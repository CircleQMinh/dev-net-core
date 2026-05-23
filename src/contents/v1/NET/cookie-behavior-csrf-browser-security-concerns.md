---
id: cookie-behavior-csrf-browser-security-concerns
topic: Authentication, authorization, and web security
subtopic: Cookie behavior, CSRF, and browser-based security concerns
category: .NET
---


## Overview

Cookie behavior, CSRF, and browser-based security concerns are important parts of secure web application design. They explain how browsers store authentication state, when credentials are automatically sent to a server, and how attackers can abuse that behavior if an application does not validate requests correctly.

In many web applications, especially server-rendered applications and cookie-authenticated APIs, the browser automatically includes cookies with matching requests. This is useful because users do not need to manually attach credentials to every request. However, it also creates security risks. If another website can cause the user's browser to send a state-changing request to your application, the browser may attach the user's authentication cookie even though the user did not intentionally perform the action. This is the core idea behind Cross-Site Request Forgery, usually called CSRF or XSRF.

This topic matters because authentication is not only about verifying who the user is. A secure application must also understand how browsers behave, how cookies are scoped, how cross-origin requests work, how tokens are protected, and how client-side attacks such as XSS can weaken otherwise correct authentication designs.

In interviews, this topic is commonly used to test whether a developer understands real production security rather than only framework syntax. A strong candidate should be able to explain cookie attributes such as `HttpOnly`, `Secure`, and `SameSite`; describe how CSRF attacks work; compare cookie-based authentication with bearer-token authentication; and design practical defenses for server-rendered apps, APIs, and SPAs.

## Core Concepts

### Browser Cookies

A cookie is a small piece of data stored by the browser and associated with a website. Servers usually create cookies with the `Set-Cookie` response header. On later matching requests, the browser sends those cookies back using the `Cookie` request header.

Cookies are commonly used for:

- Authentication sessions
- User preferences
- Temporary state
- Tracking and analytics
- Anti-forgery coordination

A simplified HTTP flow looks like this:

```http
HTTP/1.1 200 OK
Set-Cookie: sessionId=abc123; HttpOnly; Secure; SameSite=Lax; Path=/
```

Later, the browser may send:

```http
GET /account HTTP/1.1
Host: example.com
Cookie: sessionId=abc123
```

The important security point is that cookies are automatically attached by the browser when the request matches the cookie's rules. JavaScript does not need to manually add the cookie.

### Cookie Authentication

In cookie-based authentication, the server signs in a user and sends an authentication cookie to the browser. The cookie may contain an encrypted authentication ticket, a reference to a server-side session, or another protected value.

In ASP.NET Core, cookie authentication usually looks conceptually like this:

```csharp
builder.Services
    .AddAuthentication("AppCookie")
    .AddCookie("AppCookie", options =>
    {
        options.Cookie.Name = "__Host-AppAuth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.LoginPath = "/login";
        options.AccessDeniedPath = "/access-denied";
    });
```

The browser does not know whether the cookie represents an authenticated user. It only stores and sends the cookie according to browser rules. The server is responsible for validating the cookie and rebuilding the user identity.

### Important Cookie Attributes

Cookie attributes define how the browser stores and sends a cookie.

#### `HttpOnly`

`HttpOnly` prevents JavaScript from reading the cookie through `document.cookie`.

```http
Set-Cookie: sessionId=abc123; HttpOnly
```

This is important because if an attacker finds an XSS vulnerability, `HttpOnly` makes it harder to directly steal the session cookie.

However, `HttpOnly` does not prevent XSS itself. Malicious JavaScript can still perform actions as the user while it runs in the page.

#### `Secure`

`Secure` tells the browser to send the cookie only over HTTPS.

```http
Set-Cookie: sessionId=abc123; Secure
```

Authentication cookies should normally use `Secure` in production. Without it, cookies may be exposed over unencrypted HTTP.

#### `SameSite`

`SameSite` controls whether a cookie is sent on cross-site requests.

Common values are:

- `Strict`: send the cookie only in same-site contexts.
- `Lax`: send the cookie for same-site requests and some top-level navigations.
- `None`: send the cookie in cross-site contexts, but it must also use `Secure`.

Example:

```http
Set-Cookie: sessionId=abc123; HttpOnly; Secure; SameSite=Lax
```

`SameSite=Lax` is a common default for normal web app session cookies because it reduces many CSRF risks while keeping normal navigation usable.

`SameSite=Strict` is more restrictive and can improve protection, but it may break expected flows such as links from external sites.

`SameSite=None` is required for some cross-site scenarios, such as embedded applications, certain third-party integrations, or some external login flows. Because it allows cross-site cookie sending, it must be paired with `Secure`.

#### `Domain` and `Path`

