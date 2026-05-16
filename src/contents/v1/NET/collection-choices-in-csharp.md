---
id: collection-choices-in-csharp
topic: C# Language Foundations
subtopic: Collection Choices in C#
category: .NET
---

## Overview

Collection choices in C# are about selecting the right data structure for storing, reading, searching, updating, ordering, and sharing data in a .NET application. A collection can be as simple as an array, as common as a `List<T>` or `Dictionary<TKey, TValue>`, or as specialized as a `ConcurrentDictionary<TKey, TValue>`, `ImmutableList<T>`, `PriorityQueue<TElement, TPriority>`, or `FrozenDictionary<TKey, TValue>`.

Choosing the correct collection matters because the collection type directly affects performance, memory usage, thread safety, API design, readability, and correctness. A collection that works well for one scenario can be inefficient or unsafe in another. For example, a `List<T>` is good for ordered iteration and index access, but it is not ideal for frequent key lookups. A `Dictionary<TKey, TValue>` is good for fast lookup by key, but it should not be chosen when sorted order is required. A `ConcurrentQueue<T>` is useful for multi-threaded producer/consumer scenarios, but it adds unnecessary overhead if only one thread uses the collection.

Collection choice is important in real-world development because collections are used almost everywhere: API responses, request validation, caching, lookup tables, domain models, Entity Framework query results, background processing, queues, configuration maps, authorization rules, search filters, and UI view models.

This topic is also common in interviews because it tests whether a developer understands practical trade-offs instead of only syntax. Interviewers often ask why you would choose `List<T>` instead of an array, `Dictionary<TKey, TValue>` instead of `List<T>`, `HashSet<T>` instead of `List<T>`, `ConcurrentDictionary<TKey, TValue>` instead of locking a normal dictionary, or immutable/read-only collections instead of mutable collections.

## Core Concepts

### What Is a Collection?

A collection is an object that stores multiple values and provides operations for accessing, adding, removing, searching, or enumerating those values.

Common collection categories in C# include:

| Category | Examples | Main Use Case |
|---|---|---|
| Fixed-size sequence | `T[]` | Known-size data, fast index access |
| Dynamic sequence | `List<T>` | Ordered list that grows and shrinks |
| Key/value lookup | `Dictionary<TKey, TValue>` | Fast lookup by key |
| Unique values | `HashSet<T>` | Prevent duplicates and test membership quickly |
| Sorted values | `SortedSet<T>`, `SortedDictionary<TKey, TValue>`, `SortedList<TKey, TValue>` | Keep data sorted by value or key |
| Queue/stack | `Queue<T>`, `Stack<T>` | FIFO or LIFO processing |
| Priority queue | `PriorityQueue<TElement, TPriority>` | Process items by priority |
| Linked structure | `LinkedList<T>` | Efficient node insertion/removal when node is known |
| Thread-safe collection | `ConcurrentDictionary<TKey, TValue>`, `ConcurrentQueue<T>` | Multi-threaded add/remove/update operations |
| Immutable collection | `ImmutableList<T>`, `ImmutableDictionary<TKey, TValue>` | Share data safely without mutation |
| Frozen collection | `FrozenDictionary<TKey, TValue>`, `FrozenSet<T>` | Read-only lookup optimized after construction |
| Read-only wrapper/interface | `IReadOnlyList<T>`, `ReadOnlyCollection<T>` | Expose data without allowing callers to modify it directly |

The most important interview skill is not memorizing every collection type. The important skill is knowing what question to ask before choosing one.

### The Main Questions to Ask Before Choosing a Collection

When choosing a collection, ask:

1. Do I need fixed size or dynamic size?
2. Do I need fast lookup by index, key, or value?
3. Are duplicate values allowed?
4. Does the order matter?
5. Does the collection need to be sorted?
6. Will multiple threads modify it?
7. Should callers be allowed to modify it?
8. Is this collection read-heavy, write-heavy, or balanced?
9. Is memory usage important?
10. Is this part of a public API or only an internal implementation detail?

Example:

```csharp
// Need ordered data and index access?
List<string> names = ["Alice", "Bob", "Charlie"];
Console.WriteLine(names[0]);

// Need fast lookup by key?
Dictionary<int, string> usersById = new()
{
    [1] = "Alice",
    [2] = "Bob"
};
Console.WriteLine(usersById[2]);

// Need uniqueness?
HashSet<string> roles = ["Admin", "User", "Admin"];
Console.WriteLine(roles.Count); // 2
```

### Big O Complexity Basics

A major reason collection choice matters is operation complexity.

| Collection | Access by Index | Search by Value | Add | Remove | Lookup by Key/Value |
|---|---:|---:|---:|---:|---:|
| `T[]` | O(1) | O(n) | Fixed size | Fixed size | O(n) |
| `List<T>` | O(1) | O(n) | Usually O(1), sometimes O(n) when resizing | O(n) | O(n) |
| `Dictionary<TKey, TValue>` | Not index-based | Not value-focused | Usually O(1) | Usually O(1) | Usually O(1) by key |
| `HashSet<T>` | Not index-based | Usually O(1) membership | Usually O(1) | Usually O(1) | Usually O(1) by value |
| `SortedDictionary<TKey, TValue>` | Not index-based | Not value-focused | O(log n) | O(log n) | O(log n) by key |
| `SortedList<TKey, TValue>` | O(1) by index | Not value-focused | O(n) | O(n) | O(log n) by key |
| `LinkedList<T>` | O(n) | O(n) | O(1) when node is known | O(1) when node is known | O(n) |
| `Queue<T>` | Not index-based | O(n) | O(1) enqueue | O(1) dequeue | O(n) |
| `Stack<T>` | Not index-based | O(n) | O(1) push | O(1) pop | O(n) |
| `PriorityQueue<TElement, TPriority>` | Not index-based | O(n) | O(log n) enqueue | O(log n) dequeue | Priority-based |

`O(1)` does not always mean "always faster". Constant factors, memory allocation, CPU cache locality, resizing, hash quality, and data size also matter. However, Big O is a strong interview signal because it shows you understand how collections scale.

### Arrays: `T[]`

An array is a fixed-size, zero-based sequence of elements of the same type.

Use an array when:

- The size is known and does not change.
- You need very fast index access.
- You want low overhead.
- You are working with APIs that require arrays.
- You are working with performance-sensitive code.

Example:

```csharp
int[] numbers = [10, 20, 30];

for (int i = 0; i < numbers.Length; i++)
{
    Console.WriteLine(numbers[i]);
}
```

Trade-offs:

- Fast index access.
- Low memory overhead compared with many dynamic collections.
- Size cannot be changed after creation.
- Inserting or removing in the middle requires creating or shifting data manually.

Common mistake:

```csharp
// Not possible: arrays do not have Add.
int[] numbers = [1, 2, 3];
// numbers.Add(4); // Compile error
```

Use `List<T>` when the collection needs to grow or shrink frequently.

### Lists: `List<T>`

`List<T>` is one of the most commonly used C# collections. It is a dynamic array that grows as needed.

Use `List<T>` when:

- You need ordered items.
- You need index access.
- You need to add items dynamically.
- You usually add to the end.
- You need to return a simple sequence from a method.

Example:

```csharp
List<string> products = new(capacity: 100);

products.Add("Laptop");
products.Add("Mouse");
products.Add("Keyboard");

Console.WriteLine(products[1]); // Mouse
```

`List<T>` is usually efficient for appending items. However, inserting or removing from the middle can be expensive because later elements must be shifted.

Example of inefficient use:

```csharp
List<int> numbers = Enumerable.Range(1, 100_000).ToList();

// Expensive because each removal shifts many elements.
while (numbers.Count > 0)
{
    numbers.RemoveAt(0);
}
```

Better choice for FIFO processing:

```csharp
Queue<int> queue = new(Enumerable.Range(1, 100_000));

while (queue.Count > 0)
{
    int item = queue.Dequeue();
}
```

Best practices:

- Use `List<T>` as the default collection for ordered, mutable sequences.
- Set initial capacity when the approximate size is known.
- Avoid using `List<T>.Contains` repeatedly for large membership checks; use `HashSet<T>` instead.
- Avoid removing from the beginning repeatedly; use `Queue<T>` if FIFO behavior is needed.

### Dictionaries: `Dictionary<TKey, TValue>`

`Dictionary<TKey, TValue>` stores key/value pairs and provides fast lookup by key.

Use `Dictionary<TKey, TValue>` when:

- Each item has a unique key.
- You need fast lookup by key.
- You need to map one value to another.
- You are building caches, indexes, or lookup tables.

Example:

```csharp
Dictionary<int, string> usersById = new()
{
    [101] = "Alice",
    [102] = "Bob"
};

if (usersById.TryGetValue(102, out string? userName))
{
    Console.WriteLine(userName);
}
```

Prefer `TryGetValue` when the key may not exist:

```csharp
Dictionary<string, decimal> prices = new()
{
    ["Laptop"] = 1200m,
    ["Mouse"] = 25m
};

if (!prices.TryGetValue("Keyboard", out decimal price))
{
    Console.WriteLine("Product not found.");
}
```

Avoid this when the key may be missing:

```csharp
// Throws KeyNotFoundException if the key does not exist.
decimal keyboardPrice = prices["Keyboard"];
```

Use a custom comparer for case-insensitive string keys:

```csharp
Dictionary<string, int> roleCounts = new(StringComparer.OrdinalIgnoreCase)
{
    ["Admin"] = 1
};

roleCounts["admin"]++;
Console.WriteLine(roleCounts["ADMIN"]); // 2
```

Trade-offs:

- Very fast lookup by key on average.
- Keys must be unique.
- Requires a good equality implementation for custom key types.
- Does not represent sorted order.
- Uses more memory than a simple list.

Common mistake with custom keys:

```csharp
public sealed class ProductKey
{
    public string Sku { get; init; } = "";
}

var dictionary = new Dictionary<ProductKey, string>();
dictionary[new ProductKey { Sku = "ABC" }] = "Product A";

// This is a different object reference, so lookup fails unless equality is implemented.
bool found = dictionary.ContainsKey(new ProductKey { Sku = "ABC" });
```

Better with a record:

```csharp
public sealed record ProductKey(string Sku);

var dictionary = new Dictionary<ProductKey, string>();
dictionary[new ProductKey("ABC")] = "Product A";

bool found = dictionary.ContainsKey(new ProductKey("ABC")); // true
```

### Sets: `HashSet<T>`

`HashSet<T>` stores unique values and provides fast membership checks.

Use `HashSet<T>` when:

- You need uniqueness.
- You frequently check whether an item exists.
- You need set operations like union, intersection, and except.
- Order does not matter.

Example:

```csharp
HashSet<string> allowedRoles = new(StringComparer.OrdinalIgnoreCase)
{
    "Admin",
    "Manager",
    "Auditor"
};

bool canAccess = allowedRoles.Contains("admin"); // true
```

Set operations:

```csharp
HashSet<string> currentPermissions = ["Read", "Write", "Delete"];
HashSet<string> requiredPermissions = ["Read", "Write"];

bool hasAllRequired = requiredPermissions.IsSubsetOf(currentPermissions);
Console.WriteLine(hasAllRequired); // true
```

Practical example: removing duplicates.

```csharp
string[] emails =
[
    "a@example.com",
    "b@example.com",
    "a@example.com"
];

HashSet<string> uniqueEmails = new(emails, StringComparer.OrdinalIgnoreCase);
```

Trade-offs:

- Fast membership checks.
- Automatically prevents duplicates.
- Not index-based.
- Does not represent sorted order.
- Requires correct equality and hash code behavior.

### `List<T>` vs `HashSet<T>`

A common interview question is when to choose `List<T>` or `HashSet<T>`.

Use `List<T>` when order and index access matter.

Use `HashSet<T>` when uniqueness and fast membership checks matter.

Example:

```csharp
List<int> selectedIds = [1, 2, 3, 4, 5];

// Fine for small lists, but O(n).
bool isSelected = selectedIds.Contains(5);
```

Better for frequent membership checks:

```csharp
HashSet<int> selectedIds = [1, 2, 3, 4, 5];

// Usually O(1).
bool isSelected = selectedIds.Contains(5);
```

Real-world use:

```csharp
HashSet<int> blockedUserIds = new(blockedUsers.Select(u => u.Id));

List<User> visibleUsers = allUsers
    .Where(user => !blockedUserIds.Contains(user.Id))
    .ToList();
```

This avoids repeatedly scanning a list of blocked users.

### Queues: `Queue<T>`

`Queue<T>` represents first-in, first-out processing.

Use `Queue<T>` when:

- The first item added should be the first item processed.
- You are implementing buffering.
- You are processing tasks in arrival order.
- You need BFS-style traversal.

Example:

```csharp
Queue<string> jobs = new();

jobs.Enqueue("Send welcome email");
jobs.Enqueue("Generate report");

while (jobs.TryDequeue(out string? job))
{
    Console.WriteLine($"Processing: {job}");
}
```

Real-world examples:

- Background job processing.
- Breadth-first search.
- Message buffering.
- Request ordering.

Use `ConcurrentQueue<T>` instead when multiple threads need to enqueue and dequeue concurrently.

### Stacks: `Stack<T>`

`Stack<T>` represents last-in, first-out processing.

Use `Stack<T>` when:

- The most recently added item should be processed first.
- You need undo/redo behavior.
- You are parsing nested structures.
- You need DFS-style traversal.

Example:

```csharp
Stack<string> navigationHistory = new();

navigationHistory.Push("Home");
navigationHistory.Push("Products");
navigationHistory.Push("Details");

string previousPage = navigationHistory.Pop();
Console.WriteLine(previousPage); // Details
```

Common use cases:

- Undo operations.
- Browser history.
- Depth-first search.
- Expression parsing.

Use `ConcurrentStack<T>` if multiple threads need to push and pop concurrently.

### Priority Queues: `PriorityQueue<TElement, TPriority>`

`PriorityQueue<TElement, TPriority>` stores elements with priorities. When you dequeue, the element with the lowest priority value is returned first by default.

Use `PriorityQueue<TElement, TPriority>` when:

- Items should be processed by priority rather than insertion order.
- You need scheduling behavior.
- You are implementing algorithms like Dijkstra's shortest path.
- You need a min-heap-like data structure.

Example:

```csharp
PriorityQueue<string, int> tasks = new();

tasks.Enqueue("Low priority report", 5);
tasks.Enqueue("Critical alert", 1);
tasks.Enqueue("Normal email", 3);

while (tasks.TryDequeue(out string? task, out int priority))
{
    Console.WriteLine($"Priority {priority}: {task}");
}
```

Output order:

```text
Priority 1: Critical alert
Priority 3: Normal email
Priority 5: Low priority report
```

Trade-offs:

- Efficient for priority-based enqueue/dequeue.
- Not designed for searching arbitrary items.
- Not the same as a sorted list for full ordered enumeration.

### Linked Lists: `LinkedList<T>`

`LinkedList<T>` is a doubly linked list where each element is stored in a node with links to the previous and next nodes.

Use `LinkedList<T>` when:

- You frequently insert or remove nodes from the middle.
- You already have a reference to the node.
- You need stable node references.

Example:

```csharp
LinkedList<string> steps = new();

LinkedListNode<string> first = steps.AddLast("Validate request");
LinkedListNode<string> third = steps.AddLast("Save data");

steps.AddBefore(third, "Map DTO to entity");

foreach (string step in steps)
{
    Console.WriteLine(step);
}
```

Trade-offs:

- Efficient insertion/removal when the node is known.
- Poor index access because finding the nth item requires traversal.
- Higher memory overhead because each node stores links.
- Often less cache-friendly than `List<T>`.

Common interview point: `LinkedList<T>` is not automatically better for insertions. If you do not already have the node, you still need O(n) time to find where to insert.

### Sorted Collections

Sorted collections keep data sorted according to a comparer.

Common sorted collections:

| Collection | Description | Good For |
|---|---|---|
| `SortedDictionary<TKey, TValue>` | Key/value collection sorted by key, tree-based | Frequent inserts/removes with sorted key lookup |
| `SortedList<TKey, TValue>` | Key/value collection sorted by key, array-based | Smaller or mostly-read collections where memory matters |
| `SortedSet<T>` | Unique values sorted by value | Unique sorted values and range-style operations |

Example:

```csharp
SortedDictionary<DateOnly, string> events = new()
{
    [new DateOnly(2026, 5, 12)] = "Deploy API",
    [new DateOnly(2026, 5, 10)] = "Code review",
    [new DateOnly(2026, 5, 11)] = "Run tests"
};

foreach (var item in events)
{
    Console.WriteLine($"{item.Key}: {item.Value}");
}
```

The output is sorted by date, not insertion order.

`SortedDictionary<TKey, TValue>` vs `SortedList<TKey, TValue>`:

| Feature | `SortedDictionary<TKey, TValue>` | `SortedList<TKey, TValue>` |
|---|---|---|
| Internal structure | Tree-based | Array-based |
| Lookup | O(log n) | O(log n) |
| Insert/remove | O(log n) | O(n) because shifting may be needed |
| Memory usage | Usually higher | Usually lower |
| Index access | No direct index access | Supports index-based access to keys/values |
| Good for | Frequent changes | Mostly-read data or smaller data sets |

### Ordered Dictionaries

An ordered dictionary is useful when you need both key lookup and a stable item order.

Use an ordered dictionary when:

- You need key/value lookup.
- You also need to preserve or manipulate order.
- You cannot model the data cleanly as only a list or only a dictionary.

Example:

```csharp
OrderedDictionary<string, int> scores = new()
{
    ["Alice"] = 95,
    ["Bob"] = 88,
    ["Charlie"] = 91
};

scores.Insert(1, "Diana", 90);

foreach (var score in scores)
{
    Console.WriteLine($"{score.Key}: {score.Value}");
}
```

Do not use a normal `Dictionary<TKey, TValue>` when the business logic depends on order. Even if a specific runtime appears to enumerate in insertion order, the safer interview answer is to choose a collection whose contract matches the ordering requirement.

### Read-Only Collections and Interfaces

Read-only collections are useful for API design and encapsulation. They prevent callers from modifying a collection through the exposed reference.

Common read-only abstractions:

| Type | Meaning |
|---|---|
| `IEnumerable<T>` | Can be enumerated only |
| `IReadOnlyCollection<T>` | Can be enumerated and exposes `Count` |
| `IReadOnlyList<T>` | Read-only sequence with index access |
| `IReadOnlyDictionary<TKey, TValue>` | Read-only key/value lookup |
| `ReadOnlyCollection<T>` | Read-only wrapper around a list |
| `ReadOnlyDictionary<TKey, TValue>` | Read-only wrapper around a dictionary |

Example:

```csharp
public sealed class Order
{
    private readonly List<OrderLine> _lines = [];

    public IReadOnlyList<OrderLine> Lines => _lines;

    public void AddLine(string productName, int quantity)
    {
        if (quantity <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(quantity));
        }

        _lines.Add(new OrderLine(productName, quantity));
    }
}

public sealed record OrderLine(string ProductName, int Quantity);
```

This design allows consumers to read order lines without directly modifying the internal list.

Important distinction:

- Read-only does not always mean immutable.
- A read-only wrapper may still reflect changes if the underlying collection changes.
- Immutable collections cannot be changed after creation; modification creates a new collection instance.

### Immutable Collections

Immutable collections cannot be changed after they are created. Operations like `Add`, `Remove`, or `SetItem` return a new collection instead of modifying the original.

Common immutable collections:

- `ImmutableArray<T>`
- `ImmutableList<T>`
- `ImmutableDictionary<TKey, TValue>`
- `ImmutableHashSet<T>`
- `ImmutableQueue<T>`
- `ImmutableStack<T>`
- `ImmutableSortedDictionary<TKey, TValue>`
- `ImmutableSortedSet<T>`

Use immutable collections when:

- You want safe sharing across threads.
- You want predictable state.
- You use functional programming patterns.
- You want to avoid accidental mutation.
- You need snapshots of data.

Example:

```csharp
using System.Collections.Immutable;

ImmutableList<string> original = ImmutableList.Create("Read", "Write");
ImmutableList<string> updated = original.Add("Delete");

Console.WriteLine(original.Count); // 2
Console.WriteLine(updated.Count);  // 3
```

The original collection is unchanged.

Trade-offs:

- Safer sharing.
- Easier reasoning about state.
- Useful for concurrent read scenarios.
- Can allocate more than mutable collections if used incorrectly.
- For many changes, use a builder and convert to immutable at the end.

Example using a builder:

```csharp
using System.Collections.Immutable;

ImmutableList<string>.Builder builder = ImmutableList.CreateBuilder<string>();

builder.Add("Read");
builder.Add("Write");
builder.Add("Delete");

ImmutableList<string> permissions = builder.ToImmutable();
```

### Frozen Collections

Frozen collections are immutable, read-only collections optimized for fast lookup and enumeration after construction.

Common frozen collections:

- `FrozenDictionary<TKey, TValue>`
- `FrozenSet<T>`

Use frozen collections when:

- The collection is built once and read many times.
- Startup or initialization cost is acceptable.
- Lookup performance matters.
- The data does not change after initialization.

Example:

```csharp
using System.Collections.Frozen;

FrozenDictionary<string, int> statusCodes = new Dictionary<string, int>
{
    ["OK"] = 200,
    ["BadRequest"] = 400,
    ["Unauthorized"] = 401,
    ["NotFound"] = 404
}.ToFrozenDictionary(StringComparer.OrdinalIgnoreCase);

int notFound = statusCodes["notfound"];
```

