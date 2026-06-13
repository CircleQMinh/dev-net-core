---
id: cancellationtoken-propagation-in-csharp
topic: Async programming, tasks, cancellation, and concurrency
subtopic: CancellationToken Propagation
category: .NET
---


## Overview

`CancellationToken` propagation is the habit of accepting a cancellation signal at the entry point of an operation and passing that same signal through every layer that performs asynchronous, long-running, or potentially expensive work.

In C#, cancellation is cooperative. A caller can request cancellation, but the running code must choose to observe the request and stop safely. This is different from forcibly killing a thread. The token is only a signal; it does not automatically stop work unless the code being executed checks it or passes it to APIs that check it.

This topic matters because modern .NET applications often perform I/O-heavy work: database queries, HTTP calls, file operations, queue processing, background jobs, streaming, and cloud service calls. If cancellation is ignored, an application can continue doing useless work after a user disconnects, a request times out, a background service is stopping, or a client no longer needs the result.

In interviews, `CancellationToken` questions test whether a developer understands practical async programming, resource usage, ASP.NET Core request handling, EF Core queries, HttpClient calls, graceful shutdown, and production reliability. A strong answer shows that you know not only how to add a token parameter, but also when to propagate it, when to check it, when not to cancel, and how to handle cancellation correctly.

## Core Concepts

### What a CancellationToken Is

A `CancellationToken` is a lightweight value type that represents a cancellation request. It is passed to code that may need to stop before finishing.

The token itself does not start or stop work. It only exposes cancellation state through members such as:

- `IsCancellationRequested`
- `ThrowIfCancellationRequested()`
- `Register(...)`
- `CanBeCanceled`

A token is normally produced by a `CancellationTokenSource`.

```csharp
using var cts = new CancellationTokenSource();

CancellationToken token = cts.Token;

Task work = DoWorkAsync(token);

cts.Cancel();

await work;
```

The important distinction is:

- `CancellationTokenSource` owns the cancellation request.
- `CancellationToken` observes the cancellation request.

Code that starts or controls the operation usually owns the `CancellationTokenSource`. Code that performs the operation usually receives only the `CancellationToken`.

### What Propagation Means

Propagation means passing the same cancellation token from the outer operation into inner operations.

A common ASP.NET Core example:

```csharp
app.MapGet("/orders/{id:int}", async (
    int id,
    CancellationToken cancellationToken,
    IOrderService orderService) =>
{
    OrderDto order = await orderService.GetOrderAsync(id, cancellationToken);
    return Results.Ok(order);
});
```

Then the service passes the same token to the repository:

```csharp
public sealed class OrderService
{
    private readonly IOrderRepository _orders;

    public OrderService(IOrderRepository orders)
    {
        _orders = orders;
    }

    public async Task<OrderDto> GetOrderAsync(
        int id,
        CancellationToken cancellationToken)
    {
        Order order = await _orders.GetByIdAsync(id, cancellationToken);

        return new OrderDto
        {
            Id = order.Id,
            Number = order.Number,
            Total = order.Total
        };
    }
}
```

Then the repository passes it to EF Core:

```csharp
public sealed class OrderRepository
{
    private readonly AppDbContext _dbContext;

    public OrderRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Order> GetByIdAsync(
        int id,
        CancellationToken cancellationToken)
    {
        return await _dbContext.Orders
            .AsNoTracking()
            .SingleAsync(o => o.Id == id, cancellationToken);
    }
}
```

This is proper propagation because the original request cancellation signal reaches the database query.

A poor implementation accepts a token but stops passing it:

```csharp
public async Task<Order> GetByIdAsync(int id, CancellationToken cancellationToken)
{
    // Bad: token is ignored.
    return await _dbContext.Orders.SingleAsync(o => o.Id == id);
}
```

This compiles, but the cancellation signal is lost.

### Cooperative Cancellation

Cancellation in .NET is cooperative. The caller requests cancellation, and the running operation decides how to respond.

For I/O-bound work, pass the token into APIs that support it:

```csharp
HttpResponseMessage response = await httpClient.SendAsync(
    request,
    cancellationToken);
```

```csharp
List<Customer> customers = await dbContext.Customers
    .Where(c => c.IsActive)
    .ToListAsync(cancellationToken);
```

```csharp
await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
```

For CPU-bound work, check the token manually inside loops or between expensive steps:

```csharp
public void GenerateReport(IEnumerable<Order> orders, CancellationToken cancellationToken)
{
    foreach (Order order in orders)
    {
        cancellationToken.ThrowIfCancellationRequested();

        ProcessOrder(order);
    }
}
```

Do not check the token on every tiny operation if it creates unnecessary overhead. Check it at reasonable boundaries: before starting work, inside long loops, before expensive calls, and between major processing steps.

### CancellationTokenSource

`CancellationTokenSource` is the object used to trigger cancellation.

```csharp
using var cts = new CancellationTokenSource();

Task task = LongRunningOperationAsync(cts.Token);

cts.Cancel();

await task;
```

It can also be configured with a timeout:

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

await LongRunningOperationAsync(cts.Token);
```

Or:

```csharp
using var cts = new CancellationTokenSource();