`Domain` and `Path` control where a cookie is sent.

```http
Set-Cookie: sessionId=abc123; Domain=example.com; Path=/admin
```

If no `Domain` is specified, the cookie is usually host-only. Host-only cookies are often safer because they are not automatically shared with subdomains.

A broad domain such as `.example.com` can be risky because subdomains may receive or influence cookies. If one subdomain is compromised, it may affect other applications under the same parent domain.

#### `Expires` and `Max-Age`

`Expires` and `Max-Age` control cookie lifetime.

```http
Set-Cookie: rememberMe=true; Max-Age=2592000
```

Session cookies usually expire when the browser session ends. Persistent cookies survive longer.

Authentication cookies should use a lifetime that matches the risk of the application. Banking, admin, and sensitive enterprise systems usually require shorter lifetimes and stricter reauthentication than low-risk applications.

#### Cookie Prefixes

Cookie prefixes help enforce stronger browser rules.

`__Secure-` means the cookie must be set over HTTPS and use `Secure`.

`__Host-` is stricter. A `__Host-` cookie must use `Secure`, must not specify `Domain`, and must use `Path=/`.

Example:

```http
Set-Cookie: __Host-AppAuth=abc123; Path=/; Secure; HttpOnly; SameSite=Lax
```

For important authentication cookies, `__Host-` is often a good habit because it prevents accidental broad domain scoping.

### Site, Origin, and Cross-Origin Requests

Security discussions often use the words site and origin, but they are not identical.

An origin is defined by:

- Scheme
- Host
- Port

For example:

```text
https://app.example.com:443
```

A site is usually based on the registrable domain and scheme.

For example:

```text
https://app.example.com
https://api.example.com
```

These may be different origins but can still be same-site depending on the domain relationship.

This distinction matters because:

- CORS is based on origins.
- `SameSite` cookie behavior is based on site concepts.
- Browser security decisions may differ depending on whether something is cross-origin or cross-site.

### Same-Origin Policy

The Same-Origin Policy is a browser security rule that restricts one origin from reading sensitive data from another origin.

For example, a malicious website may be able to cause the browser to submit a form to a banking site, but it usually cannot read the banking site's response because of the Same-Origin Policy.

This is why CSRF is often about causing state-changing actions, not reading data directly.

### CORS Is Not CSRF Protection

CORS stands for Cross-Origin Resource Sharing. It controls whether browsers allow JavaScript from one origin to read responses from another origin.

CORS does not stop simple browser actions such as form posts, image requests, or top-level navigations. It also does not prove that a request was intentionally made by the real user.

A common mistake is assuming this is enough:

```csharp
app.UseCors();
```

CORS is important for API access control, but CSRF protection requires separate defenses such as anti-forgery tokens, `SameSite`, and origin validation.

### What CSRF Is

CSRF is an attack where a malicious site causes the victim's browser to send an unwanted request to a trusted application where the victim is already authenticated.

A simplified example:

```html
<form action="https://bank.example.com/transfer" method="post">
  <input type="hidden" name="toAccount" value="attacker" />
  <input type="hidden" name="amount" value="1000" />
</form>

<script>
  document.forms[0].submit();
</script>
```

If the victim is already signed in to `bank.example.com`, the browser may automatically attach the victim's session cookie. If the server only checks that the cookie is valid, it may process the request.

CSRF usually requires these conditions:

- The application uses automatically-sent credentials, such as cookies.
- The victim is authenticated.
- The target endpoint changes server-side state.
- The endpoint does not require an attacker-unknown value, such as a valid anti-forgery token.
- The browser can be tricked into sending the request.

### Why CSRF Usually Targets State-Changing Operations

Safe HTTP methods such as `GET` should not change server state. State-changing actions should use methods such as `POST`, `PUT`, `PATCH`, or `DELETE`.

Bad design:

```csharp
app.MapGet("/delete-account", (AppDbContext db) =>
{
    // Dangerous: state-changing action via GET
});
```

Better design:

```csharp
app.MapPost("/delete-account", async (
    DeleteAccountRequest request,
    AppDbContext db,
    CancellationToken cancellationToken) =>
{
    // Validate authorization, anti-forgery protections, and business rules.
});
```

Using correct HTTP methods does not solve CSRF by itself, but it reduces attack surface and aligns with browser and security expectations.

### Anti-Forgery Tokens

An anti-forgery token is a secret value generated by the server and required on unsafe requests. The attacker should not be able to guess or read the token from another site.

Common patterns include:

- Synchronizer token pattern
- Double-submit cookie pattern
- Header-based token submission for APIs and SPAs

In ASP.NET Core MVC or Razor Pages, anti-forgery protection can be enabled globally for unsafe methods:

```csharp
using Microsoft.AspNetCore.Mvc;

builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
});
```

