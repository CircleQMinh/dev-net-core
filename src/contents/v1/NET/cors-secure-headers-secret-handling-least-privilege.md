---
id: cors-secure-headers-secret-handling-and-least-privilege
topic: Authentication, authorization, and web security
subtopic: CORS, secure headers, secret handling, and least privilege
category: Design & Architecture
---


## Overview

CORS, secure headers, secret handling, and least privilege are core web security topics that help protect applications from browser-based attacks, data leakage, credential misuse, and excessive access rights.

In a modern full-stack application, security is not handled by one feature only. It is usually built from multiple layers:

- CORS controls which browser-based frontends are allowed to read responses from an API across origins.
- Secure HTTP response headers instruct browsers to apply additional protections such as HTTPS enforcement, script restrictions, clickjacking protection, MIME-sniffing prevention, and referrer control.
- Secret handling protects sensitive values such as connection strings, API keys, signing keys, certificates, and tokens.
- Least privilege limits what users, services, applications, and infrastructure identities can access.

These topics are important because many production security problems are caused by misconfiguration rather than complex code bugs. Examples include allowing any CORS origin with credentials, missing security headers, committing secrets to source control, giving an application broad database permissions, or assigning a cloud identity access to an entire subscription when it only needs one resource.

For interviews, this topic is important because it tests practical security judgment. A strong candidate should be able to explain not only what CORS or security headers are, but also where they fit in the request pipeline, what they do not protect against, how to configure them safely, how to manage secrets across environments, and how to design access using least privilege.

## Core Concepts

### Same-Origin Policy and CORS

The same-origin policy is a browser security rule that restricts a script loaded from one origin from reading sensitive data from another origin unless the target server explicitly allows it.

An origin is defined by the combination of:

- Scheme, such as `https`
- Host, such as `app.example.com`
- Port, such as `443`

For example, these are different origins:

```text
https://app.example.com
https://api.example.com
http://app.example.com
https://app.example.com:5001
```

CORS stands for Cross-Origin Resource Sharing. It is a browser-enforced mechanism that allows a server to say which origins can read cross-origin responses.

CORS is not authentication. CORS does not prove who the user is. It only controls whether the browser exposes the response to frontend JavaScript.

A common example is a React app calling an ASP.NET Core API:

```text
Frontend: https://app.example.com
API:      https://api.example.com
```

Because the frontend and API use different hosts, the browser treats them as different origins. The API must return appropriate CORS headers before browser JavaScript can read the response.

### Simple Requests and Preflight Requests

Some cross-origin requests are considered simple requests. Others require a preflight request.

A preflight request is an automatic `OPTIONS` request sent by the browser before the actual request. The browser asks the server whether the cross-origin request is allowed.

A preflight is commonly triggered by:

- Non-simple HTTP methods such as `PUT`, `PATCH`, or `DELETE`
- Custom request headers such as `Authorization` or `X-Correlation-Id`
- Certain content types, such as `application/json`

Example preflight request:

```http
OPTIONS /api/orders HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type, authorization
```

Example response:

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST
Access-Control-Allow-Headers: content-type, authorization
```

If the preflight response does not allow the origin, method, or headers, the browser blocks the actual request.

### Safe CORS Configuration

A safe CORS policy should be as specific as possible.

Good approach:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendApp", policy =>
    {
        policy
            .WithOrigins("https://app.example.com")
            .WithMethods("GET", "POST", "PUT", "DELETE")
            .WithHeaders("Content-Type", "Authorization")
            .AllowCredentials();
    });
});

var app = builder.Build();

app.UseRouting();
app.UseCors("FrontendApp");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
```

