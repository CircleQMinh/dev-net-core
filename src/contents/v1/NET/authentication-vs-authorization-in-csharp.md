---
id: authentication-vs-authorization-in-csharp
topic: Authentication, authorization, and web security
subtopic: Authentication vs Authorization in C#
category: .NET
---

## Overview

Authentication and authorization are two core security concepts in C# web applications, especially in ASP.NET Core APIs and web apps.

Authentication answers the question: **Who are you?**

Authorization answers the question: **What are you allowed to do?**

Authentication verifies the identity of a user, service, or client application. Authorization decides whether that authenticated identity has permission to access a resource or perform an operation.

For example, when a user signs in with a username and password, cookie, JWT bearer token, OpenID Connect provider, or external identity provider, the application is performing authentication. When the same user tries to access an admin endpoint, update another user's data, approve a payment, or call a protected API, the application performs authorization.

This topic matters because almost every production C# web application needs secure identity and access control. A developer must understand the difference between proving identity and granting access. Confusing the two can cause serious security issues, such as allowing authenticated users to access data they should not see.

In ASP.NET Core, authentication is handled by authentication middleware, authentication schemes, and authentication handlers. Authorization is handled by `[Authorize]`, policies, roles, claims, requirements, handlers, and authorization middleware.

This topic is important for interviews because it tests practical web security understanding. Interviewers often ask about:

- The difference between authentication and authorization.
- What `[Authorize]` actually does.
- How JWT bearer authentication works.
- What claims, roles, and policies are.
- Why middleware order matters.
- The difference between `401 Unauthorized` and `403 Forbidden`.
- How to secure APIs using cookies, JWTs, or external identity providers.
- How to avoid common security mistakes in ASP.NET Core.

A strong answer should explain both concepts clearly and show how they work together in a real ASP.NET Core application.

## Core Concepts

### Authentication

Authentication is the process of verifying an identity.

In an ASP.NET Core application, authentication usually produces a `ClaimsPrincipal` that represents the current user or caller.

A `ClaimsPrincipal` contains one or more identities, and each identity contains claims.

Example claims:

```text
sub: 12345
name: Minh
email: minh@example.com
role: Admin
tenant_id: tenant-001
permission: orders.read
```

Authentication does not automatically mean the user can access everything. It only means the application has identified who the caller is.

Common authentication mechanisms in C# and ASP.NET Core include:

- Cookie authentication.
- JWT bearer authentication.
- OpenID Connect authentication.
- OAuth 2.0 access tokens.
- ASP.NET Core Identity.
- Windows authentication.
- API key authentication through custom middleware or handlers.
- External identity providers such as Microsoft Entra ID, Auth0, Okta, or Google.

Example JWT bearer authentication registration:

```csharp
using Microsoft.AspNetCore.Authentication.JwtBearer;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://identity.example.com";
        options.Audience = "orders-api";
    });

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
```

In this example, authentication validates the incoming bearer token and builds the authenticated user identity.

### Authorization

Authorization is the process of deciding whether an authenticated identity can access a resource or perform an action.

Authorization usually depends on information from authentication, such as:

- User ID.
- Roles.
- Claims.
- Permissions.
- Tenant ID.
- Department.
- Subscription level.
- Resource ownership.

Example authorization using `[Authorize]`:

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/orders")]
[Authorize]
public class OrdersController : ControllerBase
{
    [HttpGet]
    public IActionResult GetOrders()
    {
        return Ok(new[] { "Order 1", "Order 2" });
    }
}
```

This requires the caller to be authenticated. If the caller is not authenticated, the request is rejected.

Authorization can also be more specific:

```csharp
[Authorize(Roles = "Admin")]
[HttpDelete("{id:int}")]
public IActionResult DeleteOrder(int id)
{
    return NoContent();
}
```

This requires the authenticated user to be in the `Admin` role.

### Authentication vs Authorization

Authentication and authorization are related but different.

| Concept | Question Answered | Example |
|---|---|---|
| Authentication | Who are you? | User signs in and receives a cookie or JWT |
| Authorization | What can you access? | User must have `Admin` role to delete an order |

A user can be authenticated but not authorized.

Example:

- Minh signs in successfully.
- Minh is authenticated.
- Minh tries to access `/api/admin/users`.
- Minh is not an admin.
- The application returns `403 Forbidden`.

A request can also be unauthenticated.

Example:

- No token or cookie is sent.
- The application cannot identify the caller.
- The application returns `401 Unauthorized`.

The key point is that authentication comes first, and authorization uses the authenticated identity to make access decisions.

### ClaimsPrincipal, ClaimsIdentity, and Claims

ASP.NET Core represents the current user using `HttpContext.User`, which is a `ClaimsPrincipal`.

Example:

```csharp
[Authorize]
[HttpGet("me")]
public IActionResult GetCurrentUser()
{
    var userId = User.FindFirst("sub")?.Value;
    var email = User.FindFirst("email")?.Value;
    var roles = User.Claims
        .Where(c => c.Type == "role")
        .Select(c => c.Value)
        .ToList();

    return Ok(new
    {
        UserId = userId,
        Email = email,
        Roles = roles
    });
}
```

Important terms:

| Term | Meaning |
|---|---|
| `ClaimsPrincipal` | Represents the current user or caller |
| `ClaimsIdentity` | Represents one identity inside a principal |
| Claim | A key-value statement about the user |
| Role | A type of claim commonly used for role-based access |
| Policy | A named authorization rule |
| Requirement | A condition inside a policy |
| Handler | Code that evaluates a requirement |

Claims are not always permissions. A claim only states something about the user or token. The application must decide how to interpret it.

For example, a claim `department: finance` does not automatically grant access. You need authorization rules that use that claim.

### Authentication Schemes

An authentication scheme is a named authentication configuration. It tells ASP.NET Core which handler should authenticate a request.

Common schemes include:

- `Cookies`
- `Bearer`
- OpenID Connect schemes
- Custom schemes

Example using cookies:

```csharp
using Microsoft.AspNetCore.Authentication.Cookies;

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/login";
        options.AccessDeniedPath = "/access-denied";
    });
