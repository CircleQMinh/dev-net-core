---
id: test-doubles-mocks-stubs-fakes-mocking-integration-problems
topic: Testing strategy and integration testing
subtopic: Test doubles, mocking boundaries, and integration risks in .NET
category: .NET
---

## Overview

Test doubles are replacement objects used in tests instead of real dependencies such as databases, file systems, message queues, HTTP APIs, identity providers, clocks, payment gateways, or email services. They help developers test code quickly, deterministically, and safely without relying on slow or unpredictable external systems.

In C# and .NET applications, test doubles are commonly used with unit testing frameworks such as xUnit, NUnit, and MSTest, and with mocking libraries such as Moq, NSubstitute, and FakeItEasy. They are especially common in applications built with dependency injection, where services depend on interfaces such as `IEmailSender`, `IPaymentGateway`, `IClock`, `IRepository<T>`, or `IHttpClientFactory`.

This topic matters because testing is not only about making tests pass. Good tests should give confidence that the real application works. Test doubles are useful when they isolate business logic, remove external instability, and make edge cases easy to simulate. However, excessive mocking can hide real integration problems. A test can pass because the mock behaves exactly as the developer configured it, while the real database query, real HTTP call, real serializer, real authentication middleware, real transaction, or real dependency injection configuration fails in production.

This topic is important for interviews because it reveals whether a developer understands the difference between isolated unit tests and integration tests. Interviewers often ask about mocks, stubs, and fakes to evaluate practical judgment: what should be mocked, what should be tested with real infrastructure, how to avoid brittle tests, and how to design code that is testable without over-abstracting everything.

A strong interview answer should explain that test doubles are tools, not the goal. The goal is useful feedback. Unit tests with test doubles should validate business logic quickly, while integration tests should verify real wiring, framework behavior, database behavior, serialization, authentication, authorization, middleware, configuration, and external contracts.

## Core Concepts

### What Is a Test Double?

A test double is a substitute used in a test in place of a real dependency. The name comes from the idea of a stunt double in a movie: the double stands in for the real object during a controlled scenario.

Common reasons to use a test double include:

- Avoiding calls to external services.
- Making tests faster.
- Making tests deterministic.
- Simulating rare error cases.
- Avoiding destructive actions such as sending real emails or charging real cards.
- Testing business logic in isolation.
- Controlling dependency behavior for edge cases.

Example dependency:

```csharp
public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default);
}
```

A real implementation may use SMTP, SendGrid, Azure Communication Services, or another provider. In a unit test, calling the real provider would be slow, unreliable, and potentially dangerous. A test double can replace it.

### Dummy, Stub, Fake, Mock, and Spy

Testing terminology is sometimes used inconsistently, but interviewers usually expect the following practical distinctions.

### Dummy

A dummy is passed only because a method requires a parameter. The test does not use it meaningfully.

```csharp
public sealed class NullLogger : ILogger
{
    public void Log(string message)
    {
        // Intentionally does nothing.
    }
}
```

Use a dummy when the dependency is required by the constructor or method signature but is irrelevant to the specific test.

### Stub

A stub provides pre-defined data or behavior. It helps the system under test reach a specific path.

```csharp
public interface IExchangeRateProvider
{
    Task<decimal> GetRateAsync(string fromCurrency, string toCurrency);
}

public sealed class StubExchangeRateProvider : IExchangeRateProvider
{
    public Task<decimal> GetRateAsync(string fromCurrency, string toCurrency)
    {
        return Task.FromResult(25_000m);
    }
}
```

A stub is useful when the test needs a known response.

```csharp
public sealed class PriceCalculator
{
    private readonly IExchangeRateProvider _exchangeRateProvider;

    public PriceCalculator(IExchangeRateProvider exchangeRateProvider)
    {
        _exchangeRateProvider = exchangeRateProvider;
    }

    public async Task<decimal> ConvertToVndAsync(decimal usdAmount)
    {
        var rate = await _exchangeRateProvider.GetRateAsync("USD", "VND");
        return usdAmount * rate;
    }
}
```

```csharp
[Fact]
public async Task ConvertToVndAsync_ReturnsConvertedAmount()
{
    var calculator = new PriceCalculator(new StubExchangeRateProvider());

    var result = await calculator.ConvertToVndAsync(10m);

    Assert.Equal(250_000m, result);
}
```

This test checks the calculator logic. It does not check the real exchange rate provider.

### Fake

A fake is a working but simplified implementation. It usually has behavior close to the real dependency but is simpler, faster, and safer.

```csharp
public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email);
    Task AddAsync(User user);
}

public sealed class FakeUserRepository : IUserRepository
{
    private readonly List<User> _users = new();

    public Task<User?> GetByEmailAsync(string email)
    {
        var user = _users.SingleOrDefault(x => x.Email == email);
        return Task.FromResult(user);
    }

    public Task AddAsync(User user)
    {
        _users.Add(user);
        return Task.CompletedTask;
    }
}
```

A fake is useful when the dependency has enough behavior that configuring many mocks would make the test hard to read.

Example:

```csharp
[Fact]
public async Task RegisterAsync_AddsUser_WhenEmailIsUnique()
{
    var repository = new FakeUserRepository();
    var service = new RegistrationService(repository);

    await service.RegisterAsync("minh@example.com");

    var user = await repository.GetByEmailAsync("minh@example.com");
    Assert.NotNull(user);
}
```

This fake repository is simple and fast, but it does not behave exactly like a real database. It does not enforce all database constraints, transactions, collation rules, query translation rules, tracking behavior, or concurrency behavior.

### Mock

A mock is a test double used to verify interactions. It usually answers the question: "Did the system call this dependency correctly?"

Example using Moq:

```csharp
[Fact]
public async Task CompleteOrderAsync_SendsConfirmationEmail()
{
    var emailSender = new Mock<IEmailSender>();

    var service = new OrderService(emailSender.Object);

    await service.CompleteOrderAsync(
        orderId: 123,
        customerEmail: "customer@example.com");

    emailSender.Verify(x => x.SendAsync(
            "customer@example.com",
            "Order completed",
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()),
        Times.Once);
}
```

This test verifies that the service asks the email sender to send a confirmation email.

Mocks are most valuable when the observable outcome is an interaction with an external boundary, such as:

- Sending an email.
- Publishing an event.
- Calling a payment gateway.
- Writing an audit log.
- Invalidating a cache.
- Triggering a notification.

Mocks become risky when they verify internal implementation details that users do not care about.

### Spy

A spy records what happened so the test can inspect it later. Some mocking libraries can create spies, but a hand-written spy is often clearer.

```csharp
public sealed class SpyEmailSender : IEmailSender
{
    public List<string> Recipients { get; } = new();

    public Task SendAsync(
        string to,
        string subject,
        string body,
        CancellationToken cancellationToken = default)
    {
        Recipients.Add(to);
        return Task.CompletedTask;
    }
}
```

```csharp
[Fact]
public async Task CompleteOrderAsync_RecordsEmailRecipient()
{
    var emailSender = new SpyEmailSender();
    var service = new OrderService(emailSender);

    await service.CompleteOrderAsync(123, "customer@example.com");

    Assert.Contains("customer@example.com", emailSender.Recipients);
}
```

A spy is useful when a mocking library would make the test more complex than necessary.

### Unit Tests vs Integration Tests

A unit test usually tests a small unit of behavior in isolation. It often replaces external dependencies with test doubles.

An integration test verifies that multiple parts of the system work together. It may use a real ASP.NET Core pipeline, dependency injection container, database provider, HTTP serialization, authentication scheme, middleware, configuration, or external service emulator.

Example unit test scope:

```text
OrderService + mocked IEmailSender + fake repository
```

Example integration test scope:

```text
HTTP request
-> ASP.NET Core middleware
-> endpoint routing
-> model binding
-> validation
-> controller/minimal API
-> EF Core
-> real test database
-> response serialization
```

Both are valuable. A healthy test suite usually contains many fast unit tests and enough integration tests to prove that the real application wiring works.

### Why Test Doubles Are Useful

Test doubles help with several practical problems.

They make tests fast:

```text
Real payment provider call: slow and unreliable
Mock payment provider: immediate and deterministic
```

They make tests safe:

```text
Real email sender: may send an actual customer email
Spy email sender: records the email without sending it
```

They make rare cases easy to simulate:

```csharp
paymentGateway
    .Setup(x => x.ChargeAsync(It.IsAny<PaymentRequest>(), It.IsAny<CancellationToken>()))
    .ThrowsAsync(new TimeoutException("Payment provider timed out."));
```

They isolate business rules:

```text
Test the discount calculation without needing a database, message broker, or HTTP server.
```

They improve design feedback:

```text
If a class is impossible to test without a huge amount of setup, it may have too many responsibilities.
```

### When Mocking Is the Right Choice

Mocking is usually appropriate for dependencies at system boundaries.

Good candidates for mocks include:

- Email services.
- SMS services.
- Push notification services.
- Payment gateways.
- External HTTP APIs.
- Message publishers.
- File storage abstractions.
- Cache invalidation services.
- Clock/time providers.
- Random number providers.
- Feature flag providers.
- Authorization or identity abstractions in pure unit tests.

Example:

```csharp
public interface IOrderEventPublisher
{
    Task PublishOrderCompletedAsync(int orderId, CancellationToken cancellationToken);
}

[Fact]
public async Task CompleteOrderAsync_PublishesOrderCompletedEvent()
{
    var publisher = new Mock<IOrderEventPublisher>();
    var service = new OrderService(publisher.Object);

    await service.CompleteOrderAsync(123, CancellationToken.None);

    publisher.Verify(x => x.PublishOrderCompletedAsync(123, It.IsAny<CancellationToken>()), Times.Once);
}
```

This is reasonable because publishing an event is an important observable interaction.

### When a Fake Is Better Than a Mock

A fake is often better when the dependency has behavior that many tests need and mocking each interaction would create noisy tests.

Good fake candidates include:

- In-memory repositories for simple domain tests.
- In-memory queues for command handlers.
- Fake clocks.
- Fake current-user providers.
- Fake file storage for simple save/read behavior.
- Fake feature flag stores.

Example fake clock:

```csharp
public interface IClock
{
    DateTimeOffset UtcNow { get; }
}

public sealed class FakeClock : IClock
{
    public DateTimeOffset UtcNow { get; set; }
}
```

```csharp
[Fact]
public void IsExpired_ReturnsTrue_WhenExpirationIsInPast()
{
    var clock = new FakeClock
    {
        UtcNow = new DateTimeOffset(2026, 5, 17, 0, 0, 0, TimeSpan.Zero)
    };

    var token = new AccessToken(
        expiresAt: new DateTimeOffset(2026, 5, 16, 0, 0, 0, TimeSpan.Zero));

    Assert.True(token.IsExpired(clock));
}
```

This is easier to read than mocking a property call.

### When Not to Mock

Do not mock something just because it is possible.

Avoid mocking:

- Simple value objects.
- Domain entities.
- Pure functions.
- LINQ behavior.
- Framework code that should be tested through the framework.
- EF Core query behavior when the real concern is SQL translation.
- ASP.NET Core model binding, filters, middleware, routing, or authorization when the real concern is API behavior.
- AutoMapper mappings when the real concern is mapping configuration.
- Serialization when the real concern is JSON contract compatibility.
- Internal private method calls through artificial abstractions.