Risky approach:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("Unsafe", policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});
```

`AllowAnyOrigin` may be acceptable for a public read-only API that does not use cookies, credentials, or sensitive user data. It is usually unsafe for authenticated business APIs.

The most dangerous CORS mistake is allowing any origin together with credentials. Credentialed requests include cookies, client certificates, or HTTP authentication. For credentialed cross-origin requests, the server should allow only trusted origins.

Important CORS habits:

- Do not use CORS as an authorization mechanism.
- Do not allow all origins for private APIs.
- Do not allow credentials unless the frontend really needs them.
- Keep environment-specific origins in configuration.
- Configure CORS before authorization in the ASP.NET Core middleware pipeline when endpoint routing is used.
- Remember that CORS is enforced by browsers, not by every HTTP client.

### CORS vs CSRF

CORS and CSRF are related to browser security, but they solve different problems.

CORS controls whether browser JavaScript can read a cross-origin response.

CSRF, or Cross-Site Request Forgery, is an attack where a malicious site causes a user's browser to send a request to another site where the user is already authenticated.

CORS does not automatically prevent CSRF. If an application uses cookies for authentication, the browser may send those cookies automatically depending on cookie settings. Even if CORS blocks the malicious site from reading the response, the state-changing request may still reach the server unless CSRF protection is implemented.

For cookie-based authentication, use protections such as:

- Anti-forgery tokens
- `SameSite` cookies
- Origin or Referer validation for sensitive operations
- Safe HTTP semantics, where `GET` does not change state
- Explicit re-authentication for high-risk operations

### Secure HTTP Response Headers

Secure headers are response headers that tell browsers to apply additional security rules.

They do not replace authentication, authorization, validation, or secure coding. They reduce the impact of common browser-based attacks and misconfigurations.

Common secure headers include:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'
```

Important headers:

- `Strict-Transport-Security` tells browsers to use HTTPS for future requests.
- `Content-Security-Policy` restricts where scripts, styles, images, frames, and other resources can be loaded from.
- `X-Content-Type-Options: nosniff` prevents MIME-sniffing attacks.
- `X-Frame-Options` helps prevent clickjacking in older browser scenarios.
- `frame-ancestors` in CSP is the modern way to control who can embed the page.
- `Referrer-Policy` controls how much referrer information is sent to other sites.
- `Permissions-Policy` limits browser features such as camera, microphone, geolocation, and payment APIs.
- `Cache-Control` can prevent sensitive pages from being stored by browsers or proxies.

### Adding Secure Headers in ASP.NET Core

Secure headers can be added using middleware.

Example:

```csharp
app.Use(async (context, next) =>
{
    context.Response.Headers.TryAdd("X-Content-Type-Options", "nosniff");
    context.Response.Headers.TryAdd("X-Frame-Options", "DENY");
    context.Response.Headers.TryAdd("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.TryAdd("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    context.Response.Headers.TryAdd(
        "Content-Security-Policy",
        "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");

    await next();
});
```

HSTS is commonly configured separately:

```csharp
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();
```

Security headers should be tested carefully. For example, a strict CSP can break scripts, styles, analytics, fonts, images, or third-party integrations if the policy does not allow the required sources.

A practical rollout strategy for CSP is:

1. Inventory scripts, styles, images, fonts, APIs, and frame sources.
2. Start with a report-only policy.
3. Review violations.
4. Remove unsafe inline scripts where possible.
5. Use nonces or hashes when inline scripts are unavoidable.
6. Move from report-only mode to enforcement.

### Content Security Policy

Content Security Policy, or CSP, is one of the most powerful browser security headers. It helps reduce the risk of cross-site scripting by controlling which sources the browser may load code and resources from.

Example strict starting point:

```http
Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

Example policy for an application that calls an API and loads images from a CDN:

```http
Content-Security-Policy: default-src 'self'; connect-src 'self' https://api.example.com; img-src 'self' https://cdn.example.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

Common CSP mistakes include:

- Using `default-src *`
- Allowing `unsafe-inline` without understanding the risk
- Allowing `unsafe-eval` unnecessarily
- Forgetting `frame-ancestors`
- Not testing third-party scripts and analytics
- Using a copied policy that does not match the real application

CSP is application-specific. A strong policy for one application may break another application.

### Secret Handling

A secret is any value that grants access or can be used to impersonate an identity.

Examples include:

- Database passwords
- API keys
- OAuth client secrets
- JWT signing keys
- Encryption keys
- Storage account keys
- Connection strings
- Certificates and private keys
- Service bus connection strings

Secret handling is the practice of storing, accessing, rotating, and auditing secrets safely.

Bad secret handling example:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=prod-db;Database=AppDb;User Id=app;Password=SuperSecretPassword;"
  }
}
```

This is risky because configuration files are often committed, copied, logged, shared, or deployed to multiple environments.

Better options include:

- Local development: user secrets or local environment variables
- CI/CD: secure pipeline secret storage
- Production: managed secret store such as Azure Key Vault
- Azure-hosted apps: managed identity instead of stored credentials where possible

### User Secrets, Environment Variables, and Key Vault

In ASP.NET Core development, User Secrets can store local development secrets outside the project folder.

Example:

```bash
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost;Database=AppDb;Trusted_Connection=True;"
```

User Secrets are useful for local development, but they are not a production secret store.

Environment variables are often used in deployed applications:

```bash
ConnectionStrings__DefaultConnection="Server=prod-db;Database=AppDb;..."
```

The double underscore maps to nested configuration keys in ASP.NET Core.

For production, a managed secret store is safer. In Azure, an ASP.NET Core application can load secrets from Key Vault using managed identity.

Example concept:

```csharp
builder.Configuration.AddAzureKeyVault(
    new Uri($"https://{builder.Configuration["KeyVaultName"]}.vault.azure.net/"),
    new DefaultAzureCredential());
```

With managed identity, the application does not need a client secret in its configuration. Azure provides the identity, and access to the vault is controlled through permissions.

### Secret Handling Best Practices

Good secret handling habits include:

- Never commit secrets to source control.
- Never put production secrets in development configuration.
- Avoid sharing secrets in chat, email, tickets, logs, or screenshots.
- Prefer managed identities over static credentials when possible.
- Scope each secret to the minimum required access.
- Rotate secrets regularly and immediately after suspected exposure.
- Use separate secrets per environment.
- Use separate identities per application or service.
- Mask secrets in logs and telemetry.
- Avoid long-lived personal access tokens.
- Audit who accessed secrets and when.
- Delete unused secrets.

One important habit is to design the application so that secrets are read at startup or through a centralized provider, not scattered across the codebase.

### Least Privilege

Least privilege means granting only the minimum permissions required to perform a task, for the minimum scope, and for the minimum necessary duration.

It applies to:

- Human users
- Application users
- Service accounts
- Managed identities
- Database accounts
- Cloud roles
- CI/CD pipelines
- API permissions
- File and storage access

Bad example:

```text
App Service identity has Owner access to the entire Azure subscription.
```

Better example:

```text
App Service managed identity has Key Vault Secrets User access only on one Key Vault.
The same identity has read/write access only to the specific storage container it needs.
```

Least privilege limits blast radius. If a user, token, or service identity is compromised, the attacker gets fewer permissions.

### Least Privilege in Application Code

Least privilege is not only an infrastructure concept. It also applies inside application code.

Examples:

- Users should only access resources they own or are allowed to manage.
- Admin permissions should be separated from normal user permissions.
- Sensitive operations should require explicit authorization checks.
- APIs should avoid returning fields the client does not need.
- Background jobs should use separate identities from web APIs.
- Read-only workflows should use read-only database permissions where practical.

Example policy-based authorization in ASP.NET Core:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CanApproveOrder", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim("permission", "orders.approve");
    });
});

app.MapPost("/orders/{id:int}/approve", ApproveOrder)
   .RequireAuthorization("CanApproveOrder");
```

This is better than checking only whether the user is logged in.

For resource-based authorization, the application should verify access to the specific resource:

```csharp
if (order.CustomerId != currentUser.CustomerId && !currentUser.IsAdmin)
{
    return Results.Forbid();
}
```

Authentication answers: who are you?

Authorization answers: what are you allowed to do?

Resource-based authorization answers: are you allowed to do this action on this specific object?

