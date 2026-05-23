---
id: solid-principles-in-dotnet-design
topic: Software design principles and common .NET patterns

subtopic: SOLID Principles in .NET Design
category: Design & Architecture
---



## Overview

SOLID is a set of object-oriented design principles used to make software easier to understand, change, test, and maintain. In C# and .NET projects, these principles commonly appear in application services, domain services, controllers, repositories, validators, handlers, background services, and integration boundaries.

The acronym SOLID stands for:

- **Single Responsibility Principle (SRP)**: a type should have one clear reason to change.
- **Open/Closed Principle (OCP)**: software should be open for extension but closed for modification.
- **Liskov Substitution Principle (LSP)**: derived types should be usable wherever their base type is expected without breaking behavior.
- **Interface Segregation Principle (ISP)**: clients should not depend on methods they do not use.
- **Dependency Inversion Principle (DIP)**: high-level policy should depend on abstractions, not low-level implementation details.

For interviews, SOLID matters because it tests whether a developer can design code beyond making it "just work." Interviewers often use SOLID questions to evaluate maintainability, testability, extensibility, coupling, dependency injection knowledge, API boundaries, and practical judgment. A strong candidate should be able to explain each principle, recognize violations in code, refactor toward better design, and also know when not to over-engineer.

In real .NET systems, SOLID helps when building:

- ASP.NET Core APIs with controllers, services, validators, filters, middleware, and dependency injection.
- Clean Architecture or layered systems where domain/application logic should not depend directly on infrastructure.
- CQRS/MediatR handlers that should stay focused and testable.
- Integration code that talks to databases, queues, storage, email, payment providers, or external APIs.
- Reusable libraries where abstractions and contracts need to remain stable over time.

SOLID is not a rule that every class must have an interface or every method must use a pattern. It is a design guide. The practical goal is to reduce the cost of change without creating unnecessary abstraction.

## Core Concepts

### Why SOLID exists

Software usually becomes difficult to maintain because of uncontrolled dependencies and mixed responsibilities. A small change in one place unexpectedly breaks another place. A class becomes too large. A business rule is copied into multiple services. Unit tests require real infrastructure. A new provider or rule requires editing many existing files.

SOLID helps manage these problems by encouraging:

- **Cohesion**: related behavior belongs together.
- **Low coupling**: unrelated modules know as little as possible about each other.
- **Stable abstractions**: important business behavior depends on contracts instead of volatile details.
- **Replaceability**: implementations can be swapped without rewriting high-level code.
- **Testability**: dependencies can be isolated in tests.
- **Change safety**: new behavior can often be added without modifying stable existing code.

A practical interview answer should connect SOLID to the business reason: teams need code that can change safely over months or years.

### Single Responsibility Principle (SRP)

The Single Responsibility Principle says a class, module, or function should have one reason to change. This does not mean a class can have only one method. It means the class should represent one focused responsibility or one cohesive area of behavior.

A common SRP violation is an application service that validates input, performs business logic, writes to the database, formats a response, sends an email, and logs audit data all in one method.

Poor example:

```csharp
public class OrderService
{
    public async Task PlaceOrderAsync(OrderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CustomerEmail))
            throw new ArgumentException("Customer email is required.");

        var order = new Order
        {
            CustomerEmail = request.CustomerEmail,
            Total = request.Items.Sum(x => x.Price * x.Quantity)
        };

        await using var connection = new SqlConnection("connection-string");
        await connection.OpenAsync();

        // Save order directly with SQL here...

        using var smtp = new SmtpClient("smtp.example.com");
        await smtp.SendMailAsync("sales@example.com", request.CustomerEmail, "Order placed", "Thanks!");

        File.AppendAllText("audit.log", $"Order placed: {DateTime.UtcNow}");
    }
}
```

This class has many reasons to change:

- Validation rules change.
- Persistence changes.
- Email provider changes.
- Audit logging changes.
- Order calculation rules change.

A better design separates responsibilities:

```csharp
public interface IOrderValidator
{
    void Validate(OrderRequest request);
}

public interface IOrderRepository
{
    Task SaveAsync(Order order, CancellationToken cancellationToken);
}

public interface IOrderNotifier
{
    Task SendOrderPlacedAsync(Order order, CancellationToken cancellationToken);
}

public class OrderService
{
    private readonly IOrderValidator _validator;
    private readonly IOrderRepository _repository;
    private readonly IOrderNotifier _notifier;

    public OrderService(
        IOrderValidator validator,
        IOrderRepository repository,
        IOrderNotifier notifier)
    {
        _validator = validator;
        _repository = repository;
        _notifier = notifier;
    }

    public async Task PlaceOrderAsync(
        OrderRequest request,
        CancellationToken cancellationToken)
    {
        _validator.Validate(request);

        var order = Order.Create(request.CustomerEmail, request.Items);

        await _repository.SaveAsync(order, cancellationToken);
        await _notifier.SendOrderPlacedAsync(order, cancellationToken);
    }
}
```

