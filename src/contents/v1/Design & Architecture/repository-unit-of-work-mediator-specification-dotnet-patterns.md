---
id: repository-unit-of-work-mediator-specification-dotnet-patterns
topic: Software design principles and common .NET patterns

subtopic: Repository, Unit of Work, Mediator, and Specification Patterns in .NET
category: Design & Architecture
---



## Overview

Repository, Unit of Work, Mediator, and Specification are common design patterns used in .NET applications to organize business logic, persistence logic, request handling, and reusable query rules. They are especially common in ASP.NET Core APIs, Clean Architecture, Domain-Driven Design, CQRS-style applications, and enterprise systems that use Entity Framework Core.

These patterns are useful because they help answer practical design questions:

- Where should database access code live?
- Should application services use `DbContext` directly?
- How do multiple database changes commit as one operation?
- How can controllers stay thin?
- How can validation, logging, authorization, transactions, and performance monitoring be applied consistently?
- How can query criteria be reused without duplicating LINQ expressions?
- When does an abstraction improve maintainability, and when does it only add noise?

For interviews, this topic matters because candidates are often asked to explain not only what these patterns are, but also when they are useful and when they are unnecessary. A strong answer should show judgment. These patterns can make a large system easier to maintain, but they can also create over-engineered code if applied mechanically.

In modern .NET, this topic is especially nuanced because EF Core's `DbContext` already behaves like a Unit of Work and its `DbSet<TEntity>` behaves somewhat like a Repository. That means adding a custom Repository or Unit of Work layer is not always required. The right choice depends on the complexity of the domain, the need for persistence isolation, testing strategy, query complexity, team conventions, and architectural boundaries.

Common real-world use cases include:

- A Clean Architecture API where the Application layer defines repository interfaces and Infrastructure implements them with EF Core.
- A CQRS-style API where controllers send commands and queries through a mediator.
- A domain model where aggregate roots are loaded and saved through repositories.
- A reporting screen where reusable specifications describe filters, sorting, includes, and pagination.
- A large codebase where cross-cutting behavior is centralized through mediator pipeline behaviors.

The key interview skill is being able to explain the trade-offs clearly: these patterns are tools, not mandatory layers.

## Core Concepts

### Pattern summary

| Pattern | Main purpose | Common .NET implementation | Useful when | Risk when overused |
|---|---|---|---|---|
| Repository | Encapsulate persistence operations behind a collection-like abstraction | Interfaces such as `IOrderRepository`, implemented using EF Core | Domain logic should not know persistence details | Generic CRUD repositories can duplicate EF Core and hide useful features |
| Unit of Work | Coordinate multiple changes as one transaction | EF Core `DbContext`, explicit transaction wrapper, or `IUnitOfWork` abstraction | Multiple changes must commit or fail together | Extra wrapper can duplicate `DbContext.SaveChangesAsync` |
| Mediator | Decouple request senders from request handlers | MediatR-style command/query handlers and pipeline behaviors | Controllers should stay thin and use cases should be isolated | Too many tiny handlers can make navigation harder |
| Specification | Encapsulate reusable criteria or query rules | Specification classes with expressions, includes, sorting, pagination | Query rules are reused or complex | Can become a query framework that is harder than direct LINQ |

### Repository pattern

The Repository pattern provides an abstraction over data access. It represents a collection-like interface for loading, adding, updating, and removing domain objects without exposing database-specific implementation details to the domain or application layer.

A repository is not just a wrapper around every EF Core method. A useful repository expresses meaningful persistence operations for a use case or aggregate.

Example:

```csharp
public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(Guid orderId, CancellationToken cancellationToken);
    Task AddAsync(Order order, CancellationToken cancellationToken);
}
```

EF Core implementation:

```csharp
public class EfCoreOrderRepository : IOrderRepository
{
    private readonly AppDbContext _dbContext;

    public EfCoreOrderRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<Order?> GetByIdAsync(Guid orderId, CancellationToken cancellationToken)
    {
        return _dbContext.Orders
            .Include(order => order.Items)
            .FirstOrDefaultAsync(order => order.Id == orderId, cancellationToken);
    }

    public async Task AddAsync(Order order, CancellationToken cancellationToken)
    {
        await _dbContext.Orders.AddAsync(order, cancellationToken);
    }
}
```

Usage from an application service or handler:

```csharp
public class PlaceOrderHandler
{
    private readonly IOrderRepository _orders;
    private readonly IUnitOfWork _unitOfWork;

    public PlaceOrderHandler(IOrderRepository orders, IUnitOfWork unitOfWork)
    {
        _orders = orders;
        _unitOfWork = unitOfWork;
    }

    public async Task<Guid> HandleAsync(
        PlaceOrderCommand command,
        CancellationToken cancellationToken)
    {
        var order = Order.Create(command.CustomerId, command.Items);

        await _orders.AddAsync(order, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return order.Id;
    }
}
```

#### Why Repository is useful

Repository is useful when it protects the application or domain layer from persistence details. It can hide EF Core query shape, includes, tracking rules, SQL-specific behavior, and persistence concerns.

It is especially useful when:

- The domain model should not depend on EF Core directly.
- The application follows Clean Architecture or DDD.
- Persistence logic is complex and should be centralized.
- Multiple persistence technologies may be used.
- Queries need consistent includes, filters, or tracking behavior.
- You want to test application logic without EF Core.
- You want repository methods to communicate intent, such as `GetPendingOrdersForCustomerAsync`.

#### When Repository is not useful

Repository can be unnecessary when it only duplicates `DbSet<TEntity>` methods:

```csharp
public interface IRepository<T>
{
    Task<T?> GetByIdAsync(Guid id);
    Task<List<T>> GetAllAsync();
    Task AddAsync(T entity);
    void Update(T entity);
    void Delete(T entity);
}
```

