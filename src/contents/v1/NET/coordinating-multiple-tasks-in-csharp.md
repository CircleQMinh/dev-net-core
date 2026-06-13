---
id: coordinating-multiple-tasks-in-csharp
topic: Async programming, tasks, cancellation, and concurrency
subtopic: Coordinating Multiple Tasks in C#
category: .NET
---


## Overview

Coordinating multiple tasks in C# means managing several asynchronous or parallel operations so they start, wait, complete, fail, cancel, or produce results in a controlled way. It is a common part of modern .NET development because real applications often need to perform more than one operation at the same time: calling multiple APIs, loading several database resources, processing files, sending notifications, running background jobs, or handling producer-consumer workloads.

In C#, this is usually done with the Task-based Asynchronous Pattern using `Task`, `Task<T>`, `async`, `await`, `Task.WhenAll`, `Task.WhenAny`, `Task.WhenEach`, `Parallel.ForEachAsync`, `SemaphoreSlim`, channels, cancellation tokens, and sometimes TPL Dataflow. The goal is not simply to "make things parallel". The real goal is to improve responsiveness, reduce latency, increase throughput, and keep code reliable under failure, cancellation, and high load.

This topic matters in interviews because it tests whether a developer understands the difference between asynchronous concurrency and CPU parallelism, how exceptions behave across multiple tasks, how cancellation should be propagated, how to avoid unbounded concurrency, and how to choose the correct coordination pattern for production code. Interviewers often ask about this topic because many real performance and reliability bugs come from incorrect task coordination: sequential awaits that should be concurrent, `Task.Run` overuse, forgotten awaits, fire-and-forget work, shared state races, blocked threads, thread pool starvation, and missing cancellation.

## Core Concepts

### Task Coordination vs Simple Async/Await

A single asynchronous operation is usually straightforward:

```csharp
var user = await userService.GetUserAsync(userId, cancellationToken);
```

Task coordination becomes necessary when multiple operations need to be managed together:

```csharp
Task<User> userTask = userService.GetUserAsync(userId, cancellationToken);
Task<IReadOnlyList<Order>> ordersTask = orderService.GetOrdersAsync(userId, cancellationToken);
Task<AccountStatus> statusTask = accountService.GetStatusAsync(userId, cancellationToken);

await Task.WhenAll(userTask, ordersTask, statusTask);

User user = await userTask;
IReadOnlyList<Order> orders = await ordersTask;
AccountStatus status = await statusTask;
```

The important detail is that the tasks are created before they are awaited. This allows the operations to run concurrently when the underlying APIs support asynchronous execution. If each operation is awaited immediately, they run one after another:

```csharp
// Sequential: each operation starts after the previous one completes.
User user = await userService.GetUserAsync(userId, cancellationToken);
IReadOnlyList<Order> orders = await orderService.GetOrdersAsync(userId, cancellationToken);
AccountStatus status = await accountService.GetStatusAsync(userId, cancellationToken);
```

The concurrent version can reduce total latency when the operations are independent.

### Concurrency vs Parallelism

Concurrency means multiple operations are in progress during the same time period. Parallelism means multiple operations are executing at the same instant, usually on different CPU cores.

In C#:

- `async` and `await` are commonly used for I/O-bound concurrency, such as HTTP calls, database calls, file reads, and queue operations.
- `Task.Run`, `Parallel.For`, `Parallel.ForEach`, and CPU-bound work use threads and can run in parallel.
- `Task.WhenAll` coordinates tasks; it does not create threads by itself.
- `Task.WhenAny` waits until one task completes; it does not stop the other tasks automatically.
- `Parallel.ForEachAsync` is useful when processing many items with controlled parallelism, especially when each item uses asynchronous work.

A common interview mistake is saying that `Task.WhenAll` "runs tasks in parallel". More accurately, the tasks are already started by the time they are passed to `Task.WhenAll`; `Task.WhenAll` returns a task that completes when all supplied tasks complete.

### Task.WhenAll

`Task.WhenAll` is used when all operations are required before the next step can continue.

Example: load multiple independent pieces of data for a dashboard:

```csharp
public async Task<DashboardDto> GetDashboardAsync(Guid userId, CancellationToken cancellationToken)
{
    Task<UserDto> userTask = userApi.GetUserAsync(userId, cancellationToken);
    Task<IReadOnlyList<OrderDto>> ordersTask = orderApi.GetRecentOrdersAsync(userId, cancellationToken);
    Task<IReadOnlyList<NotificationDto>> notificationsTask = notificationApi.GetUnreadAsync(userId, cancellationToken);

    await Task.WhenAll(userTask, ordersTask, notificationsTask);

    return new DashboardDto
    {
        User = await userTask,
        RecentOrders = await ordersTask,
        Notifications = await notificationsTask
    };
}
```

This pattern is useful when:

- The operations are independent.
- All results are needed.
- Running them concurrently does not violate resource constraints.
- The called services can handle the concurrency.