Bad example:

```csharp
discountCalculator
    .Verify(x => x.CalculateDiscount(order), Times.Once);
```

If the test only cares about the final price, verify the final price instead:

```csharp
Assert.Equal(90m, result.Total);
```

Interaction verification should be used when the interaction itself is the behavior.

### State Verification vs Interaction Verification

State verification checks the final result.

```csharp
Assert.Equal(OrderStatus.Completed, order.Status);
Assert.Equal(90m, order.Total);
```

Interaction verification checks how collaborators were used.

```csharp
emailSender.Verify(x => x.SendAsync(
    customerEmail,
    "Order completed",
    It.IsAny<string>(),
    It.IsAny<CancellationToken>()),
    Times.Once);
```

Prefer state verification when possible because it is usually less coupled to implementation details. Use interaction verification when the behavior is an interaction with another component.

Example:

```text
Good interaction verification:
"An email should be sent after order completion."

Risky interaction verification:
"The service should call repository.GetByIdAsync before repository.UpdateAsync."
```

The first describes business-observable behavior. The second may describe implementation details.

### Over-Mocking and Brittle Tests

Over-mocking means replacing too many collaborators or verifying too many internal calls.

Symptoms of over-mocking include:

- Tests fail after harmless refactoring.
- Tests duplicate the implementation.
- Tests contain more setup than assertions.
- Tests verify exact method call order unnecessarily.
- Tests pass even though the real app is broken.
- The team has high unit-test coverage but low production confidence.
- Developers avoid refactoring because many mocks must be updated.

Example of a brittle test:

```csharp
repository.Verify(x => x.GetByIdAsync(id), Times.Once);
discountService.Verify(x => x.ApplyDiscount(order), Times.Once);
repository.Verify(x => x.SaveAsync(order), Times.Once);
emailSender.Verify(x => x.SendAsync(email, subject, body, default), Times.Once);
```

This test may fail if the implementation changes from `GetByIdAsync` to `GetByNumberAsync`, even if the user-visible behavior is still correct.

A more resilient test verifies important outcomes:

```csharp
Assert.Equal(OrderStatus.Completed, order.Status);
emailSender.Verify(x => x.SendAsync(
    order.CustomerEmail,
    "Order completed",
    It.IsAny<string>(),
    It.IsAny<CancellationToken>()),
    Times.Once);
```

### How Mocking Can Hide Real Integration Problems

Mocking can hide problems when the mock does not behave like the real dependency.

Common examples include:

### Database Query Translation Problems

A mocked repository may return expected data, but the real EF Core query may fail because it cannot be translated to SQL.

Risky unit test:

```csharp
repository
    .Setup(x => x.SearchAsync("abc"))
    .ReturnsAsync(new List<Product>
    {
        new Product { Name = "ABC Product" }
    });
```

This test does not prove that the real query works.

The real code might contain:

```csharp
var products = await dbContext.Products
    .Where(x => Normalize(x.Name).Contains(searchText))
    .ToListAsync();
```

If `Normalize` cannot be translated to SQL, the real query can fail or behave differently. A unit test with a mocked repository would not catch this. An integration test using the real provider is needed.

### EF Core Tracking and State Problems

A fake repository may not reproduce EF Core behavior such as:

- Change tracking.
- Entity states.
- Relationship fix-up.
- Required properties.
- Concurrency tokens.
- Transactions.
- Unique constraints.
- Cascade deletes.
- Query translation.
- Database collation.
- Null comparison semantics.

For EF Core-heavy behavior, use integration tests with SQLite, SQL Server LocalDB, containers, or a real test database where possible.

### Serialization and Contract Problems

A mocked service may directly return a C# object, but the real API may fail due to JSON serialization settings.

Problems mocks may hide include:

- Wrong property names.
- Missing required fields.
- Enum serialization mismatch.
- Date/time format issues.
- Circular references.
- Nullability contract mismatch.
- Case sensitivity issues.

An API integration test should send an HTTP request and verify the real serialized response.

### Dependency Injection and Configuration Problems

A unit test can manually construct a service and pass mocks. That does not prove the real application can resolve the service.

Mock-based tests may miss:

- Missing service registrations.
- Wrong service lifetimes.
- Invalid options binding.
- Missing configuration keys.
- Incorrect named `HttpClient`.
- Incorrect authentication scheme registration.

A startup or API integration test can catch these problems.

### Authentication and Authorization Problems

Mocking `ICurrentUser` can be useful for domain service tests, but it does not prove real authentication and authorization work.

Mocks may hide:

- Missing `[Authorize]`.
- Wrong policy name.
- Wrong role requirement.
- Incorrect claim mapping.
- Middleware ordering problems.
- Token validation configuration issues.

Security-sensitive behavior should have integration tests that exercise the real authorization pipeline.

### HTTP Client Problems

Mocking an external API client can hide problems in:

- Base address configuration.
- Request headers.
- Authentication tokens.
- JSON body shape.
- Status code handling.
- Timeout behavior.
- Retry policies.
- Error response parsing.

A better approach is often to test your adapter against a fake HTTP server or mocked `HttpMessageHandler`, and separately test application behavior with a fake adapter.

### Message Queue and Event Problems

Mocking an event publisher can verify that publishing was attempted, but it does not verify:

- Topic or queue name.
- Message schema.
- Serialization.
- Dead-letter behavior.
- Retry behavior.
- Idempotency.
- Consumer compatibility.

For event-driven systems, add contract tests or integration tests for message shape and consumer behavior.

### Mocking External Systems vs Mocking Your Own Adapter

A useful design habit is to wrap external systems behind your own adapter interface.

Instead of mocking `HttpClient` everywhere:

