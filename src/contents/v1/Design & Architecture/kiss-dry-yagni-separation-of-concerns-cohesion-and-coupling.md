---
id: kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling
topic: Software design principles and common .NET patterns
subtopic: KISS, DRY, YAGNI, Separation of Concerns, Cohesion, and Coupling
category: Design & Architecture
---



## Overview

KISS, DRY, YAGNI, Separation of Concerns, cohesion, and coupling are foundational software design principles used to create systems that are easier to understand, change, test, and maintain. They are not tied to one programming language, but they are especially important in C# and .NET applications because .NET systems often use layered architecture, dependency injection, services, domain models, repositories, controllers, background workers, and integration boundaries.

These principles help answer practical design questions:

- Should this code be simpler?
- Is this abstraction needed now?
- Is this logic duplicated in multiple places?
- Does this class have too many responsibilities?
- Are unrelated concerns mixed together?
- Is this module easy to change without breaking others?
- Are these components too dependent on each other?
- Should this behavior be extracted, injected, composed, or left inline?
- Is this "clean architecture" or just unnecessary indirection?

The principles are:

- **KISS**: Keep It Simple. Prefer the simplest design that clearly solves the current problem.
- **DRY**: Don't Repeat Yourself. Avoid duplicated knowledge and business rules.
- **YAGNI**: You Aren't Gonna Need It. Do not build speculative functionality before it is actually needed.
- **Separation of Concerns**: Separate code by responsibility so each part handles a distinct concern.
- **Cohesion**: Keep related behavior and data together.
- **Coupling**: Minimize unnecessary dependencies between components.

These principles matter because most software cost comes after the first version is written. Real systems change constantly: requirements evolve, bugs are fixed, APIs are extended, databases are migrated, frameworks are upgraded, and teams grow. Code that is simple, cohesive, well-separated, and loosely coupled is easier to modify safely.

In interviews, these principles are important because they test design judgment. A candidate should not only define the acronyms but also explain trade-offs. For example, DRY is good when removing duplicated business knowledge, but harmful when it creates a fake abstraction between two pieces of code that only look similar today. YAGNI prevents over-engineering, but it should not be used as an excuse to ignore known scalability, security, or maintainability requirements. KISS favors simplicity, but not simplistic designs that hide real complexity or ignore production concerns.

A strong interview answer should show balance:

```text
Good design is not about applying every principle mechanically.
Good design is about using principles to manage change, reduce risk, and keep the system understandable.
```

## Core Concepts

### Why These Principles Matter

Software design principles exist because code is read, changed, extended, debugged, tested, and operated many more times than it is first written.

Poor design often causes:

- Slow feature delivery.
- Fragile changes.
- Duplicate bugs.
- Hard-to-test classes.
- Large pull requests.
- Confusing dependencies.
- Hidden side effects.
- Circular references.
- Repeated business logic.
- Over-engineered abstractions.
- Difficult onboarding.
- Expensive maintenance.
- Production incidents.

Good design aims for:

- Simplicity.
- Clarity.
- Maintainability.
- Testability.
- Local reasoning.
- Replaceable components.
- Clear boundaries.
- Reduced duplication.
- Controlled dependencies.
- Appropriate abstraction.
- Faster and safer change.

These principles work together. For example:

```text
KISS helps avoid unnecessary complexity.
YAGNI helps avoid unnecessary features and abstractions.
DRY helps avoid duplicated knowledge.
Separation of Concerns helps divide responsibilities.
High cohesion keeps related code together.
Low coupling keeps unrelated code independent.
```

They are heuristics, not laws. A good developer knows when to apply them and when a trade-off is justified.

### KISS: Keep It Simple

KISS means prefer a simple, clear solution over a complex one when both solve the problem correctly.

Simple does not mean careless. It means:

- Easy to understand.
- Easy to test.
- Easy to change.
- Direct enough for the current requirement.
- Free from unnecessary abstractions.
- Free from unnecessary layers.
- Free from clever tricks.
- Clear to the next developer.

Bad example: over-engineered validation

```csharp
public interface IRule<T>
{
    bool IsSatisfiedBy(T value);
}

public sealed class RuleEngine<T>
{
    private readonly IEnumerable<IRule<T>> _rules;

    public RuleEngine(IEnumerable<IRule<T>> rules)
    {
        _rules = rules;
    }

    public bool Validate(T value)
    {
        return _rules.All(rule => rule.IsSatisfiedBy(value));
    }
}

public sealed class EmailContainsAtSymbolRule : IRule<string>
{
    public bool IsSatisfiedBy(string value)
    {
        return value.Contains('@');
    }
}
```

For one simple validation, this may be too much.

Simpler:

```csharp
public static bool IsValidEmail(string email)
{
    return !string.IsNullOrWhiteSpace(email)
        && email.Contains('@');
}
```

If the application later needs dynamic, configurable, database-driven validation rules, a rule engine might become justified. But building it too early adds unnecessary complexity.

KISS in .NET examples:

- Use a normal service class before introducing a complex framework.
- Use an enum before creating a hierarchy of strategy classes if behavior does not vary.
- Use a simple query before introducing CQRS read models.
- Use a modular monolith before microservices if independent deployment is not needed.
- Use standard ASP.NET Core features before custom middleware or filters.
- Use built-in dependency injection before introducing a third-party container.

Best practices:

- Prefer readable code over clever code.
- Use standard framework features where they fit.
- Avoid unnecessary layers.
- Avoid abstractions without a clear reason.
- Keep methods focused and understandable.
- Favor explicit business logic over hidden magic.
- Optimize only when there is evidence or a known requirement.

### KISS Trade-Offs

KISS is not an excuse to ignore real requirements.

Too simple:

```csharp
public async Task CreateOrderAsync(Order order)
{
    await _dbContext.Orders.AddAsync(order);
    await _dbContext.SaveChangesAsync();

    await _emailSender.SendAsync(order.CustomerEmail, "Order created", "...");
}
```

This may be fine for a small internal app. But for a production checkout system, it may be too simplistic because:

- Email sending failure could break order creation.
- There is no retry.
- There is no outbox.
- There is no idempotency.
- There is no transaction boundary discussion.
- There is no observability.
- There is no failure strategy.

A better production design may separate order creation from notification:

```csharp
public async Task<Guid> CreateOrderAsync(
    CreateOrderCommand command,
    CancellationToken cancellationToken)
{
    var order = Order.Create(command.CustomerId, command.Items);

    _dbContext.Orders.Add(order);
    _dbContext.OutboxMessages.Add(OutboxMessage.OrderCreated(order.Id));

    await _dbContext.SaveChangesAsync(cancellationToken);

    return order.Id;
}
```

This is more complex, but the complexity is justified if reliable asynchronous notification is a requirement.

Good KISS thinking:

```text
Use the simplest design that satisfies the real requirements.
Do not confuse simple with incomplete.
Do not confuse complex with professional.
```

