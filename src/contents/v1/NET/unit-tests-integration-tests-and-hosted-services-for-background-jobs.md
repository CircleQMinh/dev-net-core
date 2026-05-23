---
id: unit-tests-integration-tests-and-hosted-services-for-background-jobs
topic: Performance, scalability, and caching
subtopic: Unit Tests, Integration Tests, and Hosted Services for Background Jobs
category: .NET
---



## Overview

Background jobs are tasks that run outside the normal request-response path of an application. In .NET, they are commonly implemented using `IHostedService`, `BackgroundService`, worker services, timers, queues, message consumers, scheduled jobs, and long-running processors.

Examples of background jobs include:

- Sending emails after a user registers.
- Processing uploaded files.
- Generating reports.
- Running scheduled cleanup jobs.
- Polling an external API.
- Processing messages from Azure Service Bus, RabbitMQ, Kafka, or storage queues.
- Retrying failed payments.
- Synchronizing data between systems.
- Running nightly batch operations.
- Publishing notifications.
- Updating search indexes.
- Processing domain events or integration events.

Testing background jobs is different from testing normal request-response code. A controller action or Minimal API endpoint usually has a clear input and output. A background job often runs in a loop, waits on a timer, reads from a queue, uses cancellation tokens, creates dependency injection scopes, handles retries, writes logs, and performs side effects. This makes background jobs easy to write but difficult to test well if the design is not separated properly.

This topic focuses on how to test background jobs at different levels:

- **Unit tests** for the job logic.
- **Unit tests** for queue and scheduling abstractions.
- **Integration tests** for dependency injection, database, queue behavior, and hosted service wiring.
- **ASP.NET Core integration tests** that decide whether hosted services should run or be replaced.
- **End-to-end or environment tests** for real message brokers, cloud queues, or deployed worker processes.
- **CI test execution** considerations for long-running or asynchronous workers.

This topic matters because background jobs often contain important production behavior but are commonly under-tested. Bugs in background jobs may not be visible immediately. They may silently drop messages, process the same message twice, leak scoped services, block application startup, ignore cancellation, fail to shut down cleanly, or create duplicate side effects.

This topic is important for interviews because it tests practical .NET production knowledge. Interviewers often ask:

- What is the difference between `IHostedService` and `BackgroundService`?
- How do you test a `BackgroundService`?
- Should hosted services run during API integration tests?
- How do you unit test background job logic without waiting for real timers?
- How do you use scoped services from a hosted service?
- Why should a hosted service not directly inject `DbContext`?
- How do you test retry and failure behavior?
- How do you prevent flaky tests for asynchronous background processing?
- How do you gracefully stop a worker?
- How do you test queue-based background jobs?
- What should happen when a background job throws an exception?
- How do you observe background jobs in production?

A strong answer should explain that the hosted service should usually be a thin orchestration layer. The business logic should live in testable services that can be unit tested directly. Integration tests should verify wiring, persistence, queues, dependency injection scopes, cancellation, and real infrastructure behavior when needed. Tests should avoid real sleeps, uncontrolled timers, real external systems, and hidden shared state.

## Core Concepts

### What a Background Job Is

A background job is work that runs independently from the immediate caller.

In a Web API, this often means:

```text
HTTP request arrives
 -> app validates request
 -> app stores work item or publishes message
 -> app returns response
 -> background worker processes the work later
```

Example:

```text
POST /api/reports
 -> create report request row in database
 -> return 202 Accepted
 -> background worker picks up pending report
 -> generate PDF
 -> upload to blob storage
 -> update report status
 -> notify user
```

This design improves user experience because the request does not wait for the whole long-running report generation process.

However, it introduces testing challenges because the actual result happens later and often outside the original request.

### Hosted Services in .NET

A hosted service is a background service managed by the .NET host. It implements `IHostedService`.

The interface has two methods:

```csharp
public interface IHostedService
{
    Task StartAsync(CancellationToken cancellationToken);
    Task StopAsync(CancellationToken cancellationToken);
}
```

The host calls `StartAsync` when the application starts and `StopAsync` during graceful shutdown.

In most cases, long-running workers inherit from `BackgroundService`.

```csharp
public abstract class BackgroundService : IHostedService, IDisposable
{
    protected abstract Task ExecuteAsync(CancellationToken stoppingToken);
}
```

Example:

```csharp
public sealed class ReportWorker : BackgroundService
{
    private readonly ILogger<ReportWorker> _logger;

    public ReportWorker(ILogger<ReportWorker> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation("Report worker is running.");

            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }
}
```

Registration:

```csharp
builder.Services.AddHostedService<ReportWorker>();
```

The hosted service is started by the application host, not by a controller or normal service call.

### `IHostedService` vs `BackgroundService`

`IHostedService` is the low-level interface. `BackgroundService` is a base class that implements most of the host integration and lets you focus on `ExecuteAsync`.

| Type | Use When |
|---|---|
| `IHostedService` | You need full control over `StartAsync` and `StopAsync` |
| `BackgroundService` | You need a long-running asynchronous loop |
| Worker Service template | You want a standalone worker process |
| ASP.NET Core hosted service | You want background work inside a web application |

For most long-running workers, prefer `BackgroundService`.

For one-time startup tasks or custom lifecycle behavior, `IHostedService` can be useful, but be careful: `StartAsync` should be short-running because hosted services start sequentially.

### The Testing Problem with Hosted Services

A naive hosted service is hard to test.

Bad design:

```csharp
public sealed class InvoiceWorker : BackgroundService
{
    private readonly AppDbContext _context;
    private readonly IEmailSender _emailSender;

    public InvoiceWorker(AppDbContext context, IEmailSender emailSender)
    {
        _context = context;
        _emailSender = emailSender;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var invoices = await _context.Invoices
                .Where(i => i.Status == InvoiceStatus.Pending)
                .ToListAsync(stoppingToken);

            foreach (var invoice in invoices)
            {
                invoice.Status = InvoiceStatus.Sent;

                await _emailSender.SendAsync(
                    invoice.CustomerEmail,
                    "Invoice",
                    "Your invoice is ready.",
                    stoppingToken);
            }

            await _context.SaveChangesAsync(stoppingToken);

            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }
}
```

Problems:

- Business logic is trapped inside the infinite loop.
- Uses `DbContext` directly in a long-lived hosted service.
- Hard to run only one iteration in a test.
- Requires waiting for real time.
- Difficult to assert behavior.
- Difficult to replace email sender cleanly.
- Hard to test cancellation.
- Hard to test failure behavior.
- The worker orchestration and job logic are mixed.

Better design separates orchestration from job logic.

### Separate Worker Orchestration from Job Logic

The hosted service should usually be thin. It should handle scheduling, cancellation, scoping, and looping. The actual business work should be in a separate service.

Job logic interface:

```csharp
public interface IInvoiceJob
{
    Task ProcessPendingInvoicesAsync(CancellationToken cancellationToken);
}
```

Job logic implementation:

```csharp
public sealed class InvoiceJob : IInvoiceJob
{
    private readonly AppDbContext _context;
    private readonly IEmailSender _emailSender;

    public InvoiceJob(AppDbContext context, IEmailSender emailSender)
    {
        _context = context;
        _emailSender = emailSender;
    }

    public async Task ProcessPendingInvoicesAsync(CancellationToken cancellationToken)
    {
        var invoices = await _context.Invoices
            .Where(i => i.Status == InvoiceStatus.Pending)
            .ToListAsync(cancellationToken);

        foreach (var invoice in invoices)
        {
            await _emailSender.SendAsync(
                invoice.CustomerEmail,
                "Invoice",
                "Your invoice is ready.",
                cancellationToken);

            invoice.Status = InvoiceStatus.Sent;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
```

Hosted service:

```csharp
public sealed class InvoiceWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<InvoiceWorker> _logger;

    public InvoiceWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<InvoiceWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();

                var job = scope.ServiceProvider
                    .GetRequiredService<IInvoiceJob>();

                await job.ProcessPendingInvoicesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Invoice worker failed.");
            }
        }
    }
}
```

Now you can unit test `InvoiceJob` directly and have only a small number of tests for the worker loop.

### Why Hosted Services Need Scopes for Scoped Dependencies

Hosted services are registered as singletons. A hosted service is created once and lives for the application lifetime.

This means a hosted service should not directly inject scoped services such as `DbContext`.

Bad:

```csharp
public sealed class CleanupWorker : BackgroundService
{
    private readonly AppDbContext _context;

    public CleanupWorker(AppDbContext context)
    {
        _context = context;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Bad: a scoped DbContext is captured by a singleton worker.
        return Task.CompletedTask;
    }
}
```

Better:

```csharp
public sealed class CleanupWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public CleanupWorker(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await using var scope = _scopeFactory.CreateAsyncScope();

            var context = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

            await CleanupAsync(context, stoppingToken);

            await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken);
        }
    }

    private static async Task CleanupAsync(
        AppDbContext context,
        CancellationToken cancellationToken)
    {
        var oldRows = await context.AuditLogs
            .Where(log => log.CreatedAtUtc < DateTime.UtcNow.AddDays(-90))
            .ToListAsync(cancellationToken);

        context.AuditLogs.RemoveRange(oldRows);

        await context.SaveChangesAsync(cancellationToken);
    }
}
```

Each iteration creates its own scope and gets a fresh `DbContext`.

### Unit Tests for Job Logic

The easiest and most valuable tests usually target the job logic service, not the hosted service loop.

Example job:

```csharp
public sealed class ExpireSubscriptionsJob
{
    private readonly AppDbContext _context;
    private readonly TimeProvider _timeProvider;

    public ExpireSubscriptionsJob(
        AppDbContext context,
        TimeProvider timeProvider)
    {
        _context = context;
        _timeProvider = timeProvider;
    }

    public async Task RunOnceAsync(CancellationToken cancellationToken)
    {
        var now = _timeProvider.GetUtcNow();

        var expiredSubscriptions = await _context.Subscriptions
            .Where(s => s.Status == SubscriptionStatus.Active)
            .Where(s => s.ExpiresAtUtc <= now)
            .ToListAsync(cancellationToken);

        foreach (var subscription in expiredSubscriptions)
        {
            subscription.Status = SubscriptionStatus.Expired;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
```

Unit or integration-style test:

```csharp
[Fact]
public async Task RunOnceAsync_WhenSubscriptionIsExpired_MarksItExpired()
{
    var now = new DateTimeOffset(2026, 5, 17, 10, 0, 0, TimeSpan.Zero);

    var timeProvider = new FakeTimeProvider(now);

    await using var context = CreateTestDbContext();

    context.Subscriptions.Add(new Subscription
    {
        Status = SubscriptionStatus.Active,
        ExpiresAtUtc = now.AddMinutes(-1)
    });

    await context.SaveChangesAsync();

    var job = new ExpireSubscriptionsJob(context, timeProvider);

    await job.RunOnceAsync(CancellationToken.None);

    var subscription = await context.Subscriptions.SingleAsync();

    Assert.Equal(SubscriptionStatus.Expired, subscription.Status);
}
```

The test runs once, does not wait for real time, and does not start an infinite worker loop.

### Fake Time and `TimeProvider`

Background jobs often depend on time. Direct use of `DateTime.UtcNow` makes tests harder and can cause flaky behavior.

Hard-to-test code:

```csharp
var cutoff = DateTime.UtcNow.AddDays(-30);
```

Better:

```csharp
var cutoff = _timeProvider.GetUtcNow().AddDays(-30);
```

Register in production:

```csharp
builder.Services.AddSingleton(TimeProvider.System);
```

Use fake time in tests:

```csharp
var timeProvider = new FakeTimeProvider(
    new DateTimeOffset(2026, 5, 17, 10, 0, 0, TimeSpan.Zero));
```

Benefits:

- Tests are deterministic.
- No dependency on current system time.
- Easier boundary tests.
- No time zone surprises.
- Easier testing of scheduled behavior.

### Avoid Real Sleeps in Tests

Tests should not wait for real job intervals.

Bad:

```csharp
await Task.Delay(TimeSpan.FromMinutes(5));
```

Bad:

```csharp
await Task.Delay(5000);
Assert.True(emailSender.EmailWasSent);
```

Problems:

- Slow tests.
- Flaky tests.
- CI timing issues.
- Race conditions.
- Tests pass locally but fail in CI.

Better options:

- Test job logic directly.
- Use fake time.
- Inject a delay abstraction.
- Run one iteration explicitly.
- Use channels and completion signals.
- Use bounded polling with short timeout.
- Use test-only hooks carefully.

Example bounded polling:

```csharp
public static async Task EventuallyAsync(
    Func<Task<bool>> condition,
    TimeSpan timeout,
    TimeSpan interval)
{
    var deadline = DateTimeOffset.UtcNow.Add(timeout);

    while (DateTimeOffset.UtcNow < deadline)
    {
        if (await condition())
        {
            return;
        }

        await Task.Delay(interval);
    }

    throw new TimeoutException("Condition was not met before timeout.");
}
```

Use bounded polling for asynchronous integration tests when a background worker really runs.

### One-Iteration Job Method

A very testable pattern is to expose one unit of background work as a method.

```csharp
public interface IOutboxProcessor
{
    Task<int> ProcessBatchAsync(CancellationToken cancellationToken);
}
```

Implementation:

```csharp
public sealed class OutboxProcessor : IOutboxProcessor
{
    private readonly AppDbContext _context;
    private readonly IMessagePublisher _publisher;

    public OutboxProcessor(
        AppDbContext context,
        IMessagePublisher publisher)
    {
        _context = context;
        _publisher = publisher;
    }

    public async Task<int> ProcessBatchAsync(CancellationToken cancellationToken)
    {
        var messages = await _context.OutboxMessages
            .Where(m => m.ProcessedAtUtc == null)
            .OrderBy(m => m.CreatedAtUtc)
            .Take(50)
            .ToListAsync(cancellationToken);

        foreach (var message in messages)
        {
            await _publisher.PublishAsync(
                message.Type,
                message.Payload,
                cancellationToken);

            message.ProcessedAtUtc = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return messages.Count;
    }
}
```

Worker:

```csharp
public sealed class OutboxWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OutboxWorker> _logger;

    public OutboxWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<OutboxWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();

                var processor = scope.ServiceProvider
                    .GetRequiredService<IOutboxProcessor>();

                var count = await processor.ProcessBatchAsync(stoppingToken);

                _logger.LogInformation(
                    "Processed {MessageCount} outbox messages.",
                    count);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Outbox worker failed.");
            }
        }
    }
}
```