This does not mean every line of code needs its own class. The goal is to separate responsibilities that change for different reasons.

#### Practical SRP habits

Good SRP habits in C# include:

- Keep controllers thin; move business logic into application/domain services.
- Keep EF Core `DbContext` usage out of business entities.
- Keep validation separate from persistence and infrastructure.
- Keep mapping logic separate when it becomes complex.
- Avoid "manager" or "helper" classes that do unrelated work.
- Avoid methods that mix policy decisions with infrastructure details.
- Prefer small cohesive classes over one large procedural service.

#### SRP trade-offs

SRP improves readability and testability, but too much splitting can make code harder to navigate. For small features, a simple class may be enough. Refactor when responsibilities start changing independently, when testing becomes painful, or when the class becomes difficult to reason about.

### Open/Closed Principle (OCP)

The Open/Closed Principle says software entities should be open for extension but closed for modification. In practice, this means new behavior should often be added by introducing new types, strategies, handlers, or configuration rather than repeatedly editing stable code.

A common OCP violation is a method with a growing `switch` or `if/else` chain that must be changed every time a new business case is added.

Poor example:

```csharp
public decimal CalculateDiscount(Customer customer, decimal total)
{
    if (customer.Type == CustomerType.Regular)
        return total * 0.05m;

    if (customer.Type == CustomerType.Premium)
        return total * 0.10m;

    if (customer.Type == CustomerType.Employee)
        return total * 0.25m;

    return 0m;
}
```

This may be acceptable when the rules are small and stable. However, if new customer types are added frequently, this method becomes a modification hotspot.

A more extensible approach uses strategy objects:

```csharp
public interface IDiscountPolicy
{
    bool AppliesTo(Customer customer);
    decimal CalculateDiscount(Customer customer, decimal total);
}

public class PremiumCustomerDiscountPolicy : IDiscountPolicy
{
    public bool AppliesTo(Customer customer)
    {
        return customer.Type == CustomerType.Premium;
    }

    public decimal CalculateDiscount(Customer customer, decimal total)
    {
        return total * 0.10m;
    }
}

public class DiscountCalculator
{
    private readonly IEnumerable<IDiscountPolicy> _policies;

    public DiscountCalculator(IEnumerable<IDiscountPolicy> policies)
    {
        _policies = policies;
    }

    public decimal Calculate(Customer customer, decimal total)
    {
        var policy = _policies.FirstOrDefault(x => x.AppliesTo(customer));

        return policy is null
            ? 0m
            : policy.CalculateDiscount(customer, total);
    }
}
```

In ASP.NET Core DI:

```csharp
builder.Services.AddScoped<IDiscountPolicy, RegularCustomerDiscountPolicy>();
builder.Services.AddScoped<IDiscountPolicy, PremiumCustomerDiscountPolicy>();
builder.Services.AddScoped<IDiscountPolicy, EmployeeDiscountPolicy>();
builder.Services.AddScoped<DiscountCalculator>();
```

Now a new discount policy can be added by creating a new class and registering it, without changing the calculator.

#### Practical OCP habits

Good OCP habits include:

- Use strategy pattern for replaceable business algorithms.
- Use polymorphism for behavior that varies by type.
- Use pipeline behaviors, filters, or middleware for cross-cutting behavior.
- Use decorators for logging, caching, retries, metrics, or validation around existing services.
- Use options/configuration for values that change by environment.
- Keep extension points explicit instead of spreading conditionals across the codebase.

#### OCP trade-offs

OCP should not be applied blindly. A simple `switch` expression can be better than a large abstraction when rules are small, stable, and local. OCP becomes valuable when change is frequent, behavior is complex, or modification risk is high.

Good interview answer: "I start simple, but when the same method keeps changing for each new case, I introduce an extension point."

### Liskov Substitution Principle (LSP)

The Liskov Substitution Principle says a subtype should be replaceable for its base type without surprising the caller. If code expects a base class or interface, any implementation should honor the expected behavior, contracts, and invariants.

A classic violation is an implementation that throws `NotSupportedException` for members required by the interface.

Poor example:

```csharp
public interface IReportExporter
{
    Task ExportPdfAsync(Report report);
    Task ExportExcelAsync(Report report);
}

public class PdfOnlyReportExporter : IReportExporter
{
    public Task ExportPdfAsync(Report report)
    {
        // Export PDF
        return Task.CompletedTask;
    }

    public Task ExportExcelAsync(Report report)
    {
        throw new NotSupportedException("Excel export is not supported.");
    }
}
```

The interface promises both PDF and Excel export, but the implementation cannot fulfill the contract. A caller using `IReportExporter` must now know implementation details, which breaks substitutability.

A better design separates capabilities:

```csharp
public interface IPdfReportExporter
{
    Task ExportPdfAsync(Report report);
}

public interface IExcelReportExporter
{
    Task ExportExcelAsync(Report report);
}
```

LSP often connects to ISP. If an interface forces implementations to support behavior they cannot honestly support, both principles are being violated.