```csharp
public interface IPaymentGateway
{
    Task<PaymentResult> ChargeAsync(PaymentRequest request, CancellationToken cancellationToken);
}
```

Your application unit tests can mock `IPaymentGateway`.

Then write focused integration tests for the real `PaymentGateway` implementation:

```text
PaymentGateway
-> HttpClient
-> JSON serialization
-> headers
-> status code mapping
-> fake HTTP server or sandbox API
```

This gives both fast business tests and confidence in the external integration layer.

### Mocking Repositories: Useful but Dangerous

Mocking repositories can be useful when the test is about business decisions, not persistence.

Example:

```csharp
[Fact]
public async Task CreateOrderAsync_RejectsDuplicateOrderNumber()
{
    var repository = new Mock<IOrderRepository>();

    repository
        .Setup(x => x.ExistsByOrderNumberAsync("ORD-001", It.IsAny<CancellationToken>()))
        .ReturnsAsync(true);

    var service = new OrderService(repository.Object);

    await Assert.ThrowsAsync<DuplicateOrderException>(() =>
        service.CreateOrderAsync("ORD-001", CancellationToken.None));
}
```

This test checks business behavior: duplicate order numbers are rejected.

However, it does not prove the real duplicate check query works. You still need an integration test for the repository or EF Core query.

A good rule:

```text
Mock repositories in application service unit tests.
Do not rely only on mocked repositories for persistence behavior.
```

### EF Core InMemory Provider vs Real Database Provider

The EF Core InMemory provider is convenient, but it is not a relational database. It may not catch relational database behavior such as:

- Foreign key constraints.
- Unique indexes.
- SQL translation issues.
- Transactions.
- Raw SQL behavior.
- Database-specific functions.
- Collation and case sensitivity differences.

For tests that need database confidence, prefer a relational provider such as SQLite in-memory mode or the same database engine used in production through containers or test infrastructure.

Example integration-style test shape:

```csharp
[Fact]
public async Task CreateUserAsync_Fails_WhenEmailAlreadyExists()
{
    await using var dbContext = CreateSqliteDbContext();

    dbContext.Users.Add(new User { Email = "minh@example.com" });
    await dbContext.SaveChangesAsync();

    dbContext.Users.Add(new User { Email = "minh@example.com" });

    await Assert.ThrowsAsync<DbUpdateException>(() =>
        dbContext.SaveChangesAsync());
}
```

This type of test catches real database constraint behavior that a fake repository would not catch.

### ASP.NET Core Integration Tests and Replacing Services

ASP.NET Core integration tests can run the real application pipeline while replacing selected services with stubs or fakes.

Common approach:

```csharp
public sealed class CustomWebApplicationFactory
    : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(
                x => x.ServiceType == typeof(IEmailSender));

            if (descriptor is not null)
            {
                services.Remove(descriptor);
            }

            services.AddSingleton<IEmailSender, SpyEmailSender>();
        });
    }
}
```

This keeps the real routing, model binding, validation, filters, middleware, and JSON serialization, while replacing only the email sender.

A good integration test usually mocks fewer things than a unit test.

### Contract Tests

A contract test verifies that two components agree on a boundary.

Examples:

- Your API returns the JSON shape expected by a frontend.
- Your service sends a message with the schema expected by a consumer.
- Your client sends the request format expected by a third-party API.
- Your adapter maps external error codes correctly.

Contract tests are useful when mocks would otherwise make unrealistic assumptions.

Example concern:

```text
Mock says payment provider returns "Approved".
Real provider returns "APPROVED", "approved", or a nested status object.
```

A contract test catches this mismatch.

### Choosing the Right Test Double

Use this practical decision guide:

```text
Need only a required argument?
Use a dummy.

Need a fixed response?
Use a stub.

Need a simple working implementation?
Use a fake.

Need to verify that a dependency was called?
Use a mock.

Need to record calls for later inspection?
Use a spy.

Need to verify framework, database, serialization, DI, or middleware behavior?
Use an integration test.
```

### Designing Code for Testability Without Over-Abstraction

Good testability usually comes from clear boundaries, not from abstracting every class.

Useful boundaries include:

- External services.
- Time.
- Randomness.
- File system.
- Network calls.
- Message brokers.
- Payment gateways.
- Email/SMS providers.
- Current user context.
- Feature flags.

Avoid creating interfaces for every class only to make mocking possible. This can create unnecessary complexity.

Example of useful abstraction:

```csharp
public interface ISystemClock
{
    DateTimeOffset UtcNow { get; }
}
```

Example of questionable abstraction:

```csharp
public interface IStringTrimmer
{
    string Trim(string value);
}
```

The first abstracts a hard-to-control dependency: time. The second abstracts a simple framework method and may not add value.

### Verifying Behavior Instead of Implementation

Tests should usually describe behavior, not implementation details.

Less useful:

```csharp
[Fact]
public async Task CreateOrderAsync_CallsRepositorySave()
{
    // This verifies an implementation step.
}
```

More useful:

```csharp
[Fact]
public async Task CreateOrderAsync_CreatesPendingOrderForValidCustomer()
{
    // This verifies business behavior.
}
```

A test name should help future developers understand what behavior must not break.

### Mock Setup Should Be Minimal

Avoid configuring mocks for behavior that does not matter to the test.

Noisy setup:

```csharp
customerRepository.Setup(x => x.GetByIdAsync(id)).ReturnsAsync(customer);
pricingService.Setup(x => x.CalculateAsync(cart)).ReturnsAsync(price);
taxService.Setup(x => x.CalculateAsync(price)).ReturnsAsync(tax);
shippingService.Setup(x => x.CalculateAsync(cart)).ReturnsAsync(shipping);
auditLogger.Setup(x => x.WriteAsync(It.IsAny<string>())).Returns(Task.CompletedTask);
```

