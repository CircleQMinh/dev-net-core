---
id: linq-core-methods
topic: LINQ Core Methods and Concepts
category: .NET
---

# Select() vs SelectMany()

## Quick Summary

| Feature    | Select()                          | SelectMany()                              |
|------------|-----------------------------------|--------------------------------------------|
| Projection | Transforms each element           | Flattens and transforms each element       |
| Output     | Sequence of sequences             | Flattened single sequence                  |
| Use Case   | 1-to-1 mapping                    | 1-to-many mapping + flattening             |

---

## Example: Basic Difference

```csharp
var data = new List<string>
{
    "apple banana",
    "orange grape"
};

// Using Select()
var result = data.Select(str => str.Split(' '));
// Type: IEnumerable<string[]>

// Conceptual result:
[ ["apple", "banana"], ["orange", "grape"] ]

// Using SelectMany()
var result2 = data.SelectMany(str => str.Split(' '));
// Type: IEnumerable<string>

// Conceptual result:
[ "apple", "banana", "orange", "grape" ]
````

---

## Real-World Example: Users and Orders

```csharp
class User
{
    public string Name { get; set; }
    public List<string> Orders { get; set; }
}

var users = new List<User>
{
    new User { Name = "Alice", Orders = new List<string> { "Pizza", "Salad" } },
    new User { Name = "Bob", Orders = new List<string> { "Burger" } }
};

// Select()
var ordersPerUser = users.Select(u => u.Orders);
// Type: IEnumerable<List<string>>

// Conceptual result:
[ ["Pizza", "Salad"], ["Burger"] ]

// SelectMany()
var allOrders = users.SelectMany(u => u.Orders);
// Type: IEnumerable<string>

// Conceptual result:
[ "Pizza", "Salad", "Burger" ]
```

---

## Tip

* Use `Select()` when projecting each item individually.
* Use `SelectMany()` when your projection returns collections and you want to flatten them.

---

# Deferred Execution in LINQ

* LINQ queries are not executed until iterated.
* Execution occurs during:

  * `foreach`
  * `ToList()`
  * `ToArray()`
  * `First()`, etc.

Benefits:

* Performance optimization
* Flexible query composition

---

# First vs Single Variants

| Method            | Throws if Not Found | Throws if Multiple | Returns Default |
| ----------------- | ------------------- | ------------------ | --------------- |
| First()           | Yes                 | No                 | No              |
| FirstOrDefault()  | No                  | No                 | Yes             |
| Single()          | Yes                 | Yes                | No              |
| SingleOrDefault() | No                  | Yes                | Yes             |

---

# IEnumerable vs IQueryable

| Feature       | IEnumerable    | IQueryable                       |
| ------------- | -------------- | -------------------------------- |
| Executes in   | Memory         | Database / Remote source         |
| Deferred Exec | Yes            | Yes                              |
| Suitable for  | In-memory data | Remote providers (e.g., EF Core) |

`IQueryable` queries are translated by the provider (e.g., into SQL).

---

# Zip()

## What is Zip()?

`Zip()` merges two sequences element-by-element using a projection function.

---

## Simple Example

```csharp
var numbers = new[] { 1, 2, 3 };
var words = new[] { "one", "two", "three" };

var zipped = numbers.Zip(words, (n, w) => $"{n} = {w}");

foreach (var item in zipped)
{
    Console.WriteLine(item);
}
```

Output:

```
1 = one
2 = two
3 = three
```

---

## Uneven Sequences Behavior

```csharp
var a = new[] { 1, 2, 3, 4 };
var b = new[] { "A", "B" };

var result = a.Zip(b, (x, y) => $"{x}-{y}");

// Conceptual result:
[ "1-A", "2-B" ]
```

Stops at the shortest sequence.

---

## Real-World Example

```csharp
var names = new[] { "Alice", "Bob", "Charlie" };
var scores = new[] { 85, 90, 95 };

var report = names.Zip(scores, (name, score) => $"{name} scored {score}");

foreach (var line in report)
{
    Console.WriteLine(line);
}
```

---

## When to Use Zip()

* Combine matching elements from two lists
* Synchronize sequences by position
* Cleaner alternative to indexed `for` loops

---

# Take and Skip Variants

| Method      | Purpose                      |
| ----------- | ---------------------------- |
| Take(n)     | Take first n elements        |
| Skip(n)     | Skip first n elements        |
| TakeWhile() | Take while condition is true |
| SkipWhile() | Skip while condition is true |

---

# Notes

1. Array-style examples (e.g., `[ "a", "b" ]`) are conceptual. In C#, you must enumerate or call `ToList()` to materialize.
2. `IQueryable` execution depends on the provider (e.g., EF Core translates to SQL).
3. `SingleOrDefault()` throws if more than one element exists — commonly misunderstood.
4. Deferred execution stops once the query is materialized (e.g., after `ToList()`).

```

