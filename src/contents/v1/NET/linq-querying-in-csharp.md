---
id: linq-querying-in-csharp
topic: Modern C# patterns
subtopic: LINQ Querying 
category: .NET
---


## Overview

LINQ, or Language Integrated Query, is a set of C# language features and .NET APIs that let developers query data using strongly typed C# code. Instead of writing separate query logic for arrays, lists, XML, databases, and other data sources, LINQ provides a common query model based on sequence operations such as filtering, projection, sorting, grouping, joining, and aggregation.

In C#, LINQ is used through two main styles:

- Query syntax, which looks similar to SQL.
- Method syntax, which uses extension methods such as `Where`, `Select`, `OrderBy`, `GroupBy`, and `Join`.

LINQ matters because modern .NET applications constantly work with collections and data sources. A backend service might filter domain entities, transform DTOs, query Entity Framework Core data, group report results, validate input collections, or compose business rules over in-memory objects. LINQ gives developers a concise and readable way to express those operations.

For interviews, LINQ is important because it tests more than syntax. Interviewers often use LINQ questions to evaluate whether a candidate understands:

- Functional-style transformations in C#.
- Deferred execution and when a query actually runs.
- The difference between `IEnumerable<T>` and `IQueryable<T>`.
- How LINQ behaves with in-memory collections versus database-backed queries.
- Performance risks such as repeated enumeration, unnecessary materialization, client-side evaluation, and inefficient grouping or joining.
- Practical query writing skills using filtering, projection, grouping, joining, ordering, and aggregation.

A strong answer should show that LINQ is not just a shortcut for loops. It is a query abstraction that can produce clean code when used correctly, but it can also create hidden performance or correctness problems when developers do not understand execution timing, provider translation, and materialization.

## Core Concepts

### What LINQ Is

LINQ is a language and library feature that allows query operations to be written directly in C#.

A LINQ query usually has three parts:

1. A data source.
2. A query definition.
3. Query execution.

Example:

```csharp
var numbers = new[] { 1, 2, 3, 4, 5, 6 };

var evenNumbers = numbers
    .Where(number => number % 2 == 0)
    .Select(number => number * 10);

foreach (var number in evenNumbers)
{
    Console.WriteLine(number);
}
```

In this example:

- `numbers` is the data source.
- `Where` filters the sequence.
- `Select` projects each matching value.
- The query executes when `evenNumbers` is enumerated by `foreach`.

LINQ commonly works with:

- Arrays
- `List<T>`
- `Dictionary<TKey, TValue>`
- `IEnumerable<T>`
- `IQueryable<T>`
- XML data
- Entity Framework Core queries
- Custom query providers

### Query Syntax and Method Syntax

C# supports both query syntax and method syntax.

Query syntax:

```csharp
var adults =
    from person in people
    where person.Age >= 18
    orderby person.LastName, person.FirstName
    select person;
```

Method syntax:

```csharp
var adults = people
    .Where(person => person.Age >= 18)
    .OrderBy(person => person.LastName)
    .ThenBy(person => person.FirstName);
```

Both forms are compiled into method calls. Query syntax can be easier to read for complex queries involving `join`, `group`, or multiple `from` clauses. Method syntax is often more common in modern C# code because it is concise, composable, and supports all LINQ operators.

Some operations have no direct query syntax equivalent and must use method syntax, such as:

```csharp
int count = people.Count(person => person.Age >= 18);
Person? first = people.FirstOrDefault(person => person.IsActive);
bool anyInactive = people.Any(person => !person.IsActive);
```

Best practice is to use the syntax that makes the query easiest to understand. Many production codebases prefer method syntax for simple pipelines and query syntax for complex joins or groupings.

### Standard Query Operators

Standard query operators are methods that perform common query operations over sequences.

Common categories include:

| Category | Common Operators | Purpose |
|---|---|---|
| Filtering | `Where`, `OfType` | Keep only matching elements |
| Projection | `Select`, `SelectMany` | Transform elements into another shape |
| Sorting | `OrderBy`, `OrderByDescending`, `ThenBy`, `ThenByDescending` | Sort results |
| Grouping | `GroupBy` | Group elements by key |
| Joining | `Join`, `GroupJoin`, `LeftJoin` where available | Combine related sequences |
| Aggregation | `Count`, `Sum`, `Average`, `Min`, `Max`, `Aggregate` | Produce a single calculated value |
| Element access | `First`, `FirstOrDefault`, `Single`, `SingleOrDefault`, `Last`, `ElementAt` | Retrieve specific elements |
| Set operations | `Distinct`, `Union`, `Intersect`, `Except` | Compare or combine sequences |
| Quantifiers | `Any`, `All`, `Contains` | Test conditions |
| Partitioning | `Skip`, `Take`, `SkipWhile`, `TakeWhile` | Return part of a sequence |
| Materialization | `ToList`, `ToArray`, `ToDictionary`, `ToHashSet` | Execute and store results |

Example using several operators:

```csharp
var topCustomers = customers
    .Where(customer => customer.IsActive)
    .OrderByDescending(customer => customer.TotalSpend)
    .Take(10)
    .Select(customer => new CustomerSummary(
        customer.Id,
        customer.Name,
        customer.TotalSpend))
    .ToList();
```

This query filters active customers, sorts them by spend, takes the top ten, projects them into a DTO, and materializes the result as a list.

### `IEnumerable<T>` and LINQ to Objects

`IEnumerable<T>` represents a sequence that can be enumerated. LINQ to Objects works with in-memory sequences such as arrays and lists.

Example:

```csharp
IEnumerable<string> names = new List<string>
{
    "Alice",
    "Bob",
    "Charlie"
};

var shortNames = names.Where(name => name.Length <= 3);
```

For `IEnumerable<T>`, LINQ operators usually execute in memory using delegates such as `Func<T, bool>`.

Example:

```csharp
Func<string, bool> predicate = name => name.StartsWith("A");

var result = names.Where(predicate);
```

This is useful for in-memory operations, but it means every element may need to be inspected by the application process. For very large collections, developers should consider memory usage and algorithmic complexity.

### `IQueryable<T>` and Provider-Based Queries

`IQueryable<T>` represents a query that can be translated by a provider. The most common example is Entity Framework Core, where a LINQ query is translated into SQL.

Example:

```csharp
IQueryable<Customer> query = dbContext.Customers
    .Where(customer => customer.IsActive)
    .OrderBy(customer => customer.Name);
```

With `IQueryable<T>`, the LINQ expression is represented as an expression tree. A provider, such as EF Core, analyzes that expression tree and translates it into another query language, commonly SQL.

This is a critical interview topic because the same-looking LINQ query can behave differently depending on whether it is running over `IEnumerable<T>` or `IQueryable<T>`.

Example:

```csharp
// Database-side filtering when Customers is IQueryable<Customer>
var customers = await dbContext.Customers
    .Where(customer => customer.Country == "US")
    .ToListAsync();
```

The filter can be translated into SQL and executed by the database.

But if the query is materialized too early:

```csharp
var allCustomers = await dbContext.Customers.ToListAsync();

var usCustomers = allCustomers
    .Where(customer => customer.Country == "US")
    .ToList();
```

The application loads all customers first, then filters in memory. This can be a serious performance problem.

### Deferred Execution

Deferred execution means a LINQ query is not executed when it is defined. It executes when it is enumerated.

Example:

```csharp
var numbers = new List<int> { 1, 2, 3 };

var query = numbers.Where(number => number > 1);

numbers.Add(4);

foreach (var number in query)
{
    Console.WriteLine(number);
}
```

Output:

```text
2
3
4
```

The query includes `4` because it was not executed when it was assigned to `query`. It was executed later during enumeration.

Common operations that trigger execution include:

- `foreach`
- `ToList`
- `ToArray`
- `ToDictionary`
- `Count`
- `Any`
- `First`
- `Single`
- `Sum`
- `Average`
- `Max`
- `Min`

Deferred execution is powerful because it allows query composition:

```csharp
IQueryable<Order> query = dbContext.Orders;

if (status is not null)
{
    query = query.Where(order => order.Status == status);
}

if (fromDate is not null)
{
    query = query.Where(order => order.CreatedAt >= fromDate);
}

var results = await query
    .OrderByDescending(order => order.CreatedAt)
    .Take(50)
    .ToListAsync();
```

