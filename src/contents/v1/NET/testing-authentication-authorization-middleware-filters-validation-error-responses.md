---
id: testing-authentication-authorization-middleware-filters-validation-error-responses
topic: Testing strategy and integration testing
subtopic: Testing ASP.NET Core security, pipeline behavior, validation, and error responses
category: .NET
---


## Overview

Testing authentication, authorization, middleware, filters, validation, and error responses is about verifying that an ASP.NET Core application behaves correctly across the full HTTP request/response pipeline, not only inside individual methods.

In real applications, a request often passes through many layers before the controller, minimal API handler, or endpoint logic runs:

1. Middleware handles concerns such as exception handling, routing, CORS, authentication, authorization, logging, correlation IDs, request limits, and response headers.
2. Endpoint routing selects the target endpoint and exposes endpoint metadata.
3. Authentication identifies the caller.
4. Authorization decides whether the caller can access the endpoint.
5. Model binding and validation transform request data into .NET objects and validate them.
6. MVC filters or endpoint filters run before and after selected stages.
7. The action, handler, or endpoint executes.
8. Result execution, response formatting, exception handling, and status-code behavior shape the final response.

This topic matters because many production bugs do not live in the business logic itself. They appear at the boundaries: a protected endpoint accidentally allows anonymous access, a policy is not applied, middleware is ordered incorrectly, validation errors return inconsistent payloads, exception handling leaks internal details, or a filter short-circuits a request unexpectedly.

For interviews, this topic is important because it shows whether a developer understands the difference between unit tests and integration tests. A unit test can verify a validator, service, or authorization requirement in isolation. An integration test can verify that routing, model binding, authentication, authorization, filters, middleware, dependency injection, and response formatting work together as the application actually runs.

A strong candidate should be able to explain when to mock or replace authentication, when to use real authorization policies, when to test middleware through the full pipeline, how to assert validation and error response contracts, and how to avoid tests that pass while the real application remains broken.

## Core Concepts

### Integration Testing the ASP.NET Core Request Pipeline

ASP.NET Core integration tests commonly use `WebApplicationFactory<TEntryPoint>` from `Microsoft.AspNetCore.Mvc.Testing`. The factory starts the application in a test host and gives the test an `HttpClient` that can send requests through the application pipeline.

This style of test is useful when the behavior depends on more than one component. For example, testing an endpoint that requires authentication and validates a JSON request should usually exercise:

- routing
- middleware ordering
- authentication middleware
- authorization middleware
- endpoint metadata
- model binding
- validation
- filters
- response formatting
- exception handling

Example test project setup:

```csharp
public class ApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ApiTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetHealth_ReturnsOk()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/health");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
```

In minimal hosting applications, the test project usually needs access to the `Program` class. A common approach is to add a public partial `Program` class at the end of `Program.cs`:

```csharp
public partial class Program { }
```

This allows `WebApplicationFactory<Program>` to locate the application entry point.

### Unit Tests vs Integration Tests for Pipeline Behavior

Unit tests are fast and focused. They are appropriate for pure business logic, validators, policy handlers, mapping logic, and custom helper classes.

Integration tests are broader. They are appropriate when behavior depends on ASP.NET Core infrastructure. Examples include:

- Does an unauthenticated request return `401 Unauthorized` or redirect to login?
- Does a user without the required policy receive `403 Forbidden`?
- Does a validation failure return the expected `400 Bad Request` response body?
- Does the exception handling middleware return the expected `ProblemDetails` response?
- Does a custom middleware add a correlation ID header?
- Does a custom filter short-circuit the request as expected?

A common mistake is trying to unit test everything by manually constructing `HttpContext`, controller contexts, filters, and service providers. That can be useful for isolated logic, but it often misses real behavior caused by routing, model binding, filters, result execution, middleware order, or dependency injection configuration.

### Testing Authentication

Authentication answers the question: "Who is the caller?"

In production, authentication might use JWT bearer tokens, cookies, OpenID Connect, API keys, client certificates, or another scheme. In integration tests, you usually do not want every test to depend on a real identity provider. Instead, you can replace authentication with a test authentication handler.

A test authentication handler creates a `ClaimsPrincipal` for the request:

```csharp
public sealed class TestAuthHandler
    : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "Test";

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "user-123"),
            new Claim(ClaimTypes.Name, "Test User"),
            new Claim(ClaimTypes.Role, "Admin"),
            new Claim("scope", "orders.read")
        };

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
```

Then the test factory can register the test scheme:

```csharp
var client = factory.WithWebHostBuilder(builder =>
{
    builder.ConfigureTestServices(services =>
    {
        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
            options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
        })
        .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
            TestAuthHandler.SchemeName,
            options => { });
    });
})
.CreateClient(new WebApplicationFactoryClientOptions
{
    AllowAutoRedirect = false
});

client.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue(TestAuthHandler.SchemeName);
```

This approach allows tests to focus on application authorization behavior without requiring a real login flow.

Important habits:

- Use test authentication for most API integration tests.
- Keep a smaller number of end-to-end tests for the real identity provider or token validation path.
- Use different test users for anonymous, authenticated, wrong-role, wrong-scope, and valid-access scenarios.
- Disable automatic redirects when you need to assert the first response status code.
- Do not accidentally remove authorization checks just to make tests easier.

### Testing Authorization

Authorization answers the question: "Is this caller allowed to do this action?"

