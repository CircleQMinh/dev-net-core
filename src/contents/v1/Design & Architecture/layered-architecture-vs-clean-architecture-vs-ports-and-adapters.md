---
id: layered-architecture-vs-clean-architecture-vs-ports-and-adapters
topic: Clean Architecture and modular boundaries
subtopic: Layered architecture vs Clean Architecture vs ports-and-adapters
category: Design & Architecture
---

## Overview

Layered Architecture, Clean Architecture, and Ports-and-Adapters are related ways to organize software around responsibilities and boundaries. All three try to reduce coupling and make change safer, but they differ in how they define boundaries and, most importantly, in the direction of compile-time dependencies.

Traditional Layered Architecture commonly separates an application into presentation, business logic, and data access layers:

```text
Presentation
    |
Business Logic
    |
Data Access
    |
Database
```

This structure is familiar and works well for many business applications. Its main weakness is that business logic often depends directly on data access or framework details.

Clean Architecture places business rules and application use cases at the center. User interfaces, databases, messaging systems, external APIs, and frameworks are treated as replaceable details around that center. Compile-time dependencies point inward:

```text
Frameworks and Infrastructure
              |
          Adapters
              |
       Application Use Cases
              |
            Domain
```

Ports-and-Adapters, also called Hexagonal Architecture, describes the same broad goal from an interaction perspective. The application exposes or consumes ports, which are technology-independent contracts. Adapters connect those ports to HTTP, databases, message brokers, command-line applications, tests, and external services.

These approaches are used in ASP.NET Core APIs, modular monoliths, desktop applications, background workers, microservices, and systems with substantial business rules or multiple external integrations.

The topic matters in interviews because candidates are expected to do more than draw layers. A strong answer explains:

- The difference between a layer and a deployment tier.
- How compile-time dependencies differ from runtime call flow.
- Where domain entities and use cases belong.
- What ports and adapters are.
- How ASP.NET Core dependency injection wires the design together.
- What each architecture improves.
- What complexity each architecture introduces.
- When a simpler design is more appropriate.

The practical goal is not architectural purity. It is to keep business behavior understandable and protect it from details that change for unrelated reasons.

## Core Concepts

### Architecture, Structure, and Dependency Direction

Software architecture describes the high-level organization of a system, its major boundaries, and the rules governing how parts interact.

Three different views are important:

- **Code organization:** Projects, folders, modules, namespaces, and packages.
- **Compile-time dependencies:** Which project or type references another.
- **Runtime interactions:** Which object calls another while the application runs.

These views are related but not identical.

For example, an application service can call a repository implementation at runtime while having no compile-time dependency on that implementation:

```text
Compile time:
Infrastructure -> Application

Runtime:
Application service -> Repository implementation
```

This is possible because the application service depends on an interface owned by the application, and infrastructure implements it.

Understanding this distinction is essential for Clean Architecture and Ports-and-Adapters.

### Logical Layers vs Physical Tiers

A **layer** is a logical separation inside the codebase. A **tier** is a physical deployment or process boundary.

An application can have several layers while being deployed as one process:

```text
One ASP.NET Core deployment
  - API layer
  - Application layer
  - Domain layer
  - Infrastructure layer
```

It can also distribute tiers across processes or machines:

```text
Browser tier -> API tier -> Database tier
```

Calling an architecture "three-tier" does not necessarily describe its internal code dependencies. Likewise, a four-project Clean Architecture solution can still be a monolith deployed as one unit.

Common interview mistake:

```text
Layer = project
Tier = server
```

That statement is a useful approximation, but the deeper distinction is logical responsibility versus physical deployment.

### Traditional Layered Architecture

Traditional Layered Architecture organizes code by technical responsibility.

Typical layers include:

- **Presentation layer:** Controllers, endpoints, UI models, and serialization.
- **Business logic layer:** Services, workflows, and business rules.
- **Data access layer:** Database queries, ORM code, and repositories.
- **Database:** Persistent storage.

Typical dependency flow:

```text
Presentation -> Business Logic -> Data Access
```

Typical runtime flow follows the same direction:

```text
HTTP request
  -> Controller
  -> Business service
  -> Data access service
  -> Database
```

#### Closed and Open Layers

