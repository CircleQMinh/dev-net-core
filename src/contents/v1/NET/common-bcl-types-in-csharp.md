---
id: common-bcl-types-in-csharp
topic: C# Language Foundations
subtopic: Common BCL Types in C#
category: .NET
---

## Overview

The Base Class Library, usually called the BCL, is the core set of .NET types that C# developers use every day. It includes fundamental types for values, text, collections, dates and times, I/O, exceptions, threading, asynchronous programming, reflection, memory handling, and many other common tasks.

In C#, many language keywords are aliases for BCL types. For example, `int` maps to `System.Int32`, `string` maps to `System.String`, `object` maps to `System.Object`, and `bool` maps to `System.Boolean`. This means that learning C# well also requires understanding the common .NET types behind the language syntax.

This topic matters because interviewers often use BCL types to test practical .NET knowledge. They may ask why `string` is immutable, when to use `StringBuilder`, how `List<T>` differs from `IEnumerable<T>`, why `DateTimeOffset` is often safer than `DateTime`, how `Task` works with `async`/`await`, or why `decimal` is preferred for money. These questions reveal whether a candidate can write correct, maintainable, and production-ready C# code.

Common BCL types are used everywhere in .NET applications: ASP.NET Core APIs, background services, EF Core applications, file processing, logging, validation, data transfer objects, domain models, middleware, tests, and cloud integrations. A strong understanding of these types helps developers avoid common bugs involving nulls, culture-sensitive string comparisons, time zones, collection performance, memory allocations, and asynchronous execution.

## Core Concepts

### What the BCL Means in .NET

The Base Class Library is the common library of reusable types provided by .NET. It contains the basic building blocks used by applications and higher-level frameworks.

Examples include:

- `System.Object`
- `System.String`
- `System.Int32`
- `System.DateTime`
- `System.DateTimeOffset`
- `System.Guid`
- `System.Exception`
- `System.Collections.Generic.List<T>`
- `System.Collections.Generic.Dictionary<TKey, TValue>`
- `System.Threading.Tasks.Task`
- `System.IO.Stream`

In interviews, the term BCL is often used broadly to mean the standard .NET types developers are expected to know. Strictly speaking, the BCL is the foundation layer, while higher-level framework libraries build on top of it.

A practical way to think about it:

```csharp
int count = 10;                 // System.Int32
string name = "Alice";          // System.String
object value = count;           // System.Object, with boxing
DateTimeOffset now = DateTimeOffset.UtcNow;
List<string> names = new();     // System.Collections.Generic.List<T>
```

### C# Keywords vs .NET Type Names

C# has aliases for many BCL types. The alias and the full .NET type name represent the same type.

```csharp
int a = 10;
System.Int32 b = 20;

string first = "Alice";
System.String second = "Bob";

object obj = first;
System.Object sameObj = second;
```

Common aliases include:

| C# Alias | .NET Type | Common Use |
|---|---|---|
| `object` | `System.Object` | Base type of almost all C# types |
| `string` | `System.String` | Text |
| `bool` | `System.Boolean` | True/false values |
| `byte` | `System.Byte` | Binary data and small unsigned values |
| `short` | `System.Int16` | Small integer values |
| `int` | `System.Int32` | Default integer type |
| `long` | `System.Int64` | Large integer values |
| `float` | `System.Single` | 32-bit floating-point number |
| `double` | `System.Double` | 64-bit floating-point number |
| `decimal` | `System.Decimal` | Financial and high-precision decimal values |
| `char` | `System.Char` | UTF-16 code unit |

Best practice is to use C# aliases in normal C# code for readability, especially for primitive types. Use full type names when discussing APIs, reflection, documentation, or when consistency with framework type names matters.

### `System.Object`

`System.Object` is the root type for most C# types. Classes, structs, arrays, delegates, enums, and records ultimately derive from `object`, either directly or indirectly.

Important members include:

- `ToString()`
- `Equals(object?)`
- `GetHashCode()`
- `GetType()`

Example:

```csharp
object value = "hello";

Console.WriteLine(value.ToString());     // hello
Console.WriteLine(value.GetType().Name); // String
```

For value types, assigning to `object` causes boxing.

```csharp
int number = 42;
object boxed = number;       // boxing
int unboxed = (int)boxed;    // unboxing
```

Boxing creates an object wrapper for a value type. It can add allocations and should be avoided in performance-sensitive paths.

Common interview point: `object` gives flexibility, but generic types usually provide better type safety and performance.

```csharp
// Less type-safe; may require casting.
ArrayList oldList = new();
oldList.Add(123);
oldList.Add("abc");

// Better: strongly typed and avoids boxing for int.
List<int> numbers = new();
numbers.Add(123);
```

### Value Types and Reference Types

.NET types are generally categorized as value types or reference types.

Value types store their actual value directly in the variable location. Examples include:

- `int`
- `bool`
- `decimal`
- `DateTime`
- `DateTimeOffset`
- `Guid`
- `TimeSpan`
- `struct` types
- `enum` types

Reference types store a reference to an object. Examples include:

- `string`
- `object`
- arrays
- classes
- delegates
- most collection types such as `List<T>` and `Dictionary<TKey, TValue>`

Example:

```csharp
int x = 10;
int y = x;
y = 20;

Console.WriteLine(x); // 10

var list1 = new List<int> { 1, 2 };
var list2 = list1;
list2.Add(3);

Console.WriteLine(list1.Count); // 3
```

A common mistake is saying value types always live on the stack and reference types always live on the heap. That is an oversimplification. The important interview answer is about value semantics versus reference semantics, not only memory location.

### Numeric Types

C# numeric types are BCL value types. The most common are `int`, `long`, `double`, and `decimal`.

Use `int` for general whole numbers unless the range requires `long`.

```csharp
int pageSize = 50;
long fileSizeInBytes = 5_000_000_000;
```

Use `double` for scientific, measurement, or approximate floating-point calculations.

```csharp
double temperature = 36.6;
double distance = 123.45;
```

Use `decimal` for money and financial calculations where base-10 precision matters.

```csharp
decimal price = 19.99m;
decimal taxRate = 0.08m;
decimal total = price + (price * taxRate);
```

Common mistakes:

- Using `double` for money.
- Comparing floating-point values with exact equality.
- Ignoring overflow.
- Mixing numeric types without understanding implicit and explicit conversions.

Example of floating-point precision issue:

```csharp
double result = 0.1 + 0.2;
Console.WriteLine(result == 0.3); // Often false
```

For approximate values, compare using a tolerance:

```csharp
bool AreClose(double a, double b, double tolerance = 0.000001)
{
    return Math.Abs(a - b) < tolerance;
}
```

For money, prefer `decimal`:

```csharp
decimal result = 0.1m + 0.2m;
Console.WriteLine(result == 0.3m); // true
```

### `bool` and Boolean Logic

`bool` maps to `System.Boolean` and represents `true` or `false`.

```csharp
bool isActive = true;

if (isActive)
{
    Console.WriteLine("User is active");
}
```

A nullable Boolean, `bool?`, can represent `true`, `false`, or `null`.

```csharp
bool? isApproved = null;

if (isApproved == true)
{
    Console.WriteLine("Approved");
}
else if (isApproved == false)
{
    Console.WriteLine("Rejected");
}
else
{
    Console.WriteLine("Pending");
}
```

Use `bool?` only when the missing or unknown state has real business meaning. Otherwise, prefer non-nullable `bool`.

### `char`, Unicode, and Text

`char` maps to `System.Char`. It represents a UTF-16 code unit, not necessarily a complete user-perceived character.

```csharp
char letter = 'A';
```

