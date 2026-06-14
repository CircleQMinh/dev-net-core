---
id: dependency-inversion-and-inward-facing-dependencies
topic: Clean Architecture and modular boundaries
subtopic: Dependency inversion and inward-facing dependencies
category: Design & Architecture
---

## Overview

Dependency Inversion is the principle that high-level policy should not depend directly on low-level implementation details. Both should depend on abstractions, and those abstractions should be shaped by the needs of the higher-level policy.

Without dependency inversion, application code commonly follows its runtime call direction:

```text
Order service
    -> EF Core repository
        -> SQL Server
```

The order service has a compile-time reference to the concrete persistence code. Business behavior therefore changes or becomes harder to test when persistence details change.

With dependency inversion, the high-level module defines the capability it needs:

```text
Compile-time dependencies:

Infrastructure -> Application -> Domain
                     ^
                     |
              IOrderRepository
```

At runtime, the call still reaches infrastructure:

```text
Runtime calls:

Order use case
    -> IOrderRepository
        -> EfOrderRepository
            -> SQL Server
```

The dependency has been inverted because the infrastructure implementation depends on an abstraction owned by the application rather than the application depending on the infrastructure implementation.

Inward-facing dependencies are the architectural application of this principle. Outer details such as ASP.NET Core, EF Core, message brokers, file systems, and vendor SDKs can depend on inner application policy. Inner layers do not depend on those outer details.

This concept is central to Clean Architecture, Onion Architecture, and Ports-and-Adapters. It is also relevant in ordinary layered applications whenever business behavior must be protected from technology-specific code.

This topic is important in interviews because several related concepts are often confused:

- Dependency Inversion Principle.
- Dependency injection.
- Inversion of Control.
- Interfaces and abstractions.
- Compile-time dependencies.
- Runtime control flow.
- Composition roots.
- Service location.

A strong answer explains not only how to inject an interface but also who should own that interface, why the dependency arrow changes, which dependencies deserve inversion, and when introducing an abstraction is unnecessary.

## Core Concepts

### What Is a Dependency?

A dependency is something a class, function, module, or service requires to perform its work.

Examples:

- A use case depends on an order repository.
- A repository depends on a database context.
- A controller depends on an application service.
- A notification service depends on an email gateway.
- A pricing rule depends on a clock or exchange-rate provider.

Dependencies can be:

- Concrete classes.
- Interfaces.
- Functions or delegates.
- Configuration values.
- Framework services.
- External processes or services.

The architectural concern is not whether dependencies exist. Software must collaborate. The concern is which direction the source-code dependencies point and whether high-level policy is coupled to details that change independently.

### High-Level Policy and Low-Level Detail

A **high-level policy** describes what the business or application is trying to accomplish.

Examples:

- An order can be confirmed only when it contains lines.
- A withdrawal must not exceed the available balance.
- A customer must be authorized before viewing an invoice.
- A payment must be recorded before fulfillment begins.

A **low-level detail** describes how technical work is performed.

Examples:

- SQL Server and EF Core.
- Azure Service Bus.
- An SMTP server.
- An HTTP payment SDK.
- A local file system.
- ASP.NET Core routing.

High-level policy tends to be more valuable and longer-lived. Low-level details often change because of frameworks, vendors, hosting choices, or operational requirements.

Dependency inversion protects policy from those changes.

### The Dependency Inversion Principle

The principle is commonly expressed in two parts:

```text
High-level modules should not depend on low-level modules.
Both should depend on abstractions.

Abstractions should not depend on details.
Details should depend on abstractions.
```

This does not mean high-level code stops using low-level behavior. It means the compile-time contract is placed at a boundary controlled by the high-level need.

### Direct Dependency Without Inversion

Consider an application service that creates a database context directly:

```csharp
public sealed class ConfirmOrderService
{
    public async Task ConfirmAsync(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer("connection-string")
            .Options;

        await using var db = new AppDbContext(options);

        Order order = await db.Orders
            .Include(item => item.Lines)
            .SingleAsync(
                item => item.Id == orderId,
                cancellationToken);

        order.Confirm();

        await db.SaveChangesAsync(cancellationToken);
    }
}
```

Problems include:

- Application policy knows EF Core.
- Connection and lifetime management are mixed with the use case.
- Tests need EF Core configuration.
- Persistence changes affect application code.
- The service has multiple reasons to change.

The code may still be acceptable for a small script or prototype. Dependency inversion is most valuable when the boundary has meaningful change or testing pressure.

