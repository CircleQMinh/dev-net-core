---
id: jwt-bearer-auth-claims-scopes-and-policy-based-authorization
topic: Authentication, authorization, and web security
subtopic: JWT Bearer Auth, Claims, Scopes, and Policy-Based Authorization
category: .NET
---


## Overview

JWT bearer authentication is a common way to secure ASP.NET Core Web APIs. A client sends an access token in the HTTP `Authorization` header, and the API validates that token before allowing the request to continue.

A typical request looks like this:

```http
GET /api/orders HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOi...
```

The token is usually issued by a trusted identity provider, such as Microsoft Entra ID, Auth0, Okta, IdentityServer, or another OpenID Connect/OAuth 2.0 provider. The API does not normally sign in users directly. Instead, it validates the access token and builds a `ClaimsPrincipal` from the token claims.

This topic matters because modern C# APIs commonly use token-based security for single-page applications, mobile apps, microservices, backend-for-frontend services, and service-to-service communication. Developers must understand the difference between validating a token and authorizing access to a specific endpoint or resource.

JWT bearer authentication answers: **Is this token valid, and who or what does it represent?**

Authorization answers: **Does this identity have the required role, claim, scope, permission, or resource access?**

Claims, scopes, roles, and policies are central to this process:

- Claims describe the subject or client.
- Scopes usually represent delegated permissions granted to a client acting on behalf of a user.
- Roles often represent app roles, user roles, or application permissions.
- Policies define reusable authorization rules in ASP.NET Core.
- Requirements and handlers support custom authorization logic.

This topic is important for interviews because it tests practical API security knowledge. A strong candidate should know how JWT bearer authentication works, what token validation should check, how claims are used, why `[Authorize]` alone may not be enough, how scopes differ from roles, how to implement policy-based authorization, and how to avoid common security mistakes.

## Core Concepts

### What JWT Bearer Authentication Is

JWT stands for JSON Web Token. A JWT is a compact token format that can carry claims about a user, client application, or service.

A JWT typically has three parts:

```text
header.payload.signature
```

| Part | Purpose |
|---|---|
| Header | Describes token type and signing algorithm |
| Payload | Contains claims |
| Signature | Allows the API to verify token integrity and trust |

Bearer authentication means the caller presents a bearer token. Whoever possesses a valid bearer token can use it, so bearer tokens must be protected carefully.

In ASP.NET Core, JWT bearer authentication is usually configured with `AddAuthentication` and `AddJwtBearer`.

Example:

```csharp
using Microsoft.AspNetCore.Authentication.JwtBearer;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://login.example.com";
        options.Audience = "orders-api";
    });

builder.Services.AddAuthorization();

builder.Services.AddControllers();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
```

This configuration tells ASP.NET Core to validate bearer tokens using the JWT bearer handler.

### Authentication vs Authorization in JWT-Based APIs

Authentication verifies the token and creates an identity.

Authorization checks whether the authenticated identity can access something.

Example:

```csharp
[Authorize]
[HttpGet("profile")]
public IActionResult GetProfile()
{
    return Ok();
}
```

`[Authorize]` requires an authenticated caller. But it does not automatically mean the caller has the correct scope, role, tenant, or resource ownership.

More specific authorization:

```csharp
[Authorize(Policy = "Orders.Read")]
[HttpGet("orders")]
public IActionResult GetOrders()
{
    return Ok();
}
```

In this case, the policy can check whether the token contains the required permission or scope.

A common interview point is that JWT validation is necessary but not sufficient. The API must also verify the token has the right claims for the requested operation.

### Access Tokens vs ID Tokens

In API security, the API should validate access tokens, not ID tokens.

| Token Type | Main Purpose | Used By |
|---|---|---|
| Access token | Authorize access to an API | API |
| ID token | Prove user sign-in to a client app | Client application |
| Refresh token | Obtain new tokens | Client application |

An access token is intended for an API. It contains information such as audience, issuer, expiration, subject, scopes, roles, and other claims.

An ID token is intended for the client application. It tells the client that the user authenticated successfully.

A common mistake is sending an ID token to an API and treating it as an access token. APIs should validate that the token audience is meant for that API.

### Token Validation

A production API should fully validate incoming access tokens.

Important validation checks include:

| Validation | Why It Matters |
|---|---|
| Signature | Confirms the token was issued by a trusted authority and was not tampered with |
| Issuer | Confirms the token came from the expected identity provider |
| Audience | Confirms the token was meant for this API |
| Expiration | Rejects expired tokens |
| Token type | Helps avoid using the wrong token type |
| Required claims | Ensures the token contains the expected identity and permission data |

Example:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://login.example.com";
        options.Audience = "api://orders-api";

        options.TokenValidationParameters.ValidateIssuer = true;
        options.TokenValidationParameters.ValidateAudience = true;
        options.TokenValidationParameters.ValidateLifetime = true;
    });