A practical benefit is latency reduction. If three independent API calls each take around 500 ms, sequential awaits may take around 1500 ms, while concurrent execution may complete closer to the slowest individual operation.

### Starting Tasks Correctly

Creating a task is not always the same thing as executing work. Many asynchronous methods start work when the method is called:

```csharp
Task<Product> productTask = productClient.GetProductAsync(productId, cancellationToken);
```

But LINQ uses deferred execution, so this code can be misleading:

```csharp
IEnumerable<Task<Product>> tasks = productIds.Select(id => productClient.GetProductAsync(id, cancellationToken));

Product[] products = await Task.WhenAll(tasks);
```

This usually works because `Task.WhenAll` enumerates the sequence, but it can be harder to reason about. A clearer and safer pattern is to materialize the task list immediately:

```csharp
Task<Product>[] tasks = productIds
    .Select(id => productClient.GetProductAsync(id, cancellationToken))
    .ToArray();

Product[] products = await Task.WhenAll(tasks);
```

This makes it explicit that the tasks are created before waiting for them.

### Task.WhenAll Result Ordering

For `Task.WhenAll<TResult>`, the result array preserves the same order as the input tasks, not the order in which tasks completed.

```csharp
Task<string>[] tasks =
[
    GetNameAsync(1, cancellationToken),
    GetNameAsync(2, cancellationToken),
    GetNameAsync(3, cancellationToken)
];

string[] names = await Task.WhenAll(tasks);

// names[0] is the result of GetNameAsync(1), even if that task completed last.
```

This is useful when the caller needs to keep results aligned with the original input order.

### Exception Handling with Task.WhenAll

If one or more tasks fail, the task returned by `Task.WhenAll` becomes faulted. When awaited, an exception is thrown. A common interview point is that multiple tasks can fail, so production code may need to inspect all inner exceptions.

```csharp
Task[] tasks =
[
    SendEmailAsync(userA, cancellationToken),
    SendEmailAsync(userB, cancellationToken),
    SendEmailAsync(userC, cancellationToken)
];

Task allTasks = Task.WhenAll(tasks);

try
{
    await allTasks;
}
catch
{
    foreach (Exception exception in allTasks.Exception?.Flatten().InnerExceptions ?? [])
    {
        logger.LogError(exception, "A task failed while sending emails.");
    }

    throw;
}
```

Important habits:

- Always await the task returned by `Task.WhenAll`.
- Do not assume only one task can fail.
- Log enough context to know which operation failed.
- Decide whether partial success is acceptable.
- Avoid swallowing exceptions silently.

### Cancellation with Multiple Tasks

Cancellation in .NET is cooperative. A `CancellationToken` is a signal; it does not forcibly kill a task. Each operation must observe the token and stop safely.

```csharp
public async Task ProcessAsync(IEnumerable<int> ids, CancellationToken cancellationToken)
{
    Task[] tasks = ids
        .Select(id => ProcessItemAsync(id, cancellationToken))
        .ToArray();

    await Task.WhenAll(tasks);
}
```

If the caller cancels the token, each task should respond by passing the token to lower-level APIs or checking it in long-running loops:

```csharp
private async Task ProcessItemAsync(int id, CancellationToken cancellationToken)
{
    cancellationToken.ThrowIfCancellationRequested();

    var item = await repository.GetAsync(id, cancellationToken);

    cancellationToken.ThrowIfCancellationRequested();

    await processor.ProcessAsync(item, cancellationToken);
}
```

Best practice is to propagate the token through the entire call chain instead of creating unrelated tokens in lower layers.

### Task.WhenAny

`Task.WhenAny` is used when the application wants to continue after the first task completes.

Example: use the first successful result from multiple mirrors or providers:

```csharp
public async Task<string> GetFromFastestProviderAsync(CancellationToken cancellationToken)
{
    using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

    Task<string>[] tasks =
    [
        providerA.GetValueAsync(cts.Token),
        providerB.GetValueAsync(cts.Token),
        providerC.GetValueAsync(cts.Token)
    ];

    Task<string> completedTask = await Task.WhenAny(tasks);

    cts.Cancel(); // Ask the remaining operations to stop.

    return await completedTask; // Observe success, failure, or cancellation from the completed task.
}
```

Important details:

- `Task.WhenAny` returns the completed task, not the result directly.
- The returned wrapper task completes successfully when any task completes, even if the completed task itself failed or was canceled.
- The remaining tasks continue running unless they are canceled or otherwise stopped.
- You still need to await the completed task to observe its result or exception.

### Task.WhenEach

`Task.WhenEach` is useful when many tasks are running and the program wants to process each result as soon as it completes instead of waiting for all tasks first.

```csharp
Task<Product>[] tasks = productIds
    .Select(id => productClient.GetProductAsync(id, cancellationToken))
    .ToArray();

await foreach (Task<Product> completedTask in Task.WhenEach(tasks))
{
    Product product = await completedTask;
    Console.WriteLine($"Received product: {product.Name}");
}
```

