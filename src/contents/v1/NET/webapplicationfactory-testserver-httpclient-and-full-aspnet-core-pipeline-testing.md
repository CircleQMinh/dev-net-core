---
id: webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing
topic: Testing strategy and integration testing
subtopic: WebApplicationFactory, TestServer, HttpClient, and Full ASP.NET Core Pipeline Testing
category: .NET
---


## Overview

`WebApplicationFactory`, `TestServer`, and `HttpClient` are commonly used to write integration tests for ASP.NET Core applications. These tests start the application in a test host, send real HTTP requests to the application, and verify real HTTP responses.

This type of testing sits between unit testing and end-to-end testing.

A unit test usually tests one class or function in isolation. An end-to-end test usually drives the application through a real browser, real network port, real frontend, and real deployed-like environment. An ASP.NET Core integration test using `WebApplicationFactory` tests the server-side application pipeline in memory. It can exercise routing, middleware, dependency injection, authentication, authorization, model binding, validation, filters, endpoint execution, JSON serialization, exception handling, and database integration if configured.

This topic matters because many bugs in ASP.NET Core applications do not appear in isolated unit tests. For example:

- A route is incorrectly mapped.
- Middleware order is wrong.
- `[Authorize]` blocks a request unexpectedly.
- Model validation returns a different response than expected.
- Dependency injection is misconfigured.
- A controller action works in isolation but fails through HTTP.
- A Minimal API endpoint does not bind parameters correctly.
- Error middleware returns the wrong `ProblemDetails` response.
- The database configuration used by tests does not match relational behavior.
- Authentication behaves differently from the expected production flow.

`WebApplicationFactory<TEntryPoint>` helps test these problems by bootstrapping the application similarly to how it runs normally, but with test-specific configuration. It creates a `TestServer` and exposes an `HttpClient` that can call the application without opening a real network socket.

This topic is important for interviews because it tests practical ASP.NET Core testing knowledge. Interviewers often ask:

- What is `WebApplicationFactory` used for?
- What does `TestServer` test?
- How is this different from unit testing or E2E testing?
- How do you expose the `Program` class for integration tests?
- How do you replace production services with test services?
- How do you test authenticated endpoints?
- How do you test middleware behavior?
- How do you test validation and error responses?
- How do you configure a test database?
- How do you avoid tests sharing state?
- What are the limitations of in-memory test servers?
- When should you use a real database container instead of an in-memory provider?

A strong answer should explain that `WebApplicationFactory` is not just for testing controllers. It tests the server pipeline through HTTP. It is most valuable when you want confidence that the application is wired correctly, endpoints behave correctly, and important cross-cutting behavior works as expected.

## Core Concepts

### What Full ASP.NET Core Pipeline Testing Means

Full ASP.NET Core pipeline testing means sending a request through the application almost the same way a client would.

A request can pass through:

- Host configuration.
- Dependency injection.
- Middleware.
- Routing.
- Authentication.
- Authorization.
- CORS behavior if configured in the test path.
- Antiforgery behavior when relevant.
- Endpoint filters.
- MVC filters.
- Model binding.
- Model validation.
- Controllers or Minimal API handlers.
- Application services.
- EF Core database access.
- Exception handling middleware.
- Response formatting.
- JSON serialization.
- Status code pages.
- `ProblemDetails` generation.
- Response headers and cookies.

Example test target:

```csharp
app.UseExceptionHandler();

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/orders/{id:int}", async (
    int id,
    IOrderService orderService,
    CancellationToken cancellationToken) =>
{
    var order = await orderService.GetByIdAsync(id, cancellationToken);

    return order is null
        ? Results.NotFound()
        : Results.Ok(order);
})
.RequireAuthorization();
```

A full pipeline integration test can verify that:

- The route matches.
- The route constraint works.
- Authentication and authorization run.
- The endpoint receives the route parameter.
- The service is resolved from DI.
- The response status is correct.
- The response body is serialized correctly.
- Errors are handled consistently.

This is more realistic than directly calling the handler method in a unit test.

### `WebApplicationFactory<TEntryPoint>`

`WebApplicationFactory<TEntryPoint>` is a test utility from `Microsoft.AspNetCore.Mvc.Testing`. It bootstraps an ASP.NET Core application for integration tests.

Typical package reference:

```xml
<ItemGroup>
  <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.0.0" />
</ItemGroup>
```

A basic xUnit test:

```csharp
using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

public sealed class HealthEndpointTests
    : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetHealth_ReturnsOk()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
```

`TEntryPoint` is usually the application `Program` class.

### Exposing `Program` for Tests

Modern ASP.NET Core apps often use top-level statements in `Program.cs`. The generated `Program` class may be internal. The test project needs access to it.

A common solution is to add this at the bottom of the app's `Program.cs`:

```csharp
public partial class Program
{
}
```

Example:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

var app = builder.Build();

app.MapControllers();

app.Run();

public partial class Program
{
}
```

Then the test can reference:

```csharp
WebApplicationFactory<Program>
```

Another option is to use `InternalsVisibleTo`, but the public partial `Program` approach is simple and common.

### `TestServer`

`TestServer` is an in-memory ASP.NET Core server implementation used for testing. `WebApplicationFactory` creates a `TestServer` internally.

Important characteristics:

- It runs the ASP.NET Core application in memory.
- It does not require opening a real TCP port.
- It does not require Kestrel.
- It can create an `HttpClient`.
- It dispatches `HttpRequestMessage` objects into the ASP.NET Core pipeline.
- It is fast compared with real network E2E tests.
- It is suitable for server-side integration tests.

However, `TestServer` is not the same as a real deployed server.

It does not fully test:

- Real network behavior.
- Kestrel socket behavior.
- TLS termination.
- Reverse proxy configuration.
- Browser behavior.
- JavaScript execution.
- Real DNS.
- Real load balancer behavior.
- CDN or gateway behavior.
- Production hosting differences.
- End-to-end frontend interaction.

For those concerns, use E2E tests, browser tests, deployed environment tests, or real server tests.

### `HttpClient` in Integration Tests

`WebApplicationFactory.CreateClient()` returns an `HttpClient` configured to send requests to the in-memory `TestServer`.

Example:

```csharp
using var client = _factory.CreateClient();

