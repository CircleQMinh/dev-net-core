---
id: rate-limit-cache
topic: Rate Limiting & Caching
category: Design & Architecture
---

## Rate Limiting Concepts

### What is rate limiting and why is it important?

Rate limiting is the process of controlling how many requests a client can make to an API or service within a specific time period.

It is important for:

- Preventing abuse and brute-force attacks
- Mitigating DoS (Denial of Service) attempts
- Protecting backend services from overload
- Ensuring fair usage across users
- Controlling infrastructure costs

---

### What are common rate limiting strategies?

#### Fixed Window

- Limits requests in a fixed time window  
- Example: 100 requests per minute  
- Simple but may allow bursts at window boundaries

#### Sliding Window

- Uses a moving time window  
- More accurate and fair than fixed window  
- Reduces boundary burst issue

#### Token Bucket

- Tokens are added at a fixed rate  
- Each request consumes a token  
- Allows short bursts while enforcing long-term limits

#### Leaky Bucket

- Requests are processed at a fixed rate  
- Excess requests are queued or dropped  
- Ensures smooth output rate

---

### How do you implement rate limiting in ASP.NET Core?

Modern ASP.NET Core (7+) includes built-in rate limiting middleware.

Example:

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("fixed", opt =>
    {
        opt.PermitLimit = 100;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 0;
    });
});

app.UseRateLimiter();
````

Older versions may use third-party libraries such as `AspNetCoreRateLimit`.

---

### What is the difference between global and per-user rate limiting?

* **Global rate limiting**: Applies to all requests collectively (e.g., 10,000 requests per hour system-wide).
* **Per-user rate limiting**: Applies limits based on user identity (IP, API key, JWT claims).

Per-user limits are more common in public APIs.

---

### How do you handle burst traffic?

Use:

* Token bucket
* Sliding window
* Queueing mechanisms
* Short-term burst allowances with sustained rate enforcement

---

### How do you handle rate limiting in distributed systems?

In multi-instance environments, you need shared state:

* Redis (distributed cache)
* Central rate limiting service
* API Gateway-level rate limiting (e.g., Azure API Management)

This ensures consistent enforcement across instances.

---

### What is a backoff strategy?

A backoff strategy delays retries when rate limits are exceeded.

Common technique:

* **Exponential backoff**
* Wait time increases exponentially after each retry

Often combined with `Retry-After` HTTP headers.

---

### How do you differentiate limits for authenticated vs anonymous users?

* Anonymous users → stricter limits
* Authenticated users → higher limits
* Premium users → even higher quotas

This enables tiered API access models.

---

## Caching Concepts

### What is caching and why is it important?

Caching stores frequently accessed data in faster storage (usually memory) to reduce latency and backend load.

Benefits:

* Faster response time
* Reduced database load
* Lower infrastructure cost
* Improved scalability

---

### Types of caching in ASP.NET Core

1. **In-memory caching** (`IMemoryCache`)
2. **Distributed caching** (`IDistributedCache`)
3. **Response caching middleware**
4. **Output caching** (ASP.NET Core 7+)
5. **Data-level caching patterns**

---

### How do you implement in-memory caching?

```csharp
public class MyController : Controller
{
    private readonly IMemoryCache _memoryCache;

    public MyController(IMemoryCache memoryCache)
    {
        _memoryCache = memoryCache;
    }

    public IActionResult Index()
    {
        if (!_memoryCache.TryGetValue("myKey", out string cachedValue))
        {
            cachedValue = "Fresh Value";
            _memoryCache.Set("myKey", cachedValue,
                new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                });
        }

        return View(cachedValue);
    }
}
```

---

### How do you implement distributed caching?

```csharp
public class MyController : Controller
{
    private readonly IDistributedCache _distributedCache;

    public MyController(IDistributedCache distributedCache)
    {
        _distributedCache = distributedCache;
    }

    public async Task<IActionResult> Index()
    {
        var cachedValue = await _distributedCache.GetStringAsync("myKey");

        if (string.IsNullOrEmpty(cachedValue))
        {
            cachedValue = "Fresh Value";

            await _distributedCache.SetStringAsync(
                "myKey",
                cachedValue,
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                });
        }

        return View(cachedValue);
    }
}
```

---

### What is cache invalidation?

Cache invalidation removes or updates stale cached data.

Without proper invalidation, users may receive outdated data.

---

### Cache invalidation strategies

* Time-based expiration
* Manual invalidation
* Event-driven invalidation
* Versioned cache keys
* Write-through consistency patterns

---

### Cache expiration policies

Using `MemoryCacheEntryOptions` or `DistributedCacheEntryOptions`:

```csharp
_cache.Set("key", value, new MemoryCacheEntryOptions
{
    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
    SlidingExpiration = TimeSpan.FromMinutes(1)
});
```

Types:

* **Absolute expiration**
* **Sliding expiration**

---

### Cache Aside vs Read-Through

#### Cache Aside

* Application loads data
* Writes it into cache
* Most common in ASP.NET Core

#### Read-Through

* Cache layer loads data automatically
* Less common in .NET without specialized caching systems

---

### Write-Through vs Write-Behind

#### Write-Through

* Write to cache and database simultaneously
* Strong consistency

#### Write-Behind

* Write to cache first
* Persist to database asynchronously
* Higher performance but risk of data loss

---

### What is cache stampede and how do you prevent it?

Cache stampede occurs when many requests attempt to reload the same expired item simultaneously.

Prevention techniques:

* Locking (single flight)
* Distributed locks (e.g., Redis lock)
* Staggered expiration
* Early refresh
* Background refresh
* Lazy loading with synchronization

---

## Combining Rate Limiting and Caching

### How do they work together?

* Store rate limit counters in Redis
* Cache expensive responses
* Apply rate limiting before hitting backend services
* Use CDN for public endpoints

This combination improves:

* Performance
* Security
* Scalability

---

### What data should you cache?

Cache:

* Frequently accessed data
* Expensive database queries
* Third-party API responses
* Computed results

Avoid caching:

* Highly volatile data
* Sensitive per-request user data (unless scoped correctly)
* Large objects that rarely repeat

---

## Best Practices Summary

* Use built-in rate limiting in ASP.NET Core 7+
* Use distributed cache in multi-instance environments
* Keep cache TTL aligned with data volatility
* Prevent cache stampede
* Apply rate limiting at API Gateway level when possible
* Monitor hit ratio and eviction metrics


---

## Notes

- The original document stated that ASP.NET Core does not have built-in rate limiting. This is outdated. ASP.NET Core 7+ includes native rate limiting middleware.
- Clarified that Output Caching is officially supported starting from ASP.NET Core 7.
- Expanded distributed rate limiting discussion to include API Gateway options.
- Added additional cache stampede mitigation strategies for completeness.

```
