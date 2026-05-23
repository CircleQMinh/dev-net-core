---
id: cpu-bound-vs-io-bound-work-and-task-in-csharp
topic: Async programming, tasks, cancellation, and concurrency
subtopic: CPU-bound vs I/O-bound Work and Task 
category: .NET
---

## Overview

CPU-bound vs I/O-bound work is one of the most important practical topics in C# asynchronous and parallel programming. It explains whether a piece of work is limited mainly by processor time or by waiting for an external resource such as a database, web service, file system, message queue, or network connection.

This distinction matters because C# gives developers several tools that look similar but solve different problems:

- `async` and `await` are mainly about non-blocking asynchronous control flow.
- `Task` and `Task<T>` represent asynchronous operations or units of work.
- `Task.Run` queues CPU work to the ThreadPool.
- `Task.WhenAll` coordinates multiple asynchronous operations.
- `Parallel.ForEach`, `Parallel.ForEachAsync`, PLINQ, Channels, and background services help with parallelism, concurrency, or workload coordination.

A common interview mistake is saying "`async` means multithreading" or "`Task` means a new thread". That is not always true. An I/O-bound operation can be asynchronous without occupying a thread while it waits. A CPU-bound operation needs CPU execution time and normally requires a thread while it runs.

This topic is important for interviews because it connects language features, runtime behavior, application scalability, API design, ASP.NET Core performance, UI responsiveness, ThreadPool usage, cancellation, exception handling, and production troubleshooting. Interviewers often use this topic to test whether a developer can choose the correct approach instead of blindly adding `async`, `Task.Run`, or `Task.WhenAll`.

## Core Concepts

### CPU-bound work

CPU-bound work is work where the main cost is computation. The program is actively using CPU cycles to calculate, transform, parse, compress, encrypt, sort, search, render, or process data.

Common CPU-bound examples include:

- Image or video processing
- Large in-memory calculations
- Complex financial calculations
- Compression and decompression
- Encryption, hashing, and cryptographic operations
- Large object graph transformations
- CPU-heavy report generation
- Parsing very large files after they are already loaded into memory
- Machine learning inference on CPU

CPU-bound work usually needs a thread while it runs. If the work is expensive and runs on a UI thread, the UI can freeze. If it runs inside a high-traffic ASP.NET Core request path, it can reduce request throughput because server ThreadPool threads are occupied doing computation.

Example CPU-bound method:

```csharp
public decimal CalculatePortfolioRisk(IReadOnlyList<Position> positions)
{
    decimal totalRisk = 0;

    foreach (var position in positions)
    {
        // CPU-heavy calculation example.
        totalRisk += position.Exposure * position.Volatility * position.Weight;
    }

    return totalRisk;
}
```

In a desktop UI application, it can be reasonable to offload CPU-heavy work to the ThreadPool so the UI thread remains responsive:

```csharp
private async void CalculateButton_Click(object sender, EventArgs e)
{
    CalculateButton.Enabled = false;

    try
    {
        decimal result = await Task.Run(() => CalculatePortfolioRisk(_positions));
        ResultLabel.Text = result.ToString("N2");
    }
    finally
    {
        CalculateButton.Enabled = true;
    }
}
```

The purpose of `Task.Run` here is not to make the calculation faster by itself. The purpose is to move CPU work away from the UI thread.

### I/O-bound work

I/O-bound work is work where the main cost is waiting for an external resource rather than executing CPU instructions.

Common I/O-bound examples include:

- Calling an HTTP API
- Querying a database
- Reading or writing files
- Uploading or downloading blobs
- Waiting for a message queue
- Sending email
- Calling Redis, Azure Storage, Cosmos DB, or another remote service

For I/O-bound work, prefer real asynchronous APIs and `await` them directly. Do not wrap them in `Task.Run`.

Good I/O-bound example:

```csharp
public async Task<string> GetCustomerJsonAsync(
    HttpClient httpClient,
    int customerId,
    CancellationToken cancellationToken)
{
    string url = $"/api/customers/{customerId}";

    return await httpClient.GetStringAsync(url, cancellationToken);
}
```

Bad I/O-bound example:

```csharp
public async Task<string> GetCustomerJsonAsync(
    HttpClient httpClient,
    int customerId,
    CancellationToken cancellationToken)
{
    // Avoid this. GetStringAsync is already asynchronous.
    return await Task.Run(
        () => httpClient.GetStringAsync($"/api/customers/{customerId}", cancellationToken),
        cancellationToken);
}
```

The bad example adds unnecessary ThreadPool scheduling and makes the code harder to reason about.

### What `Task` represents

`Task` represents an operation that may complete now or later. `Task<T>` represents an operation that eventually produces a result of type `T`.

A `Task` is not the same thing as a thread.

A task can represent:

- A CPU-bound operation running on a ThreadPool thread
- An I/O-bound operation waiting for an operating system, network, file, or database completion
- A delayed operation such as `Task.Delay`
- A completed operation such as `Task.CompletedTask`
- A faulted operation that stores an exception
- A canceled operation

Example:

```csharp
Task delayTask = Task.Delay(1000);
Task<string> httpTask = httpClient.GetStringAsync("/api/products");
Task<int> cpuTask = Task.Run(() => ExpensiveCalculation());
```

All three are tasks, but they do not mean the same thing internally.

