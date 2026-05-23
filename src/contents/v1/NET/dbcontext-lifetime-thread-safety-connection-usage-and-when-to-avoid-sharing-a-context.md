---
id: dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context
topic: Entity Framework
subtopic: DbContext Lifetime, Thread Safety, Connection Usage, and When to Avoid Sharing a Context
category: .NET
---


## Overview

`DbContext` is the main EF Core object used to query and save data. It represents a session with the database and coordinates important EF Core features such as change tracking, identity resolution, relationship fix-up, transactions, database connections, and `SaveChanges`.

A `DbContext` should normally be short-lived and used for one unit of work. A unit of work is a group of operations that belong together logically and are saved together. In a typical ASP.NET Core Web API, one HTTP request often maps well to one unit of work, which is why `AddDbContext<TContext>()` registers the context as a scoped dependency by default.

This topic matters because incorrect `DbContext` lifetime management can cause serious production problems:

- Thread-safety errors.
- Data corruption risks.
- Memory growth from long-lived change tracking.
- Stale entity values.
- Unexpected `SaveChanges` behavior.
- Disposed context exceptions.
- Connection pool pressure.
- Hidden cross-request state.
- Poor performance from tracking too many entities.
- Bugs from sharing a context across parallel operations.

A common misconception is that a `DbContext` is the same as a database connection. It is not. `DbContext` is an EF Core unit-of-work object. The underlying database connection is usually opened shortly before a database operation and closed shortly after the operation so the database driver can return the connection to its connection pool.

This topic is important for interviews because it tests practical EF Core experience. Interviewers often ask:

- What lifetime should `DbContext` have in ASP.NET Core?
- Why is `DbContext` registered as scoped by default?
- Is `DbContext` thread-safe?
- Can you use one `DbContext` across multiple threads?
- What happens if you do not await EF Core async methods?
- What is the difference between `DbContext` pooling and connection pooling?
- When should you use `IDbContextFactory<TContext>`?
- Why is a singleton `DbContext` a bad idea?
- How should background services create contexts?
- How should Blazor Server handle `DbContext` lifetime?
- When should you avoid sharing a context?
- How does context lifetime relate to change tracking and memory usage?

A strong answer should explain that `DbContext` should be scoped to a clear unit of work, should not be shared across concurrent operations, should be disposed after use, and should be created through DI or a factory depending on the application type.

## Core Concepts

### What `DbContext` Represents

`DbContext` represents an EF Core session with the database.

It is responsible for:

- Querying data.
- Tracking entity instances.
- Detecting changes.
- Saving changes.
- Managing relationship fix-up.
- Managing transactions.
- Creating and executing database commands.
- Coordinating EF Core metadata and configuration.
- Opening and closing database connections as needed.

Example:

```csharp
public sealed class AppDbContext : DbContext
{
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();

    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }
}
```

Usage:

```csharp
var customer = await context.Customers
    .SingleAsync(c => c.Id == customerId);

customer.Name = "Updated Name";

await context.SaveChangesAsync();
```

The context tracks the loaded `Customer`, detects the change to `Name`, and sends the update when `SaveChangesAsync` is called.

### `DbContext` Is a Unit-of-Work Object

A `DbContext` is designed to represent a single unit of work.

Typical unit-of-work flow:

1. Create a `DbContext`.
2. Query entities or attach entities.
3. Make changes.
4. Call `SaveChanges` or `SaveChangesAsync`.
5. Dispose the `DbContext`.

Example:

```csharp
public async Task RenameCustomerAsync(
    int customerId,
    string newName,
    CancellationToken cancellationToken)
{
    var customer = await _context.Customers
        .SingleAsync(c => c.Id == customerId, cancellationToken);

    customer.Name = newName;

    await _context.SaveChangesAsync(cancellationToken);
}
```

The context should not usually live for the entire application lifetime. It should live long enough to perform the required business operation and then be disposed.

### Default Lifetime in ASP.NET Core

In ASP.NET Core, the common registration is:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"));
});
```

By default, this registers `AppDbContext` as a scoped service.

Scoped means:

- One `DbContext` instance is created per dependency injection scope.
- In a normal ASP.NET Core Web API, one request creates one scope.
- Services resolved during that request receive the same scoped context instance.
- The context is disposed when the request scope ends.

Example controller:

```csharp
[ApiController]
[Route("api/customers")]
public sealed class CustomersController : ControllerBase
{
    private readonly AppDbContext _context;

    public CustomersController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CustomerDto>> GetById(
        int id,
        CancellationToken cancellationToken)
    {
        var customer = await _context.Customers
            .AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new CustomerDto
            {
                Id = c.Id,
                Name = c.Name
            })
            .SingleOrDefaultAsync(cancellationToken);

        return customer is null ? NotFound() : Ok(customer);
    }
}
```

This is a good default for many web applications because one HTTP request often corresponds to one unit of work.

### Why Not Singleton?

A singleton `DbContext` is almost always wrong.

Bad registration:

```csharp
builder.Services.AddSingleton<AppDbContext>();
```

Problems with singleton contexts:

- `DbContext` is not thread-safe.
- Many requests may use the same instance concurrently.
- Change tracker grows over time.
- Entities become stale.
- Memory usage increases.
- One request can accidentally affect another request.
- Failed EF operations can leave the context in a bad state.
- `SaveChanges` may save changes from unrelated operations.
- Disposing becomes unclear.
- Long-lived context instances hold references and event hooks longer than needed.

A singleton service may exist for the lifetime of the application, but a `DbContext` should represent a short unit of work.

### Why Not Usually Transient?

A transient `DbContext` means each service resolution gets a new instance.

Example:

```csharp
builder.Services.AddDbContext<AppDbContext>(
    options => options.UseSqlServer(connectionString),
    ServiceLifetime.Transient);
```

Transient can be useful in specific cases, but it is not the normal default for web apps.

Potential issue:

```csharp
public sealed class OrderService
{
    private readonly AppDbContext _context;
    private readonly AuditService _auditService;

    public OrderService(AppDbContext context, AuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    public async Task PlaceOrderAsync(Order order)
    {
        _context.Orders.Add(order);

        await _auditService.WriteAuditAsync("Order placed");

        await _context.SaveChangesAsync();
    }
}

public sealed class AuditService
{
    private readonly AppDbContext _context;

    public AuditService(AppDbContext context)
    {
        _context = context;
    }