#### Practical LSP habits

Good LSP habits include:

- Do not make subclasses weaken validation rules or break invariants.
- Do not make implementations throw unexpected exceptions for valid interface calls.
- Do not return `null` when the base contract says a value is always returned.
- Do not change method meaning in derived classes.
- Prefer composition over inheritance when behavior does not form a true "is-a" relationship.
- Use interfaces with clear, honest contracts.

#### Example: inheritance problem

```csharp
public abstract class PaymentMethod
{
    public abstract Task ChargeAsync(decimal amount);
}

public class GiftCardPayment : PaymentMethod
{
    public override Task ChargeAsync(decimal amount)
    {
        if (amount > 100)
            throw new InvalidOperationException("Gift cards cannot be charged above 100.");

        return Task.CompletedTask;
    }
}
```

This might or might not violate LSP depending on the contract. If the base `PaymentMethod` promises any positive amount can be charged, `GiftCardPayment` breaks the contract. If the base contract allows payment-specific limits, then callers must be designed to handle those limits. The important part is making the contract explicit.

### Interface Segregation Principle (ISP)

The Interface Segregation Principle says clients should not be forced to depend on methods they do not use. In C#, this means smaller role-focused interfaces are often better than large "god interfaces."

Poor example:

```csharp
public interface IUserService
{
    Task<User> GetByIdAsync(Guid id);
    Task CreateAsync(User user);
    Task DeleteAsync(Guid id);
    Task SendPasswordResetEmailAsync(Guid id);
    Task ExportUsersToCsvAsync();
    Task ImportUsersFromCsvAsync(Stream file);
}
```

This interface mixes querying, commands, email behavior, and import/export. A controller that only reads users still depends on methods for deletion and import/export.

Better example:

```csharp
public interface IUserReader
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
}

public interface IUserWriter
{
    Task CreateAsync(User user, CancellationToken cancellationToken);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}

public interface IUserPasswordResetSender
{
    Task SendPasswordResetEmailAsync(Guid id, CancellationToken cancellationToken);
}

public interface IUserImportExportService
{
    Task ExportUsersToCsvAsync(CancellationToken cancellationToken);
    Task ImportUsersFromCsvAsync(Stream file, CancellationToken cancellationToken);
}
```

Now each client depends only on what it needs.

#### ISP in API design

ISP applies beyond C# interfaces. It also applies to API contracts, DTOs, services, and package boundaries.

Examples:

- A read-only page should not depend on a service that also exposes destructive write operations.
- A small microservice should not reference a large shared library containing unrelated interfaces.
- A public API should not force clients to send fields that are irrelevant to their use case.
- A repository abstraction should not expose many methods that most implementations cannot support.

#### ISP trade-offs

Too many tiny interfaces can create complexity and naming overhead. Use role-based interfaces when they meaningfully reduce coupling. Avoid splitting interfaces only to satisfy a rule.

Good practical approach:

- Start with a cohesive interface.
- Split it when consumers need different subsets.
- Split it when implementations cannot honestly support all members.
- Split it when large interfaces make tests or mocks noisy.

### Dependency Inversion Principle (DIP)

The Dependency Inversion Principle says high-level modules should not depend on low-level modules. Both should depend on abstractions. It also says abstractions should not depend on details; details should depend on abstractions.

In .NET, DIP is commonly implemented using dependency injection. However, DIP and DI are not the same thing:

- **DIP** is a design principle.
- **Dependency Injection** is a technique for providing dependencies from the outside.
- **IoC container** is a framework mechanism that constructs objects and resolves dependencies.

Poor example:

```csharp
public class InvoiceService
{
    public async Task SendInvoiceAsync(Guid invoiceId)
    {
        var repository = new SqlInvoiceRepository();
        var emailSender = new SmtpEmailSender();

        var invoice = await repository.GetByIdAsync(invoiceId);
        await emailSender.SendAsync(invoice.CustomerEmail, "Invoice", invoice.ToString());
    }
}
```

`InvoiceService` is high-level application logic, but it directly creates low-level SQL and SMTP implementations. This makes it harder to test and harder to replace infrastructure.

Better example:

```csharp
public interface IInvoiceRepository
{
    Task<Invoice?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
}

public interface IEmailSender
{
    Task SendAsync(
        string to,
        string subject,
        string body,
        CancellationToken cancellationToken);
}

public class InvoiceService
{
    private readonly IInvoiceRepository _repository;
    private readonly IEmailSender _emailSender;

    public InvoiceService(
        IInvoiceRepository repository,
        IEmailSender emailSender)
    {
        _repository = repository;
        _emailSender = emailSender;
    }

    public async Task SendInvoiceAsync(
        Guid invoiceId,
        CancellationToken cancellationToken)
    {
        var invoice = await _repository.GetByIdAsync(invoiceId, cancellationToken);

        if (invoice is null)
            throw new InvalidOperationException("Invoice not found.");

        await _emailSender.SendAsync(
            invoice.CustomerEmail,
            "Invoice",
            invoice.ToString(),
            cancellationToken);
    }
}
```