### DRY: Don't Repeat Yourself

DRY means every piece of knowledge should have a single, authoritative representation in the system.

The key word is **knowledge**. DRY is not just about removing similar-looking lines of code. It is about avoiding duplicated business rules, calculations, constants, mappings, policies, and concepts.

Bad DRY violation: duplicated tax calculation

```csharp
public decimal CalculateInvoiceTotal(Invoice invoice)
{
    var tax = invoice.Subtotal * 0.08m;
    return invoice.Subtotal + tax;
}

public decimal CalculateOrderTotal(Order order)
{
    var tax = order.Subtotal * 0.08m;
    return order.Subtotal + tax;
}
```

If the tax rate changes, both places must be updated. One might be missed.

Better:

```csharp
public interface ITaxCalculator
{
    decimal CalculateTax(decimal taxableAmount);
}

public sealed class TaxCalculator : ITaxCalculator
{
    private readonly TaxOptions _options;

    public TaxCalculator(IOptions<TaxOptions> options)
    {
        _options = options.Value;
    }

    public decimal CalculateTax(decimal taxableAmount)
    {
        return taxableAmount * _options.Rate;
    }
}
```

Now the tax rule is centralized.

DRY applies to:

- Business rules.
- Validation rules.
- Mapping rules.
- Permission checks.
- Constants and configuration.
- Error response formatting.
- Audit logic.
- Calculation logic.
- Integration policies.
- Query filters.
- Repeated UI behavior.
- Test data builders.

DRY benefits:

- Fewer inconsistent changes.
- Fewer duplicate bugs.
- Easier updates.
- Clearer source of truth.
- Reduced maintenance cost.

### DRY vs Coincidental Duplication

A common mistake is applying DRY too aggressively.

Two pieces of code may look the same today but represent different business concepts.

Bad abstraction:

```csharp
public static class PersonNameFormatter
{
    public static string Format(string firstName, string lastName)
    {
        return $"{lastName}, {firstName}";
    }
}
```

This is used for:

- Legal documents.
- Internal admin display.
- Marketing emails.
- Search index display.

At first, all formats are the same. Later:

- Legal documents need official name order.
- Marketing emails need friendly first-name display.
- Search needs normalized text.
- Admin display needs "Last, First".

If all consumers share the same abstraction, unrelated changes become risky.

Better:

```csharp
public sealed class LegalNameFormatter
{
    public string Format(Customer customer)
    {
        return $"{customer.LastName}, {customer.FirstName}";
    }
}

public sealed class MarketingNameFormatter
{
    public string Format(Customer customer)
    {
        return customer.FirstName;
    }
}
```

This may duplicate some code, but it separates business concepts.

Rule of thumb:

```text
DRY should remove duplicated knowledge, not force unrelated concepts into the same abstraction.
```

Duplication can be acceptable when:

- Requirements are likely to diverge.
- The code is small and clearer when local.
- The shared abstraction would be hard to name.
- The abstraction depends on too many options.
- The code duplication is accidental but the concepts are different.
- A wrong shared abstraction would increase coupling.

### YAGNI: You Aren't Gonna Need It

YAGNI means do not build functionality, abstraction, or flexibility before there is a real need.

Bad YAGNI violation:

```csharp
public interface IUserRepositoryFactoryProviderStrategy
{
    IUserRepository CreateRepository(UserRepositoryMode mode);
}
```

If the application has one database and one repository implementation, this may be unnecessary.

Simpler:

```csharp
public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
}
```

YAGNI helps prevent:

- Speculative features.
- Unused extension points.
- Unnecessary abstractions.
- Complex configuration systems.
- Unneeded plugin architectures.
- Premature microservices.
- Premature performance optimization.
- Generic frameworks built for imagined use cases.
- Large designs based on uncertain future requirements.

YAGNI does not mean ignoring known requirements. If security, audit logging, scalability, or compliance is already required, designing for it is not speculative.

Good YAGNI thinking:

```text
Build for current confirmed requirements.
Leave the design clean enough to change later.
Do not implement hypothetical features just because they might be needed someday.
```

### YAGNI vs Extensibility

YAGNI and extensibility can appear to conflict.

Suppose you currently support one payment provider.

Over-engineered:

```csharp
public interface IPaymentProviderResolver
{
    IPaymentProvider Resolve(PaymentProviderType providerType);
}

public interface IPaymentProviderPlugin
{
    string ProviderName { get; }
    Task<PaymentResult> ProcessAsync(PaymentRequest request);
}

public sealed class PaymentProviderPluginRegistry
{
    // Complex dynamic plugin loading
}
```

If only one provider is needed and no requirement says more are coming, this is probably premature.

Reasonable design:

```csharp
public interface IPaymentGateway
{
    Task<PaymentResult> ProcessAsync(
        PaymentRequest request,
        CancellationToken cancellationToken);
}

public sealed class StripePaymentGateway : IPaymentGateway
{
    public Task<PaymentResult> ProcessAsync(
        PaymentRequest request,
        CancellationToken cancellationToken)
    {
        // Stripe implementation
        return Task.FromResult(PaymentResult.Success());
    }
}
```

This is still extensible enough: the application depends on `IPaymentGateway`, but it does not build a full plugin platform.

Balanced approach:

- Do not build future features.
- Do keep boundaries clean.
- Do use simple abstractions at real external boundaries.
- Do not create generic frameworks without evidence.
- Do not make future change impossible.

### Separation of Concerns

Separation of Concerns means separating a system into distinct parts where each part handles a specific responsibility or concern.

A concern is an area of responsibility, such as:

- UI rendering.
- HTTP request handling.
- Business logic.
- Validation.
- Persistence.
- Authentication.
- Authorization.
- Logging.
- Caching.
- Messaging.
- Error handling.
- Configuration.
- External service integration.
- Domain rules.

Bad separation:

```csharp
[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly SmtpClient _smtpClient;

    public OrdersController(AppDbContext dbContext, SmtpClient smtpClient)
    {
        _dbContext = dbContext;
        _smtpClient = smtpClient;
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateOrderRequest request)
    {
        if (request.Items.Count == 0)
            return BadRequest("Order must contain items.");

        var order = new Order
        {
            CustomerId = request.CustomerId,
            Status = "Created"
        };

        _dbContext.Orders.Add(order);
        await _dbContext.SaveChangesAsync();

        await _smtpClient.SendMailAsync(
            "sales@example.com",
            request.CustomerEmail,
            "Order created",
            "Your order was created.");

        return Ok(order.Id);
    }
}
```

This controller handles HTTP, validation, business rules, persistence, email sending, and response formatting.

Better separation:

```csharp
[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    private readonly ICreateOrderHandler _handler;

    public OrdersController(ICreateOrderHandler handler)
    {
        _handler = handler;
    }

    [HttpPost]
    public async Task<ActionResult<CreateOrderResponse>> Create(
        CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _handler.HandleAsync(request, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = response.OrderId }, response);
    }
}
```