```

Example using JWT bearer:

```csharp
using Microsoft.AspNetCore.Authentication.JwtBearer;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://identity.example.com";
        options.Audience = "orders-api";
    });
```

If an app has one authentication scheme, it is often configured as the default scheme. If an app has multiple schemes, you may need to specify which one to use.

Example:

```csharp
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
[HttpGet("api-data")]
public IActionResult GetApiData()
{
    return Ok();
}
```

Multiple schemes are common when the same app supports both browser cookie authentication and API bearer token authentication.

### Authentication Middleware and Authorization Middleware

ASP.NET Core uses middleware to process requests.

The common order is:

```csharp
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
```

The order matters.

`UseAuthentication()` reads the incoming credential, such as a cookie or bearer token, validates it, and sets `HttpContext.User`.

`UseAuthorization()` checks endpoint authorization requirements, such as `[Authorize]`, roles, or policies.

If `UseAuthorization()` runs before `UseAuthentication()`, authorization may not see the authenticated user correctly.

Best practice:

```csharp
app.UseAuthentication();
app.UseAuthorization();
```

Authentication should run before authorization.

### `[Authorize]` and `[AllowAnonymous]`

`[Authorize]` requires authorization for a controller, action, Razor Page, or endpoint.

Example:

```csharp
[Authorize]
[ApiController]
[Route("api/profile")]
public class ProfileController : ControllerBase
{
    [HttpGet]
    public IActionResult GetProfile()
    {
        return Ok();
    }
}
```

`[AllowAnonymous]` allows anonymous access even when a controller or global policy requires authentication.

Example:

```csharp
[Authorize]
[ApiController]
[Route("api/account")]
public class AccountController : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    public IActionResult Login()
    {
        return Ok();
    }

    [HttpGet("me")]
    public IActionResult Me()
    {
        return Ok();
    }
}
```

In this example:

- `/api/account/login` allows anonymous access.
- `/api/account/me` requires an authenticated user.

Common mistake:

```csharp
[Authorize]
public class AccountController : ControllerBase
{
    [HttpPost("login")]
    public IActionResult Login()
    {
        return Ok();
    }
}
```

If you forget `[AllowAnonymous]`, the login endpoint may require authentication, which makes no sense.

### Role-Based Authorization

Role-based authorization grants access based on roles.

Example:

```csharp
[Authorize(Roles = "Admin")]
[HttpGet("admin-report")]
public IActionResult GetAdminReport()
{
    return Ok();
}
```

Multiple roles can be allowed:

```csharp
[Authorize(Roles = "Admin,Manager")]
[HttpGet("management-report")]
public IActionResult GetManagementReport()
{
    return Ok();
}
```

This means the user must be in either the `Admin` role or the `Manager` role.

Role-based authorization is simple and useful for broad access control. However, it can become hard to maintain when permissions become fine-grained.

For example, this is less flexible:

```csharp
[Authorize(Roles = "Admin")]
```

This may be better for larger systems:

```csharp
[Authorize(Policy = "CanApproveOrders")]
```

The policy name describes the permission rather than a role name.

### Claims-Based Authorization

Claims-based authorization uses claims to make access decisions.

Example policy:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("FinanceOnly", policy =>
    {
        policy.RequireClaim("department", "finance");
    });
});
```

Controller action:

```csharp
[Authorize(Policy = "FinanceOnly")]
[HttpGet("finance-report")]
public IActionResult GetFinanceReport()
{
    return Ok();
}
```

This requires the user to have a `department` claim with value `finance`.

Claims-based authorization is more flexible than simple role checks because it can use identity information such as:

- Department.
- Tenant.
- Region.
- Permission.
- Subscription level.
- Employment type.
- Security clearance.

However, claims must be trusted. Claims from a JWT should come from a trusted identity provider and must be validated.

### Policy-Based Authorization

Policy-based authorization is the recommended approach for complex authorization rules in ASP.NET Core.

A policy is a named rule.

Example:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CanDeleteOrders", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireRole("Admin");
        policy.RequireClaim("permission", "orders.delete");
    });
});
```

Usage:

```csharp
[Authorize(Policy = "CanDeleteOrders")]
[HttpDelete("{id:int}")]
public IActionResult DeleteOrder(int id)
{
    return NoContent();
}
```

Policy-based authorization is useful because it:

- Centralizes authorization rules.
- Improves readability.
- Avoids repeating role and claim logic across actions.
- Supports custom requirements and handlers.
- Works well for enterprise applications.

### Custom Authorization Requirements and Handlers

For complex authorization, you can create custom requirements and handlers.

Example requirement:

```csharp
using Microsoft.AspNetCore.Authorization;

public sealed class MinimumAgeRequirement : IAuthorizationRequirement
{
    public MinimumAgeRequirement(int minimumAge)
    {
        MinimumAge = minimumAge;
    }

    public int MinimumAge { get; }
}
```

Example handler:

```csharp
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

