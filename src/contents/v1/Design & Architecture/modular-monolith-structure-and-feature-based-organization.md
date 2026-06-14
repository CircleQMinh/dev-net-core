---
id: modular-monolith-structure-and-feature-based-organization
topic: Clean Architecture and modular boundaries
subtopic: Modular monolith structure and feature-based organization
category: Design & Architecture
---

## Overview

A modular monolith is an application that is built and deployed as one unit but divided internally into modules with explicit responsibilities and controlled dependencies. It keeps the operational simplicity of a monolith while applying many of the boundary and ownership practices associated with well-designed distributed systems.

The word **monolith** describes the deployment model, not necessarily the quality of the internal design. A monolith can be a tightly coupled collection of technical layers, or it can contain cohesive business modules that communicate through stable contracts.

Feature-based organization groups code by business capability or use case rather than placing all controllers, services, repositories, and models in application-wide technical folders. For example, code for placing, paying for, and viewing orders can live in an `Orders` module instead of being scattered across global `Controllers`, `Services`, and `Repositories` directories.

Modular monoliths are useful when:

- A product needs clear boundaries but does not need independent service deployment.
- One team or a small number of teams can coordinate a shared release.
- Strong consistency and simple transactions are valuable.
- Operational simplicity matters more than independent scaling.
- The domain is still evolving and service boundaries are not yet proven.
- The organization wants a practical path from a simple application toward stronger modularity.

This topic matters in interviews because candidates are often asked to choose between a traditional monolith, modular monolith, and microservices. A strong answer does not assume that microservices are automatically more scalable or maintainable. It explains how business boundaries, coupling, deployment needs, team ownership, data consistency, and operational cost influence the decision.

## Core Concepts

### Deployment Boundary Versus Module Boundary

A deployment boundary determines what is built, versioned, released, and run together. A module boundary determines which code owns a business capability and how other code is allowed to interact with it.

In a modular monolith:

- The whole application is usually one deployable process.
- Modules are logical or compile-time units inside that process.
- Calls between modules do not require a network.
- A single database can be used, although data ownership should still be explicit.
- Modules should expose contracts and hide implementation details.

This distinction prevents a common mistake: treating every folder or project as if it were an independently deployable service. Internal boundaries can be strong without introducing HTTP, queues, distributed tracing, retries, and eventual consistency.

### Business Capabilities as Module Boundaries

Modules should normally represent cohesive business capabilities rather than technical concerns.

Good candidates include:

- Catalog.
- Ordering.
- Billing.
- Inventory.
- Shipping.
- Identity.
- Reporting.

Weak candidates include:

- Controllers.
- Services.
- Repositories.
- Helpers.
- Database.

Technical layers describe how code is implemented. Business modules describe why the code exists and which concepts change together.

A useful module boundary usually has:

- A recognizable business purpose.
- Its own terminology and rules.
- High cohesion among its use cases and domain concepts.
- Limited reasons to change because of another module.
- An explicit contract for external callers.
- Ownership of the data required to enforce its rules.

Domain-Driven Design bounded contexts can guide module boundaries, but a modular monolith does not require a full DDD implementation. The practical goal is to group behavior that belongs together and prevent unrelated capabilities from reaching into each other's internals.

### High Cohesion and Low Coupling

**Cohesion** measures how strongly the responsibilities inside a module belong together. **Coupling** measures how much one module depends on the details of another.

A healthy module has:

- High cohesion: related rules, use cases, data, and tests live together.
- Low coupling: callers know only the module's public contract.
- Stable dependencies: dependencies point toward capabilities that change less often.
- No dependency cycles.

Low coupling does not mean no communication. Modules in a useful system must collaborate. The objective is to make collaboration intentional, visible, and resistant to internal changes.

### Feature-Based Organization

A traditional layer-based structure often looks like this:

```text
Application/
  Controllers/
  Services/
  Repositories/
  Models/
  Validators/
```

Implementing one order feature may require editing files in every folder. Ownership is unclear, and shared folders often accumulate unrelated code.

A feature-based structure groups the same code by capability:

```text
Application/
  Features/
    Orders/
      PlaceOrder/
        Endpoint.cs
        Command.cs
        Handler.cs
        Validator.cs
        Response.cs
      GetOrder/
        Endpoint.cs
        Query.cs
        Handler.cs
        Response.cs
    Catalog/
      SearchProducts/
      UpdateProduct/
```