Frozen collections are not a replacement for every dictionary or set. They are useful for read-heavy lookup tables, not for frequently changing data.

### Concurrent Collections

Standard generic collections such as `List<T>` and `Dictionary<TKey, TValue>` are not safe for concurrent writes. If multiple threads add, remove, or update items at the same time, use synchronization or choose a concurrent collection.

Common concurrent collections:

| Collection | Use Case |
|---|---|
| `ConcurrentDictionary<TKey, TValue>` | Thread-safe key/value updates |
| `ConcurrentQueue<T>` | Thread-safe FIFO queue |
| `ConcurrentStack<T>` | Thread-safe LIFO stack |
| `ConcurrentBag<T>` | Thread-safe unordered collection optimized for some producer/consumer scenarios |
| `BlockingCollection<T>` | Blocking and bounding over producer/consumer collections |

Example:

```csharp
using System.Collections.Concurrent;

ConcurrentDictionary<string, int> counts = new();

Parallel.ForEach(
    ["apple", "banana", "apple", "orange", "banana", "apple"],
    word =>
    {
        counts.AddOrUpdate(
            word,
            addValue: 1,
            updateValueFactory: (_, current) => current + 1);
    });

foreach (var item in counts)
{
    Console.WriteLine($"{item.Key}: {item.Value}");
}
```

When not to use concurrent collections:

- If only one thread writes to the collection.
- If the collection is built once and then only read.
- If a simple lock around a small critical section is clearer and sufficient.
- If you need multi-step operations to be atomic and the collection does not provide that operation directly.

Common mistake:

```csharp
// This is not atomic as a full sequence of operations.
if (!dictionary.ContainsKey(key))
{
    dictionary[key] = value;
}
```

Better:

```csharp
ConcurrentDictionary<string, int> dictionary = new();

dictionary.TryAdd("A", 1);
```

Or:

```csharp
dictionary.AddOrUpdate(
    "A",
    addValue: 1,
    updateValueFactory: (_, current) => current + 1);
```

### `IEnumerable<T>`, `ICollection<T>`, `IList<T>`, and Interface Choice

Collection interfaces are important for API design.

| Interface | Use When |
|---|---|
| `IEnumerable<T>` | The caller only needs to iterate |
| `ICollection<T>` | The caller needs count and mutation operations |
| `IList<T>` | The caller needs index access and mutation operations |
| `IReadOnlyCollection<T>` | The caller needs count but should not mutate |
| `IReadOnlyList<T>` | The caller needs index access but should not mutate |
| `IDictionary<TKey, TValue>` | The caller needs mutable key/value operations |
| `IReadOnlyDictionary<TKey, TValue>` | The caller needs key/value lookup but should not mutate |

Good API example:

```csharp
public decimal CalculateTotal(IEnumerable<OrderLine> lines)
{
    return lines.Sum(line => line.UnitPrice * line.Quantity);
}
```

This method only needs enumeration, so `IEnumerable<T>` is enough.

Better API when count is needed:

```csharp
public bool HasEnoughItems(IReadOnlyCollection<OrderLine> lines)
{
    return lines.Count >= 5;
}
```

Better API when index access is needed:

```csharp
public OrderLine GetFirstLine(IReadOnlyList<OrderLine> lines)
{
    if (lines.Count == 0)
    {
        throw new InvalidOperationException("Order has no lines.");
    }

    return lines[0];
}
```

Best practice:

- Accept the least powerful interface needed.
- Return read-only interfaces from public domain objects when callers should not mutate internal state.
- Use concrete types internally when specific behavior or performance is needed.

### Deferred Execution and Materialization

`IEnumerable<T>` often represents deferred execution. This means the query may not run until it is enumerated.

Example:

```csharp
IEnumerable<int> query = Enumerable.Range(1, 5)
    .Where(x =>
    {
        Console.WriteLine($"Filtering {x}");
        return x % 2 == 0;
    });

Console.WriteLine("Before enumeration");

foreach (int number in query)
{
    Console.WriteLine(number);
}
```

The filtering logic runs during enumeration, not when the query is created.

Materialization means converting the query into a concrete collection:

```csharp
List<int> evenNumbers = Enumerable.Range(1, 5)
    .Where(x => x % 2 == 0)
    .ToList();
```

Common mistake:

```csharp
IEnumerable<User> users = dbContext.Users.Where(u => u.IsActive);

// Multiple enumeration can execute the query multiple times depending on the source.
int count = users.Count();
List<User> result = users.ToList();
```

Better:

```csharp
List<User> users = dbContext.Users
    .Where(u => u.IsActive)
    .ToList();

int count = users.Count;
```

Interview point: `IEnumerable<T>` is not always an in-memory list. It can represent a database query, file stream, generated sequence, or lazy pipeline.

### `Array`, `Span<T>`, and `Memory<T>`

`Span<T>` and `Memory<T>` are not normal collections, but they are important in modern C# performance work.

`Span<T>` represents a contiguous region of memory and can point to arrays, stack memory, or unmanaged memory. It avoids copying data in many scenarios.

Example:

```csharp
int[] numbers = [1, 2, 3, 4, 5];
Span<int> middle = numbers.AsSpan(1, 3);

middle[0] = 20;

Console.WriteLine(numbers[1]); // 20
```

Use `Span<T>` when:

- You need high-performance slicing.
- You want to avoid allocations.
- You are parsing strings or processing buffers.
- The data does not need to escape the current stack scope.

Use `Memory<T>` when:

- You need a memory abstraction that can be stored on the heap.
- You need async-compatible memory usage.
- You cannot use `Span<T>` because it is stack-only.

Example:

```csharp
ReadOnlySpan<char> text = "ABC-123";
ReadOnlySpan<char> prefix = text[..3];
ReadOnlySpan<char> suffix = text[4..];

Console.WriteLine(prefix.ToString()); // ABC
Console.WriteLine(suffix.ToString()); // 123
```

Interview point: `Span<T>` is for performance-sensitive memory access, not a replacement for `List<T>` or `Dictionary<TKey, TValue>` in normal business code.

### Collection Expressions

Modern C# supports collection expressions, which provide a concise way to create arrays, spans, lists, and other collection-like types.

Example:

```csharp
int[] numbers = [1, 2, 3];
List<string> names = ["Alice", "Bob", "Charlie"];
HashSet<int> uniqueNumbers = [1, 2, 2, 3];
```

Collection expressions improve readability, but they do not remove the need to choose the correct target collection type.

Example:

```csharp
// This creates a List<string>, so duplicates are allowed.
List<string> list = ["Admin", "Admin"];

// This creates a HashSet<string>, so duplicates collapse.
HashSet<string> set = ["Admin", "Admin"];
```

### Choosing Collections for Common Scenarios

