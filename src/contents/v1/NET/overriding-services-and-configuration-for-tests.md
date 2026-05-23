---
id: overriding-services-and-configuration-for-tests
topic: Testing strategy and integration testing

subtopic: Overriding services and configuration in .NET tests
category: .NET
---


## Overview

Overriding services and configuration for tests means changing the application's dependency injection registrations, configuration values, environment name, authentication behavior, database provider, external integrations, or options objects during automated tests.

In .NET and ASP.NET Core applications, production code is usually built around dependency injection and layered configuration. The same application may read from `appsettings.json`, `appsettings.Development.json`, environment variables, user secrets, Azure Key Vault, Azure App Configuration, command-line arguments, and in-memory configuration. Services may include repositories, EF Core `DbContext`, HTTP clients, message publishers, background workers, payment gateways, email senders, authentication handlers, caches, clocks, and file storage clients.

Tests often need different behavior from production:

- use a test database instead of a production database
- replace an email sender with a fake implementation
- replace payment or notification integrations with test doubles
- disable real background jobs
- use deterministic time, IDs, and feature flags
- configure fake authentication for protected endpoints
- use test-specific connection strings and options
- avoid network calls to real external systems

This topic matters because many real-world .NET bugs happen at integration boundaries: dependency injection registration, configuration binding, service lifetime mismatch, authentication setup, EF Core provider differences, or environment-specific behavior. A candidate who understands how to override services and configuration can write tests that are fast, reliable, safe, and realistic.

It is important for interviews because it shows practical experience with ASP.NET Core integration testing, `WebApplicationFactory`, dependency injection, options pattern, EF Core testing, configuration providers, and test isolation. Interviewers often ask this topic to separate developers who only know isolated unit tests from developers who can test real application behavior safely.

## Core Concepts

### Why Tests Override Services and Configuration

Tests should exercise the behavior that matters while controlling dependencies that make tests slow, flaky, unsafe, or hard to reproduce.

Common examples include:

- replacing a real SMTP email sender with an in-memory fake
- replacing a real payment gateway with a deterministic stub
- replacing an external HTTP API client with a fake client or mock server
- replacing a production database connection with SQLite, a containerized database, or an isolated test database
- replacing real authentication with a test authentication scheme
- overriding feature flags to test both enabled and disabled paths
- overriding timeout, retry, and circuit-breaker settings to keep tests fast
- overriding file storage paths to use temporary directories

The goal is not to fake everything. The goal is to choose the right test boundary.

For a unit test, replacing most dependencies is normal because the test focuses on one class.

For an integration test, replacing every dependency can hide real configuration and integration problems. A good integration test usually keeps the real application pipeline, routing, model binding, filters, validation, middleware, dependency injection, and serialization, while replacing only unsafe or expensive external dependencies.

### Unit Tests vs Integration Tests

A unit test usually creates the class under test directly and passes fake dependencies to its constructor.

```csharp
var fakeEmailSender = new FakeEmailSender();
var service = new UserRegistrationService(fakeEmailSender);

await service.RegisterAsync(newUser);

Assert.Single(fakeEmailSender.SentMessages);
```

An integration test usually starts a real test host and sends HTTP requests through the application pipeline.

```csharp
public class UsersApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public UsersApiTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Get_User_ReturnsSuccess()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/users/1");

        response.EnsureSuccessStatusCode();
    }
}
```

The second test is more realistic because it uses routing, middleware, dependency injection, filters, serialization, and the actual HTTP request-response pipeline.

### `WebApplicationFactory` and `TestServer`

`WebApplicationFactory<TEntryPoint>` is the common ASP.NET Core testing type used to bootstrap an application in memory for integration tests.

Typical responsibilities include:

- starting the application with a test host
- creating an `HttpClient` that sends requests to the in-memory app
- using the real application entry point, usually `Program`
- allowing test-specific service and configuration overrides
- supporting custom factories shared across many tests

For minimal hosting projects, the test project must be able to access the application entry point. A common approach is to add a public partial `Program` class in the web project.

```csharp
var builder = WebApplication.CreateBuilder(args);

// Register services and endpoints here.

var app = builder.Build();

app.MapControllers();

app.Run();

public partial class Program { }
```

This makes `WebApplicationFactory<Program>` usable from the test project.

### Custom Test Factory

A custom factory centralizes common test setup.

```csharp
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

public sealed class CustomWebApplicationFactory
    : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration((context, config) =>
        {
            var testSettings = new Dictionary<string, string?>
            {
                ["FeatureFlags:UseNewCheckout"] = "true",
                ["ExternalApis:Payments:BaseUrl"] = "https://localhost/fake-payments",
                ["Email:Enabled"] = "false"
            };

            config.AddInMemoryCollection(testSettings);
        });

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender, FakeEmailSender>();

            services.RemoveAll<IPaymentGateway>();
            services.AddScoped<IPaymentGateway, FakePaymentGateway>();
        });
    }
}
```

This is useful when most tests need the same fake services, test environment, and configuration values.

### Per-Test Overrides with `WithWebHostBuilder`

Sometimes a specific test needs a different service or configuration from the default test factory. `WithWebHostBuilder` creates a modified factory for that test.

