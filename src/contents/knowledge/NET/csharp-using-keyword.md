---
id: csharp-using-keyword
topic: C# using Keyword
category: .NET
---

## Overview

In C#, the keyword `using` has **multiple distinct purposes**, depending on context.

Understanding these clearly is important when working extensively with .NET, especially in scenarios involving resource management, async workflows, and large-scale applications.

---

##  `using` for Namespace Import

### Purpose

Brings a namespace into scope so you don’t need fully qualified names.

Without `using`:

```csharp
System.Console.WriteLine("Hello");
````

With `using`:

```csharp
using System;

Console.WriteLine("Hello");
```

### What It Does

* Tells the compiler where to look for types
* Has **zero runtime cost**
* Purely a compile-time feature
* Improves readability and reduces verbosity

---

### Aliasing

You can alias a namespace or type:

```csharp
using MyList = System.Collections.Generic.List<string>;
```

Or:

```csharp
using IO = System.IO;
```

This is useful for:

* Resolving naming conflicts
* Improving clarity in complex files
* Shortening long type names

---

##  `using` for Resource Disposal

### Purpose

Ensures objects that implement `IDisposable` are cleaned up properly.

Classic example:

```csharp
using (var stream = new FileStream("file.txt", FileMode.Open))
{
    // Use stream
}
```

### What the Compiler Generates

```csharp
var stream = new FileStream("file.txt", FileMode.Open);
try
{
    // Use stream
}
finally
{
    if (stream != null)
        stream.Dispose();
}
```

This guarantees `Dispose()` is called even if an exception occurs.

---

### Why This Matters

Commonly used for:

* `FileStream`
* `SqlConnection`
* `DbContext`
* `HttpResponseMessage`
* `Stream`
* Any unmanaged resource

It prevents:

* Memory leaks
* File locks
* Connection leaks
* Resource exhaustion

Note: `HttpClient` should typically be reused rather than disposed per request (for example via `IHttpClientFactory`).

---

##  Modern `using` Declaration (C# 8+)

Introduced in C# 8, this is a cleaner syntax:

```csharp
using var stream = new FileStream("file.txt", FileMode.Open);

// Use stream
```

The object is automatically disposed at the end of the enclosing scope.

### Why Prefer This

* Less indentation
* Cleaner code
* Same disposal guarantees
* Recommended in modern .NET (6/7/8+)

---

## `await using` (Async Disposal)

Used for objects implementing `IAsyncDisposable`.

```csharp
await using var connection = new SomeAsyncResource();
```

This ensures `DisposeAsync()` is called instead of `Dispose()`.

Common scenarios:

* Async streams
* EF Core `DbContext` (when used asynchronously and provider supports async disposal)
* Azure SDK clients (depending on implementation)

---

## Summary Table

| Usage               | Purpose               | Runtime Impact |
| ------------------- | --------------------- | -------------- |
| `using System;`     | Import namespace      | None           |
| `using (...) {}`    | Auto dispose resource | Yes            |
| `using var x = ...` | Modern auto dispose   | Yes            |
| `await using`       | Async dispose         | Yes            |

---

## Important Clarification

These two are completely unrelated features:

```csharp
using System;
```

vs

```csharp
using (var stream = ...)
```

They share the same keyword but serve entirely different purposes.

---

## Practical Advice

When working with:

* Azure Blob Storage
* SQL connections
* Service Bus clients
* Streams
* Manual `HttpResponseMessage`
* File operations

You should:

* Wrap disposable resources with `using` or `using var`
* Prefer `await using` when dealing with `IAsyncDisposable`
* Avoid disposing shared or long-lived services (e.g., `HttpClient` from DI)

Proper resource management is critical in high-throughput backend systems.



---

## Notes

- Clarified that `HttpClient` should not always be wrapped in `using` when managed via dependency injection or `IHttpClientFactory`.
- Clarified that `DbContext` supports async disposal depending on provider and usage.
- Improved explanation to distinguish `IDisposable` vs `IAsyncDisposable`.
```