### Inverted Dependency

The application defines the capability it requires:

```csharp
public interface IOrderRepository
{
    Task<Order?> GetForConfirmationAsync(
        OrderId orderId,
        CancellationToken cancellationToken);
}

public interface IUnitOfWork
{
    Task SaveChangesAsync(
        CancellationToken cancellationToken);
}
```

The use case depends on those abstractions:

```csharp
public sealed class ConfirmOrderHandler(
    IOrderRepository orders,
    IUnitOfWork unitOfWork)
{
    public async Task HandleAsync(
        ConfirmOrder command,
        CancellationToken cancellationToken)
    {
        Order order = await orders.GetForConfirmationAsync(
            command.OrderId,
            cancellationToken)
            ?? throw new OrderNotFoundException(command.OrderId);

        order.Confirm();

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
```

Infrastructure implements the ports:

```csharp
public sealed class EfOrderRepository(AppDbContext db)
    : IOrderRepository
{
    public Task<Order?> GetForConfirmationAsync(
        OrderId orderId,
        CancellationToken cancellationToken)
    {
        return db.Orders
            .Include(order => order.Lines)
            .SingleOrDefaultAsync(
                order => order.Id == orderId,
                cancellationToken);
    }
}

public sealed class EfUnitOfWork(AppDbContext db) : IUnitOfWork
{
    public Task SaveChangesAsync(
        CancellationToken cancellationToken)
    {
        return db.SaveChangesAsync(cancellationToken);
    }
}
```

Compile-time references now point toward application policy:

```text
Infrastructure -> Application -> Domain
```

### Inward-Facing Dependencies

An inward dependency points from an outer, more technical layer toward an inner, more policy-oriented layer.

Typical direction:

```text
API ------------\
Worker ----------> Application -> Domain
Infrastructure --/
```

Examples:

- API references application commands and use cases.
- Infrastructure references application repository ports.
- Application references domain entities and value objects.
- Domain references only basic language or carefully selected foundational libraries.

The inner layer must not import types from the outer layer.

Invalid examples:

```text
Domain -> EF Core
Application -> ASP.NET Core IActionResult
Application -> Azure Service Bus SDK
Domain -> Infrastructure repository
```

### Dependency Rule

The Dependency Rule is the architectural constraint that source-code dependencies cross boundaries only toward higher-level policy.

Information crossing inward should be expressed in forms the inner layer owns or understands:

- Primitive values.
- Domain value objects.
- Application commands.
- Application results.
- Narrow interfaces.

Outer-layer types should be translated at the boundary.

For example, do not pass an ASP.NET Core `HttpRequest` into a use case:

```csharp
// Avoid
public Task HandleAsync(HttpRequest request);
```

Translate it into an application request:

```csharp
public sealed record RegisterCustomer(
    EmailAddress Email,
    CustomerName Name);
```

### Compile-Time Dependency vs Runtime Flow

These directions are often confused.

Suppose an application service calls an email adapter.

At runtime:

```text
Application -> SMTP adapter -> SMTP server
```

At compile time:

```text
SMTP adapter -> Application's IEmailSender
Application -> Domain
```

The application source references only `IEmailSender`. The concrete adapter references and implements that interface.

This is why the runtime arrow can point outward while the source-code dependency points inward.

### Interface Ownership

The location of an interface determines whether the dependency is truly inverted.

#### Infrastructure-Owned Interface

```text
Application -> Infrastructure.Abstractions
Infrastructure.Implementation -> Infrastructure.Abstractions
```

The application still depends on a package owned by infrastructure. This may reduce coupling to a concrete class, but it does not fully protect the high-level module from the lower-level module's model.

#### Consumer-Owned Interface

```text
Infrastructure -> Application.IOrderRepository
Application -> Domain
```

The application defines the behavior it needs. Infrastructure adapts to that contract.

This follows the Interface Segregation Principle as well: the consuming use case should not depend on operations it does not need.

### Design Interfaces from the Consumer's Need

Avoid designing a port as a generic mirror of a technology:

```csharp
public interface IRepository<T>
{
    IQueryable<T> Query();
    void Add(T entity);
    void Update(T entity);
    void Delete(T entity);
}
```

This contract:

- Leaks query-provider behavior.
- Exposes persistence mechanics.
- Gives every consumer a broad API.
- Makes infrastructure shape the application.

Prefer a narrow application-facing port:

```csharp
public interface ICustomerCreditReader
{
    Task<CreditProfile?> GetForOrderAsync(
        CustomerId customerId,
        CancellationToken cancellationToken);
}
```

The port names the capability required by the use case.

### Stable Abstractions

An abstraction should represent something more stable than its implementations.

Good abstraction candidates:

- A business capability.
- An external resource boundary.
- A policy with multiple implementations.
- A module contract.
- A platform capability needed by the core.

Examples:

```csharp
IPaymentAuthorizer
IOrderRepository
IExchangeRateProvider
IIntegrationEventPublisher
TimeProvider
```

Weak abstraction candidates:

```csharp
IOrderServiceImpl
IGenericManager<T>
IHelper
IProcessor<TInput, TOutput>
```

The goal is not interface quantity. The goal is dependency direction and a stable contract.

### Dependency Inversion vs Dependency Injection

These are related but different.

**Dependency Inversion Principle** is an architectural design rule about dependency direction and abstraction ownership.

**Dependency injection** is a construction technique where dependencies are supplied from outside an object.

Constructor injection:

```csharp
public sealed class ConfirmOrderHandler(
    IOrderRepository orders)
{
}
```

Method injection:

```csharp
public Task HandleAsync(
    ConfirmOrder command,
    ICurrentUser currentUser,
    CancellationToken cancellationToken);
```

Property injection exists but is usually avoided because it can leave objects incompletely initialized.

DI can be used without proper dependency inversion:

```csharp
public sealed class ConfirmOrderHandler(
    EfOrderRepository repository)
{
}
```

The dependency is injected, but the high-level handler still depends on a concrete low-level type.

Dependency inversion can also be implemented without a DI container by constructing objects manually in the composition root.

### Dependency Inversion vs Inversion of Control

**Inversion of Control** is a broader concept in which the framework or external mechanism controls execution or object creation.

Examples:

- ASP.NET Core calls an endpoint when a request arrives.
- A test framework invokes test methods.
- A UI framework invokes event handlers.
- A DI container constructs objects.

Dependency injection is one form of IoC for object construction.

Dependency Inversion is specifically about source-code dependencies between high-level policy and low-level details.

### The Composition Root

The composition root is the single location where the application's object graph is assembled.

In ASP.NET Core:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("Orders")));

builder.Services.AddScoped<IOrderRepository, EfOrderRepository>();
builder.Services.AddScoped<IUnitOfWork, EfUnitOfWork>();
builder.Services.AddScoped<
    IConfirmOrderUseCase,
    ConfirmOrderHandler>();

var app = builder.Build();
```

The composition root is allowed to know concrete types. The rest of the application should not use the DI container as a service locator.

### Project References in a .NET Solution

A common dependency structure:

```text
Orders.Domain
  references:
  - no application projects

Orders.Application
  references:
  - Orders.Domain

Orders.Infrastructure
  references:
  - Orders.Application
  - Orders.Domain
  - EF Core and external SDKs

Orders.Api
  references:
  - Orders.Application
  - Orders.Infrastructure for composition
```

The API's infrastructure reference should be confined to startup registration or an infrastructure registration extension:

```csharp
builder.Services.AddOrdersInfrastructure(
    builder.Configuration);