The query is built step by step but only sent to the database once.

### Immediate Execution and Materialization

Immediate execution happens when a LINQ operation must produce a final value or materialized collection.

Examples:

```csharp
int count = customers.Count();

bool hasActiveCustomers = customers.Any(customer => customer.IsActive);

List<Customer> activeCustomers = customers
    .Where(customer => customer.IsActive)
    .ToList();
```

`ToList`, `ToArray`, `ToDictionary`, and `ToHashSet` are materialization methods. They execute the query and store the results in memory.

Materialization is useful when:

- You need a stable snapshot of data.
- You will enumerate results multiple times.
- You want to close a database query before further in-memory processing.
- You need collection-specific operations.

But materializing too early can hurt performance:

```csharp
// Bad for large database tables
var customers = await dbContext.Customers.ToListAsync();

var activeCustomers = customers
    .Where(customer => customer.IsActive)
    .Take(100)
    .ToList();
```

Better:

```csharp
var activeCustomers = await dbContext.Customers
    .Where(customer => customer.IsActive)
    .Take(100)
    .ToListAsync();
```

The better version allows the database to filter and limit the result.

### Streaming and Non-Streaming Operators

Some deferred operators can stream results one at a time. Others must process more data before returning results.

Streaming operators include:

```csharp
var result = numbers
    .Where(number => number > 10)
    .Select(number => number * 2);
```

`Where` and `Select` can process each item as it is requested.

Non-streaming operators may need to inspect the full source before returning the first result. Examples include:

```csharp
var ordered = numbers.OrderBy(number => number);
var grouped = people.GroupBy(person => person.DepartmentId);
```

`OrderBy` needs to sort the input. `GroupBy` needs to build groups. These operations can require more memory and time.

This matters for large data sets because a query chain can look simple but still perform expensive work.

### Filtering with `Where`

`Where` filters a sequence based on a predicate.

```csharp
var activeProducts = products
    .Where(product => product.IsActive);
```

Multiple `Where` calls can be composed:

```csharp
var query = products.AsEnumerable();

query = query.Where(product => product.IsActive);
query = query.Where(product => product.Price > 100);
```

For `IQueryable<T>`, multiple filters are typically combined into one database query by the provider.

Common mistake:

```csharp
var expensiveProducts = products
    .Where(product => product.Price > 100)
    .Where(product => product.Category.Name == "Electronics");
```

This is fine if `products` is in memory and all navigation properties are loaded. But with EF Core, navigation access and translation behavior must be considered. Developers should understand what gets translated and whether related data is needed.

### Projection with `Select`

`Select` transforms each element into another shape.

Example:

```csharp
var customerNames = customers
    .Select(customer => customer.Name);
```

Projection into DTOs:

```csharp
var summaries = await dbContext.Customers
    .Where(customer => customer.IsActive)
    .Select(customer => new CustomerSummaryDto
    {
        Id = customer.Id,
        Name = customer.Name,
        Email = customer.Email
    })
    .ToListAsync();
```

Projection is especially important with EF Core because it can reduce data transfer. Instead of loading full entities, you can select only the fields needed by the API response.

Common mistake:

```csharp
var customers = await dbContext.Customers.ToListAsync();

var summaries = customers.Select(customer => new CustomerSummaryDto
{
    Id = customer.Id,
    Name = customer.Name
});
```

This loads full entities first, then maps in memory.

Better:

```csharp
var summaries = await dbContext.Customers
    .Select(customer => new CustomerSummaryDto
    {
        Id = customer.Id,
        Name = customer.Name
    })
    .ToListAsync();
```

### Flattening with `SelectMany`

`SelectMany` flattens nested collections.

Example:

```csharp
var allOrderLines = orders
    .SelectMany(order => order.Lines);
```

Without `SelectMany`, `Select` returns a sequence of sequences:

```csharp
IEnumerable<IEnumerable<OrderLine>> linesByOrder = orders
    .Select(order => order.Lines);
```

With `SelectMany`, the result is a single sequence:

```csharp
IEnumerable<OrderLine> allLines = orders
    .SelectMany(order => order.Lines);
```

`SelectMany` is useful for:

- Orders and order lines.
- Customers and addresses.
- Roles and permissions.
- Parent-child collections.
- Flattening nested DTOs.

Example with parent context:

```csharp
var lineSummaries = orders
    .SelectMany(
        order => order.Lines,
        (order, line) => new
        {
            OrderId = order.Id,
            ProductId = line.ProductId,
            Quantity = line.Quantity
        });
```

### Sorting with `OrderBy` and `ThenBy`

`OrderBy` starts a sort operation. `ThenBy` adds secondary sorting.

```csharp
var sortedPeople = people
    .OrderBy(person => person.LastName)
    .ThenBy(person => person.FirstName);
```

Common mistake:

```csharp
var sortedPeople = people
    .OrderBy(person => person.LastName)
    .OrderBy(person => person.FirstName);
```

The second `OrderBy` starts a new primary sort and can override the previous ordering. Use `ThenBy` for secondary sorting.

Descending sort:

```csharp
var recentOrders = orders
    .OrderByDescending(order => order.CreatedAt)
    .ThenBy(order => order.Id);
```

For pagination, always use deterministic ordering:

```csharp
var page = await dbContext.Orders
    .OrderByDescending(order => order.CreatedAt)
    .ThenByDescending(order => order.Id)
    .Skip(pageIndex * pageSize)
    .Take(pageSize)
    .ToListAsync();
```

Adding a tie-breaker like `Id` helps avoid unstable pages when multiple records have the same date.

### Grouping with `GroupBy`

`GroupBy` groups elements by a key.

```csharp
var ordersByStatus = orders
    .GroupBy(order => order.Status);

foreach (var group in ordersByStatus)
{
    Console.WriteLine(group.Key);

    foreach (var order in group)
    {
        Console.WriteLine(order.Id);
    }
}
```

Projection after grouping:

```csharp
var totalsByStatus = orders
    .GroupBy(order => order.Status)
    .Select(group => new
    {
        Status = group.Key,
        Count = group.Count(),
        Total = group.Sum(order => order.Total)
    });
```

With EF Core, grouping can be translated when the shape maps cleanly to SQL aggregation. Complex group projections may not translate or may require different query design.

Common usage in APIs:

```csharp
var report = await dbContext.Orders
    .Where(order => order.CreatedAt >= start && order.CreatedAt < end)
    .GroupBy(order => order.Status)
    .Select(group => new OrderStatusReportDto
    {
        Status = group.Key,
        Count = group.Count(),
        TotalAmount = group.Sum(order => order.TotalAmount)
    })
    .ToListAsync();
```

### Joining Sequences

`Join` combines two sequences based on matching keys.

```csharp
var query = customers.Join(
    orders,
    customer => customer.Id,
    order => order.CustomerId,
    (customer, order) => new
    {
        CustomerName = customer.Name,
        OrderId = order.Id,
        order.Total
    });
```

Query syntax is often more readable for joins:

```csharp
var query =
    from customer in customers
    join order in orders
        on customer.Id equals order.CustomerId
    select new
    {
        CustomerName = customer.Name,
        OrderId = order.Id,
        order.Total
    };
```

Group join:

```csharp
var customersWithOrders =
    from customer in customers
    join order in orders
        on customer.Id equals order.CustomerId
        into customerOrders
    select new
    {
        Customer = customer,
        Orders = customerOrders
    };
```

Left join pattern:

```csharp
var query =
    from customer in customers
    join order in orders
        on customer.Id equals order.CustomerId
        into customerOrders
    from order in customerOrders.DefaultIfEmpty()
    select new
    {
        CustomerName = customer.Name,
        OrderId = order?.Id
    };
```

In EF Core, joins are often unnecessary if navigation properties are properly modeled. However, explicit joins are still useful for projections, reporting, and queries across non-navigation relationships.

### Aggregation

Aggregation produces a single value from a sequence.

Examples:

```csharp
int count = orders.Count();

decimal total = orders.Sum(order => order.TotalAmount);

decimal average = orders.Average(order => order.TotalAmount);

decimal max = orders.Max(order => order.TotalAmount);
```

Use `Any` instead of `Count() > 0` when you only need to know whether at least one element exists:

```csharp
bool hasOrders = orders.Any();
```

For EF Core, `Any` can translate to an efficient existence check, while `Count` counts matching rows.

