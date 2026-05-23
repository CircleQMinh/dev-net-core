---
id: rate-limiting-memory-gc-awareness-runtime-diagnostics
topic: Performance, scalability, and caching

subtopic: Rate limiting, memory/GC awareness, and runtime diagnostics
category: .NET
---



## Overview

Rate limiting, memory/GC awareness, and runtime diagnostics are practical .NET skills used to keep applications stable, scalable, and observable in production.

Rate limiting controls how many requests or operations are allowed during a period of time. It protects APIs from abuse, accidental overload, brute-force attempts, expensive endpoint misuse, and downstream dependency pressure. In ASP.NET Core, rate limiting is commonly applied through middleware and endpoint policies.

Memory and garbage collection awareness means understanding how .NET manages memory, how object allocations affect performance, why garbage collection pauses happen, and how to avoid allocation-heavy code in hot paths. A developer does not usually manage memory manually in C#, but they still need to design code that does not create avoidable pressure on the managed heap.

Runtime diagnostics means using logs, metrics, traces, counters, dumps, and profiling tools to understand what a running .NET application is doing. This is important because many production issues cannot be solved only by reading code. Slow requests, high CPU, high allocation rate, thread pool starvation, memory leaks, and GC pressure need runtime evidence.

This topic matters in interviews because it shows whether a developer can think beyond writing features. Interviewers often want to know if you can build APIs that survive real traffic, diagnose performance problems, explain memory behavior, and use production-safe troubleshooting techniques.

## Core Concepts

### Rate limiting

Rate limiting is the practice of restricting how many requests or operations can happen within a defined boundary.

Common boundaries include:

- per IP address
- per authenticated user
- per API key
- per tenant
- per endpoint
- globally for the entire application
- per downstream dependency, such as a payment gateway or external API

Rate limiting is not the same as authentication or authorization. Authentication identifies the caller. Authorization decides what the caller is allowed to do. Rate limiting decides how often the caller or system can perform an action.

Typical reasons to use rate limiting include:

- protecting public APIs from abuse
- reducing brute-force login attempts
- preventing one tenant from affecting other tenants
- avoiding overload on expensive endpoints
- protecting downstream services with strict quotas
- keeping system behavior predictable under traffic spikes

### Common rate limiting algorithms

ASP.NET Core supports several common rate limiting strategies.

#### Fixed window

A fixed window limiter allows a maximum number of requests in a fixed time window.

Example:

- 100 requests per minute
- when the minute resets, the caller gets a new allowance

This is simple and cheap to understand, but it can allow traffic bursts around the boundary between two windows.

Example:

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("fixed", limiterOptions =>
    {
        limiterOptions.PermitLimit = 100;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });
});
```

#### Sliding window

A sliding window limiter divides a time window into smaller segments. It smooths request distribution better than a fixed window.

Example:

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddSlidingWindowLimiter("sliding", limiterOptions =>
    {
        limiterOptions.PermitLimit = 100;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.SegmentsPerWindow = 6;
        limiterOptions.QueueLimit = 0;
    });
});
```

This is useful when you want to reduce sudden bursts at time boundaries.

#### Token bucket

A token bucket limiter adds tokens over time. Each request consumes one or more tokens. If no token is available, the request is rejected or queued.

Example:

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddTokenBucketLimiter("token", limiterOptions =>
    {
        limiterOptions.TokenLimit = 100;
        limiterOptions.TokensPerPeriod = 20;
        limiterOptions.ReplenishmentPeriod = TimeSpan.FromSeconds(10);
        limiterOptions.AutoReplenishment = true;
        limiterOptions.QueueLimit = 0;
    });
});
```

Token bucket is useful when you want to allow controlled bursts while still enforcing an average rate.

#### Concurrency limiter

A concurrency limiter limits how many operations can run at the same time. It does not limit total requests per time window.

Example:

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddConcurrencyLimiter("concurrency", limiterOptions =>
    {
        limiterOptions.PermitLimit = 20;
        limiterOptions.QueueLimit = 10;
    });
});
```

This is useful for expensive operations such as file processing, report generation, image conversion, or calls to a slow downstream service.

### Applying rate limiting in ASP.NET Core

A basic ASP.NET Core setup usually registers rate limiting services and enables the middleware in the request pipeline.

```csharp
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddFixedWindowLimiter("standard-api", limiterOptions =>
    {
        limiterOptions.PermitLimit = 60;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });
});

var app = builder.Build();

app.UseRateLimiter();

app.MapGet("/api/products", () => Results.Ok())
   .RequireRateLimiting("standard-api");

app.Run();
```

For APIs, rejected requests normally return `429 Too Many Requests`.