cts.CancelAfter(TimeSpan.FromSeconds(10));

await LongRunningOperationAsync(cts.Token);
```

A `CancellationTokenSource` should be disposed when you own it, especially if it uses timers, registrations, or linked tokens.

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
await SomeOperationAsync(cts.Token);
```

### Linked Cancellation Tokens

Sometimes an operation must stop for more than one reason. For example:

- The HTTP client disconnected.
- The server-side operation exceeded an internal timeout.
- The application is shutting down.

A linked token combines multiple cancellation tokens into one token.

```csharp
public async Task<OrderDto> GetOrderWithTimeoutAsync(
    int id,
    CancellationToken requestCancellationToken)
{
    using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(3));

    using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
        requestCancellationToken,
        timeoutCts.Token);

    return await GetOrderAsync(id, linkedCts.Token);
}
```

The linked token is canceled if either source token is canceled.

This is useful, but it should not be overused. Creating token sources has cost, and linked sources must be disposed. In most methods, simply accept and pass the token you received.

### ASP.NET Core Request Cancellation

In ASP.NET Core, a request has a cancellation token exposed through `HttpContext.RequestAborted`. Minimal APIs and controller actions can accept a `CancellationToken` parameter, which represents the request-aborted signal.

```csharp
[ApiController]
[Route("api/orders")]
public sealed class OrdersController : ControllerBase
{
    private readonly IOrderService _orders;

    public OrdersController(IOrderService orders)
    {
        _orders = orders;
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderDto>> Get(
        int id,
        CancellationToken cancellationToken)
    {
        OrderDto order = await _orders.GetOrderAsync(id, cancellationToken);
        return Ok(order);
    }
}
```

When the client disconnects or the request is aborted, the token is canceled. If that token is propagated to EF Core, HttpClient, file operations, or other async work, those operations may stop earlier and release resources.

This is especially important for:

- Long-running API requests
- Database queries
- External API calls
- File downloads and uploads
- Streaming endpoints
- Report generation
- Search endpoints
- Queue-triggered work that calls other services

### EF Core and CancellationToken

EF Core async execution methods usually accept a cancellation token. Examples include:

```csharp
await dbContext.SaveChangesAsync(cancellationToken);
```

```csharp
Customer? customer = await dbContext.Customers
    .AsNoTracking()
    .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
```

```csharp
List<Customer> customers = await dbContext.Customers
    .Where(c => c.IsActive)
    .OrderBy(c => c.Name)
    .ToListAsync(cancellationToken);
```

Important distinction:

- Query-building methods such as `Where`, `Select`, and `OrderBy` usually do not execute the query.
- Terminal async methods such as `ToListAsync`, `SingleAsync`, `FirstOrDefaultAsync`, and `SaveChangesAsync` execute database I/O and accept cancellation tokens.

A common mistake is building a query with a token in mind but forgetting to pass the token to the terminal operation.

```csharp
// Bad: cancellationToken is not used by the database operation.
var customers = await dbContext.Customers
    .Where(c => c.IsActive)
    .ToListAsync();
```

```csharp
// Good.
var customers = await dbContext.Customers
    .Where(c => c.IsActive)
    .ToListAsync(cancellationToken);
```

Database providers may differ in how completely they honor cancellation. Even so, passing the token is still the correct pattern because it gives the provider and underlying driver the opportunity to cancel.

### HttpClient and External Calls

`HttpClient` methods support cancellation tokens. Propagating the token prevents the server from waiting unnecessarily on an outbound HTTP call after the original caller no longer needs the result.

```csharp
public async Task<ProductDto?> GetProductAsync(
    int id,
    CancellationToken cancellationToken)
{
    using var request = new HttpRequestMessage(
        HttpMethod.Get,
        $"https://example.com/products/{id}");

    using HttpResponseMessage response = await _httpClient.SendAsync(
        request,
        cancellationToken);

    if (response.StatusCode == HttpStatusCode.NotFound)
    {
        return null;
    }

    response.EnsureSuccessStatusCode();

    return await response.Content.ReadFromJsonAsync<ProductDto>(
        cancellationToken);
}
```

For streaming or large responses, cancellation is even more important because reading the response body may take time.

```csharp
using HttpResponseMessage response = await _httpClient.SendAsync(
    request,
    HttpCompletionOption.ResponseHeadersRead,
    cancellationToken);

await using Stream stream = await response.Content.ReadAsStreamAsync(cancellationToken);
```

### OperationCanceledException and TaskCanceledException

When cancellation is observed, .NET code usually throws `OperationCanceledException`. `TaskCanceledException` derives from `OperationCanceledException` and is often seen with task-based asynchronous operations.

Use `ThrowIfCancellationRequested()` when your own code detects cancellation:

```csharp
public async Task ImportAsync(
    IReadOnlyList<CustomerImportRow> rows,
    CancellationToken cancellationToken)
{
    foreach (CustomerImportRow row in rows)
    {
        cancellationToken.ThrowIfCancellationRequested();

        await ValidateRowAsync(row, cancellationToken);
        await SaveRowAsync(row, cancellationToken);
    }
}
```

