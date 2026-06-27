---
id: async-and-await-semantics-in-csharp
topic: Async programming, tasks, cancellation, and concurrency
subtopic: Async and Await Semantics 
category: .NET
seoTitle: Async and Await in C# Interview Questions
seoDescription: Learn async and await in C# for technical interviews, including Task, cancellation, exception handling, and common deadlock risks.
canonicalPath: /content/async-and-await-semantics-in-csharp/
---

## Overview

`async` and `await` are C# language features used to write asynchronous code in a readable, sequential style. They are most commonly used with the Task-based Asynchronous Pattern, where asynchronous operations are represented by `Task`, `Task<T>`, `ValueTask`, or `ValueTask<T>`.

Asynchronous programming is important because many modern applications spend time waiting for external work: HTTP calls, database queries, file I/O, message queues, cloud services, timers, and other operations that do not require a thread to actively execute CPU instructions while waiting. In these situations, `async` and `await` allow the application to stay responsive and scalable by returning control to the caller while the operation is in progress.

In C#, `async` does not automatically create a new thread, and `await` does not block the current thread. Instead, the compiler transforms an async method into a state machine. When execution reaches an incomplete awaited operation, the method is suspended, control returns to the caller, and the remaining code is scheduled as a continuation when the awaited operation completes.

This topic is important for interviews because many C# developers can use `async` and `await` syntactically, but interviews often test whether the candidate understands the semantics: how tasks work, what happens before and after `await`, how exceptions are propagated, why deadlocks happen, when to use `Task.WhenAll`, when not to use `Task.Run`, why `async void` is dangerous, and how cancellation and context capture work.

## Core Concepts

### Asynchronous Programming in C#

Asynchronous programming allows code to start an operation and continue later when the operation finishes. It is especially useful for I/O-bound work where the application waits for something outside the current process.

Common examples include:

- Calling an HTTP API
- Querying a database with Entity Framework Core
- Reading or writing files
- Waiting for a message queue operation
- Calling Azure Storage, Service Bus, Cosmos DB, or other cloud services
- Keeping a desktop UI responsive while work is pending
- Handling many concurrent web requests efficiently

Example:

```csharp
public async Task<string> GetUserJsonAsync(HttpClient httpClient, int userId)
{
    string url = $"https://api.example.com/users/{userId}";
    string json = await httpClient.GetStringAsync(url);
    return json;
}
```

This method starts an HTTP request and asynchronously waits for the result. While the HTTP request is in progress, the calling thread is not blocked by the `await`.

### `async` Keyword

The `async` keyword marks a method, lambda expression, or anonymous method as asynchronous. It enables the use of `await` inside the method body and tells the compiler to transform the method into an async state machine.

Example:

```csharp
public async Task<int> CountUsersAsync()
{
    await Task.Delay(100);
    return 10;
}
```

Important points:

- `async` by itself does not make the method run on another thread.
- An async method starts executing synchronously on the calling thread.
- Execution continues synchronously until the method reaches the first incomplete `await`.
- If there is no `await`, the method runs synchronously and the compiler issues a warning.
- Async methods should usually return `Task`, `Task<T>`, `ValueTask`, or `ValueTask<T>`.
- `async void` should generally be avoided except for event handlers.

Common mistake:

```csharp
public async Task<int> GetNumberAsync()
{
    return 42; // No await. This method runs synchronously.
}
```

Better:

```csharp
public Task<int> GetNumberAsync()
{
    return Task.FromResult(42);
}
```

If the method has no actual asynchronous work, do not mark it `async` unnecessarily.

### `await` Operator

The `await` operator asynchronously waits for an awaitable operation to complete.

Example:

```csharp
public async Task ProcessAsync()
{
    Console.WriteLine("Before await");

    await Task.Delay(1000);

    Console.WriteLine("After await");
}
```

The key behavior is:

1. Code before the first incomplete `await` runs synchronously.
2. When an incomplete awaited operation is reached, the async method is suspended.
3. Control returns to the caller.
4. When the awaited operation completes, the remainder of the method continues as a continuation.
5. If the awaited operation has already completed, execution can continue synchronously without suspension.

`await` does not block the thread. This is different from `.Result` or `.Wait()`, which block the thread.

Bad:

```csharp
public string GetData(HttpClient client)
{
    return client.GetStringAsync("https://example.com").Result;
}
```

Better:

```csharp
public async Task<string> GetDataAsync(HttpClient client)
{
    return await client.GetStringAsync("https://example.com");
}
```

### Task-Based Asynchronous Pattern

Most modern .NET asynchronous APIs follow the Task-based Asynchronous Pattern. A `Task` represents an operation that may complete in the future.

Common async return types:

| Return type | Meaning |
|---|---|
| `Task` | An async operation that does not return a value |
| `Task<T>` | An async operation that returns a value of type `T` |
| `ValueTask` | A lower-allocation alternative for some performance-sensitive operations |
| `ValueTask<T>` | A lower-allocation alternative for operations returning `T` |
| `void` | Only for async event handlers in most cases |
| `IAsyncEnumerable<T>` | An asynchronous stream of values |

Example using `Task`:

```csharp
public async Task SaveAsync(Order order)
{
    await repository.SaveAsync(order);
}
```

Example using `Task<T>`:

```csharp
public async Task<Order?> GetOrderAsync(int id)
{
    return await repository.GetByIdAsync(id);
}
```

### How Async Methods Execute

An async method does not immediately become asynchronous just because it has the `async` modifier.

Example:

```csharp
public async Task ExampleAsync()
{
    Console.WriteLine("A");
    await Task.Delay(1000);
    Console.WriteLine("B");
}
```

Execution flow:

1. `ExampleAsync()` is called.
2. `Console.WriteLine("A")` runs immediately on the calling thread.
3. `Task.Delay(1000)` starts a timer-backed task.
4. `await` sees that the task is not complete.
5. The method is suspended.
6. A `Task` is returned to the caller.
7. After the delay completes, the continuation runs and prints `B`.

This behavior is important because code before the first incomplete `await` can still block the caller if it performs expensive synchronous work.

Bad:

```csharp
public async Task<byte[]> DownloadReportAsync(HttpClient client)
{
    Thread.Sleep(5000); // Blocks before the first await.
    return await client.GetByteArrayAsync("https://example.com/report.pdf");
}
```

Better:

```csharp
public async Task<byte[]> DownloadReportAsync(HttpClient client)
{
    await Task.Delay(5000); // Non-blocking delay.
    return await client.GetByteArrayAsync("https://example.com/report.pdf");
}
```

### Compiler-Generated State Machine

