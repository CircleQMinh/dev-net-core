---
id: ihttpclientfactory-and-resilient-outbound-http
topic: Performance, scalability, and caching
subtopic: IHttpClientFactory and Resilient Outbound HTTP
category: .NET
---



## Overview

`IHttpClientFactory` is the recommended .NET abstraction for creating and configuring `HttpClient` instances in applications that use dependency injection. It centralizes outbound HTTP configuration, manages underlying message handler lifetimes, supports named and typed clients, enables outgoing middleware through delegating handlers, integrates logging, and works with modern resilience strategies such as retries, timeouts, circuit breakers, rate limiting, and hedging.

Outbound HTTP calls are common in modern .NET systems. A Web API may call:

- Payment providers.
- Identity providers.
- Internal microservices.
- Third-party APIs.
- Azure services.
- REST APIs.
- Webhooks.
- External reporting services.
- Feature flag services.
- Search services.
- Notification services.

These calls can fail for reasons outside the current application:

- Network interruptions.
- DNS changes.
- Connection resets.
- Server overload.
- Rate limiting.
- Slow dependencies.
- Temporary 5xx responses.
- Timeouts.
- Authentication failures.
- Bad request payloads.
- Downstream deployment restarts.
- Regional outages.

Resilient outbound HTTP means designing these calls so the application can handle expected transient failures without making the system worse. A resilient client should use correct `HttpClient` lifetime management, sensible timeouts, safe retries, circuit breakers, rate limits, cancellation tokens, observability, and clear error handling.

This topic is important because incorrect `HttpClient` usage can cause production incidents. Creating and disposing a new `HttpClient` for every request can exhaust available sockets. Keeping a single `HttpClient` forever without connection lifetime configuration can fail to react to DNS changes. Retrying every request blindly can duplicate writes, increase downstream load, and make outages worse. Hiding all HTTP failures behind generic exceptions makes production debugging harder.

This topic is important for interviews because it tests practical .NET production experience. Interviewers often ask:

- Why should you not create a new `HttpClient` manually for every request?
- What problem does `IHttpClientFactory` solve?
- What is the difference between `HttpClient` and `HttpMessageHandler`?
- What are named clients and typed clients?
- Why can typed clients be problematic in singleton services?
- What is handler lifetime?
- How does `IHttpClientFactory` help with DNS changes?
- What is `SocketsHttpHandler.PooledConnectionLifetime`?
- How do you add retries, timeouts, and circuit breakers?
- Why are retries dangerous for non-idempotent HTTP methods?
- What is a delegating handler?
- How do you add authentication headers?
- How do you test code that uses `HttpClient`?
- How do you avoid leaking cookies or scoped data through handlers?
- How do you observe outbound HTTP calls in logs and traces?

A strong answer should explain that `IHttpClientFactory` is not only about avoiding socket exhaustion. It is also about central configuration, logical clients, handler reuse, outgoing middleware, logging, testability, resilience, and consistent outbound HTTP design.

## Core Concepts

### The Problem with Outbound HTTP

Outbound HTTP looks simple:

```csharp
using var client = new HttpClient();

var response = await client.GetAsync("https://api.example.com/products");
response.EnsureSuccessStatusCode();

var json = await response.Content.ReadAsStringAsync();
```

This code may work in a demo, but it is not a good production pattern when called frequently.

Problems can include:

- Too many socket connections.
- TCP ports stuck in `TIME_WAIT`.
- DNS changes not respected.
- No central timeout policy.
- No logging or tracing strategy.
- No retry policy.
- No rate limiting.
- No authentication handler.
- No consistent error handling.
- Hard-to-test code.
- Configuration duplicated across services.

Production HTTP calls need a deliberate design.

### `HttpClient` and `HttpMessageHandler`

`HttpClient` is the high-level object used by application code to send HTTP requests.

`HttpMessageHandler` is the lower-level pipeline component that actually sends the request. The default primary handler in modern .NET is usually based on `SocketsHttpHandler`.

Important relationship:

```text
HttpClient
  -> DelegatingHandler
    -> DelegatingHandler
      -> Primary HttpMessageHandler / SocketsHttpHandler
        -> connection pool
        -> network
```

The handler owns the underlying connection pool. Reusing handlers is important because creating too many handlers can create too many connection pools and exhaust sockets.

`IHttpClientFactory` creates new `HttpClient` objects but reuses underlying handlers for a configured lifetime.

### What `IHttpClientFactory` Does

`IHttpClientFactory` is a factory abstraction for creating configured `HttpClient` instances.

Register it:

```csharp
builder.Services.AddHttpClient();
```

Use it:

```csharp
public sealed class ProductApiService
{
    private readonly IHttpClientFactory _httpClientFactory;

    public ProductApiService(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<string> GetProductsAsync(CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient();

        return await client.GetStringAsync(
            "https://api.example.com/products",
            cancellationToken);
    }
}
```

Benefits:

- Provides `HttpClient` through dependency injection.
- Centralizes outbound HTTP configuration.
- Supports named clients.
- Supports typed clients.
- Supports generated clients such as Refit clients.
- Manages `HttpMessageHandler` lifetime.
- Reuses handlers to avoid socket exhaustion.
- Recycles handlers so DNS changes can be picked up.
- Adds logging for outgoing requests.
- Supports delegating handlers as outgoing middleware.
- Works with resilience handlers.
- Makes outbound HTTP easier to test.

### Socket Exhaustion

A common anti-pattern is creating a new `HttpClient` per request.

Bad:

```csharp
public async Task<string> GetAsync()
{
    using var client = new HttpClient();

    return await client.GetStringAsync("https://api.example.com/data");
}
```

`HttpClient` itself is disposable, but the important part is the underlying handler and connection pool. Creating too many clients and handlers can create too many connections. TCP ports may remain unavailable for a period after closing, which can lead to port exhaustion under load.

Better options:

1. Use short-lived `HttpClient` instances created by `IHttpClientFactory`.
2. Use a long-lived/static `HttpClient` with `SocketsHttpHandler.PooledConnectionLifetime`.

With `IHttpClientFactory`:

```csharp
builder.Services.AddHttpClient("ExternalApi", client =>
{
    client.BaseAddress = new Uri("https://api.example.com/");
});
```

```csharp
var client = _httpClientFactory.CreateClient("ExternalApi");
```

This creates a new `HttpClient` but reuses the underlying handler while it is valid.

### DNS Changes

A different problem happens when a `HttpClient` or its underlying handler lives too long. The client may keep using existing connections and may not react quickly to DNS changes.

This matters in cloud systems where DNS can change because of:

- Load balancers.
- Blue-green deployments.
- Kubernetes services.
- Azure App Service changes.
- Regional failover.
- Service discovery.
- Container restarts.
- API gateway changes.

`IHttpClientFactory` helps by recycling handlers after a configured handler lifetime.

Default handler lifetime is commonly two minutes.

Example:

```csharp
builder.Services.AddHttpClient("ExternalApi", client =>
{
    client.BaseAddress = new Uri("https://api.example.com/");
})
.SetHandlerLifetime(TimeSpan.FromMinutes(5));
```

When the handler lifetime expires and no clients are using it, the factory can dispose it and create a new handler. New handlers create new connections and can resolve DNS again.

### Short-Lived Factory Clients vs Long-Lived Static Clients

There are two valid lifetime strategies in modern .NET.

Strategy 1: short-lived clients from `IHttpClientFactory`.

```csharp
var client = _httpClientFactory.CreateClient("ExternalApi");
```

Use this when:

- You use dependency injection.
- You want named or typed clients.
- You want outgoing middleware.
- You want centralized logging and configuration.
- You want easy resilience registration.
- You want multiple logical external clients.

Strategy 2: long-lived `HttpClient` with `SocketsHttpHandler.PooledConnectionLifetime`.