A Razor form can include an anti-forgery token:

```html
<form asp-action="UpdateEmail" method="post">
    @Html.AntiForgeryToken()

    <input name="email" />
    <button type="submit">Save</button>
</form>
```

The server validates that the token submitted by the form matches the expected token for that user context.

### Anti-Forgery Tokens for SPAs

SPAs often call APIs using `fetch` or Axios. If the SPA uses cookie-based authentication, CSRF is still relevant because the browser can automatically attach the authentication cookie.

A common approach is:

1. Server issues an anti-forgery token.
2. Browser stores the token in a readable place, such as a non-`HttpOnly` CSRF token cookie.
3. JavaScript reads that token.
4. JavaScript sends the token in a custom request header.
5. Server validates the token.

Example client request:

```typescript
await fetch("/api/profile/email", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRF-TOKEN": csrfToken
  },
  body: JSON.stringify({ email: "new@example.com" })
});
```

Example ASP.NET Core setup:

```csharp
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
});
```

A custom header helps because normal cross-site HTML forms cannot add arbitrary headers. However, the server must still validate the token, and CORS must not allow untrusted origins to send credentialed requests.

### SameSite as CSRF Defense-in-Depth

`SameSite` reduces how often cookies are sent in cross-site contexts.

For many normal web applications:

```csharp
options.Cookie.SameSite = SameSiteMode.Lax;
```

For stricter applications:

```csharp
options.Cookie.SameSite = SameSiteMode.Strict;
```

For cross-site authentication or embedded app scenarios:

```csharp
options.Cookie.SameSite = SameSiteMode.None;
options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
```

`SameSite` is useful, but it should not always be the only CSRF defense. Complex systems, legacy browsers, subdomain risks, external identity providers, and unusual navigation flows can make token-based protection necessary.

### Origin and Referer Validation

For unsafe requests, the server can check `Origin` or `Referer` headers to ensure the request came from an expected origin.

Example idea:

```csharp
app.Use(async (context, next) =>
{
    if (HttpMethods.IsPost(context.Request.Method) ||
        HttpMethods.IsPut(context.Request.Method) ||
        HttpMethods.IsPatch(context.Request.Method) ||
        HttpMethods.IsDelete(context.Request.Method))
    {
        var origin = context.Request.Headers.Origin.ToString();

        if (!string.IsNullOrEmpty(origin) &&
            origin != "https://app.example.com")
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }
    }

    await next();
});
```

Origin validation is usually defense-in-depth, not a complete replacement for anti-forgery tokens. Some requests may omit these headers, and applications must decide how strictly to handle missing values.

### Fetch Metadata Headers

Modern browsers may send Fetch Metadata headers such as:

```text
Sec-Fetch-Site
Sec-Fetch-Mode
Sec-Fetch-Dest
```

These headers help servers detect cross-site requests. For example, a server can reject cross-site unsafe requests when `Sec-Fetch-Site` indicates the request is from another site.

This is useful defense-in-depth, especially for applications that want to block unexpected cross-site traffic. It should be tested carefully because integrations, embeds, identity providers, and legitimate cross-site flows may be affected.

### Cookie-Based Auth vs Bearer Tokens

Cookie-based authentication and bearer-token authentication have different browser security trade-offs.

Cookie-based authentication:

- Browser automatically sends cookies.
- Works well for server-rendered apps.
- Can use `HttpOnly` to reduce token theft through XSS.
- Requires CSRF protection for state-changing operations.
- Needs careful `SameSite`, `Secure`, and domain configuration.

Bearer-token authentication:

- Client usually sends the token manually in the `Authorization` header.
- Common for APIs and mobile clients.
- Classic CSRF risk is lower if the token is not automatically sent by the browser.
- XSS risk can be higher if tokens are stored in `localStorage` or accessible JavaScript memory.
- Token refresh and logout can be more complex.

Example bearer request:

```http
GET /api/orders HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOi...
```

A good interview answer should avoid saying one approach is always better. The right choice depends on the client type, threat model, deployment model, authentication provider, and operational requirements.

### XSS and Its Relationship to Cookies

XSS means an attacker can run JavaScript in the victim's browser within the trusted application's origin.

`HttpOnly` helps prevent JavaScript from reading cookies:

```http
Set-Cookie: sessionId=abc123; HttpOnly; Secure; SameSite=Lax
```

But XSS can still be dangerous because malicious JavaScript can:

- Send requests as the user
- Read non-`HttpOnly` tokens
- Modify page content
- Capture user input
- Trigger sensitive workflows
- Exfiltrate data visible in the page

This is why cookie security and XSS prevention must work together.

Common XSS defenses include:

- Output encoding
- Avoiding unsafe HTML injection
- Sanitizing user-generated HTML when HTML input is truly required
- Content Security Policy
- Avoiding inline script when possible
- Secure framework defaults
- Dependency hygiene
- Validating and constraining input

### CSRF Tokens and XSS

CSRF tokens protect against attackers on other sites. They do not protect well against an attacker who can run JavaScript inside your own site.

If an application has XSS, malicious JavaScript may be able to read page tokens, call APIs, or perform actions directly.

This is why security is layered:

- CSRF protection handles cross-site request abuse.
- XSS prevention protects the trusted origin itself.
- Authorization checks ensure the user is allowed to perform the action.
- Audit logs and anomaly detection help detect abuse.
- Step-up authentication protects sensitive actions.

### Credentialed CORS Requests

A cross-origin API call that includes cookies requires careful server and client configuration.

Client example:

```typescript
await fetch("https://api.example.com/orders", {
  method: "GET",
  credentials: "include"
});
```

Server configuration must explicitly allow the trusted origin and credentials:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("SpaClient", policy =>
    {
        policy
            .WithOrigins("https://app.example.com")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});
```

Avoid this pattern with credentials:

```csharp
policy
    .AllowAnyOrigin()
    .AllowCredentials();
```

Credentialed CORS should be restricted to specific trusted origins. Allowing broad origins with credentials can expose sensitive APIs.

### Browser Storage Choices

Browser applications commonly store state in:

- Cookies
- `localStorage`
- `sessionStorage`
- In-memory variables
- IndexedDB

Security trade-offs:

| Storage option | Automatically sent? | Readable by JavaScript? | CSRF risk | XSS token theft risk |
|---|---:|---:|---:|---:|
| `HttpOnly` cookie | Yes | No | Higher without CSRF defense | Lower direct theft risk |
| Non-`HttpOnly` cookie | Yes | Yes | Higher without CSRF defense | Higher |
| `localStorage` | No | Yes | Lower classic CSRF risk | Higher |
| In-memory token | No | Yes while app runs | Lower classic CSRF risk | Still exposed during XSS |

For browser apps, the decision is not simply "cookies are secure" or "tokens are secure." Each option changes the attack surface.

### Session Expiration and Logout

Cookie security also includes lifecycle management.

Important practices include:

- Use reasonable expiration times.
- Rotate session identifiers after login.
- Invalidate server-side sessions on logout when using server-side session storage.
- Clear cookies on logout.
- Consider sliding expiration carefully.
- Require reauthentication for sensitive operations.
- Avoid long-lived authentication cookies for high-risk apps.

Example logout cookie clearing:

```csharp
await HttpContext.SignOutAsync("AppCookie");
```

If the authentication state is fully contained in a protected cookie, logout usually removes the browser cookie. If the system uses server-side sessions or refresh tokens, the server should also revoke or invalidate the related server-side state.

### Clickjacking

Clickjacking tricks users into clicking hidden or disguised UI elements, often by embedding the target site in an iframe.

Defenses include:

- `Content-Security-Policy: frame-ancestors 'self'`
- `X-Frame-Options: DENY`
- `X-Frame-Options: SAMEORIGIN`

Example:

```http
Content-Security-Policy: frame-ancestors 'self'
```

This matters for authentication and CSRF because attackers may combine UI deception with authenticated user actions.

### Content Security Policy

Content Security Policy, or CSP, helps reduce the impact of XSS by controlling where scripts, styles, images, frames, and other resources can be loaded from.

Example:

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'self'
```

CSP is not a replacement for output encoding or secure coding, but it is valuable defense-in-depth.

### HTTPS and HSTS

HTTPS protects cookies and credentials in transit. HSTS tells browsers to use HTTPS for future requests to the site.

Example:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

For production authentication systems, HTTPS should be mandatory. Authentication cookies should use `Secure`, and HTTP endpoints should redirect or be disabled.

### Practical ASP.NET Core Cookie Configuration

A practical cookie configuration might look like this:

```csharp
builder.Services
    .AddAuthentication("AppCookie")
    .AddCookie("AppCookie", options =>
    {
        options.Cookie.Name = "__Host-AppAuth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.Path = "/";

        options.ExpireTimeSpan = TimeSpan.FromHours(1);
        options.SlidingExpiration = true;

        options.LoginPath = "/login";
        options.LogoutPath = "/logout";
        options.AccessDeniedPath = "/access-denied";
    });
```

Important notes:

- Use HTTPS in production.
- Use `HttpOnly` for authentication cookies.
- Use `Secure` for authentication cookies.
- Prefer host-only cookies for authentication.
- Use `SameSite=Lax` or `Strict` when possible.
- Use `SameSite=None; Secure` only when cross-site cookie sending is required.
- Add anti-forgery validation for unsafe methods when cookies authenticate browser requests.