```

Do not disable validation in production.

Bad example:

```csharp
// Do not do this in production.
options.TokenValidationParameters.ValidateIssuer = false;
options.TokenValidationParameters.ValidateAudience = false;
options.TokenValidationParameters.ValidateLifetime = false;
```

Disabling validation can allow tokens issued for another API, from another issuer, or with expired lifetimes to be accepted incorrectly.

### `Authorization` Header and Bearer Tokens

JWT bearer tokens are usually sent in the `Authorization` header.

```http
Authorization: Bearer <access_token>
```

ASP.NET Core's JWT bearer handler reads this header, extracts the token, validates it, and creates `HttpContext.User`.

Controller example:

```csharp
[Authorize]
[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    [HttpGet("me")]
    public IActionResult GetCurrentUser()
    {
        var subject = User.FindFirst("sub")?.Value;
        var name = User.Identity?.Name;

        return Ok(new
        {
            Subject = subject,
            Name = name
        });
    }
}
```

If the token is missing or invalid, the API typically returns `401 Unauthorized`.

If the token is valid but the caller does not meet authorization requirements, the API typically returns `403 Forbidden`.

### `ClaimsPrincipal`, `ClaimsIdentity`, and Claims

After token validation, ASP.NET Core represents the caller as a `ClaimsPrincipal`.

Important types:

| Type | Meaning |
|---|---|
| `ClaimsPrincipal` | Represents the current caller |
| `ClaimsIdentity` | Represents one identity inside the principal |
| `Claim` | A key-value statement about the caller |
| `HttpContext.User` | The current request's `ClaimsPrincipal` |

Example:

```csharp
[Authorize]
[HttpGet("claims")]
public IActionResult GetClaims()
{
    var claims = User.Claims.Select(claim => new
    {
        claim.Type,
        claim.Value
    });

    return Ok(claims);
}
```

Common JWT claims include:

| Claim | Meaning |
|---|---|
| `iss` | Issuer |
| `aud` | Audience |
| `exp` | Expiration time |
| `iat` | Issued-at time |
| `sub` | Subject identifier |
| `client_id` or `azp` | Client application |
| `scp` or `scope` | Delegated scopes |
| `roles` | Roles or app permissions |
| `tid` or `tenant_id` | Tenant identifier |
| `jti` | Token identifier |

A claim says something about the caller. It does not automatically grant access unless your authorization logic uses it.

### Claims Are Not Always Permissions

A claim is a statement about the subject. It is not always a permission.

Example:

```text
email: minh@example.com
department: finance
tenant_id: tenant-001
```

These claims describe the caller. They do not automatically mean the user can access all finance data or all tenant data.

A permission-like claim might look like this:

```text
permission: orders.read
permission: orders.write
```

A scope-like claim might look like this:

```text
scp: orders.read orders.write
```

A role-like claim might look like this:

```json
"roles": [
  "Orders.Admin"
]
```

Good authorization logic should be explicit about which claims are used for access decisions.

### Scopes

A scope represents a permission granted to a client application, commonly for delegated access on behalf of a signed-in user.

Example delegated scope:

```text
orders.read
```

A token may contain scopes like this:

```json
{
  "sub": "user-123",
  "aud": "api://orders-api",
  "scp": "orders.read orders.write"
}
```

The `scp` claim is commonly used by Microsoft identity platform for delegated permissions. Some providers use `scope` instead. The value is often a space-separated list of scopes.

In an API, you should verify that the token contains the scope required by the endpoint.

Example:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Orders.Read", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim("scp", "orders.read");
    });
});
```

However, this simple `RequireClaim` example only works when the claim value exactly matches one of the expected values. Many scope claims contain space-separated values, so production code often needs a custom policy requirement or helper that splits the scope string.

### Scope Claim with Space-Separated Values

Many identity providers put multiple scopes in one claim value.

Example:

```json
{
  "scp": "orders.read orders.write customers.read"
}
```

A basic `RequireClaim("scp", "orders.read")` may not match if the entire claim value is `"orders.read orders.write customers.read"`.

A safer custom extension can split the scope value.

Example:

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

public static class AuthorizationPolicyBuilderExtensions
{
    public static AuthorizationPolicyBuilder RequireScope(
        this AuthorizationPolicyBuilder builder,
        string requiredScope)
    {
        return builder.RequireAssertion(context =>
        {
            var scopeClaims = context.User.FindAll("scope")
                .Concat(context.User.FindAll("scp"));

            return scopeClaims
                .SelectMany(claim => claim.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries))
                .Contains(requiredScope, StringComparer.Ordinal);
        });
    }
}
```

Policy registration:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Orders.Read", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireScope("orders.read");
    });
});
```

Usage:

```csharp
[Authorize(Policy = "Orders.Read")]
[HttpGet("orders")]
public IActionResult GetOrders()
{
    return Ok();
}
```

This pattern is interview-relevant because it shows that the developer understands token claim shape, not just `[Authorize]`.

### Roles and App Roles

Roles are often used for broad access control.

Example:

```json
{
  "roles": [
    "Admin",
    "Orders.Manager"
  ]
}
```

ASP.NET Core can use roles with `[Authorize(Roles = "...")]`.

Example:

```csharp
[Authorize(Roles = "Admin")]
[HttpDelete("orders/{id:int}")]
public IActionResult DeleteOrder(int id)
{
    return NoContent();
}
```

Multiple roles can be allowed:

```csharp
[Authorize(Roles = "Admin,Orders.Manager")]
public IActionResult ApproveOrder(int id)
{
    return Ok();
}
```

This means the user must be in either role.

Roles are simple, but large systems can suffer from role explosion. For fine-grained access, policies and permissions are usually better.

### Scopes vs Roles

Scopes and roles are both used in authorization, but they model different things.

| Concept | Usually Represents | Common Scenario |
|---|---|---|
| Scope | Delegated permission granted to a client acting for a user | SPA calls API as signed-in user |
| Role | User role or application permission | Admin users or daemon apps |
| Permission | Fine-grained application action | `orders.approve`, `users.manage` |
| Claim | Statement about user/client | `tenant_id`, `department`, `email` |

