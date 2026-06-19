---
id: axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior
topic: Production data access, API clients, and frontend auth
subtopic: Axios request and response interceptors for auth headers, global errors, logging, and retry behavior
category: React
---

## Overview

Axios interceptors are functions that run before a request is sent or after a response is received. They let a React application centralize cross-cutting HTTP behavior such as auth headers, error normalization, logging, request IDs, timeout handling, token refresh, and retry behavior.

Interceptors are powerful because they sit at the API client boundary. A component can call `api.get("/profile")`, while the Axios instance handles routine work around the request lifecycle.

They are also risky when used carelessly. Interceptors can hide important behavior, create infinite retry loops, leak credentials, swallow errors, duplicate logs, or register multiple times during hot reload and component renders. Good interceptor design is small, predictable, scoped to a specific Axios instance, and tested.

For interviews, this topic matters because it combines frontend architecture, authentication, async error handling, security, and production debugging. Strong candidates can explain what belongs in interceptors, what does not, and how to avoid making the API layer magical.

## Core Concepts

### What Axios Interceptors Are

Axios supports request interceptors and response interceptors.

Request interceptors run before Axios sends the request. They commonly:

- Attach auth headers.
- Add correlation IDs.
- Set tenant, locale, or version headers.
- Start request timing.
- Normalize config defaults.
- Skip behavior for specific requests.

Response interceptors run after Axios receives a response or error. They commonly:

- Return `response.data`.
- Normalize errors.
- Log failures.
- Handle `401 Unauthorized`.
- Retry selected failures.
- Trigger global notifications.
- Measure request duration.

Example:

```ts
import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  timeout: 10_000,
});

api.interceptors.request.use((config) => {
  config.headers.set("x-client", "web");
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);
```

The interceptor chain is promise-based. If an interceptor throws or returns a rejected promise, the request moves to the error path.

### Use Axios Instances Instead of Global Interceptors

Interceptors should usually be attached to an Axios instance created with `axios.create`.

Example:

```ts
export const internalApi = axios.create({
  baseURL: import.meta.env.VITE_INTERNAL_API_URL,
  timeout: 10_000,
});

export const publicApi = axios.create({
  baseURL: "https://public.example.com",
  timeout: 5_000,
});
```

Attach auth behavior only to the instance that calls the authenticated API:

```ts
internalApi.interceptors.request.use((config) => {
  const token = authStore.getAccessToken();

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});
```

This prevents accidentally sending private headers to third-party APIs. It also lets each service have different timeout, retry, logging, and error behavior.

### Request Interceptors for Auth Headers

Auth headers are one of the most common uses for request interceptors.

Good auth interceptor behavior:

- Reads the access token close to request time.
- Adds the header only when a token exists.
- Uses a scoped Axios instance.
- Skips endpoints that must not receive the token if needed.
- Avoids logging the token.

Example:

```ts
internalApi.interceptors.request.use((config) => {
  const token = tokenStore.getAccessToken();

  if (token && config.headers) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});
```

Avoid this pattern for multi-origin applications:

```ts
axios.defaults.headers.common.Authorization = `Bearer ${token}`;
```

Global defaults can send credentials to any request made through the default Axios object. A scoped instance is safer.

### Request Metadata for Logging and Timing

Interceptors can attach metadata to measure duration and correlate logs.

Example:

```ts
declare module "axios" {
  export interface InternalAxiosRequestConfig {
    metadata?: {
      startedAt: number;
      requestId: string;
    };
  }
}

api.interceptors.request.use((config) => {
  config.metadata = {
    startedAt: performance.now(),
    requestId: crypto.randomUUID(),
  };

  config.headers.set("x-request-id", config.metadata.requestId);

  return config;
});
```

Then log response duration:

```ts
api.interceptors.response.use(
  (response) => {
    const startedAt = response.config.metadata?.startedAt;
    const durationMs = startedAt ? performance.now() - startedAt : undefined;

    logHttpSuccess({
      method: response.config.method,
      url: response.config.url,
      status: response.status,
      durationMs,
    });

    return response;
  },
  (error) => {
    logHttpFailure(toLogEvent(error));
    return Promise.reject(error);
  },
);
```