| Scenario | Good Choice | Why |
|---|---|---|
| Store ordered API response items | `List<T>` | Simple, ordered, serializable |
| Store known-size numeric data | `T[]` | Low overhead and fast index access |
| Lookup user by ID | `Dictionary<int, User>` | Fast key lookup |
| Check whether a role exists | `HashSet<string>` | Fast membership and uniqueness |
| Process jobs in arrival order | `Queue<T>` | FIFO behavior |
| Process undo actions | `Stack<T>` | LIFO behavior |
| Process tasks by priority | `PriorityQueue<TElement, TPriority>` | Priority-based dequeue |
| Keep data sorted by key | `SortedDictionary<TKey, TValue>` | Maintains sorted key order |
| Expose domain child entities safely | `IReadOnlyList<T>` | Prevents direct mutation by callers |
| Multi-threaded cache updates | `ConcurrentDictionary<TKey, TValue>` | Thread-safe key/value operations |
| Shared state snapshot | `ImmutableList<T>` or `ImmutableDictionary<TKey, TValue>` | Prevents accidental mutation |
| Build once, read often lookup table | `FrozenDictionary<TKey, TValue>` | Optimized for read-heavy lookup |

### Practical Example: Choosing the Right Collection in an API

Bad approach:

```csharp
public sealed class PermissionService
{
    private readonly List<string> _adminPermissions =
    [
        "User.Read",
        "User.Write",
        "Report.Read"
    ];

    public bool HasPermission(string permission)
    {
        return _adminPermissions.Contains(permission);
    }
}
```

This works for small data, but if permission checks happen frequently, a set is a better fit.

Better approach:

```csharp
public sealed class PermissionService
{
    private readonly HashSet<string> _adminPermissions = new(
        [
            "User.Read",
            "User.Write",
            "Report.Read"
        ],
        StringComparer.OrdinalIgnoreCase);

    public bool HasPermission(string permission)
    {
        return _adminPermissions.Contains(permission);
    }
}
```

Even better if the permissions are initialized once and never change:

```csharp
using System.Collections.Frozen;

public sealed class PermissionService
{
    private static readonly FrozenSet<string> AdminPermissions = new[]
    {
        "User.Read",
        "User.Write",
        "Report.Read"
    }.ToFrozenSet(StringComparer.OrdinalIgnoreCase);

    public bool HasPermission(string permission)
    {
        return AdminPermissions.Contains(permission);
    }
}
```

### Practical Example: Avoiding Repeated Linear Search

Bad approach:

```csharp
List<int> allowedDepartmentIds = allowedDepartments
    .Select(d => d.Id)
    .ToList();

List<Employee> result = employees
    .Where(e => allowedDepartmentIds.Contains(e.DepartmentId))
    .ToList();
```

If both lists are large, this can become expensive because `List<T>.Contains` is O(n).

Better approach:

```csharp
HashSet<int> allowedDepartmentIds = allowedDepartments
    .Select(d => d.Id)
    .ToHashSet();

List<Employee> result = employees
    .Where(e => allowedDepartmentIds.Contains(e.DepartmentId))
    .ToList();
```

### Practical Example: Safe Domain Model Encapsulation

Bad approach:

```csharp
public sealed class Order
{
    public List<OrderLine> Lines { get; } = [];
}
```

Any caller can do this:

```csharp
order.Lines.Clear();
```

Better approach:

```csharp
public sealed class Order
{
    private readonly List<OrderLine> _lines = [];

    public IReadOnlyList<OrderLine> Lines => _lines;

    public void AddLine(string productName, int quantity)
    {
        if (string.IsNullOrWhiteSpace(productName))
        {
            throw new ArgumentException("Product name is required.", nameof(productName));
        }

        if (quantity <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(quantity));
        }

        _lines.Add(new OrderLine(productName, quantity));
    }
}

public sealed record OrderLine(string ProductName, int Quantity);
```

This keeps business rules inside the aggregate.

### Common Mistakes

Common collection mistakes include:

- Using `List<T>` for frequent membership checks instead of `HashSet<T>`.
- Using `List<T>` as a queue and repeatedly removing from index `0`.
- Using `Dictionary<TKey, TValue>` when sorted order is required.
- Exposing mutable `List<T>` properties from domain entities.
- Assuming `IEnumerable<T>` is already materialized.
- Enumerating an `IEnumerable<T>` multiple times when it represents an expensive query.
- Modifying a collection while iterating over it.
- Using non-generic collections like `ArrayList` and `Hashtable` in modern C# code.
- Using concurrent collections when there is no concurrent write scenario.
- Assuming read-only wrappers are the same as immutable collections.
- Forgetting to pass `StringComparer.OrdinalIgnoreCase` for case-insensitive string keys.
- Using mutable objects as dictionary keys and then changing the fields used for equality.

Example of modifying during enumeration:

```csharp
List<int> numbers = [1, 2, 3, 4, 5];

// Throws InvalidOperationException.
foreach (int number in numbers)
{
    if (number % 2 == 0)
    {
        numbers.Remove(number);
    }
}
```

Better:

```csharp
numbers.RemoveAll(number => number % 2 == 0);
```

Or:

```csharp
List<int> filtered = numbers
    .Where(number => number % 2 != 0)
    .ToList();
```

### Best Practices

Use these rules of thumb:

- Use `List<T>` for the default ordered, mutable sequence.
- Use `T[]` for fixed-size data or low-level performance scenarios.
- Use `Dictionary<TKey, TValue>` for fast lookup by key.
- Use `HashSet<T>` for uniqueness and fast membership checks.
- Use `Queue<T>` for FIFO processing.
- Use `Stack<T>` for LIFO processing.
- Use `PriorityQueue<TElement, TPriority>` for priority-based processing.
- Use `SortedDictionary<TKey, TValue>` or `SortedSet<T>` when sorted order is part of the requirement.
- Use `IReadOnlyList<T>` or `IReadOnlyCollection<T>` when exposing data that should not be modified by callers.
- Use immutable collections when shared state should not change.
- Use frozen collections for build-once, read-many lookup tables.
- Use concurrent collections for multi-threaded writes.
- Use `StringComparer.OrdinalIgnoreCase` for case-insensitive technical keys such as codes, names, identifiers, and headers.
- Accept the least powerful interface needed by a method.
- Choose collections based on access pattern, not habit.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

<!-- question:start:collection-choices-in-csharp-beginner-q01 -->
<!-- question-id:collection-choices-in-csharp-beginner-q01 -->
<!-- question-level:beginner -->
#### 1. What is the difference between an array and `List<T>` in C#?

##### Expected Answer

An array is fixed-size after creation, while `List<T>` is a dynamic collection that can grow and shrink. Both provide fast index access, but `List<T>` provides convenient methods such as `Add`, `Remove`, `Insert`, `Contains`, and `RemoveAll`.

Use an array when the size is known and stable or when low overhead matters. Use `List<T>` when the number of items changes during runtime.

Example:

```csharp
int[] fixedNumbers = [1, 2, 3];

List<int> dynamicNumbers = [];
dynamicNumbers.Add(1);
dynamicNumbers.Add(2);
dynamicNumbers.Add(3);
```

##### Key Points to Mention

- Arrays have fixed length.
- `List<T>` grows dynamically.
- Both support index access.
- Arrays can be more memory-efficient.
- `List<T>` is usually the default for mutable sequences.

<!-- question:end:collection-choices-in-csharp-beginner-q01 -->

<!-- question:start:collection-choices-in-csharp-beginner-q02 -->
<!-- question-id:collection-choices-in-csharp-beginner-q02 -->
<!-- question-level:beginner -->
#### 2. When would you use `Dictionary<TKey, TValue>` instead of `List<T>`?