public sealed class MinimumAgeHandler
    : AuthorizationHandler<MinimumAgeRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        MinimumAgeRequirement requirement)
    {
        var dateOfBirthValue = context.User.FindFirst("date_of_birth")?.Value;

        if (!DateTime.TryParse(dateOfBirthValue, out var dateOfBirth))
        {
            return Task.CompletedTask;
        }

        var age = DateTime.Today.Year - dateOfBirth.Year;

        if (dateOfBirth.Date > DateTime.Today.AddYears(-age))
        {
            age--;
        }

        if (age >= requirement.MinimumAge)
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
```

Register the handler and policy:

```csharp
builder.Services.AddSingleton<IAuthorizationHandler, MinimumAgeHandler>();

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AtLeast18", policy =>
    {
        policy.Requirements.Add(new MinimumAgeRequirement(18));
    });
});
```

Use the policy:

```csharp
[Authorize(Policy = "AtLeast18")]
[HttpGet("restricted-content")]
public IActionResult GetRestrictedContent()
{
    return Ok();
}
```

This is useful when authorization logic cannot be expressed with simple role or claim checks.

### Resource-Based Authorization

Sometimes authorization depends on the specific resource being accessed.

Example:

- A user can edit their own order.
- An admin can edit any order.
- A manager can approve only orders from their department.
- A tenant user can access only resources from their tenant.

Attribute-based authorization may not have enough context because the resource must be loaded first.

Example:

```csharp
[Authorize]
[HttpPut("{id:int}")]
public async Task<IActionResult> UpdateOrder(
    int id,
    UpdateOrderRequest request,
    IAuthorizationService authorizationService,
    CancellationToken cancellationToken)
{
    var order = await _orderRepository.GetByIdAsync(id, cancellationToken);

    if (order is null)
    {
        return NotFound();
    }

    var authorizationResult = await authorizationService.AuthorizeAsync(
        User,
        order,
        "CanUpdateOrder");

    if (!authorizationResult.Succeeded)
    {
        return Forbid();
    }

    order.Update(request.Description);

    await _orderRepository.SaveChangesAsync(cancellationToken);

    return NoContent();
}
```

Resource-based authorization is more secure than checking only whether the user is authenticated.

A common security mistake is checking only this:

```csharp
[Authorize]
public async Task<IActionResult> GetOrder(int id)
{
    var order = await _orderRepository.GetByIdAsync(id);
    return Ok(order);
}
```

This verifies that the user is logged in but does not verify that the user owns or is allowed to access the order.

### JWT Bearer Authentication

JWT bearer authentication is common for APIs.

The client sends an access token in the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOi...
```

ASP.NET Core validates the token and creates a `ClaimsPrincipal`.

A secure API should validate:

- Token signature.
- Issuer.
- Audience.
- Expiration.
- Relevant claims.
- Token type and intended use.

Example:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://login.example.com";
        options.Audience = "orders-api";

        options.TokenValidationParameters.ValidateIssuer = true;
        options.TokenValidationParameters.ValidateAudience = true;
        options.TokenValidationParameters.ValidateLifetime = true;
    });
```

Common mistake:

```csharp
// Bad idea for production
options.TokenValidationParameters.ValidateIssuerSigningKey = false;
```

Do not weaken token validation in production.

JWTs are commonly used for stateless API authentication, mobile apps, SPAs, and service-to-service calls. However, token storage and refresh flows must be designed carefully.

### Cookie Authentication

Cookie authentication is common for server-rendered web apps and some browser-based applications.

After sign-in, the server creates an authentication cookie. The browser sends the cookie with later requests.

Example registration:

```csharp
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "__Host-AppAuth";
        options.LoginPath = "/login";
        options.AccessDeniedPath = "/access-denied";
        options.SlidingExpiration = true;
    });
```

Cookies are convenient for browser apps because the browser automatically sends them. However, cookie-based authentication must handle:

- CSRF protection.
- Secure cookie settings.
- SameSite behavior.
- Expiration.
- Sign-out.
- Data protection key management across multiple servers.

JWTs and cookies both authenticate users, but they are used differently.

| Mechanism | Common Use Case |
|---|---|
| Cookie authentication | Server-rendered web apps |
| JWT bearer authentication | APIs, mobile apps, SPAs, service-to-service calls |
| OpenID Connect | Sign-in with an external identity provider |
| OAuth 2.0 access token | API authorization |

### OpenID Connect and OAuth 2.0

OpenID Connect and OAuth 2.0 are related but not the same.

OpenID Connect is about signing in users and getting identity information. It answers authentication questions.

OAuth 2.0 is about delegated access to resources. It is commonly used to obtain access tokens for APIs.

In practical ASP.NET Core development:

- A web app may use OpenID Connect to sign in a user.
- An API may use JWT bearer authentication to validate access tokens.
- Authorization policies decide what the user or client can access.

A common interview mistake is saying OAuth is simply a login protocol. In modern systems, OpenID Connect is typically used for login, while OAuth 2.0 is used for delegated authorization.

### `401 Unauthorized` vs `403 Forbidden`

`401 Unauthorized` means the request is not authenticated or the authentication failed.

Examples:

- No token was provided.
- Token is expired.
- Token signature is invalid.
- Cookie is missing.
- The app cannot identify the caller.

`403 Forbidden` means the caller is authenticated but not allowed to access the resource.

Examples:

- User is signed in but lacks the required role.
- User has a valid token but missing required permission.
- User tries to access another tenant's data.
- User is authenticated but fails a policy check.

In ASP.NET Core terms:

- `Challenge()` often results in `401`.
- `Forbid()` often results in `403`.

Example:

```csharp
if (!User.Identity?.IsAuthenticated ?? true)
{
    return Challenge();
}