Tests can focus on `ProcessBatchAsync`.

### Unit Testing Queue Abstractions

A common background pattern is to enqueue work during a request and process it in a hosted service.

Queue interface:

```csharp
public interface IBackgroundTaskQueue
{
    ValueTask QueueAsync(
        Func<CancellationToken, ValueTask> workItem,
        CancellationToken cancellationToken = default);

    ValueTask<Func<CancellationToken, ValueTask>> DequeueAsync(
        CancellationToken cancellationToken);
}
```

Channel implementation:

```csharp
public sealed class BackgroundTaskQueue : IBackgroundTaskQueue
{
    private readonly Channel<Func<CancellationToken, ValueTask>> _queue;

    public BackgroundTaskQueue(int capacity)
    {
        var options = new BoundedChannelOptions(capacity)
        {
            FullMode = BoundedChannelFullMode.Wait
        };

        _queue = Channel.CreateBounded<Func<CancellationToken, ValueTask>>(options);
    }

    public async ValueTask QueueAsync(
        Func<CancellationToken, ValueTask> workItem,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(workItem);

        await _queue.Writer.WriteAsync(workItem, cancellationToken);
    }

    public async ValueTask<Func<CancellationToken, ValueTask>> DequeueAsync(
        CancellationToken cancellationToken)
    {
        return await _queue.Reader.ReadAsync(cancellationToken);
    }
}
```

Test:

```csharp
[Fact]
public async Task QueueAsync_WhenItemIsQueued_DequeueReturnsSameWorkItem()
{
    var queue = new BackgroundTaskQueue(capacity: 10);

    Func<CancellationToken, ValueTask> workItem =
        _ => ValueTask.CompletedTask;

    await queue.QueueAsync(workItem);

    var dequeued = await queue.DequeueAsync(CancellationToken.None);

    Assert.Same(workItem, dequeued);
}
```

This tests the queue abstraction without running the hosted service.

### Testing a Queued Worker

Queued worker:

```csharp
public sealed class QueuedWorker : BackgroundService
{
    private readonly IBackgroundTaskQueue _queue;
    private readonly ILogger<QueuedWorker> _logger;

    public QueuedWorker(
        IBackgroundTaskQueue queue,
        ILogger<QueuedWorker> logger)
    {
        _queue = queue;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var workItem = await _queue.DequeueAsync(stoppingToken);

            try
            {
                await workItem(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Queued work item failed.");
            }
        }
    }
}
```

Instead of unit testing the infinite loop directly, you can test:

- The queue separately.
- The work item logic separately.
- A small integration test where the worker processes one item and signals completion.

Example completion signal:

```csharp
[Fact]
public async Task QueuedWorker_WhenWorkItemIsQueued_ExecutesWorkItem()
{
    var queue = new BackgroundTaskQueue(capacity: 10);
    var logger = NullLogger<QueuedWorker>.Instance;
    var worker = new QueuedWorker(queue, logger);

    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
    var executed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

    await worker.StartAsync(cts.Token);

    await queue.QueueAsync(_ =>
    {
        executed.SetResult();
        return ValueTask.CompletedTask;
    }, cts.Token);

    await executed.Task.WaitAsync(cts.Token);

    await worker.StopAsync(CancellationToken.None);
}
```

This test runs the worker but does not depend on arbitrary sleeps.

### Integration Tests for Hosted Services

Integration tests can verify that the hosted service is registered, uses real DI, creates scopes correctly, and performs real persistence or messaging behavior.

Example host test:

```csharp
[Fact]
public async Task Worker_WhenStarted_ProcessesPendingJobs()
{
    using var host = Host.CreateDefaultBuilder()
        .ConfigureServices(services =>
        {
            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseSqlite(_connection);
            });

            services.AddScoped<IInvoiceJob, InvoiceJob>();
            services.AddHostedService<InvoiceWorker>();
            services.AddSingleton(TimeProvider.System);
            services.AddSingleton<IEmailSender, FakeEmailSender>();
        })
        .Build();

    await SeedPendingInvoiceAsync(host.Services);

    await host.StartAsync();

    await EventuallyAsync(
        async () => await InvoiceWasProcessedAsync(host.Services),
        timeout: TimeSpan.FromSeconds(5),
        interval: TimeSpan.FromMilliseconds(100));

    await host.StopAsync();
}
```

This style gives confidence that the host and DI are wired correctly. Use it sparingly because it is slower and more asynchronous than direct job tests.

### `WebApplicationFactory` and Hosted Services

When using `WebApplicationFactory<Program>` to test an ASP.NET Core Web API, hosted services registered in the application may start automatically.

This can be good or bad.

Good when:

- The test specifically verifies background processing.
- The worker is part of the scenario.
- The test can control timing and data.
- External dependencies are replaced.
- The worker can shut down cleanly.

Bad when:

- The test only wants to call API endpoints.
- The worker modifies database state unexpectedly.
- The worker calls real external systems.
- The worker runs timers and slows tests.
- The worker introduces flakiness.
- The worker consumes messages from shared queues.
- The worker conflicts with test isolation.

For most API integration tests, replace or remove hosted services unless they are part of the behavior being tested.

### Removing Hosted Services in Integration Tests

In `WebApplicationFactory`, remove hosted services that should not run.

Example:

```csharp
public sealed class CustomWebApplicationFactory
    : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            var hostedServices = services
                .Where(descriptor =>
                    descriptor.ServiceType == typeof(IHostedService))
                .ToList();

            foreach (var descriptor in hostedServices)
            {
                services.Remove(descriptor);
            }
        });
    }
}
```

This removes all hosted services. If you only want to remove one worker, filter by implementation type.

```csharp
var descriptor = services.SingleOrDefault(descriptor =>
    descriptor.ServiceType == typeof(IHostedService) &&
    descriptor.ImplementationType == typeof(InvoiceWorker));

if (descriptor is not null)
{
    services.Remove(descriptor);
}
```

Then test the API without background side effects.

### Replacing Hosted Services with Test Doubles

Instead of removing a worker, you can replace it with a test double.

Example:

```csharp
public sealed class NoOpHostedService : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
```

Registration in tests:

```csharp
builder.ConfigureServices(services =>
{
    var descriptor = services.SingleOrDefault(descriptor =>
        descriptor.ServiceType == typeof(IHostedService) &&
        descriptor.ImplementationType == typeof(InvoiceWorker));

    if (descriptor is not null)
    {
        services.Remove(descriptor);
    }

    services.AddHostedService<NoOpHostedService>();
});
```

This keeps host behavior predictable.

### Testing API-to-Queue Flow

A common integration test should verify that an API endpoint enqueues work, not that the entire background job completes.

Example endpoint:

```csharp
app.MapPost("/api/emails", async (
    SendEmailRequest request,
    IBackgroundTaskQueue queue,
    CancellationToken cancellationToken) =>
{
    await queue.QueueAsync(async token =>
    {
        await Task.Delay(1, token);
    }, cancellationToken);

    return Results.Accepted();
});
```

Test with fake queue:

```csharp
public sealed class FakeBackgroundTaskQueue : IBackgroundTaskQueue
{
    public List<Func<CancellationToken, ValueTask>> Items { get; } = new();

    public ValueTask QueueAsync(
        Func<CancellationToken, ValueTask> workItem,
        CancellationToken cancellationToken = default)
    {
        Items.Add(workItem);
        return ValueTask.CompletedTask;
    }

    public ValueTask<Func<CancellationToken, ValueTask>> DequeueAsync(
        CancellationToken cancellationToken)
    {
        throw new NotSupportedException();
    }
}
```

Test:

```csharp
[Fact]
public async Task PostEmail_WhenRequestIsValid_EnqueuesWorkAndReturnsAccepted()
{
    var fakeQueue = new FakeBackgroundTaskQueue();

    using var client = _factory.WithWebHostBuilder(builder =>
    {
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<IBackgroundTaskQueue>(fakeQueue);
        });
    })
    .CreateClient();

    var response = await client.PostAsJsonAsync("/api/emails", new
    {
        To = "user@example.com",
        Subject = "Welcome"
    });

    Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
    Assert.Single(fakeQueue.Items);
}
```

This test is stable because it does not wait for a worker.

### Testing the Worker Separately

Test the worker or job processing separately from the endpoint.

```csharp
[Fact]
public async Task ProcessPendingEmails_WhenEmailExists_SendsEmail()
{
    await using var context = CreateDbContext();

    context.EmailOutbox.Add(new EmailOutboxMessage
    {
        To = "user@example.com",
        Subject = "Welcome",
        Body = "Hello"
    });

    await context.SaveChangesAsync();

    var sender = new FakeEmailSender();
    var processor = new EmailOutboxProcessor(context, sender);

    await processor.ProcessBatchAsync(CancellationToken.None);

    Assert.Single(sender.SentEmails);
}
```

This separation creates stable tests:

- API test verifies work is requested.
- Job test verifies work is processed.
- A smaller number of integration tests verify the worker loop.

### Testing Timed Jobs

Timed jobs should be designed so the timing mechanism is not the only way to run the job.

Bad design:

```csharp
protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    while (!stoppingToken.IsCancellationRequested)
    {
        await DoEverythingAsync(stoppingToken);
        await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
    }
}
```

Better:

```csharp
public interface IScheduledCleanupJob
{
    Task RunOnceAsync(CancellationToken cancellationToken);
}
```

Worker:

```csharp
public sealed class ScheduledCleanupWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public ScheduledCleanupWorker(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await using var scope = _scopeFactory.CreateAsyncScope();

            var job = scope.ServiceProvider
                .GetRequiredService<IScheduledCleanupJob>();

            await job.RunOnceAsync(stoppingToken);
        }
    }
}
```

Test `RunOnceAsync` directly. Only use integration tests for the timer loop if necessary.

### `System.Threading.Timer` vs `PeriodicTimer`

`System.Threading.Timer` can run callbacks while a previous callback is still executing. This can create overlapping job executions.

Example risk:

```text
Timer interval: 10 seconds
Job duration: 30 seconds
Result: 3 overlapping executions
```

This can cause:

- Duplicate processing.
- Race conditions.
- Database conflicts.
- Increased load.
- Hard-to-test behavior.

`PeriodicTimer` works naturally with `await`, making it easier to avoid overlap:

```csharp
using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));

while (await timer.WaitForNextTickAsync(stoppingToken))
{
    await job.RunOnceAsync(stoppingToken);
}
```

The next iteration does not start until the previous awaited work completes.

For cron-like scheduling, consider a scheduler library or external scheduler, but still keep the job logic testable through a `RunOnceAsync` method.

### Cancellation and Graceful Shutdown

Background jobs must respect cancellation tokens.

Good:

```csharp
while (!stoppingToken.IsCancellationRequested)
{
    await ProcessAsync(stoppingToken);

    await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
}
```

Bad:

```csharp
while (true)
{
    Thread.Sleep(10000);
    Process();
}
```

Problems with ignoring cancellation:

- Slow shutdown.
- CI tests hang.
- Container termination becomes unsafe.
- Kubernetes or Azure may kill the process before cleanup.
- In-flight work may not finish cleanly.
- Deployments take longer.
- Locked resources may not be released.

Tests should verify that cancellation is honored for important long-running operations.

Example:

```csharp
[Fact]
public async Task ExecuteAsync_WhenCancellationIsRequested_StopsPromptly()
{
    using var cts = new CancellationTokenSource();

    var worker = CreateWorker();

    await worker.StartAsync(cts.Token);

    cts.Cancel();

    var stopTask = worker.StopAsync(CancellationToken.None);

    await stopTask.WaitAsync(TimeSpan.FromSeconds(2));
}
```

Avoid tests that can hang forever.

### Exception Handling in Background Jobs

Unhandled exceptions in `BackgroundService.ExecuteAsync` can stop the host depending on host options.

For many production workers, you should decide intentionally:

- Should the whole process stop if the worker fails?
- Should the worker log the error and continue?
- Should the current item be retried?
- Should the item move to a dead-letter queue?
- Should the health check fail?
- Should the application restart?

Example item-level error handling:

```csharp
try
{
    await ProcessMessageAsync(message, stoppingToken);

    await _queue.CompleteAsync(message, stoppingToken);
}
catch (TransientException ex)
{
    _logger.LogWarning(ex, "Transient failure processing message {MessageId}.", message.Id);

    await _queue.AbandonAsync(message, stoppingToken);
}
catch (Exception ex)
{
    _logger.LogError(ex, "Permanent failure processing message {MessageId}.", message.Id);

    await _queue.DeadLetterAsync(message, ex.Message, stoppingToken);
}
```

Do not swallow exceptions silently.

Bad:

```csharp
catch
{
}
```

At minimum, log with enough context to diagnose the failed item.

### `BackgroundServiceExceptionBehavior`

The host can be configured for how to react to unhandled exceptions from `BackgroundService`.

Example:

```csharp
builder.Services.Configure<HostOptions>(options =>
{
    options.BackgroundServiceExceptionBehavior =
        BackgroundServiceExceptionBehavior.StopHost;
});
```

Common values:

| Value | Meaning |
|---|---|
| `StopHost` | Stop the host when a background service throws an unhandled exception |
| `Ignore` | Ignore unhandled exceptions from background services |

For critical workers, stopping the host can be better than silently running without the worker. In containerized environments, the orchestrator can restart the process. For non-critical best-effort jobs, you may prefer to handle exceptions inside the loop and continue.

The key is to choose intentionally and monitor it.

### Retrying Background Jobs

Background jobs often need retries, but retries must be designed carefully.

Transient failures:

- Network issue.
- Temporary database deadlock.
- Timeout.
- Downstream `503`.
- Message broker reconnect.
- Rate limiting.

Permanent failures:

- Invalid message schema.
- Missing required business data.
- Unsupported operation.
- Authentication configuration error.
- Bad recipient email format.

Retry strategy:

- Use limited retries.
- Use exponential backoff.
- Add jitter.
- Avoid infinite tight retry loops.
- Preserve failure reason.
- Move poison messages to dead-letter storage.
- Make handlers idempotent.
- Use retry count metadata.
- Avoid duplicate side effects.

Example retry loop concept:

```csharp
for (var attempt = 1; attempt <= 3; attempt++)
{
    try
    {
        await ProcessAsync(cancellationToken);
        return;
    }
    catch (TransientException) when (attempt < 3)
    {
        await Task.Delay(
            TimeSpan.FromSeconds(Math.Pow(2, attempt)),
            cancellationToken);
    }
}
```