### Middleware Ordering and Security

Security features often depend on correct ASP.NET Core middleware order.

A common order is:

```csharp
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();

app.UseRouting();

app.UseCors("SpaClient");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
```

General guidance:

- HTTPS redirection and HSTS should happen early.
- Routing should happen before authentication and authorization.
- CORS should be placed where it can apply to endpoints correctly.
- Authentication must run before authorization.
- Endpoint mappings should happen after required middleware setup.

Security mistakes can happen even when individual features are configured correctly but placed in the wrong order.

### Common Mistakes

Common mistakes include:

- Assuming CORS prevents CSRF.
- Using `GET` for state-changing operations.
- Storing raw sensitive data in cookies.
- Forgetting `HttpOnly` on authentication cookies.
- Forgetting `Secure` in production.
- Using `SameSite=None` without understanding cross-site risk.
- Using broad cookie domains unnecessarily.
- Trusting authentication without checking authorization.
- Storing long-lived access tokens in `localStorage` without considering XSS.
- Disabling anti-forgery validation because it is inconvenient during development.
- Allowing credentialed CORS from untrusted origins.
- Believing `HttpOnly` prevents XSS.
- Believing CSRF tokens protect against XSS.
- Not testing login flows, external identity providers, iframes, and SPAs with real browser behavior.

### Best Practices

Good security habits include:

- Use HTTPS everywhere.
- Mark authentication cookies as `HttpOnly`.
- Mark authentication cookies as `Secure`.
- Use `SameSite=Lax` or `Strict` when possible.
- Use `SameSite=None; Secure` only when cross-site cookies are required.
- Prefer host-only cookies or `__Host-` prefixed cookies for authentication.
- Protect unsafe methods with anti-forgery tokens when using cookie authentication.
- Keep `GET` operations safe and idempotent.
- Validate authorization on every sensitive operation.
- Restrict credentialed CORS to trusted origins only.
- Add origin or Fetch Metadata checks for defense-in-depth when appropriate.
- Use CSP, output encoding, and safe rendering to reduce XSS risk.
- Avoid storing sensitive raw data in client-side storage.
- Use short-lived sessions for sensitive applications.
- Require step-up authentication for high-risk actions.
- Test browser security behavior in environments that match production.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

<!-- question:start:cookie-security-csrf-browser-beginner-q01 -->
<!-- question-id:cookie-security-csrf-browser-beginner-q01 -->
<!-- question-level:beginner -->
#### 1. What is a cookie, and why is it important for authentication?

##### Expected Answer

A cookie is a small piece of data stored by the browser and associated with a specific website. The server usually sends it using the `Set-Cookie` response header, and the browser sends it back on later matching requests using the `Cookie` request header.

Cookies are important for authentication because many web applications store authentication state in a cookie. After login, the server sends an authentication cookie. On later requests, the browser automatically includes that cookie, allowing the server to identify the user.

The security concern is that cookies are automatically sent by the browser. This is convenient, but it means developers must configure cookies carefully and protect state-changing requests from CSRF.

##### Key Points to Mention

- Cookies are created with `Set-Cookie`.
- Browsers automatically send matching cookies.
- Authentication cookies often represent a signed-in session.
- Cookie attributes control security behavior.
- Automatically-sent cookies are one reason CSRF exists.

<!-- question:end:cookie-security-csrf-browser-beginner-q01 -->

<!-- question:start:cookie-security-csrf-browser-beginner-q02 -->
<!-- question-id:cookie-security-csrf-browser-beginner-q02 -->
<!-- question-level:beginner -->
#### 2. What do `HttpOnly`, `Secure`, and `SameSite` mean?

##### Expected Answer

`HttpOnly` prevents JavaScript from reading the cookie through `document.cookie`. It helps reduce direct session cookie theft if an XSS vulnerability exists.

`Secure` means the cookie should only be sent over HTTPS. Authentication cookies should use `Secure` in production to avoid exposing credentials over unencrypted HTTP.

`SameSite` controls whether the browser sends the cookie in cross-site requests. `Strict` is the most restrictive, `Lax` is a practical default for many applications, and `None` allows cross-site cookie sending but must be combined with `Secure`.

##### Key Points to Mention

- `HttpOnly` protects against direct JavaScript cookie theft.
- `Secure` requires HTTPS.
- `SameSite` helps reduce CSRF risk.
- `SameSite=None` requires `Secure`.
- These attributes reduce risk but do not replace all other security controls.

<!-- question:end:cookie-security-csrf-browser-beginner-q02 -->

<!-- question:start:cookie-security-csrf-browser-beginner-q03 -->
<!-- question-id:cookie-security-csrf-browser-beginner-q03 -->
<!-- question-level:beginner -->
#### 3. What is CSRF?