Do not treat normal cancellation as an application error.

```csharp
try
{
    await service.DoWorkAsync(cancellationToken);
}
catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
{
    // Normal cancellation path.
    // Usually do not log this as an error.
}
```

In application code, cancellation is often logged at debug or information level, not error level, unless it indicates an unexpected timeout or operational problem.

### Method Signature Conventions

A common convention is to place `CancellationToken` as the last parameter.

```csharp
Task<OrderDto> GetOrderAsync(int id, CancellationToken cancellationToken);
```

For public reusable APIs, it is common to provide a default value:

```csharp
public Task<OrderDto> GetOrderAsync(
    int id,
    CancellationToken cancellationToken = default)
{
    // ...
}
```

For internal application layers, many teams prefer requiring the token explicitly so developers do not accidentally ignore propagation:

```csharp
Task<OrderDto> GetOrderAsync(int id, CancellationToken cancellationToken);
```

For ASP.NET Core, MediatR handlers, hosted services, repositories, and services, passing the token explicitly is usually a good habit.

### CancellationToken.None and default

`CancellationToken.None` and `default` both represent a token that will never be canceled.

```csharp
await DoWorkAsync(CancellationToken.None);
```

Use them only when cancellation is intentionally unavailable or not needed. Avoid using them inside lower-level methods when a caller already provided a real token.

Bad:

```csharp
public async Task SendEmailAsync(
    EmailMessage message,
    CancellationToken cancellationToken)
{
    // Bad: discards the caller's token.
    await _httpClient.PostAsJsonAsync("/email", message, CancellationToken.None);
}
```

Good:

```csharp
public async Task SendEmailAsync(
    EmailMessage message,
    CancellationToken cancellationToken)
{
    await _httpClient.PostAsJsonAsync("/email", message, cancellationToken);
}
```

### Do Not Create New Tokens in Every Layer

A lower-level method should usually not create its own `CancellationTokenSource` just because it needs a token. It should accept a token from the caller.

Bad:

```csharp
public async Task<List<Order>> GetOrdersAsync()
{
    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

    return await _dbContext.Orders.ToListAsync(cts.Token);
}
```

This hides timeout behavior inside the repository and prevents the caller from controlling cancellation consistently.

Better:

```csharp
public async Task<List<Order>> GetOrdersAsync(
    CancellationToken cancellationToken)
{
    return await _dbContext.Orders.ToListAsync(cancellationToken);
}
```

If a method needs an internal timeout, combine the caller token with a timeout using a linked token source.

```csharp
public async Task<List<Order>> GetOrdersAsync(
    CancellationToken cancellationToken)
{
    using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

    using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
        cancellationToken,
        timeoutCts.Token);

    return await _dbContext.Orders.ToListAsync(linkedCts.Token);
}
```

### Point of No Cancellation

Cancellation should be safe. There are cases where cancellation should no longer be honored after an operation has passed a point of no cancellation.

Examples:

- A payment has already been submitted.
- A message has already been published and must be recorded.
- A database transaction is being committed.
- A file has been partially written and must be finalized or cleaned up.
- An audit record must be written even if the user disconnected.

Before the point of no cancellation, observe and propagate the token. After that point, either complete the operation or perform compensating cleanup.

Example:

```csharp
public async Task PlaceOrderAsync(
    PlaceOrderRequest request,
    CancellationToken cancellationToken)
{
    cancellationToken.ThrowIfCancellationRequested();

    await ValidateOrderAsync(request, cancellationToken);

    await using var transaction = await _dbContext.Database
        .BeginTransactionAsync(cancellationToken);

    Order order = CreateOrder(request);

    _dbContext.Orders.Add(order);

    await _dbContext.SaveChangesAsync(cancellationToken);

    // Point of no cancellation:
    // After payment is charged, the system must finish recording the result.
    PaymentResult payment = await _paymentGateway.ChargeAsync(
        order.PaymentDetails,
        cancellationToken);

    order.MarkPaid(payment.TransactionId);

    // Depending on business rules, this may intentionally use CancellationToken.None
    // so the local consistency update is not abandoned after payment succeeds.
    await _dbContext.SaveChangesAsync(CancellationToken.None);

    await transaction.CommitAsync(CancellationToken.None);
}
```

This decision depends on business requirements. In interviews, the key point is that cancellation must not leave the system in an inconsistent state.

### Cancellation in Background Services

In `BackgroundService`, the `ExecuteAsync` method receives a stopping token. This token is canceled when the host is shutting down.

```csharp
public sealed class OrderWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OrderWorker> _logger;

    public OrderWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<OrderWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using IServiceScope scope = _scopeFactory.CreateScope();

            var processor = scope.ServiceProvider
                .GetRequiredService<IOrderProcessor>();

            await processor.ProcessNextBatchAsync(stoppingToken);

            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }
}
```

Important habits:

- Pass `stoppingToken` to all async work.
- Pass it to `Task.Delay`.
- Avoid swallowing `OperationCanceledException` as an error during shutdown.
- Keep shutdown paths graceful and idempotent.

### Cancellation in Async Streams

