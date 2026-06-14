---
id: cache-aside-read-caching-and-invalidation-trade-offs
topic: Scalability, resilience, caching, and observability design
subtopic: Cache-aside, read caching, and invalidation trade-offs
category: Design & Architecture
---

## Overview

Caching stores a reusable copy of data closer to callers or in a faster system so repeated reads avoid expensive computation, network calls, or database queries.

In the cache-aside pattern, the application:

1. Reads from the cache.
2. Loads from the source on a miss.
3. Stores the result in the cache.
4. Returns the result.

On a write, the application usually updates the authoritative store and invalidates the cached entry.

Caching can improve:

- Latency.
- Throughput.
- Origin database load.
- Availability during short dependency problems.
- Cost for expensive repeated work.

Caching also creates another copy of data with its own:

- Consistency delay.
- Expiration and eviction rules.
- Security boundary.
- Capacity and failure modes.
- Serialization and schema concerns.

The central trade-off is freshness versus performance and availability. Invalidation is difficult because updates, readers, multiple cache layers, and failures can race.

This topic matters in interviews because strong candidates define which data may be stale, how keys and TTLs are chosen, what happens when the cache fails, and how stampedes and invalidation races are controlled.

## Core Concepts

### Cache-Aside Read Flow

```csharp
public async Task<ProductView?> GetProductAsync(
    Guid productId,
    CancellationToken cancellationToken)
{
    var key = $"product:v2:{productId:N}";
    var cached = await cache.GetStringAsync(key, cancellationToken);

    if (cached is not null)
    {
        return JsonSerializer.Deserialize<ProductView>(cached);
    }

    var product = await db.Products
        .AsNoTracking()
        .Where(item => item.Id == productId)
        .Select(item => new ProductView(
            item.Id,
            item.Name,
            item.Price,
            item.Version))
        .SingleOrDefaultAsync(cancellationToken);

    if (product is not null)
    {
        await cache.SetStringAsync(
            key,
            JsonSerializer.Serialize(product),
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
            },
            cancellationToken);
    }

    return product;
}
```

The source of truth remains the database. Cache population is normally best effort.

### Cache Hit, Miss, and Effectiveness

Important measurements:

- Hit ratio.
- Miss ratio.
- Lookup latency.
- Origin latency.
- Load latency on miss.
- Eviction count.
- Memory usage.
- Stale-read rate where measurable.
- Errors and timeouts.

A high hit ratio is not automatically good if entries are stale, oversized, insecure, or cheap to recompute. Measure user latency and origin load.

### Read-Through, Write-Through, and Write-Behind

**Cache-aside**

- Application manages loading and invalidation.
- Flexible and common.

**Read-through**

- Cache provider loads missing data through a configured loader.

**Write-through**

- Write is applied through the cache to the authoritative store.
- Can simplify callers but couples writes to cache behavior.

**Write-behind**

- Cache accepts the write and persists later.
- Improves latency but risks data loss and complex ordering.

Do not treat a cache as authoritative unless the architecture explicitly provides the required durability and consistency.

### Update Then Invalidate

For cache-aside writes:

```csharp
public async Task UpdateProductAsync(
    Product product,
    CancellationToken cancellationToken)
{
    await repository.UpdateAsync(product, cancellationToken);
    await cache.RemoveAsync(
        $"product:v2:{product.Id:N}",
        cancellationToken);
}
```

Update the source before invalidating.

If invalidation happens first:

```text
writer removes cache
reader misses
reader loads old database value
reader repopulates old value
writer commits database
```

The stale entry can remain until expiration.

Updating first still has a small stale window and invalidation can fail. TTL, event-driven invalidation, versioned keys, or repair mechanisms limit the impact.

### Cache Invalidation Strategies

Common strategies:

**Time-based expiration**

- Simple.
- Bounded staleness.
- Does not react immediately to changes.

**Explicit invalidation**

- Writer deletes affected keys after commit.
- Requires knowledge of every dependent key.

**Event-driven invalidation**

- Committed changes publish invalidation events.
- Useful across services and cache layers.
- Delivery is eventually consistent and must be reliable.

**Versioned keys**

- Key includes data or schema version.
- Old values become unreachable.
- Old entries still consume space until eviction.

**Short TTL plus invalidation**

- Invalidation provides normal freshness.
- TTL limits damage when invalidation is missed.

### TTL Selection

TTL should reflect:

- Allowed staleness.
- Update frequency.
- Read frequency.
- Load cost.
- Failure tolerance.
- Memory budget.

Examples:

- Product description: minutes may be acceptable.
- Inventory availability: seconds or no cache for final decisions.
- Authorization and account status: generally read from an authoritative source or use tightly controlled short-lived state.

Add randomized TTL jitter to prevent many entries from expiring simultaneously.

### Absolute and Sliding Expiration

**Absolute expiration**

- Entry expires at a fixed time after creation.
- Bounds maximum staleness.

**Sliding expiration**

- Active entries remain while they are accessed.
- A popular stale entry can survive indefinitely if no absolute limit exists.

Combine them when needed:

```csharp
new DistributedCacheEntryOptions
{
    SlidingExpiration = TimeSpan.FromMinutes(2),
    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(15)
};
```

### Eviction

Caches have finite capacity and can evict entries before TTL.

Design assumptions:

- Any cache read can miss.
- Cache loss must not corrupt business state.
- Rebuilding must not overload the origin.
- Priority and size policies should reflect value.

Do not rely on a cached value's continued presence for correctness or workflow progress.

### Local and Distributed Caches

**Local in-memory cache**

- Very low latency.
- No network hop.
- Private to one instance.
- Lost on restart.
- Different instances can hold different values.

**Distributed cache**

- Shared by multiple instances.
- More consistent key space.
- Adds network latency and another dependency.
- Requires capacity, connection, and availability design.

**Two-level cache**

```text
L1 local cache -> L2 distributed cache -> database
```

This improves latency but makes invalidation more complex. L1 entries need short TTLs or an invalidation channel.

### Stateless Services and Cache State

Using a distributed cache does not mean every cached item is safe as session state.

Separate:

- Reconstructable read cache.
- Durable business state.
- Authentication or session state.
- Workflow state.

Eviction of read cache should cause a miss, not logout, lost orders, or corrupted workflows.

### Cache Stampede

When a popular entry expires, many requests miss simultaneously:

```text
10,000 requests
    -> same cache miss
    -> 10,000 database queries
```

Mitigations:

- Single-flight request coalescing.
- Distributed lock with bounded wait.
- Early refresh.
- Stale-while-revalidate.
- TTL jitter.
- Prewarming.
- Origin concurrency limits.

Locks need expiry and failure handling. Never hold a distributed lock indefinitely.

### Single Flight

One process can coalesce concurrent loads:

```csharp
private readonly ConcurrentDictionary<string, Lazy<Task<ProductView?>>> loads = new();

public Task<ProductView?> LoadOnceAsync(string key)
{
    var lazy = loads.GetOrAdd(
        key,
        _ => new Lazy<Task<ProductView?>>(
            () => LoadFromSourceAsync(key)));

    return CompleteAndRemoveAsync(key, lazy);
}
```

This protects one instance. Distributed stampede control requires cross-instance coordination or stale serving.

### Stale-While-Revalidate

Store:

- Fresh-until time.
- Serve-stale-until time.

Behavior:

```text
fresh -> return immediately
stale but allowed -> return stale and refresh in background
too old -> block on source or fail
```

This stabilizes latency but is appropriate only when stale data is safe. Make staleness visible for high-impact decisions.

### Negative Caching

Caching "not found" reduces repeated misses for nonexistent keys.

Use:

- Short TTL.
- Tenant-aware keys.
- Invalidation when the object is created.
- Care around authorization.

Do not let a long negative cache hide a newly created resource or convert a temporary dependency failure into "not found."

### Key Design

A cache key must include every dimension that changes the result:

```text
product:v2:{productId}:{locale}:{currency}
```

Potential dimensions:

- Tenant.
- User or authorization scope.
- Locale.
- Currency.
- API version.
- Query parameters.
- Projection schema.
- Feature flags.

Missing tenant or permission scope can leak data between callers.

Avoid unbounded attacker-controlled key cardinality.

### Caching Lists and Queries

Invalidating one entity key is straightforward. Query caches are harder:

```text
products by category
search results
dashboard aggregates
paginated lists
```

An update can affect many keys.

Options:

- Short TTL.
- Version a whole collection namespace.
- Cache IDs rather than full objects.
- Maintain explicit dependency tags.
- Use materialized views or search indexes.
- Avoid caching highly dynamic ad hoc queries.

### Cache Consistency Races