##### Expected Answer

Use `Dictionary<TKey, TValue>` when you need fast lookup by a unique key. A `List<T>` is useful for ordered iteration and index access, but searching for an item usually requires scanning the list. A dictionary uses keys and usually provides O(1) lookup.

Example:

```csharp
Dictionary<int, User> usersById = users.ToDictionary(user => user.Id);

if (usersById.TryGetValue(42, out User? user))
{
    Console.WriteLine(user.Name);
}
```

##### Key Points to Mention

- `Dictionary<TKey, TValue>` is for key/value lookup.
- Keys must be unique.
- Lookup is usually O(1).
- `List<T>` search is O(n).
- Prefer `TryGetValue` when the key might be missing.

<!-- question:end:collection-choices-in-csharp-beginner-q02 -->

<!-- question:start:collection-choices-in-csharp-beginner-q03 -->
<!-- question-id:collection-choices-in-csharp-beginner-q03 -->
<!-- question-level:beginner -->
#### 3. When would you use `HashSet<T>`?

##### Expected Answer

Use `HashSet<T>` when you need unique values and fast membership checks. It is useful when duplicates are not allowed or when you repeatedly check whether a value exists.

Example:

```csharp
HashSet<string> allowedRoles = new(StringComparer.OrdinalIgnoreCase)
{
    "Admin",
    "Manager"
};

bool allowed = allowedRoles.Contains("admin");
```

##### Key Points to Mention

- Stores unique values.
- Membership checks are usually O(1).
- Not index-based.
- Does not represent sorted order.
- Useful for de-duplication and permission checks.

<!-- question:end:collection-choices-in-csharp-beginner-q03 -->

<!-- question:start:collection-choices-in-csharp-beginner-q04 -->
<!-- question-id:collection-choices-in-csharp-beginner-q04 -->
<!-- question-level:beginner -->
#### 4. What is the difference between `Queue<T>` and `Stack<T>`?

##### Expected Answer

`Queue<T>` is first-in, first-out. The first item added is the first item removed. `Stack<T>` is last-in, first-out. The last item added is the first item removed.

Example:

```csharp
Queue<string> queue = new();
queue.Enqueue("A");
queue.Enqueue("B");
Console.WriteLine(queue.Dequeue()); // A

Stack<string> stack = new();
stack.Push("A");
stack.Push("B");
Console.WriteLine(stack.Pop()); // B
```

##### Key Points to Mention

- `Queue<T>` is FIFO.
- `Stack<T>` is LIFO.
- Queues are useful for job processing.
- Stacks are useful for undo, parsing, and DFS.

<!-- question:end:collection-choices-in-csharp-beginner-q04 -->

<!-- question:start:collection-choices-in-csharp-beginner-q05 -->
<!-- question-id:collection-choices-in-csharp-beginner-q05 -->
<!-- question-level:beginner -->
#### 5. Why should modern C# code prefer generic collections over non-generic collections?

##### Expected Answer

Generic collections such as `List<T>`, `Dictionary<TKey, TValue>`, and `HashSet<T>` provide compile-time type safety and usually better performance. Non-generic collections such as `ArrayList` and `Hashtable` store items as `object`, which can require casting and boxing/unboxing for value types.

Example:

```csharp
List<int> numbers = [1, 2, 3];

// No cast required.
int first = numbers[0];
```

##### Key Points to Mention

- Generic collections are type-safe.
- They avoid many runtime cast errors.
- They reduce boxing for value types.
- They are the normal choice in modern C#.

<!-- question:end:collection-choices-in-csharp-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

<!-- question:start:collection-choices-in-csharp-intermediate-q01 -->
<!-- question-id:collection-choices-in-csharp-intermediate-q01 -->
<!-- question-level:intermediate -->
#### 1. How do you choose between `List<T>` and `HashSet<T>`?

##### Expected Answer

Choose `List<T>` when order and index access matter. Choose `HashSet<T>` when uniqueness and fast membership checks matter. `List<T>.Contains` scans the list, while `HashSet<T>.Contains` is usually O(1).

Example:

```csharp
HashSet<int> blockedUserIds = blockedUsers
    .Select(user => user.Id)
    .ToHashSet();

List<User> visibleUsers = users
    .Where(user => !blockedUserIds.Contains(user.Id))
    .ToList();
```

##### Key Points to Mention

- `List<T>` preserves sequence and supports indexing.
- `HashSet<T>` enforces uniqueness.
- `HashSet<T>` is better for repeated membership checks.
- `HashSet<T>` is not for index-based access.

<!-- question:end:collection-choices-in-csharp-intermediate-q01 -->

<!-- question:start:collection-choices-in-csharp-intermediate-q02 -->
<!-- question-id:collection-choices-in-csharp-intermediate-q02 -->
<!-- question-level:intermediate -->
#### 2. What is the difference between `IEnumerable<T>`, `ICollection<T>`, and `IList<T>`?

##### Expected Answer

`IEnumerable<T>` only means the sequence can be enumerated. `ICollection<T>` adds `Count` and mutation methods such as `Add`, `Remove`, and `Clear`. `IList<T>` adds index access and index-based mutation.

Use the least powerful abstraction required. If a method only needs to loop over items, accept `IEnumerable<T>`. If it needs count but should not modify data, prefer `IReadOnlyCollection<T>`. If it needs index access but should not modify data, prefer `IReadOnlyList<T>`.

Example:

```csharp
public decimal CalculateTotal(IEnumerable<OrderLine> lines)
{
    return lines.Sum(line => line.UnitPrice * line.Quantity);
}
```

##### Key Points to Mention

- `IEnumerable<T>` supports enumeration.
- `ICollection<T>` supports count and mutation.
- `IList<T>` supports index access.
- Prefer read-only interfaces for safe public APIs.
- Accept the least powerful interface needed.

<!-- question:end:collection-choices-in-csharp-intermediate-q02 -->

<!-- question:start:collection-choices-in-csharp-intermediate-q03 -->
<!-- question-id:collection-choices-in-csharp-intermediate-q03 -->
<!-- question-level:intermediate -->
#### 3. What is deferred execution, and how does it affect collection choice?

##### Expected Answer

Deferred execution means a query is not executed until it is enumerated. Many LINQ queries return `IEnumerable<T>`, which may represent a lazy operation rather than an already materialized collection. This matters because multiple enumeration can repeat work, re-run database queries, or produce different results if the source changes.

Example:

```csharp
IEnumerable<User> activeUsersQuery = users.Where(user => user.IsActive);

// Query runs here.
List<User> activeUsers = activeUsersQuery.ToList();
```

If you need stable results, count multiple times, or pass data across layers, materialize with `ToList`, `ToArray`, or another collection type.

##### Key Points to Mention

- `IEnumerable<T>` can be lazy.
- Queries execute during enumeration.
- Multiple enumeration can repeat work.
- Use `ToList` or `ToArray` to materialize.
- Important when working with EF Core and LINQ providers.

<!-- question:end:collection-choices-in-csharp-intermediate-q03 -->

<!-- question:start:collection-choices-in-csharp-intermediate-q04 -->
<!-- question-id:collection-choices-in-csharp-intermediate-q04 -->
<!-- question-level:intermediate -->
#### 4. When should you use `SortedDictionary<TKey, TValue>` instead of `Dictionary<TKey, TValue>`?

