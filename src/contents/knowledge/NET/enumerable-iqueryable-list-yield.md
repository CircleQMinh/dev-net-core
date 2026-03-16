---
id: enumerable-iqueryable-list-yield
topic: IEnumerable, IQueryable, List, and yield
category: .NET
---

## Overview

This guide explains the practical differences between:

- `IEnumerable`
- `IQueryable`
- `List`
- `yield`

These concepts are frequently used in **LINQ, EF Core, and C# collection processing**, and understanding them is important for both performance and correct behavior.

---

# 1. IEnumerable vs IQueryable

These two interfaces look similar but operate in **different environments**.

| Feature | IEnumerable | IQueryable |
|-------|-------|-------|
| Execution location | In memory | Database / provider |
| Typical usage | LINQ to Objects | LINQ to EF / SQL |
| Query type | `Func<T,bool>` | `Expression<Func<T,bool>>` |
| Execution | Local execution | Translated to SQL |

---

## IEnumerable

Works with **objects already loaded into memory**.

Example:

```csharp
var users = context.Users.ToList();

var filtered = users.Where(x => x.Age > 18);
````

Execution flow:

```text
Database → Load all rows → Filter in memory
```

---

## IQueryable

Works with **query providers** such as EF Core.

Example:

```csharp
var users = context.Users
    .Where(x => x.Age > 18);
```

Execution flow:

```text
Expression tree → SQL → Database filtering
```

Generated SQL (conceptual example):

```sql
SELECT * FROM Users WHERE Age > 18
```

---

## Key Rule

```text
IQueryable → database query
IEnumerable → in-memory collection
```

---

# 2. IEnumerable vs List

A common interview topic.

| Feature               | IEnumerable | List |
| --------------------- | ----------- | ---- |
| Iteration             | ✔           | ✔    |
| Add / Remove          | ✖           | ✔    |
| Index access          | ✖           | ✔    |
| Deferred execution    | Often       | No   |
| Read-only abstraction | ✔           | ✖    |

---

## IEnumerable

Represents:

```text
A sequence you can iterate
```

Example:

```csharp
IEnumerable<int> numbers = new List<int> {1,2,3};
```

You cannot directly:

```text
Add
Remove
Index
```

---

## List

Represents a **concrete collection implementation**.

Example:

```csharp
var numbers = new List<int> {1,2,3};
numbers.Add(4);
```

---

# 3. Collection Interface Hierarchy

Important hierarchy:

```text
IEnumerable<T>
   ↓
ICollection<T>
   ↓
IList<T>
   ↓