if (!User.IsInRole("Admin"))
{
    return Forbid();
}
```

In APIs, returning the correct status code helps clients know whether they need to sign in again or show an access denied message.

### Challenge vs Forbid

Authentication handlers respond to two important actions:

- Challenge.
- Forbid.

A challenge asks the client to authenticate. This commonly maps to `401 Unauthorized` for APIs or redirects to login for cookie-based web apps.

A forbid tells the client that authentication succeeded, but access is denied. This commonly maps to `403 Forbidden` for APIs or redirects to an access denied page for cookie-based web apps.

Example:

```csharp
[Authorize(Roles = "Admin")]
[HttpGet("admin")]
public IActionResult AdminOnly()
{
    return Ok();
}
```

If the user is not signed in, the app challenges the user.

If the user is signed in but not an admin, the app forbids access.

### Global Authorization

Some APIs require authentication by default.

You can configure a fallback policy:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});
```

This means endpoints require authenticated users unless explicitly marked as anonymous.

Example:

```csharp
app.MapGet("/health", () => Results.Ok("Healthy"))
   .AllowAnonymous();

app.MapGet("/profile", () => Results.Ok("Profile"))
   .RequireAuthorization();
```

For controller APIs, you can also use `[Authorize]` at the controller or base controller level.

A secure default is useful because developers are less likely to accidentally expose endpoints. However, public endpoints like login, registration, health checks, documentation, and webhook callbacks must be considered carefully.

### Minimal APIs and Authorization

Minimal APIs use endpoint methods instead of controller attributes, but the same security concepts apply.

Example:

```csharp
app.MapGet("/api/orders", () =>
{
    return Results.Ok(new[] { "Order 1", "Order 2" });
})
.RequireAuthorization();
```

Policy example:

```csharp
app.MapDelete("/api/orders/{id:int}", (int id) =>
{
    return Results.NoContent();
})
.RequireAuthorization("CanDeleteOrders");
```

Allow anonymous:

```csharp
app.MapPost("/api/account/login", () =>
{
    return Results.Ok();
})
.AllowAnonymous();
```

Minimal APIs still use authentication and authorization middleware:

```csharp
app.UseAuthentication();
app.UseAuthorization();
```

The syntax is different, but the concepts are the same.

### Authentication and Authorization in Clean Architecture

In Clean Architecture, authentication and authorization should be separated from business logic.

Typical responsibilities:

| Layer | Responsibility |
|---|---|
| API layer | Reads authenticated user and applies endpoint authorization |
| Application layer | Performs use case authorization when needed |
| Domain layer | Enforces domain invariants |
| Infrastructure layer | Integrates with identity providers, token validation, persistence |

Example:

```csharp
public interface ICurrentUser
{
    string? UserId { get; }
    bool IsAuthenticated { get; }
    bool HasPermission(string permission);
}
```

Implementation in the API or infrastructure layer:

```csharp
public sealed class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUser(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public string? UserId =>
        _httpContextAccessor.HttpContext?.User.FindFirst("sub")?.Value;

    public bool IsAuthenticated =>
        _httpContextAccessor.HttpContext?.User.Identity?.IsAuthenticated == true;

    public bool HasPermission(string permission)
    {
        return _httpContextAccessor.HttpContext?.User
            .HasClaim("permission", permission) == true;
    }
}
```

This allows application handlers to access current-user information without depending directly on MVC controller classes.

However, avoid spreading authorization logic randomly across the codebase. Centralize policies and use clear authorization services where possible.

### Authentication Is Not Enough for Multi-Tenant Security

In multi-tenant applications, authentication only identifies the caller. It does not automatically protect tenant data.

Bad example:

```csharp
[Authorize]
[HttpGet("{orderId:int}")]
public async Task<IActionResult> GetOrder(int orderId)
{
    var order = await _dbContext.Orders.FindAsync(orderId);
    return Ok(order);
}
```

This endpoint checks that the user is logged in, but it does not verify tenant access.

Better example:

```csharp
[Authorize]
[HttpGet("{orderId:int}")]
public async Task<IActionResult> GetOrder(int orderId)
{
    var tenantId = User.FindFirst("tenant_id")?.Value;

    var order = await _dbContext.Orders
        .Where(o => o.Id == orderId && o.TenantId == tenantId)
        .SingleOrDefaultAsync();

    return order is null ? NotFound() : Ok(order);
}
```

This checks resource access using tenant information.

A good interview answer should mention that authorization often includes row-level or resource-level checks, not just endpoint-level `[Authorize]`.

### Common Security Mistakes

Common mistakes include:

- Confusing authentication with authorization.
- Assuming logged-in users can access all data.
- Using `[Authorize]` but not checking resource ownership.
- Putting sensitive permissions only in frontend code.
- Trusting unvalidated JWTs.
- Disabling issuer, audience, signature, or lifetime validation.
- Using roles for every permission in a large system.
- Forgetting middleware order.
- Forgetting `[AllowAnonymous]` on login endpoints.
- Returning `401` when the user is authenticated but not allowed.
- Returning `403` when the user is not authenticated.
- Storing JWTs insecurely in browser storage without considering XSS risk.
- Not protecting cookie-based flows against CSRF.
- Exposing too much information in error messages.
- Hard-coding authorization rules throughout controllers.
- Not testing authorization paths.

### Best Practices

Use authentication to establish identity and authorization to enforce access rules.

