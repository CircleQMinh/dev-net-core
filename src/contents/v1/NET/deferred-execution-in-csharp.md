---
id: deferred-execution-in-csharp
topic: Modern C# patterns
subtopic: Deferred Execution in C#
category: .NET
---



## Overview

Deferred execution in C# means that an operation is not executed when it is defined. Instead, it is executed later, usually when the result is enumerated.

This concept appears most often in LINQ, `IEnumerable<T>`, iterators using `yield return`, `IQueryable<T>`, Entity Framework Core queries, and asynchronous streams using `IAsyncEnumerable<T>`.

Deferred execution matters because it affects performance, memory usage, correctness, database access, exception timing, and debugging. A query that looks simple may not run immediately. It may run every time it is enumerated. It may also return different results if the source data changes before enumeration.

For interviews, deferred execution is important because it tests whether a developer understands more than LINQ syntax. A strong C# developer should know when queries execute, how to avoid repeated database calls, when to use `ToList()`, how `yield return` works, and why multiple enumeration can become a production bug.

## Core Concepts

### What Deferred Execution Means

Deferred execution means the query or iterator describes work to be done later.

The following query is defined but not executed immediately:

```csharp
var numbers = new List<int> { 1, 2, 3, 4, 5 };

var evenNumbers = numbers.Where(n => n % 2 == 0);
```

At this point, `Where` has not filtered the list yet. It has created an object that knows how to filter the list when someone asks for the values.

The query runs when it is enumerated:

```csharp
foreach (var number in evenNumbers)
{
    Console.WriteLine(number);
}
```

Output:

```text
2
4
```

The key idea is:

```text
Query definition != query execution
```

This is one of the most common LINQ interview topics.

### Immediate Execution

Immediate execution means the operation runs right away and produces a concrete result.

Examples:

```csharp
var numbers = new List<int> { 1, 2, 3, 4, 5 };

int count = numbers.Where(n => n > 2).Count();

List<int> result = numbers.Where(n => n > 2).ToList();

int first = numbers.Where(n => n > 2).First();
```

Common immediate execution methods include:

- `ToList()`
- `ToArray()`
- `Count()`
- `Any()`
- `All()`
- `First()`
- `Single()`
- `Max()`
- `Min()`
- `Sum()`
- `Average()`
- `Aggregate()`

Some of these return a materialized collection, such as `ToList()` and `ToArray()`. Others return a scalar value, such as `Count()` or `First()`.

### Deferred Execution in LINQ

Most LINQ methods that return `IEnumerable<T>` are deferred.

Examples:

```csharp
var query = users
    .Where(u => u.IsActive)
    .OrderBy(u => u.LastName)
    .Select(u => u.Email);
```

This query describes the pipeline:

1. Filter active users.
2. Sort them by last name.
3. Select email addresses.

The pipeline does not run until enumeration:

```csharp
foreach (var email in query)
{
    Console.WriteLine(email);
}
```

This is useful because LINQ can compose operations before executing them.

### `IEnumerable<T>` and Enumeration

`IEnumerable<T>` represents something that can be enumerated. It does not guarantee that the data is already stored in memory.

Examples of `IEnumerable<T>` sources:

```csharp
IEnumerable<int> numbers = new List<int> { 1, 2, 3 };
IEnumerable<string> lines = File.ReadLines("data.txt");
IEnumerable<int> generated = GenerateNumbers();
```

Each time a `foreach` loop runs, C# asks the enumerable for an enumerator.

Simplified mental model:

```csharp
foreach (var item in source)
{
    // use item
}
```

is similar to:

```csharp
using var enumerator = source.GetEnumerator();

while (enumerator.MoveNext())
{
    var item = enumerator.Current;
    // use item
}
```

Deferred execution is closely tied to this enumeration process.

### Multiple Enumeration

A deferred query may execute again every time it is enumerated.

```csharp
var numbers = new List<int> { 1, 2, 3, 4, 5 };

var query = numbers.Where(n =>
{
    Console.WriteLine($"Checking {n}");
    return n > 2;
});

foreach (var number in query)
{
    Console.WriteLine(number);
}

foreach (var number in query)
{
    Console.WriteLine(number);
}
```

The filter runs twice because the query is enumerated twice.

This can be harmless for in-memory collections, but expensive or incorrect for:

- database queries
- API calls
- file reads
- queries with side effects
- queries over mutable data
- queries that perform expensive calculations

If the result should be reused, materialize it:

```csharp
var result = query.ToList();

foreach (var number in result)
{
    Console.WriteLine(number);
}

foreach (var number in result)
{
    Console.WriteLine(number);
}
```

Now the filtering logic runs once.

### Source Data Is Evaluated at Enumeration Time

Deferred queries read the current state of the source when the query is enumerated, not when the query is defined.

```csharp
var names = new List<string> { "Anna", "Ben" };

var query = names.Where(name => name.StartsWith("A"));

names.Add("Alex");

foreach (var name in query)
{
    Console.WriteLine(name);
}
```

Output:

```text
Anna
Alex
```

`Alex` appears because the query was executed after `Alex` was added.

This behavior can be useful, but it can also surprise developers.