For `IAsyncEnumerable<T>`, cancellation can be passed into async iteration.

```csharp
await foreach (OrderDto order in GetOrdersAsync(cancellationToken)
    .WithCancellation(cancellationToken))
{
    Console.WriteLine(order.Number);
}
```

When writing an async iterator, use `[EnumeratorCancellation]` to connect the caller's cancellation token to the generated async enumerator.

```csharp
using System.Runtime.CompilerServices;

public async IAsyncEnumerable<OrderDto> StreamOrdersAsync(
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    for (int page = 1; page <= 10; page++)
    {
        cancellationToken.ThrowIfCancellationRequested();

        IReadOnlyList<OrderDto> orders = await LoadPageAsync(
            page,
            cancellationToken);

        foreach (OrderDto order in orders)
        {
            yield return order;
        }
    }
}
```

This matters for streaming APIs, large result sets, real-time feeds, and background processing.

### Cancellation with Task.Run and Parallel Work

Passing a token to `Task.Run` can prevent the task from starting if cancellation is already requested, but it does not automatically stop the delegate once it is running. The delegate must still observe the token.

```csharp
Task task = Task.Run(() =>
{
    for (int i = 0; i < 1_000_000; i++)
    {
        cancellationToken.ThrowIfCancellationRequested();

        DoCpuWork(i);
    }
}, cancellationToken);
```

For multiple concurrent operations, pass the same token to each operation.

```csharp
await Task.WhenAll(
    SyncCustomersAsync(cancellationToken),
    SyncOrdersAsync(cancellationToken),
    SyncInvoicesAsync(cancellationToken));
```

`Task.WhenAll` does not add cancellation by itself. The individual tasks must observe the token.

### API Design: Optional vs Required CancellationToken

There are two common styles.

Public library style:

```csharp
public Task<IReadOnlyList<Customer>> SearchAsync(
    string keyword,
    CancellationToken cancellationToken = default);
```

Application-internal style:

```csharp
Task<IReadOnlyList<Customer>> SearchAsync(
    string keyword,
    CancellationToken cancellationToken);
```

The public library style is convenient because callers can ignore cancellation if they do not need it. The application-internal style is stricter because it forces propagation through service, repository, and handler layers.

In production codebases, consistency matters more than personal preference. Teams should define a clear convention.

### Common Mistakes

A frequent mistake is accepting a token but not passing it down.

```csharp
public async Task<List<Order>> SearchAsync(
    string keyword,
    CancellationToken cancellationToken)
{
    return await _dbContext.Orders
        .Where(o => o.Number.Contains(keyword))
        .ToListAsync(); // Token forgotten.
}
```

Another mistake is catching all exceptions and accidentally converting cancellation into a failure.

```csharp
try
{
    await DoWorkAsync(cancellationToken);
}
catch (Exception ex)
{
    // Bad: this also catches OperationCanceledException.
    _logger.LogError(ex, "Work failed.");
    throw;
}
```

Better:

```csharp
try
{
    await DoWorkAsync(cancellationToken);
}
catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
{
    _logger.LogInformation("Work was canceled.");
    throw;
}
catch (Exception ex)
{
    _logger.LogError(ex, "Work failed.");
    throw;
}
```

Another mistake is creating unrelated timeouts deep in the call stack without linking them to the caller token.

```csharp
// Bad: caller cancellation is ignored.
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
await _externalApi.CallAsync(cts.Token);
```

Better:

```csharp
using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
    cancellationToken,
    timeoutCts.Token);

await _externalApi.CallAsync(linkedCts.Token);
```

Another mistake is using cancellation to hide business errors. Cancellation should represent an operation that was requested to stop, not invalid input, failed validation, authorization failure, or a domain rule violation.

### Best Practices

Use these habits in real projects:

- Accept `CancellationToken` in async methods that perform I/O, long-running work, or loops.
- Put `CancellationToken` as the last parameter.
- Propagate the same token to EF Core, HttpClient, file APIs, queue clients, and other async APIs.
- Check the token manually in CPU-bound loops.
- Use `ThrowIfCancellationRequested()` when cancellation should stop the operation by throwing.
- Dispose `CancellationTokenSource` instances that you create.
- Use linked token sources when combining caller cancellation with internal timeouts.
- Avoid `CancellationToken.None` unless cancellation is intentionally not supported at that point.
- Do not log expected cancellation as an application error.
- Think about the point of no cancellation before writes, commits, payments, messages, or other side effects.
- Test cancellation behavior for long-running operations and shutdown paths.

### Comparison: CancellationToken vs Timeout

A timeout is one reason to cancel. A cancellation token is the mechanism used to communicate cancellation.

```csharp
using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

await DownloadAsync(timeoutCts.Token);
```

A token can represent:

- User cancellation
- Browser/client disconnect
- Request timeout
- Host shutdown
- Manual operation cancellation
- Combined cancellation reasons through linked tokens

A timeout is time-based. A token is signal-based.

### Comparison: CancellationToken vs Thread.Abort

`CancellationToken` is cooperative and safe. The running operation decides when and how to stop.

`Thread.Abort` was a forceful mechanism that could interrupt execution unpredictably and leave state inconsistent. Modern .NET code should use cooperative cancellation instead.

