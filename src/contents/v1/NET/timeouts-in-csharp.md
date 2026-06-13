---
id: timeouts-in-csharp
topic: Async programming, tasks, cancellation, and concurrency
subtopic: Timeouts in C#
category: .NET
---



## Overview

Timeouts in C# are limits placed on how long an operation is allowed to run before the application stops waiting, cancels the work, or treats the operation as failed. They are commonly used for HTTP calls, database queries, background jobs, file operations, message processing, request handling, distributed service calls, and long-running asynchronous workflows.

Timeouts matter because production applications rarely run in perfect conditions. A remote API can become slow, a SQL query can block, a network call can hang, or a downstream dependency can degrade. Without timeouts, one slow dependency can consume threads, connections, memory, queue workers, and request capacity until the application becomes unstable.

In C#, timeouts are usually implemented through a combination of:

- `CancellationTokenSource`
- `CancellationToken`
- `CancelAfter`
- `Task.WaitAsync`
- API-specific timeout settings such as `HttpClient.Timeout`
- database command timeouts
- ASP.NET Core request timeout middleware
- resilience libraries that combine timeout, retry, circuit breaker, and rate limiting strategies

Timeouts are important in interviews because they test whether a developer understands real-world reliability, asynchronous programming, cancellation, resource protection, and distributed system behavior. A strong candidate should know that a timeout is not just a timer. It is a design decision about how long the caller is willing to wait, how cancellation is propagated, what exception is expected, how the operation is cleaned up, and how the system should respond when a dependency is too slow.

## Core Concepts

### What a Timeout Means

A timeout means the caller has decided that an operation has taken too long. The caller can then stop waiting, cancel the operation, return an error, retry, log the failure, or move the work to another path.

A timeout does not always mean the underlying operation has physically stopped. This distinction is very important.

For example:

```csharp
await SomeOperationAsync().WaitAsync(TimeSpan.FromSeconds(2));
```

This limits how long the caller waits for `SomeOperationAsync`. If the timeout expires, the returned wait task fails with `TimeoutException`. However, the original operation may keep running unless that operation supports cancellation and receives a cancellation token.

A better pattern for cooperative cancellation is:

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));

await SomeOperationAsync(cts.Token);
```

In this version, the timeout is represented as cancellation. The operation has a chance to stop itself when the token is canceled.

### Timeout vs Cancellation

Timeout and cancellation are related but not identical.

A timeout is usually based on elapsed time. It means the operation exceeded a configured duration.

Cancellation is a cooperative signal that asks an operation to stop. Cancellation can be caused by a timeout, a user action, an HTTP client disconnect, application shutdown, or business logic.

Example:

```csharp
using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

await service.ProcessAsync(timeoutCts.Token);
```

Here, timeout is implemented by canceling the token after five seconds.

In ASP.NET Core, cancellation often comes from the request:

```csharp
app.MapGet("/orders/{id}", async (
    int id,
    OrderService service,
    HttpContext context) =>
{
    var order = await service.GetOrderAsync(id, context.RequestAborted);
    return Results.Ok(order);
});
```

`HttpContext.RequestAborted` is canceled when the client disconnects or when request timeout middleware triggers a timeout. Passing it down prevents wasted work.

### Cooperative Cancellation

C# cancellation is cooperative. The runtime does not safely kill arbitrary running code just because a token is canceled. Instead, methods that accept `CancellationToken` must check the token or pass it to lower-level APIs.

Common ways to observe cancellation:

```csharp
public async Task ImportAsync(Stream stream, CancellationToken cancellationToken)
{
    while (HasMoreRows(stream))
    {
        cancellationToken.ThrowIfCancellationRequested();

        var row = await ReadRowAsync(stream, cancellationToken);
        await SaveRowAsync(row, cancellationToken);
    }
}
```

Key habits:

- Accept a `CancellationToken` in async methods that may take time.
- Pass the token to every async operation that supports it.
- Use `ThrowIfCancellationRequested` in CPU-bound or loop-based work.
- Do not swallow cancellation exceptions as normal failures.
- Avoid creating new tokens inside low-level methods unless you need a local timeout.

### `CancellationTokenSource.CancelAfter`

`CancellationTokenSource.CancelAfter` schedules cancellation after a delay.

```csharp
using var cts = new CancellationTokenSource();