`Task.Delay` does not consume a thread for one second. An async HTTP request does not normally consume a thread while waiting for the response. `Task.Run` queues work that needs a ThreadPool thread to execute the delegate.

### What `await` does

`await` asynchronously waits for a task to complete. It does not block the current thread like `Wait()` or `.Result`.

When execution reaches an incomplete awaited task:

1. The current async method is suspended.
2. Control returns to the caller.
3. The current thread is free to do other work.
4. When the awaited operation completes, the rest of the method continues.

Example:

```csharp
public async Task<OrderDto> GetOrderAsync(int orderId, CancellationToken cancellationToken)
{
    Order order = await _orderRepository.GetByIdAsync(orderId, cancellationToken);

    return new OrderDto
    {
        Id = order.Id,
        Total = order.Total
    };
}
```

The method is easier to read than callback-based code, but it still avoids blocking the caller while the database operation is in progress.

### Blocking vs non-blocking waits

Blocking means the current thread is stopped while waiting for a result.

Avoid this in asynchronous code:

```csharp
Order order = _orderRepository.GetByIdAsync(orderId).Result;
```

Also avoid this:

```csharp
_orderRepository.GetByIdAsync(orderId).Wait();
```

Prefer this:

```csharp
Order order = await _orderRepository.GetByIdAsync(orderId, cancellationToken);
```

Blocking on async work can cause:

- Deadlocks in UI or legacy synchronization-context environments
- ThreadPool starvation in server applications
- Worse scalability
- More complicated exception behavior
- Poor responsiveness

In interviews, a strong answer should mention that async should usually be used all the way through the call stack.

### ThreadPool and `Task.Run`

The .NET ThreadPool manages a pool of reusable background threads. It is used by many runtime and framework features, including the Task Parallel Library.

`Task.Run` queues a delegate to the ThreadPool and returns a `Task` that represents that work.

Example:

```csharp
public Task<byte[]> CompressAsync(byte[] input, CancellationToken cancellationToken)
{
    return Task.Run(() =>
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Compress(input);
    }, cancellationToken);
}
```

This pattern can be useful when:

- The work is CPU-bound.
- The caller must remain responsive.
- You are in a UI app and need to avoid blocking the UI thread.
- You intentionally want to offload computation.

This pattern is often not appropriate when:

- The work is already asynchronous I/O.
- You are in ASP.NET Core and immediately await `Task.Run`.
- You are trying to hide a synchronous API behind an async method.
- The work is long-running and should be handled by a background service or external worker.
- The work blocks for a long time and can exhaust ThreadPool threads.

### Why `Task.Run` is different in UI apps and ASP.NET Core

In a UI app, there is usually a special UI thread. If CPU-bound work runs on that thread, the interface freezes. `Task.Run` can move that CPU-bound work to a ThreadPool thread.

In ASP.NET Core, request code already runs on ThreadPool threads. Calling `Task.Run` inside a controller action and immediately awaiting it usually just moves work from one ThreadPool thread to another ThreadPool thread, adding scheduling overhead without improving scalability.

Poor ASP.NET Core example:

```csharp
[HttpGet("{id:int}")]
public async Task<IActionResult> GetReport(int id, CancellationToken cancellationToken)
{
    // Usually a bad idea in ASP.NET Core request paths.
    Report report = await Task.Run(() => _reportService.GenerateReport(id), cancellationToken);

    return Ok(report);
}
```

Better options depend on the scenario:

```csharp
[HttpGet("{id:int}")]
public async Task<IActionResult> GetReport(int id, CancellationToken cancellationToken)
{
    // Good if the service uses real async I/O internally.
    Report report = await _reportService.GetReportAsync(id, cancellationToken);

    return Ok(report);
}
```

For truly long-running or CPU-heavy work, consider moving the job outside the request-response path:

```csharp
[HttpPost("{id:int}/generate")]
public async Task<IActionResult> QueueReportGeneration(int id, CancellationToken cancellationToken)
{
    await _queue.EnqueueAsync(new GenerateReportCommand(id), cancellationToken);

    return Accepted();
}
```

The queued job can be processed by a hosted service, worker service, Azure Function, container job, or message-driven background processor.

### Concurrency vs parallelism

Concurrency means multiple operations are in progress during the same time period. They may not all be executing CPU instructions at the same instant.

Parallelism means multiple operations are executing at the same time, usually on multiple CPU cores.

I/O-bound async code is often concurrent:

```csharp
Task<CustomerDto> customerTask = GetCustomerAsync(customerId, cancellationToken);
Task<IReadOnlyList<OrderDto>> ordersTask = GetOrdersAsync(customerId, cancellationToken);
Task<LoyaltyDto> loyaltyTask = GetLoyaltyAsync(customerId, cancellationToken);

await Task.WhenAll(customerTask, ordersTask, loyaltyTask);

CustomerProfileDto profile = new()
{
    Customer = await customerTask,
    Orders = await ordersTask,
    Loyalty = await loyaltyTask
};
```

CPU-bound work can be parallelized when the work can be safely split across cores:

```csharp
Parallel.ForEach(items, item =>
{
    ProcessCpuHeavyItem(item);
});
```

Parallelism is not free. It can add overhead, increase contention, increase memory pressure, and make debugging harder. Always measure performance.

### `Task.WhenAll` for I/O-bound concurrency

`Task.WhenAll` waits asynchronously for multiple tasks to complete. It is commonly used when independent I/O-bound operations can run concurrently.

