---
id: in-memory-distributed-hybrid-output-caching
topic: Performance, scalability, and caching
subtopic: In-memory, distributed, hybrid, and output caching
category: .NET
---



## Overview

Caching is the practice of storing data or generated output temporarily so future requests can be served faster and with less work. In .NET applications, caching is commonly used to reduce repeated database queries, expensive calculations, API calls, file reads, template rendering, and repeated HTTP response generation.

For interviews, caching is important because it tests whether a developer understands performance, scalability, correctness, invalidation, consistency, and production trade-offs. A strong answer is not simply "use Redis" or "use memory cache." A strong answer explains what is being cached, who can see it, how long it is valid, how it is invalidated, whether the application runs on one server or many servers, and what happens when data changes.

In .NET and ASP.NET Core, the main caching choices include:

- **In-memory caching** using `IMemoryCache`, where cached values live inside the application process.
- **Distributed caching** using `IDistributedCache`, where cached values live in an external shared store such as Redis, SQL Server, Postgres, Cosmos DB, or another provider.
- **Hybrid caching** using `HybridCache`, which combines fast local memory caching with optional distributed caching and built-in stampede protection.
- **Output caching** in ASP.NET Core, where complete HTTP responses are cached based on server-side policies.

These choices solve different problems. In-memory caching is simple and fast for single-instance apps. Distributed caching is better for scaled-out applications. Hybrid caching is useful when you want both local speed and shared distributed behavior. Output caching is useful when the same HTTP response can be reused safely for many requests.

## Core Concepts

### What caching is solving

Caching is usually introduced to reduce one or more of the following costs:

- **Latency**, such as waiting for a database, external API, or expensive computation.
- **CPU usage**, such as repeatedly rendering the same data or calculating the same result.
- **Database load**, such as repeatedly querying mostly unchanged reference data.
- **Network traffic**, such as repeatedly calling downstream services.
- **Application throughput limits**, where repeated work prevents the system from handling more requests.

A cache is useful when the cost of recomputing or refetching data is higher than the cost and risk of storing a temporary copy.

A cache is risky when the data changes frequently, is security-sensitive, is user-specific, or must always be strongly consistent.

### Important caching terminology

| Term | Meaning |
|---|---|
| Cache key | The unique identifier used to store and retrieve a cached value. |
| Cache value | The object, bytes, DTO, or response body stored in the cache. |
| Cache hit | The requested key exists in the cache and can be returned. |
| Cache miss | The requested key does not exist or has expired, so the source must be queried. |
| Expiration | A rule that determines when cached data becomes invalid. |
| Absolute expiration | The item expires at a fixed time or after a fixed duration. |
| Sliding expiration | The item expires if it has not been accessed for a duration. |
| Eviction | Removing an item from the cache due to expiration, memory pressure, manual removal, or policy. |
| Invalidation | Intentionally removing or marking cached data as stale after underlying data changes. |
| Cache stampede | Many requests miss the same cache key at the same time and all try to rebuild it. |
| Stale data | Cached data that no longer matches the source of truth. |
| Vary | Creating different cached responses based on route, query string, header, user, culture, tenant, or another value. |
| TTL | Time to live; how long an item is allowed to remain cached. |

### In-memory caching with `IMemoryCache`

`IMemoryCache` stores cache entries inside the memory of the current application process. It is usually the simplest caching option in a .NET application.

It is a good choice when:

- The application runs as a single instance.
- The cached data is small or moderately sized.
- It is acceptable for cached data to disappear when the process restarts.
- Each server can safely have its own copy of the cache.
- The data does not need to be shared across multiple application instances.

Typical examples include:

- Lookup lists such as countries, currencies, product categories, and feature metadata.
- Expensive calculations that are reused frequently.
- Configuration-like data that changes rarely.
- Small reference data loaded from a database.

Basic setup:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddMemoryCache();
builder.Services.AddScoped<ProductLookupService>();
```

Example service:

```csharp
using Microsoft.Extensions.Caching.Memory;

public sealed class ProductLookupService
{
    private readonly IMemoryCache _cache;
    private readonly AppDbContext _dbContext;

    public ProductLookupService(IMemoryCache cache, AppDbContext dbContext)
    {
        _cache = cache;
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<ProductCategoryDto>> GetCategoriesAsync(
        CancellationToken cancellationToken)
    {
        return await _cache.GetOrCreateAsync(
            "product-categories:v1",
            async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);
                entry.SlidingExpiration = TimeSpan.FromMinutes(10);

                return await _dbContext.ProductCategories
                    .OrderBy(x => x.Name)
                    .Select(x => new ProductCategoryDto(x.Id, x.Name))
                    .ToListAsync(cancellationToken);
            }) ?? [];
    }
}