Application service:

```csharp
public sealed class CreateOrderHandler : ICreateOrderHandler
{
    private readonly AppDbContext _dbContext;
    private readonly IOutboxWriter _outboxWriter;

    public CreateOrderHandler(
        AppDbContext dbContext,
        IOutboxWriter outboxWriter)
    {
        _dbContext = dbContext;
        _outboxWriter = outboxWriter;
    }

    public async Task<CreateOrderResponse> HandleAsync(
        CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var order = Order.Create(request.CustomerId, request.Items);

        _dbContext.Orders.Add(order);
        _outboxWriter.Add(OrderCreatedEvent.From(order));

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new CreateOrderResponse(order.Id);
    }
}
```

The controller handles HTTP. The handler handles the use case. The entity handles business invariants. The infrastructure handles persistence and messaging.

### Separation of Concerns in .NET Architecture

In .NET applications, Separation of Concerns often appears as layers or projects.

Example structure:

```text
MyApp.Api
  Controllers
  Middleware
  Authentication setup
  OpenAPI setup

MyApp.Application
  Use cases
  Commands and queries
  Validators
  Interfaces for infrastructure

MyApp.Domain
  Entities
  Value objects
  Domain services
  Domain events
  Business rules

MyApp.Infrastructure
  EF Core DbContext
  Repositories
  External API clients
  Email providers
  Message brokers
```

This separation helps keep the system maintainable:

- API layer should not contain complex business rules.
- Domain layer should not depend on EF Core or HTTP.
- Application layer orchestrates use cases.
- Infrastructure layer implements external details.
- Tests can focus on each concern separately.

Separation of Concerns is also used inside frontend applications:

```text
Components: rendering and user interaction
Hooks: reusable stateful logic
Services/API clients: HTTP calls
State management: application state
Utilities: pure helper functions
```

### Cohesion

Cohesion describes how closely related the responsibilities inside a module, class, method, or component are.

High cohesion means a class or module has responsibilities that belong together.

Low cohesion means a class or module contains unrelated responsibilities.

Low cohesion example:

```csharp
public class UserManager
{
    public void RegisterUser() { }
    public void SendEmail() { }
    public void GeneratePdfReport() { }
    public void BackupDatabase() { }
    public void CalculateTax() { }
}
```

This class has unrelated responsibilities. It is hard to name, hard to test, and likely changes for many reasons.

Higher cohesion:

```csharp
public class UserRegistrationService
{
    public Task RegisterAsync(RegisterUserRequest request)
    {
        // Registration workflow
        return Task.CompletedTask;
    }
}

public class EmailSender
{
    public Task SendAsync(EmailMessage message)
    {
        // Email infrastructure
        return Task.CompletedTask;
    }
}

public class TaxCalculator
{
    public decimal CalculateTax(decimal amount)
    {
        return amount * 0.08m;
    }
}
```

Each class has a focused purpose.

Signs of high cohesion:

- The class has a clear name.
- Most methods use the same fields.
- Responsibilities are related.
- The class has one main reason to change.
- Tests are easy to describe.
- The public API feels consistent.
- It is easy to explain what the class does.

Signs of low cohesion:

- Class name is vague, such as `Manager`, `Helper`, `Processor`, or `Utility`.
- Methods are unrelated.
- The class has many dependencies.
- The class changes for unrelated reasons.
- Tests require lots of setup.
- Developers keep adding random methods to it.

### Coupling

Coupling describes how dependent one component is on another.

High coupling means a change in one component is likely to affect another. Low coupling means components can change independently.

High coupling example:

```csharp
public class OrderService
{
    private readonly SqlConnection _connection = new(
        "Server=.;Database=AppDb;Trusted_Connection=True;");

    private readonly SmtpClient _smtpClient = new("smtp.example.com");

    public void CreateOrder(Order order)
    {
        // Direct SQL and SMTP logic
    }
}
```

This service is tightly coupled to:

- SQL Server.
- A hard-coded connection string.
- SMTP.
- Infrastructure details.
- Concrete implementations.

Lower coupling:

```csharp
public class OrderService
{
    private readonly IOrderRepository _orders;
    private readonly IMessagePublisher _publisher;

    public OrderService(
        IOrderRepository orders,
        IMessagePublisher publisher)
    {
        _orders = orders;
        _publisher = publisher;
    }

    public async Task CreateOrderAsync(
        Order order,
        CancellationToken cancellationToken)
    {
        await _orders.AddAsync(order, cancellationToken);
        await _publisher.PublishAsync(new OrderCreated(order.Id), cancellationToken);
    }
}
```

This service depends on abstractions. Infrastructure can change without changing `OrderService`.

Types of coupling:

| Type | Meaning |
|---|---|
| Concrete coupling | A class directly depends on a concrete implementation |
| Temporal coupling | Operations must be called in a specific order |
| Data coupling | Components depend on specific data structures |
| Control coupling | One component tells another how to behave through flags |
| Content coupling | One component reaches into another's internal details |
| Deployment coupling | Components must be deployed together |
| Runtime coupling | Components depend on each other at runtime |
| Schema coupling | Components depend on database schema or message format |

Not all coupling is bad. Some coupling is necessary. The goal is to avoid unnecessary and harmful coupling.

### High Cohesion and Low Coupling

High cohesion and low coupling are often used together.

Good design goal:

```text
Inside a module: related things are together.
Between modules: dependencies are minimal and explicit.
```

Example:

```text
Order module:
- Order entity
- Order service
- Order repository interface
- Order validators
- Order use cases

Payment module:
- Payment gateway interface
- Payment service
- Payment result models
- Payment provider implementation
```

The order module is cohesive because it contains order-related behavior. It is loosely coupled to payment if it depends on a small abstraction such as `IPaymentGateway`.

Benefits:

- Easier testing.
- Easier refactoring.
- Easier feature changes.
- Easier team ownership.
- Smaller blast radius.
- Better readability.
- Better architecture boundaries.

Common mistake:

```text
Low coupling does not mean no coupling.
```

A useful system must have dependencies. The goal is controlled, intentional coupling.

### Cohesion vs Separation of Concerns

Cohesion and Separation of Concerns are related but not identical.

Separation of Concerns asks:

```text
Are different responsibilities separated?
```

Cohesion asks:

```text
Do the responsibilities inside this unit belong together?
```

Example:

```text
A controller that handles HTTP, validation, persistence, and email sending violates Separation of Concerns.
A utility class containing unrelated date, tax, email, and file methods has low cohesion.
```

Good design uses both:

- Separate unrelated concerns.
- Keep related responsibilities together.

Too much separation can reduce cohesion if a single concept is scattered across too many tiny files. Too little separation can create God classes.

### DRY vs Separation of Concerns

DRY and Separation of Concerns can conflict.

Example:

```csharp
public class CustomerValidator
{
    public bool IsValidEmail(string email)
    {
        return email.Contains('@');
    }
}

public class EmployeeValidator
{
    public bool IsValidEmail(string email)
    {
        return email.Contains('@');
    }
}
```

This looks duplicated. But customer email validation and employee email validation may diverge. Employee emails may require `@company.com`, while customers can use any address.

Premature DRY abstraction:

```csharp
public class UniversalEmailValidator
{
    public bool IsValid(string email)
    {
        return email.Contains('@');
    }
}
```

Later it gains flags:

```csharp
public bool IsValid(
    string email,
    bool requireCompanyDomain,
    bool allowDisposableDomains,
    bool requireVerifiedDomain)
```

This abstraction becomes less cohesive and more coupled to multiple concerns.

Better:

```csharp
public class CustomerEmailValidator
{
    public bool IsValid(string email)
    {
        return email.Contains('@');
    }
}

public class EmployeeEmailValidator
{
    public bool IsValid(string email)
    {
        return email.EndsWith("@company.com", StringComparison.OrdinalIgnoreCase);
    }
}
```

DRY should not merge separate concerns just because code looks similar.

### KISS vs DRY

KISS and DRY can conflict when removing duplication requires complex abstraction.

Duplicated but clear:

```csharp
public decimal CalculateRegularCustomerDiscount(decimal amount)
{
    return amount * 0.05m;
}

public decimal CalculatePremiumCustomerDiscount(decimal amount)
{
    return amount * 0.10m;
}
```

Possible over-abstracted DRY:

```csharp
public decimal CalculateDiscount(
    decimal amount,
    DiscountCalculationMode mode,
    CustomerTier tier,
    Campaign campaign,
    DateTime date)
{
    // Many conditional branches
}
```

The abstraction may be technically DRY but less simple.

Balanced design:

```csharp
public interface IDiscountPolicy
{
    decimal CalculateDiscount(decimal amount);
}

public sealed class RegularCustomerDiscountPolicy : IDiscountPolicy
{
    public decimal CalculateDiscount(decimal amount) => amount * 0.05m;
}

public sealed class PremiumCustomerDiscountPolicy : IDiscountPolicy
{
    public decimal CalculateDiscount(decimal amount) => amount * 0.10m;
}
```

This is justified if discount policies vary and are selected polymorphically. If there are only two simple calculations and no variation, the original simple functions may be enough.

Rule:

```text
Do not remove duplication by creating a more confusing design.
```

### YAGNI vs DRY

DRY can tempt developers to create abstractions early. YAGNI asks whether the abstraction is needed now.

Example:

```text
Two controllers have similar filtering logic.
```

Options:

1. Keep duplication for now.
2. Extract a helper method.
3. Create a generic query framework.
4. Introduce a full specification pattern.

YAGNI suggests choosing the smallest useful extraction, not the most flexible future-proof framework.

Practical decision:

- If the duplication is small and likely to diverge, keep it.
- If it is a repeated business rule, centralize it.
- If it is repeated infrastructure behavior, extract it.
- If the abstraction is hard to name, wait.
- If a third example appears with the same concept, extraction may be clearer.

A common heuristic is the "rule of three": tolerate some duplication until a stable pattern emerges.

### Separation of Concerns vs Over-Layering

Separation of Concerns can be overused.

Over-layered example:

```text
OrderController
OrderControllerHelper
OrderRequestMapper
OrderApplicationFacade
OrderCommandFactory
OrderCommandHandler
OrderDomainService
OrderRepositoryWrapper
OrderRepository
OrderDataAccessor
OrderDbContext
```

If each layer only passes data to the next layer without adding meaningful responsibility, the design may be unnecessarily complex.

A simpler design may be better:

```text
OrderController
CreateOrderHandler
Order entity
AppDbContext
```

Good separation means each layer has a real responsibility.

Questions to ask:

- Does this layer hide useful complexity?
- Does this abstraction protect a boundary?
- Does it improve testability?
- Does it reduce coupling?
- Does it represent a real business or technical concern?
- Would removing it make the code clearer?

Do not add layers only to look architectural.

### Coupling Through Shared Models

Shared models can create hidden coupling.

Example:

```csharp
public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsAdmin { get; set; }
}
```

If the same `User` class is used for:

- EF Core persistence.
- API response.
- frontend model.
- authentication token.
- audit log.
- message contract.

Then changing the class can break many consumers.

Better:

```csharp
public class UserEntity
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
}

public record UserResponse(Guid Id, string Email);

public record UserCreatedEvent(Guid UserId, string Email);
```

This duplicates some fields, but reduces coupling between persistence, API, and messaging concerns.

DRY should not force all layers to share one model. In many systems, separate models improve separation and reduce coupling.

### Temporal Coupling

Temporal coupling occurs when methods must be called in a specific order for an object to work correctly.

Bad:

```csharp
public class ReportBuilder
{
    public void LoadData() { }
    public void CalculateTotals() { }
    public void RenderPdf() { }
    public void SaveFile() { }
}
```

If callers must remember the exact order, the class is fragile.

Better:

```csharp
public class ReportGenerator
{
    public async Task<ReportFile> GenerateAsync(
        ReportRequest request,
        CancellationToken cancellationToken)
    {
        var data = await LoadDataAsync(request, cancellationToken);
        var totals = CalculateTotals(data);
        var pdf = RenderPdf(data, totals);

        return await SaveFileAsync(pdf, cancellationToken);
    }
}
```

Now the order is controlled inside the class.

Temporal coupling is sometimes necessary, but it should be explicit and safe.

Strategies:

- Use constructors to require needed dependencies.
- Use methods that represent complete operations.
- Avoid partially initialized objects.
- Use immutable types.
- Use state machines for complex workflows.
- Hide ordering inside a cohesive service.

### Control Coupling

Control coupling occurs when one method passes flags that control another method's internal behavior.

Bad:

```csharp
public decimal CalculatePrice(Order order, bool includeTax, bool applyDiscount, bool usePremiumRules)
{
    // Many branches
}
```

This method has too many modes and likely too many responsibilities.

Better:

```csharp
public interface IPricingPolicy
{
    decimal Calculate(Order order);
}

public sealed class StandardPricingPolicy : IPricingPolicy
{
    public decimal Calculate(Order order)
    {
        return order.Subtotal + order.Tax;
    }
}

public sealed class PremiumPricingPolicy : IPricingPolicy
{
    public decimal Calculate(Order order)
    {
        return (order.Subtotal * 0.9m) + order.Tax;
    }
}
```

Or if the logic is simple, use separate explicit methods:

```csharp
public decimal CalculateStandardPrice(Order order) { }
public decimal CalculatePremiumPrice(Order order) { }
```

Flags are not always bad, but many flags can indicate missing separation or low cohesion.

### Coupling Through Static State

Static state can tightly couple code to global mutable data.

Bad:

```csharp
public static class CurrentTenant
{
    public static string TenantId { get; set; } = string.Empty;
}
```

Problems:

- Hard to test.
- Unsafe with concurrent requests.
- Hidden dependency.
- Data can leak between requests.
- Difficult to reason about.

Better:

```csharp
public interface ITenantContext
{
    string TenantId { get; }
}

public sealed class TenantContext : ITenantContext
{
    public string TenantId { get; }

    public TenantContext(IHttpContextAccessor httpContextAccessor)
    {
        TenantId = httpContextAccessor.HttpContext?
            .User
            .FindFirst("tenant_id")?
            .Value ?? throw new InvalidOperationException("Tenant is missing.");
    }
}
```

The dependency is now explicit and can be replaced in tests.

Static methods are fine for pure utility logic. Static mutable state should be avoided unless carefully designed.

### Coupling and Dependency Injection

Dependency injection helps reduce concrete coupling by providing dependencies from the outside.

Tightly coupled:

```csharp
public class InvoiceService
{
    private readonly SmtpEmailSender _emailSender = new();

    public Task SendInvoiceAsync(Invoice invoice)
    {
        return _emailSender.SendAsync(invoice.CustomerEmail, "Invoice", "...");
    }
}
```

Loosely coupled:

```csharp
public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken);
}

public class InvoiceService
{
    private readonly IEmailSender _emailSender;

    public InvoiceService(IEmailSender emailSender)
    {
        _emailSender = emailSender;
    }

    public Task SendInvoiceAsync(
        Invoice invoice,
        CancellationToken cancellationToken)
    {
        return _emailSender.SendAsync(
            invoice.CustomerEmail,
            "Invoice",
            "...",
            cancellationToken);
    }
}
```

Registration:

```csharp
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<InvoiceService>();
```

Benefits:

- Easier unit testing.
- Easier replacement.
- Clear dependencies.
- Better separation of business and infrastructure concerns.

Trade-off:

- Too many interfaces can create noise.
- Not every class needs an interface.
- Use interfaces for meaningful boundaries, not mechanically.

### Design Principles in Clean Architecture

These principles align well with Clean Architecture.

Typical Clean Architecture dependency direction:

```text
API -> Application -> Domain
Infrastructure -> Application
```

The domain layer should not depend on infrastructure. Application logic depends on abstractions. Infrastructure implements those abstractions.

Example:

```csharp
public interface IOrderRepository
{
    Task AddAsync(Order order, CancellationToken cancellationToken);
}
```

Application service:

```csharp
public sealed class CreateOrderHandler
{
    private readonly IOrderRepository _orders;

    public CreateOrderHandler(IOrderRepository orders)
    {
        _orders = orders;
    }

    public async Task<Guid> HandleAsync(
        CreateOrderCommand command,
        CancellationToken cancellationToken)
    {
        var order = Order.Create(command.CustomerId, command.Items);

        await _orders.AddAsync(order, cancellationToken);

        return order.Id;
    }
}
```

Infrastructure implementation:

```csharp
public sealed class EfOrderRepository : IOrderRepository
{
    private readonly AppDbContext _context;

    public EfOrderRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(Order order, CancellationToken cancellationToken)
    {
        _context.Orders.Add(order);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
```

Principle mapping:

- Separation of Concerns: API, application, domain, and infrastructure have different roles.
- Low coupling: application depends on repository abstraction, not EF Core implementation.
- High cohesion: order use case stays focused.
- DRY: order creation rules live in one place.
- KISS/YAGNI: avoid adding unnecessary layers beyond the project needs.

### Design Principles in ASP.NET Core APIs

Bad API design with mixed concerns:

```csharp
[HttpPost]
public async Task<IActionResult> Register(RegisterUserRequest request)
{
    if (string.IsNullOrWhiteSpace(request.Email))
        return BadRequest("Email is required.");

    var exists = await _dbContext.Users.AnyAsync(u => u.Email == request.Email);

    if (exists)
        return Conflict("Email already exists.");

    var user = new User { Email = request.Email };
    user.PasswordHash = BCrypt.HashPassword(request.Password);

    _dbContext.Users.Add(user);
    await _dbContext.SaveChangesAsync();

    await _emailSender.SendAsync(request.Email, "Welcome", "Hello");

    return Ok();
}
```

Better separation:

```csharp
[HttpPost]
public async Task<ActionResult<RegisterUserResponse>> Register(
    RegisterUserRequest request,
    CancellationToken cancellationToken)
{
    var response = await _registerUserHandler.HandleAsync(
        request,
        cancellationToken);

    return CreatedAtAction(nameof(GetById), new { id = response.UserId }, response);
}
```

The handler owns the use case. Validators own validation. Domain models own business rules. Infrastructure owns persistence and email.

This makes the controller small and cohesive.

### Design Principles in EF Core Code

DRY and Separation of Concerns are important in EF Core.

Bad: duplicated query filters

```csharp
var activeCustomers = await context.Customers
    .Where(c => !c.IsDeleted && c.TenantId == tenantId)
    .ToListAsync();

var customer = await context.Customers
    .Where(c => !c.IsDeleted && c.TenantId == tenantId)
    .SingleAsync(c => c.Id == id);
```

Possible improvement with global query filters:

```csharp
modelBuilder.Entity<Customer>()
    .HasQueryFilter(c => !c.IsDeleted);
```

But be careful. Tenant filters may need request context and explicit behavior.

Good separation:

- Keep EF Core mapping in infrastructure.
- Keep business rules in domain/application logic.
- Use projections for API DTOs.
- Avoid exposing EF entities directly as API models.
- Avoid putting complex HTTP-specific logic inside entities.

KISS reminder: do not add a repository layer only because every project uses one. If EF Core already provides the abstraction you need and the application is simple, direct DbContext use in application handlers may be acceptable. If you need a boundary for tests, domain separation, or persistence replacement, a repository can be justified.

### Design Principles in React and Frontend Code

Although the topic is design architecture, the same principles apply to React.

Low cohesion component:

```tsx
function Dashboard() {
  // fetches users
  // fetches orders
  // handles filters
  // renders charts
  // validates forms
  // manages modal state
  // formats currency
  // exports PDF
}
```

Better separation:

```text
DashboardPage
  useDashboardData
  DashboardFilters
  OrdersChart
  RevenueSummaryCard
  ExportReportButton
  formatCurrency utility
```

DRY applies to repeated UI behavior. YAGNI warns against building a generic component library too early. KISS favors readable components over clever abstractions. Cohesion keeps related rendering and state together. Low coupling avoids components depending on unrelated global state.

### Practical Refactoring Signals

Look for these signals:

#### KISS Signals

- Code is hard to explain.
- There are many layers that only pass data through.
- A simple feature requires changing many files.
- Generic code has type parameters and options no one uses.
- Developers avoid changing the code because it feels clever.

#### DRY Signals