##### Expected Answer

Use `SortedDictionary<TKey, TValue>` when the collection must remain sorted by key. A normal dictionary is optimized for fast lookup but should not be used when sorted key order is part of the requirement.

Example:

```csharp
SortedDictionary<DateOnly, string> schedule = new()
{
    [new DateOnly(2026, 5, 12)] = "Deploy",
    [new DateOnly(2026, 5, 10)] = "Review",
    [new DateOnly(2026, 5, 11)] = "Test"
};

foreach (var item in schedule)
{
    Console.WriteLine($"{item.Key}: {item.Value}");
}
```

##### Key Points to Mention

- `Dictionary<TKey, TValue>` is for fast key lookup.
- `SortedDictionary<TKey, TValue>` keeps keys sorted.
- Sorted dictionary operations are typically O(log n).
- Use sorted collections only when sorting is required.

<!-- question:end:collection-choices-in-csharp-intermediate-q04 -->

<!-- question:start:collection-choices-in-csharp-intermediate-q05 -->
<!-- question-id:collection-choices-in-csharp-intermediate-q05 -->
<!-- question-level:intermediate -->
#### 5. What is the difference between a read-only collection and an immutable collection?

##### Expected Answer

A read-only collection prevents modification through a specific reference or interface. However, the underlying collection may still change if another reference can modify it. An immutable collection cannot be changed after creation; operations return a new collection instance.

Example:

```csharp
List<string> source = ["A", "B"];
IReadOnlyList<string> readOnly = source;

source.Add("C");
Console.WriteLine(readOnly.Count); // 3
```

With immutable collections:

```csharp
ImmutableList<string> original = ImmutableList.Create("A", "B");
ImmutableList<string> updated = original.Add("C");

Console.WriteLine(original.Count); // 2
Console.WriteLine(updated.Count);  // 3
```

##### Key Points to Mention

- Read-only is a view or contract.
- Immutable means the data structure cannot be changed.
- Read-only wrappers can reflect underlying changes.
- Immutable collections are useful for safe sharing and snapshots.

<!-- question:end:collection-choices-in-csharp-intermediate-q05 -->

<!-- question:start:collection-choices-in-csharp-intermediate-q06 -->
<!-- question-id:collection-choices-in-csharp-intermediate-q06 -->
<!-- question-level:intermediate -->
#### 6. When should you use `ConcurrentDictionary<TKey, TValue>`?

##### Expected Answer

Use `ConcurrentDictionary<TKey, TValue>` when multiple threads need to add, remove, or update key/value pairs concurrently. It provides thread-safe operations such as `TryAdd`, `TryRemove`, `GetOrAdd`, and `AddOrUpdate`.

Example:

```csharp
ConcurrentDictionary<string, int> counts = new();

Parallel.ForEach(words, word =>
{
    counts.AddOrUpdate(
        word,
        addValue: 1,
        updateValueFactory: (_, current) => current + 1);
});
```

Do not use it just because it sounds safer. It has overhead and is mainly useful for concurrent write scenarios.

##### Key Points to Mention

- Use for multi-threaded key/value updates.
- Provides atomic helper methods.
- Avoid check-then-act race conditions.
- Not always needed for read-only or single-threaded scenarios.

<!-- question:end:collection-choices-in-csharp-intermediate-q06 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

<!-- question:start:collection-choices-in-csharp-advanced-q01 -->
<!-- question-id:collection-choices-in-csharp-advanced-q01 -->
<!-- question-level:advanced -->
#### 1. How would you choose between `Dictionary<TKey, TValue>`, `ImmutableDictionary<TKey, TValue>`, `ConcurrentDictionary<TKey, TValue>`, and `FrozenDictionary<TKey, TValue>`?

##### Expected Answer

Choose based on mutation and concurrency requirements.

Use `Dictionary<TKey, TValue>` for normal single-threaded or externally synchronized mutable lookup.

Use `ImmutableDictionary<TKey, TValue>` when you want safe snapshots and no mutation of existing instances. It is useful when sharing data across threads or preserving state history.

Use `ConcurrentDictionary<TKey, TValue>` when multiple threads must modify the dictionary concurrently.

Use `FrozenDictionary<TKey, TValue>` when the dictionary is built once and read many times. It is optimized for lookup and enumeration after construction, but it is not suitable for frequent updates.

Example:

```csharp
// Mutable local lookup.
Dictionary<int, User> usersById = users.ToDictionary(user => user.Id);

// Concurrent updates.
ConcurrentDictionary<int, User> cache = new();
cache.GetOrAdd(user.Id, user);

// Build once, read many times.
FrozenDictionary<string, int> codes = statusCodes.ToFrozenDictionary(
    item => item.Name,
    item => item.Code,
    StringComparer.OrdinalIgnoreCase);
```

##### Key Points to Mention

- `Dictionary` is the normal mutable lookup.
- `ImmutableDictionary` creates safe snapshots.
- `ConcurrentDictionary` supports multi-threaded writes.
- `FrozenDictionary` is optimized for build-once/read-many scenarios.
- Do not choose thread-safe or immutable types without a reason.

<!-- question:end:collection-choices-in-csharp-advanced-q01 -->

<!-- question:start:collection-choices-in-csharp-advanced-q02 -->
<!-- question-id:collection-choices-in-csharp-advanced-q02 -->
<!-- question-level:advanced -->
#### 2. What problems can occur when using mutable objects as dictionary keys?

##### Expected Answer

A dictionary depends on key equality and hash codes. If a key object's equality-related fields change after insertion, the dictionary may no longer be able to find the item correctly. The key may be stored in a bucket based on its old hash code, but lookup uses the new hash code.

Bad example:

```csharp
public sealed class ProductKey
{
    public string Sku { get; set; } = "";

    public override bool Equals(object? obj)
    {
        return obj is ProductKey other && Sku == other.Sku;
    }

    public override int GetHashCode()
    {
        return Sku.GetHashCode();
    }
}

var key = new ProductKey { Sku = "ABC" };
var map = new Dictionary<ProductKey, string>
{
    [key] = "Product A"
};

key.Sku = "XYZ";

bool found = map.ContainsKey(key); // May fail
```

Better approach:

```csharp
public sealed record ProductKey(string Sku);
```

Use immutable key types, records, strings, integers, GUIDs, or value objects with stable equality.

##### Key Points to Mention

- Dictionary lookup depends on `Equals` and `GetHashCode`.
- Mutating key fields can break lookup.
- Prefer immutable keys.
- Records are often a good fit for value-based keys.

<!-- question:end:collection-choices-in-csharp-advanced-q02 -->

<!-- question:start:collection-choices-in-csharp-advanced-q03 -->
<!-- question-id:collection-choices-in-csharp-advanced-q03 -->
<!-- question-level:advanced -->
#### 3. Why can `List<T>.Contains` cause performance issues, and how can you fix it?

##### Expected Answer

`List<T>.Contains` performs a linear search, so each lookup is O(n). If it is used inside another loop, the total complexity can become O(n × m). For large data sets, convert the lookup list to a `HashSet<T>` so membership checks are usually O(1).

Bad example:

```csharp
List<int> allowedIds = allowedUsers.Select(user => user.Id).ToList();

List<User> result = allUsers
    .Where(user => allowedIds.Contains(user.Id))
    .ToList();
```