In a **closed-layer** design, a layer can call only the layer immediately below it:

```text
Presentation -> Business -> Data Access
```

The presentation layer cannot call data access directly.

In an **open-layer** design, a layer can skip lower layers:

```text
Presentation ---------> Data Access
             \-> Business
```

Closed layers enforce boundaries more strongly but can create pass-through methods. Open layers can reduce ceremony for simple operations but make dependencies harder to control.

#### Benefits of Layered Architecture

- Familiar to many developers.
- Easy to explain and start.
- Clear separation of technical concerns.
- Suitable for straightforward CRUD applications.
- Often maps naturally to existing enterprise systems.
- Can remain one simple deployment.
- Supports gradual migration from older applications.

#### Limitations of Traditional Layering

The most important limitation is downward dependency:

```text
Business Logic -> Data Access implementation
```

This can cause:

- Business rules coupled to EF Core, SQL, or a specific storage model.
- Unit tests that require database infrastructure.
- Persistence concerns leaking into business behavior.
- Changes to lower layers affecting higher layers.
- An anemic business layer that only forwards CRUD calls.
- Features spread horizontally across several technical folders.

Layering itself is not the problem. The issue is allowing important policies to depend directly on volatile details.

### Clean Architecture

Clean Architecture organizes the application around business rules and use cases. The exact project names vary, but a common model includes:

- **Domain:** Enterprise or business rules.
- **Application:** Use cases and application-specific orchestration.
- **Adapters:** Translation between external models and application contracts.
- **Infrastructure and frameworks:** Databases, HTTP frameworks, messaging, file systems, and vendors.

The central rule is:

```text
Source-code dependencies point inward.
```

Outer layers may depend on inner layers. Inner layers must not depend on outer layers.

```text
API ------------\
Infrastructure ---> Application ---> Domain
Worker ---------/
```

The domain does not reference ASP.NET Core, EF Core, message brokers, or vendor SDKs. Application use cases can depend on domain types and on abstractions required to perform external work.

#### Domain Layer

The domain contains business concepts and rules:

- Entities.
- Value objects.
- Aggregates.
- Domain services.
- Domain events.
- Invariants.
- Domain-specific exceptions.

Example:

```csharp
public sealed class Order
{
    private readonly List<OrderLine> _lines = [];

    public OrderId Id { get; }
    public OrderStatus Status { get; private set; }
    public IReadOnlyCollection<OrderLine> Lines => _lines;

    public void Confirm()
    {
        if (_lines.Count == 0)
        {
            throw new DomainException(
                "An order must contain at least one line.");
        }

        if (Status != OrderStatus.Draft)
        {
            throw new DomainException(
                "Only draft orders can be confirmed.");
        }

        Status = OrderStatus.Confirmed;
    }
}
```

This rule does not need to know whether the order is stored with EF Core, MongoDB, or an external service.

#### Application Layer

The application layer coordinates use cases:

- Receives an application request.
- Loads required domain objects.
- Invokes domain behavior.
- Coordinates external operations through interfaces.
- Commits results.
- Returns an application result.

```csharp
public sealed class ConfirmOrderHandler(
    IOrderRepository orders,
    IUnitOfWork unitOfWork)
{
    public async Task HandleAsync(
        ConfirmOrder command,
        CancellationToken cancellationToken)
    {
        Order order = await orders.GetAsync(
            command.OrderId,
            cancellationToken)
            ?? throw new OrderNotFoundException(command.OrderId);

        order.Confirm();

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
```

The handler defines what the use case needs. It does not know how the repository reaches the database.

#### Infrastructure Layer

Infrastructure implements external details:

- EF Core `DbContext`.
- Repository implementations.
- Email or SMS gateways.
- File storage.
- Message publishers.
- HTTP clients.
- Clock, identity, and configuration adapters.

```csharp
public sealed class EfOrderRepository(AppDbContext db)
    : IOrderRepository
{
    public Task<Order?> GetAsync(
        OrderId id,
        CancellationToken cancellationToken)
    {
        return db.Orders
            .Include(order => order.Lines)
            .SingleOrDefaultAsync(
                order => order.Id == id,
                cancellationToken);
    }
}
```

Infrastructure references the application or domain project because it implements their contracts.

#### Presentation Layer