Even update-then-invalidate can race:

```text
reader starts old database read
writer commits and invalidates
reader completes and stores old value
```

Mitigations:

- Store source version with the cached item.
- Conditional cache write.
- Delayed second invalidation.
- Versioned keys.
- Change events.
- Short TTL.

The required complexity depends on the cost of a stale read.

### Read-Your-Writes

After a user updates data, a cache may return the old value.

Options:

- Invalidate synchronously after commit.
- Return the updated representation from the write.
- Bypass cache for that caller briefly.
- Use a version token and reject older cached values.
- Update the cache only with the committed version.

Define the consistency promise explicitly.

### Cache Failure

Decide whether the cache is:

**Optional optimization**

- On failure, read from origin.
- Protect origin with concurrency limits and circuit breakers.

**Required dependency**

- Fail or degrade when cache is unavailable.
- Common when origin cannot tolerate full traffic.

If every instance falls back to the database during a cache outage, the database may fail next. Use load shedding and gradual recovery.

### Cache Penetration and Abuse

Attackers can request many unique nonexistent keys:

```text
/products/random-1
/products/random-2
...
```

Defenses:

- Input validation.
- Rate limits.
- Short negative caching.
- Bloom filters in specialized cases.
- Key cardinality monitoring.
- Origin admission controls.

Do not cache large arbitrary user responses without size and quota controls.

### Security and Privacy

Cache data needs:

- Encryption where appropriate.
- Network and identity controls.
- Tenant-safe keys.
- Restricted administrative access.
- Retention and deletion behavior.
- Redacted telemetry.

Avoid caching:

- Secrets.
- Raw tokens.
- Highly sensitive data without a justified design.
- Authorization decisions longer than their revocation tolerance.

Cache poisoning occurs when untrusted values or incomplete key variation cause one caller's response to be served to another.

### Serialization and Schema Evolution

Cached objects can outlive a deployment.

Use:

- Versioned key prefixes.
- Tolerant serialization.
- Bounded TTL.
- Migration or cache flush plan.

Do not assume all cache values deserialize under the new code. Treat corrupt or unknown entries as misses.

### Testing and Observability

Test:

- Hit and miss behavior.
- Concurrent miss stampede.
- Writer-reader races.
- Invalidation failure.
- Cache outage.
- Eviction.
- Schema deployment.
- Tenant key isolation.
- Stale-while-revalidate.
- Negative cache creation race.

Measure hit ratio by cache and operation, load latency, origin calls, stale age, evictions, memory, connection errors, and stampede suppression.

### When Caching Makes Sense

Cache when:

- Reads repeat.
- Origin work is expensive.
- Data changes less often than it is read.
- Some staleness is acceptable.
- Keys and invalidation can be bounded.
- Performance benefit is measurable.

Avoid caching when:

- Almost every read is unique.
- Data must always be current.
- The value is cheap to retrieve.
- Security or privacy risk exceeds benefit.
- Invalidation dependencies are unmanageable.

### Common Mistakes

Common failures include:

- Caching without measuring benefit.
- Invalidating before database commit.
- Omitting tenant or locale from keys.
- Using sliding expiration without an absolute bound.
- Treating cache presence as durable state.
- Allowing stampedes after expiry.
- Falling back without protecting the origin.
- Caching errors as not found.
- Updating cache and database independently.
- Caching authorization too long.
- Ignoring schema evolution.
- Logging sensitive cache values.

### Best-Practice Design Process

1. Define the latency and origin-load problem.
2. Classify freshness and security requirements.
3. Design complete, versioned, bounded keys.
4. Start with cache-aside and finite TTL.
5. Update source first, then invalidate.
6. Add TTL jitter and stampede protection.
7. Define read-your-writes and stale behavior.
8. Protect origin during cache outage.
9. Treat cache data as disposable but secured.
10. Test races, eviction, failure, and deployment changes.
11. Measure end-user benefit and correctness.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the cache-aside pattern?

<!-- question:start:cache-aside-read-caching-and-invalidation-trade-offs-beginner-q01 -->
<!-- question-id:cache-aside-read-caching-and-invalidation-trade-offs-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

The application reads the cache first, loads the authoritative store on a miss, writes the result into the cache, and returns it. On update, it normally commits to the source and invalidates the cached entry. The cache is an optimization and can be rebuilt.

##### Key Points to Mention