### Comparison: Cancellation vs Exception Handling

Cancellation commonly uses exceptions, but semantically it is not the same as an unexpected failure.

`OperationCanceledException` usually means: "The operation stopped because cancellation was requested."

A normal exception usually means: "The operation failed unexpectedly or could not complete successfully."

This difference affects logging, metrics, retries, and HTTP response behavior.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

<!-- question:start:cancellationtoken-propagation-beginner-q01 -->
<!-- question-id:cancellationtoken-propagation-beginner-q01 -->
<!-- question-level:beginner -->
####  What is a CancellationToken in C#?

##### Expected Answer

A `CancellationToken` is a lightweight value type used to observe a cancellation request. It is part of .NET's cooperative cancellation model. A caller can request cancellation through a `CancellationTokenSource`, and the code doing the work receives a `CancellationToken` so it can stop safely.

The token does not forcibly stop a method or kill a thread. The method must either check `IsCancellationRequested`, call `ThrowIfCancellationRequested()`, or pass the token to another API that supports cancellation.

##### Key Points to Mention

- `CancellationToken` observes cancellation.
- `CancellationTokenSource` requests cancellation.
- Cancellation is cooperative, not forced.
- The running code must observe the token.
- Common in async, I/O, background services, and web APIs.

<!-- question:end:cancellationtoken-propagation-beginner-q01 -->

<!-- question:start:cancellationtoken-propagation-beginner-q02 -->
<!-- question-id:cancellationtoken-propagation-beginner-q02 -->
<!-- question-level:beginner -->
####  What does CancellationToken propagation mean?

##### Expected Answer

CancellationToken propagation means passing a cancellation token from the outer caller into every inner method that performs cancellable work. For example, an ASP.NET Core action receives a token, passes it to a service, the service passes it to a repository, and the repository passes it to EF Core's `ToListAsync` or `SingleAsync`.

The goal is to avoid losing the cancellation signal. If a user disconnects or a request is aborted, the lower-level operations can stop earlier instead of wasting resources.

##### Key Points to Mention

- Propagation means passing the same token down the call chain.
- Do not accept a token and then ignore it.
- Pass it to EF Core, HttpClient, file operations, delays, and long-running tasks.
- It improves resource usage and responsiveness.
- It is especially important in ASP.NET Core and background workers.

<!-- question:end:cancellationtoken-propagation-beginner-q02 -->

<!-- question:start:cancellationtoken-propagation-beginner-q03 -->
<!-- question-id:cancellationtoken-propagation-beginner-q03 -->
<!-- question-level:beginner -->
####  Does a CancellationToken automatically stop a running operation?

##### Expected Answer

No. A `CancellationToken` does not automatically stop code. It is only a signal. The running operation must cooperate by checking the token or passing it to APIs that support cancellation.

For example, `Task.Delay(5000, cancellationToken)` can stop early because `Task.Delay` observes the token. A custom CPU loop will not stop unless the loop checks the token.

##### Key Points to Mention

- Cancellation is cooperative.
- The token is a signal, not a forceful stop.
- APIs must support cancellation to react automatically.
- Custom loops must check manually.
- `ThrowIfCancellationRequested()` is a common way to stop.

<!-- question:end:cancellationtoken-propagation-beginner-q03 -->

<!-- question:start:cancellationtoken-propagation-beginner-q04 -->
<!-- question-id:cancellationtoken-propagation-beginner-q04 -->
<!-- question-level:beginner -->
####  Where should CancellationToken appear in a method signature?

##### Expected Answer

The common convention is to place `CancellationToken` as the last parameter.

```csharp
Task<CustomerDto> GetCustomerAsync(
    int id,
    CancellationToken cancellationToken);
```

For public APIs, it may have a default value:

```csharp
Task<CustomerDto> GetCustomerAsync(
    int id,
    CancellationToken cancellationToken = default);
```

For internal application code, many teams prefer requiring it explicitly to make propagation harder to forget.

##### Key Points to Mention

- Usually the last parameter.
- Public APIs often use `= default`.
- Internal code may require it explicitly.
- Consistency across the codebase is important.
- Do not add the token if the method has no meaningful cancellable work.

<!-- question:end:cancellationtoken-propagation-beginner-q04 -->

<!-- question:start:cancellationtoken-propagation-beginner-q05 -->
<!-- question-id:cancellationtoken-propagation-beginner-q05 -->
<!-- question-level:beginner -->
####  What is the difference between CancellationToken and CancellationTokenSource?

##### Expected Answer

`CancellationTokenSource` owns and triggers the cancellation request. `CancellationToken` is the value passed to operations so they can observe that request.

The source has methods such as `Cancel()` and `CancelAfter(...)`. The token has methods and properties such as `IsCancellationRequested` and `ThrowIfCancellationRequested()`.

Normally, the caller or owner of the operation controls the source. The callee receives only the token.

##### Key Points to Mention

- Source requests cancellation.
- Token observes cancellation.
- The token should be passed to worker methods.
- The source should be disposed when owned by the code.
- Lower-level methods should usually not create new sources unnecessarily.