```

Application and domain code should not reference API or infrastructure.

### Inbound and Outbound Boundaries

Dependency inversion applies on both sides of the application.

#### Inbound Boundary

An inbound adapter drives a use case:

```csharp
public interface ITransferFundsUseCase
{
    Task<TransferFundsResult> ExecuteAsync(
        TransferFunds command,
        CancellationToken cancellationToken);
}
```

Possible adapters:

- HTTP endpoint.
- Message consumer.
- CLI.
- Scheduled job.
- Integration test.

#### Outbound Boundary

The use case drives an external capability:

```csharp
public interface IAccountRepository
{
    Task<Account?> GetAsync(
        AccountId id,
        CancellationToken cancellationToken);
}
```

Possible adapters:

- EF Core.
- Remote banking API.
- In-memory fake.

The application owns both ports because both describe its interaction model.

### External API Adapter Example

The domain should not depend on a vendor SDK:

```csharp
public interface IPaymentAuthorizer
{
    Task<PaymentAuthorization> AuthorizeAsync(
        Money amount,
        PaymentMethod method,
        CancellationToken cancellationToken);
}
```

Infrastructure translates to the vendor:

```csharp
public sealed class AcmePaymentAuthorizer(
    AcmePaymentsClient client) : IPaymentAuthorizer
{
    public async Task<PaymentAuthorization> AuthorizeAsync(
        Money amount,
        PaymentMethod method,
        CancellationToken cancellationToken)
    {
        AcmeAuthorizationResponse response =
            await client.AuthorizeAsync(
                new AcmeAuthorizationRequest
                {
                    Amount = amount.ToMinorUnits(),
                    Currency = amount.Currency,
                    PaymentToken = method.Token
                },
                cancellationToken);

        return new PaymentAuthorization(
            response.Id,
            response.Status == "approved",
            MapDeclineReason(response.DeclineCode));
    }
}
```

The adapter absorbs:

- Vendor models.
- Vendor naming.
- Authentication.
- Error translation.
- Retry and timeout policy.
- SDK upgrades.

### Time and Other Environmental Dependencies

Code often depends implicitly on the environment:

```csharp
public bool IsExpired()
{
    return ExpiresAtUtc <= DateTimeOffset.UtcNow;
}
```

Modern .NET provides `TimeProvider`:

```csharp
public sealed class SubscriptionService(TimeProvider timeProvider)
{
    public bool IsExpired(Subscription subscription)
    {
        return subscription.ExpiresAtUtc <=
            timeProvider.GetUtcNow();
    }
}
```

Tests can use a controllable time provider. This is preferable to inventing a custom interface when the platform abstraction already expresses the need.

Other environmental dependencies include:

- Current user.
- Random values.
- File system.
- Process environment.
- Network.
- Host shutdown.

Invert them when deterministic behavior or boundary isolation matters.

### Persistence Ignorance

Persistence ignorance means domain behavior is not shaped by a persistence technology.

Good domain model:

```csharp
public sealed class Money
{
    public decimal Amount { get; }
    public string Currency { get; }

    public Money(decimal amount, string currency)
    {
        if (amount < 0)
        {
            throw new DomainException(
                "Money cannot be negative.");
        }

        Amount = amount;
        Currency = currency;
    }
}
```

Infrastructure maps it with EF Core configuration:

```csharp
builder.OwnsOne(
    order => order.Total,
    money =>
    {
        money.Property(value => value.Amount)
            .HasColumnName("TotalAmount");
        money.Property(value => value.Currency)
            .HasColumnName("Currency");
    });
```

Persistence ignorance is not absolute technology neutrality. Aggregate size, consistency, query needs, and storage behavior still influence practical design. The objective is to avoid unnecessary direct dependencies in business code.

### Framework Independence

Framework independence means the application's core behavior is not expressed in framework-specific types.

Avoid:

```csharp
public IActionResult ConfirmOrder(Guid id);
```

inside the application layer.

Prefer:

```csharp
public Task<ConfirmOrderResult> HandleAsync(
    ConfirmOrder command,
    CancellationToken cancellationToken);
```

The API adapter maps the application result:

```csharp
return result switch
{
    ConfirmOrderResult.Confirmed => Results.NoContent(),
    ConfirmOrderResult.NotFound => Results.NotFound(),
    ConfirmOrderResult.Invalid invalid =>
        Results.BadRequest(new { invalid.Message }),
    _ => Results.StatusCode(500)
};
```

### Domain Events and Infrastructure

Domain events should be domain concepts:

```csharp
public sealed record OrderConfirmed(
    OrderId OrderId) : IDomainEvent;
```

They should not depend on a broker message type. Infrastructure or application coordination can translate them into integration events:

```csharp
public sealed record OrderConfirmedV1(
    Guid OrderId,
    DateTimeOffset ConfirmedAtUtc);
