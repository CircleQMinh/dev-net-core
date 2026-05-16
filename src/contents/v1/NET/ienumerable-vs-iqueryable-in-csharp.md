---
id: ienumerable-vs-iqueryable-in-csharp
topic: Modern C# patterns
subtopic: IEnumerable vs IQueryable in C#
category: .NET
---

## Overview

`IEnumerable<T>` and `IQueryable<T>` are two important LINQ-related interfaces in C#. They can look similar because both allow a sequence of data to be queried with LINQ, but they are designed for different execution models.

`IEnumerable<T>` represents a sequence that can be enumerated in .NET. It is most commonly used for in-memory collections such as arrays, lists, sets, dictionaries, and custom iterator methods. LINQ methods used with `IEnumerable<T>` are provided by the `Enumerable` class and operate using normal .NET delegates such as `Func<T, bool>`.

`IQueryable<T>` represents a query that can be translated and executed by a query provider. It is most commonly used with remote or external data sources such as Entity Framework Core, LINQ providers, databases, OData providers, and other systems that can translate an expression tree into a native query. LINQ methods used with `IQueryable<T>` are provided by the `Queryable` class and usually build expression trees such as `Expression<Func<T, bool>>`.

The practical difference is not just syntax. It affects where the filtering happens, when the query executes, how much data is loaded, whether the database can optimize the query, whether a custom C# method can be used, how exceptions appear, and whether code is safe across application layers.

For interviews, this topic is important because it tests whether a developer understands LINQ beyond basic syntax. A strong C# developer should know when a query runs in memory, when it can be translated to SQL, when `ToList()` changes behavior, why returning `IQueryable<T>` from repositories can be risky, and how to avoid common performance bugs such as client-side filtering and repeated query execution.

## Core Concepts

### Basic Definitions

`IEnumerable<T>` is an interface for reading a sequence of values one item at a time.

```csharp
public interface IEnumerable<out T> : IEnumerable
{
    IEnumerator<T> GetEnumerator();
}
```

It supports enumeration through `foreach`:

```csharp
IEnumerable<int> numbers = new List<int> { 1, 2, 3, 4, 5 };

foreach (int number in numbers)
{
    Console.WriteLine(number);
}
```

`IQueryable<T>` is an interface for building a query that can be interpreted by a provider.

```csharp
public interface IQueryable<out T> : IEnumerable<T>, IQueryable
{
}
```

Even though `IQueryable<T>` inherits from `IEnumerable<T>`, it adds query-specific information through the non-generic `IQueryable` interface:

```csharp
public interface IQueryable : IEnumerable
{
    Type ElementType { get; }
    Expression Expression { get; }
    IQueryProvider Provider { get; }
}
```

The important properties are:

| Property | Meaning |
|---|---|
| `Expression` | The expression tree representing the query. |
| `Provider` | The query provider responsible for translating and executing the query. |
| `ElementType` | The type of element returned by the query. |

In simple terms:

```text
IEnumerable<T> = enumerate .NET objects
IQueryable<T> = describe a query for a provider to execute
```

### The Main Difference

The most important difference is where the query logic runs.

| Feature | `IEnumerable<T>` | `IQueryable<T>` |
|---|---|---|
| Common source | In-memory objects | External/queryable source such as a database |
| LINQ implementation | `System.Linq.Enumerable` | `System.Linq.Queryable` |
| Predicate type | `Func<T, bool>` | `Expression<Func<T, bool>>` |
| Query representation | Compiled .NET delegates | Expression tree |
| Execution location | Application memory | Provider decides, often database server |
| Common with EF Core | After materialization or after `AsEnumerable()` | Before materialization, translated to SQL |
| Best for | Working with objects already loaded | Composing database/provider queries |
| Main risk | Repeated enumeration, lazy execution surprises | Translation failures, provider leakage, hidden database queries |

### IEnumerable<T> Execution Model

`IEnumerable<T>` works by asking a sequence for an enumerator, then repeatedly calling `MoveNext()` until the sequence ends.

```csharp
IEnumerable<string> names = new List<string>
{
    "Alice",
    "Bob",
    "Charlie"
};

foreach (string name in names)
{
    Console.WriteLine(name);
}
```

LINQ over `IEnumerable<T>` usually runs in the application process:

```csharp
List<User> users = GetUsersFromMemory();

IEnumerable<User> activeUsers = users
    .Where(user => user.IsActive)
    .OrderBy(user => user.LastName);
```

The `Where` and `OrderBy` methods here are `Enumerable.Where` and `Enumerable.OrderBy`. They operate on .NET objects. The predicate is compiled code:

```csharp
Func<User, bool> predicate = user => user.IsActive;
```

The filtering happens in memory when the sequence is enumerated.

### IQueryable<T> Execution Model

`IQueryable<T>` does not normally execute the query logic directly in .NET. Instead, it builds an expression tree that describes the query.

Example with Entity Framework Core:

```csharp
IQueryable<User> query = dbContext.Users
    .Where(user => user.IsActive)
    .OrderBy(user => user.LastName)
    .Select(user => new UserSummaryDto
    {
        Id = user.Id,
        FullName = user.FirstName + " " + user.LastName,
        Email = user.Email
    });
```

This query is not executed immediately. It is a description of work to perform. With EF Core, the provider can translate it into SQL when the query is executed.

For example, the provider may produce SQL conceptually similar to:

```sql
SELECT Id, FirstName, LastName, Email
FROM Users
WHERE IsActive = 1
ORDER BY LastName;
```

The key point is that the filtering, ordering, and projection can happen in the database instead of loading all users into memory first.

### Enumerable vs Queryable Extension Methods

C# LINQ uses extension methods. The selected method depends on the compile-time type of the source.

For `IEnumerable<T>`:

```csharp
IEnumerable<User> users = GetUsers();

var query = users.Where(user => user.IsActive);
```

This uses `Enumerable.Where`:

```csharp
Enumerable.Where(users, user => user.IsActive);
```

The predicate is a `Func<User, bool>`.

For `IQueryable<T>`:

```csharp
IQueryable<User> users = dbContext.Users;

var query = users.Where(user => user.IsActive);
```

This uses `Queryable.Where`:

```csharp
Queryable.Where(users, user => user.IsActive);
```

The predicate is an `Expression<Func<User, bool>>`.

That difference is extremely important:

```text
Func<T, bool> executes code.
Expression<Func<T, bool>> describes code.
```

A delegate can be invoked directly by .NET. An expression tree can be inspected, translated, optimized, or rejected by a provider.

### Expression Trees

An expression tree represents code as data.

This lambda:

```csharp
user => user.Age >= 18
```

Can become an expression tree that describes:

```text
Parameter: user
Member access: user.Age
Constant: 18
Operator: >=
```

A query provider such as EF Core can inspect that expression tree and translate it into SQL:

```sql
WHERE Age >= 18
```

This is why `IQueryable<T>` can be powerful. The provider receives a structured representation of the query instead of an already compiled .NET function.

However, this also creates limitations. The provider can only translate expressions it understands. A normal C# method may not be translatable.

```csharp
public static bool IsImportantCustomer(Customer customer)
{
    return customer.TotalSpend > 10_000 && customer.IsActive;
}

var query = dbContext.Customers
    .Where(customer => IsImportantCustomer(customer));
```

This may fail because the provider does not know how to translate `IsImportantCustomer` into SQL.

A provider-friendly version is:

```csharp
var query = dbContext.Customers
    .Where(customer => customer.TotalSpend > 10_000 && customer.IsActive);
```

### Deferred Execution

Both `IEnumerable<T>` and `IQueryable<T>` commonly use deferred execution.

Deferred execution means the query is not executed when it is defined. It is executed when the result is enumerated or when a terminal operation is called.