```csharp
[Fact]
public async Task Checkout_WhenPaymentFails_ReturnsBadRequest()
{
    var client = _factory.WithWebHostBuilder(builder =>
    {
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IPaymentGateway>();
            services.AddScoped<IPaymentGateway, FailingPaymentGateway>();
        });
    })
    .CreateClient();

    var response = await client.PostAsJsonAsync("/api/checkout", new
    {
        ProductId = 10,
        Quantity = 1
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
}
```

This pattern keeps tests isolated. A failure-specific fake payment gateway is used only by that test, not by the entire suite.

### `ConfigureServices` vs `ConfigureTestServices`

`ConfigureServices` is a general host builder hook that can add or replace services during host configuration.

`ConfigureTestServices` is specifically designed for tests and runs after the application has registered its normal services. This makes it convenient for replacing production registrations.

```csharp
builder.ConfigureTestServices(services =>
{
    services.RemoveAll<INotificationSender>();
    services.AddSingleton<INotificationSender, FakeNotificationSender>();
});
```

In interviews, the important idea is that service registration order matters. If multiple registrations exist for the same service type, resolving a single service normally returns the last registration, while resolving `IEnumerable<TService>` returns all registrations. To avoid ambiguity, tests commonly remove the old registration before adding the replacement.

### Removing Existing Service Registrations

When overriding a dependency, do not blindly add another registration if the application may still resolve the old one.

Prefer explicit replacement:

```csharp
using Microsoft.Extensions.DependencyInjection.Extensions;

builder.ConfigureTestServices(services =>
{
    services.RemoveAll<IEmailSender>();
    services.AddSingleton<IEmailSender, FakeEmailSender>();
});
```

For simple services, `RemoveAll<TService>()` is usually clear.

For more complex cases, such as EF Core or named HTTP clients, you may need to remove specific descriptors.

```csharp
var descriptor = services.SingleOrDefault(
    d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));

if (descriptor is not null)
{
    services.Remove(descriptor);
}
```

The key habit is to inspect how the service is registered in production before replacing it in tests.

### Overriding EF Core `DbContext`

A common integration testing requirement is replacing the production database with a test database.

A realistic option is SQLite in-memory with an open connection:

```csharp
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Data.Common;

builder.ConfigureTestServices(services =>
{
    services.RemoveAll<DbContextOptions<AppDbContext>>();
    services.RemoveAll<DbConnection>();

    services.AddSingleton<DbConnection>(_ =>
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        return connection;
    });

    services.AddDbContext<AppDbContext>((serviceProvider, options) =>
    {
        var connection = serviceProvider.GetRequiredService<DbConnection>();
        options.UseSqlite(connection);
    });
});
```

The connection is registered as a singleton and kept open so that the SQLite in-memory database remains alive for the duration of the test host.

Test setup can then create the schema and seed data:

```csharp
using var scope = factory.Services.CreateScope();

var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

await db.Database.EnsureCreatedAsync();

db.Users.Add(new User
{
    Id = 1,
    Email = "admin@example.com",
    DisplayName = "Admin"
});

await db.SaveChangesAsync();
```

Important trade-offs:

- EF Core InMemory is fast but does not behave like a relational database.
- SQLite in-memory is closer to relational behavior but still differs from SQL Server.
- Testcontainers or a real test database gives the most realistic result but is slower and needs more infrastructure.
- A shared database can cause test pollution unless data is isolated carefully.

### Overriding Configuration with In-Memory Values

ASP.NET Core configuration is built from multiple providers. Later providers can override earlier providers for the same key. Tests can add an in-memory provider to override settings safely.

```csharp
builder.ConfigureAppConfiguration((context, config) =>
{
    config.AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["ConnectionStrings:Default"] = "DataSource=:memory:",
        ["Features:EnableAuditLogs"] = "false",
        ["ExternalApis:Inventory:TimeoutSeconds"] = "1"
    });
});
```

This is useful for:

- feature flags
- connection strings
- fake API URLs
- retry settings
- timeout settings
- authentication settings
- background worker settings

Configuration keys use colon-separated paths. For example, this JSON:

```json
{
  "ExternalApis": {
    "Inventory": {
      "TimeoutSeconds": 10
    }
  }
}
```

can be overridden with:

```csharp
["ExternalApis:Inventory:TimeoutSeconds"] = "1"
```

### Overriding the Environment

Some application behavior changes based on environment name. Tests can set a dedicated environment such as `Testing`.

```csharp
builder.UseEnvironment("Testing");
```

Application code can then load environment-specific settings:

```json
// appsettings.Testing.json
{
  "Email": {
    "Enabled": false
  }
}
```

However, tests should not rely too heavily on hidden environment-specific behavior. It is usually clearer to override important values directly in the test factory.

Good habits:

- use `Testing` as a clear environment name
- avoid using the real `Development` environment if tests need different behavior
- do not accidentally load production secrets or production connection strings
- make test-critical configuration explicit in the test setup

### Overriding Options

Many .NET applications bind configuration to strongly typed options classes.

```csharp
public sealed class PaymentOptions
{
    public string BaseUrl { get; set; } = "";
    public int TimeoutSeconds { get; set; }
}
```

Production registration might look like this:

```csharp
builder.Services
    .AddOptions<PaymentOptions>()
    .Bind(builder.Configuration.GetSection("Payment"))
    .ValidateDataAnnotations()
    .ValidateOnStart();
```