### Lazy Evaluation

Lazy evaluation means values are produced only when needed.

```csharp
var numbers = Enumerable.Range(1, 1_000_000);

var firstEven = numbers
    .Where(n => n % 2 == 0)
    .First();
```

The query does not check all one million numbers. It stops when it finds the first even number.

This can improve performance because only the necessary work is performed.

### Streaming vs Non-Streaming Deferred Operators

Deferred execution does not always mean each item is returned immediately.

Some deferred operators are streaming. They can return one item at a time.

Examples:

```csharp
Where
Select
Take
Skip
Concat
```

Example:

```csharp
var query = numbers
    .Where(n => n > 10)
    .Select(n => n * 2);
```

As each item is requested, the pipeline can process and return it.

Some deferred operators are non-streaming. They are deferred, but when enumeration starts, they may need to inspect all or many items before returning the first result.

Examples:

```csharp
OrderBy
GroupBy
Distinct
Reverse
Join
```

Example:

```csharp
var sorted = numbers.OrderBy(n => n);
```

The sorting does not happen when `OrderBy` is called. However, when enumeration starts, the operator generally needs to process the full source before returning the first sorted item.

This distinction is important for performance and memory usage.

### `yield return` and Custom Deferred Execution

C# supports deferred execution directly with iterator methods using `yield return`.

```csharp
public static IEnumerable<int> GetEvenNumbers(IEnumerable<int> numbers)
{
    foreach (var number in numbers)
    {
        Console.WriteLine($"Checking {number}");

        if (number % 2 == 0)
        {
            yield return number;
        }
    }
}
```

Usage:

```csharp
var numbers = new[] { 1, 2, 3, 4 };

var evens = GetEvenNumbers(numbers);

Console.WriteLine("Query created");

foreach (var number in evens)
{
    Console.WriteLine(number);
}
```

Output:

```text
Query created
Checking 1
Checking 2
2
Checking 3
Checking 4
4
```

The method body does not run when `GetEvenNumbers` is called. It runs when the returned sequence is enumerated.

### How `yield return` Works Conceptually

When the compiler sees `yield return`, it generates a state machine.

Instead of returning all values at once, the method returns an object that remembers where it stopped.

```csharp
public static IEnumerable<int> CountToThree()
{
    yield return 1;
    yield return 2;
    yield return 3;
}
```

Each call to `MoveNext()` advances to the next `yield return`.

This allows efficient iteration without building a full collection first.

### `IEnumerable<T>` vs `IQueryable<T>`

`IEnumerable<T>` is usually used for in-memory enumeration.

`IQueryable<T>` is usually used for remote query providers, such as Entity Framework Core.

Example:

```csharp
IQueryable<User> query = dbContext.Users
    .Where(u => u.IsActive)
    .OrderBy(u => u.LastName);
```

This query is not executed immediately. It is represented as an expression tree that a provider can translate, often into SQL.

Execution happens when the query is materialized or enumerated:

```csharp
List<User> users = await query.ToListAsync();
```

With Entity Framework Core, this is the difference between composing a database query and actually sending it to the database.

### Deferred Execution with Entity Framework Core

Deferred execution is especially important in EF Core.

```csharp
var query = dbContext.Products
    .Where(p => p.Price > 100);

query = query.Where(p => p.IsActive);

var products = await query.ToListAsync();
```

The database query is built step by step. It is sent to the database when `ToListAsync()` is called.

This is useful because it allows dynamic query composition:

```csharp
IQueryable<Product> query = dbContext.Products;

if (!string.IsNullOrWhiteSpace(search))
{
    query = query.Where(p => p.Name.Contains(search));
}

if (minPrice is not null)
{
    query = query.Where(p => p.Price >= minPrice);
}

var results = await query.ToListAsync();
```

However, it can also cause problems if a query is enumerated multiple times:

```csharp
var query = dbContext.Products.Where(p => p.IsActive);

var count = await query.CountAsync();
var items = await query.ToListAsync();
```

This sends two database queries. That may be acceptable, but developers should understand it.

### Materialization

Materialization means converting a deferred query into a concrete result.

Examples:

```csharp
var list = query.ToList();
var array = query.ToArray();
var dictionary = query.ToDictionary(x => x.Id);
```

Materialization is useful when:

- the result will be reused multiple times
- the source might change
- the database context will be disposed
- you want predictable exception timing
- you want to avoid repeated expensive work
- you want to separate query execution from later business logic

Example:

```csharp
public async Task<IReadOnlyList<ProductDto>> GetProductsAsync()
{
    var products = await dbContext.Products
        .Where(p => p.IsActive)
        .Select(p => new ProductDto(p.Id, p.Name))
        .ToListAsync();

    return products;
}
```

The method returns already-loaded data instead of returning a query tied to the lifetime of the `DbContext`.

### Deferred Execution and Resource Lifetime

Deferred execution can cause bugs when the underlying resource is disposed before enumeration.

Problem:

```csharp
public IEnumerable<string> ReadLines()
{
    using var reader = new StreamReader("data.txt");

    while (!reader.EndOfStream)
    {
        yield return reader.ReadLine()!;
    }
}
```