```csharp
var query = dbContext.Users
    .Where(user => user.IsActive);

// Query has not executed yet.

List<User> users = query.ToList();

// Query executes here.
```

Common execution triggers include:

- `foreach`
- `ToList()`
- `ToArray()`
- `Count()`
- `Any()`
- `First()`
- `Single()`
- `Max()`
- `Min()`
- `Sum()`
- `Average()`

With `IEnumerable<T>`, execution usually means iterating in memory.

With `IQueryable<T>`, execution usually means the provider executes the query, often by sending SQL to the database.

### Example: Filtering Before and After Materialization

This is one of the most common interview examples.

Good version:

```csharp
var users = await dbContext.Users
    .Where(user => user.IsActive)
    .OrderBy(user => user.LastName)
    .Take(50)
    .ToListAsync();
```

This keeps the query as `IQueryable<T>` until the end. EF Core can translate the filtering, ordering, and paging into SQL. The database returns only the required records.

Bad version:

```csharp
var allUsers = await dbContext.Users.ToListAsync();

var users = allUsers
    .Where(user => user.IsActive)
    .OrderBy(user => user.LastName)
    .Take(50)
    .ToList();
```

This loads all users from the database first, then filters in memory. That can cause major performance and memory problems.

The practical rule is:

```text
For database queries, apply Where, OrderBy, Select, Skip, and Take before ToList().
```

### Example: IEnumerable<T> Against an EF Core DbSet

Because `IQueryable<T>` inherits from `IEnumerable<T>`, it is possible to accidentally force LINQ to use `Enumerable` instead of `Queryable`.

```csharp
IEnumerable<User> users = dbContext.Users;

var activeUsers = users.Where(user => user.IsActive);
```

This looks harmless, but the compile-time type is now `IEnumerable<User>`, so the `Where` method is `Enumerable.Where`, not `Queryable.Where`.

Depending on the exact code path, this can lead to a query being executed and filtering happening in memory instead of being translated as part of the database query.

Prefer this when composing EF Core queries:

```csharp
IQueryable<User> users = dbContext.Users;

var activeUsers = users.Where(user => user.IsActive);
```

Or simply keep the chain directly on `DbSet<T>`:

```csharp
var activeUsers = dbContext.Users
    .Where(user => user.IsActive)
    .ToList();
```

### AsEnumerable()

`AsEnumerable()` changes how subsequent LINQ operators are resolved.

```csharp
var query = dbContext.Users
    .Where(user => user.IsActive)
    .AsEnumerable()
    .Where(user => IsValidInApplicationCode(user));
```

The first `Where` is still provider-based and can be translated to SQL. After `AsEnumerable()`, later operators use `Enumerable` and run in memory.

Important details:

- `AsEnumerable()` does not normally execute the query immediately by itself.
- It changes the compile-time type from `IQueryable<T>` to `IEnumerable<T>`.
- Subsequent LINQ operations happen in application memory when the sequence is enumerated.
- It is useful when you intentionally want to switch from provider translation to in-memory logic.
- It is dangerous when used accidentally before filtering, sorting, or paging.

Example where `AsEnumerable()` is acceptable:

```csharp
var results = dbContext.Orders
    .Where(order => order.Status == OrderStatus.Completed)
    .Select(order => new
    {
        order.Id,
        order.Total,
        order.CreatedAt
    })
    .AsEnumerable()
    .Select(order => new OrderReportRow
    {
        Id = order.Id,
        FormattedTotal = FormatCurrency(order.Total),
        CreatedDate = order.CreatedAt.ToString("yyyy-MM-dd")
    })
    .ToList();
```

In this example, database-friendly filtering and projection happen first. Formatting happens in memory afterward.

### AsQueryable()

`AsQueryable()` converts a sequence to `IQueryable<T>` from the perspective of the type system.

```csharp
List<User> users = GetUsersFromMemory();

IQueryable<User> query = users.AsQueryable();
```

This does not magically turn an in-memory list into a database query. If the source is already in memory, query execution still happens in memory.

Common mistake:

```csharp
var users = GetUsersFromApi().AsQueryable();
```

This only wraps the in-memory sequence. It does not make the API queryable, does not push filtering to the API server, and does not create SQL.

`AsQueryable()` is useful in some generic APIs, dynamic query builders, or tests, but it should not be treated as a performance optimization.

### ToList(), ToArray(), and Materialization

Materialization means executing a query and storing the results in a concrete collection.

```csharp
List<User> users = await dbContext.Users
    .Where(user => user.IsActive)
    .ToListAsync();
```

After materialization, further LINQ operations run in memory:

```csharp
var names = users
    .Where(user => user.LastName.StartsWith("S"))
    .Select(user => user.FullName)
    .ToList();
```

Materialization is not bad. It is necessary when:

- You need a stable snapshot of results.
- You want to avoid multiple database calls.
- You need to close the database context before further processing.
- You need to use application-only logic that cannot be translated.
- You need to pass data to another layer as a concrete collection.

Materialization becomes a problem when it happens too early:

```csharp
var users = await dbContext.Users
    .ToListAsync(); // Too early if the table is large.

return users
    .Where(user => user.IsActive)
    .Take(20)
    .ToList();
```

Better:

```csharp
return await dbContext.Users
    .Where(user => user.IsActive)
    .Take(20)
    .ToListAsync();
```

### Server-Side vs Client-Side Evaluation

With `IQueryable<T>`, the provider decides what can be executed by the external source.

For EF Core, the ideal case is server-side execution:

```csharp
var users = await dbContext.Users
    .Where(user => user.Email.EndsWith("@example.com"))
    .ToListAsync();
```

The database can handle this filtering.

Client-side evaluation means data is loaded into the application and then processed in memory:

```csharp
var users = dbContext.Users
    .AsEnumerable()
    .Where(user => CustomEmailCheck(user.Email))
    .ToList();
```

Client-side evaluation can be acceptable when the dataset is already small, but it is dangerous for large tables.

Common interview warning:

```text
Do not accidentally move filtering, sorting, paging, or joining from the database to the application.
```

### IQueryable<T> and Entity Framework Core

`DbSet<T>` in EF Core implements `IQueryable<T>`. That allows LINQ queries to be translated into SQL.

```csharp
public async Task<List<ProductDto>> GetProductsAsync(decimal minimumPrice)
{
    return await dbContext.Products
        .Where(product => product.Price >= minimumPrice)
        .OrderBy(product => product.Name)
        .Select(product => new ProductDto
        {
            Id = product.Id,
            Name = product.Name,
            Price = product.Price
        })
        .ToListAsync();
}
```

Good habits with EF Core queries:

- Keep the query as `IQueryable<T>` while composing database operations.
- Use `Select` to return only the columns needed.
- Apply `Where` before materialization.
- Apply `Skip` and `Take` before materialization.
- Use `ToListAsync`, `FirstOrDefaultAsync`, `AnyAsync`, and `CountAsync` for async database execution.
- Avoid calling custom C# methods inside provider-translated filters.
- Avoid returning tracked entity queries directly to UI layers.

### Projection Matters

A common performance mistake is loading full entities when only a few fields are needed.

Less efficient:

```csharp
var users = await dbContext.Users
    .Where(user => user.IsActive)
    .ToListAsync();

var result = users.Select(user => new UserListItemDto
{
    Id = user.Id,
    Name = user.FirstName + " " + user.LastName
}).ToList();
```

More efficient:

```csharp
var result = await dbContext.Users
    .Where(user => user.IsActive)
    .Select(user => new UserListItemDto
    {
        Id = user.Id,
        Name = user.FirstName + " " + user.LastName
    })
    .ToListAsync();
```

The second version allows the database provider to select only the needed columns.

### Paging Must Happen Before Materialization

Bad version:

```csharp
var allProducts = await dbContext.Products.ToListAsync();

var page = allProducts
    .OrderBy(product => product.Name)
    .Skip((pageNumber - 1) * pageSize)
    .Take(pageSize)
    .ToList();
```

This loads all products first.

Good version:

```csharp
var page = await dbContext.Products
    .OrderBy(product => product.Name)
    .Skip((pageNumber - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync();
```

This lets the database return only the requested page.

### Multiple Enumeration

`IEnumerable<T>` can represent a lazy sequence. Every enumeration may repeat the work.

```csharp
IEnumerable<User> users = GetUsersFromDatabaseLikeSource();

int count = users.Count();

foreach (var user in users)
{
    Console.WriteLine(user.Name);
}
```

This may enumerate the sequence twice. If the sequence triggers database access, file reads, API calls, expensive calculations, or logging, the work may happen twice.

Safer version:

```csharp
List<User> users = GetUsersFromDatabaseLikeSource().ToList();

int count = users.Count;

foreach (var user in users)
{
    Console.WriteLine(user.Name);
}
```

For `IQueryable<T>`, multiple enumeration may send multiple database queries:

```csharp
IQueryable<Order> query = dbContext.Orders
    .Where(order => order.Status == OrderStatus.Pending);

int count = await query.CountAsync();

List<Order> orders = await query.ToListAsync();
```

This sends two database queries. Sometimes that is intentional. Sometimes it is wasteful.

### DbContext Lifetime and IQueryable<T>

`IQueryable<T>` depends on its provider. With EF Core, that provider depends on a live `DbContext`.

Problematic example:

```csharp
public IQueryable<User> GetActiveUsers()
{
    using var dbContext = new AppDbContext();

    return dbContext.Users.Where(user => user.IsActive);
}
```

The query is returned without being executed. But the `DbContext` is disposed before the caller enumerates the query. This can fail at runtime.

Better:

```csharp
public async Task<List<UserDto>> GetActiveUsersAsync()
{
    await using var dbContext = new AppDbContext();

    return await dbContext.Users
        .Where(user => user.IsActive)
        .Select(user => new UserDto
        {
            Id = user.Id,
            Name = user.FirstName + " " + user.LastName
        })
        .ToListAsync();
}
```

The query is executed while the context is still alive.

### Returning IQueryable<T> from Repositories

Returning `IQueryable<T>` from a repository is controversial.

Example:

```csharp
public IQueryable<User> GetUsers()
{
    return dbContext.Users;
}
```

This gives callers maximum flexibility:

```csharp
var users = await repository.GetUsers()
    .Where(user => user.IsActive)
    .OrderBy(user => user.LastName)
    .ToListAsync();
```

But it also leaks data access details outside the repository. Callers can now decide query shape, tracking behavior, includes, filtering, paging, and execution timing.

Risks include:

- Repository abstraction becomes thin and less meaningful.
- Data access logic spreads across the application.
- Callers may build inefficient queries.
- Queries may execute outside the intended `DbContext` lifetime.
- Security filters may be bypassed if not enforced carefully.
- Unit tests using in-memory `AsQueryable()` may not catch provider translation problems.

A more controlled approach is to expose specific query methods:

```csharp
public async Task<List<UserListItemDto>> GetActiveUsersAsync(int pageNumber, int pageSize)
{
    return await dbContext.Users
        .Where(user => user.IsActive)
        .OrderBy(user => user.LastName)
        .Skip((pageNumber - 1) * pageSize)
        .Take(pageSize)
        .Select(user => new UserListItemDto
        {
            Id = user.Id,
            Name = user.FirstName + " " + user.LastName,
            Email = user.Email
        })
        .ToListAsync();
}
```

Another approach is the Specification pattern, where query rules are represented explicitly and applied inside the data access layer.

### Query Composition

`IQueryable<T>` is useful for composing optional filters before execution.

```csharp
IQueryable<Product> query = dbContext.Products;

if (!string.IsNullOrWhiteSpace(searchTerm))
{
    query = query.Where(product => product.Name.Contains(searchTerm));
}

if (categoryId is not null)
{
    query = query.Where(product => product.CategoryId == categoryId);
}

if (minimumPrice is not null)
{
    query = query.Where(product => product.Price >= minimumPrice);
}

var products = await query
    .OrderBy(product => product.Name)
    .Select(product => new ProductDto
    {
        Id = product.Id,
        Name = product.Name,
        Price = product.Price
    })
    .ToListAsync();
```

This is a strong use case for `IQueryable<T>` because the query remains composable and still executes once.

### Dynamic Filtering

`IQueryable<T>` is often used in APIs that support dynamic filtering, sorting, and paging.

```csharp
public async Task<List<CustomerDto>> SearchCustomersAsync(CustomerSearchRequest request)
{
    IQueryable<Customer> query = dbContext.Customers;

    if (!string.IsNullOrWhiteSpace(request.Keyword))
    {
        query = query.Where(customer =>
            customer.Name.Contains(request.Keyword) ||
            customer.Email.Contains(request.Keyword));
    }

    query = request.SortBy switch
    {
        "email" => query.OrderBy(customer => customer.Email),
        "createdAt" => query.OrderByDescending(customer => customer.CreatedAt),
        _ => query.OrderBy(customer => customer.Name)
    };

    return await query
        .Skip((request.Page - 1) * request.PageSize)
        .Take(request.PageSize)
        .Select(customer => new CustomerDto
        {
            Id = customer.Id,
            Name = customer.Name,
            Email = customer.Email
        })
        .ToListAsync();
}
```

This keeps dynamic query construction server-side.

### IQueryable<T> Translation Limitations

Not every C# expression can be translated by every provider.

Usually safe:

```csharp
var query = dbContext.Users
    .Where(user => user.Age >= 18 && user.IsActive)
    .Select(user => new
    {
        user.Id,
        user.Email
    });
```

Potentially unsafe:

```csharp
var query = dbContext.Users
    .Where(user => NormalizeEmail(user.Email) == normalizedInput);
```

The provider may not know how to translate `NormalizeEmail`.

A safer approach is to normalize the input before the query and use provider-translatable operations:

```csharp
string normalizedInput = input.Trim().ToUpperInvariant();

var query = dbContext.Users
    .Where(user => user.NormalizedEmail == normalizedInput);
```

Common operations that may cause issues depending on provider and version:

- Custom methods inside `Where`
- Complex object construction before filtering
- Local collection operations that cannot be translated
- Unsupported string, date, or math methods
- `DateTime` operations that the database provider does not support
- Comparing complex objects instead of scalar fields

### IEnumerable<T> Is Not Always Materialized

A common misconception is that `IEnumerable<T>` always means a collection already exists in memory.

That is not always true.

```csharp
public IEnumerable<int> GenerateNumbers()
{
    for (int i = 1; i <= 5; i++)
    {
        Console.WriteLine($"Generating {i}");
        yield return i;
    }
}
```

This method returns an `IEnumerable<int>`, but the numbers are generated lazily.

```csharp
IEnumerable<int> numbers = GenerateNumbers();

foreach (int number in numbers)
{
    Console.WriteLine(number);
}
```

The output is produced as the sequence is enumerated.

This matters because `IEnumerable<T>` tells you that something can be enumerated. It does not guarantee that it is already stored in memory.

### IQueryable<T> Is Not Always a Database Query

Another misconception is that `IQueryable<T>` always means SQL or a database.

That is also not true.

```csharp
List<int> numbers = new() { 1, 2, 3, 4, 5 };

IQueryable<int> query = numbers.AsQueryable();
```

This query is still backed by an in-memory list. It uses an in-memory query provider.

The correct understanding is:

```text
IQueryable<T> means provider-based query composition, not necessarily database execution.
```

### API Design: What Should Methods Accept?