The most realistic test override is often to override the underlying configuration:

```csharp
builder.ConfigureAppConfiguration((context, config) =>
{
    config.AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["Payment:BaseUrl"] = "https://localhost/fake-payment",
        ["Payment:TimeoutSeconds"] = "1"
    });
});
```

For a narrower unit or component test, you can inject `IOptions<T>` directly:

```csharp
var options = Options.Create(new PaymentOptions
{
    BaseUrl = "https://localhost/fake-payment",
    TimeoutSeconds = 1
});

var gateway = new PaymentGateway(options, httpClient);
```

Important distinction:

- Override configuration when testing the real app startup and options binding.
- Use `Options.Create` when testing a class directly.
- Do not bypass options validation in integration tests if validation is part of production startup behavior.

### Overriding Authentication and Authorization

Protected endpoints often require authentication. Integration tests should not usually call the real identity provider. Instead, tests can register a fake authentication handler.

```csharp
public sealed class TestAuthHandler
    : AuthenticationHandler<AuthenticationSchemeOptions>
{
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
            new Claim(ClaimTypes.Name, "test-user"),
            new Claim(ClaimTypes.Role, "Admin")
        };

        var identity = new ClaimsIdentity(claims, "Test");
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, "Test");

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
```

Test registration:

```csharp
builder.ConfigureTestServices(services =>
{
    services
        .AddAuthentication("Test")
        .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
            "Test",
            options => { });
});
```

The test application must also use the same default authentication scheme for the request. This can be done through test-specific configuration or test-specific service setup depending on how authentication is configured in the application.

Good interview answer:

- Do not disable authorization globally if the purpose is to test protected endpoints.
- Prefer fake authentication with realistic claims.
- Test role, policy, and claim behavior explicitly.
- Keep a small number of end-to-end tests against the real identity provider if that integration is critical.

### Overriding `HttpClient` and External API Clients

Applications often call external APIs through typed clients, named clients, generated clients, or custom gateway interfaces.

A clean design wraps external calls behind an interface:

```csharp
public interface IInventoryClient
{
    Task<bool> IsAvailableAsync(int productId, CancellationToken cancellationToken);
}
```

Tests can replace the interface:

```csharp
builder.ConfigureTestServices(services =>
{
    services.RemoveAll<IInventoryClient>();
    services.AddSingleton<IInventoryClient>(new FakeInventoryClient
    {
        IsAvailable = true
    });
});
```

For more realistic HTTP-level tests, use a mock HTTP handler or local test server rather than replacing the whole client. This can catch problems in serialization, headers, URLs, and status code handling.

Trade-off:

- Replacing the interface is simple and fast.
- Mocking HTTP responses is more realistic for HTTP client code.
- Calling the real external service is slow, flaky, and unsafe for normal integration tests.

### Overriding Background Services

Background services can make integration tests unpredictable because they may start running as soon as the host starts.

Examples include:

- queue consumers
- scheduled jobs
- cache warmers
- outbox dispatchers
- long-running polling services

A common strategy is to disable or replace them in tests.

```csharp
builder.ConfigureTestServices(services =>
{
    services.RemoveAll<IHostedService>();
    services.AddSingleton<IHostedService, NoOpHostedService>();
});
```

This removes all hosted services, which may be too broad. A safer approach is to remove only a specific implementation when possible.

```csharp
var descriptor = services.SingleOrDefault(d =>
    d.ImplementationType == typeof(OrderOutboxWorker));

if (descriptor is not null)
{
    services.Remove(descriptor);
}
```

Best practice is to design background services around small injectable components. Then unit test the component logic directly and integration test only the hosted-service wiring when needed.

### Overriding Time, IDs, and Randomness

Tests are more reliable when time, IDs, and random values are deterministic.

Instead of calling `DateTime.UtcNow`, `Guid.NewGuid()`, or `Random.Shared` everywhere, production code can depend on abstractions.

```csharp
public interface IClock
{
    DateTimeOffset UtcNow { get; }
}

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}

public sealed class FakeClock : IClock
{
    public DateTimeOffset UtcNow { get; set; }
}
```

Test override:

```csharp
var fakeClock = new FakeClock
{
    UtcNow = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)
};

builder.ConfigureTestServices(services =>
{
    services.RemoveAll<IClock>();
    services.AddSingleton<IClock>(fakeClock);
});
```

This makes expiration, scheduling, audit fields, and date filtering easier to test.

### Service Lifetimes in Test Overrides

When replacing services, match the production lifetime unless there is a deliberate reason not to.

Common lifetimes:

- `Transient`: new instance each time it is requested
- `Scoped`: one instance per request scope in ASP.NET Core
- `Singleton`: one instance for the whole application host

Bad lifetime choices can create bugs:

```csharp
// Risky: singleton fake captures per-test mutable state and leaks across tests.
services.AddSingleton<IFakeStateStore, FakeStateStore>();
```

A singleton fake can be useful when the test needs to inspect state after an HTTP request, but it must be reset between tests or scoped to a fresh factory.

Better pattern for shared fake state:

```csharp
public sealed class EmailSink
{
    public List<EmailMessage> Messages { get; } = new();
}

builder.ConfigureTestServices(services =>
{
    services.AddSingleton<EmailSink>();
    services.RemoveAll<IEmailSender>();
    services.AddSingleton<IEmailSender, FakeEmailSender>();
});
```