A production API should often return useful response information:

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;

        if (context.Lease.TryGetMetadata(
            MetadataName.RetryAfter,
            out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter =
                ((int)retryAfter.TotalSeconds).ToString();
        }

        await context.HttpContext.Response.WriteAsync(
            "Too many requests. Please try again later.",
            cancellationToken);
    };
});
```

### Partitioned rate limiting

Partitioned rate limiting creates separate limits for different callers or groups.

A common example is per-user or per-IP rate limiting:

```csharp
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("per-user", httpContext =>
    {
        var userName = httpContext.User.Identity?.Name;

        var partitionKey = !string.IsNullOrWhiteSpace(userName)
            ? userName
            : httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey,
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            });
    });
});
```

Partitioning is powerful, but it must be designed carefully. If every random input value creates a new partition, an attacker can cause memory growth by creating many unique keys. Good partition keys should be bounded, normalized, and meaningful.

### Rate limiting in distributed systems

Built-in in-memory rate limiting works well for a single application instance. In a multi-instance environment, each instance has its own memory unless the rate limit state is stored in a shared system.

For distributed applications, common approaches include:

- applying rate limits at an API gateway or reverse proxy
- using a shared cache or data store such as Redis
- enforcing limits in an external identity/API management layer
- combining application-level limits with infrastructure-level limits

Example problem:

- instance A allows 100 requests per minute
- instance B allows 100 requests per minute
- the real global limit becomes 200 requests per minute if traffic is balanced across both instances

For interviews, it is important to explain whether the limit is per instance or global across the system.

### Rate limiting trade-offs and mistakes

Common trade-offs:

| Choice | Benefit | Risk |
|---|---|---|
| Fixed window | Simple and fast | Boundary bursts |
| Sliding window | Smoother than fixed window | More configuration complexity |
| Token bucket | Allows controlled bursts | Needs careful tuning |
| Concurrency limiter | Protects expensive work | Does not enforce requests per minute |
| Queueing | Reduces rejected requests | Can increase latency and memory usage |
| Rejecting immediately | Protects resources quickly | Caller must retry later |

Common mistakes include:

- treating rate limiting as authentication
- applying one global limit to all endpoints
- forgetting that expensive endpoints need stricter limits
- using client IP incorrectly behind proxies
- allowing unlimited rate limiter partitions
- enabling queueing without considering latency and memory
- not returning `429 Too Many Requests`
- not load testing rate limit behavior
- using only application-local limits when a distributed global limit is required

### .NET managed memory model

.NET uses automatic memory management. Objects are allocated on the managed heap and cleaned up by the garbage collector when they are no longer reachable.

Important terms:

| Term | Meaning |
|---|---|
| Managed heap | Memory area where most reference type objects are allocated |
| Stack | Memory used for method calls, local value types, and references |
| Garbage collector | Runtime component that reclaims unused managed memory |
| Allocation | Creating objects or arrays that consume memory |
| Gen 0 | Young, short-lived objects |
| Gen 1 | Buffer generation between short-lived and long-lived objects |
| Gen 2 | Long-lived objects |
| LOH | Large Object Heap, used for large objects |
| GC pause | Time when application threads may be suspended for collection work |

The GC is optimized around the idea that most objects are short-lived. For web applications, request-scoped objects should usually become unreachable after the request completes.

### Generational garbage collection

The .NET GC divides objects into generations.

#### Generation 0

Generation 0 contains newly allocated small objects. Collections are frequent and usually fast.

Example short-lived allocations:

```csharp
public string FormatCustomerName(Customer customer)
{
    return $"{customer.FirstName} {customer.LastName}";
}
```

The resulting string may be short-lived if used only for one response.

#### Generation 1

Generation 1 acts as a middle area for objects that survived a Gen 0 collection but may still be short-lived.

#### Generation 2

Generation 2 contains longer-lived objects. Gen 2 collections are more expensive because they involve more of the heap.

Long-lived objects often include:

- static caches
- singleton service state
- large object graphs retained by references
- long-lived collections
- accidental memory leaks caused by event handlers or static references

### Large Object Heap

Large objects are allocated on the Large Object Heap. Large arrays, large strings, and large buffers can increase memory pressure and trigger more expensive collections.

Examples that can create large allocations:

```csharp
var bytes = new byte[100_000];

var json = await File.ReadAllTextAsync("large-file.json");

var allRows = await dbContext.Orders.ToListAsync();
```

Better approaches can include:

- streaming instead of loading everything into memory
- paging large result sets
- using buffers carefully
- reusing arrays with `ArrayPool<T>` in hot paths
- avoiding unnecessary large string concatenation
- compressing or chunking large payloads when appropriate

Example using `ArrayPool<byte>`:

```csharp
using System.Buffers;