    public async Task WriteAuditAsync(string message)
    {
        _context.AuditLogs.Add(new AuditLog { Message = message });
        await Task.CompletedTask;
    }
}
```

If the context is transient, `OrderService` and `AuditService` may receive different context instances. Then `OrderService.SaveChangesAsync()` may not save the audit log. With scoped lifetime, both services in the same request normally share the same context instance.

Transient contexts can be useful when each operation must have an independent context, but it should be a deliberate design choice.

### Scoped Lifetime and Repositories

A scoped `DbContext` allows multiple services and repositories in the same request to participate in the same unit of work.

Example:

```csharp
public sealed class CustomerRepository
{
    private readonly AppDbContext _context;

    public CustomerRepository(AppDbContext context)
    {
        _context = context;
    }

    public Task<Customer?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        return _context.Customers
            .SingleOrDefaultAsync(c => c.Id == id, cancellationToken);
    }
}

public sealed class OrderRepository
{
    private readonly AppDbContext _context;

    public OrderRepository(AppDbContext context)
    {
        _context = context;
    }

    public void Add(Order order)
    {
        _context.Orders.Add(order);
    }
}
```

If both repositories are resolved in the same request scope, they use the same context. One call to `SaveChangesAsync` can persist all changes for that unit of work.

This is often useful in application services or CQRS command handlers.

### `DbContext` Is Not Thread-Safe

`DbContext` is not thread-safe. Do not use the same context instance from multiple threads at the same time.

Bad example:

```csharp
var task1 = _context.Customers.ToListAsync();
var task2 = _context.Orders.ToListAsync();

await Task.WhenAll(task1, task2);
```

This starts two database operations on the same context concurrently. It can throw an exception such as "A second operation was started on this context instance before a previous operation completed."

Correct approach: await one operation before starting another on the same context.

```csharp
var customers = await _context.Customers.ToListAsync();
var orders = await _context.Orders.ToListAsync();
```

If true parallel database operations are needed, use separate `DbContext` instances.

```csharp
await Task.WhenAll(
    LoadCustomersAsync(cancellationToken),
    LoadOrdersAsync(cancellationToken));

async Task<List<Customer>> LoadCustomersAsync(CancellationToken cancellationToken)
{
    await using var context = await _contextFactory.CreateDbContextAsync(cancellationToken);

    return await context.Customers
        .AsNoTracking()
        .ToListAsync(cancellationToken);
}

async Task<List<Order>> LoadOrdersAsync(CancellationToken cancellationToken)
{
    await using var context = await _contextFactory.CreateDbContextAsync(cancellationToken);

    return await context.Orders
        .AsNoTracking()
        .ToListAsync(cancellationToken);
}
```

Each parallel operation gets its own context.

### Always Await EF Core Async Methods

A common thread-safety bug happens when developers forget to await an EF Core async call before using the same context again.

Bad:

```csharp
var customerTask = _context.Customers
    .SingleAsync(c => c.Id == customerId);

var orders = await _context.Orders
    .Where(o => o.CustomerId == customerId)
    .ToListAsync();

var customer = await customerTask;
```

This starts the customer query and then starts the orders query before the first query finishes. Both use the same context concurrently.

Good:

```csharp
var customer = await _context.Customers
    .SingleAsync(c => c.Id == customerId);

var orders = await _context.Orders
    .Where(o => o.CustomerId == customerId)
    .ToListAsync();
```

Rule:

Always await EF Core async operations before using the same context again.

### Avoid Sharing a Context Across Threads

Do not capture one injected scoped context and use it in multiple parallel tasks.

Bad:

```csharp
public async Task ProcessOrdersAsync(List<int> orderIds)
{
    await Parallel.ForEachAsync(orderIds, async (orderId, cancellationToken) =>
    {
        var order = await _context.Orders
            .SingleAsync(o => o.Id == orderId, cancellationToken);

        order.Process();

        await _context.SaveChangesAsync(cancellationToken);
    });
}
```

This shares `_context` across parallel operations.

Better: create a context per parallel operation.

```csharp
public async Task ProcessOrdersAsync(List<int> orderIds)
{
    await Parallel.ForEachAsync(orderIds, async (orderId, cancellationToken) =>
    {
        await using var context = await _contextFactory
            .CreateDbContextAsync(cancellationToken);

        var order = await context.Orders
            .SingleAsync(o => o.Id == orderId, cancellationToken);

        order.Process();

        await context.SaveChangesAsync(cancellationToken);
    });
}
```

However, parallelizing database work is not always a good idea. It can increase database load and exhaust the connection pool. Measure and limit concurrency when needed.

### `IDbContextFactory<TContext>`

`IDbContextFactory<TContext>` creates new `DbContext` instances on demand.

Registration:

```csharp
builder.Services.AddDbContextFactory<AppDbContext>(options =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"));
});
```

Usage:

```csharp
public sealed class ReportService
{
    private readonly IDbContextFactory<AppDbContext> _contextFactory;

    public ReportService(IDbContextFactory<AppDbContext> contextFactory)
    {
        _contextFactory = contextFactory;
    }

    public async Task<List<CustomerReportRow>> BuildReportAsync(
        CancellationToken cancellationToken)
    {
        await using var context = await _contextFactory
            .CreateDbContextAsync(cancellationToken);

        return await context.Customers
            .AsNoTracking()
            .Select(c => new CustomerReportRow
            {
                CustomerId = c.Id,
                Name = c.Name,
                OrderCount = c.Orders.Count
            })
            .ToListAsync(cancellationToken);
    }
}
```

When using a factory, you are responsible for disposing the context.

Use a factory when:

- The DI scope does not match the desired context lifetime.
- A service needs multiple independent units of work.
- Work happens outside an HTTP request.
- You need a context inside a background service.
- You need separate contexts for parallel operations.
- Blazor Server needs shorter contexts than the circuit scope.
- You want explicit control over context creation and disposal.

### Background Services

Hosted services and background workers are singletons by default. A singleton background service should not directly inject a scoped `DbContext`.

Bad:

```csharp
public sealed class OrderWorker : BackgroundService
{
    private readonly AppDbContext _context;

    public OrderWorker(AppDbContext context)
    {
        _context = context;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Bad: scoped context captured by singleton service.
    }
}
```

Better option 1: use `IDbContextFactory<TContext>`.

```csharp
public sealed class OrderWorker : BackgroundService
{
    private readonly IDbContextFactory<AppDbContext> _contextFactory;