This is helpful for streaming progress, updating UI, writing partial results, or reducing memory pressure when results can be processed independently. If targeting an older .NET version that does not support `Task.WhenEach`, the same behavior can be implemented with a loop around `Task.WhenAny`.

### Throttling with SemaphoreSlim

Unbounded concurrency can overload databases, APIs, file systems, message brokers, or the .NET thread pool. `SemaphoreSlim` is commonly used to limit how many asynchronous operations run at the same time.

```csharp
public async Task<IReadOnlyList<ProductDto>> GetProductsAsync(
    IEnumerable<int> productIds,
    CancellationToken cancellationToken)
{
    using var semaphore = new SemaphoreSlim(initialCount: 5, maxCount: 5);

    Task<ProductDto>[] tasks = productIds
        .Select(id => GetProductWithThrottleAsync(id, semaphore, cancellationToken))
        .ToArray();

    return await Task.WhenAll(tasks);
}

private async Task<ProductDto> GetProductWithThrottleAsync(
    int productId,
    SemaphoreSlim semaphore,
    CancellationToken cancellationToken)
{
    await semaphore.WaitAsync(cancellationToken);

    try
    {
        return await productClient.GetProductAsync(productId, cancellationToken);
    }
    finally
    {
        semaphore.Release();
    }
}
```

The `finally` block is essential. Without it, an exception can prevent the semaphore from being released, which can cause deadlocks or permanent throttling.

Use throttling when:

- Calling a rate-limited external API.
- Running many database queries.
- Processing many files.
- Sending many messages.
- Protecting limited resources.

### Parallel.ForEachAsync

`Parallel.ForEachAsync` is useful for processing many items with a maximum degree of parallelism.

```csharp
await Parallel.ForEachAsync(
    source: productIds,
    parallelOptions: new ParallelOptions
    {
        MaxDegreeOfParallelism = 8,
        CancellationToken = cancellationToken
    },
    body: async (productId, token) =>
    {
        Product product = await productClient.GetProductAsync(productId, token);
        await searchIndex.UpdateAsync(product, token);
    });
```

This is often cleaner than manually creating many tasks and wrapping each one with a semaphore. However, it is best suited for cases where the same operation is applied to each item and where the result can be handled inside the loop body or safely collected.

Trade-offs:

- Good for controlled parallel processing of a collection.
- Less convenient when you need a complex result shape or custom per-task orchestration.
- Shared mutable state inside the loop requires synchronization.
- A high `MaxDegreeOfParallelism` can still overload downstream systems.

### Producer-Consumer Coordination with Channels

Channels provide an asynchronous producer-consumer pattern. Producers write work items into a channel; consumers read from the channel and process items.

```csharp
using System.Threading.Channels;

public async Task ProcessQueueAsync(IEnumerable<Job> jobs, CancellationToken cancellationToken)
{
    var channel = Channel.CreateBounded<Job>(new BoundedChannelOptions(capacity: 100)
    {
        FullMode = BoundedChannelFullMode.Wait
    });

    Task producer = Task.Run(async () =>
    {
        try
        {
            foreach (Job job in jobs)
            {
                await channel.Writer.WriteAsync(job, cancellationToken);
            }
        }
        finally
        {
            channel.Writer.Complete();
        }
    }, cancellationToken);

    Task[] consumers = Enumerable.Range(0, 4)
        .Select(_ => Task.Run(async () =>
        {
            await foreach (Job job in channel.Reader.ReadAllAsync(cancellationToken))
            {
                await ProcessJobAsync(job, cancellationToken);
            }
        }, cancellationToken))
        .ToArray();

    await Task.WhenAll(consumers.Prepend(producer));
}
```

Channels are useful when:

- Work arrives over time.
- You need backpressure.
- Producers and consumers should be decoupled.
- A bounded queue is safer than creating unlimited tasks.
- Multiple workers process the same type of job.

A bounded channel is often safer than an unbounded channel because it prevents producers from filling memory faster than consumers can process work.

### TPL Dataflow

TPL Dataflow is a higher-level library for building asynchronous pipelines. It is useful when work needs to move through multiple stages, such as download, parse, validate, transform, and save.

Example concept:

```csharp
var options = new ExecutionDataflowBlockOptions
{
    MaxDegreeOfParallelism = 4,
    CancellationToken = cancellationToken
};

var processBlock = new ActionBlock<Order>(
    async order => await ProcessOrderAsync(order, cancellationToken),
    options);

foreach (Order order in orders)
{
    await processBlock.SendAsync(order, cancellationToken);
}

processBlock.Complete();
await processBlock.Completion;
```

TPL Dataflow can be useful for more advanced pipelines because it supports blocks, linking, bounded capacity, completion propagation, and controlled parallelism. For simpler producer-consumer cases, channels are often enough.

### Task.Run and CPU-Bound Work

`Task.Run` queues work to the thread pool. It is useful for CPU-bound work that should run on a background thread, especially in desktop or UI applications where blocking the UI thread would freeze the application.

