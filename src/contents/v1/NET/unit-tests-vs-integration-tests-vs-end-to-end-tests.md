---
id: unit-tests-vs-integration-tests-vs-end-to-end-tests
topic: Testing strategy and integration testing
subtopic: Unit Tests vs Integration Tests vs End-to-End Tests
category: .NET
---



## Overview

Unit tests, integration tests, and end-to-end tests are three important categories of automated tests. They all help verify software quality, but they operate at different levels of the system and answer different questions.

A **unit test** verifies a small piece of code in isolation, such as a method, class, validator, domain service, or command handler. Unit tests should be fast, deterministic, and focused on business logic or edge cases.

An **integration test** verifies that multiple components work together correctly. In a .NET application, this might mean testing an ASP.NET Core API through `WebApplicationFactory`, testing EF Core against a real or test database, testing middleware, dependency injection, configuration, authentication, or the request-response pipeline.

An **end-to-end test** verifies a complete user or business flow through the system from the outside. For a web app, this often means using a browser automation tool such as Playwright to simulate a real user clicking buttons, filling forms, navigating pages, and verifying visible behavior.

This topic matters because a strong test strategy balances confidence, speed, maintainability, and cost. Unit tests are fast and precise but cannot prove the full system works. Integration tests catch wiring and infrastructure problems but are slower and more complex. End-to-end tests provide high business confidence but are the slowest, most expensive, and most fragile.

In real full-stack .NET applications, all three test types are useful:

- Unit tests for domain logic, validation, mapping, calculations, and handler behavior.
- Integration tests for API endpoints, EF Core persistence, dependency injection, middleware, authentication, authorization, background jobs, and external service boundaries.
- End-to-end tests for critical user journeys such as login, checkout, payment, document upload, reporting, approval workflows, and account management.

This topic is important for interviews because it tests practical engineering judgment. Interviewers often ask:

- What is the difference between unit, integration, and end-to-end tests?
- What should be mocked and what should be real?
- Why should most test suites not rely only on E2E tests?
- How do you test an ASP.NET Core API?
- How do you test EF Core code?
- When should you use `WebApplicationFactory`?
- When should you use Testcontainers or a real database?
- How do you keep tests fast and reliable?
- How do you avoid flaky tests?
- How do tests fit into CI/CD?
- What belongs in each layer of the testing pyramid?

A strong answer should explain that the purpose is not to choose one test type. The goal is to use the right level of test for the risk being tested.

## Core Concepts

### The Main Difference

The simplest comparison is:

| Test Type | Main Question | Scope | Speed | Confidence | Typical Tools |
|---|---|---|---|---|---|
| Unit test | Does this small piece of logic work? | One method/class/component | Fastest | Low to medium | xUnit, NUnit, MSTest, Moq, NSubstitute |
| Integration test | Do these components work together? | Multiple components or infrastructure boundary | Medium | Medium to high | xUnit, WebApplicationFactory, TestServer, EF Core, Testcontainers |
| End-to-end test | Does the full user/business flow work? | Whole system from outside | Slowest | Highest for user flow | Playwright, Selenium, Cypress, browser automation |

The trade-off is important:

- The lower the test level, the faster and more precise the test usually is.
- The higher the test level, the more realistic and business-facing the test usually is.
- Higher-level tests are usually slower, more brittle, harder to debug, and more expensive to maintain.

A healthy test strategy normally uses all three, but not in equal amounts.

### Unit Tests

A unit test verifies a small unit of behavior in isolation.

Examples of good unit test targets:

- Domain entity methods.
- Value objects.
- Validators.
- Calculation logic.
- Mapping logic.
- Pure functions.
- Command/query handlers with mocked dependencies.
- Authorization requirement handlers.
- Business rules.
- Error handling branches.
- Edge cases.

Example domain class:

```csharp
public sealed class Order
{
    private readonly List<OrderLine> _lines = new();

    public IReadOnlyCollection<OrderLine> Lines => _lines;
    public decimal Total => _lines.Sum(line => line.Quantity * line.UnitPrice);

    public void AddLine(string productName, int quantity, decimal unitPrice)
    {
        if (string.IsNullOrWhiteSpace(productName))
        {
            throw new ArgumentException("Product name is required.", nameof(productName));
        }

        if (quantity <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(quantity));
        }

        if (unitPrice < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(unitPrice));
        }

        _lines.Add(new OrderLine(productName, quantity, unitPrice));
    }
}

public sealed record OrderLine(string ProductName, int Quantity, decimal UnitPrice);
```

Unit test:

```csharp
using Xunit;

public sealed class OrderTests
{
    [Fact]
    public void AddLine_WhenLineIsValid_AddsLineAndUpdatesTotal()
    {
        // Arrange
        var order = new Order();

        // Act
        order.AddLine("Keyboard", 2, 50m);

        // Assert
        Assert.Single(order.Lines);
        Assert.Equal(100m, order.Total);
    }

    [Fact]
    public void AddLine_WhenQuantityIsZero_ThrowsException()
    {
        // Arrange
        var order = new Order();

        // Act
        var act = () => order.AddLine("Keyboard", 0, 50m);

        // Assert
        Assert.Throws<ArgumentOutOfRangeException>(act);
    }
}
```

This is a good unit test because it:

- Does not require a database.
- Does not require HTTP.
- Does not require dependency injection.
- Does not require configuration.
- Runs quickly.
- Tests one specific behavior.
- Gives clear failure feedback.

### What Unit Tests Should Usually Avoid

Unit tests should usually avoid real infrastructure.

Avoid in unit tests:

- Real database calls.
- Real HTTP calls.
- Real file system access.
- Real message queues.
- Real cloud services.
- Real email sending.
- Real browser automation.
- Large app startup.
- Complex environment configuration.

If a test needs the real ASP.NET Core pipeline, EF Core provider behavior, or real infrastructure behavior, it is probably an integration test.

### Test Doubles

A test double is a replacement for a real dependency.

Common types:

| Test Double | Purpose |
|---|---|
| Dummy | Passed only because a parameter is required |
| Stub | Returns predefined data |
| Fake | Working simplified implementation, such as an in-memory repository |
| Mock | Verifies interactions, such as whether a method was called |
| Spy | Records information for later assertions |

Example with a mock dependency:

```csharp
public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken);
}

public sealed class RegisterUserHandler
{
    private readonly IEmailSender _emailSender;

    public RegisterUserHandler(IEmailSender emailSender)
    {
        _emailSender = emailSender;
    }

    public async Task HandleAsync(RegisterUserCommand command, CancellationToken cancellationToken)
    {
        // User creation logic omitted for brevity.

        await _emailSender.SendAsync(
            command.Email,
            "Welcome",
            "Thanks for registering.",
            cancellationToken);
    }
}

public sealed record RegisterUserCommand(string Email);
```

Unit test with Moq:

```csharp
using Moq;
using Xunit;

public sealed class RegisterUserHandlerTests
{
    [Fact]
    public async Task HandleAsync_WhenUserIsRegistered_SendsWelcomeEmail()
    {
        // Arrange
        var emailSender = new Mock<IEmailSender>();
        var handler = new RegisterUserHandler(emailSender.Object);

        var command = new RegisterUserCommand("user@example.com");

        // Act
        await handler.HandleAsync(command, CancellationToken.None);

        // Assert
        emailSender.Verify(sender => sender.SendAsync(
            "user@example.com",
            "Welcome",
            It.IsAny<string>(),
            CancellationToken.None), Times.Once);
    }
}
```

Mocking is useful, but over-mocking can make tests brittle. Prefer testing observable behavior rather than internal implementation details.

### Unit Test Strengths

Unit tests are valuable because they are:

- Fast.
- Deterministic.
- Easy to run locally.
- Good for edge cases.
- Good for business rules.
- Good for regression protection.
- Good for guiding design.
- Easy to debug when focused.
- Cheap to run in CI.

Unit tests are especially useful for complicated logic with many input combinations.

Example:

```csharp
[Theory]
[InlineData(100, 0, 100)]
[InlineData(100, 10, 90)]
[InlineData(200, 25, 150)]
public void ApplyDiscount_ReturnsExpectedTotal(
    decimal amount,
    decimal discountPercent,
    decimal expected)
{
    var result = DiscountCalculator.ApplyDiscount(amount, discountPercent);

    Assert.Equal(expected, result);
}
```

This kind of logic is much better tested with unit tests than with slow end-to-end tests.

### Unit Test Limitations

Unit tests cannot prove that the whole application works.

They may miss:

- Dependency injection misconfiguration.
- Wrong database mappings.
- Missing migrations.
- SQL translation problems.
- Wrong authentication configuration.
- Middleware ordering bugs.
- Serialization issues.
- Routing issues.
- CORS issues.
- External service contract problems.
- Environment configuration issues.
- Frontend-backend integration problems.

A unit test can prove that a handler behaves correctly with a mocked repository. It cannot prove that the real repository queries the database correctly.

### Integration Tests

An integration test verifies that multiple parts of the application work together.

Examples:

- API endpoint plus routing plus model binding plus validation.
- Controller plus dependency injection plus middleware.
- EF Core repository plus real database provider.
- Authentication handler plus authorization policy.
- Message consumer plus database update.
- File upload endpoint plus storage abstraction.
- Application service plus real database transaction.
- Configuration binding plus options validation.

Integration test scope can vary. It does not always mean the whole system. It means the test crosses a boundary between components.

### ASP.NET Core Integration Tests with `WebApplicationFactory`

ASP.NET Core integration tests often use `WebApplicationFactory<TEntryPoint>`.

Example minimal setup:

```csharp
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;
using Xunit;

public sealed class CustomersApiTests
    : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public CustomersApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetCustomers_ReturnsSuccess()
    {
        // Act
        var response = await _client.GetAsync("/api/customers");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
```

For top-level statements in `Program.cs`, the web app may expose a partial `Program` class:

```csharp
public partial class Program
{
}
```

This lets the test project reference `Program` as the entry point.

### Customizing `WebApplicationFactory`

A real integration test often replaces production services with test services.

Example: replace SQL Server with SQLite for integration tests.

```csharp
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

public sealed class CustomWebApplicationFactory
    : WebApplicationFactory<Program>
{
    private SqliteConnection? _connection;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();

            _connection = new SqliteConnection("Data Source=:memory:");
            _connection.Open();

            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseSqlite(_connection);
            });

            using var scope = services.BuildServiceProvider().CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            context.Database.EnsureCreated();
            SeedTestData(context);
        });
    }

    private static void SeedTestData(AppDbContext context)
    {
        context.Customers.Add(new Customer
        {
            Name = "Test Customer"
        });

        context.SaveChanges();
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        _connection?.Dispose();
    }
}
```

Test:

```csharp
public sealed class CustomersApiTests
    : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public CustomersApiTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetCustomers_WhenDataExists_ReturnsCustomerList()
    {
        var response = await _client.GetAsync("/api/customers");

        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();

        Assert.Contains("Test Customer", json);
    }
}
```