Common mistake:

```csharp
if (orders.Count() > 0)
{
    // ...
}
```

Better:

```csharp
if (orders.Any())
{
    // ...
}
```

`Aggregate` is a general-purpose accumulator:

```csharp
var csv = names.Aggregate((current, next) => $"{current}, {next}");
```

For strings, prefer `string.Join` because it is clearer and more efficient:

```csharp
var csv = string.Join(", ", names);
```

### Element Operators

Element operators return specific elements.

Common examples:

```csharp
var first = people.First();
var firstOrDefault = people.FirstOrDefault();

var single = people.Single();
var singleOrDefault = people.SingleOrDefault();
```

Important differences:

| Operator | Behavior |
|---|---|
| `First` | Returns first element; throws if sequence is empty |
| `FirstOrDefault` | Returns first element or default value if empty |
| `Single` | Returns only element; throws if zero or more than one |
| `SingleOrDefault` | Returns only element or default if empty; throws if more than one |

Use `Single` when the business rule requires exactly one match. Use `First` when multiple matches are acceptable and you only need the first.

Example:

```csharp
var user = await dbContext.Users
    .SingleOrDefaultAsync(user => user.Email == email);
```

This communicates that email should be unique. If more than one record matches, an exception exposes a data integrity problem.

For high-traffic paths where exceptions are not desired, you may query with `Take(2)` and handle duplicates explicitly.

### Set Operations

Set operations compare or combine sequences.

```csharp
var uniqueTags = tags.Distinct();

var allIds = internalIds.Union(externalIds);

var sharedIds = internalIds.Intersect(externalIds);

var missingIds = expectedIds.Except(actualIds);
```

For custom types, set operations need correct equality behavior. You can use records, override equality, or pass an equality comparer.

Example with custom comparer:

```csharp
var distinctCustomers = customers.DistinctBy(customer => customer.Email);
```

Common set-related operators include:

- `Distinct`
- `DistinctBy`
- `Union`
- `UnionBy`
- `Intersect`
- `IntersectBy`
- `Except`
- `ExceptBy`

These are useful for deduplication, comparing IDs, and merging data from different sources.

### Partitioning and Pagination

Partitioning operators return part of a sequence.

```csharp
var firstTen = products.Take(10);

var nextTen = products.Skip(10).Take(10);
```

Pagination example:

```csharp
var page = await dbContext.Products
    .Where(product => product.IsActive)
    .OrderBy(product => product.Name)
    .Skip((pageNumber - 1) * pageSize)
    .Take(pageSize)
    .Select(product => new ProductDto
    {
        Id = product.Id,
        Name = product.Name,
        Price = product.Price
    })
    .ToListAsync();
```

Best practices:

- Always order before using `Skip` and `Take`.
- Validate page number and page size.
- Avoid very large offsets for high-scale systems because offset pagination can become expensive.
- Consider keyset pagination for large data sets.

Keyset pagination example:

```csharp
var nextPage = await dbContext.Products
    .Where(product => product.Name.CompareTo(lastName) > 0)
    .OrderBy(product => product.Name)
    .Take(pageSize)
    .ToListAsync();
```

Keyset pagination uses a known last value instead of skipping many rows.

### `Any`, `All`, and `Contains`

Quantifier operators answer yes/no questions.

```csharp
bool hasActiveUsers = users.Any(user => user.IsActive);

bool allUsersVerified = users.All(user => user.IsVerified);

bool containsId = selectedIds.Contains(user.Id);
```

Important detail:

```csharp
bool allVerified = users.All(user => user.IsVerified);
```

If `users` is empty, `All` returns `true`. This is mathematically correct but can surprise developers. If you require at least one item and all must match:

```csharp
bool valid = users.Any() && users.All(user => user.IsVerified);
```

With EF Core, `Contains` over a local list of primitive values is commonly translated into an SQL `IN` expression:

```csharp
var selectedUsers = await dbContext.Users
    .Where(user => selectedIds.Contains(user.Id))
    .ToListAsync();
```

For very large ID lists, consider database-specific limits and alternative designs such as temporary tables, table-valued parameters, or batch processing.

### Null Handling in LINQ

LINQ queries often interact with nullable data.

Example:

```csharp
var names = people
    .Where(person => person.Name is not null)
    .Select(person => person.Name!);
```

Null-safe projection:

```csharp
var cities = customers
    .Select(customer => customer.Address?.City)
    .Where(city => city is not null);
```

Default values:

```csharp
var displayNames = users
    .Select(user => user.DisplayName ?? user.Email);
```

Be careful with `FirstOrDefault` because default can be `null` for reference types and `0` for integers.

```csharp
var firstNumber = numbers.FirstOrDefault();
```

If `numbers` is empty, `firstNumber` is `0`, which may also be a valid number. In such cases, use nullable projection or check with `Any`.

### Custom Types, Equality, and Comparers

LINQ operators such as `Distinct`, `GroupBy`, `ToDictionary`, `Join`, and `Contains` depend on equality.

For primitive types, equality usually works as expected.

For custom classes, default equality compares references unless equality is overridden.

Example:

```csharp
public sealed class Customer
{
    public string Email { get; init; } = "";
}
```

Two `Customer` objects with the same email are not equal by default if they are different instances.

Options:

Use a record:

```csharp
public sealed record CustomerKey(string Email);
```

Use key selector operators:

```csharp
var uniqueCustomers = customers.DistinctBy(customer => customer.Email);
```

Use a custom comparer:

```csharp
public sealed class CustomerEmailComparer : IEqualityComparer<Customer>
{
    public bool Equals(Customer? x, Customer? y)
    {
        return string.Equals(x?.Email, y?.Email, StringComparison.OrdinalIgnoreCase);
    }

    public int GetHashCode(Customer obj)
    {
        return StringComparer.OrdinalIgnoreCase.GetHashCode(obj.Email);
    }
}
```

Then:

```csharp
var uniqueCustomers = customers.Distinct(new CustomerEmailComparer());
```

### `ToDictionary`, `ToLookup`, and `GroupBy`

`ToDictionary` creates a dictionary and requires unique keys.

```csharp
var customersById = customers.ToDictionary(customer => customer.Id);
```

If duplicate keys exist, `ToDictionary` throws an exception.

`ToLookup` creates a lookup where each key can have multiple values.

```csharp
var ordersByCustomerId = orders.ToLookup(order => order.CustomerId);

var ordersForCustomer = ordersByCustomerId[customerId];
```

`GroupBy` creates grouped sequences and is often used for reporting or aggregation.

```csharp
var groups = orders.GroupBy(order => order.CustomerId);
```

Comparison:

| API | Allows Duplicate Keys | Typical Use |
|---|---:|---|
| `ToDictionary` | No | Fast lookup by unique key |
| `ToLookup` | Yes | Fast lookup where one key has many values |
| `GroupBy` | Yes | Grouping and aggregation pipeline |

### LINQ and Entity Framework Core

When LINQ is used with EF Core, the query is translated to database-specific SQL where possible.

Example:

```csharp
var products = await dbContext.Products
    .Where(product => product.IsActive && product.Price > 100)
    .OrderBy(product => product.Name)
    .Select(product => new ProductDto
    {
        Id = product.Id,
        Name = product.Name,
        Price = product.Price
    })
    .ToListAsync();
```

This should execute filtering, ordering, and projection in the database.

Important EF Core LINQ principles:

- Keep queryable operations as `IQueryable<T>` until the final materialization step.
- Use `ToListAsync`, `FirstOrDefaultAsync`, `SingleOrDefaultAsync`, and other async operators for database queries.
- Project only the columns needed for API responses.
- Avoid calling custom C# methods inside filters because they may not translate to SQL.
- Be careful with `AsEnumerable`; it switches from provider-based querying to in-memory LINQ.
- Use `AsNoTracking` for read-only entity queries when change tracking is not needed.
- Avoid N+1 query patterns.
- Understand what runs on the server and what runs in memory.

Example of a bad query for EF Core:

```csharp
var products = await dbContext.Products
    .Where(product => IsExpensive(product.Price))
    .ToListAsync();

static bool IsExpensive(decimal price) => price > 100;
```

The custom method may not translate to SQL.

Better:

```csharp
var products = await dbContext.Products
    .Where(product => product.Price > 100)
    .ToListAsync();
```