public async Task CopyWithPooledBufferAsync(Stream input, Stream output)
{
    byte[] buffer = ArrayPool<byte>.Shared.Rent(64 * 1024);

    try
    {
        int bytesRead;

        while ((bytesRead = await input.ReadAsync(buffer)) > 0)
        {
            await output.WriteAsync(buffer.AsMemory(0, bytesRead));
        }
    }
    finally
    {
        ArrayPool<byte>.Shared.Return(buffer);
    }
}
```

Pooling is useful in hot paths, but it adds complexity. It should be used when measurements show allocation pressure.

### Allocation awareness in C#

Allocation awareness means writing code that avoids unnecessary object creation, especially in hot paths.

Common allocation sources include:

- LINQ chains in performance-sensitive loops
- repeated string concatenation
- boxing value types
- closures and captured variables
- creating arrays repeatedly
- materializing large collections with `ToList()`
- unnecessary exceptions in normal control flow
- large JSON serialization/deserialization operations

Example of avoidable repeated allocation:

```csharp
foreach (var item in items)
{
    var message = "Item: " + item.Name + ", Status: " + item.Status;
    logger.LogInformation(message);
}
```

Better logging pattern:

```csharp
foreach (var item in items)
{
    logger.LogInformation(
        "Item: {ItemName}, Status: {Status}",
        item.Name,
        item.Status);
}
```

Structured logging avoids unnecessary string formatting when the log level is disabled and creates better searchable logs.

### Memory leaks in managed code

Managed code can still leak memory. A memory leak happens when objects are no longer needed but are still reachable from active references.

Common causes include:

- static collections that keep growing
- event subscriptions that are never removed
- long-lived services holding references to scoped services or request data
- unbounded caches
- background queues without limits
- timers that are not disposed
- large object graphs attached to singleton services
- storing `HttpContext` or request objects after a request ends

Example event subscription leak:

```csharp
public sealed class OrderListener
{
    private readonly OrderService _orderService;

    public OrderListener(OrderService orderService)
    {
        _orderService = orderService;
        _orderService.OrderCreated += OnOrderCreated;
    }

    private void OnOrderCreated(object? sender, OrderCreatedEventArgs e)
    {
        // Handle event
    }
}
```

If `OrderService` is long-lived and `OrderListener` is expected to be short-lived, the event subscription can keep `OrderListener` alive.

A safer approach is to unsubscribe when appropriate:

```csharp
public sealed class OrderListener : IDisposable
{
    private readonly OrderService _orderService;

    public OrderListener(OrderService orderService)
    {
        _orderService = orderService;
        _orderService.OrderCreated += OnOrderCreated;
    }

    private void OnOrderCreated(object? sender, OrderCreatedEventArgs e)
    {
        // Handle event
    }

    public void Dispose()
    {
        _orderService.OrderCreated -= OnOrderCreated;
    }
}
```

### IDisposable and unmanaged resources

The GC manages memory, but it does not automatically release unmanaged resources immediately.

Examples of unmanaged or external resources include:

- file handles
- sockets
- database connections
- streams
- timers
- native handles

Use `using` or `await using` to release resources promptly:

```csharp
await using var stream = File.OpenRead("report.pdf");

using var connection = new SqlConnection(connectionString);