DI registration:

```csharp
builder.Services.AddScoped<IInvoiceRepository, SqlInvoiceRepository>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<InvoiceService>();
```

Now `InvoiceService` depends on abstractions. Infrastructure implementations can be replaced with fakes in tests or alternative providers in production.

#### DIP in Clean Architecture

In Clean Architecture, the application core usually defines interfaces, and infrastructure implements them.

Example structure:

```text
MyApp.Domain
  Order.cs

MyApp.Application
  IOrderRepository.cs
  PlaceOrderHandler.cs

MyApp.Infrastructure
  EfCoreOrderRepository.cs

MyApp.Api
  Controllers
  DependencyInjection registration
```

The key direction is:

```text
API -> Application
Infrastructure -> Application
Application -> Domain
Domain -> no dependency on infrastructure
```

The application layer defines what it needs. The infrastructure layer provides implementation details. This keeps business logic independent from database, email, queue, file system, or cloud provider details.

#### DIP mistakes

Common DIP mistakes include:

- Creating an interface for every class even when there is no meaningful abstraction.
- Putting infrastructure-specific details into application interfaces.
- Using the service locator pattern by injecting `IServiceProvider` everywhere.
- Depending on generic abstractions that leak persistence details.
- Mocking every dependency and never running integration tests.
- Treating dependency injection as a replacement for good design.

A good abstraction should represent a stable business or application capability, not simply mirror a concrete class.

### How SOLID principles work together

The SOLID principles are connected:

- SRP improves cohesion by keeping responsibilities focused.
- OCP helps add new behavior without rewriting stable code.
- LSP ensures abstractions are safe to substitute.
- ISP keeps abstractions small and client-focused.
- DIP keeps high-level logic independent from low-level details.

Example connection:

- DIP introduces `IPaymentGateway`.
- ISP ensures the interface only contains payment operations needed by the application.
- LSP ensures all gateway implementations behave consistently.
- OCP allows adding `StripePaymentGateway` or `AdyenPaymentGateway` without changing application logic.
- SRP keeps payment processing separate from order validation and email notification.

### SOLID and dependency injection in ASP.NET Core

ASP.NET Core has built-in dependency injection, which supports constructor injection and service lifetimes such as singleton, scoped, and transient. This makes DIP easier to apply.

Example controller:

```csharp
[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    private readonly IPlaceOrderUseCase _placeOrderUseCase;

    public OrdersController(IPlaceOrderUseCase placeOrderUseCase)
    {
        _placeOrderUseCase = placeOrderUseCase;
    }

    [HttpPost]
    public async Task<IActionResult> PlaceOrder(
        PlaceOrderRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _placeOrderUseCase.ExecuteAsync(request, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = result.OrderId }, result);
    }

    [HttpGet("{id:guid}")]
    public IActionResult GetById(Guid id)
    {
        return Ok();
    }
}
```

The controller does not know whether the use case uses EF Core, Dapper, Azure Service Bus, email, or another infrastructure component. It depends on the use-case abstraction.

### SOLID and testing

SOLID improves testability because focused classes and explicit dependencies are easier to isolate.

Example unit test using a fake:

```csharp
public class FakeEmailSender : IEmailSender
{
    public List<string> Recipients { get; } = new();

    public Task SendAsync(
        string to,
        string subject,
        string body,
        CancellationToken cancellationToken)
    {
        Recipients.Add(to);
        return Task.CompletedTask;
    }
}
```

A service that depends on `IEmailSender` can be tested without connecting to a real SMTP server.

However, SOLID does not remove the need for integration tests. If everything is mocked, tests may pass while the real database mapping, DI registration, middleware, configuration, or external API contract is broken. A practical testing strategy combines:

- Unit tests for business rules.
- Integration tests for real infrastructure boundaries.
- Contract tests for external integrations when needed.
- End-to-end tests for critical user workflows.

### SOLID in C# language features

C# and .NET provide many tools that support SOLID design:

- Interfaces and abstract classes for abstractions.
- Constructor injection through ASP.NET Core DI.
- Records and immutable types for clearer data models.
- Generics for reusable abstractions.
- Extension methods for adding behavior carefully.
- Pattern matching and switch expressions for simple branching.
- Delegates and function parameters for lightweight strategies.
- Options pattern for environment-specific configuration.

SOLID does not require using all of these. The best design uses the simplest tool that keeps change safe.

### Common real-world examples

#### Controller with too much responsibility

A controller that validates business rules, queries EF Core directly, maps DTOs, sends emails, and handles authorization decisions is usually violating SRP. A better design moves business behavior into application services or handlers, keeps authorization declarative when possible, and leaves the controller responsible for HTTP concerns.

#### Repository interface that is too broad

An interface like this is often too generic:

```csharp
public interface IRepository<T>
{
    Task<T?> GetByIdAsync(Guid id);
    Task<List<T>> GetAllAsync();
    Task AddAsync(T entity);
    Task UpdateAsync(T entity);
    Task DeleteAsync(Guid id);
    IQueryable<T> Query();
}
```

Problems:

- Not every entity should support all operations.
- Exposing `IQueryable<T>` leaks persistence details.
- It can hide important query-specific requirements.
- It may encourage anemic CRUD design.

A more focused approach may be better:

```csharp
public interface IOrderReadRepository
{
    Task<OrderDetails?> GetDetailsAsync(Guid orderId, CancellationToken cancellationToken);
}

public interface IOrderWriteRepository
{
    Task AddAsync(Order order, CancellationToken cancellationToken);
}
```

#### Business rules implemented with repeated conditionals

If many services check the same condition, the rule likely belongs in one domain method, specification, policy, or strategy.

Poor example:

```csharp
if (order.Status == OrderStatus.Paid && !order.IsCancelled)
{
    // allow shipping
}
```

Better:

```csharp
if (order.CanBeShipped())
{
    // allow shipping
}
```

This improves SRP and reduces duplicated rule logic.

### SOLID vs design patterns

SOLID principles are not design patterns. They are guidelines. Design patterns are reusable solutions to common design problems.

Examples:

- Strategy pattern often supports OCP.
- Decorator pattern often supports OCP and SRP.
- Adapter pattern often supports DIP.
- Facade pattern can improve SRP at call sites.
- Factory pattern can help hide object creation details.
- Mediator pattern can reduce direct coupling between components.

In interviews, avoid saying "SOLID means use patterns." A better answer is: "SOLID helps me decide when a pattern is useful."

### SOLID in layered and Clean Architecture

SOLID is especially important in layered architecture:

- Domain layer should contain business behavior and should not depend on infrastructure.
- Application layer should coordinate use cases and define required abstractions.
- Infrastructure layer should implement database, file, email, queue, and external API details.
- API layer should handle HTTP request/response concerns.

This prevents infrastructure details from dominating business logic.

Example:

```csharp
public class PlaceOrderHandler
{
    private readonly IOrderRepository _orderRepository;
    private readonly IPaymentGateway _paymentGateway;

    public PlaceOrderHandler(
        IOrderRepository orderRepository,
        IPaymentGateway paymentGateway)
    {
        _orderRepository = orderRepository;
        _paymentGateway = paymentGateway;
    }

    public async Task<Guid> HandleAsync(
        PlaceOrderCommand command,
        CancellationToken cancellationToken)
    {
        var order = Order.Create(command.CustomerId, command.Items);

        await _paymentGateway.AuthorizeAsync(order.Total, cancellationToken);
        await _orderRepository.AddAsync(order, cancellationToken);

        return order.Id;
    }
}
```

The handler expresses the use case. It does not know how payment authorization or persistence is implemented.

### Common mistakes

Common SOLID mistakes include:

- Thinking SRP means every class must have only one method.
- Creating interfaces for every class without a real abstraction.
- Using inheritance when composition would be clearer.
- Making interfaces too broad.
- Making abstractions too generic and leaky.
- Hiding all behavior behind patterns even when direct code is simpler.
- Applying OCP before understanding what actually changes.
- Violating LSP by throwing `NotSupportedException` for required interface methods.
- Injecting `IServiceProvider` everywhere instead of explicit dependencies.
- Treating DI container registration as architecture.
- Writing unit tests with mocks only and missing integration failures.
- Making domain logic depend on EF Core, HTTP, configuration, or cloud SDKs directly.

### Best practices

Good SOLID habits include:

- Start with clear responsibilities before introducing abstractions.
- Use interfaces where there are meaningful alternate implementations, test seams, or architectural boundaries.
- Prefer constructor injection for required dependencies.
- Keep high-level business logic independent from infrastructure.
- Keep public interfaces small and role-focused.
- Use composition before inheritance.
- Use strategies or policies when behavior varies by business rule.
- Keep DTOs, domain models, and persistence models separate when their responsibilities differ.
- Avoid exposing `IQueryable<T>` from application abstractions unless intentionally designing a query boundary.
- Write tests that verify behavior, not implementation details.
- Use integration tests to validate DI, database mapping, middleware, configuration, and real contracts.
- Refactor toward SOLID when change patterns become visible.

### Practical decision guide

Use this mental model in interviews:

```text
Is the class changing for unrelated reasons?
  -> Consider SRP.

Do I keep editing the same method for every new variation?
  -> Consider OCP with strategy, policy, handler, or plugin-style design.

Can an implementation not honestly fulfill its base contract?
  -> Check LSP and maybe split the abstraction.

Do consumers depend on methods they do not use?
  -> Apply ISP.

Does business logic directly create or depend on infrastructure details?
  -> Apply DIP and dependency injection.
```

The best answers show judgment. SOLID is about reducing change cost, not maximizing the number of abstractions.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What are the SOLID principles?

<!-- question:start:solid-principles-beginner-q01 -->
<!-- question-id:solid-principles-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