If the test needs all of this setup, the unit may be too large or the test may be trying to cover too much.

Better options:

- Split the service.
- Use a fake object that represents a common scenario.
- Move complex setup into a test data builder.
- Use an integration test if the behavior depends on many real components.

### Handling Errors with Test Doubles

Mocks and stubs are useful for simulating failure paths that are difficult to reproduce with real systems.

Example:

```csharp
emailSender
    .Setup(x => x.SendAsync(
        It.IsAny<string>(),
        It.IsAny<string>(),
        It.IsAny<string>(),
        It.IsAny<CancellationToken>()))
    .ThrowsAsync(new TimeoutException());
```

This helps test retry logic, fallback behavior, logging, or user-friendly error handling.

However, a mocked timeout does not prove that real timeout configuration works. For that, use integration or resilience tests around the real HTTP client, database command timeout, or messaging client.

### Test Data Builders and Object Mothers

Test doubles often become easier to use when combined with test data builders.

Example:

```csharp
public sealed class OrderBuilder
{
    private int _id = 1;
    private string _email = "customer@example.com";
    private decimal _total = 100m;

    public OrderBuilder WithId(int id)
    {
        _id = id;
        return this;
    }

    public OrderBuilder WithEmail(string email)
    {
        _email = email;
        return this;
    }

    public OrderBuilder WithTotal(decimal total)
    {
        _total = total;
        return this;
    }

    public Order Build()
    {
        return new Order
        {
            Id = _id,
            CustomerEmail = _email,
            Total = _total
        };
    }
}
```

Usage:

```csharp
var order = new OrderBuilder()
    .WithTotal(250m)
    .Build();
```

This keeps tests readable and reduces irrelevant setup noise.

### Common Mistakes

Common mistakes include:

- Calling every test double a mock.
- Mocking the class under test.
- Mocking simple data objects.
- Verifying every internal method call.
- Writing tests that duplicate implementation logic.
- Using mocks to hide poor design instead of improving boundaries.
- Mocking EF Core queries and assuming persistence is tested.
- Using the EF Core InMemory provider as proof of relational database behavior.
- Mocking ASP.NET Core authorization and assuming endpoint security is tested.
- Having only unit tests and no integration tests.
- Having only integration tests and no fast unit tests.
- Making tests depend on exact call order without a business reason.
- Returning unrealistic data from stubs.
- Letting fake implementations become more complex than production code.
- Ignoring cancellation tokens, exceptions, and failure scenarios in mocked dependencies.

### Best Practices

Use test doubles intentionally.

Good habits include:

- Mock external boundaries, not simple domain logic.
- Prefer state-based assertions when possible.
- Use interaction verification only when the interaction is the behavior.
- Keep mock setup small and relevant.
- Use fakes for common, reusable test behavior.
- Use spies when recording calls is simpler than using a mocking library.
- Use integration tests for framework behavior, DI, database behavior, serialization, authentication, authorization, and middleware.
- Test real EF Core queries with a relational provider when query behavior matters.
- Wrap external systems behind adapter interfaces.
- Keep test double behavior realistic.
- Avoid testing implementation details.
- Use clear names such as `FakeUserRepository`, `StubClock`, or `SpyEmailSender`.
- Add contract tests for important external boundaries.
- Combine unit tests and integration tests instead of relying on only one style.
- Treat high code coverage from heavily mocked tests with caution.
- Refactor production code when tests require excessive mocking.

### Practical Rule of Thumb

A practical interview-ready answer is:

```text
Use mocks to isolate business logic from external boundaries.
Use fakes or stubs when simple controlled behavior is enough.
Use integration tests when the risk is in wiring, database behavior, framework behavior, serialization, security, or external contracts.
Avoid mocking so much that tests only prove the mocks were configured correctly.
```

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

####  What is a test double?

<!-- question:start:test-doubles-beginner-q01 -->
<!-- question-id:test-doubles-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A test double is a replacement object used in a test instead of a real dependency. It allows the test to control dependency behavior, avoid slow or unreliable external systems, and focus on the behavior being tested.

Examples include replacing a real email sender with a spy email sender, replacing a payment gateway with a mock, replacing a database repository with a fake repository, or replacing a clock with a fake clock.

Test doubles are useful because unit tests should usually be fast, deterministic, isolated, and safe. A unit test should not send real emails, charge real credit cards, depend on a live database, or call a real third-party API.

##### Key Points to Mention

- A test double stands in for a real dependency.
- It helps tests stay fast, deterministic, and isolated.
- Common types include dummy, stub, fake, mock, and spy.
- Test doubles are useful for unit tests but do not replace all integration tests.

<!-- question:end:test-doubles-beginner-q01 -->

####  What is the difference between a mock and a stub?

<!-- question:start:test-doubles-beginner-q02 -->
<!-- question-id:test-doubles-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A stub provides pre-defined data or behavior to help the system under test execute a scenario. A mock is used to verify that a dependency was called in a certain way.

For example, if a test needs an exchange rate provider to always return `25000`, that is a stub. If a test verifies that `IEmailSender.SendAsync` was called once after an order was completed, that is a mock.

The main difference is that a stub supports the test by providing data, while a mock is part of the assertion because the test checks how it was used.

##### Key Points to Mention

- Stub: provides controlled responses.
- Mock: verifies interactions.
- A mock usually participates in assertions.
- A stub helps arrange a scenario.
- Terminology is sometimes used inconsistently, so intent matters.

<!-- question:end:test-doubles-beginner-q02 -->

####  What is a fake?

<!-- question:start:test-doubles-beginner-q03 -->
<!-- question-id:test-doubles-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A fake is a working but simplified implementation of a dependency. It behaves more like a real dependency than a stub, but it is simpler and safer.