public sealed record ProductCategoryDto(int Id, string Name);
```

Important habits:

- Use stable, descriptive cache keys.
- Cache DTOs or immutable values instead of EF Core tracked entities.
- Set expiration rules instead of caching forever.
- Avoid caching large objects without considering memory pressure.
- Avoid storing per-user sensitive data unless the key includes the user identity and the security model is clear.
- Remember that each application instance has its own separate memory cache.

### Expiration, eviction, and invalidation

Caching is not complete without an expiration and invalidation strategy.

**Expiration** is time-based. For example, cache the product list for 10 minutes.

**Invalidation** is event-based. For example, remove the product list cache when an admin updates a product.

Example manual invalidation:

```csharp
public sealed class ProductCommandService
{
    private readonly AppDbContext _dbContext;
    private readonly IMemoryCache _cache;

    public ProductCommandService(AppDbContext dbContext, IMemoryCache cache)
    {
        _dbContext = dbContext;
        _cache = cache;
    }

    public async Task RenameCategoryAsync(
        int categoryId,
        string newName,
        CancellationToken cancellationToken)
    {
        var category = await _dbContext.ProductCategories
            .SingleAsync(x => x.Id == categoryId, cancellationToken);

        category.Name = newName;
        await _dbContext.SaveChangesAsync(cancellationToken);

        _cache.Remove("product-categories:v1");
    }
}
```

Common mistakes:

- Using only sliding expiration for important data. A frequently accessed item may live much longer than intended.
- Forgetting to invalidate cached lookup data after writes.
- Using a cache key that is too broad and returns the wrong data to different users or tenants.
- Using a cache key that is too specific and creates too many entries.
- Assuming expiration is exact. Cache cleanup is usually opportunistic and implementation-dependent.

A practical pattern is to combine absolute expiration with event-based invalidation.

### Distributed caching with `IDistributedCache`

`IDistributedCache` stores cache entries in an external shared cache provider. The application talks to the cache through a common interface, but the storage can be Redis, SQL Server, Postgres, Cosmos DB, NCache, or another implementation.

It is a good choice when:

- The application runs on multiple servers or containers.
- Cached data should be shared between app instances.
- Cache data should survive application restarts or deployments.
- Local memory usage must be reduced.
- Session-like or shared cached data must be available across the server farm.

Common setup with Redis:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "myapp:";
});
```

`IDistributedCache` stores and retrieves byte arrays, so applications usually serialize data before storing it.

Example helper:

```csharp
using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;

public static class DistributedCacheJsonExtensions
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static async Task<T?> GetJsonAsync<T>(
        this IDistributedCache cache,
        string key,
        CancellationToken cancellationToken = default)
    {
        var bytes = await cache.GetAsync(key, cancellationToken);
        return bytes is null
            ? default
            : JsonSerializer.Deserialize<T>(bytes, JsonOptions);
    }

    public static async Task SetJsonAsync<T>(
        this IDistributedCache cache,
        string key,
        T value,
        DistributedCacheEntryOptions options,
        CancellationToken cancellationToken = default)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(value, JsonOptions);
        await cache.SetAsync(key, bytes, options, cancellationToken);
    }
}
```

Example service:

```csharp
public sealed class CustomerSummaryService
{
    private readonly IDistributedCache _cache;
    private readonly AppDbContext _dbContext;

    public CustomerSummaryService(IDistributedCache cache, AppDbContext dbContext)
    {
        _cache = cache;
        _dbContext = dbContext;
    }

    public async Task<CustomerSummaryDto?> GetCustomerSummaryAsync(
        int customerId,
        CancellationToken cancellationToken)
    {
        var key = $"customer-summary:{customerId}";

        var cached = await _cache.GetJsonAsync<CustomerSummaryDto>(key, cancellationToken);
        if (cached is not null)
        {
            return cached;
        }

        var summary = await _dbContext.Customers
            .Where(x => x.Id == customerId)
            .Select(x => new CustomerSummaryDto(
                x.Id,
                x.Name,
                x.Orders.Count))
            .SingleOrDefaultAsync(cancellationToken);

        if (summary is null)
        {
            return null;
        }

        await _cache.SetJsonAsync(
            key,
            summary,
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(15),
                SlidingExpiration = TimeSpan.FromMinutes(5)
            },
            cancellationToken);

        return summary;
    }
}

public sealed record CustomerSummaryDto(int Id, string Name, int OrderCount);
```

Trade-offs of distributed caching:

| Advantage | Trade-off |
|---|---|
| Shared across app instances | Adds network latency compared with memory cache |
| Can survive app restarts | Requires external infrastructure |
| Reduces local memory usage | Serialization and deserialization are required |
| Useful for scaled-out systems | Cache provider outages must be handled |
| Centralized invalidation is easier than local memory | Data consistency still requires careful design |