This is sometimes called a **vertical slice** because a feature contains the application code required to handle an end-to-end request. A vertical slice can still use internal layers where they provide value.

Feature-based organization improves:

- Discoverability: developers can find most code for a use case in one place.
- Change locality: a feature change touches fewer unrelated directories.
- Ownership: teams can own recognizable capabilities.
- Deletion: obsolete features can be removed more safely.
- Testing: tests can be organized around behavior rather than technical classes.

Feature folders alone do not create modularity. A codebase can use feature names while every feature still accesses every database table and implementation class. Real modularity requires dependency and data-access rules.

### Module Structure in a .NET Solution

Modules can be represented as folders in one project, multiple projects in one solution, or a combination of both.

A project-per-layer-per-module structure might look like this:

```text
src/
  Shop.Api/
    Program.cs
  BuildingBlocks/
    BuildingBlocks.csproj
  Modules/
    Orders/
      Orders.Contracts/
      Orders.Domain/
      Orders.Application/
      Orders.Infrastructure/
    Catalog/
      Catalog.Contracts/
      Catalog.Domain/
      Catalog.Application/
      Catalog.Infrastructure/
```

This provides strong compile-time boundaries but can create many projects. A smaller application can keep each module in one project:

```text
src/
  Shop/
    Modules/
      Orders/
        Contracts/
        Domain/
        Application/
        Infrastructure/
        Presentation/
      Catalog/
        Contracts/
        Domain/
        Application/
        Infrastructure/
        Presentation/
```

The appropriate granularity depends on risk:

- Use folders when the codebase and team are small and conventions are sufficient.
- Use separate projects when compile-time enforcement materially reduces boundary violations.
- Split a module internally only when its complexity justifies the extra structure.

The objective is not to maximize the number of projects. It is to make ownership and allowed dependencies clear.

### Public Contracts and Internal Implementations

Each module should have a small public surface. Other modules should depend on that surface rather than on its handlers, entities, repositories, or database context.

A contract can be:

- A public application interface.
- A command or query accepted by the module.
- A result DTO.
- An integration event.
- A facade exposed by the module.

For example:

```csharp
public interface IOrderModule
{
    Task<OrderSummary?> GetOrderAsync(
        Guid orderId,
        CancellationToken cancellationToken);
}

public sealed record OrderSummary(
    Guid Id,
    string Status,
    decimal Total);
```

The contract should expose what callers need, not the module's persistence model:

```csharp
// Avoid exposing an EF Core entity or IQueryable across the boundary.
public interface IOrderModule
{
    IQueryable<OrderEntity> Orders { get; }
}
```

Returning `IQueryable`, a module-owned entity, or a database context lets callers compose logic against implementation details. That weakens ownership and makes internal changes unsafe.

In .NET, implementation types can be marked `internal`. `InternalsVisibleTo` should be used carefully because broad access can undermine the boundary it is meant to support.

### Dependency Rules

Dependencies should be acyclic and intentionally directed.

Inside a module using Clean Architecture:

```text
Presentation -> Application -> Domain
Infrastructure -> Application -> Domain
```

Across modules:

```text
Ordering -> Catalog.Contracts
```

should not become:

```text
Ordering.Application -> Catalog.Infrastructure
```

The consuming module may depend on the provider's contracts, but not on its internal implementation.

Useful enforcement techniques include:

- Separate projects with restricted project references.
- `internal` implementation types.
- Architecture tests that reject forbidden dependencies.
- Namespace conventions.
- Code ownership and pull-request checks.
- A small shared-kernel package for genuinely universal concepts.

Architecture tests can express rules such as:

```csharp
[Fact]
public void Orders_Should_Not_Depend_On_Catalog_Infrastructure()
{
    Types.InAssembly(typeof(OrdersAssemblyMarker).Assembly)
        .ShouldNot()
        .HaveDependencyOn("Shop.Modules.Catalog.Infrastructure")
        .GetResult()
        .ShouldBeSuccessful();
}
```

The exact testing library is less important than making the rule executable.

### Data Ownership

Using one physical database does not require every module to own every table.

Each module should own:

- The tables or schema that store its state.
- The invariants enforced by that state.
- The migrations for its data.
- The repository or persistence APIs used to access it.

Other modules should not update those tables directly. They should ask the owning module to perform the operation.

A shared database can be partitioned with:

- A schema per module.
- Table naming conventions.
- Separate EF Core `DbContext` types.
- Database permissions where stronger enforcement is required.

For example:

```csharp
public sealed class OrdersDbContext : DbContext
{
    internal DbSet<Order> Orders => Set<Order>();
}

public sealed class InventoryDbContext : DbContext
{
    internal DbSet<StockItem> StockItems => Set<StockItem>();
}
```

Separate `DbContext` types make ownership visible, even when both use the same SQL Server database.

Common violations include:

- Joining arbitrary tables across module boundaries in application code.
- Sharing one large entity model across all modules.
- Updating another module's rows directly.
- Treating a shared database as a shared domain model.

Read models and reporting are legitimate special cases. They can use replicated projections, database views, or a dedicated reporting module, but those choices should not grant write ownership.

### Synchronous Module Communication

Synchronous communication is appropriate when the caller needs an immediate answer before it can continue.

Examples:

- Ordering asks Catalog for current product information.
- Shipping asks Ordering for a delivery address.
- Billing validates that an order is payable.

An in-process call through a module contract is usually sufficient:

```csharp
public sealed class PlaceOrderHandler
{
    private readonly ICatalogQueries _catalog;
    private readonly IOrderRepository _orders;

    public PlaceOrderHandler(
        ICatalogQueries catalog,
        IOrderRepository orders)
    {
        _catalog = catalog;
        _orders = orders;
    }

    public async Task<Guid> Handle(
        PlaceOrder command,
        CancellationToken cancellationToken)
    {
        var product = await _catalog.GetProductAsync(
            command.ProductId,
            cancellationToken);

        if (product is null)
        {
            throw new ProductNotFoundException(command.ProductId);
        }

        var order = Order.Place(product.Id, product.Price, command.Quantity);
        await _orders.AddAsync(order, cancellationToken);
        return order.Id;
    }
}
```

Calling an internal HTTP endpoint merely to imitate microservices adds serialization, latency, failure handling, and observability requirements without creating independent deployment.

### Asynchronous Communication and Events

Events are appropriate when one module announces a completed fact and does not need an immediate response.

Examples:

- `OrderPlaced`.
- `PaymentCaptured`.
- `ShipmentDispatched`.

The publishing module should not know which modules react:

```csharp
public sealed record OrderPlaced(
    Guid OrderId,
    Guid CustomerId,
    decimal Total);
```

In-process events can reduce direct coupling, but they introduce indirect control flow. Use them where one-to-many notification or independent reactions are valuable, not as the default for every method call.

Questions to decide between a direct call and an event include:

- Does the caller need the result now?
- Must the downstream action succeed in the same transaction?
- Is there one known collaborator or several independent subscribers?
- Is temporary delay acceptable?
- Can handlers be idempotent?

An outbox is useful when events must be reliably published to an external broker or survive process failure. It is usually unnecessary for simple in-process notifications that can be repeated safely.

### Transactions and Consistency

A major advantage of a modular monolith is that related work can often use a local database transaction. However, module ownership still matters.

Possible approaches include:

- Keep a use case inside one module and one transaction whenever possible.
- Coordinate a transaction across module contexts only when strong consistency is a genuine requirement.
- Use events and eventual consistency when modules can complete independently.
- Compensate explicitly when a later action can fail after an earlier commit.

Sharing one transaction across every module may create hidden coupling. For example, requiring Inventory, Billing, Ordering, and Notifications to commit atomically makes each module's availability and persistence behavior part of one operation.

Consistency should be selected from business requirements, not from the convenience of a shared process.

### Composition Root and Module Registration

The application entry point should compose modules without containing their business rules.

Each module can expose a registration method:

```csharp
public static class OrdersModule
{
    public static IServiceCollection AddOrdersModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<OrdersDbContext>(options =>
            options.UseSqlServer(
                configuration.GetConnectionString("Orders")));

        services.AddScoped<IOrderModule, OrderModuleFacade>();
        services.AddScoped<IOrderRepository, EfOrderRepository>();
        return services;
    }
}
```

The host composes the application:

```csharp
builder.Services
    .AddCatalogModule(builder.Configuration)
    .AddOrdersModule(builder.Configuration)
    .AddBillingModule(builder.Configuration);
```

This keeps framework configuration centralized while allowing each module to own its registrations.

### Testing Strategy