### CORS, Headers, Secrets, and Least Privilege Together

These security practices are strongest when used together.

Example production API design:

- The API allows CORS only from `https://app.example.com`.
- The API requires authentication and authorization for protected endpoints.
- The frontend uses secure cookies or tokens based on the chosen authentication model.
- CSRF protection is used when cookies are automatically sent.
- Secure headers are applied consistently.
- CSP is tuned to the actual frontend.
- Secrets are stored in Key Vault and accessed by managed identity.
- The managed identity has only the Key Vault and database permissions it needs.
- Admin actions require dedicated permissions.
- Logs never include tokens, passwords, or full connection strings.

A common interview mistake is treating one control as if it solves everything. For example, CORS does not replace authorization, CSP does not replace output encoding, Key Vault does not fix excessive permissions, and least privilege does not remove the need for input validation.

### Common Mistakes

Common CORS mistakes:

- Using `AllowAnyOrigin` for private APIs.
- Allowing credentials for untrusted origins.
- Assuming CORS protects APIs from all clients.
- Forgetting that tools like Postman, curl, and backend services are not restricted by browser CORS.
- Adding CORS headers manually instead of using framework policy configuration.
- Applying CORS middleware in the wrong order.

Common secure header mistakes:

- Adding headers without testing their behavior.
- Using weak CSP values such as `default-src *`.
- Relying only on `X-Frame-Options` instead of also using CSP `frame-ancestors`.
- Forgetting HSTS in production HTTPS sites.
- Caching sensitive authenticated pages.

Common secret handling mistakes:

- Storing secrets in `appsettings.json`.
- Committing `.env` files.
- Logging connection strings or tokens.
- Reusing the same secret across environments.
- Giving developers access to production secrets by default.
- Using long-lived credentials when managed identity is available.

Common least privilege mistakes:

- Assigning broad roles for convenience.
- Granting permissions at subscription or tenant scope when resource scope is enough.
- Sharing one service account across many applications.
- Using admin database credentials in application runtime.
- Not reviewing stale access.
- Ignoring authorization checks after authentication succeeds.

### Best Practices Summary

For CORS:

- Allow only known frontend origins.
- Allow only required methods and headers.
- Avoid credentials unless required.
- Keep CORS configuration environment-specific.
- Do not confuse CORS with authentication or authorization.

For secure headers:

- Enforce HTTPS with HSTS in production.
- Add `X-Content-Type-Options: nosniff`.
- Use CSP and tune it carefully.
- Use `frame-ancestors` to prevent unauthorized framing.
- Use `Referrer-Policy` and `Permissions-Policy`.
- Avoid caching sensitive responses.

For secrets:

- Keep secrets out of source control.
- Use user secrets only for local development.
- Use managed secret stores in production.
- Prefer managed identity over static credentials.
- Rotate and audit secrets.
- Mask secrets in logs.

For least privilege:

- Grant only required permissions.
- Use the narrowest practical scope.
- Separate duties between users, services, and environments.
- Review access regularly.
- Use resource-based authorization for sensitive domain data.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

<!-- question:start:cors-secure-headers-secrets-least-privilege-beginner-q01 -->
<!-- question-id:cors-secure-headers-secrets-least-privilege-beginner-q01 -->
<!-- question-level:beginner -->
#### 1. What is CORS, and why is it needed?

##### Expected Answer

CORS stands for Cross-Origin Resource Sharing. It is a browser security mechanism that allows a server to control whether JavaScript from another origin can read its responses.

It is needed because browsers enforce the same-origin policy. Without CORS, a frontend hosted on `https://app.example.com` may not be allowed to read responses from an API hosted on `https://api.example.com`, even if the request reaches the server successfully.

CORS is configured by the API through response headers such as `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers`.

CORS is not authentication or authorization. It does not prove the identity of the user and does not protect the API from non-browser clients such as curl, Postman, server-side code, or scripts running outside the browser security model.

##### Key Points to Mention