Logging should redact sensitive data. Do not log `Authorization`, cookies, refresh tokens, passwords, or full request bodies that may contain personal data.

### Response Interceptors for Data Unwrapping

Some teams use response interceptors to return `response.data` directly.

Example:

```ts
api.interceptors.response.use((response) => response.data);
```

This can reduce boilerplate, but it has trade-offs:

- Callers lose direct access to status, headers, and config unless the type system and API shape account for it.
- It can make the Axios instance behave differently from normal Axios.
- TypeScript declarations may need customization.

An alternative is to unwrap data in service functions:

```ts
export async function getProfile() {
  const response = await api.get<UserProfile>("/me");
  return response.data;
}
```

This is more explicit and often easier to type.

### Response Interceptors for Error Normalization

Response error interceptors can convert Axios errors into application-specific errors.

Example:

```ts
export class HttpClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const data = error.response?.data as { message?: string } | undefined;

    return Promise.reject(
      new HttpClientError(
        data?.message ?? error.message,
        status,
        error.code,
        data,
      ),
    );
  },
);
```

This lets UI code handle predictable error types instead of checking `error.response`, `error.request`, `error.code`, and backend-specific response shapes everywhere.

### Global Error Handling

Response interceptors are useful for global error handling, but not every error should become a global toast or redirect.

Good global handling examples:

- Redirect or publish an auth event for expired sessions.
- Show a network offline banner for network failures.
- Log unexpected `5xx` responses.
- Capture correlation IDs for support.

Poor global handling examples:

- Showing a toast for every validation error.
- Redirecting on every `403`, even when the current screen can explain the permission issue.
- Swallowing errors so components think the request succeeded.
- Logging expected `404` responses as critical incidents.

A good pattern is to normalize and publish global events, while still rejecting the error so feature code can decide local UX.

```ts
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalized = normalizeAxiosError(error);

    if (normalized.status === 401) {
      authEvents.emit("sessionExpired");
    }

    if (normalized.isNetworkError) {
      networkEvents.emit("requestFailed");
    }

    return Promise.reject(normalized);
  },
);
```

### Retry Behavior in Interceptors

Retries can be implemented in an interceptor, but they must be constrained.

Retry only when:

- The request is safe or idempotent.
- The failure is likely transient.
- The retry count is limited.
- There is delay or backoff.
- The request has not been intentionally canceled.
- The server did not return a non-retryable status.

Example:

```ts
type RetryConfig = InternalAxiosRequestConfig & {
  _retryCount?: number;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error) || !error.config) {
      return Promise.reject(error);
    }

    const config = error.config as RetryConfig;
    const status = error.response?.status;
    const method = config.method?.toUpperCase();
    const retryCount = config._retryCount ?? 0;
    const canRetryMethod = method === "GET" || method === "HEAD";
    const canRetryStatus = !status || status === 408 || status === 429 || status >= 500;

    if (retryCount >= 2 || !canRetryMethod || !canRetryStatus) {
      return Promise.reject(error);
    }

    config._retryCount = retryCount + 1;
    await delay(500 * 2 ** retryCount);

    return api(config);
  },
);
```

Do not blindly retry `POST`, `PATCH`, or `DELETE` unless the operation is idempotent or protected by idempotency keys.

### Token Refresh and Retrying Original Requests

One advanced use case is refreshing an expired access token after a `401` and then retrying the original request.

The basic flow:

- Request fails with `401`.
- If it was not already retried, start or join a refresh-token request.
- Save the new access token.
- Update the original request header.
- Retry the original request once.
- If refresh fails, clear auth state and send the user to sign in.

Example:

```ts
let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error) || !error.config) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      refreshPromise ??= refreshAccessToken();
      const newToken = await refreshPromise;
      tokenStore.setAccessToken(newToken);
      originalRequest.headers.set("Authorization", `Bearer ${newToken}`);

      return api(originalRequest);
    } catch (refreshError) {
      authEvents.emit("sessionExpired");
      return Promise.reject(refreshError);
    } finally {
      refreshPromise = null;
    }
  },
);
```

