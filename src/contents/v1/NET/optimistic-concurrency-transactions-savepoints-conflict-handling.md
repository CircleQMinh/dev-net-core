---
id: optimistic-concurrency-transactions-savepoints-conflict-handling
topic: Entity Framework

subtopic: Optimistic concurrency, transactions, savepoints, and conflict handling
category: .NET
---


## Overview

Optimistic concurrency, transactions, savepoints, and conflict handling are essential parts of building reliable data access code with Entity Framework Core.

In real applications, multiple users, background jobs, API requests, and services may read and update the same data at the same time. Without a clear consistency strategy, one operation can accidentally overwrite another operation, partially save invalid data, or leave the system in a state that is difficult to recover from.

Entity Framework Core provides several tools for handling these problems:

- **Optimistic concurrency** detects whether data changed after it was originally loaded.
- **Transactions** group multiple database operations into one atomic unit.
- **Savepoints** allow partial rollback inside an existing transaction.
- **Conflict handling** defines what the application should do when another process changed or deleted data first.

This topic matters in interviews because it tests practical production knowledge. Interviewers often want to know whether a developer understands more than basic CRUD. A strong candidate should be able to explain how EF Core detects concurrency conflicts, why `SaveChanges` is transactional by default, when manual transactions are needed, how to handle `DbUpdateConcurrencyException`, and how to design safe retry or merge behavior.

These concepts are commonly used in:

- APIs that update user profiles, orders, inventory, payments, or workflows
- Admin screens where multiple users can edit the same record
- Background workers that process shared queues or scheduled jobs
- Financial or business-critical systems where partial writes are unacceptable
- Distributed systems where multiple application instances write to the same database

The key interview idea is this: **transactions protect atomicity, while concurrency control protects against stale writes and lost updates**. They solve related but different problems.

## Core Concepts

### The Problem: Lost Updates and Partial Writes

A **lost update** happens when two users read the same record, both make changes, and the second save overwrites the first save without noticing.

Example:

1. User A loads product `Id = 10`, stock is `100`.
2. User B loads the same product, stock is also `100`.
3. User A changes stock to `90` and saves.
4. User B changes stock to `95` and saves.
5. User A's change is lost because User B saved stale data.

Without concurrency checking, the database may accept both updates because both target the same primary key.

A **partial write** happens when an operation saves some changes but fails before saving all required changes.

Example:

1. Create an order.
2. Deduct inventory.
3. Create a payment record.
4. Failure occurs after the order is created but before inventory is deducted.

Transactions solve this by ensuring that either all changes succeed or all changes are rolled back.

### Optimistic Concurrency

**Optimistic concurrency** assumes conflicts are uncommon. Instead of locking data when it is read, the application proceeds normally and checks during save whether the data has changed since it was loaded.

EF Core implements optimistic concurrency by using a **concurrency token**.

A concurrency token is a property whose original value is remembered by EF Core when the entity is loaded. When EF Core sends an `UPDATE` or `DELETE`, it includes the original concurrency token value in the `WHERE` clause.

Conceptually, EF Core sends SQL like this:

```sql
UPDATE Products
SET Name = @newName, Price = @newPrice
WHERE Id = @id AND RowVersion = @originalRowVersion;
```

If another transaction updated the row first, the row version no longer matches. The update affects `0` rows, and EF Core throws `DbUpdateConcurrencyException`.

This prevents silent overwrites.

### Concurrency Tokens

A **concurrency token** is a property used to detect whether a row changed after it was read.

Common options include:

- SQL Server `rowversion`
- A manually managed `Guid`
- A manually managed version number
- A `DateTime` or timestamp-like column, although this is often less reliable than `rowversion`
- One or more business columns configured as concurrency tokens

For SQL Server, the most common approach is `rowversion`.

```csharp
public class Product
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public decimal Price { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = [];
}
```

Equivalent Fluent API configuration:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<Product>()
        .Property(p => p.RowVersion)
        .IsRowVersion();
}
```

With this configuration, the database automatically changes the `RowVersion` value whenever the row is updated.

### How EF Core Detects a Concurrency Conflict

When an entity is queried, EF Core tracks:

- The entity key
- Current values
- Original values
- Concurrency token values
- Entity state

When `SaveChanges` runs, EF Core compares the original concurrency token value with the current value in the database.

Example:

```csharp
var product = await db.Products
    .SingleAsync(p => p.Id == productId, cancellationToken);

product.Price = 19.99m;