For example, an in-memory user repository can implement `IUserRepository` using a `List<User>`. It can support adding and searching users without using a real database.

Fakes are useful when many tests need the same simple behavior and setting up mocks repeatedly would make tests noisy. However, fakes may not reproduce all real behavior, especially database constraints, transactions, concurrency, or query translation.

##### Key Points to Mention

- A fake is a simplified working implementation.
- It is more behavioral than a simple stub.
- It can reduce repeated mock setup.
- It may not behave exactly like the real dependency.
- Database fakes should not be treated as proof that real database behavior works.

<!-- question:end:test-doubles-beginner-q03 -->

####  What is a spy?

<!-- question:start:test-doubles-beginner-q04 -->
<!-- question-id:test-doubles-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A spy is a test double that records how it was used so the test can inspect the recorded calls later.

For example, a `SpyEmailSender` might store email recipients in a list. After the system under test runs, the test checks whether the expected recipient was recorded.

A spy can be easier to understand than a mocking library when the interaction is simple.

##### Key Points to Mention

- A spy records interactions.
- The test inspects the recorded data afterward.
- It is useful for simple interaction verification.
- It can be hand-written without a mocking library.

<!-- question:end:test-doubles-beginner-q04 -->

####  Why should unit tests avoid real external systems?

<!-- question:start:test-doubles-beginner-q05 -->
<!-- question-id:test-doubles-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Unit tests should usually avoid real external systems because external systems make tests slower, less reliable, harder to set up, and sometimes unsafe.

A unit test that calls a real API may fail because the network is down. A test that sends a real email can annoy users. A test that charges a real payment card is dangerous. A test that depends on a shared database may fail because of data from another test.

Using test doubles allows the test to control dependency behavior and focus on the logic being tested.

##### Key Points to Mention

- Unit tests should be fast and deterministic.
- Real external systems introduce instability.
- Some real actions are unsafe in tests.
- Use test doubles for isolation.
- Use integration tests separately to verify real boundaries.

<!-- question:end:test-doubles-beginner-q05 -->

####  Should every dependency be mocked?

<!-- question:start:test-doubles-beginner-q06 -->
<!-- question-id:test-doubles-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

No. Dependencies should be mocked only when it helps the test. Simple value objects, domain entities, pure functions, and framework behavior often should not be mocked.

Mocking everything can make tests brittle and hard to understand. A better habit is to mock external boundaries, use fakes or stubs for simple controlled behavior, and verify real behavior through integration tests when needed.

##### Key Points to Mention

- Do not mock just because a dependency exists.
- Mock external boundaries and hard-to-control dependencies.
- Prefer real simple objects where possible.
- Over-mocking can make tests brittle.
- Integration tests are needed for real framework and infrastructure behavior.

<!-- question:end:test-doubles-beginner-q06 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

####  When should you use a mock instead of a fake?

<!-- question:start:test-doubles-intermediate-q01 -->
<!-- question-id:test-doubles-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use a mock when the important behavior is an interaction with another component. For example, after an order is completed, the system should send an email, publish an event, write an audit record, or call a payment gateway.

Use a fake when the dependency needs to provide reusable working behavior across tests. For example, a fake repository, fake clock, or fake feature flag provider can be easier to maintain than repeated mock setup.

A mock is better for verifying "this dependency was called correctly." A fake is better for supporting a realistic scenario with simple behavior.

##### Key Points to Mention

- Mock when the interaction is the behavior.
- Fake when reusable simplified behavior is useful.
- Mocks are assertion-focused.
- Fakes are behavior-focused.
- Avoid verifying internal implementation details with mocks.

<!-- question:end:test-doubles-intermediate-q01 -->

####  What does it mean when mocking hides real integration problems?

<!-- question:start:test-doubles-intermediate-q02 -->
<!-- question-id:test-doubles-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Mocking hides real integration problems when the mock behaves in a way that the real dependency does not. The unit test passes because the mock returns the expected value, but the real application fails due to framework behavior, database behavior, serialization, configuration, dependency injection, authentication, authorization, or network behavior.

For example, a mocked repository can return data successfully, but the real EF Core query may fail because a C# method cannot be translated to SQL. A mocked API client can return a valid response, but the real HTTP request may have the wrong JSON body, missing header, wrong base URL, or incorrect timeout configuration.

The solution is not to avoid mocks completely. The solution is to combine mocks with integration tests and contract tests for high-risk boundaries.

##### Key Points to Mention

- Mocks can behave differently from real dependencies.
- Passing mock-based tests does not prove real integration works.
- Common hidden risks include EF Core, HTTP, JSON, DI, security, and configuration.
- Use integration tests for real infrastructure behavior.
- Use contract tests for boundary agreements.

<!-- question:end:test-doubles-intermediate-q02 -->

####  Why is mocking EF Core queries risky?

<!-- question:start:test-doubles-intermediate-q03 -->
<!-- question-id:test-doubles-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Mocking EF Core queries is risky because mocked LINQ or repository methods do not prove that the real query can be translated to SQL or behaves correctly against the real database provider.

EF Core behavior includes query translation, tracking, identity resolution, relationship fix-up, transactions, constraints, concurrency tokens, null semantics, collation, and provider-specific SQL behavior. A mock or simple in-memory fake usually does not reproduce these accurately.

Mocking a repository can be acceptable when testing business logic, but persistence behavior should be tested with integration tests using a relational provider or the actual production database engine in a controlled test environment.

##### Key Points to Mention

- Mocked queries do not validate SQL translation.
- EF Core behavior is provider-dependent.
- In-memory behavior can differ from relational database behavior.
- Business logic can use mocked repositories.
- Repository/query behavior needs integration tests.