var response = await client.GetAsync("/api/products");

response.EnsureSuccessStatusCode();

var content = await response.Content.ReadAsStringAsync();
```

You can also configure the client:

```csharp
using var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
{
    AllowAutoRedirect = false,
    BaseAddress = new Uri("https://localhost")
});
```

Important options:

| Option | Purpose |
|---|---|
| `AllowAutoRedirect` | Controls whether redirects are followed automatically |
| `BaseAddress` | Sets the base address used by the client |
| `HandleCookies` | Controls cookie handling |
| `MaxAutomaticRedirections` | Controls redirect limit |

`AllowAutoRedirect = false` is especially useful when testing authentication redirects or verifying `Location` headers.

### Basic API Test Example

Example controller:

```csharp
[ApiController]
[Route("api/customers")]
public sealed class CustomersController : ControllerBase
{
    [HttpGet("{id:int}")]
    public ActionResult<CustomerDto> GetById(int id)
    {
        if (id == 1)
        {
            return Ok(new CustomerDto
            {
                Id = 1,
                Name = "Alice"
            });
        }

        return NotFound();
    }
}

public sealed class CustomerDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
```

Integration test:

```csharp
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

public sealed class CustomersApiTests
    : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public CustomersApiTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetById_WhenCustomerExists_ReturnsCustomer()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/customers/1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var customer = await response.Content
            .ReadFromJsonAsync<CustomerDto>();

        Assert.NotNull(customer);
        Assert.Equal(1, customer.Id);
        Assert.Equal("Alice", customer.Name);
    }

    [Fact]
    public async Task GetById_WhenCustomerDoesNotExist_ReturnsNotFound()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/customers/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
```

This tests the application through HTTP rather than directly calling the controller method.

### Testing Minimal APIs

`WebApplicationFactory` works well with Minimal APIs.

Example endpoint:

```csharp
app.MapGet("/api/products/{id:int}", (int id) =>
{
    return id == 1
        ? Results.Ok(new ProductDto(1, "Keyboard"))
        : Results.NotFound();
});

public sealed record ProductDto(int Id, string Name);
```

Test:

```csharp
public sealed class ProductsApiTests
    : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ProductsApiTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetProduct_WhenRouteMatches_ReturnsProduct()
    {
        using var client = _factory.CreateClient();

        var product = await client.GetFromJsonAsync<ProductDto>(
            "/api/products/1");

        Assert.NotNull(product);
        Assert.Equal("Keyboard", product.Name);
    }
}
```

This verifies route matching, parameter binding, endpoint execution, and response serialization.

### Custom `WebApplicationFactory`

Most real integration tests need custom configuration. A common approach is to derive from `WebApplicationFactory<Program>`.

Example:

```csharp
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

public sealed class CustomWebApplicationFactory
    : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            // Replace production services here.
        });
    }
}
```

Test:

```csharp
public sealed class OrdersApiTests
    : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public OrdersApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetOrders_ReturnsOk()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/orders");

        response.EnsureSuccessStatusCode();
    }
}
```

A custom factory keeps test setup reusable and avoids duplicating configuration in every test class.

### `ConfigureWebHost`

`ConfigureWebHost` lets tests customize the app host.

Common customizations:

- Set environment to `Testing`.
- Replace the database.
- Replace external services with fakes.
- Override configuration values.
- Add test authentication.
- Seed test data.
- Configure test logging.
- Remove hosted services that should not run in tests.

Example:

```csharp
protected override void ConfigureWebHost(IWebHostBuilder builder)
{
    builder.UseEnvironment("Testing");

    builder.ConfigureServices(services =>
    {
        services.AddSingleton<IEmailSender, FakeEmailSender>();
    });
}
```

This modifies the service collection before the test server is built.

### `ConfigureTestServices`

`ConfigureTestServices` is commonly used to override services specifically for tests.

Example:

```csharp
var client = _factory.WithWebHostBuilder(builder =>
{
    builder.ConfigureTestServices(services =>
    {
        services.AddSingleton<IPaymentGateway, FakePaymentGateway>();
    });
})
.CreateClient();
```

This is useful when one test or one test class needs a specific fake or stub.

Use `ConfigureWebHost` in a custom factory for common test setup.

Use `WithWebHostBuilder` plus `ConfigureTestServices` for per-test customizations.

### Replacing Services

To replace an existing service, remove the old registration and add a new one.

Example:

```csharp
builder.ConfigureServices(services =>
{
    var descriptor = services.SingleOrDefault(
        service => service.ServiceType == typeof(IEmailSender));

    if (descriptor is not null)
    {
        services.Remove(descriptor);
    }

    services.AddSingleton<IEmailSender, FakeEmailSender>();
});
```

A reusable extension can help:

```csharp
public static class ServiceCollectionTestExtensions
{
    public static IServiceCollection ReplaceService<TService, TImplementation>(
        this IServiceCollection services)
        where TService : class
        where TImplementation : class, TService
    {
        var descriptor = services.SingleOrDefault(
            service => service.ServiceType == typeof(TService));

        if (descriptor is not null)
        {
            services.Remove(descriptor);
        }

        services.AddScoped<TService, TImplementation>();

        return services;
    }
}
```

Usage:

```csharp
services.ReplaceService<IEmailSender, FakeEmailSender>();
```

### Replacing the Database

Integration tests should use a database strategy that matches the test goal.

Options:

| Option | Best For | Trade-Off |
|---|---|---|
| EF Core InMemory provider | Simple tests not depending on relational behavior | Does not behave like a relational database |
| SQLite in-memory | Fast relational tests | SQL dialect differs from SQL Server/PostgreSQL |
| Testcontainers | Production-like database tests | Slower and needs Docker |
| Dedicated test database | Production-like behavior | Requires cleanup and isolation |
| Transaction rollback per test | Fast isolation in some cases | Can be hard with multiple connections or background work |

For ASP.NET Core + EF Core integration tests, SQLite in-memory is often better than EF Core InMemory when relational behavior matters.

### SQLite In-Memory Test Database Example

For SQLite in-memory, keep the connection open for the lifetime of the factory. If the connection closes, the database disappears.

Example custom factory:

```csharp
using System.Data.Common;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