cts.CancelAfter(TimeSpan.FromSeconds(3));

await DownloadFileAsync(url, cts.Token);
```

A shorter form is:

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));

await DownloadFileAsync(url, cts.Token);
```

`CancelAfter` is useful when an operation already accepts a `CancellationToken`. It creates a timeout by canceling the token after the configured duration.

A common mistake is creating a token but not passing it anywhere:

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));

await DownloadFileAsync(url); // The token is ignored.
```

The timeout has no effect unless the token is used by the operation.

### Linked Cancellation Tokens

In real applications, an operation may need to stop for multiple reasons. For example, an API request should stop if:

- the client disconnects
- the endpoint-specific timeout expires
- the application is shutting down

Use `CancellationTokenSource.CreateLinkedTokenSource` to combine cancellation sources.

```csharp
public async Task<OrderDto> GetOrderAsync(
    int orderId,
    CancellationToken requestAborted)
{
    using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
    using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
        requestAborted,
        timeoutCts.Token);

    return await _repository.GetOrderAsync(orderId, linkedCts.Token);
}
```

The linked token is canceled if either the original request token is canceled or the timeout token expires.

This is a common production pattern because it preserves caller cancellation while adding a local service-level timeout.

### `Task.WaitAsync`

`Task.WaitAsync` can be used to wait for a task with a timeout.

```csharp
var result = await GetReportAsync()
    .WaitAsync(TimeSpan.FromSeconds(10));
```

If the task does not complete within the timeout, the wait fails with `TimeoutException`.

This is useful when the operation does not expose a cancellation token, or when the caller only wants to limit how long it waits.

However, `WaitAsync` does not automatically cancel the underlying work. The original task may continue running in the background.

A safer pattern is to combine timeout waiting with cancellation when the operation supports it:

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

var result = await GetReportAsync(cts.Token);
```

Use `WaitAsync` carefully for operations you do not control. It protects the caller from waiting forever, but it may not release the underlying resource unless the operation itself cooperates.

### `Task.Delay` and Manual Timeout Patterns

Before `Task.WaitAsync`, developers often used `Task.WhenAny` with `Task.Delay`.

```csharp
var operationTask = LoadDataAsync();
var timeoutTask = Task.Delay(TimeSpan.FromSeconds(5));

var completed = await Task.WhenAny(operationTask, timeoutTask);

if (completed == timeoutTask)
{
    throw new TimeoutException("Loading data timed out.");
}

var result = await operationTask;
```

This still appears in older codebases and is useful to understand in interviews. However, it has the same problem as `WaitAsync`: it only stops waiting. It does not necessarily cancel the original operation.

A better version uses cancellation:

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

var result = await LoadDataAsync(cts.Token);
```

If you use `Task.Delay`, pass a token when appropriate:

```csharp
await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
```

### `HttpClient` Timeouts

`HttpClient` has a `Timeout` property that applies a default timeout to requests made by that `HttpClient` instance.

```csharp
builder.Services.AddHttpClient("OrdersClient", client =>
{
    client.BaseAddress = new Uri("https://orders.example.com");
    client.Timeout = TimeSpan.FromSeconds(10);
});
```

When the timeout is reached, the request task is canceled. The default `HttpClient.Timeout` is 100 seconds, which may be too long for many APIs.

For more fine-grained control, use a per-request cancellation token:

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));

using var response = await _httpClient.GetAsync(
    "/api/orders/123",
    cts.Token);

response.EnsureSuccessStatusCode();
```

You can also combine caller cancellation with a local timeout:

```csharp
public async Task<string> GetInventoryAsync(CancellationToken cancellationToken)
{
    using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
    using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
        cancellationToken,
        timeoutCts.Token);

    using var response = await _httpClient.GetAsync(
        "/inventory",
        linkedCts.Token);

    return await response.Content.ReadAsStringAsync(linkedCts.Token);
}
```

Important `HttpClient` timeout habits:

- Do not create a new `HttpClient` for every request.
- Prefer `IHttpClientFactory` in ASP.NET Core applications.
- Set reasonable default timeouts for each named or typed client.
- Use per-request tokens when different operations need different limits.
- Understand that DNS lookup, connection establishment, request sending, response headers, and response body reading can have different timeout concerns.
- Consider `SocketsHttpHandler.ConnectTimeout` when connection establishment needs a separate limit.

Example with connection timeout:

```csharp
builder.Services.AddHttpClient("ExternalApi")
    .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
    {
        ConnectTimeout = TimeSpan.FromSeconds(2)
    });
```

### Timeout Exceptions in HTTP Code

Timeouts can surface as different exception types depending on the API and configuration.

Common possibilities include:

- `OperationCanceledException`
- `TaskCanceledException`
- `TimeoutException`
- provider-specific exceptions
- resilience-library-specific exceptions

For example, `HttpClient.Timeout` commonly appears as task cancellation. `Task.WaitAsync` uses `TimeoutException`. SQL command timeout usually appears as a database provider exception.

A practical handler should distinguish cancellation from real errors:

```csharp
try
{
    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
    return await client.GetStringAsync("/status", cts.Token);
}
catch (OperationCanceledException) when (!externalCancellationToken.IsCancellationRequested)
{
    throw new TimeoutException("The downstream status API timed out.");
}
```

Be careful with this pattern. If you use linked tokens, you may need to check which token was canceled to decide whether it was caller cancellation or local timeout.

### ASP.NET Core Request Timeouts

ASP.NET Core can apply request timeouts globally or per endpoint using request timeout middleware.

Example:

```csharp
using Microsoft.AspNetCore.Http.Timeouts;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRequestTimeouts(options =>
{
    options.DefaultPolicy = new RequestTimeoutPolicy
    {
        Timeout = TimeSpan.FromSeconds(10),
        TimeoutStatusCode = StatusCodes.Status504GatewayTimeout
    };
});

var app = builder.Build();

app.UseRequestTimeouts();

app.MapGet("/slow-report", async (HttpContext context) =>
{
    await GenerateReportAsync(context.RequestAborted);
    return Results.Ok();
})
.WithRequestTimeout(TimeSpan.FromSeconds(5));

app.Run();
```

When the timeout is reached, `HttpContext.RequestAborted` is canceled. The application code should pass that token to downstream operations.

A request timeout does not mean every long-running endpoint should be forced into the same limit. Some endpoints need short limits, while streaming, file upload, WebSocket, and background job trigger endpoints may need different policies.

### Database Command Timeouts

Database operations have their own timeout settings. In SQL Server, `CommandTimeout` controls how long a command waits before timing out. The default is commonly 30 seconds.

Example using ADO.NET:

```csharp
using var command = connection.CreateCommand();

command.CommandText = "SELECT * FROM LargeReport WHERE TenantId = @TenantId";
command.CommandTimeout = 60;

using var reader = await command.ExecuteReaderAsync(cancellationToken);
```

In EF Core, command timeout can be configured in the provider options:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString, sqlOptions =>
    {
        sqlOptions.CommandTimeout(60);
    });
});
```

A command timeout is not the same as a cancellation token:

- command timeout is provider/database-specific
- cancellation token is caller-driven cooperative cancellation
- both can be used together

Example:

```csharp
var orders = await _dbContext.Orders
    .Where(o => o.CustomerId == customerId)
    .ToListAsync(cancellationToken);
```

In production code, avoid solving slow queries by blindly increasing command timeouts. First check indexing, query shape, blocking, transaction duration, missing filters, and data volume.

### Timeouts in Background Services

Background workers should use timeouts to prevent one slow unit of work from blocking the entire worker loop.

```csharp
public class InvoiceWorker : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var itemTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
                stoppingToken,
                itemTimeout.Token);

            try
            {
                await ProcessNextInvoiceAsync(linkedCts.Token);
            }
            catch (OperationCanceledException) when (itemTimeout.IsCancellationRequested)
            {
                // Log timeout and continue with the next item.
            }

            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }
}
```

This protects the worker from being stuck forever on one message, file, or external call.

### Timeout vs Retry

Timeouts and retries are often used together, but the order and total budget matter.

Bad pattern:

```csharp
// 3 retries, each can wait 30 seconds.
// Total worst-case wait can be much longer than the caller expects.
```

Better thinking:

- Define a total operation budget.
- Define per-attempt timeout.
- Retry only safe operations.
- Avoid retrying non-idempotent writes unless the operation is designed for it.
- Add jittered backoff to avoid retry storms.
- Combine timeouts with circuit breakers for unhealthy dependencies.

Example idea:

```csharp
builder.Services.AddHttpClient<OrderClient>()
    .AddStandardResilienceHandler(options =>
    {
        options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(15);
        options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(3);
    });