await db.SaveChangesAsync(cancellationToken);
```

If no one changed the product after it was loaded, the update succeeds.

If another user changed the product first, the generated `UPDATE` affects `0` rows, and EF Core throws:

```csharp
DbUpdateConcurrencyException
```

Important details:

- Concurrency exceptions usually happen on `UPDATE` or `DELETE`.
- Inserts usually do not produce `DbUpdateConcurrencyException`.
- Duplicate inserts usually produce provider-specific database exceptions, such as unique constraint violations.
- The exception does not automatically mean the database is broken. It means EF Core detected a stale write.

### Handling `DbUpdateConcurrencyException`

A production application must decide what to do when a concurrency conflict happens.

Common strategies:

1. **Client wins**
   - The application overwrites database values with the user's current values.
   - Risk: another user's update may be lost.

2. **Database wins**
   - The application discards the user's pending changes and reloads the database values.
   - Safer, but the user may need to reapply their changes.

3. **Merge**
   - The application compares user changes with database changes and chooses which values to keep.
   - Best for complex business screens, but requires more code and often UI support.

4. **Retry**
   - The application reloads the latest database values and retries the operation.
   - Useful for automated operations, but must be designed carefully to avoid repeated conflicts.

Example conflict handling pattern:

```csharp
public async Task UpdateProductPriceAsync(
    int productId,
    decimal newPrice,
    CancellationToken cancellationToken)
{
    var saved = false;

    while (!saved)
    {
        var product = await db.Products
            .SingleAsync(p => p.Id == productId, cancellationToken);

        product.Price = newPrice;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            saved = true;
        }
        catch (DbUpdateConcurrencyException ex)
        {
            foreach (var entry in ex.Entries)
            {
                var databaseValues = await entry.GetDatabaseValuesAsync(cancellationToken);

                if (databaseValues is null)
                {
                    throw new InvalidOperationException(
                        "The product was deleted by another user.");
                }

                entry.OriginalValues.SetValues(databaseValues);
            }
        }
    }
}
```

This pattern refreshes the original values so the next retry compares against the latest database version.

However, this example should not be copied blindly into every application. In many business workflows, automatic retry may hide a real conflict from the user. For example, if two users edit the same order, it may be better to show a conflict message instead of overwriting or silently retrying.

### Current Values, Original Values, and Database Values

When resolving a concurrency conflict, EF Core exposes three important sets of values:

| Value set | Meaning |
|---|---|
| Current values | The values the application is trying to save |
| Original values | The values originally loaded and tracked by EF Core |
| Database values | The latest values currently stored in the database |

Example merge-oriented logic:

```csharp
catch (DbUpdateConcurrencyException ex)
{
    foreach (var entry in ex.Entries)
    {
        var proposedValues = entry.CurrentValues;
        var originalValues = entry.OriginalValues;
        var databaseValues = await entry.GetDatabaseValuesAsync(cancellationToken);

        if (databaseValues is null)
        {
            throw new InvalidOperationException("The record was deleted.");
        }

        foreach (var property in proposedValues.Properties)
        {
            var proposedValue = proposedValues[property];
            var originalValue = originalValues[property];
            var databaseValue = databaseValues[property];

            // Example decision point:
            // Choose proposedValue, databaseValue, or custom merged value.
        }

        entry.OriginalValues.SetValues(databaseValues);
    }
}
```

In a real application, the merge decision should be based on business rules.

For example:

- For a user's display name, client wins may be acceptable.
- For inventory, financial amounts, or approval status, automatic overwrite may be dangerous.
- For audit fields, database values often should win.
- For independent fields, a field-by-field merge may be possible.

### Transactions

A **transaction** groups multiple database operations into a single atomic unit.

A transaction follows the idea of **all or nothing**:

- If all operations succeed, commit the transaction.
- If any operation fails, roll back the transaction.

EF Core automatically wraps a single `SaveChanges` call in a transaction when the provider supports transactions.

Example:

```csharp
order.Status = OrderStatus.Confirmed;
inventory.Quantity -= order.Quantity;
payment.Status = PaymentStatus.Captured;

await db.SaveChangesAsync(cancellationToken);
```

If all three changes are tracked by the same `DbContext`, a single `SaveChangesAsync` call is usually enough. EF Core will save them transactionally.

### Default `SaveChanges` Transaction Behavior

For most common CRUD operations, this is enough:

```csharp
db.Orders.Add(order);
db.OrderItems.AddRange(items);
db.AuditLogs.Add(auditLog);