The presentation layer translates transport details into application requests:

```csharp
app.MapPost(
    "/orders/{orderId:guid}/confirmation",
    async (
        Guid orderId,
        ConfirmOrderHandler handler,
        CancellationToken cancellationToken) =>
    {
        await handler.HandleAsync(
            new ConfirmOrder(new OrderId(orderId)),
            cancellationToken);

        return Results.NoContent();
    });
```

HTTP status codes, route values, JSON, and authentication metadata remain at the boundary rather than entering the domain.

### Ports-and-Adapters Architecture

Ports-and-Adapters views the application as a core surrounded by external actors and technologies.

```text
           HTTP Adapter
                |
            Input Port
                |
Database <-- Application Core --> Payment Provider
Adapter       |             |        Adapter
          Output Port   Output Port
```

A **port** is a technology-independent interaction point. An **adapter** translates between a specific technology and a port.

The architecture is called hexagonal not because systems need six sides, but because the shape allows multiple interchangeable connections around the application.

### Primary and Secondary Actors

Ports-and-Adapters commonly distinguishes actors by their relationship to the application.

- **Primary or driving actor:** Initiates an interaction with the application.
- **Secondary or driven actor:** Is called by the application to complete work.

Primary actors:

- HTTP clients.
- Command-line users.
- Scheduled jobs.
- Message consumers.
- Automated tests.

Secondary actors:

- Databases.
- Message brokers.
- Payment providers.
- File storage.
- Email services.
- External APIs.

The terms describe interaction direction, not importance.

### Input Ports and Output Ports

An **input port** describes a use case the application offers.

```csharp
public interface IConfirmOrderUseCase
{
    Task ExecuteAsync(
        ConfirmOrder command,
        CancellationToken cancellationToken);
}
```

An HTTP endpoint and a message consumer can both be input adapters:

```text
HTTP endpoint -----\
                    -> IConfirmOrderUseCase
Message consumer --/
```

An **output port** describes something the application needs from the outside:

```csharp
public interface IOrderRepository
{
    Task<Order?> GetAsync(
        OrderId id,
        CancellationToken cancellationToken);
}
```

EF Core, an in-memory test implementation, or a remote API can provide output adapters.

Some teams call these ports **inbound/outbound**, **driving/driven**, or **primary/secondary**. The terminology varies, but the boundary principle is the same.

### Adapters Translate, Not Just Forward

A meaningful adapter protects one model from another.

An HTTP adapter translates:

- Route and query values.
- JSON request models.
- Authentication context.
- Validation failures.
- Application results.
- HTTP status codes.

A database adapter translates:

- Domain identifiers.
- Persistence models.
- Queries.
- Transactions.
- Concurrency failures.

An external API adapter translates:

- Vendor request and response formats.
- Authentication.
- Error codes.
- Retries and timeouts.
- Vendor-specific identifiers.

An adapter that only mirrors another API may be unnecessary unless it establishes a boundary that is expected to matter.

### Clean Architecture vs Ports-and-Adapters

The two approaches strongly overlap.

Both:

- Keep business behavior independent of external technology.
- Use dependency inversion at boundaries.
- Treat databases and frameworks as details.
- Support multiple adapters.
- Encourage testing through stable application contracts.

Different emphasis:

| Clean Architecture | Ports-and-Adapters |
|---|---|
| Emphasizes concentric policy layers | Emphasizes application ports and external adapters |
| Often distinguishes Domain and Application | Often discusses one application core |
| Uses the Dependency Rule | Uses driving and driven interactions |
| Frequently shown as circles | Frequently shown as a hexagon |
| Focuses on policy level | Focuses on boundary interaction |

In practice, a solution can be described accurately by both names.

### Clean Architecture vs Traditional Layered Architecture

The decisive difference is dependency direction.

Traditional:

```text
Presentation -> Business -> Data Access
```

Clean:

```text
Presentation ----\
                  -> Application -> Domain
Infrastructure --/
```

Traditional layering can still be well designed. It can use interfaces, encapsulate data access, and maintain strong boundaries. Clean Architecture applies dependency inversion more systematically so that important business policy does not depend on external details.

### Runtime Flow vs Compile-Time Dependency

This is a frequent interview topic.

At runtime:

```text
Endpoint
  -> Application handler
  -> Repository interface
  -> EF repository
  -> Database
```

At compile time:

```text
API -> Application
Infrastructure -> Application
Application -> Domain
```

The application calls infrastructure behavior through an abstraction, but infrastructure owns the implementation and references the contract.

### The Composition Root

The composition root is the location where concrete implementations are connected to abstractions.

In ASP.NET Core, it is usually `Program.cs` or an extension called from it:

```csharp
builder.Services.AddScoped<IOrderRepository, EfOrderRepository>();
builder.Services.AddScoped<IUnitOfWork>(
    serviceProvider =>
        serviceProvider.GetRequiredService<AppDbContext>());
builder.Services.AddScoped<IConfirmOrderUseCase, ConfirmOrderHandler>();
```

The entry-point project may reference infrastructure for registration. This is acceptable when concrete types remain confined to composition code.

```text
Compile-time exception:
API references Infrastructure only at the composition root.

Runtime result:
The DI container supplies infrastructure implementations
to application-owned interfaces.
```

Do not hide the composition root behind service location throughout the application. Dependencies should remain explicit in constructors or method parameters.

### Example .NET Solution Structures

#### Traditional Layered Solution

```text
Shop.Api
  -> Shop.Business
      -> Shop.Data

Shop.Data
  -> EF Core
  -> SQL Server
```

Possible folders:

```text
Shop.Api/
  Controllers/

Shop.Business/
  Services/
  Models/

Shop.Data/
  AppDbContext.cs
  Repositories/
```

This is simple and may be sufficient for a CRUD-focused application.

#### Clean Architecture Solution

```text
Shop.Domain

Shop.Application
  -> Shop.Domain

Shop.Infrastructure
  -> Shop.Application
  -> Shop.Domain

Shop.Api
  -> Shop.Application
  -> Shop.Infrastructure only for composition
```

Possible folders:

```text
Shop.Domain/
  Orders/
    Order.cs
    OrderLine.cs
    OrderId.cs

Shop.Application/
  Orders/
    ConfirmOrder/
      ConfirmOrder.cs
      ConfirmOrderHandler.cs
  Abstractions/
    IOrderRepository.cs
    IUnitOfWork.cs

Shop.Infrastructure/
  Persistence/
    AppDbContext.cs
    EfOrderRepository.cs
  Messaging/
  Payments/

Shop.Api/
  Endpoints/
  Contracts/
  Program.cs
```

#### Feature-Oriented Variation

Clean Architecture does not require organizing every project by technical type.

```text
Shop.Application/
  Orders/
    CreateOrder/
    ConfirmOrder/
    CancelOrder/
  Customers/
    RegisterCustomer/
```

Feature-oriented folders often improve discoverability while project references still enforce architectural dependencies.

### Testing Across the Boundaries

Different layers require different tests.

#### Domain Tests

Test business invariants without infrastructure:

```csharp
[Fact]
public void Confirm_rejects_an_empty_order()
{
    var order = Order.CreateDraft();

    Action confirm = order.Confirm;

    confirm.Should().Throw<DomainException>();
}
```

#### Application Tests

Use fakes for owned ports where isolation is useful:

```csharp
var repository = new InMemoryOrderRepository(existingOrder);
var unitOfWork = new SpyUnitOfWork();
var handler = new ConfirmOrderHandler(repository, unitOfWork);

await handler.HandleAsync(command, CancellationToken.None);

unitOfWork.SaveCount.Should().Be(1);
```

#### Adapter Integration Tests

Test infrastructure against the real technology or a realistic substitute:

- EF Core repository against SQL Server, PostgreSQL, or SQLite as appropriate.
- HTTP adapter through `WebApplicationFactory`.
- Message adapter against a broker container or test environment.
- Vendor adapter against a sandbox or contract test.

Clean Architecture does not eliminate integration testing. It makes test responsibilities clearer.

### Data Models Across Boundaries

One model should not automatically be reused everywhere.

Potential model types:

- HTTP request and response contracts.
- Application commands and results.
- Domain entities and value objects.
- Persistence entities or EF Core configurations.
- External vendor DTOs.

Separate models are useful when they protect different contracts or change for different reasons. They become unnecessary ceremony when every field is mapped identically through many layers with no boundary benefit.