In Microsoft Entra-style tokens:

- Delegated user tokens often contain scopes in `scp`.
- App-only/client-credential tokens often contain app permissions in `roles`.
- User role assignments can also appear in `roles`.

Practical interpretation:

- Use scopes to check whether the client was granted permission to call the API on behalf of a user.
- Use roles or app roles for broad role checks or daemon/service access.
- Use policy-based authorization to express the actual access rule clearly.
- Use resource-based authorization when the decision depends on the specific data being accessed.

### Delegated Permissions vs Application Permissions

Delegated permissions are used when an app calls an API on behalf of a signed-in user.

Example:

```text
User signs in -> SPA gets access token -> SPA calls API -> API sees user and scopes
```

The token might contain:

```json
{
  "sub": "user-123",
  "scp": "orders.read orders.create"
}
```

Application permissions are used when an app calls an API as itself, without a signed-in user.

Example:

```text
Background service -> gets app-only token -> calls API
```

The token might contain:

```json
{
  "client_id": "service-client-123",
  "roles": [
    "Orders.Import"
  ]
}
```

A production API should understand which token type each endpoint supports.

For example:

- A user endpoint may require `orders.read` scope.
- A background import endpoint may require `Orders.Import` app role.
- Some endpoints may support both, but the policy should make that explicit.

### Policy-Based Authorization

Policy-based authorization lets you define named rules and apply them to endpoints.

Example:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Orders.Read", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireScope("orders.read");
    });

    options.AddPolicy("Orders.Delete", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireRole("Orders.Admin");
    });
});
```

Controller usage:

```csharp
[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    [Authorize(Policy = "Orders.Read")]
    [HttpGet]
    public IActionResult GetOrders()
    {
        return Ok();
    }

    [Authorize(Policy = "Orders.Delete")]
    [HttpDelete("{id:int}")]
    public IActionResult DeleteOrder(int id)
    {
        return NoContent();
    }
}
```

Minimal API usage:

```csharp
app.MapGet("/api/orders", () => Results.Ok())
   .RequireAuthorization("Orders.Read");

app.MapDelete("/api/orders/{id:int}", (int id) => Results.NoContent())
   .RequireAuthorization("Orders.Delete");
```

Policies are useful because they centralize authorization rules and make endpoint intent clearer.

### Requirements and Authorization Handlers

A policy can contain one or more requirements. Requirements can be evaluated by authorization handlers.

Example requirement:

```csharp
using Microsoft.AspNetCore.Authorization;

public sealed class ScopeRequirement : IAuthorizationRequirement
{
    public ScopeRequirement(string scope)
    {
        Scope = scope;
    }

    public string Scope { get; }
}
```

Example handler:

```csharp
using Microsoft.AspNetCore.Authorization;

public sealed class ScopeRequirementHandler
    : AuthorizationHandler<ScopeRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ScopeRequirement requirement)
    {
        var scopes = context.User.FindAll("scp")
            .Concat(context.User.FindAll("scope"))
            .SelectMany(claim => claim.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries));

        if (scopes.Contains(requirement.Scope, StringComparer.Ordinal))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
```

Register the handler and policy:

```csharp
builder.Services.AddSingleton<IAuthorizationHandler, ScopeRequirementHandler>();

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Orders.Read", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.Requirements.Add(new ScopeRequirement("orders.read"));
    });
});
```

This approach is more maintainable than repeating manual claim parsing in every controller.

### Multiple Requirements Are AND-Based

When a policy has multiple requirements, all requirements must pass.

Example:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Orders.Approve", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireRole("Manager");
        policy.RequireClaim("department", "sales");
    });
});
```

This means:

- The user must be authenticated.
- The user must be in the `Manager` role.
- The user must have `department = sales`.

All conditions must succeed.

If you need OR behavior, you can use:

- Multiple accepted values in a single requirement.
- `RequireAssertion`.
- Multiple handlers for the same requirement.
- A custom authorization handler.

Example OR-style policy using `RequireAssertion`:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Orders.Read", policy =>
    {
        policy.RequireAssertion(context =>
            HasScope(context.User, "orders.read") ||
            context.User.IsInRole("Orders.Admin"));
    });
});