In production, use a resilience library or queue-native retry/dead-letter features when appropriate.

### Idempotency in Background Jobs

Background jobs may process the same item more than once.

Reasons:

- Worker crashes after side effect but before marking complete.
- Message visibility timeout expires.
- Queue redelivers a message.
- Retry occurs after timeout.
- Two workers compete for the same database row.
- A user submits the same request twice.

Idempotency means processing the same item multiple times produces the same final result.

Example patterns:

- Use unique job IDs.
- Use idempotency keys.
- Mark processed messages in a table.
- Use database unique constraints.
- Use optimistic concurrency.
- Use status transitions.
- Check current state before applying side effects.
- Store external provider transaction IDs.
- Make outgoing writes idempotent when possible.

Example:

```csharp
var alreadyProcessed = await _context.ProcessedMessages
    .AnyAsync(m => m.MessageId == message.Id, cancellationToken);

if (alreadyProcessed)
{
    return;
}

await ProcessMessageAsync(message, cancellationToken);

_context.ProcessedMessages.Add(new ProcessedMessage
{
    MessageId = message.Id,
    ProcessedAtUtc = _timeProvider.GetUtcNow()
});

await _context.SaveChangesAsync(cancellationToken);
```

Add a unique index on `MessageId` to protect against races.

### Testing Idempotency

An important background job test verifies duplicate processing is safe.

```csharp
[Fact]
public async Task ProcessMessageAsync_WhenMessageIsProcessedTwice_SendsEmailOnce()
{
    await using var context = CreateDbContext();

    var emailSender = new FakeEmailSender();

    var processor = new EmailMessageProcessor(
        context,
        emailSender,
        new FakeTimeProvider());

    var message = new EmailMessage
    {
        MessageId = "message-123",
        To = "user@example.com"
    };

    await processor.ProcessAsync(message, CancellationToken.None);
    await processor.ProcessAsync(message, CancellationToken.None);

    Assert.Single(emailSender.SentEmails);

    var processedCount = await context.ProcessedMessages.CountAsync();

    Assert.Equal(1, processedCount);
}
```

This catches duplicate side effects.

### Queues, Channels, and Backpressure

A background queue should not accept unlimited work without backpressure.

Bad:

```csharp
private readonly Queue<Func<Task>> _queue = new();
```

Problems:

- Unbounded memory growth.
- No async waiting.
- Thread-safety issues.
- No backpressure.
- Hard to shut down.

Better:

```csharp
var options = new BoundedChannelOptions(capacity: 100)
{
    FullMode = BoundedChannelFullMode.Wait
};

var channel = Channel.CreateBounded<WorkItem>(options);
```

Backpressure means producers slow down when the queue is full.

This matters in production because if the background worker cannot keep up, the API should not keep accepting unlimited work into memory.

Tests should verify:

- Enqueue works.
- Dequeue works.
- Cancellation is honored.
- Queue does not drop items unexpectedly.
- Full queue behavior matches design.
- Worker processes items sequentially or with expected concurrency.

### Concurrency in Background Jobs

Some workers process one item at a time. Others process multiple items concurrently.

Sequential worker:

```text
Dequeue item
Process item
Complete item
Dequeue next item
```

Concurrent worker:

```text
Dequeue many items
Process up to N at once
Complete each item
```

Concurrency can improve throughput but introduces risks:

- Race conditions.
- Duplicate processing.
- Database deadlocks.
- External API rate limits.
- Out-of-order processing.
- Harder tests.
- More complex shutdown.
- More complex error handling.

If using concurrency, make the degree of parallelism explicit and configurable.

Example:

```csharp
public sealed class WorkerOptions
{
    public int MaxDegreeOfParallelism { get; set; } = 4;
}
```

Tests should verify concurrency-sensitive behavior with deterministic synchronization, not arbitrary sleeps.

### Database Polling Workers

Some jobs poll a database table for pending work.

Example:

```csharp
var jobs = await _context.Jobs
    .Where(j => j.Status == JobStatus.Pending)
    .OrderBy(j => j.CreatedAtUtc)
    .Take(10)
    .ToListAsync(cancellationToken);
```

Risks:

- Two worker instances pick the same row.
- Long transactions block other workers.
- Job status is not updated atomically.
- Retried jobs are not scheduled correctly.
- Failed jobs are stuck forever.
- Polling is too frequent and loads the database.
- Polling is too slow and increases latency.

Safer patterns:

- Atomically claim jobs.
- Use status transitions.
- Use row version or concurrency token.
- Use `LockedUntilUtc` or visibility timeout pattern.
- Use unique worker ID.
- Keep transactions short.
- Use database indexes.
- Consider a real queue if workload grows.

Testing should include multi-worker or duplicate-claim scenarios if production may run multiple instances.

### Message Broker Workers

Message broker workers process messages from systems such as Azure Service Bus, RabbitMQ, Kafka, or storage queues.

Testing levels:

| Test Type | What It Verifies |
|---|---|
| Unit test | Message handler behavior for one message |
| Integration test with fake broker | App wiring and basic processing |
| Integration test with Testcontainers/emulator | Real broker semantics |
| E2E test | Deployed producer and consumer work together |

Unit test the handler:

```csharp
[Fact]
public async Task HandleAsync_WhenOrderCreatedMessageReceived_CreatesInvoice()
{
    var handler = CreateHandler();

    var message = new OrderCreatedMessage
    {
        OrderId = 123
    };

    await handler.HandleAsync(message, CancellationToken.None);

    Assert.True(await InvoiceExistsAsync(123));
}
```

Do not require a real broker for every handler behavior test.

Use real broker tests for:

- Serialization.
- Routing keys/topics/subscriptions.
- Dead-letter behavior.
- Lock renewal.
- Visibility timeout.
- Message completion.
- Consumer registration.
- Retry policy.
- Duplicate delivery behavior.

### Outbox Pattern and Testing

The outbox pattern stores messages in the same database transaction as the business data, then a background worker publishes them later.

Example flow:

```text
Create order
Save order and outbox message in same transaction
Outbox worker reads unpublished messages
Publish message
Mark message as published
```

Benefits:

- Avoids losing events after database commit.
- Gives retryable publishing.
- Supports eventual consistency.
- Keeps API transaction local.

Tests:

1. Unit/integration test that command creates outbox message.
2. Processor test that unpublished message is published and marked.
3. Idempotency test that already published messages are not republished.
4. Failure test that publish failure leaves message retryable.
5. Integration test that worker processes outbox in the hosted environment.

Example assertion:

```csharp
Assert.Equal(OrderStatus.Created, order.Status);
Assert.Single(context.OutboxMessages);
```

Do not rely only on E2E tests for outbox behavior. Most outbox logic can be tested directly.

### Health Checks for Background Jobs

A background job can fail while the web API still responds to HTTP requests. Health checks can expose this.

Possible health signals:

- Last successful run time.
- Last failure time.
- Consecutive failure count.
- Queue length.
- Oldest pending item age.
- Worker running status.
- External dependency availability.
- Dead-letter count.
- Processing latency.
- Stuck jobs.

Example state object:

```csharp
public sealed class WorkerHealthState
{
    public DateTimeOffset? LastSuccessUtc { get; set; }
    public DateTimeOffset? LastFailureUtc { get; set; }
    public int ConsecutiveFailures { get; set; }
}
```