##### Expected Answer

CSRF, or Cross-Site Request Forgery, is an attack where a malicious website causes the victim's browser to send an unwanted request to another site where the victim is already authenticated.

The attack works because browsers automatically include cookies with matching requests. If the target application only checks that the user has a valid authentication cookie, it may process the request even though the user did not intentionally perform the action.

CSRF usually targets state-changing operations such as updating an email address, transferring money, deleting data, or changing a password.

##### Key Points to Mention

- CSRF abuses automatically-sent credentials.
- The victim must usually already be authenticated.
- The attacker often cannot read the response but can cause an action.
- State-changing operations are the main concern.
- Anti-forgery tokens and `SameSite` help prevent it.

<!-- question:end:cookie-security-csrf-browser-beginner-q03 -->

<!-- question:start:cookie-security-csrf-browser-beginner-q04 -->
<!-- question-id:cookie-security-csrf-browser-beginner-q04 -->
<!-- question-level:beginner -->
#### 4. Is CORS the same as CSRF protection?

##### Expected Answer

No. CORS and CSRF protection solve different problems.

CORS controls whether browser JavaScript from one origin can read responses from another origin. CSRF protection prevents another site from causing a user's browser to perform unwanted authenticated actions.

A malicious website may not be able to read the response because of CORS or the Same-Origin Policy, but it may still be able to submit a form or trigger a request. Therefore, applications that use cookie-based authentication still need CSRF defenses for unsafe operations.

##### Key Points to Mention

- CORS controls cross-origin response access.
- CSRF is about unwanted authenticated actions.
- CORS is not enough to stop form-based CSRF.
- Cookie-authenticated APIs need separate CSRF protection.
- Do not rely on CORS alone for request integrity.

<!-- question:end:cookie-security-csrf-browser-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

<!-- question:start:cookie-security-csrf-browser-intermediate-q01 -->
<!-- question-id:cookie-security-csrf-browser-intermediate-q01 -->
<!-- question-level:intermediate -->
#### 1. How do anti-forgery tokens prevent CSRF?

##### Expected Answer

Anti-forgery tokens prevent CSRF by requiring unsafe requests to include a secret value that an attacker from another site cannot know.

In a typical server-rendered application, the server generates a token and includes it in the form. When the form is submitted, the server validates the token. A malicious site can cause a browser to submit a request, but it cannot read the legitimate page to obtain the correct token due to browser security rules.

For SPAs using cookie authentication, the server may issue a CSRF token that JavaScript sends back in a custom header such as `X-CSRF-TOKEN`. The server validates that header before processing unsafe operations.

##### Key Points to Mention

- Tokens must be unpredictable and tied to the user/session context.
- The server validates the token on unsafe methods.
- Normal cross-site forms cannot add custom headers.
- Anti-forgery tokens are especially important with cookie authentication.
- XSS can weaken token-based CSRF defenses.

<!-- question:end:cookie-security-csrf-browser-intermediate-q01 -->

<!-- question:start:cookie-security-csrf-browser-intermediate-q02 -->
<!-- question-id:cookie-security-csrf-browser-intermediate-q02 -->
<!-- question-level:intermediate -->
#### 2. How would you configure a secure authentication cookie in ASP.NET Core?

##### Expected Answer

A secure authentication cookie should use HTTPS, be inaccessible to JavaScript when possible, and have appropriate same-site behavior.

Example:

```csharp
builder.Services
    .AddAuthentication("AppCookie")
    .AddCookie("AppCookie", options =>
    {
        options.Cookie.Name = "__Host-AppAuth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.Path = "/";

        options.ExpireTimeSpan = TimeSpan.FromHours(1);
        options.SlidingExpiration = true;
    });
```

For many normal web apps, `SameSite=Lax` is a practical default. For stricter systems, `Strict` may be considered. For cross-site scenarios, `None` may be required, but it must use `Secure` and should be combined with other protections.

##### Key Points to Mention

- Use `HttpOnly` for auth cookies.
- Use `Secure` in production.
- Choose `SameSite` based on the app flow.
- Prefer host-only or `__Host-` cookies.
- Configure expiration and logout behavior.
- Add CSRF protection for unsafe methods.

<!-- question:end:cookie-security-csrf-browser-intermediate-q02 -->

<!-- question:start:cookie-security-csrf-browser-intermediate-q03 -->
<!-- question-id:cookie-security-csrf-browser-intermediate-q03 -->
<!-- question-level:intermediate -->
#### 3. Compare cookie-based authentication and bearer-token authentication in browser apps.

##### Expected Answer

Cookie-based authentication relies on the browser automatically sending cookies with requests. It works well for server-rendered applications and can use `HttpOnly` cookies to reduce direct token theft through XSS. However, because cookies are automatically sent, CSRF protection is needed for unsafe operations.