await db.SaveChangesAsync(cancellationToken);
```

If the database provider supports transactions, EF Core makes this operation atomic. If one insert fails, the whole `SaveChanges` operation is rolled back.

This is a common interview point. Developers do not always need to manually create a transaction. Manual transactions should be used when the operation requires multiple `SaveChanges` calls, raw SQL mixed with EF Core changes, or coordination across several steps.

### Manual Transactions

Manual transactions are useful when several database operations must be committed together but cannot be represented as one simple `SaveChanges` call.

Example:

```csharp
await using var transaction = await db.Database
    .BeginTransactionAsync(cancellationToken);

try
{
    db.Orders.Add(order);
    await db.SaveChangesAsync(cancellationToken);

    db.OutboxMessages.Add(new OutboxMessage
    {
        Type = "OrderCreated",
        Payload = payload
    });

    await db.SaveChangesAsync(cancellationToken);

    await transaction.CommitAsync(cancellationToken);
}
catch
{
    await transaction.RollbackAsync(cancellationToken);
    throw;
}
```

Use manual transactions when:

- Multiple `SaveChanges` calls must succeed or fail together
- EF Core operations are mixed with raw SQL commands
- Multiple repositories share the same `DbContext`
- You need savepoints
- You need a specific isolation level

Avoid manual transactions when:

- A single `SaveChanges` is enough
- You are only wrapping code "just in case"
- You are using execution strategies incorrectly
- You are holding a transaction open across remote API calls

### Transactions and External Side Effects

Database transactions do not roll back external side effects.

For example, a transaction cannot undo:

- An email already sent
- A message already published to a message broker
- A file uploaded to blob storage
- A call to a payment gateway
- A request sent to another service

Bad example:

```csharp
await using var transaction = await db.Database.BeginTransactionAsync();

db.Orders.Add(order);
await db.SaveChangesAsync();

await emailSender.SendOrderConfirmationAsync(order.Email);

await transaction.CommitAsync();
```

If the email succeeds but the transaction fails, the user receives confirmation for an order that was not committed.

A better production pattern is the **outbox pattern**:

```csharp
db.Orders.Add(order);

db.OutboxMessages.Add(new OutboxMessage
{
    Type = "OrderConfirmationRequested",
    Payload = JsonSerializer.Serialize(new
    {
        order.Id,
        order.CustomerEmail
    })
});

await db.SaveChangesAsync(cancellationToken);
```

A background worker later sends the email and marks the outbox message as processed.

### Savepoints

A **savepoint** is a named checkpoint inside an active transaction. The application can roll back to that point without rolling back the entire transaction.

EF Core automatically creates a savepoint before `SaveChanges` when there is already an active transaction. If `SaveChanges` fails, EF Core can roll back to the savepoint and leave the transaction usable.

Manual savepoint example:

```csharp
await using var transaction = await db.Database
    .BeginTransactionAsync(cancellationToken);

try
{
    db.Orders.Add(order);
    await db.SaveChangesAsync(cancellationToken);

    await transaction.CreateSavepointAsync("BeforeInventory", cancellationToken);

    inventory.Quantity -= order.Quantity;
    await db.SaveChangesAsync(cancellationToken);

    await transaction.CommitAsync(cancellationToken);
}
catch
{
    await transaction.RollbackToSavepointAsync("BeforeInventory", cancellationToken);

    // The order insert may still be part of the transaction,
    // but the inventory update was rolled back to the savepoint.
    // Decide whether to continue, compensate, or rollback fully.

    await transaction.RollbackAsync(cancellationToken);
    throw;
}
```

Savepoints are useful when:

- You want to retry only part of a larger transaction
- You need to recover from a known failure point
- You are handling optimistic concurrency inside a manually controlled transaction
- You want finer control than full rollback

Important caution:

- Savepoints are not a replacement for good transaction design.
- Savepoints can make logic harder to understand.
- On SQL Server, savepoints are not created by EF Core when Multiple Active Result Sets is enabled.

### Conflict Handling Inside a Transaction

Concurrency conflict handling becomes more complex inside manual transactions.

Example scenario:

1. Start transaction.
2. Load an order.
3. Update order status.
4. Save changes.
5. Update inventory.
6. Save changes.
7. Inventory update hits a concurrency conflict.

A good design must answer:

- Should the entire transaction roll back?
- Should only the inventory update roll back to a savepoint?
- Should the latest inventory row be reloaded and retried?
- Should the user see a conflict message?
- Is the operation idempotent if retried?

For most business-critical operations, prefer simple and explicit handling:

```csharp
try
{
    await db.SaveChangesAsync(cancellationToken);
}
catch (DbUpdateConcurrencyException)
{
    await transaction.RollbackAsync(cancellationToken);

    throw new ConflictException(
        "The data was changed by another user. Reload and try again.");
}
```

In an API, this often maps to HTTP `409 Conflict`.

### Mapping Concurrency Conflicts to API Responses

In a Web API, a concurrency conflict should usually not return `500 Internal Server Error`.

Better options:

- `409 Conflict` when the client is trying to update stale data
- `404 Not Found` when the row was deleted by another user
- `400 Bad Request` when the request is structurally invalid
- `422 Unprocessable Entity` when the request is valid JSON but violates business rules

Example API handling:

```csharp
[HttpPut("{id:int}")]
public async Task<IActionResult> UpdateProduct(
    int id,
    UpdateProductRequest request,
    CancellationToken cancellationToken)
{
    try
    {
        await productService.UpdateAsync(id, request, cancellationToken);
        return NoContent();
    }
    catch (ConcurrencyConflictException ex)
    {
        return Conflict(new
        {
            message = ex.Message
        });
    }
}
```

A strong API contract may include the latest version value in the response so the client can reload or resubmit with the current version.

### Row Version in Request and Response Contracts

For APIs, concurrency tokens should usually be part of the update contract.

Example response DTO:

```csharp
public sealed class ProductResponse
{
    public int Id { get; init; }