static bool HasScope(ClaimsPrincipal user, string requiredScope)
{
    return user.FindAll("scp")
        .Concat(user.FindAll("scope"))
        .SelectMany(claim => claim.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        .Contains(requiredScope, StringComparer.Ordinal);
}
```

### Resource-Based Authorization

Sometimes authorization depends on the specific resource being accessed.

Examples:

- User can view only their own order.
- User can access only their tenant's data.
- Manager can approve only orders below a certain amount.
- Support agent can access only assigned tickets.

Endpoint-level policy checks may not be enough because the resource must be loaded first.

Example:

```csharp
[Authorize]
[HttpGet("{id:int}")]
public async Task<IActionResult> GetOrder(
    int id,
    IAuthorizationService authorizationService,
    CancellationToken cancellationToken)
{
    var order = await _orderRepository.GetByIdAsync(id, cancellationToken);

    if (order is null)
    {
        return NotFound();
    }

    var result = await authorizationService.AuthorizeAsync(
        User,
        order,
        "CanReadOrder");

    if (!result.Succeeded)
    {
        return Forbid();
    }

    return Ok(order);
}
```

This pattern prevents a common security bug: authenticated users accessing records they do not own.

### Middleware Order

Authentication and authorization middleware must be placed correctly.

Typical order:

```csharp
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
```

`UseAuthentication()` validates the token and sets `HttpContext.User`.

`UseAuthorization()` evaluates endpoint authorization requirements using `HttpContext.User`.

Wrong order can cause confusing behavior because authorization may run before the user has been authenticated.

### `401 Unauthorized` vs `403 Forbidden`

In JWT-secured APIs, correct status codes matter.

| Status Code | Meaning |
|---|---|
| `401 Unauthorized` | No valid authentication was provided |
| `403 Forbidden` | Authentication succeeded, but authorization failed |

Examples:

| Scenario | Result |
|---|---|
| Missing token | `401` |
| Expired token | `401` |
| Invalid signature | `401` |
| Valid token but missing scope | `403` |
| Valid token but wrong role | `403` |
| Valid token but wrong tenant/resource | `403` or sometimes `404` depending on security design |

`Challenge()` usually maps to authentication failure.

```csharp
return Challenge();
```

`Forbid()` usually maps to authorization failure.

```csharp
return Forbid();
```

### Claims Mapping and Role Claim Types

JWT claim names do not always match ASP.NET Core's default claim type expectations.

Some identity providers emit:

```json
{
  "roles": ["Admin"]
}
```

Others may emit:

```json
{
  "role": "Admin"
}
```

ASP.NET Core role authorization depends on the configured role claim type.

Example:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://login.example.com";
        options.Audience = "api://orders-api";

        options.TokenValidationParameters.RoleClaimType = "roles";
        options.TokenValidationParameters.NameClaimType = "name";
    });
```

If role authorization does not work, check:

- The token actually contains the role claim.
- The role claim type matches the configured `RoleClaimType`.
- The role name casing matches.
- The endpoint uses the correct authentication scheme.
- The token audience is correct.
- The token is an access token, not an ID token.

### Case Sensitivity

Claim values should be treated consistently.

For example:

```text
Admin
admin
```

These should not be assumed to be the same.

Best practice:

- Use consistent casing for role names.
- Use consistent casing for scope names.
- Use constants for policy names and permission names.
- Avoid mixing `Orders.Read`, `orders.read`, and `orders:read` without a clear convention.

Example constants:

```csharp
public static class Policies
{
    public const string OrdersRead = "Orders.Read";
    public const string OrdersWrite = "Orders.Write";
}

public static class Scopes
{
    public const string OrdersRead = "orders.read";
    public const string OrdersWrite = "orders.write";
}
```

### Avoid Putting Too Much Authorization Data in Tokens

JWTs are often self-contained, but they should not become large permission databases.

Problems with large tokens:

- Larger HTTP headers.
- More network overhead.
- Header size limits.
- Stale permissions until token expiration.
- Harder permission revocation.
- More sensitive data exposed to clients.

Good practice:

- Keep tokens focused on identity and coarse permission information.
- Use short-lived access tokens.
- Use resource-based checks for sensitive data.
- Query the database when authorization depends on live state.
- Avoid putting confidential business data in tokens.

### Token Revocation and Expiration

JWT access tokens are often valid until they expire. Because they are self-contained, revocation can be harder than with server-side session storage.

Important design considerations:

- Use short access token lifetimes.
- Use refresh tokens carefully.
- Re-check sensitive permissions server-side when needed.
- Consider token versioning or security stamps for high-risk scenarios.
- Do not rely only on logout to invalidate already-issued access tokens unless the system supports revocation.
- For critical operations, check current database permissions.

Example:

```csharp
[Authorize(Policy = "Orders.Approve")]
[HttpPost("{id:int}/approve")]
public async Task<IActionResult> ApproveOrder(int id)
{
    // Even if token has a permission claim,
    // still load the order and enforce current business rules.
    return Ok();
}
```

### Scope-Based Authorization Without Microsoft.Identity.Web

Some projects do not use Microsoft.Identity.Web. They can still implement scope checks using standard ASP.NET Core policies.

Example:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Customers.Read", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(context =>
        {
            var scopes = context.User.FindAll("scp")
                .Concat(context.User.FindAll("scope"))
                .SelectMany(c => c.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries));

            return scopes.Contains("customers.read", StringComparer.Ordinal);
        });
    });
});
```

This is simple and avoids extra dependencies, but it can become repetitive. For larger apps, prefer reusable extension methods, custom requirements, or a security library.

### Scope-Based Authorization with Microsoft.Identity.Web

In Microsoft Entra-based APIs, Microsoft.Identity.Web provides helpers such as required-scope checks.

Example concept:

```csharp
[Authorize]
[RequiredScope("orders.read")]
[HttpGet("orders")]
public IActionResult GetOrders()
{
    return Ok();
}
```

This style is convenient when the project uses Microsoft.Identity.Web and Microsoft Entra ID.

Even with helper attributes, the underlying idea is the same:

- Validate the access token.
- Read the scope claim.
- Verify the endpoint's required scope.
- Return `403` if the token lacks the required permission.

### Service-to-Service Authorization

Service-to-service calls often use application permissions rather than user-delegated scopes.

Example app-only token:

```json
{
  "aud": "api://orders-api",
  "client_id": "background-worker",
  "roles": [
    "Orders.Import"
  ]
}
```

Policy:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Orders.Import", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireRole("Orders.Import");
    });
});
```