```

A total timeout limits the entire operation. An attempt timeout limits each individual try. This distinction is important in distributed systems interviews.

### Timeout vs Circuit Breaker

A timeout protects one caller from waiting too long.

A circuit breaker protects the system from repeatedly calling a failing or overloaded dependency.

Example scenario:

- A payment API starts taking 20 seconds to respond.
- Timeout stops each request after 3 seconds.
- Retry may try again.
- Circuit breaker eventually stops sending more traffic temporarily.

Timeouts are usually the first layer of protection, but they are not enough by themselves. A resilient system often combines timeout, retry, circuit breaker, rate limiting, bulkhead isolation, fallback, and monitoring.

### Timeout vs Deadline

A timeout is a duration from now.

A deadline is an absolute point in time by which the operation must finish.

Timeout example:

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
```

Deadline example:

```csharp
var deadline = DateTimeOffset.UtcNow.AddSeconds(5);
var remaining = deadline - DateTimeOffset.UtcNow;

using var cts = new CancellationTokenSource(remaining);
```

Deadlines are useful when a request passes through multiple services. Each service should use the remaining budget instead of starting a fresh full timeout.

### Common Timeout Values

There is no single correct timeout value. Timeout values should be based on:

- user experience requirements
- service-level objectives
- dependency latency distribution
- retry policy
- network environment
- endpoint purpose
- system capacity
- failure mode

Common production habits:

- Use short timeouts for interactive API calls.
- Use longer timeouts for reports, file processing, and batch jobs.
- Avoid infinite timeouts unless there is a clear reason.
- Make timeout values configurable.
- Monitor timeout rates and latency percentiles.
- Tune using real metrics, not guesses.

### Testing Timeout Logic

Timeout logic should be tested without making unit tests slow or flaky.

Avoid this kind of test:

```csharp
await Task.Delay(TimeSpan.FromSeconds(30));
```

Prefer small durations, fake dependencies, or time abstraction.

Example with a fake slow dependency:

```csharp
public sealed class SlowPaymentGateway : IPaymentGateway
{
    public async Task ChargeAsync(CancellationToken cancellationToken)
    {
        await Task.Delay(TimeSpan.FromMinutes(5), cancellationToken);
    }
}
```

Test:

```csharp
[Fact]
public async Task ChargeAsync_Throws_WhenGatewayTimesOut()
{
    var service = new PaymentService(new SlowPaymentGateway());

    await Assert.ThrowsAsync<OperationCanceledException>(() =>
        service.ChargeAsync(TimeSpan.FromMilliseconds(50), CancellationToken.None));
}
```

In newer code, APIs that support `TimeProvider` can make time-based tests more deterministic.

### Best Practices

Good timeout design includes both code-level and architecture-level habits.

Use cancellation-aware APIs:

```csharp
await _dbContext.SaveChangesAsync(cancellationToken);
await _httpClient.SendAsync(request, cancellationToken);
await Task.Delay(delay, cancellationToken);
```

Propagate tokens through layers:

```csharp
public Task<Order> GetOrderAsync(int id, CancellationToken cancellationToken)
{
    return _repository.GetOrderAsync(id, cancellationToken);
}
```

Use local timeout only where ownership is clear:

```csharp
using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
    callerToken,
    timeoutCts.Token);
```

Handle timeout separately from caller cancellation:

```csharp
catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested)
{
    // Local timeout.
}
catch (OperationCanceledException) when (callerToken.IsCancellationRequested)
{
    // Caller canceled.
    throw;
}
```

Log timeout context:

```csharp
_logger.LogWarning(
    "Order API timed out after {TimeoutSeconds} seconds for OrderId {OrderId}",
    timeout.TotalSeconds,
    orderId);
```