```csharp
private static readonly HttpClient Client = new(
    new SocketsHttpHandler
    {
        PooledConnectionLifetime = TimeSpan.FromMinutes(5)
    })
{
    BaseAddress = new Uri("https://api.example.com/")
};
```

Use this when:

- You do not use dependency injection.
- You want a simple static client.
- You understand connection lifetime configuration.
- You do not need named/typed client configuration.
- You do not need factory-based outgoing middleware.

Avoid the worst option: creating a new unmanaged `HttpClient` and handler for every operation.

### Handler Lifetime

`IHttpClientFactory` caches handlers. Handler lifetime controls how long a handler can be reused.

Example:

```csharp
builder.Services.AddHttpClient("Payments", client =>
{
    client.BaseAddress = new Uri("https://payments.example.com/");
})
.SetHandlerLifetime(TimeSpan.FromMinutes(5));
```

Important points:

- `CreateClient` returns a new `HttpClient`.
- The handler may be reused.
- The handler owns the connection pool.
- Handler reuse helps avoid socket exhaustion.
- Handler recycling helps pick up DNS changes.
- Disposing a factory-created `HttpClient` does not immediately dispose the handler.
- Long-lived typed clients can defeat handler recycling benefits.

Choose handler lifetime based on expected DNS and network change frequency. Do not set it randomly without understanding the environment.

### `SocketsHttpHandler` and `PooledConnectionLifetime`

`SocketsHttpHandler.PooledConnectionLifetime` limits how long a connection can stay in the pool. When the lifetime expires, the connection is replaced after it completes active work.

Example with `IHttpClientFactory`:

```csharp
builder.Services.AddHttpClient("Inventory", client =>
{
    client.BaseAddress = new Uri("https://inventory.example.com/");
})
.UseSocketsHttpHandler((handler, _) =>
{
    handler.PooledConnectionLifetime = TimeSpan.FromMinutes(5);
})
.SetHandlerLifetime(Timeout.InfiniteTimeSpan);
```

This pattern uses `SocketsHttpHandler` to handle connection recycling. Since connection lifetime is handled at the socket handler level, factory handler recycling can be disabled.

This is useful when you want precise connection lifetime control while still using `IHttpClientFactory` for DI, named clients, logging, and handlers.

### Basic Client Registration

Basic registration:

```csharp
builder.Services.AddHttpClient();
```

Basic usage:

```csharp
public sealed class WeatherGateway
{
    private readonly IHttpClientFactory _httpClientFactory;

    public WeatherGateway(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<string> GetForecastAsync(CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient();

        using var response = await client.GetAsync(
            "https://weather.example.com/forecast",
            cancellationToken);

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadAsStringAsync(cancellationToken);
    }
}
```

This is useful for simple or legacy code, but named or typed clients are usually better for real applications because they centralize configuration per external service.

### Named Clients

A named client is configured with a string name.

Registration:

```csharp
builder.Services.AddHttpClient("CatalogApi", client =>
{
    client.BaseAddress = new Uri("https://catalog.example.com/");
    client.DefaultRequestHeaders.UserAgent.ParseAdd("my-app/1.0");
    client.Timeout = TimeSpan.FromSeconds(20);
});
```

Usage:

```csharp
public sealed class CatalogGateway
{
    private readonly IHttpClientFactory _httpClientFactory;

    public CatalogGateway(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<ProductDto?> GetProductAsync(
        int productId,
        CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("CatalogApi");

        return await client.GetFromJsonAsync<ProductDto>(
            $"api/products/{productId}",
            cancellationToken);
    }
}
```

Named clients are useful when:

- The app calls multiple external APIs.
- Each API has different base address, timeout, headers, and handlers.
- A singleton service needs to create clients when needed.
- You want to avoid capturing a typed client in a singleton.
- You want configuration keyed by logical external dependency.

Avoid deriving client names from unbounded user input. Each distinct name may create separate handler state and can lead to resource problems.

### Typed Clients

A typed client wraps `HttpClient` in a strongly typed class.

Registration:

```csharp
builder.Services.AddHttpClient<CatalogClient>(client =>
{
    client.BaseAddress = new Uri("https://catalog.example.com/");
    client.Timeout = TimeSpan.FromSeconds(20);
});
```

Typed client:

```csharp
public sealed class CatalogClient
{
    private readonly HttpClient _httpClient;

    public CatalogClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<ProductDto?> GetProductAsync(
        int productId,
        CancellationToken cancellationToken)
    {
        return await _httpClient.GetFromJsonAsync<ProductDto>(
            $"api/products/{productId}",
            cancellationToken);
    }
}
```

Usage:

```csharp
public sealed class ProductService
{
    private readonly CatalogClient _catalogClient;

    public ProductService(CatalogClient catalogClient)
    {
        _catalogClient = catalogClient;
    }

    public Task<ProductDto?> GetProductAsync(
        int productId,
        CancellationToken cancellationToken)
    {
        return _catalogClient.GetProductAsync(productId, cancellationToken);
    }
}
```

Benefits:

- Strong typing.
- Encapsulates API-specific logic.
- Avoids string client names in consuming code.
- Provides IntelliSense.
- Keeps external API calls in one place.
- Easier to mock through an interface if needed.

### Typed Client Interface

A typed client can implement an interface.

```csharp
public interface ICatalogClient
{
    Task<ProductDto?> GetProductAsync(
        int productId,
        CancellationToken cancellationToken);
}
```

```csharp
public sealed class CatalogClient : ICatalogClient
{
    private readonly HttpClient _httpClient;

    public CatalogClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<ProductDto?> GetProductAsync(
        int productId,
        CancellationToken cancellationToken)
    {
        return await _httpClient.GetFromJsonAsync<ProductDto>(
            $"api/products/{productId}",
            cancellationToken);
    }
}
```

Registration:

```csharp
builder.Services.AddHttpClient<ICatalogClient, CatalogClient>(client =>
{
    client.BaseAddress = new Uri("https://catalog.example.com/");
});
```

This improves testability because application services can depend on `ICatalogClient` rather than `HttpClient`.

### Avoid Capturing Typed Clients in Singletons

Typed clients are usually registered as transient. They should be treated as short-lived.

Problem:

```csharp
builder.Services.AddHttpClient<CatalogClient>();
builder.Services.AddSingleton<ProductCache>();
```

```csharp
public sealed class ProductCache
{
    private readonly CatalogClient _catalogClient;

    public ProductCache(CatalogClient catalogClient)
    {
        _catalogClient = catalogClient;
    }
}
```

If a singleton captures a typed client, the typed client and its `HttpClient` may live too long. This can prevent the application from getting handler updates and reacting to DNS changes.

Better for singleton services:

```csharp
public sealed class ProductCache
{
    private readonly IHttpClientFactory _httpClientFactory;

    public ProductCache(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task RefreshAsync(CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("CatalogApi");

        var products = await client.GetFromJsonAsync<List<ProductDto>>(
            "api/products",
            cancellationToken);
    }
}
```

Use named clients from singletons, or configure a long-lived client with `PooledConnectionLifetime` deliberately.

### Generated Clients

Generated clients are libraries that generate HTTP client implementations from interfaces or contracts. One common example is Refit.

Example interface:

```csharp
public interface ICatalogApi
{
    [Get("/api/products/{id}")]
    Task<ProductDto> GetProductAsync(int id);
}
```

Registration concept:

```csharp
builder.Services.AddRefitClient<ICatalogApi>()
    .ConfigureHttpClient(client =>
    {
        client.BaseAddress = new Uri("https://catalog.example.com/");
    });
```

Generated clients are useful when:

- You want declarative REST API definitions.
- You want less manual serialization code.
- You want strongly typed endpoints.
- You want to combine generated clients with `IHttpClientFactory`.

Generated clients still need the same production concerns:

- Timeouts.
- Resilience.
- Authentication.
- Observability.
- Error handling.
- Testability.
- Safe retries.

### Delegating Handlers

A delegating handler is outgoing middleware for `HttpClient`.

It can run logic before and after the HTTP request.

Example:

```csharp
public sealed class CorrelationIdHandler : DelegatingHandler
{
    private readonly ICorrelationIdAccessor _correlationIdAccessor;

    public CorrelationIdHandler(ICorrelationIdAccessor correlationIdAccessor)
    {
        _correlationIdAccessor = correlationIdAccessor;
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var correlationId = _correlationIdAccessor.CorrelationId;

        if (!string.IsNullOrWhiteSpace(correlationId))
        {
            request.Headers.TryAddWithoutValidation(
                "X-Correlation-Id",
                correlationId);
        }

        return base.SendAsync(request, cancellationToken);
    }
}
```

Registration:

```csharp
builder.Services.AddTransient<CorrelationIdHandler>();

builder.Services.AddHttpClient("CatalogApi", client =>
{
    client.BaseAddress = new Uri("https://catalog.example.com/");
})
.AddHttpMessageHandler<CorrelationIdHandler>();
```

Delegating handlers are useful for:

- Correlation IDs.
- Authentication tokens.
- Custom headers.
- Logging enrichment.
- Request signing.
- Tenant headers.
- Idempotency keys.
- User-agent headers.
- Custom metrics.
- Request/response transformations.

Avoid putting large business workflows in handlers. Handlers should be small, cross-cutting, and focused.

### Handler Scope Caveat

`IHttpClientFactory` creates a separate dependency injection scope for message handlers. This scope is not the same as an ASP.NET Core request scope.

This matters because a handler can live longer than a single incoming request.

Avoid storing request-specific sensitive data inside a long-lived handler.

Risky:

```csharp
public sealed class BadTokenHandler : DelegatingHandler
{
    private string? _cachedToken;

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        request.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", _cachedToken);

        return base.SendAsync(request, cancellationToken);
    }
}
```

Better:

```csharp
public sealed class AccessTokenHandler : DelegatingHandler
{
    private readonly IAccessTokenProvider _accessTokenProvider;

    public AccessTokenHandler(IAccessTokenProvider accessTokenProvider)
    {
        _accessTokenProvider = accessTokenProvider;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var token = await _accessTokenProvider
            .GetAccessTokenAsync(cancellationToken);

        request.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        return await base.SendAsync(request, cancellationToken);
    }
}
```

Keep handlers stateless when possible.

### Cookies and `IHttpClientFactory`

`IHttpClientFactory` pools handlers. If handlers use cookies, the underlying `CookieContainer` can be shared between clients using the same handler. When a handler expires, cookies stored in that handler can be lost.

This can cause problems:

- Cookies leak between unrelated logical calls.
- User-specific cookies are reused accidentally.
- Cookies disappear when the handler is recycled.
- Stateful cookie-based flows behave unpredictably.

Avoid using `IHttpClientFactory` for scenarios requiring isolated cookie containers unless you understand and control the handler configuration.

For user-specific cookie sessions, consider:

- A manually managed `HttpClientHandler` per session.
- A browser automation tool for real browser flows.
- Token-based authentication instead of cookies for service-to-service calls.
- Explicitly disabling cookies when not needed.

Example disabling automatic cookies:

```csharp
builder.Services.AddHttpClient("NoCookies")
    .ConfigurePrimaryHttpMessageHandler(() =>
    {
        return new HttpClientHandler
        {
            UseCookies = false
        };
    });
```

### Configuring Primary Handler

The primary handler controls low-level HTTP behavior.

Example:

```csharp
builder.Services.AddHttpClient("InternalApi", client =>
{
    client.BaseAddress = new Uri("https://internal.example.com/");
})
.ConfigurePrimaryHttpMessageHandler(() =>
{
    return new SocketsHttpHandler
    {
        PooledConnectionLifetime = TimeSpan.FromMinutes(5),
        MaxConnectionsPerServer = 50,
        AutomaticDecompression =
            DecompressionMethods.GZip | DecompressionMethods.Deflate
    };
});
```

Common handler settings:

- Proxy.
- Credentials.
- Client certificates.
- Automatic decompression.
- Redirect behavior.
- Cookie behavior.
- Max connections per server.
- Connection lifetime.
- SSL/TLS options.

Do not configure these globally without considering each external dependency.

### Timeouts

Timeouts are essential for resilient outbound HTTP. Without timeouts, requests can hang long enough to exhaust threads, connections, or request capacity.

There are multiple timeout layers:

| Timeout | Purpose |
|---|---|
| `HttpClient.Timeout` | Overall timeout on the client request |
| Resilience total timeout | Total limit including retries |
| Resilience attempt timeout | Timeout for each individual try |
| Cancellation token | Caller-controlled cancellation |
| Server timeout | Downstream service limit |
| Reverse proxy/gateway timeout | Infrastructure limit |

Example:

```csharp
builder.Services.AddHttpClient("CatalogApi", client =>
{
    client.BaseAddress = new Uri("https://catalog.example.com/");
    client.Timeout = TimeSpan.FromSeconds(30);
});
```

With resilience handlers, prefer clear total and attempt timeout design rather than random overlapping timeouts.

Example:

```csharp
builder.Services.AddHttpClient<CatalogClient>(client =>
{
    client.BaseAddress = new Uri("https://catalog.example.com/");
})
.AddStandardResilienceHandler(options =>
{
    options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(20);
    options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(5);
});
```

Timeouts should be based on user experience, downstream SLA, retry budget, and system capacity.

### Cancellation Tokens

Always pass cancellation tokens to outbound HTTP operations.

Example:

```csharp
public async Task<ProductDto?> GetProductAsync(
    int productId,
    CancellationToken cancellationToken)
{
    return await _httpClient.GetFromJsonAsync<ProductDto>(
        $"api/products/{productId}",
        cancellationToken);
}
```

In ASP.NET Core, the request cancellation token is usually available as a method parameter:

```csharp
app.MapGet("/api/products/{id:int}", async (
    int id,
    CatalogClient catalogClient,
    CancellationToken cancellationToken) =>
{
    var product = await catalogClient.GetProductAsync(id, cancellationToken);

    return product is null ? Results.NotFound() : Results.Ok(product);
});
```

Benefits:

- Stops unnecessary work when the client disconnects.
- Frees resources faster.
- Helps downstream cancellation.
- Prevents long-running abandoned requests.
- Works with timeouts and resilience policies.

Cancellation is not a replacement for timeouts. Use both.

### Resilient Outbound HTTP

Resilience is the ability to handle temporary failures and degraded dependencies without immediately failing the whole system or making the failure worse.

Common resilience strategies:

| Strategy | Purpose |
|---|---|
| Timeout | Stop waiting too long |
| Retry | Try again after transient failure |
| Exponential backoff | Increase delay between retries |
| Jitter | Add randomness to avoid synchronized retries |
| Circuit breaker | Stop calling a dependency that is failing repeatedly |
| Rate limiter | Limit concurrent or total outbound calls |
| Bulkhead | Isolate resources for dependencies |
| Hedging | Send parallel attempts for slow calls |
| Fallback | Return a degraded but acceptable result |
| Idempotency key | Make retried writes safe |
| Observability | Understand dependency behavior |

Resilience is not just adding retries. It is controlling failure behavior.

### `Microsoft.Extensions.Http.Resilience`

Modern .NET provides `Microsoft.Extensions.Http.Resilience` for resilient HTTP pipelines.

Install:

```bash
dotnet add package Microsoft.Extensions.Http.Resilience
```

Registration:

```csharp
builder.Services.AddHttpClient<CatalogClient>(client =>
{
    client.BaseAddress = new Uri("https://catalog.example.com/");
})
.AddStandardResilienceHandler();
```