Tests should verify both module behavior and module boundaries.

Useful levels include:

- Domain tests for invariants and calculations.
- Use-case tests for commands and queries.
- Module integration tests using the module's public contract.
- Persistence tests for mappings and transactions.
- Architecture tests for dependency rules.
- End-to-end tests for important workflows across modules.

Prefer tests against public behavior over tests that couple directly to private classes. If an internal refactoring breaks many tests despite unchanged behavior, the tests may be crossing the same boundaries as production code.

### Modular Monolith Versus Other Structures

| Structure | Deployment | Internal organization | Main strength | Main risk |
| --- | --- | --- | --- | --- |
| Layered monolith | One unit | Global technical layers | Familiar and simple | Business capabilities become entangled |
| Modular monolith | One unit | Explicit business modules | Clear boundaries with simple operations | Boundaries can erode without enforcement |
| Microservices | Multiple independent services | Business services with network contracts | Independent deployment and scaling | Distributed-system and operational complexity |

A modular monolith is not merely a temporary architecture. It can be the appropriate long-term design when independent deployment and scaling are not required.

### Extracting a Module into a Service

A well-isolated module is easier to extract, but extraction should be driven by concrete needs.

Strong signals include:

- The module needs independent release cadence.
- A separate team needs autonomous ownership.
- The module has distinct scaling or availability requirements.
- It requires a different technology or security boundary.
- Failures must be isolated from the rest of the application.
- Its data and contracts are already well owned.

Before extraction, identify:

- The public operations that become network APIs or messages.
- Data that must move to a separately owned store.
- Cross-module transactions that must become eventual workflows.
- New timeout, retry, idempotency, and observability requirements.
- Deployment, versioning, and support ownership.

Extracting a poorly bounded module usually creates a distributed monolith: separately deployed components that still require coordinated changes and releases.

### Common Mistakes

Common modular-monolith mistakes include:

- Calling a folder a module while allowing unrestricted cross-folder access.
- Organizing only by technical layer.
- Sharing entities and `DbContext` types across all modules.
- Allowing modules to update each other's tables.
- Creating a large `Shared`, `Common`, or `Utils` project for business code.
- Introducing an event for every collaboration, making behavior hard to trace.
- Creating internal HTTP APIs without an independent deployment requirement.
- Splitting into too many projects before boundaries are understood.
- Depending on another module's infrastructure or persistence types.
- Creating circular dependencies.
- Assuming a future microservice extraction is guaranteed.

### Best Practices

- Start module boundaries from business capabilities and change patterns.
- Keep each module's public contract small and stable.
- Make implementation types internal where practical.
- Enforce dependency rules with project references and architecture tests.
- Give each module explicit ownership of its writes and invariants.
- Prefer simple in-process calls for request-response collaboration.
- Use events for facts and independent reactions, not as decoration.
- Keep shared code small, stable, and domain-neutral unless it is an intentional shared kernel.
- Organize use cases as feature slices inside a module when that improves locality.
- Measure actual deployment, scaling, and team needs before extracting services.
- Review boundaries as the domain becomes better understood.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is a modular monolith?

<!-- question:start:modular-monolith-structure-and-feature-based-organization-beginner-q01 -->
<!-- question-id:modular-monolith-structure-and-feature-based-organization-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A modular monolith is a single deployable application whose code is divided into cohesive business modules with explicit contracts and controlled dependencies. Modules execute in the same process, so they can communicate without a network, but one module should not freely access another module's implementation or data. It combines straightforward deployment and local transactions with stronger internal boundaries than a traditional tightly coupled monolith.

##### Key Points to Mention

- One deployment unit does not imply one undifferentiated codebase.
- Modules usually align with business capabilities.
- Contracts, data ownership, and dependency rules make the boundaries real.
- It avoids distributed-system costs when independent services are unnecessary.

<!-- question:end:modular-monolith-structure-and-feature-based-organization-beginner-q01 -->

#### How does feature-based organization differ from organizing code by technical layer?

<!-- question:start:modular-monolith-structure-and-feature-based-organization-beginner-q02 -->
<!-- question-id:modular-monolith-structure-and-feature-based-organization-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Technical-layer organization places all controllers, services, repositories, and models into global folders. Feature-based organization places the code required for a business capability or use case together, such as `Orders/PlaceOrder`. This improves discoverability and change locality because developers navigate by what the system does. Features may still contain internal layers, but those layers are subordinate to the business boundary.