```

This prevents Azure Service Bus, Kafka, or another broker SDK from becoming a domain dependency.

### Transactions and Inward Dependencies

The application may define a transaction-oriented port:

```csharp
public interface IUnitOfWork
{
    Task SaveChangesAsync(
        CancellationToken cancellationToken);
}
```

Infrastructure decides whether this means:

- `DbContext.SaveChangesAsync`.
- An explicit database transaction.
- A document-database batch.
- Another persistence mechanism.

Do not create an abstraction that falsely claims all transaction technologies are identical. The port should express only the guarantees the application actually requires.

### Testing Benefits and Limits

Dependency inversion allows high-level policy to be tested with controlled implementations:

```csharp
public sealed class StubPaymentAuthorizer(
    bool approved) : IPaymentAuthorizer
{
    public Task<PaymentAuthorization> AuthorizeAsync(
        Money amount,
        PaymentMethod method,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(
            new PaymentAuthorization(
                "test-auth",
                approved,
                approved ? null : "declined"));
    }
}
```

This is useful for domain or application scenarios.

It does not replace integration tests:

- EF Core queries must be tested against a realistic database.
- HTTP routing and model binding require pipeline tests.
- Broker configuration and serialization require integration or contract tests.
- Vendor adapters require sandbox, stub-server, or contract testing.

Testability is a benefit of a good boundary, not a reason to mock every class.

### Service Locator Anti-Pattern

Service location asks a global container for dependencies:

```csharp
public sealed class ConfirmOrderHandler(
    IServiceProvider services)
{
    public async Task HandleAsync(
        ConfirmOrder command,
        CancellationToken cancellationToken)
    {
        var repository =
            services.GetRequiredService<IOrderRepository>();

        // ...
    }
}
```

Problems:

- Required dependencies are hidden.
- Invalid objects can be constructed.
- Tests require container setup.
- Runtime failures replace compile-time feedback.
- Application code depends on the DI framework.

Prefer explicit constructor injection:

```csharp
public sealed class ConfirmOrderHandler(
    IOrderRepository repository)
{
}
```

Use `IServiceProvider` only in infrastructure-level factories or framework integration where dynamic resolution is genuinely required.

### Captive Dependencies and Lifetimes

Correct dependency direction does not guarantee correct DI lifetimes.

A singleton must not capture a scoped dependency:

```csharp
builder.Services.AddSingleton<OrderCache>();
builder.Services.AddScoped<AppDbContext>();
```

If `OrderCache` directly receives `AppDbContext`, the scoped context becomes captive for the singleton's lifetime.

Choose lifetimes based on ownership and thread-safety:

- **Transient:** New instance for each resolution.
- **Scoped:** One instance per request or explicit scope.
- **Singleton:** One instance for the application lifetime.

Validate scopes during development and avoid manually building nested service providers.

### Circular Dependencies

Circular dependencies are a sign that responsibilities or boundaries are unclear:

```text
Application A -> Application B -> Application A
```

Possible fixes:

- Extract a shared lower-level concept.
- Move behavior to the module that owns the invariant.
- Define an event or callback where temporal decoupling is appropriate.
- Introduce a higher-level orchestrator.
- Reconsider the module boundary.

Do not resolve a conceptual cycle merely by adding interfaces on both sides. That can hide the cycle without fixing ownership.

### Dependency Inversion Across Modules

The principle applies beyond classes.

Suppose Billing needs customer status from Customer Management.

Weak coupling:

```text
Billing -> CustomerManagement.Infrastructure.Database
```

Better module contract:

```text
Billing -> CustomerManagement.Contracts
CustomerManagement -> CustomerManagement.Contracts
```

Or the consuming module can own a port:

```text
CustomerManagement.Adapter -> Billing.ICustomerCreditStatus
```

The correct ownership depends on whether the interaction is a published provider contract or a consumer-specific adapter.

For cross-process communication, contracts must also address:

- Versioning.
- Availability.
- Timeouts.
- Idempotency.
- Eventual consistency.
- Observability.

### Dependency Inversion in a Modular Monolith

Modules can expose narrow application contracts while hiding implementation types.

```text
Orders
  - Domain
  - Application
  - Infrastructure

Payments
  - Domain
  - Application
  - Infrastructure