For method parameters, choose the least powerful abstraction that satisfies the method.

Use `IEnumerable<T>` when the method only needs to iterate:

```csharp
public decimal CalculateTotal(IEnumerable<OrderLine> lines)
{
    return lines.Sum(line => line.Quantity * line.UnitPrice);
}
```

Use `IReadOnlyCollection<T>` when the method needs enumeration and count:

```csharp
public void ValidateItems(IReadOnlyCollection<OrderLine> lines)
{
    if (lines.Count == 0)
    {
        throw new InvalidOperationException("At least one line is required.");
    }
}
```

Use `IReadOnlyList<T>` when the method needs indexing:

```csharp
public OrderLine GetFirstLine(IReadOnlyList<OrderLine> lines)
{
    return lines[0];
}
```

Use `IQueryable<T>` only when the method is intentionally composing a provider query:

```csharp
public static IQueryable<User> ApplyActiveFilter(IQueryable<User> query)
{
    return query.Where(user => user.IsActive);
}
```

Do not accept `IQueryable<T>` just because it looks flexible. It couples the method to provider-based query semantics.

### API Design: What Should Methods Return?

Return `IEnumerable<T>` when the caller only needs to enumerate a sequence and should not depend on a specific collection type.

```csharp
public IEnumerable<string> GetSupportedCultures()
{
    yield return "en-US";
    yield return "es-ES";
    yield return "vi-VN";
}
```

Return `List<T>` or `IReadOnlyList<T>` when the result is materialized and stable.

```csharp
public async Task<IReadOnlyList<UserDto>> GetUsersAsync()
{
    return await dbContext.Users
        .Select(user => new UserDto
        {
            Id = user.Id,
            Name = user.FirstName + " " + user.LastName
        })
        .ToListAsync();
}
```

Return `IQueryable<T>` only when you deliberately want the caller to keep composing the provider query.

```csharp
public IQueryable<Product> QueryProducts()
{
    return dbContext.Products.AsNoTracking();
}
```

This should be a conscious design decision, not the default.

### Common Real-World Scenarios

Use `IEnumerable<T>` for:

- In-memory collections.
- Simple service methods that process a sequence.
- Iterator methods using `yield return`.
- Domain logic that should not depend on EF Core or database providers.
- Returning data that has already been materialized.
- Passing results to UI code, reporting code, or business rules.

Use `IQueryable<T>` for:

- Building database queries before execution.
- Adding optional filters, sorting, paging, and projection.
- EF Core query composition inside repository/query services.
- Dynamic search screens.
- Provider-based query translation.
- Data access code that must keep execution server-side.

### Common Mistake: Calling ToList() Too Early

Bad:

```csharp
public async Task<List<OrderDto>> GetOrdersAsync(OrderSearchRequest request)
{
    var orders = await dbContext.Orders.ToListAsync();

    if (request.CustomerId is not null)
    {
        orders = orders
            .Where(order => order.CustomerId == request.CustomerId)
            .ToList();
    }

    return orders.Select(order => new OrderDto
    {
        Id = order.Id,
        Total = order.Total
    }).ToList();
}
```

Better:

```csharp
public async Task<List<OrderDto>> GetOrdersAsync(OrderSearchRequest request)
{
    IQueryable<Order> query = dbContext.Orders;

    if (request.CustomerId is not null)
    {
        query = query.Where(order => order.CustomerId == request.CustomerId);
    }

    return await query
        .Select(order => new OrderDto
        {
            Id = order.Id,
            Total = order.Total
        })
        .ToListAsync();
}
```

### Common Mistake: Returning IQueryable<T> to the Controller

Problematic:

```csharp
public IQueryable<User> GetUsers()
{
    return dbContext.Users;
}
```

```csharp
[HttpGet]
public async Task<IActionResult> GetUsers()
{
    var users = await userRepository.GetUsers()
        .Where(user => user.IsActive)
        .ToListAsync();

    return Ok(users);
}
```

This allows controller code to shape the database query directly.

Better:

```csharp
public async Task<List<UserDto>> GetActiveUsersAsync()
{
    return await dbContext.Users
        .Where(user => user.IsActive)
        .Select(user => new UserDto
        {
            Id = user.Id,
            Email = user.Email
        })
        .ToListAsync();
}
```

```csharp
[HttpGet]
public async Task<IActionResult> GetUsers()
{
    var users = await userService.GetActiveUsersAsync();

    return Ok(users);
}
```

The service or repository controls the query shape.

### Common Mistake: Unit Tests with List.AsQueryable()

A unit test may pass with `List<T>.AsQueryable()` but fail with EF Core.

```csharp
var users = new List<User>
{
    new() { Email = "test@example.com" }
}.AsQueryable();

var result = users
    .Where(user => NormalizeEmail(user.Email) == "TEST@EXAMPLE.COM")
    .ToList();
```

This works in memory because .NET can call `NormalizeEmail`. But the same query may fail against a real database provider because the method cannot be translated.

For query behavior, integration tests against a realistic provider are often more valuable than only using in-memory `AsQueryable()`.

### Common Mistake: Hidden Database Queries

This method returns an `IEnumerable<Order>`:

```csharp
public IEnumerable<Order> GetPendingOrders()
{
    return dbContext.Orders.Where(order => order.Status == OrderStatus.Pending);
}
```

Even though the return type is `IEnumerable<Order>`, the underlying object may still be an EF Core query. The database query may not execute until the caller enumerates it.

This can create hidden behavior:

```csharp
var orders = orderRepository.GetPendingOrders();

// Database query may execute here.
foreach (var order in orders)
{
    Console.WriteLine(order.Id);
}
```

A clearer approach is to execute inside the data access method:

```csharp
public async Task<List<Order>> GetPendingOrdersAsync()
{
    return await dbContext.Orders
        .Where(order => order.Status == OrderStatus.Pending)
        .ToListAsync();
}
```

### Tracking and No-Tracking Queries

With EF Core, `IQueryable<T>` can also carry tracking behavior.

For read-only queries, use `AsNoTracking()` when entity tracking is not needed:

```csharp
var users = await dbContext.Users
    .AsNoTracking()
    .Where(user => user.IsActive)
    .Select(user => new UserDto
    {
        Id = user.Id,
        Name = user.FirstName + " " + user.LastName
    })
    .ToListAsync();
```

This can reduce overhead for read-only scenarios.

However, do not blindly use `AsNoTracking()` when you plan to modify the entity and save changes.

### Async Queries

`IQueryable<T>` from EF Core supports async query execution through methods such as:

- `ToListAsync()`
- `FirstOrDefaultAsync()`
- `SingleOrDefaultAsync()`
- `AnyAsync()`
- `CountAsync()`

Example:

```csharp
bool exists = await dbContext.Users
    .AnyAsync(user => user.Email == email);
```

An in-memory `IEnumerable<T>` uses normal synchronous LINQ:

```csharp
bool exists = users.Any(user => user.Email == email);
```

Do not confuse async query execution with in-memory enumeration. `ToListAsync()` is useful when the provider performs asynchronous I/O, such as database access.

### IEnumerable<T> vs IAsyncEnumerable<T>

`IEnumerable<T>` is synchronous. It is suitable for normal in-memory enumeration.

`IAsyncEnumerable<T>` supports asynchronous streaming:

```csharp
public async IAsyncEnumerable<string> ReadLinesAsync(string path)
{
    using var reader = File.OpenText(path);

    while (await reader.ReadLineAsync() is { } line)
    {
        yield return line;
    }
}
```

This is a separate concept from `IQueryable<T>`. A query can be provider-based and async-executed, but `IQueryable<T>` itself is not the same as `IAsyncEnumerable<T>`.

### Choosing Between IEnumerable<T> and IQueryable<T>

A practical decision guide:

| Situation | Prefer |
|---|---|
| You already have a `List<T>` or array | `IEnumerable<T>` or collection interface |
| You are writing business logic over objects | `IEnumerable<T>` |
| You are composing an EF Core database query | `IQueryable<T>` inside data access/query layer |
| You need server-side filtering and paging | `IQueryable<T>` until materialization |
| You are returning data from a service to a controller | Usually `Task<List<T>>`, `Task<IReadOnlyList<T>>`, or DTO collection |
| You need caller-controlled query composition | `IQueryable<T>`, but intentionally and carefully |
| You need count without enumeration | `IReadOnlyCollection<T>` or collection-specific type |
| You need indexing | `IReadOnlyList<T>` or `IList<T>` |
| You need async streaming | `IAsyncEnumerable<T>` |

### Best Practices

Keep database queries as `IQueryable<T>` until all provider-translatable filters, sorting, paging, and projection are applied.

```csharp
var result = await dbContext.Products
    .Where(product => product.IsActive)
    .OrderBy(product => product.Name)
    .Skip(offset)
    .Take(limit)
    .Select(product => new ProductDto
    {
        Id = product.Id,
        Name = product.Name
    })
    .ToListAsync();
```

Materialize intentionally with `ToList()`, `ToArray()`, or async EF Core methods.

Avoid exposing `IQueryable<T>` outside the layer that owns query rules unless you intentionally want composability.

Avoid calling `AsEnumerable()` before filtering, ordering, paging, or selecting needed columns.

Do not use `AsQueryable()` as a fake performance improvement for in-memory collections.

Use projection to DTOs for API responses instead of returning full entities.

Watch for multiple enumeration of `IEnumerable<T>` and repeated execution of `IQueryable<T>`.

Use integration tests for important EF Core queries because in-memory LINQ does not behave exactly like provider-translated SQL.

Use `IReadOnlyList<T>` or `IReadOnlyCollection<T>` when a method needs collection semantics beyond simple enumeration.

### Summary Mental Model

Use this mental model in interviews:

```text
IEnumerable<T>
- Pulls objects one by one.
- Uses delegates.
- Runs LINQ in .NET memory.
- Best for objects already in the application.

IQueryable<T>
- Builds an expression tree.
- Uses a query provider.
- Can translate LINQ to another query language such as SQL.
- Best before executing database/provider queries.
```

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

<!-- question:start:ienumerable-vs-iqueryable-beginner-q01 -->
<!-- question-id: ienumerable-vs-iqueryable-beginner-q01 -->
<!-- question-level: beginner -->
#### 1. What is `IEnumerable<T>` in C#?

##### Expected Answer

`IEnumerable<T>` is an interface that represents a sequence of items that can be enumerated one item at a time. It is commonly used with arrays, lists, sets, dictionaries, and custom iterator methods.

It provides a `GetEnumerator()` method that allows `foreach` to iterate through the sequence.

Example:

```csharp
IEnumerable<int> numbers = new List<int> { 1, 2, 3 };

foreach (int number in numbers)
{
    Console.WriteLine(number);
}
```

In LINQ, `IEnumerable<T>` is commonly used for in-memory queries. Methods such as `Where`, `Select`, and `OrderBy` are usually extension methods from `System.Linq.Enumerable` when the source type is `IEnumerable<T>`.

##### Key Points to Mention

- Represents an enumerable sequence.
- Supports `foreach`.
- Common for in-memory collections.
- Uses `Enumerable` LINQ methods.
- LINQ over `IEnumerable<T>` usually runs in application memory.
- It can be lazy; it does not always mean the data is already materialized.

<!-- question:end:ienumerable-vs-iqueryable-beginner-q01 -->

<!-- question:start:ienumerable-vs-iqueryable-beginner-q02 -->
<!-- question-id: ienumerable-vs-iqueryable-beginner-q02 -->
<!-- question-level: beginner -->
#### 2. What is `IQueryable<T>` in C#?

##### Expected Answer

`IQueryable<T>` is an interface used to represent a query that can be executed by a query provider. It is commonly used with data sources such as Entity Framework Core, where LINQ queries can be translated into SQL.

Unlike `IEnumerable<T>`, which uses compiled delegates, `IQueryable<T>` uses expression trees. This allows a provider to inspect the query, translate it, optimize it, and execute it against an external data source.

Example:

```csharp
IQueryable<User> query = dbContext.Users
    .Where(user => user.IsActive);
```

The query is not executed immediately. It is executed when enumerated or when a terminal operation such as `ToListAsync()` is called.

##### Key Points to Mention

- Represents a provider-based query.
- Common with EF Core and database queries.
- Uses expression trees.
- Uses `Queryable` LINQ methods.
- Execution is usually deferred.
- Provider may translate the query to SQL or another native query language.

<!-- question:end:ienumerable-vs-iqueryable-beginner-q02 -->

<!-- question:start:ienumerable-vs-iqueryable-beginner-q03 -->
<!-- question-id: ienumerable-vs-iqueryable-beginner-q03 -->
<!-- question-level: beginner -->
#### 3. What is the main difference between `IEnumerable<T>` and `IQueryable<T>`?

##### Expected Answer

The main difference is how and where the query executes.

`IEnumerable<T>` is used to enumerate objects in .NET, usually in memory. LINQ operations use delegates such as `Func<T, bool>` and run in the application process.

`IQueryable<T>` is used to build a query expression that a provider can execute. LINQ operations build expression trees, and the provider may translate those expression trees into SQL or another query language.

Example:

```csharp
IEnumerable<User> usersInMemory = usersList.Where(user => user.IsActive);
```

This filters in memory.

```csharp
IQueryable<User> usersQuery = dbContext.Users.Where(user => user.IsActive);
```

This can be translated to SQL and filtered by the database.

##### Key Points to Mention

- `IEnumerable<T>` is object enumeration.
- `IQueryable<T>` is provider-based query composition.
- `IEnumerable<T>` uses `Func<T, bool>`.
- `IQueryable<T>` uses `Expression<Func<T, bool>>`.
- `IEnumerable<T>` usually runs in memory.
- `IQueryable<T>` can run on the database/server side.

<!-- question:end:ienumerable-vs-iqueryable-beginner-q03 -->

<!-- question:start:ienumerable-vs-iqueryable-beginner-q04 -->
<!-- question-id: ienumerable-vs-iqueryable-beginner-q04 -->
<!-- question-level: beginner -->
#### 4. Does `IQueryable<T>` inherit from `IEnumerable<T>`?

##### Expected Answer

Yes. `IQueryable<T>` inherits from `IEnumerable<T>`, which means an `IQueryable<T>` can be enumerated with `foreach`.

However, this does not mean they behave the same. `IQueryable<T>` also has an expression tree and a query provider. When an `IQueryable<T>` is enumerated, the provider executes the expression tree.

Example:

```csharp
IQueryable<User> query = dbContext.Users
    .Where(user => user.IsActive);

foreach (User user in query)
{
    Console.WriteLine(user.Email);
}
```

The `foreach` triggers execution of the query.

##### Key Points to Mention

- `IQueryable<T>` inherits from `IEnumerable<T>`.
- It can be enumerated.
- It adds `Expression`, `Provider`, and `ElementType`.
- Enumeration triggers provider execution.
- Inheritance does not mean identical behavior.

<!-- question:end:ienumerable-vs-iqueryable-beginner-q04 -->

<!-- question:start:ienumerable-vs-iqueryable-beginner-q05 -->
<!-- question-id: ienumerable-vs-iqueryable-beginner-q05 -->
<!-- question-level: beginner -->
#### 5. When does a LINQ query execute?

##### Expected Answer

Many LINQ queries use deferred execution. This means the query does not execute when it is created. It executes when the result is enumerated or when a terminal operation is called.