<!-- question:end:cancellationtoken-propagation-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

<!-- question:start:cancellationtoken-propagation-intermediate-q01 -->
<!-- question-id:cancellationtoken-propagation-intermediate-q01 -->
<!-- question-level:intermediate -->
####  How do you use CancellationToken in an ASP.NET Core API?

##### Expected Answer

In ASP.NET Core, an action or Minimal API endpoint can accept a `CancellationToken` parameter. This token represents the request cancellation signal, usually linked to `HttpContext.RequestAborted`.

The token should be passed into services, repositories, EF Core queries, external HTTP calls, and other async operations.

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<OrderDto>> Get(
    int id,
    CancellationToken cancellationToken)
{
    OrderDto order = await _orderService.GetOrderAsync(
        id,
        cancellationToken);

    return Ok(order);
}
```

If the client disconnects or the request is aborted, downstream operations that observe the token can stop.

##### Key Points to Mention

- ASP.NET Core exposes request cancellation through `RequestAborted`.
- A `CancellationToken` parameter can be bound in actions/endpoints.
- Pass the token to service and data layers.
- Useful for long-running requests, DB queries, and HTTP calls.
- Avoid wasting server resources after client disconnects.

<!-- question:end:cancellationtoken-propagation-intermediate-q01 -->

<!-- question:start:cancellationtoken-propagation-intermediate-q02 -->
<!-- question-id:cancellationtoken-propagation-intermediate-q02 -->
<!-- question-level:intermediate -->
####  How should CancellationToken be used with EF Core?

##### Expected Answer

EF Core async methods that execute database work usually accept a cancellation token. The token should be passed to terminal methods such as `ToListAsync`, `FirstOrDefaultAsync`, `SingleAsync`, and `SaveChangesAsync`.

```csharp
List<Order> orders = await dbContext.Orders
    .Where(o => o.CustomerId == customerId)
    .ToListAsync(cancellationToken);
```

Query composition methods like `Where` and `OrderBy` do not execute the query, so the token is usually passed only when the query is executed.

##### Key Points to Mention

- Pass the token to terminal async methods.
- `Where`, `Select`, and `OrderBy` build the query but do not execute it.
- `ToListAsync`, `SingleAsync`, and `SaveChangesAsync` perform I/O.
- Database provider support may vary, but passing the token is still correct.
- Do not forget the token at the final query execution point.

<!-- question:end:cancellationtoken-propagation-intermediate-q02 -->

<!-- question:start:cancellationtoken-propagation-intermediate-q03 -->
<!-- question-id:cancellationtoken-propagation-intermediate-q03 -->
<!-- question-level:intermediate -->
####  How should cancellation be handled in CPU-bound loops?

##### Expected Answer

For CPU-bound work, the code must manually check the token because there may not be an async API that observes it. A common pattern is to call `ThrowIfCancellationRequested()` inside the loop or between expensive steps.

```csharp
foreach (ReportItem item in items)
{
    cancellationToken.ThrowIfCancellationRequested();

    ProcessItem(item);
}
```

The check should be frequent enough to respond in a timely manner, but not so frequent that it creates unnecessary overhead in very tight loops.

##### Key Points to Mention

- CPU-bound work usually needs manual checks.
- Use `ThrowIfCancellationRequested()`.
- Check at reasonable boundaries.
- Cancellation should leave data in a safe state.
- Avoid excessive checks in extremely tight loops.

<!-- question:end:cancellationtoken-propagation-intermediate-q03 -->

<!-- question:start:cancellationtoken-propagation-intermediate-q04 -->
<!-- question-id:cancellationtoken-propagation-intermediate-q04 -->
<!-- question-level:intermediate -->
####  What is a linked CancellationTokenSource?

##### Expected Answer

A linked `CancellationTokenSource` combines multiple cancellation tokens into one token. The linked token is canceled when any of the source tokens is canceled.

This is useful when an operation should stop because of either caller cancellation or an internal timeout.

```csharp
using var timeoutCts = new CancellationTokenSource(
    TimeSpan.FromSeconds(5));

using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
    requestCancellationToken,
    timeoutCts.Token);