- The database remains authoritative.
- Cache misses are expected.
- TTL bounds stale data and missed invalidations.
- The application owns population and invalidation.

<!-- question:end:cache-aside-read-caching-and-invalidation-trade-offs-beginner-q01 -->

#### Why is cache invalidation difficult?

<!-- question:start:cache-aside-read-caching-and-invalidation-trade-offs-beginner-q02 -->
<!-- question-id:cache-aside-read-caching-and-invalidation-trade-offs-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Readers, writers, multiple instances, and cache layers run concurrently. A reader can repopulate old data while a writer commits, invalidation can fail, and one update can affect many query keys. The system must define acceptable staleness and combine ordering, TTL, versions, or events accordingly.

##### Key Points to Mention

- Update the source before deleting the cache entry.
- TTL is a recovery bound, not immediate consistency.
- Query caches have many invalidation dependencies.
- Concurrency races remain even with explicit deletion.

<!-- question:end:cache-aside-read-caching-and-invalidation-trade-offs-beginner-q02 -->

#### What is the difference between local and distributed caching?

<!-- question:start:cache-aside-read-caching-and-invalidation-trade-offs-beginner-q03 -->
<!-- question-id:cache-aside-read-caching-and-invalidation-trade-offs-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A local cache is private to one process and has very low latency, but instances can hold different values and lose them on restart. A distributed cache is shared across instances and offers a common key space, but adds network latency, capacity planning, security, and another dependency.

##### Key Points to Mention

- Local caches complicate cross-instance invalidation.
- Distributed caches support horizontal scaling better.
- Both can evict entries at any time.
- Two-level caching increases invalidation complexity.

<!-- question:end:cache-aside-read-caching-and-invalidation-trade-offs-beginner-q03 -->

#### What is a cache stampede?

<!-- question:start:cache-aside-read-caching-and-invalidation-trade-offs-beginner-q04 -->
<!-- question-id:cache-aside-read-caching-and-invalidation-trade-offs-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A cache stampede occurs when many callers miss the same popular entry and simultaneously load it from the origin, often after expiration. It can overload the database. Mitigations include request coalescing, bounded locks, TTL jitter, early refresh, stale-while-revalidate, and origin concurrency limits.

##### Key Points to Mention

- Popular synchronized expirations are dangerous.
- Single flight may protect only one instance.
- Locks need timeout and failure behavior.
- Stale serving is safe only for suitable data.

<!-- question:end:cache-aside-read-caching-and-invalidation-trade-offs-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you choose a cache TTL?

<!-- question:start:cache-aside-read-caching-and-invalidation-trade-offs-intermediate-q01 -->
<!-- question-id:cache-aside-read-caching-and-invalidation-trade-offs-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Choose TTL from allowed staleness, update frequency, read volume, retrieval cost, memory budget, and invalidation reliability. Use shorter TTLs for volatile or sensitive data and longer TTLs for stable expensive data. Add jitter, and combine sliding expiration with an absolute maximum if active entries must not live indefinitely.

##### Key Points to Mention

- One global TTL rarely fits all data.
- Too short reduces hit rate and increases origin load.
- Too long increases stale-read risk.
- Measure actual age and hit behavior.

<!-- question:end:cache-aside-read-caching-and-invalidation-trade-offs-intermediate-q01 -->

#### How should writes interact with a cache-aside cache?

<!-- question:start:cache-aside-read-caching-and-invalidation-trade-offs-intermediate-q02 -->
<!-- question-id:cache-aside-read-caching-and-invalidation-trade-offs-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Commit the authoritative store first, then invalidate affected cache keys. If invalidation fails, retry or publish a reliable invalidation event, while TTL bounds the stale period. Return the committed write result for immediate feedback. Updating both cache and database independently risks divergent state.

##### Key Points to Mention

- Invalidating first permits old data to be repopulated.
- Identify entity and dependent query keys.
- Versioned keys can simplify broad invalidation.
- Define behavior for an invalidation outage.

<!-- question:end:cache-aside-read-caching-and-invalidation-trade-offs-intermediate-q02 -->

#### How would you protect the database during a cache outage?

<!-- question:start:cache-aside-read-caching-and-invalidation-trade-offs-intermediate-q03 -->
<!-- question-id:cache-aside-read-caching-and-invalidation-trade-offs-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use origin concurrency limits, rate limiting, circuit breakers, request coalescing, degraded responses, and gradual cache repopulation. Avoid every instance immediately forwarding full traffic to the database. Prewarm critical keys where justified and monitor database saturation and cache recovery.