This example can work because the `using` scope is part of the iterator state machine and remains active during enumeration.

However, this pattern can be dangerous when returning deferred queries from disposed services or database contexts.

Problem with EF Core:

```csharp
public IQueryable<Product> GetProducts()
{
    using var dbContext = new AppDbContext();

    return dbContext.Products.Where(p => p.IsActive);
}
```

The returned query depends on a disposed context. It will fail when enumerated.

Better:

```csharp
public async Task<List<Product>> GetProductsAsync()
{
    await using var dbContext = new AppDbContext();

    return await dbContext.Products
        .Where(p => p.IsActive)
        .ToListAsync();
}
```

### Deferred Execution and Exceptions

With deferred execution, exceptions may happen later than expected.

```csharp
var query = numbers.Select(n => 10 / n);
```

If `numbers` contains zero, the exception is not thrown when the query is defined.

It is thrown during enumeration:

```csharp
foreach (var value in query)
{
    Console.WriteLine(value);
}
```

This matters when debugging and when choosing where to catch exceptions.

### Side Effects in LINQ Queries

A common mistake is putting side effects inside LINQ queries.

Bad example:

```csharp
var processed = orders.Select(order =>
{
    order.MarkAsProcessed();
    return order;
});
```

Nothing happens until `processed` is enumerated. If it is enumerated twice, the side effect may run twice.

Better:

```csharp
foreach (var order in orders)
{
    order.MarkAsProcessed();
}
```

LINQ should usually be used for querying and projection, not for changing state.

### Captured Variables

LINQ queries can capture variables from the surrounding scope.

```csharp
int threshold = 10;

var query = numbers.Where(n => n > threshold);

threshold = 20;

var result = query.ToList();
```

The query uses the value of `threshold` at execution time, so it filters using `20`.

To avoid confusion, store values intentionally before defining or executing the query.

```csharp
int threshold = GetThreshold();

var result = numbers
    .Where(n => n > threshold)
    .ToList();
```

### Modifying a Collection During Enumeration

Changing a collection while it is being enumerated can throw an exception.

```csharp
foreach (var item in items)
{
    if (item.IsDeleted)
    {
        items.Remove(item);
    }
}
```

Better:

```csharp
var deletedItems = items
    .Where(item => item.IsDeleted)
    .ToList();

foreach (var item in deletedItems)
{
    items.Remove(item);
}
```

The `ToList()` creates a snapshot of the items to remove.

### `File.ReadLines` vs `File.ReadAllLines`

Deferred execution is useful for large files.

```csharp
IEnumerable<string> lines = File.ReadLines("large-file.txt");
```

`File.ReadLines` reads lines lazily as they are enumerated.

```csharp
string[] lines = File.ReadAllLines("large-file.txt");
```

`File.ReadAllLines` loads the whole file into memory immediately.

Use `ReadLines` when streaming large files is better. Use `ReadAllLines` when the full file is needed in memory.

### `IEnumerable<T>` vs `List<T>` Return Types

Returning `IEnumerable<T>` can communicate that the result can be enumerated, but it may also hide deferred execution.

Example:

```csharp
public IEnumerable<UserDto> GetUsers()
{
    return users.Select(u => new UserDto(u.Id, u.Name));
}
```

This returns a deferred query.

If callers may enumerate multiple times, or if the data should be stable, return a materialized collection:

```csharp
public IReadOnlyList<UserDto> GetUsers()
{
    return users
        .Select(u => new UserDto(u.Id, u.Name))
        .ToList();
}
```

A practical guideline:

- Return `IEnumerable<T>` when streaming or deferred behavior is intentional.
- Return `IReadOnlyList<T>` when returning a stable in-memory result.
- Return `IQueryable<T>` only from carefully designed query-building APIs, not casually from service layers.

### Async Deferred Execution with `IAsyncEnumerable<T>`

`IAsyncEnumerable<T>` supports asynchronous streaming.

```csharp
public async IAsyncEnumerable<int> GetNumbersAsync()
{
    for (int i = 1; i <= 3; i++)
    {
        await Task.Delay(100);
        yield return i;
    }
}
```

Usage:

```csharp
await foreach (var number in GetNumbersAsync())
{
    Console.WriteLine(number);
}
```

Like `IEnumerable<T>`, the method does not produce all results immediately. Values are produced as the async sequence is consumed.

This is useful for:

- streaming database results
- reading large files
- consuming paginated APIs
- real-time data pipelines
- reducing memory pressure

### Performance Benefits

Deferred execution can improve performance by:

- avoiding unnecessary work
- processing only needed items
- supporting query composition
- reducing memory allocation
- enabling streaming pipelines
- allowing providers to optimize queries before execution

Example:

```csharp
var firstMatch = products
    .Where(p => p.IsActive)
    .Select(p => p.Name)
    .FirstOrDefault();
```

The query can stop once the first matching item is found.

### Performance Risks

Deferred execution can also hurt performance when misunderstood.

Problem:

```csharp
var activeUsers = users.Where(u => u.IsActive);

var count = activeUsers.Count();

foreach (var user in activeUsers)
{
    SendEmail(user);
}
```