<!-- question:end:test-doubles-intermediate-q03 -->

####  What is the difference between state verification and interaction verification?

<!-- question:start:test-doubles-intermediate-q04 -->
<!-- question-id:test-doubles-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

State verification checks the final result or state after the system under test runs. For example, verifying that an order status is `Completed` or that the returned total is `90`.

Interaction verification checks whether a dependency was called in a certain way. For example, verifying that `IEmailSender.SendAsync` was called once with the customer's email address.

State verification is usually less coupled to implementation details and should be preferred when possible. Interaction verification is useful when the interaction itself is the observable behavior, such as sending a message, publishing an event, or calling an external service.

##### Key Points to Mention

- State verification checks outcomes.
- Interaction verification checks collaborator calls.
- Prefer state verification when possible.
- Use interaction verification for important side effects.
- Excessive interaction verification can make tests brittle.

<!-- question:end:test-doubles-intermediate-q04 -->

####  How can ASP.NET Core integration tests use test doubles without losing integration value?

<!-- question:start:test-doubles-intermediate-q05 -->
<!-- question-id:test-doubles-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

ASP.NET Core integration tests can run the real application pipeline with `WebApplicationFactory` and replace only selected services with test doubles. This keeps routing, middleware, model binding, validation, filters, authentication setup, JSON serialization, and dependency injection active, while avoiding unsafe external side effects.

For example, a test can replace `IEmailSender` with a `SpyEmailSender`, while still sending a real HTTP request to the application. This verifies that the endpoint works through the real pipeline and that the application attempted to send an email.

The key is to replace only the boundary that must be controlled, not everything.

##### Key Points to Mention

- Use `WebApplicationFactory` for ASP.NET Core integration tests.
- Replace selected services with fakes, stubs, or spies.
- Keep the real HTTP pipeline active.
- Avoid replacing so much that the test becomes another unit test.
- Useful for testing endpoints, middleware, model binding, validation, and serialization.

<!-- question:end:test-doubles-intermediate-q05 -->

####  What are common signs of over-mocking?

<!-- question:start:test-doubles-intermediate-q06 -->
<!-- question-id:test-doubles-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Common signs of over-mocking include tests that have more mock setup than meaningful assertions, tests that fail after harmless refactoring, tests that verify every internal method call, and tests that duplicate the implementation.

Another sign is when the test passes but gives little confidence that the application works with real infrastructure. For example, a service has high unit-test coverage with mocked repositories, mocked HTTP clients, mocked serializers, and mocked authentication, but no test verifies the actual API endpoint, database query, or JSON contract.

Over-mocking often means the test is too coupled to implementation details or the production code has unclear boundaries.

##### Key Points to Mention

- Excessive setup.
- Brittle tests.
- Verifying internal call order unnecessarily.
- Tests duplicate implementation.
- High coverage but low confidence.
- Missing integration tests for real boundaries.

<!-- question:end:test-doubles-intermediate-q06 -->

####  How do you decide between unit tests and integration tests?

<!-- question:start:test-doubles-intermediate-q07 -->
<!-- question-id:test-doubles-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use unit tests when the goal is to validate business logic quickly and in isolation. Use integration tests when the risk is in how components work together.

For example, use a unit test with a mocked payment gateway to test that an order is rejected when payment fails. Use an integration test to verify that the API endpoint binds the request correctly, validates input, calls the application service, persists data, and serializes the response.

A practical test suite usually has both. Unit tests provide fast feedback. Integration tests provide confidence that real wiring and infrastructure behavior work.

##### Key Points to Mention

- Unit tests are fast and isolated.
- Integration tests verify real collaboration.
- Use unit tests for business rules.
- Use integration tests for database, HTTP, serialization, DI, middleware, and security.
- A healthy test suite combines both.

<!-- question:end:test-doubles-intermediate-q07 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

####  How would you test a service that calls an external payment provider?

<!-- question:start:test-doubles-advanced-q01 -->
<!-- question-id:test-doubles-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

A good approach is to separate application business logic from the external payment integration.

The application layer depends on an interface such as `IPaymentGateway`. Unit tests for the application service can mock or stub `IPaymentGateway` to simulate approved payments, declined payments, timeouts, and provider errors.

The real `PaymentGateway` implementation should have focused integration or contract tests. These tests verify HTTP request construction, headers, authentication, JSON serialization, timeout behavior, status-code mapping, error response parsing, and idempotency behavior. The tests may use a fake HTTP server, sandbox provider, or contract testing tool.

This gives fast unit tests for business decisions and separate integration confidence for the external boundary.

##### Key Points to Mention

- Wrap external provider behind an adapter interface.
- Mock the adapter in business unit tests.
- Test the real adapter separately.
- Verify request/response contracts.
- Include failure cases such as timeouts and declined payments.
- Avoid calling real production payment systems in normal automated tests.

<!-- question:end:test-doubles-advanced-q01 -->

####  Why can high code coverage from mocked tests be misleading?

<!-- question:start:test-doubles-advanced-q02 -->
<!-- question-id:test-doubles-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

High code coverage only means that code was executed by tests. It does not prove that the tests verify meaningful behavior or that the application works with real dependencies.

A suite with many mocks may cover application services but still miss broken dependency injection, invalid EF Core queries, wrong migrations, wrong JSON contracts, missing authorization policies, incorrect middleware ordering, or broken HTTP client configuration.

Coverage is useful as one signal, but it should be combined with test quality, mutation resistance, meaningful assertions, integration tests, contract tests, and production risk analysis.

##### Key Points to Mention

- Coverage measures execution, not confidence.
- Mock-heavy tests can miss real integration failures.
- Meaningful assertions matter more than raw percentage.
- Integration and contract tests complement unit coverage.
- High coverage can still hide low test quality.

