---
id: secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration
topic: Production data access, API clients, and frontend auth
subtopic: Secure cookie flags: `HttpOnly`, `Secure`, `SameSite`, path, domain, and expiration
category: React
---

## Overview

Secure cookie flags are attributes that control how browsers store and send cookies. In React applications, cookies are often used for server-managed sessions, refresh tokens, CSRF tokens, preferences, or identity provider flows. The most important attributes for interviews are `HttpOnly`, `Secure`, `SameSite`, `Path`, `Domain`, `Expires`, and `Max-Age`.

This topic matters because cookie behavior is deceptively simple. A single missing flag can expose a session to JavaScript theft, allow cross-site request forgery, send credentials to too many subdomains, or keep a user logged in longer than intended.

React does not make cookies secure by itself. Cookie security is mainly controlled by the server's `Set-Cookie` header, browser behavior, HTTPS, CORS, CSRF protections, and the backend's authorization checks. The frontend must understand the consequences because API clients, route guards, refresh flows, and unauthorized UX all depend on the authentication model.

For interviews, this topic tests whether a candidate can explain browser security controls precisely and connect them to practical app behavior.

## Core Concepts

### Cookie Basics

A cookie is usually set by the server with a `Set-Cookie` response header.

Example:

```http
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
```

After the browser stores the cookie, it sends the cookie on future requests that match the cookie's domain, path, security, and same-site rules.

Important cookie facts:

- Cookies are small compared with other browser storage mechanisms.
- Cookies are sent automatically with matching requests.
- A server can set cookies that JavaScript cannot read.
- Cookies are scoped by domain and path.
- Cookies can expire at browser close or at a configured time.
- Cookies are not a complete security solution without server-side validation.

### `HttpOnly`

`HttpOnly` tells the browser not to expose the cookie through JavaScript APIs such as `document.cookie`.

Example:

```http
Set-Cookie: refreshToken=abc123; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh
```

Why it matters:

- Reduces direct cookie theft from XSS.
- Protects session IDs and refresh tokens from ordinary JavaScript access.
- Forces auth logic to rely on server validation or session endpoints instead of reading the token in React.

What it does not do:

- It does not stop the browser from sending the cookie with matching requests.
- It does not prevent CSRF by itself.
- It does not prevent XSS from performing actions as the user while the cookie is present.
- It does not remove the need for output encoding and CSP.

For session or refresh cookies, `HttpOnly` is usually expected.

### `Secure`

`Secure` tells the browser to send the cookie only over secure HTTPS requests.

Example:

```http
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax; Path=/
```

Why it matters:

- Reduces exposure over plaintext HTTP.
- Should be used for authentication cookies.
- Is required for `SameSite=None`.

Important nuance:

- `Secure` protects transmission, not JavaScript access.
- `Secure` does not replace `HttpOnly`.
- Local development may need HTTPS or special local handling.

Production authentication cookies should use `Secure`.

### `SameSite`

`SameSite` controls whether a cookie is sent with cross-site requests.

Common values:

- `Strict`: send the cookie only for same-site requests.
- `Lax`: send the cookie for same-site requests and some top-level safe navigations.
- `None`: send the cookie in cross-site contexts; must be paired with `Secure`.

Example:

```http
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax; Path=/
```

Choosing a value:

- `Strict` is strongest but can break sign-in redirects, links from email, or identity provider flows.
- `Lax` is a practical default for many session cookies.
- `None` is needed for true cross-site embedding or some third-party scenarios, but it increases CSRF exposure and requires careful controls.

`SameSite` helps reduce CSRF risk, but it should not be the only defense for sensitive unsafe operations.

### `Path`

`Path` controls which URL paths receive the cookie.

Example:

```http
Set-Cookie: refreshToken=abc123; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh
```

If `Path=/`, the cookie is sent to the whole site. If `Path=/auth/refresh`, it is only sent to requests under that path.

Useful patterns:

- Session cookie with `Path=/` when the whole app needs it.
- Refresh token cookie with a narrow refresh endpoint path.
- CSRF cookie with a path that matches the API surface that needs it.

Limits:

- `Path` is not a strong security boundary against malicious code on the same origin.
- It mainly controls request matching.
- A broad `Path=/` increases where the cookie is sent.

Use the narrowest path that still supports the app's flow.

### `Domain`

`Domain` controls which hosts receive the cookie. If omitted, the cookie is host-only and applies only to the exact host that set it.

Example host-only cookie:

```http
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax; Path=/
```

Example broader domain cookie:

```http
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax; Domain=example.com; Path=/
```

Trade-off:

- Omitting `Domain` is usually safer because the cookie is limited to the exact host.
- Setting `Domain=example.com` allows subdomains to receive the cookie.
- If any subdomain is less trusted, broad domain cookies increase risk.