The standard resilience handler combines several strategies with sensible defaults:

- Rate limiter.
- Total request timeout.
- Retry.
- Circuit breaker.
- Attempt timeout.

This gives a good starting point for many outbound HTTP clients.

However, do not blindly apply default resilience to every dependency. Review idempotency, downstream capacity, expected latency, and business behavior.

### Standard Resilience Handler

Example:

```csharp
builder.Services.AddHttpClient<InventoryClient>(client =>
{
    client.BaseAddress = new Uri("https://inventory.example.com/");
})
.AddStandardResilienceHandler();
```

This can handle transient errors such as:

- HTTP 5xx responses.
- HTTP 408 Request Timeout.
- HTTP 429 Too Many Requests.
- `HttpRequestException`.
- Timeout-related exceptions.

The default pipeline includes retry and circuit breaker behavior. This is useful, but it must be matched with the operation semantics.

For example, retrying a GET request is often safe. Retrying a POST that creates a payment may be dangerous unless the downstream API supports idempotency keys.

### Customizing Resilience

Example: disable retries for unsafe HTTP methods.

```csharp
builder.Services.AddHttpClient<PaymentsClient>(client =>
{
    client.BaseAddress = new Uri("https://payments.example.com/");
})
.AddStandardResilienceHandler(options =>
{
    options.Retry.DisableForUnsafeHttpMethods();

    options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(30);
    options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(10);
});
```

This prevents automatic retries for methods such as `POST`, `PUT`, `PATCH`, and `DELETE`.

Example: disable retries only for selected methods.

```csharp
builder.Services.AddHttpClient<OrdersClient>(client =>
{
    client.BaseAddress = new Uri("https://orders.example.com/");
})
.AddStandardResilienceHandler(options =>
{
    options.Retry.DisableFor(HttpMethod.Post, HttpMethod.Delete);
});
```

Always think about whether the operation is safe to retry.

### Retry Strategy

Retries are useful for transient failures.

Good retry candidates:

- Temporary network failures.
- HTTP 408.
- HTTP 429 when allowed by service contract.
- HTTP 500, 502, 503, 504.
- Connection reset.
- Temporary DNS/network issue.
- Short downstream restart.

Poor retry candidates:

- HTTP 400 Bad Request.
- HTTP 401 Unauthorized.
- HTTP 403 Forbidden.
- HTTP 404 Not Found in most cases.
- Validation errors.
- Business rule failures.
- Non-idempotent writes without idempotency protection.
- Large uploads.
- Long-running operations.
- Payment creation without idempotency key.

Bad retry behavior:

```text
Retry every failure immediately three times.
```

Better retry behavior:

```text
Retry transient failures with exponential backoff, jitter, limits, and safe method rules.
```

Retries increase downstream traffic. During an outage, aggressive retries can amplify failure.

### Idempotency and Safe Retries

Idempotency means repeating the same operation produces the same effect.

Generally safe to retry:

- `GET`
- `HEAD`
- `OPTIONS`
- Some `PUT` operations if designed idempotently.
- Some `DELETE` operations if designed idempotently.

Potentially unsafe:

- `POST`
- Some `PATCH`
- Payment capture.
- Order creation.
- Sending email.
- Creating shipment.
- Creating a ticket.
- Triggering a workflow.

If retrying a write operation, use idempotency keys when supported.

Example:

```csharp
public async Task<PaymentResponse> CreatePaymentAsync(
    CreatePaymentRequest request,
    CancellationToken cancellationToken)
{
    using var httpRequest = new HttpRequestMessage(
        HttpMethod.Post,
        "api/payments");

    httpRequest.Headers.Add(
        "Idempotency-Key",
        request.IdempotencyKey);

    httpRequest.Content = JsonContent.Create(request);

    using var response = await _httpClient.SendAsync(
        httpRequest,
        cancellationToken);

    response.EnsureSuccessStatusCode();

    return (await response.Content.ReadFromJsonAsync<PaymentResponse>(
        cancellationToken))!;
}
```

The server must also support idempotency. Adding a header alone does not make the operation safe.

### Circuit Breaker

A circuit breaker stops calling a dependency when too many failures occur.

Purpose:

- Prevent hammering a failing service.
- Reduce cascading failures.
- Give the dependency time to recover.
- Fail fast instead of waiting for repeated timeouts.
- Protect the current application from resource exhaustion.

Conceptual states:

| State | Meaning |
|---|---|
| Closed | Calls are allowed |
| Open | Calls are blocked temporarily |
| Half-open | A limited number of test calls are allowed |

Circuit breakers are useful when:

- A dependency is down.
- Calls are timing out repeatedly.
- A service is overloaded.
- Failure rate is high.
- Retrying would make the situation worse.

Circuit breakers should be observable. Teams should know when a circuit opens and which dependency is affected.

### Timeout Strategy

Timeouts should be explicit and layered carefully.

Example decision:

```text
User request budget: 2 seconds
Outbound dependency target: 500 ms
Attempt timeout: 300 ms
Max retries: 2
Total timeout: 1 second
Fallback if dependency unavailable
```

Bad:

```text
HttpClient.Timeout = 100 seconds
Retry 5 times
No total timeout
API request times out after 30 seconds
```

This can cause the server to keep doing useless work long after the client gave up.

Good timeout design considers:

- User experience.
- API gateway timeout.
- ASP.NET Core request timeout.
- Downstream SLA.
- Retry count.
- Attempt timeout.
- Total timeout.
- Cancellation tokens.
- Queue and thread capacity.

### Rate Limiting and Bulkheads

Rate limiting controls how many requests are sent to a dependency.

Bulkhead isolation separates resources so one failing dependency does not consume all capacity.

Example reason:

```text
The app calls Payment API and Recommendation API.
Recommendation API becomes slow.
Without isolation, all outbound connection capacity is consumed by Recommendation calls.
Payment calls also fail.
```

A rate limiter can limit Recommendation API concurrency so critical Payment API calls still have capacity.

Standard resilience handlers include rate limiting behavior.

For more advanced scenarios, design per-dependency limits based on:

- Dependency SLA.
- Business criticality.
- Downstream rate limits.
- Thread and connection capacity.
- Queue behavior.
- Fallback strategy.

### Hedging

Hedging sends an additional request attempt when the original request is slow, often to another endpoint or replica.

Example use cases:

- Read-heavy services.
- Multiple equivalent replicas.
- Regional replicas.
- Search queries.
- Low-latency critical reads.

Hedging can reduce tail latency, but it can also increase traffic.

Avoid hedging for:

- Non-idempotent writes.
- Payment calls.
- Operations with side effects.
- Downstream services already under pressure.
- APIs that cannot handle extra load.

Example registration:

```csharp
builder.Services.AddHttpClient<SearchClient>(client =>
{
    client.BaseAddress = new Uri("https://search.example.com/");
})
.AddStandardHedgingHandler();
```

Use hedging carefully and measure its impact.

### Fallbacks

A fallback returns an alternative result when the dependency is unavailable.

Examples:

- Return cached product details.
- Return empty recommendations.
- Return a degraded response.
- Queue work for later.
- Show "temporarily unavailable."
- Use a secondary provider.

Fallbacks should be explicit and honest.

Bad fallback:

```csharp
catch
{
    return new PaymentResult { Success = true };
}
```

This hides a critical failure.

Good fallback:

```csharp
catch (ExternalCatalogUnavailableException)
{
    return ProductDetails.Unavailable(productId);
}
```

Fallbacks are business decisions, not just technical decisions.

### Error Handling

Do not blindly call `EnsureSuccessStatusCode()` everywhere if different status codes need different business handling.

Simple case:

```csharp
using var response = await _httpClient.GetAsync(
    $"api/products/{productId}",
    cancellationToken);

if (response.StatusCode == HttpStatusCode.NotFound)
{
    return null;
}

response.EnsureSuccessStatusCode();

return await response.Content.ReadFromJsonAsync<ProductDto>(
    cancellationToken);
```

