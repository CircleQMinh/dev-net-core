---
id: access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns
topic: Production data access, API clients, and frontend auth
subtopic: Access tokens, refresh tokens, expiration handling, retrying original requests, and refresh-token queue patterns
category: React
---

## Overview

Access tokens and refresh tokens are the core credentials used by many modern React applications that call protected APIs. The access token is presented to the API to authorize a request. The refresh token is used to obtain a new access token when the current access token expires or becomes invalid.

This topic matters because frontend auth bugs are easy to create and painful in production. A weak implementation can log users out unnecessarily, send stale tokens, retry requests forever, create multiple simultaneous refresh calls, expose tokens to attackers, or accidentally treat an authorization failure as an expired session.

In React apps, token handling usually appears in API clients, Axios interceptors, RTK Query base queries, route loaders, and auth state providers. The UI needs clear behavior for normal requests, expired access tokens, refresh success, refresh failure, logout, and concurrent requests that fail at the same time.

For interviews, this topic is important because it tests practical security and async control flow. Strong candidates can explain token lifetimes, bearer-token risk, refresh-token rotation, retrying the original request, and queueing failed requests behind one refresh operation.

## Core Concepts

### Access Tokens

An access token is a credential that allows a client to access protected resources. In browser-based React apps, it is often sent to an API using the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOi...
```

Important properties:

- It represents granted authorization.
- It usually has a limited lifetime.
- It may contain scopes or permissions.
- It may be opaque or formatted as a JWT.
- It should be sent only to the intended API.
- It must not be logged.
- Anyone who has a bearer token can use it unless additional sender constraints are used.

The frontend should treat access tokens as sensitive credentials, not as harmless user profile data.

### Refresh Tokens

A refresh token is used to request a new access token. Refresh tokens are usually longer-lived and more sensitive than access tokens because they can mint new access tokens.

Common refresh-token behavior:

- The client sends the refresh token to an authorization server or auth endpoint.
- The server validates it.
- The server returns a new access token.
- The server may also return a new refresh token.
- The client replaces old token values.

Example refresh response:

```json
{
  "accessToken": "new-access-token",
  "refreshToken": "new-refresh-token",
  "expiresIn": 900
}
```

When refresh-token rotation is used, the old refresh token must be discarded after the server issues a new one.

### Bearer Token Risk

Most access tokens used by browser apps are bearer tokens. A bearer token grants access to whoever presents it.

Risk implications:

- XSS can steal JavaScript-accessible tokens.
- Logs can leak tokens.
- Browser extensions can sometimes inspect app data.
- Sending tokens to the wrong origin leaks credentials.
- Tokens in URLs can leak through history, referrers, screenshots, and logs.

Practical rules:

- Send tokens in headers, not query strings.
- Use HTTPS.
- Never log tokens.
- Scope tokens narrowly.
- Keep access token lifetime short.
- Prefer secure server-side or cookie-based refresh designs when the architecture supports them.

### Expiration Handling

Access token expiration can be handled reactively or proactively.

Reactive handling means:

- Send request.
- API returns `401 Unauthorized`.
- Client attempts refresh.
- If refresh succeeds, retry the original request.
- If refresh fails, log out or require sign-in.

Proactive handling means:

- Track token expiration time.
- Refresh shortly before expiration.
- Avoid predictable `401` failures during active work.

Both approaches are common. Reactive handling is simpler and should still exist because a token can be revoked before its timestamp expires. Proactive handling can improve UX but must handle clock skew, background tab throttling, and refresh failure.

Example expiration helper:

```ts
function shouldRefreshSoon(expiresAtMs: number, skewMs = 60_000) {
  return Date.now() + skewMs >= expiresAtMs;
}
```

Do not rely only on decoding a JWT on the client. The server is the authority on whether a token is valid.

### Status Codes: `401` vs `403`

Token refresh logic should usually respond to `401 Unauthorized`, not every auth-related failure.

Typical meaning:

- `401`: the request is unauthenticated or the credentials are invalid or expired.
- `403`: the user is authenticated but not allowed to perform the action.

Refreshing a token will not fix missing permissions. A `403` should usually produce an authorization UX, not a refresh attempt.

Also avoid refreshing on:

- `400` validation errors.
- `404` missing resources.
- `409` conflicts.
- `429` rate limiting unless the auth server specifically requires a different flow.
- `5xx` server failures unless the token endpoint itself is being retried carefully.

### Retrying the Original Request

The standard user-friendly flow is:

- API request fails with `401`.
- Client refreshes the access token.
- Client stores the new token.
- Client retries the original request once.
- UI receives the successful response as if the token had been valid.

Axios-style example:

```ts
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const tokens = await refreshTokens();
    tokenStore.set(tokens);
    originalRequest.headers.set(
      "Authorization",
      `Bearer ${tokens.accessToken}`,
    );

    return api(originalRequest);
  },
);
```

The `_retry` guard prevents infinite loops if the retried request also returns `401`.

### Refresh-Token Queue Pattern

When an access token expires, many API calls may fail at nearly the same time. Without coordination, each request may try to refresh.

Problems this causes:

- Too many refresh requests.
- Race conditions when refresh-token rotation is enabled.
- Older refresh responses overwriting newer tokens.
- Some original requests retrying with stale tokens.
- Users being logged out even though one refresh succeeded.

A refresh-token queue pattern ensures one refresh operation runs while other failed requests wait.

Shared promise example:

```ts
let refreshPromise: Promise<AuthTokens> | null = null;

