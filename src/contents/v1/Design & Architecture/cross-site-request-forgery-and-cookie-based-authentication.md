---
id: cross-site-request-forgery-and-cookie-based-authentication
topic: Web application security threat modeling and attack patterns
subtopic: Cross-Site Request Forgery and how cookie-based authentication changes the risk model
category: Design & Architecture
---

## Overview

Cross-Site Request Forgery (CSRF) is an attack in which a malicious site causes a victim's browser to send an unwanted request to another application where the victim is authenticated.

The attacker does not need to read the response. The attack succeeds when the browser automatically attaches credentials, the server accepts the request, and the request changes state without independent proof that the legitimate application initiated it.

Cookie-based authentication changes the risk model because cookies are **ambient credentials**. The browser decides whether to attach them from cookie attributes such as domain, path, `Secure`, and `SameSite`; it does not use the trustworthiness of the page that initiated the request. A cross-site form, image, navigation, or script may therefore trigger an authenticated request.

By contrast, a bearer token that client code explicitly places in an `Authorization` header is not normally attached to a cross-site request automatically. This reduces classical CSRF exposure, although it introduces other concerns such as XSS, token storage, CORS configuration, and token leakage. A backend-for-frontend (BFF) that stores tokens server-side but authenticates the browser with a cookie remains subject to CSRF.

CSRF matters in interviews because it tests whether a candidate can reason about browser behavior, authentication transport, HTTP method semantics, cross-origin restrictions, and layered defenses. Strong answers explain why the same-origin policy and CORS do not by themselves stop forged requests, and why `SameSite` cookies are useful but should not be the only control for sensitive operations.

## Core Concepts

### Attack Preconditions

A typical CSRF attack requires:

- A victim who is authenticated to the target application.
- Credentials that the browser attaches automatically, usually a session cookie.
- A predictable state-changing endpoint and request shape.
- A request the attacker can cause a browser to send.
- No effective anti-forgery, origin, or same-site validation.

For example, a vulnerable transfer endpoint might accept:

```http
POST /api/transfers HTTP/1.1
Content-Type: application/x-www-form-urlencoded

to=attacker&amount=1000
```

An attacker-controlled page could submit the same request:

```html
<form action="https://bank.example/api/transfers" method="post">
  <input type="hidden" name="to" value="attacker">
  <input type="hidden" name="amount" value="1000">
</form>
<script>
  document.forms[0].submit();
</script>
```

If the browser includes the victim's session cookie and the server requires no additional proof of intent, the server may process the transfer.

### Same-Origin Policy Does Not Stop Requests

The same-origin policy generally prevents a malicious origin from reading another origin's protected response. It does not prevent every cross-origin request from being sent.

Browsers intentionally support cross-origin:

- HTML form submissions.
- Top-level navigations.
- Images, stylesheets, and other embedded resources.
- Some script-issued "simple" requests.

CSRF often needs only a side effect. The attacker may not care whether the response is readable.

### Cookie-Based Authentication and Ambient Authority

Consider a session cookie:

```http
Set-Cookie: session=abc123; Path=/; Secure; HttpOnly; SameSite=Lax
```

`HttpOnly` prevents JavaScript from reading the cookie, which helps limit cookie theft through some XSS attacks. It does not stop the browser from attaching the cookie to eligible requests and therefore is not a CSRF defense.

The key distinction is:

| Authentication transport | Browser behavior | Classical CSRF risk |
|---|---|---|
| Session cookie | Automatically attached when cookie rules permit | Present |
| JWT in a cookie | Automatically attached like any other cookie | Present |
| Bearer token in `Authorization` | Client code normally adds it explicitly | Usually reduced |
| Mutual TLS client certificate | Browser or client may present it automatically | Can be present |
| BFF session cookie | Automatically attached to the BFF | Present |

The token format does not determine CSRF risk. A JWT stored in a cookie is still an ambient credential.

### Unsafe HTTP Methods

`GET`, `HEAD`, `OPTIONS`, and `TRACE` are defined as safe methods: they should not change application state.

