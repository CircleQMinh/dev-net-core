---
id: memorycache-concurrency-handling
topic: MemoryCache Concurrency & Cache Handling
category: .NET
---

## Cache Handling

`MemoryCache` (IMemoryCache) is in-memory and local to the current process.

That means:

- If you have multiple VMs or App Service instances (scale-out scenario), each instance has its own separate cache.
- There is no automatic synchronization between instances.
- Cache invalidation and updates are not shared across servers.

For multi-instance deployments, you need a distributed cache (e.g., Redis).

---

## Handling Concurrent Cache Writes (MemoryCache)

Although `MemoryCache` itself is thread-safe, multiple concurrent requests can still cause:

- Duplicate database calls
- Cache stampede
- Unnecessary CPU and IO usage

Since `lock` cannot be used with `await`, we use `SemaphoreSlim`.

---

##  In-Process Locking with `SemaphoreSlim`

```csharp
private static readonly SemaphoreSlim _cacheLock = new(1, 1);

public async Task<T> GetOrSetAsync<T>(string key, Func<Task<T>> factory, TimeSpan expiration)
{
    if (!_memoryCache.TryGetValue(key, out T value))
    {
        await _cacheLock.WaitAsync();
        try
        {
            // Double-check after acquiring lock
            if (!_memoryCache.TryGetValue(key, out value))
            {
                value = await factory();
                _memoryCache.Set(key, value, expiration);
            }
        }
        finally
        {
            _cacheLock.Release();
        }
    }

    return value;
}
````

Benefits:

* Prevents duplicate DB calls
* Safe under high concurrency
* Ensures only one request populates the cache

---

##  Controlling Background Tasks with `SemaphoreSlim`

```csharp
private static SemaphoreSlim _semaphore = new SemaphoreSlim(1, 1);

public async Task AddOrUpdateAsync()
{
    await _semaphore.WaitAsync();
    try
    {
        await DoSomethingAsync();
    }
    catch (Exception ex)
    {
        Console.WriteLine(ex.Message);
    }
    finally
    {
        _semaphore.Release();
    }
}
```

This ensures:

* Only one execution runs at a time
* Prevents overlapping background jobs

Optional non-blocking attempt:

```csharp
if (!await _semaphore.WaitAsync(0))
{
    return; // Task already running
}
```

---

##  Using `GetOrCreateAsync` (Preferred Pattern)

```csharp
public async Task<Product> GetProductAsync(Guid id)
{
    return await _cache.GetOrCreateAsync(
        $"product:{id}",
        async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            return await LoadFromDatabase(id);
        });
}
```

Advantages:

* Cleaner syntax
* Built-in concurrency protection per key (within the same process)
* Automatically handles expiration

This is usually preferred over manual locking.

---

##  Per-Key Locking (Avoid Global Contention)

Using a global lock may reduce performance when many different keys are requested.

Instead, use per-key locking:

```csharp
public class CacheLockProvider
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

    public static SemaphoreSlim GetLock(string key)
    {
        return _locks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
    }
}
```

Usage:

```csharp
public async Task<Product> GetProductAsync(int id)
{
    var cacheKey = $"product:{id}";

    // 1. Fast path: cache hit
    var cached = _cache.Get<Product>(cacheKey);
    if (cached != null)
        return cached;

    // 2. Acquire per-key lock
    var semaphore = CacheLockProvider.GetLock(cacheKey);
    await semaphore.WaitAsync();

    try
    {
        // 3. Double-check cache
        cached = _cache.Get<Product>(cacheKey);
        if (cached != null)
            return cached;

        // 4. Load from data source
        var product = await _repository.GetAsync(id);

        // 5. Write to cache once
        _cache.Set(cacheKey, product, TimeSpan.FromMinutes(5));

        return product;
    }
    finally
    {
        semaphore.Release();
    }
}
```

Benefits:

* Prevents cache stampede
* Avoids global lock bottleneck
* Scales better for high-traffic systems

---

## Single Server vs Multi-Server Strategy

Use:

* `IMemoryCache` → Single server / single instance
* Redis / SQL-based distributed cache → Multi-server / load-balanced environments

Distributed cache is required to:

* Share cache across instances
* Prevent cross-instance cache stampede
* Maintain consistency in scale-out scenarios

---

## Key Takeaways

* `MemoryCache` is process-local.
* It is thread-safe, but not distributed.
* `SemaphoreSlim` is appropriate for async locking.
* `GetOrCreateAsync` is usually sufficient for per-key concurrency control.
* Use per-key locking to reduce contention.
* Use distributed cache for multi-instance deployments.


```