await DoWorkAsync(linkedCts.Token);
```

The linked source should be disposed when finished.

##### Key Points to Mention

- Combines multiple cancellation signals.
- Canceled when any linked token is canceled.
- Useful for request cancellation plus timeout.
- Must be disposed.
- Do not create linked sources unnecessarily in every method.

<!-- question:end:cancellationtoken-propagation-intermediate-q04 -->

<!-- question:start:cancellationtoken-propagation-intermediate-q05 -->
<!-- question-id:cancellationtoken-propagation-intermediate-q05 -->
<!-- question-level:intermediate -->
####  How should OperationCanceledException be handled?

##### Expected Answer

`OperationCanceledException` is the standard exception used to indicate that an operation observed cancellation. It should usually not be logged as an unexpected application error when cancellation was expected.

A common pattern is to catch it separately from other exceptions.

```csharp
try
{
    await service.ProcessAsync(cancellationToken);
}
catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
{
    // Normal cancellation path.
    throw;
}
catch (Exception ex)
{
    logger.LogError(ex, "Processing failed.");
    throw;
}
```

The exact handling depends on the application, but cancellation should be treated differently from true failure.

##### Key Points to Mention

- `OperationCanceledException` represents observed cancellation.
- `TaskCanceledException` derives from it.
- Do not treat expected cancellation as an error.
- Catch cancellation separately from general exceptions.
- Usually rethrow unless the current layer owns the cancellation boundary.

<!-- question:end:cancellationtoken-propagation-intermediate-q05 -->

<!-- question:start:cancellationtoken-propagation-intermediate-q06 -->
<!-- question-id:cancellationtoken-propagation-intermediate-q06 -->
<!-- question-level:intermediate -->
####  What are common mistakes when using CancellationToken?

##### Expected Answer

Common mistakes include accepting a token but not passing it to inner calls, using `CancellationToken.None` when a real token is available, catching `Exception` and treating cancellation as an error, creating unrelated `CancellationTokenSource` instances in lower layers, and canceling after side effects have passed a point where the operation must complete.

Another common mistake is assuming that passing a token to `Task.Run` automatically stops the work. It only helps before the task starts; the delegate itself must still observe the token.

##### Key Points to Mention

- Do not ignore the token.
- Do not replace the caller token with `CancellationToken.None`.
- Do not log expected cancellation as an error.
- Do not create hidden cancellation sources unnecessarily.
- Do not assume cancellation is automatic.
- Be careful after side effects or commits.

<!-- question:end:cancellationtoken-propagation-intermediate-q06 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

<!-- question:start:cancellationtoken-propagation-advanced-q01 -->
<!-- question-id:cancellationtoken-propagation-advanced-q01 -->
<!-- question-level:advanced -->
####  What is the point of no cancellation, and why does it matter?

##### Expected Answer

The point of no cancellation is the moment after which stopping the operation could leave the system inconsistent or violate business rules. Before this point, cancellation can be honored normally. After this point, the operation should usually complete, clean up, or execute a compensating action.

For example, if a payment has already been charged, the system may need to finish saving the order status even if the HTTP request was canceled. In that case, using `CancellationToken.None` for the final consistency update may be intentional.

The key idea is that cancellation is not only a technical concern. It must respect transactional consistency and business correctness.

##### Key Points to Mention

- Cancellation must be safe.
- Do not abandon work after irreversible side effects.
- Examples include payments, commits, messages, and audit records.
- Use transactions or compensating actions where possible.
- Sometimes intentionally stop propagating the caller token after this point.

<!-- question:end:cancellationtoken-propagation-advanced-q01 -->

<!-- question:start:cancellationtoken-propagation-advanced-q02 -->
<!-- question-id:cancellationtoken-propagation-advanced-q02 -->
<!-- question-level:advanced -->
####  How would you design cancellation propagation across controller, service, repository, and external API layers?

##### Expected Answer

The entry point should receive the request token. The controller or endpoint passes it to the application service. The service passes it to repositories, external API clients, validators that perform I/O, and any async operations. The repository passes it to EF Core terminal methods. The external API client passes it to `HttpClient`.

Example flow:

```csharp
public async Task<ActionResult<OrderDto>> Get(
    int id,
    CancellationToken cancellationToken)
{
    return Ok(await _orders.GetOrderAsync(id, cancellationToken));
}

public async Task<OrderDto> GetOrderAsync(
    int id,
    CancellationToken cancellationToken)
{
    Order order = await _repository.GetByIdAsync(id, cancellationToken);

    ShippingStatus shipping = await _shippingClient.GetStatusAsync(
        order.ShippingId,
        cancellationToken);

    return Map(order, shipping);
}

public Task<Order> GetByIdAsync(
    int id,
    CancellationToken cancellationToken)
{
    return _dbContext.Orders.SingleAsync(o => o.Id == id, cancellationToken);
}
```

The design should avoid creating new unrelated token sources in lower layers unless a local timeout is explicitly required and linked with the caller token.

##### Key Points to Mention

- Token enters at the request boundary.
- Pass it through every cancellable layer.
- Repository passes it to EF Core execution methods.
- HTTP client passes it to outbound calls.
- Avoid hidden or unrelated token sources.
- Use linked tokens only for combined cancellation reasons.

<!-- question:end:cancellationtoken-propagation-advanced-q02 -->

<!-- question:start:cancellationtoken-propagation-advanced-q03 -->
<!-- question-id:cancellationtoken-propagation-advanced-q03 -->
<!-- question-level:advanced -->
####  How should CancellationToken be used in a BackgroundService?

##### Expected Answer

`BackgroundService.ExecuteAsync` receives a `stoppingToken`, which is canceled when the host is shutting down. The worker should pass this token to all async operations, delays, queue reads, database calls, and external service calls. The worker should also avoid logging expected shutdown cancellation as an error.

```csharp
protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    while (!stoppingToken.IsCancellationRequested)
    {
        await ProcessBatchAsync(stoppingToken);
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
    }
}
```

This allows the application to stop gracefully instead of hanging during shutdown.

##### Key Points to Mention

- `stoppingToken` signals host shutdown.
- Pass it to all async operations.
- Pass it to `Task.Delay`.
- Handle expected cancellation gracefully.
- Design processing to be idempotent and safe to stop.

<!-- question:end:cancellationtoken-propagation-advanced-q03 -->

<!-- question:start:cancellationtoken-propagation-advanced-q04 -->
<!-- question-id:cancellationtoken-propagation-advanced-q04 -->
<!-- question-level:advanced -->
####  How does cancellation work with Task.Run and Task.WhenAll?

##### Expected Answer

Passing a token to `Task.Run` can prevent the task from starting if cancellation is already requested, but it does not automatically stop the code once the delegate is running. The delegate must check the token.

`Task.WhenAll` waits for multiple tasks, but it does not cancel them by itself. Each individual task must receive and observe the token.

```csharp
Task task = Task.Run(() =>
{
    foreach (WorkItem item in items)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Process(item);
    }
}, cancellationToken);