### Client Evaluation and Server Evaluation

Server evaluation means the database performs the filtering, sorting, grouping, or aggregation. Client evaluation means the application performs it after data is loaded.

Server-side filtering:

```csharp
var activeUsers = await dbContext.Users
    .Where(user => user.IsActive)
    .ToListAsync();
```

Client-side filtering after materialization:

```csharp
var users = await dbContext.Users.ToListAsync();

var activeUsers = users
    .Where(user => user.IsActive)
    .ToList();
```

The second version loads all users into memory first.

`AsEnumerable` can intentionally switch to client-side LINQ:

```csharp
var results = dbContext.Users
    .Where(user => user.IsActive)
    .AsEnumerable()
    .Where(user => CustomInMemoryRule(user))
    .ToList();
```

This can be valid when:

- The database-side query already reduces the data to a small set.
- The remaining rule cannot be translated to SQL.
- The performance trade-off is acceptable.

But it should be used deliberately and not accidentally.

### Multiple Enumeration

Multiple enumeration happens when the same deferred query is executed more than once.

Example:

```csharp
var activeUsers = users.Where(user => user.IsActive);

int count = activeUsers.Count();

foreach (var user in activeUsers)
{
    Console.WriteLine(user.Name);
}
```

If `users` is a database query, this can trigger multiple database queries. If `users` is an expensive iterator, it can repeat expensive work.

If the results are needed multiple times, materialize once:

```csharp
var activeUsers = users
    .Where(user => user.IsActive)
    .ToList();

int count = activeUsers.Count;

foreach (var user in activeUsers)
{
    Console.WriteLine(user.Name);
}
```

Be careful not to materialize too early. Materialization is useful when you need a snapshot or repeated access, but harmful when it prevents efficient query translation.

### LINQ Performance Considerations

LINQ improves readability, but developers should understand performance.

Common performance concerns:

- Repeated enumeration of deferred queries.
- Materializing large data sets with `ToList`.
- Filtering after materialization instead of before.
- Using `Count() > 0` instead of `Any()`.
- Calling `OrderBy` more than needed.
- Using nested LINQ queries that cause O(n²) behavior.
- Using `GroupBy` or `ToDictionary` without considering memory usage.
- Accidentally switching from `IQueryable<T>` to `IEnumerable<T>`.
- Using custom methods in EF Core query filters.
- Selecting full entities when a DTO projection would be enough.

Example of inefficient nested lookup:

```csharp
var results = customers.Select(customer => new
{
    Customer = customer,
    Orders = orders.Where(order => order.CustomerId == customer.Id).ToList()
});
```

If both collections are in memory, this may scan `orders` for every customer.

Better:

```csharp
var ordersByCustomerId = orders.ToLookup(order => order.CustomerId);

var results = customers.Select(customer => new
{
    Customer = customer,
    Orders = ordersByCustomerId[customer.Id].ToList()
});
```

This builds a lookup once and avoids repeated scanning.

### LINQ Readability and Maintainability

LINQ is best when it makes intent clear.

Readable:

```csharp
var overdueInvoices = invoices
    .Where(invoice => invoice.Status == InvoiceStatus.Open)
    .Where(invoice => invoice.DueDate < today)
    .OrderBy(invoice => invoice.DueDate)
    .Select(invoice => new OverdueInvoiceDto
    {
        Id = invoice.Id,
        CustomerName = invoice.Customer.Name,
        DueDate = invoice.DueDate,
        Amount = invoice.Amount
    })
    .ToList();
```

Hard to read:

```csharp
var result = invoices.Where(x => x.Status == InvoiceStatus.Open && x.DueDate < today)
    .OrderBy(x => x.DueDate)
    .Select(x => new OverdueInvoiceDto { Id = x.Id, CustomerName = x.Customer.Name, DueDate = x.DueDate, Amount = x.Amount })
    .ToList();
```

Best practices:

- Use meaningful lambda parameter names in complex queries.
- Break long queries into steps when it improves clarity.
- Avoid mixing heavy business logic inside LINQ expressions.
- Prefer explicit DTO projection for API responses.
- Keep database queries translatable.
- Use method syntax and query syntax intentionally.
- Add tests for complex query behavior.

### Common Mistakes

Common LINQ mistakes include:

#### Assuming the Query Runs Immediately

```csharp
var query = users.Where(user => user.IsActive);
```

This defines a query. It does not necessarily execute it.

#### Materializing Too Early

```csharp
var users = await dbContext.Users.ToListAsync();

var active = users.Where(user => user.IsActive);
```

This loads all rows before filtering.

#### Using `OrderBy` Twice Instead of `ThenBy`

```csharp
var sorted = users
    .OrderBy(user => user.LastName)
    .OrderBy(user => user.FirstName);
```

Use:

```csharp
var sorted = users
    .OrderBy(user => user.LastName)
    .ThenBy(user => user.FirstName);
```

#### Using `Count() > 0`

```csharp
if (orders.Count() > 0)
{
}
```

Use:

```csharp
if (orders.Any())
{
}
```

#### Ignoring `First`, `Single`, and Default Behavior

```csharp
var user = users.First(user => user.Email == email);
```

This throws if there is no match. Use `FirstOrDefault` or `SingleOrDefault` depending on the business rule.

#### Accidentally Running Client-Side Logic for Database Queries

```csharp
var users = dbContext.Users
    .AsEnumerable()
    .Where(user => ExpensiveCustomCheck(user))
    .ToList();
```

This might load far more data than expected.

#### Reusing Deferred Queries Without Understanding Re-Execution

```csharp
var query = dbContext.Users.Where(user => user.IsActive);

var count = await query.CountAsync();
var list = await query.ToListAsync();
```

This sends two database queries. That may be acceptable, but it should be intentional.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:linq-querying-in-csharp-beginner-q01 -->
#### Beginner Q01: What is LINQ in C#?
<!-- question-id:linq-querying-in-csharp-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

LINQ stands for Language Integrated Query. It is a set of C# language features and .NET APIs that allow developers to query and transform data using strongly typed C# syntax.

LINQ can be used with many data sources, including arrays, lists, dictionaries, XML, and database-backed sources such as Entity Framework Core. It provides common operations such as filtering with `Where`, projection with `Select`, sorting with `OrderBy`, grouping with `GroupBy`, joining with `Join`, and aggregation with `Count`, `Sum`, `Average`, `Min`, and `Max`.

A good answer should mention that LINQ is not a database-only feature. It is a general query abstraction over sequences and query providers.

##### Key Points to Mention

- LINQ means Language Integrated Query.
- It enables strongly typed querying in C#.
- It works with in-memory collections and provider-backed data sources.
- Common operators include `Where`, `Select`, `OrderBy`, `GroupBy`, and `Join`.
- It improves readability and composability when used correctly.

<!-- question:end:linq-querying-in-csharp-beginner-q01 -->

<!-- question:start:linq-querying-in-csharp-beginner-q02 -->
#### Beginner Q02: What is the difference between query syntax and method syntax?
<!-- question-id:linq-querying-in-csharp-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Query syntax is the SQL-like syntax built into C#:

```csharp
var result =
    from product in products
    where product.Price > 100
    orderby product.Name
    select product;
```

Method syntax uses extension methods and lambda expressions:

```csharp
var result = products
    .Where(product => product.Price > 100)
    .OrderBy(product => product.Name);
```

Both forms are semantically equivalent for operations they both support. The compiler translates query syntax into method calls. Method syntax is often more common and supports all LINQ operators. Query syntax can be more readable for joins, groupings, and multi-source queries.

##### Key Points to Mention

- Query syntax looks more like SQL.
- Method syntax uses extension methods and lambdas.
- Query syntax is compiled into method calls.
- Not every LINQ operator has query syntax.
- Choose the syntax that is clearer for the specific query.

<!-- question:end:linq-querying-in-csharp-beginner-q02 -->

<!-- question:start:linq-querying-in-csharp-beginner-q03 -->
#### Beginner Q03: What does `Where` do in LINQ?
<!-- question-id:linq-querying-in-csharp-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`Where` filters a sequence based on a predicate. The predicate is a function that returns `true` for elements that should be included and `false` for elements that should be excluded.

Example:

```csharp
var activeUsers = users
    .Where(user => user.IsActive);
```