More structured handling:

```csharp
using var response = await _httpClient.SendAsync(
    request,
    cancellationToken);

if (response.IsSuccessStatusCode)
{
    return await response.Content.ReadFromJsonAsync<OrderStatusDto>(
        cancellationToken);
}

var body = await response.Content.ReadAsStringAsync(cancellationToken);

throw new ExternalApiException(
    serviceName: "OrdersApi",
    statusCode: response.StatusCode,
    responseBody: body);
```

Be careful with response body logging. It may contain sensitive data.

### Observability

Outbound HTTP should be observable.

Useful telemetry:

- Dependency name.
- URL host.
- HTTP method.
- Route/template when available.
- Status code.
- Duration.
- Timeout vs cancellation vs network failure.
- Retry count.
- Circuit breaker state.
- Rate limiter rejection.
- Correlation ID.
- Trace ID.
- Request ID.
- Error category.
- Sanitized response details.

`IHttpClientFactory` integrates with logging. Additional observability can come from OpenTelemetry, Application Insights, structured logs, and custom handlers.

Example logging in a typed client:

```csharp
public sealed class CatalogClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<CatalogClient> _logger;

    public CatalogClient(
        HttpClient httpClient,
        ILogger<CatalogClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<ProductDto?> GetProductAsync(
        int productId,
        CancellationToken cancellationToken)
    {
        using var response = await _httpClient.GetAsync(
            $"api/products/{productId}",
            cancellationToken);

        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            _logger.LogInformation(
                "Product {ProductId} was not found in Catalog API.",
                productId);

            return null;
        }

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<ProductDto>(
            cancellationToken);
    }
}
```

Do not log secrets, authorization headers, cookies, or full payloads without careful redaction.

### Redacting Sensitive Headers

HTTP logs can accidentally include sensitive data.

Sensitive headers include:

- `Authorization`
- `Cookie`
- `Set-Cookie`
- API keys
- custom token headers
- session headers

Use redaction when configuring clients.

Example:

```csharp
builder.Services.AddHttpClient("ExternalApi", client =>
{
    client.BaseAddress = new Uri("https://api.example.com/");
})
.RedactLoggedHeaders("Authorization", "Cookie", "X-Api-Key");
```

Even with redaction, be careful with request and response body logging.

### Configuration with Options Pattern

External API settings should usually come from configuration.

Configuration:

```json
{
  "ExternalApis": {
    "Catalog": {
      "BaseAddress": "https://catalog.example.com/",
      "TimeoutSeconds": 20
    }
  }
}
```

Options class:

```csharp
public sealed class CatalogApiOptions
{
    public string BaseAddress { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 20;
}
```

Registration:

```csharp
builder.Services.Configure<CatalogApiOptions>(
    builder.Configuration.GetSection("ExternalApis:Catalog"));

builder.Services.AddHttpClient<CatalogClient>((serviceProvider, client) =>
{
    var options = serviceProvider
        .GetRequiredService<IOptions<CatalogApiOptions>>()
        .Value;

    client.BaseAddress = new Uri(options.BaseAddress);
    client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
});
```

Benefits:

- Environment-specific configuration.
- No hard-coded URLs.
- Easier local/staging/production setup.
- Easier testing.
- Central validation possible.

Add options validation for production systems.

### Authentication and Authorization Headers

Service-to-service HTTP often requires authentication.

Example API key handler:

```csharp
public sealed class ApiKeyHandler : DelegatingHandler
{
    private readonly IOptions<ExternalApiOptions> _options;

    public ApiKeyHandler(IOptions<ExternalApiOptions> options)
    {
        _options = options;
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        request.Headers.Add("X-Api-Key", _options.Value.ApiKey);

        return base.SendAsync(request, cancellationToken);
    }
}
```

Registration:

```csharp
builder.Services.AddTransient<ApiKeyHandler>();

builder.Services.AddHttpClient("ExternalApi", client =>
{
    client.BaseAddress = new Uri("https://api.example.com/");
})
.AddHttpMessageHandler<ApiKeyHandler>();
```

For OAuth/JWT tokens, use a token provider and cache tokens safely. Avoid requesting a new token for every outbound request if token reuse is allowed.

### Request and Response Disposal

Dispose `HttpResponseMessage` when using `SendAsync`, `GetAsync`, `PostAsync`, and similar methods that return a response.

Example:

```csharp
using var response = await _httpClient.SendAsync(
    request,
    cancellationToken);

response.EnsureSuccessStatusCode();
```

When using convenience methods such as `GetFromJsonAsync`, disposal is handled internally.

Disposing the response helps release resources associated with the response content stream.

For large responses, consider streaming.

```csharp
using var response = await _httpClient.GetAsync(
    "api/export",
    HttpCompletionOption.ResponseHeadersRead,
    cancellationToken);

response.EnsureSuccessStatusCode();

await using var stream = await response.Content
    .ReadAsStreamAsync(cancellationToken);
```

`ResponseHeadersRead` avoids buffering the whole response before returning.

### Testing Outbound HTTP

Do not call real external services in normal unit tests.

Better options:

- Mock the typed client interface.
- Fake `HttpMessageHandler`.
- Use a local test server.
- Use `WireMock.Net` or similar fake server.
- Use `WebApplicationFactory` for in-process test APIs.
- Use contract tests for provider/consumer contracts.
- Use integration tests for real external service only when appropriate.

If application code depends on an interface:

```csharp
public interface ICatalogClient
{
    Task<ProductDto?> GetProductAsync(
        int productId,
        CancellationToken cancellationToken);
}
```

Unit test can mock it:

```csharp
var catalogClient = new Mock<ICatalogClient>();

catalogClient
    .Setup(client => client.GetProductAsync(1, It.IsAny<CancellationToken>()))
    .ReturnsAsync(new ProductDto(1, "Keyboard"));

var service = new ProductService(catalogClient.Object);
```

This tests application logic without HTTP.

### Testing `HttpClient` with a Fake Handler

For typed client tests, fake the `HttpMessageHandler`.

```csharp
public sealed class FakeHttpMessageHandler : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;

    public FakeHttpMessageHandler(
        Func<HttpRequestMessage, HttpResponseMessage> handler)
    {
        _handler = handler;
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(_handler(request));
    }
}
```

Test:

```csharp
[Fact]
public async Task GetProductAsync_WhenApiReturnsProduct_ReturnsProduct()
{
    var handler = new FakeHttpMessageHandler(request =>
    {
        Assert.Equal(HttpMethod.Get, request.Method);
        Assert.Equal("/api/products/1", request.RequestUri?.AbsolutePath);

        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent.Create(new ProductDto(1, "Keyboard"))
        };
    });

    var httpClient = new HttpClient(handler)
    {
        BaseAddress = new Uri("https://catalog.example.com")
    };

    var client = new CatalogClient(httpClient);

    var product = await client.GetProductAsync(1, CancellationToken.None);

    Assert.NotNull(product);
    Assert.Equal("Keyboard", product.Name);
}
```

This avoids real network calls and tests request construction and response handling.

### Testing Resilience Behavior

Resilience tests can be tricky because retries and timeouts involve time and multiple attempts.

Example fake handler that fails twice then succeeds:

```csharp
public sealed class SequenceHandler : HttpMessageHandler
{
    private int _attempt;

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        _attempt++;

        if (_attempt <= 2)
        {
            return Task.FromResult(
                new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        }

        return Task.FromResult(
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(new { Message = "OK" })
            });
    }
}
```

For full resilience pipeline tests, consider using a test server or fake HTTP server and keep timeouts short. Avoid slow tests that wait for real long timeouts.

Test most business logic separately. Test only a small number of resilience scenarios.