await task;
```

For `Task.WhenAll`, pass the same token into each operation.

```csharp
await Task.WhenAll(
    ImportCustomersAsync(cancellationToken),
    ImportOrdersAsync(cancellationToken),
    ImportInvoicesAsync(cancellationToken));
```

##### Key Points to Mention

- `Task.Run(token)` does not magically stop running code.
- The delegate must observe the token.
- `Task.WhenAll` does not create cancellation behavior.
- Each task must be cancellation-aware.
- Useful for parallel I/O and CPU work when designed carefully.

<!-- question:end:cancellationtoken-propagation-advanced-q04 -->

<!-- question:start:cancellationtoken-propagation-advanced-q05 -->
<!-- question-id:cancellationtoken-propagation-advanced-q05 -->
<!-- question-level:advanced -->
####  How do you combine request cancellation with an operation timeout?

##### Expected Answer

Use a linked `CancellationTokenSource` that combines the request token with a timeout token. This allows the operation to stop if the client disconnects or if the server-side timeout is reached.

```csharp
public async Task<Result> GetResultAsync(
    CancellationToken requestCancellationToken)
{
    using var timeoutCts = new CancellationTokenSource(
        TimeSpan.FromSeconds(3));

    using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
        requestCancellationToken,
        timeoutCts.Token);

    return await _client.CallAsync(linkedCts.Token);
}
```

If it is important to know which reason caused cancellation, the code can inspect the original tokens in the catch block.

##### Key Points to Mention

- A timeout is one reason for cancellation.
- Use `CreateLinkedTokenSource`.
- Dispose both owned token sources.
- Preserve caller cancellation while adding internal timeout.
- Inspect source tokens if the reason matters.

<!-- question:end:cancellationtoken-propagation-advanced-q05 -->

<!-- question:start:cancellationtoken-propagation-advanced-q06 -->
<!-- question-id:cancellationtoken-propagation-advanced-q06 -->
<!-- question-level:advanced -->
####  How do you use CancellationToken with IAsyncEnumerable?

##### Expected Answer

For async streams, cancellation can be applied during enumeration by using `WithCancellation(cancellationToken)`.

```csharp
await foreach (OrderDto order in StreamOrdersAsync(cancellationToken)
    .WithCancellation(cancellationToken))
{
    Console.WriteLine(order.Id);
}
```

When writing an async iterator, use `[EnumeratorCancellation]` so the cancellation token is associated with the generated async enumerator.

```csharp
public async IAsyncEnumerable<OrderDto> StreamOrdersAsync(
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    while (await HasMoreAsync(cancellationToken))
    {
        cancellationToken.ThrowIfCancellationRequested();

        yield return await ReadNextAsync(cancellationToken);
    }
}
```

This is important for streaming APIs and large asynchronous result sets.

##### Key Points to Mention

- Async streams can be canceled during enumeration.
- Use `WithCancellation`.
- Use `[EnumeratorCancellation]` in async iterator methods.
- Pass the token to async work inside the iterator.
- Important for streaming and large result sets.

<!-- question:end:cancellationtoken-propagation-advanced-q06 -->

<!-- question:start:cancellationtoken-propagation-advanced-q07 -->
<!-- question-id:cancellationtoken-propagation-advanced-q07 -->
<!-- question-level:advanced -->
####  Should cancellation be passed to write operations like SaveChangesAsync?

##### Expected Answer

It depends on the business operation and where the code is in the workflow. Passing a token to `SaveChangesAsync` is normal before the point of no cancellation. However, after an irreversible side effect has happened, canceling a write could leave the system inconsistent.

For example, before a payment is charged, cancellation may be safe. After the payment is charged, the system may need to finish saving the payment result even if the request token was canceled. In that case, the code may intentionally use `CancellationToken.None` or a different internal token for the consistency-critical write.

The important point is to make the decision deliberately based on consistency, transactions, and idempotency.

##### Key Points to Mention

- It is normal to pass tokens to writes before side effects.
- Be careful after irreversible side effects.
- Consider transactions and idempotency.
- Cancellation should not corrupt business state.
- Sometimes stopping propagation after a point is correct.

<!-- question:end:cancellationtoken-propagation-advanced-q07 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