Then the test can resolve `EmailSink` from the factory services and inspect what was sent.

### Test Isolation and Shared State

A frequent mistake is sharing one test host, one database, or one fake state object across many tests without resetting it.

Problems include:

- tests pass individually but fail when run together
- test order affects results
- parallel execution causes race conditions
- fake state leaks across tests
- database rows from one test affect another test

Safer strategies include:

- create a new factory per test when isolation is critical
- use unique database names per test
- reset database state before each test
- use transactions when the database provider supports rollback
- disable parallelization only when necessary
- avoid mutable static state in fakes
- keep fake objects thread-safe if tests run in parallel

Example unique database name:

```csharp
var databaseName = $"TestDb_{Guid.NewGuid():N}";

services.AddDbContext<AppDbContext>(options =>
{
    options.UseInMemoryDatabase(databaseName);
});
```

### Configuration Provider Order

Configuration provider order matters. If the same key is provided by multiple sources, the provider added later generally wins.

For tests, adding an in-memory provider near the end is useful because it can override earlier JSON files or environment-specific settings.

```csharp
builder.ConfigureAppConfiguration((context, config) =>
{
    config.AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["Features:EnablePayments"] = "false"
    });
});
```

Common mistake:

```csharp
Environment.SetEnvironmentVariable("Features__EnablePayments", "false");
```

This can work, but it is less isolated because environment variables are process-wide. If tests run in parallel, one test may affect another.

Prefer `AddInMemoryCollection` for test-specific settings.

### Avoiding Production Resource Access

Tests must never accidentally call production services or production databases.

Safety habits:

- use a dedicated `Testing` environment
- fail fast if a production connection string is detected in tests
- use fake external integrations by default
- use test-specific secrets only when required
- keep test settings outside production configuration
- make destructive tests run only against isolated resources
- avoid using real cloud resources unless the test is explicitly an end-to-end or smoke test

Example guard:

```csharp
if (connectionString.Contains("prod", StringComparison.OrdinalIgnoreCase))
{
    throw new InvalidOperationException(
        "Tests must not use a production database connection string.");
}
```

### Choosing What to Override

A good test strategy does not override everything.

Use this decision model:

| Dependency | Usually override? | Reason |
|---|---:|---|
| Database | Sometimes | Use real provider for higher confidence; use test DB for safety |
| Email sender | Yes | Prevent real emails |
| Payment gateway | Yes | Prevent real charges |
| External APIs | Usually | Avoid network flakiness and third-party dependency |
| Authentication | Usually | Avoid real identity provider in normal integration tests |
| Authorization policies | Usually no | Keep real policies to test protected behavior |
| Serialization | No | Keep real serialization to catch contract issues |
| Routing and middleware | No | Keep real pipeline in integration tests |
| Options binding | Usually no | Override config, but keep real binding and validation |
| Background services | Often | Avoid nondeterministic side effects |

The best interview answer explains not only how to override services, but also why and where to draw the boundary.

### Common Mistakes

Common mistakes include:

- adding a fake service without removing the production registration
- accidentally using production connection strings in tests
- overriding too much and turning integration tests into shallow unit tests
- mocking EF Core `DbSet` instead of testing repository/query behavior with a real provider
- using EF Core InMemory and assuming it behaves like SQL Server
- disabling authorization instead of testing policies with fake authenticated users
- using process-wide environment variables in parallel tests
- sharing mutable fake state across tests without resetting it
- ignoring service lifetimes when replacing dependencies
- testing only happy paths and never testing configuration failure
- bypassing options validation in tests even though production uses it
- letting background services run unintentionally during tests

### Best Practices

Good habits include:

- keep unit tests and integration tests in separate projects or clearly separated folders
- use `WebApplicationFactory<Program>` for ASP.NET Core integration tests
- centralize common test setup in a custom factory
- use `WithWebHostBuilder` for per-test overrides
- use `ConfigureTestServices` to replace services after production registration
- remove old registrations before adding replacements
- prefer in-memory configuration overrides over process-wide environment variables
- use a dedicated `Testing` environment
- keep real middleware, routing, filters, serialization, and model validation in integration tests
- use realistic database testing when persistence behavior matters
- fake external side-effect systems such as email, payments, SMS, and third-party APIs
- keep fake services simple, deterministic, and inspectable
- reset state between tests
- protect against accidental production resource access
- test both success and failure configuration scenarios

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

<!-- question:start:overriding-services-and-configuration-for-tests-beginner-q01 -->
<!-- question-id:overriding-services-and-configuration-for-tests-beginner-q01 -->
<!-- question-level:beginner -->
#### What does it mean to override services and configuration in .NET tests?

##### Expected Answer

Overriding services and configuration means changing the application's normal dependency injection registrations or configuration values during a test run.

For example, a production application may register a real `IEmailSender`, real payment gateway, real database connection, and real authentication provider. In tests, these can be replaced with fake or test-specific implementations so tests are safe, fast, deterministic, and isolated.

In ASP.NET Core integration tests, this is commonly done with `WebApplicationFactory`, `ConfigureTestServices`, `ConfigureAppConfiguration`, and `WithWebHostBuilder`.

The purpose is to keep the important parts of the application real while controlling dependencies that are unsafe, slow, flaky, or external.