This test checks more than a unit test. It verifies HTTP routing, middleware, dependency injection, EF Core, serialization, and endpoint behavior.

### Integration Testing EF Core

EF Core code should often be integration-tested against a real relational provider or a provider close to production.

Why:

- LINQ translation depends on the provider.
- SQL behavior differs by provider.
- Null handling can differ.
- Transactions can differ.
- Constraints can differ.
- Case sensitivity can differ.
- Migrations are relational behavior.
- EF Core InMemory provider does not behave like a relational database.

Example repository integration test:

```csharp
public sealed class CustomerRepositoryTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private AppDbContext _context = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;

        _context = new AppDbContext(options);
        await _context.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await _context.DisposeAsync();
        await _connection.DisposeAsync();
    }

    [Fact]
    public async Task AddAsync_WhenCustomerIsValid_SavesCustomer()
    {
        var customer = new Customer
        {
            Name = "Contoso"
        };

        _context.Customers.Add(customer);
        await _context.SaveChangesAsync();

        var saved = await _context.Customers
            .SingleAsync(c => c.Name == "Contoso");

        Assert.Equal("Contoso", saved.Name);
    }
}
```

For more production-like tests, use the same database engine as production, often through Docker/Testcontainers.

### Integration Tests with Testcontainers

Testcontainers can start real infrastructure in Docker for tests.

Example concept:

```csharp
public sealed class SqlServerIntegrationTests : IAsyncLifetime
{
    private readonly MsSqlContainer _sqlServer = new MsSqlBuilder()
        .WithPassword("yourStrong(!)Password")
        .Build();

    public async Task InitializeAsync()
    {
        await _sqlServer.StartAsync();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(_sqlServer.GetConnectionString())
            .Options;

        await using var context = new AppDbContext(options);
        await context.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        await _sqlServer.DisposeAsync();
    }
}
```

This is slower than a pure unit test but catches real database behavior, provider differences, migrations, constraints, and SQL translation issues.

### Integration Test Strengths

Integration tests are valuable because they catch problems that unit tests miss:

- Dependency injection misconfiguration.
- Incorrect EF Core mapping.
- Missing services.
- Middleware ordering bugs.
- Routing problems.
- Model binding problems.
- Serialization problems.
- Authentication and authorization misconfiguration.
- Database constraint problems.
- Query translation issues.
- Transaction behavior.
- Configuration binding issues.
- External service contract problems.

Integration tests provide higher confidence than unit tests for infrastructure-heavy code.

### Integration Test Limitations

Integration tests are slower and more expensive than unit tests.

They can be harder to maintain because they may require:

- Test databases.
- Test data setup.
- Environment variables.
- Docker containers.
- Authentication setup.
- Service replacement.
- Cleanup between tests.
- More complex fixtures.
- More CI time.

Integration tests should be focused. Do not test every small business-rule permutation through integration tests when a unit test would be faster and clearer.

### End-to-End Tests

An end-to-end test verifies a complete flow through the system from the user's or external client's perspective.

Examples:

- User logs in, creates an order, checks out, and sees confirmation.
- Admin creates a user, assigns a role, and the user can access a protected page.
- Customer uploads a file, backend processes it, and result appears in the UI.
- User submits a form, receives validation feedback, and saved data appears after refresh.
- Payment flow completes through frontend, backend, payment provider sandbox, and database.

For a web application, an E2E test often uses browser automation.

Example Playwright test:

```typescript
import { test, expect } from '@playwright/test';

test('user can create a customer', async ({ page }) => {
  await page.goto('/customers');

  await page.getByRole('button', { name: 'New Customer' }).click();
  await page.getByLabel('Name').fill('Contoso');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Customer created successfully')).toBeVisible();
  await expect(page.getByText('Contoso')).toBeVisible();
});
```

This test verifies visible behavior, not implementation details.

### E2E Tests Should Focus on User-Visible Behavior

A good E2E test interacts with the application like a user:

- Clicks buttons.
- Fills form fields.
- Uses labels and roles.
- Verifies visible text.
- Verifies navigation.
- Verifies important outcomes.

Avoid testing implementation details:

```typescript
// Brittle
await page.locator('.css-abc123 > div:nth-child(2)').click();
```

Prefer user-facing locators:

```typescript
await page.getByRole('button', { name: 'Save' }).click();
await page.getByLabel('Email').fill('user@example.com');
```

User-visible tests are usually more resilient to refactoring.

### E2E Test Strengths

E2E tests are valuable because they catch issues across the whole stack:

- Frontend routing issues.
- Broken API calls.
- Authentication flow problems.
- Browser-specific behavior.
- Real validation behavior.
- Incorrect UI state after API responses.
- Deployment configuration problems.
- Environment issues.
- CORS problems.
- Broken JavaScript bundles.
- Integration between frontend and backend.
- Critical business flow regressions.

They provide strong confidence for important user journeys.

### E2E Test Limitations

E2E tests are expensive.

They are often:

- Slower than unit and integration tests.
- More brittle.
- Harder to debug.
- More dependent on environment stability.
- More sensitive to data setup.
- More likely to fail because of timing or infrastructure issues.
- Harder to run on every local change.
- More expensive in CI.

Use E2E tests for critical flows, not every business rule permutation.

### The Testing Pyramid

The testing pyramid is a common way to think about test distribution.

A typical test strategy has:

```text
        End-to-End Tests
       /                \
      /  Integration     \
     /      Tests         \
    /                      \
   /       Unit Tests       \
  /__________________________\
```

The general idea:

- Many unit tests.
- A smaller number of integration tests.
- A smaller number of E2E tests.