##### Key Points to Mention

- Cache fallback can create a cascading failure.
- A cache may be operationally required even if logically optional.
- Bound refill concurrency.
- Serve stale values only within explicit safety limits.

<!-- question:end:cache-aside-read-caching-and-invalidation-trade-offs-intermediate-q03 -->

#### How do you prevent cross-tenant cache data leakage?

<!-- question:start:cache-aside-read-caching-and-invalidation-trade-offs-intermediate-q04 -->
<!-- question-id:cache-aside-read-caching-and-invalidation-trade-offs-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Include tenant, authorization scope, locale, version, and every response-varying parameter in the key. Authorize before lookup, avoid caching broad privileged responses for normal users, restrict cache administration, and test that two tenants requesting the same object ID cannot share an entry.

##### Key Points to Mention

- Object ID alone may not be globally authorization-safe.
- User-specific caching can create high cardinality.
- Never use untrusted key input without normalization and bounds.
- Cache poisoning is also a key-design problem.

<!-- question:end:cache-aside-read-caching-and-invalidation-trade-offs-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you handle a reader repopulating stale data after invalidation?

<!-- question:start:cache-aside-read-caching-and-invalidation-trade-offs-advanced-q01 -->
<!-- question-id:cache-aside-read-caching-and-invalidation-trade-offs-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Include the authoritative version in the cached value and use conditional writes, versioned keys, or an invalidation generation so an older read cannot replace a newer entry. A delayed second invalidation or change event can close residual windows. Select the mechanism according to the tolerated stale period and write frequency.

##### Key Points to Mention

- Update-then-delete alone still has a reader race.
- Compare source versions rather than timestamps where possible.
- Complex consistency mechanisms may outweigh caching benefit.
- TTL remains a final recovery bound.

<!-- question:end:cache-aside-read-caching-and-invalidation-trade-offs-advanced-q01 -->

#### How would you design stale-while-revalidate safely?

<!-- question:start:cache-aside-read-caching-and-invalidation-trade-offs-advanced-q02 -->
<!-- question-id:cache-aside-read-caching-and-invalidation-trade-offs-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Store fresh and maximum-stale deadlines. Return fresh data normally; within the stale window, return the cached value and allow one bounded background refresh; after the maximum age, block on the origin or fail. Do not use it for authorization, irreversible decisions, or data whose stale value could cause harm.

##### Key Points to Mention

- Coalesce refreshes across callers.
- Record value age and refresh failures.
- Preserve origin protection during prolonged failure.
- Communicate staleness when users act on the data.

<!-- question:end:cache-aside-read-caching-and-invalidation-trade-offs-advanced-q02 -->

#### How would you cache dynamic list and search queries?

<!-- question:start:cache-aside-read-caching-and-invalidation-trade-offs-advanced-q03 -->
<!-- question-id:cache-aside-read-caching-and-invalidation-trade-offs-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Normalize and bound query keys, include all filters and security dimensions, and prefer short TTLs or generation-based invalidation because one entity update can affect many results. For high-value cases, use materialized views or search indexes designed as projections. Avoid caching unbounded ad hoc queries with low reuse.

##### Key Points to Mention

- Query caches can explode key cardinality.
- Pagination and sort parameters change the result.
- Cache IDs separately when object entries have independent invalidation.
- Measure reuse before adding complexity.

<!-- question:end:cache-aside-read-caching-and-invalidation-trade-offs-advanced-q03 -->

#### How would you evaluate whether a cache is improving the system?

<!-- question:start:cache-aside-read-caching-and-invalidation-trade-offs-advanced-q04 -->
<!-- question-id:cache-aside-read-caching-and-invalidation-trade-offs-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Compare end-user latency, origin throughput and saturation, cache hit ratio by operation, miss-load cost, memory and network cost, stale-read incidents, and outage behavior. Load-test cold start, stampede, eviction, and cache failure. Remove or redesign caches whose lookup and invalidation complexity exceed their measured benefit.

##### Key Points to Mention

- Hit ratio alone is insufficient.
- Cold-cache behavior is part of capacity planning.
- Correctness and security incidents outweigh latency gains.
- Track cost and operational burden.

<!-- question:end:cache-aside-read-caching-and-invalidation-trade-offs-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