Better:

```csharp
HashSet<int> allowedIds = allowedUsers.Select(user => user.Id).ToHashSet();

List<User> result = allUsers
    .Where(user => allowedIds.Contains(user.Id))
    .ToList();
```

##### Key Points to Mention

- `List<T>.Contains` is O(n).
- Nested lookups can become expensive.
- `HashSet<T>` is better for repeated membership checks.
- This is common in filtering, authorization, and data matching.

<!-- question:end:collection-choices-in-csharp-advanced-q03 -->

<!-- question:start:collection-choices-in-csharp-advanced-q04 -->
<!-- question-id:collection-choices-in-csharp-advanced-q04 -->
<!-- question-level:advanced -->
#### 4. How should you expose collections from a domain entity?

##### Expected Answer

Do not expose mutable collections directly from a domain entity because callers can bypass business rules. Keep a private mutable collection internally and expose a read-only interface such as `IReadOnlyList<T>` or `IReadOnlyCollection<T>`. Provide methods that enforce invariants.

Bad example:

```csharp
public sealed class Order
{
    public List<OrderLine> Lines { get; } = [];
}
```

Better:

```csharp
public sealed class Order
{
    private readonly List<OrderLine> _lines = [];

    public IReadOnlyList<OrderLine> Lines => _lines;

    public void AddLine(string productName, int quantity)
    {
        if (quantity <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(quantity));
        }

        _lines.Add(new OrderLine(productName, quantity));
    }
}
```

##### Key Points to Mention

- Avoid public mutable collection properties in domain models.
- Use private backing collections.
- Expose read-only interfaces.
- Use methods to enforce business rules.
- Read-only does not always mean immutable.

<!-- question:end:collection-choices-in-csharp-advanced-q04 -->

<!-- question:start:collection-choices-in-csharp-advanced-q05 -->
<!-- question-id:collection-choices-in-csharp-advanced-q05 -->
<!-- question-level:advanced -->
#### 5. When would you use `Span<T>` instead of a normal collection?

##### Expected Answer

Use `Span<T>` for high-performance access to contiguous memory without copying. It is useful for slicing arrays, parsing strings, working with buffers, and reducing allocations. It is not a general replacement for `List<T>` or `Dictionary<TKey, TValue>`.

Example:

```csharp
ReadOnlySpan<char> value = "ORDER-12345";
ReadOnlySpan<char> prefix = value[..5];
ReadOnlySpan<char> id = value[6..];

Console.WriteLine(prefix.ToString());
Console.WriteLine(id.ToString());
```

`Span<T>` is stack-only and cannot be stored in fields of normal classes or used across `await` boundaries. Use `Memory<T>` when data must be stored or used with asynchronous operations.

##### Key Points to Mention

- `Span<T>` avoids copying and allocations.
- It is for contiguous memory.
- It is stack-only.
- It is useful for parsing and buffer processing.
- Use `Memory<T>` for heap storage or async-compatible scenarios.

<!-- question:end:collection-choices-in-csharp-advanced-q05 -->

<!-- question:start:collection-choices-in-csharp-advanced-q06 -->
<!-- question-id:collection-choices-in-csharp-advanced-q06 -->
<!-- question-level:advanced -->
#### 6. How do collection choices affect thread safety?

##### Expected Answer

Most standard generic collections are safe for multiple readers if no thread modifies them, but they are not safe for concurrent writes. If multiple threads modify a collection, you need synchronization, immutable snapshots, or concurrent collections.

Options include:

- Use `lock` around a normal collection for simple critical sections.
- Use `ConcurrentDictionary<TKey, TValue>`, `ConcurrentQueue<T>`, or another concurrent collection for concurrent operations.
- Use immutable collections when readers need safe snapshots.
- Build the collection before sharing it if it is read-only afterward.

Example using a lock:

```csharp
private readonly object _gate = new();
private readonly Dictionary<string, int> _counts = new();

public void Increment(string key)
{
    lock (_gate)
    {
        _counts[key] = _counts.TryGetValue(key, out int current)
            ? current + 1
            : 1;
    }
}
```

Example using a concurrent dictionary:

```csharp
private readonly ConcurrentDictionary<string, int> _counts = new();

public void Increment(string key)
{
    _counts.AddOrUpdate(key, 1, (_, current) => current + 1);
}
```

##### Key Points to Mention

- Standard collections are not safe for concurrent writes.
- Concurrent collections provide thread-safe operations.
- Immutable collections provide safe snapshots.
- Locks can still be appropriate for simple cases.
- Multi-step logic must be atomic, not just individually thread-safe.

<!-- question:end:collection-choices-in-csharp-advanced-q06 -->

<!-- question:start:collection-choices-in-csharp-advanced-q07 -->
<!-- question-id:collection-choices-in-csharp-advanced-q07 -->
<!-- question-level:advanced -->
#### 7. What is the difference between `SortedDictionary<TKey, TValue>`, `SortedList<TKey, TValue>`, and `OrderedDictionary<TKey, TValue>`?

##### Expected Answer

`SortedDictionary<TKey, TValue>` keeps keys sorted and is usually better for frequent insertions and removals because it is tree-based.

`SortedList<TKey, TValue>` also keeps keys sorted, but it is array-based. It can use less memory and supports index-based access, but insertions and removals can be expensive because items may need to shift.

`OrderedDictionary<TKey, TValue>` is different from both. It preserves or manages item order while also allowing lookup by key. It is useful when insertion order or manual ordering matters, not sorted key order.

##### Key Points to Mention

- `SortedDictionary` sorts by key and handles frequent changes better.
- `SortedList` sorts by key and can be memory-efficient for mostly-read data.
- `OrderedDictionary` is about maintained order, not sorted order.
- Choose based on whether the requirement is sorted order or insertion/custom order.

<!-- question:end:collection-choices-in-csharp-advanced-q07 -->

<!-- question:start:collection-choices-in-csharp-advanced-q08 -->
<!-- question-id:collection-choices-in-csharp-advanced-q08 -->
<!-- question-level:advanced -->
#### 8. How would you choose a collection for a high-read, low-write lookup table?

##### Expected Answer

For a high-read, low-write lookup table, first decide whether the data changes after initialization. If it changes occasionally, a normal `Dictionary<TKey, TValue>` with controlled updates may be enough. If it is built once and then read many times, `FrozenDictionary<TKey, TValue>` can be a strong choice because it is optimized for read-heavy lookup after construction. If the lookup table needs safe snapshots across updates, consider `ImmutableDictionary<TKey, TValue>`.

Example:

```csharp
private static readonly FrozenDictionary<string, int> StatusCodes = new Dictionary<string, int>
{
    ["OK"] = 200,
    ["BadRequest"] = 400,
    ["NotFound"] = 404
}.ToFrozenDictionary(StringComparer.OrdinalIgnoreCase);
```

##### Key Points to Mention

- Identify whether data changes after construction.
- Use `Dictionary` for normal mutable lookup.
- Use `FrozenDictionary` for build-once/read-many lookup.
- Use `ImmutableDictionary` for snapshot-based updates.
- Avoid overengineering small lookup tables.

<!-- question:end:collection-choices-in-csharp-advanced-q08 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