This is not a strict mathematical rule. Some CRUD-heavy applications may need many integration tests. Some domain-heavy applications may benefit from many unit tests. The key principle is to test behavior at the lowest level that gives enough confidence.

Do not test a simple pure function through a browser if a unit test can verify it faster and more precisely.

Do not mock EF Core behavior if the real risk is SQL translation or database constraints.

### Test Trophy and Practical Balance

Some modern teams use a "test trophy" idea instead of a strict pyramid, especially frontend-heavy applications. It emphasizes many integration/component tests because they provide better confidence than shallow unit tests while still being cheaper than full E2E tests.

For full-stack .NET applications, a practical balance is often:

- Unit tests for business rules and edge cases.
- Integration tests for API and persistence behavior.
- E2E tests for a small number of critical user journeys.

The exact mix depends on architecture:

| Application Type | Likely Test Emphasis |
|---|---|
| Domain-heavy system | More unit tests around domain rules |
| CRUD-heavy API | More integration tests around API/database behavior |
| Frontend-heavy SPA | More component and E2E tests around user behavior |
| Microservices | Contract and integration tests around service boundaries |
| Legacy system | More characterization and higher-level regression tests first |

### Test Scope and Test Speed

A useful way to classify tests is by size:

| Size | Similar Category | Characteristics |
|---|---|---|
| Small | Unit test | In-process, no network, no database, very fast |
| Medium | Integration test | Crosses process/component boundary or uses test infrastructure |
| Large | E2E/system test | Uses real app, browser, network, deployed environment, or multiple services |

Smaller tests are easier to run frequently. Larger tests provide more realistic coverage but should be fewer and more carefully selected.

### What to Mock

Mocking should be based on the test type and risk.

In unit tests, mock dependencies that are not the focus:

- Email sender.
- Clock/time provider.
- External API client.
- File storage.
- Message bus.
- Repository interface.
- Current user provider.

In integration tests, use more real components:

- Real DI container.
- Real middleware.
- Real EF Core provider.
- Real validation pipeline.
- Real authorization policies.
- Test database.

In E2E tests, avoid mocking core application behavior unless using a controlled fake for unstable third-party systems.

Example:

- Unit test checkout calculation: mock payment gateway.
- Integration test payment service boundary: use fake payment provider or sandbox.
- E2E test checkout flow: use payment provider sandbox or stable test double configured at environment level.

### Testing External Services

External services make tests harder because they add network dependency, cost, rate limits, credentials, and instability.

Strategies:

| Strategy | Use Case |
|---|---|
| Mock | Unit tests of logic using the service |
| Fake server | Integration tests of HTTP client behavior |
| Sandbox | E2E test of real provider flow |
| Contract test | Verify request/response compatibility |
| Recorded response | Stable tests where live service is too expensive |

Example HTTP client unit test with fake message handler:

```csharp
public sealed class FakeHttpMessageHandler : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var response = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{ \"status\": \"ok\" }")
        };

        return Task.FromResult(response);
    }
}
```

Use real external systems sparingly and usually outside the fast pull-request test suite.

### Test Data Management

Good tests require reliable data setup.

Common approaches:

- Arrange data inside each test.
- Use builders or object mothers.
- Use database transactions and rollback.
- Recreate database per test class.
- Use unique test data per test.
- Use Testcontainers per test suite.
- Use API calls to set up E2E state.
- Use seeded baseline data.

Example test data builder:

```csharp
public sealed class CustomerBuilder
{
    private string _name = "Default Customer";

    public CustomerBuilder WithName(string name)
    {
        _name = name;
        return this;
    }

    public Customer Build()
    {
        return new Customer
        {
            Name = _name
        };
    }
}
```

Usage:

```csharp
var customer = new CustomerBuilder()
    .WithName("Contoso")
    .Build();
```

Tests should not depend on other tests leaving data behind.

### Test Isolation

Test isolation means each test should be able to run independently.

A good test should:

- Run alone.
- Run with other tests.
- Run in any order.
- Run repeatedly.
- Not depend on shared mutable state.
- Clean up after itself or use isolated data.
- Not require another test to run first.

Bad E2E pattern:

```text
Test 1 creates customer
Test 2 edits customer created by Test 1
Test 3 deletes customer edited by Test 2
```

Better pattern:

```text
Each test creates or obtains its own customer data.
Each test can run independently.
```

Test dependency causes cascading failures and makes parallel execution difficult.

### Flaky Tests

A flaky test sometimes passes and sometimes fails without a code change.

Common causes:

- Timing assumptions.
- Race conditions.
- Shared test data.
- Tests depending on execution order.
- Unstable external services.
- Fixed sleeps.
- Environment differences.
- Browser rendering timing.
- Database cleanup issues.
- Parallel tests modifying the same data.

Bad Playwright pattern:

```typescript
await page.waitForTimeout(3000);
await expect(page.getByText('Saved')).toBeVisible();
```

Better:

```typescript
await expect(page.getByText('Saved')).toBeVisible();
```

Modern E2E tools usually have auto-waiting and retrying assertions. Prefer condition-based waits over fixed delays.

### AAA Pattern

AAA means Arrange, Act, Assert.

Example:

```csharp
[Fact]
public void CalculateTotal_WhenOrderHasLines_ReturnsSum()
{
    // Arrange
    var order = new Order();
    order.AddLine("Mouse", 2, 25m);
    order.AddLine("Keyboard", 1, 50m);

    // Act
    var total = order.Total;

    // Assert
    Assert.Equal(100m, total);
}
```

Benefits:

- Clear structure.
- Easy to read.
- Easy to debug.
- Easier to review.
- Helps avoid testing multiple behaviors at once.

### Naming Tests

Good test names describe behavior.

Common pattern:

```text
MethodName_StateUnderTest_ExpectedBehavior
```

Example:

```csharp
[Fact]
public void AddLine_WhenQuantityIsZero_ThrowsException()
{
}
```

Another readable style:

```csharp
[Fact]
public void Cannot_add_order_line_with_zero_quantity()
{
}
```

Choose one convention and keep it consistent.

### Code Coverage

Code coverage measures how much code was executed by tests.

Coverage is useful, but it does not prove correctness.

A test can execute code without meaningful assertions:

```csharp
[Fact]
public void BadTest()
{
    var order = new Order();
    order.AddLine("Mouse", 1, 10m);

    // No meaningful assertion.
}
```

Good coverage strategy:

- Use coverage to find untested areas.
- Focus on meaningful assertions.
- Prioritize critical business logic.
- Do not chase 100% coverage blindly.
- Combine coverage with mutation testing if needed.
- Review high-risk uncovered code.

### CI/CD Test Strategy

A practical CI pipeline often separates tests by speed and cost.

Example:

```text
Pull Request:
- Build
- Unit tests
- Fast integration tests
- Lint/static analysis

Main branch:
- Full integration tests
- Database tests
- Contract tests

Nightly or pre-release:
- Full E2E suite
- Cross-browser tests
- Performance smoke tests
- Security scans
```

Not every test must run at every stage. Fast feedback is important for developers, while deeper confidence can run later or on release branches.

### Choosing the Right Test Type

Use this decision guide:

| Scenario | Best Test Type |
|---|---|
| Pure calculation logic | Unit test |
| Validation rule | Unit test |
| Domain entity behavior | Unit test |
| Command handler with mocked repository | Unit test |
| EF Core mapping/query behavior | Integration test |
| API endpoint routing/model binding/validation | Integration test |
| Middleware behavior | Integration test |
| Authentication and authorization pipeline | Integration test |
| Frontend button calls API and updates UI | E2E or component/integration test |
| Complete checkout flow | E2E test |
| Cross-service workflow | Integration, contract, or E2E depending on scope |
| Browser-specific behavior | E2E test |

Principle:

Test at the lowest level that gives enough confidence.

### Common Mistakes

Common mistakes include:

- Testing everything through E2E tests.
- Mocking everything and missing real integration failures.
- Unit testing implementation details instead of behavior.
- Writing tests with no meaningful assertions.
- Letting tests depend on execution order.
- Sharing mutable test data between tests.
- Using fixed sleeps in E2E tests.
- Using EF Core InMemory provider to test relational behavior.
- Not testing database constraints or migrations.
- Returning false confidence from over-mocked tests.
- Ignoring flaky tests.
- Writing large integration tests for every small business rule.
- Running slow tests on every small local change without separation.
- Not including tests in CI.
- Not cleaning up test data.
- Using production services or production data in tests.
- Treating code coverage as the only quality metric.

### Best Practices

Use unit tests for fast feedback on business logic.

Use integration tests for real component collaboration and infrastructure behavior.

Use E2E tests for critical user journeys, not every edge case.

Prefer meaningful assertions over high coverage numbers.

Keep tests isolated and deterministic.

Avoid test dependencies and shared mutable data.

Use test data builders for readable setup.

Use realistic infrastructure for integration tests when provider behavior matters.

Prefer `WebApplicationFactory` for ASP.NET Core API integration tests.

Use Testcontainers or real test databases when relational database behavior matters.

Avoid EF Core InMemory provider for relational behavior tests.

Use Playwright-style E2E tests for user-visible browser behavior.

Avoid fixed sleeps; use condition-based waits and retrying assertions.

Separate fast and slow test suites in CI.

Run the fastest useful tests on every pull request.

Run broader integration and E2E suites at appropriate pipeline stages.

Treat flaky tests as bugs.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q01 -->
#### Beginner Q01: What is the difference between unit tests, integration tests, and end-to-end tests?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A unit test verifies a small piece of code in isolation, such as a method, class, validator, or domain rule. It is usually fast and uses mocks or fakes for external dependencies.

An integration test verifies that multiple components work together, such as an API endpoint using routing, dependency injection, EF Core, validation, and the database.

An end-to-end test verifies a complete user or business flow from outside the system, often through a browser or deployed API.

The main difference is scope. Unit tests are narrow, integration tests are broader, and E2E tests are closest to real user behavior.

##### Key Points to Mention

- Unit tests test small isolated logic.
- Integration tests test component collaboration.
- E2E tests test complete flows.
- Unit tests are fastest.
- E2E tests are usually slowest.
- Higher-level tests give more realistic confidence but cost more.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q01 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q02 -->
#### Beginner Q02: What should be tested with unit tests?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Unit tests should test small, focused pieces of logic. Good targets include domain methods, validators, value objects, calculations, mapping logic, command handlers, and edge cases.

A unit test should usually avoid real infrastructure such as databases, HTTP calls, file systems, cloud services, and browser automation. Those belong in integration or E2E tests.

##### Key Points to Mention

- Test business logic.
- Test edge cases.
- Test validation rules.
- Test pure calculations.
- Keep tests fast and deterministic.
- Mock dependencies that are not the focus.
- Avoid real infrastructure in unit tests.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q02 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q03 -->
#### Beginner Q03: What should be tested with integration tests?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Integration tests should verify that multiple parts of the application work together. In ASP.NET Core, this can include routing, model binding, validation, dependency injection, middleware, authentication, authorization, EF Core, and the database.

