---
id: browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies
topic: Production data access, API clients, and frontend auth
subtopic: Browser storage trade-offs: localStorage, sessionStorage, memory storage, and cookies
category: React
---

## Overview

Browser storage trade-offs are about choosing where a React application keeps client-side state, preferences, cached data, and authentication-related values. The common options are `localStorage`, `sessionStorage`, in-memory state, and cookies. Each option has different behavior for persistence, tab isolation, JavaScript access, automatic request inclusion, security, and user experience.

This topic matters because storage decisions often become security decisions. A token placed in `localStorage` is easy to read and attach to headers, but it is also easy for injected JavaScript to steal. A cookie can be protected from JavaScript with `HttpOnly`, but cookies are sent automatically by the browser and can introduce CSRF concerns. Memory storage avoids disk persistence, but it disappears on refresh and requires careful session recovery.

In React apps, storage choices appear in auth providers, API clients, RTK Query base queries, Axios interceptors, route guards, theme settings, feature flags, form drafts, and offline-friendly experiences. Interviewers ask about this topic because it shows whether a candidate can connect frontend convenience with a realistic browser threat model.

The practical goal is not to memorize one universal answer. The goal is to match storage to data sensitivity, required lifetime, cross-tab behavior, server auth model, and recovery UX.

## Core Concepts

### Browser Storage Threat Model

Browser storage is client-controlled. Anything stored in the browser should be treated as readable or modifiable by the user, browser extensions, malware on the device, or injected JavaScript if the application has an XSS vulnerability.

Important questions:

- Is the value sensitive?
- Does the value grant access?
- Does it need to survive refresh?
- Does it need to survive browser restart?
- Should it be shared across tabs?
- Should JavaScript be able to read it?
- Should the browser automatically send it to the server?
- What happens if the value is stale, deleted, or modified?

Good storage design starts with these questions instead of starting with a favorite API.

### `localStorage`

`localStorage` is a browser key-value store scoped to an origin. Its data persists across browser sessions until explicitly cleared by code, the user, browser policy, or storage eviction behavior.

Example:

```ts
localStorage.setItem("theme", "dark");

const theme = localStorage.getItem("theme");

localStorage.removeItem("theme");
```

Common uses:

- Theme preference.
- Dismissed onboarding banners.
- Non-sensitive feature preferences.
- Small cached UI hints.
- Last selected workspace or region identifier.

Strengths:

- Simple API.
- Persists after refresh and browser restart.
- Shared across tabs for the same origin.
- Useful for non-sensitive preferences.

Risks:

- Accessible to any JavaScript running on the origin.
- Exposed by XSS.
- Not automatically encrypted by the web platform.
- Synchronous API can block the main thread if abused.
- Values are strings, so objects need serialization.
- All apps on the same origin share visibility.

`localStorage` should not be treated as a secure place for session identifiers, refresh tokens, or other credentials.

### `sessionStorage`

`sessionStorage` is similar to `localStorage`, but it is scoped to a browser tab or page session. Data normally lasts until the tab or browsing context closes.

Example:

```ts
sessionStorage.setItem("checkoutStep", "shipping");

const checkoutStep = sessionStorage.getItem("checkoutStep");
```

Common uses:

- In-progress wizard state.
- Temporary UI state for a single tab.
- Non-sensitive form recovery during one tab session.
- Return path after login in a specific tab.

Strengths:

- Does not persist as long as `localStorage`.
- Usually isolated per tab.
- Good for temporary, tab-specific state.

Risks:

- Still accessible to JavaScript.
- Still exposed by XSS.
- Lost when the tab closes.
- Not a secure token store.
- Can be awkward for multi-tab workflows.

`sessionStorage` reduces persistence, but it does not make sensitive data safe from injected scripts.

### Memory Storage

Memory storage means keeping values in JavaScript memory, such as React state, module-level variables, Redux state, Zustand state, or TanStack Query cache.

Example:

```ts
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}
```

Common uses:

- Short-lived access tokens.
- Current user object.
- In-flight request state.
- UI state that should reset on refresh.
- Sensitive values that should not persist to disk.

Strengths:

- Cleared on full page reload.
- Not persisted to disk by the app.
- Not shared across browser restarts.
- Reduces long-term exposure compared with persistent storage.

Risks:

- Still accessible to injected JavaScript running in the page.
- Lost on refresh.
- Not shared across tabs unless explicitly synchronized.
- Requires session restoration strategy.
- Can produce confusing UX after reload if the server session still exists.