### Hybrid caching with `HybridCache`

`HybridCache` is a newer .NET caching abstraction that combines local in-memory caching with optional distributed caching. It is designed to simplify common cache-aside code and reduce problems such as cache stampedes.

Conceptually, it provides:

- **L1 cache**: fast in-process memory cache.
- **L2 cache**: optional distributed cache through an `IDistributedCache` provider.
- **Cache stampede protection**: when many requests ask for the same missing key, only one request should run the expensive factory while others wait for the result.
- **Simplified API**: `GetOrCreateAsync` handles lookup, factory execution, and storage.
- **Serialization support**: useful when a distributed cache is configured.
- **Tag-based invalidation**: useful for invalidating related entries together.

Basic setup:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
});

builder.Services.AddHybridCache();
```

Example usage:

```csharp
using Microsoft.Extensions.Caching.Hybrid;

public sealed class ProductReadService
{
    private readonly HybridCache _cache;
    private readonly AppDbContext _dbContext;

    public ProductReadService(HybridCache cache, AppDbContext dbContext)
    {
        _cache = cache;
        _dbContext = dbContext;
    }

    public async Task<ProductDetailsDto?> GetProductAsync(
        int productId,
        CancellationToken cancellationToken)
    {
        return await _cache.GetOrCreateAsync(
            $"product:{productId}",
            async token =>
            {
                return await _dbContext.Products
                    .Where(x => x.Id == productId)
                    .Select(x => new ProductDetailsDto(
                        x.Id,
                        x.Name,
                        x.Price))
                    .SingleOrDefaultAsync(token);
            },
            cancellationToken: cancellationToken);
    }
}

public sealed record ProductDetailsDto(int Id, string Name, decimal Price);
```

Example with options and tags:

```csharp
public async Task<ProductDetailsDto?> GetProductWithTagsAsync(
    int productId,
    CancellationToken cancellationToken)
{
    var options = new HybridCacheEntryOptions
    {
        Expiration = TimeSpan.FromMinutes(30),
        LocalCacheExpiration = TimeSpan.FromMinutes(5)
    };

    return await _cache.GetOrCreateAsync(
        $"product:{productId}",
        async token => await LoadProductAsync(productId, token),
        options,
        tags: [$"product:{productId}", "products"],
        cancellationToken: cancellationToken);
}
```

`HybridCache` is often a strong default for new applications that need both local speed and distributed consistency features. However, it does not remove the need to design good keys, expiration, invalidation, and serialization behavior.

### Output caching in ASP.NET Core

Output caching stores complete HTTP responses and serves them again without re-executing the endpoint logic. It is different from caching a data object inside a service.

Output caching is useful when:

- The same endpoint returns the same response for many callers.
- The response is expensive to generate.
- The response is safe to reuse.
- The endpoint is usually public or anonymous.
- The response can vary by route, query string, header, culture, tenant, or another known value.

Basic setup:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOutputCache(options =>
{
    options.AddBasePolicy(policy => policy.Expire(TimeSpan.FromSeconds(30)));
    options.AddPolicy("Products", policy =>
        policy.Expire(TimeSpan.FromMinutes(2))
              .SetVaryByQuery("category", "page")
              .Tag("products"));
});

var app = builder.Build();

app.UseRouting();
app.UseCors();
app.UseOutputCache();
app.UseAuthorization();

app.MapGet("/products", GetProducts)
   .CacheOutput("Products");

app.Run();
```

Controller example:

```csharp
using Microsoft.AspNetCore.OutputCaching;

[ApiController]
[Route("api/products")]
public sealed class ProductsController : ControllerBase
{
    [HttpGet]
    [OutputCache(PolicyName = "Products")]
    public async Task<IReadOnlyList<ProductDto>> GetProducts(
        [FromServices] ProductQueryService service,
        [FromQuery] string? category,
        CancellationToken cancellationToken)
    {
        return await service.GetProductsAsync(category, cancellationToken);
    }
}
```

Evicting output cache entries by tag:

```csharp
app.MapPost("/admin/cache/purge/products", async (
    IOutputCacheStore outputCacheStore,
    CancellationToken cancellationToken) =>
{
    await outputCacheStore.EvictByTagAsync("products", cancellationToken);
    return Results.NoContent();
});
```

Important output caching rules:

- Register services with `AddOutputCache`.
- Add middleware with `UseOutputCache`.
- Adding the service and middleware does not automatically cache everything; endpoints must be configured with policies or attributes.
- Default output caching is conservative: typically successful GET or HEAD responses are good candidates.
- Responses that set cookies or authenticated responses should not be cached by default.
- Use `VaryByQuery`, `VaryByHeader`, or `VaryByValue` when the response depends on request inputs.
- Use tags for group invalidation.
- Be careful with middleware order. In apps using CORS, output caching should be placed after CORS. In apps using routing/controllers, it should be placed after routing.