await connection.OpenAsync();
```

Failing to dispose resources can create production issues even when managed memory appears normal.

### GC performance habits

Good GC habits include:

- avoid unnecessary allocations in hot paths
- avoid loading large data sets into memory
- use streaming for large files and responses
- use pagination for database results
- prefer `StringBuilder` for repeated string building
- use `Span<T>` and `Memory<T>` only where they simplify or improve measured performance
- reuse buffers carefully when appropriate
- keep caches bounded
- avoid calling `GC.Collect()` manually in normal application code
- measure before optimizing

Bad habits include:

- assuming GC means memory never matters
- blaming GC before checking allocation rate
- using object pooling everywhere without measurement
- keeping references longer than needed
- storing request-scoped data in singletons
- ignoring large object allocations
- using exceptions for expected control flow in high-volume paths

### Runtime diagnostics

Runtime diagnostics is the process of observing and analyzing a running application.

Common diagnostic signals:

| Signal | Purpose |
|---|---|
| Logs | Understand important events and failures |
| Metrics | Track numeric measurements over time |
| Traces | Follow request flow across components |
| Counters | Inspect runtime-level behavior |
| Dumps | Analyze process memory and threads |
| Profiles | Find CPU or allocation hot spots |

A practical investigation starts with symptoms and evidence.

Example symptoms:

- API latency increased
- CPU is high
- memory keeps growing
- many requests time out
- error rate increased
- Gen 2 collections are frequent
- thread pool queue length is high
- database calls are slow

### dotnet-counters

`dotnet-counters` monitors live runtime counters.

Example:

```bash
dotnet-counters monitor --process-id 12345 System.Runtime
```

Useful counters include:

- CPU usage
- working set
- GC heap size
- allocation rate
- Gen 0/1/2 GC count
- time in GC
- exception count
- thread pool thread count
- thread pool queue length

Example interpretation:

| Observation | Possible meaning |
|---|---|
| High allocation rate | Hot path creates many objects |
| Frequent Gen 2 collections | Long-lived objects or high memory pressure |
| High time in GC | GC is affecting throughput |
| Rising working set | Memory growth or cache growth |
| High thread pool queue length | Blocking work or insufficient throughput |
| High exception count | Exceptions may be used as normal flow or errors are repeated |

### dotnet-trace

`dotnet-trace` collects runtime events for deeper analysis.

Example:

```bash
dotnet-trace collect --process-id 12345
```

It is useful for:

- CPU investigation
- runtime event analysis
- GC events
- thread pool behavior
- request processing activity when combined with other telemetry

A trace is better than guessing when the question is, "Where is time being spent?"

### dotnet-dump

`dotnet-dump` collects and analyzes process dumps.

Example:

```bash
dotnet-dump collect --process-id 12345 --output app.dmp
dotnet-dump analyze app.dmp
```

A dump is useful for:

- memory leak investigation
- high memory usage
- deadlocks
- thread inspection
- object heap analysis
- understanding what is still referenced

Common dump analysis questions include:

- What object types consume the most memory?
- Why are these objects still alive?
- Are many threads blocked?
- Is the application waiting on locks, I/O, or tasks?

### dotnet-gcdump

`dotnet-gcdump` collects a GC heap snapshot.

Example:

```bash
dotnet-gcdump collect --process-id 12345 --output app.gcdump
```

It is useful for comparing heap usage over time and identifying which object types are growing.

Important caution: collecting a GC dump can trigger a full garbage collection, which may affect a performance-sensitive application. In production, use diagnostics carefully and follow operational safety procedures.

### Logs, metrics, and traces

Modern production diagnostics normally combines three pillars:

| Pillar | What it answers |
|---|---|
| Logs | What happened? |
| Metrics | How often and how much? |
| Traces | Where did time go across services? |

Example:

- logs show a request failed
- metrics show error rate increased after deployment
- traces show most latency is inside a downstream payment API call

In .NET applications, common observability tools include:

- `ILogger`
- built-in .NET metrics
- ASP.NET Core metrics
- OpenTelemetry
- Application Insights
- Prometheus/Grafana
- distributed tracing with `ActivitySource`

Example custom metric:

```csharp
using System.Diagnostics.Metrics;

public sealed class OrderMetrics
{
    private readonly Counter<int> _ordersCreated;

    public OrderMetrics(IMeterFactory meterFactory)
    {
        var meter = meterFactory.Create("MyApp.Orders");
        _ordersCreated = meter.CreateCounter<int>("orders.created");
    }

