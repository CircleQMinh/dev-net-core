---
id: concurrency-handling-dotnet
topic: Handling Concurrency in .NET (C# / ASP.NET Core)
category: .NET
---

## Overview

Concurrency in web applications occurs when multiple users or threads attempt to access or modify the same data simultaneously.

Proper concurrency control ensures:

- Data consistency
- Prevention of race conditions
- Prevention of lost updates
- Safe parallel execution

In .NET and ASP.NET Core applications, several strategies can be used to handle concurrency.

---

#  Optimistic Concurrency (EF Core)

This is the **most common strategy when using Entity Framework Core**.

### How It Works

- A version column (`RowVersion` / `Timestamp`) is added to the table.
- EF Core checks whether the record changed since it was read.
- If the version changed, EF Core throws `DbUpdateConcurrencyException`.

### Best For

- High-read, low-write systems
- Web applications where update conflicts are rare

---

### Example Entity

```csharp
public class Product
{
    public int Id { get; set; }

    public string Name { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; }
}
````

---

### Handling Concurrency Exception

```csharp
try
{
    context.Products.Update(product);
    await context.SaveChangesAsync();
}
catch (DbUpdateConcurrencyException)
{
    // Handle concurrency conflict
}
```

---

#  Pessimistic Concurrency

Pessimistic concurrency **locks the data record while it is being edited**, forcing other transactions to wait.

This approach is less common in web applications because it can reduce scalability.

---

### Example (SQL Server Row Lock)

```sql
SELECT *
FROM Products WITH (UPDLOCK)
WHERE Id = 1;
```

---

### Best For

* Financial systems
* Critical consistency scenarios

---

#  Concurrency Token Without Timestamp

Instead of using `RowVersion`, any property can be used as a concurrency token.

EF Core verifies the value before updating the row.

---

### Example

```csharp
modelBuilder.Entity<Product>()
    .Property(p => p.Price)
    .IsConcurrencyToken();
```

---

#  In-Memory Locking (Thread Safety)

Used when protecting shared **in-memory resources**, such as:

* application cache
* singleton services
* static state

---

### Using `lock`

```csharp
private static readonly object _lock = new object();

public void UpdateSharedResource()
{
    lock (_lock)
    {
        // thread-safe code
    }
}
```

---

### Using `SemaphoreSlim` for Async Code

Since `lock` cannot be used with `await`, use `SemaphoreSlim`.

```csharp
private static readonly SemaphoreSlim _semaphore = new SemaphoreSlim(1, 1);

public async Task SafeUpdateAsync()
{
    await _semaphore.WaitAsync();

    try
    {
        // critical section
    }
    finally
    {
        _semaphore.Release();
    }
}
```

---

#  Distributed Locking

Distributed locking is required when an application runs across **multiple instances**, such as:

* Kubernetes clusters
* Azure App Service scale-out
* Load-balanced environments

---

### Common Distributed Lock Mechanisms

* Redis (Redlock algorithm)
* SQL Server application locks
* Azure Blob Lease

---

### Conceptual Redis Distributed Lock

```csharp
using (var handle = await distributedLock.TryAcquireAsync())
{
    if (handle != null)
    {
        // safe distributed operation
    }
}
```

---

### Libraries Often Used

* `Medallion.Threading`
* `RedLock.net`

---

#  Database-Level Concurrency (SQL Isolation Levels)

SQL databases provide isolation levels to control how transactions interact.

---

### SQL Server Isolation Levels

| Isolation Level  | Prevents                                           |
| ---------------- | -------------------------------------------------- |
| Read Uncommitted | Nothing (dirty reads allowed)                      |
| Read Committed   | Dirty reads                                        |
| Repeatable Read  | Dirty reads + non-repeatable reads                 |
| Serializable     | Dirty reads + non-repeatable reads + phantom reads |

---

### Example

```sql
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

BEGIN TRANSACTION;

-- read and update operations

COMMIT;
```

---

### Best For

* Strong consistency requirements
* Financial transactions

---

#  Queue-Based Sequential Processing

For sensitive operations such as:

* billing
* inventory updates
* financial transactions

Use **queues to serialize operations**.

---

### Example Technologies

* Azure Service Bus
* RabbitMQ
* Kafka

---

### Concept

Sequential processing:

```
1 queue + 1 consumer = sequential processing
```

Scaling with partitions:

```
N queues + N consumers = parallel processing
```

Partitioning by key:

* `customerId`
* `orderId`

This ensures **ordered processing per key** while still allowing horizontal scaling.

Examples:

* Azure Service Bus Sessions
* Kafka partitions
* Amazon SQS message groups

---

# Best Practices Summary

| Scenario                           | Recommended Strategy                          |
| ---------------------------------- | --------------------------------------------- |
| EF Core CRUD operations            | Optimistic concurrency (`RowVersion`)         |
| In-memory shared resources         | `lock` or `SemaphoreSlim`                     |
| Distributed environment            | Redis or distributed locks                    |
| Mission-critical transactions      | Pessimistic locking or Serializable isolation |
| Race-condition sensitive workflows | Queue-based sequential processing             |

---

# Summary

Concurrency control is essential for maintaining **data integrity and system reliability**.

Common strategies include:

* Optimistic concurrency
* Pessimistic locking
* Thread synchronization
* Distributed locks
* Database isolation levels
* Queue-based serialization

Choosing the right approach depends on **system architecture, traffic patterns, and consistency requirements**.



---

## Notes

1. **RowVersion vs Timestamp**

In SQL Server:

- `rowversion` is the correct database column type.
- `[Timestamp]` is the EF Core attribute that maps to it.

Example database column:

```sql
RowVersion rowversion
````

---

2. **Pessimistic locking in EF Core**

EF Core does **not provide direct pessimistic locking APIs**.
It is typically implemented using:

* raw SQL queries
* explicit database transactions

Example:

```csharp
await context.Database.ExecuteSqlRawAsync(
    "SELECT * FROM Products WITH (UPDLOCK) WHERE Id = {0}", id);
```

---

3. **Serializable isolation caution**

`Serializable` isolation level can cause:

* blocking
* deadlocks
* reduced throughput

Use carefully.

---

4. **Distributed locking caution**

Redis Redlock works best when:

* operations are short-lived
* lock expiration is configured correctly

For long workflows, queue-based processing is often safer.

---

5. **Queue partitioning insight**

Instead of a single queue:

```
1 queue + 1 consumer = sequential processing
```

Use partitioning:

```
N queues + N consumers = parallel processing
```

This pattern is used by systems such as:

* Azure Service Bus Sessions
* Kafka partitions
* Amazon SQS message groups

to guarantee **ordered processing per key while scaling horizontally**.