This endpoint is dangerous:

```http
GET /account/delete?id=42
```

An attacker may trigger it with:

```html
<img src="https://app.example/account/delete?id=42" alt="">
```

State changes should use methods such as `POST`, `PUT`, `PATCH`, or `DELETE`, and those methods should be protected. Using `POST` is necessary but not sufficient because cross-site forms can submit `POST` requests.

### Synchronizer Token Pattern

The synchronizer token pattern generates an unpredictable token associated with the user's authenticated session.

The legitimate application includes the token in:

- A hidden form field.
- A custom request header.
- Another request location not automatically populated by the browser.

The server verifies that the submitted token matches the session before processing the request.

```html
<form method="post" action="/profile/email">
  <input type="hidden" name="__RequestVerificationToken"
         value="unpredictable-session-bound-token">
  <input type="email" name="email">
  <button type="submit">Change email</button>
</form>
```

A malicious site can cause the browser to send the session cookie, but it should not be able to read the legitimate page and obtain the token.

Good anti-forgery tokens are:

- Generated with a cryptographically secure source.
- Unpredictable.
- Bound to the intended session or authentication context.
- Compared using the framework's supported validation mechanism.
- Excluded from URLs and logs.

### Double-Submit Cookie Pattern

In a double-submit design, the server sends a CSRF token in a cookie and the client echoes the value in a form field or custom header. The server compares both values.

```text
Cookie: csrf=RANDOM_VALUE
X-CSRF-TOKEN: RANDOM_VALUE
```

A robust implementation should sign the token and bind it to session-specific data. A naive comparison of two attacker-injectable values can fail if an attacker can plant or overwrite cookies through a vulnerable subdomain or other cookie-injection path.

Use a framework implementation when available rather than designing a custom token format.

### Custom Headers and Preflight

HTML forms cannot set arbitrary custom headers. Requiring a header such as `X-CSRF-TOKEN` can therefore distinguish requests made by approved application code from ordinary cross-site form submissions.

```typescript
await fetch("/api/profile/email", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRF-TOKEN": csrfToken,
  },
  body: JSON.stringify({ email }),
});
```

Cross-origin JavaScript that sends a custom header normally triggers a CORS preflight. The server must allow only exact trusted origins when credentials are enabled.

Do not treat CORS as authorization:

- CORS controls whether browser JavaScript may make or read certain cross-origin requests.
- It does not protect non-browser clients.
- A permissive or reflected origin policy can undermine a custom-header CSRF design.
- Compromised trusted origins remain dangerous.

### SameSite Cookies

`SameSite` controls whether cookies are sent in cross-site contexts.

- `Strict` provides the strongest cross-site restriction but can disrupt legitimate incoming links and federated flows.
- `Lax` permits cookies in some top-level navigation scenarios while blocking many cross-site subrequests.
- `None` permits cross-site use and requires `Secure`.

Important limitations:

- "Site" is not the same as "origin." Different subdomains can be same-site while being cross-origin.
- Some authentication, payment, embedded, and federation flows require deliberate exceptions.
- Legacy clients and unusual browser behavior may differ.
- A state-changing `GET` remains unsafe.
- A vulnerable or attacker-controlled sibling subdomain can affect the trust model.

Set `SameSite` deliberately, but retain token validation or equivalent proof of request intent for sensitive cookie-authenticated operations.

### Origin and Referer Validation

For state-changing requests, a server can verify that the `Origin` header matches an exact trusted origin. If `Origin` is unavailable, a carefully parsed `Referer` header may be a fallback.

Validation should:

- Compare parsed scheme, host, and port.
- Use an explicit allowlist.
- Reject suffix tricks such as `trusted.example.attacker.test`.
- Account for reverse proxies and the application's canonical external origin.
- Define a cautious policy for missing or `null` origins.

Header validation is useful defense in depth and can be a primary control in some architectures, but teams must understand compatibility requirements before rejecting all missing headers.

### Fetch Metadata

Modern browsers may send Fetch Metadata headers such as:

```http
Sec-Fetch-Site: cross-site
Sec-Fetch-Mode: navigate
Sec-Fetch-Dest: document
```

A server can reject clearly cross-site requests to sensitive endpoints while allowing same-origin or same-site traffic according to policy.

Fetch Metadata is defense in depth:

- Not every client sends the headers.
- Same-site subdomains may still be untrusted.
- Webhooks, APIs, and legacy integrations may require separate policies.
- It should complement, not silently replace, established anti-forgery protection.

### ASP.NET Core Antiforgery

ASP.NET Core provides antiforgery services for cookie-authenticated applications. MVC and Razor Pages can generate and validate tokens through built-in helpers, filters, and attributes.

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
});
```

A controller can require validation:

```csharp
[Authorize]
[HttpPost]
[ValidateAntiForgeryToken]
public IActionResult ChangeEmail(ChangeEmailRequest request)
{
    // Perform the authorized state change.
    return NoContent();
}
```

For a JavaScript client, the application can issue a request token through an authenticated same-origin endpoint and require the client to return it in the configured header. The framework maintains the corresponding cookie token and validates the pair.

Key implementation rules:

- Register antiforgery services and ensure validation actually runs.
- Protect all cookie-authenticated unsafe methods, not only selected forms.
- Do not expose tokens in query strings.
- Do not disable validation broadly to fix one integration.
- Separate browser endpoints from webhook or machine-to-machine endpoints when their trust models differ.

### SPA and BFF Architectures

A single-page application may use one of two broad models.

**Token-based browser API client**

- The client adds an access token to `Authorization`.
- The browser does not automatically attach that header to an attacker's form.
- Classical CSRF is reduced.
- XSS and token-storage decisions become especially important.

**Cookie-authenticated SPA or BFF**

- The browser automatically sends the session cookie.
- The application needs CSRF protection for state-changing endpoints.
- The SPA commonly obtains a CSRF token and returns it in a custom header.
- `credentials: "include"` and CORS policies must be tightly controlled when origins differ.

Moving tokens into a BFF can reduce token exposure to browser JavaScript, but the cookie-facing boundary must still handle CSRF.

### JSON Does Not Automatically Prevent CSRF

Requiring `application/json` and rejecting form content types blocks ordinary HTML forms from reproducing a JSON request. This can be a useful layer when combined with a required custom header and restrictive CORS.

It is not a universal substitute for anti-forgery validation:

- Endpoints may accidentally accept form or text content.
- Parsers and middleware may support unexpected formats.
- CORS may be overly permissive.
- Browser behavior and integrations evolve.

Explicitly constrain accepted methods and content types, then enforce the intended CSRF control.

### Login CSRF

CSRF is not limited to operations performed after a victim logs in. In login CSRF, an attacker causes the victim's browser to authenticate to the application using the attacker's account.

The victim may then enter:

- Personal information.
- Payment details.
- Search history.
- Uploaded data.

The attacker later signs in to the same account and sees that information. Login endpoints and account-linking flows therefore need request correlation and anti-forgery protection.

### CSRF and XSS

CSRF and XSS are different:

- CSRF causes a browser to send an authenticated request without proving user intent.
- XSS executes attacker-controlled script in the trusted origin.

An XSS vulnerability can often read CSRF tokens and send valid same-origin requests, bypassing CSRF defenses. This does not make CSRF protection unnecessary; it means both vulnerability classes must be addressed.

### Sensitive Operations and Reauthentication

High-impact operations should use layered controls:

- Anti-forgery validation.
- Authorization against the requested action and resource.
- Recent reauthentication or step-up MFA.
- Transaction confirmation that displays critical values.
- Rate limits and anomaly detection.
- Audit logs and user notifications.

A CSRF token proves that a request likely came through an approved application context. It does not prove that the user is authorized, recently authenticated, or knowingly approved every transaction detail.

### Common Mistakes

Common implementation failures include:

- Assuming `POST` prevents CSRF.
- Using `HttpOnly` as a CSRF control.
- Storing a JWT in a cookie and assuming JWTs are immune.
- Protecting HTML forms but not JSON, upload, GraphQL, or batch endpoints.
- Accepting state changes through `GET`.
- Using predictable or globally shared tokens.
- Logging tokens or placing them in URLs.
- Allowing arbitrary credentialed CORS origins.
- Trusting all same-site subdomains.
- Disabling antiforgery validation for an entire controller.
- Comparing `Origin` with substring or suffix checks.
- Relying on `SameSite` alone for critical operations.

### Best-Practice Decision Process

For each browser-facing endpoint:

1. Identify whether the browser attaches authentication automatically.
2. Classify the method as safe or state-changing.
3. Determine which origins and sites legitimately initiate the request.
4. Apply framework-supported anti-forgery validation to cookie-authenticated unsafe methods.
5. Set restrictive cookie attributes: `Secure`, `HttpOnly`, appropriate domain and path, and deliberate `SameSite`.
6. Validate exact origins and consider Fetch Metadata as additional controls.
7. Restrict content types and credentialed CORS policies.
8. Add authorization, reauthentication, and transaction confirmation according to impact.
9. Test negative cases from an attacker-controlled origin.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is Cross-Site Request Forgery?

<!-- question:start:cross-site-request-forgery-and-cookie-based-authentication-beginner-q01 -->
<!-- question-id:cross-site-request-forgery-and-cookie-based-authentication-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

CSRF is an attack that causes a victim's browser to send an unwanted request to an application where the victim is authenticated. It commonly succeeds because the browser automatically includes a session cookie, while the server checks authentication but does not require independent proof that the legitimate application initiated the state-changing request.

##### Key Points to Mention

- The victim is already authenticated.
- The browser sends ambient credentials automatically.
- The attacker usually needs a side effect, not response access.
- State-changing endpoints require proof of request intent.

<!-- question:end:cross-site-request-forgery-and-cookie-based-authentication-beginner-q01 -->

#### Why does cookie-based authentication create CSRF risk?

<!-- question:start:cross-site-request-forgery-and-cookie-based-authentication-beginner-q02 -->
<!-- question-id:cross-site-request-forgery-and-cookie-based-authentication-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Cookies are ambient credentials. When a request matches the cookie's domain, path, security, and same-site rules, the browser can attach the cookie regardless of which page initiated the request. The server therefore sees an authenticated request even though the user did not intentionally initiate it from the legitimate application.

##### Key Points to Mention

- JWTs in cookies have the same CSRF property.
- `HttpOnly` limits JavaScript access but not automatic sending.
- Explicit `Authorization` headers are not normally attached automatically.
- Cookie attributes reduce risk but do not replace request validation.

<!-- question:end:cross-site-request-forgery-and-cookie-based-authentication-beginner-q02 -->

#### How does an anti-forgery token prevent CSRF?

<!-- question:start:cross-site-request-forgery-and-cookie-based-authentication-beginner-q03 -->
<!-- question-id:cross-site-request-forgery-and-cookie-based-authentication-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

The application generates an unpredictable token associated with the user's session and places it in the legitimate page or exposes it through a trusted same-origin flow. The client returns the token in a form field or custom header. A malicious cross-site page may cause the browser to send cookies, but it cannot normally read the legitimate application to obtain the token, so server validation fails.

##### Key Points to Mention

- Tokens must be unpredictable and session-bound.
- The token is sent separately from the automatic credential.
- The server must validate it on every protected unsafe request.
- Framework implementations are preferable to custom token schemes.

<!-- question:end:cross-site-request-forgery-and-cookie-based-authentication-beginner-q03 -->

#### Is using POST enough to prevent CSRF?

<!-- question:start:cross-site-request-forgery-and-cookie-based-authentication-beginner-q04 -->
<!-- question-id:cross-site-request-forgery-and-cookie-based-authentication-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

No. HTML forms can submit cross-site `POST` requests, and browsers may include eligible cookies. Applications should avoid state changes through safe methods such as `GET`, but unsafe methods still need anti-forgery protection, authorization, and appropriate origin and cookie controls.

##### Key Points to Mention

- Method semantics are important but not a complete defense.
- Cross-site forms support `POST`.
- Protect `POST`, `PUT`, `PATCH`, and `DELETE`.
- Never make sensitive changes through `GET`.

<!-- question:end:cross-site-request-forgery-and-cookie-based-authentication-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### What are the limitations of SameSite cookies as a CSRF defense?

<!-- question:start:cross-site-request-forgery-and-cookie-based-authentication-intermediate-q01 -->
<!-- question-id:cross-site-request-forgery-and-cookie-based-authentication-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

`SameSite` blocks many cross-site cookie deliveries, but behavior differs among `Strict`, `Lax`, and `None`, and legitimate federation, payment, or embedded flows may require cross-site cookies. Same-site is broader than same-origin, so a compromised sibling subdomain may still be dangerous. Browser compatibility and navigation exceptions also matter. Use `SameSite` as a strong layer, not the sole control for sensitive state changes.

##### Key Points to Mention

- Site and origin are different boundaries.
- `Lax` permits some top-level navigation behavior.
- `None` enables cross-site cookies and requires `Secure`.
- Token or equivalent request-intent validation remains important.

<!-- question:end:cross-site-request-forgery-and-cookie-based-authentication-intermediate-q01 -->

#### Why do the same-origin policy and CORS not automatically prevent CSRF?

<!-- question:start:cross-site-request-forgery-and-cookie-based-authentication-intermediate-q02 -->
<!-- question-id:cross-site-request-forgery-and-cookie-based-authentication-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

The same-origin policy mainly limits reading cross-origin responses; browsers still allow cross-origin forms, navigations, and resource requests. CORS governs selected cross-origin JavaScript access and is not a server-side authorization mechanism. CSRF only needs the forged request to produce a side effect. A custom-header design can rely on preflight behavior only when the server uses an exact restrictive CORS allowlist.

##### Key Points to Mention

- Sending and reading a request are different.
- HTML forms do not require CORS permission.
- Credentialed wildcard or reflected CORS policies are dangerous.
- Non-browser clients are not constrained by CORS.

<!-- question:end:cross-site-request-forgery-and-cookie-based-authentication-intermediate-q02 -->

#### How would you protect a cookie-authenticated React SPA backed by ASP.NET Core?

<!-- question:start:cross-site-request-forgery-and-cookie-based-authentication-intermediate-q03 -->
<!-- question-id:cross-site-request-forgery-and-cookie-based-authentication-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use secure, narrowly scoped authentication cookies with an appropriate `SameSite` policy. Enable ASP.NET Core antiforgery services, expose a request token through a same-origin authenticated flow, and have React return it in a configured custom header for every state-changing request. Validate the token server-side, restrict accepted content types and exact CORS origins, preserve authorization checks, and avoid state-changing `GET` endpoints.

##### Key Points to Mention

- Configure both token generation and validation.
- Send the CSRF token separately from the auth cookie.
- Use `credentials` deliberately when the SPA and API origins differ.
- Test missing, invalid, and cross-origin requests.

<!-- question:end:cross-site-request-forgery-and-cookie-based-authentication-intermediate-q03 -->

#### What is the difference between CSRF and XSS?

<!-- question:start:cross-site-request-forgery-and-cookie-based-authentication-intermediate-q04 -->
<!-- question-id:cross-site-request-forgery-and-cookie-based-authentication-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

CSRF abuses the browser's automatic credential handling to send a request without proving user intent. XSS executes attacker-controlled code in the application's trusted origin. XSS can often read anti-forgery tokens and make valid same-origin requests, so it may bypass CSRF defenses. The application must prevent both; one control does not replace the other.

##### Key Points to Mention

- CSRF does not require script execution in the target origin.
- XSS gains the target origin's browser privileges.
- Anti-forgery tokens do not repair XSS.
- Output safety and request-intent validation solve different problems.

<!-- question:end:cross-site-request-forgery-and-cookie-based-authentication-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design layered CSRF protection for a BFF architecture?

<!-- question:start:cross-site-request-forgery-and-cookie-based-authentication-advanced-q01 -->
<!-- question-id:cross-site-request-forgery-and-cookie-based-authentication-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Treat the browser-to-BFF cookie as an ambient credential even though the BFF keeps access tokens away from JavaScript. Use a host-only, `Secure`, `HttpOnly` cookie with the strictest workable `SameSite` value; require framework antiforgery validation or a signed session-bound token on unsafe methods; validate exact origins; reject clearly cross-site requests with Fetch Metadata where compatible; and restrict credentialed CORS. Keep backend service tokens scoped and server-side, and add reauthentication for high-impact actions.

##### Key Points to Mention

- A BFF reduces browser token exposure but does not remove CSRF.
- Browser and service trust boundaries need separate controls.
- Same-site subdomains should not be trusted automatically.
- Authorization and step-up authentication remain independent requirements.

<!-- question:end:cross-site-request-forgery-and-cookie-based-authentication-advanced-q01 -->

#### When is a custom-header CSRF defense sound, and how can it fail?

<!-- question:start:cross-site-request-forgery-and-cookie-based-authentication-advanced-q02 -->
<!-- question-id:cross-site-request-forgery-and-cookie-based-authentication-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

It is sound when all protected endpoints require a header that ordinary cross-site HTML cannot set, browsers must preflight cross-origin attempts, and the server allows credentialed requests only from exact trusted origins. It fails when endpoints accept alternate simple content types, validation is inconsistent, CORS reflects arbitrary origins, a trusted origin is compromised, or non-browser integrations bypass assumptions. Binding a secret token to the session adds stronger proof than checking a fixed header name alone.

##### Key Points to Mention

- Require the header consistently on every unsafe browser endpoint.
- Restrict methods, content types, and CORS together.
- Audit trusted origins and subdomains.
- Prefer a token value over a constant header when feasible.

<!-- question:end:cross-site-request-forgery-and-cookie-based-authentication-advanced-q02 -->

#### How should Origin and Fetch Metadata checks be deployed without breaking legitimate clients?

<!-- question:start:cross-site-request-forgery-and-cookie-based-authentication-advanced-q03 -->
<!-- question-id:cross-site-request-forgery-and-cookie-based-authentication-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Inventory browser, mobile, webhook, federation, and machine-to-machine callers first. Apply exact `Origin` validation and Fetch Metadata rejection to browser-facing state-changing routes, with explicit rules for missing or `null` values. Separate non-browser integrations onto endpoints authenticated with non-cookie credentials. Roll out in report or telemetry mode, observe false positives, account for trusted proxies and canonical external origins, then enforce while retaining antiforgery tokens for sensitive operations.

##### Key Points to Mention

- Policies should be endpoint and client aware.
- Parse origins rather than comparing strings loosely.
- Reverse proxies can affect the perceived target origin.
- Telemetry-driven rollout reduces compatibility surprises.

<!-- question:end:cross-site-request-forgery-and-cookie-based-authentication-advanced-q03 -->

#### How would you test an application's CSRF defenses?

<!-- question:start:cross-site-request-forgery-and-cookie-based-authentication-advanced-q04 -->
<!-- question-id:cross-site-request-forgery-and-cookie-based-authentication-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Enumerate every cookie-authenticated state-changing endpoint, including forms, JSON APIs, uploads, GraphQL mutations, login, account linking, and administrative actions. Attempt requests with missing, invalid, reused, and cross-session tokens; alternate methods and content types; cross-site forms; disallowed origins; and missing Fetch Metadata headers. Verify that safe methods have no side effects, CORS does not authorize untrusted origins, token failures are logged safely, and legitimate multi-tab and authentication flows still work.

##### Key Points to Mention

- Test the full endpoint inventory, not one representative form.
- Include browser-based attack pages and automated integration tests.
- Verify both rejection and legitimate workflow compatibility.
- Repeat tests when authentication, proxy, or CORS configuration changes.

<!-- question:end:cross-site-request-forgery-and-cookie-based-authentication-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