This kind of generic repository often adds little value because EF Core already provides:

- Query composition through LINQ.
- Change tracking.
- Entity sets through `DbSet<TEntity>`.
- Unit of Work behavior through `DbContext`.
- Transactions through `SaveChanges` and explicit transaction APIs.

A generic repository can also hide important EF Core capabilities such as `Include`, projection, split queries, compiled queries, tracking/no-tracking configuration, and provider-specific optimizations.

A practical rule is:

```text
Use repositories when they express business-oriented persistence operations.
Avoid repositories when they are only thin wrappers around EF Core CRUD.
```

### DbContext as Repository and Unit of Work

EF Core's `DbContext` already has characteristics of both Repository and Unit of Work:

- `DbSet<TEntity>` represents a collection of entities and supports querying and persistence operations.
- `DbContext` tracks changes to entities.
- `SaveChanges` or `SaveChangesAsync` commits all tracked changes as a unit.
- EF Core can wrap changes in a transaction depending on the provider and operation.

Example without a custom repository:

```csharp
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public ProductsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var product = await _dbContext.Products
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new ProductDto(x.Id, x.Name, x.Price))
            .FirstOrDefaultAsync(cancellationToken);

        return product is null ? NotFound() : Ok(product);
    }
}
```

This can be perfectly acceptable for simple CRUD applications. The issue is not direct `DbContext` usage itself. The issue is whether direct usage leaks persistence concerns into places where they make the application harder to maintain.

### Unit of Work pattern

The Unit of Work pattern coordinates changes to multiple objects and commits them as one operation. If one part fails, the whole operation should fail.

In EF Core, the simplest Unit of Work is often the `DbContext` itself:

```csharp
order.MarkAsPaid();
customer.AddLoyaltyPoints(order.Total);

await dbContext.SaveChangesAsync(cancellationToken);
```

All tracked changes are persisted together.

Some architectures add a small `IUnitOfWork` abstraction:

```csharp
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
```

Implementation:

```csharp
public class EfCoreUnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _dbContext;

    public EfCoreUnitOfWork(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken)
    {
        return _dbContext.SaveChangesAsync(cancellationToken);
    }
}
```

This can keep application services independent from EF Core while still allowing EF Core to perform the actual work.

#### Explicit transactions

Sometimes a use case needs an explicit transaction, especially when multiple saves, raw SQL, or multiple operations must be coordinated.

```csharp
public async Task CompleteCheckoutAsync(
    CheckoutCommand command,
    CancellationToken cancellationToken)
{
    await using var transaction =
        await _dbContext.Database.BeginTransactionAsync(cancellationToken);

    try
    {
        var order = await _dbContext.Orders
            .FirstAsync(x => x.Id == command.OrderId, cancellationToken);

        order.MarkAsPaid();

        await _dbContext.SaveChangesAsync(cancellationToken);

        var shipment = Shipment.Create(order.Id, command.Address);
        await _dbContext.Shipments.AddAsync(shipment, cancellationToken);

        await _dbContext.SaveChangesAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);
    }
    catch
    {
        await transaction.RollbackAsync(cancellationToken);
        throw;
    }
}
```

In many cases, a single `SaveChangesAsync` is cleaner. Explicit transactions should be used when the use case really needs transaction boundaries beyond the default behavior.

#### Unit of Work mistakes

Common mistakes include:

- Adding an `IUnitOfWork` that only duplicates `DbContext` without architectural benefit.
- Calling `SaveChangesAsync` inside every repository method, which prevents coordinating multiple changes.
- Creating multiple `DbContext` instances inside one business operation unintentionally.
- Hiding transaction behavior so callers cannot reason about consistency.
- Trying to use one Unit of Work across long-running workflows or user sessions.
- Mixing database transactions with external services such as email or payment APIs without understanding distributed consistency.

A good practice is to keep one short-lived unit of work per web request or per application use case.

### Repository and Unit of Work together

Repository and Unit of Work are often used together:

- Repository loads and stores aggregates.
- Unit of Work commits changes.

Example:

```csharp
public interface ICustomerRepository
{
    Task<Customer?> GetByIdAsync(Guid customerId, CancellationToken cancellationToken);
}

public class UpdateCustomerEmailHandler
{
    private readonly ICustomerRepository _customers;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateCustomerEmailHandler(
        ICustomerRepository customers,
        IUnitOfWork unitOfWork)
    {
        _customers = customers;
        _unitOfWork = unitOfWork;
    }

    public async Task HandleAsync(
        UpdateCustomerEmailCommand command,
        CancellationToken cancellationToken)
    {
        var customer = await _customers.GetByIdAsync(
            command.CustomerId,
            cancellationToken);

        if (customer is null)
            throw new InvalidOperationException("Customer not found.");

        customer.ChangeEmail(command.NewEmail);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
```

Notice that the repository does not save immediately. It retrieves an entity and lets the application operation decide when to commit.

### Aggregate-focused repositories

In DDD-style applications, repositories are usually designed around aggregate roots, not every database table.

Example:

```csharp
public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(Guid orderId, CancellationToken cancellationToken);
    Task AddAsync(Order order, CancellationToken cancellationToken);
}
```

The repository works with `Order`, not directly with `OrderItem` if `OrderItem` belongs inside the `Order` aggregate. This protects invariants and prevents unrelated parts of the app from modifying child entities incorrectly.

Good aggregate repository methods describe intent:

```csharp
Task<Order?> GetPendingOrderForCustomerAsync(
    Guid customerId,
    CancellationToken cancellationToken);

Task<IReadOnlyList<Order>> GetOrdersReadyForShipmentAsync(
    CancellationToken cancellationToken);
```

Poor repository methods expose generic persistence details:

```csharp
IQueryable<Order> Query();
void Attach(Order order);
void SetEntityState(Order order, EntityState state);
```

These may be useful in infrastructure code, but they often leak EF Core details into the application layer.

### Mediator pattern

The Mediator pattern reduces direct coupling between objects by having them communicate through a mediator. In .NET applications, this is commonly seen in command/query handlers.

Instead of a controller directly calling many services, the controller sends a request object:

```csharp
public record CreateProductCommand(
    string Name,
    decimal Price) : IRequest<Guid>;
```

Handler:

```csharp
public class CreateProductHandler
    : IRequestHandler<CreateProductCommand, Guid>
{
    private readonly AppDbContext _dbContext;

    public CreateProductHandler(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Guid> Handle(
        CreateProductCommand request,
        CancellationToken cancellationToken)
    {
        var product = new Product(request.Name, request.Price);

        await _dbContext.Products.AddAsync(product, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return product.Id;
    }
}
```

Controller:

```csharp
[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    private readonly ISender _sender;

    public ProductsController(ISender sender)
    {
        _sender = sender;
    }

    [HttpPost]
    public async Task<ActionResult<Guid>> Create(
        CreateProductCommand command,
        CancellationToken cancellationToken)
    {
        var productId = await _sender.Send(command, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = productId }, productId);
    }

    [HttpGet("{id:guid}")]
    public IActionResult GetById(Guid id)
    {
        return Ok();
    }
}
```

The controller only knows how to receive HTTP input and send a request. The handler contains the use-case logic.

### Mediator vs CQRS

Mediator and CQRS are related but not the same.

- **Mediator** is a communication pattern.
- **CQRS** separates commands that change state from queries that read state.
- A mediator library can help implement CQRS-style handlers.
- You can use mediator without full CQRS.
- You can use CQRS without a mediator library.

Example command:

```csharp
public record CancelOrderCommand(Guid OrderId) : IRequest;
```

Example query:

```csharp
public record GetOrderDetailsQuery(Guid OrderId) : IRequest<OrderDetailsDto?>;
```

A command should usually express an intent and may return minimal data. A query should return data and should not change state.

### Mediator pipeline behaviors

One major reason mediator patterns are popular in .NET is pipeline behavior. A pipeline behavior wraps handlers and applies cross-cutting concerns consistently.

Examples:

- Validation.
- Logging.
- Authorization.
- Performance measurement.
- Transaction handling.
- Exception handling.
- Idempotency.
- Retry policies for safe operations.

Example validation behavior:

```csharp
public class ValidationBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
    {
        _validators = validators;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var context = new ValidationContext<TRequest>(request);

        var errors = _validators
            .Select(validator => validator.Validate(context))
            .SelectMany(result => result.Errors)
            .Where(error => error is not null)
            .ToList();

        if (errors.Count > 0)
            throw new ValidationException(errors);

        return await next();
    }
}
```

This keeps validation out of every controller and handler.

#### When Mediator is useful

Mediator is useful when:

- Controllers are becoming too large.
- Use cases should be isolated into one handler each.
- Commands and queries need consistent cross-cutting behavior.
- The team wants a clear application layer boundary.
- CQRS-style organization improves readability.
- Application workflows are easier to test as request handlers.

#### When Mediator is not useful

Mediator can be unnecessary or harmful when:

- The application is small and simple.
- Every endpoint only forwards to a handler with one line of code.
- Developers struggle to navigate request-to-handler flow.
- The mediator becomes a hidden service locator.
- Business logic is scattered across too many tiny classes.
- Pipeline behaviors hide important control flow.

A practical rule is:

```text
Use mediator when it clarifies use cases and centralizes cross-cutting behavior.
Avoid mediator when it only adds ceremony.
```

### Specification pattern

The Specification pattern encapsulates a rule or criteria that can be reused, combined, and tested. In .NET persistence code, a specification often contains:

- Filter expression.
- Includes.
- Sorting.
- Pagination.
- Projection.
- Tracking behavior.
- Business rule intent.

Simple specification interface:

```csharp
public interface ISpecification<T>
{
    Expression<Func<T, bool>> Criteria { get; }
}
```

Example specification:

```csharp
public class ActiveCustomersByCountrySpecification
    : ISpecification<Customer>
{
    public ActiveCustomersByCountrySpecification(string countryCode)
    {
        Criteria = customer =>
            customer.IsActive &&
            customer.CountryCode == countryCode;
    }

    public Expression<Func<Customer, bool>> Criteria { get; }
}
```

Usage:

```csharp
public Task<List<Customer>> ListAsync(
    ISpecification<Customer> specification,
    CancellationToken cancellationToken)
{
    return _dbContext.Customers
        .Where(specification.Criteria)
        .ToListAsync(cancellationToken);
}
```

A richer specification can include query-shaping rules:

```csharp
public abstract class Specification<T>
{
    public Expression<Func<T, bool>>? Criteria { get; protected set; }
    public List<Expression<Func<T, object>>> Includes { get; } = new();
    public Expression<Func<T, object>>? OrderBy { get; protected set; }
    public int? Skip { get; protected set; }
    public int? Take { get; protected set; }
}
```

Example:

```csharp
public class RecentPaidOrdersSpecification : Specification<Order>
{
    public RecentPaidOrdersSpecification(Guid customerId, int take)
    {
        Criteria = order =>
            order.CustomerId == customerId &&
            order.Status == OrderStatus.Paid;

        Includes.Add(order => order.Items);
        OrderBy = order => order.CreatedAt;
        Take = take;
    }
}
```

### Specification as business rule vs query rule

There are two common meanings of "specification":

#### Business rule specification

A business rule specification answers whether an object satisfies a rule.

