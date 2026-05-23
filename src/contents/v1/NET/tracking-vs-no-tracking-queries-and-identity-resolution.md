---
id: tracking-vs-no-tracking-queries-and-identity-resolution
topic: Entity Framework
subtopic: Tracking vs no-tracking queries and identity resolution
category: .NET
---


## Overview

Tracking vs no-tracking queries are a core Entity Framework Core concept. They determine whether EF Core stores returned entity instances in the `DbContext` Change Tracker and whether those instances can later be automatically persisted with `SaveChanges` or `SaveChangesAsync`.

A tracking query is the default behavior for queries that return entity types with keys. EF Core keeps information about the returned entities, their original values, current values, relationships, and entity states. If the application modifies a tracked entity, EF Core can detect the change and generate the correct `UPDATE`, `INSERT`, or `DELETE` commands when saving.

A no-tracking query tells EF Core not to keep the returned entities in the Change Tracker. This is commonly used for read-only screens, API GET endpoints, reports, search results, dropdown lists, exports, and projections where the application does not intend to update the returned entities in the same `DbContext` unit of work.

Identity resolution means EF Core ensures that one database row with a given primary key is represented by one object instance within a tracking context. For example, if the same `Customer` appears multiple times in a query result because several `Order` rows reference it, identity resolution can make those references point to the same `Customer` object instance instead of creating duplicates.

This topic matters because tracking behavior affects correctness, performance, memory usage, update behavior, relationship fix-up, and API design. Misunderstanding it can cause common production bugs such as:

- Accidentally changing data from what was intended to be a read-only query.
- Loading too many tracked entities and increasing memory usage.
- Returning duplicate object instances in no-tracking graph queries.
- Getting stale data from a long-lived `DbContext`.
- Attaching no-tracking entities incorrectly and causing duplicate key tracking errors.
- Assuming DTO projections are tracked when they are not.
- Assuming all projections are no-tracking when they still contain entity instances.

It is important for interviews because it tests whether a developer understands how EF Core behaves beyond basic LINQ syntax. A strong candidate should know when to use tracking, when to use `AsNoTracking`, when `AsNoTrackingWithIdentityResolution` is useful, how `DbContext` identity resolution works, and how these choices affect real API and service-layer code.

Typical real-world use cases include:

- Using tracking queries for command/update workflows.
- Using no-tracking queries for read-only API responses.
- Projecting database data directly into DTOs.
- Avoiding unnecessary Change Tracker overhead in large reads.
- Loading complex object graphs without duplicated entity instances.
- Configuring default query tracking behavior for read-heavy applications.
- Debugging why an entity update was or was not saved.
- Debugging duplicate instance errors in disconnected entity workflows.

## Core Concepts

### Change Tracking

Change tracking is EF Core's mechanism for remembering entity instances and detecting how they changed during a unit of work.

When an entity is tracked, EF Core records information such as:

- The entity type.
- The primary key value.
- The entity state, such as `Unchanged`, `Modified`, `Added`, `Deleted`, or `Detached`.
- Original property values.
- Current property values.
- Relationship information.
- Navigation property fix-up information.

Example of a tracking query:

```csharp
var customer = await dbContext.Customers
    .SingleAsync(c => c.Id == customerId, cancellationToken);

customer.Name = "Updated Name";

await dbContext.SaveChangesAsync(cancellationToken);
```

In this example, `customer` is tracked because EF Core tracks entity queries by default. The property change is detected and persisted when `SaveChangesAsync` is called.

The important point is that tracking is useful when the application intends to modify the entity within the same `DbContext` unit of work.

### Tracking Queries

A tracking query returns entities and stores them in the current `DbContext` Change Tracker.

Example:

```csharp
var orders = await dbContext.Orders
    .Where(o => o.CustomerId == customerId)
    .ToListAsync(cancellationToken);
```

If `Order` is a normal entity type with a key, the returned orders are tracked by default.

Tracking queries are useful when:

- The application needs to update the returned entities.
- The application needs relationship fix-up between loaded entities.
- The same entity may already be tracked and should be reused.
- The unit of work is command-oriented rather than read-only.
- EF Core should generate updates only for changed properties.

Example of a command workflow:

```csharp
public async Task RenameCustomerAsync(
    int customerId,
    string newName,
    CancellationToken cancellationToken)
{
    var customer = await dbContext.Customers
        .SingleAsync(c => c.Id == customerId, cancellationToken);

    customer.Name = newName;

    await dbContext.SaveChangesAsync(cancellationToken);
}
```

This is a good use of tracking because EF Core can compare original and current values and save only the relevant changes.

### No-Tracking Queries

A no-tracking query returns entities without storing them in the current `DbContext` Change Tracker.

Example:

```csharp
var customers = await dbContext.Customers
    .AsNoTracking()
    .Where(c => c.IsActive)
    .ToListAsync(cancellationToken);
```

No-tracking queries are useful when:

- The result is read-only.
- The data will be serialized to an API response.
- The application projects data into DTOs.
- The query returns a large number of rows.
- Change tracking would add unnecessary memory or CPU overhead.
- The result should reflect database values without considering local tracked changes.

Example read-only API query:

```csharp
public async Task<IReadOnlyList<CustomerListItemDto>> GetCustomersAsync(
    CancellationToken cancellationToken)
{
    return await dbContext.Customers
        .AsNoTracking()
        .Where(c => c.IsActive)
        .OrderBy(c => c.Name)
        .Select(c => new CustomerListItemDto
        {
            Id = c.Id,
            Name = c.Name,
            Email = c.Email
        })
        .ToListAsync(cancellationToken);
}
```

In many read-only cases, the best option is not just `AsNoTracking`, but projection to a DTO. Projection reduces the selected columns and avoids exposing entity models directly.

### Tracking vs No-Tracking Comparison

| Area | Tracking Query | No-Tracking Query |
|---|---|---|
| Default behavior | Yes, for entity types with keys | Must be requested with `AsNoTracking` or configured globally |
| Change Tracker usage | Uses the current `DbContext` Change Tracker | Does not use the current `DbContext` Change Tracker |
| Save changes automatically | Yes, if entity is modified and `SaveChanges` is called | No, unless the entity is later attached or updated explicitly |
| Identity resolution | Yes | No, except with `AsNoTrackingWithIdentityResolution` |
| Memory overhead | Higher for large reads | Lower for simple read-only reads |
| Best for | Updates and unit-of-work workflows | Read-only queries and DTO responses |
| Navigation fix-up | Uses tracked relationships | Does not perform normal context tracking fix-up |
| Risk | Long-lived contexts can hold stale data and many tracked entities | Accidentally modifying returned entities will not be saved automatically |