### `IHttpClientFactory` in Integration Tests

When testing ASP.NET Core apps with `WebApplicationFactory`, replace outbound HTTP clients with fakes.

Example:

```csharp
factory.WithWebHostBuilder(builder =>
{
    builder.ConfigureTestServices(services =>
    {
        services.AddHttpClient("CatalogApi")
            .ConfigurePrimaryHttpMessageHandler(() =>
            {
                return new FakeHttpMessageHandler(request =>
                {
                    return new HttpResponseMessage(HttpStatusCode.OK)
                    {
                        Content = JsonContent.Create(
                            new ProductDto(1, "Test Product"))
                    };
                });
            });
    });
});
```

This lets the API under test use its real code path while the external dependency is controlled.

### Common Mistakes

Common mistakes include:

- Creating a new manual `HttpClient` per request.
- Keeping a static `HttpClient` forever without `PooledConnectionLifetime`.
- Capturing a typed client inside a singleton service.
- Retrying non-idempotent operations blindly.
- Retrying all HTTP status codes.
- Using very long default timeouts.
- Not passing cancellation tokens.
- Not disposing `HttpResponseMessage`.
- Logging authorization headers or cookies.
- Storing request-specific state inside a long-lived handler.
- Using `IHttpClientFactory` with cookies without understanding handler pooling.
- Creating unbounded named clients.
- Adding multiple resilience handlers accidentally.
- Stacking retries at multiple layers.
- Retrying inside both gateway, service, and client without a retry budget.
- Swallowing all HTTP errors and returning fake success.
- Using `EnsureSuccessStatusCode` when business-specific handling is needed.
- Not testing error responses.
- Calling real external services in unit tests.
- Using `Task.Result` or `.Wait()` on async HTTP calls.
- Forgetting to set `BaseAddress` for typed clients.
- Hard-coding external URLs in client classes.
- Ignoring 429 rate limit responses.
- Not observing downstream latency and failure rates.

### Best Practices

Use `IHttpClientFactory` for DI-based applications that call external HTTP services.

Prefer named or typed clients over scattered raw `HttpClient` usage.

Use typed clients to encapsulate each external API.

Use named clients when a singleton service needs to create clients repeatedly.

Configure base address, timeout, headers, and handlers centrally.

Use `SocketsHttpHandler.PooledConnectionLifetime` when using long-lived clients or when you need explicit DNS refresh behavior.

Set sensible timeouts.

Pass cancellation tokens.

Use resilience policies for transient failures.

Disable or carefully design retries for unsafe HTTP methods.

Use idempotency keys for retried write operations when supported.

Use circuit breakers and rate limiting for unstable dependencies.

Use hedging only for safe read scenarios where extra traffic is acceptable.

Keep delegating handlers stateless and focused.

Avoid leaking scoped or user-specific data through long-lived handlers.

Avoid `IHttpClientFactory` for cookie-heavy session scenarios unless carefully configured.

Log and trace outbound HTTP calls.

Redact sensitive headers and payloads.

Test typed clients with fake handlers or fake servers.

Replace external clients in integration tests.

Treat outbound HTTP as a production boundary that needs design, observability, and failure handling.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-beginner-q01 -->
#### Beginner Q01: What is `IHttpClientFactory`?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

`IHttpClientFactory` is a .NET abstraction used to create and configure `HttpClient` instances through dependency injection. It centralizes outbound HTTP configuration, supports named and typed clients, manages the lifetime of underlying `HttpMessageHandler` instances, adds logging, and supports outgoing middleware through delegating handlers.

It helps avoid common `HttpClient` lifetime problems such as socket exhaustion and stale DNS connections when used correctly.

##### Key Points to Mention

- Creates configured `HttpClient` instances.
- Registered with `AddHttpClient`.
- Supports basic, named, typed, and generated clients.
- Reuses underlying handlers.
- Helps avoid socket exhaustion.
- Helps handle DNS changes through handler recycling.
- Integrates logging and delegating handlers.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-beginner-q01 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-beginner-q02 -->
#### Beginner Q02: Why should you avoid creating a new `HttpClient` manually for every request?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Creating and disposing a new manual `HttpClient` for every request can create too many underlying handlers and connection pools. Under high traffic, this can exhaust available sockets or ports and cause connection failures.

The safer patterns are to use short-lived clients created by `IHttpClientFactory`, which reuses handlers, or to use a long-lived `HttpClient` configured with `SocketsHttpHandler.PooledConnectionLifetime`.

##### Key Points to Mention

- `HttpClient` uses underlying handlers and connection pools.
- Too many handlers can cause socket exhaustion.
- Disposing `HttpClient` does not immediately free TCP ports.
- `IHttpClientFactory` reuses handlers.
- Long-lived clients need `PooledConnectionLifetime` for DNS changes.
- Avoid `new HttpClient()` in frequently called code.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-beginner-q02 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-beginner-q03 -->
#### Beginner Q03: What is a named `HttpClient`?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A named `HttpClient` is a client registered with a string name and a specific configuration.

Example:

```csharp
builder.Services.AddHttpClient("CatalogApi", client =>
{
    client.BaseAddress = new Uri("https://catalog.example.com/");
});
```

Usage:

```csharp
var client = httpClientFactory.CreateClient("CatalogApi");
```

Named clients are useful when an application calls multiple external services, each with its own base URL, headers, timeout, handlers, and resilience settings.

##### Key Points to Mention

- Registered with a name.
- Created with `CreateClient(name)`.
- Useful for multiple external APIs.
- Centralizes per-service configuration.
- Good for singleton services that need to create clients.
- Avoid unbounded client names.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-beginner-q03 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-beginner-q04 -->
#### Beginner Q04: What is a typed `HttpClient`?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A typed client is a class that receives a configured `HttpClient` through its constructor and exposes API-specific methods.

Example:

```csharp
public sealed class CatalogClient
{
    private readonly HttpClient _httpClient;

    public CatalogClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public Task<ProductDto?> GetProductAsync(
        int id,
        CancellationToken cancellationToken)
    {
        return _httpClient.GetFromJsonAsync<ProductDto>(
            $"api/products/{id}",
            cancellationToken);
    }
}
```

Typed clients are useful because they encapsulate external API logic in one place and give consuming code a strongly typed service.

##### Key Points to Mention

- Wraps `HttpClient` in a custom class.
- Registered with `AddHttpClient<TClient>`.
- Encapsulates external API calls.
- Avoids scattering URLs across the app.
- Easier to test through an interface.
- Should usually be short-lived.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-beginner-q04 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-beginner-q05 -->
#### Beginner Q05: What is a delegating handler?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

A delegating handler is outgoing middleware for `HttpClient`. It can inspect or modify an HTTP request before it is sent, and inspect the response after it returns.

Delegating handlers are commonly used for correlation IDs, authentication headers, request signing, logging, metrics, tenant headers, and other cross-cutting outbound HTTP behavior.

Example registration:

```csharp
builder.Services.AddTransient<CorrelationIdHandler>();

builder.Services.AddHttpClient("CatalogApi")
    .AddHttpMessageHandler<CorrelationIdHandler>();
```

##### Key Points to Mention

- Outgoing middleware for `HttpClient`.
- Derives from `DelegatingHandler`.
- Overrides `SendAsync`.
- Can modify request and response.
- Useful for headers, auth, logging, correlation.
- Should be small and focused.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-beginner-q05 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-beginner-q06 -->
#### Beginner Q06: What does resilient outbound HTTP mean?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

Resilient outbound HTTP means designing external HTTP calls to handle temporary failures safely. This includes using timeouts, retries, exponential backoff, jitter, circuit breakers, rate limits, cancellation tokens, observability, and safe error handling.

The goal is to recover from transient failures without making the downstream system worse or causing cascading failures in the current application.

##### Key Points to Mention