The compiler transforms an async method into a state machine. This state machine stores local variables, tracks the current execution point, and resumes execution after awaited operations complete.

You write:

```csharp
public async Task<int> CalculateAsync()
{
    int value = await GetValueAsync();
    return value * 2;
}
```

Conceptually, the compiler creates logic similar to:

- Start method execution.
- Call `GetValueAsync()`.
- If the returned task is incomplete, store the current state.
- Return a task to the caller.
- Register a continuation.
- Resume from the saved state when the task completes.
- Complete the returned task with the result or exception.

Interviewers often ask about this to check whether you understand that `async`/`await` is not magic threading. It is compiler-generated continuation logic built around awaitable operations.

### I/O-Bound Work vs CPU-Bound Work

`async` and `await` are most useful for I/O-bound work.

I/O-bound work waits on external systems:

```csharp
public async Task<Customer?> GetCustomerAsync(int id)
{
    return await dbContext.Customers.FindAsync(id);
}
```

CPU-bound work consumes CPU resources:

```csharp
public decimal CalculatePremium(Policy policy)
{
    // CPU-heavy calculation.
    return calculator.Calculate(policy);
}
```

For CPU-bound work, `async` does not make the calculation faster. If you need to move CPU-bound work away from a UI thread, `Task.Run` can be useful.

Example in a desktop UI app:

```csharp
private async void CalculateButton_Click(object sender, EventArgs e)
{
    decimal result = await Task.Run(() => CalculateLargeReport());
    resultLabel.Text = result.ToString("N2");
}
```

In ASP.NET Core request handling, avoid wrapping normal synchronous CPU work in `Task.Run` just to make it look async. It usually only moves work from one thread pool thread to another and can reduce scalability under load.

### `Task.Run` vs True Async I/O

`Task.Run` schedules work on the thread pool. It is useful for CPU-bound work that should run on a background thread, especially in client applications.

True async I/O does not require a thread to sit blocked while waiting.

CPU-bound example:

```csharp
public Task<int> CalculateAsync()
{
    return Task.Run(() => ExpensiveCpuCalculation());
}
```

I/O-bound example:

```csharp
public async Task<string> ReadFileAsync(string path)
{
    return await File.ReadAllTextAsync(path);
}
```

Do not use `Task.Run` around already asynchronous I/O:

```csharp
// Poor practice
public Task<string> GetDataAsync(HttpClient client)
{
    return Task.Run(() => client.GetStringAsync("https://example.com"));
}
```

Better:

```csharp
public Task<string> GetDataAsync(HttpClient client)
{
    return client.GetStringAsync("https://example.com");
}
```

### Async Return Types

Use the return type that matches the operation.

Use `Task` when the operation has no result:

```csharp
public async Task SendEmailAsync(EmailMessage message)
{
    await emailSender.SendAsync(message);
}
```

Use `Task<T>` when the operation returns a result:

```csharp
public async Task<UserDto> GetUserAsync(int id)
{
    User user = await userRepository.GetRequiredAsync(id);
    return new UserDto(user.Id, user.Name);
}
```

Use `ValueTask<T>` carefully in performance-sensitive code where the operation frequently completes synchronously:

```csharp
public ValueTask<User?> TryGetCachedUserAsync(int id)
{
    if (cache.TryGetValue(id, out User? user))
    {
        return ValueTask.FromResult(user);
    }

    return new ValueTask<User?>(database.GetUserAsync(id));
}
```

Do not use `ValueTask<T>` everywhere by default. It makes APIs more complex and has usage rules that developers must understand. `Task<T>` is the default choice for most application code.

Use `async void` only for event handlers:

```csharp
private async void SaveButton_Click(object sender, EventArgs e)
{
    await SaveAsync();
}
```

Avoid this in application services:

```csharp
public async void SaveUserAsync(User user)
{
    await repository.SaveAsync(user);
}
```

Better:

```csharp
public async Task SaveUserAsync(User user)
{
    await repository.SaveAsync(user);
}
```

### `async void` Pitfalls

`async void` is dangerous because the caller cannot await it, cannot reliably catch its exceptions, and cannot know when it completes.

Bad:

```csharp
public async void ProcessOrderAsync(Order order)
{
    await paymentService.ChargeAsync(order);
    await orderRepository.SaveAsync(order);
}
```

A caller cannot do this:

```csharp
await ProcessOrderAsync(order); // Not possible because the method returns void.
```

Better:

```csharp
public async Task ProcessOrderAsync(Order order)
{
    await paymentService.ChargeAsync(order);
    await orderRepository.SaveAsync(order);
}
```

Acceptable use:

```csharp
private async void Button_Click(object sender, EventArgs e)
{
    try
    {
        await ProcessOrderAsync(currentOrder);
    }
    catch (Exception ex)
    {
        ShowError(ex.Message);
    }
}
```

For event handlers, `async void` is usually required by the event signature, but the handler should catch and handle exceptions internally.

### Exception Semantics

Exceptions in async code are stored in the returned task and rethrown when awaited.

Example:

```csharp
public async Task<int> DivideAsync(int a, int b)
{
    await Task.Delay(100);
    return a / b;
}
```

Caller:

```csharp
try
{
    int result = await DivideAsync(10, 0);
}
catch (DivideByZeroException ex)
{
    Console.WriteLine(ex.Message);
}
```

The exception is observed at the `await` point.

Important details:

- `await` rethrows the exception from a faulted task.
- `try/catch` works naturally with `await`.
- A task can be completed successfully, faulted, or canceled.
- Blocking with `.Wait()` or `.Result` can wrap exceptions differently and can cause deadlocks.
- `Task.WhenAll` can involve multiple exceptions.

Example with `Task.WhenAll`:

```csharp
Task first = CallServiceAAsync();
Task second = CallServiceBAsync();

try
{
    await Task.WhenAll(first, second);
}
catch
{
    if (first.Exception is not null)
    {
        // Inspect first task errors if needed.
    }

    if (second.Exception is not null)
    {
        // Inspect second task errors if needed.
    }

    throw;
}
```

When multiple tasks fail, the returned task contains the exception information. If you need every exception, inspect the individual tasks or the `Exception` property of the task returned by `Task.WhenAll`.

### Cancellation Semantics

Cancellation in .NET async code is cooperative. A caller passes a `CancellationToken`, and the async operation checks or forwards that token.

Example:

```csharp
public async Task<string> DownloadAsync(HttpClient client, CancellationToken cancellationToken)
{
    return await client.GetStringAsync("https://example.com", cancellationToken);
}
```

Example with explicit checking:

```csharp
public async Task ProcessItemsAsync(
    IEnumerable<Item> items,
    CancellationToken cancellationToken)
{
    foreach (Item item in items)
    {
        cancellationToken.ThrowIfCancellationRequested();
        await ProcessItemAsync(item, cancellationToken);
    }
}
```

Important points:

- Cancellation is not forced thread termination.
- The operation must observe the token.
- Canceled tasks are different from faulted tasks.
- Cancellation usually results in `OperationCanceledException` or `TaskCanceledException`.
- APIs should accept and pass `CancellationToken` where cancellation matters.

Common ASP.NET Core example:

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<UserDto>> GetUser(
    int id,
    CancellationToken cancellationToken)
{
    UserDto? user = await userService.GetUserAsync(id, cancellationToken);

    return user is null ? NotFound() : Ok(user);
}
```

ASP.NET Core can bind the request cancellation token, allowing downstream operations to stop when the client disconnects.

### SynchronizationContext and Continuations

When an async method awaits a task, the continuation may try to resume on the captured context.

A context is important in environments such as:

- WPF
- Windows Forms
- older ASP.NET
- some test frameworks

In UI applications, resuming on the UI context is useful because UI controls usually must be accessed from the UI thread.

Example:

```csharp
private async void LoadButton_Click(object sender, EventArgs e)
{
    string text = await httpClient.GetStringAsync("https://example.com");
    textBox.Text = text; // Resumes on UI context, so this is safe in typical UI apps.
}
```

In library code, you often do not need to resume on the original context. `ConfigureAwait(false)` tells the awaiter that the continuation does not need the captured context.

```csharp
public async Task<string> GetContentAsync(HttpClient client)
{
    return await client
        .GetStringAsync("https://example.com")
        .ConfigureAwait(false);
}
```

Practical guidance:

- Application-level code can usually use normal `await`.
- UI code often needs the captured context to update UI controls.
- General-purpose library code often uses `ConfigureAwait(false)` to avoid unnecessary context capture.
- ASP.NET Core does not rely on the same classic request SynchronizationContext as older ASP.NET, but blocking async code can still cause thread pool starvation and scalability issues.

### Deadlocks and Sync-over-Async

A common async deadlock happens when code blocks on an async operation using `.Result` or `.Wait()` while the async operation tries to resume on the blocked context.

Bad:

```csharp
public string LoadData()
{
    return LoadDataAsync().Result;
}

public async Task<string> LoadDataAsync()
{
    string data = await httpClient.GetStringAsync("https://example.com");
    return data;
}
```

In a UI or classic ASP.NET context, this can deadlock:

1. The caller blocks the context thread with `.Result`.
2. The async operation completes.
3. The continuation tries to resume on the captured context.
4. The context is blocked waiting for `.Result`.
5. Neither side can continue.

Better:

```csharp
public async Task<string> LoadDataAsync()
{
    return await httpClient.GetStringAsync("https://example.com");
}
```

Then call it asynchronously all the way up:

```csharp
string data = await LoadDataAsync();
```

Best practice: avoid mixing synchronous blocking with async code. This is often called sync-over-async.

### `Task.WhenAll` and Concurrent Async Work

`await` inside a loop can accidentally run operations sequentially.

Sequential:

```csharp
foreach (int id in userIds)
{
    User user = await userClient.GetUserAsync(id);
    users.Add(user);
}
```

Concurrent:

```csharp
Task<User>[] tasks = userIds
    .Select(id => userClient.GetUserAsync(id))
    .ToArray();

User[] users = await Task.WhenAll(tasks);
```

Use `Task.WhenAll` when operations are independent and can safely run at the same time.

Be careful with:

- Too many concurrent requests
- Rate limits
- Database connection pool limits
- External API throttling
- Memory pressure
- Ordering requirements

For large workloads, limit concurrency:

```csharp
public async Task ProcessAllAsync(IEnumerable<int> ids, CancellationToken cancellationToken)
{
    using SemaphoreSlim semaphore = new(initialCount: 10);

    Task[] tasks = ids.Select(async id =>
    {
        await semaphore.WaitAsync(cancellationToken);
        try
        {
            await ProcessOneAsync(id, cancellationToken);
        }
        finally
        {
            semaphore.Release();
        }
    }).ToArray();

    await Task.WhenAll(tasks);
}
```

### `Task.WhenAny` and Processing as Tasks Complete

`Task.WhenAny` completes when any task in a set completes. It is useful for timeouts, racing operations, or processing results as they arrive.

Example:

```csharp
Task<string> apiCall = client.GetStringAsync("https://example.com");
Task timeout = Task.Delay(TimeSpan.FromSeconds(3));

Task completed = await Task.WhenAny(apiCall, timeout);

if (completed == timeout)
{
    throw new TimeoutException();
}

string result = await apiCall;
```

Important detail: `Task.WhenAny` returns the completed task. You still need to await that task to get its result or observe its exception.

### Fire-and-Forget Work

Fire-and-forget means starting async work without awaiting it.

Bad:

```csharp
public Task CreateOrderAsync(Order order)
{
    _ = emailSender.SendConfirmationAsync(order.Email);
    return orderRepository.SaveAsync(order);
}
```

Problems:

- Exceptions may go unobserved.
- The operation may outlive the request scope.
- Scoped services may be disposed before the work completes.
- The application may shut down before the work finishes.
- There is no retry or monitoring strategy.

Better for ASP.NET Core production code:

```csharp
public async Task CreateOrderAsync(Order order)
{
    await orderRepository.SaveAsync(order);
    await backgroundQueue.EnqueueAsync(new SendOrderEmailMessage(order.Id));
}
```

Use a background queue, hosted service, message broker, or durable workflow for reliable background processing.

### Asynchronous Streams with `IAsyncEnumerable<T>`

`IAsyncEnumerable<T>` represents a stream of values produced asynchronously. It is useful when values arrive over time or when loading all values into memory at once is not ideal.

Example:

```csharp
public async IAsyncEnumerable<string> ReadLinesAsync(string path)
{
    using StreamReader reader = File.OpenText(path);

    while (await reader.ReadLineAsync() is { } line)
    {
        yield return line;
    }
}
```

Consuming it:

```csharp
await foreach (string line in ReadLinesAsync("data.txt"))
{
    Console.WriteLine(line);
}
```

Useful scenarios:

- Reading large files
- Streaming database results
- Streaming API responses
- Processing messages over time

When cancellation is needed, design the async stream to accept a `CancellationToken`.

### Async Disposal with `IAsyncDisposable`

Some resources require asynchronous cleanup, such as flushing buffers or closing network resources.

Example:

```csharp
await using var stream = new FileStream(
    path,
    FileMode.Create,
    FileAccess.Write,
    FileShare.None,
    bufferSize: 4096,
    useAsync: true);