### Common Mistakes

A common mistake is using `Thread.Sleep` in async code.

```csharp
Thread.Sleep(5000); // Blocks a thread.
```

Use:

```csharp
await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
```

Another mistake is blocking on async work:

```csharp
var result = GetDataAsync().Result;
```

This can cause deadlocks in some environments and wastes threads. Use:

```csharp
var result = await GetDataAsync();
```

Another mistake is catching all exceptions and hiding timeout information:

```csharp
catch (Exception)
{
    return null;
}
```

This makes production debugging difficult. Log the timeout and preserve useful exception context.

Another mistake is retrying timeouts without a total budget. This can turn a small outage into a large traffic spike.

Another mistake is setting all timeouts to the same value. A search endpoint, a payment request, a report export, and a file upload usually need different timeout policies.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

####  What is a timeout in C#?

<!-- question:start:timeouts-in-csharp-beginner-q01 -->
<!-- question-id:timeouts-in-csharp-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A timeout is a limit on how long an operation is allowed to run or how long the caller is willing to wait. In C#, timeouts are commonly used with async operations, HTTP requests, database commands, background workers, and request handling.

A timeout can be implemented with `CancellationTokenSource`, `CancelAfter`, `Task.WaitAsync`, `HttpClient.Timeout`, database command timeout settings, or framework-specific timeout features.

A key point is that a timeout does not always kill the underlying operation. Some patterns only stop the caller from waiting. To actually stop the work cleanly, the operation should support cooperative cancellation through `CancellationToken`.

##### Key Points to Mention

- A timeout is a maximum wait duration.
- It protects the system from slow or stuck operations.
- It is common in HTTP, database, and distributed systems.
- Cancellation tokens are often used to implement timeouts.
- Stopping waiting is not always the same as stopping the underlying operation.

<!-- question:end:timeouts-in-csharp-beginner-q01 -->

####  What is the difference between timeout and cancellation?

<!-- question:start:timeouts-in-csharp-beginner-q02 -->
<!-- question-id:timeouts-in-csharp-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A timeout is based on elapsed time. It means an operation took longer than the allowed duration.

Cancellation is a cooperative signal that asks an operation to stop. Cancellation can be caused by a timeout, user action, client disconnect, application shutdown, or business logic.

In C#, a timeout is often implemented by canceling a `CancellationTokenSource` after a time limit. The operation must observe the token for cancellation to be effective.

##### Key Points to Mention

- Timeout is time-based.
- Cancellation is a stop signal.
- Timeout can trigger cancellation.
- C# cancellation is cooperative.
- The operation must accept and observe the token.

<!-- question:end:timeouts-in-csharp-beginner-q02 -->

####  How do you create a timeout using `CancellationTokenSource`?

<!-- question:start:timeouts-in-csharp-beginner-q03 -->
<!-- question-id:timeouts-in-csharp-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

You can create a `CancellationTokenSource` with a timeout duration or call `CancelAfter`.

Example:

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

await SomeOperationAsync(cts.Token);
```

Or:

```csharp
using var cts = new CancellationTokenSource();

cts.CancelAfter(TimeSpan.FromSeconds(5));