For example, an integration test might call an API endpoint using `HttpClient` from `WebApplicationFactory` and verify the response and database changes.

##### Key Points to Mention

- Tests component collaboration.
- Useful for API endpoints.
- Useful for database behavior.
- Catches DI and configuration issues.
- Catches middleware and routing problems.
- Slower than unit tests.
- Should focus on important infrastructure scenarios.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q03 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q04 -->
#### Beginner Q04: What should be tested with end-to-end tests?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

End-to-end tests should verify critical user or business flows through the full system. For a web application, this often means using a browser automation tool to interact with the UI like a real user.

Examples include login, checkout, file upload, account creation, approval workflow, and payment flow.

E2E tests should focus on high-value flows because they are slower and more expensive to maintain than unit or integration tests.

##### Key Points to Mention

- Tests complete user journeys.
- Usually runs from outside the system.
- Often uses browser automation.
- Good for critical workflows.
- Slower and more fragile than lower-level tests.
- Should verify user-visible behavior.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q04 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q05 -->
#### Beginner Q05: What is the AAA pattern in testing?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

AAA stands for Arrange, Act, Assert.

Arrange means setting up the test data and dependencies. Act means executing the behavior being tested. Assert means verifying the result.

Example:

```csharp
[Fact]
public void AddLine_WhenQuantityIsValid_AddsLine()
{
    // Arrange
    var order = new Order();

    // Act
    order.AddLine("Mouse", 1, 25m);

    // Assert
    Assert.Single(order.Lines);
}
```

The AAA pattern makes tests easier to read and maintain.

##### Key Points to Mention

- Arrange sets up the test.
- Act executes the behavior.
- Assert verifies the result.
- Improves readability.
- Works for unit, integration, and E2E tests.
- Helps keep tests focused.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q05 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q06 -->
#### Beginner Q06: What is a test double?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

A test double is a replacement for a real dependency in a test. Common test doubles include mocks, stubs, fakes, dummies, and spies.

For example, a unit test might replace a real email sender with a mock email sender so the test can verify that an email would be sent without actually sending one.

Test doubles are useful in unit tests, but overusing them can make tests brittle and disconnected from real behavior.

##### Key Points to Mention

- Replaces a real dependency.
- Mock verifies interactions.
- Stub returns predefined data.
- Fake is a simplified working implementation.
- Useful for unit tests.
- Over-mocking can reduce confidence.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q01 -->
#### Intermediate Q01: What is the testing pyramid?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

The testing pyramid is a testing strategy model that suggests having many fast lower-level tests, fewer integration tests, and even fewer end-to-end tests.

The idea is not that every project must have exact percentages. The principle is that lower-level tests are faster and cheaper, while higher-level tests provide broader confidence but are slower and more expensive.

A good strategy tests behavior at the lowest level that provides enough confidence.

##### Key Points to Mention

- Many unit tests.
- Fewer integration tests.
- Fewer E2E tests.
- Lower-level tests are faster.
- Higher-level tests are more realistic but costlier.
- The exact shape depends on the application.
- Test at the lowest useful level.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q01 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q02 -->
#### Intermediate Q02: When should you prefer an integration test over a unit test?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Prefer an integration test when the risk is in how components work together rather than inside one isolated method.

Examples include EF Core LINQ translation, database constraints, API routing, model binding, middleware ordering, dependency injection, authentication, authorization, serialization, and configuration.

If the same behavior can be tested confidently with a unit test, use the unit test because it is faster and easier to diagnose. But if mocking would hide the real risk, use an integration test.

##### Key Points to Mention

- Use integration tests for component collaboration.
- Use integration tests for infrastructure behavior.
- EF Core provider behavior should often be integration-tested.
- API pipeline behavior needs integration tests.
- Unit tests are better for isolated business logic.
- Do not mock away the thing you need confidence in.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q02 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q03 -->
#### Intermediate Q03: How do you integration-test an ASP.NET Core API?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A common approach is to use `WebApplicationFactory<Program>` from `Microsoft.AspNetCore.Mvc.Testing`. It starts the application in a test host and gives the test an `HttpClient` for sending requests.

Example:

```csharp
public sealed class CustomersApiTests
    : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public CustomersApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetCustomers_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/customers");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
```

For real tests, you often customize services, replace the database, seed test data, and configure authentication.

##### Key Points to Mention

- Use `WebApplicationFactory<Program>`.
- Use `HttpClient` to call the app.
- Tests the request-response pipeline.
- Can customize services for test environment.
- Can replace database with test database.
- Can seed test data.
- Good for routing, filters, middleware, DI, and serialization.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q03 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q04 -->
#### Intermediate Q04: Why should EF Core code often be integration-tested against a real relational provider?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

EF Core behavior depends on the database provider. LINQ translation, constraints, transactions, null handling, case sensitivity, indexes, and migrations can behave differently across providers.

The EF Core InMemory provider does not behave like a relational database, so it can give false confidence for relational behavior.

For realistic persistence tests, use SQLite in relational mode for simple cases or the same database engine as production through Docker/Testcontainers for higher confidence.

##### Key Points to Mention

- LINQ translation is provider-specific.
- Relational constraints matter.
- Transactions matter.
- InMemory provider is not relational.
- SQLite can help but is not identical to SQL Server/PostgreSQL.
- Testcontainers can run production-like databases.
- Use real provider behavior when persistence correctness matters.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q04 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q05 -->
#### Intermediate Q05: How do you keep tests isolated?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Tests are isolated when each test can run independently, in any order, and repeatedly without depending on another test's data or side effects.