Example:

```csharp
public sealed record CreateOrderRequest(
    Guid CustomerId,
    IReadOnlyList<CreateOrderLineRequest> Lines);

public sealed record CreateOrder(
    CustomerId CustomerId,
    IReadOnlyList<NewOrderLine> Lines);
```

The HTTP adapter validates and translates transport concerns before invoking the use case.

### Transactions and Unit-of-Work Boundaries

Use cases often form transaction boundaries:

```text
Load aggregate
Apply business behavior
Persist changes
Publish required integration work safely
```

The domain should not start database transactions. Transaction management belongs to application or infrastructure coordination.

For a simple EF Core application, `DbContext.SaveChangesAsync` may be enough. A custom unit-of-work abstraction is justified only if it creates a useful application boundary.

### Domain Events and Integration Events

A domain event expresses something that happened inside the domain:

```csharp
public sealed record OrderConfirmed(OrderId OrderId) : IDomainEvent;
```

An integration event is an external contract published to other modules or services:

```csharp
public sealed record OrderConfirmedV1(
    Guid OrderId,
    DateTimeOffset ConfirmedAtUtc);
```

They should not automatically be the same type. An adapter or application service can translate internal events into stable external contracts.

Publishing reliably may require an outbox pattern. This is infrastructure complexity that should be introduced when reliable cross-process delivery is actually required.

### Common Mistakes

#### Treating Project Names as Architecture

Creating projects named `Domain`, `Application`, and `Infrastructure` does not create Clean Architecture if:

- The domain references EF Core.
- Application handlers use `DbContext` directly despite a claimed boundary.
- Controllers contain business rules.
- Infrastructure models leak into API contracts.
- All projects reference one another.

Architecture is enforced by dependency and responsibility rules, not labels.

#### Creating an Interface for Every Class

Dependency inversion applies at important boundaries. It does not require one interface per implementation.

Good candidates:

- Database access required by a use case.
- External payment or messaging services.
- Time, identity, or storage when they affect business behavior.

Weak candidates:

- Stateless internal classes with no boundary value.
- DTO mappers created only to satisfy a layering convention.
- Interfaces whose only consumer and implementation always change together.

#### Allowing the Domain to Know Transport or Persistence Details

Examples:

- Domain methods returning `IActionResult`.
- Domain entities decorated with API serialization behavior.
- Business rules based on HTTP status codes.
- Domain services accepting EF Core queries.
- Domain exceptions named after database errors.

Translate these concerns at adapters.

#### Excessive Mapping

Mapping is a cost. Use separate models where contracts differ. Avoid a mandatory model per layer when the objects have no independent meaning.

#### Anemic Domain with Ceremony

A system can have many Clean Architecture projects while all business behavior remains in application handlers and entities contain only getters and setters.

Place invariants near the state they protect. Use application services for orchestration, not as a replacement for all domain behavior.

#### Pass-Through Use Cases

Not every endpoint needs a command, handler, service, repository, specification, mapper, and response factory. Simple queries can use a straightforward path while respecting important boundaries.

#### Depending on the DI Container

Application and domain code should not call `IServiceProvider` to find dependencies. Service location hides requirements and couples code to the container.

Use constructor or method injection.

#### Assuming the Database Is Easily Replaceable

Clean boundaries reduce coupling, but replacing a relational database with a document database is rarely a simple adapter swap. Query behavior, transactions, consistency, indexing, and data modeling differ.

The architecture protects business policy, but it does not erase technology semantics.

### Choosing the Appropriate Style

Use a simple layered design when:

- The application is mostly CRUD.
- Business rules are limited.
- One team owns the system.
- Technology choices are stable.
- Fast delivery and low ceremony matter most.

Use Clean Architecture or Ports-and-Adapters when:

- Business rules are substantial and long-lived.
- External systems change independently.
- Multiple interfaces drive the same use cases.
- Infrastructure needs focused integration testing.
- The application must remain testable without external resources.
- Clear module boundaries matter.

Do not assume a large number of projects is required. A small application can enforce the same dependency principles with folders and internal types.

### Best Practices