### Output caching vs response caching

Output caching and response caching are often confused.

| Feature | Output caching | Response caching |
|---|---|---|
| Main purpose | Server-controlled reuse of generated HTTP responses | HTTP caching behavior based on HTTP cache headers |
| Controlled by | Server-side policies and endpoint metadata | HTTP cache headers such as `Cache-Control`, `Vary`, and `Expires` |
| Client request headers can bypass it | Not in the same way; server policy controls behavior | Yes, client cache headers can force revalidation or bypass behavior |
| Invalidation | Supports policy-based and tag-based eviction | Mostly header-driven; fewer programmatic invalidation options |
| Useful for | Reducing server work for expensive endpoints | Standards-based HTTP caching for clients/proxies |
| ASP.NET Core availability | Modern ASP.NET Core feature for server-side response caching | Older HTTP-standard caching middleware |

In interviews, a good answer explains that response caching follows HTTP caching semantics, while output caching is designed to let the server control when responses are cached to reduce backend work.

### Choosing the right cache type

| Scenario | Recommended choice | Reason |
|---|---|---|
| Single-server app with small lookup data | `IMemoryCache` | Fastest and simplest option |
| Multi-server app needing shared cache | `IDistributedCache` | Shared external cache across app instances |
| Multi-server app needing both local speed and shared cache | `HybridCache` | Combines local memory and distributed cache |
| Public endpoint returning same response for many callers | Output caching | Avoids rerunning endpoint logic |
| User-specific dashboard | Usually data caching with user-specific keys, or no caching | Output caching can leak data if not varied correctly |
| Frequently changing transactional data | Usually avoid caching or use very short TTL | Stale data risk is high |
| Expensive external API response | `HybridCache`, `IDistributedCache`, or `IMemoryCache` | Reduces downstream dependency calls |
| Static assets | CDN/browser caching | Better handled outside application code |

A useful decision flow:

1. Is the cached thing a full HTTP response?
   - Use output caching when it is safe and reusable.
2. Is the cached thing application data?
   - Use `IMemoryCache` for simple single-instance scenarios.
   - Use `IDistributedCache` for shared multi-instance scenarios.
   - Use `HybridCache` when you want local speed, distributed support, and stampede protection.
3. Is the data user-specific or security-sensitive?
   - Avoid caching unless keys and authorization boundaries are carefully designed.
4. Does the data change often?
   - Use short TTLs, active invalidation, or avoid caching.

### Cache-aside pattern

The cache-aside pattern is one of the most common application caching patterns.

The flow is:

1. Try to get data from cache.
2. If found, return it.
3. If not found, query the source of truth.
4. Store the result in cache.
5. Return the result.

Example:

```csharp
public async Task<ProductDto?> GetProductAsync(
    int id,
    CancellationToken cancellationToken)
{
    var key = $"product:{id}";

    if (_memoryCache.TryGetValue(key, out ProductDto? cached))
    {
        return cached;
    }

    var product = await _dbContext.Products
        .Where(x => x.Id == id)
        .Select(x => new ProductDto(x.Id, x.Name, x.Price))
        .SingleOrDefaultAsync(cancellationToken);

    if (product is not null)
    {
        _memoryCache.Set(
            key,
            product,
            new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
            });
    }

    return product;
}
```

The cache-aside pattern is easy to understand but can create cache stampedes if many requests miss the same key at once. `HybridCache` and output caching resource locking can help with this problem.

### Cache stampede and thundering herd

A cache stampede happens when a popular cache item expires and many requests rebuild it at the same time. This can overload the database or downstream service.

Common mitigations:

- Use `HybridCache`, which includes stampede protection for `GetOrCreateAsync`.
- Use output caching resource locking for HTTP responses.
- Use randomized TTL jitter so many entries do not expire at the exact same moment.
- Refresh cache entries in the background before they expire.
- Use a lock or single-flight mechanism for expensive keys.
- Use stale-while-revalidate behavior where appropriate.

Example TTL jitter:

```csharp
private static TimeSpan AddJitter(TimeSpan baseTtl)
{
    var jitterSeconds = Random.Shared.Next(0, 30);
    return baseTtl + TimeSpan.FromSeconds(jitterSeconds);
}
```

### Security and correctness concerns

Caching can create serious production bugs if security and correctness are ignored.

Common risks:

- **Data leakage**: caching a response for one user and returning it to another user.
- **Tenant leakage**: forgetting to include tenant ID in the cache key.
- **Authorization bypass**: serving cached data without checking whether the current user can access it.
- **Stale permissions**: caching authorization or role data for too long.
- **Sensitive data persistence**: storing tokens, personal data, or secrets in a distributed cache without proper security controls.
- **Cache poisoning**: allowing untrusted input to control cache keys or cached output incorrectly.