    public string Name { get; init; } = string.Empty;

    public decimal Price { get; init; }

    public string RowVersion { get; init; } = string.Empty;
}
```

Because `rowversion` is a `byte[]`, it is commonly serialized as Base64.

```csharp
var response = new ProductResponse
{
    Id = product.Id,
    Name = product.Name,
    Price = product.Price,
    RowVersion = Convert.ToBase64String(product.RowVersion)
};
```

Update request:

```csharp
public sealed class UpdateProductRequest
{
    public string Name { get; init; } = string.Empty;

    public decimal Price { get; init; }

    public string RowVersion { get; init; } = string.Empty;
}
```

When updating a detached entity, the original row version must be set correctly so EF Core can include it in the concurrency check.

```csharp
public async Task UpdateAsync(
    int id,
    UpdateProductRequest request,
    CancellationToken cancellationToken)
{
    var product = await db.Products
        .SingleOrDefaultAsync(p => p.Id == id, cancellationToken);

    if (product is null)
    {
        throw new NotFoundException("Product not found.");
    }

    product.Name = request.Name;
    product.Price = request.Price;

    db.Entry(product)
        .Property(p => p.RowVersion)
        .OriginalValue = Convert.FromBase64String(request.RowVersion);

    await db.SaveChangesAsync(cancellationToken);
}
```

This allows the API to detect whether the client is updating a stale version of the resource.

### Isolation Levels vs Optimistic Concurrency Tokens

Concurrency tokens are not the only way to manage concurrency.

Databases also provide transaction isolation levels, such as:

- Read committed
- Repeatable read
- Snapshot
- Serializable

These control what data a transaction can see and how concurrent operations interact.

Comparison:

| Approach | How it works | Strengths | Trade-offs |
|---|---|---|---|
| Optimistic concurrency token | Detects stale writes during save | Good for web apps, avoids long locks | Requires conflict handling |
| Repeatable read / serializable | Prevents or blocks conflicting changes during transaction | Strong consistency | Can reduce concurrency and increase blocking |
| Snapshot isolation | Uses row versions to provide a consistent snapshot | Avoids many read locks | Can still produce update conflicts |
| Pessimistic locking | Locks data before update | Useful for high-conflict workflows | Can cause blocking and deadlocks |

Most EF Core applications use optimistic concurrency for normal edit forms and transactions for atomic saves.

### Pessimistic Concurrency Compared with Optimistic Concurrency

**Pessimistic concurrency** assumes conflicts are likely and prevents them by locking data before changes are made.

Example use cases:

- Claiming a queue job
- Reserving limited inventory
- Preventing two workers from processing the same record
- Coordinating high-contention workflows

EF Core does not have a single universal high-level pessimistic locking API that works the same across all providers. Applications often use:

- Raw SQL
- Provider-specific locking hints
- Isolation levels
- Database-specific features
- Distributed locks for cross-resource coordination

Optimistic concurrency is usually better for normal web editing because it avoids holding locks while users think, read, or edit forms.

### Execution Strategies and Manual Transactions

EF Core execution strategies can retry transient failures, such as temporary network or database availability problems.

A common mistake is manually starting a transaction while also relying on an execution strategy without using the strategy correctly.

When an execution strategy is enabled, the entire transaction block must be executed as a retryable unit.

Example pattern:

```csharp
var strategy = db.Database.CreateExecutionStrategy();