Validate tokens fully in production.

Prefer policy-based authorization for complex systems.

Use role-based authorization for simple broad access control.

Use claims and permissions for fine-grained access control.

Use resource-based authorization when access depends on the specific entity being accessed.

Always use `UseAuthentication()` before `UseAuthorization()`.

Use `[AllowAnonymous]` intentionally for public endpoints.

Return correct status codes:

- `401` for unauthenticated or invalid authentication.
- `403` for authenticated but not allowed.

Do not rely on frontend checks for security. Backend authorization is required.

Keep authentication configuration in infrastructure or startup code, and keep business access decisions explicit and testable.

Add automated tests for:

- Anonymous access.
- Authenticated access.
- Missing roles.
- Missing permissions.
- Cross-tenant access.
- Resource ownership rules.
- Expired or invalid tokens.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:authentication-vs-authorization-in-csharp-beginner-q01 -->
#### Beginner Q01: What is the difference between authentication and authorization?

<!-- question-id:authentication-vs-authorization-in-csharp-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Authentication verifies who the user or caller is. Authorization determines what that authenticated user or caller is allowed to do.

For example, signing in with a username and password, cookie, or JWT token is authentication. Checking whether the signed-in user can access an admin endpoint is authorization.

Authentication usually happens before authorization. Authorization depends on the identity and claims produced by authentication.

##### Key Points to Mention

- Authentication answers: who are you?
- Authorization answers: what can you access?
- Authentication produces identity.
- Authorization uses identity to make access decisions.
- A user can be authenticated but not authorized.
- In ASP.NET Core, authentication creates `HttpContext.User`.

<!-- question:end:authentication-vs-authorization-in-csharp-beginner-q01 -->

<!-- question:start:authentication-vs-authorization-in-csharp-beginner-q02 -->
#### Beginner Q02: What does `[Authorize]` do in ASP.NET Core?

<!-- question-id:authentication-vs-authorization-in-csharp-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`[Authorize]` marks a controller, action, Razor Page, or endpoint as requiring authorization. By default, it requires the caller to be authenticated. It can also require specific roles, policies, or authentication schemes.

Example:

```csharp
[Authorize]
[HttpGet("profile")]
public IActionResult GetProfile()
{
    return Ok();
}
```

This endpoint requires the caller to be signed in or otherwise authenticated.

##### Key Points to Mention

- Requires an authenticated user by default.
- Can be applied to controllers or actions.
- Can use roles and policies.
- Works with authorization middleware.
- Does not itself validate passwords or tokens.
- Uses the authenticated `ClaimsPrincipal`.

<!-- question:end:authentication-vs-authorization-in-csharp-beginner-q02 -->

<!-- question:start:authentication-vs-authorization-in-csharp-beginner-q03 -->
#### Beginner Q03: What is `[AllowAnonymous]` used for?

<!-- question-id:authentication-vs-authorization-in-csharp-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`[AllowAnonymous]` allows access to an endpoint without authentication, even if the controller or application has authorization enabled globally.

It is commonly used for public endpoints such as login, register, health checks, public content, or password reset.

Example:

```csharp
[Authorize]
[Route("api/account")]
public class AccountController : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    public IActionResult Login()
    {
        return Ok();
    }
}
```

##### Key Points to Mention

- Allows anonymous access.
- Overrides `[Authorize]` for that endpoint.
- Useful for login and public endpoints.
- Should be used intentionally.
- Avoid accidentally exposing private endpoints.

<!-- question:end:authentication-vs-authorization-in-csharp-beginner-q03 -->

<!-- question:start:authentication-vs-authorization-in-csharp-beginner-q04 -->
#### Beginner Q04: What is a claim in ASP.NET Core?

<!-- question-id:authentication-vs-authorization-in-csharp-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A claim is a key-value statement about a user or caller. Claims are stored in the authenticated user's `ClaimsPrincipal`.

Examples include user ID, email, role, tenant ID, department, or permission.

Example:

```csharp
var userId = User.FindFirst("sub")?.Value;
var email = User.FindFirst("email")?.Value;
```

Claims are commonly used by authorization policies to decide whether access should be granted.

##### Key Points to Mention

- Claim is a statement about the user.
- Stored in `ClaimsPrincipal`.
- Comes from cookies, JWTs, identity providers, or custom authentication.
- Roles are often represented as claims.
- Claims support policy-based authorization.
- Claims must come from a trusted source.

<!-- question:end:authentication-vs-authorization-in-csharp-beginner-q04 -->

<!-- question:start:authentication-vs-authorization-in-csharp-beginner-q05 -->
#### Beginner Q05: What is the difference between `401 Unauthorized` and `403 Forbidden`?

<!-- question-id:authentication-vs-authorization-in-csharp-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

`401 Unauthorized` means the request is not authenticated or authentication failed. For example, the token is missing, expired, invalid, or the cookie is missing.

`403 Forbidden` means the user is authenticated but does not have permission to access the resource.

Example:

- No token: `401`.
- Valid token but missing `Admin` role: `403`.

##### Key Points to Mention

- `401` means not authenticated.
- `403` means authenticated but not allowed.
- Missing or invalid token usually causes `401`.
- Missing role or failed policy usually causes `403`.
- In ASP.NET Core, `Challenge()` maps to authentication challenge.
- `Forbid()` maps to access denied.

<!-- question:end:authentication-vs-authorization-in-csharp-beginner-q05 -->

<!-- question:start:authentication-vs-authorization-in-csharp-beginner-q06 -->
#### Beginner Q06: Why must `UseAuthentication()` usually run before `UseAuthorization()`?