- CORS is enforced by browsers.
- It controls whether frontend JavaScript can read cross-origin responses.
- It is based on origins: scheme, host, and port.
- It does not replace authentication or authorization.
- Non-browser clients are not protected by CORS.

<!-- question:end:cors-secure-headers-secrets-least-privilege-beginner-q01 -->

<!-- question:start:cors-secure-headers-secrets-least-privilege-beginner-q02 -->
<!-- question-id:cors-secure-headers-secrets-least-privilege-beginner-q02 -->
<!-- question-level:beginner -->
#### 2. What are secure HTTP response headers?

##### Expected Answer

Secure HTTP response headers are headers returned by the server that instruct the browser to apply additional security protections.

Examples include `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Cache-Control`.

They help reduce risks such as downgrade attacks, cross-site scripting impact, clickjacking, MIME-sniffing, referrer leakage, browser feature abuse, and accidental caching of sensitive data.

Secure headers are defense-in-depth controls. They do not replace proper authentication, authorization, input validation, output encoding, or secure coding.

##### Key Points to Mention

- Secure headers are browser instructions.
- They reduce common browser-based risks.
- CSP and HSTS are especially important for modern web apps.
- Headers must be configured and tested carefully.
- They are defense-in-depth, not a complete security solution.

<!-- question:end:cors-secure-headers-secrets-least-privilege-beginner-q02 -->

<!-- question:start:cors-secure-headers-secrets-least-privilege-beginner-q03 -->
<!-- question-id:cors-secure-headers-secrets-least-privilege-beginner-q03 -->
<!-- question-level:beginner -->
#### 3. What is considered a secret in an application?

##### Expected Answer

A secret is any value that can grant access, impersonate an identity, decrypt sensitive data, or connect to a protected system.

Examples include database passwords, API keys, OAuth client secrets, JWT signing keys, private certificates, storage keys, connection strings, and service bus credentials.

Secrets should not be committed to source control or stored directly in application configuration files. In development, local secret stores or environment variables can be used. In production, secrets should be stored in a controlled secret manager such as Azure Key Vault, ideally accessed using managed identity.

##### Key Points to Mention

- Secrets grant access or unlock protected resources.
- Examples include passwords, API keys, signing keys, certificates, and connection strings.
- Secrets should not be committed to source control.
- Development and production secrets should be separated.
- Managed identity reduces the need for stored credentials.

<!-- question:end:cors-secure-headers-secrets-least-privilege-beginner-q03 -->

<!-- question:start:cors-secure-headers-secrets-least-privilege-beginner-q04 -->
<!-- question-id:cors-secure-headers-secrets-least-privilege-beginner-q04 -->
<!-- question-level:beginner -->
#### 4. What does least privilege mean?

##### Expected Answer

Least privilege means giving a user, service, or application only the permissions required to perform its task, at the smallest practical scope, for the shortest practical time.

For example, an application that only reads one storage container should not have owner access to the entire cloud subscription. A normal user should not have admin permissions unless they need them for a specific task.

Least privilege reduces the impact of mistakes, bugs, stolen credentials, and compromised identities.

##### Key Points to Mention

- Grant only required permissions.
- Use the narrowest practical scope.
- Apply it to users, services, apps, databases, pipelines, and cloud identities.
- It reduces blast radius.
- It should be reviewed regularly.

<!-- question:end:cors-secure-headers-secrets-least-privilege-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

<!-- question:start:cors-secure-headers-secrets-least-privilege-intermediate-q01 -->
<!-- question-id:cors-secure-headers-secrets-least-privilege-intermediate-q01 -->
<!-- question-level:intermediate -->
#### 1. Why is `AllowAnyOrigin` dangerous for authenticated APIs?

##### Expected Answer

`AllowAnyOrigin` allows browser JavaScript from any website to read responses from the API if the CORS request is otherwise allowed. For public, anonymous, read-only APIs this may be acceptable, but for authenticated APIs it is usually unsafe.