Memory storage is often a reasonable place for short-lived access tokens when refresh is handled by an `HttpOnly` cookie or backend session.

### Cookies

Cookies are small pieces of data stored by the browser and sent automatically with matching HTTP requests. They are usually set by the server using the `Set-Cookie` response header.

Example:

```http
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
```

Common uses:

- Server-managed session IDs.
- Refresh-token cookies.
- CSRF tokens when JavaScript must read the token.
- Small user preferences.
- A/B test bucketing.

Strengths:

- Can be marked `HttpOnly` so JavaScript cannot read them.
- Can be restricted to HTTPS with `Secure`.
- Can restrict cross-site sending behavior with `SameSite`.
- Automatically sent by the browser to matching requests.
- Works well with server-side session validation.

Risks:

- Automatically sent cookies can create CSRF risk.
- Size limits are much smaller than Web Storage.
- Cookies are sent on every matching request, adding overhead.
- Misconfigured `Domain` and `Path` can broaden exposure.
- JavaScript cannot read `HttpOnly` cookies, so client code needs a different way to know auth state.

Cookies are not automatically secure. Their safety depends heavily on cookie flags, server validation, CSRF defenses, CORS, and HTTPS.

### Cookies vs Web Storage

Cookies and Web Storage behave very differently.

`localStorage` and `sessionStorage`:

- Are read and written by JavaScript.
- Are not automatically sent with HTTP requests.
- Are scoped by origin.
- Can store more data than cookies.
- Are poor choices for secrets because XSS can read them.

Cookies:

- Are included automatically in matching HTTP requests.
- Can be set and controlled by the server.
- Can be hidden from JavaScript with `HttpOnly`.
- Have security attributes such as `Secure` and `SameSite`.
- Can create CSRF risk because they are automatically sent.

The trade-off is sharp: Web Storage is convenient for JavaScript-controlled data, while cookies are better for server-controlled session credentials when configured carefully.

### XSS Risk

Cross-site scripting changes the storage decision. If an attacker can run JavaScript in the app, that script can read `localStorage`, read `sessionStorage`, inspect memory state available to the page, and call APIs as the user.

`HttpOnly` cookies reduce one important XSS impact: injected JavaScript cannot directly read the cookie value. However, XSS can still perform actions as the user while the cookie is present.

Implications:

- Do not store long-lived credentials in Web Storage.
- Use output encoding and avoid dangerous HTML rendering.
- Use Content Security Policy where appropriate.
- Treat all client-side storage as untrusted input when reading it.
- Do not trust values from storage for authorization.

Storage choices reduce risk; they do not replace XSS prevention.

### CSRF Risk

Cross-site request forgery matters when authentication credentials are sent automatically by the browser, as with cookies.

If an API relies on cookies for authentication, a malicious site may be able to trigger a request from the user's browser unless defenses are in place.

Common defenses:

- `SameSite=Lax` or `SameSite=Strict` when compatible with product flows.
- CSRF tokens for unsafe requests.
- Origin and Referer validation on the server.
- Avoiding unsafe side effects in `GET` requests.
- CORS configured to trusted origins only.

Bearer tokens stored in memory or Web Storage and manually attached to headers are not automatically sent cross-site, so the CSRF risk model is different. But those tokens are more exposed to XSS if JavaScript can read them.

### Persistence and User Experience

Storage lifetime affects UX.

`localStorage`:

- Best persistence.
- Survives restart.
- Good for preferences.
- Risky for credentials.

`sessionStorage`:

- Survives reload in the same tab.
- Usually clears when tab closes.
- Good for temporary flow state.

Memory:

- Clears on refresh.
- Good for sensitive short-lived data.
- Requires session restoration.

Cookie:

- Lifetime controlled by `Expires`, `Max-Age`, or session behavior.
- Can support server-managed login across refreshes.
- Can be `HttpOnly` for safer credential storage.

Good UX usually combines storage types. For example, a React app might keep the access token in memory, keep the refresh session in an `HttpOnly` cookie, and store only theme preference in `localStorage`.

### Cross-Tab Behavior

Storage choices behave differently across tabs.

`localStorage` is shared across tabs for the same origin and can emit a `storage` event in other tabs.

Example:

```ts
window.addEventListener("storage", (event) => {
  if (event.key === "logout") {
    clearAuthState();
  }
});

function broadcastLogout() {
  localStorage.setItem("logout", String(Date.now()));
}
```