public sealed class CustomWebApplicationFactory
    : WebApplicationFactory<Program>
{
    private DbConnection? _connection;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            var dbContextDescriptor = services.SingleOrDefault(
                service => service.ServiceType ==
                    typeof(DbContextOptions<AppDbContext>));

            if (dbContextDescriptor is not null)
            {
                services.Remove(dbContextDescriptor);
            }

            var dbConnectionDescriptor = services.SingleOrDefault(
                service => service.ServiceType == typeof(DbConnection));

            if (dbConnectionDescriptor is not null)
            {
                services.Remove(dbConnectionDescriptor);
            }

            services.AddSingleton<DbConnection>(_ =>
            {
                _connection = new SqliteConnection("Data Source=:memory:");
                _connection.Open();

                return _connection;
            });

            services.AddDbContext<AppDbContext>((serviceProvider, options) =>
            {
                var connection = serviceProvider
                    .GetRequiredService<DbConnection>();

                options.UseSqlite(connection);
            });

            using var serviceProvider = services.BuildServiceProvider();
            using var scope = serviceProvider.CreateScope();

            var context = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

            context.Database.EnsureCreated();

            SeedTestData(context);
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        _connection?.Dispose();
    }

    private static void SeedTestData(AppDbContext context)
    {
        context.Customers.Add(new Customer
        {
            Name = "Test Customer"
        });

        context.SaveChanges();
    }
}
```

This pattern provides relational database behavior without requiring a full external database server.

### Testcontainers and Real Databases

For higher confidence, tests can run against a real database in a container, such as SQL Server, PostgreSQL, or MySQL.

This is useful when tests depend on:

- Provider-specific SQL behavior.
- Real migrations.
- Real constraints.
- Real indexes.
- Transactions.
- Stored procedures.
- JSON columns.
- Case sensitivity or collation.
- Query performance behavior.
- Database-specific functions.

Trade-offs:

- Slower than in-memory tests.
- Requires Docker or container support.
- More setup complexity.
- Must manage test data cleanup.
- More moving parts in CI.

A practical testing strategy often combines:

- Many unit tests.
- A focused set of integration tests with `WebApplicationFactory`.
- Database integration tests using SQLite or real containers.
- A small number of E2E tests in a deployed-like environment.

### Seeding Test Data

Test data should be deterministic and isolated.

Example:

```csharp
public static class TestDataSeeder
{
    public static void Seed(AppDbContext context)
    {
        context.Customers.AddRange(
            new Customer
            {
                Id = 1,
                Name = "Alice"
            },
            new Customer
            {
                Id = 2,
                Name = "Bob"
            });

        context.SaveChanges();
    }
}
```

Common seeding approaches:

- Seed once per test class.
- Reseed before each test.
- Use unique database names per test.
- Use transaction rollback.
- Use Respawn-style database reset.
- Use test data builders.
- Use factory methods for request DTOs.

Avoid tests depending on execution order.

Bad:

```csharp
[Fact]
public async Task TestA_CreatesCustomer()
{
    // Creates customer needed by TestB.
}