- Start with business capabilities and use cases.
- Keep domain behavior independent from transport and infrastructure.
- Make dependencies explicit.
- Define ports from the application's needs.
- Keep interfaces narrow and semantic.
- Place adapters at actual technology boundaries.
- Keep the composition root at the entry point.
- Enforce project reference rules.
- Test domain policy separately from adapter integration.
- Prefer feature-oriented organization inside layers.
- Introduce mappings only where contracts genuinely differ.
- Choose the simplest architecture that satisfies current quality requirements.
- Reassess boundaries as the system and team evolve.

### Comparison Summary

| Concern | Traditional Layered | Clean Architecture | Ports-and-Adapters |
|---|---|---|---|
| Main organizing idea | Technical responsibility | Policy level and inward dependencies | Application ports and technology adapters |
| Typical dependency direction | Top to bottom | Outside to inside | Adapters to application ports |
| Business dependency on data access | Common | Avoided | Avoided |
| Database role | Bottom layer | Outer detail | Driven adapter |
| HTTP role | Top layer | Outer detail | Driving adapter |
| Testing core logic | Can require lower layers | Core can be isolated | Core can be driven through ports |
| Main strength | Familiar simplicity | Protected business policy | Explicit interaction boundaries |
| Main risk | Business coupled to details | Excessive layers and mapping | Too many ports and abstractions |
| Good fit | Straightforward business apps | Non-trivial domain applications | Multiple interfaces and integrations |

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is Layered Architecture?

<!-- question:start:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-beginner-q01 -->
<!-- question-id:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Layered Architecture organizes an application into logical groups with distinct responsibilities. A common structure contains presentation, business logic, and data access layers.

The presentation layer handles user or transport concerns. The business layer handles workflows and rules. The data access layer communicates with persistence. Traditional dependency flow usually points downward from presentation to business to data access.

The style is familiar and effective for many applications, especially straightforward CRUD systems. Its main risk is coupling important business logic to lower-level implementation details.

##### Key Points to Mention

- Separates code by responsibility.
- Common layers are presentation, business, and data access.
- Traditional dependencies point downward.
- Layers are logical, not necessarily separate deployments.
- It is simple and familiar.
- Business logic can become coupled to data access.

<!-- question:end:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-beginner-q01 -->

#### What is Clean Architecture?

<!-- question:start:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-beginner-q02 -->
<!-- question-id:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Clean Architecture places domain rules and application use cases at the center of the system. Databases, web frameworks, messaging systems, file systems, and external APIs are outer implementation details.

Its Dependency Rule says source-code dependencies should point inward toward higher-level policy. Infrastructure implements interfaces required by the application rather than the application depending directly on infrastructure implementations.

The result is a core that can be tested and evolved without requiring the UI or database in every test.

##### Key Points to Mention

- Business policy is central.
- Frameworks and databases are outer details.
- Compile-time dependencies point inward.
- Infrastructure implements core-owned abstractions.
- Runtime calls can still flow outward through interfaces.
- It improves isolation but adds structural complexity.

<!-- question:end:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-beginner-q02 -->

#### What are ports and adapters?

<!-- question:start:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-beginner-q03 -->
<!-- question-id:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A port is a technology-independent contract through which the application is used or through which it requests external behavior. An adapter connects a specific technology to that port.

An HTTP endpoint is an input adapter that calls an application use-case port. An EF Core repository is an output adapter that implements a persistence port. Tests, command-line applications, and message consumers can provide other input adapters.

Ports keep the application API stable while adapters translate technology-specific details.

##### Key Points to Mention

- Ports are application-facing contracts.
- Adapters connect technologies to ports.
- HTTP can be a driving adapter.
- A database repository can be a driven adapter.
- Adapters translate models and errors.
- The core remains independent of adapter technology.

<!-- question:end:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-beginner-q03 -->

#### What is the difference between a layer and a tier?

<!-- question:start:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-beginner-q04 -->
<!-- question-id:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A layer is a logical code boundary based on responsibility. A tier is a physical deployment, process, machine, or network boundary.

An ASP.NET Core application can contain API, application, domain, and infrastructure layers while all of them run in one process and one deployment tier. A browser, API server, and database can form three physical tiers.

Separating layers does not automatically create distributed services.

##### Key Points to Mention