- Same business rule appears in multiple places.
- Same validation logic is repeated.
- Bug fix must be copied to multiple files.
- Constants are duplicated.
- Similar mapping code keeps drifting.

#### YAGNI Signals

- Code supports features not in the backlog.
- There are unused interfaces or implementations.
- Configuration options are never changed.
- Extension points have only one user and no known second user.
- A framework is being built before the product needs it.

#### Separation of Concerns Signals

- Controllers contain business logic.
- Entities contain infrastructure concerns.
- Services directly know about UI details.
- Persistence models are exposed directly as API contracts.
- Logging, validation, persistence, and business rules are mixed.

#### Cohesion Signals

- Class name is vague.
- Methods are unrelated.
- Class has many dependencies.
- The class changes for many different reasons.
- Tests require complex setup unrelated to the behavior under test.

#### Coupling Signals

- Changing one class forces many unrelated changes.
- Code uses concrete infrastructure types everywhere.
- Circular dependencies exist.
- Static global state is used.
- Shared models are used across too many boundaries.
- Tests require real external services.

### Common Mistakes

Common mistakes include:

- Treating KISS as an excuse for incomplete production design.
- Treating DRY as "never repeat any line of code."
- Creating abstractions before the business concept is stable.
- Using YAGNI to ignore known requirements.
- Splitting code into too many layers with no clear responsibility.
- Putting business logic in controllers.
- Exposing EF Core entities directly from APIs.
- Creating one large utility or manager class.
- Using interfaces for every class even when there is no boundary.
- Using inheritance for code reuse when composition is better.
- Sharing one model across database, API, UI, and messaging layers.
- Creating generic frameworks for simple application needs.
- Overusing static mutable state.
- Accepting circular dependencies between projects.
- Confusing low coupling with no dependencies at all.
- Optimizing for theoretical future changes while making current code harder.
- Removing duplication too early and creating a wrong abstraction.
- Keeping duplication too long when it represents the same business rule.

### Best Practices

Use KISS to keep the design understandable.

Use DRY to remove duplicated business knowledge, not every similar line.

Use YAGNI to avoid speculative features and abstractions.

Use Separation of Concerns to define clear responsibilities and boundaries.

Aim for high cohesion inside classes, modules, and services.

Aim for low coupling between classes, modules, layers, and services.

Prefer composition over inheritance for flexible behavior reuse.

Depend on abstractions at real boundaries.

Avoid unnecessary abstractions inside simple local code.

Keep controllers thin and use services or handlers for use cases.

Keep domain rules close to the domain model or application logic that owns them.

Avoid shared models across unrelated boundaries when independent change matters.

Make dependencies explicit through constructors.

Avoid static mutable state.

Refactor when duplication becomes stable and meaningful.

Do not refactor only to satisfy a slogan.

Choose the design that best supports current requirements while keeping future change possible.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q01 -->
#### Beginner Q01: What does KISS mean in software design?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

KISS means "Keep It Simple." In software design, it means choosing the simplest design that clearly satisfies the current requirements. Simple code is easier to read, test, debug, maintain, and change.

KISS does not mean ignoring real production needs. It means avoiding unnecessary complexity, unnecessary abstractions, clever tricks, and over-engineered solutions when a direct solution is enough.

##### Key Points to Mention

- KISS means keep the design simple and understandable.
- Simple does not mean incomplete or careless.
- Avoid unnecessary layers and abstractions.
- Prefer readable code over clever code.
- The design must still satisfy real requirements.
- KISS reduces maintenance cost.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q01 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q02 -->
#### Beginner Q02: What does DRY mean?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

DRY means "Don't Repeat Yourself." It means that important knowledge, rules, and decisions should have a single authoritative place in the system.

For example, if tax calculation logic is duplicated in several services, a rule change may be applied in one place but forgotten in another. Centralizing that logic reduces inconsistent behavior.

DRY is mainly about avoiding duplicated knowledge, not blindly removing every similar-looking line of code.

##### Key Points to Mention

- DRY means avoid duplicated knowledge.
- Useful for business rules, validation, calculations, and policies.
- Reduces inconsistent changes.
- Improves maintainability.
- Do not over-abstract unrelated code just because it looks similar.
- Similar code can represent different concepts.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q02 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q03 -->
#### Beginner Q03: What does YAGNI mean?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

YAGNI means "You Aren't Gonna Need It." It means developers should not build functionality, abstractions, extension points, or infrastructure before there is a real current need.

For example, if the system has one payment provider and no confirmed requirement for multiple providers, building a full plugin framework may be premature.

YAGNI helps prevent over-engineering and keeps the codebase simpler.

##### Key Points to Mention

- YAGNI means do not build speculative features.
- Avoid unnecessary abstraction and future-proofing.
- Helps reduce complexity.
- Does not mean ignoring known requirements.
- Keep the design clean enough to change later.
- Good for avoiding premature optimization and over-engineering.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q03 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q04 -->
#### Beginner Q04: What is Separation of Concerns?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Separation of Concerns means dividing software into parts where each part handles a distinct responsibility. For example, in an ASP.NET Core application, controllers should handle HTTP concerns, application services should handle use cases, domain models should handle business rules, and infrastructure should handle database or external service details.

This makes the system easier to understand, test, and change.

##### Key Points to Mention

- Separate code by responsibility.
- Avoid mixing unrelated concerns.
- Controllers should not contain all business and persistence logic.
- Helps testability and maintainability.
- Common in layered architecture and Clean Architecture.
- Boundaries should be meaningful, not just extra layers.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q04 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q05 -->
#### Beginner Q05: What is cohesion?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Cohesion describes how closely related the responsibilities inside a class, method, module, or component are. High cohesion means the code inside the unit belongs together and serves one clear purpose. Low cohesion means unrelated responsibilities are mixed together.

For example, a `TaxCalculator` that only calculates tax is cohesive. A `UserManager` that registers users, sends emails, generates reports, backs up the database, and calculates tax has low cohesion.

##### Key Points to Mention

- Cohesion is about relatedness inside a unit.
- High cohesion means focused responsibility.
- Low cohesion means unrelated behavior is mixed.
- High cohesion improves readability and testability.
- Vague class names often indicate low cohesion.
- Related to Single Responsibility Principle.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q05 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q06 -->
#### Beginner Q06: What is coupling?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

Coupling describes how dependent one class, module, service, or layer is on another. High coupling means changes in one part often force changes in another. Low coupling means parts can change more independently.

For example, a service that directly creates `SqlConnection` and `SmtpClient` is tightly coupled to those infrastructure details. A service that depends on `IOrderRepository` and `IEmailSender` is less coupled and easier to test or change.

##### Key Points to Mention

- Coupling is about dependency between units.
- High coupling makes changes risky.
- Low coupling improves flexibility and testability.
- Dependency injection can reduce concrete coupling.
- Interfaces can help at real boundaries.
- Some coupling is necessary; avoid unnecessary coupling.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q01 -->
#### Intermediate Q01: How can DRY be harmful when applied incorrectly?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

