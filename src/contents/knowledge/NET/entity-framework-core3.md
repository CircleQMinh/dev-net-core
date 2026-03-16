---
id: entity-framework-core3
topic: Entity Framework Core (EF Core) Part 3
category: .NET
---

Migrations in Entity Framework Core allow you to evolve your database schema over time while keeping it in sync with your domain model.


---

# Migrations Basics

## What Are Migrations?

Migrations:

- Track changes in your data model
- Generate SQL to update schema
- Allow incremental database evolution
- Preserve existing data

---

## Create and Apply Migrations

Create a migration:

```bash
dotnet ef migrations add MigrationName
````

Apply migration:

```bash
dotnet ef database update
```

---

## What Does `dotnet ef migrations` Do?

Common commands:

* `add` → Create migration
* `remove` → Remove last migration
* `update` → Apply migrations to database

---

## How Are Migrations Tracked?

EF Core tracks applied migrations in:

```
__EFMigrationsHistory
```

This table stores:

* Migration ID
* Product version

---

## What Happens During `database update`?

1. EF compares:

   * Code migrations
   * Applied migrations in database
2. Applies pending migrations
3. Updates `__EFMigrationsHistory`

---

# Advanced Migration Topics

## Roll Back a Migration

If not applied:

```bash
dotnet ef migrations remove
```

If already applied:

```bash
dotnet ef database update PreviousMigrationName
```

---

## Applying Migrations in Production

Possible, but:

* Backup database first
* Test in staging
* Avoid automatic schema changes without review
* Use `context.Database.Migrate()` carefully

---

## Handling Migration Conflicts (Multiple Developers)

When conflicts occur:

* Merge model changes
* Re-generate migration
* Manually adjust migration files if needed

---

## What Is a Migration Snapshot?

EF Core generates a snapshot file:

* Represents current model state
* Used to compare future changes
* Helps generate new migrations

---

# Seeding Data

## What Is Seed Data?

Seed data:

* Initial data inserted into DB
* Often default values or lookup tables
* Applied via migrations

---

## Seeding Using HasData()

```csharp
modelBuilder.Entity<Product>().HasData(
    new Product { Id = 1, Name = "Laptop", Price = 1000 },
    new Product { Id = 2, Name = "Smartphone", Price = 500 }
);
```

---

## When Is Seeding Executed?

Seed data runs when:

```csharp
context.Database.Migrate();
```

Or when migrations are applied via CLI.

---

## Can HasData() Update Existing Data?

No.

* `HasData()` is designed for deterministic seed data.
* If data changes, create a new migration.
* For dynamic updates, use custom logic.

---

## Seeding in Production

Options:

* Use migrations carefully
* Run SQL scripts
* Execute custom seed service at startup
* Avoid overwriting real production data

---

## Conditional/Dynamic Seeding

Example:

```csharp
public static void Initialize(MyDbContext context)
{
    if (!context.Products.Any())
    {
        context.Products.Add(
            new Product { Name = "Laptop", Price = 1000 });
        context.SaveChanges();
    }
}
```

This is not tracked by migrations.

---

## Seeding Related Entities

Parent first:

```csharp
modelBuilder.Entity<Category>().HasData(
    new Category { Id = 1, Name = "Electronics" }
);

modelBuilder.Entity<Product>().HasData(
    new Product
    {
        Id = 1,
        Name = "Laptop",
        Price = 1000,
        CategoryId = 1
    }
);
```

---

## Many-to-Many Seeding

Seed join table explicitly:

```csharp
modelBuilder.Entity<OrderProduct>().HasData(
    new OrderProduct { OrderId = 1, ProductId = 1 },
    new OrderProduct { OrderId = 2, ProductId = 2 }
);
```

---

# HasData vs Runtime Seeding

| Method          | Tracked by Migrations | Flexible | Use Case                    |
| --------------- | --------------------- | -------- | --------------------------- |
| HasData()       | Yes                   | No       | Static reference data       |
| Runtime Seeding | No                    | Yes      | Dynamic or conditional data |

---

## Modifying Seed Data After Migration

Options:

* Create a new migration
* Or update manually through application code

---

# Stored Procedures & EF Core

EF Core supports:

* Calling stored procedures via:

  * `FromSqlRaw()`
  * `ExecuteSqlRaw()`

Example:

```csharp
context.Products
    .FromSqlRaw("EXEC GetProducts")
    .ToList();
```

---

# EF Core vs Dapper (Brief Comparison)

| Feature          | EF Core  | Dapper    |
| ---------------- | -------- | --------- |
| Type             | Full ORM | Micro ORM |
| Change tracking  | Yes      | No        |
| Migrations       | Yes      | No        |
| Performance      | Good     | Very fast |
| Control over SQL | Moderate | Full      |

Use:

* EF Core → Complex domain, rich model
* Dapper → High-performance, SQL-focused scenarios




```csharp
// EF Core can call stored procedures:

context.Set<Product>()
    .FromSqlRaw("EXEC dbo.sp_Product_GetAll");
```

Problems:

* requires DbSet or keyless entity
* extra configuration
* awkward for arbitrary results
* harder generic abstraction

````

---

```csharp
// Dapper stored procedure call

var result = await connection.QueryAsync<T>(
    new CommandDefinition(
        commandText: procedureName,
        parameters: parameters,
        transaction: transaction,
        commandType: CommandType.StoredProcedure,
        cancellationToken: ct));

return result.AsList();
````
## Ready-to-copy content

```csharp
EF Core can call stored procedures:

context.Set<ProductDto>()
    .FromSqlRaw("EXEC dbo.sp_Product_GetAll");
```

Problems:

* requires DbSet or keyless entity
* extra configuration
* awkward for arbitrary results
* harder generic abstraction

---

```text
Summary — Which API to Use

Scenario              | EF Core Method
Returns rows          | FromSqlRaw()
Insert/Update/Delete  | ExecuteSqlInterpolatedAsync()
Scalar value          | ADO.NET command
Output parameter      | ExecuteSqlRawAsync()
```


---

# Key Interview Takeaways

* Migrations track schema evolution.
* `__EFMigrationsHistory` tracks applied migrations.
* Snapshot file compares model states.
* `HasData()` is for deterministic seeding.
* Dynamic seeding requires custom logic.
* Many-to-many requires seeding join table.
* Production migrations must be handled carefully.
* EF Core vs Dapper depends on complexity vs performance.

---

## Notes

* `HasData()` requires explicit primary key values.
* Changing seeded data requires a new migration.
* Avoid using automatic runtime migrations blindly in production.
* Snapshot file is located in the Migrations folder and updated automatically.
* `HasData()` does generate UPDATE statements if seeded data changes between migrations (based on key comparison), but it is not suitable for arbitrary runtime updates.
* `context.Database.Migrate()` applies pending migrations but should be used cautiously in production with proper migration strategy and rollback plan.
```