<!-- question-id:authentication-vs-authorization-in-csharp-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

`UseAuthentication()` validates the incoming credential and sets `HttpContext.User`. `UseAuthorization()` uses `HttpContext.User` to check access rules.

If authorization runs before authentication, the app may not have the correct authenticated user available when evaluating policies or `[Authorize]`.

Correct order:

```csharp
app.UseAuthentication();
app.UseAuthorization();
```

##### Key Points to Mention

- Authentication builds the user identity.
- Authorization uses the user identity.
- Middleware order matters.
- Incorrect order can cause authorization failures.
- This is a common ASP.NET Core interview question.

<!-- question:end:authentication-vs-authorization-in-csharp-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:authentication-vs-authorization-in-csharp-intermediate-q01 -->
#### Intermediate Q01: What is an authentication scheme?

<!-- question-id:authentication-vs-authorization-in-csharp-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

An authentication scheme is a named authentication configuration that tells ASP.NET Core which authentication handler to use. A scheme can represent cookies, JWT bearer tokens, OpenID Connect, or a custom authentication mechanism.

Example:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://identity.example.com";
        options.Audience = "orders-api";
    });
```

Here, the default scheme is the JWT bearer scheme.

Schemes matter when an application supports multiple authentication mechanisms, such as cookies for browser pages and bearer tokens for APIs.

##### Key Points to Mention

- Scheme is a named authentication configuration.
- Uses an authentication handler.
- Examples include cookies and bearer tokens.
- A default scheme can be configured.
- Multiple schemes may require explicit selection.
- `[Authorize(AuthenticationSchemes = "...")]` can specify a scheme.

<!-- question:end:authentication-vs-authorization-in-csharp-intermediate-q01 -->

<!-- question:start:authentication-vs-authorization-in-csharp-intermediate-q02 -->
#### Intermediate Q02: How does JWT bearer authentication work in ASP.NET Core?

<!-- question-id:authentication-vs-authorization-in-csharp-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

JWT bearer authentication works by reading an access token from the `Authorization` header, validating the token, and creating a `ClaimsPrincipal` from the token claims.

The header usually looks like this:

```http
Authorization: Bearer eyJhbGciOi...
```

The API should validate the token signature, issuer, audience, expiration, and relevant claims. If the token is valid, authentication succeeds and authorization can use the claims to make access decisions.

Example:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://identity.example.com";
        options.Audience = "orders-api";
    });
```

##### Key Points to Mention

- Token is usually sent in the `Authorization` header.
- Bearer token is validated by the JWT bearer handler.
- Validation should include signature, issuer, audience, and expiration.
- Claims are extracted from the token.
- Authorization uses those claims.
- Invalid or missing token usually results in `401`.

<!-- question:end:authentication-vs-authorization-in-csharp-intermediate-q02 -->

<!-- question:start:authentication-vs-authorization-in-csharp-intermediate-q03 -->
#### Intermediate Q03: What is policy-based authorization?

<!-- question-id:authentication-vs-authorization-in-csharp-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Policy-based authorization defines named authorization rules in one place and applies them to endpoints using `[Authorize(Policy = "...")]` or `.RequireAuthorization("...")`.

Example:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CanApproveOrders", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim("permission", "orders.approve");
    });
});
```

Usage:

```csharp
[Authorize(Policy = "CanApproveOrders")]
[HttpPost("{id:int}/approve")]
public IActionResult ApproveOrder(int id)
{
    return Ok();
}
```

This is more maintainable than scattering role and claim checks throughout controllers.

##### Key Points to Mention

- Policies are named authorization rules.
- Policies can require roles, claims, authenticated users, or custom requirements.
- Policies centralize access rules.
- Useful for complex systems.
- Prefer policies for fine-grained permissions.
- Works with controllers and Minimal APIs.

<!-- question:end:authentication-vs-authorization-in-csharp-intermediate-q03 -->

<!-- question:start:authentication-vs-authorization-in-csharp-intermediate-q04 -->
#### Intermediate Q04: What is the difference between role-based and claims-based authorization?

<!-- question-id:authentication-vs-authorization-in-csharp-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Role-based authorization checks whether a user belongs to a role such as `Admin`, `Manager`, or `User`.

Example:

```csharp
[Authorize(Roles = "Admin")]
```

Claims-based authorization checks specific claims about the user, such as department, tenant, permission, or subscription level.

Example:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("FinanceOnly", policy =>
    {
        policy.RequireClaim("department", "finance");
    });
});
```

Roles are simple and useful for broad access control. Claims are more flexible and can support fine-grained rules.

##### Key Points to Mention

- Roles are usually broad groups.
- Claims are key-value facts about the user.
- Roles can be represented as claims.
- Claims are more flexible.
- Policies can combine roles and claims.
- Permissions are often modeled as claims in APIs.

<!-- question:end:authentication-vs-authorization-in-csharp-intermediate-q04 -->

<!-- question:start:authentication-vs-authorization-in-csharp-intermediate-q05 -->
#### Intermediate Q05: How do cookie authentication and JWT bearer authentication differ?

<!-- question-id:authentication-vs-authorization-in-csharp-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Cookie authentication stores authentication state in an encrypted cookie sent automatically by the browser. It is commonly used for server-rendered web applications.

JWT bearer authentication uses an access token sent explicitly in the `Authorization` header. It is commonly used for APIs, mobile apps, SPAs, and service-to-service communication.