Safer practices:

- Include tenant, user, culture, query, and authorization-relevant values in the cache key when needed.
- Avoid output caching authenticated responses unless you fully understand and configure variation rules.
- Do not cache secrets in normal application caches.
- Use short TTLs for permission-related data.
- Treat distributed caches as production infrastructure that needs authentication, encryption, monitoring, and access control.
- Prefer caching DTOs designed for safe reuse.

Example tenant-aware key:

```csharp
var key = $"tenant:{tenantId}:product:{productId}";
```

### Serialization and versioning

Distributed and hybrid caches often require serialization because data leaves the process. This creates versioning concerns.

Common issues:

- The application deploys a new DTO shape while old cached data still uses the old shape.
- Different services serialize the same logical object differently.
- Type names or private implementation details leak into serialized payloads.
- Large serialized values increase network latency and memory usage.

Best practices:

- Cache stable DTOs, not EF Core entities or domain aggregates with complex behavior.
- Include a version in the key when the shape changes.
- Keep cached payloads small.
- Use explicit serialization options.
- Consider compression only for large payloads after measuring cost.

Example versioned key:

```csharp
var key = $"product-details:v2:{productId}";
```

### Caching with EF Core

Caching can work well with EF Core read paths, but it should be used carefully.

Good candidates:

- Lookup/reference data.
- Read models and DTO projections.
- Aggregated summaries.
- Expensive reports.
- Data from read-only tables.

Risky candidates:

- Tracked EF Core entities.
- Data that changes often.
- Data that must reflect writes immediately.
- Per-user data without user-specific cache keys.

Recommended pattern:

```csharp
var product = await _dbContext.Products
    .AsNoTracking()
    .Where(x => x.Id == productId)
    .Select(x => new ProductDetailsDto(x.Id, x.Name, x.Price))
    .SingleOrDefaultAsync(cancellationToken);
```

Use `AsNoTracking` and project to DTOs when caching query results. This avoids storing objects that are tied to a specific `DbContext` or change tracker.

### Common production best practices

Use caching intentionally:

- Cache data that is expensive to compute or fetch.
- Do not cache everything by default.
- Measure before and after caching.
- Track cache hit rate, miss rate, eviction rate, and latency.
- Use consistent naming for keys.
- Set expiration and invalidation policies.
- Avoid caching failed responses unless that is explicitly desired.
- Use short TTLs for data that changes often.
- Avoid storing very large payloads.
- Protect distributed cache infrastructure.
- Design behavior for cache provider outages.
- Do not make the cache the only source of truth unless the system is explicitly designed that way.

A practical rule: the database or original service should remain the source of truth, and the cache should be an optimization unless the architecture explicitly says otherwise.

### Common mistakes

Common interview-worthy mistakes include:

- Using `IMemoryCache` in a load-balanced application and expecting all instances to share data.
- Caching authenticated HTTP responses without varying by user or authorization state.
- Forgetting to invalidate data after writes.
- Caching EF Core tracked entities.
- Not setting expiration.
- Using broad keys such as `"products"` when the result depends on query parameters.
- Using overly granular keys that create unbounded cache growth.
- Ignoring cache stampede problems.
- Not handling distributed cache outages.
- Caching data before confirming it is a performance bottleneck.
- Treating response caching and output caching as the same thing.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is caching, and why is it useful in .NET applications?

<!-- question:start:caching-basics-beginner-q01 -->
<!-- question-id:caching-basics-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Caching stores data or generated output temporarily so future requests can be served faster. In .NET applications, caching is useful for reducing database calls, external API calls, expensive calculations, and repeated response generation. It can improve latency, throughput, and scalability.

However, caching introduces correctness concerns. Cached data can become stale, can use memory, and can leak data if keys or output caching policies are designed incorrectly. A good developer uses caching for data that is expensive to fetch or compute and where temporary staleness is acceptable.

##### Key Points to Mention

- Caching is a performance optimization.
- It reduces repeated expensive work.
- It can improve latency and scalability.
- Cached data can become stale.
- Security and invalidation must be considered.

<!-- question:end:caching-basics-beginner-q01 -->

#### What is the difference between `IMemoryCache` and `IDistributedCache`?

<!-- question:start:memorycache-vs-distributedcache-beginner-q02 -->
<!-- question-id:memorycache-vs-distributedcache-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`IMemoryCache` stores cached values inside the memory of the current application process. It is very fast and simple, but every application instance has its own cache. If the app restarts, the cache is lost.

`IDistributedCache` stores cached values in an external shared store such as Redis, SQL Server, Postgres, Cosmos DB, or another provider. It is useful for multi-server or cloud applications because all app instances can share the same cached data. The trade-off is that it adds network latency, serialization, and infrastructure complexity.