```

Orders should not query Payments tables directly. It can use:

- A published Payments contract.
- An internal event.
- A consumer-owned port implemented by an adapter.

The modular monolith keeps calls in-process while preserving boundaries that could support later extraction.

### When Not to Invert a Dependency

Do not add an abstraction automatically.

Direct dependency can be appropriate when:

- The dependency is a stable language or framework primitive.
- The code is local and unlikely to vary.
- The abstraction would only mirror the concrete API.
- The dependency and consumer belong to the same cohesive module.
- Integration tests are more valuable than substitution.

Examples:

- Depending on `List<T>`.
- Using `ILogger<T>` directly.
- Using `CancellationToken`.
- Using `TimeProvider` instead of a custom clock interface.
- Calling a cohesive internal class directly.

Invert dependencies at architectural boundaries and volatile details, not at every `new` expression.

### Common Mistakes

#### Confusing DI with DIP

Injecting a concrete class is dependency injection but not necessarily dependency inversion.

#### Putting All Interfaces in a Shared Project

A large `Common.Abstractions` project can become a dependency magnet. Place contracts near the policy or consumer that owns them.

#### Generic Lowest-Common-Denominator Ports

Generic abstractions can hide useful capabilities while still leaking technical concepts.

#### Leaking Outer Types Inward

Examples:

- `HttpContext` in application services.
- `IActionResult` in use cases.
- EF Core `DbSet<T>` in domain services.
- Vendor DTOs in domain entities.
- Broker message types in domain events.

#### Using Interfaces Only for Mocks

This often creates production abstractions shaped by a testing tool rather than by the application design.

#### Hiding Dependencies

Static globals, ambient context, and service location make classes appear simpler while increasing runtime coupling.

#### Over-Inverting Stable Internal Code

An interface around every internal class creates navigation and configuration without protecting a meaningful boundary.

#### Claiming Complete Technology Independence

Abstractions reduce coupling but cannot erase important semantics such as transactions, consistency, query capabilities, delivery guarantees, and latency.

### Best Practices

- Identify high-level policy before choosing abstractions.
- Point project references toward policy.
- Let consumers own the ports they require.
- Keep interfaces narrow and use-case-oriented.
- Translate transport, persistence, and vendor models at adapters.
- Keep construction in the composition root.
- Use constructor injection for required dependencies.
- Avoid service location.
- Prefer platform abstractions when they already fit.
- Test core policy in isolation and adapters through integration tests.
- Validate DI lifetimes.
- Enforce boundaries with project references and architecture tests.
- Do not introduce an interface without a boundary or variation reason.
- Revisit abstractions when the system's real needs become clearer.

### Decision Checklist

Before inverting a dependency, ask:

```text
1. Is this dependency an external or volatile detail?
2. Does high-level policy need protection from it?
3. What exact capability does the consumer require?
4. Who should own the abstraction?
5. Can a platform abstraction already satisfy the need?
6. What technology-specific models must be translated?
7. What guarantees must the port express?
8. How will the adapter be integration-tested?
9. Does the added abstraction reduce total change cost?
```

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the Dependency Inversion Principle?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-beginner-q01 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Dependency Inversion says high-level policy should not depend directly on low-level implementation details. Both should depend on abstractions, and details should implement abstractions shaped by the high-level need.

For example, an order use case depends on `IOrderRepository`. An EF Core repository in infrastructure implements that interface. The application therefore does not reference EF Core or the concrete repository.

The principle reduces coupling between business behavior and technologies that may change independently.

##### Key Points to Mention

- Protects high-level policy from low-level details.
- Both sides depend on abstractions.
- Details implement core-owned contracts.
- It concerns compile-time dependency direction.
- It can improve testability and replaceability.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-beginner-q01 -->

#### What is an inward-facing dependency?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-beginner-q02 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

An inward-facing dependency points from an outer technical layer toward an inner policy layer. Infrastructure can reference application contracts, and application can reference domain types. Domain and application do not reference the outer implementation details.

The runtime call might still reach outward to a database or external API. The important point is that the source-code reference points toward the abstraction owned by the core.

##### Key Points to Mention

- Outer layers depend on inner layers.
- Inner layers contain higher-level policy.
- Source-code dependencies differ from runtime calls.
- Domain should not depend on infrastructure.
- This is the core Dependency Rule in Clean Architecture.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-beginner-q02 -->

#### What is the difference between dependency inversion and dependency injection?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-beginner-q03 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Dependency inversion is a design principle about how modules depend on policy and abstractions. Dependency injection is a construction technique where an object's dependencies are supplied from outside.

Constructor injection can support dependency inversion, but injecting a concrete infrastructure class does not invert the dependency. Conversely, dependency inversion can be implemented with manual construction and no DI container.

##### Key Points to Mention

- DIP is an architectural principle.
- DI is an object-construction technique.
- DI often wires DIP-based designs.
- Injecting concrete classes is still DI.
- A container is not required for DIP.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-beginner-q03 -->

#### Why is constructor injection commonly preferred?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-beginner-q04 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Constructor injection makes required dependencies explicit and ensures an object cannot be created without them. It improves readability, allows immutable dependency fields, and gives compile-time feedback when construction is incomplete.

Property injection can create partially initialized objects. Service location hides dependencies until runtime. Method injection is useful when a dependency is required only for one operation, but constructor injection is the normal choice for object-wide requirements.

##### Key Points to Mention

- Makes required dependencies explicit.
- Supports valid construction.
- Works well with immutable fields.
- Avoids hidden runtime resolution.
- Property injection can permit invalid state.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Who should own an interface used to invert a dependency?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-intermediate-q01 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

The consumer or high-level policy should usually own the interface. The contract should describe what the application needs, not expose the full API of the implementation technology.

For example, `IOrderRepository` belongs in Application or Domain, while `EfOrderRepository` belongs in Infrastructure. Infrastructure references and implements the application-owned contract.

Provider-owned contracts can be valid for published module APIs, but application-specific ports should be shaped by their consumers.

##### Key Points to Mention

- Consumer ownership creates the inversion.
- Define contracts near high-level policy.
- Infrastructure implements the contract.
- Keep interfaces narrow.
- Provider contracts and consumer ports serve different purposes.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-intermediate-q01 -->

#### Does using an interface automatically satisfy Dependency Inversion?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-intermediate-q02 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

No. An interface can still belong to and expose the model of a low-level module. If the application references an infrastructure abstraction package, the dependency may remain outward even though the concrete class is hidden.

The interface must represent a stable capability required by high-level policy, and its ownership and source-code references must point in the intended direction.

An interface that merely copies a concrete API can also add indirection without reducing coupling.

##### Key Points to Mention

- Interfaces alone do not determine dependency direction.
- Ownership and contract shape matter.
- Avoid infrastructure-shaped abstractions.
- Avoid one-to-one interfaces without boundary value.
- Examine project references, not only type names.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-intermediate-q02 -->

#### How should ASP.NET Core wire inward dependencies?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-intermediate-q03 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

ASP.NET Core should wire abstractions to concrete implementations in the composition root, normally `Program.cs` or registration extensions called from it.

Application handlers depend on application-owned interfaces. Infrastructure implements them. The API startup code registers those mappings with the DI container.

Concrete infrastructure references should remain in composition code. Controllers and application services should request abstractions rather than resolving dependencies through `IServiceProvider`.

##### Key Points to Mention

- Use `Program.cs` as the composition root.
- Register infrastructure implementations for application ports.
- Keep concrete types out of business code.
- Prefer constructor injection.
- Avoid service location.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-intermediate-q03 -->

#### How do you avoid leaking infrastructure types into the application core?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-intermediate-q04 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Define commands, results, value objects, and ports in the core. Adapters translate framework, persistence, and vendor types at boundaries.

For example, an endpoint converts an HTTP request into an application command. An EF Core repository converts database state into domain objects. A payment adapter converts vendor responses into an application-owned authorization result.

Project references should prevent the core from importing ASP.NET Core, EF Core, broker SDK, or vendor packages.

##### Key Points to Mention

- Translate at adapters.
- Use core-owned request and result types.
- Keep vendor DTOs outside the core.
- Keep `HttpContext` and `IActionResult` at the API boundary.
- Enforce rules with project references.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-intermediate-q04 -->

#### When is dependency inversion unnecessary?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-intermediate-q05 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Dependency inversion is unnecessary when the dependency is stable, local, cohesive with the consumer, and does not represent an architectural boundary. Adding an interface would then only mirror the concrete API and increase navigation.

Examples include ordinary collections, value objects, internal stateless helpers, or platform abstractions that already meet the need.

Use inversion for volatile external details, module boundaries, meaningful policy variation, and behavior requiring deterministic substitution. Do not create an interface for every class.

##### Key Points to Mention

- Apply DIP at meaningful boundaries.
- Stable internal code can remain concrete.
- Prefer existing platform abstractions.
- Avoid interface-per-class conventions.
- Consider total change cost.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-intermediate-q05 -->

#### Why is Service Locator considered an anti-pattern?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-intermediate-q06 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Service Locator lets a class request dependencies from a container or global registry. This hides requirements from the constructor, allows invalid objects to be created, and moves dependency errors to runtime.

It also couples application code to the container and makes tests require container configuration. Constructor injection is preferred because it makes dependencies explicit.

Dynamic resolution is sometimes necessary in infrastructure factories, but it should not become the normal application dependency model.

##### Key Points to Mention

- Hides dependencies.
- Produces runtime rather than compile-time failures.
- Couples code to the container.
- Makes tests harder to understand.
- Restrict dynamic resolution to composition or infrastructure.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-intermediate-q06 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How can runtime control flow point outward while dependencies point inward?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-advanced-q01 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

The application calls an abstraction it owns. An outer adapter implements that abstraction. At runtime, polymorphism dispatches the call to the adapter, so execution reaches outward.

At compile time, the application references only its own port. The adapter references the application to implement that port. Therefore the source dependency points inward even though runtime execution reaches the database, broker, or vendor.

The composition root supplies the adapter implementation to the use case.

##### Key Points to Mention

- Distinguish source dependency from execution flow.
- The core owns the port.
- The adapter implements the port.
- Runtime polymorphism reaches the adapter.
- The composition root connects both sides.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-advanced-q01 -->

#### How would you design a port without creating a lowest-common-denominator abstraction?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-advanced-q02 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Design the port from a specific consumer's use case and required guarantees. Use domain language and expose only operations the consumer needs.

Do not attempt to represent every capability of SQL, document stores, and remote APIs through one generic repository. That usually creates a weak abstraction or leaks query mechanics such as `IQueryable`.

If different consumers need substantially different capabilities, define separate ports. Accept that technology semantics such as transactions or consistency may require explicit contracts rather than pretending every adapter is interchangeable.

##### Key Points to Mention

- Start from consumer needs.
- Use domain-specific operations.
- Keep interfaces segregated.
- Avoid generic ORM mirrors.
- Express required guarantees explicitly.
- Do not hide meaningful technology differences.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-advanced-q02 -->

#### How does Dependency Inversion apply between modules or services?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-advanced-q03 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Modules should depend on explicit contracts rather than another module's internal database or implementation classes. The provider can publish a stable contract, or the consumer can define a port that an adapter uses to call the provider.

Within a modular monolith, the adapter may make an in-process call. Across services, it makes a network or messaging call. Distribution adds availability, latency, versioning, idempotency, and consistency concerns that the contract must acknowledge.

Dependency inversion protects module ownership but does not eliminate distributed-system complexity.

##### Key Points to Mention

- Do not depend on another module's internals.
- Use published contracts or consumer-owned ports.
- Adapters can be in-process or remote.
- Remote boundaries add failure and consistency concerns.
- Contracts require versioning and observability.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-advanced-q03 -->

#### How do you handle transactions without leaking persistence details inward?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-advanced-q04 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

The application defines the consistency boundary of the use case and can depend on a narrow unit-of-work or transaction port expressing only the guarantees it needs. Infrastructure implements that port with EF Core or another storage mechanism.

The domain should not call database transaction APIs. For operations spanning a database and message broker, a single local transaction cannot normally cover both. Use patterns such as outbox, retries, and idempotent consumers where reliable delivery is required.

The abstraction must not claim stronger guarantees than an adapter can provide.

##### Key Points to Mention

- Application owns consistency requirements.
- Infrastructure owns transaction mechanics.
- Keep database APIs outside the domain.
- Cross-resource operations require explicit reliability patterns.
- Ports must express realistic guarantees.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-advanced-q04 -->

#### How would you test a DIP-based architecture without overusing mocks?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-advanced-q05 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Unit-test domain policy directly. Test application use cases with small fakes or stubs for owned ports when isolation clarifies the scenario. Avoid mocking every internal collaborator or verifying incidental call sequences.

Test infrastructure adapters with integration tests against realistic databases, HTTP servers, broker containers, or vendor sandboxes. Test the API through the ASP.NET Core pipeline.

The architecture should produce clear test seams, but each boundary must still be tested at the level where its real semantics appear.

##### Key Points to Mention

- Unit-test domain behavior.
- Use focused fakes for application ports.
- Avoid implementation-detail interaction tests.
- Integration-test adapters.
- Exercise routing and binding through pipeline tests.
- DIP does not remove the need for real infrastructure tests.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-advanced-q05 -->

#### How would you identify a false or ineffective application of Dependency Inversion?

<!-- question:start:dependency-inversion-and-inward-facing-dependencies-advanced-q06 -->
<!-- question-id:dependency-inversion-and-inward-facing-dependencies-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Inspect project references, interface ownership, and the types crossing boundaries. Warning signs include application projects referencing infrastructure abstraction packages, interfaces that copy concrete APIs, `IQueryable` leaking through repositories, framework types inside use cases, and a service locator used throughout the core.

Also look for one-to-one interfaces created only by convention and circular dependencies hidden behind abstractions. A correct design should let high-level policy compile without the low-level implementation project.

##### Key Points to Mention

- Check source references, not only DI registrations.
- Check who owns each interface.
- Look for leaking framework and vendor types.
- Look for service location.
- Watch for generic pass-through contracts.
- Verify the core can compile independently.

<!-- question:end:dependency-inversion-and-inward-facing-dependencies-advanced-q06 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