```csharp
Task<Report> reportTask = Task.Run(() => GenerateLargeReport(input), cancellationToken);
Report report = await reportTask;
```

In ASP.NET Core, `Task.Run` should be used carefully. Wrapping synchronous blocking work in `Task.Run` does not make it truly asynchronous; it just moves the blocking work to another thread pool thread. Under load, this can reduce scalability.

Good use cases:

- CPU-heavy calculations.
- Isolating work from a UI thread.
- Running independent CPU-bound tasks in a controlled way.

Poor use cases:

- Wrapping already asynchronous I/O methods.
- Hiding blocking database or HTTP calls.
- Fire-and-forget background work in a web request.
- Creating one task per item for a very large collection without throttling.

### Fire-and-Forget Tasks

Fire-and-forget means starting a task without awaiting it.

```csharp
_ = SendAuditLogAsync(auditEvent, cancellationToken);
```

This is risky because:

- Exceptions can be lost or become unobserved.
- The request scope may end before the task finishes.
- Scoped dependencies such as `DbContext` may be disposed.
- Cancellation and shutdown may not be handled correctly.
- There is no reliable completion signal.

In production, prefer a background queue, hosted service, message broker, or durable job processor for work that must continue after the current request.

### Shared State and Thread Safety

Coordinating multiple tasks often means multiple operations run at the same time. If they access shared mutable state, the code must be thread-safe.

Unsafe example:

```csharp
var results = new List<Product>();

await Task.WhenAll(productIds.Select(async id =>
{
    Product product = await productClient.GetProductAsync(id, cancellationToken);
    results.Add(product); // Not safe when multiple tasks write at the same time.
}));
```

Safer options:

```csharp
Task<Product>[] tasks = productIds
    .Select(id => productClient.GetProductAsync(id, cancellationToken))
    .ToArray();

Product[] results = await Task.WhenAll(tasks);
```

Or use a thread-safe collection when shared writes are necessary:

```csharp
var results = new ConcurrentBag<Product>();

await Parallel.ForEachAsync(productIds, cancellationToken, async (id, token) =>
{
    Product product = await productClient.GetProductAsync(id, token);
    results.Add(product);
});
```

Best practice is to avoid shared mutable state when possible. Prefer returning results from tasks and combining them after coordination.

### Resource Lifetime and DbContext Warning

Many objects are not safe to use concurrently. A common production mistake is running multiple EF Core operations in parallel on the same `DbContext` instance.

Problematic pattern:

```csharp
Task<User?> userTask = dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
Task<List<Order>> ordersTask = dbContext.Orders.Where(x => x.UserId == userId).ToListAsync(cancellationToken);

await Task.WhenAll(userTask, ordersTask); // Risky: same DbContext used concurrently.
```

Better options:

- Use one combined query when possible.
- Run the queries sequentially if they share the same context.
- Use separate context instances when true parallel database queries are justified.
- Consider whether parallel database calls actually improve performance or just increase load.

### Timeouts with Multiple Tasks

Task coordination should usually include cancellation or timeout behavior. One modern pattern is to use cancellation tokens with timeout sources:

```csharp
using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
    timeoutCts.Token,
    cancellationToken);

await Task.WhenAll(tasks.Select(task => RunOperationAsync(task, linkedCts.Token)));
```

For waiting on a specific task with a timeout, `WaitAsync` can be useful:

```csharp
await externalCallTask.WaitAsync(TimeSpan.FromSeconds(3), cancellationToken);
```

Timeouts should be selected carefully. A timeout that is too short causes false failures; a timeout that is too long can waste resources and delay recovery.

### Choosing the Right Coordination Tool

| Scenario | Good option | Why |
|---|---|---|
| Need all independent results | `Task.WhenAll` | Waits for all tasks and can return all results |
| Need first completed operation | `Task.WhenAny` | Continues as soon as one task completes |
| Need to process results as they complete | `Task.WhenEach` | Streams completed tasks one by one |
| Need to limit concurrent async operations | `SemaphoreSlim` | Throttles access to limited resources |
| Need to process a collection with bounded parallelism | `Parallel.ForEachAsync` | Built-in degree-of-parallelism control |
| Need producer-consumer queue | `Channel<T>` | Supports async readers, writers, and backpressure |
| Need multi-stage processing pipeline | TPL Dataflow | Supports linked blocks, completion, and bounded capacity |
| Need CPU-bound work off the caller thread | `Task.Run` | Uses the thread pool for background CPU work |
| Need reliable background work after a request | Hosted service or message queue | Avoids request-scope fire-and-forget problems |

### Common Mistakes

Common mistakes include:

- Awaiting each task immediately when the operations could run concurrently.
- Creating thousands of tasks without throttling.
- Using `Task.Run` to wrap already asynchronous I/O.
- Blocking with `.Result`, `.Wait()`, or `Task.WaitAll()` inside async code.
- Forgetting to await a task.
- Using `async void` except for event handlers.
- Assuming `Task.WhenAny` cancels remaining tasks automatically.
- Assuming `Task.WhenAll` creates new threads.
- Modifying `List<T>` or other non-thread-safe collections from multiple tasks.
- Running parallel EF Core operations on the same `DbContext`.
- Forgetting to release `SemaphoreSlim` in a `finally` block.
- Swallowing exceptions from background tasks.
- Ignoring cancellation tokens.

### Best Practices

Good habits for coordinating multiple tasks:

- Start independent asynchronous operations before awaiting them.
- Use `Task.WhenAll` for independent operations where all results are required.
- Use `Task.WhenAny` or `Task.WhenEach` when completion order matters.
- Use throttling for large collections or limited downstream systems.
- Prefer `Parallel.ForEachAsync` for simple bounded parallel item processing.
- Prefer channels or queues for producer-consumer workloads.
- Propagate `CancellationToken` through every async layer.
- Avoid shared mutable state; combine task results after awaiting.
- Use thread-safe collections only when shared writes are truly needed.
- Handle exceptions deliberately, especially when partial failure is possible.
- Avoid blocking async code with synchronous waits.
- Avoid fire-and-forget work unless it is routed through a reliable background processing mechanism.
- Measure performance before and after adding concurrency; more concurrency is not always faster.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

####  What does it mean to coordinate multiple tasks in C#?

<!-- question:start:coordinating-multiple-tasks-beginner-q01 -->
<!-- question-id:coordinating-multiple-tasks-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Coordinating multiple tasks means managing several asynchronous or parallel operations together. This can include starting them, waiting for all of them, waiting for the first one to complete, canceling remaining work, handling exceptions, limiting concurrency, or processing results as they complete.

In C#, common APIs for task coordination include `Task.WhenAll`, `Task.WhenAny`, `Task.WhenEach`, `Parallel.ForEachAsync`, `SemaphoreSlim`, `CancellationToken`, channels, and sometimes TPL Dataflow.

A simple example is loading a user profile, recent orders, and notifications at the same time instead of waiting for each call sequentially.

##### Key Points to Mention

- Coordination means managing multiple operations together.
- It is common in API calls, database calls, file processing, and background jobs.
- `Task.WhenAll` waits for all tasks.
- `Task.WhenAny` waits for the first task.
- Coordination should include exception, cancellation, and resource-limit handling.

<!-- question:end:coordinating-multiple-tasks-beginner-q01 -->

####  What is the difference between awaiting tasks sequentially and using Task.WhenAll?

<!-- question:start:coordinating-multiple-tasks-beginner-q02 -->
<!-- question-id:coordinating-multiple-tasks-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Awaiting tasks sequentially means each operation completes before the next one starts or continues. This is slower when operations are independent.

```csharp
var user = await GetUserAsync();
var orders = await GetOrdersAsync();
var notifications = await GetNotificationsAsync();
```

Using `Task.WhenAll` allows independent tasks to be in progress at the same time:

```csharp
Task<User> userTask = GetUserAsync();
Task<List<Order>> ordersTask = GetOrdersAsync();
Task<List<Notification>> notificationsTask = GetNotificationsAsync();

await Task.WhenAll(userTask, ordersTask, notificationsTask);
```

This can reduce total latency because the application waits for the slowest operation instead of the sum of all operations.

##### Key Points to Mention

- Sequential awaits run one after another.
- Concurrent tasks are started before awaiting.
- `Task.WhenAll` waits for all supplied tasks to finish.
- Useful only when operations are independent.
- Concurrency can improve latency but may increase load.

<!-- question:end:coordinating-multiple-tasks-beginner-q02 -->

####  Does Task.WhenAll start tasks?

<!-- question:start:coordinating-multiple-tasks-beginner-q03 -->
<!-- question-id:coordinating-multiple-tasks-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

No, `Task.WhenAll` does not start tasks in the general sense. It creates a task that completes when all supplied tasks complete. The supplied tasks are usually already started when their asynchronous methods are called.

For example:

```csharp
Task<string> task1 = service.GetAAsync();
Task<string> task2 = service.GetBAsync();

string[] results = await Task.WhenAll(task1, task2);
```

The calls to `GetAAsync` and `GetBAsync` create and usually start the asynchronous operations. `Task.WhenAll` only waits for their completion as a group.

##### Key Points to Mention

- `Task.WhenAll` coordinates existing tasks.
- The async method call usually starts the operation.
- `Task.WhenAll` itself does not create extra threads.
- This is an important distinction in interviews.

<!-- question:end:coordinating-multiple-tasks-beginner-q03 -->

####  What is Task.WhenAny used for?

<!-- question:start:coordinating-multiple-tasks-beginner-q04 -->
<!-- question-id:coordinating-multiple-tasks-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`Task.WhenAny` is used when code should continue after the first task completes. It returns the completed task. The completed task still needs to be awaited to get its result or exception.