    public OrderWorker(IDbContextFactory<AppDbContext> contextFactory)
    {
        _contextFactory = contextFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await using var context = await _contextFactory
                .CreateDbContextAsync(stoppingToken);

            var pendingOrders = await context.Orders
                .Where(o => o.Status == OrderStatus.Pending)
                .Take(50)
                .ToListAsync(stoppingToken);

            foreach (var order in pendingOrders)
            {
                order.MarkProcessing();
            }

            await context.SaveChangesAsync(stoppingToken);

            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }
}
```

Better option 2: create a DI scope.

```csharp
public sealed class OrderWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public OrderWorker(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await using var scope = _scopeFactory.CreateAsyncScope();

            var context = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

            var pendingOrders = await context.Orders
                .Where(o => o.Status == OrderStatus.Pending)
                .Take(50)
                .ToListAsync(stoppingToken);

            foreach (var order in pendingOrders)
            {
                order.MarkProcessing();
            }

            await context.SaveChangesAsync(stoppingToken);

            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }
}
```

### Blazor Server and `DbContext`

Blazor Server has a different lifetime model from normal HTTP APIs. A scoped service can live for the duration of a user's circuit, which may be much longer than a single operation.

This can make a scoped `DbContext` too long-lived.

Preferred approach:

```csharp
builder.Services.AddDbContextFactory<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);
});
```

Component usage:

```csharp
@inject IDbContextFactory<AppDbContext> ContextFactory

@code {
    private List<CustomerDto> customers = new();

    protected override async Task OnInitializedAsync()
    {
        await using var context = await ContextFactory.CreateDbContextAsync();

        customers = await context.Customers
            .AsNoTracking()
            .Select(c => new CustomerDto
            {
                Id = c.Id,
                Name = c.Name
            })
            .ToListAsync();
    }
}
```

The factory allows each component operation to create a short-lived context.

### Desktop Applications

Desktop applications such as WPF or Windows Forms do not have HTTP request scopes. The right context lifetime depends on the unit of work.

Possible patterns:

- One context per screen edit operation.
- One context per command.
- One context per short transaction.
- One context per form only if the form itself represents a bounded edit session.

Bad pattern:

```text
Application starts -> create one DbContext -> keep it until application closes
```

This creates stale data and a growing change tracker.

Better pattern:

```text
User opens Edit Customer window -> create context
User edits customer -> SaveChanges
Window closes -> dispose context
```

For read-only grids or search screens, use short-lived no-tracking queries.

### Long-Running Operations

Avoid keeping one context alive for a long-running process that handles many independent operations.

Bad:

```csharp
public async Task ImportLargeFileAsync(string path)
{
    foreach (var line in File.ReadLines(path))
    {
        var entity = Parse(line);

        _context.Items.Add(entity);
    }

    await _context.SaveChangesAsync();
}
```

Problems:

- Change tracker grows.
- Memory usage increases.
- One failure affects the whole import.
- Save operation may become very large.
- The database transaction may be too large.

Better batching:

```csharp
public async Task ImportLargeFileAsync(
    string path,
    CancellationToken cancellationToken)
{
    const int batchSize = 500;

    var batch = new List<Item>(batchSize);

    foreach (var line in File.ReadLines(path))
    {
        batch.Add(Parse(line));

        if (batch.Count == batchSize)
        {
            await SaveBatchAsync(batch, cancellationToken);
            batch.Clear();
        }
    }

    if (batch.Count > 0)
    {
        await SaveBatchAsync(batch, cancellationToken);
    }
}

private async Task SaveBatchAsync(
    List<Item> batch,
    CancellationToken cancellationToken)
{
    await using var context = await _contextFactory
        .CreateDbContextAsync(cancellationToken);

    context.Items.AddRange(batch);

    await context.SaveChangesAsync(cancellationToken);
}
```

Another option is to use one context per batch and call `ChangeTracker.Clear()` after each save.

```csharp
context.Items.AddRange(batch);
await context.SaveChangesAsync(cancellationToken);
context.ChangeTracker.Clear();
```

### Change Tracker and Long-Lived Contexts

The change tracker keeps track of entity instances returned by queries or attached to the context.

Example:

```csharp
var customers = await context.Customers.ToListAsync();
```

In a tracking query, all returned customers become tracked.

If a context lives too long:

- More entities remain tracked.
- Memory usage increases.
- Query results may be stale.
- Relationship fix-up can create surprising results.
- `SaveChanges` may save changes from earlier unrelated operations.
- Performance may degrade because change detection has more entities to inspect.

For read-only queries, use no tracking:

```csharp
var customers = await context.Customers
    .AsNoTracking()
    .ToListAsync();
```

For large write operations, keep context lifetime bounded and clear tracking between batches when appropriate.

### Disposing a `DbContext`

A `DbContext` should be disposed after use.

When created by DI in a request scope, the DI container disposes it automatically.

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);
});
```

When created manually or through a factory, you must dispose it.

```csharp
await using var context = await _contextFactory.CreateDbContextAsync();

var customers = await context.Customers.ToListAsync();
```

Disposal matters because:

- Resources can be released.
- Event handlers and hooks can be unregistered.
- Underlying database connections can be closed if still open.
- Pooled contexts can be returned to the pool.
- Memory pressure is reduced.

### Connection Usage

A `DbContext` is not the same as a database connection.

EF Core typically opens the database connection just before a database operation and closes it shortly after the operation finishes.

Example:

```csharp
var customers = await context.Customers.ToListAsync();
// EF Core opens the connection for the query and closes it afterward.
```

This means a context can exist without holding an open connection all the time.

Why this matters:

- Creating a context is usually cheap.
- The database driver manages connection pooling.
- Closed connections are returned to the connection pool.
- Keeping connections open longer than necessary can reduce scalability.
- Long-running transactions keep connections busy.

### Database Connection Pooling

Database connection pooling is handled by the underlying database driver, such as the ADO.NET provider.

Connection pooling reuses physical database connections so the application does not need to create a new physical connection for every query.

Important points:

- EF Core does not implement database connection pooling itself.
- Connection pooling is usually enabled by default by the provider.
- Connection pool settings are usually configured in the connection string.
- Connections are returned to the pool when closed or disposed.
- EF Core normally opens and closes connections around operations.
- Long-running queries and transactions can hold connections and reduce pool availability.

Example SQL Server connection string with pool settings:

```text
Server=tcp:myserver.database.windows.net,1433;
Database=MyDatabase;
Authentication=Active Directory Default;
Max Pool Size=100;
Min Pool Size=0;
```

Do not confuse this with `DbContext` pooling.

### `DbContext` Pooling

`DbContext` pooling reuses context instances to reduce allocation and initialization overhead.

Registration:

```csharp
builder.Services.AddDbContextPool<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);
});
```

With pooling, when a context is disposed, EF Core resets its state and stores it in a pool. A later request can reuse the instance.

Benefits:

- Reduces context allocation overhead.
- Can improve performance in high-throughput applications.
- Useful when context setup cost matters.

Trade-offs and cautions:

- Context instances are reused.
- Any custom mutable state in your context can leak if not reset.
- `OnConfiguring` may not behave as expected for per-request state.
- Tenant-specific state must be handled carefully.
- Do not store request-specific data in the context instance.
- Pooled contexts must still not be used concurrently.
- You must still dispose the context so it returns to the pool.

`DbContext` pooling is an optimization. It does not change the normal unit-of-work rule.

### `DbContext` Pooling vs Connection Pooling

These two features solve different problems.

| Feature | What It Reuses | Managed By | Purpose |
|---|---|---|---|
| `DbContext` pooling | EF Core context instances | EF Core | Reduce context allocation/setup overhead |
| Connection pooling | Database connections | Database driver | Reduce cost of opening physical connections |

A context pool does not mean one database connection is kept forever for each context.

A connection pool does not mean one `DbContext` should be shared forever.

They are orthogonal.

Example:

```csharp
builder.Services.AddDbContextPool<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);
});
```

This enables EF Core context pooling. Database connection pooling still depends on the SQL Server provider and connection string.

### `AddPooledDbContextFactory`

A pooled factory can create pooled context instances on demand.

Registration:

```csharp
builder.Services.AddPooledDbContextFactory<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);
});
```

Usage:

```csharp
public sealed class ImportService
{
    private readonly IDbContextFactory<AppDbContext> _contextFactory;

    public ImportService(IDbContextFactory<AppDbContext> contextFactory)
    {
        _contextFactory = contextFactory;
    }

    public async Task ImportAsync(CancellationToken cancellationToken)
    {
        await using var context = await _contextFactory
            .CreateDbContextAsync(cancellationToken);

        context.Items.Add(new Item { Name = "Sample" });

        await context.SaveChangesAsync(cancellationToken);
    }
}
```

This combines factory-style context creation with pooling.

Use it when you need explicit context creation and want pooling benefits.

### Request-Specific State and Context Pooling

Be careful with pooled contexts if the context stores request-specific state.

Bad:

```csharp
public sealed class AppDbContext : DbContext
{
    public string? TenantId { get; set; }

    public DbSet<Order> Orders => Set<Order>();

    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }
}
```

If this context is pooled, `TenantId` may accidentally carry over if it is not reset.

Better approaches:

- Avoid mutable request-specific state in the context.
- Pass tenant ID through query filters carefully.
- Use a scoped tenant provider.
- Create a scoped wrapper around a pooled factory.
- Ensure any state is set before use and reset before return.
- Consider not using context pooling for complex per-tenant state.

For multi-tenant systems, context pooling requires extra care.

### One Context per Request vs One Context per Operation

In many ASP.NET Core APIs, one context per request is a good default.

Example:

```text
HTTP POST /orders
 -> Load customer
 -> Add order
 -> Add audit log
 -> SaveChanges
 -> Dispose context at request end
```

But sometimes one request contains multiple independent operations.

Example:

```text
HTTP POST /batch
 -> Process item A
 -> Save
 -> Process item B
 -> Save
 -> Process item C
 -> Save
```

You might choose one context per item or one context per batch instead of one context for the whole request, especially when the batch is large.

Use one context per request when:

- The request is a single business unit of work.
- Multiple services should participate in one `SaveChanges`.
- The number of tracked entities is bounded.
- No parallel EF operations are needed.

Use one context per operation when:

- The request has independent sub-operations.
- The process is long-running.
- You need to release tracked entities.
- You need isolation between operations.
- You need parallel operations with separate contexts.
- You want each item to succeed or fail independently.

### Sharing a Context Across Services

Sharing a scoped context across services within one request can be correct.

Example:

```csharp
public sealed class PlaceOrderHandler
{
    private readonly AppDbContext _context;
    private readonly InventoryService _inventoryService;

    public PlaceOrderHandler(
        AppDbContext context,
        InventoryService inventoryService)
    {
        _context = context;
        _inventoryService = inventoryService;
    }

    public async Task<int> HandleAsync(
        PlaceOrderCommand command,
        CancellationToken cancellationToken)
    {
        var order = new Order(command.CustomerId);

        _context.Orders.Add(order);

        await _inventoryService.ReserveAsync(
            command.ProductId,
            command.Quantity,
            cancellationToken);

        await _context.SaveChangesAsync(cancellationToken);

        return order.Id;
    }
}
```

If `InventoryService` uses the same scoped context, the order and inventory changes can be saved together.

This is useful for a single unit of work.

Avoid sharing across:

- Different requests.
- Different users.
- Background operations outside the scope.
- Parallel tasks.
- Long-running workflows.
- Cached delegates or callbacks.
- Singleton services.
- UI sessions that stay open for a long time.

### Capturing a Scoped Context in a Singleton

A singleton service must not capture a scoped `DbContext`.

Bad:

```csharp
public sealed class ProductCache
{
    private readonly AppDbContext _context;

    public ProductCache(AppDbContext context)
    {
        _context = context;
    }
}
```

If `ProductCache` is singleton, this creates a lifetime mismatch. A scoped context is being captured by a longer-lived service.

Better:

```csharp
public sealed class ProductCache
{
    private readonly IDbContextFactory<AppDbContext> _contextFactory;

    public ProductCache(IDbContextFactory<AppDbContext> contextFactory)
    {
        _contextFactory = contextFactory;
    }

    public async Task<List<ProductDto>> LoadProductsAsync(
        CancellationToken cancellationToken)
    {
        await using var context = await _contextFactory
            .CreateDbContextAsync(cancellationToken);

        return await context.Products
            .AsNoTracking()
            .Select(p => new ProductDto
            {
                Id = p.Id,
                Name = p.Name
            })
            .ToListAsync(cancellationToken);
    }
}
```

Singleton services should create contexts only when needed and dispose them quickly.

### Caching and `DbContext`

Do not cache entities that are still attached to a context. Do not cache a context itself.

Bad:

```csharp
_memoryCache.Set("products", await _context.Products.ToListAsync());
```

This may cache tracked entities. If the context is disposed, those entities are detached. If the context is long-lived, the cache may hold references longer than intended.

Better:

```csharp
var products = await _context.Products
    .AsNoTracking()
    .Select(p => new ProductCacheItem
    {
        Id = p.Id,
        Name = p.Name,
        Price = p.Price
    })
    .ToListAsync(cancellationToken);

_memoryCache.Set("products", products);
```

Cache DTOs or immutable read models, not live EF Core contexts.

### Disconnected Entities

In web APIs, entities are often disconnected between requests.

Example flow:

1. Request 1 loads an entity and sends a DTO to the client.
2. The context is disposed.
3. The client sends an update request later.
4. Request 2 uses a new context.

Do not try to keep the same context across requests just to keep tracking alive.

Better update pattern:

```csharp
[HttpPut("{id:int}")]
public async Task<IActionResult> UpdateCustomer(
    int id,
    UpdateCustomerRequest request,
    CancellationToken cancellationToken)
{
    var customer = await _context.Customers
        .SingleOrDefaultAsync(c => c.Id == id, cancellationToken);

    if (customer is null)
    {
        return NotFound();
    }

    customer.Name = request.Name;

    await _context.SaveChangesAsync(cancellationToken);

    return NoContent();
}
```

A new context per request is normal.

### Context Lifetime and Transactions

A `DbContext` can use a transaction to coordinate multiple database operations.

Example:

```csharp
await using var transaction = await _context.Database
    .BeginTransactionAsync(cancellationToken);

try
{
    _context.Orders.Add(order);
    await _context.SaveChangesAsync(cancellationToken);

    _context.AuditLogs.Add(auditLog);
    await _context.SaveChangesAsync(cancellationToken);

    await transaction.CommitAsync(cancellationToken);
}
catch
{
    await transaction.RollbackAsync(cancellationToken);
    throw;
}
```

The context should live for the duration of the transaction. Do not dispose the context before the transaction completes.

However, do not keep transactions open for a long time. Long transactions can:

- Hold locks.
- Block other operations.
- Hold database connections.
- Increase deadlock risk.
- Reduce scalability.

### Connection Resiliency and Retries

Some providers support connection resiliency with automatic retries.

Example for SQL Server:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(
        connectionString,
        sqlOptions =>
        {
            sqlOptions.EnableRetryOnFailure();
        });
});
```

This can help with transient failures, especially in cloud databases.

Important points:

- Each EF operation can be retried as a unit.
- User-initiated transactions need special handling with an execution strategy.
- Retrying can affect memory use because results may be buffered internally.
- Retrying does not make a shared context thread-safe.
- Retrying does not fix long-lived context problems.

### Handling EF Core Exceptions and Context State

Some EF Core exceptions indicate programming errors and may leave the context in an unrecoverable state.

Example:

```csharp
try
{
    await _context.SaveChangesAsync(cancellationToken);
}
catch (InvalidOperationException)
{
    // This often indicates a programming/configuration error.
    // The context may not be safe to continue using.
    throw;
}
```

For recoverable database exceptions such as a unique constraint violation, you may choose to handle the exception. But be careful: entities in the change tracker may still be in Added/Modified states.

A safe pattern after serious EF errors is to discard the context and create a new one for the next unit of work.

### `DbContext` and `SaveChanges`

`SaveChanges` applies all tracked changes in the context.

Example:

```csharp
customer.Name = "New Name";
order.Status = OrderStatus.Submitted;

await context.SaveChangesAsync();
```

This saves both changes if both entities are tracked by the same context.

This is powerful, but it is also why long-lived or shared contexts are dangerous. If unrelated code changes tracked entities, a later `SaveChanges` may persist unexpected changes.

Best practice:

- Keep the context lifetime bounded.
- Keep unit-of-work boundaries clear.
- Avoid hidden changes across unrelated operations.
- Use separate contexts when operations are independent.
- Use explicit transactions when multiple saves must be atomic.

### No-Tracking Queries and Context Lifetime

For read-only operations, no-tracking queries reduce change tracker overhead.

```csharp
var customers = await context.Customers
    .AsNoTracking()
    .Where(c => c.IsActive)
    .Select(c => new CustomerDto
    {
        Id = c.Id,
        Name = c.Name
    })
    .ToListAsync(cancellationToken);
```

No-tracking is helpful when:

- Returning API DTOs.
- Rendering read-only pages.
- Running reports.
- Loading cache data.
- Reading large result sets.
- You do not need `SaveChanges` for the loaded entities.

No-tracking does not remove the need to dispose the context. It only reduces tracking overhead.

### When to Avoid Sharing a Context

Avoid sharing a context when:

- Operations run in parallel.
- Work is long-running.
- Work spans multiple requests.
- Work spans multiple users.
- A singleton service needs data access.
- A background service runs continuously.
- A UI circuit/session is long-lived.
- A cache needs data refresh later.
- The context has request-specific state.
- The context would track too many entities.
- You need independent transactions.
- You need independent success/failure boundaries.
- You use `Task.WhenAll`, `Parallel.ForEachAsync`, or multiple threads.
- You want to isolate retries or failures.

Use a new context or factory-created context instead.

### When Sharing a Scoped Context Is Appropriate

Sharing a scoped context is appropriate when:

- The services are part of the same request.
- The request represents one unit of work.
- All changes should be saved together.
- The operations are sequential, not parallel.
- The context lifetime is short.
- The number of tracked entities is reasonable.
- The services are scoped or transient within the same DI scope.

Example:

```text
POST /orders
 -> OrderHandler
 -> InventoryService
 -> AuditService
 -> one scoped DbContext
 -> SaveChanges once
```

This is a normal and useful EF Core pattern.

### Multiple Contexts in One Request

Sometimes multiple contexts in one request are acceptable.

Examples:

- One context for a read-only query and another for a write.
- One context per independent batch item.
- Separate contexts for parallel operations.
- Separate contexts for multiple databases.
- A short-lived context from a factory inside a larger request.

Trade-offs:

- Separate contexts do not share change tracking.
- One `SaveChanges` does not save changes from another context.
- Transactions across multiple contexts require explicit coordination.
- Identity resolution happens per context.
- The same database row may appear as different object instances.

Use multiple contexts when isolation is more important than a shared unit of work.

### Context Per Tenant

Multi-tenant applications need careful context design.

Common patterns:

- Shared database with tenant ID column.
- Database per tenant.
- Schema per tenant.
- Connection string per tenant.

For shared database:

```csharp
public sealed class AppDbContext : DbContext
{
    private readonly ITenantProvider _tenantProvider;