await stream.WriteAsync(buffer);
```

`await using` works with types that implement `IAsyncDisposable`.

This matters in interviews because candidates should know that async code can affect resource cleanup patterns, not only method calls.

### Common Mistakes

Common mistakes include:

- Believing `async` automatically creates a new thread
- Blocking on async code with `.Result` or `.Wait()`
- Using `async void` outside event handlers
- Forgetting to await a task
- Fire-and-forget without error handling or lifecycle management
- Using `Task.Run` around naturally asynchronous I/O
- Awaiting inside a loop when `Task.WhenAll` is appropriate
- Using unlimited concurrency
- Ignoring cancellation tokens
- Catching exceptions too broadly and hiding failures
- Returning `ValueTask<T>` everywhere without a real performance reason
- Assuming `ConfigureAwait(false)` is always required in application code
- Doing expensive synchronous work before the first `await`

Example of a forgotten await:

```csharp
public async Task SaveAsync(Order order)
{
    repository.SaveAsync(order); // Missing await.
    await auditLog.WriteAsync("Order saved");
}
```

Better:

```csharp
public async Task SaveAsync(Order order)
{
    await repository.SaveAsync(order);
    await auditLog.WriteAsync("Order saved");
}
```

### Best Practices

Use these practices in production C# code:

- Use async APIs for I/O-bound work.
- Use `Task` or `Task<T>` by default.
- Avoid `async void` except for event handlers.
- Avoid `.Result`, `.Wait()`, and `GetAwaiter().GetResult()` in normal application code.
- Prefer async all the way through the call chain.
- Pass `CancellationToken` to I/O and long-running operations.
- Use `Task.WhenAll` for independent concurrent operations.
- Limit concurrency for large workloads.
- Handle exceptions where meaningful recovery or translation is possible.
- Use `ConfigureAwait(false)` mainly in reusable library code when the original context is not needed.
- Avoid wrapping true async I/O in `Task.Run`.
- Use `ValueTask<T>` only when measurement or API design justifies it.
- Use background services, queues, or message brokers for reliable background work.
- Name asynchronous methods with the `Async` suffix.

Example service method:

```csharp
public async Task<OrderDto> GetOrderAsync(
    int orderId,
    CancellationToken cancellationToken)
{
    Order order = await orderRepository.GetRequiredAsync(orderId, cancellationToken);

    Customer customer = await customerRepository.GetRequiredAsync(
        order.CustomerId,
        cancellationToken);

    return new OrderDto(
        order.Id,
        customer.Name,
        order.TotalAmount);
}
```

If the order and customer calls are independent, run them concurrently:

```csharp
public async Task<OrderSummaryDto> GetOrderSummaryAsync(
    int orderId,
    int customerId,
    CancellationToken cancellationToken)
{
    Task<Order> orderTask = orderRepository.GetRequiredAsync(orderId, cancellationToken);
    Task<Customer> customerTask = customerRepository.GetRequiredAsync(customerId, cancellationToken);

    await Task.WhenAll(orderTask, customerTask);

    Order order = await orderTask;
    Customer customer = await customerTask;

    return new OrderSummaryDto(order.Id, customer.Name, order.TotalAmount);
}
```

### Async in ASP.NET Core

ASP.NET Core applications commonly use async code for database access, HTTP calls, cloud SDKs, and file operations.

Example:

```csharp
[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    private readonly AppDbContext dbContext;

    public OrdersController(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderDto>> GetById(
        int id,
        CancellationToken cancellationToken)
    {
        OrderDto? order = await dbContext.Orders
            .Where(o => o.Id == id)
            .Select(o => new OrderDto(o.Id, o.CustomerName, o.TotalAmount))
            .SingleOrDefaultAsync(cancellationToken);

        return order is null ? NotFound() : Ok(order);
    }
}
```

Why async matters in ASP.NET Core:

- Frees request-handling threads while waiting for I/O
- Improves scalability under many concurrent requests
- Prevents thread pool starvation caused by blocking waits
- Supports cancellation when clients disconnect
- Integrates naturally with EF Core, HttpClient, and Azure SDKs

Avoid:

```csharp
OrderDto? order = dbContext.Orders
    .Where(o => o.Id == id)
    .Select(o => new OrderDto(o.Id, o.CustomerName, o.TotalAmount))
    .SingleOrDefaultAsync()
    .Result;
```

Prefer:

```csharp
OrderDto? order = await dbContext.Orders
    .Where(o => o.Id == id)
    .Select(o => new OrderDto(o.Id, o.CustomerName, o.TotalAmount))
    .SingleOrDefaultAsync(cancellationToken);
```

### Async in Libraries

Reusable libraries should expose async APIs when they perform asynchronous work.

Example:

```csharp
public interface IFileStorage
{
    Task UploadAsync(
        string path,
        Stream content,
        CancellationToken cancellationToken = default);
}
```

Implementation:

```csharp
public sealed class BlobFileStorage : IFileStorage
{
    private readonly BlobContainerClient container;

    public BlobFileStorage(BlobContainerClient container)
    {
        this.container = container;
    }

    public async Task UploadAsync(
        string path,
        Stream content,
        CancellationToken cancellationToken = default)
    {
        BlobClient blob = container.GetBlobClient(path);

        await blob.UploadAsync(
            content,
            overwrite: true,
            cancellationToken: cancellationToken).ConfigureAwait(false);
    }
}
```

In library code, `ConfigureAwait(false)` is often appropriate because the library usually does not need to resume on a caller-specific UI or request context.

### Performance Considerations

Async code improves scalability for I/O-bound workloads, but it is not free.

Costs can include:

- State machine allocation or overhead
- Task allocation
- Continuation scheduling
- Capturing execution context
- More complex stack traces
- More complex debugging

Performance guidance:

- Do not make trivial synchronous code async without reason.
- Avoid unnecessary `async`/`await` when directly returning a task is sufficient and exception semantics are understood.
- Use `ValueTask<T>` only for hot paths where synchronous completion is common and measurement supports it.
- Avoid creating too many tasks for huge collections without throttling.
- Use true async I/O instead of `Task.Run` for I/O.

Example where returning a task directly is fine:

```csharp
public Task<User?> GetUserAsync(int id, CancellationToken cancellationToken)
{
    return userRepository.GetByIdAsync(id, cancellationToken);
}
```

Example where `async`/`await` is useful for exception handling or additional logic:

```csharp
public async Task<UserDto?> GetUserDtoAsync(int id, CancellationToken cancellationToken)
{
    User? user = await userRepository.GetByIdAsync(id, cancellationToken);

    return user is null
        ? null
        : new UserDto(user.Id, user.Name);
}
```

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:async-and-await-semantics-in-csharp-beginner-q01 -->
#### Beginner Q01: What are `async` and `await` in C#?
<!-- question-id:async-and-await-semantics-in-csharp-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

`async` and `await` are C# language features used to write asynchronous code in a readable way. The `async` keyword enables the use of `await` inside a method and causes the compiler to transform the method into a state machine. The `await` operator asynchronously waits for an awaitable operation, usually a `Task` or `Task<T>`, to complete.

The important point is that `await` does not block the thread. If the awaited operation has not completed, the method is suspended and control returns to the caller. When the operation completes, the rest of the method continues.

Example:

```csharp
public async Task<string> GetPageAsync(HttpClient client)
{
    string html = await client.GetStringAsync("https://example.com");
    return html;
}
```

This is useful for I/O-bound operations such as HTTP requests, database queries, and file operations.

##### Key Points to Mention

- `async` enables `await` and compiler state-machine generation.
- `await` asynchronously waits for completion.
- `await` does not block the thread.
- Most async methods return `Task` or `Task<T>`.
- Common use cases are I/O-bound operations.

<!-- question:end:async-and-await-semantics-in-csharp-beginner-q01 -->

<!-- question:start:async-and-await-semantics-in-csharp-beginner-q02 -->
#### Beginner Q02: Does `async` create a new thread?
<!-- question-id:async-and-await-semantics-in-csharp-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

No. The `async` keyword does not create a new thread. An async method starts executing synchronously on the calling thread. It continues synchronously until it reaches the first incomplete `await`. At that point, the method is suspended and control returns to the caller.

If the awaited operation represents true asynchronous I/O, no thread needs to be blocked while waiting for the operation to complete. When the operation completes, the continuation is scheduled to run.

If you want to run CPU-bound work on another thread, you typically use `Task.Run`, but that is different from true async I/O.

##### Key Points to Mention

- `async` does not mean background thread.
- Code before the first incomplete `await` runs synchronously.
- True async I/O does not require a blocked thread.
- Use `Task.Run` only when you intentionally want thread-pool execution for CPU-bound work.

<!-- question:end:async-and-await-semantics-in-csharp-beginner-q02 -->

<!-- question:start:async-and-await-semantics-in-csharp-beginner-q03 -->
#### Beginner Q03: What is the difference between `Task` and `Task<T>`?
<!-- question-id:async-and-await-semantics-in-csharp-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`Task` represents an asynchronous operation that does not return a value. `Task<T>` represents an asynchronous operation that returns a value of type `T`.

Example using `Task`:

```csharp
public async Task SaveAsync(Order order)
{
    await repository.SaveAsync(order);
}
```

Example using `Task<T>`:

```csharp
public async Task<Order?> GetOrderAsync(int id)
{
    return await repository.GetByIdAsync(id);
}
```

When awaiting a `Task`, the result is `void`. When awaiting a `Task<T>`, the result is a value of type `T`.

##### Key Points to Mention

- `Task` means async operation with no return value.
- `Task<T>` means async operation that returns `T`.
- Both can complete successfully, fault, or be canceled.
- `await Task<T>` produces a `T` value.

<!-- question:end:async-and-await-semantics-in-csharp-beginner-q03 -->

<!-- question:start:async-and-await-semantics-in-csharp-beginner-q04 -->
#### Beginner Q04: Why should most async methods return `Task` instead of `void`?
<!-- question-id:async-and-await-semantics-in-csharp-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Most async methods should return `Task` or `Task<T>` because callers can await them, catch exceptions from them, and know when they have completed. `async void` should generally be used only for event handlers because a `void`-returning async method cannot be awaited by the caller.

Bad:

```csharp
public async void SaveAsync(Order order)
{
    await repository.SaveAsync(order);
}
```

Better:

```csharp
public async Task SaveAsync(Order order)
{
    await repository.SaveAsync(order);
}
```

With the `Task`-returning version, callers can write:

```csharp
await SaveAsync(order);
```

##### Key Points to Mention

- `async void` cannot be awaited.
- Exceptions from `async void` are harder to handle.
- `Task` allows completion tracking and error handling.
- `async void` is mainly for event handlers.

<!-- question:end:async-and-await-semantics-in-csharp-beginner-q04 -->

<!-- question:start:async-and-await-semantics-in-csharp-beginner-q05 -->
#### Beginner Q05: What happens when an async method reaches an `await`?
<!-- question-id:async-and-await-semantics-in-csharp-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

When an async method reaches an `await`, it checks whether the awaited operation is already complete. If it is complete, execution continues immediately. If it is not complete, the method is suspended, the current state is saved, control returns to the caller, and the rest of the method is registered as a continuation.

When the awaited operation finishes, the continuation runs and the method continues from the point after the `await`.

##### Key Points to Mention

- If the awaited task is complete, execution can continue synchronously.
- If incomplete, the method is suspended.
- The caller receives control back.
- The compiler-generated state machine stores the method state.
- The remaining code runs later as a continuation.

<!-- question:end:async-and-await-semantics-in-csharp-beginner-q05 -->

<!-- question:start:async-and-await-semantics-in-csharp-beginner-q06 -->
#### Beginner Q06: What is the difference between asynchronous and parallel programming?
<!-- question-id:async-and-await-semantics-in-csharp-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

Asynchronous programming is about not blocking while waiting for an operation to complete. It is commonly used for I/O-bound work such as HTTP calls or database queries.

Parallel programming is about doing multiple pieces of work at the same time, usually to use multiple CPU cores for CPU-bound work.

Async code is not automatically parallel. For example, awaiting one HTTP call is asynchronous but not necessarily parallel. Starting multiple independent tasks and awaiting `Task.WhenAll` can create concurrent asynchronous work.

##### Key Points to Mention

- Async is about waiting without blocking.
- Parallelism is about executing multiple operations at the same time.
- Async is commonly for I/O-bound work.
- Parallelism is commonly for CPU-bound work.
- `Task.WhenAll` can coordinate concurrent async operations.

<!-- question:end:async-and-await-semantics-in-csharp-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:async-and-await-semantics-in-csharp-intermediate-q01 -->
#### Intermediate Q01: What is the difference between `.Result`, `.Wait()`, and `await`?
<!-- question-id:async-and-await-semantics-in-csharp-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

`.Result` and `.Wait()` block the current thread until the task completes. `await` asynchronously waits for the task without blocking the current thread. Blocking can cause deadlocks in environments with a synchronization context, such as UI applications and older ASP.NET applications. It can also cause thread pool starvation in server applications.

Bad:

```csharp
string data = client.GetStringAsync("https://example.com").Result;
```

Better:

```csharp
string data = await client.GetStringAsync("https://example.com");
```

`await` also unwraps exceptions naturally. Blocking APIs can expose exceptions differently and make async code harder to reason about.

##### Key Points to Mention

- `.Result` and `.Wait()` block threads.
- `await` does not block the current thread.
- Blocking async code can deadlock.
- Blocking can reduce scalability in server applications.
- Prefer async all the way through the call chain.

<!-- question:end:async-and-await-semantics-in-csharp-intermediate-q01 -->

<!-- question:start:async-and-await-semantics-in-csharp-intermediate-q02 -->
#### Intermediate Q02: Why can blocking on async code cause a deadlock?
<!-- question-id:async-and-await-semantics-in-csharp-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A deadlock can happen when a thread blocks on an async task while that async task needs to resume on the same context that is blocked.

For example, in a UI application:

```csharp
public string LoadData()
{
    return LoadDataAsync().Result;
}

public async Task<string> LoadDataAsync()
{
    return await httpClient.GetStringAsync("https://example.com");
}
```

The UI thread blocks on `.Result`. The async operation completes and tries to resume its continuation on the UI context. But the UI context is blocked waiting for `.Result`. The result is a deadlock.

The fix is to avoid sync-over-async and use `await` all the way:

```csharp
string data = await LoadDataAsync();
```

##### Key Points to Mention

- Deadlock can involve synchronization context capture.
- `.Result` or `.Wait()` blocks the context thread.
- The continuation may need the same context.
- Use `await` instead of blocking.
- `ConfigureAwait(false)` can help in library code, but it is not a replacement for good async design.

<!-- question:end:async-and-await-semantics-in-csharp-intermediate-q02 -->

<!-- question:start:async-and-await-semantics-in-csharp-intermediate-q03 -->
#### Intermediate Q03: What is `ConfigureAwait(false)` and when should it be used?
<!-- question-id:async-and-await-semantics-in-csharp-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

`ConfigureAwait(false)` tells the awaiter that the continuation does not need to resume on the captured context. This can reduce overhead and avoid certain deadlock patterns in reusable library code.

Example:

```csharp
public async Task<string> GetContentAsync(HttpClient client)
{
    return await client
        .GetStringAsync("https://example.com")
        .ConfigureAwait(false);
}
```

In UI code, you often need the original context after `await` so you can update UI controls. In that case, do not use `ConfigureAwait(false)` before UI access.

In ASP.NET Core application code, normal `await` is usually fine because ASP.NET Core does not depend on the old ASP.NET request synchronization context. In reusable libraries, `ConfigureAwait(false)` is still commonly used when the library does not need a caller-specific context.

##### Key Points to Mention

- Controls whether to capture and resume on the original context.
- Useful in general-purpose library code.
- Avoid it when continuation must run on the UI context.
- It can reduce context-related overhead.
- It is not a substitute for avoiding `.Result` and `.Wait()`.

<!-- question:end:async-and-await-semantics-in-csharp-intermediate-q03 -->

<!-- question:start:async-and-await-semantics-in-csharp-intermediate-q04 -->
#### Intermediate Q04: How are exceptions handled in async methods?
<!-- question-id:async-and-await-semantics-in-csharp-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Exceptions in async methods are captured by the returned task. When the caller awaits the task, the exception is rethrown at the await point, so normal `try/catch` syntax works.

Example:

```csharp
try
{
    int value = await service.CalculateAsync();
}
catch (InvalidOperationException ex)
{
    logger.LogError(ex, "Calculation failed");
}
```

This is one reason returning `Task` or `Task<T>` is important. With `async void`, callers cannot await the method and cannot catch exceptions in the normal way.

With `Task.WhenAll`, multiple tasks can fail. Awaiting the combined task throws an exception, but if you need all exceptions, inspect the tasks or the combined task's exception information.

##### Key Points to Mention

- Async exceptions are stored in the returned task.
- `await` rethrows the exception.
- `try/catch` works around `await`.
- `async void` exceptions are difficult to handle.
- `Task.WhenAll` may involve multiple exceptions.

<!-- question:end:async-and-await-semantics-in-csharp-intermediate-q04 -->

<!-- question:start:async-and-await-semantics-in-csharp-intermediate-q05 -->
#### Intermediate Q05: What is the difference between awaiting tasks sequentially and using `Task.WhenAll`?
<!-- question-id:async-and-await-semantics-in-csharp-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Awaiting tasks sequentially means each operation starts and completes before the next operation starts. `Task.WhenAll` allows multiple independent tasks to run concurrently and waits until all of them complete.

Sequential:

```csharp
User user = await userService.GetUserAsync(userId);
Order[] orders = await orderService.GetOrdersAsync(userId);
```

Concurrent, if operations are independent:

```csharp
Task<User> userTask = userService.GetUserAsync(userId);
Task<Order[]> ordersTask = orderService.GetOrdersAsync(userId);

await Task.WhenAll(userTask, ordersTask);

User user = await userTask;
Order[] orders = await ordersTask;
```

`Task.WhenAll` can improve total latency when operations are independent. However, it must be used carefully to avoid too much concurrency, rate limit problems, database connection pool exhaustion, or excessive memory usage.

##### Key Points to Mention

- Sequential awaits run one after another.
- `Task.WhenAll` coordinates concurrent tasks.
- Use it for independent operations.
- Watch for throttling and resource limits.
- Exceptions and cancellation need careful handling.

<!-- question:end:async-and-await-semantics-in-csharp-intermediate-q05 -->

<!-- question:start:async-and-await-semantics-in-csharp-intermediate-q06 -->
#### Intermediate Q06: When should you use `Task.Run` with async code?
<!-- question-id:async-and-await-semantics-in-csharp-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

`Task.Run` schedules CPU-bound work on the thread pool. It is useful when you want to move expensive CPU work off a UI thread. It is usually not needed for naturally asynchronous I/O operations because those operations already avoid blocking threads.

Useful in UI code:

```csharp
Report report = await Task.Run(() => GenerateLargeReport());
```

Unnecessary for async I/O:

```csharp
// Poor practice
string data = await Task.Run(() => client.GetStringAsync("https://example.com"));
```

Better:

```csharp
string data = await client.GetStringAsync("https://example.com");
```

In ASP.NET Core request code, using `Task.Run` around normal work can reduce scalability because it consumes additional thread pool resources.

##### Key Points to Mention

- `Task.Run` uses the thread pool.
- Useful for CPU-bound work, especially in UI apps.
- Not needed for true async I/O.
- Avoid using it to fake asynchrony in ASP.NET Core.
- It does not make CPU work disappear; it only moves where it runs.

<!-- question:end:async-and-await-semantics-in-csharp-intermediate-q06 -->

<!-- question:start:async-and-await-semantics-in-csharp-intermediate-q07 -->
#### Intermediate Q07: How does cancellation work in async code?
<!-- question-id:async-and-await-semantics-in-csharp-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

Cancellation is cooperative. A caller passes a `CancellationToken`, and the async method either checks the token or passes it to other async APIs. If cancellation is requested, the operation usually throws `OperationCanceledException` or returns a canceled task.

Example:

```csharp
public async Task<User?> GetUserAsync(
    int id,
    CancellationToken cancellationToken)
{
    return await dbContext.Users
        .SingleOrDefaultAsync(u => u.Id == id, cancellationToken);
}
```

For manual loops:

```csharp
foreach (Item item in items)
{
    cancellationToken.ThrowIfCancellationRequested();
    await ProcessAsync(item, cancellationToken);
}
```

Cancellation does not forcibly abort a thread. The operation must observe the token.

##### Key Points to Mention

- Cancellation is cooperative.
- Pass `CancellationToken` to async APIs.
- Use `ThrowIfCancellationRequested` in long-running loops.
- Canceled tasks are different from faulted tasks.
- Important for web requests, background jobs, and long-running operations.

<!-- question:end:async-and-await-semantics-in-csharp-intermediate-q07 -->

<!-- question:start:async-and-await-semantics-in-csharp-intermediate-q08 -->
#### Intermediate Q08: What is the problem with fire-and-forget async code?
<!-- question-id:async-and-await-semantics-in-csharp-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

Fire-and-forget means starting an async operation without awaiting it. This can be dangerous because exceptions may go unobserved, the work may outlive its dependency injection scope, and the application may shut down before the work completes.

Bad:

```csharp
public Task CreateOrderAsync(Order order)
{
    _ = emailSender.SendConfirmationAsync(order.Email);
    return orderRepository.SaveAsync(order);
}
```

In ASP.NET Core, this is especially risky if the background operation uses scoped services from the request.

A better approach is to use a proper background queue, hosted service, message broker, or durable job processor.

##### Key Points to Mention

- Unobserved exceptions are a risk.
- Scoped services may be disposed.
- Work can be lost during shutdown.
- No built-in retry or monitoring.
- Use background services or queues for reliable work.

<!-- question:end:async-and-await-semantics-in-csharp-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:async-and-await-semantics-in-csharp-advanced-q01 -->
#### Advanced Q01: What does the compiler generate for an async method?
<!-- question-id:async-and-await-semantics-in-csharp-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

The compiler transforms an async method into a state machine. The state machine tracks the current execution state, stores local variables that must survive across awaits, registers continuations, and completes the returned task with a result, exception, or cancellation.

For example:

```csharp
public async Task<int> GetValueAsync()
{
    int value = await repository.GetValueAsync();
    return value * 2;
}
```

Conceptually, the generated state machine:

- Starts executing synchronously.
- Calls the awaited operation.
- Checks whether it has completed.
- If incomplete, saves the current state and returns to the caller.
- Registers a continuation to resume later.
- Restores state when the task completes.
- Sets the result or exception on the returned task.

This is why local variables can still be available after an `await`.

##### Key Points to Mention

- Async methods become state machines.
- Local state is preserved across awaits.
- Continuations resume execution.
- The returned task represents final completion.
- This transformation has some overhead.

<!-- question:end:async-and-await-semantics-in-csharp-advanced-q01 -->

<!-- question:start:async-and-await-semantics-in-csharp-advanced-q02 -->
#### Advanced Q02: What is the difference between returning a task directly and awaiting it before returning?
<!-- question-id:async-and-await-semantics-in-csharp-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Returning a task directly avoids creating an additional async state machine when no extra logic is needed.

Example:

```csharp
public Task<User?> GetUserAsync(int id, CancellationToken cancellationToken)
{
    return repository.GetByIdAsync(id, cancellationToken);
}
```

Awaiting before returning is needed when you need to transform the result, use `try/catch/finally`, use `using`/`await using`, perform additional async work, or ensure exceptions happen within the current method's context.

Example:

```csharp
public async Task<UserDto?> GetUserDtoAsync(int id, CancellationToken cancellationToken)
{
    User? user = await repository.GetByIdAsync(id, cancellationToken);

    return user is null ? null : new UserDto(user.Id, user.Name);
}
```

A common pitfall is returning a task from inside a `using` block without awaiting it, which may dispose the resource too early.

Bad:

```csharp
public Task<string> ReadAsync(string path)
{
    using StreamReader reader = File.OpenText(path);
    return reader.ReadToEndAsync();
}
```

Better:

```csharp
public async Task<string> ReadAsync(string path)
{
    using StreamReader reader = File.OpenText(path);
    return await reader.ReadToEndAsync();
}
```

##### Key Points to Mention

- Direct task return can avoid unnecessary state-machine overhead.
- Use `await` when you need transformation, cleanup, error handling, or sequencing.
- Be careful with `using` and resource lifetime.
- Exception timing and stack traces can differ.
- Do not remove `async`/`await` blindly.

<!-- question:end:async-and-await-semantics-in-csharp-advanced-q02 -->

<!-- question:start:async-and-await-semantics-in-csharp-advanced-q03 -->
#### Advanced Q03: How does `Task.WhenAll` handle exceptions?
<!-- question-id:async-and-await-semantics-in-csharp-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

`Task.WhenAll` returns a task that completes when all supplied tasks complete. If any supplied task faults, the returned task faults. If multiple tasks fault, the returned task contains information about multiple exceptions.

When you `await Task.WhenAll(...)`, an exception is thrown at the await point. If you need to inspect all exceptions, you should examine the individual tasks or the exception information from the combined task.

Example:

```csharp
Task first = ServiceAAsync();
Task second = ServiceBAsync();
Task all = Task.WhenAll(first, second);

try
{
    await all;
}
catch
{
    foreach (Exception ex in all.Exception?.InnerExceptions ?? [])
    {
        logger.LogError(ex, "One task failed");
    }

    throw;
}
```

This is important in production code because concurrent operations can fail independently.

##### Key Points to Mention

- `Task.WhenAll` waits for all tasks to complete.
- The combined task faults if any child task faults.
- Multiple exceptions can exist.
- Awaiting rethrows an exception at the await point.
- Inspect the combined task or individual tasks when all errors matter.

<!-- question:end:async-and-await-semantics-in-csharp-advanced-q03 -->

<!-- question:start:async-and-await-semantics-in-csharp-advanced-q04 -->
#### Advanced Q04: When should you use `ValueTask<T>` instead of `Task<T>`?
<!-- question-id:async-and-await-semantics-in-csharp-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

`ValueTask<T>` can reduce allocations when an async operation frequently completes synchronously, such as returning a cached value. It is useful in performance-critical APIs, but it should not be the default choice for normal application code.

Example:

```csharp
public ValueTask<User?> GetCachedUserAsync(int id)
{
    if (cache.TryGetValue(id, out User? user))
    {
        return ValueTask.FromResult(user);
    }

    return new ValueTask<User?>(database.GetUserAsync(id));
}
```

`Task<T>` is simpler and safer for most cases. `ValueTask<T>` has more complex usage rules and can make APIs harder to consume correctly. It should usually be introduced after measurement shows that task allocation is a real performance issue.

##### Key Points to Mention

- Use `Task<T>` by default.
- `ValueTask<T>` can reduce allocations when synchronous completion is common.
- Best for hot paths and library-level performance optimization.
- Adds complexity for consumers.
- Use based on measurement, not habit.

<!-- question:end:async-and-await-semantics-in-csharp-advanced-q04 -->

<!-- question:start:async-and-await-semantics-in-csharp-advanced-q05 -->
#### Advanced Q05: What is thread pool starvation and how can async code contribute to it?
<!-- question-id:async-and-await-semantics-in-csharp-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Thread pool starvation happens when many thread pool threads are blocked, leaving too few available threads to run queued work. Async code can contribute to this if developers block on async operations using `.Result`, `.Wait()`, or `GetAwaiter().GetResult()`.

In a web application, if many requests block threads while waiting for I/O, those threads cannot process other requests or continuations. This can increase latency and reduce throughput.

Bad:

```csharp
public IActionResult Get()
{
    string data = service.GetDataAsync().Result;
    return Ok(data);
}
```

Better:

```csharp
public async Task<IActionResult> Get()
{
    string data = await service.GetDataAsync();
    return Ok(data);
}
```

Async improves scalability only when it is used without blocking.

##### Key Points to Mention

- Starvation occurs when many thread pool threads are blocked.
- Blocking async work can cause starvation.
- Server apps should avoid sync-over-async.
- Async all the way improves scalability for I/O-bound work.
- `Task.Run` misuse can also increase thread pool pressure.

<!-- question:end:async-and-await-semantics-in-csharp-advanced-q05 -->

<!-- question:start:async-and-await-semantics-in-csharp-advanced-q06 -->
#### Advanced Q06: How should you limit concurrency in async code?
<!-- question-id:async-and-await-semantics-in-csharp-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

You should limit concurrency when starting too many operations at once could overload resources such as database connections, HTTP endpoints, memory, or external APIs. A common approach is to use `SemaphoreSlim`.

Example:

```csharp
public async Task ProcessAsync(IEnumerable<int> ids, CancellationToken cancellationToken)
{
    using SemaphoreSlim semaphore = new(10);

    Task[] tasks = ids.Select(async id =>
    {
        await semaphore.WaitAsync(cancellationToken);
        try
        {
            await ProcessOneAsync(id, cancellationToken);
        }
        finally
        {
            semaphore.Release();
        }
    }).ToArray();

    await Task.WhenAll(tasks);
}
```

Other options include channels, background queues, rate limiters, dataflow blocks, or message brokers depending on the workload.

##### Key Points to Mention

- Unlimited `Task.WhenAll` can overload resources.
- Use `SemaphoreSlim` for simple throttling.
- Always release the semaphore in `finally`.
- Pass cancellation tokens.
- For production workloads, consider queues, rate limiters, or worker services.

<!-- question:end:async-and-await-semantics-in-csharp-advanced-q06 -->

<!-- question:start:async-and-await-semantics-in-csharp-advanced-q07 -->
#### Advanced Q07: What are asynchronous streams and when would you use `IAsyncEnumerable<T>`?
<!-- question-id:async-and-await-semantics-in-csharp-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

`IAsyncEnumerable<T>` represents a sequence of values produced asynchronously. It is useful when values are fetched or generated over time and loading everything into memory at once is inefficient.

Producer:

```csharp
public async IAsyncEnumerable<string> ReadLinesAsync(string path)
{
    using StreamReader reader = File.OpenText(path);

    while (await reader.ReadLineAsync() is { } line)
    {
        yield return line;
    }
}
```

Consumer:

```csharp
await foreach (string line in ReadLinesAsync("data.txt"))
{
    Console.WriteLine(line);
}
```

This pattern is useful for streaming files, database results, API responses, or messages.

##### Key Points to Mention

- `IAsyncEnumerable<T>` is an async stream.
- Use `await foreach` to consume it.
- Useful for streaming and large result sets.
- Avoids loading all data into memory at once.
- Consider cancellation and disposal in real implementations.

<!-- question:end:async-and-await-semantics-in-csharp-advanced-q07 -->

<!-- question:start:async-and-await-semantics-in-csharp-advanced-q08 -->
#### Advanced Q08: How do async semantics affect ASP.NET Core scalability?
<!-- question-id:async-and-await-semantics-in-csharp-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

ASP.NET Core uses a thread pool to process requests. When a request performs I/O asynchronously and awaits it, the request thread can return to the pool while the I/O operation is pending. This allows the server to handle more concurrent requests with fewer blocked threads.

Example:

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<OrderDto>> GetOrder(
    int id,
    CancellationToken cancellationToken)
{
    OrderDto? order = await dbContext.Orders
        .Where(o => o.Id == id)
        .Select(o => new OrderDto(o.Id, o.CustomerName, o.TotalAmount))
        .SingleOrDefaultAsync(cancellationToken);

    return order is null ? NotFound() : Ok(order);
}
```

However, async only helps if the code avoids blocking. Blocking with `.Result`, `.Wait()`, synchronous database calls, or unnecessary `Task.Run` can reduce scalability.

##### Key Points to Mention

- Async I/O frees request threads while waiting.
- Improves scalability for I/O-bound workloads.
- Avoid blocking calls in request handlers.
- Pass cancellation tokens to downstream operations.
- Async does not make CPU-bound code faster.

<!-- question:end:async-and-await-semantics-in-csharp-advanced-q08 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