Cookies are convenient for browsers but require CSRF protection. JWTs are useful for APIs but require careful token validation, storage, expiration, and refresh handling.

##### Key Points to Mention

- Cookies are browser-oriented.
- JWTs are API-oriented.
- Cookies are sent automatically by the browser.
- JWTs are usually sent in the `Authorization` header.
- Cookies need CSRF protection.
- JWTs need secure storage and full validation.
- Both can create a `ClaimsPrincipal`.

<!-- question:end:authentication-vs-authorization-in-csharp-intermediate-q05 -->

<!-- question:start:authentication-vs-authorization-in-csharp-intermediate-q06 -->
#### Intermediate Q06: What is resource-based authorization?

<!-- question-id:authentication-vs-authorization-in-csharp-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Resource-based authorization checks access based on the specific resource being accessed. This is needed when authorization depends on data loaded from the database, such as ownership, tenant ID, department, or document status.

Example:

```csharp
var result = await authorizationService.AuthorizeAsync(
    User,
    order,
    "CanUpdateOrder");

if (!result.Succeeded)
{
    return Forbid();
}
```

This is better than only checking `[Authorize]` when users should access only their own records or tenant-specific data.

##### Key Points to Mention

- Used when access depends on the specific resource.
- Requires loading the resource before authorization.
- Common for ownership and tenant checks.
- Uses `IAuthorizationService`.
- Prevents horizontal privilege escalation.
- More secure than only checking if the user is logged in.

<!-- question:end:authentication-vs-authorization-in-csharp-intermediate-q06 -->

<!-- question:start:authentication-vs-authorization-in-csharp-intermediate-q07 -->
#### Intermediate Q07: What is the difference between `Challenge()` and `Forbid()`?

<!-- question-id:authentication-vs-authorization-in-csharp-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

`Challenge()` asks the client to authenticate. It usually results in `401 Unauthorized` for APIs or redirects to a login page for cookie-based web apps.

`Forbid()` means the user is authenticated but not allowed to access the resource. It usually results in `403 Forbidden` for APIs or redirects to an access denied page for cookie-based web apps.

Use `Challenge()` when authentication is missing or invalid. Use `Forbid()` when authentication succeeded but authorization failed.

##### Key Points to Mention

- `Challenge()` means authentication is required.
- `Forbid()` means access is denied.
- Challenge often maps to `401`.
- Forbid often maps to `403`.
- Cookie authentication may redirect.
- API authentication usually returns status codes.

<!-- question:end:authentication-vs-authorization-in-csharp-intermediate-q07 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:authentication-vs-authorization-in-csharp-advanced-q01 -->
#### Advanced Q01: How would you design authentication and authorization for a production ASP.NET Core API?

<!-- question-id:authentication-vs-authorization-in-csharp-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

For a production ASP.NET Core API, authentication should usually be delegated to a trusted identity provider using standards such as OpenID Connect and OAuth 2.0. The API should validate access tokens using JWT bearer authentication or another appropriate scheme. Token validation should include signature, issuer, audience, lifetime, and required claims.

Authorization should be enforced on the server using policies, roles, claims, permissions, and resource-based checks where needed. Simple endpoints can use `[Authorize]`. More complex access rules should use named policies or custom authorization handlers. Resource ownership and tenant access should be checked against the actual resource, not only the token.

The API should return correct status codes, log security events carefully, avoid leaking sensitive data, and include automated tests for anonymous, unauthorized, and forbidden cases.

##### Key Points to Mention

- Use a trusted identity provider.
- Prefer standard protocols over custom token systems.
- Validate JWTs fully.
- Use `[Authorize]` or `.RequireAuthorization()`.
- Use policies for fine-grained access.
- Use resource-based authorization for ownership or tenant rules.
- Return `401` vs `403` correctly.
- Test authorization paths.

<!-- question:end:authentication-vs-authorization-in-csharp-advanced-q01 -->

<!-- question:start:authentication-vs-authorization-in-csharp-advanced-q02 -->
#### Advanced Q02: Why is `[Authorize]` not enough for multi-tenant or ownership-based security?

<!-- question-id:authentication-vs-authorization-in-csharp-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

`[Authorize]` can ensure that a user is authenticated or meets a general policy, but it does not automatically check whether the user owns the specific resource or belongs to the same tenant as the resource.

For multi-tenant systems, every query or command must enforce tenant boundaries. For ownership-based systems, the application must verify that the authenticated user is allowed to access the requested record.

Bad example:

```csharp
[Authorize]
public async Task<IActionResult> GetOrder(int id)
{
    var order = await _dbContext.Orders.FindAsync(id);
    return Ok(order);
}
```

Better example:

```csharp
[Authorize]
public async Task<IActionResult> GetOrder(int id)
{
    var tenantId = User.FindFirst("tenant_id")?.Value;

    var order = await _dbContext.Orders
        .Where(o => o.Id == id && o.TenantId == tenantId)
        .SingleOrDefaultAsync();

    return order is null ? NotFound() : Ok(order);
}
```

##### Key Points to Mention

- `[Authorize]` usually checks endpoint access.
- It does not automatically filter database rows.
- Multi-tenant access requires tenant checks.
- Ownership access requires resource checks.
- Missing checks can cause horizontal privilege escalation.
- Use resource-based authorization or query filters carefully.

<!-- question:end:authentication-vs-authorization-in-csharp-advanced-q02 -->

<!-- question:start:authentication-vs-authorization-in-csharp-advanced-q03 -->
#### Advanced Q03: How would you implement fine-grained permissions in ASP.NET Core?