The filter runs once for `Count()` and again for the `foreach`.

Better:

```csharp
var activeUsers = users
    .Where(u => u.IsActive)
    .ToList();

var count = activeUsers.Count;

foreach (var user in activeUsers)
{
    SendEmail(user);
}
```

For EF Core, the first version may result in multiple database queries.

### Common Mistakes

Common mistakes include:

- assuming a LINQ query executes when declared
- enumerating the same deferred query multiple times
- returning `IQueryable<T>` from service layers without clear ownership
- using side effects inside `Select`, `Where`, or other LINQ methods
- forgetting that source data changes affect deferred queries
- disposing a context or resource before enumeration
- using `ToList()` too early and losing database-side filtering
- using `ToList()` too late and causing lifetime or repeated execution bugs
- not understanding that `OrderBy` is deferred but still needs buffering
- mixing `IEnumerable<T>` and `IQueryable<T>` without understanding where execution happens

### Best Practices

Use deferred execution intentionally.

Good habits:

- Keep LINQ queries side-effect free.
- Materialize with `ToList()` or `ToArray()` when you need a stable snapshot.
- Avoid returning `IQueryable<T>` from application services unless there is a clear reason.
- Use `IQueryable<T>` inside repositories or query builders to compose database queries before execution.
- Be careful with multiple enumeration.
- Avoid expensive logic inside deferred queries unless needed.
- Materialize before disposing a `DbContext`, stream, or other resource.
- Use `Any()` instead of `Count() > 0` when checking existence.
- Use `FirstOrDefault()` or `Take()` to avoid reading more data than necessary.
- Push filters before materialization when using EF Core.
- Prefer clear code over clever LINQ chains.

### Comparison: Deferred Execution vs Immediate Execution

| Aspect | Deferred Execution | Immediate Execution |
|---|---|---|
| When it runs | When enumerated | When the method is called |
| Common return types | `IEnumerable<T>`, `IQueryable<T>` | `List<T>`, array, scalar values |
| Memory usage | Often lower | Often higher |
| Reuse | May re-run each time | Reuses stored result |
| Source changes | Reflected at enumeration time | Snapshot at execution time |
| Common examples | `Where`, `Select`, `Take` | `ToList`, `Count`, `First` |
| Main risk | Unexpected repeated execution | Unnecessary memory usage |

### Comparison: `IEnumerable<T>` vs `IQueryable<T>`

| Aspect | `IEnumerable<T>` | `IQueryable<T>` |
|---|---|---|
| Main use | In-memory sequences | Remote query providers |
| Query representation | Delegates and iterators | Expression trees |
| Execution location | Usually application memory | Often database or remote provider |
| Common provider | LINQ to Objects | EF Core |
| Materialization | `ToList()`, `ToArray()` | `ToListAsync()`, `FirstOrDefaultAsync()` |
| Main risk | Multiple enumeration | Unexpected database queries or translation issues |

### Real-World Usage

Deferred execution appears in real projects when:

- filtering and projecting in-memory collections
- building EF Core queries dynamically
- streaming large files
- processing large datasets without loading everything into memory
- implementing custom iterators
- building reusable query pipelines
- exposing async streams from APIs or services

Example from a service method:

```csharp
public async Task<IReadOnlyList<CustomerDto>> SearchCustomersAsync(
    string? keyword,
    bool activeOnly)
{
    IQueryable<Customer> query = dbContext.Customers;

    if (activeOnly)
    {
        query = query.Where(c => c.IsActive);
    }

    if (!string.IsNullOrWhiteSpace(keyword))
    {
        query = query.Where(c => c.Name.Contains(keyword));
    }

    return await query
        .OrderBy(c => c.Name)
        .Select(c => new CustomerDto(c.Id, c.Name, c.Email))
        .ToListAsync();
}
```

This is a good use of deferred execution because the query is composed first and executed once.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

<!-- question:start:deferred-execution-beginner-q01 -->
<!-- question-id:deferred-execution-beginner-q01 -->
<!-- question-level:beginner -->
#### What is deferred execution in C#?

##### Expected Answer

Deferred execution means an operation is not executed when it is defined. Instead, it runs later when the result is needed, usually when an `IEnumerable<T>` or `IQueryable<T>` is enumerated.

In LINQ, many methods such as `Where`, `Select`, and `Take` are deferred. They create a query pipeline but do not process the data immediately.

Example:

```csharp
var query = numbers.Where(n => n > 10);
```

This query does not run immediately. It runs when used in a `foreach`, `ToList()`, `Count()`, `First()`, or another operation that forces execution.

##### Key Points to Mention

- Query definition is separate from query execution.
- Many LINQ methods are deferred.
- Enumeration triggers execution.
- Deferred execution can improve performance but can also surprise developers.
<!-- question:end:deferred-execution-beginner-q01 -->

<!-- question:start:deferred-execution-beginner-q02 -->
<!-- question-id:deferred-execution-beginner-q02 -->
<!-- question-level:beginner -->
#### Which LINQ methods use deferred execution?

##### Expected Answer

Many LINQ methods that return `IEnumerable<T>` use deferred execution.