This returns only users where `IsActive` is `true`.

A good answer should mention that `Where` usually uses deferred execution when it returns a sequence. The query may not run until it is enumerated or materialized.

##### Key Points to Mention

- `Where` filters a sequence.
- It accepts a predicate.
- It returns matching elements.
- It usually uses deferred execution.
- In EF Core, it can be translated into a database `WHERE` clause.

<!-- question:end:linq-querying-in-csharp-beginner-q03 -->

<!-- question:start:linq-querying-in-csharp-beginner-q04 -->
#### Beginner Q04: What does `Select` do in LINQ?
<!-- question-id:linq-querying-in-csharp-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`Select` projects each element of a sequence into a new form. It is used to transform data.

Example:

```csharp
var names = customers
    .Select(customer => customer.Name);
```

Projection into a DTO:

```csharp
var summaries = customers
    .Select(customer => new CustomerSummaryDto
    {
        Id = customer.Id,
        Name = customer.Name
    });
```

`Select` is especially useful in APIs because it allows developers to return only the fields needed by the client instead of exposing full domain or entity objects.

##### Key Points to Mention

- `Select` transforms each element.
- It is used for projection.
- It can project to primitive values, anonymous objects, DTOs, or records.
- In EF Core, projection can reduce selected columns.
- It is different from `Where`, which filters elements.

<!-- question:end:linq-querying-in-csharp-beginner-q04 -->

<!-- question:start:linq-querying-in-csharp-beginner-q05 -->
#### Beginner Q05: What is deferred execution in LINQ?
<!-- question-id:linq-querying-in-csharp-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Deferred execution means a LINQ query is not executed when it is defined. Instead, it is executed when the result is enumerated or materialized.

Example:

```csharp
var numbers = new List<int> { 1, 2, 3 };

var query = numbers.Where(number => number > 1);

numbers.Add(4);

var result = query.ToList();
```

The result contains `2`, `3`, and `4` because the query runs when `ToList` is called, not when `query` is defined.

Deferred execution allows queries to be composed before execution and can improve efficiency. However, it can also surprise developers if the source collection changes or if the query is enumerated multiple times.

##### Key Points to Mention

- Query definition and query execution are separate.
- Sequence-returning operators usually defer execution.
- Execution happens during enumeration or materialization.
- `ToList`, `ToArray`, `Count`, `Any`, `First`, and `Single` trigger execution.
- Deferred execution enables query composition but can cause repeated execution.

<!-- question:end:linq-querying-in-csharp-beginner-q05 -->

<!-- question:start:linq-querying-in-csharp-beginner-q06 -->
#### Beginner Q06: What is the difference between `First` and `FirstOrDefault`?
<!-- question-id:linq-querying-in-csharp-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

`First` returns the first element of a sequence or the first element that matches a predicate. It throws an exception if no matching element exists.

`FirstOrDefault` returns the first matching element if one exists, otherwise it returns the default value for the type. For reference types, the default is usually `null`. For value types, the default might be `0`, `false`, or the default struct value.

Example:

```csharp
var user = users.FirstOrDefault(user => user.Email == email);

if (user is null)
{
    return NotFound();
}
```

Use `First` when the absence of a result is exceptional. Use `FirstOrDefault` when no result is expected and should be handled normally.

##### Key Points to Mention

- `First` throws if no item exists.
- `FirstOrDefault` returns default if no item exists.
- For reference types, default is usually `null`.
- Choose based on expected business behavior.
- Be careful with default values for value types.

<!-- question:end:linq-querying-in-csharp-beginner-q06 -->

<!-- question:start:linq-querying-in-csharp-beginner-q07 -->
#### Beginner Q07: What is the difference between `Any` and `Count`?
<!-- question-id:linq-querying-in-csharp-beginner-q07 -->
<!-- question-level:beginner -->

##### Expected Answer

`Any` checks whether at least one element exists or at least one element matches a predicate. `Count` counts the number of elements.

If the goal is only to check existence, `Any` is usually preferred:

```csharp
if (orders.Any())
{
    // At least one order exists
}
```

Instead of:

```csharp
if (orders.Count() > 0)
{
    // At least one order exists
}
```

`Any` can stop as soon as it finds one matching item. `Count` may need to count all matching items, depending on the source and provider.

##### Key Points to Mention

- `Any` checks existence.
- `Count` returns the number of items.
- Prefer `Any` for existence checks.
- `Any` can short-circuit.
- In database queries, `Any` can translate to an efficient existence query.

<!-- question:end:linq-querying-in-csharp-beginner-q07 -->

<!-- question:start:linq-querying-in-csharp-beginner-q08 -->
#### Beginner Q08: What is `ToList` used for in LINQ?
<!-- question-id:linq-querying-in-csharp-beginner-q08 -->
<!-- question-level:beginner -->

##### Expected Answer

`ToList` materializes a LINQ query into a `List<T>`. It executes the query immediately and stores the results in memory.

Example:

```csharp
var activeUsers = users
    .Where(user => user.IsActive)
    .ToList();
```

`ToList` is useful when you need a snapshot, need to enumerate the results multiple times, or need list-specific operations. However, calling `ToList` too early can hurt performance, especially with database queries, because it may load more data than needed.

##### Key Points to Mention

- `ToList` executes the query.
- It stores results in memory.
- It is a materialization method.
- Useful for snapshots and repeated enumeration.
- Dangerous if used too early before filtering or projection.

<!-- question:end:linq-querying-in-csharp-beginner-q08 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:linq-querying-in-csharp-intermediate-q01 -->
#### Intermediate Q01: What is the difference between `IEnumerable<T>` and `IQueryable<T>`?
<!-- question-id:linq-querying-in-csharp-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

`IEnumerable<T>` represents an in-memory sequence that can be enumerated. LINQ operators over `IEnumerable<T>` usually use delegates and execute in the application process.

`IQueryable<T>` represents a query that can be translated by a query provider. LINQ operators over `IQueryable<T>` build expression trees. A provider such as Entity Framework Core can translate those expression trees into SQL or another query language.

Example:

```csharp
IEnumerable<Customer> inMemoryCustomers = customersList;

IQueryable<Customer> databaseCustomers = dbContext.Customers;
```

With `IEnumerable<T>`, filtering happens in memory. With `IQueryable<T>`, filtering may happen in the database if the provider can translate the expression.

This distinction is critical for performance. Accidentally converting `IQueryable<T>` to `IEnumerable<T>` too early can cause data to be loaded into memory before filtering, sorting, or pagination.

##### Key Points to Mention

- `IEnumerable<T>` is for enumerable sequences.
- `IQueryable<T>` is for provider-backed query composition.
- `IEnumerable<T>` uses delegates.
- `IQueryable<T>` uses expression trees.
- EF Core translates `IQueryable<T>` expressions to SQL.
- Avoid switching to `IEnumerable<T>` too early for database queries.

<!-- question:end:linq-querying-in-csharp-intermediate-q01 -->

<!-- question:start:linq-querying-in-csharp-intermediate-q02 -->
#### Intermediate Q02: What is the difference between deferred execution and immediate execution?
<!-- question-id:linq-querying-in-csharp-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Deferred execution means a query is not executed when it is defined. It is executed later when the results are enumerated.

Example:

```csharp
var query = users.Where(user => user.IsActive);
```

This defines a query.

Immediate execution means the query runs immediately because the operation must return a final value or materialized collection.

Examples:

```csharp
var list = users.Where(user => user.IsActive).ToList();

var count = users.Count(user => user.IsActive);

var exists = users.Any(user => user.IsActive);
```

Operators returning sequences, such as `Where` and `Select`, usually use deferred execution. Operators returning scalar values, such as `Count`, `Any`, `First`, `Single`, `Sum`, and `Average`, execute immediately.

##### Key Points to Mention

- Deferred execution delays query evaluation.
- Immediate execution happens when a final value or collection is required.
- `Where` and `Select` are commonly deferred.
- `ToList`, `Count`, `Any`, and `First` trigger execution.
- Deferred execution enables composition but can cause repeated execution.

<!-- question:end:linq-querying-in-csharp-intermediate-q02 -->

<!-- question:start:linq-querying-in-csharp-intermediate-q03 -->
#### Intermediate Q03: What is multiple enumeration and why can it be a problem?
<!-- question-id:linq-querying-in-csharp-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Multiple enumeration happens when the same deferred query is enumerated more than once.