Endpoint:

```csharp
[Authorize(Policy = "Orders.Import")]
[HttpPost("orders/import")]
public IActionResult ImportOrders()
{
    return Accepted();
}
```

A strong interview answer should mention that service-to-service security is not the same as user-delegated security. A daemon app may not have a user, so `scp` may be absent and `roles` may carry app permissions.

### Combining User Scopes and App Roles

Some APIs support both delegated user tokens and app-only tokens.

Example requirement:

- User token with `orders.read` scope can read orders.
- App-only token with `Orders.Read.All` app role can read orders.

Policy:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Orders.Read.AnyCaller", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(context =>
            HasScope(context.User, "orders.read") ||
            context.User.IsInRole("Orders.Read.All"));
    });
});
```

Helper:

```csharp
static bool HasScope(ClaimsPrincipal user, string requiredScope)
{
    return user.FindAll("scp")
        .Concat(user.FindAll("scope"))
        .SelectMany(claim => claim.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        .Contains(requiredScope, StringComparer.Ordinal);
}
```

This makes the supported access model explicit.

### Tenant and Audience Validation

For multi-tenant APIs, tenant validation is important.

A token may be valid from a trusted issuer but still not belong to an allowed tenant or customer.

Example check:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AllowedTenant", policy =>
    {
        policy.RequireClaim("tid", "tenant-001");
    });
});
```

However, static tenant checks are not enough for many SaaS systems. Often, the API must check tenant access against the database or tenant configuration.

Audience validation is also critical. If your API accepts a token issued for another API, the token could be misused.

Good practice:

- Validate issuer.
- Validate audience.
- Validate tenant if relevant.
- Validate scopes or roles.
- Validate resource ownership.

### API Gateway and Downstream APIs

In microservice systems, an API may receive a token and call another API.

Important patterns:

- Token validation still belongs at each trust boundary.
- Do not blindly forward tokens to unrelated services.
- Use delegated tokens when calling on behalf of a user.
- Use app-only tokens when a service acts as itself.
- Be clear about which service is the audience of each token.
- Avoid using one token for every service unless the architecture explicitly supports it.

A common mistake is accepting any token that looks valid without checking whether the token audience matches the API.

### Common Mistakes

Common mistakes include:

- Treating JWT decoding as validation.
- Accepting unsigned or weakly validated tokens.
- Disabling issuer, audience, signature, or lifetime validation.
- Accepting ID tokens as API access tokens.
- Using `[Authorize]` without checking required scopes or roles.
- Assuming a valid token means access to all resources.
- Not checking tenant or resource ownership.
- Using `RequireClaim("scp", "orders.read")` when the scope claim is space-separated.
- Confusing scopes, claims, roles, and permissions.
- Putting too much authorization state inside tokens.
- Using long-lived access tokens without a revocation strategy.
- Trusting frontend authorization checks.
- Returning inconsistent `401` and `403` responses.
- Forgetting `UseAuthentication()` before `UseAuthorization()`.
- Not testing authorization failures.

### Best Practices

Use a trusted identity provider to issue access tokens.

Validate signature, issuer, audience, and expiration.

Use access tokens for APIs, not ID tokens.

Use `[Authorize]` to require authentication, but use policies to express permissions.

Verify scopes for delegated user access.

Verify app roles for daemon or service-to-service access.

Use policy-based authorization for maintainable access rules.

Use custom requirements and handlers for complex logic.

Use resource-based authorization for ownership, tenant, and row-level rules.

Keep token contents minimal.

Use short-lived access tokens.

Use constants for policy, scope, role, and permission names.

Test security behavior with anonymous requests, invalid tokens, missing scopes, wrong roles, wrong tenants, and cross-resource access.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q01 -->
#### Beginner Q01: What is JWT bearer authentication?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

JWT bearer authentication is a token-based authentication mechanism where the client sends a JWT access token in the HTTP `Authorization` header using the `Bearer` scheme.

The API validates the token, checks that it was issued by a trusted authority, verifies that it was intended for the API, and creates a `ClaimsPrincipal` from the token claims.

Example request:

```http
Authorization: Bearer eyJhbGciOi...
```

In ASP.NET Core, JWT bearer authentication is usually configured with `AddAuthentication()` and `AddJwtBearer()`.

##### Key Points to Mention

- JWT means JSON Web Token.
- Bearer token is sent in the `Authorization` header.
- API validates the token before trusting it.
- Validation should include signature, issuer, audience, and expiration.
- ASP.NET Core creates `HttpContext.User` from claims.
- Used commonly for Web APIs.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q01 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q02 -->
#### Beginner Q02: What is a claim?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A claim is a key-value statement about a user, client application, or token subject. In ASP.NET Core, claims are stored in the current `ClaimsPrincipal`, which is available through `HttpContext.User` or `ControllerBase.User`.

Examples of claims include `sub`, `email`, `role`, `scp`, `tenant_id`, and `permission`.

Claims can be used by authorization policies to decide whether access should be granted.

##### Key Points to Mention

- Claim is a statement about the caller.
- Stored in `ClaimsPrincipal`.
- Comes from a validated token.
- Claims can represent identity, tenant, role, scope, or permission data.
- Claims are not automatically permissions unless the app treats them that way.
- Claims should come from a trusted token issuer.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q02 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q03 -->
#### Beginner Q03: What is a scope?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A scope is a permission granted to a client application, usually for delegated access on behalf of a signed-in user. In access tokens, scopes are often represented by a claim such as `scp` or `scope`.

Example:

```json
{
  "scp": "orders.read orders.write"
}
```

An API should check that the token contains the scope required by the endpoint.

##### Key Points to Mention

- Scope usually represents delegated permission.
- Commonly appears in `scp` or `scope`.
- Scope values are often space-separated.
- API should verify required scopes.
- Scopes are common in OAuth 2.0-based APIs.
- Scopes are different from user roles.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q03 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q04 -->
#### Beginner Q04: What does `[Authorize]` do with JWT bearer authentication?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`[Authorize]` requires the caller to pass authorization checks. With basic usage, it requires the caller to be authenticated. In a JWT bearer API, this means the request must include a valid access token.

Example:

```csharp
[Authorize]
[HttpGet("orders")]
public IActionResult GetOrders()
{
    return Ok();
}
```

However, `[Authorize]` by itself usually only verifies that the caller is authenticated. For permission checks, you should use roles, claims, scopes, or policies.

##### Key Points to Mention

- Requires authenticated caller by default.
- Works with JWT bearer authentication.
- Invalid or missing token usually returns `401`.
- Does not automatically check endpoint-specific scopes.
- Can use roles or policies.
- Should be combined with policy-based authorization for real permissions.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q04 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q05 -->
#### Beginner Q05: What is the difference between `401` and `403` in JWT-secured APIs?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

`401 Unauthorized` means the request is not authenticated. For example, the token is missing, expired, invalid, or has an invalid signature.

`403 Forbidden` means authentication succeeded, but the caller is not authorized. For example, the token is valid but missing the required role, scope, or policy requirement.

##### Key Points to Mention

- Missing token usually returns `401`.
- Invalid token usually returns `401`.
- Valid token but missing permission usually returns `403`.
- Authentication failure and authorization failure are different.
- `Challenge()` usually maps to authentication failure.
- `Forbid()` usually maps to authorization failure.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q05 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q06 -->
#### Beginner Q06: Why is token validation important?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

Token validation is important because an API must not trust a token just because it is formatted like a JWT. The API must verify that the token was issued by a trusted issuer, was not tampered with, has a valid signature, was intended for this API, and has not expired.

Without proper validation, an attacker could send a forged, expired, or wrong-audience token.

##### Key Points to Mention

- JWT decoding is not the same as validation.
- Validate signature.
- Validate issuer.
- Validate audience.
- Validate expiration.
- Reject invalid tokens.
- Do not disable validation in production.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q01 -->
#### Intermediate Q01: What is the difference between scopes and roles?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Scopes usually represent delegated permissions granted to a client application acting on behalf of a signed-in user. Roles usually represent broad user roles, app roles, or application permissions.

For example, a user-delegated token might contain:

```json
{
  "scp": "orders.read orders.write"
}
```

An app-only token might contain:

```json
{
  "roles": [
    "Orders.Import"
  ]
}
```

Scopes are often used to verify that a client has permission to call an API for a user. Roles are often used for broad access control or daemon/service permissions.

##### Key Points to Mention

- Scopes are often delegated permissions.
- Roles can represent user roles or app permissions.
- `scp` is common for delegated tokens.
- `roles` is common for app permissions.
- Policies can combine scopes and roles.
- Do not treat scopes and roles as identical concepts.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q01 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q02 -->
#### Intermediate Q02: How do you configure JWT bearer authentication in ASP.NET Core?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

JWT bearer authentication is configured by adding authentication services, registering the JWT bearer handler, setting the authority and audience, and adding authentication and authorization middleware.

Example:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://login.example.com";
        options.Audience = "api://orders-api";
    });