This matters because some Unicode characters require more than one UTF-16 code unit. Interviewers may ask this to test whether you understand that `string.Length` counts `char` values, not always user-visible characters.

```csharp
string text = "😀";
Console.WriteLine(text.Length); // May be 2 because the emoji uses a surrogate pair
```

For normal business applications, `char` is useful for simple character-level checks. For advanced Unicode handling, use APIs designed for Unicode text processing.

### `string` and `System.String`

`string` is an alias for `System.String`. It represents text and is immutable. Once created, a string instance cannot be changed. Operations such as `Replace`, `Substring`, `ToUpper`, and concatenation return new strings.

```csharp
string name = "alice";
string upper = name.ToUpperInvariant();

Console.WriteLine(name);  // alice
Console.WriteLine(upper); // ALICE
```

String immutability makes strings safe to share and helps with predictable behavior, but repeated modifications can allocate many temporary strings.

```csharp
// Inefficient for many iterations
string result = "";
for (int i = 0; i < 1000; i++)
{
    result += i.ToString();
}
```

For repeated string building, use `StringBuilder`.

```csharp
var builder = new StringBuilder();

for (int i = 0; i < 1000; i++)
{
    builder.Append(i);
}

string result = builder.ToString();
```

Important best practices:

- Use `string.IsNullOrEmpty` or `string.IsNullOrWhiteSpace` for validation.
- Use `StringComparison.Ordinal` or `StringComparison.OrdinalIgnoreCase` for non-linguistic comparisons such as IDs, keys, and tokens.
- Use culture-aware comparison only when comparing text for users.
- Use interpolation for readable formatting.
- Avoid unnecessary `ToLower()` or `ToUpper()` before comparison.

Example:

```csharp
bool matches = string.Equals(
    input,
    expected,
    StringComparison.OrdinalIgnoreCase);
```

### `StringBuilder`

`StringBuilder` is used to efficiently build strings through repeated modifications.

Use it when:

- Building large strings in loops.
- Appending many fragments conditionally.
- Creating generated text, logs, reports, SQL fragments, or export files.

```csharp
var sb = new StringBuilder();

sb.AppendLine("Report");
sb.AppendLine("------");

foreach (var item in items)
{
    sb.AppendLine($"- {item.Name}: {item.Value}");
}

string report = sb.ToString();
```

Do not use `StringBuilder` for simple one-line interpolation. This is usually less readable and unnecessary.

```csharp
// Good
string message = $"Hello {firstName} {lastName}";
```

### Nullable Value Types: `Nullable<T>` and `T?`

A nullable value type represents all values of a value type plus `null`.

```csharp
int? age = null;
DateTime? completedAt = null;
decimal? discount = 10.5m;
```

`int?` is shorthand for `Nullable<int>`.

```csharp
Nullable<int> a = 10;
int? b = 20;
```

Common members:

- `HasValue`
- `Value`
- `GetValueOrDefault()`

```csharp
int? score = null;

int safeScore = score ?? 0;

if (score.HasValue)
{
    Console.WriteLine(score.Value);
}
```

Best practices:

- Use nullable value types when data can be missing, such as optional database fields.
- Prefer `??` or pattern matching instead of directly accessing `.Value`.
- Avoid nullable value types when a default value is meaningful and enough.

Common mistake:

```csharp
int? score = null;
Console.WriteLine(score.Value); // Throws InvalidOperationException
```

Better:

```csharp
if (score is int actualScore)
{
    Console.WriteLine(actualScore);
}
```

### Nullable Reference Types

Nullable reference types are a C# feature that helps express whether a reference is expected to be null.

```csharp
string name = "Alice";       // should not be null
string? middleName = null;   // can be null
```

This is a compile-time analysis feature. It does not create a different runtime type. Both `string` and `string?` are still `System.String` at runtime.

Use nullable reference types to make APIs clearer:

```csharp
public sealed class Customer
{
    public required string Name { get; init; }
    public string? Email { get; init; }
}
```

Common interview points:

- `T?` for value types means `Nullable<T>`.
- `string?` for reference types means the compiler should treat the value as possibly null.
- Nullable reference types help prevent `NullReferenceException`, but they do not replace runtime validation.

### `DateTime`, `DateTimeOffset`, `DateOnly`, `TimeOnly`, and `TimeSpan`

Date and time types are common sources of production bugs.

`DateTime` represents a date and time. It has a `Kind` property that can be `Local`, `Utc`, or `Unspecified`.

```csharp
DateTime createdAt = DateTime.UtcNow;
```

`DateTimeOffset` represents a date and time with an offset from UTC. It is often better for logging, events, audit fields, and distributed systems because it identifies a more precise point in time.

```csharp
DateTimeOffset createdAt = DateTimeOffset.UtcNow;
```

`DateOnly` represents a calendar date without a time.

```csharp
DateOnly birthDate = new(1995, 5, 20);
```

`TimeOnly` represents a time of day without a date.

```csharp
TimeOnly openingTime = new(9, 0);
```

`TimeSpan` represents a duration or interval.

```csharp
TimeSpan timeout = TimeSpan.FromSeconds(30);
```

Best practices:

- Use `DateTimeOffset` for timestamps in distributed applications.
- Use `DateOnly` for dates such as birth dates, due dates, or schedule dates when time is irrelevant.
- Use `TimeOnly` for time-of-day values such as opening hours.
- Use `TimeSpan` for durations, timeouts, and elapsed time.
- Store server-side timestamps in UTC unless there is a strong reason not to.
- Do not use `DateTime.Now` for cross-system timestamps.

Example:

```csharp
public sealed class Order
{
    public Guid Id { get; init; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateOnly RequiredDeliveryDate { get; init; }
}
```

### `Guid`

`Guid` represents a globally unique identifier. It is commonly used for IDs in APIs, databases, distributed systems, and correlation tracking.

```csharp
Guid id = Guid.NewGuid();
```

Use cases:

- Entity identifiers.
- Public resource IDs.
- Correlation IDs.
- Idempotency keys.
- Distributed message identifiers.

Trade-offs:

- Good for distributed uniqueness.
- Larger than `int` or `long`.
- Random GUIDs can affect clustered database index performance if used as primary keys without planning.
- Not naturally ordered unless using ordered/sequential GUID strategies.

Example:

```csharp
public sealed record CreateOrderRequest(Guid CustomerId, decimal Amount);
```

Common mistake: treating GUIDs as secure secrets. A GUID is an identifier, not an authorization mechanism.

### `Uri`

`Uri` represents a Uniform Resource Identifier. It is useful for URLs and resource addresses.

```csharp
var uri = new Uri("https://example.com/api/customers?page=1");

Console.WriteLine(uri.Host);      // example.com
Console.WriteLine(uri.Scheme);    // https
Console.WriteLine(uri.Query);     // ?page=1
```

Use `Uri` instead of manual string parsing when working with URLs.

Common use cases:

- API clients.
- File/resource addresses.
- Redirect URLs.
- Validation of absolute and relative URLs.

Best practice: still validate business rules. A syntactically valid URI is not automatically safe or allowed.

### Arrays

Arrays are fixed-size collections of elements of the same type.

```csharp
int[] numbers = { 1, 2, 3 };
Console.WriteLine(numbers[0]);
```

Arrays are useful when:

- The size is known.
- You need fast index-based access.
- You are interoperating with APIs that expect arrays.
- You are working with buffers.

Trade-offs:

- Fixed length after creation.
- Less flexible than `List<T>` for add/remove operations.
- Good performance for simple indexed data.

```csharp
byte[] buffer = new byte[4096];
```

### `List<T>`

`List<T>` is a resizable generic collection.

```csharp
var names = new List<string>();
names.Add("Alice");
names.Add("Bob");
```

Use `List<T>` when:

- You need ordered items.
- You need index access.
- You need to add or remove items dynamically.
- You want a concrete in-memory collection.

Common mistakes:

- Returning `List<T>` from every API when `IReadOnlyList<T>` or `IEnumerable<T>` would express intent better.
- Modifying a list while enumerating it.
- Assuming `List<T>` is thread-safe.

Example of safer API design:

```csharp
public IReadOnlyList<string> GetRoles()
{
    return new List<string> { "Admin", "User" };
}
```

### `Dictionary<TKey, TValue>`

`Dictionary<TKey, TValue>` stores key/value pairs and provides fast lookup by key.

```csharp
var usersById = new Dictionary<Guid, string>();

Guid userId = Guid.NewGuid();
usersById[userId] = "Alice";

if (usersById.TryGetValue(userId, out string? name))
{
    Console.WriteLine(name);
}
```

Use `Dictionary<TKey, TValue>` when:

- You need lookup by unique key.
- You want to avoid repeated linear searches.
- You need a map from one value to another.

Best practices:

- Use `TryGetValue` when a key may not exist.
- Choose a suitable comparer for string keys.
- Do not depend on dictionary ordering unless the specific API guarantees it.
- Ensure keys are immutable or at least not mutated in ways that affect equality or hash code.

Example using a case-insensitive string comparer:

```csharp
var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
{
    ["Content-Type"] = "application/json"
};
```

### `HashSet<T>`

`HashSet<T>` stores unique values and provides fast membership checks.

```csharp
var allowedRoles = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "Admin",
    "Manager"
};

if (allowedRoles.Contains(userRole))
{
    Console.WriteLine("Allowed");
}
```

Use it when:

- You need uniqueness.
- You frequently check whether a value exists.
- You need set operations such as union, intersection, or difference.

```csharp
var selectedIds = new HashSet<int> { 1, 2, 3 };
var activeIds = new HashSet<int> { 2, 3, 4 };

selectedIds.IntersectWith(activeIds); // selectedIds now contains 2 and 3
```

### `Queue<T>` and `Stack<T>`

`Queue<T>` is first-in, first-out.

```csharp
var queue = new Queue<string>();
queue.Enqueue("first");
queue.Enqueue("second");

Console.WriteLine(queue.Dequeue()); // first
```

`Stack<T>` is last-in, first-out.

```csharp
var stack = new Stack<string>();
stack.Push("first");
stack.Push("second");

Console.WriteLine(stack.Pop()); // second
```

Use cases:

- `Queue<T>`: work queues, breadth-first traversal, ordered processing.
- `Stack<T>`: undo operations, depth-first traversal, parsing, backtracking.

For multi-threaded producer/consumer scenarios, use types from `System.Collections.Concurrent` instead of manually locking generic collections unless you have a specific reason.

### Collection Interfaces: `IEnumerable<T>`, `ICollection<T>`, `IList<T>`, and `IReadOnlyList<T>`

Collection interfaces express what operations a caller can perform.

| Type | Meaning | Common Use |
|---|---|---|
| `IEnumerable<T>` | Can be enumerated | Input sequence, streaming, LINQ |
| `ICollection<T>` | Can add/remove/count | Mutable collection abstraction |
| `IList<T>` | Indexed mutable list | List-like abstraction with indexing |
| `IReadOnlyCollection<T>` | Can enumerate and count | Read-only collection result |
| `IReadOnlyList<T>` | Read-only indexed list | Read-only ordered result |
| `List<T>` | Concrete resizable list | Internal implementation or when concrete features are needed |

Example:

```csharp
public decimal CalculateTotal(IEnumerable<OrderLine> lines)
{
    return lines.Sum(line => line.Price * line.Quantity);
}
```

This method accepts many sources: arrays, lists, query results, and generated sequences.

For returning data:

```csharp
public IReadOnlyList<CustomerDto> GetCustomers()
{
    return customers
        .Select(c => new CustomerDto(c.Id, c.Name))
        .ToList();
}
```

Best practice:

- Accept the least specific type needed.
- Return a type that communicates whether the result is materialized and whether callers can mutate it.
- Avoid exposing mutable internal collections directly.

### LINQ, `IEnumerable<T>`, and Deferred Execution

LINQ works heavily with `IEnumerable<T>` and extension methods.

```csharp
var activeUsers = users
    .Where(user => user.IsActive)
    .OrderBy(user => user.Name)
    .Select(user => user.Name);
```

Many LINQ operations use deferred execution, meaning the query is not executed until enumerated.

```csharp
var numbers = new List<int> { 1, 2, 3 };

var query = numbers.Where(n => n > 1);

numbers.Add(4);

foreach (var number in query)
{
    Console.WriteLine(number); // 2, 3, 4
}
```

Use `ToList()` or `ToArray()` to materialize results when needed.

```csharp
var activeUsers = users
    .Where(user => user.IsActive)
    .ToList();
```

Common mistakes:

- Enumerating expensive queries multiple times.
- Returning deferred queries after the underlying context or resource has been disposed.
- Using LINQ where a simple loop would be clearer or faster.
- Confusing `IEnumerable<T>` with `IQueryable<T>` in database queries.

### `IQueryable<T>` vs `IEnumerable<T>`

`IEnumerable<T>` represents in-memory or enumerable data. LINQ operations run in .NET code.

`IQueryable<T>` represents a query that can be translated by a provider, such as EF Core translating expression trees to SQL.

```csharp
IQueryable<Customer> query = dbContext.Customers
    .Where(c => c.IsActive);

List<Customer> result = await query.ToListAsync();
```

Important interview point: applying filters before materialization can allow the database to do the work.

```csharp
// Better: filter in the database
var customers = await dbContext.Customers
    .Where(c => c.IsActive)
    .ToListAsync();

// Worse for large tables: loads too much data first
var allCustomers = await dbContext.Customers.ToListAsync();
var activeCustomers = allCustomers.Where(c => c.IsActive).ToList();
```

### Tuples and `ValueTuple`

Tuples are useful for grouping a small number of values without creating a dedicated type.

```csharp
(string Name, int Age) person = ("Alice", 30);

Console.WriteLine(person.Name);
Console.WriteLine(person.Age);
```

They are often used for private helper methods or simple returns.

```csharp
private static (bool IsValid, string? Error) ValidateAge(int age)
{
    if (age < 0)
    {
        return (false, "Age cannot be negative.");
    }

    return (true, null);
}
```

Best practices:

- Use tuples for small, local, obvious groupings.
- Use records or classes for public APIs, domain models, or values with business meaning.
- Name tuple elements for readability.

Common mistake:

```csharp
// Hard to understand
(int, string, bool) result = GetData();
```

Better:

```csharp
(int Count, string Message, bool IsSuccessful) result = GetData();
```

### `KeyValuePair<TKey, TValue>`

`KeyValuePair<TKey, TValue>` represents a key/value pair, commonly seen when enumerating dictionaries.

```csharp
foreach (KeyValuePair<string, int> item in countsByName)
{
    Console.WriteLine($"{item.Key}: {item.Value}");
}
```

Modern C# also allows deconstruction in many cases:

```csharp
foreach (var (name, count) in countsByName)
{
    Console.WriteLine($"{name}: {count}");
}
```

Use `KeyValuePair<TKey, TValue>` when working with dictionary-like APIs. For richer business concepts, prefer a named type.

### `Enum`

Enums represent a named set of constant values.

```csharp
public enum OrderStatus
{
    Pending,
    Paid,
    Shipped,
    Cancelled
}
```

Use enums when a value must be one of a known set of options.

```csharp
public sealed class Order
{
    public OrderStatus Status { get; set; }
}
```

Best practices:

- Use clear names.
- Define explicit values when persisted to a database or exchanged through an API.
- Be careful when parsing external input.
- Consider unknown or future values in distributed systems.

```csharp
public enum OrderStatus
{
    Unknown = 0,
    Pending = 1,
    Paid = 2,
    Shipped = 3,
    Cancelled = 4
}
```

Parsing safely:

```csharp
if (Enum.TryParse<OrderStatus>(input, ignoreCase: true, out var status))
{
    Console.WriteLine(status);
}
```

### `Exception` and Common Exception Types

`System.Exception` is the base type for exceptions in .NET.

Common exception types include:

- `ArgumentException`
- `ArgumentNullException`
- `ArgumentOutOfRangeException`
- `InvalidOperationException`
- `NotSupportedException`
- `KeyNotFoundException`
- `FormatException`
- `TimeoutException`
- `OperationCanceledException`

Example:

```csharp
public void SetPageSize(int pageSize)
{
    if (pageSize <= 0)
    {
        throw new ArgumentOutOfRangeException(nameof(pageSize), "Page size must be greater than zero.");
    }
}
```

Best practices:

- Use exceptions for exceptional or invalid situations, not normal control flow.
- Throw the most specific exception type that matches the problem.
- Include useful messages.
- Preserve stack traces by using `throw;` instead of `throw ex;`.
- Avoid swallowing exceptions silently.

```csharp
try
{
    ProcessOrder(order);
}
catch (ValidationException ex)
{
    logger.LogWarning(ex, "Order validation failed.");
    throw;
}
```

### `Task`, `Task<T>`, `ValueTask<T>`, and `CancellationToken`

`Task` and `Task<T>` represent asynchronous operations. They are central to `async` and `await`.

```csharp
public async Task<CustomerDto> GetCustomerAsync(Guid id, CancellationToken cancellationToken)
{
    Customer customer = await repository.GetByIdAsync(id, cancellationToken);
    return new CustomerDto(customer.Id, customer.Name);
}
```

Use `Task` when an asynchronous operation does not return a value.

```csharp
public async Task SaveAsync(Order order, CancellationToken cancellationToken)
{
    await repository.SaveAsync(order, cancellationToken);
}
```

Use `Task<T>` when it returns a value.

```csharp
public async Task<int> CountAsync(CancellationToken cancellationToken)
{
    return await repository.CountAsync(cancellationToken);
}
```

`CancellationToken` allows cooperative cancellation.

```csharp
public async Task<string> DownloadAsync(HttpClient client, string url, CancellationToken cancellationToken)
{
    return await client.GetStringAsync(url, cancellationToken);
}
```

`ValueTask<T>` can reduce allocations in specialized high-performance scenarios where the result is often available synchronously. For normal application code, prefer `Task<T>` unless profiling shows a reason to use `ValueTask<T>`.

Common mistakes:

- Blocking async code with `.Result` or `.Wait()`.
- Forgetting to pass `CancellationToken` through layers.
- Using `async void` except for event handlers.
- Wrapping I/O-bound async code in `Task.Run` unnecessarily.

### `Stream`, `File`, `Directory`, and `Path`

`Stream` represents a sequence of bytes. Many I/O APIs use streams because they can work with files, memory, network data, compression, and other sources.

```csharp
await using FileStream stream = File.OpenRead("data.txt");
using var reader = new StreamReader(stream);

string content = await reader.ReadToEndAsync();
```

Common stream types:

- `FileStream`
- `MemoryStream`
- `NetworkStream`
- `BufferedStream`
- `CryptoStream`
- `GZipStream`

`File` provides static helpers for file operations.

```csharp
string text = await File.ReadAllTextAsync("data.txt");
await File.WriteAllTextAsync("output.txt", text);
```

`Directory` provides helpers for directories.

```csharp
Directory.CreateDirectory("exports");
```

`Path` helps combine and inspect file paths safely.

```csharp
string fullPath = Path.Combine(baseDirectory, "exports", "report.txt");
string extension = Path.GetExtension(fullPath);
```

Best practices:

- Prefer `Path.Combine` over manual string concatenation.
- Dispose streams with `using` or `await using`.
- Use async file APIs for scalable I/O operations.
- Do not trust file paths from users without validation.

### `IDisposable` and `IAsyncDisposable`

`IDisposable` is used by types that need deterministic cleanup, such as streams, database contexts, timers, and unmanaged resource wrappers.

```csharp
using var stream = File.OpenRead("data.txt");
```

The `using` statement ensures `Dispose()` is called even if an exception occurs.

`IAsyncDisposable` supports asynchronous cleanup.

```csharp
await using var stream = File.OpenRead("data.txt");
```

Common interview point: garbage collection manages memory, but `IDisposable` handles non-memory resources or resources that should be released promptly.

### `Span<T>`, `ReadOnlySpan<T>`, `Memory<T>`, and `ReadOnlyMemory<T>`

`Span<T>` and `ReadOnlySpan<T>` represent contiguous regions of memory without copying. They are useful for high-performance parsing, slicing, and buffer manipulation.

```csharp
string value = "ABC-123";
ReadOnlySpan<char> span = value.AsSpan();

ReadOnlySpan<char> prefix = span[..3];
ReadOnlySpan<char> number = span[4..];

Console.WriteLine(prefix.ToString()); // ABC
Console.WriteLine(number.ToString()); // 123
```

`Span<T>` is stack-only and cannot be stored in fields of normal classes, captured by lambdas, or used across `await` boundaries. `Memory<T>` and `ReadOnlyMemory<T>` can be stored and used in asynchronous APIs.

Use these types when:

- Avoiding allocations in hot paths.
- Parsing large text or binary data.
- Working with buffers.
- Building performance-sensitive libraries.

For normal business code, simpler types such as `string`, arrays, and `List<T>` are often more readable.

### `Regex`

`Regex` is used for pattern matching in text.

```csharp
bool isValid = Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$");
```

Use regex for patterns, not for simple string checks.

```csharp
// Prefer this for simple checks
bool hasPrefix = value.StartsWith("ORD-", StringComparison.Ordinal);
```

Best practices:

- Keep regex patterns readable.
- Use timeouts for untrusted input in security-sensitive code.
- Avoid overly complex regex when parsing with normal code would be clearer.

### `Math`, `Random`, and Utility Types

`Math` provides common numeric operations.

```csharp
double rounded = Math.Round(12.345, 2);
int max = Math.Max(10, 20);
```

`Random` generates pseudo-random numbers.

```csharp
int value = Random.Shared.Next(1, 101);
```

For security-sensitive random values, use cryptographic random APIs instead of `Random`.

```csharp
byte[] bytes = RandomNumberGenerator.GetBytes(32);
```

Common use cases:

- `Math`: calculations, rounding, min/max, absolute values.
- `Random`: non-security simulations, test data, simple randomized behavior.
- Cryptographic random APIs: tokens, secrets, keys, security-sensitive identifiers.

### Equality, Comparers, and Hash Codes

Many BCL types rely on equality and comparison.

Important types include:

- `IEquatable<T>`
- `IEqualityComparer<T>`
- `EqualityComparer<T>.Default`
- `IComparable<T>`
- `IComparer<T>`
- `StringComparer`

Example using `StringComparer`:

```csharp
var users = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
{
    ["alice"] = 1
};

Console.WriteLine(users.ContainsKey("ALICE")); // true
```

When implementing equality for custom types used in dictionaries or sets, ensure `Equals` and `GetHashCode` are consistent.