Bearer-token authentication usually sends tokens manually in the `Authorization` header. This reduces classic CSRF risk because another site cannot normally force the browser to add that custom authorization header. However, if tokens are stored in `localStorage` or readable JavaScript memory, XSS can steal them more easily.

Neither approach is always better. Cookie authentication is often strong for browser-first applications when combined with `HttpOnly`, `Secure`, `SameSite`, CSRF tokens, and good XSS defenses. Bearer tokens are common for APIs, mobile clients, service-to-service communication, and some SPAs, but storage and refresh-token handling must be designed carefully.

##### Key Points to Mention

- Cookies are automatically sent.
- Bearer tokens are usually manually attached.
- Cookies need CSRF protection.
- Browser-stored bearer tokens need strong XSS defenses.
- `HttpOnly` cookies reduce direct token theft.
- The best option depends on the threat model and client type.

<!-- question:end:cookie-security-csrf-browser-intermediate-q03 -->

<!-- question:start:cookie-security-csrf-browser-intermediate-q04 -->
<!-- question-id:cookie-security-csrf-browser-intermediate-q04 -->
<!-- question-level:intermediate -->
#### 4. Why should state-changing operations not use `GET`?

##### Expected Answer

`GET` should be safe and should not change server state. Browsers, crawlers, caches, link previews, and prefetching features may issue `GET` requests automatically. If a `GET` endpoint deletes data, changes account settings, or performs a transaction, it becomes easier to trigger accidental or malicious actions.

State-changing operations should use methods such as `POST`, `PUT`, `PATCH`, or `DELETE`, and should include authorization checks and CSRF protection when using cookie authentication.

##### Key Points to Mention

- `GET` should be safe and idempotent from a user-action perspective.
- Browsers and tools may trigger `GET` automatically.
- CSRF attacks become easier when mutations use `GET`.
- Use unsafe methods for mutations.
- Still validate authorization and anti-forgery tokens.

<!-- question:end:cookie-security-csrf-browser-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

<!-- question:start:cookie-security-csrf-browser-advanced-q01 -->
<!-- question-id:cookie-security-csrf-browser-advanced-q01 -->
<!-- question-level:advanced -->
#### 1. How would you design CSRF protection for a React SPA that uses cookie authentication with an ASP.NET Core API?

##### Expected Answer

A good design starts by recognizing that cookie authentication means the browser may automatically include the authentication cookie on API requests. Therefore, unsafe API operations need CSRF protection.

A practical design is:

1. Use an `HttpOnly`, `Secure`, `SameSite` authentication cookie.
2. Issue a separate CSRF token that the SPA can read.
3. Have the SPA send the CSRF token in a custom header, such as `X-CSRF-TOKEN`, on unsafe requests.
4. Validate the token on the server.
5. Restrict credentialed CORS to the exact trusted SPA origin.
6. Keep `GET` endpoints safe.
7. Add XSS defenses because XSS can bypass or weaken CSRF protection.
8. Use origin or Fetch Metadata checks as defense-in-depth where appropriate.

Example client request:

```typescript
await fetch("https://api.example.com/profile/email", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRF-TOKEN": csrfToken
  },
  body: JSON.stringify({ email: "new@example.com" })
});
```

The design should also consider deployment details. If the SPA and API are on different origins, CORS must allow credentials only from trusted origins. If the SPA and API are cross-site, cookie `SameSite` may need to be `None`, which increases the importance of token validation.

##### Key Points to Mention

- Cookie auth in SPAs still has CSRF risk.
- Auth cookie should be `HttpOnly`, `Secure`, and appropriately `SameSite`.
- CSRF token is sent in a custom header.
- Server must validate the token.
- Credentialed CORS must be restricted.
- XSS prevention is still necessary.
- Consider Origin and Fetch Metadata validation.

<!-- question:end:cookie-security-csrf-browser-advanced-q01 -->

<!-- question:start:cookie-security-csrf-browser-advanced-q02 -->
<!-- question-id:cookie-security-csrf-browser-advanced-q02 -->
<!-- question-level:advanced -->
#### 2. When is `SameSite=None` required, and what risks does it introduce?

##### Expected Answer

`SameSite=None` is required when a cookie must be sent in cross-site contexts. Examples include some embedded applications, iframes, third-party integrations, and certain external authentication or identity-provider flows.

The risk is that the cookie becomes eligible to be sent on cross-site requests. This can increase CSRF exposure if the application relies only on cookies to authorize state-changing requests. Because of that, `SameSite=None` must be combined with `Secure`, and applications should use anti-forgery tokens, origin validation, or other defense-in-depth protections for unsafe operations.