    public void OrderCreated()
    {
        _ordersCreated.Add(1);
    }
}
```

### Diagnosing high memory usage

A practical memory investigation might look like this:

1. Check process memory and GC heap size.
2. Check allocation rate.
3. Check Gen 2 GC frequency.
4. Capture multiple snapshots over time.
5. Compare which object types are growing.
6. Find roots that keep objects alive.
7. Review caches, static references, queues, event handlers, and long-lived services.
8. Fix the root cause.
9. Validate with the same metrics after the fix.

Example diagnosis:

- memory grows continuously
- GC heap grows with it
- `dotnet-gcdump` shows many `OrderReport` objects
- dump analysis shows a singleton service holds a list of generated reports
- fix by adding expiration, size limits, or external storage

### Diagnosing high CPU

A practical CPU investigation might look like this:

1. Confirm CPU is high using metrics.
2. Check whether high CPU is constant or spike-based.
3. Collect a trace or CPU profile.
4. Identify hot methods.
5. Check for tight loops, expensive serialization, regex usage, inefficient LINQ, repeated database query materialization, or lock contention.
6. Optimize the measured hot path.
7. Validate improvement with load testing.

Avoid optimizing random code without evidence. The slowest code path is often not where developers expect.

### Diagnosing thread pool starvation

Thread pool starvation happens when work items wait too long because available thread pool threads are blocked or exhausted.

Common causes include:

- blocking async code with `.Result` or `.Wait()`
- sync-over-async calls
- long-running CPU work on request threads
- blocking I/O
- lock contention
- too much parallelism
- thread pool misuse

Problematic example:

```csharp
public IActionResult Get()
{
    var result = _service.GetDataAsync().Result;
    return Ok(result);
}
```

Better approach:

```csharp
public async Task<IActionResult> Get(CancellationToken cancellationToken)
{
    var result = await _service.GetDataAsync(cancellationToken);
    return Ok(result);
}
```

Thread pool issues often show up as high latency, request timeouts, and growing queue length even when CPU is not fully used.

### Production-safe diagnostics habits

Good production diagnostics habits include:

- collect the least invasive evidence first
- start with metrics and logs before dumps
- avoid collecting heavy dumps during peak traffic unless necessary
- protect dumps because they can contain sensitive data
- use staging or replica environments when possible
- capture baseline metrics before an incident
- add correlation IDs to logs and traces
- keep dashboards for request rate, latency, errors, CPU, memory, GC, and dependency calls
- document known performance limits and rate limits
- validate fixes with load testing

### Rate limiting and diagnostics together

Rate limiting should be observable.

Track:

- total requests
- rejected requests
- rejection rate by endpoint
- rejection rate by user/tenant/API key
- queue length if queueing is enabled
- downstream dependency latency
- `429` response rate
- whether rate limits are too strict or too loose

A rate limiter that silently rejects requests without monitoring can create confusing production behavior.

Example:

```csharp
options.OnRejected = async (context, cancellationToken) =>
{
    var logger = context.HttpContext.RequestServices
        .GetRequiredService<ILoggerFactory>()
        .CreateLogger("RateLimiting");

    logger.LogWarning(
        "Rate limit rejected request. Path: {Path}, User: {User}",
        context.HttpContext.Request.Path,
        context.HttpContext.User.Identity?.Name ?? "anonymous");

    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;

    await context.HttpContext.Response.WriteAsync(
        "Too many requests.",
        cancellationToken);
};
```

### Common interview comparison: performance, scalability, and diagnostics

| Concept | Focus | Example |
|---|---|---|
| Rate limiting | Control incoming or outgoing operation rate | 100 requests per minute per user |
| Throttling | Slowing or limiting resource usage | External API quota protection |
| Load shedding | Rejecting work to keep system healthy | Return 503 when overloaded |
| Caching | Avoid repeated expensive work | Cache product list for 5 minutes |
| GC tuning | Runtime memory behavior | Server GC vs workstation GC |
| Profiling | Find expensive code | CPU trace shows JSON serialization hot path |
| Metrics | Continuous numeric visibility | p95 latency, allocation rate, request count |
| Dump analysis | Deep process inspection | Find memory leak roots |

### Best practices

Use rate limiting deliberately:

- apply different limits to different endpoint costs
- partition by authenticated identity when possible
- handle anonymous users carefully
- return `429 Too Many Requests`
- include retry information when appropriate
- load test rate limit behavior
- use gateway or distributed rate limiting for multi-instance global limits
- monitor rejected requests

Write memory-aware code:

- avoid unnecessary allocations in hot paths
- stream large files and responses
- paginate large database queries
- bound caches and queues
- dispose resources
- avoid keeping request data in singleton services
- avoid manual GC collection in normal code
- measure before optimizing

Use diagnostics professionally:

- use logs, metrics, and traces together
- start with lightweight tools
- use counters for live runtime behavior
- use traces for CPU and timing problems
- use dumps for deep memory/thread investigation
- protect diagnostic files
- validate fixes with repeatable measurements

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is rate limiting, and why is it used in APIs?

<!-- question:start:rate-limiting-memory-gc-awareness-runtime-diagnostics-beginner-q01 -->
<!-- question-id:rate-limiting-memory-gc-awareness-runtime-diagnostics-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Rate limiting controls how many requests or operations a caller can perform within a defined period or concurrency boundary. In APIs, it is used to protect the system from abuse, accidental overload, brute-force attempts, expensive endpoint misuse, and downstream dependency pressure.

It can be applied globally, per endpoint, per user, per IP address, per tenant, or per API key. When the limit is exceeded, APIs commonly return `429 Too Many Requests`.

Rate limiting is not a replacement for authentication or authorization. Authentication identifies the caller, authorization determines what the caller can access, and rate limiting controls how often the caller can perform actions.

##### Key Points to Mention

- Controls request or operation frequency
- Protects APIs and downstream systems
- Common response is `429 Too Many Requests`
- Can be global or partitioned per caller
- Different from authentication and authorization

<!-- question:end:rate-limiting-memory-gc-awareness-runtime-diagnostics-beginner-q01 -->

#### What is the difference between fixed window, sliding window, token bucket, and concurrency limiting?

<!-- question:start:rate-limiting-memory-gc-awareness-runtime-diagnostics-beginner-q02 -->
<!-- question-id:rate-limiting-memory-gc-awareness-runtime-diagnostics-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A fixed window limiter allows a certain number of requests in a fixed time period, such as 100 requests per minute. It is simple but can allow bursts at the boundary between windows.

A sliding window limiter divides the window into segments and smooths traffic more effectively than a fixed window. It reduces boundary burst problems.

A token bucket limiter replenishes tokens over time. Requests consume tokens. It can allow controlled bursts while maintaining an average rate.

A concurrency limiter controls how many operations are running at the same time. It does not limit how many total requests happen per minute. It is useful for expensive work such as report generation or slow external calls.

##### Key Points to Mention

- Fixed window is simple but can burst at boundaries
- Sliding window smooths traffic
- Token bucket supports controlled bursts
- Concurrency limiter controls simultaneous work
- Choose based on endpoint cost and traffic pattern

<!-- question:end:rate-limiting-memory-gc-awareness-runtime-diagnostics-beginner-q02 -->

#### What is garbage collection in .NET?

<!-- question:start:rate-limiting-memory-gc-awareness-runtime-diagnostics-beginner-q03 -->
<!-- question-id:rate-limiting-memory-gc-awareness-runtime-diagnostics-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Garbage collection is .NET's automatic memory management system. Objects are allocated on the managed heap, and the garbage collector reclaims memory when objects are no longer reachable.

The .NET GC is generational. New objects usually start in Generation 0. Objects that survive collections can be promoted to Generation 1 and Generation 2. This design works well because many objects in typical applications are short-lived.

The developer does not usually free managed memory manually, but still needs to write memory-aware code. Excessive allocations, long-lived references, unbounded caches, and large objects can cause performance problems.

##### Key Points to Mention

- Automatic memory management
- Reclaims unreachable managed objects
- Uses generations 0, 1, and 2
- Most short-lived objects are collected quickly
- Developers still need allocation awareness

<!-- question:end:rate-limiting-memory-gc-awareness-runtime-diagnostics-beginner-q03 -->

#### What are logs, metrics, and traces?

<!-- question:start:rate-limiting-memory-gc-awareness-runtime-diagnostics-beginner-q04 -->
<!-- question-id:rate-limiting-memory-gc-awareness-runtime-diagnostics-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Logs record events that happened in the application, such as errors, warnings, or business events. Metrics are numerical measurements over time, such as request rate, latency, CPU usage, memory usage, and error count. Traces show the path of a request across components and help identify where time is spent.

Together, logs, metrics, and traces provide observability. Logs explain what happened, metrics show how often or how much, and traces show where a request went and where it was slow.

##### Key Points to Mention

- Logs answer what happened
- Metrics answer how much or how often
- Traces answer where time was spent
- Together they support observability
- Useful for production diagnostics

<!-- question:end:rate-limiting-memory-gc-awareness-runtime-diagnostics-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you configure rate limiting in ASP.NET Core?

<!-- question:start:rate-limiting-memory-gc-awareness-runtime-diagnostics-intermediate-q01 -->
<!-- question-id:rate-limiting-memory-gc-awareness-runtime-diagnostics-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

In ASP.NET Core, rate limiting is configured by registering rate limiter services and enabling rate limiting middleware. Policies can then be applied globally or to specific endpoints.

Example:

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddFixedWindowLimiter("api", limiterOptions =>
    {
        limiterOptions.PermitLimit = 100;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });
});

var app = builder.Build();

app.UseRateLimiter();

app.MapGet("/api/orders", () => Results.Ok())
   .RequireRateLimiting("api");
```