##### Key Points to Mention

- Uses dependency injection and configuration provider overrides
- Common in ASP.NET Core integration tests
- Helps replace external dependencies with test doubles
- Keeps tests safe and repeatable
- Should not replace so much that integration tests lose value

<!-- question:end:overriding-services-and-configuration-for-tests-beginner-q01 -->

<!-- question:start:overriding-services-and-configuration-for-tests-beginner-q02 -->
<!-- question-id:overriding-services-and-configuration-for-tests-beginner-q02 -->
<!-- question-level:beginner -->
#### Why should tests avoid using production services and configuration?

##### Expected Answer

Tests should avoid production services and configuration because they can cause real side effects, security risks, flaky tests, high cost, and data corruption.

For example, using a production email sender may send real emails. Using a production payment gateway may create real charges. Using a production database may modify real customer data. Calling a third-party API may make tests slow or fail due to network issues.

Tests should use test-specific resources, fake services, isolated databases, and safe configuration values.

##### Key Points to Mention

- Prevents real side effects
- Protects production data
- Improves test reliability
- Avoids dependence on external systems
- Keeps tests deterministic and safe

<!-- question:end:overriding-services-and-configuration-for-tests-beginner-q02 -->

<!-- question:start:overriding-services-and-configuration-for-tests-beginner-q03 -->
<!-- question-id:overriding-services-and-configuration-for-tests-beginner-q03 -->
<!-- question-level:beginner -->
#### What is `WebApplicationFactory` used for in ASP.NET Core tests?

##### Expected Answer

`WebApplicationFactory<TEntryPoint>` is used to start an ASP.NET Core application in a test host and create an `HttpClient` for sending requests to the application in memory.

It allows integration tests to exercise the real request pipeline, including routing, middleware, filters, dependency injection, model binding, validation, and serialization.

It also allows tests to customize the application host by overriding services, configuration, environment, authentication, and databases.

##### Key Points to Mention

- Boots the application for integration testing
- Uses the real application entry point, usually `Program`
- Creates an `HttpClient` for test requests
- Supports service and configuration overrides
- Tests more than isolated class logic

<!-- question:end:overriding-services-and-configuration-for-tests-beginner-q03 -->

<!-- question:start:overriding-services-and-configuration-for-tests-beginner-q04 -->
<!-- question-id:overriding-services-and-configuration-for-tests-beginner-q04 -->
<!-- question-level:beginner -->
#### What is the difference between a unit test and an integration test in this context?

##### Expected Answer

A unit test usually tests one class or method in isolation and passes fake dependencies directly to the constructor.

An integration test starts more of the real application and verifies that multiple components work together. In ASP.NET Core, an integration test may send an HTTP request through routing, middleware, filters, dependency injection, model binding, validation, and serialization.

Service and configuration overrides are especially important in integration tests because the app is closer to production but still needs safe test-specific dependencies.

##### Key Points to Mention

- Unit tests isolate one component
- Integration tests verify multiple components together
- Integration tests often use `WebApplicationFactory`
- Overrides keep integration tests safe and controlled
- Integration tests catch wiring and configuration problems

<!-- question:end:overriding-services-and-configuration-for-tests-beginner-q04 -->

<!-- question:start:overriding-services-and-configuration-for-tests-beginner-q05 -->
<!-- question-id:overriding-services-and-configuration-for-tests-beginner-q05 -->
<!-- question-level:beginner -->
#### How do you replace a service in an ASP.NET Core integration test?

##### Expected Answer

A common way is to use `ConfigureTestServices` in a custom `WebApplicationFactory` or inside `WithWebHostBuilder`.

The test should remove the existing production registration and add the fake implementation.

```csharp
builder.ConfigureTestServices(services =>
{
    services.RemoveAll<IEmailSender>();
    services.AddSingleton<IEmailSender, FakeEmailSender>();
});
```

Removing the old registration avoids ambiguity and ensures the application resolves the fake service during the test.

##### Key Points to Mention

- Use `ConfigureTestServices`
- Remove existing registration first
- Add fake or test-specific implementation
- Match service lifetime when appropriate
- Can be centralized in a custom test factory

<!-- question:end:overriding-services-and-configuration-for-tests-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

<!-- question:start:overriding-services-and-configuration-for-tests-intermediate-q01 -->
<!-- question-id:overriding-services-and-configuration-for-tests-intermediate-q01 -->
<!-- question-level:intermediate -->
#### What is the difference between `ConfigureServices` and `ConfigureTestServices`?

##### Expected Answer

`ConfigureServices` is a general host configuration hook that can add or modify services during application startup.

`ConfigureTestServices` is designed for tests and is usually applied after the application has registered its normal services. This makes it convenient for replacing production services with fake services.

In integration tests, `ConfigureTestServices` is often preferred because the application starts normally first, then the test changes only the dependencies it needs to control.

##### Key Points to Mention

- `ConfigureServices` is general host configuration
- `ConfigureTestServices` is test-specific
- Test service overrides are applied after normal registrations
- Useful for replacing production dependencies
- Registration order matters

<!-- question:end:overriding-services-and-configuration-for-tests-intermediate-q01 -->

<!-- question:start:overriding-services-and-configuration-for-tests-intermediate-q02 -->
<!-- question-id:overriding-services-and-configuration-for-tests-intermediate-q02 -->
<!-- question-level:intermediate -->
#### Why should you remove an existing service registration before adding a test replacement?