For sensitive auth cookies, prefer host-only cookies unless there is a clear cross-subdomain requirement.

### Expiration: Session Cookies, `Expires`, and `Max-Age`

Cookie lifetime is controlled by `Expires` or `Max-Age`.

Examples:

```http
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax; Path=/
```

```http
Set-Cookie: remember=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
```

If a cookie has no explicit expiration, it is a session cookie and is typically removed when the browser session ends. Browser session restore features can affect user expectations, so do not rely on this alone for critical security.

`Max-Age` sets lifetime in seconds. `Expires` sets an absolute date. When both are present, modern behavior gives `Max-Age` precedence.

For authentication:

- Use short lifetimes for high-risk credentials.
- Match cookie lifetime to server session lifetime.
- Expire cookies on logout.
- Rotate refresh tokens where appropriate.

### Cookie Deletion

To delete a cookie, the server must set the same cookie name with matching `Path` and `Domain` attributes and an expiration in the past or `Max-Age=0`.

Example:

```http
Set-Cookie: session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0
```

Important:

- JavaScript cannot delete an `HttpOnly` cookie.
- The server must expire it.
- Path and domain must match the original cookie.
- Server-side session state should also be invalidated.

Logout should not only remove the browser cookie. It should also invalidate the session or refresh token server-side.

### Cookie Prefixes

Cookie name prefixes can add browser-enforced constraints.

Common prefixes:

- `__Secure-`: cookie must be set with `Secure` from a secure origin.
- `__Host-`: cookie must be set with `Secure`, must not include `Domain`, and must use `Path=/`.

Example:

```http
Set-Cookie: __Host-session=abc123; HttpOnly; Secure; SameSite=Lax; Path=/
```

The `__Host-` prefix is useful for sensitive host-bound cookies because it prevents broad domain scoping.

### Cookie-Based Auth in React

When React uses cookie-based auth, the frontend often does not read the credential directly. Instead, it asks the server for session state.

Example:

```ts
async function loadCurrentUser() {
  const response = await fetch("/api/me", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to load session");
  }

  return response.json() as Promise<User>;
}
```

The frontend sees whether the user is authenticated based on server responses, not by reading the cookie.

For cross-origin APIs, credentialed requests also require correct CORS configuration from the server.

### `SameSite` and OAuth Redirects

Authentication flows often involve redirects between an app and an identity provider. `SameSite=Strict` can break some redirect-based flows because the browser may not send the cookie when returning from another site.

Common approach:

- Use `SameSite=Lax` for main session cookies when top-level sign-in redirects are expected.
- Use `SameSite=None; Secure` only when cross-site sending is required.
- Use state and nonce parameters for OAuth/OIDC flows.
- Keep unsafe state-changing actions protected by CSRF controls.

The strongest cookie setting is not always the setting that works for the product. The correct setting balances security and the required navigation flow.

### CSRF and Cookie Flags

Cookie flags reduce CSRF risk but do not eliminate every scenario.

Defense layers:

- `SameSite=Lax` or `Strict` where compatible.
- CSRF tokens for unsafe actions.
- Origin or Referer validation.
- No state-changing behavior on `GET`.
- CORS allow-listing for credentialed APIs.

Example double-submit style shape:

```http
Set-Cookie: csrf=token-value; Secure; SameSite=Lax; Path=/
```

The JavaScript-readable CSRF cookie is different from an `HttpOnly` session cookie. It does not authenticate the user by itself. It is used to prove that the request came from a page that could read the CSRF value.

### Local Development

Secure cookie behavior can be awkward locally.

Common approaches:

- Run local development over HTTPS.
- Use localhost-specific exceptions where the platform supports them.
- Keep production flags in production configs.
- Avoid weakening production behavior for local convenience.

Do not ship development cookie settings such as missing `Secure`, broad `Domain`, or `SameSite=None` without a real need.

### Common Mistakes

Common mistakes include:

- Setting session cookies without `HttpOnly`.
- Setting auth cookies without `Secure` in production.
- Using `SameSite=None` without understanding cross-site risk.
- Setting a broad `Domain` for sensitive cookies.
- Using `Path=/` for refresh tokens that only need one endpoint.
- Forgetting that JavaScript cannot delete `HttpOnly` cookies.
- Clearing the browser cookie but not invalidating the server session.
- Relying only on `SameSite` for all CSRF protection.
- Assuming `Path` is a strong security boundary.
- Logging `Set-Cookie` headers or cookie values.

### Best Practices

Best practices include:

- Use `HttpOnly` for session and refresh cookies.
- Use `Secure` for production auth cookies.
- Prefer `SameSite=Lax` or `Strict` unless cross-site behavior is required.
- Use `SameSite=None; Secure` only with a clear need.
- Prefer host-only cookies by omitting `Domain`.
- Use narrow `Path` values when possible.
- Align cookie expiration with server session expiration.
- Expire cookies and invalidate server sessions on logout.
- Consider `__Host-` for sensitive host-bound cookies.
- Add CSRF protection for unsafe cookie-authenticated requests.
- Keep frontend auth state derived from server validation.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What does the `HttpOnly` cookie flag do?

<!-- question:start:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-beginner-q01 -->
<!-- question-id:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

`HttpOnly` prevents JavaScript from reading the cookie through APIs such as `document.cookie`. It is commonly used for session cookies and refresh-token cookies to reduce the impact of XSS token theft.

It does not stop the browser from sending the cookie with matching HTTP requests, and it does not prevent CSRF by itself.

##### Key Points to Mention

- Hides cookie from JavaScript.
- Good for session and refresh cookies.
- Reduces direct theft from XSS.
- Does not stop automatic sending.
- Does not replace CSRF protection.

<!-- question:end:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-beginner-q01 -->

#### What does the `Secure` cookie flag do?

<!-- question:start:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-beginner-q02 -->
<!-- question-id:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`Secure` tells the browser to send the cookie only over secure HTTPS connections. Production authentication cookies should use it because session credentials should not be sent over plaintext HTTP.

`Secure` does not hide the cookie from JavaScript. That requires `HttpOnly`.

##### Key Points to Mention

- Restricts sending to HTTPS.
- Expected for auth cookies in production.
- Required with `SameSite=None`.
- Does not prevent JavaScript access.
- Complements `HttpOnly`.

<!-- question:end:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-beginner-q02 -->

#### What does `SameSite` control?

<!-- question:start:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-beginner-q03 -->
<!-- question-id:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`SameSite` controls whether the browser sends a cookie with cross-site requests. `Strict` is the most restrictive, `Lax` allows common top-level navigations, and `None` allows cross-site sending when paired with `Secure`.

It is important for reducing CSRF risk, but sensitive unsafe operations may still need additional CSRF protection.

##### Key Points to Mention

- Controls cross-site cookie sending.
- Values are `Strict`, `Lax`, and `None`.
- `None` requires `Secure`.
- Helps reduce CSRF.
- Can affect login redirects.

<!-- question:end:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-beginner-q03 -->

#### What is the difference between `Expires` and `Max-Age`?

<!-- question:start:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-beginner-q04 -->
<!-- question-id:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`Expires` sets an absolute expiration date for a cookie. `Max-Age` sets a lifetime in seconds from when the browser receives the cookie. If neither is set, the cookie behaves like a session cookie and is typically removed when the browser session ends.

Modern behavior gives `Max-Age` precedence when both are present.

##### Key Points to Mention

- `Expires` is an absolute date.
- `Max-Age` is relative seconds.
- No expiration means session cookie behavior.
- Expiration should match server session rules.
- Use `Max-Age=0` to delete when matching path/domain.

<!-- question:end:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why is omitting `Domain` often safer for auth cookies?

<!-- question:start:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-intermediate-q01 -->
<!-- question-id:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

If `Domain` is omitted, the cookie is host-only and is sent only to the exact host that set it. If `Domain=example.com` is set, the cookie can be sent to subdomains. That can be risky if any subdomain is less trusted or easier to compromise.

For sensitive auth cookies, host-only scope is usually safer unless there is a real cross-subdomain requirement.

##### Key Points to Mention

- Omitted `Domain` creates host-only behavior.
- Broad domain scope includes subdomains.
- Subdomain compromise can increase risk.
- Sensitive cookies should be scoped narrowly.
- `__Host-` can enforce host-bound constraints.

<!-- question:end:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-intermediate-q01 -->

#### How should cookie logout work?

<!-- question:start:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-intermediate-q02 -->
<!-- question-id:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Logout should invalidate the server session or refresh token and send a `Set-Cookie` header that expires the cookie. The deletion cookie must use the same name and matching `Path` and `Domain` attributes as the original cookie.

If the cookie is `HttpOnly`, JavaScript cannot delete it directly. The frontend should call a logout endpoint and then clear client-side auth state and sensitive caches.

##### Key Points to Mention

- Server should invalidate session state.
- Expire cookie with `Max-Age=0` or past `Expires`.
- Path and domain must match.
- JavaScript cannot delete `HttpOnly` cookies.
- Clear client cache after logout.

<!-- question:end:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-intermediate-q02 -->

#### How do `SameSite` settings affect OAuth or identity-provider redirects?