```csharp
public sealed class ProductCode : IEquatable<ProductCode>
{
    public ProductCode(string value)
    {
        Value = value;
    }

    public string Value { get; }

    public bool Equals(ProductCode? other)
    {
        return other is not null &&
               string.Equals(Value, other.Value, StringComparison.OrdinalIgnoreCase);
    }

    public override bool Equals(object? obj) => Equals(obj as ProductCode);

    public override int GetHashCode()
    {
        return StringComparer.OrdinalIgnoreCase.GetHashCode(Value);
    }
}
```

Common mistake: overriding `Equals` but not `GetHashCode`, causing incorrect behavior in `Dictionary<TKey, TValue>` or `HashSet<T>`.

### `Type`, `Attribute`, and Reflection Basics

`System.Type` represents metadata about a type at runtime. Reflection lets code inspect assemblies, types, properties, methods, and attributes.

```csharp
Type type = typeof(Customer);

Console.WriteLine(type.Name);
Console.WriteLine(type.FullName);
```

Attributes add metadata to code elements.

```csharp
[Obsolete("Use NewMethod instead.")]
public void OldMethod()
{
}
```

Common use cases:

- Dependency injection scanning.
- Serialization.
- Validation frameworks.
- Test frameworks.
- ASP.NET Core attributes.
- Mapping libraries.

Trade-offs:

- Reflection is powerful and flexible.
- It can be slower and less type-safe than direct code.
- It should be used carefully in hot paths.

### Practical Type Selection Guide

| Scenario | Prefer |
|---|---|
| General whole number | `int` |
| Large whole number | `long` |
| Money | `decimal` |
| Approximate scientific/measurement value | `double` |
| Text | `string` |
| Repeated text building | `StringBuilder` |
| Unique distributed ID | `Guid` |
| Timestamp in distributed systems | `DateTimeOffset` |
| Date without time | `DateOnly` |
| Time without date | `TimeOnly` |
| Duration or timeout | `TimeSpan` |
| Ordered resizable list | `List<T>` |
| Unique values | `HashSet<T>` |
| Key/value lookup | `Dictionary<TKey, TValue>` |
| Sequence input | `IEnumerable<T>` |
| Read-only ordered result | `IReadOnlyList<T>` |
| Async operation | `Task` or `Task<T>` |
| Cancellation | `CancellationToken` |
| Binary or file data | `Stream` |
| Resource cleanup | `IDisposable` or `IAsyncDisposable` |
| High-performance memory slice | `Span<T>` or `ReadOnlySpan<T>` |

### Common Mistakes with BCL Types

Common mistakes include:

- Using `double` for money.
- Using `DateTime.Now` for distributed timestamps.
- Ignoring `DateTime.Kind`.
- Using `DateTime` when `DateOnly` or `TimeOnly` better expresses intent.
- Building large strings with repeated `+=` in loops.
- Comparing strings without specifying `StringComparison`.
- Exposing mutable `List<T>` properties directly.
- Enumerating `IEnumerable<T>` multiple times when it represents an expensive query.
- Using `.Result` or `.Wait()` on async operations.
- Forgetting to dispose `Stream`, `DbContext`, or other disposable resources.
- Overusing `object` instead of generics.
- Ignoring culture when parsing or formatting user-facing values.
- Treating GUIDs as secrets.
- Using regex for simple string operations.

### Best Practices for Interview Answers

Strong interview answers should explain both what the type is and why you would choose it.

For example, a weak answer is:

```text
Use Dictionary because it is faster.
```

A stronger answer is:

```text
Use Dictionary<TKey, TValue> when you need fast lookup by key and each key is unique. It is usually more appropriate than scanning a List<T> repeatedly. However, the key type must have stable equality and hash-code behavior, and you should use a suitable comparer for string keys.
```

When discussing BCL types, mention:

- Correct type semantics.
- Performance characteristics.
- Mutability.
- Nullability.
- Thread-safety.
- Culture and globalization concerns.
- Resource management.
- Real production scenarios.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:common-bcl-types-in-csharp-beginner-q01 -->
#### Beginner Q01: What is the BCL in .NET?
<!-- question-id:common-bcl-types-in-csharp-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

The BCL, or Base Class Library, is the core set of reusable types provided by .NET. It includes fundamental types for text, numbers, collections, dates and times, exceptions, I/O, asynchronous programming, reflection, and other common development tasks.

In C#, many keywords are aliases for BCL types. For example, `int` is `System.Int32`, `string` is `System.String`, and `object` is `System.Object`. This means C# developers use BCL types constantly, even when writing basic code.

The BCL matters because it provides standard, tested, and optimized building blocks instead of requiring developers to implement common functionality from scratch.

##### Key Points to Mention

- BCL means Base Class Library.
- It contains common .NET types used by almost every application.
- C# aliases map to BCL types.
- Examples include `String`, `Int32`, `DateTime`, `List<T>`, `Dictionary<TKey, TValue>`, `Task`, and `Stream`.
- Strong BCL knowledge is essential for practical .NET development.

<!-- question:end:common-bcl-types-in-csharp-beginner-q01 -->

<!-- question:start:common-bcl-types-in-csharp-beginner-q02 -->
#### Beginner Q02: What is the difference between `string` and `System.String`?
<!-- question-id:common-bcl-types-in-csharp-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

There is no runtime difference. In C#, `string` is an alias for `System.String`. Both represent the same BCL type.

Most C# code uses the `string` keyword because it is idiomatic and concise. `System.String` may appear in documentation, reflection, or code that uses full framework type names.

```csharp
string a = "hello";
System.String b = "world";

Console.WriteLine(a.GetType() == b.GetType()); // true
```

##### Key Points to Mention

- `string` is a C# alias.
- `System.String` is the actual .NET type name.
- They are equivalent.
- Prefer `string` in normal C# code.
- The same concept applies to `int` and `System.Int32`, `bool` and `System.Boolean`, etc.

<!-- question:end:common-bcl-types-in-csharp-beginner-q02 -->

<!-- question:start:common-bcl-types-in-csharp-beginner-q03 -->
#### Beginner Q03: What is the difference between value types and reference types?
<!-- question-id:common-bcl-types-in-csharp-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A value type stores the actual value. When assigned to another variable, the value is copied. Examples include `int`, `bool`, `decimal`, `DateTime`, `Guid`, structs, and enums.

A reference type stores a reference to an object. When assigned to another variable, the reference is copied, so both variables can refer to the same object. Examples include `string`, arrays, classes, delegates, and collections such as `List<T>`.

```csharp
int a = 10;
int b = a;
b = 20;
Console.WriteLine(a); // 10

var list1 = new List<int> { 1 };
var list2 = list1;
list2.Add(2);
Console.WriteLine(list1.Count); // 2
```

##### Key Points to Mention

- Value type assignment copies the value.
- Reference type assignment copies the reference.
- Value types include structs and enums.
- Reference types include classes, strings, arrays, and most collections.
- Avoid oversimplifying the answer to only stack vs heap.

<!-- question:end:common-bcl-types-in-csharp-beginner-q03 -->

<!-- question:start:common-bcl-types-in-csharp-beginner-q04 -->
#### Beginner Q04: Why is `string` immutable in C#?
<!-- question-id:common-bcl-types-in-csharp-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`string` is immutable, which means a string instance cannot be changed after it is created. Methods that appear to modify a string return a new string instead.

```csharp
string name = "alice";
string upper = name.ToUpperInvariant();

Console.WriteLine(name);  // alice
Console.WriteLine(upper); // ALICE
```

Immutability makes strings safer to share, easier to reason about, and useful as dictionary keys. It also supports optimizations such as string interning. The trade-off is that repeated string modification can create many temporary objects.

For repeated string building, use `StringBuilder`.

##### Key Points to Mention

- Strings cannot be modified after creation.
- String operations return new string instances.
- Immutability improves safety and predictability.
- Repeated concatenation can cause unnecessary allocations.
- Use `StringBuilder` for many repeated appends.