##### Key Points to Mention

- `IMemoryCache` is local to one process.
- `IDistributedCache` is external and shared.
- Memory cache is faster but not shared.
- Distributed cache works better for scaled-out apps.
- Distributed cache usually requires serialization.

<!-- question:end:memorycache-vs-distributedcache-beginner-q02 -->

#### What is cache expiration?

<!-- question:start:cache-expiration-beginner-q03 -->
<!-- question-id:cache-expiration-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Cache expiration defines when a cached item should no longer be used. Absolute expiration removes an item after a fixed time. Sliding expiration removes an item if it has not been accessed for a specified duration. Expiration helps prevent stale data from living forever and helps control memory or storage usage.

In real systems, expiration is often combined with manual invalidation. For example, a product list may expire after 10 minutes, but the application may also remove it immediately when a product is updated.

##### Key Points to Mention

- Expiration controls cache lifetime.
- Absolute expiration uses a fixed deadline.
- Sliding expiration extends lifetime when accessed.
- Expiration reduces stale data risk.
- Manual invalidation is often still needed.

<!-- question:end:cache-expiration-beginner-q03 -->

#### What is output caching in ASP.NET Core?

<!-- question:start:output-caching-basics-beginner-q04 -->
<!-- question-id:output-caching-basics-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Output caching in ASP.NET Core caches complete HTTP responses. When a matching request arrives later, ASP.NET Core can serve the cached response without executing the endpoint logic again. It is useful for public or safely reusable responses that are expensive to generate.

Output caching is configured with services, middleware, and endpoint policies or attributes. It can vary responses by query string, header, route, or custom values, and it can evict groups of cached responses using tags.

##### Key Points to Mention

- It caches HTTP responses, not just data objects.
- It reduces repeated endpoint execution.
- It is configured server-side.
- It can vary by request values.
- It must be used carefully with authenticated or user-specific data.

<!-- question:end:output-caching-basics-beginner-q04 -->

#### What should usually be cached: EF Core entities or DTOs?

<!-- question:start:cache-entities-or-dtos-beginner-q05 -->
<!-- question-id:cache-entities-or-dtos-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

DTOs should usually be cached instead of EF Core entities. EF Core entities may be tracked by a `DbContext`, may contain navigation properties, and may represent persistence behavior that should not be reused across requests. DTOs are safer because they are simple, stable, and designed for read scenarios.

For cached query results, it is common to use `AsNoTracking`, project to a DTO, and cache the DTO result.

##### Key Points to Mention

- Prefer DTOs or immutable read models.
- Avoid caching tracked EF Core entities.
- Use `AsNoTracking` for read-only cached queries.
- DTOs reduce serialization and change tracker issues.
- Cache shape should be stable and intentional.

<!-- question:end:cache-entities-or-dtos-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How do you choose between in-memory, distributed, hybrid, and output caching?

<!-- question:start:choose-cache-type-intermediate-q01 -->
<!-- question-id:choose-cache-type-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

The choice depends on what is being cached and how the application is deployed. For small application data in a single-instance app, `IMemoryCache` is usually enough. For multi-instance applications where cached data must be shared, `IDistributedCache` is better. For applications that need both local speed and distributed sharing, `HybridCache` is a strong option because it combines local and distributed caching and includes stampede protection. For complete HTTP responses, ASP.NET Core output caching is the correct tool when responses are safe to reuse.

A good answer also considers security, invalidation, consistency, data size, cache provider reliability, and whether the response or data is user-specific.

##### Key Points to Mention

- Use `IMemoryCache` for simple local caching.
- Use `IDistributedCache` for shared multi-server caching.
- Use `HybridCache` for local plus distributed caching and stampede protection.
- Use output caching for complete HTTP responses.
- Consider data sensitivity, invalidation, deployment topology, and consistency.

<!-- question:end:choose-cache-type-intermediate-q01 -->

#### What is the cache-aside pattern?

<!-- question:start:cache-aside-pattern-intermediate-q02 -->
<!-- question-id:cache-aside-pattern-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

The cache-aside pattern means the application checks the cache first. If the item exists, it returns the cached value. If the item does not exist, the application loads it from the source of truth, stores it in the cache, and then returns it.

This pattern is popular because it is simple and keeps the database or external service as the source of truth. The main challenges are choosing good keys, setting expiration, invalidating data after writes, and avoiding cache stampedes when many requests miss the same key at the same time.

##### Key Points to Mention

- Check cache first.
- Load from source on miss.
- Store result in cache.
- Return the result.
- Main risks are stale data and stampedes.

<!-- question:end:cache-aside-pattern-intermediate-q02 -->