This prevents a burst of requests from triggering many refresh calls at once. Production implementations should also skip refresh logic for login and refresh endpoints themselves.

### Avoiding Infinite Loops

Interceptor retry loops happen when a retried request goes through the same interceptor and meets the retry condition again.

Prevention techniques:

- Add `_retry` or `_retryCount` metadata.
- Skip retry for auth endpoints.
- Limit retry count.
- Use separate Axios instance for token refresh if needed.
- Reject when refresh fails.
- Do not retry canceled requests.
- Do not retry validation or authorization failures.

Example skip:

```ts
if (originalRequest.url?.includes("/auth/refresh")) {
  return Promise.reject(error);
}
```

Retry logic must be deliberately boring. Fancy hidden retry behavior is one of those things that looks elegant until production traffic makes it confusing.

### Interceptor Registration and Cleanup

Interceptors should be registered once near the API client setup, not inside React components.

Bad pattern:

```tsx
function ProfilePage() {
  api.interceptors.response.use(handleResponse, handleError);
  return <Profile />;
}
```

This registers a new interceptor on every render and can cause duplicated behavior.

If an interceptor must be temporary, store its ID and eject it:

```ts
const interceptorId = api.interceptors.response.use(handleResponse, handleError);

api.interceptors.response.eject(interceptorId);
```

Most app-level interceptors should be created once during module initialization.

### Interceptor Execution Order

Request and response interceptors do not behave the same way.

In Axios:

- Request interceptors run in reverse order of registration.
- Response interceptors run in registration order.
- Each interceptor receives the result of the previous step.
- A thrown error moves the chain to the rejection path.

This matters when combining auth, logging, retry, and normalization. For example, if one response interceptor converts an Axios error to a custom error, a later interceptor that expects `axios.isAxiosError(error)` may no longer work.

Keep the chain intentionally ordered:

- Request: metadata, auth, final config validation.
- Response success: timing/logging, optional data unwrap.
- Response error: retry/token refresh, error normalization, global events/logging.

### What Not to Put in Interceptors

Not everything belongs in an interceptor.

Avoid putting these in interceptors:

- Feature-specific UI messages.
- Component navigation decisions that depend on local context.
- Business rules for a single endpoint.
- Complex data transformations that belong in service functions.
- Validation error rendering.
- Broad mutation retry behavior.
- Silent fallback data that makes failures invisible.

Interceptors are best for cross-cutting transport concerns. Feature behavior should remain close to the feature.

### Common Mistakes

Common mistakes include:

- Registering interceptors inside components.
- Using global Axios interceptors for all services.
- Sending auth headers to untrusted domains.
- Not ejecting temporary interceptors.
- Retrying all methods automatically.
- Retrying without a retry limit.
- Forgetting to mark retried requests.
- Running token refresh for the refresh endpoint itself.
- Swallowing errors instead of rejecting them.
- Logging secrets from headers or request bodies.
- Assuming interceptor order does not matter.

### Best Practices

Best practices include:

- Use `axios.create` for scoped clients.
- Register interceptors once.
- Keep interceptors small and composable.
- Attach auth headers at request time.
- Normalize errors into one app-level shape.
- Redact sensitive data in logs.
- Retry only safe or explicitly idempotent operations.
- Limit retries and use backoff.
- Use a refresh queue or shared refresh promise for token refresh.
- Let feature code handle local validation and business errors.
- Test interceptor behavior with success, failure, retry, cancellation, and auth-refresh cases.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is an Axios interceptor?

<!-- question:start:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-beginner-q01 -->
<!-- question-id:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

An Axios interceptor is a function that runs during the request or response lifecycle. A request interceptor runs before the request is sent. A response interceptor runs after Axios receives a response or an error.

Interceptors are used for cross-cutting concerns such as auth headers, logging, error normalization, and retry behavior.