await strategy.ExecuteAsync(async () =>
{
    await using var transaction = await db.Database
        .BeginTransactionAsync(cancellationToken);

    db.Orders.Add(order);
    await db.SaveChangesAsync(cancellationToken);

    db.OutboxMessages.Add(outboxMessage);
    await db.SaveChangesAsync(cancellationToken);

    await transaction.CommitAsync(cancellationToken);
});
```

This ensures that if EF Core retries the operation, it retries the full transaction safely.

### Retrying Concurrency Conflicts

Not every concurrency conflict should be retried automatically.

Automatic retry is reasonable when:

- The operation is idempotent
- The business operation can be safely recalculated
- The new database state can be reloaded and used
- The retry count is limited
- The user does not need to make a manual decision

Automatic retry is risky when:

- The user edited a form based on old values
- Two users changed related fields
- The operation affects money, inventory, status, or approvals
- The correct outcome requires business judgment
- Retrying may cause duplicate side effects

Example retry limit:

```csharp
const int maxRetries = 3;

for (var attempt = 1; attempt <= maxRetries; attempt++)
{
    try
    {
        await ApplyBusinessChangeAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return;
    }
    catch (DbUpdateConcurrencyException) when (attempt < maxRetries)
    {
        foreach (var entry in db.ChangeTracker.Entries())
        {
            await entry.ReloadAsync(cancellationToken);
        }
    }
}

throw new ConcurrencyConflictException(
    "The operation could not be completed because the data changed.");
```

In production, retry logic should be specific to the business operation rather than a generic catch-all wrapper around every save.

### Common Mistakes

#### Ignoring `DbUpdateConcurrencyException`

Bad:

```csharp
try
{
    await db.SaveChangesAsync();
}
catch (DbUpdateConcurrencyException)
{
    // Ignore and continue
}
```

This hides data loss and can make the application appear successful when nothing was saved.

#### Treating Concurrency Conflicts as Server Errors

A stale update is often a valid business conflict, not an unexpected server failure. For APIs, map it to a meaningful response such as `409 Conflict`.

#### Using Transactions Instead of Concurrency Tokens

A transaction does not automatically prevent stale updates from a user who loaded data earlier.

For example:

1. User loads edit screen at 10:00.
2. Another user updates the same record at 10:01.
3. First user submits at 10:05.
4. A transaction around the first user's save does not know the user edited stale data unless a concurrency token is checked.

#### Holding Transactions Open Too Long

Avoid holding database transactions while:

- Calling external APIs
- Sending emails
- Waiting for user input
- Running long CPU work
- Uploading files
- Processing large batches without a clear batching strategy

Long transactions increase locking, blocking, deadlocks, and resource usage.

#### Using `Update` on Detached Entities Without Correct Original Version

If an API receives a detached DTO and calls `Update` without setting the original concurrency token, EF Core may not perform the intended stale-write check.

Prefer loading the entity, applying allowed changes, and setting the original row version from the client.

#### Confusing Transient Retry with Concurrency Retry

A transient error retry handles temporary infrastructure failure.

A concurrency retry handles a business conflict caused by changed data.

They are not the same and should not be handled blindly in the same way.

### Best Practices

Use concurrency tokens for important mutable data where lost updates matter.

Use `rowversion` for SQL Server when you need a simple row-level version token.

Include the version token in API responses and require it in update requests.

Map stale updates to clear application behavior, often `409 Conflict`.

Prefer one `SaveChanges` call for one atomic unit of work when possible.

Use manual transactions only when multiple saves or database operations must be committed together.

Keep transactions short.

Do not perform external side effects inside a database transaction unless you have a compensating or outbox strategy.

Use savepoints only when they make the failure recovery flow clearer.

Design conflict handling based on business rules, not just technical retry loops.

When using execution strategies with manual transactions, execute the entire transaction inside the strategy.

Log concurrency conflicts with enough context to diagnose them, but do not log sensitive data.

Test concurrency behavior with realistic scenarios, such as two contexts updating the same row.

Example test pattern:

```csharp
await using var db1 = CreateDbContext();
await using var db2 = CreateDbContext();

var product1 = await db1.Products.SingleAsync(p => p.Id == productId);
var product2 = await db2.Products.SingleAsync(p => p.Id == productId);