    public AppDbContext(
        DbContextOptions<AppDbContext> options,
        ITenantProvider tenantProvider)
        : base(options)
    {
        _tenantProvider = tenantProvider;
    }

    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Order>()
            .HasQueryFilter(o => o.TenantId == _tenantProvider.TenantId);
    }
}
```

Be careful when combining tenant-specific state with context pooling. Pooled contexts may be reused across requests, so tenant state must not leak.

For database-per-tenant, a factory or scoped context configuration may be needed to choose the right connection string per unit of work.

### Common Mistakes

Common mistakes include:

- Registering `DbContext` as singleton.
- Sharing a context across threads.
- Running multiple async EF operations on the same context at once.
- Forgetting to await `ToListAsync`, `SaveChangesAsync`, or other async EF methods.
- Injecting scoped `DbContext` into singleton services.
- Using a scoped context in long-running background work.
- Keeping one context for the entire application lifetime.
- Returning a context from a factory without disposing it.
- Assuming `DbContext` pooling is the same as connection pooling.
- Storing request-specific mutable state in a pooled context.
- Using one context for huge imports without batching.
- Tracking large read-only result sets.
- Sharing one context across multiple users or requests.
- Calling `SaveChanges` from multiple layers without clear unit-of-work boundaries.
- Treating `DbContext` as a global repository.
- Using lazy loading with long-lived contexts and then seeing stale or unexpected data.

### Best Practices

Use `AddDbContext<TContext>()` with scoped lifetime for typical ASP.NET Core Web APIs.

Treat one HTTP request as one unit of work when appropriate.

Keep `DbContext` instances short-lived.

Dispose contexts created manually or through factories.

Never use the same context concurrently from multiple threads.

Always await EF Core async operations before using the context again.

Use `IDbContextFactory<TContext>` when the DI scope does not match the desired context lifetime.

Use factories or scopes in background services.

Avoid singleton `DbContext`.

Use `AsNoTracking()` for read-only queries.

Use batching for large imports or long-running work.

Do not cache `DbContext` or tracked entities.

Understand that context pooling is an optimization and does not change lifetime rules.

Understand that connection pooling is managed by the database driver and is separate from context pooling.

Avoid storing request-specific mutable state in pooled contexts.

Use transactions only for bounded operations and keep them short.

Discard the context after serious EF Core programming exceptions.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q01 -->
#### Beginner Q01: What is the recommended lifetime for `DbContext` in ASP.NET Core?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

For typical ASP.NET Core Web APIs, `DbContext` is registered as scoped by default using `AddDbContext`. This usually means one context instance per HTTP request.

This works well because one request often represents one unit of work. The context can track entities, apply changes, call `SaveChanges`, and then be disposed when the request ends.

Example:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);
});
```

##### Key Points to Mention

- `AddDbContext` registers scoped by default.
- Scoped usually means one context per HTTP request.
- `DbContext` should be short-lived.
- One request often maps to one unit of work.
- The context is disposed at the end of the request.
- Singleton `DbContext` is usually wrong.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q01 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q02 -->
#### Beginner Q02: Is `DbContext` thread-safe?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

No. `DbContext` is not thread-safe. You should not use the same context instance concurrently from multiple threads or parallel tasks.

Bad example:

```csharp
var customersTask = context.Customers.ToListAsync();
var ordersTask = context.Orders.ToListAsync();

await Task.WhenAll(customersTask, ordersTask);
```

This starts two operations on the same context at the same time. Use sequential awaits or separate context instances.

##### Key Points to Mention

- `DbContext` is not thread-safe.
- Do not share one context across parallel tasks.
- Always await async EF operations before using the context again.
- Use separate contexts for parallel operations.
- Concurrent use can throw exceptions or corrupt state.
- This is a common EF Core interview question.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q02 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q03 -->
#### Beginner Q03: Why is a singleton `DbContext` a bad idea?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A singleton `DbContext` is bad because a context is designed for a short unit of work, not the entire application lifetime. A singleton context may be used by many requests at the same time, but `DbContext` is not thread-safe.

It also keeps tracking more and more entities, increases memory usage, can contain stale data, and can accidentally save changes from unrelated operations.

##### Key Points to Mention

- `DbContext` is not thread-safe.
- Singleton may be shared across requests.
- Change tracker grows over time.
- Data can become stale.
- Memory usage increases.
- `SaveChanges` may persist unrelated changes.
- Use scoped or factory-created contexts instead.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q03 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q04 -->
#### Beginner Q04: What does it mean that `DbContext` is a unit-of-work object?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

It means a `DbContext` should represent one logical group of database operations. During that unit of work, the context tracks entities, detects changes, and saves those changes together.

A typical unit of work is:

1. Create or resolve a context.
2. Query or attach entities.
3. Modify entities.
4. Call `SaveChanges`.
5. Dispose the context.

In a Web API, one HTTP request often maps to one unit of work.

##### Key Points to Mention

- Tracks changes for a logical operation.
- `SaveChanges` persists tracked changes.
- Context lifetime should be short.
- Dispose after the unit of work.
- One request is often one unit of work.
- Long-lived contexts are usually problematic.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q04 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q05 -->
#### Beginner Q05: What is the difference between `DbContext` and a database connection?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

`DbContext` is an EF Core object that manages querying, tracking, and saving entities. A database connection is the lower-level connection to the database.

A context does not usually keep a database connection open for its entire lifetime. EF Core typically opens a connection before a database operation and closes it afterward, returning the connection to the provider's connection pool.

##### Key Points to Mention

- `DbContext` is an EF Core unit-of-work/session object.
- Database connection is lower-level.
- EF usually opens and closes connections around operations.
- Connection pooling is handled by the database provider.
- Context pooling and connection pooling are different.
- Keeping contexts short-lived does not mean creating physical connections constantly.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q05 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q06 -->
#### Beginner Q06: When should a `DbContext` be disposed?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

A `DbContext` should be disposed after its unit of work is complete. If the context is created by ASP.NET Core dependency injection through `AddDbContext`, the DI container disposes it at the end of the request scope.

If you create a context manually or with `IDbContextFactory<TContext>`, you are responsible for disposing it.

Example:

```csharp
await using var context = await contextFactory.CreateDbContextAsync();
```

##### Key Points to Mention

- Dispose after unit of work.
- DI disposes scoped contexts automatically.
- Factory-created contexts must be disposed manually.
- Disposal releases resources and unregisters hooks.
- Pooled contexts return to the pool when disposed.
- Do not keep context for the app lifetime.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q01 -->
#### Intermediate Q01: When should you use `IDbContextFactory<TContext>`?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use `IDbContextFactory<TContext>` when the dependency injection scope does not match the desired context lifetime or when you need to create contexts manually.

Common cases include background services, Blazor Server, parallel operations, long-running workflows, multiple independent units of work inside one request, or singleton services that need database access.

Example:

```csharp
await using var context = await contextFactory.CreateDbContextAsync();

var customers = await context.Customers
    .AsNoTracking()
    .ToListAsync();
```

When using a factory, the caller must dispose the context.

##### Key Points to Mention

- Creates new context instances on demand.
- Useful outside normal request scope.
- Useful in background services.
- Useful in Blazor Server.
- Useful for parallel operations with separate contexts.
- Factory-created contexts must be disposed.
- Avoids capturing scoped contexts in singletons.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q01 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q02 -->
#### Intermediate Q02: How should a background service use `DbContext`?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A background service is typically a singleton, so it should not directly inject a scoped `DbContext`. Instead, it should use `IDbContextFactory<TContext>` or create a service scope with `IServiceScopeFactory`.