```csharp
public interface IBusinessSpecification<T>
{
    bool IsSatisfiedBy(T entity);
}

public class OrderCanBeCancelledSpecification
    : IBusinessSpecification<Order>
{
    public bool IsSatisfiedBy(Order order)
    {
        return order.Status is OrderStatus.Pending or OrderStatus.Paid
            && !order.HasShipped;
    }
}
```

This is useful for domain logic.

#### Query specification

A query specification describes how to retrieve data.

```csharp
public class PendingOrdersForCustomerSpecification
{
    public Expression<Func<Order, bool>> Criteria { get; }

    public PendingOrdersForCustomerSpecification(Guid customerId)
    {
        Criteria = order =>
            order.CustomerId == customerId &&
            order.Status == OrderStatus.Pending;
    }
}
```

This is useful for repositories and read models.

Both forms are valid, but they solve different problems. In interviews, make that distinction clear.

### Specification vs exposing IQueryable

Some repositories expose `IQueryable<T>`:

```csharp
IQueryable<Order> Query();
```

This gives callers maximum flexibility, but it also leaks persistence details and makes it harder to control query behavior.

Problems with exposing `IQueryable<T>` from application abstractions:

- Callers can build inefficient queries.
- EF Core-specific translation concerns leak upward.
- Query execution timing becomes less obvious.
- Includes, tracking, split queries, pagination, and projection may become inconsistent.
- It is harder to enforce aggregate boundaries.

Specification is one alternative. It allows reusable query intent without exposing the full query provider.

However, specifications can also become too complex. For reporting screens or highly dynamic search, direct query objects or dedicated read services may be clearer.

### Query services and read models

Not every read operation needs a repository. In CQRS-style systems, queries often use dedicated query handlers or read services that project directly to DTOs.

Example:

```csharp
public class GetOrderDetailsHandler
    : IRequestHandler<GetOrderDetailsQuery, OrderDetailsDto?>
{
    private readonly AppDbContext _dbContext;

    public GetOrderDetailsHandler(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<OrderDetailsDto?> Handle(
        GetOrderDetailsQuery request,
        CancellationToken cancellationToken)
    {
        return _dbContext.Orders
            .AsNoTracking()
            .Where(order => order.Id == request.OrderId)
            .Select(order => new OrderDetailsDto
            {
                Id = order.Id,
                CustomerName = order.Customer.Name,
                Total = order.Items.Sum(item => item.UnitPrice * item.Quantity)
            })
            .FirstOrDefaultAsync(cancellationToken);
    }
}
```

This can be better than forcing all reads through aggregate repositories, especially for screens that need projections, joins, pagination, and sorting.

A practical design often looks like:

- Use repositories for aggregate write operations.
- Use query handlers or read services for read models and projections.
- Use specifications when query criteria are reused or complex.

### How the patterns work together

A common Clean Architecture flow:

```text
HTTP request
  -> Controller
  -> Mediator sends command/query
  -> Handler executes use case
  -> Repository loads aggregate
  -> Domain model applies business rules
  -> Unit of Work commits changes
  -> Pipeline behaviors apply validation/logging/transactions
```

Example:

```csharp
public record CancelOrderCommand(Guid OrderId) : IRequest;

public class CancelOrderHandler : IRequestHandler<CancelOrderCommand>
{
    private readonly IOrderRepository _orders;
    private readonly IUnitOfWork _unitOfWork;

    public CancelOrderHandler(
        IOrderRepository orders,
        IUnitOfWork unitOfWork)
    {
        _orders = orders;
        _unitOfWork = unitOfWork;
    }

    public async Task Handle(
        CancelOrderCommand request,
        CancellationToken cancellationToken)
    {
        var order = await _orders.GetByIdAsync(request.OrderId, cancellationToken);

        if (order is null)
            throw new InvalidOperationException("Order not found.");

        order.Cancel();

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
```

This design keeps the controller thin, puts use-case logic in the handler, hides persistence details behind a repository, and commits through the Unit of Work.

### Transaction behavior with Mediator

Some applications use a transaction pipeline behavior for commands:

```csharp
public class TransactionBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
{
    private readonly AppDbContext _dbContext;

    public TransactionBehavior(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        await using var transaction =
            await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        var response = await next();

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return response;
    }
}
```

This centralizes transaction behavior, but it must be used carefully.

Potential issues:

- Queries should not open write transactions unnecessarily.
- Handlers should not also call `SaveChangesAsync` inconsistently.
- External side effects such as email or message publishing should not be treated as part of the database transaction unless using an outbox or similar pattern.
- Nested transactions and multiple `DbContext` instances can complicate behavior.
- Some operations may need different transaction isolation or no transaction.

A common production approach is to use a transaction behavior only for commands and keep side effects reliable through patterns like outbox messaging.

### When to use each pattern

#### Use Repository when

- You have domain-focused aggregate persistence.
- You want to hide EF Core from the application or domain layer.
- Persistence logic is complex or repeated.
- You need a stable application boundary.
- You want to enforce aggregate access rules.
- Repository methods express business intent.

#### Avoid Repository when

- The app is simple CRUD.
- The repository only mirrors EF Core.
- The abstraction leaks `IQueryable`, `DbSet`, or EF state management everywhere.
- It prevents efficient projection or query optimization.
- It creates a lot of boilerplate with no design benefit.

#### Use Unit of Work when

- Multiple changes must be committed as one operation.
- You want an abstraction over `SaveChangesAsync`.
- You need explicit transaction coordination.
- You want handlers/services to avoid depending on `DbContext`.

#### Avoid custom Unit of Work when

- `DbContext` is already visible and sufficient.
- The custom abstraction only forwards to `SaveChangesAsync`.
- It hides important transaction boundaries.
- It encourages long-lived contexts.

#### Use Mediator when