##### Expected Answer

If the original service registration remains, the application may still resolve the production service in some cases.

When resolving a single service, the built-in DI container usually returns the last registration. However, when resolving `IEnumerable<T>`, all registrations are returned. Some frameworks and libraries also register related service descriptors that may still affect behavior.

Removing the old registration makes the test setup explicit and avoids ambiguity.

```csharp
services.RemoveAll<IPaymentGateway>();
services.AddScoped<IPaymentGateway, FakePaymentGateway>();
```

##### Key Points to Mention

- Avoids duplicate registrations
- Prevents accidental production dependency usage
- Important when `IEnumerable<T>` is resolved
- Makes test setup easier to reason about
- Useful for external integrations and infrastructure services

<!-- question:end:overriding-services-and-configuration-for-tests-intermediate-q02 -->

<!-- question:start:overriding-services-and-configuration-for-tests-intermediate-q03 -->
<!-- question-id:overriding-services-and-configuration-for-tests-intermediate-q03 -->
<!-- question-level:intermediate -->
#### How can you override configuration values in an integration test?

##### Expected Answer

Use `ConfigureAppConfiguration` and add an in-memory configuration provider with test-specific values.

```csharp
builder.ConfigureAppConfiguration((context, config) =>
{
    config.AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["Features:EnablePayments"] = "false",
        ["Payment:TimeoutSeconds"] = "1"
    });
});
```

This is better than changing process-wide environment variables because it is scoped to the test host and avoids cross-test pollution.

The test can also set a dedicated environment with `builder.UseEnvironment("Testing")`.

##### Key Points to Mention

- Use `ConfigureAppConfiguration`
- Add in-memory configuration values
- Later configuration providers override earlier values
- Avoid process-wide environment variables when possible
- Use `Testing` environment for clarity

<!-- question:end:overriding-services-and-configuration-for-tests-intermediate-q03 -->

<!-- question:start:overriding-services-and-configuration-for-tests-intermediate-q04 -->
<!-- question-id:overriding-services-and-configuration-for-tests-intermediate-q04 -->
<!-- question-level:intermediate -->
#### How should tests override strongly typed options?

##### Expected Answer

For integration tests, prefer overriding the underlying configuration values so the application still uses the real options binding and validation pipeline.

```csharp
builder.ConfigureAppConfiguration((context, config) =>
{
    config.AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["Payment:BaseUrl"] = "https://localhost/fake-payment",
        ["Payment:TimeoutSeconds"] = "1"
    });
});
```

For unit tests, it is fine to create options directly with `Options.Create`.

```csharp
var options = Options.Create(new PaymentOptions
{
    BaseUrl = "https://localhost/fake-payment",
    TimeoutSeconds = 1
});
```

The difference is that integration tests should verify startup wiring, binding, and validation when those are important production behaviors.

##### Key Points to Mention

- Override configuration for integration tests
- Use `Options.Create` for direct unit tests
- Keep real binding and validation when testing app startup
- Understand `IOptions`, `IOptionsSnapshot`, and `IOptionsMonitor`
- Avoid bypassing production validation accidentally

<!-- question:end:overriding-services-and-configuration-for-tests-intermediate-q04 -->

<!-- question:start:overriding-services-and-configuration-for-tests-intermediate-q05 -->
<!-- question-id:overriding-services-and-configuration-for-tests-intermediate-q05 -->
<!-- question-level:intermediate -->
#### How do you replace a production database in integration tests?

##### Expected Answer

A common approach is to remove the production `DbContext` registration and add a test database provider.

For relational behavior, SQLite in-memory is often better than EF Core InMemory because it catches more relational database issues.

```csharp
builder.ConfigureTestServices(services =>
{
    services.RemoveAll<DbContextOptions<AppDbContext>>();

    services.AddDbContext<AppDbContext>(options =>
    {
        options.UseSqlite("DataSource=:memory:");
    });
});
```

For SQLite in-memory, the connection must usually remain open for the database to stay alive. For the highest realism, teams may use a containerized instance of the same database engine used in production.

##### Key Points to Mention

- Remove production `DbContext` configuration
- Use SQLite, test containers, or isolated test database
- EF Core InMemory has behavioral differences
- Seed test data explicitly
- Keep tests isolated from each other

<!-- question:end:overriding-services-and-configuration-for-tests-intermediate-q05 -->

<!-- question:start:overriding-services-and-configuration-for-tests-intermediate-q06 -->
<!-- question-id:overriding-services-and-configuration-for-tests-intermediate-q06 -->
<!-- question-level:intermediate -->
#### How can you test protected endpoints without using a real identity provider?

##### Expected Answer

Use a fake authentication handler that creates a test `ClaimsPrincipal`. This allows the request to go through the real authorization middleware and policies without requiring a real token issuer or login flow.

The fake handler should provide realistic claims such as user ID, name, roles, or policy-specific claims.

This approach is better than disabling authorization globally because it still tests role and policy behavior.

##### Key Points to Mention

- Register a fake authentication scheme
- Create test claims and roles
- Keep real authorization policies enabled
- Avoid calling real identity provider in normal integration tests
- Test allowed and forbidden scenarios