`sessionStorage` is tab-specific. Memory state is also tab-specific. Cookies are shared by matching requests across tabs because the browser cookie jar is shared.

For auth, cross-tab consistency matters. If the user logs out in one tab, other tabs should not continue showing privileged UI.

### Server Authority

The server must be the authority for authentication and authorization. Client storage can remember hints, but it cannot prove permission.

Unsafe examples:

```ts
const isAdmin = localStorage.getItem("role") === "admin";
```

Better approach:

- Server validates session or token.
- Server returns the current user and permissions.
- UI uses that data to render affordances.
- Server still enforces every protected operation.

Storage values can be modified by the user. Never use browser storage as an authorization boundary.

### Storage for Authentication

Common auth storage patterns:

- Access token in memory, refresh cookie as `HttpOnly`, `Secure`, and `SameSite`.
- Server session cookie with backend-managed session state.
- Bearer access token in memory, refreshed by a backend-for-frontend.
- Token in Web Storage for simpler SPAs, accepted only with a clear understanding of XSS risk.

A strong interview answer avoids claiming that one pattern is always perfect. It explains the risk trade-offs:

- Web Storage is easy but exposed to JavaScript.
- Cookies can protect values from JavaScript but need CSRF defenses.
- Memory reduces persistence but requires refresh and recovery.
- Server-side sessions reduce frontend token handling but require backend session management.

### Storage for Non-Auth Data

Good `localStorage` candidates:

- Theme.
- Locale.
- Table density.
- Dismissed tips.
- Recently selected non-sensitive IDs.

Good `sessionStorage` candidates:

- In-progress wizard step.
- Temporary return URL.
- Non-sensitive form draft for one tab.

Good memory candidates:

- Modal state.
- Current page filters when URL persistence is not needed.
- In-flight request state.
- Sensitive temporary values.

Good cookie candidates:

- Server session ID.
- Refresh token managed by server.
- Small server-needed preference.

For larger structured client caches, IndexedDB is often a better fit than Web Storage, but it has similar XSS and local-device trust concerns.

### Logout and Cleanup

Logout should clear all relevant client state.

Typical logout flow:

```ts
async function logout() {
  await api.post("/auth/logout");
  queryClient.clear();
  sessionStorage.clear();
  localStorage.removeItem("returnTo");
  setAccessToken(null);
}
```

If auth uses cookies, the server must expire the cookie. JavaScript cannot delete an `HttpOnly` cookie directly.

Important cleanup targets:

- In-memory access token.
- User profile state.
- Query cache with sensitive data.
- `sessionStorage` flow state.
- Non-sensitive `localStorage` auth hints.
- Cross-tab logout notification.

Do not rely only on hiding UI. Clear cached sensitive data too.

### Common Mistakes

Common mistakes include:

- Storing refresh tokens in `localStorage`.
- Assuming `sessionStorage` is secure because it is temporary.
- Trusting roles or permissions read from browser storage.
- Forgetting that all apps on the same origin share Web Storage.
- Keeping sensitive query cache after logout.
- Using cookies without `HttpOnly`, `Secure`, and a thoughtful `SameSite` value.
- Ignoring CSRF when using cookie-based auth.
- Breaking refresh UX by storing access tokens only in memory without a recovery path.
- Reading browser storage during server rendering without guards.
- Failing to synchronize logout across tabs.

### Best Practices

Best practices include:

- Store only non-sensitive preferences in `localStorage`.
- Use `sessionStorage` for temporary, tab-scoped, non-sensitive data.
- Keep short-lived sensitive values in memory when possible.
- Prefer `HttpOnly`, `Secure` cookies for server-managed session credentials.
- Add CSRF defenses when cookies authenticate unsafe requests.
- Keep access tokens short-lived.
- Treat storage values as untrusted input.
- Clear sensitive caches on logout.
- Use different subdomains for unrelated apps that need storage isolation.
- Guard browser-only storage access during SSR or tests.
- Choose storage based on lifetime, sensitivity, and request behavior.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is `localStorage` used for in a React application?

<!-- question:start:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-beginner-q01 -->
<!-- question-id:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

`localStorage` is used to persist small key-value data for an origin across browser sessions. In React apps, it is a reasonable choice for non-sensitive preferences such as theme, locale, dismissed banners, or simple UI settings.