SOLID is an acronym for five object-oriented design principles: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion. They help developers design software that is easier to maintain, extend, test, and reason about.

In C# and .NET, SOLID is often applied through focused classes, small interfaces, dependency injection, strategy patterns, layered architecture, and clear separation between application logic and infrastructure details.

SOLID should be treated as guidance, not as strict rules. The goal is to reduce coupling, improve cohesion, and make future changes safer.

##### Key Points to Mention

- SRP: one clear reason to change.
- OCP: extend behavior without repeatedly modifying stable code.
- LSP: derived types or implementations should honor the base contract.
- ISP: clients should not depend on methods they do not use.
- DIP: depend on abstractions, not concrete infrastructure details.
- SOLID improves maintainability and testability.
- SOLID can be overused if every simple class becomes an abstraction.

<!-- question:end:solid-principles-beginner-q01 -->

#### What is the Single Responsibility Principle?

<!-- question:start:solid-principles-beginner-q02 -->
<!-- question-id:solid-principles-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

The Single Responsibility Principle says a class or module should have one clear reason to change. It should focus on one responsibility or one cohesive area of behavior.

For example, an `OrderService` that validates input, calculates totals, saves to the database, sends email, and writes audit logs has multiple reasons to change. A better design separates validation, persistence, notification, and auditing into separate collaborators.

SRP does not mean one method per class. It means the class should not mix unrelated responsibilities.

##### Key Points to Mention

- SRP is about reasons to change.
- It improves cohesion and readability.
- It makes testing easier.
- Controllers should not contain complex business logic.
- Large "manager" or "helper" classes often violate SRP.
- Too much splitting can create unnecessary complexity.

<!-- question:end:solid-principles-beginner-q02 -->

#### What is the Open/Closed Principle?

<!-- question:start:solid-principles-beginner-q03 -->
<!-- question-id:solid-principles-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

The Open/Closed Principle says code should be open for extension but closed for modification. This means new behavior should often be added by creating new implementations rather than editing stable existing code.

For example, if a discount calculation method has a growing `if/else` chain for each customer type, adding a new customer type requires modifying that method. A better approach may use an `IDiscountPolicy` interface and separate policy classes. Then new policies can be added without changing the calculator.

OCP is useful when behavior varies and changes frequently. It should not be forced onto simple stable code.

##### Key Points to Mention

- OCP reduces modification risk.
- Strategy, policy, handler, decorator, and plugin-style designs can support OCP.
- Repeatedly changing the same method for new cases is a warning sign.
- Simple conditionals are acceptable when the logic is small and stable.
- OCP should be applied where change is likely.

<!-- question:end:solid-principles-beginner-q03 -->

#### What is the Dependency Inversion Principle?

<!-- question:start:solid-principles-beginner-q04 -->
<!-- question-id:solid-principles-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

The Dependency Inversion Principle says high-level modules should not depend on low-level modules. Both should depend on abstractions. In practice, business or application logic should not directly create concrete infrastructure classes like SQL repositories, SMTP clients, file writers, or cloud SDK clients.

In .NET, DIP is commonly implemented with dependency injection. A service depends on interfaces such as `IEmailSender` or `IOrderRepository`, and concrete implementations are registered in the DI container.

DIP makes code easier to test and easier to change because infrastructure details can be replaced without rewriting high-level business logic.

##### Key Points to Mention

- DIP is a design principle.
- Dependency injection is a technique used to apply DIP.
- High-level business logic should depend on stable abstractions.
- Infrastructure should implement application-defined contracts.
- DIP supports testing, Clean Architecture, and replaceable implementations.
- Avoid injecting `IServiceProvider` everywhere as a service locator.

<!-- question:end:solid-principles-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How are dependency inversion and dependency injection different?

<!-- question:start:solid-principles-intermediate-q01 -->
<!-- question-id:solid-principles-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Dependency inversion is a design principle. It says high-level modules and low-level modules should both depend on abstractions, and details should depend on abstractions.

Dependency injection is a technique for supplying dependencies from the outside instead of creating them inside the class. Constructor injection is the most common form in ASP.NET Core.

An IoC container is a tool that creates objects and resolves dependencies automatically. ASP.NET Core has a built-in DI container.

The relationship is: DIP is the principle, DI is a technique, and the DI container is a tool.

##### Key Points to Mention

- DIP defines the desired dependency direction.
- DI provides dependencies from the outside.
- An IoC container automates object creation and lifetime management.
- Constructor injection makes required dependencies explicit.
- DI alone does not guarantee good design.
- Poor abstractions can still violate DIP even with a DI container.

<!-- question:end:solid-principles-intermediate-q01 -->

#### How does Interface Segregation help in C# applications?

<!-- question:start:solid-principles-intermediate-q02 -->
<!-- question-id:solid-principles-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Interface Segregation helps by ensuring clients only depend on the operations they actually use. Instead of creating a large interface with many unrelated methods, the design uses smaller role-focused interfaces.

