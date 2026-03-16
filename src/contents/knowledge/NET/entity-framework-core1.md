---
id: entity-framework-core1
topic: Entity Framework Core (EF Core) Part 1
category: .NET
---

Entity Framework Core (EF Core) is a lightweight, cross-platform ORM (Object-Relational Mapper) for .NET that enables developers to interact with databases using .NET objects instead of raw SQL.


---

# Basics of EF Core

## What is EF Core?

EF Core:

- Maps .NET classes to database tables
- Translates LINQ queries into SQL
- Tracks entity changes
- Supports multiple database providers (SQL Server, PostgreSQL, etc.)

---

## Approaches to Using EF Core

- **Code-First** (most common)
- **Database-First**
- **Model-First** (rare in EF Core)

---

## What is DbContext?

`DbContext`:

- Main class for interacting with the database
- Manages entity instances
- Handles querying and saving data
- Configures model via `DbSet<T>` and Fluent API

Example:

```csharp
public class AppDbContext : DbContext
{
    public DbSet<Product> Products { get; set; }
}
````

---

## What is DbSet?

`DbSet<T>`:

* Represents a table
* Allows querying and tracking entities

```csharp
public DbSet<Product> Products { get; set; }
```

---

## Configuring Connection String

```csharp
services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        Configuration.GetConnectionString("DefaultConnection")));
```

---

# Migrations

## What are Migrations?

Migrations:

* Track model changes
* Generate incremental schema updates
* Keep database schema in sync with model

---

## Common CLI Commands

Package Manager Console:

* `Add-Migration MigrationName`
* `Update-Database`
* `Remove-Migration`

.NET CLI:

* `dotnet ef migrations add`
* `dotnet ef database update`

---

## Apply Migrations at Runtime

```csharp
context.Database.Migrate();
```

Recommended for development/testing, not production automation without review.

---

# Querying & LINQ

## How EF Executes Queries

* LINQ expressions are translated into SQL
* Executed against database
* Results materialized into entities

---

## IQueryable vs IEnumerable

| Feature            | IQueryable | IEnumerable          |
| ------------------ | ---------- | -------------------- |
| Executes in        | Database   | Memory               |
| Translation        | LINQ → SQL | Already materialized |
| Deferred execution | Yes        | Yes                  |

---

## Tracking vs No-Tracking

### Tracking (default)

* EF tracks entity changes
* Used for update/delete

### No-Tracking

* Better performance
* Read-only scenarios

```csharp
context.Products.AsNoTracking().ToList();
```

---

## Eager Loading

```csharp
context.Orders
    .Include(o => o.Customer)
    .ToList();
```

Loads related entities in one query.

---

## Lazy Loading

* Loads related data when accessed
* Requires:

  * `Microsoft.EntityFrameworkCore.Proxies`
  * Virtual navigation properties

---

## Explicit Loading

```csharp
context.Entry(order)
    .Collection(o => o.Items)
    .Load();
```

Manual control over loading related data.

---

# Model Configuration

## Fluent API

Configured in `OnModelCreating()`:

* Relationships
* Keys
* Constraints
* Indexes

---

## One-to-Many

```csharp
modelBuilder.Entity<Order>()
    .HasMany(o => o.Items)
    .WithOne(i => i.Order)
    .HasForeignKey(i => i.OrderId);
```

---

## Many-to-Many (EF Core 5+)

```csharp
modelBuilder.Entity<User>()
    .HasMany(u => u.Roles)
    .WithMany(r => r.Users);
```

---

## Composite Key

```csharp
modelBuilder.Entity<OrderDetail>()
    .HasKey(od => new { od.OrderId, od.ProductId });
```

---

## Data Seeding

```csharp
modelBuilder.Entity<Product>().HasData(
    new Product { Id = 1, Name = "Item1" });
```

---

# Advanced Concepts

## Transactions

```csharp
using var transaction =
    context.Database.BeginTransaction();

try
{
    context.SaveChanges();
    transaction.Commit();
}
catch
{
    transaction.Rollback();
}
```

---

## Shadow Property

Property not defined in CLR class:

```csharp
modelBuilder.Entity<Product>()
    .Property<DateTime>("CreatedDate");