### Identity Resolution

Identity resolution means EF Core makes sure that only one object instance represents a specific entity key within a tracking context.

For example, assume multiple orders belong to the same customer:

```csharp
var orders = await dbContext.Orders
    .Include(o => o.Customer)
    .Where(o => o.CustomerId == customerId)
    .ToListAsync(cancellationToken);
```

With a tracking query, if several orders reference the same customer row, EF Core uses one `Customer` object instance for that key.

Conceptually:

```csharp
var firstCustomer = orders[0].Customer;
var secondCustomer = orders[1].Customer;

bool sameInstance = ReferenceEquals(firstCustomer, secondCustomer); // usually true in tracking query
```

Identity resolution matters because EF Core must maintain a consistent object graph. If two different object instances with the same primary key were tracked at the same time, EF Core would not know which property values and relationships are the authoritative version.

### Identity Map Mental Model

A useful mental model is that the `DbContext` maintains an identity map.

The identity map is like a dictionary:

```csharp
(EntityType, PrimaryKeyValue) -> EntityInstance
```

When EF Core materializes an entity from a tracking query, it checks whether that entity key is already tracked.

If the entity is already tracked:

- EF Core returns the existing object instance.
- The same object reference is reused.
- The tracked entity's current and original values are not automatically overwritten by the new query result.

If the entity is not already tracked:

- EF Core creates a new object instance.
- EF Core stores it in the Change Tracker.
- EF Core marks it as `Unchanged` initially.

This behavior is why a short-lived `DbContext` is important. A long-lived context can return already-tracked instances that may not reflect the latest database values.

### Tracking Query Returning an Existing Tracked Instance

Consider this example:

```csharp
var customer = await dbContext.Customers
    .SingleAsync(c => c.Id == 1, cancellationToken);

customer.Name = "Local Unsaved Name";

var sameCustomer = await dbContext.Customers
    .SingleAsync(c => c.Id == 1, cancellationToken);

Console.WriteLine(ReferenceEquals(customer, sameCustomer)); // True
Console.WriteLine(sameCustomer.Name); // Local Unsaved Name
```

The second query still goes to the database to evaluate the query, but because the entity with key `1` is already tracked, EF Core returns the existing tracked instance.

This is useful for consistency within a unit of work, but it can surprise developers who expect every query to refresh the entity from the database.

If fresh database values are required, common options include:

```csharp
await dbContext.Entry(customer).ReloadAsync(cancellationToken);
```

or using a new short-lived `DbContext` for a new unit of work.

### No-Tracking Queries and Duplicate Instances

A normal no-tracking query does not perform identity resolution.

Example:

```csharp
var orders = await dbContext.Orders
    .AsNoTracking()
    .Include(o => o.Customer)
    .Where(o => o.CustomerId == customerId)
    .ToListAsync(cancellationToken);
```

If the same customer appears multiple times in the result graph, EF Core may create separate `Customer` object instances for the same database row.

This is often acceptable for read-only API responses because the objects are usually serialized and discarded. However, it can matter when:

- The application compares object references.
- The result graph is large and duplicates increase memory usage.
- Multiple result objects should share the same related entity instance.
- The query produces repeated references to the same entity.

### AsNoTrackingWithIdentityResolution

`AsNoTrackingWithIdentityResolution` gives a middle-ground behavior:

- The result is not tracked by the current `DbContext`.
- EF Core still performs identity resolution within the result of that query.
- A temporary internal tracker is used only while materializing the query result.
- After the query is fully enumerated, the temporary tracking structure can be discarded.

Example:

```csharp
var orders = await dbContext.Orders
    .AsNoTrackingWithIdentityResolution()
    .Include(o => o.Customer)
    .Where(o => o.CustomerId == customerId)
    .ToListAsync(cancellationToken);
```

This is useful for read-only graph queries where the same entity may appear multiple times and duplicate object instances would be wasteful or confusing.

Use `AsNoTrackingWithIdentityResolution` when:

- The result is read-only.
- The query returns an object graph with repeated entity references.
- You want one object instance per key within the query result.
- You do not want the entities tracked by the `DbContext` after the query.

Avoid assuming it is always faster than `AsNoTracking`. It does extra work to resolve identities, so simple flat read-only queries may be better with plain `AsNoTracking` or direct DTO projection.

### AsTracking

`AsTracking` explicitly requests tracking behavior for a query.

Example:

```csharp
var customer = await dbContext.Customers
    .AsTracking()
    .SingleAsync(c => c.Id == customerId, cancellationToken);
```

This is useful when the default query tracking behavior has been configured as no-tracking, but one specific query needs to update entities.

Example:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);
    options.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
});
```

Then for update workflows:

```csharp
var customer = await dbContext.Customers
    .AsTracking()
    .SingleAsync(c => c.Id == customerId, cancellationToken);

customer.Name = request.Name;

await dbContext.SaveChangesAsync(cancellationToken);
```

This pattern can work in read-heavy applications, but teams must be disciplined. Forgetting `AsTracking` in command code can result in changes not being saved.

### QueryTrackingBehavior

EF Core allows configuring tracking behavior at different levels:

1. Per query:

```csharp
var customers = await dbContext.Customers
    .AsNoTracking()
    .ToListAsync(cancellationToken);
```

2. Per context instance:

```csharp
dbContext.ChangeTracker.QueryTrackingBehavior = QueryTrackingBehavior.NoTracking;
```

3. In `DbContext` options:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);
    options.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
});
```

Common enum values include:

- `TrackAll`: track query results by default.
- `NoTracking`: do not track query results by default.
- `NoTrackingWithIdentityResolution`: do not track results in the context, but perform identity resolution for query results.

For most business applications, a common practice is:

- Use default tracking for command/update workflows.
- Use `AsNoTracking` or DTO projections explicitly for read-only query workflows.

Changing the entire context default to no-tracking can be helpful in read-only services, reporting services, or query-side contexts, but it can create bugs if update code assumes tracking is enabled.

### DTO Projection and Tracking

Projection means selecting only the shape required by the application instead of returning full entity objects.

Example:

```csharp
var customers = await dbContext.Customers
    .Where(c => c.IsActive)
    .Select(c => new CustomerListItemDto
    {
        Id = c.Id,
        Name = c.Name,
        OrderCount = c.Orders.Count
    })
    .ToListAsync(cancellationToken);
```