builder.Services.AddAuthorization();

app.UseAuthentication();
app.UseAuthorization();
```

The `Authority` identifies the trusted token issuer. The `Audience` identifies the API that the token is intended for.

##### Key Points to Mention

- Use `AddAuthentication`.
- Use `AddJwtBearer`.
- Configure trusted authority or metadata.
- Configure expected audience.
- Add `UseAuthentication()` before `UseAuthorization()`.
- Add authorization policies as needed.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q02 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q03 -->
#### Intermediate Q03: Why is `[Authorize]` alone often not enough for API authorization?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

`[Authorize]` by itself usually only requires the caller to be authenticated. It does not necessarily verify that the token has the specific scope, permission, role, tenant, or resource access required for the operation.

For example, a valid user token should not automatically allow deleting orders. The delete endpoint should require a specific role, scope, or policy.

Example:

```csharp
[Authorize(Policy = "Orders.Delete")]
[HttpDelete("{id:int}")]
public IActionResult DeleteOrder(int id)
{
    return NoContent();
}
```

##### Key Points to Mention

- Authentication is not the same as authorization.
- Valid token does not mean unlimited access.
- Endpoint should check required permission.
- Use policies for specific rules.
- Check resource ownership when needed.
- Avoid relying only on frontend checks.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q03 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q04 -->
#### Intermediate Q04: How would you implement a policy that checks for a required scope?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

A policy can check for a required scope by reading the `scp` or `scope` claim from the authenticated user. Because scope claims often contain space-separated values, the policy should split the claim value before comparing.

Example:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Orders.Read", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(context =>
        {
            var scopes = context.User.FindAll("scp")
                .Concat(context.User.FindAll("scope"))
                .SelectMany(c => c.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries));

            return scopes.Contains("orders.read", StringComparer.Ordinal);
        });
    });
});
```