<!-- question-id:authentication-vs-authorization-in-csharp-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Fine-grained permissions are usually implemented with policy-based authorization. Permissions can be represented as claims, database records, or values loaded into the user's identity during authentication. Then policies can require specific permissions.

Example:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Orders.Delete", policy =>
    {
        policy.RequireClaim("permission", "orders.delete");
    });
});
```

Usage:

```csharp
[Authorize(Policy = "Orders.Delete")]
public IActionResult DeleteOrder(int id)
{
    return NoContent();
}
```

For more complex cases, use custom requirements and handlers. For example, a handler can check permissions, tenant access, resource ownership, feature flags, or database state.

##### Key Points to Mention

- Prefer policies over hard-coded checks.
- Permissions can be modeled as claims.
- Custom handlers support complex logic.
- Avoid role explosion.
- Centralize permission names.
- Consider resource-based checks for entity-specific permissions.
- Test each permission boundary.

<!-- question:end:authentication-vs-authorization-in-csharp-advanced-q03 -->

<!-- question:start:authentication-vs-authorization-in-csharp-advanced-q04 -->
#### Advanced Q04: What are common JWT security mistakes in ASP.NET Core APIs?

<!-- question-id:authentication-vs-authorization-in-csharp-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Common JWT security mistakes include failing to validate the token signature, issuer, audience, or expiration; accepting tokens from the wrong identity provider; using tokens generated by the API itself without a proper standard; storing tokens insecurely; treating ID tokens as API access tokens; using long-lived access tokens; and trusting claims without validating the token.

Another mistake is assuming that a valid token means the user can access every resource. The token proves identity and may contain claims, but the API still needs authorization rules.

##### Key Points to Mention

- Validate signature.
- Validate issuer.
- Validate audience.
- Validate expiration.
- Do not use insecure test settings in production.
- Do not treat authentication as full authorization.
- Avoid long-lived access tokens.
- Be careful with token storage in browser apps.
- Prefer standards-based identity providers.

<!-- question:end:authentication-vs-authorization-in-csharp-advanced-q04 -->

<!-- question:start:authentication-vs-authorization-in-csharp-advanced-q05 -->
#### Advanced Q05: How should authorization logic be organized in Clean Architecture?

<!-- question-id:authentication-vs-authorization-in-csharp-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

In Clean Architecture, authentication integration should usually stay near the API or infrastructure layer because it depends on ASP.NET Core, identity providers, cookies, JWTs, and HTTP context.

Authorization can exist at multiple levels. Endpoint-level authorization can be handled with `[Authorize]` and policies in the API layer. Use-case-level authorization can be enforced in the application layer when business operations require permissions. Domain invariants should remain in the domain layer and should not depend on ASP.NET Core.

A common approach is to define an abstraction such as `ICurrentUser` in the application layer and implement it in the API or infrastructure layer.

##### Key Points to Mention

- Keep ASP.NET Core-specific code out of the domain layer.
- Use endpoint policies for route-level access.
- Use application-layer checks for use-case permissions.
- Use domain rules for domain invariants.
- Use abstractions like `ICurrentUser`.
- Avoid scattering authorization logic randomly.
- Keep authorization testable.

<!-- question:end:authentication-vs-authorization-in-csharp-advanced-q05 -->

<!-- question:start:authentication-vs-authorization-in-csharp-advanced-q06 -->
#### Advanced Q06: How do OpenID Connect and OAuth 2.0 relate to authentication and authorization?

<!-- question-id:authentication-vs-authorization-in-csharp-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

OpenID Connect is built on top of OAuth 2.0 and is commonly used for user sign-in. It provides identity information and supports authentication scenarios.

OAuth 2.0 is primarily a delegated authorization framework. It is commonly used to issue access tokens that allow a client application to call an API on behalf of a user or as an application.

In a typical ASP.NET Core system, a web app may use OpenID Connect to sign in a user, while an API uses JWT bearer authentication to validate access tokens. The API then uses authorization policies to decide what the caller can do.

##### Key Points to Mention

- OpenID Connect is commonly used for login.
- OAuth 2.0 is about delegated access.
- Access tokens are used to call APIs.
- ID tokens represent authentication information for the client.
- APIs should validate access tokens.
- Authorization still happens inside the API.

<!-- question:end:authentication-vs-authorization-in-csharp-advanced-q06 -->

<!-- question:start:authentication-vs-authorization-in-csharp-advanced-q07 -->
#### Advanced Q07: What should be tested when securing an ASP.NET Core API?

<!-- question-id:authentication-vs-authorization-in-csharp-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Security tests should verify both authentication and authorization behavior. The API should be tested with anonymous requests, invalid tokens, expired tokens, valid tokens without required roles, valid tokens without required permissions, valid users from the wrong tenant, and valid users trying to access resources they do not own.

Tests should also check status codes such as `401`, `403`, and successful responses. For multi-tenant systems, tests should confirm that users cannot access another tenant's data.

Example test cases:

- Anonymous request to protected endpoint returns `401`.
- Authenticated user without permission returns `403`.
- Admin user can access admin endpoint.
- User cannot read another user's order.
- Expired token is rejected.
- Public login endpoint allows anonymous access.

##### Key Points to Mention

- Test anonymous access.
- Test invalid authentication.
- Test missing roles and permissions.
- Test resource ownership.
- Test tenant isolation.
- Test correct `401` and `403` behavior.
- Test public endpoints intentionally.
- Authorization tests are as important as happy-path tests.

<!-- question:end:authentication-vs-authorization-in-csharp-advanced-q07 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