Tests can verify that the job updates health state on success and failure.

Health checks are especially important when a background job is critical to business operations.

### Logging and Observability

Background jobs need strong observability because they often run without direct user interaction.

Log:

- Job name.
- Job instance ID.
- Message ID or job ID.
- Correlation ID.
- Start and end.
- Duration.
- Success/failure.
- Retry count.
- Dead-letter reason.
- Queue length or batch size.
- Number of processed items.
- Exception details.
- External dependency status.

Example:

```csharp
_logger.LogInformation(
    "Processing report job {JobId} for tenant {TenantId}.",
    job.Id,
    job.TenantId);
```

Avoid logs like:

```csharp
_logger.LogInformation("Processing...");
```

Useful logs make tests and production incidents easier to diagnose.

### Testing Logs

Logs are usually not the main behavior to test, but they can be tested when they are part of operational requirements.

Examples:

- Worker logs an error when item processing fails.
- Worker logs a warning when retrying.
- Worker logs critical error before stopping.
- Health state changes after repeated failure.

Test logs with a fake logger or test logging provider.

However, do not over-test exact log message text unless the text is part of a contract. Prefer asserting the log level, event ID, and structured properties when needed.

### CI Considerations for Background Job Tests

Background job tests can be flaky if they depend on timing or shared infrastructure.

CI best practices:

- Unit test job logic directly.
- Avoid long real-time intervals.
- Use fake time.
- Use test doubles for queues and external systems.
- Use bounded polling only when necessary.
- Use short timeouts.
- Capture logs on failure.
- Avoid test order dependencies.
- Reset databases and queues between tests.
- Disable hosted services in API tests unless needed.
- Run real broker/container tests in a separate integration stage.
- Limit parallelism for tests sharing broker/database resources.
- Use deterministic test IDs.
- Stop hosts cleanly at test end.
- Avoid infinite loops that cannot be cancelled.

Background tests should never hang CI indefinitely.

### Common Mistakes

Common mistakes include:

- Putting all job logic directly inside `ExecuteAsync`.
- Unit testing an infinite loop instead of the job logic.
- Using `DateTime.UtcNow` directly instead of `TimeProvider`.
- Using real sleeps in tests.
- Directly injecting scoped services such as `DbContext` into hosted services.
- Not creating a scope per iteration or per message.
- Ignoring cancellation tokens.
- Using `Thread.Sleep` in workers.
- Swallowing exceptions silently.
- Letting non-critical workers call real external services in integration tests.
- Allowing hosted services to run during unrelated API integration tests.
- Not testing failure paths.
- Not testing duplicate message handling.
- Not making message processing idempotent.
- Using unbounded in-memory queues.
- Not applying backpressure.
- Not testing graceful shutdown.
- Not disposing host or worker resources in tests.
- Depending on test execution order.
- Using shared queues or databases without cleanup.
- Assuming background work completes before assertions.
- Not logging enough context for failed jobs.
- Not having health checks for critical workers.

### Best Practices

Separate worker orchestration from job logic.

Expose a `RunOnceAsync`, `ProcessBatchAsync`, or message handler method that can be tested directly.

Use `BackgroundService` for long-running loops.

Keep `StartAsync` short.

Use `PeriodicTimer` or scheduler abstractions instead of raw timers when async work must not overlap.

Use `TimeProvider` for time-dependent logic.

Do not inject scoped services directly into hosted services.

Create a DI scope for each iteration, batch, or message when resolving scoped services.

Pass cancellation tokens through all async calls.

Handle `OperationCanceledException` correctly during shutdown.

Log exceptions with useful context.

Decide intentionally whether worker failures should stop the host or be handled per item.

Use bounded queues and backpressure.

Design message processing to be idempotent.

Test duplicate processing and failure paths.

Disable or replace hosted services in unrelated `WebApplicationFactory` tests.

Use integration tests for real DI, database, queue, and hosted-service wiring.

Use real broker/container tests only for behavior that requires real infrastructure.

Avoid arbitrary sleeps in tests.

Use completion signals, fake time, or bounded polling.

Stop and dispose hosts cleanly in tests.

Keep CI background-job tests deterministic, isolated, and time-bounded.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q01 -->
#### Beginner Q01: What is a hosted service in .NET?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A hosted service is a background service managed by the .NET host. It implements `IHostedService`, which has `StartAsync` and `StopAsync` methods. The host starts hosted services when the application starts and stops them during graceful shutdown.

For long-running background work, developers commonly inherit from `BackgroundService` and implement `ExecuteAsync`.

Hosted services are used for background jobs such as polling queues, processing messages, running scheduled cleanup, sending notifications, or doing long-running worker tasks.

##### Key Points to Mention

- Managed by the .NET host.
- Implements `IHostedService`.
- `StartAsync` runs on startup.
- `StopAsync` runs during shutdown.
- `BackgroundService` is a base class for long-running workers.
- Registered with `AddHostedService<T>()`.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q01 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q02 -->
#### Beginner Q02: What is the difference between `IHostedService` and `BackgroundService`?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`IHostedService` is the low-level interface with `StartAsync` and `StopAsync`. It gives full control over the hosted service lifecycle.

`BackgroundService` is an abstract base class that implements `IHostedService` and lets you implement `ExecuteAsync`, which represents the lifetime of the background operation. It is usually simpler for long-running worker loops.

Use `BackgroundService` for most continuous background workers. Use `IHostedService` directly when you need custom startup/shutdown behavior.

##### Key Points to Mention

- `IHostedService` is the interface.
- `BackgroundService` is a base class.
- `BackgroundService` uses `ExecuteAsync`.
- `IHostedService` gives more lifecycle control.
- `BackgroundService` is common for worker loops.
- Keep `StartAsync` short.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q02 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q03 -->
#### Beginner Q03: How should you unit test background job logic?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

The best approach is to keep the business logic outside the hosted service loop and put it into a separate service or handler with a method such as `RunOnceAsync`, `ProcessBatchAsync`, or `HandleAsync`.

Then unit test that method directly.

Example:

```csharp
public interface IReportJob
{
    Task RunOnceAsync(CancellationToken cancellationToken);
}
```

The hosted service only handles scheduling, looping, scoping, logging, and cancellation. The job service contains the behavior that can be tested without starting the host or waiting for timers.

##### Key Points to Mention

- Do not put all logic inside `ExecuteAsync`.
- Extract job logic into a separate service.
- Test `RunOnceAsync` or handler methods directly.
- Avoid infinite loops in unit tests.
- Avoid real sleeps.
- Use fakes for dependencies.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q03 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q04 -->
#### Beginner Q04: Why should hosted services not directly inject `DbContext`?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Hosted services are registered as singletons and live for the application lifetime. `DbContext` is usually scoped and should be short-lived. Directly injecting `DbContext` into a hosted service captures a scoped dependency in a singleton, which can cause lifetime problems, stale tracking, thread-safety issues, and memory growth.

Instead, inject `IServiceScopeFactory` or `IDbContextFactory<TContext>` and create a new scope or context for each iteration, batch, or message.

##### Key Points to Mention