Example:

```csharp
var activeUsers = users.Where(user => user.IsActive);

var count = activeUsers.Count();

foreach (var user in activeUsers)
{
    Console.WriteLine(user.Name);
}
```

If `users` is an in-memory list, this repeats the filtering work. If `users` is an EF Core query, it can send multiple database queries. If the source is an iterator with side effects, it can produce unexpected behavior.

If results are needed multiple times, materialize once:

```csharp
var activeUsers = users
    .Where(user => user.IsActive)
    .ToList();

var count = activeUsers.Count;
```

However, materialization should be done at the right time, after filtering and projection when possible.

##### Key Points to Mention

- Deferred queries can execute each time they are enumerated.
- Multiple enumeration can repeat expensive work.
- With EF Core, it can cause multiple database queries.
- Materialize with `ToList` when repeated access is needed.
- Do not materialize too early.

<!-- question:end:linq-querying-in-csharp-intermediate-q03 -->

<!-- question:start:linq-querying-in-csharp-intermediate-q04 -->
#### Intermediate Q04: What is the difference between `Select` and `SelectMany`?
<!-- question-id:linq-querying-in-csharp-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

`Select` transforms each element into another value. If each element is transformed into a collection, the result is a sequence of collections.

`SelectMany` transforms each element into a collection and flattens the results into one sequence.

Example:

```csharp
var linesByOrder = orders.Select(order => order.Lines);
```

This returns `IEnumerable<IEnumerable<OrderLine>>`.

```csharp
var allLines = orders.SelectMany(order => order.Lines);
```

This returns `IEnumerable<OrderLine>`.

`SelectMany` is useful for parent-child relationships, such as orders and order lines, customers and addresses, users and roles, or roles and permissions.

##### Key Points to Mention

- `Select` maps one input item to one output item.
- `SelectMany` maps one input item to many output items and flattens them.
- `Select` can produce nested sequences.
- `SelectMany` is useful for child collections.
- Query syntax with multiple `from` clauses often translates to `SelectMany`.

<!-- question:end:linq-querying-in-csharp-intermediate-q04 -->

<!-- question:start:linq-querying-in-csharp-intermediate-q05 -->
#### Intermediate Q05: What is the difference between `First`, `Single`, `FirstOrDefault`, and `SingleOrDefault`?
<!-- question-id:linq-querying-in-csharp-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

`First` returns the first matching element and throws if no element exists.

`FirstOrDefault` returns the first matching element or the default value if no element exists.

`Single` expects exactly one matching element. It throws if no element exists or if more than one element exists.

`SingleOrDefault` returns the single matching element or default if none exists, but throws if more than one element exists.

Use `First` or `FirstOrDefault` when multiple matches are acceptable and you only need the first. Use `Single` or `SingleOrDefault` when the business rule requires uniqueness.

Example:

```csharp
var user = await dbContext.Users
    .SingleOrDefaultAsync(user => user.Email == email);
```

This communicates that email should identify at most one user.

##### Key Points to Mention

- `First` allows multiple matches but returns the first.
- `Single` requires exactly one match.
- `OrDefault` versions return default when no match exists.
- `Single` and `SingleOrDefault` throw on multiple matches.
- Use `Single` to express uniqueness expectations.

<!-- question:end:linq-querying-in-csharp-intermediate-q05 -->

<!-- question:start:linq-querying-in-csharp-intermediate-q06 -->
#### Intermediate Q06: Why is `OrderBy().OrderBy()` usually wrong?
<!-- question-id:linq-querying-in-csharp-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

A second `OrderBy` starts a new primary ordering. It does not add a secondary sort. If you want secondary sorting, use `ThenBy`.

Wrong:

```csharp
var result = people
    .OrderBy(person => person.LastName)
    .OrderBy(person => person.FirstName);
```

Correct:

```csharp
var result = people
    .OrderBy(person => person.LastName)
    .ThenBy(person => person.FirstName);
```

Use `OrderBy` or `OrderByDescending` for the first sort key. Use `ThenBy` or `ThenByDescending` for additional sort keys.

##### Key Points to Mention

- `OrderBy` creates a new ordering.
- `ThenBy` adds secondary ordering.
- Repeated `OrderBy` can override previous ordering.
- Use `ThenByDescending` for descending secondary sort.
- Deterministic ordering is important for pagination.

<!-- question:end:linq-querying-in-csharp-intermediate-q06 -->

<!-- question:start:linq-querying-in-csharp-intermediate-q07 -->
#### Intermediate Q07: How does `GroupBy` work in LINQ?
<!-- question-id:linq-querying-in-csharp-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

`GroupBy` groups elements by a key. It returns groups where each group has a `Key` and a sequence of elements belonging to that key.

Example:

```csharp
var ordersByStatus = orders
    .GroupBy(order => order.Status);

foreach (var group in ordersByStatus)
{
    Console.WriteLine(group.Key);
    Console.WriteLine(group.Count());
}
```

For reporting, `GroupBy` is commonly followed by projection and aggregation:

```csharp
var report = orders
    .GroupBy(order => order.Status)
    .Select(group => new
    {
        Status = group.Key,
        Count = group.Count(),
        Total = group.Sum(order => order.TotalAmount)
    });
```

In EF Core, simple grouping with aggregate projection often translates to SQL. Complex grouping shapes may not translate as expected.

##### Key Points to Mention

- `GroupBy` groups items by key.
- Each group has a `Key`.
- Commonly used with `Count`, `Sum`, `Average`, `Min`, and `Max`.
- Useful for reports and summaries.
- EF Core translation depends on query shape and provider capabilities.

<!-- question:end:linq-querying-in-csharp-intermediate-q07 -->

<!-- question:start:linq-querying-in-csharp-intermediate-q08 -->
#### Intermediate Q08: How do joins work in LINQ?
<!-- question-id:linq-querying-in-csharp-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

LINQ joins combine elements from two sequences based on matching keys.

Method syntax:

```csharp
var result = customers.Join(
    orders,
    customer => customer.Id,
    order => order.CustomerId,
    (customer, order) => new
    {
        customer.Name,
        order.Id,
        order.TotalAmount
    });
```

Query syntax:

```csharp
var result =
    from customer in customers
    join order in orders
        on customer.Id equals order.CustomerId
    select new
    {
        customer.Name,
        order.Id,
        order.TotalAmount
    };
```

For left joins, a common pattern is `GroupJoin` with `DefaultIfEmpty`.

```csharp
var result =
    from customer in customers
    join order in orders
        on customer.Id equals order.CustomerId
        into customerOrders
    from order in customerOrders.DefaultIfEmpty()
    select new
    {
        customer.Name,
        OrderId = order?.Id
    };
```

In EF Core, navigation properties often reduce the need for explicit joins, but explicit joins are still useful for reporting and custom projections.

##### Key Points to Mention

- `Join` matches elements by key.
- Query syntax is often clearer for joins.
- Left joins can be written with `GroupJoin` and `DefaultIfEmpty`.
- EF Core can translate many joins to SQL.
- Navigation properties can often replace explicit joins.

<!-- question:end:linq-querying-in-csharp-intermediate-q08 -->

<!-- question:start:linq-querying-in-csharp-intermediate-q09 -->
#### Intermediate Q09: What is the difference between `ToDictionary`, `ToLookup`, and `GroupBy`?
<!-- question-id:linq-querying-in-csharp-intermediate-q09 -->
<!-- question-level:intermediate -->

##### Expected Answer

`ToDictionary` creates a dictionary from a sequence and requires unique keys. It throws if duplicate keys exist.

```csharp
var customersById = customers.ToDictionary(customer => customer.Id);
```

`ToLookup` creates a lookup where one key can map to multiple values.

```csharp
var ordersByCustomer = orders.ToLookup(order => order.CustomerId);
```

`GroupBy` groups elements by key and is useful in query pipelines, often followed by aggregation or projection.

```csharp
var totals = orders
    .GroupBy(order => order.CustomerId)
    .Select(group => new
    {
        CustomerId = group.Key,
        Total = group.Sum(order => order.TotalAmount)
    });
```

Use `ToDictionary` for unique-key lookup, `ToLookup` for repeated lookups where keys can have multiple values, and `GroupBy` for grouping and aggregation.

##### Key Points to Mention