```csharp
Task<string> taskA = providerA.GetAsync();
Task<string> taskB = providerB.GetAsync();

Task<string> completed = await Task.WhenAny(taskA, taskB);
string result = await completed;
```

It is useful for fastest-response scenarios, timeouts, races between operations, or processing tasks one at a time as they finish.

##### Key Points to Mention

- `Task.WhenAny` waits for the first task to complete.
- It returns the completed task, not the result directly.
- Other tasks continue running unless canceled.
- Await the completed task to observe result or exception.

<!-- question:end:coordinating-multiple-tasks-beginner-q04 -->

####  What is the difference between concurrency and parallelism?

<!-- question:start:coordinating-multiple-tasks-beginner-q05 -->
<!-- question-id:coordinating-multiple-tasks-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Concurrency means multiple operations are in progress during the same time period. Parallelism means multiple operations execute at the same instant, usually on different CPU cores.

In C#, `async` and `await` are commonly used for I/O-bound concurrency. They allow the application to continue doing other work while waiting for I/O. CPU-bound parallelism usually involves threads, `Task.Run`, `Parallel.For`, or `Parallel.ForEachAsync`.

##### Key Points to Mention

- Concurrency is about overlapping progress.
- Parallelism is about simultaneous execution.
- Async I/O does not necessarily use one thread per operation.
- CPU-bound work may benefit from parallelism.
- More parallelism is not always better.

<!-- question:end:coordinating-multiple-tasks-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

####  How do exceptions behave with Task.WhenAll?

<!-- question:start:coordinating-multiple-tasks-intermediate-q01 -->
<!-- question-id:coordinating-multiple-tasks-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

If any supplied task fails, the task returned by `Task.WhenAll` becomes faulted. When awaited, an exception is thrown. If multiple tasks fail, the returned task stores multiple exceptions in its `Exception` property.

A robust pattern is to keep a reference to the `Task.WhenAll` task and inspect its exceptions if needed:

```csharp
Task allTasks = Task.WhenAll(tasks);

try
{
    await allTasks;
}
catch
{
    foreach (Exception exception in allTasks.Exception?.Flatten().InnerExceptions ?? [])
    {
        logger.LogError(exception, "One of the tasks failed.");
    }

    throw;
}
```

The correct handling depends on whether partial success is acceptable or the entire operation should fail.

##### Key Points to Mention

- `Task.WhenAll` becomes faulted if any task faults.
- Multiple tasks can fail.
- Awaiting throws an exception.
- Inspect `Task.Exception` if all failures are important.
- Do not swallow exceptions silently.

<!-- question:end:coordinating-multiple-tasks-intermediate-q01 -->

####  How do you limit the number of tasks running at the same time?

<!-- question:start:coordinating-multiple-tasks-intermediate-q02 -->
<!-- question-id:coordinating-multiple-tasks-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A common way is to use `SemaphoreSlim` to throttle concurrency.

```csharp
using var semaphore = new SemaphoreSlim(5);

Task[] tasks = items.Select(async item =>
{
    await semaphore.WaitAsync(cancellationToken);

    try
    {
        await ProcessItemAsync(item, cancellationToken);
    }
    finally
    {
        semaphore.Release();
    }
}).ToArray();

await Task.WhenAll(tasks);
```

Another option is `Parallel.ForEachAsync`, which has built-in `MaxDegreeOfParallelism` support.

```csharp
await Parallel.ForEachAsync(items, new ParallelOptions
{
    MaxDegreeOfParallelism = 5,
    CancellationToken = cancellationToken
}, async (item, token) =>
{
    await ProcessItemAsync(item, token);
});
```

Throttling is important when working with APIs, databases, file systems, or other limited resources.

##### Key Points to Mention

- Use `SemaphoreSlim` for async throttling.
- Always release the semaphore in a `finally` block.
- `Parallel.ForEachAsync` is useful for collection processing.
- Throttling protects downstream systems.
- Unbounded concurrency can cause outages or poor performance.

<!-- question:end:coordinating-multiple-tasks-intermediate-q02 -->

####  Why is fire-and-forget risky in C#?

<!-- question:start:coordinating-multiple-tasks-intermediate-q03 -->
<!-- question-id:coordinating-multiple-tasks-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Fire-and-forget means starting a task without awaiting it. This is risky because exceptions may be lost, scoped services may be disposed before the task completes, cancellation may not be handled, and the application has no reliable signal that the work finished.

```csharp
_ = SendEmailAsync(message, cancellationToken); // Risky if this work matters.
```

In ASP.NET Core, this is especially dangerous if the task uses request-scoped dependencies such as `DbContext`. For important background work, use a background queue, hosted service, message broker, or durable job system.

##### Key Points to Mention

- Exceptions may be unobserved.
- Request-scoped dependencies may be disposed.
- Shutdown and cancellation may not be handled.
- Fire-and-forget is unreliable for important work.
- Prefer hosted services, queues, or durable background jobs.

<!-- question:end:coordinating-multiple-tasks-intermediate-q03 -->