#### What is cache stampede, and how can you prevent it?

<!-- question:start:cache-stampede-intermediate-q03 -->
<!-- question-id:cache-stampede-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A cache stampede happens when a popular cache entry expires or is missing, and many concurrent requests all try to rebuild it at the same time. This can overload the database or downstream service and make the cache less useful.

Prevention strategies include using `HybridCache` for built-in stampede protection, output caching resource locking for HTTP responses, adding jitter to expiration times, refreshing cache entries in the background, using per-key locks, or allowing stale data to be served briefly while a refresh happens.

##### Key Points to Mention

- Many requests miss the same key at once.
- The source of truth can be overloaded.
- `HybridCache` helps with stampede protection.
- Output caching can use resource locking.
- TTL jitter and background refresh can help.

<!-- question:end:cache-stampede-intermediate-q03 -->

#### Why can caching authenticated responses be dangerous?

<!-- question:start:caching-authenticated-responses-intermediate-q04 -->
<!-- question-id:caching-authenticated-responses-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Caching authenticated responses is dangerous because the response may contain user-specific or permission-specific data. If the cache key or output caching policy does not vary by user, tenant, role, permission, or other authorization-relevant values, one user may receive another user's data.

For this reason, output caching defaults are conservative around authenticated requests and responses that set cookies. If user-specific caching is needed, it should usually be done with explicit data caching and carefully designed keys, or with very strict output cache variation rules.

##### Key Points to Mention

- Risk of leaking one user's data to another user.
- Keys must include user, tenant, and authorization-relevant values when needed.
- Cookie and authenticated responses require special care.
- Output caching is usually best for public or anonymous responses.
- Authorization must not be bypassed by cache hits.

<!-- question:end:caching-authenticated-responses-intermediate-q04 -->

#### How does output caching differ from response caching?

<!-- question:start:output-vs-response-caching-intermediate-q05 -->
<!-- question-id:output-vs-response-caching-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Output caching is server-controlled caching of complete HTTP responses. The server defines policies that decide what is cached, how long it is cached, how keys vary, and how entries can be evicted.

Response caching follows HTTP caching semantics and is controlled by HTTP cache headers such as `Cache-Control`, `Vary`, and `Expires`. Client request headers can affect whether a cached response can be used. Response caching is useful for standards-based HTTP caching, while output caching is usually better when the goal is reducing server work under server-defined rules.

##### Key Points to Mention

- Output caching is controlled by server-side policies.
- Response caching follows HTTP cache headers.
- Output caching supports tags and programmatic eviction.
- Response caching can be bypassed by client cache directives.
- Output caching is usually better for reducing origin server work.

<!-- question:end:output-vs-response-caching-intermediate-q05 -->

#### How should cache keys be designed?

<!-- question:start:cache-key-design-intermediate-q06 -->
<!-- question-id:cache-key-design-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Cache keys should uniquely represent the data being cached. A good key includes all values that affect the result, such as entity ID, tenant ID, user ID, culture, page number, filters, feature flags, or version. Keys should be consistent, readable, and namespaced to avoid collisions.

A key that is too broad can return incorrect data. A key that is too specific can create excessive cache entries and low hit rates. For serialized distributed caches, including a version in the key helps avoid problems when the DTO shape changes.

##### Key Points to Mention

- Include all values that affect the result.
- Include tenant or user when needed.
- Use namespacing and versioning.
- Avoid broad keys that return wrong data.
- Avoid overly granular keys that create unbounded growth.

<!-- question:end:cache-key-design-intermediate-q06 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design caching for a scaled-out ASP.NET Core API?

<!-- question:start:scaled-out-api-caching-advanced-q01 -->
<!-- question-id:scaled-out-api-caching-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

For a scaled-out ASP.NET Core API, the design should first identify cacheable data and response patterns. Public reusable HTTP responses can use output caching with policies, variation rules, and tags. Shared application data can use `IDistributedCache` or `HybridCache` with a distributed provider such as Redis. `HybridCache` is attractive when the app needs local speed, shared L2 cache, and stampede protection.

The design should include namespaced and versioned cache keys, tenant-aware keys, expiration rules, active invalidation after writes, observability, fallback behavior if the cache provider is unavailable, and security boundaries. The database or source service should remain the source of truth unless the architecture explicitly uses cache as a primary data store.

##### Key Points to Mention

- Use distributed or hybrid caching for shared multi-instance data.
- Use output caching for safe reusable HTTP responses.
- Include tenant/user/context in keys when needed.
- Plan invalidation and TTLs.
- Monitor hit rate, latency, errors, and evictions.
- Design fallback behavior for cache outages.

<!-- question:end:scaled-out-api-caching-advanced-q01 -->

#### What are the main risks of distributed caching?