- Hosted services are singleton-like.
- `DbContext` is usually scoped.
- Do not capture scoped services in singletons.
- Create a scope inside the worker.
- Resolve scoped services per iteration or message.
- Use `IDbContextFactory` when appropriate.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q04 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q05 -->
#### Beginner Q05: Why should tests avoid real sleeps when testing background jobs?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Real sleeps make tests slow and flaky. A test that waits for `Task.Delay(5000)` may pass locally but fail in CI due to slower machines, scheduling differences, or race conditions.

Instead of waiting for real time, test the job logic directly, use fake time, use completion signals such as `TaskCompletionSource`, or use bounded polling with short timeouts for integration tests.

##### Key Points to Mention

- Real sleeps slow tests.
- Real sleeps cause flaky CI results.
- Prefer direct job logic tests.
- Use fake time.
- Use `TaskCompletionSource` for completion.
- Use bounded polling only when needed.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q05 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q06 -->
#### Beginner Q06: What should happen when a background job is cancelled?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

A background job should stop promptly and gracefully when its cancellation token is triggered. It should pass the cancellation token to async operations such as database calls, HTTP calls, queue operations, and delays.

During shutdown, `OperationCanceledException` may be expected. The worker should not treat expected shutdown cancellation as a normal error. It should finish or stop work safely and release resources.

##### Key Points to Mention

- Respect cancellation tokens.
- Pass tokens to async operations.
- Stop promptly during shutdown.
- Avoid `Thread.Sleep`.
- Handle `OperationCanceledException` correctly.
- Tests should not hang if cancellation is requested.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q01 -->
#### Intermediate Q01: How do you test a `BackgroundService` without testing an infinite loop?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

The best approach is to avoid putting business logic directly in the infinite loop. Extract one unit of work into a separate service with a method like `RunOnceAsync` or `ProcessBatchAsync`. Unit test that service directly.

For the `BackgroundService` itself, use a small number of tests to verify orchestration behavior, such as that it starts, creates a scope, calls the job, logs failures, and stops on cancellation. Use fake timers, short test-specific intervals, or completion signals rather than real delays.

##### Key Points to Mention

- Extract one-iteration logic.
- Test job service directly.
- Keep worker loop thin.
- Use completion signals.
- Use fake time or short intervals.
- Test cancellation and error handling separately.
- Avoid waiting for production intervals.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q01 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q02 -->
#### Intermediate Q02: Should hosted services run during `WebApplicationFactory` integration tests?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

It depends on the purpose of the test. If the test is verifying background processing, then the hosted service may need to run with controlled dependencies and deterministic timing.

For most API integration tests, hosted services should be removed or replaced because they can modify database state, call external services, slow down tests, or introduce flakiness.

In `WebApplicationFactory`, you can remove hosted services by removing `IHostedService` registrations or replacing a specific worker with a no-op test implementation.

##### Key Points to Mention

- Run hosted services only when relevant to the test.
- Remove or replace them for normal API tests.
- Workers can cause side effects and flakiness.
- Use `ConfigureServices` or `ConfigureTestServices`.
- Replace external dependencies.
- Keep test behavior deterministic.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q02 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q03 -->
#### Intermediate Q03: How do you test API-to-background-job behavior?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Split the behavior into two tests. First, test that the API endpoint records or enqueues the work and returns the expected response, usually `202 Accepted` for asynchronous processing. Use a fake queue or inspect the outbox table.

Second, test the background job processor separately to verify that it processes the queued work correctly.

This avoids making the API test wait for the full background job to complete and reduces flakiness.

##### Key Points to Mention

- Test enqueue/request creation separately.
- Test worker processing separately.
- Use fake queue or outbox table assertions.
- Avoid waiting for background completion in every API test.
- Use `202 Accepted` when work is asynchronous.
- Add a few full-flow integration tests if needed.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q03 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q04 -->
#### Intermediate Q04: How do you test a queued background worker?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Test the queue abstraction separately, test the work item or message handler separately, and use a small integration test to verify that the worker dequeues and executes one item.

For the worker integration test, use a `TaskCompletionSource` as a completion signal instead of sleeping. Start the worker, enqueue a work item that completes the signal, wait for the signal with a timeout, then stop the worker.

##### Key Points to Mention

- Test queue behavior separately.
- Test message handler separately.
- Use `TaskCompletionSource` for worker execution.
- Avoid arbitrary sleeps.
- Use cancellation timeout to prevent hangs.
- Stop the worker after the test.
- Verify error handling separately.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q04 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q05 -->
#### Intermediate Q05: Why is `PeriodicTimer` often safer than `System.Threading.Timer` for async background jobs?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

`System.Threading.Timer` can invoke the callback again even if the previous callback is still running. This can create overlapping job executions, race conditions, duplicate processing, and difficult tests.

`PeriodicTimer` works naturally with `await`. The next iteration starts only after the current awaited work finishes, unless the code explicitly starts concurrent work. This makes it easier to avoid overlap and to respect cancellation.

##### Key Points to Mention

- `System.Threading.Timer` can overlap callbacks.
- Overlap can cause duplicate processing.
- `PeriodicTimer` supports async loops naturally.
- Easier cancellation with `WaitForNextTickAsync`.
- Easier to reason about sequential jobs.
- Still test job logic separately from the timer.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q05 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q06 -->
#### Intermediate Q06: How should background jobs handle exceptions?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Background jobs should not swallow exceptions silently. For item-level failures, log the error with useful context and decide whether to retry, abandon, dead-letter, or mark the item as failed. For critical worker-level failures, decide whether the host should stop and be restarted by the environment.

The behavior should be intentional. Some failures are transient and should be retried. Some are permanent and should move to dead-letter storage or failed status. Expected cancellation should not be logged as a normal error.

##### Key Points to Mention

- Do not swallow exceptions.
- Log with job/message context.
- Handle cancellation separately.
- Retry transient failures.
- Dead-letter or mark permanent failures.
- Decide whether worker failure should stop the host.
- Test failure paths.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q06 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q07 -->
#### Intermediate Q07: How do you prevent flaky tests for background jobs?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

Prevent flakiness by making tests deterministic. Avoid real sleeps, uncontrolled timers, shared queues, shared databases without cleanup, test order dependency, and real external services.

Use fake time, fake queues, deterministic test data, completion signals, bounded polling, and short timeouts. Reset databases and queues between tests. Disable hosted services in unrelated integration tests. Stop and dispose hosts cleanly.

##### Key Points to Mention

- Avoid real sleeps.
- Use fake time.
- Use completion signals.
- Reset shared state.
- Replace external services.
- Avoid test order dependency.
- Use bounded timeouts.
- Stop hosts cleanly.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q07 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q08 -->
#### Intermediate Q08: How do you test idempotency in background jobs?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

Test idempotency by processing the same work item or message more than once and asserting that the final state and side effects happen only once.

For example, process the same email message twice and assert that only one email is sent and only one processed-message row exists. Use a unique constraint on the message ID to protect against race conditions.

Idempotency matters because queues and background workers may redeliver or retry the same work.

##### Key Points to Mention

- Process same message twice in test.
- Assert side effect occurs once.
- Store processed message IDs.
- Use unique constraints.
- Important for retries and redelivery.
- Prevents duplicate emails, payments, or events.
- Test both state and side effects.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q01 -->
#### Advanced Q01: How would you design a testable background-job architecture in .NET?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would keep the hosted service as a thin orchestration layer responsible for scheduling, cancellation, logging, scoping, and calling a job service. The actual work would live in a separate service, handler, or processor with a method like `RunOnceAsync`, `ProcessBatchAsync`, or `HandleAsync`.