It should not be treated as secure storage. Any JavaScript running on the same origin can read it, so an XSS bug can expose everything stored there.

##### Key Points to Mention

- Persists across browser sessions.
- Scoped to an origin.
- Stores strings.
- Useful for non-sensitive preferences.
- Accessible to JavaScript.
- Poor choice for secrets or refresh tokens.

<!-- question:end:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-beginner-q01 -->

#### How is `sessionStorage` different from `localStorage`?

<!-- question:start:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-beginner-q02 -->
<!-- question-id:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`sessionStorage` is scoped to a page session or tab and is usually cleared when the tab closes. `localStorage` persists across browser sessions until cleared. Both are accessible to JavaScript and both are scoped by origin.

`sessionStorage` is useful for temporary tab-specific state, while `localStorage` is better for long-lived non-sensitive preferences.

##### Key Points to Mention

- `sessionStorage` is tab/session scoped.
- `localStorage` persists longer.
- Both are JavaScript-accessible.
- Both store string values.
- Neither is safe for sensitive credentials.

<!-- question:end:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-beginner-q02 -->

#### What is memory storage?

<!-- question:start:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-beginner-q03 -->
<!-- question-id:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Memory storage means keeping data in JavaScript memory instead of persisting it to browser storage. Examples include React state, Redux state, Zustand state, module variables, or TanStack Query cache.

It is useful for short-lived data and sensitive values that should not persist to disk. The trade-off is that memory is cleared on refresh or tab close, so the app may need a session restoration strategy.

##### Key Points to Mention

- Stored in JavaScript runtime memory.
- Cleared on refresh.
- Not persisted by the app.
- Useful for short-lived access tokens.
- Still exposed to active XSS in the page.
- Requires recovery UX.

<!-- question:end:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-beginner-q03 -->

#### Why are cookies different from Web Storage?

<!-- question:start:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-beginner-q04 -->
<!-- question-id:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Cookies are automatically sent by the browser with matching HTTP requests. Web Storage is not sent automatically; JavaScript must read it and attach values manually if needed. Cookies can also use attributes such as `HttpOnly`, `Secure`, and `SameSite`.

This means cookies can work well for server-managed sessions, but they require CSRF protections. Web Storage is convenient for JavaScript-controlled values, but it is exposed to XSS.

##### Key Points to Mention

- Cookies are sent automatically.
- Web Storage is read manually by JavaScript.
- Cookies can be `HttpOnly`.
- Cookies need CSRF-aware design.
- Web Storage is exposed to JavaScript.

<!-- question:end:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why is storing tokens in `localStorage` risky?

<!-- question:start:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-intermediate-q01 -->
<!-- question-id:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Tokens in `localStorage` are accessible to any JavaScript running on the origin. If the app has an XSS vulnerability, an attacker can read the token and send it elsewhere. If the token is long-lived, the attacker may continue using it even after the user closes the tab.

This is especially dangerous for refresh tokens or long-lived session credentials. Short-lived access tokens in memory or `HttpOnly` cookie-based sessions often reduce exposure.

##### Key Points to Mention

- XSS can read `localStorage`.
- Persistent tokens increase exposure time.
- Refresh tokens are especially sensitive.
- Web Storage is not an authorization boundary.
- Short token lifetimes and safer storage reduce impact.

<!-- question:end:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-intermediate-q01 -->

#### How does cookie-based authentication change the risk model?

<!-- question:start:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-intermediate-q02 -->
<!-- question-id:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Cookie-based authentication can hide the credential from JavaScript with `HttpOnly`, which reduces direct token theft from XSS. However, cookies are automatically sent with matching requests, so the app must consider CSRF for unsafe operations.

The app also needs secure cookie attributes, CORS rules for credentialed requests, server-side authorization, and a clear way for the frontend to know whether the user is authenticated.

##### Key Points to Mention

- `HttpOnly` reduces JavaScript token theft.
- Cookies are sent automatically.
- CSRF becomes important.
- `SameSite`, CSRF tokens, and Origin checks help.
- Server remains the auth authority.

<!-- question:end:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-intermediate-q02 -->

#### How should logout be synchronized across tabs?

<!-- question:start:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-intermediate-q03 -->
<!-- question-id:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Logout should clear local auth state in the current tab, ask the server to expire the session or cookie, clear sensitive query caches, and notify other tabs. Common notification options include the `storage` event with a `localStorage` marker or `BroadcastChannel`.

