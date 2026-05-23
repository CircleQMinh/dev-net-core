---
id: dbcontext-change-tracking-and-entity-state-management-in-ef-core
topic: Entity Framework
subtopic: DbContext change tracking and entity state management in EF Core
category: .NET
---


## Overview

`DbContext`, `DbSet`, entity states, and the Change Tracker are central to how Entity Framework Core reads data, tracks object changes, and writes those changes back to the database.

In EF Core, a `DbContext` represents a short-lived unit of work. It usually lives for one business operation, such as one HTTP request, one command handler, one background job step, or one screen edit operation. During that unit of work, EF Core can query entities, track them, detect changes, and generate SQL commands when `SaveChanges` or `SaveChangesAsync` is called.

This topic matters because many production bugs in EF Core come from misunderstanding tracking behavior. Common issues include accidentally updating every column, attaching duplicate entity instances, using a long-lived `DbContext`, mixing tracked and untracked entities incorrectly, calling `Update` on disconnected DTOs, or disabling `DetectChanges` without understanding the consequences.

It is important for interviews because it tests more than basic EF Core syntax. A strong candidate should understand how EF Core works internally enough to make good persistence decisions, debug unexpected updates, design clean API update flows, and avoid performance and concurrency problems.

Typical real-world use cases include:

- Loading an entity, changing a few properties, and saving only the changed columns.
- Creating new entities with `Add`.
- Updating disconnected entities from API request DTOs.
- Attaching existing entities without querying them first.
- Deleting entities with `Remove`.
- Inspecting `ChangeTracker.Entries()` for auditing, domain events, debugging, or soft-delete logic.
- Choosing between tracking queries and `AsNoTracking` queries.
- Avoiding duplicate tracked entity instances in long-running workflows.
- Understanding why an entity is `Added`, `Modified`, `Deleted`, `Unchanged`, or `Detached`.

## Core Concepts

### DbContext as a Unit of Work

`DbContext` is the main EF Core object used to coordinate database access. It combines several responsibilities:

- Database connection and provider configuration.
- Query execution.
- Change tracking.
- Relationship fix-up.
- Entity state management.
- Command generation.
- Transaction coordination for `SaveChanges`.

A common mental model is:

1. Create a `DbContext`.
2. Query, add, attach, update, or remove entities.
3. Change entity property values.
4. Call `SaveChangesAsync`.
5. Dispose the `DbContext`.

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

In ASP.NET Core, `DbContext` is commonly registered as scoped:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));
});
```

For a typical Web API request, this means the same context instance is used during one request scope and disposed at the end of that request.

Best practice:

```csharp
public sealed class UpdateCustomerHandler
{
    private readonly AppDbContext _dbContext;