Usage:

```csharp
[Authorize(Policy = "Orders.Read")]
public IActionResult GetOrders()
{
    return Ok();
}
```

##### Key Points to Mention

- Use policy-based authorization.
- Check `scp` or `scope`.
- Split space-separated scope values.
- Use exact comparison.
- Require authenticated user.
- Reuse helper methods or custom requirements for maintainability.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q04 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q05 -->
#### Intermediate Q05: What is policy-based authorization?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Policy-based authorization defines named authorization rules and applies them to endpoints. A policy can require authentication, roles, claims, scopes, custom requirements, or resource-specific checks.

Example:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Orders.Approve", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireRole("Manager");
        policy.RequireClaim("department", "sales");
    });
});
```

Usage:

```csharp
[Authorize(Policy = "Orders.Approve")]
public IActionResult ApproveOrder(int id)
{
    return Ok();
}
```

Policies centralize authorization rules and make endpoints easier to understand.

##### Key Points to Mention

- Policies are named authorization rules.
- Policies can require roles, claims, and custom requirements.
- Apply with `[Authorize(Policy = "...")]`.
- Minimal APIs use `.RequireAuthorization("...")`.
- Policies improve maintainability.
- Useful for fine-grained access control.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q05 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q06 -->
#### Intermediate Q06: What is the difference between delegated permissions and application permissions?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Delegated permissions are used when an application calls an API on behalf of a signed-in user. The token represents both the user and the client application. These permissions are often represented as scopes in the `scp` claim.

Application permissions are used when an application calls an API as itself, without a signed-in user. These permissions are often represented as app roles in the `roles` claim.

Example delegated token:

```json
{
  "sub": "user-123",
  "scp": "orders.read"
}
```

Example application token:

```json
{
  "client_id": "worker-service",
  "roles": [
    "Orders.Import"
  ]
}
```

##### Key Points to Mention

- Delegated means app acts on behalf of a user.
- Application permission means app acts as itself.
- Delegated tokens commonly use scopes.
- App-only tokens commonly use roles.
- APIs should verify the expected token type and permission.
- Some endpoints may support both, but this should be explicit.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q06 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q07 -->
#### Intermediate Q07: How do you troubleshoot role authorization not working with JWT tokens?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

First, inspect the access token and confirm that it contains the expected role claim. Then check whether the claim name matches ASP.NET Core's configured role claim type. Some providers use `roles`, some use `role`, and some use URI-based claim types.

You can configure the role claim type:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters.RoleClaimType = "roles";
    });
```

Also verify that the token is valid, the correct authentication scheme is used, the endpoint has the expected `[Authorize(Roles = "...")]`, and the casing of the role value matches.

##### Key Points to Mention

- Inspect token claims.
- Check `roles` vs `role`.
- Configure `RoleClaimType`.
- Verify token audience and issuer.
- Verify correct authentication scheme.
- Role values are case-sensitive in practice.
- Confirm endpoint uses the expected role name.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-intermediate-q07 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q01 -->
#### Advanced Q01: How would you design authorization for a production JWT-secured ASP.NET Core API?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

A production JWT-secured API should validate access tokens fully, including signature, issuer, audience, and expiration. The API should use `[Authorize]` or endpoint authorization to require authentication, but it should also define policy-based authorization rules for actual permissions.

Delegated user access should verify scopes, usually from `scp` or `scope`. App-only service access should verify app roles, usually from `roles`. Resource-specific access should use resource-based authorization or database checks to enforce ownership and tenant boundaries.

The API should not rely only on token presence or frontend checks. It should return correct `401` and `403` responses, keep tokens small, use short-lived access tokens, and include automated tests for missing tokens, invalid tokens, missing permissions, wrong tenant access, and cross-resource access.

##### Key Points to Mention

- Validate tokens fully.
- Use access tokens, not ID tokens.
- Use policies for endpoint permissions.
- Check scopes for delegated user access.
- Check app roles for app-only access.
- Use resource-based authorization for ownership and tenant data.
- Do not trust frontend-only authorization.
- Test negative security cases.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q01 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q02 -->
#### Advanced Q02: Why can a valid JWT still be rejected by an API?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

A JWT can be structurally valid and signed correctly but still be rejected because it does not meet the API's validation or authorization requirements.

For example, the token may have the wrong audience, wrong issuer, expired lifetime, missing required scope, missing role, wrong tenant, or may be an ID token instead of an access token. It may also be valid for another API but not for the current API.

A secure API must validate not just the signature, but also whether the token is intended for this API and contains the required authorization claims.

##### Key Points to Mention

- Signature validation alone is not enough.
- Audience must match the API.
- Issuer must be trusted.
- Token must not be expired.
- Required scopes or roles must be present.
- Tenant or resource checks may fail.
- ID tokens should not be accepted as API access tokens.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q02 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q03 -->
#### Advanced Q03: How would you implement reusable scope authorization in ASP.NET Core?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Reusable scope authorization can be implemented with a custom `IAuthorizationRequirement` and `AuthorizationHandler`. The requirement stores the required scope, and the handler checks the current user's `scp` or `scope` claims, splitting space-separated values.

Example:

```csharp
public sealed class ScopeRequirement : IAuthorizationRequirement
{
    public ScopeRequirement(string scope)
    {
        Scope = scope;
    }

    public string Scope { get; }
}

public sealed class ScopeRequirementHandler
    : AuthorizationHandler<ScopeRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ScopeRequirement requirement)
    {
        var scopes = context.User.FindAll("scp")
            .Concat(context.User.FindAll("scope"))
            .SelectMany(c => c.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries));

        if (scopes.Contains(requirement.Scope, StringComparer.Ordinal))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
```