<!-- question:end:test-doubles-advanced-q02 -->

####  How do you avoid brittle tests when using mocks?

<!-- question:start:test-doubles-advanced-q03 -->
<!-- question-id:test-doubles-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

To avoid brittle tests, verify behavior rather than implementation details. Keep mock setup minimal and only verify interactions that are part of the observable requirement.

Avoid verifying every repository call, every internal service call, or exact call order unless the order is business-critical. Prefer state-based assertions when possible. Use fakes or builders to reduce repeated setup. If many mocks are required, consider whether the class has too many responsibilities or whether an integration test would be more appropriate.

Mock only stable boundaries. Do not mock simple domain objects or pure calculations.

##### Key Points to Mention

- Verify observable behavior.
- Avoid unnecessary interaction verification.
- Keep setup minimal.
- Prefer state verification where possible.
- Use fakes/builders to reduce noise.
- Refactor overly complex units.

<!-- question:end:test-doubles-advanced-q03 -->

####  How should you test EF Core persistence behavior?

<!-- question:start:test-doubles-advanced-q04 -->
<!-- question-id:test-doubles-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

EF Core persistence behavior should be tested with integration tests when the behavior depends on the database provider. This includes query translation, transactions, unique constraints, foreign keys, concurrency tokens, migrations, raw SQL, cascade deletes, and performance-sensitive queries.

Mocked repositories can test application decisions, but they cannot prove EF Core behavior. The EF Core InMemory provider is useful for simple tests but does not behave like a relational database. For stronger confidence, use SQLite in-memory mode for relational behavior or use the same database engine as production through containers or a dedicated test database.

A repository or query test should execute the real query and assert the result.

##### Key Points to Mention

- Test provider-dependent behavior with a real relational provider.
- Mocking repositories does not validate EF Core queries.
- InMemory provider has important differences from relational databases.
- Use SQLite or the production database engine for higher confidence.
- Include constraints, transactions, and concurrency cases when relevant.

<!-- question:end:test-doubles-advanced-q04 -->

####  How do contract tests relate to mocks?

<!-- question:start:test-doubles-advanced-q05 -->
<!-- question-id:test-doubles-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Mocks define expected behavior inside a test, but they can be wrong if the real dependency behaves differently. Contract tests reduce that risk by verifying the agreement between components at a boundary.

For example, a mock payment provider might return `{ status: "Approved" }`, but the real provider may return `{ result: { code: "APPROVED" } }`. A contract test verifies the real or agreed request and response format so the application does not rely on unrealistic mock behavior.

Contract tests are useful for HTTP APIs, message schemas, event-driven systems, SDK adapters, and frontend/backend API contracts.

##### Key Points to Mention

- Mocks can encode incorrect assumptions.
- Contract tests verify boundary agreements.
- Useful for APIs, messages, and external integrations.
- They complement unit tests.
- They reduce integration surprises.

<!-- question:end:test-doubles-advanced-q05 -->

####  How would you test authorization without hiding real security problems?

<!-- question:start:test-doubles-advanced-q06 -->
<!-- question-id:test-doubles-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

For pure business logic, it can be acceptable to mock a current-user abstraction such as `ICurrentUser`. This helps test decisions based on user ID, tenant ID, role, or permission.

However, endpoint security should also be tested through integration tests using the real ASP.NET Core authorization pipeline. These tests should verify that anonymous users are rejected, users without the required policy are forbidden, and authorized users can access the endpoint.

Mocking authorization everywhere can hide missing `[Authorize]` attributes, wrong policy names, incorrect claim mapping, token validation problems, and middleware ordering issues.

##### Key Points to Mention

- Mock current-user context for business logic tests.
- Use integration tests for real endpoint authorization.
- Verify 401, 403, and success cases.
- Do not rely only on mocked security checks.
- Security behavior belongs in integration tests as well as unit tests.

<!-- question:end:test-doubles-advanced-q06 -->

####  What is a good testing strategy for a Clean Architecture .NET application?

<!-- question:start:test-doubles-advanced-q07 -->
<!-- question-id:test-doubles-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

A good strategy uses different test types at different layers.

Domain tests should usually avoid mocks and test entities, value objects, and domain services directly. Application layer tests can mock ports such as repositories, email senders, payment gateways, event publishers, current-user providers, and clocks. Infrastructure tests should verify real implementations such as EF Core repositories, HTTP clients, file storage, and message publishers. API integration tests should verify routing, middleware, model binding, validation, authorization, dependency injection, and response contracts.

This approach keeps unit tests fast while still proving that real infrastructure and framework behavior work.

##### Key Points to Mention

- Domain tests usually need few or no mocks.
- Application tests mock external ports.
- Infrastructure tests verify real adapters.
- API integration tests verify the real pipeline.
- Use contracts for external boundaries.
- Match test type to risk.

<!-- question:end:test-doubles-advanced-q07 -->

####  What should you do when a test requires many mocks?

<!-- question:start:test-doubles-advanced-q08 -->
<!-- question-id:test-doubles-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

A test that requires many mocks may indicate that the unit under test has too many responsibilities, the test is too broad, or the wrong test type is being used.

Options include refactoring the production code, extracting smaller services, introducing clearer boundaries, using a fake instead of many individual mocks, using a test data builder, or writing an integration test instead of a heavily mocked unit test.

The goal is not to force everything into a unit test. The goal is to get useful feedback with readable and maintainable tests.

##### Key Points to Mention

- Many mocks can indicate poor boundaries.
- Consider refactoring the service.
- Use fakes or builders to simplify setup.
- Consider integration testing if many components must work together.
- Test readability and confidence matter.

<!-- question:end:test-doubles-advanced-q08 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