[Fact]
public async Task TestB_UsesCustomerFromTestA()
{
    // Bad: depends on TestA running first.
}
```

Each test should arrange the data it needs or use a known seeded baseline.

### Testing Authentication

For integration tests, you usually do not want to call a real identity provider. Instead, add a test authentication scheme.

Test authentication handler:

```csharp
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

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
            new Claim(ClaimTypes.NameIdentifier, "test-user-id"),
            new Claim(ClaimTypes.Name, "Test User"),
            new Claim(ClaimTypes.Role, "Admin")
        };

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
```

Configure it in tests:

```csharp
var client = _factory.WithWebHostBuilder(builder =>
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

Now protected endpoints can be tested without real JWT validation or external sign-in.

### Testing Authorization

Example endpoint:

```csharp
app.MapGet("/api/admin/users", () => Results.Ok())
    .RequireAuthorization(policy => policy.RequireRole("Admin"));
```

Test success:

```csharp
[Fact]
public async Task AdminEndpoint_WithAdminUser_ReturnsOk()
{
    using var client = _factory.CreateClient();

    client.DefaultRequestHeaders.Authorization =
        new AuthenticationHeaderValue(TestAuthHandler.SchemeName);

    var response = await client.GetAsync("/api/admin/users");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
}
```

Test unauthenticated behavior:

```csharp
[Fact]
public async Task AdminEndpoint_WithoutUser_ReturnsUnauthorizedOrRedirect()
{
    using var client = _factory.CreateClient(
        new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

    var response = await client.GetAsync("/api/admin/users");

    Assert.True(
        response.StatusCode == HttpStatusCode.Unauthorized ||
        response.StatusCode == HttpStatusCode.Redirect);
}
```

For API projects, unauthenticated requests usually return `401 Unauthorized`. For cookie-based apps, unauthenticated requests may redirect to login.

### Testing Redirects

By default, `HttpClient` from `CreateClient()` may follow redirects. That can hide the original response.

Example: if an unauthenticated request redirects to `/login`, automatic redirect can make the final response `200 OK`, even though the first response was `302 Redirect`.

To test redirects:

```csharp
using var client = _factory.CreateClient(
    new WebApplicationFactoryClientOptions
    {
        AllowAutoRedirect = false
    });

var response = await client.GetAsync("/admin");

Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
Assert.Contains("/login", response.Headers.Location?.OriginalString);
```

This is important for authentication tests and MVC/Razor Pages tests.

### Testing Model Binding and Validation

Because `WebApplicationFactory` sends real HTTP requests, it can test model binding and validation.

Example request:

```csharp
public sealed class CreateProductRequest
{
    [Required]
    public string Name { get; set; } = string.Empty;

    [Range(0.01, 10000)]
    public decimal Price { get; set; }
}
```

Controller:

```csharp
[ApiController]
[Route("api/products")]
public sealed class ProductsController : ControllerBase
{
    [HttpPost]
    public IActionResult Create(CreateProductRequest request)
    {
        return Created($"/api/products/1", new { Id = 1 });
    }
}
```

Test invalid request:

```csharp
[Fact]
public async Task CreateProduct_WhenRequestIsInvalid_ReturnsBadRequest()
{
    using var client = _factory.CreateClient();

    var response = await client.PostAsJsonAsync("/api/products", new
    {
        Name = "",
        Price = -1
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

    var body = await response.Content.ReadAsStringAsync();

    Assert.Contains("errors", body);
}
```

This verifies `[ApiController]` automatic validation behavior, model binding, response formatting, and HTTP status code.

### Testing `ProblemDetails` and Error Middleware

Integration tests are useful for verifying consistent error responses.

Example:

```csharp
[Fact]
public async Task UnknownEndpoint_ReturnsProblemDetailsOrNotFound()
{
    using var client = _factory.CreateClient();

    var response = await client.GetAsync("/api/does-not-exist");

    Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
}
```

Example for validation problem details:

```csharp
[Fact]
public async Task CreateProduct_InvalidBody_ReturnsValidationProblemDetails()
{
    using var client = _factory.CreateClient();

    var response = await client.PostAsJsonAsync("/api/products", new
    {
        Price = -5
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

    var problem = await response.Content
        .ReadFromJsonAsync<ValidationProblemDetails>();

    Assert.NotNull(problem);
    Assert.NotEmpty(problem.Errors);
}
```

This is difficult to test fully with only controller unit tests because the response can be produced by filters, middleware, or framework behavior.

### Testing Middleware

Integration tests are excellent for middleware behavior.

Example custom middleware:

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
        var correlationId = context.Request.Headers["X-Correlation-Id"]
            .FirstOrDefault() ?? Guid.NewGuid().ToString("N");

        context.Response.Headers["X-Correlation-Id"] = correlationId;

        await _next(context);
    }
}
```

Test:

```csharp
[Fact]
public async Task Request_WithCorrelationId_ReturnsSameCorrelationId()
{
    using var client = _factory.CreateClient();

    using var request = new HttpRequestMessage(HttpMethod.Get, "/health");
    request.Headers.Add("X-Correlation-Id", "test-correlation-id");

    var response = await client.SendAsync(request);

    Assert.True(response.Headers.TryGetValues(
        "X-Correlation-Id",
        out var values));

    Assert.Contains("test-correlation-id", values);
}
```

This verifies the middleware in the actual pipeline order.

### Testing Headers, Cookies, and Content Types

Integration tests can verify HTTP-level details.

Example:

```csharp
[Fact]
public async Task GetProducts_ReturnsJsonContentType()
{
    using var client = _factory.CreateClient();

    var response = await client.GetAsync("/api/products");

    response.EnsureSuccessStatusCode();

    Assert.Equal(
        "application/json",
        response.Content.Headers.ContentType?.MediaType);
}
```

Cookie test:

```csharp
var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
{
    HandleCookies = true
});
```

HTTP details are part of the contract. Integration tests are a good place to verify them.

### Testing Configuration

Tests often need configuration overrides.

Example using environment:

```csharp
protected override void ConfigureWebHost(IWebHostBuilder builder)
{
    builder.UseEnvironment("Testing");
}
```

Example overriding configuration values:

```csharp
protected override void ConfigureWebHost(IWebHostBuilder builder)
{
    builder.ConfigureAppConfiguration((context, configBuilder) =>
    {
        var testSettings = new Dictionary<string, string?>
        {
            ["FeatureFlags:UseFakePayments"] = "true",
            ["ExternalServices:Payments:BaseUrl"] = "http://localhost/fake"
        };

        configBuilder.AddInMemoryCollection(testSettings);
    });
}
```

This is useful for replacing production URLs, disabling background jobs, using test connection strings, or enabling test-only behavior.

### Testing External Dependencies

External systems should usually be replaced in integration tests unless the goal is to test the external integration itself.

Examples:

| Dependency | Test Replacement |
|---|---|
| Email provider | Fake email sender |
| Payment gateway | Fake payment gateway |
| Message bus | In-memory fake or test container |
| Blob storage | Local emulator, fake, or test container |
| Identity provider | Test authentication scheme |
| Third-party API | Mock HTTP server or fake client |
| Time | `TimeProvider` fake |
| Random IDs | Deterministic generator |

Example fake:

```csharp
public sealed class FakeEmailSender : IEmailSender
{
    public List<EmailMessage> SentMessages { get; } = new();

    public Task SendAsync(EmailMessage message)
    {
        SentMessages.Add(message);
        return Task.CompletedTask;
    }
}
```

Register:

```csharp
services.AddSingleton<IEmailSender, FakeEmailSender>();
```

The test can later resolve the fake from the factory service provider if needed.

### Accessing Services from the Factory

Sometimes a test needs to access services from the test host, such as a fake service or database context.

Example:

```csharp
using var scope = _factory.Services.CreateScope();

var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

var order = await context.Orders.SingleAsync(o => o.Id == orderId);
```

This can be useful for:

- Seeding data.
- Verifying database state.
- Inspecting fake service calls.
- Resetting state between tests.

Be careful not to bypass the HTTP API too much. Use direct service access mainly for arrange and assert steps, not for the actual behavior being tested.

### Arrange-Act-Assert Pattern

Integration tests should still follow Arrange-Act-Assert.

Example:

```csharp
[Fact]
public async Task CreateOrder_WithValidRequest_PersistsOrder()
{
    // Arrange
    using var scope = _factory.Services.CreateScope();

    var context = scope.ServiceProvider
        .GetRequiredService<AppDbContext>();

    context.Customers.Add(new Customer { Id = 1, Name = "Alice" });
    await context.SaveChangesAsync();

    using var client = _factory.CreateClient();

    var request = new CreateOrderRequest
    {
        CustomerId = 1,
        ProductId = 10,
        Quantity = 2
    };

    // Act
    var response = await client.PostAsJsonAsync("/api/orders", request);

    // Assert
    Assert.Equal(HttpStatusCode.Created, response.StatusCode);

    var orderExists = await context.Orders
        .AnyAsync(o => o.CustomerId == 1);

    Assert.True(orderExists);
}
```

The actual behavior is exercised through HTTP. Direct database access is used only to set up and verify.

### Test Isolation

Integration tests must avoid hidden dependencies between tests.

Common isolation strategies:

- New database per test.
- New database per test class.
- Clean database before each test.
- Transaction rollback after each test.
- Unique test data per test.
- Testcontainers with reset logic.
- Respawn-style cleanup.
- SQLite in-memory database per factory.
- Disable parallelization for tests sharing the same database.

Bad pattern:

```csharp
// Test B depends on data created by Test A.
```

Good pattern:

```csharp
// Every test creates or resets the data it needs.
```

Test isolation is critical because integration tests are often slower and more stateful than unit tests.

### xUnit Fixtures

`WebApplicationFactory` is commonly used with xUnit fixtures.

Class fixture:

```csharp
public sealed class OrdersApiTests
    : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public OrdersApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }
}
```

A class fixture is created once for the test class and shared by tests in that class.

Collection fixture:

```csharp
[CollectionDefinition("Integration tests")]
public sealed class IntegrationTestCollection
    : ICollectionFixture<CustomWebApplicationFactory>
{
}
```

Usage:

```csharp
[Collection("Integration tests")]
public sealed class OrdersApiTests
{
    private readonly CustomWebApplicationFactory _factory;