For example, a large `IUserService` with read, write, password reset, import, and export methods can be split into `IUserReader`, `IUserWriter`, `IUserPasswordResetSender`, and `IUserImportExportService`.

This reduces coupling, makes implementations more honest, and simplifies tests. It also prevents classes from implementing methods that throw `NotSupportedException`.

##### Key Points to Mention

- ISP prevents "fat interfaces."
- Clients should depend only on required capabilities.
- Smaller interfaces are easier to mock and implement.
- ISP often works together with LSP.
- Too many tiny interfaces can create unnecessary complexity.
- Split interfaces when consumers or implementations have different needs.

<!-- question:end:solid-principles-intermediate-q02 -->

#### What is a practical Liskov Substitution Principle violation?

<!-- question:start:solid-principles-intermediate-q03 -->
<!-- question-id:solid-principles-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A practical LSP violation occurs when a class implements an interface or inherits from a base class but cannot honor the expected contract.

For example, if `IReportExporter` has `ExportPdfAsync` and `ExportExcelAsync`, but `PdfOnlyReportExporter` throws `NotSupportedException` for Excel export, callers cannot safely use it as an `IReportExporter`. The abstraction promises more than the implementation can provide.

A better design is to split the interface into `IPdfReportExporter` and `IExcelReportExporter`, or define a capability model that makes unsupported behavior explicit.

##### Key Points to Mention

- LSP is about substitutability.
- Implementations should honor the base contract.
- Unexpected `NotSupportedException` is often a warning sign.
- Do not weaken preconditions or break invariants in derived types.
- Prefer composition when inheritance does not represent a true "is-a" relationship.
- ISP can help fix LSP violations caused by broad interfaces.

<!-- question:end:solid-principles-intermediate-q03 -->

#### When should you introduce an interface in .NET?

<!-- question:start:solid-principles-intermediate-q04 -->
<!-- question-id:solid-principles-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

An interface is useful when it represents a meaningful abstraction, a boundary, or a replaceable capability. Examples include repositories, email senders, payment gateways, file storage, external API clients, message publishers, and time providers.

Interfaces are also helpful for testing when the dependency is slow, non-deterministic, external, or difficult to control.

However, creating an interface for every class can be over-engineering. If a class is simple, has only one implementation, and is not a boundary, a concrete dependency may be acceptable.

##### Key Points to Mention

- Use interfaces for meaningful abstractions and boundaries.
- Use interfaces when multiple implementations are likely.
- Use interfaces for infrastructure dependencies.
- Avoid interfaces that only mirror a concrete class without design value.
- Avoid leaky abstractions that expose infrastructure details.
- Consider testability, change frequency, and architectural boundaries.

<!-- question:end:solid-principles-intermediate-q04 -->

#### How does SOLID apply to ASP.NET Core controllers and services?

<!-- question:start:solid-principles-intermediate-q05 -->
<!-- question-id:solid-principles-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

In ASP.NET Core, controllers should usually focus on HTTP concerns such as routing, model binding, status codes, and request/response shape. Business logic should be placed in application services, domain services, or request handlers.

SRP keeps controllers thin. DIP allows controllers and services to depend on abstractions. ISP keeps service contracts small. OCP allows behavior such as validation, caching, logging, authorization, and different business rules to be added through policies, handlers, decorators, filters, or middleware.

A good design avoids controllers directly using EF Core, SMTP clients, storage SDKs, or complex business rules unless the endpoint is very small and simple.

##### Key Points to Mention

- Controllers should not become business-logic containers.
- Use services or handlers for use-case logic.
- Use DI for dependencies.
- Use filters/middleware/decorators for cross-cutting behavior when appropriate.
- Keep contracts focused.
- Avoid over-engineering simple endpoints.

<!-- question:end:solid-principles-intermediate-q05 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you refactor a large service class that violates multiple SOLID principles?

<!-- question:start:solid-principles-advanced-q01 -->
<!-- question-id:solid-principles-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

First, identify separate responsibilities and reasons for change. For example, the service may handle validation, authorization, business rules, persistence, external API calls, notifications, and logging.

Next, extract cohesive collaborators around stable responsibilities. Validation can move into validators, persistence behind repositories or data access services, external calls behind gateway interfaces, and business rules into domain methods, policies, or strategies.

Then introduce abstractions only at meaningful boundaries. Register implementations with DI and write tests around the refactored behavior. The refactor should be incremental to reduce risk.

The goal is not to create many classes. The goal is to make the code easier to change safely.

##### Key Points to Mention

- Start by identifying reasons for change.
- Separate business logic from infrastructure.
- Extract cohesive responsibilities gradually.
- Introduce interfaces at boundaries, not everywhere.
- Keep behavior covered by tests during refactoring.
- Avoid big-bang rewrites.
- Measure success by improved readability, testability, and change safety.

<!-- question:end:solid-principles-advanced-q01 -->

#### How can SOLID be overused?