<!-- question:end:overriding-services-and-configuration-for-tests-intermediate-q06 -->

<!-- question:start:overriding-services-and-configuration-for-tests-intermediate-q07 -->
<!-- question-id:overriding-services-and-configuration-for-tests-intermediate-q07 -->
<!-- question-level:intermediate -->
#### What is `WithWebHostBuilder` used for?

##### Expected Answer

`WithWebHostBuilder` creates a modified test host from an existing `WebApplicationFactory`. It is useful for per-test overrides.

For example, one test may need a successful payment gateway fake, while another test needs a failing payment gateway fake.

```csharp
var client = factory.WithWebHostBuilder(builder =>
{
    builder.ConfigureTestServices(services =>
    {
        services.RemoveAll<IPaymentGateway>();
        services.AddScoped<IPaymentGateway, FailingPaymentGateway>();
    });
})
.CreateClient();
```

This avoids changing the shared factory for every test.

##### Key Points to Mention

- Used for per-test customization
- Keeps overrides scoped to one test
- Useful for testing failure paths
- Builds on an existing factory
- Helps reduce shared mutable setup

<!-- question:end:overriding-services-and-configuration-for-tests-intermediate-q07 -->

<!-- question:start:overriding-services-and-configuration-for-tests-intermediate-q08 -->
<!-- question-id:overriding-services-and-configuration-for-tests-intermediate-q08 -->
<!-- question-level:intermediate -->
#### Why can process-wide environment variables be risky in automated tests?

##### Expected Answer

Environment variables are process-wide. If multiple tests run in parallel, one test can affect another test by changing a value that both tests read.

This can cause flaky behavior where tests pass individually but fail when run as a suite.

For test-specific configuration, an in-memory configuration provider is usually safer because it is scoped to the test host.

##### Key Points to Mention

- Environment variables affect the whole process
- Parallel tests can interfere with each other
- Can cause flaky tests
- Prefer `AddInMemoryCollection` for scoped overrides
- Use environment variables only when the test explicitly needs them

<!-- question:end:overriding-services-and-configuration-for-tests-intermediate-q08 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

<!-- question:start:overriding-services-and-configuration-for-tests-advanced-q01 -->
<!-- question-id:overriding-services-and-configuration-for-tests-advanced-q01 -->
<!-- question-level:advanced -->
#### When can mocking or overriding services hide real integration problems?

##### Expected Answer

Mocking or overriding services can hide problems when the replaced dependency is part of the behavior the test should verify.

For example, replacing the database with a fake repository may hide EF Core query translation errors, transaction problems, database constraints, and migration issues. Replacing an HTTP client interface may hide serialization bugs, incorrect URLs, missing headers, timeout behavior, and status-code handling. Disabling authorization may hide policy misconfiguration.

The solution is to choose the right test boundary. Unit tests can use mocks heavily. Integration tests should keep important framework and infrastructure behavior real where confidence matters.

##### Key Points to Mention

- Too many fakes reduce integration-test value
- Fake repositories hide EF Core/database behavior
- Fake HTTP clients can hide contract and serialization bugs
- Disabling authorization hides policy bugs
- Choose test boundary intentionally

<!-- question:end:overriding-services-and-configuration-for-tests-advanced-q01 -->

<!-- question:start:overriding-services-and-configuration-for-tests-advanced-q02 -->
<!-- question-id:overriding-services-and-configuration-for-tests-advanced-q02 -->
<!-- question-level:advanced -->
#### How would you design a reliable integration test setup for an ASP.NET Core API with EF Core, authentication, and external services?

##### Expected Answer

A reliable setup would use `WebApplicationFactory<Program>` with a custom factory.

The factory would:

- set the environment to `Testing`
- override dangerous configuration values
- replace external services such as email, payments, and SMS with fakes
- use a test database provider such as SQLite, a containerized SQL Server, or an isolated test database
- seed required test data
- register fake authentication with realistic claims
- keep real routing, middleware, filters, validation, serialization, and authorization policies
- reset state between tests

This provides high confidence while avoiding real side effects.

##### Key Points to Mention

- Custom `WebApplicationFactory`
- Test-specific configuration
- Real app pipeline
- Safe fakes for external side effects
- Realistic database strategy
- Fake auth but real authorization policies
- Test isolation and cleanup

<!-- question:end:overriding-services-and-configuration-for-tests-advanced-q02 -->

<!-- question:start:overriding-services-and-configuration-for-tests-advanced-q03 -->
<!-- question-id:overriding-services-and-configuration-for-tests-advanced-q03 -->
<!-- question-level:advanced -->
#### What are the trade-offs between EF Core InMemory, SQLite in-memory, and a real test database?

##### Expected Answer

EF Core InMemory is fast and simple, but it is not relational. It may not catch SQL translation problems, relational constraints, transaction behavior, case sensitivity differences, or provider-specific behavior.

SQLite in-memory is closer to a relational database and can catch more issues, but it still differs from SQL Server or PostgreSQL in SQL dialect, data types, functions, and provider-specific behavior.

A real test database or containerized database gives the highest confidence because it matches production behavior more closely. However, it is slower, requires more setup, and needs careful isolation and cleanup.

The best choice depends on what the test is trying to prove.

##### Key Points to Mention