DRY can be harmful when developers merge code that only looks similar but represents different business concepts. This creates a wrong abstraction. Later, when the concepts evolve differently, the shared abstraction becomes full of flags, special cases, and conditional logic.

Good DRY removes duplicated knowledge. Bad DRY removes duplication too early and increases coupling between unrelated concerns.

For example, customer email validation and employee email validation may look the same today but diverge later. Keeping them separate may be better if they represent different business rules.

##### Key Points to Mention

- DRY is about duplicated knowledge, not similar syntax.
- Premature abstraction can increase coupling.
- Similar code may represent different concepts.
- Wrong abstractions become complex with flags and special cases.
- Some duplication is cheaper than bad abstraction.
- Refactor when the shared concept is stable.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q01 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q02 -->
#### Intermediate Q02: How do KISS and YAGNI differ?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

KISS focuses on simplicity in the current design. It asks whether the solution is unnecessarily complex. YAGNI focuses on avoiding speculative functionality or abstraction. It asks whether a feature or flexibility is actually needed now.

They are related. KISS says keep the solution simple. YAGNI says do not build things for imagined future requirements.

Example: KISS might reject a complex validation framework for a single validation rule. YAGNI might reject a plugin system for a second payment provider that is not actually planned.

##### Key Points to Mention

- KISS focuses on simplicity.
- YAGNI focuses on avoiding speculative work.
- Both reduce unnecessary complexity.
- KISS is about design clarity.
- YAGNI is about current need.
- Neither should ignore known requirements.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q02 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q03 -->
#### Intermediate Q03: How does Separation of Concerns improve testability?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Separation of Concerns improves testability by isolating responsibilities. If business logic is inside a service or domain object, it can be unit tested without starting a web server. If database access is separated, it can be integration tested separately. If controllers only handle HTTP, controller or API tests become simpler.

When concerns are mixed, tests require too much setup and often become brittle because they must involve HTTP, database, validation, business rules, email, and logging all at once.

##### Key Points to Mention

- Isolated responsibilities are easier to test.
- Business logic can be tested without HTTP.
- Infrastructure can be tested separately.
- Controllers stay thin.
- Tests need less setup.
- Fakes and mocks are easier to use at boundaries.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q03 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q04 -->
#### Intermediate Q04: What are signs of low cohesion in a class?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Signs of low cohesion include a vague class name, unrelated methods, too many dependencies, methods that do not use the same state, frequent changes for unrelated reasons, and tests that require complex setup. Classes named `Manager`, `Helper`, `Utility`, or `Processor` can be warning signs if they collect unrelated behavior.

A low-cohesion class should often be split into smaller classes with clearer responsibilities.

##### Key Points to Mention

- Vague class name.
- Unrelated methods.
- Too many dependencies.
- Changes for many reasons.
- Hard-to-write tests.
- Methods do not belong together.
- Often violates Single Responsibility Principle.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q04 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q05 -->
#### Intermediate Q05: How can dependency injection reduce coupling?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Dependency injection reduces coupling by providing dependencies from outside the class instead of creating concrete dependencies inside the class. The class can depend on abstractions such as interfaces, while the DI container supplies the implementation.

Example:

```csharp
public class InvoiceService
{
    private readonly IEmailSender _emailSender;

    public InvoiceService(IEmailSender emailSender)
    {
        _emailSender = emailSender;
    }
}
```

This is less coupled than directly creating `SmtpEmailSender` inside `InvoiceService`. It also makes testing easier because tests can inject a fake `IEmailSender`.

##### Key Points to Mention

- Dependencies are provided from outside.
- Classes avoid creating concrete infrastructure directly.
- Interfaces can represent boundaries.
- Improves testability.
- Allows implementations to change.
- Should not create unnecessary interfaces for every class mechanically.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q05 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q06 -->
#### Intermediate Q06: What is the difference between cohesion and coupling?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Cohesion describes how closely related the responsibilities inside one unit are. Coupling describes how dependent one unit is on another.

Good design usually aims for high cohesion and low coupling. High cohesion keeps related behavior together. Low coupling keeps separate components from depending too heavily on each other.

Example: an `OrderService` focused only on order use cases has high cohesion. If it depends on interfaces such as `IOrderRepository` and `IPaymentGateway` instead of concrete SQL and payment provider classes, it has lower coupling.

##### Key Points to Mention

- Cohesion is internal relatedness.
- Coupling is external dependency.
- High cohesion is good.
- Low unnecessary coupling is good.
- They are different but related.
- Good modules have focused responsibilities and explicit dependencies.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q06 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q07 -->
#### Intermediate Q07: Why is sharing the same model across database, API, and UI often a coupling problem?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

Sharing the same model across database, API, and UI creates coupling because each layer now depends on the same shape. A database change can break API clients. An API response requirement can affect persistence. Sensitive fields may accidentally be exposed. Different layers often change for different reasons.

Separate models such as EF entities, API DTOs, and message contracts may duplicate some fields, but they allow each boundary to evolve independently.

##### Key Points to Mention

- Shared models couple unrelated layers.
- Database changes can affect API clients.
- API concerns can leak into persistence.
- Sensitive fields can be exposed accidentally.
- Separate DTOs reduce boundary coupling.
- Some duplication is acceptable to protect independent change.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q07 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q08 -->
#### Intermediate Q08: How do you decide whether to extract duplicated code?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

First, decide whether the duplication represents the same knowledge or only similar-looking code. If it is the same business rule, validation, calculation, or policy, extraction is usually good. If the code belongs to different concepts that may change independently, keeping it separate may be better.

Also consider whether the extracted abstraction has a clear name and simpler usage. If the abstraction needs many flags or special cases, it may be premature or wrong.

##### Key Points to Mention

- Extract duplicated knowledge, not just similar syntax.
- Ask whether the concepts will change together.
- Good abstractions have clear names.
- Avoid flag-heavy generic helpers.
- Some duplication is acceptable.
- The "rule of three" can help wait for a stable pattern.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q01 -->
#### Advanced Q01: How would you refactor a controller that violates Separation of Concerns?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would first identify the concerns mixed inside the controller: HTTP handling, validation, business rules, persistence, external service calls, logging, and response formatting. Then I would move use-case logic into an application service or command handler. Validation would move into a validator or request validation layer. Domain rules would move into domain entities or domain services. Infrastructure details such as EF Core, email, or messaging would be injected behind clear boundaries.

The controller should become thin. It should accept the request, call the use case, and return an HTTP response. The business behavior should be testable without the controller.

##### Key Points to Mention

- Identify mixed concerns.
- Keep controller focused on HTTP.
- Move use case logic to service/handler.
- Move validation to validator.
- Move business invariants to domain model where appropriate.
- Inject infrastructure dependencies.
- Add tests around extracted behavior.
- Avoid creating unnecessary layers.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q01 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q02 -->
#### Advanced Q02: How do you balance DRY and YAGNI in real projects?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