- Handles transient failures.
- Uses timeouts and cancellation.
- Uses safe retries with backoff and jitter.
- Uses circuit breakers for repeated failures.
- Uses rate limiting to protect dependencies.
- Requires observability.
- Must consider idempotency.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-intermediate-q01 -->
#### Intermediate Q01: How does `IHttpClientFactory` help with socket exhaustion and DNS changes?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

`IHttpClientFactory` creates new `HttpClient` instances but reuses the underlying `HttpMessageHandler` instances for a configured handler lifetime. Reusing handlers helps avoid creating too many connection pools, which reduces the risk of socket exhaustion.

The factory also recycles handlers after their lifetime expires. New handlers create new connections and can resolve DNS again, which helps the application react to DNS changes.

##### Key Points to Mention

- Factory returns new `HttpClient` instances.
- Underlying handlers are cached and reused.
- Handler reuse helps avoid socket exhaustion.
- Handler recycling helps with DNS changes.
- Default handler lifetime is commonly two minutes.
- `SetHandlerLifetime` can customize lifetime.
- Long-lived clients can use `PooledConnectionLifetime`.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-intermediate-q01 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-intermediate-q02 -->
#### Intermediate Q02: What is the difference between handler lifetime and `PooledConnectionLifetime`?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Handler lifetime is an `IHttpClientFactory` setting that controls how long a pooled `HttpMessageHandler` can be reused before the factory creates a replacement handler.

`PooledConnectionLifetime` is a `SocketsHttpHandler` setting that controls how long individual connections can remain in the connection pool before they are replaced.

Handler lifetime recycles the handler and its connection pool. `PooledConnectionLifetime` recycles connections inside the handler.

Both can help with DNS changes, but they work at different levels.

##### Key Points to Mention

- Handler lifetime belongs to `IHttpClientFactory`.
- `PooledConnectionLifetime` belongs to `SocketsHttpHandler`.
- Handler lifetime recycles handlers.
- `PooledConnectionLifetime` recycles connections.
- Both can help refresh DNS.
- They should be configured deliberately, not randomly.
- You can use `SocketsHttpHandler` with `IHttpClientFactory`.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-intermediate-q02 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-intermediate-q03 -->
#### Intermediate Q03: Why can typed clients be dangerous in singleton services?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Typed clients are usually registered as transient and are expected to be short-lived. If a singleton service captures a typed client in its constructor, that typed client and its `HttpClient` can live for the lifetime of the application.

This can defeat handler lifetime management and prevent the app from reacting to DNS changes. For singleton services, it is usually safer to inject `IHttpClientFactory` and create a named client when needed.

##### Key Points to Mention

- Typed clients are expected to be short-lived.
- Singleton services live for the app lifetime.
- Capturing a typed client can keep `HttpClient` too long.
- This can defeat DNS refresh behavior.
- Use named clients with `IHttpClientFactory` in singletons.
- Or configure a long-lived client with `PooledConnectionLifetime`.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-intermediate-q03 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-intermediate-q04 -->
#### Intermediate Q04: How do you add a standard resilience pipeline to an HTTP client?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Install `Microsoft.Extensions.Http.Resilience` and call `AddStandardResilienceHandler()` on the `IHttpClientBuilder`.

Example:

```csharp
builder.Services.AddHttpClient<CatalogClient>(client =>
{
    client.BaseAddress = new Uri("https://catalog.example.com/");
})
.AddStandardResilienceHandler();
```

The standard resilience handler combines strategies such as rate limiting, total timeout, retry, circuit breaker, and attempt timeout. It is a good starting point, but it should be reviewed for each dependency and operation type.

##### Key Points to Mention

- Use `Microsoft.Extensions.Http.Resilience`.
- Call `AddStandardResilienceHandler`.
- Adds multiple resilience strategies.
- Includes timeout, retry, circuit breaker, and rate limiting.
- Must consider idempotency.
- Defaults may need customization.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-intermediate-q04 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-intermediate-q05 -->
#### Intermediate Q05: Why are retries dangerous for `POST` requests?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

`POST` requests often create new resources or trigger side effects. If a `POST` succeeds on the server but the client times out before receiving the response, retrying the same request may create a duplicate resource or repeat the side effect.

Examples include payment creation, order submission, sending email, shipment creation, and workflow triggering.

Retries for writes should be disabled unless the operation is idempotent or the downstream service supports idempotency keys.

##### Key Points to Mention

- `POST` often has side effects.
- Retrying can duplicate writes.
- Timeouts do not prove the server failed.
- Use idempotency keys when supported.
- Disable retries for unsafe methods when needed.
- Safe retries depend on API contract.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-intermediate-q05 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-intermediate-q06 -->
#### Intermediate Q06: How should you handle HTTP status codes in a typed client?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

A typed client should handle expected status codes explicitly and treat unexpected status codes as external dependency failures.

Example:

```csharp
using var response = await _httpClient.GetAsync(
    $"api/products/{productId}",
    cancellationToken);

if (response.StatusCode == HttpStatusCode.NotFound)
{
    return null;
}

response.EnsureSuccessStatusCode();

return await response.Content.ReadFromJsonAsync<ProductDto>(
    cancellationToken);
```

Do not blindly call `EnsureSuccessStatusCode` if some non-success status codes have business meaning. Also avoid swallowing all errors and returning fake success.

##### Key Points to Mention

- Handle expected status codes explicitly.
- `404` may map to `null` for lookup calls.
- Validation or business errors may need special handling.
- Use `EnsureSuccessStatusCode` for unexpected failures.
- Include useful context in custom exceptions.
- Avoid logging sensitive response bodies.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-intermediate-q06 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-intermediate-q07 -->
#### Intermediate Q07: How do you test a typed client that uses `HttpClient`?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

You can test a typed client by creating an `HttpClient` with a fake `HttpMessageHandler`. The fake handler returns controlled responses and can assert the outgoing request.

Example:

```csharp
var handler = new FakeHttpMessageHandler(request =>
{
    Assert.Equal(HttpMethod.Get, request.Method);

    return new HttpResponseMessage(HttpStatusCode.OK)
    {
        Content = JsonContent.Create(new ProductDto(1, "Keyboard"))
    };
});

var httpClient = new HttpClient(handler)
{
    BaseAddress = new Uri("https://catalog.example.com")
};

var client = new CatalogClient(httpClient);
```

This avoids real network calls and verifies request/response behavior.

##### Key Points to Mention

- Do not call real external APIs in unit tests.
- Fake `HttpMessageHandler`.
- Create `HttpClient` with the fake handler.
- Assert request method, path, headers, and body.
- Return controlled responses.
- Alternatively mock a typed client interface for application service tests.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-intermediate-q07 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-intermediate-q08 -->
#### Intermediate Q08: Why can cookies be problematic with `IHttpClientFactory`?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

`IHttpClientFactory` pools `HttpMessageHandler` instances. If a handler uses a `CookieContainer`, cookies can be shared between logical clients using the same handler. When the handler lifetime expires and the handler is recycled, cookies stored in that handler may be lost.

This can cause cookie leakage or unpredictable cookie-based session behavior. For cookie-heavy scenarios, avoid `IHttpClientFactory` or configure cookie handling carefully.

##### Key Points to Mention

- Handlers are pooled.
- `CookieContainer` can be shared.
- Cookies can leak between unrelated calls.
- Cookies can be lost when handler expires.
- Avoid factory for cookie-heavy session scenarios.
- Disable cookies if not needed.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-advanced-q01 -->
#### Advanced Q01: How would you design outbound HTTP clients for a production .NET microservice?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would create one logical client per external dependency using typed clients for normal scoped/transient usage and named clients where singleton services need to create clients on demand. Each client would have a centrally configured base address, timeout, headers, primary handler settings, authentication handler, and resilience policy.