await SomeOperationAsync(cts.Token);
```

The token must be passed to the operation. If the method ignores the token, the timeout will not cancel the work.

##### Key Points to Mention

- Use `new CancellationTokenSource(timeout)`.
- Or call `CancelAfter(timeout)`.
- Pass `cts.Token` to async APIs.
- Dispose the `CancellationTokenSource`.
- The operation must support cancellation.

<!-- question:end:timeouts-in-csharp-beginner-q03 -->

####  What exception do you usually see when an operation is canceled?

<!-- question:start:timeouts-in-csharp-beginner-q04 -->
<!-- question-id:timeouts-in-csharp-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Canceled operations commonly throw `OperationCanceledException`. `TaskCanceledException` derives from `OperationCanceledException` and is also commonly seen with tasks and HTTP calls.

Some timeout APIs throw different exceptions. For example, `Task.WaitAsync(TimeSpan)` throws `TimeoutException` when the timeout expires. SQL command timeout usually throws a provider-specific database exception.

A good answer should mention that exception type depends on the API being used.

##### Key Points to Mention

- `OperationCanceledException` is the common cancellation exception.
- `TaskCanceledException` is common for tasks and HTTP.
- `Task.WaitAsync` can throw `TimeoutException`.
- Database timeouts may use provider-specific exceptions.
- Exception handling should distinguish timeout from caller cancellation.

<!-- question:end:timeouts-in-csharp-beginner-q04 -->

####  Why is `Thread.Sleep` usually a bad choice in async C# code?

<!-- question:start:timeouts-in-csharp-beginner-q05 -->
<!-- question-id:timeouts-in-csharp-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

`Thread.Sleep` blocks the current thread. In an ASP.NET Core app or any scalable async application, blocking threads reduces throughput and wastes resources.

For async waiting, use `Task.Delay`, preferably with a cancellation token.

```csharp
await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
```

This allows the thread to return to the thread pool while the delay is pending.

##### Key Points to Mention

- `Thread.Sleep` blocks a thread.
- Blocking reduces scalability.
- `Task.Delay` is asynchronous.
- Use cancellation-aware delay when possible.
- Avoid mixing blocking calls with async code.

<!-- question:end:timeouts-in-csharp-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

####  What is the difference between `Task.WaitAsync` and `CancellationTokenSource.CancelAfter`?

<!-- question:start:timeouts-in-csharp-intermediate-q01 -->
<!-- question-id:timeouts-in-csharp-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

`Task.WaitAsync(TimeSpan)` limits how long the caller waits for a task. If the timeout expires, it throws `TimeoutException`. However, it does not automatically cancel the underlying operation.

`CancellationTokenSource.CancelAfter` schedules cancellation of a token after a time limit. If the operation accepts and observes that token, it can stop cooperatively.

Use `WaitAsync` when you need to limit waiting for a task, especially when the operation does not support cancellation. Use `CancellationTokenSource` when you want to request cancellation of the underlying operation.

##### Key Points to Mention

- `WaitAsync` times out the wait.
- `CancelAfter` cancels a token.
- `WaitAsync` may leave the original operation running.
- `CancelAfter` works only if the token is passed and observed.
- Cooperative cancellation is usually preferred for owned code.

<!-- question:end:timeouts-in-csharp-intermediate-q01 -->

####  How should you handle timeouts in `HttpClient`?

<!-- question:start:timeouts-in-csharp-intermediate-q02 -->
<!-- question-id:timeouts-in-csharp-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

`HttpClient` has a `Timeout` property that applies to requests made by that instance. In ASP.NET Core, it is common to configure this through `IHttpClientFactory`.

Example:

```csharp
builder.Services.AddHttpClient("ExternalApi", client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});
```

For per-request timeout control, use a `CancellationTokenSource`:

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));

using var response = await client.GetAsync("/status", cts.Token);
```

In production, use named or typed clients, set reasonable timeouts per dependency, and consider resilience policies for total timeout, attempt timeout, retry, and circuit breaker behavior.

##### Key Points to Mention

- `HttpClient.Timeout` is a client-level default.
- Use `IHttpClientFactory` in ASP.NET Core.
- Use per-request tokens for specific limits.
- Do not create a new `HttpClient` per request.
- Combine timeout with resilience policies when appropriate.

<!-- question:end:timeouts-in-csharp-intermediate-q02 -->

####  How do you combine a request cancellation token with a local timeout?

<!-- question:start:timeouts-in-csharp-intermediate-q03 -->
<!-- question-id:timeouts-in-csharp-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use `CancellationTokenSource.CreateLinkedTokenSource` to combine the caller token with a timeout token.

```csharp
public async Task<Result> ExecuteAsync(CancellationToken requestAborted)
{
    using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
    using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
        requestAborted,
        timeoutCts.Token);

    return await DoWorkAsync(linkedCts.Token);
}
```

The linked token is canceled if the request is aborted or if the local timeout expires.

##### Key Points to Mention

- Use linked token source.
- Preserve caller cancellation.
- Add local timeout safely.
- Dispose both token sources.
- Check which token was canceled if behavior differs.

<!-- question:end:timeouts-in-csharp-intermediate-q03 -->