If the projection contains only scalar values and DTOs, EF Core does not track entity instances from the result because no entity instances are returned.

This is often better than returning entities for read-only API responses because it:

- Selects fewer columns.
- Avoids unnecessary tracking.
- Avoids exposing persistence models directly.
- Produces a clear request/response contract.
- Reduces accidental data leakage.

However, if the projection includes an entity instance, that entity can still be tracked by default:

```csharp
var result = await dbContext.Customers
    .Select(c => new
    {
        Customer = c,
        OrderCount = c.Orders.Count
    })
    .ToListAsync(cancellationToken);
```

In this query, `Customer` is an entity instance, so it can be tracked unless no-tracking is applied.

To avoid tracking:

```csharp
var result = await dbContext.Customers
    .AsNoTracking()
    .Select(c => new
    {
        Customer = c,
        OrderCount = c.Orders.Count
    })
    .ToListAsync(cancellationToken);
```

A very important interview point is: projection to a DTO with scalar properties is naturally not tracking entity instances, but projection that contains entity objects can still track those entity objects.

### Keyless Entity Types

Keyless entity types are never tracked because EF Core does not have a primary key to identify one instance as the same conceptual entity.

Keyless entity types are commonly used for:

- Database views.
- Raw SQL query shapes.
- Report models.
- Read-only projections.

Example:

```csharp
public sealed class MonthlySalesReport
{
    public string Month { get; set; } = string.Empty;
    public decimal TotalSales { get; set; }
}

protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<MonthlySalesReport>()
        .HasNoKey()
        .ToView("View_MonthlySalesReport");
}
```

Because there is no key, EF Core cannot perform normal identity resolution or update tracking for this type.

### Relationship Fix-Up

Relationship fix-up is EF Core's process of keeping navigation properties and foreign key values consistent among tracked entities.

Example:

```csharp
var customer = await dbContext.Customers
    .SingleAsync(c => c.Id == customerId, cancellationToken);

var orders = await dbContext.Orders
    .Where(o => o.CustomerId == customerId)
    .ToListAsync(cancellationToken);
```

Because the entities are tracked, EF Core can connect the relationship in memory. The customer's `Orders` navigation may be populated with the orders that were loaded, and each order's `Customer` navigation may point to the tracked customer.

This can be useful, but it can also surprise developers when a long-lived context already contains related entities. The result graph may include relationships from the Change Tracker that were loaded by earlier queries in the same context.

For clean read-only API results, DTO projection is often safer and more predictable than returning tracked entity graphs.

### Tracking and Filtered Include

Filtered include allows applying operations such as `Where`, `OrderBy`, `Skip`, and `Take` inside an `Include`.

Example:

```csharp
var customers = await dbContext.Customers
    .Include(c => c.Orders.Where(o => o.Status == OrderStatus.Open))
    .ToListAsync(cancellationToken);
```

With tracking queries, previously tracked related entities can affect the final navigation property contents through relationship fix-up. This means the in-memory navigation collection may contain entities that were loaded earlier in the context, even if they do not match the filtered include.

For predictable read-only results with filtered includes, consider:

```csharp
var customers = await dbContext.Customers
    .AsNoTracking()
    .Include(c => c.Orders.Where(o => o.Status == OrderStatus.Open))
    .ToListAsync(cancellationToken);
```

Or better, project directly to a DTO:

```csharp
var customers = await dbContext.Customers
    .Select(c => new CustomerOrdersDto
    {
        CustomerId = c.Id,
        CustomerName = c.Name,
        OpenOrders = c.Orders
            .Where(o => o.Status == OrderStatus.Open)
            .Select(o => new OrderDto
            {
                Id = o.Id,
                OrderDate = o.OrderDate,
                Total = o.Total
            })
            .ToList()
    })
    .ToListAsync(cancellationToken);
```

### Updating Entities: Tracking Query Approach

The simplest and safest update pattern is to query the entity with tracking, modify allowed properties, and save.

Example:

```csharp
public async Task UpdateCustomerAsync(
    int id,
    UpdateCustomerRequest request,
    CancellationToken cancellationToken)
{
    var customer = await dbContext.Customers
        .SingleOrDefaultAsync(c => c.Id == id, cancellationToken);

    if (customer is null)
    {
        throw new KeyNotFoundException("Customer was not found.");
    }

    customer.Name = request.Name;
    customer.Email = request.Email;

    await dbContext.SaveChangesAsync(cancellationToken);
}
```

Benefits:

- Easy to reason about.
- Updates only changed properties.
- Preserves concurrency tokens and shadow properties.
- Avoids accidentally overwriting fields not included in the request.
- Avoids attaching duplicate instances.

Trade-off:

- Requires a database read before the update.

For many business applications, this trade-off is acceptable because it improves correctness and validation clarity.

### Updating Entities: No-Tracking Query Pitfall

A common mistake is querying with `AsNoTracking`, modifying the entity, and expecting `SaveChanges` to persist it.

Problem example:

```csharp
var customer = await dbContext.Customers
    .AsNoTracking()
    .SingleAsync(c => c.Id == customerId, cancellationToken);

customer.Name = "New Name";

await dbContext.SaveChangesAsync(cancellationToken); // No update is saved
```

The entity is not tracked, so EF Core does not know it changed.

Possible fixes:

1. Remove `AsNoTracking` for update workflows:

```csharp
var customer = await dbContext.Customers
    .SingleAsync(c => c.Id == customerId, cancellationToken);

customer.Name = "New Name";

await dbContext.SaveChangesAsync(cancellationToken);
```

2. Attach and mark specific properties as modified when using a disconnected entity:

```csharp
var customer = new Customer
{
    Id = customerId,
    Name = request.Name
};

dbContext.Attach(customer);
dbContext.Entry(customer).Property(c => c.Name).IsModified = true;

await dbContext.SaveChangesAsync(cancellationToken);
```

Use the second approach carefully. It is useful for optimized updates but requires discipline to avoid overwriting data incorrectly.

### Disconnected Entities and Duplicate Tracking Errors

Disconnected entities are objects created outside the current `DbContext`, often from API requests, JSON payloads, message queues, or UI forms.

A common error occurs when the context already tracks an entity with a given key, and the application tries to attach another instance with the same key.

Problem example:

```csharp
var existingCustomer = await dbContext.Customers
    .SingleAsync(c => c.Id == request.Id, cancellationToken);

var detachedCustomer = new Customer
{
    Id = request.Id,
    Name = request.Name
};

dbContext.Update(detachedCustomer); // Can throw if another instance with same key is already tracked
```