Example with a factory:

```csharp
await using var context = await contextFactory.CreateDbContextAsync(stoppingToken);

var jobs = await context.Jobs
    .Where(j => j.Status == JobStatus.Pending)
    .ToListAsync(stoppingToken);
```

Each loop or unit of work should create and dispose a context.

##### Key Points to Mention

- Hosted services are usually singletons.
- Do not inject scoped context directly into singleton services.
- Use `IDbContextFactory<TContext>` or `IServiceScopeFactory`.
- Create a context per unit of work.
- Dispose the context after use.
- Avoid long-lived context instances in background loops.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q02 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q03 -->
#### Intermediate Q03: What is the difference between `DbContext` pooling and connection pooling?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

`DbContext` pooling reuses EF Core context instances to reduce allocation and initialization overhead. It is configured with `AddDbContextPool` or `AddPooledDbContextFactory`.

Connection pooling reuses physical database connections and is handled by the database provider or ADO.NET driver. It is usually configured through the connection string.

They are separate features. Context pooling does not replace connection pooling, and connection pooling does not mean a `DbContext` should be shared.

##### Key Points to Mention

- Context pooling reuses EF context instances.
- Connection pooling reuses database connections.
- Context pooling is managed by EF Core.
- Connection pooling is managed by the database driver.
- They solve different performance problems.
- Both still require proper context disposal.
- Pooled contexts still are not thread-safe.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q03 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q04 -->
#### Intermediate Q04: Why should you avoid a long-lived `DbContext`?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

A long-lived `DbContext` keeps tracking entities over time. This can increase memory usage, slow down change detection, return stale data, and cause unexpected saves because unrelated changes may still be tracked.

A context should normally be short-lived and tied to a clear unit of work. For long-running operations, use one context per batch or per operation.

##### Key Points to Mention

- Change tracker grows over time.
- Memory usage increases.
- Data can become stale.
- `SaveChanges` may save unrelated changes.
- Change detection can get slower.
- Serious EF exceptions can leave context unusable.
- Use short-lived contexts or batching.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q04 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q05 -->
#### Intermediate Q05: Why is it important to await EF Core async calls immediately?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

EF Core async calls must be awaited before using the same context again because `DbContext` does not support multiple concurrent operations.

Bad example:

```csharp
var customerTask = context.Customers.SingleAsync(c => c.Id == id);
var orders = await context.Orders.ToListAsync();
var customer = await customerTask;
```

This can start two operations on the same context at the same time.

Correct example:

```csharp
var customer = await context.Customers.SingleAsync(c => c.Id == id);
var orders = await context.Orders.ToListAsync();
```

##### Key Points to Mention

- `DbContext` does not support concurrent operations.
- Missing `await` can cause concurrent context usage.
- Can throw "second operation started" exception.
- Can corrupt context state if undetected.
- Await before using the context again.
- Use separate contexts for parallel operations.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q05 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q06 -->
#### Intermediate Q06: How should you handle large imports with EF Core?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Large imports should avoid using one context for the entire import if that causes the change tracker to grow too large. A common pattern is to process records in batches, save each batch, and either create a new context per batch or clear the change tracker after each batch.

Example:

```csharp
context.Items.AddRange(batch);
await context.SaveChangesAsync(cancellationToken);
context.ChangeTracker.Clear();
```

Or create a new context per batch using a factory.

##### Key Points to Mention

- Avoid tracking too many entities.
- Process in batches.
- Save per batch.
- Clear the change tracker or create a new context per batch.
- Keep transactions bounded.
- Consider bulk import tools for very large data.
- Monitor memory usage and database load.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q06 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q07 -->
#### Intermediate Q07: How should a singleton service access the database with EF Core?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

A singleton service should not directly inject a scoped `DbContext`. It should use `IDbContextFactory<TContext>` or `IServiceScopeFactory` to create a short-lived context when needed.

Example:

```csharp
public sealed class ProductCache
{
    private readonly IDbContextFactory<AppDbContext> _contextFactory;

    public ProductCache(IDbContextFactory<AppDbContext> contextFactory)
    {
        _contextFactory = contextFactory;
    }

    public async Task RefreshAsync(CancellationToken cancellationToken)
    {
        await using var context = await _contextFactory
            .CreateDbContextAsync(cancellationToken);

        var products = await context.Products
            .AsNoTracking()
            .ToListAsync(cancellationToken);
    }
}
```

##### Key Points to Mention

- Singleton should not capture scoped context.
- Use `IDbContextFactory` or create a scope.
- Create context only for the operation.
- Dispose the context.
- Use no-tracking for cache reads.
- Avoid caching tracked entities.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q07 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q08 -->
#### Intermediate Q08: What are the risks of `DbContext` pooling?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

`DbContext` pooling reuses context instances. This can improve performance, but it means custom mutable state in the context can leak across requests if not reset. Request-specific data such as tenant ID, current user ID, or flags should not be stored casually on the context instance.

Pooled contexts are still not thread-safe and must still be disposed after use so they can return to the pool.

##### Key Points to Mention

- Context instances are reused.
- Custom mutable state can leak.
- Request-specific state is risky.
- Tenant-specific scenarios need care.
- Still not thread-safe.
- Still must be disposed.
- Pooling is an optimization, not a lifetime change.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q01 -->
#### Advanced Q01: How would you design `DbContext` lifetime in a production ASP.NET Core application?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

For a typical ASP.NET Core Web API, register the context with `AddDbContext`, which gives a scoped lifetime by default. Treat each request as a unit of work when appropriate. Use one `SaveChangesAsync` at the application-service or handler boundary when multiple changes should be committed together.

For background services, Blazor Server, long-running work, or parallel operations, use `IDbContextFactory<TContext>` or create scopes explicitly. Keep contexts short-lived, avoid singleton contexts, use no-tracking queries for reads, and avoid sharing contexts across threads.

Use context pooling only as a measured optimization and be careful with mutable context state.

##### Key Points to Mention

- Scoped context is the default for Web APIs.
- One request often maps to one unit of work.
- Use factory when scope does not match lifetime.
- Background services should not capture scoped contexts.
- Do not share contexts across threads.
- Use no-tracking for reads.
- Consider pooling only with care.
- Keep unit-of-work boundaries clear.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q01 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q02 -->
#### Advanced Q02: How would you safely run parallel EF Core queries?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Do not run parallel queries on the same context. Use separate context instances for each parallel operation, usually created through `IDbContextFactory<TContext>`.

Example:

```csharp
var customersTask = LoadCustomersAsync(cancellationToken);
var ordersTask = LoadOrdersAsync(cancellationToken);

await Task.WhenAll(customersTask, ordersTask);
```

Each method should create and dispose its own context.

Also consider whether parallel database work is actually beneficial. It can increase database load, use more connections, and exhaust the connection pool. Limit concurrency when needed.

##### Key Points to Mention

- Same context cannot run parallel operations.
- Use separate contexts.
- `IDbContextFactory` is useful.
- Dispose each context.
- Watch connection pool pressure.
- Limit concurrency.
- Measure performance instead of assuming parallel is faster.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q02 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q03 -->
#### Advanced Q03: How does `DbContext` lifetime affect change tracking and stale data?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

The context tracks entities it loads or attaches. In a short-lived context, this is useful because changes are tracked only for the current unit of work. In a long-lived context, many entities can accumulate in the change tracker, increasing memory usage and slowing change detection.

Long-lived contexts can also show stale data because an entity already tracked by the context may be returned from the change tracker instead of being refreshed from the database. Relationship fix-up can also create surprising object graphs.

For read-only operations, use `AsNoTracking`. For long-running write operations, use batching or new contexts per unit of work.

##### Key Points to Mention

- Tracking is useful within a unit of work.
- Long-lived tracking increases memory.
- Change detection can get slower.
- Tracked entities may become stale.
- Relationship fix-up can surprise developers.
- `AsNoTracking` helps read-only queries.
- Keep context lifetime short.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q03 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q04 -->
#### Advanced Q04: How do you handle `DbContext` in a multi-tenant application?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

The design depends on the tenancy model. For a shared database, the context can use a tenant provider and global query filters to restrict data by tenant. For database-per-tenant, the context or factory must choose the correct connection string for each unit of work.

Be careful with `DbContext` pooling because pooled context instances are reused. Any tenant-specific mutable state stored on the context can leak between requests if not reset. In complex multi-tenant systems, avoid pooling or use a scoped wrapper/factory pattern that sets tenant state correctly.

##### Key Points to Mention

- Shared database often uses tenant ID filters.
- Database-per-tenant needs dynamic connection selection.
- Tenant state must be per unit of work.
- Context pooling requires extra caution.
- Do not let tenant state leak across requests.
- Use scoped tenant provider or factory pattern.
- Test tenant isolation.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q04 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q05 -->
#### Advanced Q05: How does connection pooling relate to context lifetime and scalability?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

EF Core usually opens a database connection shortly before executing a command and closes it after the command finishes. The underlying provider returns the physical connection to the connection pool.

This means short-lived contexts do not necessarily create new physical database connections every time. Connection pooling makes opening logical connections cheap.

Scalability problems happen when operations hold connections too long, such as long-running queries, long transactions, excessive parallelism, or streaming results slowly. These can exhaust the connection pool and cause timeouts.

##### Key Points to Mention

- EF Core does not implement connection pooling.
- Database provider manages connection pooling.
- EF usually opens/closes connections around operations.
- Closed connections return to the pool.
- Short-lived contexts are compatible with connection pooling.
- Long queries and transactions hold connections.
- Excessive parallelism can exhaust the pool.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q05 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q06 -->
#### Advanced Q06: When would you intentionally use multiple `DbContext` instances in one request?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Multiple contexts in one request can be useful when operations are independent, need separate success/failure boundaries, run in parallel, use different databases, or should avoid sharing a large change tracker.

Examples include a batch endpoint that processes independent items, a read-only reporting context separate from a write context, or parallel queries that each require their own context.

Trade-offs include no shared change tracking, no single `SaveChanges` across both contexts, and more complex transaction coordination if changes must be atomic.

##### Key Points to Mention

- Useful for independent operations.
- Needed for safe parallel EF work.
- Useful for different databases.
- Can reduce change tracker growth.
- Separate contexts do not share tracked entities.
- One `SaveChanges` does not save changes from another context.
- Cross-context transactions require explicit coordination.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q06 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q07 -->
#### Advanced Q07: How should `DbContext` lifetime be handled in Blazor Server?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Blazor Server scoped services can live for the duration of a user circuit, which is longer than a normal HTTP request. A scoped `DbContext` can therefore become too long-lived.

A common recommendation is to register `IDbContextFactory<TContext>` and create a short-lived context for each operation.

Example:

```csharp
await using var context = await ContextFactory.CreateDbContextAsync();

var customers = await context.Customers
    .AsNoTracking()
    .ToListAsync();
```

This avoids keeping one context for the whole circuit.

##### Key Points to Mention

- Blazor Server scope is circuit-based.
- Circuit lifetime can be long.
- Scoped context may become too long-lived.
- Use `IDbContextFactory`.
- Create context per operation.
- Dispose after operation.
- Use no-tracking for read-only UI data.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q07 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q08 -->
#### Advanced Q08: What can go wrong if `SaveChanges` is called from multiple services using the same scoped context?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

Calling `SaveChanges` from multiple services is not automatically wrong, but it can make unit-of-work boundaries unclear. One service may persist partial changes before the full business operation is complete. Another service may unintentionally save changes tracked by a different service.

A cleaner design is often to let repositories and domain services modify tracked entities, then call `SaveChanges` once at the application-service, command-handler, or transaction boundary.

However, there are cases where multiple saves are intentional, such as obtaining database-generated keys or saving independent steps.

##### Key Points to Mention

- Same scoped context tracks all changes.
- `SaveChanges` saves all tracked changes.
- Multiple services calling save can create unclear boundaries.
- Can persist partial state.
- Prefer saving at application boundary.
- Use transactions when multiple saves must be atomic.
- Multiple saves can be intentional when designed carefully.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q08 -->

<!-- question:start:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q09 -->
#### Advanced Q09: How would you explain when to avoid sharing a `DbContext`?

<!-- question-id:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

Avoid sharing a `DbContext` when operations are concurrent, long-running, unrelated, cross-request, cross-user, or require independent transactions or failure boundaries. Also avoid sharing with singleton services, background workers, cache refresh callbacks, and parallel loops.

Sharing is appropriate only when operations are sequential and belong to the same short unit of work, such as services participating in one HTTP request and one `SaveChanges`.

When in doubt, create a new context for a new unit of work.

##### Key Points to Mention

- Avoid sharing across threads.
- Avoid sharing across requests or users.
- Avoid sharing in singleton/background services.
- Avoid sharing in long-running operations.
- Avoid sharing when independent transactions are needed.
- Sharing within one sequential unit of work is okay.
- Use a factory for independent contexts.

<!-- question:end:dbcontext-lifetime-thread-safety-connection-usage-and-when-to-avoid-sharing-a-context-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