    public UpdateCustomerHandler(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task HandleAsync(int customerId, string newName, CancellationToken cancellationToken)
    {
        var customer = await _dbContext.Customers
            .SingleAsync(c => c.Id == customerId, cancellationToken);

        customer.Name = newName;

        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
```

Avoid treating `DbContext` as a singleton. It is not thread-safe, and a long-lived context can accumulate tracked entities, stale state, memory usage, and identity resolution conflicts.

### DbSet

`DbSet<TEntity>` represents a queryable and mutable set of entities of a specific type.

It is used for:

- Querying a database table or collection-like entity source.
- Adding new entities.
- Attaching existing entities.
- Updating disconnected entities.
- Removing entities.
- Accessing local tracked entities.

Example:

```csharp
var activeCustomers = await dbContext.Customers
    .Where(c => c.IsActive)
    .OrderBy(c => c.Name)
    .ToListAsync(cancellationToken);
```

A `DbSet<Customer>` does not literally hold every customer in memory. It represents the query root for `Customer` entities. The database is queried only when the LINQ query is executed, such as by calling `ToListAsync`, `SingleAsync`, `FirstOrDefaultAsync`, or iterating the query.

### Entity States

EF Core assigns each tracked entity an `EntityState`.

| State | Meaning | Saved by `SaveChanges`? |
|---|---|---|
| `Detached` | The entity is not tracked by the current `DbContext`. | No |
| `Added` | The entity is new and should be inserted. | Insert |
| `Unchanged` | The entity is tracked and matches the database snapshot. | No |
| `Modified` | One or more properties are marked as changed. | Update |
| `Deleted` | The entity should be deleted. | Delete |

Example:

```csharp
var customer = await dbContext.Customers.FindAsync([1], cancellationToken);

Console.WriteLine(dbContext.Entry(customer!).State); // Unchanged

customer!.Name = "Updated Name";

Console.WriteLine(dbContext.Entry(customer).State); // Often still Unchanged until changes are detected

await dbContext.SaveChangesAsync(cancellationToken);
```

A key interview point is that EF Core can track modifications at the property level. If a tracked entity is loaded from the database and only one property changes, EF Core can generate an update for only that changed property.

### Change Tracker

The Change Tracker is the EF Core component that tracks entity instances and their states.

It keeps information such as:

- Which entities are being tracked.
- Entity state.
- Original property values.
- Current property values.
- Modified properties.
- Temporary key values.
- Relationship changes.
- Navigation fix-up information.

Example:

```csharp
foreach (var entry in dbContext.ChangeTracker.Entries())
{
    Console.WriteLine($"{entry.Entity.GetType().Name}: {entry.State}");
}
```

The Change Tracker is what allows this simple update pattern to work:

```csharp
var customer = await dbContext.Customers
    .SingleAsync(c => c.Id == customerId, cancellationToken);

customer.Email = request.Email;

await dbContext.SaveChangesAsync(cancellationToken);
```

EF Core knows `customer` was loaded and tracked. It compares the current values with the original values and generates the needed database update.

### Snapshot Change Tracking

By default, EF Core uses snapshot change tracking.

When an entity is first tracked, EF Core stores a snapshot of its property values. Later, EF Core compares the current values with that snapshot to detect what changed.

Example:

```csharp
var product = await dbContext.Products
    .SingleAsync(p => p.Id == productId, cancellationToken);

product.Price = 99.99m;

await dbContext.SaveChangesAsync(cancellationToken);
```

EF Core originally remembers the old `Price`. At save time, it detects that `Price` changed and generates an update.

Conceptually:

```text
Original Price: 79.99
Current Price:  99.99
State:          Modified
Modified prop:  Price
```

This is different from simply saying "the entity object changed." EF Core needs either tracked state, explicit state changes, or attached state to know what should be written.

### DetectChanges

`DetectChanges` is the process EF Core uses to discover changes made to tracked entities.

It can be triggered automatically by EF Core in common operations such as:

- `SaveChanges`.
- `SaveChangesAsync`.
- `ChangeTracker.Entries()`.
- `ChangeTracker.HasChanges()`.
- `DbSet.Local`.
- Some `Entry` operations.

You can also call it manually:

```csharp
dbContext.ChangeTracker.DetectChanges();

Console.WriteLine(dbContext.ChangeTracker.DebugView.LongView);
```

Manual `DetectChanges` is useful when:

- Debugging tracking state.
- Working with low-level change-tracking APIs.
- Temporarily disabling automatic change detection for performance.
- Inspecting `DebugView`.

A common performance pattern for large imports is to temporarily disable automatic change detection:

```csharp
dbContext.ChangeTracker.AutoDetectChangesEnabled = false;

try
{
    foreach (var item in importedItems)
    {
        dbContext.Products.Add(item);
    }

    dbContext.ChangeTracker.DetectChanges();
    await dbContext.SaveChangesAsync(cancellationToken);
}
finally
{
    dbContext.ChangeTracker.AutoDetectChangesEnabled = true;
}
```

This should be used carefully. Disabling automatic change detection can improve performance in some large batch scenarios, but it can also cause incorrect behavior if the code expects EF Core to detect changes automatically.

### Tracking Queries

By default, EF Core queries that return entity types are tracking queries.

Example:

```csharp
var customer = await dbContext.Customers
    .SingleAsync(c => c.Id == customerId, cancellationToken);

customer.Name = "New Name";

await dbContext.SaveChangesAsync(cancellationToken);
```

The loaded `customer` is tracked. Updating the property and calling `SaveChangesAsync` is enough.

Tracking queries are useful when:

- You intend to update the returned entities.
- You need identity resolution within the context.
- You want EF Core to preserve original values for efficient updates.
- You are working inside one unit of work.

### No-Tracking Queries

`AsNoTracking` tells EF Core not to track returned entities.

Example:

```csharp
var customers = await dbContext.Customers
    .AsNoTracking()
    .Where(c => c.IsActive)
    .ToListAsync(cancellationToken);
```

No-tracking queries are usually better for read-only operations because they avoid the overhead of tracking.

Use `AsNoTracking` for:

- Read-only API responses.
- Reports.
- Dropdown lists.
- Search results.
- Queries with many rows where no update is needed.

Do not use `AsNoTracking` if you plan to edit the returned entity and expect `SaveChanges` to detect it automatically.

Problem example:

```csharp
var customer = await dbContext.Customers
    .AsNoTracking()
    .SingleAsync(c => c.Id == customerId, cancellationToken);

customer.Name = "Updated Name";

await dbContext.SaveChangesAsync(cancellationToken); // No update, because customer is not tracked
```

To update an untracked entity, you must either query a tracked entity first or explicitly attach/update it.

### Identity Resolution

A single `DbContext` can track only one entity instance with a given primary key value.

This means the following pattern can fail:

```csharp
var trackedCustomer = await dbContext.Customers
    .SingleAsync(c => c.Id == request.Id, cancellationToken);

var detachedCustomer = new Customer
{
    Id = request.Id,
    Name = request.Name
};

dbContext.Update(detachedCustomer); // Can throw because another instance with same key is already tracked
```

EF Core avoids tracking multiple instances with the same key because it would not know which instance represents the correct state.

Better approach:

```csharp
var customer = await dbContext.Customers
    .SingleAsync(c => c.Id == request.Id, cancellationToken);

customer.Name = request.Name;
customer.Email = request.Email;

await dbContext.SaveChangesAsync(cancellationToken);
```

Identity resolution is one reason short-lived contexts are important. A long-lived context increases the chance that stale or duplicate entity instances remain tracked.

### Add

`Add` tells EF Core that an entity is new and should be inserted.

```csharp
var customer = new Customer
{
    Name = "Alice",
    Email = "alice@example.com"
};

dbContext.Customers.Add(customer);

await dbContext.SaveChangesAsync(cancellationToken);
```

The entity state becomes `Added`. On save, EF Core generates an `INSERT`.

Important behavior:

- `Add` can affect an entire object graph.
- Entities with generated keys may receive temporary key values before save.
- After save, generated database keys are populated back into the entity.
- After successful save, the entity usually becomes `Unchanged`.

### Attach

`Attach` starts tracking an existing entity without marking it as modified.

```csharp
var customer = new Customer
{
    Id = 10
};

dbContext.Customers.Attach(customer);

Console.WriteLine(dbContext.Entry(customer).State); // Unchanged
```

`Attach` is useful when:

- You know the entity already exists.
- You do not want to update every column.
- You want to set a relationship using a known key.
- You want to mark specific properties as modified manually.

Example: update one property without loading the full row:

```csharp
var customer = new Customer
{
    Id = request.Id
};

dbContext.Customers.Attach(customer);

customer.Email = request.Email;

dbContext.Entry(customer)
    .Property(c => c.Email)
    .IsModified = true;

await dbContext.SaveChangesAsync(cancellationToken);
```

This can be efficient, but it must be used carefully because:

- You bypass database validation that a prior query might have provided.
- You may not have original values for concurrency checks unless configured separately.
- You must explicitly mark what changed.
- Incorrect use can cause missing updates.

### Update

`Update` starts tracking an entity as `Modified`.

```csharp
var customer = new Customer
{
    Id = request.Id,
    Name = request.Name,
    Email = request.Email
};

dbContext.Customers.Update(customer);

await dbContext.SaveChangesAsync(cancellationToken);
```

This is simple, but it can be dangerous with disconnected API models.

`Update` usually marks the entire entity graph as modified. That can result in updating more columns than intended.

Risky pattern:

```csharp
[HttpPut("{id:int}")]
public async Task<IActionResult> UpdateCustomer(int id, Customer customer)
{
    if (id != customer.Id)
    {
        return BadRequest();
    }

    _dbContext.Customers.Update(customer);
    await _dbContext.SaveChangesAsync();

    return NoContent();
}
```

Problems:

- The API accepts an entity directly instead of a DTO.
- The client might omit properties.
- Omitted properties may overwrite database values.
- More columns may be updated than necessary.
- Related entities in the graph may also be marked modified.
- It can bypass business rules.

Safer pattern:

```csharp
[HttpPut("{id:int}")]
public async Task<IActionResult> UpdateCustomer(int id, UpdateCustomerRequest request, CancellationToken cancellationToken)
{
    var customer = await _dbContext.Customers
        .SingleOrDefaultAsync(c => c.Id == id, cancellationToken);

    if (customer is null)
    {
        return NotFound();
    }

    customer.Name = request.Name;
    customer.Email = request.Email;

    await _dbContext.SaveChangesAsync(cancellationToken);

    return NoContent();
}
```

This pattern allows EF Core to track only actual changes and keeps update logic explicit.

### Remove

`Remove` marks an entity as `Deleted`.

```csharp
var customer = await dbContext.Customers
    .SingleAsync(c => c.Id == customerId, cancellationToken);

dbContext.Customers.Remove(customer);

await dbContext.SaveChangesAsync(cancellationToken);
```

If the entity is not tracked, `Remove` first attaches it and then marks it as deleted:

```csharp
var customer = new Customer { Id = customerId };

dbContext.Customers.Remove(customer);

await dbContext.SaveChangesAsync(cancellationToken);
```

This can be useful for deleting by key without loading the entity, but it should be used carefully when business rules require checking the current database state.

### Attach vs Update

`Attach` and `Update` are common interview comparison points.

| API | Initial state | Typical purpose |
|---|---|---|
| `Attach` | `Unchanged` | Track an existing entity without updating it yet |
| `Update` | `Modified` | Mark an existing disconnected entity as changed |
| `Add` | `Added` | Insert a new entity |
| `Remove` | `Deleted` | Delete an entity |

Example:

```csharp
var customer = new Customer { Id = 1, Name = "Alice" };

dbContext.Attach(customer);
// State: Unchanged

dbContext.Update(customer);
// State: Modified
```

Use `Attach` when you want more control. Use `Update` only when you are comfortable treating the supplied entity or graph as the full updated state.

### Graph Tracking Behavior

`Add`, `Attach`, and `Update` can apply to an entire graph of related entities.

Example:

```csharp
var order = new Order
{
    Id = 10,
    CustomerId = 1,
    Lines =
    {
        new OrderLine { Id = 100, ProductId = 5, Quantity = 2 },
        new OrderLine { ProductId = 6, Quantity = 1 }
    }
};

dbContext.Orders.Update(order);
```

Depending on key values and configuration, EF Core may treat some related entities as existing and others as new. With generated keys, an unset key value often indicates a new entity.

This is useful, but it can be risky for API update endpoints. A client-provided graph might unintentionally insert, update, or delete related records.

For complex aggregate updates, a safer approach is often:

1. Load the aggregate from the database.
2. Apply the command or DTO intentionally.
3. Add, update, or remove child entities according to business rules.
4. Call `SaveChangesAsync`.

### Generated Keys and Temporary Keys

For entities with generated keys, EF Core may assign temporary key values before the database generates the real values.

Example:

```csharp
var customer = new Customer
{
    Name = "Alice"
};

dbContext.Customers.Add(customer);

Console.WriteLine(customer.Id); // May be temporary internally before save

await dbContext.SaveChangesAsync(cancellationToken);

Console.WriteLine(customer.Id); // Real database-generated ID
```

In disconnected graph scenarios, generated keys help EF Core distinguish new entities from existing entities. If a generated key has its default value, EF Core can infer that the entity is new.

### Property-Level Updates

EF Core can update only selected properties when it knows exactly what changed.

Tracked entity pattern:

```csharp
var customer = await dbContext.Customers
    .SingleAsync(c => c.Id == request.Id, cancellationToken);

customer.Name = request.Name;

await dbContext.SaveChangesAsync(cancellationToken);
```

Only changed properties are marked modified.

Manual property update pattern:

```csharp
var customer = new Customer { Id = request.Id };

dbContext.Attach(customer);

customer.Name = request.Name;

dbContext.Entry(customer)
    .Property(c => c.Name)
    .IsModified = true;

await dbContext.SaveChangesAsync(cancellationToken);
```

This avoids a preliminary query but requires careful handling of validation, authorization, concurrency, and missing data.

### CurrentValues and OriginalValues

Each tracked entity has an `EntityEntry` that exposes current and original values.

Example:

```csharp
var entry = dbContext.Entry(customer);

var currentName = entry.CurrentValues[nameof(Customer.Name)];
var originalName = entry.OriginalValues[nameof(Customer.Name)];
```

A useful DTO update pattern is `SetValues`:

```csharp
var customer = await dbContext.Customers
    .SingleAsync(c => c.Id == request.Id, cancellationToken);

dbContext.Entry(customer).CurrentValues.SetValues(request);

await dbContext.SaveChangesAsync(cancellationToken);
```

This works best when the DTO property names match entity property names. However, many teams prefer explicit assignment to avoid accidental updates to fields that should not be client-controlled.

### Debugging Change Tracker State

`ChangeTracker.DebugView` can help explain what EF Core will save.

```csharp
dbContext.ChangeTracker.DetectChanges();

Console.WriteLine(dbContext.ChangeTracker.DebugView.LongView);
```

This is useful when debugging:

- Why an update did not happen.
- Why an unexpected insert happened.
- Why too many columns are updated.
- Why an entity is still `Unchanged`.
- Why a duplicate tracking exception occurs.
- Which properties are marked as modified.

You can also inspect entries:

```csharp
var entries = dbContext.ChangeTracker.Entries()
    .Select(e => new
    {
        Entity = e.Entity.GetType().Name,
        State = e.State
    })
    .ToList();
```

### Tracking vs No-Tracking Performance

Tracking has overhead because EF Core must store snapshots and manage entity state.

Use tracking when:

- You intend to modify entities.
- You need EF Core to detect changes.
- You need identity resolution inside the context.
- You are working in a command/update flow.

Use no-tracking when:

- The result is read-only.
- The result is projected to a DTO.
- The query is used for reports or search.
- The result set is large and does not need to be updated.

Example projection:

```csharp
var customers = await dbContext.Customers
    .AsNoTracking()
    .Select(c => new CustomerListItemDto
    {
        Id = c.Id,
        Name = c.Name,
        Email = c.Email
    })
    .ToListAsync(cancellationToken);
```

For many read APIs, projection plus `AsNoTracking` is a good default.

### Disconnected Entities in Web APIs

Web APIs commonly receive DTOs from clients. These DTOs are disconnected from the `DbContext`.

Example request:

```csharp
public sealed record UpdateProductRequest(
    string Name,
    decimal Price);
```

Recommended update flow:

```csharp
public async Task UpdateProductAsync(
    int productId,
    UpdateProductRequest request,
    CancellationToken cancellationToken)
{
    var product = await dbContext.Products
        .SingleOrDefaultAsync(p => p.Id == productId, cancellationToken);

    if (product is null)
    {
        throw new KeyNotFoundException("Product was not found.");
    }

    product.Name = request.Name;
    product.Price = request.Price;

    await dbContext.SaveChangesAsync(cancellationToken);
}
```

This approach is clear, safe, and easy to validate.

Alternative disconnected update:

```csharp
var product = new Product
{
    Id = productId,
    Name = request.Name,
    Price = request.Price
};

dbContext.Products.Update(product);

await dbContext.SaveChangesAsync(cancellationToken);
```

This is shorter but less precise. It can be acceptable for internal tools or simple full-replacement commands, but it is risky for public APIs where partial data, authorization, and overposting matter.

### Overposting Risk

Overposting happens when a client can update fields that should not be client-controlled.

Risky entity binding:

```csharp
public sealed class User
{
    public int Id { get; set; }
    public string DisplayName { get; set; } = "";
    public bool IsAdmin { get; set; }
}

[HttpPut("{id:int}")]
public async Task<IActionResult> UpdateUser(int id, User user)
{
    _dbContext.Users.Update(user);
    await _dbContext.SaveChangesAsync();
    return NoContent();
}
```

A malicious client could set `IsAdmin = true`.

Safer DTO:

```csharp
public sealed record UpdateUserRequest(string DisplayName);

[HttpPut("{id:int}")]
public async Task<IActionResult> UpdateUser(
    int id,
    UpdateUserRequest request,
    CancellationToken cancellationToken)
{
    var user = await _dbContext.Users
        .SingleOrDefaultAsync(u => u.Id == id, cancellationToken);

    if (user is null)
    {
        return NotFound();
    }

    user.DisplayName = request.DisplayName;

    await _dbContext.SaveChangesAsync(cancellationToken);

    return NoContent();
}
```

DTOs define the request contract and prevent accidental persistence of fields that should not be writable.

### Change Tracker and Relationships

EF Core also tracks relationship changes.

Example:

```csharp
var order = await dbContext.Orders
    .Include(o => o.Lines)
    .SingleAsync(o => o.Id == orderId, cancellationToken);

order.Lines.Add(new OrderLine
{
    ProductId = productId,
    Quantity = 2
});

await dbContext.SaveChangesAsync(cancellationToken);
```

EF Core detects the new child entity and inserts it.

Changing a reference can also update a foreign key:

```csharp
order.CustomerId = newCustomerId;

await dbContext.SaveChangesAsync(cancellationToken);
```

Relationship fix-up means EF Core can synchronize foreign key values and navigation properties for tracked entities. This is helpful, but it can be confusing when many entities are tracked in a long-lived context.

### SaveChanges Behavior

`SaveChanges` and `SaveChangesAsync` are the point where tracked changes are converted into database commands.

Conceptually, EF Core does the following:

1. Detect changes.
2. Determine entity states and modified properties.
3. Generate insert, update, and delete commands.
4. Execute commands.
5. Accept changes if save succeeds.
6. Mark saved entities as `Unchanged`.

Example:

```csharp
dbContext.Customers.Add(new Customer { Name = "Alice" });

var existing = await dbContext.Products
    .SingleAsync(p => p.Id == 5, cancellationToken);

existing.Price = 100m;

await dbContext.SaveChangesAsync(cancellationToken);
```

The same `SaveChangesAsync` call can insert the new customer and update the product.

### DbContext Is Not Thread-Safe

A single `DbContext` instance should not be used concurrently from multiple threads.

Bad pattern:

```csharp
await Task.WhenAll(
    ProcessCustomerAsync(dbContext, 1),
    ProcessCustomerAsync(dbContext, 2));
```

Better pattern:

```csharp
await Task.WhenAll(
    ProcessCustomerWithNewContextAsync(1),
    ProcessCustomerWithNewContextAsync(2));
```

For background jobs or parallel operations, use separate scopes or an `IDbContextFactory<TContext>`.

Example:

```csharp
public sealed class ProductWorker
{
    private readonly IDbContextFactory<AppDbContext> _contextFactory;

    public ProductWorker(IDbContextFactory<AppDbContext> contextFactory)
    {
        _contextFactory = contextFactory;
    }

    public async Task ProcessAsync(int productId, CancellationToken cancellationToken)
    {
        await using var dbContext = await _contextFactory.CreateDbContextAsync(cancellationToken);

        var product = await dbContext.Products
            .SingleAsync(p => p.Id == productId, cancellationToken);

        product.LastProcessedUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
```

### Common Mistakes

Common mistakes include:

- Using a singleton `DbContext`.
- Sharing one `DbContext` across parallel tasks.
- Calling `Update` on a client-provided entity without checking overposting risk.
- Mixing a tracked entity and a detached entity with the same key.
- Using `AsNoTracking` and expecting automatic updates.
- Attaching an entity already tracked by the same context.
- Forgetting that `Update` can mark an entire graph as modified.
- Disabling `AutoDetectChangesEnabled` and forgetting to re-enable it.
- Keeping a context alive too long and seeing stale data.
- Exposing EF Core entities directly as API request models.
- Calling `SaveChanges` inside every repository method instead of coordinating one unit of work.
- Not passing `CancellationToken` to async EF Core operations.
- Ignoring concurrency control when updating disconnected entities.

### Best Practices

Good EF Core tracking habits:

- Use short-lived `DbContext` instances.
- Let dependency injection manage scoped contexts in typical ASP.NET Core requests.
- Use tracking queries for command/update flows.
- Use `AsNoTracking` and DTO projections for read-only queries.
- Prefer DTOs over binding API requests directly to EF Core entities.
- Prefer query-then-update for business-critical updates.
- Use `Attach` plus property-level `IsModified` only when you intentionally want a partial update without loading.
- Use `Update` carefully for full replacement scenarios.
- Inspect `ChangeTracker.DebugView.LongView` when behavior is confusing.
- Avoid parallel operations on the same context.
- Keep transaction boundaries and `SaveChanges` boundaries clear.
- Understand graph behavior before using `Add`, `Attach`, or `Update` on aggregate roots.
- Use concurrency tokens when multiple users or processes may update the same row.
- Keep persistence logic explicit enough that future maintainers can see what is being changed.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

<!-- question:start:dbcontext-change-tracking-beginner-q01 -->
<!-- question-id:dbcontext-change-tracking-beginner-q01 -->
<!-- question-level:beginner -->
#### 1. What is `DbContext` in EF Core?

##### Expected Answer

`DbContext` is the main EF Core class used to interact with the database. It represents a short-lived unit of work. It manages queries, tracks entity instances, detects changes, and saves changes back to the database.

In a typical ASP.NET Core application, a `DbContext` is registered as a scoped service, so one context instance is used during one HTTP request. During that request, the application can query entities, modify them, add new entities, delete entities, and then call `SaveChangesAsync`.

A `DbContext` should not be treated as a singleton or shared across threads. It is designed to be short-lived and disposed after the unit of work completes.

##### Key Points to Mention

- Main EF Core object for database access.
- Represents a unit of work.
- Tracks entities and coordinates `SaveChanges`.
- Usually scoped per request in ASP.NET Core.
- Not thread-safe.
- Should be short-lived.

<!-- question:end:dbcontext-change-tracking-beginner-q01 -->

<!-- question:start:dbcontext-change-tracking-beginner-q02 -->
<!-- question-id:dbcontext-change-tracking-beginner-q02 -->
<!-- question-level:beginner -->
#### 2. What is a `DbSet`?

##### Expected Answer

A `DbSet<TEntity>` represents a set of entities of a specific type. It is commonly used as the query root for an entity, such as `dbContext.Customers`. It also provides methods to add, attach, update, and remove entities.

A `DbSet` does not mean all rows are loaded into memory. It represents a queryable source. The database is queried only when the LINQ query is executed.

Example:

```csharp
var customers = await dbContext.Customers
    .Where(c => c.IsActive)
    .ToListAsync(cancellationToken);
```

##### Key Points to Mention

- Represents a set of entities.
- Used for querying and persistence operations.
- Usually maps to a database table-like source.
- Queries are executed when enumerated or materialized.
- Provides methods like `Add`, `Attach`, `Update`, and `Remove`.

<!-- question:end:dbcontext-change-tracking-beginner-q02 -->

<!-- question:start:dbcontext-change-tracking-beginner-q03 -->
<!-- question-id:dbcontext-change-tracking-beginner-q03 -->
<!-- question-level:beginner -->
#### 3. What are the main EF Core entity states?

##### Expected Answer

The main EF Core entity states are:

- `Detached`: the entity is not tracked by the current context.
- `Added`: the entity is new and will be inserted.
- `Unchanged`: the entity is tracked and has no detected changes.
- `Modified`: the entity is tracked and has one or more modified properties.
- `Deleted`: the entity is tracked and will be deleted.

These states determine what `SaveChanges` does. For example, `Added` creates an `INSERT`, `Modified` creates an `UPDATE`, and `Deleted` creates a `DELETE`.

##### Key Points to Mention

- Entity state determines persistence behavior.
- `Added` inserts.
- `Modified` updates.
- `Deleted` deletes.
- `Unchanged` does nothing.
- `Detached` is not tracked.

<!-- question:end:dbcontext-change-tracking-beginner-q03 -->

<!-- question:start:dbcontext-change-tracking-beginner-q04 -->
<!-- question-id:dbcontext-change-tracking-beginner-q04 -->
<!-- question-level:beginner -->
#### 4. What is the Change Tracker?

##### Expected Answer

The Change Tracker is the EF Core component that tracks entity instances loaded or attached to a `DbContext`. It stores entity state, original values, current values, modified properties, temporary keys, and relationship information.

When `SaveChanges` is called, EF Core uses the Change Tracker to decide which SQL commands to generate.

For example, if a tracked customer's `Name` property changes, the Change Tracker can detect that change and EF Core can generate an update for that property.

##### Key Points to Mention

- Tracks entity instances.
- Stores state and value information.
- Drives `SaveChanges`.
- Supports property-level change detection.
- Can be inspected through `ChangeTracker.Entries()`.
- Useful for debugging and auditing.

<!-- question:end:dbcontext-change-tracking-beginner-q04 -->

<!-- question:start:dbcontext-change-tracking-beginner-q05 -->
<!-- question-id:dbcontext-change-tracking-beginner-q05 -->
<!-- question-level:beginner -->
#### 5. What happens when you call `SaveChanges`?

##### Expected Answer

When `SaveChanges` or `SaveChangesAsync` is called, EF Core detects changes in tracked entities, determines what insert, update, or delete commands are needed, sends those commands to the database, and then updates the tracked entity states.

After a successful save, entities are usually marked as `Unchanged` because their current values now match the database.

Example:

```csharp
var customer = await dbContext.Customers.FindAsync([id], cancellationToken);

customer!.Name = "Updated Name";

await dbContext.SaveChangesAsync(cancellationToken);
```

EF Core detects the changed name and sends an update.

##### Key Points to Mention

- Detects changes.
- Generates insert/update/delete commands.
- Executes database commands.
- Updates generated keys when needed.
- Marks saved entities as `Unchanged`.
- Should usually be called once per unit of work.

<!-- question:end:dbcontext-change-tracking-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

<!-- question:start:dbcontext-change-tracking-intermediate-q01 -->
<!-- question-id:dbcontext-change-tracking-intermediate-q01 -->
<!-- question-level:intermediate -->
#### 6. What is the difference between `Add`, `Attach`, and `Update`?

##### Expected Answer

`Add`, `Attach`, and `Update` all start tracking entities, but they assign different states.

`Add` marks an entity as `Added`, meaning it will be inserted.

`Attach` marks an existing entity as `Unchanged`, meaning EF Core starts tracking it but does not update it unless properties are later marked as modified.

`Update` marks an entity as `Modified`, meaning EF Core treats it as changed and will send an update on `SaveChanges`.

The important interview detail is that these methods can apply to an entire object graph, not just one entity. Calling `Update` on a disconnected graph can mark many entities as modified.

##### Key Points to Mention

- `Add` means insert.
- `Attach` means track as existing and unchanged.
- `Update` means track as modified.
- All can affect an entity graph.
- `Update` can update more columns than expected.
- `Attach` gives more precise control when combined with `IsModified`.

<!-- question:end:dbcontext-change-tracking-intermediate-q01 -->

<!-- question:start:dbcontext-change-tracking-intermediate-q02 -->
<!-- question-id:dbcontext-change-tracking-intermediate-q02 -->
<!-- question-level:intermediate -->
#### 7. When should you use `AsNoTracking`?

##### Expected Answer

Use `AsNoTracking` for read-only queries where you do not plan to modify and save the returned entities. It avoids change-tracking overhead and can improve performance for queries like reports, search results, dropdown lists, and API response DTO projections.

Example:

```csharp
var result = await dbContext.Customers
    .AsNoTracking()
    .Select(c => new CustomerDto(c.Id, c.Name))
    .ToListAsync(cancellationToken);
```

Do not use `AsNoTracking` if you plan to modify the returned entity and expect `SaveChanges` to persist it automatically. Since the entity is not tracked, EF Core will not detect changes unless you attach or update it explicitly.

##### Key Points to Mention

- Good for read-only queries.
- Reduces tracking overhead.
- Common with DTO projection.
- Not suitable for automatic updates.
- Detached result must be attached or queried again before updating.

<!-- question:end:dbcontext-change-tracking-intermediate-q02 -->

<!-- question:start:dbcontext-change-tracking-intermediate-q03 -->
<!-- question-id:dbcontext-change-tracking-intermediate-q03 -->
<!-- question-level:intermediate -->
#### 8. Why can calling `Update` on a DTO or client-provided entity be dangerous?

##### Expected Answer

Calling `Update` on a client-provided entity can be dangerous because EF Core may mark the whole entity or graph as modified. This can update columns that the client did not intend to change. It can also create overposting vulnerabilities where the client sends values for fields they should not control.

For example, if a `User` entity has an `IsAdmin` property and the API binds directly to the entity, a malicious client might set `IsAdmin` to `true`.

A safer pattern is to use a DTO, load the existing entity from the database, validate authorization and business rules, then assign allowed properties explicitly.

##### Key Points to Mention

- `Update` can mark all properties as modified.
- Client data may be incomplete.
- Omitted fields can overwrite database values.
- Can cause overposting/security issues.
- DTOs define safe request contracts.
- Query-then-update is safer for business-critical updates.

<!-- question:end:dbcontext-change-tracking-intermediate-q03 -->

<!-- question:start:dbcontext-change-tracking-intermediate-q04 -->
<!-- question-id:dbcontext-change-tracking-intermediate-q04 -->
<!-- question-level:intermediate -->
#### 9. How can you update a single property without loading the full entity?

##### Expected Answer

You can create a stub entity with the key, attach it, set the property, and mark only that property as modified.

Example:

```csharp
var customer = new Customer
{
    Id = customerId
};

dbContext.Customers.Attach(customer);

customer.Email = newEmail;

dbContext.Entry(customer)
    .Property(c => c.Email)
    .IsModified = true;

await dbContext.SaveChangesAsync(cancellationToken);
```

This can be efficient because it avoids a select query. However, it should be used carefully because it bypasses checks that require the current database state. It may also need extra handling for concurrency, validation, and authorization.

##### Key Points to Mention

- Use a stub entity with the key.
- Call `Attach`.
- Set the property.
- Mark the property as modified.
- Efficient but less safe than query-then-update.
- Be careful with validation and concurrency.

<!-- question:end:dbcontext-change-tracking-intermediate-q04 -->

<!-- question:start:dbcontext-change-tracking-intermediate-q05 -->
<!-- question-id:dbcontext-change-tracking-intermediate-q05 -->
<!-- question-level:intermediate -->
#### 10. What is `DetectChanges` and when is it called?

##### Expected Answer

`DetectChanges` is the process EF Core uses to compare current entity values with original snapshots and determine which entities and properties changed.

EF Core calls `DetectChanges` automatically in common situations, including `SaveChanges`, `SaveChangesAsync`, `ChangeTracker.Entries`, and `ChangeTracker.HasChanges`.

You can call it manually when debugging or when automatic change detection is disabled. In high-volume batch operations, some developers temporarily disable `AutoDetectChangesEnabled` for performance and then call `DetectChanges` before saving.

##### Key Points to Mention

- Compares current values with original snapshots.
- Determines modified state and properties.
- Automatically called by `SaveChanges`.
- Can be called manually.
- Useful for debugging.
- Disabling auto-detection requires caution.

<!-- question:end:dbcontext-change-tracking-intermediate-q05 -->

<!-- question:start:dbcontext-change-tracking-intermediate-q06 -->
<!-- question-id:dbcontext-change-tracking-intermediate-q06 -->
<!-- question-level:intermediate -->
#### 11. What causes the error that another instance with the same key is already being tracked?

##### Expected Answer

This error occurs when the same `DbContext` is already tracking one entity instance with a particular primary key, and the code tries to attach or update another instance with the same key.

EF Core allows only one tracked instance per key because it needs a single source of truth for that entity's state and values.

Common causes include:

- Querying an entity, then calling `Update` with a detached copy of the same entity.
- Mapping a DTO to a new entity instance while the original is already tracked.
- Reusing a long-lived `DbContext`.
- Mixing tracked and disconnected update patterns.

A common fix is to use the tracked entity and apply DTO values to it instead of attaching a second instance.

##### Key Points to Mention

- One tracked instance per primary key per context.
- Caused by duplicate entity instances.
- Common in disconnected API updates.
- Avoid mixing query-then-update with `Update(detachedEntity)`.
- Short-lived contexts reduce this risk.
- Apply DTO values to the tracked entity.

<!-- question:end:dbcontext-change-tracking-intermediate-q06 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

<!-- question:start:dbcontext-change-tracking-advanced-q01 -->
<!-- question-id:dbcontext-change-tracking-advanced-q01 -->
<!-- question-level:advanced -->
#### 12. How would you design a safe update endpoint using EF Core?

##### Expected Answer

A safe update endpoint should use a request DTO rather than binding directly to an EF Core entity. It should load the existing entity, validate that it exists, check authorization and business rules, apply only allowed changes, and then call `SaveChangesAsync`.

Example:

```csharp
public sealed record UpdateCustomerRequest(
    string Name,
    string Email);

[HttpPut("{id:int}")]
public async Task<IActionResult> UpdateCustomer(
    int id,
    UpdateCustomerRequest request,
    CancellationToken cancellationToken)
{
    var customer = await _dbContext.Customers
        .SingleOrDefaultAsync(c => c.Id == id, cancellationToken);

    if (customer is null)
    {
        return NotFound();
    }

    customer.Name = request.Name;
    customer.Email = request.Email;

    await _dbContext.SaveChangesAsync(cancellationToken);

    return NoContent();
}
```

This avoids overposting, avoids duplicate tracking, supports property-level updates, and makes business rules explicit.

##### Key Points to Mention

- Use DTOs, not EF entities, as API request contracts.
- Load the existing entity when business rules matter.
- Apply allowed changes explicitly.
- Avoid direct `Update` on client-provided entities.
- Call `SaveChangesAsync` once for the unit of work.
- Include validation, authorization, and cancellation.

<!-- question:end:dbcontext-change-tracking-advanced-q01 -->

<!-- question:start:dbcontext-change-tracking-advanced-q02 -->
<!-- question-id:dbcontext-change-tracking-advanced-q02 -->
<!-- question-level:advanced -->
#### 13. How does EF Core handle graph updates with `Add`, `Attach`, and `Update`?

##### Expected Answer

EF Core can apply `Add`, `Attach`, or `Update` to an entire graph of related entities. For example, calling `Update` on an aggregate root can cause related child entities to be marked as `Modified` as well.

With generated keys, EF Core can often infer that entities with default key values are new and should be inserted. Existing entities with key values may be marked as unchanged or modified depending on the operation.

This behavior is powerful but risky with client-provided graphs. A client graph may accidentally update related entities, insert new child rows, or overwrite relationship data. For complex aggregates, it is usually safer to load the existing aggregate and apply changes intentionally.

##### Key Points to Mention

- Operations can apply to entire graphs.
- Generated keys help EF infer new entities.
- Default key values often indicate new entities.
- `Update` can mark a full graph as modified.
- Client-provided graphs can cause unintended changes.
- Safer aggregate updates usually load then apply changes.

<!-- question:end:dbcontext-change-tracking-advanced-q02 -->

<!-- question:start:dbcontext-change-tracking-advanced-q03 -->
<!-- question-id:dbcontext-change-tracking-advanced-q03 -->
<!-- question-level:advanced -->
#### 14. How would you use the Change Tracker for auditing?

##### Expected Answer

You can inspect `ChangeTracker.Entries()` before saving to find added, modified, and deleted entities. This can be used to populate audit columns such as `CreatedAtUtc`, `UpdatedAtUtc`, `CreatedBy`, and `UpdatedBy`, or to create audit log records.

Example:

```csharp
public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
{
    var now = DateTime.UtcNow;

    foreach (var entry in ChangeTracker.Entries<IAuditable>())
    {
        if (entry.State == EntityState.Added)
        {
            entry.Entity.CreatedAtUtc = now;
            entry.Entity.UpdatedAtUtc = now;
        }

        if (entry.State == EntityState.Modified)
        {
            entry.Entity.UpdatedAtUtc = now;
        }
    }

    return base.SaveChangesAsync(cancellationToken);
}
```

The key is to inspect entries before calling the base `SaveChangesAsync`. For complex auditing, especially if changes can be made outside the application, database-level auditing may also be needed.

##### Key Points to Mention

- Inspect `ChangeTracker.Entries()`.
- Filter by entity type or interface.
- Use entity state to decide audit behavior.
- Apply audit values before base `SaveChanges`.
- Useful for created/updated timestamps.
- Application-level auditing only sees changes made through the app.

<!-- question:end:dbcontext-change-tracking-advanced-q03 -->

<!-- question:start:dbcontext-change-tracking-advanced-q04 -->
<!-- question-id:dbcontext-change-tracking-advanced-q04 -->
<!-- question-level:advanced -->
#### 15. How does `DbContext` lifetime affect tracking behavior and bugs?

##### Expected Answer

`DbContext` lifetime has a major effect on tracking behavior. A short-lived context keeps tracking state limited to one unit of work. This reduces memory usage, stale data, and duplicate tracking conflicts.

A long-lived context can accumulate many tracked entities. It may return already-tracked instances instead of reflecting fresh database values. It can also throw duplicate tracking errors if the application tries to attach a different instance with the same key. In addition, a long-lived context can become difficult to reason about because unrelated operations share tracking state.

In ASP.NET Core, scoped per request is a good default. For background jobs, parallel processing, or Blazor-style scenarios, use appropriate scopes or `IDbContextFactory<TContext>` to create contexts per unit of work.

##### Key Points to Mention

- Short-lived context is the normal pattern.
- Long-lived context can accumulate stale tracked state.
- Duplicate key tracking conflicts become more likely.
- `DbContext` is not thread-safe.
- Scoped per request is common in ASP.NET Core.
- Use factories or scopes for background and parallel work.

<!-- question:end:dbcontext-change-tracking-advanced-q04 -->

<!-- question:start:dbcontext-change-tracking-advanced-q05 -->
<!-- question-id:dbcontext-change-tracking-advanced-q05 -->
<!-- question-level:advanced -->
#### 16. How would you optimize a large import that adds many entities?

##### Expected Answer

For large imports, performance can be affected by change detection, tracking overhead, and save batch size. One approach is to add records in batches, call `SaveChangesAsync` per batch, and clear the tracker after each batch. In some cases, temporarily disabling automatic change detection can help, but it must be restored and used carefully.

Example:

```csharp
const int batchSize = 500;

dbContext.ChangeTracker.AutoDetectChangesEnabled = false;

try
{
    foreach (var batch in importedProducts.Chunk(batchSize))
    {
        dbContext.Products.AddRange(batch);

        dbContext.ChangeTracker.DetectChanges();
        await dbContext.SaveChangesAsync(cancellationToken);

        dbContext.ChangeTracker.Clear();
    }
}
finally
{
    dbContext.ChangeTracker.AutoDetectChangesEnabled = true;
}
```

For very large imports, provider-specific bulk insert tools may be more appropriate than regular EF Core tracking. The best approach depends on data volume, validation requirements, relationship complexity, and whether domain logic must run.

##### Key Points to Mention

- Tracking many entities has overhead.
- Use batching.
- Consider `AutoDetectChangesEnabled = false` carefully.
- Re-enable change detection in `finally`.
- Clear tracker between batches if appropriate.
- For very large imports, consider bulk APIs or provider-specific tools.

<!-- question:end:dbcontext-change-tracking-advanced-q05 -->

<!-- question:start:dbcontext-change-tracking-advanced-q06 -->
<!-- question-id:dbcontext-change-tracking-advanced-q06 -->
<!-- question-level:advanced -->
#### 17. How does EF Core change tracking interact with concurrency control?

##### Expected Answer

EF Core change tracking stores original values for tracked entities. Concurrency tokens use original values to detect whether another process changed the row since it was loaded.

For example, with a row version column, EF Core includes the original row version in the update condition. If no row is updated, EF Core can throw a concurrency exception.

This works naturally with query-then-update because EF Core has original values. With disconnected updates using `Attach` or `Update`, the application may need to provide or set the original concurrency token value explicitly.

##### Key Points to Mention

- Original values matter for concurrency checks.
- Query-then-update naturally has original values.
- Concurrency tokens are included in update/delete conditions.
- No affected row can indicate a concurrency conflict.
- Disconnected updates need careful original value handling.
- Concurrency handling should be part of update design.

<!-- question:end:dbcontext-change-tracking-advanced-q06 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