####  How should cancellation be handled when coordinating multiple tasks?

<!-- question:start:coordinating-multiple-tasks-intermediate-q04 -->
<!-- question-id:coordinating-multiple-tasks-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Cancellation should be propagated through the call chain using `CancellationToken`. Each task should pass the token to async APIs and check it in long-running loops. Cancellation is cooperative, so the token only signals that work should stop; it does not forcibly terminate the task.

```csharp
Task[] tasks = ids
    .Select(id => ProcessAsync(id, cancellationToken))
    .ToArray();

await Task.WhenAll(tasks);
```

Inside each operation:

```csharp
private async Task ProcessAsync(int id, CancellationToken cancellationToken)
{
    cancellationToken.ThrowIfCancellationRequested();

    var item = await repository.GetAsync(id, cancellationToken);
    await processor.ProcessAsync(item, cancellationToken);
}
```

When using `Task.WhenAny`, canceling remaining tasks usually requires a linked `CancellationTokenSource`.

##### Key Points to Mention

- Cancellation is cooperative.
- Propagate the same token or a linked token.
- Pass tokens to lower-level async APIs.
- Check tokens in long-running work.
- Cancel remaining tasks explicitly when using race patterns.

<!-- question:end:coordinating-multiple-tasks-intermediate-q04 -->

####  What is the danger of updating a List<T> from multiple tasks?

<!-- question:start:coordinating-multiple-tasks-intermediate-q05 -->
<!-- question-id:coordinating-multiple-tasks-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

`List<T>` is not thread-safe for concurrent writes. If multiple tasks call `Add` at the same time, the list can become corrupted, throw exceptions, lose data, or produce unpredictable results.

Unsafe:

```csharp
var results = new List<Product>();

await Task.WhenAll(ids.Select(async id =>
{
    Product product = await GetProductAsync(id);
    results.Add(product);
}));
```

Safer:

```csharp
Task<Product>[] tasks = ids.Select(GetProductAsync).ToArray();
Product[] results = await Task.WhenAll(tasks);
```

Another option is to use a thread-safe collection such as `ConcurrentBag<T>`, but avoiding shared mutable state is usually cleaner.

##### Key Points to Mention

- `List<T>` is not safe for concurrent writes.
- Prefer task results and combine after awaiting.
- Use concurrent collections only when shared writes are needed.
- Race conditions may be intermittent and hard to reproduce.

<!-- question:end:coordinating-multiple-tasks-intermediate-q05 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

####  How would you process a large number of items concurrently without overloading the system?

<!-- question:start:coordinating-multiple-tasks-advanced-q01 -->
<!-- question-id:coordinating-multiple-tasks-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

The solution should use bounded concurrency. Creating one task per item for a huge input can overload memory, the thread pool, databases, or remote APIs. Better approaches include `Parallel.ForEachAsync` with `MaxDegreeOfParallelism`, `SemaphoreSlim` throttling, batching, channels, or a background queue.

Example with `Parallel.ForEachAsync`:

```csharp
await Parallel.ForEachAsync(items, new ParallelOptions
{
    MaxDegreeOfParallelism = 10,
    CancellationToken = cancellationToken
}, async (item, token) =>
{
    await ProcessItemAsync(item, token);
});
```

For streaming workloads, a bounded channel is often better because it provides backpressure and avoids holding all work in memory.

##### Key Points to Mention

- Avoid unbounded task creation.
- Use bounded concurrency.
- Choose degree of parallelism based on resource limits.
- Use channels for producer-consumer workloads.
- Measure throughput, latency, and downstream pressure.

<!-- question:end:coordinating-multiple-tasks-advanced-q01 -->

####  When would you use channels instead of Task.WhenAll?

<!-- question:start:coordinating-multiple-tasks-advanced-q02 -->
<!-- question-id:coordinating-multiple-tasks-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use `Task.WhenAll` when there is a known finite set of tasks and the program needs to wait for all of them. Use channels when work arrives over time, when producers and consumers should be decoupled, when you need backpressure, or when workers should continuously process items from a queue.

A bounded channel is useful because producers wait when the queue is full, preventing memory growth and protecting downstream systems.

Channels are good for background processing, pipelines, queue-like workloads, and worker pools. `Task.WhenAll` is simpler for small finite sets of independent operations.

##### Key Points to Mention

- `Task.WhenAll` is for a finite set of tasks.
- Channels are for producer-consumer workflows.
- Bounded channels provide backpressure.
- Channels decouple production from consumption.
- Channels are useful for worker pools and streaming workloads.

<!-- question:end:coordinating-multiple-tasks-advanced-q02 -->

####  How would you handle partial failure when coordinating multiple tasks?

<!-- question:start:coordinating-multiple-tasks-advanced-q03 -->
<!-- question-id:coordinating-multiple-tasks-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

The correct approach depends on the business requirement. Some operations require all tasks to succeed. Others allow partial success, retries, fallback values, or compensation.