I would use `IHttpClientFactory` to manage handlers, configure DNS/connection lifetime deliberately, pass cancellation tokens, use standard resilience handlers with customizations per dependency, disable unsafe retries unless idempotency is guaranteed, and add observability through logs, traces, metrics, and redacted headers.

I would also define clear error mapping, test clients with fake handlers or fake servers, and replace external clients in integration tests.

##### Key Points to Mention

- One logical client per external dependency.
- Typed clients for API-specific logic.
- Named clients for singleton scenarios.
- Central configuration.
- Timeouts and cancellation tokens.
- Resilience per dependency.
- Safe retry rules.
- Observability and redaction.
- Testability through fakes.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-advanced-q01 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-advanced-q02 -->
#### Advanced Q02: How do retries, circuit breakers, and timeouts work together?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Timeouts limit how long each attempt or total operation can take. Retries handle transient failures by trying again, usually with exponential backoff and jitter. Circuit breakers stop calls temporarily when the dependency is failing repeatedly, which prevents the caller from hammering a broken service and helps avoid cascading failures.

They must be configured together carefully. For example, the total timeout should include all retry attempts, and retries should not exceed the caller's request budget. Circuit breakers should be observable. Retries should be limited and safe for the operation type.

##### Key Points to Mention

- Attempt timeout limits each try.
- Total timeout limits the whole operation.
- Retries handle transient failures.
- Backoff and jitter reduce retry storms.
- Circuit breaker fails fast during repeated failures.
- Policies must fit the request budget.
- Unsafe operations should not be retried blindly.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-advanced-q02 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-advanced-q03 -->
#### Advanced Q03: How would you handle idempotency for retried outbound HTTP calls?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

First, classify operations by whether they are safe to retry. Read operations such as `GET` are usually safe. Write operations such as `POST` may not be safe because the server could have completed the operation even if the client timed out.

For retried writes, use an idempotency key if the downstream API supports it. The same key should be sent for all retry attempts so the server can return the original result instead of creating duplicates.

If the downstream system does not support idempotency, retries for that operation should usually be disabled or handled through a more careful workflow.

##### Key Points to Mention

- Identify whether the operation is idempotent.
- `GET` is usually safe to retry.
- `POST` can duplicate side effects.
- Timeouts do not prove the server failed.
- Use idempotency keys for retried writes.
- Server must support idempotency.
- Disable unsafe retries when needed.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-advanced-q03 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-advanced-q04 -->
#### Advanced Q04: What are the risks of stacking multiple resilience handlers or retry layers?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Stacking multiple retry or resilience layers can multiply attempts unexpectedly. For example, if a client retries three times, an API gateway retries three times, and a message processor retries three times, one logical operation can become many downstream calls.

This can increase latency, overload a failing dependency, duplicate side effects, make failures harder to reason about, and hide the true cause of errors.

A better approach is to define a clear retry budget, understand all retry layers, avoid duplicate retries, and centralize resilience policy per dependency where possible.

##### Key Points to Mention

- Retry multiplication.
- Higher downstream load.
- Longer latency.
- More duplicate side-effect risk.
- Harder debugging.
- Define retry budgets.
- Avoid unintentional stacked handlers.
- Coordinate retries across layers.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-advanced-q04 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-advanced-q05 -->
#### Advanced Q05: How do you design observability for outbound HTTP dependencies?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

I would log and trace outbound HTTP calls with dependency name, method, host, route or logical operation, status code, duration, failure category, retry count, timeout events, circuit breaker events, rate limiter rejections, and correlation or trace ID.

I would redact sensitive headers such as `Authorization`, `Cookie`, and API keys. I would avoid logging full request or response bodies unless explicitly safe and necessary.

Metrics should show latency, error rate, timeout rate, retry count, circuit breaker state, and downstream availability. Distributed tracing should connect incoming requests to outbound dependency calls.

##### Key Points to Mention

- Log dependency name and duration.
- Track status codes and failure types.
- Include trace/correlation IDs.
- Track retries, timeouts, and circuit breaker events.
- Redact sensitive headers.
- Avoid unsafe body logging.
- Use metrics and distributed tracing.
- Observe per dependency, not only globally.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-advanced-q05 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-advanced-q06 -->
#### Advanced Q06: How would you safely add authentication to outbound HTTP clients?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

I would usually add authentication through a delegating handler or typed client logic. For API keys, the handler can add the key from secure configuration. For OAuth tokens, a token provider should acquire and cache tokens safely, then the handler adds the `Authorization` header.

The handler should avoid storing user-specific or request-specific sensitive state in fields because message handler scopes can outlive request scopes. Tokens and secrets should be redacted from logs. Token refresh should be thread-safe and should avoid requesting a new token for every HTTP call.

##### Key Points to Mention

- Use delegating handlers for cross-cutting auth.
- Use secure configuration or secret storage.
- Use token provider for OAuth/JWT.
- Cache tokens safely when appropriate.
- Avoid request-specific state in long-lived handlers.
- Redact secrets in logs.
- Handle token expiration and refresh.
- Avoid token request storms.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-advanced-q06 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-advanced-q07 -->
#### Advanced Q07: When would you choose named clients over typed clients?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

I would choose typed clients when I want a strongly typed wrapper around a specific external API and the consuming service is scoped or transient. Typed clients keep API-specific methods and serialization logic in one place.

I would choose named clients when a singleton service needs to create clients on demand, when I want to avoid typed clients being captured too long, or when the consuming code already has its own abstraction and only needs a configured `HttpClient`.

Named clients are also useful when configuration is keyed by external dependency name.

##### Key Points to Mention

- Typed clients are good for API-specific wrappers.
- Typed clients are strongly typed and readable.
- Named clients work well with singleton services.
- Named clients avoid capturing short-lived typed clients.
- Named clients use string keys, so use constants/configuration.
- Both can use handlers and resilience policies.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-advanced-q07 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-advanced-q08 -->
#### Advanced Q08: How do you test resilience policies without making tests slow or flaky?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

Test most business behavior separately from resilience infrastructure. For resilience-specific tests, use fake handlers or local test servers that return controlled sequences of responses, such as two `503` responses followed by one `200`.

Keep timeout values short in tests and avoid waiting for real production timeout durations. Assert the important behavior, such as number of attempts, final status, or fallback behavior. Avoid tests that depend on real network instability.

For broad confidence, include a small number of integration tests verifying the configured client pipeline, but do not over-test the resilience library itself.

##### Key Points to Mention

- Use fake handlers or local servers.
- Return controlled response sequences.
- Keep test timeouts short.
- Avoid real external services.
- Assert attempts and final behavior.
- Do not over-test library internals.
- Keep resilience tests focused and deterministic.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-advanced-q08 -->

<!-- question:start:ihttpclientfactory-and-resilient-outbound-http-advanced-q09 -->
#### Advanced Q09: What are common production mistakes with outbound HTTP in .NET?

<!-- question-id:ihttpclientfactory-and-resilient-outbound-http-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

Common mistakes include creating a new manual `HttpClient` per request, keeping a static client forever without connection lifetime control, capturing typed clients in singletons, using no timeout, not passing cancellation tokens, blindly retrying unsafe methods, stacking multiple retry layers, logging secrets, calling real external services in tests, ignoring 429 rate limits, storing request-specific state in handlers, and not observing dependency latency or failure rates.

A production-ready design uses clear client boundaries, central configuration, safe resilience, idempotency rules, observability, and deterministic testing.

##### Key Points to Mention

- New manual client per request.
- Static client without `PooledConnectionLifetime`.
- Typed client captured by singleton.
- No timeout or cancellation.
- Blind retries.
- Multiple retry layers.
- Leaking secrets in logs.
- Cookie and handler pooling issues.
- Poor observability.
- Real external calls in tests.

<!-- question:end:ihttpclientfactory-and-resilient-outbound-http-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