```

---

## SaveChanges vs SaveChangesAsync

* `SaveChanges()` → synchronous
* `SaveChangesAsync()` → asynchronous (recommended for async flows)

---

## Change Tracking

EF Core:

* Tracks entity state (Added, Modified, Deleted, Unchanged)
* Detects changes automatically
* Generates appropriate SQL on `SaveChanges()`

---

# Performance Optimization

* Use `AsNoTracking()` for read-only queries
* Use projections:

```csharp
context.Products
    .Select(p => new { p.Id, p.Name })
    .ToList();
```

* Use compiled queries
* Limit unnecessary `Include()`

---

# Concurrency Handling

Use concurrency token:

```csharp
[Timestamp]
public byte[] RowVersion { get; set; }
```

Throws `DbUpdateConcurrencyException` if conflict detected.

---

# Global Query Filters

Used for soft delete or multi-tenancy:

```csharp
modelBuilder.Entity<Product>()
    .HasQueryFilter(p => !p.IsDeleted);
```

---

# Compiled Queries

Improve performance for frequently executed queries.

---

## Synchronous

```csharp
static readonly Func<MyDbContext, int, User?> _getUserById =
    EF.CompileQuery((MyDbContext context, int id) =>
        context.Users.FirstOrDefault(u => u.Id == id));

var user = _getUserById(dbContext, 42);
```

---

## Asynchronous

```csharp
static readonly Func<MyDbContext, int, Task<User?>> _getUserByIdAsync =
    EF.CompileAsyncQuery((MyDbContext context, int id) =>
        context.Users.FirstOrDefault(u => u.Id == id));

var user = await _getUserByIdAsync(dbContext, 42);
```

---

## When to Use

* Same query executed frequently
* Performance-sensitive hot paths
* Avoid for highly dynamic queries

---

# Query Tracking Behavior

| Method                               | Tracking     | Identity Resolution | Use Case          |
| ------------------------------------ | ------------ | ------------------- | ----------------- |
| AsTracking()                         | Yes          | Yes                 | Updates           |
| AsNoTracking()                       | No           | No                  | Read-only         |
| AsNoTrackingWithIdentityResolution() | No           | Yes                 | Complex read-only |
| UseQueryTrackingBehavior()           | Configurable | Configurable        | Global default    |

---

# Dynamic Sorting

## Option 1: System.Linq.Dynamic.Core

Install:

```
dotnet add package System.Linq.Dynamic.Core
```

Usage:

```csharp
query = query.OrderBy($"{sortBy} {sortDirection}");
```

Validate user input before applying.

---

## Option 2: Expression Trees

```csharp
public static IQueryable<T> OrderByDynamic<T>(
    this IQueryable<T> query,
    string propertyName,
    bool descending)
{
    var param = Expression.Parameter(typeof(T), "x");
    var property = Expression.PropertyOrField(param, propertyName);
    var keySelector = Expression.Lambda(property, param);

    var method = descending ? "OrderByDescending" : "OrderBy";

    var methodCall = Expression.Call(
        typeof(Queryable),
        method,
        new Type[] { typeof(T), property.Type },
        query.Expression,
        Expression.Quote(keySelector));

    return query.Provider.CreateQuery<T>(methodCall);
}
```

---

# Summary

* EF Core is a modern ORM for .NET.
* DbContext manages entities and database connection.
* Migrations manage schema changes.
* Use AsNoTracking for read-only queries.
* Use Include for eager loading.
* Handle concurrency with RowVersion.
* Compiled queries optimize hot paths.
* Validate dynamic sorting input.

---

## Notes

* Compiled queries improve performance mainly in high-throughput scenarios.
* Lazy loading requires proxies and virtual navigation properties.
* Avoid enabling lazy loading globally in performance-critical systems.
* IQueryable execution depends on provider (e.g., SQL Server provider translates to SQL).
* `IEnumerable` still supports deferred execution, but once data is materialized from the database, further filtering happens in-memory.
* Runtime migrations (`Database.Migrate()`) should be used carefully in production environments.
* Compiled queries provide marginal improvements unless executed frequently in hot paths.

```
