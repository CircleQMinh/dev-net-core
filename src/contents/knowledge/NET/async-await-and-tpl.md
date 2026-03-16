---
id: async-await-and-tpl
topic: Async/Await and Task Parallel Library (TPL)
category: .NET
---

# Async and Await in C#

## What is the Purpose of async and await?

- `async` marks a method as asynchronous.
- `await` pauses execution until the awaited `Task` completes **without blocking the thread**.

A thread is the execution unit that runs code.  
`await` suspends the method and frees the thread to do other work instead of blocking it while waiting for an asynchronous operation to complete.

```csharp
public async Task<string> GetDataAsync()
{
    await Task.Delay(1000); // Simulate delay
    return "Data";
}
````

---

## What Does the Compiler Do?

When using `async/await`, the compiler:

* Rewrites the method into a **state machine**
* Preserves readability while enabling non-blocking execution

---

## Async Method Return Types

Common return types:

* `Task` → No return value
* `Task<T>` → Returns a value
* `void` → Only for event handlers

---

## Can an Async Method Return void?

Yes, but only for event handlers.

```csharp
// Recommended
public async Task LoadDataAsync() { }

// Only for events
private async void OnClick(object sender, EventArgs e) { }
```

Using `async void` outside events makes exception handling and awaiting impossible.

---

## What If You Forget await?

* The method runs synchronously until the first `await`.
* If no `await` exists, it runs synchronously.
* The compiler produces a warning.

---

## Exception Handling in Async Code

Wrap the `await`, not just the method call.

```csharp
try
{
    await SomeAsyncMethod();
}
catch (Exception ex)
{
    Console.WriteLine($"Caught: {ex.Message}");
}
```

---

## What is ConfigureAwait(false)?

* Prevents capturing the original synchronization context.
* Improves performance in library code or non-UI apps.

```csharp
await Task.Delay(1000).ConfigureAwait(false);
```

Use in backend or library code. Avoid blindly using it in UI apps.

---

# Task Parallel Library (TPL)

## What is TPL?

TPL (Task Parallel Library):

* Introduced in .NET 4
* Provides the Task-based Asynchronous Pattern (TAP)
* Enables concurrent and parallel programming

---

## Task.Run() vs Task.Factory.StartNew()

| Feature    | Task.Run()          | Task.Factory.StartNew()     |
| ---------- | ------------------- | --------------------------- |
| Simplicity | Simple              | More flexible               |
| Use Case   | Background CPU work | Advanced scheduling options |
| Returns    | Task                | Task                        |

Use `Task.Run()` in most scenarios.

---

## Running Multiple Tasks in Parallel

```csharp
var task1 = Task.Run(() => DoWork1());
var task2 = Task.Run(() => DoWork2());

await Task.WhenAll(task1, task2);
```

---

## Task.WhenAll vs Task.WhenAny

* `WhenAll` → Waits for all tasks
* `WhenAny` → Waits for the first task

```csharp
await Task.WhenAll(task1, task2);
await Task.WhenAny(task1, task2);
```

---

## Thread vs Task vs async/await

| Feature     | Thread        | Task              | async/await            |
| ----------- | ------------- | ----------------- | ---------------------- |
| Level       | Low-level     | Mid-level (TPL)   | High-level (TAP)       |
| Performance | High overhead | Uses thread pool  | Most efficient for I/O |
| Ease of Use | Complex       | Simpler           | Easiest                |
| Best For    | Full control  | Parallel CPU work | I/O-bound operations   |

---

## Cancelling a Task

Use `CancellationToken`.

```csharp
var cts = new CancellationTokenSource();
await Task.Run(() => DoWork(cts.Token), cts.Token);
```

---

## Full Cancellation Example

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        using CancellationTokenSource cts = new CancellationTokenSource();

        Task workTask = DoWorkAsync(cts.Token);

        Console.WriteLine("Press any key to cancel...\n");
        Console.ReadKey();
        cts.Cancel();

        try
        {
            await workTask;
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine("\nTask was cancelled!");
        }
    }

    static async Task DoWorkAsync(CancellationToken token)
    {
        Console.WriteLine("Task started.\n");

        for (int i = 1; i <= 10; i++)
        {
            token.ThrowIfCancellationRequested();

            Console.WriteLine($"Working... {i}");
            await Task.Delay(500, token);
        }

        Console.WriteLine("\nTask completed successfully!");
    }
}
```

---

## Timeout Cancellation

```csharp
var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
```

---

## Awaiting the Same Task Multiple Times

* A `Task` does not run again.
* It can be awaited multiple times if already running or completed.

---

## Can You Use await in a Constructor?

No. Constructors cannot be async.

Use an async factory method instead:

```csharp
public static async Task<MyClass> CreateAsync()
{
    var instance = new MyClass();
    await instance.LoadAsync();
    return instance;
}
```

---

# Practical Example

```csharp
public async Task LoadAndProcessAsync()
{
    var dataTask = GetDataAsync();
    var logTask = LogActivityAsync();

    await Task.WhenAll(dataTask, logTask);

    Console.WriteLine("Both tasks completed.");
}
```

---

# When to Use What

## Thread

* Full low-level control
* Manual priority/interruption
* Not ideal for many short-lived tasks

## Task

* Background CPU-bound work
* Parallel execution
* Uses thread pool

## async/await

* I/O-bound operations (API calls, DB calls)
* Keep UI responsive
* Clean error handling

---

## Combining Task with async

```csharp
await Task.Run(() => LongRunningWork());
```

This runs CPU-bound work on a background thread while keeping the method asynchronous.

---

# Summary

| Concept         | Use Case                 | Keyword/API           |
| --------------- | ------------------------ | --------------------- |
| Async method    | Asynchronous programming | async, await          |
| Parallel tasks  | Concurrency              | Task.Run, WhenAll     |
| Cancellation    | Stop long-running tasks  | CancellationToken     |
| Non-blocking UI | Keep UI responsive       | await                 |
| Performance     | Improve throughput       | ConfigureAwait(false) |

---

## Notes

* `async/await` does not create new threads by default.
* `Task.Run()` should not be used for I/O-bound operations.
* `ConfigureAwait(false)` is recommended in libraries, but be careful in UI applications.
* Cancellation requires cooperative implementation using `CancellationToken`.

```

