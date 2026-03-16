---
id: ef-transaction
topic: EF Core Transactions
category: .NET
---

## Basic Concepts of Transactions

### What is a transaction in the context of EF Core?

A transaction is a way of grouping multiple database operations into a single atomic unit of work, ensuring that either all operations are committed or none are (in case of failure).

This guarantees **ACID properties**, especially atomicity and consistency.

---

### How do you manage transactions in EF Core?

EF Core supports both implicit and explicit transactions:

- **Implicit transactions**: Automatically managed by EF Core when calling `SaveChanges()` or `SaveChangesAsync()`. EF Core wraps the operation in a transaction if none exists.
- **Explicit transactions**: Manually created and controlled using `IDbContextTransaction`.

---

## Working with Transactions

### How do you start a transaction in EF Core?

You can start a transaction using the `BeginTransaction()` method on the `Database` property of the `DbContext`:

```csharp
using var transaction = context.Database.BeginTransaction();
try
{
    // Perform multiple operations
    context.SaveChanges();
    transaction.Commit();
}
catch (Exception)
{
    transaction.Rollback();
    throw;
}
````

Async version:

```csharp
using var transaction = await context.Database.BeginTransactionAsync();
try
{
    await context.SaveChangesAsync();
    await transaction.CommitAsync();
}
catch (Exception)
{
    await transaction.RollbackAsync();
    throw;
}
```

---

### What is the difference between SaveChanges() and SaveChangesAsync() in the context of transactions?

* `SaveChanges()`: Synchronous method that saves changes to the database. EF Core automatically wraps it in a transaction if none exists.
* `SaveChangesAsync()`: Asynchronous version recommended for async workflows to avoid blocking threads.

Both methods:

* Participate in an existing explicit transaction if one is active.
* Otherwise, create and manage their own internal transaction.

---

### How do you commit and roll back a transaction?

* **Commit**: `transaction.Commit()` confirms all changes made within the transaction.
* **Rollback**: `transaction.Rollback()` undoes all changes if an error occurs.

Async versions:

* `CommitAsync()`
* `RollbackAsync()`

---

### What happens if an exception is thrown during a transaction in EF Core?

* If using **implicit transactions**, EF Core automatically rolls back the transaction when `SaveChanges()` fails.
* If using **explicit transactions**, you are responsible for calling `Rollback()` (typically inside a `catch` block).

The database remains in a consistent state because uncommitted changes are not persisted.

---

## Transaction Scenarios

### How do you handle multiple transactions in EF Core?

For advanced scenarios:

* **Savepoints (nested transactions)**: EF Core supports savepoints when using relational providers. You can manually create savepoints via `IDbContextTransaction`.
* **Distributed transactions**: When working across multiple databases or data sources, you may use `TransactionScope`.

Note: Distributed transactions depend on provider support and environment configuration.

---

### What is TransactionScope in EF Core?

`TransactionScope` is a .NET feature (`System.Transactions`) that enables ambient transactions across multiple connections or data sources.

Example:

```csharp
using (var scope = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled))
{
    context.SaveChanges();
    scope.Complete();
}
```

Important notes:

* Async code requires `TransactionScopeAsyncFlowOption.Enabled`.
* Distributed transactions require proper database/provider support.
* EF Core itself does not implement distributed coordination — it relies on the underlying provider.

---

### Can EF Core automatically handle transaction rollbacks?

Yes.

When using `SaveChanges()` or `SaveChangesAsync()` without an explicit transaction:

* EF Core automatically creates a transaction.
* If a failure occurs, the transaction is rolled back automatically.

When using explicit transactions:

* You must manually call `Commit()` or `Rollback()`.

---

### Can you execute raw SQL queries inside a transaction in EF Core?

Yes.

You can execute raw SQL inside a transaction:

```csharp
using var transaction = context.Database.BeginTransaction();

context.Database.ExecuteSqlRaw("UPDATE Orders SET Status = 'Processed'");
context.SaveChanges();

transaction.Commit();
```

All operations must use the same `DbContext` instance to share the same transaction.

---

## Concurrency and Transactions

### How do you handle concurrency conflicts in EF Core?

EF Core uses **optimistic concurrency control**.

This is typically implemented using a:

* `rowversion` column (SQL Server)
* Timestamp column
* Concurrency token

When a conflict is detected, EF Core throws a `DbUpdateConcurrencyException`.

Example:

```csharp
try
{
    context.SaveChanges();
}
catch (DbUpdateConcurrencyException)
{
    // Handle concurrency conflict (retry, reload, or notify user)
}
```

---

### What happens in SaveChanges() if multiple entities have conflicting data?

If a concurrency conflict occurs:

* EF Core attempts to save all tracked changes.
* If any entity fails due to concurrency conflict, the entire transaction fails.
* The transaction is rolled back.

You must resolve the conflicting entity and retry if needed.

---

### How do you ensure consistency across multiple related entities within a transaction?

Group all related operations inside the same transaction:

```csharp
using var transaction = context.Database.BeginTransaction();
try
{
    context.Orders.Add(order);
    context.OrderItems.AddRange(orderItems);

    context.SaveChanges();
    transaction.Commit();
}
catch
{
    transaction.Rollback();
    throw;
}
```

This guarantees atomicity across related entities.

---

## Performance and Best Practices

### What is the impact of using explicit transactions on performance?

Explicit transactions can:

* Reduce transaction overhead when batching multiple operations.
* Improve consistency control.

However:

* Long-running transactions increase locking.
* They may reduce concurrency and hurt performance.
* Keep transactions as short as possible.

---

### Can you use EF Core transactions across multiple DbContext instances?

Not automatically.

If multiple `DbContext` instances use:

* The same database connection → You can share the transaction manually.
* Different connections or databases → Use `TransactionScope` (provider support required).

EF Core does not provide built-in distributed transaction management.

---

### What is SaveChangesAsync() and how does it relate to transactions?

`SaveChangesAsync()` is the asynchronous version of `SaveChanges()`.

If an explicit transaction exists, it participates in that transaction:

```csharp
using var transaction = await context.Database.BeginTransactionAsync();

await context.SaveChangesAsync();
await transaction.CommitAsync();
```

---

### What are best practices for handling transactions in EF Core?

* Keep transactions short.
* Use explicit transactions only when necessary.
* Prefer `SaveChangesAsync()` in async applications.
* Handle `DbUpdateConcurrencyException`.
* Avoid long-running business logic inside transactions.

---

### What is Database.Migrate() in the context of transactions?

`Database.Migrate()` applies pending migrations and updates the database schema.

Important:

* It executes migration operations inside its own internal transactions (when supported).
* It is not intended to be wrapped in application-level business transactions.
* Migration failure handling depends on provider capabilities.

---

## Notes

* The original statement "EF Core doesn’t natively support distributed transactions" was oversimplified. EF Core relies on `TransactionScope` and provider capabilities; distributed support depends on the database provider and environment.
* The explanation of `Database.Migrate()` was inaccurate. Migrations typically run inside transactions when supported by the provider.
* Clarified that `SaveChanges()` automatically creates a transaction only if none exists.


```