Common examples include:

```csharp
Where
Select
Take
Skip
OrderBy
GroupBy
Distinct
Concat
```

They do not immediately produce final results. They return a sequence that executes when enumerated.

Methods that return scalar values or materialized collections usually execute immediately.

Examples:

```csharp
ToList()
ToArray()
Count()
First()
Any()
Sum()
Max()
Min()
```

##### Key Points to Mention

- Methods returning `IEnumerable<T>` are often deferred.
- Methods returning scalar values usually execute immediately.
- `ToList()` and `ToArray()` force materialization.
- `OrderBy` is deferred but may still buffer data when execution begins.
<!-- question:end:deferred-execution-beginner-q02 -->

<!-- question:start:deferred-execution-beginner-q03 -->
<!-- question-id:deferred-execution-beginner-q03 -->
<!-- question-level:beginner -->
#### What causes a deferred LINQ query to execute?

##### Expected Answer

A deferred LINQ query executes when it is enumerated or when a terminal operation requires the result.

Examples:

```csharp
foreach (var item in query)
{
    Console.WriteLine(item);
}
```

```csharp
var list = query.ToList();
```

```csharp
var count = query.Count();
```

```csharp
var first = query.FirstOrDefault();
```

Enumeration or materialization forces the query to run.

##### Key Points to Mention

- `foreach` triggers execution.
- `ToList()` and `ToArray()` trigger execution.
- Scalar operators like `Count()` and `First()` trigger execution.
- Query variables may only store query definitions until execution.
<!-- question:end:deferred-execution-beginner-q03 -->

<!-- question:start:deferred-execution-beginner-q04 -->
<!-- question-id:deferred-execution-beginner-q04 -->
<!-- question-level:beginner -->
#### What is the difference between `IEnumerable<T>` and `List<T>` in this context?

##### Expected Answer

`IEnumerable<T>` represents a sequence that can be enumerated. It may be deferred, streamed, generated, or backed by a collection.

`List<T>` is a concrete in-memory collection. If a LINQ query is converted to a list using `ToList()`, the query executes immediately and stores the results.

Example:

```csharp
IEnumerable<int> query = numbers.Where(n => n > 10);
List<int> list = numbers.Where(n => n > 10).ToList();
```

The first line defines a deferred query. The second line executes the query immediately and stores the result.

##### Key Points to Mention

- `IEnumerable<T>` can represent deferred execution.
- `List<T>` is already materialized.
- `ToList()` creates a snapshot.
- Returning `List<T>` or `IReadOnlyList<T>` can make execution timing clearer.
<!-- question:end:deferred-execution-beginner-q04 -->

<!-- question:start:deferred-execution-beginner-q05 -->
<!-- question-id:deferred-execution-beginner-q05 -->
<!-- question-level:beginner -->
#### What does `ToList()` do in a LINQ query?

##### Expected Answer

`ToList()` forces immediate execution of a LINQ query and stores the results in a `List<T>`.

Example:

```csharp
var activeUsers = users
    .Where(u => u.IsActive)
    .ToList();
```

After `ToList()` runs, `activeUsers` contains a concrete list. Reusing the list does not re-run the original query.

`ToList()` is useful when you need a stable snapshot, want to avoid multiple enumeration, or need to materialize data before a resource such as a database context is disposed.

##### Key Points to Mention

- `ToList()` materializes the query.
- It prevents repeated execution of the same deferred query.
- It uses memory to store the result.
- It should not be used too early if more filtering can be done by a database provider.
<!-- question:end:deferred-execution-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

<!-- question:start:deferred-execution-intermediate-q01 -->
<!-- question-id:deferred-execution-intermediate-q01 -->
<!-- question-level:intermediate -->
#### Why can multiple enumeration be a problem?

##### Expected Answer

Multiple enumeration means iterating over the same deferred query more than once. Each enumeration may re-execute the query.

Example:

```csharp
var activeUsers = users.Where(u => u.IsActive);

int count = activeUsers.Count();

foreach (var user in activeUsers)
{
    Console.WriteLine(user.Name);
}
```

The filter may run twice. If `activeUsers` is an EF Core query, this may send two database queries. If the query reads a file or calls an API, the external operation may happen multiple times.

The solution is to materialize the query when the result should be reused:

```csharp
var activeUsers = users
    .Where(u => u.IsActive)
    .ToList();
```

##### Key Points to Mention

- Deferred queries may run each time they are enumerated.
- Multiple enumeration can cause performance issues.
- In EF Core, it can cause multiple database calls.
- Materialize when you need to reuse results.
<!-- question:end:deferred-execution-intermediate-q01 -->

<!-- question:start:deferred-execution-intermediate-q02 -->
<!-- question-id:deferred-execution-intermediate-q02 -->
<!-- question-level:intermediate -->
#### What is the difference between lazy evaluation and eager evaluation?

##### Expected Answer

Lazy evaluation processes values only when they are needed. Many deferred LINQ operators use lazy evaluation, especially streaming operators like `Where` and `Select`.

Example:

```csharp
var first = numbers
    .Where(n => n > 100)
    .FirstOrDefault();
```