I balance them by avoiding premature abstraction while still removing duplicated knowledge when the concept is stable. If two pieces of code look similar but may evolve differently, I may leave them separate. If the same business rule or policy is duplicated and a change must be applied consistently, I centralize it.

YAGNI reminds me not to create a generic framework for possible future needs. DRY reminds me not to allow important rules to be scattered. A good compromise is to start simple, watch for repeated stable patterns, then refactor when the abstraction becomes obvious.

##### Key Points to Mention

- DRY removes duplicated knowledge.
- YAGNI avoids speculative abstraction.
- Similar code is not always same concept.
- Centralize stable business rules.
- Avoid generic frameworks too early.
- Refactor when a real pattern emerges.
- Keep future change possible without overbuilding.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q02 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q03 -->
#### Advanced Q03: What is a wrong abstraction and how do you recognize it?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

A wrong abstraction is an abstraction that combines concepts that should have remained separate or hides differences that actually matter. It often starts by removing duplicated code too early. Over time, it grows flags, special cases, optional parameters, branching logic, and confusing names.

Signs include a generic name like `CommonHelper`, many boolean parameters, consumers using only part of the API, frequent changes for unrelated reasons, and fear of changing the abstraction because many unrelated features depend on it.

The fix may be to split the abstraction back into separate cohesive concepts.

##### Key Points to Mention

- Combines concepts that should be separate.
- Often caused by premature DRY.
- Has flags and special cases.
- Has vague names.
- Changes for unrelated reasons.
- Increases coupling.
- Sometimes duplication is better than a wrong abstraction.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q03 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q04 -->
#### Advanced Q04: How do these principles apply to Clean Architecture in .NET?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Clean Architecture uses Separation of Concerns by splitting API, application, domain, and infrastructure responsibilities. It uses low coupling by making inner layers independent of infrastructure details. It uses dependency inversion by defining interfaces in the application or domain layer and implementing them in infrastructure. High cohesion is achieved when each layer and feature has a focused purpose.

KISS and YAGNI still matter. Clean Architecture should not become excessive layering. A small app may not need every pattern. The architecture should be as simple as possible while protecting important boundaries and requirements.

##### Key Points to Mention

- API, application, domain, and infrastructure have separate concerns.
- Inner layers should not depend on outer layers.
- Interfaces reduce coupling at infrastructure boundaries.
- Domain and use cases should be cohesive.
- Avoid unnecessary layers.
- Apply Clean Architecture pragmatically.
- Do not confuse architecture with ceremony.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q04 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q05 -->
#### Advanced Q05: How would you identify and reduce high coupling in a legacy .NET application?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

I would look for concrete infrastructure dependencies spread throughout business code, static mutable state, circular project references, shared models across boundaries, direct database access from UI/controllers, large classes with many dependencies, and tests that require real external systems.

To reduce coupling, I would first add tests around current behavior, then introduce seams at important boundaries. For example, extract interfaces for external APIs, email, file storage, and time. Move business logic out of controllers. Replace static state with injected services. Separate DTOs from EF entities. Break circular dependencies. Refactor gradually rather than rewriting everything.

##### Key Points to Mention

- Look for concrete dependencies and circular references.
- Static state is a coupling signal.
- Shared models can couple boundaries.
- Add characterization tests before refactoring.
- Introduce interfaces at real boundaries.
- Move business logic to cohesive services.
- Refactor incrementally.
- Avoid a risky full rewrite.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q05 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q06 -->
#### Advanced Q06: How do you know when an abstraction is justified?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

An abstraction is justified when it represents a real concept or boundary, reduces coupling, improves testability, removes duplicated knowledge, or supports known variation. It should have a clear name and make the code easier to understand or change.

An abstraction is suspicious if it exists only because "we might need it someday", has one implementation with no boundary value, requires many options to satisfy different consumers, or makes simple code harder to follow.

Examples of justified abstractions include external service clients, payment gateways, repositories when persistence needs a boundary, time providers, and message publishers.

##### Key Points to Mention

- Represents a real concept.
- Protects a real boundary.
- Supports known variation.
- Removes duplicated knowledge.
- Improves testability.
- Has a clear name.
- Avoid abstractions with no current purpose.
- Avoid one-implementation abstractions unless they protect an important boundary.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q06 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q07 -->
#### Advanced Q07: How can high cohesion and low coupling improve team productivity?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

High cohesion makes code easier to understand because related behavior is located together. Low coupling reduces the blast radius of changes because teams can modify one module with fewer unexpected effects on others. Together, they improve parallel development, code review, testing, onboarding, and release safety.

For example, if the payment module has clear boundaries and exposes a small interface, one team can change payment provider logic without affecting catalog, reporting, or user management code.

##### Key Points to Mention

- Easier code ownership.
- Smaller blast radius.
- Safer refactoring.
- Easier testing.
- Easier onboarding.
- Better parallel development.
- Clearer module boundaries.
- Reduced merge conflicts and unintended side effects.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q07 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q08 -->
#### Advanced Q08: When is duplication acceptable?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

Duplication is acceptable when the duplicated code represents different concepts, is likely to evolve differently, or when an abstraction would be more complex than the duplication. It is also acceptable temporarily while waiting for a stable pattern to emerge.

Duplication is dangerous when it duplicates business rules, security policies, validation logic, calculations, or behavior that must change consistently.

A good approach is to tolerate small duplication until the common concept is clear, then refactor to a well-named abstraction.

##### Key Points to Mention

- Similar code may represent different concepts.
- Avoid premature abstraction.
- Small duplication can be cheaper than wrong abstraction.
- Duplicated business rules are risky.
- Refactor when the pattern is stable.
- The abstraction should make the code clearer.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q08 -->

<!-- question:start:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q09 -->
#### Advanced Q09: How do you explain the relationship between these principles and SOLID?

<!-- question-id:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

These principles overlap with SOLID but are broader. Separation of Concerns and cohesion are closely related to the Single Responsibility Principle. Low coupling and dependency injection are related to the Dependency Inversion Principle. Avoiding large interfaces is related to the Interface Segregation Principle. Using polymorphism instead of modifying existing conditional logic can support the Open/Closed Principle.

KISS and YAGNI act as balancing principles. They prevent developers from applying SOLID mechanically and creating unnecessary abstractions or layers.

A good design applies SOLID pragmatically while keeping the code simple and focused.

##### Key Points to Mention

- SoC and cohesion relate to SRP.
- Low coupling relates to DIP.
- Small focused interfaces relate to ISP.
- Polymorphic extension relates to OCP.
- LSP protects correct inheritance.
- KISS and YAGNI prevent over-engineering.
- Principles should be applied pragmatically.

<!-- question:end:kiss-dry-yagni-separation-of-concerns-cohesion-and-coupling-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
