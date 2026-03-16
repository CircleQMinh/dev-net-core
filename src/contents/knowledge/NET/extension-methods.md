---
id: extension-methods
topic: Extension Methods in C#
category: .NET
---

Extension methods are a powerful C# feature that allow you to add functionality to existing types without modifying their source code.

---

# Fundamentals

## What is an Extension Method?

An extension method allows you to “add” methods to existing types without:

- Modifying the original type
- Using inheritance

### Requirements

An extension method must:

- Be a **static method**
- Be inside a **static class**
- Use the `this` keyword on the first parameter

```csharp
public static class StringExtensions
{
    public static bool IsCapitalized(this string input)
    {
        return !string.IsNullOrEmpty(input) && char.IsUpper(input[0]);
    }
}
````

### Usage

```csharp
string name = "John";
bool result = name.IsCapitalized();
```

---

## How Do Extension Methods Work Behind the Scenes?

Extension methods are just static methods.

The compiler converts:

```csharp
name.IsCapitalized();
```

Into:

```csharp
StringExtensions.IsCapitalized(name);
```

This transformation happens at compile time.

---

## Can You Override Existing Methods?

No.

* Extension methods cannot override instance methods.
* If a conflict exists, the instance method always takes precedence.

---

## Common Use Cases

* LINQ (`Where`, `Select`, `OrderBy`, etc.)
* Fluent APIs
* Utility helpers (string, DateTime, collections)

---

# Intermediate Concepts

## Can You Extend Sealed Classes or Interfaces?

Yes.

One major benefit of extension methods is extending:

* Sealed classes (e.g., `string`, `DateTime`)
* Interfaces

```csharp
public static bool IsFuture(this DateTime date)
{
    return date > DateTime.Now;
}
```

---

## Extension Method for an Interface

```csharp
public interface IAnimal
{
    string Speak();
}

public static class AnimalExtensions
{
    public static void Print(this IAnimal animal)
    {
        Console.WriteLine(animal.Speak());
    }
}
```

---

## Optional Parameters and Overloads

Extension methods behave like normal static methods.

They support:

* Overloads
* Optional parameters

```csharp
public static string Truncate(this string str, int length = 10)
{
    return str.Length <= length ? str : str.Substring(0, length);
}
```

---

## Limitations of Extension Methods

* Cannot access private or protected members
* Cannot override instance methods
* Cannot be virtual or abstract
* May cause confusion if overused
* Only resolved at compile time

---

## What If Multiple Extension Methods Match?

The compiler:

* Selects the most specific match
* Considers namespaces and method signatures

If ambiguous → Compile-time error.

---

# Design Considerations

## When Should You Use Extension Methods?

Use extension methods when:

* You cannot modify the original type (third-party or sealed)
* You want fluent-style chaining
* You want logic close to the types it operates on

Avoid when:

* It causes confusion about method ownership
* You scatter unrelated helpers across namespaces

---

## Generic Extension Methods

Extension methods can be generic and work with constrained types.

```csharp
public static class EnumerableExtensions
{
    public static bool HasItems<T>(this IEnumerable<T> source)
    {
        return source != null && source.Any();
    }
}
```

---

## How Are Extension Methods Discovered?

* Compiled as static methods
* No special runtime behavior
* Must be in scope via `using` statement
* Resolved entirely at compile time

---

# Practical Exercise

## Word Count Extension

```csharp
public static class StringExtensions
{
    public static int WordCount(this string input)
    {
        return string.IsNullOrWhiteSpace(input)
            ? 0
            : input.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
    }
}
```

Usage:

```csharp
string sentence = "Extension methods are powerful";
int count = sentence.WordCount();
```

---

# Summary

| Concept          | Key Point                                          |
| ---------------- | -------------------------------------------------- |
| Extension Method | Adds functionality without modifying original type |
| Implementation   | Static method + static class + `this` keyword      |
| Resolution       | Compile-time static method call                    |
| Limitations      | Cannot override, cannot access private members     |
| Best Use         | Fluent APIs, utilities, LINQ-style chaining        |

---

## Notes

* Extension methods do not truly add methods to a type; they are syntactic sugar over static methods.
* Instance methods always take precedence over extension methods.
* Overuse can reduce readability if not organized properly.

```