Common techniques include creating test data inside each test, using unique data values, resetting the database between tests, wrapping database changes in transactions, using test containers, clearing state after each test, and avoiding shared mutable static state.

For E2E tests, each test should create or obtain its own data and should not rely on a previous E2E test having already run.

##### Key Points to Mention

- Tests should run independently.
- Avoid order dependency.
- Avoid shared mutable state.
- Create data per test.
- Reset or isolate database state.
- Use unique test identifiers.
- Isolation improves parallel execution and reliability.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q05 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q06 -->
#### Intermediate Q06: What causes flaky tests and how do you reduce flakiness?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Flaky tests pass sometimes and fail other times without a code change. Common causes include timing assumptions, fixed sleeps, shared test data, tests depending on order, race conditions, unstable external services, environment differences, and poor cleanup.

To reduce flakiness, make tests isolated, avoid fixed sleeps, use condition-based waits, use stable test data, mock or fake unstable external services, reset state between tests, and keep E2E tests focused.

##### Key Points to Mention

- Flaky tests are unreliable tests.
- Fixed sleeps are a common cause.
- Shared data causes conflicts.
- Test order dependency causes cascading failures.
- Use condition-based waits.
- Keep tests isolated.
- Treat flaky tests as bugs.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q06 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q07 -->
#### Intermediate Q07: How should tests be organized in a .NET solution?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

A common approach is to use separate test projects for different test types.

Example:

```text
src/
  MyApp.Api/
  MyApp.Application/
  MyApp.Domain/
  MyApp.Infrastructure/

tests/
  MyApp.UnitTests/
  MyApp.IntegrationTests/
  MyApp.EndToEndTests/
```

This makes it easier to run fast unit tests separately from slower integration and E2E tests. It also helps configure different dependencies, test data, environment variables, and CI stages.

##### Key Points to Mention

- Separate projects by test type when useful.
- Unit tests should run quickly.
- Integration tests may need database or test server setup.
- E2E tests may need deployed app or browser.
- CI can run different suites at different stages.
- Naming should make test purpose clear.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q07 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q08 -->
#### Intermediate Q08: How should automated tests fit into CI/CD?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

A practical CI/CD pipeline separates tests by speed and confidence level. Pull requests should run fast tests such as unit tests and key integration tests. Main branch or pre-release pipelines can run broader integration tests. Full E2E suites can run before release, nightly, or on important branches.

The goal is fast developer feedback while still having deeper confidence before deployment.

##### Key Points to Mention

- Run unit tests on every pull request.
- Run important integration tests in CI.
- Run slower E2E tests at appropriate stages.
- Keep PR feedback fast.
- Use test categories or separate projects.
- Publish test results and artifacts.
- Do not block every small change on extremely slow tests unless necessary.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q01 -->
#### Advanced Q01: How would you design a testing strategy for a full-stack .NET application?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would start by identifying the application's highest-risk areas: business rules, persistence behavior, API contracts, authentication, authorization, frontend workflows, and external integrations.

I would use unit tests for domain logic, validators, calculations, and command/query handlers where dependencies can be replaced safely. I would use integration tests for ASP.NET Core endpoints, middleware, EF Core queries, database constraints, and authentication/authorization behavior. I would use E2E tests for a small number of critical user journeys such as login, checkout, upload, or approval workflows.

The CI pipeline should run fast tests on every pull request and run slower E2E or full integration suites at later stages. The strategy should prioritize confidence, speed, maintainability, and clear failure diagnosis.

##### Key Points to Mention

- Identify system risks first.
- Use unit tests for business logic.
- Use integration tests for API/database/infrastructure.
- Use E2E tests for critical user journeys.
- Avoid testing everything through the UI.
- Separate fast and slow test suites.
- Include tests in CI/CD.
- Keep tests isolated and deterministic.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q01 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q02 -->
#### Advanced Q02: How do you decide whether to mock a dependency or use the real implementation?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

The decision depends on what risk the test is trying to cover. If the test is focused on business logic and the dependency is not part of the behavior under test, mocking is appropriate. For example, a unit test can mock an email sender or payment gateway.

If the risk is in the real dependency behavior or integration boundary, use the real implementation or a realistic test version. For example, EF Core queries should often be tested against a real relational provider because mocking the repository would not catch SQL translation or constraint problems.

Do not mock away the thing you need confidence in.

##### Key Points to Mention

- Mock dependencies not under test.
- Use real implementations when integration behavior matters.
- Mock external services in unit tests.
- Use fake/sandbox services for integration or E2E tests.
- Avoid over-mocking.
- Avoid false confidence.
- Match test double choice to test purpose.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q02 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q03 -->
#### Advanced Q03: How would you test authentication and authorization in ASP.NET Core?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Authentication and authorization should be tested at multiple levels. Unit tests can cover custom authorization handlers or permission logic. Integration tests should verify real endpoint behavior, such as anonymous users receiving `401`, authenticated users without permission receiving `403`, and authorized users receiving success.

With `WebApplicationFactory`, tests can configure a test authentication scheme that creates users with specific claims and roles. This allows testing authorization policies without relying on a real identity provider.

E2E tests should cover only critical login and access-control flows through the UI.

##### Key Points to Mention

- Unit test custom authorization logic.
- Integration test endpoint-level access control.
- Use test authentication scheme for API tests.
- Verify `401`, `403`, and success cases.
- Test roles, claims, scopes, and policies.
- E2E test critical login flows only.
- Do not rely only on frontend checks.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q03 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q04 -->
#### Advanced Q04: How would you test a CQRS/MediatR command handler?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