The query can stop once the first matching value is found.

Eager evaluation processes more data upfront. Some operators are deferred but eager internally when enumeration begins. For example, `OrderBy` is deferred, but it generally needs to sort the whole source before returning the first sorted item.

##### Key Points to Mention

- Lazy evaluation produces values on demand.
- Eager evaluation processes data upfront.
- Deferred execution and lazy evaluation are related but not identical.
- `OrderBy` is deferred but not fully streaming.
<!-- question:end:deferred-execution-intermediate-q02 -->

<!-- question:start:deferred-execution-intermediate-q03 -->
<!-- question-id:deferred-execution-intermediate-q03 -->
<!-- question-level:intermediate -->
#### What is the difference between streaming and non-streaming deferred operators?

##### Expected Answer

Streaming deferred operators can process and return one element at a time.

Examples:

```csharp
Where
Select
Take
Skip
```

Non-streaming deferred operators are still deferred, but when enumeration begins, they may need to process the whole source or a large part of it before producing the first result.

Examples:

```csharp
OrderBy
GroupBy
Reverse
Distinct
```

This difference matters for memory usage and performance.

##### Key Points to Mention

- Streaming operators can yield items as they are processed.
- Non-streaming operators may buffer data.
- Both can still be deferred.
- `OrderBy` is a common example of a deferred but non-streaming operation.
<!-- question:end:deferred-execution-intermediate-q03 -->

<!-- question:start:deferred-execution-intermediate-q04 -->
<!-- question-id:deferred-execution-intermediate-q04 -->
<!-- question-level:intermediate -->
#### How does deferred execution affect Entity Framework Core queries?

##### Expected Answer

In EF Core, queries are often represented as `IQueryable<T>`. The query is composed in C# but not sent to the database until it is executed.

Example:

```csharp
var query = dbContext.Users.Where(u => u.IsActive);

if (!string.IsNullOrWhiteSpace(search))
{
    query = query.Where(u => u.Name.Contains(search));
}

var users = await query.ToListAsync();
```

The database call happens at `ToListAsync()`, not when the query variable is created.

This allows dynamic query composition, but developers must avoid accidental multiple execution and must not return queries tied to a disposed `DbContext`.

##### Key Points to Mention

- EF Core uses `IQueryable<T>` and expression trees.
- Queries are composed before execution.
- `ToListAsync()`, `FirstOrDefaultAsync()`, and `CountAsync()` execute the database query.
- Multiple enumeration can cause multiple database calls.
- Materialize before the `DbContext` is disposed.
<!-- question:end:deferred-execution-intermediate-q04 -->

<!-- question:start:deferred-execution-intermediate-q05 -->
<!-- question-id:deferred-execution-intermediate-q05 -->
<!-- question-level:intermediate -->
#### Why are side effects inside LINQ queries dangerous?

##### Expected Answer

Side effects inside LINQ queries are dangerous because deferred execution controls when and how often the query runs.

Bad example:

```csharp
var query = orders.Select(order =>
{
    order.MarkAsProcessed();
    return order;
});
```

If `query` is never enumerated, no orders are processed. If `query` is enumerated twice, orders may be processed twice.

Side effects should usually be handled with explicit loops or commands.

Better:

```csharp
foreach (var order in orders)
{
    order.MarkAsProcessed();
}
```

##### Key Points to Mention

- LINQ should usually be side-effect free.
- Deferred execution delays side effects.
- Multiple enumeration can repeat side effects.
- Use explicit loops for state changes.
<!-- question:end:deferred-execution-intermediate-q05 -->

<!-- question:start:deferred-execution-intermediate-q06 -->
<!-- question-id:deferred-execution-intermediate-q06 -->
<!-- question-level:intermediate -->
#### How does `yield return` implement deferred execution?

##### Expected Answer

`yield return` lets a method return values one at a time instead of building a full collection first.

Example:

```csharp
public static IEnumerable<int> GetNumbers()
{
    yield return 1;
    yield return 2;
    yield return 3;
}
```

The method body does not fully execute when `GetNumbers()` is called. It executes as the returned sequence is enumerated.

The compiler transforms the iterator method into a state machine that remembers the current position between calls to `MoveNext()`.

##### Key Points to Mention

- `yield return` creates an iterator.
- Values are produced on demand.
- The compiler generates a state machine.
- Useful for streaming and custom sequence generation.
<!-- question:end:deferred-execution-intermediate-q06 -->

<!-- question:start:deferred-execution-intermediate-q07 -->
<!-- question-id:deferred-execution-intermediate-q07 -->
<!-- question-level:intermediate -->
#### When should you call `ToList()`?

##### Expected Answer

Call `ToList()` when you need to execute the query immediately and store the results.

Good reasons include:

- avoiding multiple enumeration
- creating a stable snapshot
- materializing data before disposing a resource
- separating database access from business logic
- returning a concrete result from a service
- debugging query results

However, avoid calling `ToList()` too early when using EF Core. If you materialize before applying filters, sorting, or paging, you may load too much data into memory.

Bad example:

```csharp
var users = await dbContext.Users.ToListAsync();

var activeUsers = users.Where(u => u.IsActive);
```