- InMemory is fastest but least realistic
- SQLite catches more relational behavior
- Real test database gives highest confidence
- Provider differences matter
- Match database choice to test purpose

<!-- question:end:overriding-services-and-configuration-for-tests-advanced-q03 -->

<!-- question:start:overriding-services-and-configuration-for-tests-advanced-q04 -->
<!-- question-id:overriding-services-and-configuration-for-tests-advanced-q04 -->
<!-- question-level:advanced -->
#### How do service lifetimes affect test overrides?

##### Expected Answer

Service lifetime controls how long a dependency instance lives. A test replacement should usually match the production lifetime unless the test has a specific reason to change it.

A singleton fake can be useful because the test can inspect it after a request. However, singleton mutable state can leak between tests. A scoped fake is created per request, which may be more realistic but harder to inspect after the request. A transient fake creates a new instance every time and may not preserve state.

Wrong lifetimes can also cause runtime errors. For example, a singleton service should not depend on a scoped `DbContext`.

##### Key Points to Mention

- Match production lifetime when possible
- Singleton fakes can leak state
- Scoped services are per request
- Transient services are recreated frequently
- Avoid singleton depending on scoped services
- Reset fake state between tests

<!-- question:end:overriding-services-and-configuration-for-tests-advanced-q04 -->

<!-- question:start:overriding-services-and-configuration-for-tests-advanced-q05 -->
<!-- question-id:overriding-services-and-configuration-for-tests-advanced-q05 -->
<!-- question-level:advanced -->
#### How would you prevent tests from accidentally using production resources?

##### Expected Answer

Use multiple safeguards.

Set a dedicated `Testing` environment. Override connection strings and external API settings in the test factory. Replace dangerous services such as payments, email, and SMS with fakes. Add startup guards that fail if a production-looking connection string is used in a test. Keep test secrets separate from production secrets. Avoid process-wide environment variables when possible. Run destructive tests only against isolated databases or containers.

In CI/CD, test configuration should be explicit and should not rely on developer machine settings.

##### Key Points to Mention

- Dedicated `Testing` environment
- Explicit test configuration overrides
- Fake external side-effect systems
- Guard against production connection strings
- Separate test secrets
- Isolated test databases
- CI configuration should be explicit

<!-- question:end:overriding-services-and-configuration-for-tests-advanced-q05 -->

<!-- question:start:overriding-services-and-configuration-for-tests-advanced-q06 -->
<!-- question-id:overriding-services-and-configuration-for-tests-advanced-q06 -->
<!-- question-level:advanced -->
#### How should background services be handled in integration tests?

##### Expected Answer

Background services can make tests nondeterministic because they start with the application host and may modify data, consume messages, or call external services while the test is running.

A common approach is to remove or replace specific hosted services during tests.

```csharp
var descriptor = services.SingleOrDefault(d =>
    d.ImplementationType == typeof(OrderOutboxWorker));

if (descriptor is not null)
{
    services.Remove(descriptor);
}
```

Another approach is to make the background service depend on a small injectable component, unit test that component directly, and only run full hosted-service integration tests when necessary.

##### Key Points to Mention

- Background services can create nondeterministic side effects
- Remove or replace them when not part of the test
- Prefer removing specific hosted services over all hosted services
- Unit test worker logic separately
- Integration test hosted-service wiring only when needed

<!-- question:end:overriding-services-and-configuration-for-tests-advanced-q06 -->

<!-- question:start:overriding-services-and-configuration-for-tests-advanced-q07 -->
<!-- question-id:overriding-services-and-configuration-for-tests-advanced-q07 -->
<!-- question-level:advanced -->
#### How do you keep integration tests isolated when using shared fakes or a shared test host?

##### Expected Answer

Test isolation requires controlling shared state.

Options include creating a new factory per test, using unique database names, resetting the database before each test, wrapping test data changes in transactions, clearing fake state, avoiding static mutable state, and disabling parallel execution only when necessary.

If a fake service stores messages or calls in memory, it should expose a clear reset mechanism or be scoped to a single test host.

A shared test host is efficient but increases the risk of state leakage.

##### Key Points to Mention

- Shared state causes flaky tests
- Use unique databases or reset state
- Clear fake state between tests
- Avoid mutable static state
- Be careful with parallel test execution
- Balance performance and isolation

<!-- question:end:overriding-services-and-configuration-for-tests-advanced-q07 -->

<!-- question:start:overriding-services-and-configuration-for-tests-advanced-q08 -->
<!-- question-id:overriding-services-and-configuration-for-tests-advanced-q08 -->
<!-- question-level:advanced -->
#### Should integration tests disable authorization?

##### Expected Answer

Usually no. Disabling authorization can make tests pass even when policies, roles, claims, or middleware ordering are broken.

A better approach is to use fake authentication and keep real authorization policies enabled. The fake authentication handler creates users with specific claims and roles. Tests can then verify successful access, forbidden access, and unauthenticated behavior.

There may be a few tests where authorization is irrelevant and disabling it is acceptable, but for API endpoint tests, keeping authorization behavior real gives much better confidence.

##### Key Points to Mention

- Disabling authorization hides security bugs
- Fake authentication is usually better
- Keep real authorization policies
- Test allowed, forbidden, and unauthenticated scenarios
- Use realistic claims and roles

<!-- question:end:overriding-services-and-configuration-for-tests-advanced-q08 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