Example:

```csharp
var query = dbContext.Users
    .Where(user => user.IsActive);

// Not executed yet.

var users = await query.ToListAsync();

// Executed here.
```

Execution can be triggered by methods such as `ToList()`, `ToArray()`, `Count()`, `Any()`, `First()`, `Single()`, or by `foreach`.

##### Key Points to Mention

- LINQ queries are often deferred.
- Query definition is not the same as query execution.
- `foreach` can trigger execution.
- Terminal methods trigger execution.
- For `IQueryable<T>`, execution may send a query to the database.
- For `IEnumerable<T>`, execution usually means in-memory iteration.

<!-- question:end:ienumerable-vs-iqueryable-beginner-q05 -->

<!-- question:start:ienumerable-vs-iqueryable-beginner-q06 -->
<!-- question-id: ienumerable-vs-iqueryable-beginner-q06 -->
<!-- question-level: beginner -->
#### 6. What does `ToList()` do in a LINQ query?

##### Expected Answer

`ToList()` executes the query and materializes the results into a `List<T>`.

For `IQueryable<T>`, this usually means the provider executes the query, such as sending SQL to the database. After `ToList()` is called, further LINQ operations happen in memory.

Example:

```csharp
var users = dbContext.Users
    .Where(user => user.IsActive)
    .ToList();
```

The database query is executed at `ToList()`.

Calling `ToList()` too early can be inefficient:

```csharp
var users = dbContext.Users.ToList()
    .Where(user => user.IsActive)
    .ToList();
```

This loads all users first, then filters in memory.

##### Key Points to Mention

- `ToList()` materializes results.
- It triggers query execution.
- After `ToList()`, data is in memory.
- Calling it too early can hurt performance.
- Apply filters, sorting, paging, and projection before materialization.

<!-- question:end:ienumerable-vs-iqueryable-beginner-q06 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

<!-- question:start:ienumerable-vs-iqueryable-intermediate-q01 -->
<!-- question-id: ienumerable-vs-iqueryable-intermediate-q01 -->
<!-- question-level: intermediate -->
#### 1. Why can using `IEnumerable<T>` with EF Core cause performance problems?

##### Expected Answer

Using `IEnumerable<T>` too early can cause LINQ operators to run in memory instead of being translated to SQL. If the query is materialized before filtering, sorting, paging, or projection, the application may load far more data than needed.

Bad example:

```csharp
var users = await dbContext.Users.ToListAsync();

var activeUsers = users
    .Where(user => user.IsActive)
    .Take(50)
    .ToList();
```

This loads all users from the database, then filters in memory.

Better:

```csharp
var activeUsers = await dbContext.Users
    .Where(user => user.IsActive)
    .Take(50)
    .ToListAsync();
```

This lets the database filter and limit the result set.

##### Key Points to Mention

- EF Core queries should usually stay as `IQueryable<T>` until execution.
- Early materialization causes in-memory filtering.
- This can increase memory usage and database traffic.
- Apply `Where`, `OrderBy`, `Skip`, `Take`, and `Select` before `ToList()`.
- Server-side filtering is usually better for large datasets.

<!-- question:end:ienumerable-vs-iqueryable-intermediate-q01 -->

<!-- question:start:ienumerable-vs-iqueryable-intermediate-q02 -->
<!-- question-id: ienumerable-vs-iqueryable-intermediate-q02 -->
<!-- question-level: intermediate -->
#### 2. What is the difference between `Func<T, bool>` and `Expression<Func<T, bool>>`?

##### Expected Answer

`Func<T, bool>` is a compiled delegate that can be executed directly by .NET.

`Expression<Func<T, bool>>` is an expression tree that represents code as data. It can be inspected and translated by a query provider.

`IEnumerable<T>` LINQ operators use delegates:

```csharp
Func<User, bool> predicate = user => user.IsActive;

var result = users.Where(predicate);
```

`IQueryable<T>` LINQ operators use expression trees:

```csharp
Expression<Func<User, bool>> predicate = user => user.IsActive;

var result = dbContext.Users.Where(predicate);
```

The expression tree allows EF Core to translate the predicate into SQL.

##### Key Points to Mention

- `Func<T, bool>` is executable code.
- `Expression<Func<T, bool>>` is a representation of code.
- `IEnumerable<T>` uses delegates.
- `IQueryable<T>` uses expression trees.
- Expression trees allow provider translation.
- Not all C# code can be represented or translated successfully.

<!-- question:end:ienumerable-vs-iqueryable-intermediate-q02 -->

<!-- question:start:ienumerable-vs-iqueryable-intermediate-q03 -->
<!-- question-id: ienumerable-vs-iqueryable-intermediate-q03 -->
<!-- question-level: intermediate -->
#### 3. What does `AsEnumerable()` do?

##### Expected Answer

`AsEnumerable()` changes the compile-time type of a sequence to `IEnumerable<T>`. It does not usually execute the query immediately by itself. However, it causes subsequent LINQ operators to use `Enumerable` methods instead of `Queryable` methods.

Example:

```csharp
var query = dbContext.Users
    .Where(user => user.IsActive)
    .AsEnumerable()
    .Where(user => CustomCheck(user));
```

The first `Where` can be translated to SQL. The second `Where` runs in memory when the query is enumerated.

`AsEnumerable()` can be useful when you intentionally want to switch from provider-based query translation to in-memory processing. It is risky if used before filtering, sorting, or paging.

##### Key Points to Mention

- Changes subsequent LINQ resolution to `Enumerable`.
- Usually does not execute immediately by itself.
- Later operations run in memory.
- Useful for intentional client-side processing.
- Dangerous before important filters or paging.
- Often used to separate server-translatable logic from application-only logic.

<!-- question:end:ienumerable-vs-iqueryable-intermediate-q03 -->

<!-- question:start:ienumerable-vs-iqueryable-intermediate-q04 -->
<!-- question-id: ienumerable-vs-iqueryable-intermediate-q04 -->
<!-- question-level: intermediate -->
#### 4. What does `AsQueryable()` do?

##### Expected Answer

`AsQueryable()` converts a sequence to `IQueryable<T>` from the type system perspective. If the source already has a query provider, that provider can be used. If the source is an in-memory collection, it is wrapped with an in-memory query provider.

Example:

```csharp
List<User> users = GetUsersFromMemory();

IQueryable<User> query = users.AsQueryable();
```

This does not turn the list into a database query. Filtering still happens in memory.

A common mistake is thinking `AsQueryable()` automatically improves performance. It does not. It is mainly useful for APIs that expect `IQueryable<T>` or for certain dynamic query scenarios.

##### Key Points to Mention

- Converts or exposes a sequence as `IQueryable<T>`.
- Does not magically create SQL or server-side execution.
- In-memory sources remain in-memory.
- Useful for generic or dynamic query scenarios.
- Should not be used as a performance fix.

<!-- question:end:ienumerable-vs-iqueryable-intermediate-q04 -->

<!-- question:start:ienumerable-vs-iqueryable-intermediate-q05 -->
<!-- question-id: ienumerable-vs-iqueryable-intermediate-q05 -->
<!-- question-level: intermediate -->
#### 5. Why should filtering and paging happen before `ToList()`?

##### Expected Answer

Filtering and paging should happen before `ToList()` so that the provider can execute them at the data source, usually the database. This reduces the number of rows transferred to the application and reduces memory usage.

Bad example:

```csharp
var allOrders = await dbContext.Orders.ToListAsync();

var page = allOrders
    .Where(order => order.Status == OrderStatus.Completed)
    .Skip(100)
    .Take(50)
    .ToList();
```

Good example:

```csharp
var page = await dbContext.Orders
    .Where(order => order.Status == OrderStatus.Completed)
    .OrderBy(order => order.Id)
    .Skip(100)
    .Take(50)
    .ToListAsync();
```