Then register the handler and add policies using that requirement.

##### Key Points to Mention

- Use `IAuthorizationRequirement`.
- Use `AuthorizationHandler<TRequirement>`.
- Check both `scp` and `scope` if needed.
- Split space-separated scope values.
- Register handler in DI.
- Centralize authorization logic.
- Avoid duplicating scope parsing in every controller.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q03 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q04 -->
#### Advanced Q04: How should an API handle both user-delegated calls and service-to-service calls?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

The API should explicitly define which endpoints support user-delegated calls, service-to-service calls, or both.

For user-delegated calls, the API should validate scopes such as `orders.read` in `scp` or `scope`. For service-to-service calls, the API should validate app roles or application permissions in the `roles` claim.

If an endpoint supports both, the policy should make that clear:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Orders.Read.AnyCaller", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(context =>
            HasScope(context.User, "orders.read") ||
            context.User.IsInRole("Orders.Read.All"));
    });
});
```

The API should also validate audience, issuer, and tenant restrictions.

##### Key Points to Mention

- User-delegated calls usually use scopes.
- Service-to-service calls usually use app roles.
- App-only tokens may not contain `scp`.
- User tokens may not contain app-only roles.
- Policies should express supported caller types.
- Do not accidentally allow one token type where another is required.
- Validate resource access separately when needed.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q04 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q05 -->
#### Advanced Q05: Why is resource-based authorization important even when using scopes and roles?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Scopes and roles usually describe what type of operation the caller may perform, but they do not always prove the caller can access a specific resource.

For example, a user may have `orders.read`, but that does not mean they can read every order in every tenant. The API must still verify ownership, tenant membership, assignment, or other resource-specific rules.

Example:

```csharp
var result = await authorizationService.AuthorizeAsync(
    User,
    order,
    "CanReadOrder");

if (!result.Succeeded)
{
    return Forbid();
}
```

Resource-based authorization prevents horizontal privilege escalation, where users access records belonging to other users or tenants.

##### Key Points to Mention

- Scopes and roles are often operation-level permissions.
- Resource access may require ownership checks.
- Multi-tenant systems need tenant isolation.
- Use `IAuthorizationService` when the resource must be loaded first.
- Query filters can help but should be designed carefully.
- Prevent horizontal privilege escalation.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q05 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q06 -->
#### Advanced Q06: What are common JWT security mistakes in ASP.NET Core?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Common mistakes include decoding JWTs without validating them, disabling issuer or audience validation, accepting expired tokens, accepting ID tokens as access tokens, relying only on `[Authorize]`, not checking required scopes, trusting frontend authorization, using overly long-lived access tokens, putting too much sensitive data in tokens, and failing to enforce tenant or resource-level authorization.

Another common issue is incorrect scope checking. Some developers use `RequireClaim("scp", "orders.read")` even though the `scp` claim may contain a space-separated list like `"orders.read orders.write"`.

##### Key Points to Mention

- Decoding is not validation.
- Never disable validation in production.
- Validate issuer, audience, signature, and lifetime.
- Do not accept ID tokens as access tokens.
- Check scopes, roles, and policies.
- Split space-separated scope values.
- Enforce tenant and resource ownership.
- Keep tokens small and short-lived.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q06 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q07 -->
#### Advanced Q07: How should token lifetime and permission changes be handled?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

JWT access tokens are often valid until they expire. If a user's permissions change after a token is issued, the old token may still contain the old permissions until expiration.

To handle this, APIs should use short-lived access tokens, refresh tokens with care, and perform server-side checks for sensitive or high-risk operations. For critical permissions, the API may check the current database state rather than relying only on token claims.

Some systems use token versioning, security stamps, revocation lists, or introspection, but these add complexity and should be chosen based on security requirements.

##### Key Points to Mention

- JWTs can contain stale claims.
- Use short-lived access tokens.
- Refresh tokens require careful handling.
- Check current permissions for sensitive operations.
- Consider revocation or token versioning for high-risk systems.
- Logout does not always invalidate already-issued access tokens.
- Balance security, performance, and complexity.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q07 -->

<!-- question:start:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q08 -->
#### Advanced Q08: What should be tested for JWT and policy-based authorization?

<!-- question-id:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

Authorization tests should include both success and failure cases. Test anonymous requests, missing tokens, invalid tokens, expired tokens, wrong audience, missing scopes, wrong roles, wrong tenant, and cross-resource access. Also test that app-only tokens and user-delegated tokens are accepted only where intended.

Example test cases:

- Anonymous request to protected endpoint returns `401`.
- Valid token without required scope returns `403`.
- Valid token with required scope succeeds.
- App-only token cannot call user-only endpoint.
- User token cannot call app-only endpoint.
- User cannot access another tenant's resource.
- Expired token is rejected.

##### Key Points to Mention

- Test negative cases, not only happy paths.
- Verify `401` vs `403`.
- Test missing scope.
- Test missing role.
- Test wrong audience and issuer.
- Test tenant and ownership boundaries.
- Test both delegated and app-only flows.
- Security tests should be part of integration testing.

<!-- question:end:jwt-bearer-auth-claims-scopes-and-policy-based-authorization-advanced-q08 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