##### Key Points to Mention

- Feature folders describe business intent.
- Related handlers, validation, endpoints, and tests stay close together.
- A folder structure alone does not enforce module boundaries.
- Vertical slices and internal layering can be combined.

<!-- question:end:modular-monolith-structure-and-feature-based-organization-beginner-q02 -->

#### What are the main benefits of a modular monolith over microservices?

<!-- question:start:modular-monolith-structure-and-feature-based-organization-beginner-q03 -->
<!-- question-id:modular-monolith-structure-and-feature-based-organization-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A modular monolith usually has simpler deployment, debugging, testing, observability, and local development. In-process calls avoid network latency and partial network failures, and a shared database can support local transactions where the business requires them. It can still provide clear ownership and maintainable boundaries. Microservices become preferable only when benefits such as independent deployment, scaling, failure isolation, or team autonomy justify their operational and consistency costs.

##### Key Points to Mention

- Fewer deployable units and less infrastructure.
- Easier local transactions and end-to-end debugging.
- No automatic need for retries, service discovery, or message delivery guarantees.
- The decision depends on requirements, not fashion.

<!-- question:end:modular-monolith-structure-and-feature-based-organization-beginner-q03 -->

#### What makes a good module boundary?

<!-- question:start:modular-monolith-structure-and-feature-based-organization-beginner-q04 -->
<!-- question-id:modular-monolith-structure-and-feature-based-organization-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A good module boundary encloses a cohesive business capability with its own terminology, rules, use cases, and data ownership. Other modules interact through a small public contract and do not depend on internal entities or persistence types. The boundary should reduce reasons for coordinated change and should not create circular dependencies.

##### Key Points to Mention

- High cohesion inside the module.
- Low coupling through explicit contracts.
- Ownership of invariants and writes.
- Business capability or bounded context rather than technical layer.

<!-- question:end:modular-monolith-structure-and-feature-based-organization-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How should modules communicate inside a modular monolith?

<!-- question:start:modular-monolith-structure-and-feature-based-organization-intermediate-q01 -->
<!-- question-id:modular-monolith-structure-and-feature-based-organization-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use a direct in-process call through a module-owned contract when the caller needs an immediate result. Use an event when a module is announcing a completed fact and independent subscribers can react without an immediate response. The communication style should reflect business timing and consistency needs. Internal HTTP is usually unnecessary because it adds network behavior without providing independent deployment.

##### Key Points to Mention

- Depend on contracts, not implementation classes.
- Direct calls suit request-response collaboration.
- Events suit one-to-many notification and eventual reactions.
- Avoid using events or HTTP merely to imitate microservices.

<!-- question:end:modular-monolith-structure-and-feature-based-organization-intermediate-q01 -->

#### How can modules share one database without becoming tightly coupled?

<!-- question:start:modular-monolith-structure-and-feature-based-organization-intermediate-q02 -->
<!-- question-id:modular-monolith-structure-and-feature-based-organization-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Assign each module ownership of specific tables or schemas, its migrations, and the code that writes its data. Separate `DbContext` types or database schemas can make ownership visible. A module needing another module's behavior should call its contract rather than update its tables. Reporting can use dedicated read models or views, but shared reads should not imply shared write ownership.

##### Key Points to Mention

- One physical database can contain multiple logical ownership boundaries.
- Do not share a universal persistence model.
- Cross-module writes bypass invariants and must be prohibited.
- Read models are different from transactional ownership.

<!-- question:end:modular-monolith-structure-and-feature-based-organization-intermediate-q02 -->

#### How would you enforce module boundaries in a .NET solution?

<!-- question:start:modular-monolith-structure-and-feature-based-organization-intermediate-q03 -->
<!-- question-id:modular-monolith-structure-and-feature-based-organization-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use separate projects when compile-time enforcement is valuable, expose only a contracts assembly or public facade, mark implementation types internal, and restrict project references. Add architecture tests that reject dependencies on another module's infrastructure or domain internals. Namespace conventions and code review help, but executable checks are more reliable as the codebase grows.

##### Key Points to Mention

- Project references provide compile-time control.
- `internal` reduces accidental access.
- Architecture tests detect forbidden dependencies and cycles.
- Enforcement strength should match the application's size and risk.

<!-- question:end:modular-monolith-structure-and-feature-based-organization-intermediate-q03 -->