- Layers are logical.
- Tiers are physical deployment boundaries.
- Several layers can run in one tier.
- Distribution introduces network failure and latency.
- Project count does not determine tier count.

<!-- question:end:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### What is the main difference between traditional layering and Clean Architecture?

<!-- question:start:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-intermediate-q01 -->
<!-- question-id:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

The main difference is compile-time dependency direction.

In traditional layering, presentation depends on business logic, which often depends on data access. In Clean Architecture, presentation and infrastructure both depend inward on application or domain contracts. The application calls infrastructure behavior at runtime through interfaces, but it does not reference concrete infrastructure implementations.

Traditional layering emphasizes technical responsibility. Clean Architecture emphasizes protecting high-level business policy from low-level details.

##### Key Points to Mention

- Traditional dependencies usually point top to bottom.
- Clean dependencies point outside to inside.
- Runtime and compile-time directions can differ.
- Infrastructure implements application-owned contracts.
- Clean Architecture protects business policy.

<!-- question:end:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-intermediate-q01 -->

#### Where should repository interfaces be defined in Clean Architecture?

<!-- question:start:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-intermediate-q02 -->
<!-- question-id:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A repository interface should normally be owned by the layer that needs the capability, usually the application or domain core. The interface describes the application's required behavior using domain language.

Infrastructure implements that interface with EF Core, another database, or an external service. This makes infrastructure depend on the core contract rather than making the core depend on infrastructure.

The interface should expose use-case or aggregate-focused operations instead of a generic copy of the ORM API.

##### Key Points to Mention

- The consumer should own the abstraction.
- Usually place it in Application or Domain.
- Infrastructure provides the implementation.
- Use domain-focused operations.
- Avoid generic CRUD contracts without boundary value.

<!-- question:end:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-intermediate-q02 -->

#### What belongs in Domain, Application, Infrastructure, and API projects?

<!-- question:start:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-intermediate-q03 -->
<!-- question-id:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Domain contains entities, value objects, aggregates, invariants, domain services, and domain events. Application contains use cases, commands, queries, orchestration, and ports required by those use cases.

Infrastructure contains EF Core, migrations, repository implementations, message brokers, file storage, and vendor integrations. API contains endpoints, controllers, authentication configuration, transport contracts, serialization, and the composition root.

Exact project names can vary. The important rule is that responsibilities and dependency direction remain clear.

##### Key Points to Mention

- Domain owns business rules.
- Application owns use cases and required ports.
- Infrastructure owns external implementations.
- API owns transport concerns and composition.
- Names matter less than dependency rules.

<!-- question:end:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-intermediate-q03 -->

#### How does dependency injection support these architectures?

<!-- question:start:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-intermediate-q04 -->
<!-- question-id:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Dependency injection connects concrete outer-layer implementations to inner-layer abstractions at runtime.

The application service depends on an interface such as `IOrderRepository`. Infrastructure implements it with `EfOrderRepository`. The ASP.NET Core composition root registers that mapping, and the container supplies the implementation when constructing the use case.

DI supports the design but does not create it automatically. If the interface is owned by infrastructure or the core still references EF Core directly, registering it in a container does not fix the dependency direction.

##### Key Points to Mention

- DI performs runtime composition.
- Inner code depends on abstractions.
- Outer code implements abstractions.
- `Program.cs` is commonly the composition root.
- DI and dependency inversion are related but different.
- Container usage alone does not guarantee Clean Architecture.

<!-- question:end:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-intermediate-q04 -->

#### How should models be handled across architecture boundaries?

<!-- question:start:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-intermediate-q05 -->
<!-- question-id:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use separate models when boundaries have different contracts or reasons to change. HTTP requests, domain entities, persistence models, and vendor DTOs often require different validation, behavior, or versioning.

Adapters should translate between models. However, creating an identical model in every layer can produce excessive mapping with no benefit.

The decision should protect genuine contracts rather than follow a rule that every layer needs its own DTO.

##### Key Points to Mention

- Separate models protect independently changing contracts.
- Adapters perform translation.
- Domain models should not expose transport concerns.
- External DTOs should not leak into the core.
- Avoid mapping ceremony where no boundary exists.

<!-- question:end:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-intermediate-q05 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How can you enforce architectural dependency rules in a .NET solution?