In a real application, I would tune limits based on endpoint cost, user type, expected traffic, and downstream dependencies. I would also monitor rejected requests and load test behavior before production rollout.

##### Key Points to Mention

- Register with `AddRateLimiter`
- Enable with `UseRateLimiter`
- Apply policies to endpoints
- Return `429` for rejected requests
- Tune based on endpoint cost
- Load test and monitor behavior

<!-- question:end:rate-limiting-memory-gc-awareness-runtime-diagnostics-intermediate-q01 -->

#### Why can in-memory rate limiting be problematic in a multi-instance application?

<!-- question:start:rate-limiting-memory-gc-awareness-runtime-diagnostics-intermediate-q02 -->
<!-- question-id:rate-limiting-memory-gc-awareness-runtime-diagnostics-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

In-memory rate limiting stores rate limit state inside one application instance. If the application runs on multiple instances, each instance has its own independent limit.

For example, if each instance allows 100 requests per minute and there are three instances, the real system may allow up to 300 requests per minute if traffic is distributed across all instances.

For global distributed limits, the application usually needs a shared coordination mechanism such as an API gateway, reverse proxy, Redis-based limiter, API management service, or another centralized quota system.

##### Key Points to Mention

- In-memory limits are usually per instance
- Multi-instance apps can multiply effective limits
- Global limits need shared state or gateway enforcement
- Important for downstream quota protection
- Must define whether a limit is local or global

<!-- question:end:rate-limiting-memory-gc-awareness-runtime-diagnostics-intermediate-q02 -->

#### What does allocation rate tell you in .NET diagnostics?