<!-- question:end:common-bcl-types-in-csharp-beginner-q04 -->

<!-- question:start:common-bcl-types-in-csharp-beginner-q05 -->
#### Beginner Q05: When should you use `List<T>`?
<!-- question-id:common-bcl-types-in-csharp-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Use `List<T>` when you need an ordered, resizable, strongly typed collection. It supports index-based access, adding, removing, sorting, and enumeration.

```csharp
var names = new List<string>();
names.Add("Alice");
names.Add("Bob");

Console.WriteLine(names[0]);
```

`List<T>` is commonly used for in-memory collections when the number of items can grow or shrink. It is better than old non-generic collections because it provides compile-time type safety and avoids boxing for value types.

##### Key Points to Mention

- `List<T>` is a resizable generic collection.
- It preserves order.
- It supports index access.
- It is strongly typed.
- It is not thread-safe by default.

<!-- question:end:common-bcl-types-in-csharp-beginner-q05 -->

<!-- question:start:common-bcl-types-in-csharp-beginner-q06 -->
#### Beginner Q06: What is `Dictionary<TKey, TValue>` used for?
<!-- question-id:common-bcl-types-in-csharp-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

`Dictionary<TKey, TValue>` stores key/value pairs and allows fast lookup by key. It is useful when each item can be identified by a unique key.

```csharp
var usersById = new Dictionary<int, string>
{
    [1] = "Alice",
    [2] = "Bob"
};

if (usersById.TryGetValue(1, out string? name))
{
    Console.WriteLine(name);
}
```

It is commonly used for maps, caches, lookup tables, and grouping data by unique identifiers.

##### Key Points to Mention

- Stores key/value pairs.
- Keys must be unique.
- Provides fast lookup by key.
- Use `TryGetValue` when a key may be missing.
- Use an appropriate comparer for string keys.

<!-- question:end:common-bcl-types-in-csharp-beginner-q06 -->

<!-- question:start:common-bcl-types-in-csharp-beginner-q07 -->
#### Beginner Q07: What is the difference between `DateTime` and `TimeSpan`?
<!-- question-id:common-bcl-types-in-csharp-beginner-q07 -->
<!-- question-level:beginner -->

##### Expected Answer

`DateTime` represents a date and time, such as `2026-05-11 09:30`. `TimeSpan` represents a duration or interval, such as 30 seconds, 2 hours, or 5 days.

```csharp
DateTime start = DateTime.UtcNow;
TimeSpan timeout = TimeSpan.FromSeconds(30);
DateTime deadline = start.Add(timeout);
```

Use `DateTime` or `DateTimeOffset` for points in time. Use `TimeSpan` for durations, timeouts, elapsed time, and differences between times.

##### Key Points to Mention

- `DateTime` is a point in date/time.
- `TimeSpan` is a duration.
- Subtracting two `DateTime` values returns a `TimeSpan`.
- Use `TimeSpan` for timeouts and elapsed time.
- For distributed timestamps, `DateTimeOffset` is often preferred.

<!-- question:end:common-bcl-types-in-csharp-beginner-q07 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:common-bcl-types-in-csharp-intermediate-q01 -->
#### Intermediate Q01: When should you use `decimal` instead of `double`?
<!-- question-id:common-bcl-types-in-csharp-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use `decimal` for money and financial calculations because it provides base-10 decimal precision. Use `double` for approximate scientific, measurement, and engineering calculations where binary floating-point behavior is acceptable.

```csharp
decimal price = 19.99m;
decimal tax = 0.08m;
decimal total = price + price * tax;
```

`double` can represent many values only approximately, which can produce surprising results in exact comparisons.

```csharp
double result = 0.1 + 0.2;
Console.WriteLine(result == 0.3); // Often false
```

The trade-off is that `decimal` is generally slower and has a smaller range than `double`, but it is usually the correct choice for financial values.

##### Key Points to Mention

- `decimal` is preferred for money.
- `double` is better for approximate scientific calculations.
- Floating-point values should not usually be compared using exact equality.
- `decimal` trades performance/range for decimal precision.
- Use the `m` suffix for decimal literals.

<!-- question:end:common-bcl-types-in-csharp-intermediate-q01 -->

<!-- question:start:common-bcl-types-in-csharp-intermediate-q02 -->
#### Intermediate Q02: What is the difference between `IEnumerable<T>` and `List<T>`?
<!-- question-id:common-bcl-types-in-csharp-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

`IEnumerable<T>` is an interface that represents a sequence that can be enumerated. It does not guarantee indexing, mutation, or materialization. `List<T>` is a concrete resizable collection that stores items in memory and supports indexing, adding, removing, and counting.

```csharp
public decimal CalculateTotal(IEnumerable<OrderLine> lines)
{
    return lines.Sum(line => line.Price * line.Quantity);
}
```

Use `IEnumerable<T>` when a method only needs to iterate through data. Use `List<T>` when you need a concrete mutable list with index access and add/remove operations.

A key interview point is deferred execution. An `IEnumerable<T>` may represent a query that is not executed until enumeration.

##### Key Points to Mention

- `IEnumerable<T>` means enumerable sequence.
- `List<T>` is a concrete in-memory collection.
- `IEnumerable<T>` may use deferred execution.
- `List<T>` supports indexing and mutation.
- Accept the least specific abstraction needed.

<!-- question:end:common-bcl-types-in-csharp-intermediate-q02 -->

<!-- question:start:common-bcl-types-in-csharp-intermediate-q03 -->
#### Intermediate Q03: What is deferred execution in LINQ?
<!-- question-id:common-bcl-types-in-csharp-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Deferred execution means a LINQ query is not executed when it is defined. It is executed when it is enumerated, such as in a `foreach`, `ToList()`, `ToArray()`, `Count()`, or similar terminal operation.

```csharp
var numbers = new List<int> { 1, 2, 3 };

var query = numbers.Where(n => n > 1);

numbers.Add(4);

foreach (var number in query)
{
    Console.WriteLine(number); // 2, 3, 4
}
```

Deferred execution is useful because it enables query composition and avoids unnecessary work. However, it can cause bugs if the underlying data changes, if the sequence is enumerated multiple times, or if the data source is disposed before enumeration.

##### Key Points to Mention

- Query definition and query execution can happen at different times.
- Many LINQ methods return deferred `IEnumerable<T>` sequences.
- `ToList()` and `ToArray()` materialize results.
- Deferred execution can improve efficiency and composability.
- Be careful with multiple enumeration and disposed resources.

<!-- question:end:common-bcl-types-in-csharp-intermediate-q03 -->

<!-- question:start:common-bcl-types-in-csharp-intermediate-q04 -->
#### Intermediate Q04: When should you use `DateTimeOffset` instead of `DateTime`?
<!-- question-id:common-bcl-types-in-csharp-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use `DateTimeOffset` when you need to represent an unambiguous point in time, especially in distributed systems, logs, audit records, APIs, and events. It stores a date/time value together with an offset from UTC.

`DateTime` can be useful for abstract dates and times, UTC-only values, or values where time-zone information is not available. However, `DateTime.Kind` can be `Local`, `Utc`, or `Unspecified`, and misunderstanding it often causes bugs.

```csharp
public sealed class AuditEvent
{
    public Guid Id { get; init; }
    public DateTimeOffset OccurredAt { get; init; } = DateTimeOffset.UtcNow;
}
```

For birth dates, due dates, or calendar-only values, `DateOnly` may be clearer than either `DateTime` or `DateTimeOffset`.

##### Key Points to Mention

- `DateTimeOffset` includes an offset from UTC.
- It is better for logs, events, APIs, and distributed timestamps.
- `DateTime.Kind` can cause confusion.
- Store timestamps in UTC when possible.
- Use `DateOnly` for date-only values.