Example:

```csharp
public async Task<IReadOnlyList<ProductDto>> GetProductsAsync(
    IReadOnlyList<int> productIds,
    CancellationToken cancellationToken)
{
    Task<ProductDto>[] tasks = productIds
        .Select(id => GetProductAsync(id, cancellationToken))
        .ToArray();

    ProductDto[] products = await Task.WhenAll(tasks);

    return products;
}
```

The `ToArray()` is important because LINQ is lazy. It creates the tasks immediately and avoids accidentally re-enumerating the sequence.

However, `Task.WhenAll` can be dangerous if used with a very large input list:

```csharp
// Risky: could start thousands of HTTP calls at once.
ProductDto[] products = await Task.WhenAll(
    productIds.Select(id => GetProductAsync(id, cancellationToken)));
```

Unbounded concurrency can overload:

- Your application
- The remote API
- The database
- The network
- Connection pools
- Rate limits
- Memory

### Bounded concurrency with `SemaphoreSlim`

For many I/O-bound workloads, you want concurrency but with a limit.

Example:

```csharp
public async Task<IReadOnlyList<ProductDto>> GetProductsWithLimitAsync(
    IReadOnlyList<int> productIds,
    int maxConcurrency,
    CancellationToken cancellationToken)
{
    using SemaphoreSlim semaphore = new(maxConcurrency);

    Task<ProductDto>[] tasks = productIds.Select(async id =>
    {
        await semaphore.WaitAsync(cancellationToken);

        try
        {
            return await GetProductAsync(id, cancellationToken);
        }
        finally
        {
            semaphore.Release();
        }
    }).ToArray();

    return await Task.WhenAll(tasks);
}
```

This pattern is useful when calling external services, processing many files, or running multiple database queries where a sensible limit prevents resource exhaustion.

### `Parallel.ForEach` and CPU-bound work

`Parallel.ForEach` is designed for parallel CPU work over collections.

Example:

```csharp
Parallel.ForEach(images, image =>
{
    ResizeImage(image);
});
```

This can be effective when:

- Each item is independent.
- Work is CPU-heavy.
- Work is not mostly waiting on I/O.
- Shared state is avoided or protected.
- The number of items is large enough to justify overhead.

Avoid writing unsafe shared-state code:

```csharp
int total = 0;

Parallel.ForEach(numbers, number =>
{
    // Not thread-safe.
    total += Calculate(number);
});
```

Prefer thread-safe aggregation patterns:

```csharp
int total = numbers
    .AsParallel()
    .Sum(number => Calculate(number));
```

Or use explicit synchronization when necessary, while understanding that locking can reduce parallel performance.

### `Parallel.ForEachAsync`

`Parallel.ForEachAsync` supports asynchronous delegates and can limit concurrency through `ParallelOptions`.

Example:

```csharp
ParallelOptions options = new()
{
    MaxDegreeOfParallelism = 8,
    CancellationToken = cancellationToken
};

await Parallel.ForEachAsync(productIds, options, async (productId, token) =>
{
    ProductDto product = await GetProductAsync(productId, token);
    await SaveProductSnapshotAsync(product, token);
});
```

This is useful when you want a simple bounded-concurrency loop with async operations.

However, choosing `MaxDegreeOfParallelism` requires thought:

- For CPU-bound work, a value near `Environment.ProcessorCount` is often a reasonable starting point.
- For I/O-bound work, the best value may be higher or lower depending on remote service limits, connection pools, latency, and rate limits.
- For database work, too much parallelism can overload the database or exhaust connection pools.
- For external APIs, too much parallelism can cause throttling.

Always measure and adjust based on the real workload.

### `Task.Run` vs `Task.WhenAll` vs `Parallel.ForEach`

These tools solve different problems.

| Tool | Best for | Uses threads while waiting? | Common mistake |
|---|---|---:|---|
| `await` async I/O | One I/O-bound operation | Usually no | Blocking with `.Result` |
| `Task.WhenAll` | Multiple independent async operations | Usually no for true async I/O waits | Starting too many operations at once |
| `Task.Run` | Offloading CPU-bound work | Yes | Wrapping already-async I/O |
| `Parallel.ForEach` | Parallel CPU-bound loop | Yes | Using it for I/O-bound work |
| `Parallel.ForEachAsync` | Bounded async loop | Depends on the delegate | Choosing poor concurrency limits |

### Async over sync

"Async over sync" means wrapping synchronous blocking code in an async-looking API, often using `Task.Run`.

Example:

```csharp
public Task<Customer> GetCustomerAsync(int id)
{
    return Task.Run(() => GetCustomerFromDatabaseSynchronously(id));
}
```

This does not create true asynchronous I/O. It still blocks a ThreadPool thread while the synchronous database call waits.

A better solution is to use a real async API:

```csharp
public async Task<Customer?> GetCustomerAsync(int id, CancellationToken cancellationToken)
{
    return await _dbContext.Customers
        .AsNoTracking()
        .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
}
```

If no async API exists, consider:

- Keeping the method synchronous
- Isolating the blocking dependency
- Moving the work to a background worker
- Replacing the dependency with an async-capable API
- Limiting concurrency carefully

### Cancellation and timeouts

Long-running work should usually support cancellation.

For I/O-bound work:

```csharp
public async Task<string> DownloadAsync(
    HttpClient httpClient,
    string url,
    CancellationToken cancellationToken)
{
    return await httpClient.GetStringAsync(url, cancellationToken);
}
```

For CPU-bound work, cancellation must be checked cooperatively:

```csharp
public int CalculateScore(
    IReadOnlyList<Item> items,
    CancellationToken cancellationToken)
{
    int score = 0;

    foreach (Item item in items)
    {
        cancellationToken.ThrowIfCancellationRequested();
        score += ExpensiveScoreCalculation(item);
    }

    return score;
}
```

Passing a cancellation token to `Task.Run` can cancel the task before it starts. Once the delegate is running, your code must check the token if you want the operation to stop early.

### Exception behavior

Exceptions in tasks are stored in the task and rethrown when awaited.

Example:

```csharp
try
{
    await ProcessOrderAsync(orderId, cancellationToken);
}
catch (InvalidOperationException ex)
{
    _logger.LogError(ex, "Order processing failed.");
}
```

For `Task.WhenAll`, if one or more tasks fail, the combined task fails. A robust implementation should consider whether to fail fast, collect all errors, retry individual operations, or allow partial success.

Example with partial success:

```csharp
public async Task<IReadOnlyList<Result<ProductDto>>> GetProductsSafelyAsync(
    IReadOnlyList<int> productIds,
    CancellationToken cancellationToken)
{
    Task<Result<ProductDto>>[] tasks = productIds.Select(async id =>
    {
        try
        {
            ProductDto product = await GetProductAsync(id, cancellationToken);
            return Result<ProductDto>.Success(product);
        }
        catch (Exception ex)
        {
            return Result<ProductDto>.Failure(id, ex);
        }
    }).ToArray();

    return await Task.WhenAll(tasks);
}
```

This approach avoids one failed item hiding all successful items.

### Fire-and-forget tasks

Fire-and-forget means starting a task without awaiting it.

Example:

```csharp
_ = SendEmailAsync(orderId);
```

This is risky because:

- Exceptions may be lost or unobserved.
- The operation may outlive the request scope.
- Scoped services such as `DbContext` may be disposed.
- The application may shut down before work completes.
- There may be no retry, logging, cancellation, or monitoring.

In ASP.NET Core, use a background queue, hosted service, message queue, or external worker for reliable background processing.

Better design:

```csharp
public async Task<IActionResult> SubmitOrder(
    SubmitOrderRequest request,
    CancellationToken cancellationToken)
{
    int orderId = await _orderService.SubmitAsync(request, cancellationToken);

    await _backgroundQueue.EnqueueAsync(
        new SendOrderConfirmationEmail(orderId),
        cancellationToken);

    return Accepted(new { orderId });
}
```

### ThreadPool starvation

ThreadPool starvation happens when ThreadPool threads are blocked or busy for too long, leaving too few threads available to process new work.

Common causes include:

- Blocking on async code with `.Result` or `.Wait()`
- Running too many blocking operations on the ThreadPool
- Excessive `Task.Run` usage in server applications
- Sync-over-async I/O
- Long-running CPU work inside HTTP request handling
- Unbounded concurrency
- Lock contention in hot paths

Symptoms can include:

- Slow request processing
- High latency under load
- Requests timing out even when CPU is not fully used
- Many ThreadPool threads being added
- Poor scalability after traffic increases

A strong production answer should mention measuring with profiling and diagnostics tools instead of guessing.

### Choosing the right approach

Use this decision guide:

| Situation | Recommended approach |
|---|---|
| Calling a database with async API | `await db.QueryAsync(...)` or EF Core async methods |
| Calling HTTP API | `await httpClient.GetAsync(...)` |
| Reading/writing file with async API | `await stream.ReadAsync(...)` / `WriteAsync(...)` |
| Running CPU-heavy work in UI app | `await Task.Run(...)` |
| Running CPU-heavy work in ASP.NET Core request | Avoid if possible; consider background processing |
| Running many independent I/O calls | `Task.WhenAll` with bounded concurrency if needed |
| Running CPU-heavy loop | `Parallel.ForEach`, PLINQ, or partitioned `Task.Run` |
| Processing many async items with a limit | `Parallel.ForEachAsync`, `SemaphoreSlim`, Channel, or TPL Dataflow |
| Long-running background job | Hosted service, worker service, queue, Azure Function, container job |
| Need cancellation | Use `CancellationToken` and cooperative cancellation |
| Need to wait for async result | Prefer `await`, not `.Result` or `.Wait()` |

### Common mistakes

Common mistakes include:

- Thinking `async` always creates a new thread
- Thinking every `Task` is backed by a dedicated thread
- Using `Task.Run` around already-async I/O
- Using `Task.Run` inside ASP.NET Core controllers to "make it async"
- Blocking with `.Result`, `.Wait()`, or `Thread.Sleep`
- Starting thousands of tasks with unbounded `Task.WhenAll`
- Using `Parallel.ForEach` for I/O-bound work
- Ignoring cancellation
- Fire-and-forget tasks without error handling
- Sharing non-thread-safe objects in parallel code
- Using `DbContext` from multiple parallel operations
- Assuming parallelism always improves performance
- Not measuring performance before and after changes

### Best practices

Best practices include:

- Identify whether work is CPU-bound or I/O-bound before choosing a tool.
- Use real async APIs for I/O-bound work.
- Use `await` instead of blocking waits.
- Avoid `Task.Run` for I/O-bound work.
- Be cautious with `Task.Run` in ASP.NET Core request paths.
- Use `Task.Run` mainly for CPU-bound offloading, especially in UI apps.
- Use bounded concurrency when processing many items.
- Pass `CancellationToken` through the call stack.
- Avoid shared mutable state in parallel code.
- Use thread-safe collections only when needed.
- Prefer background services or queues for long-running server work.
- Measure with realistic workloads before claiming a performance improvement.
- Keep async code readable and avoid unnecessary nesting.
- Use `Async` suffix for asynchronous method names.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q01 -->
#### Beginner Q01: What is the difference between CPU-bound and I/O-bound work?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

CPU-bound work is limited mainly by CPU computation. The program is actively using processor time to perform calculations, transformations, parsing, compression, encryption, or other expensive operations.

I/O-bound work is limited mainly by waiting for an external resource, such as a database, web API, file system, network, message queue, or cloud service. During the wait, the CPU may be mostly idle for that operation.

In C#, this distinction affects which tool you should use. For I/O-bound work, use true asynchronous APIs with `async` and `await`. For CPU-bound work, use CPU execution tools such as direct synchronous execution, `Task.Run` for offloading, or parallel APIs when the work can be safely split.

##### Key Points to Mention

- CPU-bound means computation-heavy.
- I/O-bound means waiting-heavy.
- I/O-bound work should use async APIs directly.
- CPU-bound work requires CPU time and normally needs a thread while running.
- Choosing the wrong approach can hurt scalability and responsiveness.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q01 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q02 -->
#### Beginner Q02: Is a `Task` the same as a thread?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

No. A `Task` represents an operation that may complete in the future. It is not the same thing as a thread.

A task may represent CPU-bound work running on a ThreadPool thread, but it may also represent an I/O operation that is waiting for completion without occupying a thread. For example, `HttpClient.GetAsync`, `Task.Delay`, and many database async methods return tasks, but they do not necessarily use a dedicated thread while waiting.

`Task.Run` is different because it explicitly queues work to the ThreadPool. That kind of task usually needs a ThreadPool thread to execute the delegate.

##### Key Points to Mention

- `Task` is an abstraction for asynchronous work.
- A task is not necessarily backed by a dedicated thread.
- I/O-bound async tasks often do not occupy a thread while waiting.
- `Task.Run` queues work to the ThreadPool.
- This distinction is important for scalability.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q02 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q03 -->
#### Beginner Q03: What does `await` do?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`await` asynchronously waits for a task to complete. If the task is not complete, the current async method is suspended and control returns to the caller. The current thread is not blocked and can be used for other work.

When the awaited task completes, the rest of the method continues. This makes asynchronous code look similar to synchronous code while still allowing non-blocking execution.

##### Key Points to Mention

- `await` waits asynchronously.
- It does not block the current thread like `.Result` or `.Wait()`.
- The async method is transformed into a state machine.
- Execution resumes after the awaited task completes.
- It improves responsiveness and scalability.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q03 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q04 -->
#### Beginner Q04: When should you use `Task.Run`?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Use `Task.Run` when you need to run CPU-bound work on a ThreadPool thread, especially when you want to keep a UI thread responsive. For example, a desktop application might use `Task.Run` to offload image processing or a large calculation.

Do not use `Task.Run` just to wrap an already-asynchronous I/O operation. If an API already returns a `Task`, usually await it directly.

In ASP.NET Core, be careful with `Task.Run` because request code already runs on ThreadPool threads. Immediately awaiting `Task.Run` inside a controller often adds unnecessary scheduling overhead and does not improve scalability.

##### Key Points to Mention

- `Task.Run` queues work to the ThreadPool.
- Useful for CPU-bound offloading.
- Commonly useful in UI apps.
- Avoid wrapping true async I/O in `Task.Run`.
- Avoid using it casually in ASP.NET Core request paths.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q04 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q05 -->
#### Beginner Q05: Why is `.Result` or `.Wait()` often bad in async code?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

`.Result` and `.Wait()` block the current thread until the task completes. This removes the main benefit of asynchronous programming.

Blocking can cause deadlocks in UI apps and older synchronization-context scenarios. In server applications, blocking can reduce scalability and contribute to ThreadPool starvation because threads are occupied waiting instead of processing other work.

The preferred approach is to use `await` and allow async behavior to flow through the call stack.

##### Key Points to Mention

- `.Result` and `.Wait()` block threads.
- Blocking can cause deadlocks.
- Blocking can cause ThreadPool starvation.
- Prefer `await`.
- Use async all the way through when possible.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q05 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q06 -->
#### Beginner Q06: What is `Task.WhenAll` used for?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

`Task.WhenAll` is used to asynchronously wait for multiple tasks to complete. It is commonly used when several independent I/O-bound operations can run concurrently, such as calling multiple APIs or loading several independent records.

Example:

```csharp
Task<CustomerDto> customerTask = GetCustomerAsync(id, cancellationToken);
Task<IReadOnlyList<OrderDto>> ordersTask = GetOrdersAsync(id, cancellationToken);

await Task.WhenAll(customerTask, ordersTask);
```

This can reduce total waiting time because independent operations are started before awaiting all of them.

##### Key Points to Mention