##### Key Points to Mention

- Request interceptors modify or inspect outgoing config.
- Response interceptors process successful responses or errors.
- They are promise-based.
- They should return config, response, or a rejected promise.
- They are best used for shared HTTP concerns.

<!-- question:end:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-beginner-q01 -->

#### Why should Axios interceptors usually be attached to an Axios instance?

<!-- question:start:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-beginner-q02 -->
<!-- question-id:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Attaching interceptors to a scoped Axios instance limits their behavior to a specific backend service. This is safer than using global interceptors because auth headers, retries, logging, and error handling may differ between internal APIs and third-party APIs.

A scoped instance also avoids accidentally sending credentials or internal headers to the wrong domain.

##### Key Points to Mention

- Use `axios.create`.
- Scope behavior by `baseURL`.
- Avoid credential leakage.
- Different services may need different policies.
- Global defaults are risky in multi-origin apps.

<!-- question:end:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-beginner-q02 -->

#### What should a request interceptor return?

<!-- question:start:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-beginner-q03 -->
<!-- question-id:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A request interceptor should return the request config or a promise that resolves to the request config. If it cannot continue, it can throw or return a rejected promise.

For example, an auth interceptor might add an `Authorization` header and return the updated config.

##### Key Points to Mention

- Return the config to continue the request.
- Throw or reject to stop the request.
- Async interceptors can await token lookup if necessary.
- Avoid mutating unrelated global state.

<!-- question:end:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-beginner-q03 -->

#### What is one common mistake when using interceptors in React?

<!-- question:start:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-beginner-q04 -->
<!-- question-id:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A common mistake is registering interceptors inside React components. If the component renders multiple times, the app may register multiple interceptors and duplicate behavior such as logging, retries, or error toasts.

Interceptors should usually be registered once when the API client module is initialized. If a temporary interceptor is needed, its ID should be ejected during cleanup.

##### Key Points to Mention

- Avoid registering interceptors on every render.
- Register app-level interceptors once.
- Use `eject` for temporary interceptors.
- Duplicated interceptors cause repeated side effects.

<!-- question:end:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you add an auth header with an Axios request interceptor?

<!-- question:start:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-intermediate-q01 -->
<!-- question-id:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

I would create a scoped Axios instance for the trusted API and attach a request interceptor that reads the current access token close to request time. If a token exists, the interceptor sets the `Authorization` header and returns the config.

I would avoid global Axios defaults because they may send the token to the wrong host.

##### Key Points to Mention

- Use an Axios instance with a trusted `baseURL`.
- Read the token at request time.
- Attach `Authorization: Bearer <token>` only when present.
- Do not log the token.
- Avoid sending auth headers to third-party APIs.

<!-- question:end:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-intermediate-q01 -->

#### How should global error handling work in a response interceptor?

<!-- question:start:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-intermediate-q02 -->
<!-- question-id:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A response interceptor can normalize errors and trigger global events for cross-cutting cases, such as session expiration or network failure. It should usually reject the normalized error afterward so feature code can still handle local UI decisions.

It should not show global messages for every validation error or swallow failures. Expected field errors usually belong near the form fields, not in a global toast.

##### Key Points to Mention

- Normalize errors into a predictable shape.
- Trigger global auth or network events when appropriate.
- Reject the error so callers can respond.
- Avoid noisy global toasts for expected errors.
- Log unexpected failures with redaction.

<!-- question:end:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-intermediate-q02 -->

#### How should retry behavior be constrained in an Axios interceptor?

<!-- question:start:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-intermediate-q03 -->
<!-- question-id:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Retry behavior should be limited to failures that are likely transient and requests that are safe to retry. A retry interceptor should check the method, status code, cancellation state, and retry count. It should use a delay or backoff and must mark the request so it does not retry forever.

Blindly retrying all requests is dangerous, especially for non-idempotent mutations like `POST` or payment operations.

##### Key Points to Mention