    public OrdersApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }
}
```

Collection fixtures are useful when multiple test classes share the same factory or database setup.

### Parallel Test Execution

Parallel tests can interfere with each other if they share state.

Common problems:

- Two tests write to the same database.
- One test deletes data another test expects.
- Shared fake services keep old state.
- Shared static values leak between tests.
- A test changes configuration globally.

Options:

- Disable parallelization for integration test collection.
- Use a unique database per test.
- Reset database before each test.
- Make test data unique.
- Avoid mutable shared fakes.
- Create a new factory per test when necessary.

Example xUnit collection to group non-parallel tests:

```csharp
[CollectionDefinition("Integration tests", DisableParallelization = true)]
public sealed class IntegrationTestCollection
    : ICollectionFixture<CustomWebApplicationFactory>
{
}
```

Use this carefully. Disabling parallelization can make tests slower, but it may be needed for stateful integration tests.

### `WebApplicationFactory` vs Direct `TestServer`

You can use `TestServer` directly, but `WebApplicationFactory` is usually easier for testing a real ASP.NET Core app.

`WebApplicationFactory` benefits:

- Discovers and boots the real application entry point.
- Creates a test host.
- Provides `CreateClient()`.
- Supports `WithWebHostBuilder`.
- Integrates with `Microsoft.AspNetCore.Mvc.Testing`.
- Makes service replacement patterns convenient.
- Works well with minimal hosting and top-level `Program`.

Direct `TestServer` can be useful when:

- You are testing middleware in isolation.
- You are building a very small test-specific pipeline.
- You do not need to boot the full application.
- You want full control over the host builder.

Example direct `TestServer` style:

```csharp
var builder = new WebHostBuilder()
    .Configure(app =>
    {
        app.Run(async context =>
        {
            await context.Response.WriteAsync("Hello from TestServer");
        });
    });

using var server = new TestServer(builder);
using var client = server.CreateClient();

var response = await client.GetStringAsync("/");

Assert.Equal("Hello from TestServer", response);
```

For application-level integration tests, prefer `WebApplicationFactory`.

### What These Tests Do Not Cover

`WebApplicationFactory` and `TestServer` are powerful, but they do not cover everything.

They usually do not test:

- Real browser behavior.
- Frontend JavaScript.
- CSS and layout.
- Real network sockets.
- Kestrel-specific behavior.
- TLS certificate behavior.
- Reverse proxy headers from a real proxy.
- CDN behavior.
- Production gateway behavior.
- Real third-party identity provider login.
- Real cloud service permissions.
- Real load, scale, and concurrency behavior.
- Actual deployed environment configuration.

For those concerns, use E2E tests, browser automation, smoke tests, contract tests, load tests, staging tests, or infrastructure tests.

### What to Test with `WebApplicationFactory`

Good candidates:

- Important API endpoints.
- Authentication and authorization behavior.
- Model validation responses.
- Routing and parameter binding.
- Middleware behavior.
- Error handling and `ProblemDetails`.
- JSON serialization shape.
- Database persistence through the API.
- DI configuration.
- Filters and endpoint filters.
- Health checks.
- Versioned API behavior.
- CORS/preflight behavior when relevant.
- Headers and cookies.
- Idempotency behavior.
- Transaction boundaries.
- Important business workflows.

Avoid using integration tests for every tiny code path. Keep unit tests for pure business logic and integration tests for system wiring and important request flows.

### Common Mistakes

Common mistakes include:

- Treating `WebApplicationFactory` tests as unit tests.
- Testing only controllers directly and missing middleware/routing behavior.
- Not exposing `Program` correctly.
- Using EF Core InMemory provider for relational behavior tests.
- Sharing one database across tests without cleanup.
- Depending on test execution order.
- Letting tests call real external services accidentally.
- Leaving production hosted services running during tests.
- Testing authenticated endpoints without a proper test authentication scheme.
- Forgetting `AllowAutoRedirect = false` when testing redirects.
- Returning success because the client followed a redirect.
- Not setting the test environment.
- Seeding too much data globally.
- Mutating shared fake services across parallel tests.
- Making integration tests too broad and slow.
- Asserting only `200 OK` and not checking response content.
- Not testing negative cases like `400`, `401`, `403`, and `404`.
- Ignoring cancellation, headers, cookies, and content type when they matter.
- Using full pipeline tests for logic that would be better covered by fast unit tests.

### Best Practices

Use `WebApplicationFactory<Program>` for ASP.NET Core server-side integration tests.

Add `public partial class Program` to expose the app entry point to the test project.

Create a custom factory for common test configuration.

Set the environment to `Testing`.

Replace external dependencies with fakes or test doubles.

Use a relational test database when relational behavior matters.

Use real database containers for provider-specific behavior and higher confidence.

Keep test data deterministic and isolated.

Do not depend on test order.

Use `AllowAutoRedirect = false` when testing redirects or authentication challenges.

Use a test authentication scheme for protected endpoints.

Assert status code, headers, content type, and response body when relevant.

Use direct service access mainly for arrange and assert steps.

Keep integration tests focused on meaningful request flows.

Use unit tests for isolated business logic.

Use E2E tests for frontend, browser, real network, and deployed environment behavior.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q01 -->
#### Beginner Q01: What is `WebApplicationFactory` used for in ASP.NET Core tests?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

`WebApplicationFactory<TEntryPoint>` is used to bootstrap an ASP.NET Core application in a test host so tests can send HTTP requests to it. It creates a `TestServer` and provides an `HttpClient` through `CreateClient()`.

This allows tests to exercise the real server-side pipeline, including routing, middleware, dependency injection, model binding, validation, controllers or Minimal APIs, authorization, serialization, and error handling.

##### Key Points to Mention

- Used for ASP.NET Core integration tests.
- Usually references `Program`.
- Creates a test host and `TestServer`.
- Provides `HttpClient`.
- Sends real HTTP requests to the app pipeline.
- More realistic than directly calling controller methods.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q01 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q02 -->
#### Beginner Q02: What is `TestServer`?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`TestServer` is an in-memory server implementation for ASP.NET Core tests. It executes requests through the ASP.NET Core pipeline without opening a real network port.

`WebApplicationFactory` usually creates `TestServer` internally. Tests normally interact with it through an `HttpClient` created by `CreateClient()`.

##### Key Points to Mention

- In-memory ASP.NET Core test server.
- Does not require a real TCP port.
- Does not use a real browser.
- Executes the ASP.NET Core pipeline.
- Used by `WebApplicationFactory`.
- Not the same as real Kestrel/network E2E testing.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q02 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q03 -->
#### Beginner Q03: Why do integration tests use `HttpClient` instead of directly calling controllers?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Using `HttpClient` sends requests through the real ASP.NET Core pipeline. This tests routing, middleware, model binding, validation, filters, authentication, authorization, serialization, and HTTP response behavior.

Directly calling a controller method can be useful for some unit tests, but it bypasses much of the framework behavior. It may miss bugs in routing, dependency injection, middleware order, validation responses, or authentication configuration.

##### Key Points to Mention

- `HttpClient` tests through HTTP.
- Exercises framework pipeline behavior.
- Direct controller calls bypass middleware and routing.
- Better for endpoint contract testing.
- Can verify status codes, headers, and response body.
- Complements unit tests.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q03 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q04 -->
#### Beginner Q04: How do you expose `Program` for `WebApplicationFactory<Program>`?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

For ASP.NET Core apps using top-level statements, add a public partial `Program` class at the bottom of `Program.cs`.

Example:

```csharp
app.Run();