<!-- question:end:common-bcl-types-in-csharp-intermediate-q04 -->

<!-- question:start:common-bcl-types-in-csharp-intermediate-q05 -->
#### Intermediate Q05: What is boxing and unboxing?
<!-- question-id:common-bcl-types-in-csharp-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Boxing is the process of wrapping a value type inside an object so it can be treated as a reference type. Unboxing extracts the value type back from the object.

```csharp
int number = 42;
object boxed = number;       // boxing
int unboxed = (int)boxed;    // unboxing
```

Boxing can cause heap allocations and performance overhead. It also loses compile-time type specificity, so invalid unboxing can throw exceptions.

Generics help avoid boxing by preserving the actual type.

```csharp
var numbers = new List<int>();
numbers.Add(42); // no boxing
```

##### Key Points to Mention

- Boxing converts a value type to `object` or an interface reference.
- Unboxing extracts it back.
- Boxing can allocate and hurt performance.
- Invalid unboxing throws an exception.
- Generics often avoid boxing.

<!-- question:end:common-bcl-types-in-csharp-intermediate-q05 -->

<!-- question:start:common-bcl-types-in-csharp-intermediate-q06 -->
#### Intermediate Q06: How should you compare strings in C#?
<!-- question-id:common-bcl-types-in-csharp-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

String comparison should be explicit about comparison rules. For non-linguistic values such as IDs, tokens, enum-like strings, file extensions, and dictionary keys, use ordinal comparison.

```csharp
bool matches = string.Equals(
    input,
    expected,
    StringComparison.OrdinalIgnoreCase);
```

For user-facing text, culture-aware comparison may be appropriate.

Avoid converting both strings to lowercase or uppercase just to compare them, because that can allocate extra strings and may behave incorrectly in some cultures.

For dictionaries with string keys, provide a suitable `StringComparer`.

```csharp
var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
```

##### Key Points to Mention

- Use `StringComparison` overloads.
- Use ordinal comparison for non-linguistic values.
- Use culture-aware comparison for user-facing language scenarios.
- Avoid `ToLower()`/`ToUpper()` for comparison.
- Use `StringComparer` for collections with string keys.

<!-- question:end:common-bcl-types-in-csharp-intermediate-q06 -->

<!-- question:start:common-bcl-types-in-csharp-intermediate-q07 -->
#### Intermediate Q07: What is the difference between `Task` and `Task<T>`?
<!-- question-id:common-bcl-types-in-csharp-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

`Task` represents an asynchronous operation that does not return a value. `Task<T>` represents an asynchronous operation that returns a value of type `T`.

```csharp
public async Task SaveAsync(Order order)
{
    await repository.SaveAsync(order);
}

public async Task<Order> GetAsync(Guid id)
{
    return await repository.GetAsync(id);
}
```

Both are used with `async` and `await`. Exceptions thrown in async methods are captured in the task and re-thrown when awaited.

In normal application code, prefer `Task` and `Task<T>`. Use `ValueTask<T>` only when there is a measured performance reason and the API behavior is well understood.

##### Key Points to Mention

- `Task` has no result.
- `Task<T>` returns a result.
- Both represent asynchronous operations.
- Exceptions are observed when awaited.
- Avoid blocking with `.Result` or `.Wait()`.

<!-- question:end:common-bcl-types-in-csharp-intermediate-q07 -->

<!-- question:start:common-bcl-types-in-csharp-intermediate-q08 -->
#### Intermediate Q08: What is `IDisposable` used for?
<!-- question-id:common-bcl-types-in-csharp-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

`IDisposable` is used by types that need deterministic cleanup of resources. These resources can include file handles, streams, database connections, timers, operating system handles, or unmanaged resources.

The garbage collector manages memory, but it does not guarantee immediate release of non-memory resources. `Dispose()` provides a way to release those resources promptly.

```csharp
using var stream = File.OpenRead("data.txt");
```

The `using` statement ensures `Dispose()` is called even if an exception occurs.

For asynchronous cleanup, .NET also has `IAsyncDisposable` and `await using`.

##### Key Points to Mention

- Used for deterministic cleanup.
- Common with streams, database contexts, timers, and unmanaged resources.
- `using` calls `Dispose()` automatically.
- Garbage collection and disposal solve different problems.
- `IAsyncDisposable` supports async cleanup.

<!-- question:end:common-bcl-types-in-csharp-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:common-bcl-types-in-csharp-advanced-q01 -->
#### Advanced Q01: How do you choose between `IEnumerable<T>`, `IReadOnlyList<T>`, and `List<T>` in API design?
<!-- question-id:common-bcl-types-in-csharp-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Choose based on the contract you want to expose.

Use `IEnumerable<T>` when the caller only needs to enumerate a sequence. This is flexible and supports streaming and deferred execution, but it does not promise indexing, count, or materialization.

Use `IReadOnlyList<T>` when the result is ordered, materialized, indexable, and should not be mutated by the caller through that interface.

Use `List<T>` when you specifically need a concrete mutable list or when the implementation requires list-specific operations.

```csharp
public decimal CalculateTotal(IEnumerable<OrderLine> lines)
{
    return lines.Sum(x => x.Price * x.Quantity);
}

public IReadOnlyList<CustomerDto> GetCustomers()
{
    return customers.Select(c => new CustomerDto(c.Id, c.Name)).ToList();
}
```

A good API should communicate intent. Avoid exposing internal mutable lists directly because callers can modify internal state.

##### Key Points to Mention

- Accept the least specific type needed.
- Return types should communicate materialization and mutability.
- `IEnumerable<T>` can be deferred and re-enumerated.
- `IReadOnlyList<T>` communicates count/index access without mutation through the interface.
- Avoid exposing mutable internal collections.

<!-- question:end:common-bcl-types-in-csharp-advanced-q01 -->

<!-- question:start:common-bcl-types-in-csharp-advanced-q02 -->
#### Advanced Q02: What are the risks of using `DateTime` incorrectly in distributed systems?
<!-- question-id:common-bcl-types-in-csharp-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

`DateTime` can represent local time, UTC time, or unspecified time through its `Kind` property. If developers ignore `Kind`, values can be converted incorrectly, stored inconsistently, or compared incorrectly across systems.

Distributed systems often involve servers, clients, databases, and services in different time zones. Using `DateTime.Now` or storing local times can cause bugs in logging, scheduling, auditing, and event ordering.

`DateTimeOffset` is often safer for timestamps because it includes an offset from UTC. For server-side audit fields, UTC timestamps are usually preferred.

```csharp
public sealed record IntegrationEvent(
    Guid Id,
    DateTimeOffset OccurredAt,
    string Type);
```

For date-only business concepts, such as birth date or due date, use `DateOnly` to avoid accidentally attaching a meaningless time component.

##### Key Points to Mention

- `DateTime.Kind` can be `Local`, `Utc`, or `Unspecified`.
- `DateTime.Now` can cause cross-time-zone bugs.
- Prefer UTC or `DateTimeOffset` for distributed timestamps.
- Use `DateOnly` for calendar dates without time.
- Time-zone bugs affect logs, scheduling, audits, and event ordering.

<!-- question:end:common-bcl-types-in-csharp-advanced-q02 -->

<!-- question:start:common-bcl-types-in-csharp-advanced-q03 -->
#### Advanced Q03: How do `Equals` and `GetHashCode` affect `Dictionary<TKey, TValue>` and `HashSet<T>`?
<!-- question-id:common-bcl-types-in-csharp-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