The risk becomes worse when credentials are involved. If cookies or other credentials are sent cross-origin, an untrusted website may cause a signed-in user's browser to make requests to the API. The browser may block reading the response depending on CORS configuration, but the request itself can still be dangerous for state-changing operations.

A private API should explicitly list trusted frontend origins, allow only required methods and headers, and only allow credentials when necessary.

##### Key Points to Mention

- `AllowAnyOrigin` is broad and risky for private APIs.
- Authenticated APIs should allow only trusted origins.
- Credentials and wildcard origins are a dangerous combination.
- CORS does not replace CSRF protection.
- Use specific origins, methods, and headers.

<!-- question:end:cors-secure-headers-secrets-least-privilege-intermediate-q01 -->

<!-- question:start:cors-secure-headers-secrets-least-privilege-intermediate-q02 -->
<!-- question-id:cors-secure-headers-secrets-least-privilege-intermediate-q02 -->
<!-- question-level:intermediate -->
#### 2. How should CORS middleware be ordered in ASP.NET Core?

##### Expected Answer

In a typical ASP.NET Core application using endpoint routing, CORS middleware should run after routing and before authentication or authorization-dependent endpoint execution.

A common order is:

```csharp
app.UseRouting();
app.UseCors("FrontendApp");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
```

This allows routing to select endpoint metadata and allows CORS to apply before authorization blocks the request. CORS also needs to run before response caching when response caching is used.

Incorrect order can cause missing CORS headers, failed preflight requests, or confusing browser errors.

##### Key Points to Mention

- Use CORS in the correct middleware order.
- Common placement is after `UseRouting` and before `UseAuthentication`/`UseAuthorization`.
- It must run before response caching when response caching is used.
- Incorrect order often appears as browser CORS errors.
- Endpoint-specific CORS depends on route metadata.

<!-- question:end:cors-secure-headers-secrets-least-privilege-intermediate-q02 -->

<!-- question:start:cors-secure-headers-secrets-least-privilege-intermediate-q03 -->
<!-- question-id:cors-secure-headers-secrets-least-privilege-intermediate-q03 -->
<!-- question-level:intermediate -->
#### 3. How would you store secrets safely in an ASP.NET Core application?

##### Expected Answer

For local development, use User Secrets or local environment variables so secrets are not stored in the project folder or committed to source control.

For production, use a controlled secret store such as Azure Key Vault. If the app is hosted in Azure, prefer managed identity so the application can authenticate to Key Vault without storing a client secret in configuration.

The application should read secrets through configuration providers or centralized services. Secrets should be separated by environment, rotated periodically, masked in logs, and scoped to the minimum access needed.

Example production concept:

```csharp
builder.Configuration.AddAzureKeyVault(
    new Uri($"https://{builder.Configuration["KeyVaultName"]}.vault.azure.net/"),
    new DefaultAzureCredential());
```

##### Key Points to Mention

- Do not store production secrets in source code or `appsettings.json`.
- Use User Secrets only for local development.
- Use Key Vault or a similar secret manager in production.
- Prefer managed identity over static credentials.
- Rotate, audit, and mask secrets.

<!-- question:end:cors-secure-headers-secrets-least-privilege-intermediate-q03 -->

<!-- question:start:cors-secure-headers-secrets-least-privilege-intermediate-q04 -->
<!-- question-id:cors-secure-headers-secrets-least-privilege-intermediate-q04 -->
<!-- question-level:intermediate -->
#### 4. What is Content Security Policy, and how does it help?

##### Expected Answer

Content Security Policy, or CSP, is a browser security header that restricts where the browser can load scripts, styles, images, fonts, frames, and other resources from.

It helps reduce the impact of cross-site scripting by limiting what injected scripts can load or execute. For example, a policy can restrict scripts to the application's own origin and block plugin objects.

A simple starting policy might be:

```http
Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

CSP must be tuned for each application. A strict policy can break legitimate scripts, styles, analytics, or third-party integrations. A weak policy with broad wildcards or `unsafe-inline` provides much less protection.

##### Key Points to Mention

- CSP controls allowed resource sources.
- It helps reduce XSS impact.
- It should be tuned per application.
- Avoid broad wildcards and unsafe directives when possible.
- Use report-only mode during rollout when practical.

<!-- question:end:cors-secure-headers-secrets-least-privilege-intermediate-q04 -->

<!-- question:start:cors-secure-headers-secrets-least-privilege-intermediate-q05 -->
<!-- question-id:cors-secure-headers-secrets-least-privilege-intermediate-q05 -->
<!-- question-level:intermediate -->
#### 5. How is least privilege applied to an API endpoint?

##### Expected Answer

Least privilege for an API endpoint means the endpoint should require only the users or service identities that are allowed to perform that specific action.

It is not enough to check only that the user is authenticated. The API should check whether the user has the correct role, permission, claim, or policy. For resource-specific operations, it should also check whether the user is allowed to access that exact resource.

Example:

```csharp
app.MapPost("/orders/{id:int}/approve", ApproveOrder)
   .RequireAuthorization("CanApproveOrder");
```

Inside the handler or service, the application may also verify ownership or domain rules:

```csharp
if (order.TenantId != currentUser.TenantId)
{
    return Results.Forbid();
}
```

##### Key Points to Mention

- Authentication alone is not enough.
- Use roles, claims, policies, or permissions.
- Check resource ownership or tenant boundaries.
- Sensitive operations should have explicit authorization.
- Avoid broad admin checks for every scenario.

<!-- question:end:cors-secure-headers-secrets-least-privilege-intermediate-q05 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

<!-- question:start:cors-secure-headers-secrets-least-privilege-advanced-q01 -->
<!-- question-id:cors-secure-headers-secrets-least-privilege-advanced-q01 -->
<!-- question-level:advanced -->
#### 1. How would you design secure browser access for a React frontend and ASP.NET Core API?

##### Expected Answer

A secure design starts by separating concerns.

The API should authenticate users using the chosen authentication model, such as cookies or bearer tokens. Authorization should be enforced on every protected endpoint using policies, permissions, roles, and resource-based checks.

CORS should allow only the trusted React frontend origin, such as `https://app.example.com`. It should allow only required methods and headers. Credentials should be enabled only when the app uses cookies or another credentialed browser flow.

If cookies are used, CSRF protection should be included for state-changing requests. Cookies should use appropriate `HttpOnly`, `Secure`, and `SameSite` settings. If bearer tokens are used, token storage and XSS risks should be carefully considered.

The API and frontend should use HTTPS, HSTS, and secure headers. The frontend should have a tuned CSP. Secrets should be stored outside the codebase, with production secrets in a managed store such as Key Vault. Runtime identities should follow least privilege.

##### Key Points to Mention

- CORS only allows the trusted frontend origin.
- Authentication and authorization still happen on the API.
- Cookie-based auth needs CSRF protection.
- HTTPS, HSTS, CSP, and other secure headers should be applied.
- Secrets and cloud permissions should follow least privilege.

<!-- question:end:cors-secure-headers-secrets-least-privilege-advanced-q01 -->

<!-- question:start:cors-secure-headers-secrets-least-privilege-advanced-q02 -->
<!-- question-id:cors-secure-headers-secrets-least-privilege-advanced-q02 -->
<!-- question-level:advanced -->
#### 2. What is the difference between CORS, authentication, authorization, and CSRF protection?

##### Expected Answer

CORS is a browser mechanism that controls whether frontend JavaScript from one origin can read a response from another origin.

Authentication verifies identity. It answers: who is making the request?

Authorization checks permissions. It answers: what is this identity allowed to do?

CSRF protection prevents a malicious site from causing a user's browser to perform unwanted authenticated actions against another site, especially when cookies are automatically sent.

These controls solve different problems and should not be treated as interchangeable. An API still needs authentication and authorization even if CORS is configured correctly. A cookie-based application still needs CSRF protection even if the browser blocks cross-origin response reading.

##### Key Points to Mention