- Limit retry count.
- Use backoff or delay.
- Retry safe methods like `GET` more readily than mutations.
- Check transient statuses such as `408`, `429`, and `5xx`.
- Do not retry canceled requests.
- Use idempotency keys for retryable mutations.

<!-- question:end:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-intermediate-q03 -->

#### What should be logged from Axios interceptors?

<!-- question:start:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-intermediate-q04 -->
<!-- question-id:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Interceptors can log useful operational information such as method, URL path, status code, duration, request ID, error code, and correlation ID. This helps debug slow requests and failures.

Logs should redact sensitive data. They should not include access tokens, cookies, refresh tokens, passwords, or personal data from request bodies. Logging should also avoid reporting expected errors as severe incidents.

##### Key Points to Mention

- Log method, path, status, duration, and request ID.
- Redact secrets and personal data.
- Do not log full auth headers.
- Use severity based on error type.
- Include correlation IDs when available.

<!-- question:end:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you implement token refresh with Axios interceptors?

<!-- question:start:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-advanced-q01 -->
<!-- question-id:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would handle `401` responses in a response interceptor. If the original request has not already been retried, the interceptor starts or joins a single shared refresh-token request. When refresh succeeds, it stores the new access token, updates the original request header, and retries the original request once.

If refresh fails, it clears auth state and emits a session-expired event or redirects to sign in. The refresh endpoint itself must be excluded from the interceptor to avoid infinite loops.

##### Key Points to Mention

- Detect `401`.
- Mark original request with `_retry`.
- Use a shared refresh promise or queue.
- Retry the original request once with the new token.
- Skip refresh logic for auth endpoints.
- Clear auth state if refresh fails.

<!-- question:end:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-advanced-q01 -->

#### How can interceptor order affect behavior?

<!-- question:start:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-advanced-q02 -->
<!-- question-id:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Interceptor order matters because request interceptors and response interceptors run in different orders. Request interceptors run in reverse order of registration, while response interceptors run in registration order. Each interceptor receives the result of the previous step.

If an error normalization interceptor runs before a retry interceptor, the retry interceptor may no longer see an Axios error. If logging runs before metadata is attached, duration cannot be measured. The chain should be intentionally ordered and tested.

##### Key Points to Mention

- Request interceptors run last-in, first-out.
- Response interceptors run first-in, first-out.
- Throwing moves to the error path.
- Retry should usually see the original Axios error.
- Normalization can change what later interceptors receive.

<!-- question:end:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-advanced-q02 -->

#### What are the risks of doing too much in Axios interceptors?

<!-- question:start:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-advanced-q03 -->
<!-- question-id:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Doing too much in interceptors makes network behavior hard to understand. Interceptors can hide business rules, trigger unexpected navigation, show duplicate global errors, retry unsafe mutations, swallow failures, or transform response data in ways callers do not expect.

Interceptors should handle cross-cutting transport concerns. Feature-specific decisions should stay in service functions, hooks, or components where the context is visible.

##### Key Points to Mention

- Hidden behavior makes debugging harder.
- Feature-specific UI does not belong in global interceptors.
- Unsafe retries can duplicate mutations.
- Swallowed errors create false success states.
- Keep interceptors small and predictable.

<!-- question:end:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-advanced-q03 -->

#### How would you test Axios interceptor behavior?

<!-- question:start:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-advanced-q04 -->
<!-- question-id:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

I would test the configured Axios instance through network mocks or adapter mocks. Tests should verify that auth headers are attached only for the intended instance, errors are normalized, logging redacts secrets, retries happen only for allowed methods and statuses, retry count is limited, cancellation is respected, and token refresh retries the original request once.

I would also test failure paths, such as refresh failure, repeated `401`, network errors, and non-retryable validation errors.

##### Key Points to Mention

- Test the configured instance, not just isolated functions.
- Verify auth scoping.
- Verify normalized error shapes.
- Verify retry limits and skip conditions.
- Verify refresh queue behavior.
- Verify secrets are not logged.

<!-- question:end:axios-request-and-response-interceptors-for-auth-headers-global-errors-logging-and-retry-behavior-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