Authorization can be based on:

- `[Authorize]`
- `[AllowAnonymous]`
- roles
- claims
- policies
- scopes
- custom authorization requirements
- resource-based authorization
- endpoint metadata

Authorization tests should cover both successful and failing access paths.

Example endpoint:

```csharp
app.MapGet("/admin/reports", () => Results.Ok(new[] { "Report A" }))
   .RequireAuthorization("AdminOnly");
```

Example policy:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
    {
        policy.RequireRole("Admin");
    });
});
```

Useful integration test cases:

```csharp
[Fact]
public async Task GetAdminReports_WhenAnonymous_ReturnsUnauthorized()
{
    var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        AllowAutoRedirect = false
    });

    var response = await client.GetAsync("/admin/reports");

    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
}

[Fact]
public async Task GetAdminReports_WhenUserIsNotAdmin_ReturnsForbidden()
{
    var client = CreateAuthenticatedClient(role: "User");

    var response = await client.GetAsync("/admin/reports");

    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
}

[Fact]
public async Task GetAdminReports_WhenUserIsAdmin_ReturnsOk()
{
    var client = CreateAuthenticatedClient(role: "Admin");

    var response = await client.GetAsync("/admin/reports");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
}
```

The difference between `401` and `403` is a common interview point:

- `401 Unauthorized` means the request is not authenticated or authentication failed.
- `403 Forbidden` means the user is authenticated but does not have permission.

### Testing Claims, Roles, and Policies

Many authorization bugs happen because the app expects one claim type, while the token or test identity uses another claim type.

For example, an app may check `ClaimTypes.Role`, but the token contains `roles`, `role`, or `groups`. A policy may expect `scope`, but the identity provider may send `scp`.

A flexible test authentication setup can help:

```csharp
public sealed class TestUserOptions
{
    public string UserId { get; set; } = "user-123";
    public string[] Roles { get; set; } = [];
    public Dictionary<string, string> Claims { get; set; } = new();
}
```

Then individual tests can create users with different claims:

```csharp
var client = CreateAuthenticatedClient(new TestUserOptions
{
    Roles = ["Manager"],
    Claims =
    {
        ["department"] = "Finance",
        ["scope"] = "invoices.approve"
    }
});
```

Good tests should verify the real policy configuration. Avoid replacing the authorization service with a fake that always succeeds, because that can hide broken policy registration, missing metadata, or wrong claim mappings.

### Testing Middleware

Middleware is code that runs in the ASP.NET Core request pipeline. It can inspect, change, short-circuit, or pass along requests and responses.

Common middleware concerns include:

- exception handling
- request logging
- correlation IDs
- authentication
- authorization
- CORS
- rate limiting
- response compression
- response headers
- static files
- endpoint routing

Middleware behavior often depends on ordering. For example, authentication must normally run before authorization, and exception handling should be registered early enough to catch downstream exceptions.

A custom middleware can be tested in two ways:

1. Unit test the middleware class directly with `DefaultHttpContext`.
2. Integration test the middleware through the full application pipeline.

Example middleware:

```csharp
public sealed class CorrelationIdMiddleware
{
    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers.TryGetValue("X-Correlation-Id", out var value)
            ? value.ToString()
            : Guid.NewGuid().ToString("N");

        context.Response.Headers["X-Correlation-Id"] = correlationId;

        await _next(context);
    }
}
```

Integration test:

```csharp
[Fact]
public async Task Request_AddsCorrelationIdHeader()
{
    var client = _factory.CreateClient();

    var request = new HttpRequestMessage(HttpMethod.Get, "/health");
    request.Headers.Add("X-Correlation-Id", "test-correlation-id");

    var response = await client.SendAsync(request);

    Assert.True(response.Headers.TryGetValues("X-Correlation-Id", out var values));
    Assert.Contains("test-correlation-id", values);
}
```

Middleware tests should verify externally observable behavior. Avoid testing private implementation details unless the middleware contains complex logic that deserves separate unit tests.

### Testing Filters

Filters are part of the MVC and Razor Pages pipeline. They run around specific MVC stages and are usually closer to controllers/actions than middleware.

Common filter types include:

- authorization filters
- resource filters
- action filters
- exception filters
- result filters

Filters are useful for cross-cutting behavior that depends on MVC concepts such as action arguments, model state, controller results, action metadata, or result execution.

Example action filter:

```csharp
public sealed class RequireHeaderAttribute : ActionFilterAttribute
{
    private readonly string _headerName;

    public RequireHeaderAttribute(string headerName)
    {
        _headerName = headerName;
    }