public partial class Program
{
}
```

This allows the test project to reference `Program`:

```csharp
public sealed class ApiTests
    : IClassFixture<WebApplicationFactory<Program>>
{
}
```

##### Key Points to Mention

- Top-level `Program` may not be accessible by default.
- Add `public partial class Program`.
- Put it after `app.Run()`.
- Test project can then use `WebApplicationFactory<Program>`.
- `InternalsVisibleTo` is another option.
- This is common in modern ASP.NET Core apps.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q04 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q05 -->
#### Beginner Q05: What is the difference between a unit test and a `WebApplicationFactory` integration test?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

A unit test usually tests a small piece of code in isolation, such as a service method, validator, or domain rule. It should be fast and focused.

A `WebApplicationFactory` integration test starts the ASP.NET Core application in a test host and sends HTTP requests through the server pipeline. It tests how multiple parts work together, such as routing, middleware, DI, controllers, validation, database access, and response formatting.

##### Key Points to Mention

- Unit tests isolate small code units.
- Integration tests verify multiple components working together.
- `WebApplicationFactory` tests server-side HTTP behavior.
- Integration tests are usually slower than unit tests.
- Integration tests give higher confidence in wiring.
- Both test types are useful.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q05 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q06 -->
#### Beginner Q06: What can you verify in a full ASP.NET Core pipeline test?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

You can verify routing, middleware behavior, dependency injection, model binding, validation, authentication, authorization, controller or Minimal API execution, response serialization, status codes, headers, cookies, and error responses.

For example, a test can verify that an invalid request returns `400 Bad Request` with validation errors, or that a protected endpoint returns `401 Unauthorized` for anonymous users.

##### Key Points to Mention

- Routing.
- Middleware.
- DI configuration.
- Model binding and validation.
- Auth and authorization.
- Endpoint execution.
- JSON serialization.
- Status codes and headers.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q01 -->
#### Intermediate Q01: How do you customize `WebApplicationFactory` for integration tests?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Create a custom class that inherits from `WebApplicationFactory<Program>` and override `ConfigureWebHost`.

Example:

```csharp
public sealed class CustomWebApplicationFactory
    : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            services.AddSingleton<IEmailSender, FakeEmailSender>();
        });
    }
}
```

This allows tests to set the environment, replace services, configure test databases, seed data, override configuration, and add test authentication.

##### Key Points to Mention

- Inherit from `WebApplicationFactory<Program>`.
- Override `ConfigureWebHost`.
- Set environment to `Testing`.
- Replace production services.
- Configure test database.
- Seed test data.
- Reuse the custom factory across tests.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q01 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q02 -->
#### Intermediate Q02: How do you replace production services in an integration test?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use `ConfigureServices` in a custom factory or `ConfigureTestServices` with `WithWebHostBuilder`. Remove the existing service registration and add the test replacement.

Example:

```csharp
var client = factory.WithWebHostBuilder(builder =>
{
    builder.ConfigureTestServices(services =>
    {
        var descriptor = services.SingleOrDefault(
            service => service.ServiceType == typeof(IPaymentGateway));

        if (descriptor is not null)
        {
            services.Remove(descriptor);
        }

        services.AddSingleton<IPaymentGateway, FakePaymentGateway>();
    });
})
.CreateClient();
```

This prevents tests from calling real external systems.

##### Key Points to Mention

- Use `ConfigureServices` or `ConfigureTestServices`.
- Remove the old descriptor if needed.
- Add fake, stub, or mock service.
- Useful for external dependencies.
- `WithWebHostBuilder` is good for per-test changes.
- Avoid real external calls in integration tests unless intended.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q02 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q03 -->
#### Intermediate Q03: How do you test authenticated endpoints without calling a real identity provider?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Add a test authentication scheme with a custom `AuthenticationHandler`. The handler returns a successful `AuthenticateResult` with test claims. Configure the app in tests to use that scheme.

Example:

```csharp
services.AddAuthentication("Test")
    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
        "Test",
        options => { });