####  How are database command timeouts different from cancellation tokens?

<!-- question:start:timeouts-in-csharp-intermediate-q04 -->
<!-- question-id:timeouts-in-csharp-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

A database command timeout is a provider-specific setting that limits how long a database command waits before timing out. For SQL Server, `CommandTimeout` is measured in seconds and commonly defaults to 30 seconds.

A cancellation token is a caller-driven cancellation signal that can cancel async database calls if the provider supports it.

They can be used together. The command timeout protects against long-running database execution, while the cancellation token propagates request cancellation or application shutdown.

Example:

```csharp
var items = await dbContext.Items
    .Where(x => x.Status == status)
    .ToListAsync(cancellationToken);
```

And provider configuration:

```csharp
options.UseSqlServer(connectionString, sql =>
{
    sql.CommandTimeout(60);
});
```

##### Key Points to Mention

- Command timeout is database/provider-specific.
- Cancellation token is caller-driven.
- They solve related but different problems.
- EF Core async methods often accept cancellation tokens.
- Do not blindly increase command timeout to hide slow queries.

<!-- question:end:timeouts-in-csharp-intermediate-q04 -->

####  What is the risk of retrying operations after a timeout?

<!-- question:start:timeouts-in-csharp-intermediate-q05 -->
<!-- question-id:timeouts-in-csharp-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Retrying after a timeout can make an outage worse if many clients retry at the same time. It can increase load on an already slow dependency and create a retry storm.

Another risk is duplicating side effects. Retrying a non-idempotent operation like creating an order or charging a payment can create duplicate records or double charges unless the operation is designed with idempotency.

Retries should have a total timeout budget, per-attempt timeout, backoff, jitter, and should usually be limited to safe or idempotent operations.

##### Key Points to Mention

- Retries can amplify load.
- Non-idempotent operations are risky.
- Use total timeout plus per-attempt timeout.
- Use backoff and jitter.
- Combine with circuit breakers and observability.

<!-- question:end:timeouts-in-csharp-intermediate-q05 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

####  How would you design timeout handling for a microservice calling multiple downstream services?

<!-- question:start:timeouts-in-csharp-advanced-q01 -->
<!-- question-id:timeouts-in-csharp-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

A good design starts with an overall request budget. For example, if the API must respond within two seconds, each downstream call should receive only a portion of that budget. The service should propagate caller cancellation, use per-dependency timeout policies, and avoid giving each dependency a fresh full timeout that exceeds the overall request budget.

For HTTP calls, use named or typed `HttpClient` instances with dependency-specific timeouts and resilience policies. For database calls, configure reasonable command timeout and pass cancellation tokens. For internal service layers, pass the `CancellationToken` through every async method.

The design should include logging, metrics, tracing, and clear timeout error responses. For retries, use total timeout, per-attempt timeout, backoff, jitter, idempotency checks, and circuit breakers.

##### Key Points to Mention

- Start with an end-to-end latency budget.
- Use remaining time, not independent unlimited timeouts.
- Propagate cancellation tokens through layers.
- Configure timeouts per dependency.
- Combine timeout with retry, circuit breaker, and monitoring.
- Avoid retrying unsafe operations without idempotency.

<!-- question:end:timeouts-in-csharp-advanced-q01 -->

####  Why is it dangerous to use `Task.WaitAsync` as the only timeout mechanism?

<!-- question:start:timeouts-in-csharp-advanced-q02 -->
<!-- question-id:timeouts-in-csharp-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

`Task.WaitAsync` only controls how long the caller waits for the task. It does not necessarily cancel the original operation. If the original operation continues running, it may keep using sockets, database connections, CPU, locks, memory, or background resources.

This can cause resource leaks or hidden work under load. It is especially dangerous around operations that perform I/O or mutate state.

For code you control, prefer cancellation-aware APIs and pass a cancellation token. Use `WaitAsync` mainly when wrapping APIs that do not support cancellation, and understand that it protects the caller more than the underlying resource.

##### Key Points to Mention

- `WaitAsync` times out the wait, not always the work.
- The original task may continue.
- Hidden work can consume resources.
- Prefer cooperative cancellation for owned code.
- Use carefully around I/O and side effects.