- Controllers are thin and handlers represent use cases.
- You want command/query organization.
- Cross-cutting behavior can be centralized in pipeline behaviors.
- Use cases need isolated tests.
- The application layer benefits from clear request/handler structure.

#### Avoid Mediator when

- It adds ceremony without reducing complexity.
- The app is small and direct service calls are clearer.
- Developers cannot easily trace flow.
- The mediator is used as a service locator.
- Every handler becomes a one-line pass-through.

#### Use Specification when

- Query rules are reused.
- Criteria are complex and need names.
- You want to compose filters consistently.
- You want to avoid leaking `IQueryable` upward.
- You need testable query intent.

#### Avoid Specification when

- The query is simple and used once.
- Specifications become a custom query language.
- They make EF Core optimization harder.
- They hide too much behavior.
- Direct LINQ or a dedicated query handler is clearer.

### Common mistakes

#### Overusing generic repositories

A generic repository can be useful in limited cases, but it is often overused.

Problem:

```csharp
public interface IRepository<T>
{
    IQueryable<T> Query();
    Task<T?> GetByIdAsync(Guid id);
    Task AddAsync(T entity);
    void Update(T entity);
    void Delete(T entity);
}
```

This may look reusable, but it can:

- Leak `IQueryable`.
- Ignore aggregate boundaries.
- Provide operations that should not exist for all entities.
- Duplicate EF Core.
- Encourage an anemic data-access style.

A better approach is often intent-based repositories or direct query handlers.

#### Saving inside repositories

This is usually a bad default:

```csharp
public async Task AddAsync(Order order)
{
    await _dbContext.Orders.AddAsync(order);
    await _dbContext.SaveChangesAsync();
}
```

The problem is that every repository method commits immediately. A use case that needs to update an order and a customer together can no longer coordinate the transaction cleanly.

Better:

```csharp
public async Task AddAsync(Order order, CancellationToken cancellationToken)
{
    await _dbContext.Orders.AddAsync(order, cancellationToken);
}
```

Then the handler or Unit of Work commits once.

#### Using Mediator as a service locator

A mediator should not become a way to hide dependencies or avoid clear design. If a handler sends many nested commands to perform one operation, the flow may become hard to reason about.

Example warning sign:

```csharp
await _sender.Send(new StepOneCommand(...));
await _sender.Send(new StepTwoCommand(...));
await _sender.Send(new StepThreeCommand(...));
```

Sometimes orchestration belongs in an application service or workflow object instead.

#### Mixing business and persistence specifications

A business specification that uses normal C# methods may not translate to SQL. A query specification using expression trees may be designed for EF Core translation. Mixing the two without care can cause runtime translation errors or force client-side evaluation.

Keep the purpose clear:

- Business rule specifications evaluate domain behavior.
- Query specifications describe provider-translatable data access rules.

#### Hiding performance problems

Abstractions should not prevent performance-aware design. Repositories and specifications should still allow:

- Projection to DTOs.
- `AsNoTracking` for read-only queries.
- Pagination.
- Index-friendly filters.
- Avoiding N+1 queries.
- Appropriate includes or split queries.
- Cancellation tokens.
- Async execution.

A pattern that hides these concerns can make the system slower and harder to diagnose.

### Best practices

Use these practical habits in .NET applications:

- Start simple and add patterns when they solve real design pressure.
- Prefer intent-based repository methods over generic CRUD methods.
- Treat EF Core `DbContext` as the default Unit of Work unless an abstraction adds value.
- Commit once per use case when possible.
- Keep transaction boundaries explicit and short.
- Use mediator handlers to represent application use cases, not tiny wrappers around services.
- Use pipeline behaviors for cross-cutting concerns that apply consistently.
- Keep query logic close to the read use case when projection and performance matter.
- Use specifications for reusable criteria, not for every simple query.
- Avoid exposing `IQueryable<T>` from high-level application abstractions unless the design intentionally allows query composition.
- Always pass `CancellationToken` through async data access and handlers.
- Do not use mocks as a substitute for integration tests.
- Validate the real EF Core mapping, transactions, DI registration, and query behavior with integration tests.
- Prefer clear code over pattern-heavy code.

### Practical decision guide

Use this decision guide during design discussions and interviews:

```text
Is this a simple CRUD application?
  -> Direct DbContext may be enough.

Do I need to protect domain/application logic from persistence details?
  -> Consider Repository.

Do multiple changes need to commit together?
  -> Use DbContext SaveChanges or a Unit of Work abstraction.

Are controllers becoming large and use cases hard to test?
  -> Consider Mediator with command/query handlers.

Do many handlers need validation, logging, authorization, or transaction behavior?
  -> Consider mediator pipeline behaviors.

Is a query rule reused or complex enough to deserve a name?
  -> Consider Specification.

Is the abstraction mostly forwarding to EF Core with no added meaning?
  -> Avoid the pattern or simplify it.
```

Good architecture is not about using every pattern. It is about choosing the smallest design that keeps the system understandable, testable, and safe to change.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the Repository pattern?

<!-- question:start:repository-unit-of-work-mediator-specification-beginner-q01 -->
<!-- question-id:repository-unit-of-work-mediator-specification-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

The Repository pattern is a design pattern that encapsulates data access behind an abstraction. It provides methods for retrieving and storing domain objects without exposing the details of the database or ORM to the rest of the application.

In .NET, a repository is often implemented as an interface such as `IOrderRepository` with an EF Core implementation such as `EfCoreOrderRepository`. It is useful when the application or domain layer should not depend directly on EF Core.

However, EF Core already provides many repository-like features through `DbSet<TEntity>`, so custom repositories should add real design value instead of simply wrapping basic CRUD operations.

##### Key Points to Mention