```

Then set the client header:

```csharp
client.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Test");
```

This lets you test authorization policies and protected endpoints without relying on real JWT validation or external login.

##### Key Points to Mention

- Use a test authentication scheme.
- Implement `AuthenticationHandler<AuthenticationSchemeOptions>`.
- Return test claims.
- Configure the scheme in `ConfigureTestServices`.
- Use the same scheme expected by the app.
- Avoid real identity provider calls in integration tests.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q03 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q04 -->
#### Intermediate Q04: Why would you set `AllowAutoRedirect = false` in integration tests?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Set `AllowAutoRedirect = false` when you want to inspect the original redirect response instead of the final response after following the redirect.

This is common when testing authentication. An unauthenticated cookie-based request may return `302 Redirect` to a login page. If the client follows the redirect automatically, the test may only see the final `200 OK` login page and miss the original redirect.

Example:

```csharp
var client = factory.CreateClient(new WebApplicationFactoryClientOptions
{
    AllowAutoRedirect = false
});
```

##### Key Points to Mention

- Prevents automatic redirect following.
- Useful for testing login redirects.
- Lets you assert `302` status.
- Lets you inspect `Location` header.
- Avoids false success from final redirected page.
- Important for auth tests.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q04 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q05 -->
#### Intermediate Q05: How do you configure a test database for `WebApplicationFactory` tests?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

In the custom factory, remove the production `DbContextOptions<TContext>` registration and add a test database provider. For relational behavior, SQLite in-memory or a real database container is often better than EF Core InMemory.

Example:

```csharp
builder.ConfigureServices(services =>
{
    var descriptor = services.SingleOrDefault(
        service => service.ServiceType ==
            typeof(DbContextOptions<AppDbContext>));

    if (descriptor is not null)
    {
        services.Remove(descriptor);
    }

    services.AddDbContext<AppDbContext>(options =>
    {
        options.UseSqlite(_connection);
    });
});
```

Seed the database before running tests and reset it between tests when needed.

##### Key Points to Mention

- Replace production database registration.
- Use SQLite in-memory for fast relational tests.
- Use real database containers for provider-specific behavior.
- Seed deterministic test data.
- Keep test data isolated.
- Avoid EF InMemory when relational behavior matters.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q05 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q06 -->
#### Intermediate Q06: What are the limitations of `TestServer`?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

`TestServer` runs the ASP.NET Core pipeline in memory. It does not test real network behavior, Kestrel socket behavior, TLS termination, reverse proxy behavior, real browser behavior, JavaScript, CDN behavior, or deployed infrastructure.

It is excellent for server-side integration tests, but it is not a replacement for browser-based E2E tests, smoke tests, load tests, or deployed environment tests.

##### Key Points to Mention

- In-memory server.
- No real TCP socket.
- No real browser.
- Does not fully test Kestrel/network/proxy behavior.
- Great for server pipeline testing.
- Not a full E2E replacement.
- Use browser/E2E tests for frontend and deployed behavior.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q06 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q07 -->
#### Intermediate Q07: How do you keep integration tests isolated?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

Keep tests isolated by ensuring each test has a predictable database and service state. Strategies include using a new database per test, resetting the database before each test, wrapping tests in transactions, using unique test data, disabling parallelization for shared resources, or using test containers with cleanup.

Tests should not depend on execution order. Each test should arrange the data it needs or use a known baseline.

##### Key Points to Mention

- Avoid shared mutable state.
- Reset or isolate database state.
- Do not depend on test order.
- Use unique test data when needed.
- Disable parallelization for shared resources if necessary.
- Reset fake service state.
- Deterministic tests are easier to maintain.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q07 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q08 -->
#### Intermediate Q08: When should you use `WithWebHostBuilder`?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use `WithWebHostBuilder` when a specific test needs custom host configuration different from the shared factory configuration.

Example:

```csharp
var client = factory.WithWebHostBuilder(builder =>
{
    builder.ConfigureTestServices(services =>
    {
        services.AddSingleton<IPaymentGateway, DeclinedPaymentGateway>();
    });
})
.CreateClient();
```

This is useful for per-test service replacement, configuration overrides, or authentication setup.

##### Key Points to Mention

- Creates a customized factory for a specific test.
- Useful for per-test overrides.
- Often used with `ConfigureTestServices`.
- Keeps the shared factory reusable.
- Avoids global test configuration changes.
- Good for scenario-specific fakes.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q01 -->
#### Advanced Q01: How would you design an integration testing strategy for a production ASP.NET Core API?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use unit tests for pure domain and application logic. Use `WebApplicationFactory` integration tests for important HTTP request flows and server-side pipeline behavior. Use a custom factory to configure the `Testing` environment, replace external services, configure test authentication, and set up a test database.

Use SQLite in-memory for fast relational tests when provider-specific behavior is not critical. Use real database containers for migrations, provider-specific SQL behavior, constraints, transactions, and higher confidence. Keep tests isolated with database reset or unique databases. Add a small number of E2E tests for frontend and deployed environment behavior.

The goal is not to test every line through HTTP. The goal is to cover important contracts and integration points.

##### Key Points to Mention

- Unit tests for isolated logic.
- `WebApplicationFactory` tests for HTTP pipeline.
- Custom factory for common setup.
- Replace external services.
- Use test authentication.
- Use realistic database strategy.
- Keep tests isolated.
- Add E2E tests for browser/deployed behavior.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q01 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q02 -->
#### Advanced Q02: How do you test authorization policies with `WebApplicationFactory`?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use a test authentication handler that can provide different claims for different scenarios. Configure the test authentication scheme in `ConfigureTestServices`. Then send HTTP requests with the test scheme and assert the response.

Test both success and failure cases:

- Anonymous request returns `401` or redirect.
- Authenticated user without required claim returns `403`.
- Authenticated user with required claim succeeds.
- Wrong role fails.
- Correct role succeeds.

For more flexible scenarios, the test handler can read claims from request headers so each test can control the user identity.

##### Key Points to Mention

- Add a test authentication scheme.
- Provide claims and roles.
- Test anonymous, forbidden, and success cases.
- Use `AllowAutoRedirect = false`.
- Match the scheme expected by the app.
- Consider header-driven test claims.
- Assert `401`, `403`, and success cases.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q02 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q03 -->
#### Advanced Q03: Why might EF Core InMemory be a poor choice for ASP.NET Core integration tests?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

EF Core InMemory is not a relational database. It does not enforce relational constraints the same way, does not use SQL translation the same way, and may behave differently for transactions, foreign keys, unique constraints, null semantics, case sensitivity, and query behavior.

It can be useful for simple tests that do not depend on relational behavior, but it can give false confidence for real database scenarios. SQLite in-memory or real database containers are often better choices for integration tests that need relational behavior.

##### Key Points to Mention

- InMemory is not relational.
- Does not fully test SQL translation.
- May not enforce constraints.
- Behavior can differ from production database.
- SQLite in-memory is more relational.
- Real containers give higher provider confidence.
- Choose database strategy based on test goal.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q03 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q04 -->
#### Advanced Q04: How would you test middleware order or cross-cutting behavior?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Use `WebApplicationFactory` to send HTTP requests through the real pipeline and assert observable behavior. For middleware order, test the effect rather than implementation details.

Examples:

- Correlation ID middleware adds response header.
- Exception middleware returns `ProblemDetails`.
- Authentication runs before authorization.
- CORS headers appear for preflight requests.
- Request logging or custom headers are applied.
- HTTPS redirection or status code behavior is correct.

Example:

```csharp
using var request = new HttpRequestMessage(HttpMethod.Get, "/health");
request.Headers.Add("X-Correlation-Id", "test-id");