<!-- question:start:solid-principles-advanced-q02 -->
<!-- question-id:solid-principles-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

SOLID can be overused when developers add abstractions before there is a real need. This can lead to too many tiny classes, unnecessary interfaces, complex inheritance, excessive indirection, and code that is harder to navigate than the original simple solution.

For example, a stable three-line calculation does not necessarily need a strategy pattern. A class with one obvious implementation may not need an interface. A small CRUD endpoint may not need many layers if the application is simple.

Good design balances simplicity with flexibility. Apply SOLID where it reduces real change risk, improves testability, or protects architectural boundaries.

##### Key Points to Mention

- SOLID is guidance, not a checklist.
- Too many abstractions can reduce readability.
- Avoid interfaces without meaningful alternate behavior or boundary value.
- Apply patterns when change frequency justifies them.
- Simple direct code is often better for stable logic.
- Refactor toward SOLID as complexity emerges.

<!-- question:end:solid-principles-advanced-q02 -->

#### How does Dependency Inversion support Clean Architecture?

<!-- question:start:solid-principles-advanced-q03 -->
<!-- question-id:solid-principles-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Dependency Inversion supports Clean Architecture by keeping business and application logic independent from infrastructure. The application layer defines interfaces such as `IOrderRepository`, `IPaymentGateway`, or `IMessagePublisher`. The infrastructure layer implements those interfaces using EF Core, HTTP clients, cloud services, or message brokers.

This reverses the traditional dependency direction. Instead of application logic depending on infrastructure, infrastructure depends on abstractions defined by the application.

The result is a core that is easier to test, easier to reuse, and less affected by changes in databases, frameworks, or external providers.

##### Key Points to Mention

- Application core defines required abstractions.
- Infrastructure implements those abstractions.
- Business logic avoids direct dependency on databases, HTTP, queues, and SDKs.
- DI wires implementations at application startup.
- This improves testability and replaceability.
- Abstractions must not leak infrastructure-specific details.

<!-- question:end:solid-principles-advanced-q03 -->

#### How do you decide between a switch expression and polymorphism for varying behavior?

<!-- question:start:solid-principles-advanced-q04 -->
<!-- question-id:solid-principles-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

A switch expression is often appropriate when the set of cases is small, stable, and local. It is simple, readable, and avoids unnecessary abstraction.

Polymorphism or strategy-based design is better when new cases are added frequently, each case has complex behavior, behavior needs separate testing, or each case has different dependencies.

For example, a simple enum-to-label mapping is fine as a switch expression. A payment processing workflow with different providers, retry policies, credentials, and API behavior should likely use strategies or provider-specific implementations.

##### Key Points to Mention

- Use switch expressions for simple and stable branching.
- Use polymorphism/strategy for complex or frequently changing behavior.
- Consider dependencies per case.
- Consider testability and ownership of each behavior.
- Do not introduce patterns just to avoid all conditionals.
- OCP is valuable when modification risk is real.

<!-- question:end:solid-principles-advanced-q04 -->

#### How can mocking hide SOLID or integration problems?

<!-- question:start:solid-principles-advanced-q05 -->
<!-- question-id:solid-principles-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Mocking can hide problems when tests only verify interactions with artificial dependencies and never exercise real infrastructure or application wiring. A service may appear well-designed because every dependency is mocked, but the real DI registration, EF Core mapping, transaction behavior, middleware, configuration, or external API contract may be broken.

Mock-heavy tests can also encourage interfaces that exist only for mocking, not because they represent meaningful abstractions. This can create over-abstraction.

A balanced approach uses unit tests for business rules and integration tests for real boundaries. SOLID should make code testable, but tests should still validate that the actual system works.

##### Key Points to Mention

- Mocks can hide DI registration and configuration issues.
- Mocks can hide database mapping and query problems.
- Interfaces should represent real boundaries, not only test convenience.
- Unit tests and integration tests serve different purposes.
- Avoid testing implementation details too heavily.
- Use real infrastructure or realistic fakes where integration behavior matters.

<!-- question:end:solid-principles-advanced-q05 -->

#### What are signs that an abstraction is poorly designed?

<!-- question:start:solid-principles-advanced-q06 -->
<!-- question-id:solid-principles-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

A poorly designed abstraction is often too broad, too generic, too leaky, or too closely tied to one implementation. Signs include methods most consumers do not use, implementations throwing `NotSupportedException`, infrastructure-specific details leaking into application contracts, excessive generic CRUD interfaces, and tests requiring complex setup for simple behavior.

Good abstractions are stable, focused, meaningful to the business or application use case, and implemented honestly by all implementations.

##### Key Points to Mention

- Fat interfaces suggest ISP problems.
- `NotSupportedException` can indicate LSP problems.
- Infrastructure details in application contracts can violate DIP.
- Generic abstractions can hide important use-case requirements.
- Good abstractions are role-focused and stable.
- Abstractions should reduce change cost, not add confusion.

<!-- question:end:solid-principles-advanced-q06 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