- Repository hides persistence details.
- It can protect domain/application layers from EF Core.
- It is useful for aggregate persistence and business-oriented data access.
- EF Core `DbSet` already behaves somewhat like a repository.
- Generic CRUD repositories can be unnecessary.
- Good repository methods express intent.

<!-- question:end:repository-unit-of-work-mediator-specification-beginner-q01 -->

#### What is the Unit of Work pattern?

<!-- question:start:repository-unit-of-work-mediator-specification-beginner-q02 -->
<!-- question-id:repository-unit-of-work-mediator-specification-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

The Unit of Work pattern coordinates multiple changes and commits them as one operation. If one change fails, the whole operation should fail.

In EF Core, `DbContext` already acts like a Unit of Work. It tracks entity changes and commits them together when `SaveChanges` or `SaveChangesAsync` is called.

Some applications add an `IUnitOfWork` abstraction to avoid depending directly on `DbContext`, but this is only useful when it supports the architecture. If it only forwards to `SaveChangesAsync`, it may not add much value.

##### Key Points to Mention

- Unit of Work coordinates changes.
- EF Core `DbContext` already provides Unit of Work behavior.
- `SaveChangesAsync` commits tracked changes.
- Useful for transaction boundaries.
- Avoid saving inside every repository method.
- Keep units of work short-lived.

<!-- question:end:repository-unit-of-work-mediator-specification-beginner-q02 -->

#### What is the Mediator pattern?

<!-- question:start:repository-unit-of-work-mediator-specification-beginner-q03 -->
<!-- question-id:repository-unit-of-work-mediator-specification-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

The Mediator pattern decouples senders from receivers by routing requests through a mediator. In .NET applications, it is often used with command and query handlers. A controller sends a command or query, and a handler processes it.

This keeps controllers thin and organizes application logic around use cases. Mediator libraries can also support pipeline behaviors for cross-cutting concerns such as validation, logging, authorization, and transactions.

Mediator is useful in larger applications, but it can add unnecessary ceremony in small applications.

##### Key Points to Mention

- Mediator decouples request sender from handler.
- Common in CQRS-style .NET applications.
- Controllers send commands/queries.
- Handlers contain use-case logic.
- Pipeline behaviors handle cross-cutting concerns.
- It can be overused in simple applications.

<!-- question:end:repository-unit-of-work-mediator-specification-beginner-q03 -->

#### What is the Specification pattern?

<!-- question:start:repository-unit-of-work-mediator-specification-beginner-q04 -->
<!-- question-id:repository-unit-of-work-mediator-specification-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

The Specification pattern encapsulates a reusable rule or query criteria in a named object. In .NET, specifications often store LINQ expressions, includes, sorting, and pagination rules.

For example, `ActiveCustomersByCountrySpecification` can contain the criteria for active customers in a specific country. A repository can apply that specification to an EF Core query.

Specifications are useful when criteria are complex, reused, or need to be tested. They are less useful for simple one-off queries.

##### Key Points to Mention

- Specification gives a name to reusable criteria.
- Can represent business rules or query rules.
- Query specifications often use expression trees.
- Useful for reusable filters and complex queries.
- Avoid turning it into an overly complex query framework.
- Direct LINQ may be better for simple queries.

<!-- question:end:repository-unit-of-work-mediator-specification-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Is Repository still needed when using EF Core?

<!-- question:start:repository-unit-of-work-mediator-specification-intermediate-q01 -->
<!-- question-id:repository-unit-of-work-mediator-specification-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Repository is not always needed with EF Core because `DbContext` and `DbSet<TEntity>` already provide repository-like and unit-of-work behavior. For simple CRUD applications, using `DbContext` directly can be simpler and clearer.

A custom repository is useful when it protects domain/application layers from persistence concerns, enforces aggregate boundaries, centralizes complex query logic, or provides a stable architecture boundary.

The key is whether the repository adds meaningful abstraction. If it only wraps `Add`, `Update`, `Delete`, and `GetById`, it may duplicate EF Core without improving design.

##### Key Points to Mention

- EF Core already has Repository and Unit of Work characteristics.
- Direct `DbContext` is acceptable for simple CRUD.
- Repository is useful for domain boundaries and complex persistence.
- Avoid generic CRUD wrappers with no added value.
- Do not hide important EF Core performance features.
- Choose based on complexity and architecture.

<!-- question:end:repository-unit-of-work-mediator-specification-intermediate-q01 -->

#### Why should repositories usually not call SaveChanges directly?

<!-- question:start:repository-unit-of-work-mediator-specification-intermediate-q02 -->
<!-- question-id:repository-unit-of-work-mediator-specification-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Repositories should usually not call `SaveChanges` directly because doing so commits each repository operation independently. This makes it difficult to coordinate multiple changes as a single business transaction.

For example, a use case may need to update an order, update a customer, and add an audit record. If each repository saves immediately, the operation may partially complete. A better design lets repositories add or modify entities, then the application service or Unit of Work commits once.

There can be exceptions, but the default should be one commit per use case.

##### Key Points to Mention

- Save once per use case when possible.
- Unit of Work should control commit timing.
- Immediate saves can cause partial updates.
- Repositories should usually track changes, not commit them.
- EF Core tracks changes until `SaveChangesAsync`.
- Explicit transactions may be needed for complex cases.

<!-- question:end:repository-unit-of-work-mediator-specification-intermediate-q02 -->

#### How do Mediator and CQRS differ?

<!-- question:start:repository-unit-of-work-mediator-specification-intermediate-q03 -->
<!-- question-id:repository-unit-of-work-mediator-specification-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Mediator is a communication pattern that decouples request senders from request handlers. CQRS is an architectural pattern that separates commands that change state from queries that read state.