Other tabs should react by clearing memory state, clearing sensitive caches, and redirecting or showing a signed-out state.

##### Key Points to Mention

- Server must expire server-side session or cookie.
- Clear in-memory auth state.
- Clear sensitive caches.
- Use `storage` event or `BroadcastChannel`.
- Other tabs should stop showing privileged UI.

<!-- question:end:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-intermediate-q03 -->

#### What storage would you choose for SPA authentication?

<!-- question:start:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-intermediate-q04 -->
<!-- question-id:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

For many production SPAs, a strong pattern is to keep the short-lived access token in memory and use an `HttpOnly`, `Secure`, `SameSite` refresh/session cookie controlled by the server. The app can restore the session after refresh by calling a session endpoint.

This reduces persistent JavaScript-readable credentials while still giving reasonable UX across reloads. The trade-off is added backend and CSRF complexity.

##### Key Points to Mention

- Short-lived access token in memory.
- Refresh/session cookie as `HttpOnly` and `Secure`.
- Session restore endpoint after reload.
- CSRF defenses for cookie auth.
- Avoid long-lived tokens in Web Storage.

<!-- question:end:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you threat-model browser storage for auth tokens?

<!-- question:start:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-advanced-q01 -->
<!-- question-id:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would identify who can read or trigger the credential, how long it lives, and what it can access. For Web Storage, the main concern is JavaScript access and XSS. For cookies, the main concern is automatic sending and CSRF, plus cookie scope and flags. For memory storage, the concern is active XSS and refresh recovery.

Then I would reduce impact with short access-token lifetimes, `HttpOnly` refresh cookies or server sessions, CSRF protection, strong XSS prevention, cache clearing on logout, and server-side authorization checks.

##### Key Points to Mention

- Evaluate JavaScript access.
- Evaluate automatic request inclusion.
- Evaluate persistence lifetime.
- Consider XSS, CSRF, local device access, and extensions.
- Minimize token lifetime and scope.
- Server must enforce authorization.

<!-- question:end:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-advanced-q01 -->

#### How does storage choice affect refresh-token flows?

<!-- question:start:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-advanced-q02 -->
<!-- question-id:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

If the refresh token is in `localStorage`, JavaScript can read it, which increases XSS impact. If the refresh token is in an `HttpOnly` cookie, JavaScript cannot read it, but refresh requests must include credentials and the server must handle CSRF and cookie attributes. If the access token is only in memory, refresh is needed after page reload.

The design should also handle concurrent refresh requests, token rotation, logout, and session restoration.

##### Key Points to Mention

- Web Storage makes refresh tokens JavaScript-readable.
- `HttpOnly` cookies hide refresh tokens from JavaScript.
- Cookie refresh needs CSRF-aware server design.
- Memory access tokens require reload recovery.
- Concurrent refresh must be coordinated.

<!-- question:end:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-advanced-q02 -->

#### How should browser storage be handled in SSR or hydration?

<!-- question:start:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-advanced-q03 -->
<!-- question-id:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Browser storage APIs such as `localStorage` and `sessionStorage` are not available during server rendering. Code should read them only in browser-only effects, event handlers, or guarded initialization. The initial server-rendered UI should not depend on storage that only exists in the browser unless the app handles a loading or hydration-safe fallback.

For auth, the server should usually determine session state from cookies when rendering protected content, or the client should show a neutral loading state until session validation finishes.

##### Key Points to Mention

- `window` storage APIs are browser-only.
- Guard access with environment checks.
- Avoid hydration mismatches.
- Use neutral initial state.
- Server-rendered auth should rely on server-readable cookies.

<!-- question:end:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-advanced-q03 -->

#### Why should values read from browser storage be treated as untrusted?

<!-- question:start:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-advanced-q04 -->
<!-- question-id:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Users, extensions, injected scripts, or compromised dependencies can modify browser storage. Therefore, values read from storage may be missing, malformed, stale, or malicious. The app should validate and parse them defensively and should never use them as proof of permission.

For example, a stored role can control which menu item is highlighted, but the server must still decide whether the user can perform an admin operation.

##### Key Points to Mention

- Client storage can be modified.
- Validate parsed values.
- Handle malformed JSON.
- Do not trust stored roles or permissions.
- Server enforces authorization.
- Storage is a UX hint, not a security boundary.

<!-- question:end:browser-storage-trade-offs-localstorage-sessionstorage-memory-storage-and-cookies-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