var response = await client.SendAsync(request);

Assert.True(response.Headers.Contains("X-Correlation-Id"));
```

##### Key Points to Mention

- Test observable HTTP behavior.
- Send real requests through the pipeline.
- Avoid testing private middleware internals.
- Verify headers, status codes, body, and redirects.
- Useful for exception, auth, CORS, and correlation middleware.
- Pipeline order bugs often appear only in integration tests.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q04 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q05 -->
#### Advanced Q05: How do you avoid calling real external services during integration tests?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Replace external dependencies in the test host using `ConfigureServices` or `ConfigureTestServices`. Use fake implementations, mock HTTP handlers, local emulators, test containers, or contract-test stubs depending on the dependency.

For example, replace `IEmailSender` with a fake that records sent messages, or replace a payment gateway client with a deterministic fake that returns approved or declined responses.

Tests should fail if they accidentally call real production services.

##### Key Points to Mention

- Replace services in the test DI container.
- Use fakes or stubs for external systems.
- Use test containers/emulators when realistic integration is needed.
- Avoid production URLs and credentials.
- Override configuration in the `Testing` environment.
- Verify fake interactions when useful.
- Keep integration tests deterministic.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q05 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q06 -->
#### Advanced Q06: How would you handle database cleanup between integration tests?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Common strategies include creating a unique database per test, recreating the schema before each test, using transaction rollback, using a database reset tool, or using deterministic cleanup scripts.

The best choice depends on database provider, test speed, parallelization, and whether tests involve multiple connections or background work. For real database containers, resetting data between tests is often better than rebuilding the container every time.

The important goal is that tests are isolated and do not depend on execution order.

##### Key Points to Mention

- Use unique DB, reset DB, transaction rollback, or cleanup tool.
- Avoid test order dependencies.
- Consider parallel execution.
- Transactions may not work for all scenarios.
- Containers can be reused with data reset.
- Keep test setup deterministic.
- Choose strategy based on speed and realism.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q06 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q07 -->
#### Advanced Q07: What is the difference between `WebApplicationFactory` integration tests and true E2E tests?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

`WebApplicationFactory` integration tests run the ASP.NET Core server pipeline in memory using `TestServer`. They are great for testing server endpoints, middleware, DI, validation, serialization, and database integration.

True E2E tests usually run the application more like production, often with a real browser, real network port, real frontend, real backend, and real or deployed-like infrastructure. E2E tests can catch issues that `TestServer` cannot, such as JavaScript bugs, browser behavior, TLS, reverse proxy configuration, CDN behavior, or deployment configuration.

`WebApplicationFactory` tests are faster and more focused. E2E tests are broader but slower and more fragile.

##### Key Points to Mention

- `WebApplicationFactory` uses in-memory `TestServer`.
- E2E uses real browser/network/deployed-like environment.
- Integration tests are faster and more focused.
- E2E tests cover frontend and infrastructure behavior.
- `TestServer` does not fully test Kestrel/proxy/TLS/browser issues.
- Use both for different confidence levels.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q07 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q08 -->
#### Advanced Q08: How would you structure reusable integration test infrastructure?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

Create a custom `WebApplicationFactory<Program>` for common setup, such as environment, database, fake services, test authentication, and configuration overrides. Use xUnit fixtures or collections to share expensive setup. Create helper methods for authenticated clients, seeding data, resetting the database, and reading JSON responses.

Keep test infrastructure clear and predictable. Avoid hiding too much behavior in helpers, because tests should still be readable.

Example helpers:

- `CreateAuthenticatedClient`
- `ResetDatabaseAsync`
- `SeedCustomerAsync`
- `PostAsJsonAndReadAsync<T>`
- `GetRequiredService<T>`

##### Key Points to Mention

- Custom factory for common setup.
- Fixtures for shared expensive setup.
- Helpers for authenticated clients.
- Helpers for seeding and cleanup.
- Avoid test order dependencies.
- Keep helpers readable.
- Separate test infrastructure from test assertions.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q08 -->

<!-- question:start:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q09 -->
#### Advanced Q09: What are common causes of flaky `WebApplicationFactory` integration tests?

<!-- question-id:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

Common causes include shared database state, tests depending on execution order, parallel tests modifying the same data, shared fake services retaining state, real external service calls, background hosted services running during tests, timing-based assertions, unreset caches, non-deterministic test data, and redirects being followed automatically.

Fixes include database reset, unique test data, disabling parallelization for shared resources, replacing external dependencies, disabling or controlling background jobs, using deterministic clocks and IDs, and using `AllowAutoRedirect = false` when testing redirects.

##### Key Points to Mention

- Shared state causes flakes.
- Parallel tests can interfere.
- External services are unreliable.
- Background jobs can affect state.
- Timing-based tests are fragile.
- Reset database and fakes.
- Use deterministic time and IDs.
- Control redirects and authentication setup.

<!-- question:end:webapplicationfactory-testserver-httpclient-and-full-aspnet-core-pipeline-testing-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