<!-- question:start:distributed-cache-risks-advanced-q02 -->
<!-- question-id:distributed-cache-risks-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Distributed caching introduces network dependency, serialization overhead, provider availability concerns, security requirements, and consistency challenges. Unlike memory cache, each cache operation may involve network latency. If Redis or another provider is unavailable, the application must decide whether to fail, bypass the cache, or degrade gracefully.

Distributed caches also require careful key design and invalidation. Serialization can break after deployments if cached payload shapes change. Security matters because the cache may contain sensitive data or cross-tenant information. Production systems should secure the cache, monitor it, and avoid storing data that does not belong there.

##### Key Points to Mention

- Network latency and provider outages.
- Serialization and versioning problems.
- Security and access control requirements.
- Stale data and invalidation complexity.
- Operational monitoring is required.

<!-- question:end:distributed-cache-risks-advanced-q02 -->

#### How would you invalidate cache entries after a write operation?

<!-- question:start:cache-invalidation-after-write-advanced-q03 -->
<!-- question-id:cache-invalidation-after-write-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

The simplest approach is to remove known cache keys after a successful write. For related groups of entries, tags can be used when supported, such as output caching tags or hybrid cache tags. Another approach is versioned keys, where a version value changes after updates so old entries are no longer used. In event-driven systems, domain events or integration events can notify other services to invalidate related cache entries.

The important rule is that invalidation should happen after the write succeeds, not before. The design should also handle partial failures, such as the database write succeeding but cache invalidation failing. In those cases, short TTLs, retry mechanisms, or event-based invalidation can reduce stale data duration.

##### Key Points to Mention

- Remove specific keys after successful writes.
- Use tags for grouped invalidation when available.
- Use versioned keys for shape or data changes.
- Consider events for cross-service invalidation.
- Handle partial failure and stale data windows.

<!-- question:end:cache-invalidation-after-write-advanced-q03 -->

#### How do you prevent cache-related security bugs in multi-tenant systems?

<!-- question:start:multi-tenant-cache-security-advanced-q04 -->
<!-- question-id:multi-tenant-cache-security-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

In a multi-tenant system, every cached item must respect tenant isolation. Cache keys should include tenant ID whenever data differs by tenant. User-specific data should also include user ID or another safe identity boundary. Authorization must still be enforced; a cache hit should not bypass permission checks.

For output caching, policies must vary by all request values that affect the response. In many cases, authenticated or tenant-specific responses should not be output cached unless the variation rules are carefully designed and tested. Distributed cache infrastructure should also be secured with authentication, encryption where appropriate, private networking, and least-privilege access.

##### Key Points to Mention

- Include tenant ID in keys.
- Include user or authorization context when needed.
- Do not let cache hits bypass authorization.
- Be very careful with output caching authenticated responses.
- Secure the distributed cache infrastructure.

<!-- question:end:multi-tenant-cache-security-advanced-q04 -->

#### How would you measure whether caching is working?

<!-- question:start:measure-cache-effectiveness-advanced-q05 -->
<!-- question-id:measure-cache-effectiveness-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Caching should be measured by comparing system behavior before and after caching. Useful metrics include cache hit rate, miss rate, response latency, database query volume, downstream API call count, CPU usage, memory usage, eviction count, cache provider latency, and error rate. For output caching, metrics should also show whether endpoints are served from cache and whether variation rules are creating too many entries.

A high hit rate is not always enough. The cache must improve meaningful performance without returning incorrect or stale data. Monitoring should also detect cache outages, stampedes, large payloads, and sudden drops in hit rate after deployments.

##### Key Points to Mention

- Measure hit rate and miss rate.
- Measure latency and backend load reduction.
- Monitor memory, evictions, and provider errors.
- Track cache key cardinality.
- Validate correctness, not only speed.

<!-- question:end:measure-cache-effectiveness-advanced-q05 -->

#### When should you avoid caching?

<!-- question:start:when-to-avoid-caching-advanced-q06 -->
<!-- question-id:when-to-avoid-caching-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Caching should be avoided when data must always be strongly consistent, changes very frequently, is cheap to retrieve, is highly user-specific and security-sensitive, or creates more complexity than benefit. Caching should also be avoided when the team has no invalidation strategy or observability.

In interviews, a mature answer recognizes that caching is not automatically good. It improves performance by trading off freshness, simplicity, and sometimes consistency. If the database query is already fast and the data changes constantly, adding a cache may create stale-data bugs without meaningful performance benefit.

##### Key Points to Mention

- Avoid caching when freshness is critical.
- Avoid caching cheap operations.
- Avoid caching sensitive user-specific data without strong boundaries.
- Avoid caching without invalidation and monitoring.
- Caching trades simplicity and freshness for performance.

<!-- question:end:when-to-avoid-caching-advanced-q06 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