List<T>
```

---

## Comparison

| Feature      | IEnumerable | ICollection | IList |
| ------------ | ----------- | ----------- | ----- |
| Iterate      | ✔           | ✔           | ✔     |
| Count        | ✖           | ✔           | ✔     |
| Add / Remove | ✖           | ✔           | ✔     |
| Index access | ✖           | ✖           | ✔     |

---

# 4. The Problem `yield` Solves

Without `yield`, methods must:

1. Compute all results
2. Store them
3. Return the full collection

Example:

```csharp
public List<int> GetNumbers()
{
    var result = new List<int>();

    for (int i = 0; i < 1_000_000; i++)
        result.Add(i);

    return result;
}
```

Characteristics:

```text
All results generated first
Large memory allocation
Caller waits until finished
```

---

# 5. Using yield

`yield return` enables **lazy evaluation**.

Example:

```csharp
public IEnumerable<int> GetNumbers()
{
    for (int i = 0; i < 1_000_000; i++)
        yield return i;
}
```

Now:

```text
No list created
Values generated on demand
Execution happens during iteration
```

---

## Example Usage

```csharp
foreach(var number in GetNumbers())
{
    Console.WriteLine(number);
}
```

Each value is generated **one at a time**.

---

# 6. Why Lazy Execution Matters

The real benefit is **streaming computation**, not only memory optimization.

---

## Infinite sequences

Possible with `yield`.

```csharp
public IEnumerable<int> Counter()
{
    int i = 0;

    while(true)
        yield return i++;
}
```

Impossible with `List`.

---

## Early termination

Example:

```csharp
GetNumbers().First();
```

Only **one value is generated**.

This can produce significant performance improvements.

---

# 7. When You SHOULD Use yield

Good scenarios:

```text
Large datasets
Streaming IO
Pipelines
Early exit scenarios
Infinite sequences
```

Example:

```csharp
public IEnumerable<string> ReadLines(string path)
{
    foreach(var line in File.ReadLines(path))
        yield return line;
}
```

---

# 8. When You SHOULD NOT Use yield

Avoid using `yield` when:

```text
Results must be reused multiple times
Expensive computation would repeat
DbContext lifetime issues exist
```

---

## EF Core Trap

Example:

```csharp
public List<User> GetUsers()
{
    using var context = new AppDbContext();
    return context.Users.ToList();
}
```

Problem:

```text
DbContext disposed before enumeration
```

This can cause runtime exceptions.

---

# 9. The Real Purpose of yield

Important insight:

```text
yield enables lazy evaluation, not just memory optimization.
yield does not make code faster by itself.
Its benefit comes from lazy generation, reduced upfront work, and possible early termination.
```

Memory improvements are only a **side effect**.

The real advantages include:

```text
Streaming
Early termination
Infinite sequences
Composable pipelines
```

---

# Interview Summary

## What is `yield` in C#?

Good answer:

```text
yield enables lazy evaluation by returning elements one at a time
during enumeration instead of creating the entire collection first.
```

---

## Difference between IEnumerable and IQueryable?

Good answer:

```text
IEnumerable executes queries in memory,
while IQueryable builds expression trees that are translated
into database queries like SQL.
```

---

# Quick Mental Model

```text
IEnumerable → in memory, enumerate element by element in .NET
IQueryable → database query, build provider-translated query
List → concrete collection
yield → lazy sequence generator
```
In EF Core:
- IQueryable lets EF build SQL and push filtering to the database
- IEnumerable means further processing happens in .NET after data is being enumerated
---

# Notes

1. Many LINQ operators support **deferred execution**, such as:

```text
Where
Select
Skip
Take
```

These operators usually execute **only when the sequence is enumerated**.

However, the following operators trigger **immediate execution**:

```text
ToList
ToArray
Count
First
Any
```
Important nuance:

ToList / ToArray fully materialize the sequence

First / Any / Count are terminal operators, so yes, they trigger execution

But they do not all enumerate the same amount

Any() may stop after the first match

First() stops after first item/match

Count() may enumerate all items unless optimized by the source/provider
---

2. `yield return` compiles into a **state machine** behind the scenes.

The compiler generates an iterator class implementing:

```text
IEnumerable
IEnumerator
```

---

3. `yield break` can terminate an iterator early.

Example:

```csharp
if (value < 0)
    yield break;
```

###  `IReadOnlyCollection<T>` and `IReadOnlyList<T>`



```text
IReadOnlyCollection<T>
- Exposes Count
- Does not allow modification through the interface

IReadOnlyList<T>
- Exposes Count and index access
- Does not allow modification through the interface
```

Important interview note:

```text
Prefer returning the least powerful abstraction needed.
For example:
- IEnumerable<T> if caller only needs enumeration
- IReadOnlyList<T> if caller needs indexing
- List<T> only if caller truly needs mutation
```

###  `AsEnumerable()`, `ToList()`, and materialization boundary

```csharp
var query = context.Users.Where(x => x.IsActive);   // IQueryable
var list = query.ToList();                          // executes SQL and materializes data
var seq = query.AsEnumerable();                    // switches further operations to LINQ to Objects
```

Interview point:

* `ToList()` executes and materializes
* `AsEnumerable()` does not materialize by itself, but changes the remaining pipeline to in-memory LINQ

###  `IAsyncEnumerable<T>`
```text
IAsyncEnumerable<T> represents an async stream of elements.
It is consumed with await foreach.
```

Example:

```csharp
await foreach (var user in context.Users.AsAsyncEnumerable())
{
    Console.WriteLine(user.Name);
}
```

Interview note:

* useful for async streaming large result sets
* different from `Task<List<T>>`, which loads everything before returning

###  `yield return` restrictions / limitations
Useful notes:

* cannot use `yield return` in methods with `ref`, `in`, or `out` parameters
* cannot use `yield return` inside `catch` or `finally`
---

## Notes

1. The hierarchy diagram (`IEnumerable → ICollection → IList → List`) is **conceptual**, not strict inheritance in all cases. `List<T>` implements `IList<T>`, which implements `ICollection<T>`, which implements `IEnumerable<T>`, but other collections may skip some interfaces.

2. The SQL example generated from `IQueryable` is simplified. Actual SQL depends on the **query provider (e.g., EF Core)** and may include projections, joins, and parameterization.

3. Deferred execution applies to many LINQ operators on both `IEnumerable` and `IQueryable`. However, the **execution environment differs**: memory vs provider (database).
```