#### What belongs in a shared building-blocks project?

<!-- question:start:modular-monolith-structure-and-feature-based-organization-intermediate-q04 -->
<!-- question-id:modular-monolith-structure-and-feature-based-organization-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Only small, stable, broadly applicable mechanisms should be shared, such as a minimal result type, transaction abstraction, or event-dispatching contract. Business concepts should remain in the module that owns them unless the team deliberately defines a small shared kernel. A large `Common` project creates hidden coupling because changes to supposedly reusable code affect every module.

##### Key Points to Mention

- Prefer duplication over premature shared abstractions when concepts may diverge.
- Shared code should be stable and have clear ownership.
- Avoid placing module-specific entities, DTOs, or workflows in `Common`.
- A shared kernel is an explicit domain decision, not a dumping ground.

<!-- question:end:modular-monolith-structure-and-feature-based-organization-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### When should a module be extracted into a microservice?

<!-- question:start:modular-monolith-structure-and-feature-based-organization-advanced-q01 -->
<!-- question-id:modular-monolith-structure-and-feature-based-organization-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Extract a module when there is a demonstrated need for independent deployment, team autonomy, scaling, availability, security isolation, or a different technology lifecycle. The module should already have a cohesive contract and data ownership. The extraction changes in-process calls into network communication and may replace local transactions with eventual consistency, so the benefit must outweigh added failure handling, observability, deployment, and support costs.

##### Key Points to Mention

- Use measured requirements rather than a speculative future.
- Stable boundaries and owned data make extraction safer.
- Account for timeouts, retries, idempotency, versioning, and tracing.
- Cross-module transactions require redesign.

<!-- question:end:modular-monolith-structure-and-feature-based-organization-advanced-q01 -->

#### How do you prevent a modular monolith from degrading into a distributed monolith after service extraction?

<!-- question:start:modular-monolith-structure-and-feature-based-organization-advanced-q02 -->
<!-- question-id:modular-monolith-structure-and-feature-based-organization-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

The extracted service must own its data and be independently releasable. Contracts should be coarse enough to avoid chatty synchronous calls, and consumers should tolerate version differences and temporary failure. Workflows that previously used a shared transaction need idempotent messages, state transitions, or compensation. If services still share tables, require lockstep deployment, or call each other for every operation, the system remains a distributed monolith.

##### Key Points to Mention

- Independent data and release ownership are essential.
- Minimize synchronous call chains.
- Design for partial failure and eventual consistency.
- Avoid coordinated releases as a permanent requirement.

<!-- question:end:modular-monolith-structure-and-feature-based-organization-advanced-q02 -->

#### How would you handle a workflow that spans several modules and requires consistency?

<!-- question:start:modular-monolith-structure-and-feature-based-organization-advanced-q03 -->
<!-- question-id:modular-monolith-structure-and-feature-based-organization-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

First determine the actual business invariant and whether all steps must be atomic. If the invariant belongs to one module, move the decision and required state into that module. If several modules must participate synchronously and share compatible storage, a carefully scoped local transaction may be acceptable. If delayed completion is valid, model the workflow as explicit states with events, idempotent handlers, retries, and compensation for failures.

##### Key Points to Mention

- Consistency is a business requirement, not an architectural slogan.
- Prefer keeping an invariant within one ownership boundary.
- Avoid a transaction spanning unrelated modules by default.
- Make eventual workflows observable and recoverable.

<!-- question:end:modular-monolith-structure-and-feature-based-organization-advanced-q03 -->

#### How would you migrate a tightly coupled layered monolith toward a modular monolith?

<!-- question:start:modular-monolith-structure-and-feature-based-organization-advanced-q04 -->
<!-- question-id:modular-monolith-structure-and-feature-based-organization-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Identify business capabilities and change clusters, then choose one valuable but manageable capability as the first module. Introduce a facade or contract around it, move its use cases and rules behind that contract, and make its data ownership explicit. Redirect callers incrementally, add architecture tests, and remove direct access to its internals. Repeat capability by capability rather than performing a large rewrite.

##### Key Points to Mention

- Use an incremental strangler-style refactoring inside the process.
- Start from behavior and ownership, not folder moves alone.
- Add tests before changing dependency direction.
- Measure progress through reduced forbidden dependencies and change coupling.

<!-- question:end:modular-monolith-structure-and-feature-based-organization-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