<!-- question:start:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-advanced-q01 -->
<!-- question-id:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Start with project references. Domain should have no references to application, infrastructure, or API. Application can reference Domain. Infrastructure can reference Application and Domain. API references Application and may reference Infrastructure only for composition.

Use `internal` visibility, namespaces, module boundaries, code review rules, and architecture tests to prevent forbidden dependencies. Build pipelines should run these tests.

The rules should focus on meaningful boundaries. Excessive project fragmentation can slow builds and navigation without improving architecture.

##### Key Points to Mention

- Project references are the first enforcement mechanism.
- Use visibility and namespaces.
- Add architecture tests for forbidden dependencies.
- Keep composition-root exceptions explicit.
- Run checks in CI.
- Avoid unnecessary project proliferation.

<!-- question:end:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-advanced-q01 -->

#### Can Clean Architecture be used in a monolith?

<!-- question:start:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-advanced-q02 -->
<!-- question-id:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Yes. Clean Architecture describes code boundaries and dependency direction, not deployment distribution.

Domain, application, infrastructure, and API components can compile and run inside one ASP.NET Core process. This preserves simple deployment and transactions while protecting core policy from external details.

A modular monolith commonly combines Clean Architecture principles with business capability modules. Services can be extracted later if independent deployment becomes necessary.

##### Key Points to Mention

- Architecture and deployment are separate concerns.
- Clean Architecture works well in monoliths.
- One process can contain several logical boundaries.
- It preserves simple operations and transactions.
- Modular boundaries can support later extraction.

<!-- question:end:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-advanced-q02 -->

#### What are the main trade-offs of Clean Architecture?

<!-- question:start:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-advanced-q03 -->
<!-- question-id:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Clean Architecture can improve isolation, testability, business-focused design, and replaceability of external details. It is especially valuable for long-lived systems with substantial business rules.

Its costs include more projects, interfaces, mapping, indirection, conventions, and onboarding. Simple operations can become difficult to trace if every request passes through many ceremonial layers.

The solution is to apply the Dependency Rule at meaningful boundaries while allowing direct code for simple behavior. Clean Architecture should reduce the cost of likely changes, not maximize abstraction.

##### Key Points to Mention

- Benefits include isolation and protected policy.
- Costs include indirection and mapping.
- It can become ceremonial.
- Apply boundaries proportionally to complexity.
- Preserve simple paths where appropriate.
- Judge architecture by change cost, not project count.

<!-- question:end:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-advanced-q03 -->

#### How do transaction boundaries fit into Ports-and-Adapters?

<!-- question:start:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-advanced-q04 -->
<!-- question-id:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

The application use case usually defines the business transaction boundary. It coordinates loading state, applying domain behavior, and requesting persistence through ports.

Infrastructure implements the transaction with EF Core or another technology. The domain should not know database transaction APIs. If the use case spans a database and message broker, a distributed transaction may not be available, so an outbox and idempotent consumers may be required.

The architecture separates transaction policy from technology while still requiring explicit consistency decisions.

##### Key Points to Mention

- Use cases often define transaction scope.
- Infrastructure implements transaction mechanics.
- Domain code should not depend on database transactions.
- Cross-resource consistency requires explicit design.
- Outbox and idempotency may be needed.
- Architecture does not remove distributed-system trade-offs.

<!-- question:end:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-advanced-q04 -->

#### How would you migrate a traditional layered application toward Clean Architecture?

<!-- question:start:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-advanced-q05 -->
<!-- question-id:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Migrate incrementally around valuable business behavior. First identify use cases and domain rules currently mixed with controllers or data access. Add characterization tests, then move business rules into domain or application code.

Define narrow application-owned ports for the external behavior those use cases require. Implement the ports in the existing data or integration layer and wire them at the composition root.

Do not reorganize every file at once. Move one feature or bounded context at a time, keep the application deployable, and remove obsolete pass-through layers as boundaries become clear.

##### Key Points to Mention

- Start from valuable use cases.
- Protect behavior with tests.
- Extract business rules before moving files mechanically.
- Introduce consumer-owned ports.
- Migrate feature by feature.
- Keep deployment working throughout.

<!-- question:end:layered-architecture-vs-clean-architecture-vs-ports-and-adapters-advanced-q05 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