<!-- question:end:timeouts-in-csharp-advanced-q02 -->

####  How do total timeout and per-attempt timeout differ in resilience policies?

<!-- question:start:timeouts-in-csharp-advanced-q03 -->
<!-- question-id:timeouts-in-csharp-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

A per-attempt timeout limits one individual try. A total timeout limits the full operation, including retries, backoff delays, and all attempts.

For example, if the total timeout is 10 seconds and each attempt timeout is 2 seconds, the operation may make several attempts but must still finish within the overall 10-second budget.

Without a total timeout, retries can make the actual user wait much longer than expected. Without per-attempt timeout, one slow attempt can consume the entire budget.

##### Key Points to Mention

- Per-attempt timeout applies to one try.
- Total timeout applies to the full operation.
- Retries must fit inside the total budget.
- Both are useful together.
- This is important for predictable latency.

<!-- question:end:timeouts-in-csharp-advanced-q03 -->

####  How should an API distinguish between client cancellation and server-side timeout?

<!-- question:start:timeouts-in-csharp-advanced-q04 -->
<!-- question-id:timeouts-in-csharp-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

The API should track the source of cancellation. Client cancellation often comes from `HttpContext.RequestAborted`. A server-side timeout may come from a local `CancellationTokenSource` created with a timeout.

When using linked tokens, the catch block can inspect the original tokens:

```csharp
try
{
    using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
    using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
        httpContext.RequestAborted,
        timeoutCts.Token);

    await DoWorkAsync(linkedCts.Token);
}
catch (OperationCanceledException) when (httpContext.RequestAborted.IsCancellationRequested)
{
    // Client disconnected or request was aborted.
    throw;
}
catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested)
{
    return Results.StatusCode(StatusCodes.Status504GatewayTimeout);
}
```

The exact response depends on application policy. The important part is not treating every cancellation as an unexpected server error.

##### Key Points to Mention

- Track original cancellation sources.
- Request cancellation and timeout are not the same.
- Linked tokens are useful but can hide the source.
- Use exception filters carefully.
- Return/log appropriate status and context.

<!-- question:end:timeouts-in-csharp-advanced-q04 -->

####  How do you choose timeout values in a production system?

<!-- question:start:timeouts-in-csharp-advanced-q05 -->
<!-- question-id:timeouts-in-csharp-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Timeout values should be based on real latency data, service-level objectives, user experience needs, dependency behavior, and the operation type.

A production system should monitor latency percentiles, timeout rate, retry rate, dependency health, and resource usage. Interactive user-facing calls usually need shorter timeouts. Batch jobs and reports may need longer timeouts. Critical downstream calls may need carefully designed total budgets and fallback behavior.

Timeouts should be configurable and reviewed over time. Setting all timeouts to a very high value hides problems and increases resource pressure. Setting them too low causes false failures.

##### Key Points to Mention

- Use metrics and latency percentiles.
- Align with service-level objectives.
- Tune by endpoint and dependency.
- Make values configurable.
- Avoid both infinite and unrealistically short timeouts.
- Monitor timeout trends after deployment.

<!-- question:end:timeouts-in-csharp-advanced-q05 -->

####  How would you test timeout behavior without making tests slow and flaky?

<!-- question:start:timeouts-in-csharp-advanced-q06 -->
<!-- question-id:timeouts-in-csharp-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Use fake dependencies, short timeout values, and deterministic time abstractions when available. Do not write tests that sleep for long periods.

For example, create a fake dependency that waits indefinitely using a cancellation token, then configure the service timeout to a few milliseconds.

```csharp
public sealed class NeverCompletesGateway : IGateway
{
    public async Task SendAsync(CancellationToken cancellationToken)
    {
        await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
    }
}
```

Then assert that the service throws or returns the expected timeout result.

In newer APIs, `TimeProvider` can help test time-dependent behavior more deterministically when the API supports it.

##### Key Points to Mention

- Avoid long real delays in tests.
- Use fake slow dependencies.
- Use very small timeout values.
- Prefer deterministic time abstractions when possible.
- Assert exception type and behavior.
- Verify cancellation is propagated.

<!-- question:end:timeouts-in-csharp-advanced-q06 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