<!-- question:start:rate-limiting-memory-gc-awareness-runtime-diagnostics-intermediate-q03 -->
<!-- question-id:rate-limiting-memory-gc-awareness-runtime-diagnostics-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Allocation rate measures how quickly the application is allocating managed memory. A high allocation rate means the app is creating many objects or large objects over time.

High allocation rate can increase GC frequency and CPU overhead. Even if objects are short-lived and collected successfully, the application may spend more time allocating and collecting memory.

To investigate, I would use counters or profiling tools to identify hot paths that allocate heavily. Common causes include repeated string creation, unnecessary LINQ materialization, large arrays, JSON processing, closures, boxing, and creating temporary collections in loops.

##### Key Points to Mention

- Measures memory allocated over time
- High allocation rate can increase GC pressure
- Short-lived allocations can still hurt performance
- Use counters/profilers to identify hot paths
- Optimize based on measurements, not guesses

<!-- question:end:rate-limiting-memory-gc-awareness-runtime-diagnostics-intermediate-q03 -->

#### How can managed code still have memory leaks?

<!-- question:start:rate-limiting-memory-gc-awareness-runtime-diagnostics-intermediate-q04 -->
<!-- question-id:rate-limiting-memory-gc-awareness-runtime-diagnostics-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Managed code can leak memory when objects are still reachable even though the application no longer needs them. The GC only collects unreachable objects. If a static field, singleton service, event subscription, timer, unbounded cache, or background queue still references objects, those objects remain alive.

Examples include a static list that keeps growing, a singleton service storing request data, event subscribers that never unsubscribe, or an unbounded cache without expiration or size limits.

To diagnose this, I would compare memory snapshots or dumps over time and identify which object types are growing and what references are keeping them alive.

##### Key Points to Mention

- GC collects unreachable objects only
- Reachable-but-unneeded objects cause leaks
- Common causes: static references, events, caches, queues, timers
- Singleton holding scoped/request data is risky
- Diagnose with dumps or GC heap snapshots

<!-- question:end:rate-limiting-memory-gc-awareness-runtime-diagnostics-intermediate-q04 -->

#### When would you use `dotnet-counters`, `dotnet-trace`, `dotnet-dump`, and `dotnet-gcdump`?

<!-- question:start:rate-limiting-memory-gc-awareness-runtime-diagnostics-intermediate-q05 -->
<!-- question-id:rate-limiting-memory-gc-awareness-runtime-diagnostics-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

I would use `dotnet-counters` for live runtime metrics such as CPU usage, allocation rate, GC heap size, exception count, and thread pool queue length. It is a good first tool for observing symptoms.

I would use `dotnet-trace` when I need deeper timing or CPU information, such as identifying hot methods or runtime events.

I would use `dotnet-dump` when I need a process dump for memory leak analysis, thread inspection, deadlocks, or understanding object references.

I would use `dotnet-gcdump` when I want a GC heap snapshot that can show object counts and memory usage by type, especially when comparing heap growth over time.

##### Key Points to Mention

- `dotnet-counters`: live metrics
- `dotnet-trace`: runtime event and CPU analysis
- `dotnet-dump`: memory/thread dump analysis
- `dotnet-gcdump`: GC heap snapshots
- Start lightweight before heavy diagnostics

<!-- question:end:rate-limiting-memory-gc-awareness-runtime-diagnostics-intermediate-q05 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you diagnose an ASP.NET Core API with high latency and rising memory usage?

<!-- question:start:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q01 -->
<!-- question-id:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would start with metrics to understand the pattern. I would check request rate, p95/p99 latency, error rate, CPU, working set, GC heap size, allocation rate, time in GC, Gen 2 GC count, thread pool queue length, and dependency latency.

If memory is rising, I would determine whether the GC heap is rising or whether the issue is native memory, container memory, or another source. If the GC heap is rising, I would capture heap snapshots or dumps at different times and compare object growth. I would look for unbounded caches, static collections, queues, event subscriptions, large object allocations, or singleton services retaining scoped data.

If latency is rising, I would inspect traces to see where time is spent. If the thread pool queue length is high, I would check for sync-over-async, blocking calls, lock contention, or long CPU-bound work on request threads.

After identifying the likely root cause, I would make a targeted fix and validate it using the same metrics and load test scenario.

##### Key Points to Mention

- Start with metrics and symptoms
- Separate CPU, memory, GC, thread pool, and dependency issues
- Compare memory snapshots over time
- Use traces to find latency sources
- Check for blocking async code and thread pool starvation
- Validate the fix with repeatable measurements

<!-- question:end:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q01 -->

#### How would you design rate limiting for a public multi-tenant API?

<!-- question:start:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q02 -->
<!-- question-id:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

For a public multi-tenant API, I would define limits by tenant, user, API key, endpoint cost, and possibly subscription tier. Expensive endpoints would have stricter limits than cheap read endpoints. Authentication should happen before user-based rate limiting so the system can identify the caller correctly.