Better approach:

```csharp
var customer = await dbContext.Customers
    .SingleAsync(c => c.Id == request.Id, cancellationToken);

customer.Name = request.Name;
customer.Email = request.Email;

await dbContext.SaveChangesAsync(cancellationToken);
```

Another approach when you intentionally do not query first:

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

This marks the entity as modified, often causing all mapped properties to be updated. It can be acceptable in some simple cases, but it is risky when the request does not contain every property.

### Attach vs Update vs Tracking Query

| Pattern | Behavior | Best Use Case | Risk |
|---|---|---|---|
| Tracking query then modify | Loads and tracks entity, then detects changed properties | Business updates with validation | Requires a read before update |
| `Attach` | Starts tracking existing entity as usually unchanged | Updating selected properties or connecting existing related entities | Must manually mark modified properties if needed |
| `Update` | Starts tracking entity graph as modified where appropriate | Simple disconnected full update | Can update too many columns or overwrite data |
| `AsNoTracking` then modify | Does not track result | Read-only only | Changes are not saved unless attached later |

Interview-friendly rule:

Use tracking queries for normal updates. Use no-tracking queries for read-only results. Use `Attach` or `Update` only when you intentionally handle disconnected entities and understand the update consequences.

### Performance Considerations

Tracking has overhead because EF Core stores tracking information, original values, relationship information, and identity map entries.

For large read-only queries, this overhead can matter.

Example:

```csharp
var reportRows = await dbContext.Orders
    .AsNoTracking()
    .Where(o => o.OrderDate >= startDate && o.OrderDate < endDate)
    .Select(o => new OrderReportRowDto
    {
        OrderId = o.Id,
        CustomerName = o.Customer.Name,
        Total = o.Total,
        OrderDate = o.OrderDate
    })
    .ToListAsync(cancellationToken);
```

This is usually better than loading full tracked `Order` entities for a report.

However, no-tracking is not automatically faster in every scenario. For example, if a query returns the same entity many times in a complex graph, no-tracking may create duplicate instances. In those cases, `AsNoTrackingWithIdentityResolution` or a tracking query may use fewer object instances.

Performance should be guided by the query shape:

- Flat read-only DTO query: projection is usually best.
- Simple read-only entity query: `AsNoTracking` is often appropriate.
- Read-only graph with repeated references: consider `AsNoTrackingWithIdentityResolution`.
- Update workflow: use tracking.
- Very large result set: avoid tracking and consider streaming, pagination, or batching.

### Memory Considerations

A long-lived `DbContext` can accumulate tracked entities over time.

Problem pattern:

```csharp
foreach (var batch in batches)
{
    var customers = await dbContext.Customers
        .Where(c => batch.CustomerIds.Contains(c.Id))
        .ToListAsync(cancellationToken);

    // Process many batches with the same DbContext...
}
```

If this processes many batches, the Change Tracker can grow large.

Possible improvements:

- Use a new context per batch.
- Use `AsNoTracking` for read-only processing.
- Clear the Change Tracker between batches when appropriate.
- Use DTO projection.
- Avoid loading more rows than necessary.

Example:

```csharp
foreach (var batch in batches)
{
    var rows = await dbContext.Customers
        .AsNoTracking()
        .Where(c => batch.CustomerIds.Contains(c.Id))
        .Select(c => new CustomerProcessingDto
        {
            Id = c.Id,
            Name = c.Name
        })
        .ToListAsync(cancellationToken);

    // Process read-only rows...
}
```

### Read Models and CQRS

In CQRS-style applications, query handlers and command handlers often use different patterns.

Query handler:

```csharp
public async Task<IReadOnlyList<CustomerListItemDto>> Handle(
    GetCustomersQuery query,
    CancellationToken cancellationToken)
{
    return await dbContext.Customers
        .AsNoTracking()
        .Where(c => c.IsActive)
        .Select(c => new CustomerListItemDto
        {
            Id = c.Id,
            Name = c.Name
        })
        .ToListAsync(cancellationToken);
}
```

Command handler:

```csharp
public async Task Handle(
    RenameCustomerCommand command,
    CancellationToken cancellationToken)
{
    var customer = await dbContext.Customers
        .SingleAsync(c => c.Id == command.CustomerId, cancellationToken);

    customer.Rename(command.NewName);

    await dbContext.SaveChangesAsync(cancellationToken);
}
```

This separation is easy to explain in interviews:

- Queries should be optimized for read shape and usually use no-tracking DTO projection.
- Commands should load tracked aggregates/entities, apply business rules, and save changes.

### API Design Habits

For Web APIs, avoid returning EF Core entities directly from controllers.

Less ideal:

```csharp
[HttpGet]
public async Task<List<Customer>> GetCustomers(CancellationToken cancellationToken)
{
    return await dbContext.Customers.ToListAsync(cancellationToken);
}
```

Better:

```csharp
[HttpGet]
public async Task<List<CustomerListItemDto>> GetCustomers(CancellationToken cancellationToken)
{
    return await dbContext.Customers
        .AsNoTracking()
        .OrderBy(c => c.Name)
        .Select(c => new CustomerListItemDto
        {
            Id = c.Id,
            Name = c.Name,
            Email = c.Email
        })
        .ToListAsync(cancellationToken);
}
```

Benefits:

- Clear API contract.
- Fewer selected columns.
- No accidental tracking overhead.
- No circular navigation serialization issues.
- No accidental exposure of internal fields.
- Easier versioning and validation.

### Stale Data and Long-Lived DbContext

Because tracking queries reuse existing tracked instances, a long-lived `DbContext` can return stale in-memory data.

Example scenario:

1. A customer is loaded and tracked.
2. Another request or process updates the same customer in the database.
3. The original context queries the customer again.
4. EF Core returns the already-tracked instance.

This is one reason `DbContext` should usually be short-lived.

For ASP.NET Core applications, registering `DbContext` as scoped usually matches the request unit of work:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);
});
```

Avoid:

- Singleton `DbContext`.
- Static `DbContext`.
- Sharing one `DbContext` across unrelated operations.
- Reusing the same `DbContext` for many user interactions.
- Running parallel operations on the same `DbContext`.

### No-Tracking and Lazy Loading

If an application uses lazy loading proxies, no-tracking queries can affect expectations around navigation loading. Lazy loading depends on EF infrastructure and a live context. Read-only no-tracking results should not be designed around lazy loading behavior.

Better practice:

- Use explicit DTO projections for API responses.
- Use `Include` only when entity graphs are actually needed.
- Avoid relying on lazy loading in Web APIs.
- Prefer predictable query shapes.

Example DTO projection instead of lazy loading:

```csharp
var orders = await dbContext.Orders
    .AsNoTracking()
    .Where(o => o.CustomerId == customerId)
    .Select(o => new OrderSummaryDto
    {
        Id = o.Id,
        OrderDate = o.OrderDate,
        CustomerName = o.Customer.Name,
        Total = o.Total
    })
    .ToListAsync(cancellationToken);