The second version allows the database to filter and return only the requested page.

##### Key Points to Mention

- `ToList()` materializes the query.
- Operations after `ToList()` run in memory.
- Filtering and paging should be translated to SQL when possible.
- This improves performance and memory usage.
- Projection should also happen before materialization when possible.

<!-- question:end:ienumerable-vs-iqueryable-intermediate-q05 -->

<!-- question:start:ienumerable-vs-iqueryable-intermediate-q06 -->
<!-- question-id: ienumerable-vs-iqueryable-intermediate-q06 -->
<!-- question-level: intermediate -->
#### 6. Should repositories return `IQueryable<T>`?

##### Expected Answer

It depends, but returning `IQueryable<T>` from repositories should be a deliberate design decision.

Returning `IQueryable<T>` gives callers flexibility to add filters, sorting, paging, and projection. However, it also leaks data access details outside the repository and allows callers to control query execution. This can spread query logic across layers and create performance, security, and lifetime issues.

Example risk:

```csharp
public IQueryable<User> GetUsers()
{
    return dbContext.Users;
}
```

The caller can now build any query, possibly bypassing expected rules.

A more controlled approach is to expose specific query methods:

```csharp
public Task<List<UserDto>> GetActiveUsersAsync()
{
    return dbContext.Users
        .Where(user => user.IsActive)
        .Select(user => new UserDto
        {
            Id = user.Id,
            Email = user.Email
        })
        .ToListAsync();
}
```

##### Key Points to Mention

- Returning `IQueryable<T>` provides flexibility.
- It also leaks provider and persistence concerns.
- It may cause query logic to spread across layers.
- It can cause `DbContext` lifetime issues.
- It can make security filters harder to enforce.
- Prefer specific query methods unless composability is intentional.

<!-- question:end:ienumerable-vs-iqueryable-intermediate-q06 -->

<!-- question:start:ienumerable-vs-iqueryable-intermediate-q07 -->
<!-- question-id: ienumerable-vs-iqueryable-intermediate-q07 -->
<!-- question-level: intermediate -->
#### 7. What is multiple enumeration, and why can it be a problem?

##### Expected Answer

Multiple enumeration happens when the same sequence is iterated more than once.

Example:

```csharp
IEnumerable<Order> orders = GetOrders();

int count = orders.Count();

foreach (Order order in orders)
{
    Console.WriteLine(order.Id);
}
```

If `orders` is lazy, this may repeat the work twice. If the source is an EF Core query, it may send two database queries. If the source reads a file or calls an API, it may repeat those operations.

A safer approach is to materialize once when repeated access is needed:

```csharp
List<Order> orders = GetOrders().ToList();

int count = orders.Count;

foreach (Order order in orders)
{
    Console.WriteLine(order.Id);
}
```

##### Key Points to Mention

- `IEnumerable<T>` can be lazy.
- Each enumeration may repeat work.
- `IQueryable<T>` may execute multiple database queries.
- Materialize once if repeated enumeration is needed.
- Be careful with `Count()` followed by `foreach`.

<!-- question:end:ienumerable-vs-iqueryable-intermediate-q07 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

<!-- question:start:ienumerable-vs-iqueryable-advanced-q01 -->
<!-- question-id: ienumerable-vs-iqueryable-advanced-q01 -->
<!-- question-level: advanced -->
#### 1. How does a query provider execute an `IQueryable<T>` query?

##### Expected Answer

An `IQueryable<T>` query is represented as an expression tree. Queryable LINQ methods build or extend that expression tree. The `IQueryProvider` associated with the query is responsible for creating new query objects and executing the expression tree.

For sequence-returning operations, the provider creates another `IQueryable<T>` representing the updated query. For terminal operations, the provider executes the expression tree and returns a result.

With EF Core, execution commonly means translating the expression tree into SQL, sending it to the database, reading the result set, and materializing objects or DTOs.

Example:

```csharp
IQueryable<User> query = dbContext.Users
    .Where(user => user.IsActive)
    .OrderBy(user => user.LastName);

List<User> users = await query.ToListAsync();
```

The query is built before `ToListAsync()`. The provider executes it at `ToListAsync()`.

##### Key Points to Mention

- `IQueryable<T>` has an `Expression` and a `Provider`.
- Queryable operators build expression trees.
- `IQueryProvider` creates and executes queries.
- EF Core translates expression trees to SQL.
- Execution happens on enumeration or terminal operations.
- Provider behavior depends on the data source.

<!-- question:end:ienumerable-vs-iqueryable-advanced-q01 -->

<!-- question:start:ienumerable-vs-iqueryable-advanced-q02 -->
<!-- question-id: ienumerable-vs-iqueryable-advanced-q02 -->
<!-- question-level: advanced -->
#### 2. Why can a LINQ query work with `List<T>.AsQueryable()` but fail with EF Core?

##### Expected Answer

`List<T>.AsQueryable()` uses an in-memory query provider. It can execute normal .NET logic because the data is already in memory.

EF Core uses a database provider that must translate the expression tree into SQL. If the expression contains unsupported methods or logic that cannot be translated, EF Core may throw a runtime exception.

Example:

```csharp
var query = dbContext.Users
    .Where(user => NormalizeEmail(user.Email) == normalizedInput);
```

This may work with `List<T>.AsQueryable()` because .NET can call `NormalizeEmail`. It may fail with EF Core because the provider cannot translate `NormalizeEmail` to SQL.

This is why tests based only on `AsQueryable()` can give false confidence for database queries.

##### Key Points to Mention

- In-memory query providers and database providers are different.
- `AsQueryable()` over a list still runs in memory.
- EF Core must translate expression trees to SQL.
- Custom methods often cannot be translated.
- Integration tests are important for real database query behavior.

<!-- question:end:ienumerable-vs-iqueryable-advanced-q02 -->

<!-- question:start:ienumerable-vs-iqueryable-advanced-q03 -->
<!-- question-id: ienumerable-vs-iqueryable-advanced-q03 -->
<!-- question-level: advanced -->
#### 3. How can `IQueryable<T>` cause `DbContext` lifetime problems?

##### Expected Answer

`IQueryable<T>` is not the result data. It is a query that depends on its provider. With EF Core, the provider depends on a live `DbContext`.

If a method returns an unexecuted `IQueryable<T>` and the `DbContext` is disposed before enumeration, the query can fail at runtime.

Problematic example:

```csharp
public IQueryable<User> GetUsers()
{
    using var dbContext = new AppDbContext();

    return dbContext.Users.Where(user => user.IsActive);
}
```

The query is returned, but the context is disposed. When the caller enumerates the query, the provider no longer has a valid context.

Better:

```csharp
public async Task<List<UserDto>> GetUsersAsync()
{
    await using var dbContext = new AppDbContext();

    return await dbContext.Users
        .Where(user => user.IsActive)
        .Select(user => new UserDto
        {
            Id = user.Id,
            Email = user.Email
        })
        .ToListAsync();
}
```

##### Key Points to Mention

- `IQueryable<T>` is deferred.
- It depends on the provider.
- EF Core queries depend on a live `DbContext`.
- Returning unexecuted queries can outlive the context.
- Execute inside the layer that owns the context when appropriate.

<!-- question:end:ienumerable-vs-iqueryable-advanced-q03 -->

<!-- question:start:ienumerable-vs-iqueryable-advanced-q04 -->
<!-- question-id: ienumerable-vs-iqueryable-advanced-q04 -->
<!-- question-level: advanced -->
#### 4. How do you design a search API using `IQueryable<T>` safely?

##### Expected Answer

A safe search API can use `IQueryable<T>` internally to compose optional filters, sorting, paging, and projection before executing the query. The important part is to keep query composition inside the data access or application service layer instead of exposing unrestricted `IQueryable<T>` to controllers or external callers.