A .NET application can use a mediator library to implement CQRS-style commands and queries, but they are not the same thing. You can use Mediator without full CQRS, and you can implement CQRS without a mediator library.

In practice, commands usually represent business actions and queries return data. A mediator helps route each request to its handler and can apply pipeline behaviors.

##### Key Points to Mention

- Mediator is about request dispatch.
- CQRS is about separating reads and writes.
- They are often used together but are not identical.
- Commands change state.
- Queries return data.
- Pipeline behaviors can support validation, logging, and transactions.

<!-- question:end:repository-unit-of-work-mediator-specification-intermediate-q03 -->

#### When would you use Specification instead of exposing IQueryable?

<!-- question:start:repository-unit-of-work-mediator-specification-intermediate-q04 -->
<!-- question-id:repository-unit-of-work-mediator-specification-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Specification is useful when you want reusable, named query criteria without exposing the full `IQueryable<T>` to higher layers. Exposing `IQueryable<T>` gives callers flexibility, but it leaks persistence details and allows callers to build inefficient or inconsistent queries.

A specification can contain criteria, includes, sorting, pagination, and tracking preferences. This keeps query intent explicit while allowing the repository to control execution.

However, for highly dynamic reporting or simple one-off queries, a dedicated query handler or direct LINQ may be clearer than a specification.

##### Key Points to Mention

- `IQueryable<T>` leaks query provider details.
- Specification gives reusable query intent a name.
- It can include filters, includes, sorting, and pagination.
- It helps centralize repeated criteria.
- It should not become an overly complex query language.
- Direct query handlers may be better for projections and reporting.

<!-- question:end:repository-unit-of-work-mediator-specification-intermediate-q04 -->

#### What are mediator pipeline behaviors useful for?

<!-- question:start:repository-unit-of-work-mediator-specification-intermediate-q05 -->
<!-- question-id:repository-unit-of-work-mediator-specification-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Mediator pipeline behaviors are useful for applying cross-cutting behavior around handlers. Examples include validation, logging, performance timing, authorization, exception handling, transaction management, and idempotency.

Instead of adding validation or logging code to every handler, a behavior wraps the handler and applies the concern consistently.

The risk is that too much behavior in the pipeline can hide control flow. Teams should keep pipeline behaviors predictable and document which behaviors apply to commands and queries.

##### Key Points to Mention

- Behaviors wrap handlers.
- Good for validation, logging, transactions, metrics, and authorization.
- Reduces duplicated code.
- Keeps handlers focused on use-case logic.
- Do not hide too much behavior.
- Commands and queries may need different behaviors.

<!-- question:end:repository-unit-of-work-mediator-specification-intermediate-q05 -->

#### How should read queries be handled in a CQRS-style .NET application?

<!-- question:start:repository-unit-of-work-mediator-specification-intermediate-q06 -->
<!-- question-id:repository-unit-of-work-mediator-specification-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

In a CQRS-style application, read queries are often handled by query handlers or read services that project directly to DTOs. They may use EF Core directly with `AsNoTracking`, `Where`, `Select`, pagination, and sorting.

For reads, forcing everything through aggregate repositories can be inefficient because screens often need projections and joins that do not match domain aggregate loading.

A practical approach is to use repositories for aggregate writes and query handlers/read services for optimized reads.

##### Key Points to Mention

- Reads often project directly to DTOs.
- Use `AsNoTracking` for read-only queries.
- Query handlers can use EF Core directly in the application/infrastructure boundary depending on architecture.
- Repositories are often better for aggregate writes.
- Avoid loading full aggregates for simple read models.
- Optimize queries for the screen or API contract.

<!-- question:end:repository-unit-of-work-mediator-specification-intermediate-q06 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you decide whether to use direct DbContext, Repository, or CQRS handlers?

<!-- question:start:repository-unit-of-work-mediator-specification-advanced-q01 -->
<!-- question-id:repository-unit-of-work-mediator-specification-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

For a simple CRUD application, direct `DbContext` usage can be the simplest and most maintainable choice. EF Core already provides querying, tracking, and unit-of-work behavior.

For a domain-focused application with business rules and aggregate boundaries, repositories can protect the domain and application layer from persistence details. Repository methods should express business intent rather than generic CRUD.

For larger applications with many use cases, CQRS-style handlers through a mediator can organize commands and queries cleanly. Commands can use repositories and Unit of Work, while queries can use optimized read models or direct projections.

The decision depends on complexity, team size, domain rules, test strategy, and change frequency.

##### Key Points to Mention

- Direct `DbContext` is fine for simple CRUD.
- Repository helps protect domain/application boundaries.
- Mediator/CQRS helps organize use cases.
- Commands and queries may use different data access approaches.
- Avoid adding patterns without a real problem.
- Optimize for clarity, maintainability, and change safety.

<!-- question:end:repository-unit-of-work-mediator-specification-advanced-q01 -->

#### What are the risks of a generic repository over EF Core?

<!-- question:start:repository-unit-of-work-mediator-specification-advanced-q02 -->
<!-- question-id:repository-unit-of-work-mediator-specification-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

A generic repository over EF Core can be risky because it often duplicates EF Core while hiding important capabilities. It may expose generic CRUD operations that do not make sense for every entity, ignore aggregate boundaries, and make query optimization harder.

If it exposes `IQueryable<T>`, it leaks EF Core details upward. If it does not expose query composition, it may become too limiting and require many custom escape hatches.

A better approach is usually intent-based repositories for write aggregates and dedicated query handlers for read models.

##### Key Points to Mention

- Generic CRUD does not fit every entity.
- Can duplicate `DbSet<TEntity>`.
- Can hide projection, tracking, includes, split queries, and pagination.
- Exposing `IQueryable<T>` leaks persistence concerns.
- Can violate aggregate boundaries.
- Intent-based methods are often better.