```

### Split Queries, Includes, and Tracking

When loading multiple collections with `Include`, EF Core can generate large joins that repeat data. Split queries can reduce cartesian explosion by using multiple SQL queries.

Example:

```csharp
var customers = await dbContext.Customers
    .AsNoTrackingWithIdentityResolution()
    .AsSplitQuery()
    .Include(c => c.Orders)
    .Include(c => c.SupportTickets)
    .ToListAsync(cancellationToken);
```

This kind of query involves multiple concerns:

- `AsNoTrackingWithIdentityResolution` avoids tracking results in the context but prevents duplicate object instances for the same key in the result.
- `AsSplitQuery` can reduce result duplication from large joins.
- `Include` loads full related entities, which may be heavier than DTO projection.

For API endpoints, compare this with DTO projection before choosing it.

### Choosing the Right Query Mode

A practical decision flow:

1. Will you modify and save the returned entity in the same unit of work?
   - Use a tracking query.

2. Is this a read-only API or report?
   - Use DTO projection, usually with `AsNoTracking` if entity instances are involved.

3. Does the read-only result contain repeated references to the same entity?
   - Consider `AsNoTrackingWithIdentityResolution`.

4. Are you returning only scalar values or DTOs without entity instances?
   - Tracking is usually not relevant because no entity instances are returned.

5. Is the `DbContext` configured globally as no-tracking?
   - Use `AsTracking` explicitly for update workflows.

6. Are you tempted to query no-tracking and then attach the entity to update it?
   - Consider a tracking query update pattern instead. It is often simpler and safer.

### Common Mistakes

Common mistakes include:

- Using `AsNoTracking` in update workflows and expecting `SaveChanges` to persist modifications.
- Returning entities directly from API endpoints instead of DTOs.
- Assuming no-tracking queries perform identity resolution by default.
- Assuming `AsNoTrackingWithIdentityResolution` tracks entities in the `DbContext`.
- Using a long-lived `DbContext` and getting stale tracked data.
- Attaching a second instance with the same key while another instance is already tracked.
- Globally disabling tracking and forgetting `AsTracking` in commands.
- Using `Update` on a partial request DTO and overwriting columns unintentionally.
- Assuming projection always disables tracking, even when the projection includes entity instances.
- Loading large tracked graphs for read-only screens.

### Best Practices

Good habits include:

- Use tracking queries for normal update workflows.
- Use `AsNoTracking` for read-only entity queries.
- Prefer DTO projection for API responses and reports.
- Use `AsNoTrackingWithIdentityResolution` for read-only graph queries with repeated entity references.
- Keep `DbContext` short-lived.
- Avoid sharing `DbContext` across threads.
- Avoid returning EF entities from controllers.
- Be careful when changing default `QueryTrackingBehavior`.
- Avoid attaching no-tracking entities to the same context unless the workflow is intentional.
- Use `AsTracking` explicitly when the default is no-tracking but an update is required.
- Profile real queries instead of assuming one mode is always faster.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

<!-- question:start:tracking-no-tracking-beginner-q01 -->
<!-- question-id:tracking-no-tracking-beginner-q01 -->
<!-- question-level:beginner -->
#### 1. What is the difference between a tracking query and a no-tracking query in EF Core?

##### Expected Answer

A tracking query stores returned entity instances in the `DbContext` Change Tracker. If those entities are modified, EF Core can detect the changes and persist them when `SaveChanges` or `SaveChangesAsync` is called.

A no-tracking query does not store returned entities in the Change Tracker. It is useful for read-only data because EF Core does not need to keep original values, entity states, or relationship tracking information.

Tracking queries are best for update workflows. No-tracking queries are best for read-only screens, reports, and API responses where the result will not be modified and saved in the same context.

##### Key Points to Mention

- Tracking is the default for entity queries.
- Tracking enables automatic persistence of modifications.
- No-tracking avoids Change Tracker overhead.
- Use tracking for commands/updates.
- Use no-tracking for read-only queries.

<!-- question:end:tracking-no-tracking-beginner-q01 -->

<!-- question:start:tracking-no-tracking-beginner-q02 -->
<!-- question-id:tracking-no-tracking-beginner-q02 -->
<!-- question-level:beginner -->
#### 2. What does `AsNoTracking()` do?

##### Expected Answer

`AsNoTracking()` tells EF Core not to track the entities returned by a query. This means the returned objects are not stored in the current `DbContext` Change Tracker, and changes made to them will not be saved automatically by `SaveChanges`.

It is commonly used for read-only operations such as API GET endpoints, search results, reports, dropdown lists, and exports.

Example:

```csharp
var customers = await dbContext.Customers
    .AsNoTracking()
    .Where(c => c.IsActive)
    .ToListAsync(cancellationToken);
```

##### Key Points to Mention

- Disables tracking for that query.
- Useful for read-only data.
- Can reduce memory and CPU overhead.
- Modified results are not saved automatically.
- Does not perform identity resolution by default.

<!-- question:end:tracking-no-tracking-beginner-q02 -->

<!-- question:start:tracking-no-tracking-beginner-q03 -->
<!-- question-id:tracking-no-tracking-beginner-q03 -->
<!-- question-level:beginner -->
#### 3. When should you use a tracking query?

##### Expected Answer

Use a tracking query when the application needs to modify the returned entity and save those changes in the same `DbContext` unit of work.

Example:

```csharp
var customer = await dbContext.Customers
    .SingleAsync(c => c.Id == customerId, cancellationToken);

customer.Name = request.Name;