- `ToDictionary` requires unique keys.
- `ToLookup` allows multiple values per key.
- `GroupBy` groups within a query pipeline.
- `ToDictionary` and `ToLookup` materialize immediately.
- Choose based on lookup and grouping needs.

<!-- question:end:linq-querying-in-csharp-intermediate-q09 -->

<!-- question:start:linq-querying-in-csharp-intermediate-q10 -->
#### Intermediate Q10: How should LINQ be used for pagination?
<!-- question-id:linq-querying-in-csharp-intermediate-q10 -->
<!-- question-level:intermediate -->

##### Expected Answer

Pagination is commonly implemented with `OrderBy`, `Skip`, and `Take`.

Example:

```csharp
var page = await dbContext.Products
    .Where(product => product.IsActive)
    .OrderBy(product => product.Name)
    .Skip((pageNumber - 1) * pageSize)
    .Take(pageSize)
    .Select(product => new ProductDto
    {
        Id = product.Id,
        Name = product.Name,
        Price = product.Price
    })
    .ToListAsync();
```

Always apply a deterministic order before `Skip` and `Take`; otherwise, page results may be inconsistent. For large offsets, offset pagination can become inefficient because the database may still need to scan or sort many skipped rows. For high-scale systems, keyset pagination may be better.

##### Key Points to Mention

- Use `OrderBy`, then `Skip`, then `Take`.
- Always apply deterministic ordering.
- Validate `pageNumber` and `pageSize`.
- Project only needed fields.
- Large offsets can be expensive.
- Consider keyset pagination for large datasets.

<!-- question:end:linq-querying-in-csharp-intermediate-q10 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:linq-querying-in-csharp-advanced-q01 -->
#### Advanced Q01: How does LINQ work with Entity Framework Core?
<!-- question-id:linq-querying-in-csharp-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

EF Core uses LINQ over `IQueryable<T>`. When developers compose a query against a `DbSet<T>`, EF Core builds an expression tree representing the query. The database provider analyzes the expression tree and translates supported parts into database-specific SQL.

Example:

```csharp
var result = await dbContext.Orders
    .Where(order => order.Status == OrderStatus.Open)
    .OrderByDescending(order => order.CreatedAt)
    .Select(order => new OrderDto
    {
        Id = order.Id,
        CreatedAt = order.CreatedAt,
        TotalAmount = order.TotalAmount
    })
    .ToListAsync();
```

This query can be translated into SQL so filtering, ordering, and projection happen in the database.

A strong answer should mention that not every C# expression can be translated. Custom methods, complex local logic, and unsupported operations may fail translation or require explicit client evaluation. Developers should keep database queries provider-translatable, project only needed columns, use async materialization, and avoid switching to `IEnumerable<T>` too early.

##### Key Points to Mention

- EF Core queries are usually `IQueryable<T>`.
- LINQ expressions become expression trees.
- Providers translate expression trees to SQL.
- Query execution happens on materialization or enumeration.
- Not all C# logic can be translated.
- Use projection, `AsNoTracking`, async operators, and server-side filtering.

<!-- question:end:linq-querying-in-csharp-advanced-q01 -->

<!-- question:start:linq-querying-in-csharp-advanced-q02 -->
#### Advanced Q02: What is client-side evaluation and why can it be dangerous?
<!-- question-id:linq-querying-in-csharp-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Client-side evaluation means part of a query is executed in the application instead of the database. This can be dangerous when it causes the application to load too much data and then filter, sort, or process it in memory.

Example of risky client-side processing:

```csharp
var users = await dbContext.Users.ToListAsync();

var result = users
    .Where(user => CustomRule(user))
    .ToList();
```

This loads all users first. If the table is large, it can cause poor performance, high memory usage, and slow responses.

Sometimes client-side evaluation is intentional:

```csharp
var candidates = await dbContext.Users
    .Where(user => user.IsActive)
    .Take(100)
    .ToListAsync();

var result = candidates
    .Where(user => CustomInMemoryRule(user))
    .ToList();
```

This can be acceptable if the database query first reduces the result to a small set.

A strong answer should mention that EF Core tries to evaluate as much as possible on the server and that developers should be careful with custom methods, `AsEnumerable`, and early `ToList`.

##### Key Points to Mention

- Client-side evaluation runs logic in the application.
- It can load more data than necessary.
- It can cause performance and memory problems.
- Custom methods in filters often cannot translate to SQL.
- Use server-side filtering whenever possible.
- Explicit client-side processing can be acceptable after reducing data size.

<!-- question:end:linq-querying-in-csharp-advanced-q02 -->

<!-- question:start:linq-querying-in-csharp-advanced-q03 -->
#### Advanced Q03: What happens when you call `AsEnumerable` on an `IQueryable<T>`?
<!-- question-id:linq-querying-in-csharp-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Calling `AsEnumerable` changes how subsequent LINQ operators are resolved. Before `AsEnumerable`, operators are typically `Queryable` operators that build expression trees for provider translation. After `AsEnumerable`, subsequent operators are `Enumerable` operators that run in memory using delegates.

Example:

```csharp
var result = dbContext.Users
    .Where(user => user.IsActive)
    .AsEnumerable()
    .Where(user => CustomRule(user))
    .ToList();
```

The first `Where` can be translated to SQL. After `AsEnumerable`, `CustomRule` runs in memory. This can be useful when a rule cannot be translated, but it must be used carefully because it can shift work from the database to the application.

A good answer should also mention that `AsEnumerable` does not itself create a list like `ToList`, but it changes the LINQ provider used by later operators.

##### Key Points to Mention

- `AsEnumerable` switches subsequent operations to LINQ to Objects.
- It does not materialize into a list by itself.
- It can force later filtering to happen in memory.
- It can be useful for non-translatable logic after server-side filtering.
- It can be dangerous if used before filtering or pagination.

<!-- question:end:linq-querying-in-csharp-advanced-q03 -->

<!-- question:start:linq-querying-in-csharp-advanced-q04 -->
#### Advanced Q04: How can LINQ cause N+1 query problems?
<!-- question-id:linq-querying-in-csharp-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

An N+1 query problem happens when an application runs one query to load parent records and then runs one additional query for each parent to load related data.

Example pattern:

```csharp
var customers = await dbContext.Customers.ToListAsync();

foreach (var customer in customers)
{
    var orders = await dbContext.Orders
        .Where(order => order.CustomerId == customer.Id)
        .ToListAsync();

    Console.WriteLine($"{customer.Name}: {orders.Count}");
}
```

If there are 100 customers, this can produce 101 queries.

Better approaches include projection, explicit joins, eager loading where appropriate, or grouped queries.

Projection example:

```csharp
var customers = await dbContext.Customers
    .Select(customer => new CustomerOrderSummaryDto
    {
        CustomerId = customer.Id,
        CustomerName = customer.Name,
        OrderCount = customer.Orders.Count
    })
    .ToListAsync();
```

A strong answer should explain that LINQ can hide query execution behind navigation properties or loops. Developers should inspect generated SQL, use logging, and design queries to fetch required data efficiently.

##### Key Points to Mention

- N+1 means one query plus one query per item.
- It often happens in loops or lazy-loaded navigation access.
- It causes poor performance and database load.
- Use projection, eager loading, joins, or grouped queries.
- Inspect generated SQL and logs.

<!-- question:end:linq-querying-in-csharp-advanced-q04 -->

<!-- question:start:linq-querying-in-csharp-advanced-q05 -->
#### Advanced Q05: How do expression trees relate to LINQ?
<!-- question-id:linq-querying-in-csharp-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Expression trees represent code as data. In LINQ, `IQueryable<T>` operators accept expression trees such as `Expression<Func<T, bool>>` instead of compiled delegates. This allows a query provider to inspect the expression and translate it into another query language, such as SQL.

For `IEnumerable<T>`:

```csharp
Func<User, bool> predicate = user => user.IsActive;
var result = users.Where(predicate);
```

The predicate is compiled code that runs in memory.

For `IQueryable<T>`:

```csharp
Expression<Func<User, bool>> predicate = user => user.IsActive;
var result = dbContext.Users.Where(predicate);
```

The expression can be inspected and translated by EF Core.

This is why some C# code works with in-memory LINQ but not with EF Core. A provider can only translate expressions it understands.

##### Key Points to Mention