`Dictionary<TKey, TValue>` and `HashSet<T>` use equality and hash codes to locate items efficiently. If two values are considered equal, they must return the same hash code. If this rule is broken, lookups can fail or collections can behave incorrectly.

For custom key types, implement equality consistently.

```csharp
public sealed class ProductCode : IEquatable<ProductCode>
{
    public ProductCode(string value) => Value = value;

    public string Value { get; }

    public bool Equals(ProductCode? other)
    {
        return other is not null &&
               string.Equals(Value, other.Value, StringComparison.OrdinalIgnoreCase);
    }

    public override bool Equals(object? obj) => Equals(obj as ProductCode);

    public override int GetHashCode()
    {
        return StringComparer.OrdinalIgnoreCase.GetHashCode(Value);
    }
}
```

Keys should also be stable. If a key is mutated after insertion in a way that changes equality or hash code, the dictionary may no longer be able to find it.

##### Key Points to Mention

- Equal values must have equal hash codes.
- Override `Equals` and `GetHashCode` together.
- Prefer immutable keys.
- Use `IEquatable<T>` for strongly typed equality.
- Use `StringComparer` for string-keyed dictionaries.

<!-- question:end:common-bcl-types-in-csharp-advanced-q03 -->

<!-- question:start:common-bcl-types-in-csharp-advanced-q04 -->
#### Advanced Q04: What is the difference between `IEnumerable<T>` and `IQueryable<T>`?
<!-- question-id:common-bcl-types-in-csharp-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

`IEnumerable<T>` represents a sequence that is enumerated in .NET code. LINQ operations over `IEnumerable<T>` use delegates and run in memory.

`IQueryable<T>` represents a query that can be interpreted by a query provider. In EF Core, for example, the provider translates expression trees into SQL and executes the query in the database.

```csharp
IQueryable<Customer> query = dbContext.Customers
    .Where(c => c.IsActive);

List<Customer> result = await query.ToListAsync();
```

The main practical issue is where filtering happens. Filtering on `IQueryable<T>` before materialization can reduce database work and network traffic. Calling `ToList()` too early can load too much data into memory.

##### Key Points to Mention

- `IEnumerable<T>` is for enumerable sequences.
- `IQueryable<T>` is provider-based and expression-tree driven.
- EF Core translates `IQueryable<T>` to SQL.
- Materialization methods include `ToList()`, `First()`, `Count()`, etc.
- Avoid loading data before applying filters.

<!-- question:end:common-bcl-types-in-csharp-advanced-q04 -->

<!-- question:start:common-bcl-types-in-csharp-advanced-q05 -->
#### Advanced Q05: When should you use `Span<T>` or `ReadOnlySpan<T>`?
<!-- question-id:common-bcl-types-in-csharp-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Use `Span<T>` or `ReadOnlySpan<T>` when you need high-performance access to a contiguous region of memory without copying. They are useful for parsing, slicing, buffer handling, and reducing allocations in hot paths.

```csharp
ReadOnlySpan<char> value = "ORD-12345".AsSpan();
ReadOnlySpan<char> prefix = value[..3];
ReadOnlySpan<char> id = value[4..];
```

`Span<T>` is stack-only and has restrictions. It cannot be stored in normal class fields, captured by lambdas, boxed, or used across `await` boundaries. For async scenarios or storage, use `Memory<T>` or `ReadOnlyMemory<T>`.

For normal business code, use simpler types unless performance requirements justify spans.

##### Key Points to Mention

- Spans provide slicing without copying.
- Useful in high-performance parsing and buffer handling.
- `ReadOnlySpan<T>` is read-only.
- `Span<T>` is stack-only and has restrictions.
- Use `Memory<T>` for async or longer-lived memory.

<!-- question:end:common-bcl-types-in-csharp-advanced-q05 -->

<!-- question:start:common-bcl-types-in-csharp-advanced-q06 -->
#### Advanced Q06: What are common pitfalls with async BCL types such as `Task` and `CancellationToken`?
<!-- question-id:common-bcl-types-in-csharp-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Common pitfalls include blocking async operations with `.Result` or `.Wait()`, forgetting to pass `CancellationToken`, using `async void` outside event handlers, wrapping naturally asynchronous I/O operations in `Task.Run`, and ignoring exceptions from unobserved tasks.

```csharp
public async Task<OrderDto> GetOrderAsync(Guid id, CancellationToken cancellationToken)
{
    Order order = await repository.GetByIdAsync(id, cancellationToken);
    return new OrderDto(order.Id, order.Total);
}
```

`CancellationToken` is cooperative. Passing a token does not forcibly stop code; the operation must observe it and respond. Many BCL async APIs accept a token, and application code should pass it through layers.

`Task<T>` is appropriate for most async results. `ValueTask<T>` should be used carefully because it has more complex consumption rules and is mainly useful for performance-sensitive APIs where results often complete synchronously.

##### Key Points to Mention

- Avoid `.Result` and `.Wait()` in async code.
- Pass `CancellationToken` through call chains.
- Use `async void` only for event handlers.
- Do not use `Task.Run` for naturally async I/O.
- Prefer `Task<T>` unless `ValueTask<T>` is justified.

<!-- question:end:common-bcl-types-in-csharp-advanced-q06 -->

<!-- question:start:common-bcl-types-in-csharp-advanced-q07 -->
#### Advanced Q07: How do you decide between `string`, `StringBuilder`, and `ReadOnlySpan<char>`?
<!-- question-id:common-bcl-types-in-csharp-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Use `string` for normal text values, simple formatting, identifiers, names, messages, and API data. It is immutable, easy to use, and appropriate for most application code.

Use `StringBuilder` when building a string through many repeated appends or modifications, especially in loops or report generation.

Use `ReadOnlySpan<char>` when you need to inspect or slice existing text without allocating new strings, usually in performance-sensitive parsing code.

```csharp
// string: simple and readable
string message = $"Hello {name}";

// StringBuilder: many appends
var builder = new StringBuilder();
foreach (var item in items)
{
    builder.AppendLine(item.Name);
}

// ReadOnlySpan<char>: allocation-conscious slicing
ReadOnlySpan<char> code = "ABC-123";
ReadOnlySpan<char> prefix = code[..3];
```

The best choice depends on readability, mutation pattern, allocation cost, and performance requirements.

##### Key Points to Mention

- `string` is immutable and best for normal text.
- `StringBuilder` is for repeated modifications.
- `ReadOnlySpan<char>` avoids copying when slicing text.
- Do not overuse advanced types in simple business code.
- Measure performance before making code more complex.

<!-- question:end:common-bcl-types-in-csharp-advanced-q07 -->

<!-- question:start:common-bcl-types-in-csharp-advanced-q08 -->
#### Advanced Q08: What should you consider when using `Guid` as a database key?
<!-- question-id:common-bcl-types-in-csharp-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

`Guid` is useful as a distributed unique identifier because values can be generated without a central database. It is common in APIs, distributed systems, correlation IDs, and public resource identifiers.

However, GUIDs are larger than integers and random GUIDs can cause index fragmentation or poor locality in some database designs, especially when used as clustered primary keys. This can affect insert performance and storage.

Possible strategies include:

- Use `Guid` when distributed ID generation is important.
- Use integer or long identity keys when database-local sequential IDs are enough.
- Use sequential or ordered GUID strategies when appropriate.
- Avoid treating GUIDs as secrets.

```csharp
public sealed class Customer
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Name { get; init; }
}
```

##### Key Points to Mention

- GUIDs are good for distributed uniqueness.
- They are larger than integer keys.
- Random GUIDs can affect clustered index performance.
- Sequential/ordered GUIDs may help in some database scenarios.
- GUIDs are identifiers, not security tokens.

<!-- question:end:common-bcl-types-in-csharp-advanced-q08 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