- Waits for multiple tasks.
- Useful for independent operations.
- Common for concurrent I/O-bound work.
- Does not mean each task has a dedicated thread.
- Be careful with unbounded concurrency.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q01 -->
#### Intermediate Q01: Why should you not usually wrap I/O-bound work in `Task.Run`?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

You should not usually wrap I/O-bound work in `Task.Run` because true async I/O APIs already provide non-blocking behavior. Wrapping them in `Task.Run` adds unnecessary ThreadPool scheduling and can make performance worse.

For example, this is unnecessary:

```csharp
await Task.Run(() => httpClient.GetStringAsync(url));
```

The better approach is:

```csharp
await httpClient.GetStringAsync(url);
```

If the operation is truly asynchronous, the thread can return to the ThreadPool while waiting for the I/O completion. `Task.Run` is more appropriate for CPU-bound work that needs a thread to execute computation.

##### Key Points to Mention

- True async I/O does not need `Task.Run`.
- `Task.Run` adds ThreadPool scheduling overhead.
- It can reduce scalability in server applications.
- Await the async API directly.
- Use `Task.Run` primarily for CPU-bound offloading.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q01 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q02 -->
#### Intermediate Q02: Why is `Task.Run` usually discouraged inside ASP.NET Core controllers?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

ASP.NET Core request handlers already run on ThreadPool threads. If a controller calls `Task.Run` and immediately awaits it, the application usually moves work from one ThreadPool thread to another ThreadPool thread. That adds scheduling overhead without making the request more scalable.

For I/O-bound work, the correct approach is to use asynchronous APIs all the way down, such as EF Core async methods, HTTP async methods, and stream async methods.

For long-running CPU-heavy work, it is usually better to queue the work to a background service, worker, message queue, Azure Function, or another out-of-request processor instead of making the HTTP request wait.

##### Key Points to Mention

- ASP.NET Core already uses ThreadPool threads.
- Immediate `await Task.Run(...)` often only adds overhead.
- It does not make blocking I/O truly asynchronous.
- Use real async I/O APIs.
- Move long-running CPU work outside request handling when possible.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q02 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q03 -->
#### Intermediate Q03: How would you process many I/O-bound operations safely without overwhelming resources?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use bounded concurrency. Starting every operation at once with `Task.WhenAll` can overload a database, remote API, connection pool, rate limit, or the application itself.

A common solution is `SemaphoreSlim`:

```csharp
using SemaphoreSlim semaphore = new(maxConcurrency);

Task<Result> ProcessAsync(Item item) => ProcessOneAsync(item, semaphore, cancellationToken);

Task<Result>[] tasks = items.Select(ProcessAsync).ToArray();

Result[] results = await Task.WhenAll(tasks);

async Task<Result> ProcessOneAsync(
    Item item,
    SemaphoreSlim semaphore,
    CancellationToken cancellationToken)
{
    await semaphore.WaitAsync(cancellationToken);

    try
    {
        return await CallExternalServiceAsync(item, cancellationToken);
    }
    finally
    {
        semaphore.Release();
    }
}
```

Other options include `Parallel.ForEachAsync`, Channels, TPL Dataflow, background queues, or message brokers.

##### Key Points to Mention

- Avoid unbounded `Task.WhenAll` for large collections.
- Use bounded concurrency.
- `SemaphoreSlim` is a common pattern.
- `Parallel.ForEachAsync` can also limit concurrency.
- Choose limits based on real resource constraints and measurement.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q03 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q04 -->
#### Intermediate Q04: What is the difference between concurrency and parallelism?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Concurrency means multiple operations are in progress during the same time period. They may not all be executing at exactly the same instant. Async I/O often creates concurrency because many operations can be waiting for I/O at the same time.

Parallelism means multiple operations are executing at the same time, usually on multiple CPU cores. CPU-bound work benefits from parallelism when the work can be divided safely.

Example of concurrency:

```csharp
Task<string> a = httpClient.GetStringAsync(urlA);
Task<string> b = httpClient.GetStringAsync(urlB);

await Task.WhenAll(a, b);
```

Example of parallelism:

```csharp
Parallel.ForEach(files, file =>
{
    CompressFile(file);
});
```

##### Key Points to Mention

- Concurrency means in progress together.
- Parallelism means executing at the same time.
- Async I/O is often concurrent but not necessarily parallel.
- CPU-bound work may benefit from parallelism.
- Parallelism has overhead and should be measured.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q04 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q05 -->
#### Intermediate Q05: How do `Parallel.ForEach` and `Parallel.ForEachAsync` differ?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

`Parallel.ForEach` is mainly for synchronous parallel loops, commonly CPU-bound operations. It executes iterations in parallel using ThreadPool threads.

`Parallel.ForEachAsync` supports asynchronous delegates and can be useful for bounded asynchronous processing. It allows each iteration to `await` asynchronous operations and can limit concurrency using `ParallelOptions.MaxDegreeOfParallelism`.

Example:

```csharp
await Parallel.ForEachAsync(items, new ParallelOptions
{
    MaxDegreeOfParallelism = 8,
    CancellationToken = cancellationToken
},
async (item, token) =>
{
    await ProcessItemAsync(item, token);
});
```

For CPU-bound work, `MaxDegreeOfParallelism` near the processor count can be a reasonable starting point. For I/O-bound work, the best concurrency limit depends on database limits, external service limits, latency, and connection pools.

##### Key Points to Mention