await dbContext.SaveChangesAsync(cancellationToken);
```

This pattern is clear and safe because EF Core knows the original values and can save only the changes that were made.

##### Key Points to Mention

- Use for updates.
- Good for command handlers.
- Enables automatic change detection.
- Preserves original values and relationship information.
- Avoid unnecessary tracking in read-only queries.

<!-- question:end:tracking-no-tracking-beginner-q03 -->

<!-- question:start:tracking-no-tracking-beginner-q04 -->
<!-- question-id:tracking-no-tracking-beginner-q04 -->
<!-- question-level:beginner -->
#### 4. When should you use a no-tracking query?

##### Expected Answer

Use a no-tracking query when the result is read-only and will not be updated through the same `DbContext`. Common examples include API GET endpoints, report pages, export jobs, dashboards, search screens, and dropdown lists.

No-tracking queries avoid the overhead of storing entity instances in the Change Tracker. For API responses, it is often even better to project directly to DTOs instead of returning full entity objects.

##### Key Points to Mention

- Best for read-only results.
- Common in query handlers and API GET endpoints.
- Avoids Change Tracker overhead.
- Often combined with DTO projection.
- Not suitable when the entity must be modified and saved automatically.

<!-- question:end:tracking-no-tracking-beginner-q04 -->

<!-- question:start:tracking-no-tracking-beginner-q05 -->
<!-- question-id:tracking-no-tracking-beginner-q05 -->
<!-- question-level:beginner -->
#### 5. What happens if you modify an entity returned by `AsNoTracking()` and call `SaveChanges()`?

##### Expected Answer

Nothing is saved automatically because the entity is not tracked by the `DbContext`. EF Core does not know that the entity exists in the Change Tracker and does not know that its properties changed.

Example problem:

```csharp
var customer = await dbContext.Customers
    .AsNoTracking()
    .SingleAsync(c => c.Id == customerId, cancellationToken);

customer.Name = "New Name";

await dbContext.SaveChangesAsync(cancellationToken); // No update
```

To update the entity, use a tracking query or intentionally attach the entity and mark the required properties as modified.

##### Key Points to Mention

- No automatic update is saved.
- The entity is detached from the Change Tracker.
- Use tracking queries for normal updates.
- Attach/update only when intentionally handling disconnected entities.

<!-- question:end:tracking-no-tracking-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

<!-- question:start:tracking-no-tracking-intermediate-q01 -->
<!-- question-id:tracking-no-tracking-intermediate-q01 -->
<!-- question-level:intermediate -->
#### 1. What is identity resolution in EF Core?

##### Expected Answer

Identity resolution means EF Core ensures that a single entity key is represented by a single object instance within a tracking context. If the same row appears multiple times in a tracking query result, EF Core reuses the same object instance instead of creating duplicates.

For example, if multiple orders reference the same customer, a tracking query can make all those orders point to the same `Customer` instance.

Identity resolution is important because EF Core cannot safely track two different object instances with the same primary key at the same time. It needs one consistent instance for property values, relationships, and state management.

##### Key Points to Mention

- One key maps to one tracked object instance.
- Happens automatically in tracking queries.
- Maintains a consistent object graph.
- Prevents duplicate tracked instances with the same key.
- No-tracking queries do not do this by default.

<!-- question:end:tracking-no-tracking-intermediate-q01 -->

<!-- question:start:tracking-no-tracking-intermediate-q02 -->
<!-- question-id:tracking-no-tracking-intermediate-q02 -->
<!-- question-level:intermediate -->
#### 2. What is `AsNoTrackingWithIdentityResolution()`?

##### Expected Answer

`AsNoTrackingWithIdentityResolution()` is a query option that returns results without tracking them in the current `DbContext`, while still performing identity resolution within the query result.

It uses a temporary internal tracking mechanism during materialization so that if the same entity appears multiple times in the result, EF Core returns the same object instance for that key. After the query is enumerated, the temporary tracking information is no longer part of the context.

It is useful for read-only graph queries where duplicate entity instances would be wasteful or confusing, but the application still does not want the context to track the results after the query.

##### Key Points to Mention

- Read-only behavior.
- Not tracked by the current `DbContext`.
- Performs identity resolution within the query result.
- Useful for repeated references in object graphs.
- Has more overhead than plain `AsNoTracking`.

<!-- question:end:tracking-no-tracking-intermediate-q02 -->

<!-- question:start:tracking-no-tracking-intermediate-q03 -->
<!-- question-id:tracking-no-tracking-intermediate-q03 -->
<!-- question-level:intermediate -->
#### 3. Does projecting to a DTO use tracking?

##### Expected Answer

If the projection returns only scalar values or DTO objects that do not contain entity instances, EF Core does not track entity instances from the result.

Example:

```csharp
var customers = await dbContext.Customers
    .Select(c => new CustomerDto
    {
        Id = c.Id,
        Name = c.Name
    })
    .ToListAsync(cancellationToken);
```

This query returns DTOs, not `Customer` entities, so there are no `Customer` entities in the result to track.

However, if the projection includes an entity instance, that entity can still be tracked by default:

```csharp
var result = await dbContext.Customers
    .Select(c => new
    {
        Customer = c,
        OrderCount = c.Orders.Count
    })
    .ToListAsync(cancellationToken);