- CORS controls browser response exposure.
- Authentication verifies identity.
- Authorization enforces permissions.
- CSRF protection blocks unwanted authenticated browser actions.
- These controls complement each other.

<!-- question:end:cors-secure-headers-secrets-least-privilege-advanced-q02 -->

<!-- question:start:cors-secure-headers-secrets-least-privilege-advanced-q03 -->
<!-- question-id:cors-secure-headers-secrets-least-privilege-advanced-q03 -->
<!-- question-level:advanced -->
#### 3. How would you handle a leaked production secret?

##### Expected Answer

First, assume the secret is compromised. Remove the exposed secret from any public or shared location, but do not assume deletion is enough because the secret may already have been copied.

Immediately revoke or rotate the secret. Deploy the application with the new secret using the normal secure configuration path, such as Key Vault or pipeline secret storage. Review logs and audit trails to identify suspicious usage. Check source control history, CI/CD logs, application logs, telemetry, tickets, and chat messages for additional exposure.

If the secret granted broad access, reduce the permission scope as part of the fix. For example, replace a storage account key with managed identity and scoped RBAC permissions where possible.

Finally, add prevention controls such as secret scanning, pre-commit hooks, pipeline scanning, log masking, and access reviews.

##### Key Points to Mention

- Treat exposed secrets as compromised.
- Rotate or revoke immediately.
- Review logs and audit trails.
- Remove the secret from source and history where practical.
- Add scanning, masking, and least-privilege controls.

<!-- question:end:cors-secure-headers-secrets-least-privilege-advanced-q03 -->

<!-- question:start:cors-secure-headers-secrets-least-privilege-advanced-q04 -->
<!-- question-id:cors-secure-headers-secrets-least-privilege-advanced-q04 -->
<!-- question-level:advanced -->
#### 4. How would you apply least privilege to cloud infrastructure for an application?

##### Expected Answer

Start by identifying each identity and what it actually needs to do. This includes developers, operators, CI/CD pipelines, managed identities, background jobs, and runtime applications.

Assign roles at the narrowest practical scope. For example, give an application identity access only to a specific Key Vault or storage container instead of the entire subscription. Prefer built-in roles with limited permissions, or custom roles when built-in roles are too broad.

Separate environments so development identities do not automatically access production. Separate deployment permissions from runtime permissions. Use managed identity for Azure resources instead of long-lived static credentials. Review role assignments regularly and remove stale access.

Also apply least privilege inside the application: database users should not use admin credentials, APIs should enforce resource-based authorization, and sensitive operations should require specific permissions.

##### Key Points to Mention

- Identify all human and workload identities.
- Grant access at the narrowest practical scope.
- Separate runtime, deployment, and admin permissions.
- Prefer managed identity over static credentials.
- Review and remove stale access.

<!-- question:end:cors-secure-headers-secrets-least-privilege-advanced-q04 -->

<!-- question:start:cors-secure-headers-secrets-least-privilege-advanced-q05 -->
<!-- question-id:cors-secure-headers-secrets-least-privilege-advanced-q05 -->
<!-- question-level:advanced -->
#### 5. What are the trade-offs of strict security headers?

##### Expected Answer

Strict security headers improve browser-side protection but can break application behavior if configured without testing.

For example, a strict CSP may block inline scripts, third-party analytics, fonts, images, or API calls. HSTS can force HTTPS for a long time, so it should be enabled only when HTTPS is correctly configured. `Cache-Control: no-store` protects sensitive data but may reduce caching benefits. A restrictive `Permissions-Policy` can block browser features that some pages need.

The best approach is to design headers intentionally, test them in staging, roll out CSP in report-only mode when possible, monitor violations, and document why each exception exists.

##### Key Points to Mention

- Strict headers are valuable but can break functionality.
- CSP requires application-specific tuning.
- HSTS should be used only with reliable HTTPS.
- Sensitive pages may need no-store caching rules.
- Roll out carefully with testing and monitoring.

<!-- question:end:cors-secure-headers-secrets-least-privilege-advanced-q05 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