Better:

```csharp
var activeUsers = await dbContext.Users
    .Where(u => u.IsActive)
    .ToListAsync();
```

##### Key Points to Mention

- `ToList()` forces execution.
- It is useful for snapshots and reuse.
- It can prevent repeated work.
- In EF Core, filter before materializing.
<!-- question:end:deferred-execution-intermediate-q07 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

<!-- question:start:deferred-execution-advanced-q01 -->
<!-- question-id:deferred-execution-advanced-q01 -->
<!-- question-level:advanced -->
#### Explain the difference between `IEnumerable<T>` deferred execution and `IQueryable<T>` deferred execution.

##### Expected Answer

`IEnumerable<T>` deferred execution usually works through delegates and iterators in application memory. LINQ to Objects methods like `Where` and `Select` operate on objects already available in memory or streamed locally.

`IQueryable<T>` deferred execution represents the query as an expression tree. A provider, such as EF Core, can inspect the expression tree and translate it to another query language such as SQL.

Example:

```csharp
IEnumerable<User> memoryQuery = users.Where(u => u.IsActive);

IQueryable<User> databaseQuery = dbContext.Users.Where(u => u.IsActive);
```

The first query runs in memory. The second query may be translated into SQL and executed by the database when materialized.

##### Key Points to Mention

- `IEnumerable<T>` uses delegates and local iteration.
- `IQueryable<T>` uses expression trees.
- `IQueryable<T>` allows provider translation.
- EF Core queries are usually executed at materialization.
- Mixing the two incorrectly can change where filtering happens.
<!-- question:end:deferred-execution-advanced-q01 -->

<!-- question:start:deferred-execution-advanced-q02 -->
<!-- question-id:deferred-execution-advanced-q02 -->
<!-- question-level:advanced -->
#### Why can returning `IQueryable<T>` from a service layer be risky?

##### Expected Answer

Returning `IQueryable<T>` from a service layer exposes query composition to callers and delays execution outside the service boundary. This can cause several problems:

- the caller may execute the query multiple times
- the query may depend on a disposed `DbContext`
- business rules may be bypassed
- callers may add inefficient filters or projections
- exceptions happen outside the expected layer
- persistence concerns leak into application or presentation layers

A safer pattern is to execute the query inside the service and return a DTO collection:

```csharp
public async Task<IReadOnlyList<UserDto>> GetActiveUsersAsync()
{
    return await dbContext.Users
        .Where(u => u.IsActive)
        .Select(u => new UserDto(u.Id, u.Name))
        .ToListAsync();
}
```

Returning `IQueryable<T>` can be acceptable in carefully controlled query-building abstractions, but it should be intentional.

##### Key Points to Mention

- `IQueryable<T>` leaks query execution details.
- It can create lifetime problems with `DbContext`.
- It may allow callers to bypass intended constraints.
- Prefer returning DTOs or materialized read models from services.
<!-- question:end:deferred-execution-advanced-q02 -->

<!-- question:start:deferred-execution-advanced-q03 -->
<!-- question-id:deferred-execution-advanced-q03 -->
<!-- question-level:advanced -->
#### How can deferred execution cause bugs with disposed resources?

##### Expected Answer

Deferred queries may depend on resources that must remain alive until enumeration. If the resource is disposed before the query is enumerated, execution can fail.

Problem:

```csharp
public IQueryable<Product> GetProducts()
{
    using var dbContext = new AppDbContext();

    return dbContext.Products.Where(p => p.IsActive);
}
```

The method returns a query that depends on a disposed context. The actual database access occurs later, after the context is gone.

Better:

```csharp
public async Task<List<Product>> GetProductsAsync()
{
    await using var dbContext = new AppDbContext();

    return await dbContext.Products
        .Where(p => p.IsActive)
        .ToListAsync();
}
```

##### Key Points to Mention

- Deferred execution delays access to the resource.
- The resource must remain alive until enumeration completes.
- This is common with EF Core, streams, and file readers.
- Materialize inside the resource lifetime when needed.
<!-- question:end:deferred-execution-advanced-q03 -->

<!-- question:start:deferred-execution-advanced-q04 -->
<!-- question-id:deferred-execution-advanced-q04 -->
<!-- question-level:advanced -->
#### What happens when a variable captured by a LINQ query changes before enumeration?

##### Expected Answer

A LINQ query can capture variables from the surrounding scope. Because the query executes later, it may use the variable's value at execution time, not at query definition time.

Example:

```csharp
int threshold = 10;

var query = numbers.Where(n => n > threshold);

threshold = 20;

var result = query.ToList();
```

The query uses `20`, because execution happens after `threshold` changes.

This can be useful, but it can also create confusing bugs. Developers should materialize earlier or avoid changing captured variables when query timing matters.

##### Key Points to Mention

- LINQ lambdas can close over variables.
- Deferred execution uses captured variable values at execution time.
- Changing variables before enumeration can change results.
- Materialize or use local immutable values for clarity.
<!-- question:end:deferred-execution-advanced-q04 -->