- `Parallel.ForEach` is synchronous and parallel.
- `Parallel.ForEachAsync` supports async delegates.
- Both require careful handling of shared state.
- `MaxDegreeOfParallelism` controls concurrency, not a guaranteed thread count.
- Limits should be chosen based on workload and measurement.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q05 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q06 -->
#### Intermediate Q06: What is ThreadPool starvation and how can async code cause or prevent it?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

ThreadPool starvation happens when the ThreadPool does not have enough available threads to process new work items. This often happens because many threads are blocked or occupied for too long.

Async code can help prevent starvation when it uses true asynchronous I/O and `await`, because threads are released while operations wait for I/O.

However, async code can contribute to starvation if developers block on tasks using `.Result` or `.Wait()`, wrap blocking work in too many `Task.Run` calls, use sync-over-async patterns, or start unbounded concurrent operations.

Symptoms include slow responses, request timeouts, poor scalability, and many ThreadPool threads being added under load.

##### Key Points to Mention

- Starvation means not enough available ThreadPool threads.
- Blocking calls are a common cause.
- True async I/O helps free threads.
- `.Result`, `.Wait()`, and sync-over-async are dangerous.
- Diagnose with profiling and runtime diagnostics tools.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q06 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q07 -->
#### Intermediate Q07: How should cancellation be handled for CPU-bound and I/O-bound work?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

For I/O-bound work, pass the `CancellationToken` to async APIs that support cancellation:

```csharp
HttpResponseMessage response = await httpClient.GetAsync(url, cancellationToken);
```

For CPU-bound work, cancellation is cooperative. The running code must periodically check the token:

```csharp
foreach (Item item in items)
{
    cancellationToken.ThrowIfCancellationRequested();
    ProcessCpuHeavyItem(item);
}
```

Passing a token to `Task.Run` can cancel the task before it starts, but once the delegate is already running, the delegate itself must observe the token.

##### Key Points to Mention

- Cancellation is cooperative.
- Pass tokens to async I/O APIs.
- CPU-bound loops must check the token.
- `Task.Run` token does not forcibly kill running work.
- Handle `OperationCanceledException` appropriately.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-intermediate-q07 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q01 -->
#### Advanced Q01: How would you design an ASP.NET Core endpoint that needs to trigger a long-running CPU-heavy operation?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

A long-running CPU-heavy operation should usually not run directly inside the HTTP request path. Keeping the request open while CPU-heavy work runs reduces throughput, increases timeout risk, and occupies server resources.

A better design is to accept the request, validate it, create a job record, enqueue a command, and return `202 Accepted`. A background worker, hosted service, Azure Function, container job, or message-driven processor can execute the CPU-heavy work. The client can poll job status or receive updates through SignalR, webhooks, or notifications.

Example controller pattern:

```csharp
[HttpPost("reports")]
public async Task<IActionResult> CreateReport(
    CreateReportRequest request,
    CancellationToken cancellationToken)
{
    Guid jobId = await _reportJobService.CreateJobAsync(request, cancellationToken);

    await _queue.EnqueueAsync(new GenerateReportCommand(jobId), cancellationToken);

    return AcceptedAtAction(nameof(GetReportStatus), new { jobId }, new { jobId });
}
```

This separates request handling from background processing and improves reliability, retries, monitoring, and scalability.

##### Key Points to Mention

- Avoid long-running CPU-heavy work in request paths.
- Use `202 Accepted` and background processing.
- Store job status.
- Use queues or workers for reliability.
- Consider retries, cancellation, idempotency, observability, and scaling.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q01 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q02 -->
#### Advanced Q02: How can unbounded `Task.WhenAll` cause production issues?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Unbounded `Task.WhenAll` can start a very large number of operations at once. This can exhaust memory, overload external APIs, exceed rate limits, exhaust database connection pools, overload the network, increase latency, and cause cascading failures.

Example risky code:

```csharp
await Task.WhenAll(customers.Select(c => SyncCustomerAsync(c, cancellationToken)));
```

If `customers` contains 50,000 items, this may attempt to start 50,000 operations.

A safer approach is bounded concurrency:

```csharp
await Parallel.ForEachAsync(customers, new ParallelOptions
{
    MaxDegreeOfParallelism = 20,
    CancellationToken = cancellationToken
},
async (customer, token) =>
{
    await SyncCustomerAsync(customer, token);
});
```

The right concurrency limit depends on the workload and should be measured.

##### Key Points to Mention

- `Task.WhenAll` itself is not bad.
- The danger is starting too much work at once.
- Risks include memory pressure, throttling, connection pool exhaustion, and cascading failures.
- Use bounded concurrency.
- Tune limits with production-like measurements.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q02 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q03 -->
#### Advanced Q03: How do exceptions behave with `Task.WhenAll`?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

`Task.WhenAll` returns a task that completes when all supplied tasks complete. If any supplied task faults, the combined task faults. The returned task stores the exceptions from the failed tasks.

When you `await` the combined task, an exception is thrown. If multiple tasks failed, the returned task's `Exception` property contains the aggregate details, but simple `await` handling may not expose every exception directly in the catch block.

A robust design depends on the requirement. If all operations must succeed, allow `Task.WhenAll` to fail and log details. If partial success is allowed, catch exceptions inside each task and return a result object.

Example partial-success pattern:

```csharp
Task<Result> CreateTask(Item item) => ProcessSafelyAsync(item, cancellationToken);

Result[] results = await Task.WhenAll(items.Select(CreateTask));

async Task<Result> ProcessSafelyAsync(Item item, CancellationToken cancellationToken)
{
    try
    {
        await ProcessAsync(item, cancellationToken);
        return Result.Success(item.Id);
    }
    catch (Exception ex)
    {
        return Result.Failure(item.Id, ex);
    }
}
```

##### Key Points to Mention

- `Task.WhenAll` waits for all supplied tasks.
- If any task faults, the combined task faults.
- Multiple exceptions can exist.
- Partial success should be modeled explicitly.
- Do not ignore failed tasks.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q03 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q04 -->
#### Advanced Q04: Why can `async over sync` be harmful?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

`async over sync` means exposing an async-looking method by wrapping synchronous blocking work, usually with `Task.Run`.

Example:

```csharp
public Task<byte[]> ReadFileAsync(string path)
{
    return Task.Run(() => File.ReadAllBytes(path));
}
```

This is harmful because it does not create true asynchronous I/O. It blocks a ThreadPool thread while the synchronous operation waits. In server applications, many calls like this can contribute to ThreadPool starvation and poor scalability.

A better approach is to use a real asynchronous API:

```csharp
public async Task<byte[]> ReadFileAsync(
    string path,
    CancellationToken cancellationToken)
{
    return await File.ReadAllBytesAsync(path, cancellationToken);
}
```

If no async API exists, the correct design might be to keep the API synchronous, isolate the dependency, limit concurrency, or move the work to a background processor.

##### Key Points to Mention

- `async over sync` only hides blocking work.
- It can consume ThreadPool threads while waiting.
- It can reduce server scalability.
- Prefer true async APIs.
- If no async API exists, design around the limitation intentionally.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q04 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q05 -->
#### Advanced Q05: How would you choose between `Task.Run`, `Parallel.ForEach`, `Parallel.ForEachAsync`, Channels, and a message queue?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

The choice depends on workload type, lifetime, reliability requirements, scale, and resource limits.

Use `Task.Run` for small amounts of CPU-bound offloading, especially from a UI thread.

Use `Parallel.ForEach` for CPU-bound collection processing when each item can be processed independently and the work benefits from multiple cores.

Use `Parallel.ForEachAsync` for a simple bounded asynchronous loop where each iteration may await async work.

Use Channels or TPL Dataflow when you need an in-process producer-consumer pipeline, backpressure, multiple processing stages, or more control over flow.

Use a message queue or external worker when the work must be reliable, durable, retried, scaled independently, or continue outside an HTTP request lifetime.

##### Key Points to Mention

- Match the tool to the workload.
- `Task.Run` is not a general async solution.
- Parallel loops are usually for CPU-bound or controlled item processing.
- Channels help with in-process pipelines and backpressure.
- Message queues are better for durable background processing.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q05 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q06 -->
#### Advanced Q06: What are the risks of sharing objects across parallel tasks?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Sharing mutable objects across parallel tasks can cause race conditions, data corruption, inconsistent results, exceptions, and hard-to-reproduce bugs. Many common objects are not safe for concurrent mutation.

Examples include:

- Writing to a regular `List<T>` from multiple tasks
- Updating a shared counter without synchronization
- Using a single EF Core `DbContext` concurrently
- Accessing `HttpContext` from background threads
- Modifying shared dictionaries without locks or concurrent collections

Safer approaches include using immutable data, local variables, thread-safe collections, locks when necessary, partitioning work, or designing each task to return a result that is combined after all tasks complete.

Example safer pattern:

```csharp
int[] results = await Task.WhenAll(items.Select(item =>
    Task.Run(() => Calculate(item), cancellationToken)));

int total = results.Sum();
```

Each task returns a value instead of mutating shared state.

##### Key Points to Mention

- Shared mutable state is dangerous in parallel code.
- Race conditions can be intermittent.
- `DbContext` is not safe for concurrent operations.
- Prefer immutable data or return values.
- Use synchronization or concurrent collections only when needed.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q06 -->

<!-- question:start:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q07 -->
#### Advanced Q07: How would you troubleshoot slow ASP.NET Core requests suspected to be caused by ThreadPool starvation?

<!-- question-id:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Start by confirming the symptoms with metrics and diagnostics. Look for high request latency, timeouts, increasing ThreadPool thread counts, blocked threads, sync-over-async patterns, and hot paths that call `.Result`, `.Wait()`, `Thread.Sleep`, or excessive `Task.Run`.

Use application logs, distributed tracing, metrics, and profiling tools. Runtime tools such as counters, traces, stack dumps, and profilers can show whether many ThreadPool threads are blocked and where they are blocked.

Then fix the root cause:

- Replace sync I/O with async I/O.
- Remove unnecessary `Task.Run`.
- Avoid blocking waits.
- Add bounded concurrency.
- Move long-running work to background processing.
- Reduce lock contention.
- Optimize CPU-heavy hot paths.
- Add timeouts and cancellation.
- Measure again after changes.

##### Key Points to Mention

- Do not guess; measure.
- Look for blocking and sync-over-async.
- Check ThreadPool behavior and stack traces.
- Fix root causes, not just symptoms.
- Validate improvements with load testing.

<!-- question:end:cpu-bound-vs-io-bound-work-and-task-in-csharp-advanced-q07 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