```

Here, `Customer` is still an entity instance, so it can be tracked unless `AsNoTracking` is applied.

##### Key Points to Mention

- Pure DTO/scalar projection does not track entity instances.
- Projection containing entity objects can still track those entities.
- DTO projection is usually preferred for API responses.
- `AsNoTracking` is still useful if entity instances are included in the result shape.

<!-- question:end:tracking-no-tracking-intermediate-q03 -->

<!-- question:start:tracking-no-tracking-intermediate-q04 -->
<!-- question-id:tracking-no-tracking-intermediate-q04 -->
<!-- question-level:intermediate -->
#### 4. Why can a tracking query return stale data?

##### Expected Answer

A tracking query can return stale data when the `DbContext` is already tracking an entity with the same key. EF Core still executes the query against the database, but when materializing the result, it returns the existing tracked instance instead of replacing it with a new object.

If the entity was modified locally or loaded earlier, the tracked instance may not reflect newer database values. This is one reason `DbContext` should usually be short-lived and scoped to a single unit of work.

To refresh data, you can reload the entity, use a new context, or design the workflow so each operation uses a fresh context.

##### Key Points to Mention

- Tracking queries reuse existing tracked instances.
- Existing current/original values are not automatically overwritten.
- Long-lived contexts can hold stale state.
- Use short-lived contexts.
- Use reload or a new context when fresh data is required.

<!-- question:end:tracking-no-tracking-intermediate-q04 -->

<!-- question:start:tracking-no-tracking-intermediate-q05 -->
<!-- question-id:tracking-no-tracking-intermediate-q05 -->
<!-- question-level:intermediate -->
#### 5. What is the difference between `AsNoTracking()` and `AsNoTrackingWithIdentityResolution()`?

##### Expected Answer

`AsNoTracking()` returns entities without tracking them in the `DbContext` and without identity resolution. If the same entity appears multiple times in the result, EF Core may create multiple object instances for the same database row.

`AsNoTrackingWithIdentityResolution()` also returns entities without tracking them in the `DbContext`, but it performs identity resolution within the query result. This means repeated appearances of the same entity key use the same object instance inside that result.

Use `AsNoTracking()` for simple read-only queries and flat result sets. Use `AsNoTrackingWithIdentityResolution()` for read-only graph queries where repeated entity references are expected.

##### Key Points to Mention

- Both are no-tracking from the context's perspective.
- Plain `AsNoTracking` does not resolve duplicate entity instances.
- `AsNoTrackingWithIdentityResolution` resolves duplicates within the query result.
- Identity resolution adds overhead.
- Choose based on query shape.

<!-- question:end:tracking-no-tracking-intermediate-q05 -->

<!-- question:start:tracking-no-tracking-intermediate-q06 -->
<!-- question-id:tracking-no-tracking-intermediate-q06 -->
<!-- question-level:intermediate -->
#### 6. Should read-only API endpoints return EF Core entities with `AsNoTracking()`?

##### Expected Answer

Usually, read-only API endpoints should return DTOs rather than EF Core entities. `AsNoTracking()` helps avoid Change Tracker overhead, but returning entities can still expose persistence details, unwanted columns, navigation cycles, and internal domain structure.

A better pattern is to project to a response DTO:

```csharp
var result = await dbContext.Customers
    .AsNoTracking()
    .Select(c => new CustomerResponse
    {
        Id = c.Id,
        Name = c.Name,
        Email = c.Email
    })
    .ToListAsync(cancellationToken);
```

DTO projection gives a clear API contract and often generates more efficient SQL because only needed columns are selected.

##### Key Points to Mention

- Prefer DTOs for API responses.
- `AsNoTracking` helps but does not solve API contract design.
- DTOs reduce selected data.
- DTOs avoid serialization issues with navigation properties.
- Entities are persistence models, not necessarily response contracts.

<!-- question:end:tracking-no-tracking-intermediate-q06 -->

<!-- question:start:tracking-no-tracking-intermediate-q07 -->
<!-- question-id:tracking-no-tracking-intermediate-q07 -->
<!-- question-level:intermediate -->
#### 7. What happens when the default `QueryTrackingBehavior` is set to `NoTracking`?

##### Expected Answer

When the default `QueryTrackingBehavior` is set to `NoTracking`, EF Core queries do not track returned entities unless a query explicitly uses `AsTracking()`.

Example:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);
    options.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
});
```

This can be useful for read-heavy applications or query-only contexts. However, it can cause bugs if command/update code assumes entities are tracked. In that case, updates may not be saved unless the query uses `AsTracking()` or the entity is attached intentionally.

##### Key Points to Mention

- Changes default behavior for all queries in that context configuration.
- Useful for read-heavy/query-side contexts.
- Use `AsTracking()` for update workflows.
- Can cause bugs if developers forget tracking is disabled.
- Should be chosen deliberately by team convention.

<!-- question:end:tracking-no-tracking-intermediate-q07 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

<!-- question:start:tracking-no-tracking-advanced-q01 -->
<!-- question-id:tracking-no-tracking-advanced-q01 -->
<!-- question-level:advanced -->
#### 1. Why is it usually discouraged to perform a no-tracking query and then attach the returned entities to the same context?

##### Expected Answer

It is usually discouraged because it is more complex and easier to get wrong than using a tracking query from the beginning. A no-tracking query does not preserve original values, relationship tracking information, or normal Change Tracker state. If the entity is later attached, EF Core needs explicit instructions about what changed.

This can lead to problems such as:

- Updating all columns instead of only changed columns.
- Accidentally overwriting values not included in a request.
- Duplicate tracked instance errors if another instance with the same key is already tracked.
- Losing concurrency or shadow property context.
- More complicated code than a normal tracking query update.

For typical update workflows, it is usually better to query with tracking, modify allowed properties, and call `SaveChangesAsync`.

##### Key Points to Mention

- No-tracking removes useful update context.
- Reattaching requires careful state management.
- Can cause duplicate instance errors.
- Can overwrite data unintentionally.
- Tracking query update pattern is simpler and safer.

<!-- question:end:tracking-no-tracking-advanced-q01 -->

<!-- question:start:tracking-no-tracking-advanced-q02 -->
<!-- question-id:tracking-no-tracking-advanced-q02 -->
<!-- question-level:advanced -->
#### 2. How does identity resolution relate to the error about another instance with the same key already being tracked?

##### Expected Answer

EF Core's Change Tracker can track only one entity instance for a given entity type and primary key. If the context already tracks a `Customer` with `Id = 1`, and the application tries to attach or update a different `Customer` object with `Id = 1`, EF Core throws an error because it cannot safely track two instances representing the same row.

This is directly related to identity resolution. EF Core uses identity resolution to ensure one key maps to one tracked object instance. When application code bypasses that pattern by attaching duplicates, EF Core rejects the duplicate tracking situation.

A better approach is to load the tracked entity and apply changes to that instance:

```csharp
var customer = await dbContext.Customers
    .SingleAsync(c => c.Id == request.Id, cancellationToken);

customer.Name = request.Name;

await dbContext.SaveChangesAsync(cancellationToken);
```

##### Key Points to Mention

- One entity key can have only one tracked instance per context.
- Duplicate instances cause tracking conflicts.
- Identity resolution prevents ambiguity.
- Apply changes to the already-tracked instance when possible.
- Avoid mixing queried tracked entities with separately attached duplicate objects.

<!-- question:end:tracking-no-tracking-advanced-q02 -->

<!-- question:start:tracking-no-tracking-advanced-q03 -->
<!-- question-id:tracking-no-tracking-advanced-q03 -->
<!-- question-level:advanced -->
#### 3. How would you choose between tracking, `AsNoTracking`, and `AsNoTrackingWithIdentityResolution` in a high-traffic API?

##### Expected Answer

The choice should be based on whether the endpoint updates data and the shape of the result.

For command endpoints that update data, use tracking queries. This allows EF Core to detect changes, preserve original values, and save only the intended modifications.

For read-only endpoints returning flat data or DTOs, use DTO projection and no-tracking behavior. This avoids unnecessary Change Tracker overhead and reduces memory usage.