I would use scoped services correctly by creating a scope per iteration, batch, or message. Time-dependent logic would use `TimeProvider`. Queue-based work would use an abstraction such as a bounded channel or external queue client. Job handlers would be idempotent and would have clear retry/dead-letter behavior.

Tests would be layered: unit tests for business logic, integration tests for database and queue behavior, host tests for worker wiring and cancellation, and a small number of E2E tests for real infrastructure.

##### Key Points to Mention

- Thin hosted service.
- Separate job logic.
- `RunOnceAsync` or handler method.
- Scope per iteration/message.
- Use `TimeProvider`.
- Bounded queues and backpressure.
- Idempotency and retries.
- Layered tests.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q01 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q02 -->
#### Advanced Q02: How would you test a background worker that uses a database and message broker?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

I would split the tests by responsibility. Unit test the message handler with fake dependencies. Integration test database persistence using a relational test database. Test message serialization, routing, completion, retry, and dead-letter behavior with a broker emulator or Testcontainers when real broker semantics matter.

For the hosted worker, I would write a small integration test that starts the host, publishes or queues a controlled message, waits for a completion signal or database state using bounded polling, then stops the host. I would avoid arbitrary sleeps and ensure queues and databases are cleaned between tests.

##### Key Points to Mention

- Unit test handler logic.
- Integration test database behavior.
- Use real broker/emulator for broker semantics.
- Test serialization and routing.
- Use bounded polling, not sleeps.
- Reset queues and database.
- Stop host cleanly.
- Keep full-flow tests focused.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q02 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q03 -->
#### Advanced Q03: How do you handle scoped dependencies and `DbContext` inside a hosted service?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

A hosted service is effectively a singleton, so it should not capture scoped services such as `DbContext`. Instead, inject `IServiceScopeFactory` and create a scope inside each iteration, batch, or message. Resolve scoped services from that scope and dispose the scope when the unit of work completes.

Alternatively, use `IDbContextFactory<TContext>` when the worker needs to create contexts directly. The important rule is that the context lifetime should match a short unit of work, not the worker lifetime.

##### Key Points to Mention

- Hosted services are long-lived.
- `DbContext` should be short-lived.
- Do not inject scoped services directly.
- Use `IServiceScopeFactory`.
- Create scope per unit of work.
- Dispose scope.
- `IDbContextFactory` is another option.
- Avoid stale tracking and thread-safety issues.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q03 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q04 -->
#### Advanced Q04: How would you test retry and dead-letter behavior?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

I would make retry behavior explicit and test it deterministically. For unit tests, use a fake dependency that fails a controlled number of times and then succeeds, or always fails. Assert the number of attempts, final state, logs or failure records, and whether the message is marked complete, abandoned, retried, or dead-lettered.

For real queue semantics, use an integration test with a broker emulator or Testcontainers. Keep retry delays short or injectable in tests so the test does not wait for production backoff intervals.

##### Key Points to Mention

- Use controlled fake failures.
- Assert attempt count.
- Assert final item status.
- Assert dead-letter/failure record.
- Keep retry delays injectable or short in tests.
- Test transient and permanent failures.
- Use real broker tests for broker-native retry behavior.
- Avoid infinite retries.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q04 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q05 -->
#### Advanced Q05: How do you design background jobs to avoid duplicate side effects?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Design job handlers to be idempotent. Use stable job IDs or message IDs, store processed message records, use database unique constraints, apply status transitions carefully, and check current state before performing side effects. For external calls such as payments, use idempotency keys if the provider supports them.

Also consider the failure window: the worker might perform a side effect and crash before marking the message complete. The next attempt should detect that the effect already happened or use an external idempotency key to prevent duplication.

##### Key Points to Mention

- Background messages can be redelivered.
- Retries can duplicate side effects.
- Use message IDs/job IDs.
- Store processed records.
- Add unique constraints.
- Use idempotency keys for external writes.
- Check state before side effects.
- Test duplicate processing.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q05 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q06 -->
#### Advanced Q06: How do you decide whether a background worker should stop the host on failure?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

It depends on whether the worker is critical to the application. If the app is useless or unsafe without the worker, stopping the host may be better because the orchestrator can restart the process and monitoring will notice the failure. If the worker is best-effort or can skip one failed item, the worker may log the error, update health state, and continue.

The decision should be explicit. Configure host behavior when needed, handle expected item-level exceptions inside the loop, and expose health checks or metrics so failures are visible.

##### Key Points to Mention

- Critical worker failure may require host stop.
- Non-critical item failure may be logged and skipped/retried.
- Avoid silent failure.
- Use `BackgroundServiceExceptionBehavior` intentionally.
- Health checks should reflect worker state.
- Container orchestrators can restart failed workers.
- Item-level and worker-level failures are different.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q06 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q07 -->
#### Advanced Q07: How do you test graceful shutdown of a background service?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Start the worker or host, trigger cancellation or call `StopAsync`, and assert that it completes within a bounded timeout. Use fake dependencies that can observe cancellation and release controlled waits. Do not allow the test to hang forever.

The worker should pass cancellation tokens to delays, database calls, HTTP calls, queue reads, and message processing. It should not use blocking calls such as `Thread.Sleep`. It should treat expected `OperationCanceledException` during shutdown as normal.

##### Key Points to Mention

- Start host/worker in test.
- Trigger cancellation or call `StopAsync`.
- Use bounded timeout.
- Fake dependencies can verify cancellation token usage.
- Avoid blocking calls.
- Handle `OperationCanceledException`.
- Assert prompt shutdown.
- Dispose host cleanly.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q07 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q08 -->
#### Advanced Q08: How would you test an outbox background processor?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

I would test it in layers. First, test that the main business transaction writes both the domain data and an outbox message. Second, test that the outbox processor reads unpublished messages, publishes them, and marks them as processed. Third, test failure behavior: if publishing fails, the message remains retryable. Fourth, test idempotency so already processed messages are not republished.

A small hosted-service integration test can verify that the worker runs the processor, but most outbox behavior should be tested through the processor directly.

##### Key Points to Mention

- Test business operation creates outbox message.
- Test processor publishes and marks processed.
- Test publish failure leaves message retryable.
- Test idempotency.
- Use fake publisher for unit tests.
- Use real database for persistence behavior.
- Use hosted-service test only for wiring.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q08 -->

<!-- question:start:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q09 -->
#### Advanced Q09: What should a production-ready background job expose for observability and testing?

<!-- question-id:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

A production-ready background job should expose logs, metrics, traces, health state, and failure information. Useful signals include last successful run time, last failure time, consecutive failure count, processed item count, failed item count, retry count, dead-letter count, queue length, oldest pending item age, duration, and dependency failures.

For testing, the same design helps because tests can assert database state, fake side effects, health state, and completion signals instead of relying on sleeps. Good observability also makes CI and production failures easier to diagnose.

##### Key Points to Mention

- Structured logs with job/message IDs.
- Metrics for success, failure, retry, duration.
- Health state for critical workers.
- Queue length and oldest item age.
- Dead-letter count.
- Correlation and trace IDs.
- Testable completion signals.
- Useful diagnostics for CI and production.

<!-- question:end:unit-tests-integration-tests-and-hosted-services-for-background-jobs-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