A candidate should also mention that not every app needs `SameSite=None`. Using it unnecessarily weakens browser-level CSRF protection.

##### Key Points to Mention

- `SameSite=None` allows cross-site cookie sending.
- It must be paired with `Secure`.
- It is common in embedded or cross-site auth flows.
- It can increase CSRF risk.
- Use only when the app flow requires it.
- Pair it with token validation and other safeguards.

<!-- question:end:cookie-security-csrf-browser-advanced-q02 -->

<!-- question:start:cookie-security-csrf-browser-advanced-q03 -->
<!-- question-id:cookie-security-csrf-browser-advanced-q03 -->
<!-- question-level:advanced -->
#### 3. How does XSS change the security model of CSRF protection?

##### Expected Answer

CSRF protection assumes the attacker is outside the trusted origin and cannot read the legitimate page or token. XSS changes that assumption because the attacker can run JavaScript inside the trusted origin.

If XSS exists, the attacker may be able to read CSRF tokens from the page, send authenticated requests directly, capture user input, or interact with the application as the user. `HttpOnly` can prevent direct reading of authentication cookies, but it does not stop malicious JavaScript from performing actions while running in the page.

Therefore, CSRF tokens are necessary but not sufficient. Applications also need XSS prevention through output encoding, safe rendering, avoiding unsafe HTML injection, CSP, input handling, dependency security, and framework-safe defaults.

##### Key Points to Mention

- CSRF assumes attacker cannot run code in the trusted origin.
- XSS breaks that assumption.
- `HttpOnly` does not stop malicious requests from same-origin JavaScript.
- XSS can expose non-`HttpOnly` CSRF tokens.
- CSRF defense and XSS defense are separate layers.
- CSP and output encoding are important defense-in-depth.

<!-- question:end:cookie-security-csrf-browser-advanced-q03 -->

<!-- question:start:cookie-security-csrf-browser-advanced-q04 -->
<!-- question-id:cookie-security-csrf-browser-advanced-q04 -->
<!-- question-level:advanced -->
#### 4. What browser security headers would you consider for a cookie-authenticated web application?

##### Expected Answer

For a cookie-authenticated web application, useful browser security headers include:

- `Strict-Transport-Security` to enforce HTTPS after the first secure visit.
- `Content-Security-Policy` to reduce XSS and control framing, scripts, and resources.
- `X-Frame-Options` or CSP `frame-ancestors` to reduce clickjacking risk.
- `Referrer-Policy` to control how much referrer data is sent.
- `X-Content-Type-Options: nosniff` to reduce MIME sniffing risk.
- Potentially `Permissions-Policy` to disable unnecessary browser features.

The exact configuration depends on the app. A strict CSP can break existing scripts if introduced without testing. Security headers should be validated in a staging environment and monitored after deployment.

##### Key Points to Mention

- HSTS supports HTTPS enforcement.
- CSP helps reduce XSS impact.
- `frame-ancestors` or `X-Frame-Options` helps prevent clickjacking.
- Security headers are defense-in-depth.
- Strict policies require testing.
- Headers do not replace secure server-side authorization.

<!-- question:end:cookie-security-csrf-browser-advanced-q04 -->

<!-- question:start:cookie-security-csrf-browser-advanced-q05 -->
<!-- question-id:cookie-security-csrf-browser-advanced-q05 -->
<!-- question-level:advanced -->
#### 5. How would you troubleshoot a cookie not being sent from a browser-based client?

##### Expected Answer

Start by checking the browser developer tools. Look at the response that sets the cookie and verify the `Set-Cookie` attributes. Then inspect the request where the cookie is expected and confirm whether the browser includes it.

Common causes include:

- The request is HTTP but the cookie uses `Secure`.
- The cookie domain or path does not match the request.
- The request is cross-site and `SameSite=Lax` or `Strict` prevents sending.
- The cookie uses `SameSite=None` but does not use `Secure`.
- The frontend request did not include credentials.
- The server CORS policy does not allow credentials.
- The cookie expired.
- The browser blocked a third-party cookie scenario.
- The app is mixing different hosts, ports, or schemes between frontend and backend.

For a SPA using `fetch`, the client may need:

```typescript
fetch("https://api.example.com/me", {
  credentials: "include"
});
```

For credentialed CORS, the server must allow the specific origin and credentials.

##### Key Points to Mention

- Inspect `Set-Cookie` and outgoing request cookies.
- Check `Secure`, `SameSite`, `Domain`, `Path`, and expiration.
- Check frontend `credentials: "include"`.
- Check server CORS credentials configuration.
- Watch for cross-site and third-party-cookie restrictions.
- Match local development and production behavior carefully.

<!-- question:end:cookie-security-csrf-browser-advanced-q05 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