product1.Price = 10m;
await db1.SaveChangesAsync();

product2.Price = 20m;

await Assert.ThrowsAsync<DbUpdateConcurrencyException>(
    () => db2.SaveChangesAsync());
```

This verifies that the second context cannot silently overwrite the first update.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### 1. What is optimistic concurrency in EF Core?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-beginner-q01 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Optimistic concurrency is a strategy where the application assumes conflicts are rare and does not lock data when it is read. Instead, EF Core checks during `SaveChanges` whether the data has changed since it was originally loaded.

EF Core usually does this with a concurrency token, such as a SQL Server `rowversion` column. When EF Core sends an update or delete command, it includes the original concurrency token in the `WHERE` clause. If another process changed the row first, the token no longer matches, the update affects zero rows, and EF Core throws `DbUpdateConcurrencyException`.

This prevents stale data from silently overwriting newer data.

##### Key Points to Mention

- Assumes conflicts are rare
- Does not lock rows when data is read
- Uses a concurrency token
- EF Core checks the original token during `SaveChanges`
- Conflicts usually throw `DbUpdateConcurrencyException`
- Helps prevent lost updates

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-beginner-q01 -->

#### 2. What is a concurrency token?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-beginner-q02 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A concurrency token is a property used by EF Core to detect whether a row has changed since it was loaded. EF Core stores the original value of the token when it queries the entity. Later, when saving an update or delete, EF Core includes that original token value in the database command.

For SQL Server, a common concurrency token is `rowversion`, often configured with `[Timestamp]` or `.IsRowVersion()`.

If the value in the database has changed, EF Core knows another operation updated the row first and raises a concurrency exception.

##### Key Points to Mention

- Tracks whether a row has changed
- Original value is remembered by EF Core
- Included in the `UPDATE` or `DELETE` condition
- SQL Server commonly uses `rowversion`
- Can also be manually managed
- Required for reliable stale update detection

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-beginner-q02 -->

#### 3. What is a transaction?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-beginner-q03 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A transaction is a group of database operations that are treated as one atomic unit. If all operations succeed, the transaction is committed. If one operation fails, the transaction is rolled back so the database is not partially updated.

In EF Core, a single `SaveChanges` call is transactional by default when the database provider supports transactions. This means all changes tracked by the context in that save either succeed together or fail together.

##### Key Points to Mention

- Provides all-or-nothing behavior
- Prevents partial writes
- `SaveChanges` is transactional by default for relational providers
- Manual transactions are needed only for more complex flows
- Transactions protect atomicity, not necessarily stale updates

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-beginner-q03 -->

#### 4. What exception does EF Core throw when a concurrency conflict is detected?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-beginner-q04 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

EF Core throws `DbUpdateConcurrencyException` when it expects an update or delete to affect a row, but the command affects zero rows because the data has changed or been deleted since it was loaded.

This commonly happens when a concurrency token no longer matches the current database value.

##### Key Points to Mention

- Exception type is `DbUpdateConcurrencyException`
- Usually occurs during `SaveChanges`
- Common for updates or deletes
- Often means the row changed or was deleted
- Should be handled as a business conflict, not ignored

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### 5. How does EF Core use a `rowversion` column to detect concurrency conflicts?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q05 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

When an entity with a `rowversion` column is loaded, EF Core stores the original row version value. When the entity is updated, EF Core generates an `UPDATE` statement that includes both the primary key and the original row version in the `WHERE` clause.

For example, conceptually:

```sql
UPDATE Products
SET Price = @price
WHERE Id = @id AND RowVersion = @originalRowVersion;
```

If no other update happened, the row version matches and one row is updated. If another operation already changed the row, the row version is different, zero rows are updated, and EF Core throws `DbUpdateConcurrencyException`.

##### Key Points to Mention

- `rowversion` changes automatically on SQL Server updates
- EF Core tracks the original token value
- Token is included in the `WHERE` clause
- Zero affected rows means conflict
- Prevents stale writes
- Configured with `[Timestamp]` or `.IsRowVersion()`

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q05 -->

#### 6. What are Current Values, Original Values, and Database Values in concurrency conflict handling?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q06 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

When EF Core detects a concurrency conflict, it can expose three sets of values.

Current values are the values the application is trying to save. Original values are the values EF Core loaded and used for comparison. Database values are the latest values currently stored in the database.

These values help the application decide whether the client wins, the database wins, or a merge should happen.

For example, if a user changed the product name while another user changed the price, the application may be able to merge both changes. But if both changed the same business-critical field, the application may need to show a conflict to the user.

##### Key Points to Mention

- Current values: proposed changes
- Original values: values loaded earlier
- Database values: latest stored values
- Used to implement client wins, database wins, or merge
- Business rules should drive conflict resolution
- `GetDatabaseValuesAsync` can retrieve latest database values

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q06 -->

#### 7. When do you need a manual transaction in EF Core?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q07 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

A manual transaction is needed when multiple operations must commit together but cannot be handled by one simple `SaveChanges` call. This can happen when there are multiple `SaveChanges` calls, raw SQL mixed with EF Core operations, savepoints, or a specific isolation level requirement.

For simple operations where all changes are tracked by the same `DbContext`, one `SaveChanges` call is usually enough because EF Core already wraps it in a transaction.

Manual transactions should be kept short and should not include slow external calls such as sending emails or calling remote APIs.

##### Key Points to Mention

- Single `SaveChanges` is transactional by default
- Manual transactions are for multiple saves or mixed operations
- Useful for raw SQL plus EF Core changes
- Needed for explicit isolation level or savepoints
- Keep transactions short
- Avoid external side effects inside transactions

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q07 -->

#### 8. What is a savepoint, and when would you use one?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q08 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

A savepoint is a checkpoint inside an active transaction. Instead of rolling back the whole transaction, the application can roll back to a savepoint and continue from there.

EF Core can automatically create savepoints when `SaveChanges` is called inside an existing transaction. Developers can also create and roll back to savepoints manually.

Savepoints are useful when only part of a transaction should be retried or undone, such as when handling a known failure or a concurrency conflict in the middle of a larger transaction.

##### Key Points to Mention

- Savepoint is a checkpoint inside a transaction
- Allows partial rollback
- EF Core can create savepoints automatically inside an active transaction
- Can be managed manually
- Useful for retrying part of a larger operation
- SQL Server MARS affects EF Core savepoint behavior

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q08 -->

#### 9. What is the difference between optimistic concurrency and transactions?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q09 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q09 -->
<!-- question-level:intermediate -->

##### Expected Answer

Transactions and optimistic concurrency solve different problems.

A transaction makes a set of operations atomic, so they either all succeed or all roll back. Optimistic concurrency detects whether data changed since it was loaded and prevents stale updates from silently overwriting newer data.

A transaction around a save does not automatically detect that a user edited stale data from five minutes ago. For that, the application needs a concurrency token or another concurrency strategy.

In many real applications, both are used together: a transaction protects atomic writes, while a concurrency token protects against lost updates.

##### Key Points to Mention

- Transactions provide atomicity
- Optimistic concurrency prevents stale overwrites
- A transaction alone does not solve lost updates from old reads
- Concurrency tokens check original values
- Both can be used together
- Important distinction for interview scenarios

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q09 -->

#### 10. How should an API respond to an EF Core concurrency conflict?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q10 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q10 -->
<!-- question-level:intermediate -->

##### Expected Answer

An API should usually treat a concurrency conflict as a business conflict, not as an unexpected server error. A common response is HTTP `409 Conflict`, often with a message explaining that the resource was modified by another user and should be reloaded.

If the row was deleted, `404 Not Found` may be more appropriate. The API may also return the latest version of the resource or a new concurrency token so the client can decide whether to retry or show a merge UI.

The exact response should be part of the API contract.

##### Key Points to Mention

- Usually map stale updates to `409 Conflict`
- Deleted rows may map to `404 Not Found`
- Avoid returning generic `500`
- Include useful error details
- Client may need to reload latest data
- API contract should define conflict behavior

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-intermediate-q10 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### 11. How would you design conflict handling for an edit screen where multiple users can update the same record?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q11 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q11 -->
<!-- question-level:advanced -->

##### Expected Answer

A strong design would include a concurrency token in the response DTO and require the same token in update requests. When the user submits changes, the server uses the token as the original version value. If the row has changed, EF Core throws a concurrency exception.

The application then decides how to resolve the conflict. For simple screens, it may return `409 Conflict` and ask the user to reload. For richer screens, it may return current database values, the user's attempted values, and possibly original values so the client can show a merge experience.

The design should avoid blindly overwriting data. It should also define what happens if the record was deleted, which fields can be merged, and which fields require manual user decision.

##### Key Points to Mention

- Include concurrency token in read DTO
- Require token in update request
- Use token as original value during update
- Return `409 Conflict` for stale writes
- Consider merge UI for complex forms
- Business rules decide client wins, database wins, or merge
- Handle deleted rows separately

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q11 -->

#### 12. How do execution strategies affect manual transactions in EF Core?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q12 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q12 -->
<!-- question-level:advanced -->

##### Expected Answer

Execution strategies can retry transient failures. If a developer manually starts a transaction without using the execution strategy correctly, EF Core may not be able to safely retry the full operation.

The correct pattern is to get the execution strategy from the database context and execute the entire transaction block inside the strategy. That way, if a transient failure occurs, the whole unit of work can be retried from the beginning.

This is especially important for cloud databases where transient failures are expected.

##### Key Points to Mention

- Execution strategies retry transient errors
- Manual transaction must be inside the strategy delegate
- Retry must include the full unit of work
- Avoid partial retries inside an already failed transaction
- Important for cloud database resilience
- Different from concurrency conflict retry

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q12 -->

#### 13. When would you use isolation levels instead of concurrency tokens?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q13 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q13 -->
<!-- question-level:advanced -->

##### Expected Answer

Concurrency tokens are usually good for detecting stale writes in web applications. Isolation levels are useful when the transaction itself must see a consistent view of data or prevent certain concurrent changes while the transaction is running.

For example, serializable isolation may be used when checking a business invariant and then inserting or updating data based on that invariant. Snapshot isolation may be useful when a transaction needs a consistent read view without blocking readers.

However, stronger isolation levels can increase blocking, deadlocks, or retry requirements. They should be chosen carefully based on the business consistency requirement and database behavior.

##### Key Points to Mention

- Tokens detect stale writes at save time
- Isolation levels control transaction visibility and interaction
- Strong isolation can enforce business invariants
- Stronger isolation can reduce concurrency
- Snapshot isolation may still produce update conflicts
- Choose based on business consistency requirements

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q13 -->

#### 14. How would you avoid duplicate external side effects when using transactions and retries?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q14 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q14 -->
<!-- question-level:advanced -->

##### Expected Answer

External side effects such as sending emails, publishing messages, uploading files, or calling payment gateways are not rolled back by a database transaction. If a transaction fails after the side effect occurs, the system can become inconsistent.

A common solution is the outbox pattern. The application saves the business data and an outbox message in the same database transaction. A separate background process reads the outbox and performs the external side effect. The worker marks messages as processed and uses idempotency to avoid duplicates.

This design keeps the database transaction focused on durable state and makes side effects retryable.

##### Key Points to Mention

- Database transactions cannot roll back external systems
- Avoid sending emails or publishing messages inside transaction scope
- Use outbox pattern
- Save business data and outbox message atomically
- Background worker processes side effects
- Use idempotency for retries

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q14 -->

#### 15. How would you test optimistic concurrency behavior?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q15 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q15 -->
<!-- question-level:advanced -->

##### Expected Answer

A good test should use two separate `DbContext` instances to simulate two independent users or requests. Both contexts load the same row. The first context updates and saves successfully. The second context then tries to update based on its stale version and should receive `DbUpdateConcurrencyException`.

The test should use a provider that supports the required concurrency behavior. For SQL Server `rowversion`, a real SQL Server test database or appropriate integration test setup is more reliable than a simple in-memory provider.

The test should verify both the exception and the final database state.

##### Key Points to Mention

- Use two separate contexts
- Load same row in both contexts
- Save first update successfully
- Second stale update should fail
- Verify `DbUpdateConcurrencyException`
- Prefer realistic provider for integration tests
- Check final database state

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q15 -->

#### 16. What are the risks of automatically retrying every concurrency exception?

<!-- question:start:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q16 -->
<!-- question-id:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q16 -->
<!-- question-level:advanced -->

##### Expected Answer

Automatically retrying every concurrency exception can hide real business conflicts. If two users edited the same data, a retry may overwrite one user's intent or apply a change based on assumptions that are no longer true.

Automatic retry is safer for idempotent background operations where the operation can be recalculated from the latest data. It is risky for user-driven edits, financial operations, inventory, approvals, and workflow state changes.

A better approach is to decide per use case. Some conflicts should return `409 Conflict`, some can be merged, and some can be retried with a limited retry count and clear business rules.

##### Key Points to Mention

- Retry may hide business conflicts
- Can overwrite user intent
- Safer for idempotent automated operations
- Risky for money, inventory, status, and approvals
- Use limited retries
- Business rules should decide retry vs merge vs conflict response

<!-- question:end:optimistic-concurrency-transactions-savepoints-conflict-handling-advanced-q16 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