One pattern is to wrap each task result in a success/failure object so that `Task.WhenAll` completes with a full result set instead of failing on the first observed exception.

```csharp
public sealed record OperationResult<T>(T? Value, Exception? Error)
{
    public bool IsSuccess => Error is null;
}

private async Task<OperationResult<Product>> SafeGetProductAsync(
    int productId,
    CancellationToken cancellationToken)
{
    try
    {
        Product product = await productClient.GetProductAsync(productId, cancellationToken);
        return new OperationResult<Product>(product, null);
    }
    catch (Exception ex) when (ex is not OperationCanceledException)
    {
        return new OperationResult<Product>(null, ex);
    }
}
```

Then coordinate all operations:

```csharp
OperationResult<Product>[] results = await Task.WhenAll(
    productIds.Select(id => SafeGetProductAsync(id, cancellationToken)));
```

This allows the caller to separate successful and failed operations.

##### Key Points to Mention

- Clarify whether partial success is acceptable.
- Avoid losing information about failed tasks.
- Consider retries, fallback values, or compensation.
- Do not accidentally swallow cancellation.
- Use structured result objects when partial success matters.

<!-- question:end:coordinating-multiple-tasks-advanced-q03 -->

####  Why can Task.Run reduce scalability in ASP.NET Core?

<!-- question:start:coordinating-multiple-tasks-advanced-q04 -->
<!-- question-id:coordinating-multiple-tasks-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

`Task.Run` queues work to the thread pool. In ASP.NET Core, request handling already uses thread pool threads. Wrapping blocking I/O in `Task.Run` does not make it truly asynchronous; it just consumes another thread while the operation blocks. Under high load, this can contribute to thread pool starvation and reduce throughput.

For I/O-bound work, prefer truly asynchronous APIs such as `HttpClient.SendAsync`, EF Core async methods, stream async methods, and message broker async APIs. Use `Task.Run` mainly for CPU-bound work when it is appropriate to offload computation.

##### Key Points to Mention

- `Task.Run` uses the thread pool.
- It is useful for CPU-bound work, not for hiding blocking I/O.
- ASP.NET Core already runs requests on thread pool threads.
- Overuse can hurt scalability under load.
- Prefer true async I/O APIs.

<!-- question:end:coordinating-multiple-tasks-advanced-q04 -->

####  How do you coordinate multiple EF Core queries safely?

<!-- question:start:coordinating-multiple-tasks-advanced-q05 -->
<!-- question-id:coordinating-multiple-tasks-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Do not run multiple operations concurrently on the same `DbContext` instance. `DbContext` is designed as a unit-of-work object and is not intended for concurrent use. If multiple pieces of data are needed, first consider using one optimized query, joins, projections, or sequential async queries.

If true parallel database calls are justified, use separate `DbContext` instances, such as through a context factory, and ensure each task owns its own context lifetime.

Problematic:

```csharp
Task<User?> userTask = dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
Task<List<Order>> ordersTask = dbContext.Orders.Where(x => x.UserId == userId).ToListAsync(cancellationToken);

await Task.WhenAll(userTask, ordersTask); // Same DbContext used concurrently.
```

Safer choices:

- Combine the query.
- Run the queries sequentially.
- Use separate contexts if parallel execution is truly needed.
- Measure whether parallel queries improve performance or just increase database pressure.

##### Key Points to Mention

- Avoid concurrent operations on the same `DbContext`.
- Prefer optimized queries before parallel database calls.
- Use separate context instances for true parallelism.
- Parallel DB calls can increase load and contention.
- Measure performance before choosing parallel queries.

<!-- question:end:coordinating-multiple-tasks-advanced-q05 -->

####  How would you design a robust task coordination flow for calling several external APIs?

<!-- question:start:coordinating-multiple-tasks-advanced-q06 -->
<!-- question-id:coordinating-multiple-tasks-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

A robust design should include bounded concurrency, cancellation propagation, timeouts, retries where safe, clear exception handling, logging, metrics, and protection for downstream systems. If all API results are required, use `Task.WhenAll`. If partial success is acceptable, wrap each result in a success/failure model. If there are many items, use throttling with `SemaphoreSlim`, `Parallel.ForEachAsync`, channels, or a resilience library.

Important design considerations:

- Are the calls independent?
- Are all results required?
- Is partial success acceptable?
- What is the maximum safe concurrency?
- What timeouts and retry policies are appropriate?
- How are failures logged and surfaced?
- How is cancellation handled if the client disconnects?
- Are downstream systems rate-limited?

A strong answer should show that task coordination is not only about syntax; it is also about reliability, observability, and resource control.

##### Key Points to Mention

- Use the correct coordination primitive for the requirement.
- Limit concurrency based on downstream capacity.
- Propagate cancellation tokens.
- Use timeouts and retries carefully.
- Decide between all-or-nothing and partial success.
- Log and measure failures, latency, and throughput.

<!-- question:end:coordinating-multiple-tasks-advanced-q06 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