Example:

```csharp
public async Task<List<ProductDto>> SearchProductsAsync(ProductSearchRequest request)
{
    IQueryable<Product> query = dbContext.Products.AsNoTracking();

    if (!string.IsNullOrWhiteSpace(request.Keyword))
    {
        query = query.Where(product => product.Name.Contains(request.Keyword));
    }

    if (request.CategoryId is not null)
    {
        query = query.Where(product => product.CategoryId == request.CategoryId);
    }

    query = request.SortBy switch
    {
        "price" => query.OrderBy(product => product.Price),
        "createdAt" => query.OrderByDescending(product => product.CreatedAt),
        _ => query.OrderBy(product => product.Name)
    };

    return await query
        .Skip((request.Page - 1) * request.PageSize)
        .Take(request.PageSize)
        .Select(product => new ProductDto
        {
            Id = product.Id,
            Name = product.Name,
            Price = product.Price
        })
        .ToListAsync();
}
```

This keeps the query server-side, limits what the caller can control, and returns DTOs instead of exposing entities.

##### Key Points to Mention

- Use `IQueryable<T>` internally for composition.
- Validate and whitelist sort fields.
- Apply filters before paging.
- Apply deterministic ordering before `Skip` and `Take`.
- Project to DTOs before materialization.
- Return materialized results, not unrestricted query objects.

<!-- question:end:ienumerable-vs-iqueryable-advanced-q04 -->

<!-- question:start:ienumerable-vs-iqueryable-advanced-q05 -->
<!-- question-id: ienumerable-vs-iqueryable-advanced-q05 -->
<!-- question-level: advanced -->
#### 5. What is the difference between provider-side projection and in-memory projection?

##### Expected Answer

Provider-side projection happens before materialization while the query is still `IQueryable<T>`. The provider can translate the projection and return only needed columns.

Example:

```csharp
var users = await dbContext.Users
    .Where(user => user.IsActive)
    .Select(user => new UserDto
    {
        Id = user.Id,
        Email = user.Email
    })
    .ToListAsync();
```

In-memory projection happens after materialization:

```csharp
var entities = await dbContext.Users
    .Where(user => user.IsActive)
    .ToListAsync();

var users = entities.Select(user => new UserDto
{
    Id = user.Id,
    Email = user.Email
}).ToList();
```

The second version loads full entities first. That may retrieve unnecessary columns and may enable tracking when not needed.

##### Key Points to Mention

- Provider-side projection happens before `ToList()`.
- It can reduce selected columns.
- In-memory projection happens after data is loaded.
- Loading full entities can be wasteful for read-only DTO responses.
- Projection is important for performance and API boundaries.

<!-- question:end:ienumerable-vs-iqueryable-advanced-q05 -->

<!-- question:start:ienumerable-vs-iqueryable-advanced-q06 -->
<!-- question-id: ienumerable-vs-iqueryable-advanced-q06 -->
<!-- question-level: advanced -->
#### 6. How would you explain server-side evaluation vs client-side evaluation in EF Core?

##### Expected Answer

Server-side evaluation means the query is translated and executed by the database. This is usually preferred for filtering, joining, sorting, grouping, paging, and aggregation because the database can optimize these operations and return less data.

Client-side evaluation means data is loaded into the application and then processed by .NET. This can be useful for small datasets or application-only logic, but it can be dangerous if it causes large amounts of data to be loaded.

Example of server-side evaluation:

```csharp
var users = await dbContext.Users
    .Where(user => user.IsActive)
    .Take(50)
    .ToListAsync();
```

Example of intentional client-side evaluation:

```csharp
var users = dbContext.Users
    .Where(user => user.IsActive)
    .Select(user => new
    {
        user.Id,
        user.Email
    })
    .AsEnumerable()
    .Select(user => new UserReportDto
    {
        Id = user.Id,
        DisplayEmail = FormatEmail(user.Email)
    })
    .ToList();
```

The server should do the database-friendly work first. The application should only handle logic that cannot or should not run in the database.

##### Key Points to Mention

- Server-side evaluation runs in the database/provider.
- Client-side evaluation runs in .NET memory.
- Filtering and paging should usually be server-side.
- `AsEnumerable()` can intentionally switch to client-side processing.
- Client-side evaluation can cause performance problems with large datasets.
- Use projection to minimize loaded data before switching to memory.

<!-- question:end:ienumerable-vs-iqueryable-advanced-q06 -->

<!-- question:start:ienumerable-vs-iqueryable-advanced-q07 -->
<!-- question-id: ienumerable-vs-iqueryable-advanced-q07 -->
<!-- question-level: advanced -->
#### 7. What are the risks of exposing `IQueryable<T>` from an API endpoint?

##### Expected Answer

Exposing `IQueryable<T>` from an API endpoint or allowing arbitrary query composition can create security, performance, and maintainability risks.

Risks include:

- Callers may request expensive queries.
- Query logic may bypass business rules or security filters.
- Internal entity structure may leak.
- Provider-specific behavior may leak outside the data access layer.
- The application may become vulnerable to unbounded filtering, sorting, or expansion.
- Query execution timing becomes harder to reason about.

A safer approach is to define request models with allowed filters and sort fields, validate them, compose the query internally, apply paging limits, project to DTOs, and return materialized results.

##### Key Points to Mention

- Do not expose unrestricted query power to external callers.
- Validate filters, sort fields, and page size.
- Keep business and security filters inside the application.
- Return DTOs, not entities.
- Materialize results before returning from service/API boundary.
- Consider specification or query object patterns for controlled composition.

<!-- question:end:ienumerable-vs-iqueryable-advanced-q07 -->

<!-- question:start:ienumerable-vs-iqueryable-advanced-q08 -->
<!-- question-id: ienumerable-vs-iqueryable-advanced-q08 -->
<!-- question-level: advanced -->
#### 8. In a clean architecture application, where should `IQueryable<T>` be used?

##### Expected Answer

In a clean architecture application, `IQueryable<T>` should usually stay close to the infrastructure or data access layer because it is tied to provider-based query execution. Application services may use query abstractions, specifications, or repository methods, but domain logic should not depend on EF Core query providers.

A common approach is:

- Domain layer: no `IQueryable<T>` dependency on persistence concerns.
- Application layer: defines use cases, DTOs, request models, specifications, or query interfaces.
- Infrastructure layer: uses EF Core `IQueryable<T>` to implement those queries.
- API layer: sends request parameters and receives materialized DTOs.

Example:

```csharp
public interface IUserQueryService
{
    Task<IReadOnlyList<UserListItemDto>> SearchUsersAsync(UserSearchRequest request);
}
```

Implementation:

```csharp
public async Task<IReadOnlyList<UserListItemDto>> SearchUsersAsync(UserSearchRequest request)
{
    IQueryable<User> query = dbContext.Users.AsNoTracking();

    if (!string.IsNullOrWhiteSpace(request.Keyword))
    {
        query = query.Where(user => user.Email.Contains(request.Keyword));
    }

    return await query
        .OrderBy(user => user.Email)
        .Take(request.PageSize)
        .Select(user => new UserListItemDto
        {
            Id = user.Id,
            Email = user.Email
        })
        .ToListAsync();
}
```

The public abstraction returns DTOs, while `IQueryable<T>` is used internally.

##### Key Points to Mention

- Keep `IQueryable<T>` near data access/provider code.
- Avoid leaking EF Core semantics into the domain layer.
- Application layer can define query contracts or specifications.
- Infrastructure layer implements queries with EF Core.
- Return materialized DTOs across boundaries.
- This improves testability and maintainability.

<!-- question:end:ienumerable-vs-iqueryable-advanced-q08 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