I would avoid only using client IP because many users can share one NAT address, and attackers can rotate IPs. For anonymous endpoints, IP-based limiting may still be useful, but it should be combined with other protections.

In a multi-instance environment, I would enforce global limits at an API gateway, API management layer, or distributed rate limiter backed by shared state such as Redis. I would monitor `429` rates, latency, queue length, and downstream dependency behavior.

I would also define clear client behavior: return `429 Too Many Requests`, optionally include `Retry-After`, document limits, and make sure clients can retry safely with backoff.

##### Key Points to Mention

- Partition by tenant/user/API key/subscription tier
- Different limits for different endpoint costs
- Authentication should identify the caller
- Be careful with IP-only limits
- Use gateway or distributed shared state for global limits
- Monitor and document rate limit behavior

<!-- question:end:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q02 -->

#### What are the risks of using queueing in a rate limiter?

<!-- question:start:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q03 -->
<!-- question-id:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Queueing in a rate limiter can improve user experience by waiting for permits instead of immediately rejecting requests. However, it can also increase latency, consume memory, hide overload, and cause requests to wait so long that clients time out anyway.

If queue limits are too large, the application can hold many pending requests, which increases memory pressure and may make an outage worse. Queueing can also create unfairness if one caller fills the queue.

In production, queueing should be bounded and monitored. For many APIs, rejecting quickly with `429` is safer than allowing an unbounded backlog. Queueing is more suitable when the operation is short, the queue is small, and the caller benefits from waiting briefly.

##### Key Points to Mention

- Queueing can reduce rejection but increase latency
- Large queues can increase memory pressure
- Queueing can hide overload
- Bound queue size
- Monitor queue length and wait time
- Fast rejection is often safer for public APIs

<!-- question:end:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q03 -->

#### Why should developers usually avoid manually calling `GC.Collect()`?

<!-- question:start:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q04 -->
<!-- question-id:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Developers should usually avoid manually calling `GC.Collect()` because the .NET GC is already optimized to decide when collections should happen. Forcing a collection can cause unnecessary pauses, promote objects that might have died naturally, reduce throughput, and make performance worse.

Most memory problems are better solved by reducing unnecessary allocations, fixing retained references, bounding caches, disposing resources, streaming large data, and measuring allocation behavior.

There are rare specialized cases where manual collection may be considered, such as after a known large temporary workload in a desktop application, but it should not be normal server-side practice.

##### Key Points to Mention

- GC is already adaptive
- Forced collections can hurt throughput and latency
- Fix allocation and retention problems instead
- Rare specialized cases exist
- Avoid in normal ASP.NET Core request handling

<!-- question:end:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q04 -->

#### How would you identify thread pool starvation in a .NET application?

<!-- question:start:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q05 -->
<!-- question-id:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

I would look for symptoms such as high latency, request timeouts, low or moderate CPU, and a growing thread pool queue length. Using runtime counters, I would check thread pool thread count, completed work item count, and queue length.

Then I would inspect code and traces for blocking async calls such as `.Result`, `.Wait()`, sync-over-async patterns, long-running CPU work on request threads, lock contention, blocking I/O, or too much parallelism.

The fix usually involves using async all the way, avoiding blocking calls, moving long CPU-bound work outside request threads, limiting parallelism, reducing lock contention, and using proper background processing patterns.

##### Key Points to Mention

- Symptoms: latency, timeouts, growing queue length
- CPU may not be fully used
- Check thread pool counters
- Look for `.Result`, `.Wait()`, blocking I/O, locks
- Fix with async all the way and bounded work

<!-- question:end:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q05 -->

#### How do you decide whether a performance problem should be solved with caching, rate limiting, code optimization, or infrastructure scaling?

<!-- question:start:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q06 -->
<!-- question-id:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

I would first identify the bottleneck using metrics, traces, and profiling. If repeated expensive reads are causing load, caching may help. If abusive or excessive traffic is the problem, rate limiting may help. If a hot method is CPU-heavy or allocation-heavy, code optimization may help. If the application is healthy but demand exceeds capacity, scaling may help.

The wrong solution can hide the real problem. For example, scaling may temporarily hide a memory leak, caching may hide slow queries while creating stale data problems, and rate limiting may protect the system but hurt legitimate users if configured poorly.

A good answer is evidence-based: measure, identify the bottleneck, choose the smallest safe fix, and validate the result.

##### Key Points to Mention

- Diagnose before choosing the solution
- Caching helps repeated expensive reads
- Rate limiting controls abusive or excessive traffic
- Code optimization fixes hot paths
- Scaling helps when demand exceeds healthy capacity
- Validate with metrics and load tests

<!-- question:end:rate-limiting-memory-gc-awareness-runtime-diagnostics-advanced-q06 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