<!-- question:start:deferred-execution-advanced-q05 -->
<!-- question-id:deferred-execution-advanced-q05 -->
<!-- question-level:advanced -->
#### How would you design a method that returns data without accidentally exposing deferred execution problems?

##### Expected Answer

The design depends on intent.

If the method should return stable data, materialize inside the method and return `IReadOnlyList<T>`:

```csharp
public async Task<IReadOnlyList<OrderDto>> GetOpenOrdersAsync()
{
    return await dbContext.Orders
        .Where(o => o.Status == OrderStatus.Open)
        .Select(o => new OrderDto(o.Id, o.CustomerName))
        .ToListAsync();
}
```

If the method intentionally streams data, return `IAsyncEnumerable<T>` or `IEnumerable<T>` and document that behavior:

```csharp
public async IAsyncEnumerable<OrderDto> StreamOpenOrdersAsync()
{
    await foreach (var order in dbContext.Orders
        .Where(o => o.Status == OrderStatus.Open)
        .AsAsyncEnumerable())
    {
        yield return new OrderDto(order.Id, order.CustomerName);
    }
}
```

Avoid returning `IQueryable<T>` from general service methods unless the caller is explicitly responsible for composing and executing the query.

##### Key Points to Mention

- Choose return type based on execution semantics.
- Use `IReadOnlyList<T>` for stable materialized results.
- Use `IEnumerable<T>` or `IAsyncEnumerable<T>` for intentional streaming.
- Avoid accidental `IQueryable<T>` leakage.
- Keep resource lifetimes clear.
<!-- question:end:deferred-execution-advanced-q05 -->

<!-- question:start:deferred-execution-advanced-q06 -->
<!-- question-id:deferred-execution-advanced-q06 -->
<!-- question-level:advanced -->
#### How does deferred execution affect query performance in EF Core?

##### Expected Answer

Deferred execution allows EF Core queries to be composed before being sent to the database. This can improve performance because filters, projections, sorting, and paging can be translated into SQL and executed by the database.

Good example:

```csharp
var users = await dbContext.Users
    .Where(u => u.IsActive)
    .OrderBy(u => u.Name)
    .Select(u => new UserDto(u.Id, u.Name))
    .Take(50)
    .ToListAsync();
```

This can execute as a single optimized database query.

Bad example:

```csharp
var users = await dbContext.Users.ToListAsync();

var result = users
    .Where(u => u.IsActive)
    .OrderBy(u => u.Name)
    .Take(50)
    .ToList();
```

This loads all users into memory first, then filters locally.

Deferred execution helps when query composition remains provider-side until materialization.

##### Key Points to Mention

- Query composition before materialization is powerful.
- Filters and projections should usually happen before `ToListAsync()`.
- Early materialization can load too much data.
- Multiple terminal operations can cause multiple database queries.
- Understand where the query executes: database or memory.
<!-- question:end:deferred-execution-advanced-q06 -->

<!-- question:start:deferred-execution-advanced-q07 -->
<!-- question-id:deferred-execution-advanced-q07 -->
<!-- question-level:advanced -->
#### What is `IAsyncEnumerable<T>` and how is it related to deferred execution?

##### Expected Answer

`IAsyncEnumerable<T>` represents an asynchronous sequence of values. Like `IEnumerable<T>`, it can defer execution until consumed. The difference is that each item may be produced asynchronously.

Example:

```csharp
public async IAsyncEnumerable<int> GetNumbersAsync()
{
    for (int i = 1; i <= 3; i++)
    {
        await Task.Delay(100);
        yield return i;
    }
}
```

Usage:

```csharp
await foreach (var number in GetNumbersAsync())
{
    Console.WriteLine(number);
}
```

This is useful for streaming data from asynchronous sources without loading everything into memory at once.

##### Key Points to Mention

- `IAsyncEnumerable<T>` is async streaming.
- Execution starts when consumed with `await foreach`.
- It can reduce memory usage for large asynchronous data sources.
- It is useful for database streaming, APIs, and file processing.
<!-- question:end:deferred-execution-advanced-q07 -->

<!-- question:start:deferred-execution-advanced-q08 -->
<!-- question-id:deferred-execution-advanced-q08 -->
<!-- question-level:advanced -->
#### How would you diagnose a bug caused by deferred execution?

##### Expected Answer

To diagnose a deferred execution bug, first identify where the query is defined and where it is executed. Then check whether the query is enumerated multiple times, whether the source changes before enumeration, whether a resource is disposed, or whether an exception is delayed until enumeration.

Practical steps:

```csharp
var query = source.Where(x => IsValid(x));

// Temporarily materialize for debugging
var snapshot = query.ToList();
```

Use logging carefully inside predicates to confirm when execution happens:

```csharp
var query = source.Where(x =>
{
    logger.LogInformation("Checking {Id}", x.Id);
    return x.IsActive;
});
```

Also inspect database logs when using EF Core to see how many SQL queries are executed.

##### Key Points to Mention

- Find the execution point, not only the declaration point.
- Check for multiple enumeration.
- Check resource lifetime.
- Check source mutation.
- Materialize temporarily to confirm behavior.
- Use EF Core query logging for database-backed queries.
<!-- question:end:deferred-execution-advanced-q08 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