For read-only endpoints returning complex object graphs where the same entity can appear multiple times, consider `AsNoTrackingWithIdentityResolution`. It avoids tracking the result in the context but prevents duplicate object instances within the result graph.

The final decision should be validated with profiling for important endpoints because the best option depends on query shape, result size, relationship complexity, and memory behavior.

##### Key Points to Mention

- Commands: tracking.
- Simple read-only DTO queries: projection and no-tracking.
- Complex repeated graph reads: consider no-tracking with identity resolution.
- Avoid returning EF entities directly from public APIs.
- Profile important queries.

<!-- question:end:tracking-no-tracking-advanced-q03 -->

<!-- question:start:tracking-no-tracking-advanced-q04 -->
<!-- question-id:tracking-no-tracking-advanced-q04 -->
<!-- question-level:advanced -->
#### 4. How can tracking behavior affect filtered includes and navigation properties?

##### Expected Answer

Tracking behavior can affect filtered includes because EF Core performs relationship fix-up for tracked entities. If the context already tracks related entities from previous queries, navigation properties may include those previously tracked entities even when a filtered include appears to restrict the related collection.

For example, if a context already tracks closed orders for a customer, and a later tracking query includes only open orders, relationship fix-up may still connect previously tracked orders to the customer's navigation collection.

For predictable read-only filtered include results, use a short-lived context, `AsNoTracking`, or project directly to a DTO. DTO projection is often the clearest approach for API responses.

##### Key Points to Mention

- Tracking queries perform relationship fix-up.
- Previously tracked entities can affect navigation collections.
- Filtered include can surprise developers in long-lived contexts.
- Use no-tracking or DTO projection for predictable read-only results.
- Keep contexts short-lived.

<!-- question:end:tracking-no-tracking-advanced-q04 -->

<!-- question:start:tracking-no-tracking-advanced-q05 -->
<!-- question-id:tracking-no-tracking-advanced-q05 -->
<!-- question-level:advanced -->
#### 5. How does tracking behavior influence memory usage in batch processing?

##### Expected Answer

In batch processing, tracking queries can cause the `DbContext` Change Tracker to grow as more entities are loaded. This increases memory usage and can slow down change detection and relationship fix-up.

For read-only batch processing, use `AsNoTracking` and project only the required columns. For update batch processing, process data in smaller batches and consider using a fresh `DbContext` per batch. If appropriate, `ChangeTracker.Clear()` can be used after a batch, but the workflow must ensure there are no pending changes that still need to be saved.

The key idea is to avoid using one long-lived context that tracks thousands or millions of entities unnecessarily.

##### Key Points to Mention

- Tracking stores entity state and original values.
- Large tracked batches increase memory usage.
- Use no-tracking for read-only batches.
- Use short-lived contexts or clear the tracker between batches when safe.
- Avoid long-lived contexts for large processing jobs.

<!-- question:end:tracking-no-tracking-advanced-q05 -->

<!-- question:start:tracking-no-tracking-advanced-q06 -->
<!-- question-id:tracking-no-tracking-advanced-q06 -->
<!-- question-level:advanced -->
#### 6. What are the risks of setting global no-tracking behavior in a shared application `DbContext`?

##### Expected Answer

Global no-tracking behavior can improve consistency for read-heavy services, but it is risky in a shared application `DbContext` that is also used for updates. Developers may write command code that queries an entity, modifies it, calls `SaveChangesAsync`, and expects the changes to persist. If the query is no-tracking by default, the changes will not be saved unless the query uses `AsTracking()` or the entity is attached.

This can create subtle bugs because the code looks correct at first glance. A safer approach in many applications is to keep EF Core's default tracking behavior and explicitly use `AsNoTracking` in read-only query handlers. Another option is to separate read and write contexts or repository/query services by convention.

##### Key Points to Mention

- Can break update workflows if `AsTracking` is forgotten.
- Makes team conventions very important.
- Better for read-only contexts than mixed read/write contexts.
- Explicit `AsNoTracking` in queries is often safer.
- Separate read/write patterns can reduce confusion.

<!-- question:end:tracking-no-tracking-advanced-q06 -->

<!-- question:start:tracking-no-tracking-advanced-q07 -->
<!-- question-id:tracking-no-tracking-advanced-q07 -->
<!-- question-level:advanced -->
#### 7. In a CQRS architecture, how would you apply tracking and no-tracking habits?

##### Expected Answer

In CQRS, query handlers and command handlers usually have different data access goals.

Query handlers should usually use DTO projection and no-tracking behavior because they only read data and return a response model. They should avoid returning EF entities directly.

Command handlers should usually use tracking queries to load the relevant aggregate or entity, apply business rules, modify state, and call `SaveChangesAsync`. This allows EF Core to detect changes and persist only intended updates.

Example pattern:

```csharp
// Query side
var customers = await dbContext.Customers
    .AsNoTracking()
    .Select(c => new CustomerListItemDto
    {
        Id = c.Id,
        Name = c.Name
    })
    .ToListAsync(cancellationToken);

// Command side
var customer = await dbContext.Customers
    .SingleAsync(c => c.Id == command.CustomerId, cancellationToken);

customer.Rename(command.NewName);

await dbContext.SaveChangesAsync(cancellationToken);
```

##### Key Points to Mention

- Query side: DTO projection and no-tracking.
- Command side: tracking query and domain/business changes.
- Clear separation improves correctness.
- Avoid exposing entities as read models.
- Tracking supports unit-of-work persistence.

<!-- question:end:tracking-no-tracking-advanced-q07 -->

<!-- question:start:tracking-no-tracking-advanced-q08 -->
<!-- question-id:tracking-no-tracking-advanced-q08 -->
<!-- question-level:advanced -->
#### 8. Is `AsNoTracking` always faster than tracking?

##### Expected Answer

No. `AsNoTracking` is often faster for simple read-only queries because EF Core avoids setting up tracking information. However, it is not always faster in every query shape.

For example, if a query result contains the same entity many times, a tracking query or `AsNoTrackingWithIdentityResolution` may reuse object instances, while plain `AsNoTracking` may create duplicates. Also, projection to a DTO can be more efficient than both tracking and no-tracking entity queries because it selects only required columns.

The correct answer is to choose based on intent and query shape, then profile important queries.

##### Key Points to Mention

- Often faster for simple read-only queries.
- Not guaranteed to be faster for every graph query.
- Duplicate instances can increase memory usage.
- DTO projection is often the best read-model approach.
- Measure important queries.

<!-- question:end:tracking-no-tracking-advanced-q08 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
