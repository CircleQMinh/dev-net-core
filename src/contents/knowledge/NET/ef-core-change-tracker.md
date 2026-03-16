---
id: ef-core-change-tracker
topic: Entity Framework Core Change Tracker
category: .NET
---

## Overview

The **Change Tracker** is a core component of Entity Framework Core that monitors entities loaded into a `DbContext`.

Its responsibilities include:

- Tracking entities retrieved from the database
- Detecting modifications to entity properties
- Determining which SQL operations must be executed during `SaveChanges()`

Because of this mechanism, EF Core automatically generates the appropriate SQL statements:

```text
INSERT
UPDATE
DELETE
````

when `SaveChanges()` is called.

---

#  Important Concept

EF queries **do not only read from the database**.

They also consider entities **already tracked by the DbContext**.

Example scenario:

```text
Query result = Database rows + Tracked entities
```

If an entity with the same key is already tracked, EF Core may return the tracked instance instead of materializing a new one.

---

#  EF Core Entity States

Every tracked entity has a **state**.

| State     | Meaning                    | SQL on SaveChanges |
| --------- | -------------------------- | ------------------ |
| Detached  | Not tracked by DbContext   | Nothing            |
| Unchanged | Exists in DB, not modified | Nothing            |
| Added     | New entity                 | INSERT             |
| Modified  | Existing entity changed    | UPDATE             |
| Deleted   | Marked for deletion        | DELETE             |

---

# Example

```csharp
var user = new User { Name = "Alice" };

context.Users.Add(user);
```

State becomes:

```text
Added
```

On `SaveChanges()`:

```sql
INSERT INTO Users ...
```

---

#  When EF Starts Tracking Entities

EF Core begins tracking entities in several scenarios.

###  Loaded via query

```csharp
var user = context.Users.First();
```

State:

```text
Unchanged
```

---

###  Added manually

```csharp
context.Add(user);
```

State:

```text
Added
```

---

###  Attached explicitly

```csharp
context.Attach(user);
```

State:

```text
Unchanged
```

Meaning:

* Entity already exists in the database
* EF simply begins tracking it

Equivalent to:

```csharp
context.Entry(user).State = EntityState.Unchanged;
```

---

#  What `Attach()` Does

```csharp
context.Attach(entity);
```

EF sets the entity state to:

```text
Unchanged
```

Meaning:

* EF assumes the entity already exists in the database
* No SQL will be generated
* EF only begins tracking it

---

# Example

```csharp
var user = new User { Id = 10 };

context.Attach(user);
```

No database query occurs.

However, EF now tracks that entity.

---

#  How EF Detects Changes

EF Core uses two strategies.

---

##  Snapshot Tracking (Default)

EF stores **original values** and compares them with current values later.

Example:

```text
Original Name = "Alice"
Current Name = "Bob"
```

Detected during:

```text
SaveChanges()
```

---

##  Notification Tracking

Entities implement:

```text
INotifyPropertyChanged
```

EF detects changes **immediately when properties change**.

Example:

```csharp
public class User : INotifyPropertyChanged
```

This approach is less common in typical EF Core applications.

---

#  DetectChanges()

Method:

```csharp
context.ChangeTracker.DetectChanges();
```

Purpose:

```text
Force EF to scan entities and detect modifications.
```

It is usually called automatically before:

* `SaveChanges()`
* some query executions

---

# Example

```csharp
context.ChangeTracker.DetectChanges();
```

EF scans tracked entities and updates their state.

---

#  Viewing Tracked Entities

You can inspect all tracked entities:

```csharp
context.ChangeTracker.Entries()
```

Example:

```csharp
foreach (var entry in context.ChangeTracker.Entries())
{
    Console.WriteLine(entry.State);
}
```

This is useful for debugging change tracking behavior.

---

#  Disabling AutoDetectChanges

This is an **important performance optimization**.

Disable automatic change detection:

```csharp
context.ChangeTracker.AutoDetectChangesEnabled = false;
```

This is commonly used during **bulk operations**.

---

# Why This Matters

`DetectChanges()` scans all tracked entities.

Cost complexity:

```text
O(N)
```

If inserting thousands of records:

```text
N adds + N scans = O(N²)
```

Disabling automatic detection avoids repeated scans.

---

# Best Practice for Bulk Insert

Correct pattern:

```csharp
using var context = new AppDbContext();

try
{
    context.ChangeTracker.AutoDetectChangesEnabled = false;

    foreach (var item in items)
    {
        context.Add(item);
    }

    await context.SaveChangesAsync();
}
finally
{
    context.ChangeTracker.AutoDetectChangesEnabled = true;
}
```

---

# Why `try/finally` Is Important

If you forget to re-enable detection:

```text
Change tracking silently breaks
```

This can cause subtle and difficult bugs later.

---

#  AsNoTracking()

Disable tracking entirely for queries.

Example:

```csharp
var users = context.Users
    .AsNoTracking()
    .ToList();
```

Benefits:

* Faster queries
* Lower memory usage
* Ideal for read-only operations

---

# Example Use Case

API returning list of users:

```csharp
var users = await context.Users
    .AsNoTracking()
    .Select(x => new UserDto { Id = x.Id })
    .ToListAsync();
```

---

# Quick Interview Answer

If asked:

**What is EF Core Change Tracker?**

A good concise answer:

```text
The Change Tracker tracks entities loaded into a DbContext,
detects modifications to them, and determines which SQL operations
(INSERT, UPDATE, DELETE) should be executed when SaveChanges is called.
```

---

# Quick Memory Summary

Change Tracker responsibilities:

```text
Track entities
Detect changes
Generate SQL operations
```

---

# Real Performance Tips

Recommended patterns:

### Read queries

```text
AsNoTracking()
```

### Bulk inserts

```text
Disable AutoDetectChanges
```

### Debugging

```text
ChangeTracker.Entries()
```

---

# Notes

`DbContext` acts as both:

```text
Unit of Work
Change Tracker
```

Tracking large numbers of entities can increase memory usage.

Use:

```text
AsNoTracking()
```

for read-only scenarios.

Many high-performance architectures combine:

```text
EF Core (writes)
Dapper (reads)
```

especially in **CQRS-based systems**.


---

## Notes

1. The statement **“Query result = Database rows + Tracked entities”** is a simplified mental model. In reality, EF Core uses **identity resolution**: if an entity with the same key is already tracked, EF returns the tracked instance instead of creating a new one.

2. `AutoDetectChangesEnabled = false` should be used carefully. It is beneficial for **large batch operations**, but disabling it globally can cause incorrect tracking behavior if changes are not detected before `SaveChanges()`.

3. `INotifyPropertyChanged` tracking is supported but rarely used in typical EF Core applications because snapshot tracking is usually sufficient.
```