A command handler can be tested with unit tests and integration tests depending on the risk.

A unit test can instantiate the handler directly and mock dependencies such as repositories, current user, clock, or message bus. This is good for business rules and branching logic.

An integration test can send a real HTTP request or dispatch through the real MediatR pipeline to verify validation behavior, transaction behavior, database persistence, pipeline behaviors, and dependency injection.

Both are useful. Unit tests give fast feedback on handler logic, while integration tests verify that the handler works in the real application pipeline.

##### Key Points to Mention

- Unit test handler logic with mocks/fakes.
- Integration test real pipeline behavior.
- Test validation behavior.
- Test persistence behavior.
- Test transactions if important.
- Test dependency injection wiring.
- Do not duplicate every case at every level.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q04 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q05 -->
#### Advanced Q05: What are the risks of relying too heavily on E2E tests?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Relying too heavily on E2E tests makes the suite slower, more expensive, and more fragile. E2E tests are harder to debug because a failure may be caused by frontend code, backend code, test data, network issues, timing, browser behavior, or environment configuration.

They also provide poor fault localization. A failing checkout E2E test tells you the checkout flow is broken, but not necessarily whether the bug is in validation, API routing, database persistence, JavaScript state, payment integration, or authentication.

E2E tests should cover critical flows, while unit and integration tests should cover detailed logic and component behavior.

##### Key Points to Mention

- E2E tests are slower.
- E2E tests are more brittle.
- Failures are harder to diagnose.
- Poor fault localization.
- Environment-dependent.
- More expensive in CI.
- Use E2E for critical flows, not every edge case.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q05 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q06 -->
#### Advanced Q06: How would you prevent integration tests from becoming slow and hard to maintain?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Keep integration tests focused on important boundaries instead of testing every permutation. Use unit tests for detailed business-rule combinations. Reuse test fixtures carefully, seed only necessary data, use isolated databases or unique data per test, avoid excessive full-app startup, and separate slow tests from fast tests in CI.

Use realistic infrastructure only where it adds value. For database-heavy tests, use a real test database or containers, but keep the dataset small and resettable.

##### Key Points to Mention

- Focus on important integration boundaries.
- Do not duplicate every unit test case as an integration test.
- Keep test data small.
- Use fixtures carefully.
- Isolate database state.
- Separate slow test suites.
- Use real infrastructure only when it matters.
- Monitor test runtime in CI.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q06 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q07 -->
#### Advanced Q07: How would you test external service integrations?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

External services should be tested at different levels. Unit tests should mock the external service client so business logic can be tested without network calls. Integration tests can use a fake HTTP server, local emulator, contract test, or sandbox to verify request and response behavior. E2E tests should use real sandbox environments only for a small number of critical flows.

The goal is to avoid making the fast test suite depend on unstable external systems while still verifying that real integration contracts are correct.

##### Key Points to Mention

- Mock external services in unit tests.
- Use fake server or sandbox for integration tests.
- Use contract tests when possible.
- Avoid live third-party calls in fast PR tests.
- Use E2E sandbox tests sparingly.
- Handle credentials securely.
- Test failure scenarios and retries.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q07 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q08 -->
#### Advanced Q08: How do you use code coverage correctly?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

Code coverage is useful as a signal, but it does not prove correctness. A test can execute code without meaningful assertions. High coverage can still miss important edge cases or integration failures.

Use coverage to identify untested areas, especially critical business logic. Combine it with good assertions, risk-based testing, code review, integration tests, and possibly mutation testing for important logic.

Do not chase 100% coverage blindly if it leads to brittle or low-value tests.

##### Key Points to Mention

- Coverage shows executed code, not correctness.
- Meaningful assertions matter.
- Use coverage to find gaps.
- Prioritize high-risk code.
- Avoid chasing 100% blindly.
- Coverage should complement, not replace, test quality.
- Mutation testing can reveal weak assertions.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q08 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q09 -->
#### Advanced Q09: How would you handle test data in integration and E2E tests?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

Test data should be deterministic, isolated, and easy to clean up. Integration tests can use database reset strategies, transactions, unique identifiers, or recreate databases/containers between test runs. E2E tests should create their own data through APIs or setup scripts rather than depending on previous tests.

Avoid tests that depend on shared mutable records unless the data is read-only baseline data. Each test should be able to run independently and in parallel where possible.

##### Key Points to Mention

- Use deterministic data.
- Isolate test data.
- Avoid order dependency.
- Use unique IDs or prefixes.
- Reset database state when needed.
- Use API setup for E2E tests.
- Avoid relying on previous tests.
- Keep baseline seed data read-only when possible.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q09 -->

<!-- question:start:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q10 -->
#### Advanced Q10: How do you decide which tests should block a pull request?

<!-- question-id:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q10 -->
<!-- question-level:advanced -->

##### Expected Answer

Pull requests should be blocked by tests that provide fast and reliable feedback. This usually includes the build, unit tests, static analysis, and key integration tests. Slower or more fragile E2E tests can run on main branch, scheduled builds, release branches, or pre-deployment pipelines.

Critical E2E smoke tests may block a pull request if they are stable and fast enough. The goal is to balance fast developer feedback with confidence before deployment.

##### Key Points to Mention

- PR checks should be fast and reliable.
- Unit tests usually block PRs.
- Important integration tests often block PRs.
- Full E2E suites may run later.
- Critical smoke E2E tests can block if stable.
- Separate tests by category.
- Publish artifacts for failed higher-level tests.

<!-- question:end:unit-tests-vs-integration-tests-vs-end-to-end-tests-advanced-q10 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