<!-- question:start:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-intermediate-q03 -->
<!-- question-id:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

`SameSite=Strict` can prevent cookies from being sent when the user returns from an external identity provider, depending on the flow. `SameSite=Lax` is often more practical for top-level sign-in redirects. `SameSite=None; Secure` is needed when cookies must be sent in cross-site contexts.

The app should also use OAuth/OIDC state and nonce values and avoid relying only on cookie behavior.

##### Key Points to Mention

- `Strict` can break cross-site redirect flows.
- `Lax` often works for top-level navigation.
- `None` allows cross-site sending and requires `Secure`.
- Use state and nonce in auth flows.
- Balance security with required product flow.

<!-- question:end:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-intermediate-q03 -->

#### How should a React app know the user is authenticated if the session cookie is `HttpOnly`?

<!-- question:start:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-intermediate-q04 -->
<!-- question-id:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

The React app should ask the server. It can call an endpoint such as `/api/me` or `/session` with credentials included. The server reads and validates the cookie, then returns the current user or `401`.

The frontend should not need to read the cookie value. It should derive auth state from server responses.

##### Key Points to Mention

- `HttpOnly` cookie is not readable by JavaScript.
- Use a session/current-user endpoint.
- Include credentials when needed.
- Treat `401` as unauthenticated.
- Server remains the source of truth.

<!-- question:end:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you configure a secure session cookie for a production React app?

<!-- question:start:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-advanced-q01 -->
<!-- question-id:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would have the server set a session cookie with `HttpOnly`, `Secure`, a deliberate `SameSite` value, a narrow `Path`, and no `Domain` unless cross-subdomain sharing is required. I would align `Max-Age` with server session lifetime and invalidate the server session on logout.

If the cookie can be host-bound, I would consider the `__Host-` prefix. I would also add CSRF defenses for unsafe cookie-authenticated requests.

##### Key Points to Mention

- `HttpOnly` for JavaScript protection.
- `Secure` for HTTPS only.
- `SameSite=Lax` or `Strict` where compatible.
- Avoid broad `Domain`.
- Use appropriate `Path`.
- Match expiration to server session.
- Add CSRF protection.

<!-- question:end:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-advanced-q01 -->

#### Why is `SameSite` not a complete CSRF solution?

<!-- question:start:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-advanced-q02 -->
<!-- question-id:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

`SameSite` reduces when cookies are sent cross-site, but product requirements may force `Lax` or `None`, browser behavior has edge cases, and defense-in-depth is still needed for sensitive operations. Unsafe state-changing requests should not rely on cookie flags alone.

A robust design includes CSRF tokens, Origin or Referer checks, safe HTTP method semantics, and server-side authorization.

##### Key Points to Mention

- `SameSite` reduces risk but is not the whole model.
- `None` allows cross-site cookies.
- Some flows need less restrictive settings.
- Unsafe actions need CSRF defenses.
- Server must validate authorization.

<!-- question:end:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-advanced-q02 -->

#### What are cookie prefixes, and when would you use `__Host-`?

<!-- question:start:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-advanced-q03 -->
<!-- question-id:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Cookie prefixes are naming conventions that browsers enforce with additional rules. `__Secure-` requires the cookie to be set securely with the `Secure` attribute. `__Host-` is stricter: it requires `Secure`, no `Domain`, and `Path=/`.

I would use `__Host-` for sensitive host-bound session cookies when the app does not need subdomain sharing. It helps prevent accidental broad domain scope.

##### Key Points to Mention

- Prefixes add browser-enforced constraints.
- `__Secure-` requires secure setting and `Secure`.
- `__Host-` requires `Secure`, no `Domain`, and `Path=/`.
- Useful for host-bound session cookies.
- Helps prevent cookie scope mistakes.

<!-- question:end:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-advanced-q03 -->

#### How do cookie flags interact with CORS for cross-origin APIs?

<!-- question:start:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-advanced-q04 -->
<!-- question-id:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

If a React app calls a cross-origin API with cookies, the frontend must opt into credentials and the server must allow credentialed CORS from a specific trusted origin. The cookie must also be eligible to be sent based on `SameSite`, `Secure`, `Domain`, and `Path`.

For true cross-site cookie sending, `SameSite=None; Secure` may be required. The server should not use wildcard CORS with credentials and should still apply CSRF and authorization controls.

##### Key Points to Mention

- Frontend uses credentialed requests.
- Server must allow credentials for trusted origins.
- Wildcard CORS is not appropriate for credentials.
- `SameSite=None; Secure` may be needed cross-site.
- Cookie flags and CORS both must allow the request.
- CSRF controls still matter.

<!-- question:end:secure-cookie-flags-httponly-secure-samesite-path-domain-and-expiration-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