- Expression trees represent code structure as data.
- `IQueryable<T>` uses expression trees.
- `IEnumerable<T>` uses delegates.
- Providers inspect expression trees for translation.
- Unsupported expressions may fail translation.
- Expression trees enable dynamic query composition.

<!-- question:end:linq-querying-in-csharp-advanced-q05 -->

<!-- question:start:linq-querying-in-csharp-advanced-q06 -->
#### Advanced Q06: How can you build dynamic LINQ queries safely?
<!-- question-id:linq-querying-in-csharp-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Dynamic LINQ queries are built by conditionally composing query operators based on input.

Example:

```csharp
IQueryable<Order> query = dbContext.Orders;

if (status is not null)
{
    query = query.Where(order => order.Status == status);
}

if (fromDate is not null)
{
    query = query.Where(order => order.CreatedAt >= fromDate);
}

if (toDate is not null)
{
    query = query.Where(order => order.CreatedAt < toDate);
}

var result = await query
    .OrderByDescending(order => order.CreatedAt)
    .Take(100)
    .ToListAsync();
```

This is safe and composable because each condition adds a strongly typed expression. Avoid building raw SQL strings or accepting arbitrary user-provided expression strings unless carefully validated.

For advanced scenarios, developers can build expression trees dynamically, use specifications, or use libraries designed for dynamic query composition. Security and validation are important when user input controls sorting, filtering, or selected fields.

##### Key Points to Mention

- Start with an `IQueryable<T>`.
- Add `Where`, `OrderBy`, and other operators conditionally.
- Keep expressions strongly typed when possible.
- Validate user input for filters and sorting.
- Avoid unsafe raw SQL or arbitrary expression execution.
- Materialize only after the query is fully composed.

<!-- question:end:linq-querying-in-csharp-advanced-q06 -->

<!-- question:start:linq-querying-in-csharp-advanced-q07 -->
#### Advanced Q07: What are common LINQ performance pitfalls?
<!-- question-id:linq-querying-in-csharp-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Common LINQ performance pitfalls include:

- Materializing too early with `ToList`.
- Repeatedly enumerating deferred queries.
- Filtering in memory instead of in the database.
- Using `Count() > 0` instead of `Any()`.
- Using nested queries that repeatedly scan collections.
- Sorting large collections unnecessarily.
- Using `GroupBy`, `ToDictionary`, or `ToLookup` without considering memory.
- Calling custom methods inside EF Core filters.
- Selecting full entities instead of DTO projections.
- Accidentally switching from `IQueryable<T>` to `IEnumerable<T>`.

Example of repeated scanning:

```csharp
var result = customers.Select(customer => new
{
    customer.Id,
    Orders = orders.Where(order => order.CustomerId == customer.Id).ToList()
});
```

Better:

```csharp
var ordersByCustomer = orders.ToLookup(order => order.CustomerId);

var result = customers.Select(customer => new
{
    customer.Id,
    Orders = ordersByCustomer[customer.Id].ToList()
});
```

A strong answer should explain that LINQ is not automatically optimized in all cases. Developers still need to understand data size, execution location, algorithmic complexity, and provider behavior.

##### Key Points to Mention

- LINQ improves readability but does not remove performance concerns.
- Avoid early materialization.
- Avoid repeated enumeration.
- Understand server-side vs client-side execution.
- Use `Any` for existence checks.
- Use lookups or dictionaries to avoid repeated scans.
- Inspect SQL for EF Core queries.

<!-- question:end:linq-querying-in-csharp-advanced-q07 -->

<!-- question:start:linq-querying-in-csharp-advanced-q08 -->
#### Advanced Q08: How should LINQ queries be tested?
<!-- question-id:linq-querying-in-csharp-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

LINQ queries should be tested based on the type of query.

For in-memory LINQ, unit tests can use lists and verify filtering, sorting, projection, grouping, and edge cases.

Example:

```csharp
[Fact]
public void Returns_Only_Active_Customers()
{
    var customers = new List<Customer>
    {
        new() { Id = 1, IsActive = true },
        new() { Id = 2, IsActive = false }
    };

    var result = customers
        .Where(customer => customer.IsActive)
        .ToList();

    Assert.Single(result);
    Assert.Equal(1, result[0].Id);
}
```

For EF Core queries, tests should consider translation behavior. A query that works against an in-memory list might fail against a real database provider. Integration tests using SQLite, SQL Server, or the real provider are often more reliable for testing database queries.

A strong answer should mention testing edge cases such as empty sequences, duplicates, null values, ordering, pagination boundaries, and multiple matches for `Single`.

##### Key Points to Mention

- In-memory LINQ can be unit tested with lists.
- EF Core query translation should be tested with a relational provider.
- In-memory tests do not prove SQL translation works.
- Test empty collections, nulls, duplicates, ordering, and pagination.
- Test business rules around `First` versus `Single`.

<!-- question:end:linq-querying-in-csharp-advanced-q08 -->

<!-- question:start:linq-querying-in-csharp-advanced-q09 -->
#### Advanced Q09: When should you avoid LINQ?
<!-- question-id:linq-querying-in-csharp-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

LINQ should be avoided or used carefully when it makes code less clear, causes unnecessary allocations, hides expensive operations, or prevents efficient database translation.

Examples include:

- Extremely performance-sensitive loops where allocations matter.
- Complex business logic that becomes unreadable inside chained lambdas.
- Database queries that require provider-specific SQL features.
- Large data processing where streaming or batching is more appropriate.
- Queries where repeated enumeration or hidden materialization creates problems.

A simple loop may be better when it is clearer or more efficient:

```csharp
var total = 0m;

foreach (var order in orders)
{
    if (order.Status == OrderStatus.Paid)
    {
        total += order.TotalAmount;
    }
}
```

This can be easier to debug and optimize than a complex LINQ chain.

A strong answer should not say LINQ is bad. The correct view is that LINQ is excellent for many transformations, but developers should choose clarity, correctness, and performance over cleverness.

##### Key Points to Mention

- Avoid LINQ when it harms readability.
- Avoid it in extremely performance-sensitive hot paths if profiling shows overhead.
- Avoid non-translatable expressions in database queries.
- Use loops when they are clearer.
- Use SQL or stored procedures when query requirements exceed LINQ/provider capabilities.
- Base decisions on profiling and maintainability.

<!-- question:end:linq-querying-in-csharp-advanced-q09 -->

<!-- question:start:linq-querying-in-csharp-advanced-q10 -->
#### Advanced Q10: How do you explain LINQ query execution in a production API endpoint?
<!-- question-id:linq-querying-in-csharp-advanced-q10 -->
<!-- question-level:advanced -->

##### Expected Answer

In a production API endpoint, a good LINQ query should be composed as an `IQueryable<T>` until all filters, sorting, projection, and pagination are applied. Then it should be materialized once with an async method such as `ToListAsync`.

Example:

```csharp
[HttpGet]
public async Task<ActionResult<IReadOnlyList<ProductDto>>> GetProducts(
    string? search,
    int pageNumber = 1,
    int pageSize = 20)
{
    IQueryable<Product> query = dbContext.Products
        .AsNoTracking()
        .Where(product => product.IsActive);

    if (!string.IsNullOrWhiteSpace(search))
    {
        query = query.Where(product => product.Name.Contains(search));
    }

    var products = await query
        .OrderBy(product => product.Name)
        .Skip((pageNumber - 1) * pageSize)
        .Take(pageSize)
        .Select(product => new ProductDto
        {
            Id = product.Id,
            Name = product.Name,
            Price = product.Price
        })
        .ToListAsync();

    return Ok(products);
}
```

The important production concerns are:

- Keep filtering and pagination in the database.
- Use `AsNoTracking` for read-only queries.
- Project to DTOs instead of returning entities.
- Use deterministic ordering.
- Validate paging inputs.
- Materialize once at the boundary.
- Avoid custom methods that cannot translate to SQL.
- Consider indexes for filtered and sorted columns.

##### Key Points to Mention

- Compose the query before executing it.
- Keep operations server-side where possible.
- Use async EF Core methods.
- Project to DTOs.
- Apply ordering before pagination.
- Use `AsNoTracking` for read-only queries.
- Materialize once with `ToListAsync` or another terminal operator.

<!-- question:end:linq-querying-in-csharp-advanced-q10 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