    public override void OnActionExecuting(ActionExecutingContext context)
    {
        if (!context.HttpContext.Request.Headers.ContainsKey(_headerName))
        {
            context.Result = new BadRequestObjectResult(new
            {
                error = $"Missing required header: {_headerName}"
            });
        }
    }
}
```

Example controller:

```csharp
[ApiController]
[Route("api/orders")]
public sealed class OrdersController : ControllerBase
{
    [HttpPost]
    [RequireHeader("X-Client-Id")]
    public IActionResult CreateOrder(CreateOrderRequest request)
    {
        return Created("/api/orders/1", new { id = 1 });
    }
}
```

Integration test:

```csharp
[Fact]
public async Task CreateOrder_WhenClientHeaderMissing_ReturnsBadRequest()
{
    var client = _factory.CreateClient();

    var response = await client.PostAsJsonAsync("/api/orders", new
    {
        productId = 10,
        quantity = 2
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
}
```

Filters can also be unit tested by manually creating filter contexts, but integration tests are often better when the filter depends on model binding, routing, or result execution.

### How Filters Differ from Middleware in Tests

Middleware sees almost every request and is part of the global HTTP pipeline. Filters run inside the MVC or Razor Pages pipeline for selected actions or pages.

Testing middleware usually means making a request and asserting behavior at the HTTP pipeline level. Testing filters usually means making a request to an MVC action or Razor Page that has the filter applied.

Key differences:

| Concern | Middleware | Filters |
|---|---|---|
| Scope | Global pipeline, branch, or endpoint group | MVC/Razor Pages actions or pages |
| Runs before routing? | Some middleware can run before or after routing depending on order | Runs after routing selects MVC action/page |
| Has action arguments? | No | Action filters can access action arguments |
| Has model state? | Not directly | MVC filters can access model state |
| Good for | Logging, error handling, auth, CORS, headers, rate limiting | Action-level validation, result shaping, exception handling in MVC, action metadata behavior |
| Testing style | Usually integration test through `HttpClient`; sometimes unit test with `DefaultHttpContext` | Integration test through controller action; sometimes unit test with filter contexts |

A common mistake is placing logic in a filter when it should be middleware, or testing middleware as if it only affects one controller action.

### Testing Validation

Validation testing verifies that invalid input is rejected and that error responses follow the expected contract.

In ASP.NET Core APIs, validation often involves:

- JSON deserialization
- model binding
- data annotations
- nullable reference types
- custom validation attributes
- FluentValidation or similar libraries
- `[ApiController]` automatic model validation responses
- custom validation filters or endpoint filters
- `ProblemDetails` or `ValidationProblemDetails`

Example request DTO:

```csharp
public sealed class CreateProductRequest
{
    [Required]
    [StringLength(100, MinimumLength = 3)]
    public string Name { get; init; } = string.Empty;

    [Range(0.01, 100_000)]
    public decimal Price { get; init; }
}
```

Example validation test:

```csharp
[Fact]
public async Task CreateProduct_WhenRequestIsInvalid_ReturnsValidationProblem()
{
    var client = _factory.CreateClient();

    var response = await client.PostAsJsonAsync("/api/products", new
    {
        name = "",
        price = -5
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

    var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();

    Assert.NotNull(problem);
    Assert.Equal(400, problem.Status);
    Assert.Contains("Name", problem.Errors.Keys);
    Assert.Contains("Price", problem.Errors.Keys);
}
```

Good validation tests should check both status code and response shape. They should avoid asserting every exact error message unless those messages are part of a stable public contract, because framework and localization changes can make message text fragile.

### Testing Error Responses

Error response tests verify that the application returns safe, consistent, and useful responses when something fails.

Common error cases include:

- invalid request data
- unauthorized request
- forbidden request
- not found
- conflict
- unhandled exception
- domain/business rule error
- dependency failure
- timeout

Modern ASP.NET Core APIs often use `ProblemDetails` for standardized error responses.

Example error contract:

```json
{
  "type": "https://httpstatuses.com/404",
  "title": "Resource not found",
  "status": 404,
  "detail": "The requested product was not found.",
  "traceId": "00-..."
}
```

Example test:

```csharp
[Fact]
public async Task GetProduct_WhenProductDoesNotExist_ReturnsProblemDetails404()
{
    var client = _factory.CreateClient();

    var response = await client.GetAsync("/api/products/999999");

    Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

    var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();

    Assert.NotNull(problem);
    Assert.Equal(404, problem.Status);
    Assert.Equal("Resource not found", problem.Title);
}
```

For unhandled exceptions, tests should verify that production-style responses do not leak stack traces, connection strings, SQL queries, secrets, or internal exception details.

### Testing Exception Handling Middleware

Exception handling middleware should be tested through the pipeline because the behavior depends on middleware order, environment, and response state.

Example test-only endpoint:

```csharp
app.MapGet("/test/throw", () =>
{
    throw new InvalidOperationException("Something failed internally.");
});
```

Example test:

```csharp
[Fact]
public async Task ThrowingEndpoint_InProduction_ReturnsGenericProblemDetails()
{
    var client = _factory.WithWebHostBuilder(builder =>
    {
        builder.UseEnvironment("Production");
    }).CreateClient();

    var response = await client.GetAsync("/test/throw");

    Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);

    var body = await response.Content.ReadAsStringAsync();

    Assert.DoesNotContain("Something failed internally", body);
    Assert.DoesNotContain("InvalidOperationException", body);
}
```

Important test cases:

- The error handler returns the expected status code.
- The response uses the expected content type.
- The response follows the expected error contract.
- Sensitive details are hidden in production.
- Development-only details are not accidentally enabled in production tests.
- Exceptions thrown after response headers are sent are treated differently and may not be recoverable into a normal error response.

### Testing Automatic 400 Responses from `[ApiController]`

When controllers use `[ApiController]`, ASP.NET Core can automatically return a `400 Bad Request` response when model validation fails. This means the action method may not execute.

That behavior should be tested at the HTTP level, not only by unit testing the action method.

Example:

```csharp
[ApiController]
[Route("api/customers")]
public sealed class CustomersController : ControllerBase
{
    [HttpPost]
    public IActionResult Create(CreateCustomerRequest request)
    {
        return Created("/api/customers/1", new { id = 1 });
    }
}
```

If the request body is invalid, the action can be skipped and the framework returns a validation response.

Test:

```csharp
[Fact]
public async Task CreateCustomer_WhenEmailMissing_ReturnsBadRequestBeforeActionRuns()
{
    var client = _factory.CreateClient();

    var response = await client.PostAsJsonAsync("/api/customers", new
    {
        name = "Minh"
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
}
```

This is important because a controller unit test that directly calls `Create(request)` will bypass model binding and automatic validation behavior.

### Testing Endpoint Filters in Minimal APIs

Minimal APIs can use endpoint filters to run logic before or after endpoint handlers. Endpoint filters are useful for validation, logging, request shaping, and short-circuiting behavior close to a specific endpoint or endpoint group.

Example endpoint filter:

```csharp
public sealed class RequireClientIdEndpointFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        if (!context.HttpContext.Request.Headers.ContainsKey("X-Client-Id"))
        {
            return Results.BadRequest(new { error = "Missing X-Client-Id header." });
        }

        return await next(context);
    }
}
```

Example usage:

```csharp
app.MapPost("/api/orders", (CreateOrderRequest request) =>
{
    return Results.Created("/api/orders/1", new { id = 1 });
})
.AddEndpointFilter<RequireClientIdEndpointFilter>();
```

Integration test:

```csharp
[Fact]
public async Task CreateOrder_WhenClientIdHeaderMissing_ReturnsBadRequest()
{
    var client = _factory.CreateClient();

    var response = await client.PostAsJsonAsync("/api/orders", new
    {
        productId = 1,
        quantity = 2
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
}
```

Endpoint filters should be tested through HTTP requests when they depend on actual endpoint metadata, model binding, or response behavior.

### Testing Middleware Ordering

Middleware order can change the behavior of the entire app. A test may pass when calling a service directly but fail through HTTP because the middleware pipeline is wrong.

Example production order for many APIs:

```csharp
app.UseExceptionHandler();
app.UseHttpsRedirection();

app.UseRouting();

app.UseCors("FrontendPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
```

Important ordering scenarios to test:

- Authentication runs before authorization.
- CORS runs at the correct point in the pipeline.
- Exception handling is registered before downstream code throws exceptions.
- Custom header middleware runs before the response is sent.
- Static files or terminal middleware do not accidentally bypass security behavior.
- Endpoint-specific authorization metadata is respected.

Example test for a protected endpoint:

```csharp
[Fact]
public async Task ProtectedEndpoint_WhenAnonymous_DoesNotReachAction()
{
    var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        AllowAutoRedirect = false
    });

    var response = await client.GetAsync("/api/account/me");

    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
}
```

This verifies more than the controller. It verifies that the endpoint is protected in the real pipeline.

### Testing CORS and Browser-Facing Security Behavior

CORS behavior is usually important for browser-based clients. It is not a replacement for authentication or authorization, but a browser-enforced sharing policy.

CORS tests can verify expected preflight behavior:

```csharp
[Fact]
public async Task CorsPreflight_FromAllowedOrigin_ReturnsCorsHeaders()
{
    var client = _factory.CreateClient();

    var request = new HttpRequestMessage(HttpMethod.Options, "/api/products");
    request.Headers.Add("Origin", "https://frontend.example.com");
    request.Headers.Add("Access-Control-Request-Method", "POST");

    var response = await client.SendAsync(request);

    Assert.True(response.Headers.Contains("Access-Control-Allow-Origin"));
}
```

Do not rely only on CORS tests for security. CORS controls browser access to responses. Non-browser clients can still send requests, so protected endpoints still need authentication and authorization.

### Testing Response Contracts, Not Implementation Details

For APIs, tests should focus on observable contracts:

- HTTP status code
- response headers
- content type
- response body shape
- important error fields
- security behavior
- whether access is allowed or denied

Avoid tests that depend too heavily on internal implementation details such as exact method calls, private class names, or full exception text. Those tests are brittle and may pass even when the API contract is broken.

Good assertion:

```csharp
Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
Assert.Contains("email", validationProblem.Errors.Keys, StringComparer.OrdinalIgnoreCase);
```

Brittle assertion:

```csharp
Assert.Equal("The Email field is required.", exactErrorMessage);
```

Exact messages should only be asserted when they are part of a public contract, localization is fixed, and the team intentionally wants message changes to break tests.

### Test Data Setup for Security and Pipeline Tests

Security and pipeline tests need clear test data because the same endpoint can behave differently depending on user identity, roles, claims, request payload, existing database records, and configuration.

Useful test data patterns:

- helper methods to create anonymous clients
- helper methods to create authenticated clients
- test user builders with roles and claims
- database seed helpers
- factory methods for valid request DTOs
- small modifications to make an otherwise valid request invalid
- per-test database isolation
- explicit environment configuration

Example request builder:

```csharp
private static CreateOrderRequest ValidCreateOrderRequest() => new()
{
    ProductId = 10,
    Quantity = 2,
    ShippingAddress = "123 Test Street"
};
```

Example invalid variation:

```csharp
var request = ValidCreateOrderRequest() with
{
    Quantity = 0
};
```

For records that must exist in the database, seed them in the test setup instead of relying on production-like shared data. Shared mutable data can make tests flaky.

### Replacing Services for Test Scenarios

Integration tests can replace services when external dependencies would make tests slow, flaky, expensive, or unsafe.

Examples:

- replace real email sender with a fake email sender
- replace payment gateway with a test fake
- replace clock/time provider with a fixed time provider
- replace file storage with local or in-memory storage
- replace authentication with a test scheme
- replace database connection with an isolated test database

Example service override:

```csharp
var client = _factory.WithWebHostBuilder(builder =>
{
    builder.ConfigureTestServices(services =>
    {
        services.RemoveAll<IEmailSender>();
        services.AddSingleton<IEmailSender, FakeEmailSender>();
    });
})
.CreateClient();
```

Be careful not to replace the behavior you are trying to test. If the goal is to test authorization, do not replace authorization with a fake that always succeeds. If the goal is to test validation, do not bypass model binding and validation. If the goal is to test error formatting, do not catch exceptions directly in the test instead of letting the pipeline handle them.

### Common Testing Mistakes

Common mistakes include:

- Testing controllers directly and assuming middleware, filters, and model binding were tested.
- Replacing authentication and accidentally bypassing authorization.
- Only testing successful access, not `401` and `403` cases.
- Using `AllowAutoRedirect = true` when the test needs to assert the first response.
- Asserting exact framework validation messages too aggressively.
- Testing implementation details instead of HTTP contracts.
- Forgetting to test production error behavior separately from development behavior.
- Forgetting that exception handlers cannot always change a response after headers are sent.
- Sharing mutable test data across tests.
- Mocking too much and hiding real integration problems.
- Not testing middleware order.
- Not testing that protected endpoints are actually protected.

### Best Practices

Good practices include:

- Use unit tests for isolated logic and integration tests for pipeline behavior.
- Use `WebApplicationFactory<Program>` for API integration tests.
- Keep helper methods for authenticated clients, anonymous clients, roles, and claims.
- Test `401`, `403`, and successful access separately.
- Test validation through HTTP when model binding and automatic validation matter.
- Assert API error contracts using `ProblemDetails` or a documented custom format.
- Disable automatic redirects when testing authentication challenge behavior.
- Keep a small number of real end-to-end identity tests if the app uses an external identity provider.
- Replace external dependencies, but not the behavior being tested.
- Use production-like environment settings when testing production error responses.
- Prefer stable assertions over fragile exact framework messages.
- Test middleware and filters through externally observable behavior.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the difference between unit testing and integration testing in ASP.NET Core?

<!-- question:start:unit-vs-integration-testing-aspnet-core-beginner-q01 -->
<!-- question-id:unit-vs-integration-testing-aspnet-core-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Unit testing checks a small piece of code in isolation, such as a service method, validator, mapper, or authorization requirement. It usually avoids the real ASP.NET Core pipeline and often uses mocks, stubs, or fakes.

Integration testing checks whether multiple components work together. In ASP.NET Core, this often means sending an HTTP request through a test server using `WebApplicationFactory<Program>` and verifying the response. Integration tests can exercise routing, middleware, authentication, authorization, filters, model binding, validation, dependency injection, and response formatting.

For example, a unit test can verify that a validator rejects an empty email. An integration test can verify that posting invalid JSON to `/api/users` returns a `400 Bad Request` response with the correct validation problem payload.

##### Key Points to Mention

- Unit tests are isolated and fast.
- Integration tests exercise multiple components together.
- ASP.NET Core integration tests commonly use `WebApplicationFactory` and `HttpClient`.
- Pipeline behavior often requires integration tests.
- Use both styles for different purposes.

<!-- question:end:unit-vs-integration-testing-aspnet-core-beginner-q01 -->

#### Why should authentication and authorization be tested through HTTP requests?

<!-- question:start:test-authentication-authorization-through-http-beginner-q02 -->
<!-- question-id:test-authentication-authorization-through-http-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Authentication and authorization depend on the request pipeline, endpoint metadata, middleware order, schemes, policies, roles, and claims. Calling a controller method directly does not verify that the endpoint is protected in the real application.

Testing through HTTP verifies that anonymous users are challenged, authenticated users with insufficient permissions are forbidden, and users with correct permissions can access the endpoint. It also verifies that `[Authorize]`, `.RequireAuthorization()`, policies, and middleware are wired correctly.

##### Key Points to Mention

- Direct controller calls bypass middleware.
- Protected endpoints should be tested as real HTTP requests.
- Test anonymous, forbidden, and allowed scenarios.
- `401` and `403` mean different things.
- Middleware order matters.

<!-- question:end:test-authentication-authorization-through-http-beginner-q02 -->

#### What is the difference between `401 Unauthorized` and `403 Forbidden`?

<!-- question:start:401-vs-403-beginner-q03 -->
<!-- question-id:401-vs-403-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`401 Unauthorized` means the request is not authenticated or authentication failed. The server does not know a valid user identity for the request.

`403 Forbidden` means the request is authenticated, but the authenticated user does not have permission to access the resource or perform the action.

For example, an anonymous request to `/admin/reports` should usually receive `401`. A logged-in user without the `Admin` role should usually receive `403`.

##### Key Points to Mention

- `401` is about authentication.
- `403` is about authorization.
- Anonymous users usually get `401`.
- Authenticated users without permission usually get `403`.
- Tests should cover both cases.

<!-- question:end:401-vs-403-beginner-q03 -->

#### What is `WebApplicationFactory<Program>` used for?

<!-- question:start:webapplicationfactory-purpose-beginner-q04 -->
<!-- question-id:webapplicationfactory-purpose-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`WebApplicationFactory<Program>` is used to create an in-memory test host for an ASP.NET Core application. It allows tests to create an `HttpClient` and send requests to the application without deploying it to a real web server.

It is useful for integration tests because requests go through routing, middleware, dependency injection, filters, model binding, validation, and response formatting.

##### Key Points to Mention

- Comes from `Microsoft.AspNetCore.Mvc.Testing`.
- Boots the application for tests.
- Provides an `HttpClient`.
- Uses a test server.
- Useful for integration testing the real pipeline.

<!-- question:end:webapplicationfactory-purpose-beginner-q04 -->

#### Why should tests disable automatic redirects when testing authentication?

<!-- question:start:disable-automatic-redirects-auth-tests-beginner-q05 -->
<!-- question-id:disable-automatic-redirects-auth-tests-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Automatic redirects can hide the original response from the application. For example, a cookie-authenticated app may return a redirect to `/Account/Login` when an anonymous user accesses a protected page. If `HttpClient` follows the redirect automatically, the final response may be `200 OK` from the login page, not the original redirect.

Disabling redirects lets the test assert the first response, such as `302 Found`, `401 Unauthorized`, or the `Location` header.

##### Key Points to Mention

- Redirects can hide the original challenge response.
- Use `AllowAutoRedirect = false`.
- Important for cookie authentication and protected pages.
- APIs often return `401`; browser apps may redirect.
- Assert the first response when testing security behavior.

<!-- question:end:disable-automatic-redirects-auth-tests-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How can you test a protected endpoint without calling a real identity provider?

<!-- question:start:test-protected-endpoint-without-real-identity-provider-intermediate-q01 -->
<!-- question-id:test-protected-endpoint-without-real-identity-provider-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

A common approach is to register a test authentication scheme in the test host. The scheme uses a custom `AuthenticationHandler<AuthenticationSchemeOptions>` that returns a successful `AuthenticateResult` with a `ClaimsPrincipal` containing the claims, roles, or scopes needed for the test.

The test can then create users with different roles and claims without depending on a real login flow, OpenID Connect server, or JWT issuer. The authorization policies should still be real so the test verifies actual policy behavior.

##### Key Points to Mention

- Use a custom test authentication handler.
- Register it using `ConfigureTestServices`.
- Set default authenticate and challenge schemes.
- Keep real authorization policies active.
- Test different roles, claims, and scopes.
- Keep a smaller number of real end-to-end identity tests if needed.

<!-- question:end:test-protected-endpoint-without-real-identity-provider-intermediate-q01 -->

#### How should you test authorization policies?

<!-- question:start:test-authorization-policies-intermediate-q02 -->
<!-- question-id:test-authorization-policies-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Authorization policies should be tested with multiple user identities. At a minimum, tests should cover anonymous access, authenticated access without required permission, and authenticated access with required permission.

For policy logic itself, a unit test can verify a custom `AuthorizationHandler`. For endpoint wiring, an integration test should send HTTP requests to endpoints using `[Authorize(Policy = "...")]` or `.RequireAuthorization("...")`. This verifies that the policy is registered, the endpoint requires it, and the expected status codes are returned.

##### Key Points to Mention

- Unit test complex authorization handlers.
- Integration test endpoint policy wiring.
- Test `401`, `403`, and success.
- Use realistic claims and roles.
- Do not fake authorization to always succeed when testing authorization.

<!-- question:end:test-authorization-policies-intermediate-q02 -->

#### How do you test automatic validation responses from `[ApiController]`?

<!-- question:start:test-automatic-validation-apicontroller-intermediate-q03 -->
<!-- question-id:test-automatic-validation-apicontroller-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

The test should send an invalid HTTP request through the test server and assert the response. This is important because `[ApiController]` automatic validation happens before the action method executes. A direct controller unit test bypasses model binding and automatic model validation.

The test should assert the status code, usually `400 Bad Request`, and the response body shape, often `ValidationProblemDetails`. It should check that expected fields appear in the error dictionary, while avoiding overly fragile assertions on exact framework-generated messages unless those messages are part of the public API contract.

##### Key Points to Mention

- Use integration tests for model binding and automatic validation.
- Invalid input should return `400`.
- Validate response contract, not only status code.
- Use `ValidationProblemDetails` when applicable.
- Direct controller calls bypass important framework behavior.

<!-- question:end:test-automatic-validation-apicontroller-intermediate-q03 -->

#### How do you test custom middleware?

<!-- question:start:test-custom-middleware-intermediate-q04 -->
<!-- question-id:test-custom-middleware-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Custom middleware can be tested with unit tests or integration tests. A unit test can create a `DefaultHttpContext`, pass a fake `RequestDelegate`, invoke the middleware, and assert changes to the context. This is useful for isolated logic.

An integration test sends an HTTP request through the full application pipeline and asserts externally visible behavior such as status code, headers, body, or whether the next middleware was reached. Integration tests are better when behavior depends on middleware ordering, routing, authentication, authorization, exception handling, or endpoint metadata.

##### Key Points to Mention

- Unit test middleware logic with `DefaultHttpContext` when isolated.
- Integration test pipeline behavior with `WebApplicationFactory`.
- Assert observable behavior such as headers or status codes.
- Middleware order can only be trusted when tested through the pipeline.
- Avoid over-testing private implementation details.

<!-- question:end:test-custom-middleware-intermediate-q04 -->

#### How do filters differ from middleware when testing ASP.NET Core applications?

<!-- question:start:filters-vs-middleware-testing-intermediate-q05 -->
<!-- question-id:filters-vs-middleware-testing-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Middleware is part of the global HTTP pipeline and can run for almost every request. Filters run inside the MVC or Razor Pages pipeline and are tied to MVC concepts such as action arguments, model state, action results, and result execution.

When testing middleware, you usually assert behavior through HTTP requests that pass through the pipeline. When testing filters, you usually call an MVC endpoint that has the filter applied and assert the response. Filters can also be unit tested with filter contexts, but integration tests are often safer when filters depend on model binding, action metadata, or result execution.

##### Key Points to Mention

- Middleware is broader and pipeline-level.
- Filters are MVC/Razor Pages-specific.
- Filters can access action arguments and model state.
- Middleware order matters globally.
- Tests should match the level where the behavior actually occurs.

<!-- question:end:filters-vs-middleware-testing-intermediate-q05 -->

#### How should error responses be tested in an API?

<!-- question:start:test-error-responses-api-intermediate-q06 -->
<!-- question-id:test-error-responses-api-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Error response tests should verify the API contract. That includes the status code, content type, response body shape, important fields, and whether sensitive details are hidden. For APIs using `ProblemDetails`, tests should check fields such as `status`, `title`, `type`, `detail`, and validation errors where appropriate.

Tests should cover common error cases such as validation failure, unauthorized access, forbidden access, not found, conflict, and unhandled exceptions. Production error behavior should be tested separately from development behavior to make sure stack traces or internal exception details are not leaked.

##### Key Points to Mention

- Assert status code and response body contract.
- Use `ProblemDetails` or documented custom error format.
- Test common error paths, not only success paths.
- Verify production error responses do not leak internals.
- Avoid brittle assertions on implementation details.

<!-- question:end:test-error-responses-api-intermediate-q06 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### When can mocking hide real integration problems in security and pipeline tests?

<!-- question:start:mocking-hides-integration-problems-security-pipeline-advanced-q01 -->
<!-- question-id:mocking-hides-integration-problems-security-pipeline-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Mocking can hide integration problems when it replaces the exact behavior the test is supposed to verify. For example, replacing authorization with a fake that always succeeds means the test no longer verifies `[Authorize]`, policies, roles, claims, endpoint metadata, or middleware order. Calling controller methods directly can hide model binding, automatic validation, filters, and exception handling behavior.

Mocking is useful for external services such as email, payment gateways, storage, or identity providers. However, the application pipeline behavior itself should usually remain real in integration tests. A good test replaces unstable external dependencies while preserving the middleware, filters, validation, authorization policies, and response formatting that the application owns.

##### Key Points to Mention

- Do not mock away the behavior under test.
- Faking authentication is often fine; faking authorization to always pass is risky.
- Direct controller tests can miss pipeline behavior.
- Replace external dependencies, not application contracts.
- Keep integration tests focused on real wiring and observable outcomes.

<!-- question:end:mocking-hides-integration-problems-security-pipeline-advanced-q01 -->

#### How would you design a test suite for an endpoint that requires authentication, authorization, validation, and error handling?

<!-- question:start:design-test-suite-auth-validation-errors-advanced-q02 -->
<!-- question-id:design-test-suite-auth-validation-errors-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

A good test suite should separate concerns while still verifying the full HTTP behavior. It should include an anonymous request test expecting `401`, an authenticated user without permission expecting `403`, an authorized user with invalid input expecting `400` validation response, an authorized user with valid input expecting the success response, a not-found or conflict scenario if relevant, and an exception scenario if the endpoint can trigger application-level error handling.

The suite should use a test authentication handler to create users with different roles or claims. It should use real authorization policies and real model binding/validation. External dependencies can be replaced with fakes if they are not the focus of the test. Assertions should focus on status codes, response content type, response body contract, important headers, and persisted side effects when relevant.

##### Key Points to Mention

- Cover anonymous, forbidden, invalid, valid, and error paths.
- Use test authentication with real authorization policies.
- Exercise model binding and validation through HTTP.
- Assert response contracts and side effects.
- Replace external dependencies carefully.
- Keep tests readable with helper methods and builders.

<!-- question:end:design-test-suite-auth-validation-errors-advanced-q02 -->

#### How do you test production exception handling without leaking sensitive details?

<!-- question:start:test-production-exception-handling-no-leaks-advanced-q03 -->
<!-- question-id:test-production-exception-handling-no-leaks-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

The test should run the application in a production-like environment, trigger an exception through an endpoint, and assert the response generated by the exception handling middleware. It should verify the status code, content type, and error response shape. It should also assert that the response does not include sensitive details such as exception type names, stack traces, connection strings, SQL queries, file paths, or secret values.

The test should not catch the exception directly inside the test because that bypasses the middleware. Instead, the request should go through the pipeline so `UseExceptionHandler`, `ProblemDetails`, logging, and response formatting are exercised.

##### Key Points to Mention

- Use production-like environment configuration.
- Trigger the exception through HTTP.
- Let exception handling middleware handle the failure.
- Assert generic safe error output.
- Ensure stack traces and secrets are not returned.
- Do not bypass the pipeline by catching the exception in the test.

<!-- question:end:test-production-exception-handling-no-leaks-advanced-q03 -->

#### How do you avoid brittle tests when asserting validation and error messages?

<!-- question:start:avoid-brittle-validation-error-tests-advanced-q04 -->
<!-- question-id:avoid-brittle-validation-error-tests-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Brittle tests often assert exact framework-generated messages, full JSON strings, property order, or internal implementation details. These can break because of localization, framework version changes, serializer settings, or harmless wording changes.

A better approach is to assert stable parts of the API contract: status code, content type, response schema, error keys, custom error codes, and important domain-specific messages. Exact messages should only be asserted if they are intentionally part of the public contract.

For validation responses, assert that the expected field appears in the validation errors and that the response uses the expected format. For business errors, prefer stable machine-readable codes such as `PRODUCT_NOT_FOUND` or `ORDER_QUANTITY_INVALID` if clients depend on them.

##### Key Points to Mention

- Avoid exact framework message assertions unless required.
- Assert stable response structure.
- Prefer machine-readable error codes for public contracts.
- Check important fields, not entire raw JSON when unnecessary.
- Keep tests resilient to harmless framework or localization changes.

<!-- question:end:avoid-brittle-validation-error-tests-advanced-q04 -->

#### How would you test middleware ordering problems?

<!-- question:start:test-middleware-ordering-problems-advanced-q05 -->
<!-- question-id:test-middleware-ordering-problems-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Middleware ordering should be tested by asserting externally visible behavior that would fail if the order were wrong. For example, a protected endpoint should return `401` for anonymous requests and `403` for authenticated users without permission. If authentication runs after authorization, this behavior may break. Exception handling should catch downstream exceptions; if it is registered too late, exceptions may not be formatted correctly. CORS preflight responses should include the expected CORS headers; if CORS is in the wrong position, headers may be missing.

The tests should not simply inspect `Program.cs`. They should send real HTTP requests through the test host and verify the results.

##### Key Points to Mention

- Test observable behavior, not just code order.
- Use HTTP requests through `WebApplicationFactory`.
- Test auth, CORS, exception handling, and custom middleware behavior.
- Middleware order can change status codes and headers.
- Pipeline tests catch issues direct service tests miss.

<!-- question:end:test-middleware-ordering-problems-advanced-q05 -->

#### How do you test resource-based authorization?

<!-- question:start:test-resource-based-authorization-advanced-q06 -->
<!-- question-id:test-resource-based-authorization-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Resource-based authorization depends on both the user and the resource being accessed. For example, a user may be allowed to update only orders they own. Tests should seed resources with known owners, create users with different identities or claims, and send HTTP requests for resources owned by the user and resources owned by someone else.

A unit test can verify the custom authorization handler logic directly. An integration test should verify that the endpoint loads the resource, calls authorization correctly, and returns the expected status code. Tests should include owner access, non-owner access, missing resource, anonymous access, and users with elevated permissions if supported.

##### Key Points to Mention

- Resource-based authorization depends on user plus resource.
- Seed known resources and owners.
- Test owner, non-owner, anonymous, missing resource, and admin cases.
- Unit test custom handler logic.
- Integration test endpoint wiring and status codes.

<!-- question:end:test-resource-based-authorization-advanced-q06 -->

#### What should be tested for custom filters that short-circuit requests?

<!-- question:start:test-short-circuiting-filters-advanced-q07 -->
<!-- question-id:test-short-circuiting-filters-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

A short-circuiting filter sets a result before the action or later pipeline stage runs. Tests should verify the condition that triggers the short-circuit, the status code and response body returned by the filter, and that the action side effect did not happen.

For example, if an action filter rejects requests without `X-Client-Id`, the test should send a request without the header, assert `400 Bad Request`, assert the error response contract, and verify that the database record was not created or the mocked service was not called. A separate test should send the valid header and verify that the action proceeds.

##### Key Points to Mention

- Verify both short-circuit and pass-through paths.
- Assert status code and response body.
- Verify action side effects did not occur.
- Use integration tests when filter depends on model binding or action metadata.
- Unit tests can cover complex filter logic separately.

<!-- question:end:test-short-circuiting-filters-advanced-q07 -->

#### How do you decide what to replace in an integration test?

<!-- question:start:decide-what-to-replace-in-integration-tests-advanced-q08 -->
<!-- question-id:decide-what-to-replace-in-integration-tests-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

Replace dependencies that are slow, flaky, expensive, unsafe, or outside the application boundary, such as email providers, payment gateways, external APIs, real identity providers, or cloud storage. Keep the application behavior being tested real. If the test is about validation, do not bypass model binding. If the test is about authorization, do not replace authorization with a fake that always allows access. If the test is about error formatting, let exceptions pass through the real exception handling middleware.

The goal is to isolate external instability while still verifying the application’s real wiring, contracts, and pipeline behavior.

##### Key Points to Mention

- Replace external dependencies, not the behavior under test.
- Keep middleware, filters, validation, and authorization real when testing them.
- Use fakes for email, payment, storage, external APIs, and clocks.
- Use test authentication but real authorization policies.
- Avoid over-mocking integration tests.

<!-- question:end:decide-what-to-replace-in-integration-tests-advanced-q08 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