async function getFreshTokens() {
  if (!refreshPromise) {
    refreshPromise = refreshTokens().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}
```

Axios interceptor using the shared promise:

```ts
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const tokens = await getFreshTokens();
      tokenStore.set(tokens);
      originalRequest.headers.set(
        "Authorization",
        `Bearer ${tokens.accessToken}`,
      );

      return api(originalRequest);
    } catch (refreshError) {
      authEvents.emit("sessionExpired");
      return Promise.reject(refreshError);
    }
  },
);
```

All requests share one refresh result. After it resolves, each original request can retry with the new token.

### Queue Pattern with Subscribers

Some apps implement a subscriber queue instead of a shared promise.

Conceptually:

- First failed request starts refresh.
- Later failed requests register callbacks.
- When refresh succeeds, callbacks receive the new token.
- When refresh fails, callbacks reject and the user is logged out.

Simplified example:

```ts
let isRefreshing = false;
let waitingRequests: Array<(token: string) => void> = [];

function subscribeToRefresh(callback: (token: string) => void) {
  waitingRequests.push(callback);
}

function notifyWaitingRequests(token: string) {
  waitingRequests.forEach((callback) => callback(token));
  waitingRequests = [];
}
```

In modern TypeScript, a shared promise is often simpler and easier to test. The key idea is the same: coordinate concurrent failures behind one refresh operation.

### RTK Query Mutex Pattern

In RTK Query, token refresh is often implemented by wrapping `fetchBaseQuery`.

```ts
const rawBaseQuery = fetchBaseQuery({
  baseUrl: "/api",
  prepareHeaders: (headers, { getState }) => {
    const token = selectAccessToken(getState() as RootState);

    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    return headers;
  },
});
```

Use a mutex so only one refresh runs:

```ts
const mutex = new Mutex();

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  await mutex.waitForUnlock();

  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();

      try {
        const refreshResult = await rawBaseQuery(
          { url: "/auth/refresh", method: "POST" },
          api,
          extraOptions,
        );

        if (refreshResult.data) {
          api.dispatch(tokenReceived(refreshResult.data as AuthTokens));
          result = await rawBaseQuery(args, api, extraOptions);
        } else {
          api.dispatch(loggedOut());
        }
      } finally {
        release();
      }
    } else {
      await mutex.waitForUnlock();
      result = await rawBaseQuery(args, api, extraOptions);
    }
  }

  return result;
};
```

This pattern fits RTK Query because failed queries retry through the same base query after token state changes.

### Refresh Token Rotation

Refresh-token rotation means the server issues a new refresh token when a refresh succeeds and invalidates the previous one.

Why it matters:

- A stolen old refresh token becomes less useful.
- Reuse of an invalidated refresh token can indicate token theft.
- The server can revoke the token family after suspected replay.

Frontend implications:

- Replace the stored refresh token atomically.
- Do not allow parallel refresh calls.
- If refresh succeeds but token storage fails, treat the session carefully.
- If the server reports refresh-token reuse, force reauthentication.

Queueing is especially important with rotation. Two parallel refresh calls using the same old refresh token can cause one to succeed and the other to look like token replay.

### Storage Trade-Offs

Token storage is a separate deep topic, but it affects refresh behavior.

Common approaches:

- Access token in memory, refresh token in secure `HttpOnly` cookie.
- Both tokens in secure cookies with backend CSRF protection.
- Access token in memory and refresh handled by a backend-for-frontend.
- Tokens in browser storage, which is simpler but exposed to XSS.

No storage option removes all risk. Cookie-based auth reduces JavaScript token theft but introduces CSRF considerations. JavaScript-readable tokens are easier to attach to headers but increase XSS impact.

The interview answer should connect storage to the threat model, not claim one universal solution.

### Logout and Refresh Failure

Refresh can fail for legitimate reasons:

- Refresh token expired.
- Refresh token was revoked.
- User changed password.
- User was disabled.
- Token family was revoked.
- Network request failed repeatedly.
- Auth server is unavailable.

When refresh fails definitively, the app should:

- Clear auth state.
- Stop retrying original requests.
- Clear or reset sensitive cached data.
- Redirect to sign-in or show a session-expired message.
- Avoid showing stale privileged data.

Network failures are more nuanced. Some apps show a temporary offline state instead of immediate logout if the refresh token might still be valid.

### Avoiding Infinite Loops

Infinite auth loops happen when refresh logic retries requests that can only fail.

Guardrails:

- Retry the original request only once.
- Mark retried requests with `_retry` or similar metadata.
- Do not refresh for the refresh endpoint.
- Do not refresh for login or logout endpoints.
- Do not refresh on `403`.
- Stop when refresh fails.
- Clear auth state after definitive failure.

Example skip:

```ts
function isAuthEndpoint(url?: string) {
  return url?.includes("/auth/login") || url?.includes("/auth/refresh");
}
```

Auth retry code should be intentionally boring. The less surprising it is, the easier it is to debug.

### Concurrency and Race Conditions

Common race conditions:

- Two refresh calls use the same rotated refresh token.
- One request reads an old access token while another request is refreshing.
- Logout happens while a refresh request is still in flight.
- A background refresh overwrites a newer token.
- A retried request runs after the user switched accounts.

Mitigation strategies:

- Use a single refresh promise or mutex.
- Store token versions or session IDs.
- Clear pending queues on logout.
- Check the active user/session before applying refreshed tokens.
- Avoid keeping auth state in multiple unsynchronized places.

For interviews, naming these race conditions shows practical experience.

### Security Boundaries in React

React code runs in the user's browser, so it cannot safely protect secrets from the user or from successful XSS. The frontend can reduce risk, but the server must enforce authorization.

Frontend responsibilities:

- Send tokens only to trusted origins.
- Avoid logging credentials.
- Handle expiration correctly.
- Clear local auth state on logout.
- Avoid exposing privileged UI after auth failure.
- Prevent accidental duplicate refresh flows.

Server responsibilities:

- Validate tokens.
- Enforce scopes and object-level authorization.
- Rotate or constrain refresh tokens.
- Revoke tokens when needed.
- Detect refresh-token reuse.
- Set secure cookie attributes if cookies are used.

The frontend helps with UX and correct request behavior. It is not the security authority.

### Common Mistakes

Common mistakes include:

- Treating refresh tokens as harmless because they are not sent to APIs.
- Storing long-lived tokens in places exposed to XSS without understanding the risk.
- Refreshing on every `401` without checking the endpoint or retry count.
- Refreshing on `403` permission failures.
- Running many refresh requests in parallel.
- Ignoring refresh-token rotation.
- Retrying original requests with the old token.
- Forgetting to update headers before retry.
- Swallowing refresh failure and leaving the UI in a fake signed-in state.
- Logging tokens or full Axios configs.
- Trusting decoded JWT claims without server validation.

### Best Practices

Best practices include:

- Keep access tokens short-lived.
- Treat refresh tokens as high-value credentials.
- Use authorization code with PKCE for browser-based OAuth flows.
- Prefer refresh-token rotation or sender-constrained refresh tokens where available.
- Attach access tokens only to trusted API origins.
- Refresh reactively on `401` and optionally proactively near expiration.
- Retry the original request once after successful refresh.
- Use a shared promise, mutex, or queue for concurrent refresh failures.
- Clear auth state and sensitive cache on definitive refresh failure.
- Avoid logging token values.
- Test expiration, concurrent `401`, refresh success, refresh failure, logout during refresh, and rotated refresh-token behavior.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is an access token?

<!-- question:start:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-beginner-q01 -->
<!-- question-id:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

An access token is a credential used to access protected API resources. In a React app, it is commonly sent in the `Authorization` header as a bearer token. It usually has a limited lifetime and may represent scopes, permissions, or user identity.

The API must validate the token and enforce authorization. The frontend should treat the token as sensitive and send it only to trusted APIs.

##### Key Points to Mention

- Used to call protected APIs.
- Often sent as a bearer token.
- Usually short-lived.
- Must not be logged or sent to the wrong origin.
- Server validates it and enforces authorization.

<!-- question:end:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-beginner-q01 -->

#### What is a refresh token?

<!-- question:start:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-beginner-q02 -->
<!-- question-id:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A refresh token is a credential used to obtain a new access token when the current access token expires or becomes invalid. It is usually longer-lived and more sensitive than an access token because it can mint new access tokens.

Refresh tokens should be protected carefully. If refresh-token rotation is used, the client must replace the old refresh token with the new one after refresh.

##### Key Points to Mention

- Used to get new access tokens.
- Usually longer-lived.
- More sensitive than access tokens.
- May be rotated.
- Must be kept confidential.

<!-- question:end:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-beginner-q02 -->

#### What should happen when an API request returns `401` because the access token expired?

<!-- question:start:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-beginner-q03 -->
<!-- question-id:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

The client should attempt to refresh the access token. If refresh succeeds, it should store the new token, retry the original request once, and continue the user flow. If refresh fails, it should clear auth state and ask the user to sign in again or show a session-expired message.

The client should not retry forever.

##### Key Points to Mention

- Detect `401`.
- Refresh the token.
- Store the new token.
- Retry original request once.
- Logout or require sign-in if refresh fails.
- Avoid infinite retry loops.

<!-- question:end:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-beginner-q03 -->

#### What is the difference between `401` and `403`?

<!-- question:start:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-beginner-q04 -->
<!-- question-id:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`401 Unauthorized` usually means the request is not authenticated or the credentials are invalid or expired. It may be recoverable by refreshing the access token.

`403 Forbidden` usually means the user is authenticated but does not have permission to perform the action. Refreshing the token usually will not fix a permission problem.

##### Key Points to Mention

- `401` is an authentication problem.
- `403` is an authorization problem.
- Refresh usually targets `401`.
- `403` should show permission UX.
- Do not blindly refresh on every auth-related error.

<!-- question:end:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How do you retry the original request after refreshing a token?

<!-- question:start:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-intermediate-q01 -->
<!-- question-id:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

The client stores the original request config when it receives a `401`. It marks the request as already retried, calls the refresh endpoint, stores the new access token, updates the original request's authorization header, and sends the original request again.

The retry should happen once. If the retried request still fails with `401`, the client should stop retrying and handle session expiration.

##### Key Points to Mention

- Preserve original request config.
- Mark it with `_retry` or equivalent.
- Refresh token first.
- Update auth header before retry.
- Retry once.
- Stop and logout if refresh or retry fails.

<!-- question:end:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-intermediate-q01 -->

#### Why is a refresh-token queue needed?

<!-- question:start:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-intermediate-q02 -->
<!-- question-id:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A queue is needed because many requests can fail with `401` at the same time when an access token expires. Without a queue, each request may call the refresh endpoint. That can overload the auth service and break refresh-token rotation.

A queue, mutex, or shared promise lets one refresh call run while other requests wait. After refresh succeeds, waiting requests retry with the new token.

##### Key Points to Mention

- Multiple requests can fail together.
- Avoid refresh storms.
- Protect refresh-token rotation.
- Waiting requests should reuse one refresh result.
- Reduces race conditions.

<!-- question:end:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-intermediate-q02 -->

#### What is refresh-token rotation?

<!-- question:start:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-intermediate-q03 -->
<!-- question-id:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Refresh-token rotation means the server issues a new refresh token every time the client successfully refreshes. The old refresh token is invalidated. If the old token is used again, the server can treat that as possible replay or theft and revoke the token family.

The frontend must replace the old refresh token with the new one and avoid parallel refresh calls that reuse the old token.

##### Key Points to Mention

- New refresh token on each refresh.
- Old refresh token is invalidated.
- Reuse can indicate token theft.
- Client must store the replacement token.
- Parallel refresh calls can cause problems.

<!-- question:end:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-intermediate-q03 -->

#### How should a React app handle refresh failure?

<!-- question:start:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-intermediate-q04 -->
<!-- question-id:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

If refresh fails definitively, the app should clear auth state, stop retrying original requests, clear sensitive cached data, and route the user to sign in or show a session-expired message.

If the failure is a temporary network issue, the UX may show an offline or retry state instead of immediately logging out, depending on the product and security requirements.

##### Key Points to Mention

- Clear tokens and auth state.
- Stop retry loops.
- Clear sensitive cache.
- Show sign-in or session-expired UX.
- Treat network failure separately when appropriate.
- Do not leave UI in a fake authenticated state.

<!-- question:end:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design a production-safe Axios refresh-token interceptor?

<!-- question:start:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-advanced-q01 -->
<!-- question-id:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would attach the interceptor to a scoped Axios instance. On `401`, it would skip auth endpoints, check whether the original request was already retried, and then use a shared refresh promise or queue so only one refresh call runs. After refresh succeeds, it would store the new tokens, update the original request header, and retry the original request once.

If refresh fails, it would clear auth state, reject waiting requests, and emit a session-expired event. It would not swallow errors or retry `403` responses.

##### Key Points to Mention

- Scoped Axios instance.
- Skip login and refresh endpoints.
- `_retry` guard.
- Shared refresh promise or queue.
- Store tokens before retry.
- Retry once.
- Clear auth state on failure.
- Reject errors so UI can respond.

<!-- question:end:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-advanced-q01 -->

#### How would you implement token refresh in RTK Query?

<!-- question:start:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-advanced-q02 -->
<!-- question-id:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

I would wrap `fetchBaseQuery` or a custom base query. The wrapper would execute the original request, check for `401`, refresh the token if needed, dispatch an action to store the new token, and retry the original request. To handle concurrent `401` failures, I would use a mutex or shared refresh promise so only one refresh request runs.

The base query must still return `{ data }` or `{ error }` so RTK Query can track hook state correctly.

##### Key Points to Mention

- Wrap the base query.
- Use `prepareHeaders` for current token.
- Detect `401`.
- Refresh and dispatch token update.
- Retry original query.
- Use mutex for concurrent failures.
- Preserve RTK Query return shape.

<!-- question:end:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-advanced-q02 -->

#### What race conditions can happen during token refresh?

<!-- question:start:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-advanced-q03 -->
<!-- question-id:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Several requests may try to refresh at once. With refresh-token rotation, two refresh calls may use the same old refresh token, causing one to fail as a replay. An older refresh response may overwrite newer tokens. A request may retry with a stale access token. Logout can happen while refresh is still in flight.

The solution is to coordinate refresh with a queue or mutex, store tokens atomically, clear queues on logout, and verify that refreshed tokens still belong to the active session before applying them.

##### Key Points to Mention

- Parallel refresh calls.
- Rotation conflicts.
- Stale token overwrite.
- Retry with old token.
- Logout during refresh.
- Account switch during refresh.
- Use queue, mutex, session version, and clear failure paths.

<!-- question:end:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-advanced-q03 -->

#### How do token storage choices affect refresh-token design?

<!-- question:start:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-advanced-q04 -->
<!-- question-id:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

If tokens are stored in JavaScript-accessible storage, XSS can steal them, so the app must be very careful with XSS controls and token lifetimes. If refresh tokens are stored in `HttpOnly` cookies, JavaScript cannot read them directly, but the app must consider CSRF, CORS, `SameSite`, `Secure`, and credentialed requests.

The refresh strategy must match the storage model. A bearer header model usually needs the frontend to attach access tokens. A cookie-based model may let the browser send refresh credentials automatically and have the frontend call a refresh endpoint with credentials included.

##### Key Points to Mention

- JavaScript-readable tokens increase XSS impact.
- `HttpOnly` cookies reduce token theft by JavaScript.
- Cookies introduce CSRF and CORS concerns.
- Storage choice changes refresh implementation.
- Server still enforces authorization.
- No storage choice removes all risk.

<!-- question:end:access-tokens-refresh-tokens-expiration-handling-retrying-original-requests-and-refresh-token-queue-patterns-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