<!-- question:end:repository-unit-of-work-mediator-specification-advanced-q02 -->

#### How can a transaction pipeline behavior be dangerous?

<!-- question:start:repository-unit-of-work-mediator-specification-advanced-q03 -->
<!-- question-id:repository-unit-of-work-mediator-specification-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

A transaction pipeline behavior can be dangerous if it is applied too broadly or hides important transaction boundaries. For example, queries should not usually open write transactions. Some commands may need special isolation levels. Some handlers may call external services like email, payment providers, or message brokers, which are not part of the database transaction.

It can also create confusion if handlers sometimes call `SaveChangesAsync` themselves while the behavior also saves. Multiple `DbContext` instances or nested mediator sends can further complicate transaction scope.

A safer approach is to apply transaction behavior only to commands that need it, keep transactions short, commit once, and handle external side effects with reliable patterns such as outbox messaging when needed.

##### Key Points to Mention

- Do not apply write transactions to every request blindly.
- Queries usually do not need write transactions.
- External side effects are not rolled back with the database.
- Avoid inconsistent `SaveChangesAsync` locations.
- Be careful with nested handlers and multiple contexts.
- Outbox can help coordinate database changes and messages.

<!-- question:end:repository-unit-of-work-mediator-specification-advanced-q03 -->

#### How do Specification and Repository interact with EF Core performance?

<!-- question:start:repository-unit-of-work-mediator-specification-advanced-q04 -->
<!-- question-id:repository-unit-of-work-mediator-specification-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Specification and Repository should not hide EF Core performance concerns. A good design still allows efficient projection, `AsNoTracking`, pagination, index-friendly filters, includes, split queries, and cancellation tokens.

If specifications always load full entities or repositories return full aggregates for read screens, performance can suffer. Query handlers that project directly to DTOs may be better for read-heavy scenarios.

Specifications should be designed with translation in mind. Query criteria should usually be expression trees that EF Core can translate to SQL. Business-rule specifications that use regular C# logic may not translate.

##### Key Points to Mention

- Patterns must not hide performance-critical query choices.
- Use projection for read models.
- Use `AsNoTracking` for read-only queries.
- Avoid unnecessary includes and full aggregate loading.
- Expression-based specifications should be EF-translatable.
- Consider dedicated read services for complex screens.

<!-- question:end:repository-unit-of-work-mediator-specification-advanced-q04 -->

#### How would you structure these patterns in Clean Architecture?

<!-- question:start:repository-unit-of-work-mediator-specification-advanced-q05 -->
<!-- question-id:repository-unit-of-work-mediator-specification-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

In Clean Architecture, the Domain layer contains entities and business rules. The Application layer contains use cases, commands, queries, handlers, and interfaces such as repositories or gateways. The Infrastructure layer implements those interfaces using EF Core, HTTP clients, storage SDKs, or message brokers. The API layer handles HTTP concerns and sends commands or queries to the application layer.

Repository interfaces can live in the Application or Domain layer depending on the architecture. EF Core implementations live in Infrastructure. Mediator handlers usually live in Application. Specifications may live in Application or Domain depending on whether they represent query criteria or business rules.

The dependency direction should point inward. Business rules should not depend on EF Core or ASP.NET Core.

##### Key Points to Mention

- Domain contains business entities and rules.
- Application contains use cases and abstractions.
- Infrastructure implements persistence and external integrations.
- API handles HTTP and sends commands/queries.
- Dependency direction points inward.
- Avoid leaking EF Core into domain logic.

<!-- question:end:repository-unit-of-work-mediator-specification-advanced-q05 -->

#### When can these patterns become over-engineering?

<!-- question:start:repository-unit-of-work-mediator-specification-advanced-q06 -->
<!-- question-id:repository-unit-of-work-mediator-specification-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

These patterns become over-engineering when they add layers without reducing real complexity. Examples include a repository that only forwards to `DbSet`, a Unit of Work that only forwards to `SaveChangesAsync` while `DbContext` is already available, a mediator handler that only calls one service method, or a specification for a one-line query used once.

Over-engineering makes code harder to navigate, increases boilerplate, and can slow development. Good architecture starts simple and introduces patterns when they solve real problems such as repeated logic, complex domain rules, cross-cutting concerns, persistence isolation, or high change frequency.

##### Key Points to Mention

- Patterns should solve real problems.
- Avoid ceremony for simple CRUD.
- Generic repositories are often overused.
- Mediator can make simple flow harder to trace.
- Specification is unnecessary for simple one-off queries.
- Prefer the simplest design that protects maintainability.

<!-- question:end:repository-unit-of-work-mediator-specification-advanced-q06 -->

#### How would you test code that uses these patterns?

<!-- question:start:repository-unit-of-work-mediator-specification-advanced-q07 -->
<!-- question-id:repository-unit-of-work-mediator-specification-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Application handlers can be unit tested by replacing repositories, gateways, or other dependencies with fakes or mocks. This is useful for business rules and use-case flow.

However, data access behavior should also be tested with integration tests because mocks cannot verify EF Core mapping, query translation, transaction behavior, constraints, or real database behavior. Specifications should be tested either by checking their criteria or by running them against a realistic provider.

Mediator pipeline behaviors can be tested separately or through integration tests that verify validation, authorization, logging, and transaction behavior.

A balanced test strategy uses both unit tests and integration tests.

##### Key Points to Mention

- Unit test handlers for business logic.
- Use fakes/mocks for external dependencies.
- Integration test EF Core queries and mappings.
- Validate DI registration and mediator pipeline behavior.
- Test specifications against realistic query providers when translation matters.
- Do not rely only on mocks for persistence behavior.

<!-- question:end:repository-unit-of-work-mediator-specification-advanced-q07 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
