---
id: azure-cache-for-redis-low-latency-reads-and-session-state-scenarios
topic: Azure data, storage, and caching services
subtopic: Azure Cache for Redis for low-latency reads and session/state scenarios
category: Azure
---

## Overview

Redis is an in-memory data platform designed for very low-latency access to data organized by keys. It supports strings, hashes, lists, sets, sorted sets, streams, and other specialized structures. Applications commonly use Redis to reduce repeated work, share short-lived state across stateless application instances, coordinate distributed operations, and implement high-throughput counters or leaderboards.

Azure currently has two relevant managed Redis product names:

- **Azure Cache for Redis:** The older managed service. All tiers have announced retirement dates. Enterprise and Enterprise Flash retire on March 31, 2027. Basic, Standard, and Premium retire on September 30, 2028.
- **Azure Managed Redis:** The current managed Redis offering and the recommended destination for new solutions and migrations.

Interview discussions and existing codebases still frequently use the name Azure Cache for Redis. A current answer should acknowledge the retirement and explain the architecture using Azure Managed Redis unless the question explicitly concerns a legacy deployment.

Common scenarios include:

- Cache-aside for frequently read database records.
- Shared ASP.NET Core session state.
- Short-lived shopping-cart or workflow state.
- Response and rendered-content caching.
- Distributed counters and rate-limit state.
- Leaderboards with sorted sets.
- Deduplication and idempotency records.
- Distributed locks with careful correctness constraints.
- Streams, queues, or pub/sub for suitable transient messaging.

Redis is not automatically a durable system of record. Memory pressure can evict keys, expiration can remove data, failover can lose recently replicated writes, and operators can flush or replace an instance. Data persistence and active geo-replication improve resilience but do not turn every Redis design into a relational database.

For interviews, candidates should be able to:

- Explain cache-aside and cache invalidation.
- Select expiration and eviction strategies.
- Design distributed session state without sticky sessions.
- Handle cache failures without causing a database outage.
- Distinguish high availability, persistence, and geo-replication.
- Size memory, throughput, network bandwidth, and client connections.
- Explain clustering and Redis hash-slot limitations.
- Secure the service with Microsoft Entra ID, private networking, TLS, and least privilege.
- Discuss the Azure Cache for Redis retirement and migration implications.

## Core Concepts

### Product Direction and Retirement

Azure Cache for Redis remains operational during its retirement period, but it should not be treated as the strategic default.

The announced retirement dates are:

- Azure Cache for Redis Enterprise and Enterprise Flash: March 31, 2027.
- Azure Cache for Redis Basic, Standard, and Premium: September 30, 2028.

Existing customers should plan migration before those deadlines. New designs should normally evaluate Azure Managed Redis first.

Migration considerations include:

- New hostname and authentication configuration.
- Client compatibility with clustering.
- Multi-key commands and hash slots.
- Memory and performance sizing.
- Persistence and availability settings.
- Network and private endpoint changes.
- Cutover and rollback strategy.
- Whether cached data can be rebuilt or must be migrated.

A disposable cache can often be migrated by creating the new instance, warming it, changing application configuration, and allowing the old cache to expire. Session state, queues, idempotency records, and other stateful uses require a more deliberate continuity plan.

### Azure Managed Redis

Azure Managed Redis is based on Redis Enterprise and supports Redis-compatible clients and data structures. It offers managed:

- Provisioning and patching.
- Replication and failover.
- Clustering.
- Scaling.
- Private networking.
- Microsoft Entra ID authentication.
- Persistence.
- Active geo-replication in supported tiers.
- Redis modules for JSON, search, probabilistic structures, and time series.

Its tiers are organized by memory and compute characteristics:

- **Memory Optimized:** Higher memory-to-vCPU ratio for memory-heavy workloads that do not need maximum throughput.
- **Balanced:** General-purpose balance between memory and compute.
- **Compute Optimized:** More compute per unit of memory for throughput-intensive workloads.
- **Flash Optimized:** Uses RAM and NVMe storage to reduce cost for very large datasets at the expense of some latency and throughput.

Tier and size selection should use workload tests. Dataset size alone is insufficient because bandwidth, commands per second, value size, CPU cost, shard distribution, and connection count can become bottlenecks first.

### Redis Data Structures

Choosing the correct Redis data structure affects both clarity and performance:

- **String:** Serialized objects, flags, counters, tokens, or simple values.
- **Hash:** Multiple fields associated with one logical object.
- **List:** Ordered values and simple queue-like operations.
- **Set:** Unique unordered members and membership tests.
- **Sorted set:** Unique members ordered by score, useful for leaderboards and scheduling.
- **Stream:** Append-only event records with consumer groups.
- **Bitmap and probabilistic structures:** Compact flags, cardinality estimates, and deduplication.

Avoid storing one large serialized object when the application frequently updates only a small field. Conversely, splitting a small object into too many keys increases round trips and key-management complexity.

### Cache-Aside Pattern

Cache-aside is the most common caching pattern:

1. The application reads the cache.
2. On a cache hit, it returns the cached value.
3. On a cache miss, it reads the authoritative data store.
4. It writes the value to Redis with an expiration.
5. It returns the value.

When updating data:

1. Update the authoritative store.
2. Invalidate the corresponding cache key.

The order matters. Deleting the cache key before committing the database update creates a window in which another request can miss the cache, read the old database value, and repopulate stale data.

A simplified .NET example:

```csharp
public async Task<Product?> GetProductAsync(
    int id,
    IDatabase cache,
    CancellationToken cancellationToken)
{
    var key = $"product:v3:{id}";
    var cached = await cache.StringGetAsync(key);

    if (cached.HasValue)
    {
        return JsonSerializer.Deserialize<Product>(cached!);
    }

    var product = await repository.GetProductAsync(id, cancellationToken);
    if (product is null)
    {
        return null;
    }

    await cache.StringSetAsync(
        key,
        JsonSerializer.Serialize(product),
        TimeSpan.FromMinutes(10));

    return product;
}
```

Production code also needs timeout handling, metrics, stampede protection, serializer compatibility, and a decision about how to behave when Redis is unavailable.

### Cache Keys

Keys should be predictable, namespaced, and versioned:

```text
environment:service:entity:version:id
prod:catalog:product:v3:4182
prod:identity:session:v2:8f31...
```

Good key design supports:

- Environment separation.
- Service ownership.
- Schema changes.
- Targeted invalidation.
- Human diagnosis.
- Cluster hash-slot control where needed.

Avoid:

- Raw personally identifiable information in keys.
- Unbounded user-provided key components.
- Global scans such as `KEYS *` in production.
- Ambiguous keys shared by unrelated services.
- Reusing a key after changing the serialized value contract.

Key versioning is often simpler and safer than deleting every old key during deployment. Old versions expire naturally.

### Expiration and Time to Live

Expiration limits staleness and memory use. Common approaches include:

- **Absolute expiration:** Key expires after a fixed duration.
- **Sliding expiration:** Lifetime extends when accessed.
- **No expiration:** Key remains until explicitly deleted or evicted.

TTL should reflect:

- How quickly the source data changes.
- How much staleness is acceptable.
- Cost of rebuilding the value.
- Consequences of a cache miss.
- Available memory.

A short TTL improves freshness but increases source-store load. A long TTL improves hit rate but can return stale data longer.

Add random jitter to TTL values for large sets of similar keys:

```csharp
var ttl = TimeSpan.FromMinutes(10)
          + TimeSpan.FromSeconds(Random.Shared.Next(0, 90));
```

Jitter prevents thousands of keys from expiring at the same instant.

### Eviction

Redis has finite memory. When the configured memory limit is reached, the eviction policy determines what happens.

Typical policy families include:

- Evict least-recently-used keys with expiration.
- Evict least-recently-used keys from all keys.
- Evict least-frequently-used keys.
- Evict keys with the nearest expiration.
- Remove random keys.
- Reject writes instead of evicting.

The right policy depends on whether all keys are disposable:

- A pure read cache can often use an all-keys eviction policy.
- A mixed cache containing sessions or coordination records needs more care.
- A state store that cannot tolerate eviction should not share an instance with disposable cache entries under an eviction policy.

Separate workloads into different Redis instances when their durability, eviction, security, or scaling requirements conflict.

### Cache Hits, Misses, and Effectiveness

The cache hit ratio is:

```text
hits / (hits + misses)
```

A low hit ratio can mean:

- TTL is too short.
- Memory is too small.
- The workload has low reuse.
- Keys are inconsistent.
- Data is being evicted.
- Deployments are changing key versions frequently.
- Requests are spread across high-cardinality values.

A high hit ratio is not sufficient by itself. Measure:

- P50, P95, and P99 latency.
- Database load reduction.
- Redis CPU and server load.
- Network bandwidth.
- Memory fragmentation.
- Evictions and expirations.
- Timeouts and reconnects.
- Per-shard distribution.

Do not keep a cache that adds cost and complexity without improving an end-to-end service objective.

### Cache Stampede

A cache stampede occurs when many requests miss the same popular key and all query the source simultaneously.

Mitigation options include:

- Per-key distributed locking.
- Single-flight request coalescing inside each application instance.
- Serving a stale value while one worker refreshes.
- Proactive refresh before expiration.
- TTL jitter.
- Request rate limits.
- Prewarming high-value keys.

A simple distributed lock needs:

- A unique owner token.
- Atomic acquire with expiration.
- Safe release only by the owner.
- A bounded wait.
- Handling for work that outlives the lock lease.

Distributed locks are not a substitute for database constraints or idempotency when correctness is critical.

### Negative Caching

Negative caching stores the fact that an item was not found. It reduces repeated source queries for missing keys.

Use a short TTL because:

- The item might be created soon.
- Authorization results can change.
- Long negative caching can hide newly available data.

Use a distinct marker rather than serializing `null` ambiguously.

### Sessions in Distributed Applications

In-memory session state inside one web server is lost when:

- The process restarts.
- A deployment replaces the instance.
- Autoscaling routes the next request to another instance.

A distributed Redis session store allows any application instance to load the same session by an opaque session identifier held in a secure cookie.

Benefits include:

- Stateless application instances.
- Horizontal scaling without sticky sessions.
- Rolling deployments.
- Centralized session expiration.

Risks include:

- Redis becomes a request-path dependency.
- Cache latency affects every session-enabled request.
- Eviction can log users out or lose workflow state.
- Large sessions increase memory and network cost.
- Active-active multi-region session consistency is difficult.

Keep sessions small and avoid storing the complete user profile, authorization policy, or large shopping carts when an authoritative database is more appropriate.

### ASP.NET Core Distributed Session

ASP.NET Core session state can use a distributed cache provider. A typical design registers Redis and session middleware:

```csharp
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = redisConfiguration;
    options.InstanceName = "checkout:";
});

builder.Services.AddSession(options =>
{
    options.Cookie.Name = "__Host-checkout-session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.IdleTimeout = TimeSpan.FromMinutes(20);
});

var app = builder.Build();

app.UseSession();
```

Production authentication should prefer Microsoft Entra ID and managed identity where supported rather than embedding long-lived access keys. The exact client integration depends on the Redis client and Azure identity package versions.

The session cookie should contain only an opaque identifier. Configure secure cookie attributes and regenerate authentication-related identifiers after privilege changes.

### Session State Versus Authentication

Authentication should not rely solely on a Redis session record unless the complete failure and recovery model is understood.

Common patterns are:

- A self-contained signed authentication cookie or token proves identity.
- Redis stores optional application session state.
- Server-side authorization still checks current permissions for sensitive actions.

If Redis fails:

- A cache-only feature might degrade gracefully.
- A lost application session might force reauthentication.
- A security-critical server-side session might require fail-closed behavior.

Define the expected behavior explicitly. "Redis unavailable" should not accidentally bypass security checks.

### Shopping Carts and Workflow State

Redis can provide fast temporary shopping-cart or wizard state, but ask whether losing it is acceptable.

If cart loss creates significant business impact:

- Persist the cart in a durable store.
- Use Redis as a fast projection or write-through layer.
- Reconcile Redis with the durable record.

For short anonymous carts, Redis with TTL may be acceptable. For submitted orders, payments, reservations, or legal records, use an authoritative transactional store.

### Redis Is Usually Not the Source of Truth

For cache-aside, the source of truth is a database or durable object store. Redis contains a disposable copy.

This design permits:

- Eviction.
- Cache flush.
- Instance replacement.
- Rebuilding after outage.
- Short periods of staleness.

Some Redis workloads can use persistence and Redis as a primary data platform, but that choice requires explicit analysis of:

- Durability guarantees.
- Replication lag.
- Restore behavior.
- Transaction semantics.
- Query and indexing requirements.
- Backup retention.
- Regional recovery.
- Team operational maturity.

Do not gradually turn a cache into the only copy of business-critical data without revisiting the architecture.

### High Availability

With high availability enabled, Azure Managed Redis distributes primary and replica shards across at least two nodes. Supported regions distribute nodes across availability zones by default.

High availability improves endpoint availability during:

- Node failure.
- Maintenance.
- Some scaling operations.
- Service-managed failover.

It does not guarantee zero data loss. Replication can be asynchronous, and recent writes can be absent after failover.

Non-HA mode lowers cost but lacks the availability SLA and can cause downtime and data loss. It is suitable only for development and test workloads.

### Data Persistence

Persistence stores a disk copy that can help recover data after an unexpected outage.

Persistence is relevant when rebuilding Redis data is difficult or time-sensitive. It does not remove the need to understand:

- Snapshot or append behavior.
- Recovery point.
- Recovery time.
- Storage and performance cost.
- Replication lag.
- Application behavior while recovery occurs.

For a disposable cache, persistence can add unnecessary cost. For session state, queues, or expensive derived state, it may reduce impact but still does not guarantee that every acknowledged write survives every failure.

### Flash Optimized Tier

Flash Optimized stores keys in RAM while values can reside in RAM or NVMe flash. It targets large datasets with a hot subset.

It is a good fit for:

- Read-heavy workloads.
- Values much larger than keys.
- Access concentrated on a subset of the dataset.
- Cost-sensitive large caches.

It is a poor fit for:

- Write-heavy workloads.
- Uniform random access across the whole dataset.
- Long keys with small values.
- Workloads requiring the lowest consistent latency.

Test with a nearly full production-sized dataset. A lightly loaded Flash instance can appear faster because most values still fit in RAM.

### Clustering and Sharding

Azure Managed Redis uses an internally clustered architecture. The clustering policy determines client behavior.

The OSS clustering policy generally provides high throughput and low latency by allowing cluster-aware clients to connect to shards. Keys are assigned to hash slots.

Multi-key commands can fail with `CROSSSLOT` when keys belong to different slots. Hash tags force related keys into the same slot:

```text
cart:{customer-42}:items
cart:{customer-42}:totals
```

The value inside braces determines the slot. Use hash tags only for keys that genuinely need atomic multi-key operations because concentrating too much traffic in one slot creates a hot shard.

Enterprise and nonclustered policies can improve compatibility for some workloads but have performance, module, command, or size trade-offs. Test the actual client and command set before migration.

### Scaling

Scaling can increase:

- Memory.
- vCPUs.
- Network bandwidth.
- Client connections.
- Number of shards.

Choose a scale action based on the bottleneck:

- High memory and evictions: increase memory or improve TTL and value size.
- High server load: use more compute or shards.
- Network saturation: select a larger or more performance-focused tier.
- Hot shard: redesign key distribution.
- Too many connections: reuse clients and inspect connection pools before scaling.

Scaling down has current limitations in Azure Managed Redis. Avoid treating rapid scale-down as a guaranteed cost-control mechanism.

### Client Connection Management

Redis clients should reuse long-lived connections. In .NET, `ConnectionMultiplexer` is designed to be shared and reused rather than created per request.

Creating a connection per operation causes:

- TLS and authentication overhead.
- Connection storms.
- Port exhaustion.
- Increased latency.
- Pressure on client limits.

Client configuration should include:

- Appropriate connection and operation timeouts.
- Reconnect behavior.
- TLS.
- Cluster support.
- Bounded retries.
- Logging that does not expose secrets.

Do not use unbounded retries. When Redis is overloaded, aggressive retries increase load and extend the outage.

### Timeouts and Large Values

Redis is fast, but it is not immune to timeouts. Causes include:

- Network saturation.
- CPU-heavy commands.
- Large keys or values.
- Too many client connections.
- Thread-pool starvation in the application.
- Hot shards.
- Failover or scaling.
- Blocking commands.

Keep values reasonably small. Large payloads increase:

- Serialization cost.
- Memory use.
- Network time.
- Failover and replication work.
- Tail latency.

Measure serialized size, not only in-memory object size.

### Graceful Degradation

A cache should not automatically become a single point of failure for the authoritative application.

For a read cache:

1. Attempt Redis with a short timeout.
2. On failure, read from the authoritative store.
3. Avoid writing back if Redis is unhealthy.
4. Apply circuit breaking or temporary cache bypass.
5. Protect the source with rate limits, request coalescing, and load shedding.

Fallback creates a new risk: a Redis outage can send the full traffic load to the database. Capacity plans and chaos tests must cover that scenario.

For session state, fallback may not be possible. Decide whether to:

- Fail the request.
- Force reauthentication.
- Serve only stateless pages.
- Use a durable session fallback.

### Security

A secure design should normally use:

- Microsoft Entra ID authentication and managed identity where supported.
- TLS.
- Private endpoints.
- Disabled or restricted public network access.
- Least-privilege role assignments.
- Secret rotation for any temporary access keys.
- Separate instances for different trust boundaries.
- Connection auditing and Azure Monitor diagnostics.

Do not store:

- Passwords.
- Long-lived tokens.
- Raw payment data.
- Sensitive personal information without a clear encryption, retention, and access design.

Redis keys, values, logs, and diagnostic tooling all require data-classification review.

### Multi-Region Design

Active geo-replication can replicate Redis data across regions for supported tiers and configurations. It is useful for globally distributed reads and regional continuity.

Trade-offs include:

- Eventual convergence.
- Conflict behavior.
- Command restrictions.
- Cross-region data transfer.
- More complex session semantics.
- Need for region-aware application routing.

A global shopping cart or session can receive concurrent updates in two regions. The business must define acceptable merge and conflict behavior. For strict order or payment consistency, use a durable transactional system of record.

### Monitoring

Monitor:

- Cache hits and misses.
- Hit ratio.
- Memory usage.
- Evictions and expirations.
- Server load.
- Operations per second.
- Network bandwidth.
- Connected clients.
- Timeouts and errors.
- Per-shard metrics.
- Replication and failover.
- Persistence health.
- Connection audit logs.

Alerts should focus on customer impact and early saturation:

- Rising P99 latency.
- Sustained memory pressure.
- Unexpected evictions.
- High server load.
- Network bandwidth near limits.
- Connection count growth.
- Hit ratio decline.
- Database load increase during cache failures.

### Common Mistakes

Common mistakes include:

- Starting a new deployment on a retiring Azure Cache for Redis tier.
- Treating Redis as a guaranteed durable system of record.
- Creating one Redis connection per request.
- Storing very large values.
- Using no TTL for disposable cache entries.
- Giving sessions and disposable cache entries the same eviction behavior.
- Using sticky sessions instead of distributed state.
- Invalidating before committing the database update.
- Allowing a cache outage to overwhelm the source database.
- Running expensive key scans in production.
- Ignoring `CROSSSLOT` behavior during migration.
- Using broad public access and long-lived keys instead of private networking and identity.

### Best-Practice Design Checklist

A production design should normally:

- Use Azure Managed Redis for new Azure deployments.
- Classify each key as disposable cache, session, coordination, or durable state.
- Keep an authoritative data source for business-critical records.
- Namespace and version keys.
- Set TTLs with jitter.
- Select an eviction policy that matches the workload.
- Separate workloads with conflicting eviction or security needs.
- Reuse cluster-aware client connections.
- Protect against cache stampedes.
- Design bounded fallback and source-store protection.
- Enable HA for production.
- Evaluate persistence only when recovery needs justify it.
- Use managed identity, private endpoints, and TLS.
- Load-test memory, throughput, bandwidth, failover, and shard distribution.
- Monitor both cache health and downstream database impact.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is Redis used for in an Azure application?

<!-- question:start:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-beginner-q01 -->
<!-- question-id:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Redis is an in-memory key-value data platform used for low-latency reads, distributed cache entries, shared sessions, counters, leaderboards, deduplication records, and other short-lived state. It reduces repeated database or computation work and allows stateless application instances to share data.

For new Azure deployments, Azure Managed Redis is the current offering. Azure Cache for Redis is retiring, although its name remains common in existing systems and interview questions.

##### Key Points to Mention

- Redis keeps frequently accessed data in memory.
- Common uses include caching and distributed sessions.
- It supports specialized structures beyond simple strings.
- Azure Managed Redis is the current strategic service.

<!-- question:end:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-beginner-q01 -->

#### How does the cache-aside pattern work?

<!-- question:start:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-beginner-q02 -->
<!-- question-id:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

The application first checks Redis. If the value exists, it returns the cached value. On a miss, it reads the authoritative data store, writes the result into Redis with an expiration, and returns it.

For updates, the application commits the source-of-truth change first and then invalidates the cache key. A later read repopulates the cache. This pattern improves repeated read performance but allows temporary staleness and requires careful invalidation.

##### Key Points to Mention

- The application controls loading and invalidation.
- Cache misses read from the authoritative store.
- Updates should commit before invalidating.
- TTL limits staleness and memory use.

<!-- question:end:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-beginner-q02 -->

#### Why use Redis for ASP.NET Core session state?

<!-- question:start:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-beginner-q03 -->
<!-- question-id:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Local in-memory session state belongs to one process and is lost during restart or when a request moves to another scaled-out instance. Redis provides a shared session store that every application instance can access using an opaque session ID from a secure cookie.

This removes the need for sticky sessions and supports horizontal scaling and rolling deployments. Redis becomes a request-path dependency, so availability, eviction, session size, expiration, and failure behavior must be designed explicitly.

##### Key Points to Mention

- Distributed session works across application instances.
- It supports stateless scaling without affinity.
- Keep session payloads small.
- Cache failure can cause session loss or request failure.

<!-- question:end:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-beginner-q03 -->

#### What is the difference between expiration and eviction?

<!-- question:start:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-beginner-q04 -->
<!-- question-id:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Expiration removes a key when its configured TTL ends. Eviction removes keys because the instance has reached its memory limit and needs space according to the configured eviction policy.

A key can be evicted before its TTL. Therefore, Redis data that must never disappear should not depend only on a long expiration. The workload needs sufficient capacity, an appropriate eviction policy, separation from disposable cache entries, or a durable source of truth.

##### Key Points to Mention

- TTL controls time-based expiration.
- Eviction responds to memory pressure.
- Long TTL does not guarantee retention.
- Eviction policy must match the value of stored data.

<!-- question:end:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you prevent a cache stampede on a popular key?

<!-- question:start:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-intermediate-q01 -->
<!-- question-id:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use TTL jitter so related keys do not expire simultaneously. When one popular key misses, coalesce concurrent requests so only one caller loads the source. A distributed per-key lock, stale-while-revalidate strategy, or proactive refresh can coordinate refresh across instances.

The lock must have an owner token, lease timeout, bounded wait, and safe release. The source database still needs rate limiting and capacity protection because lock or Redis failures can bypass the coordination.

##### Key Points to Mention

- Add randomized TTL jitter.
- Allow one refresh while others wait or use stale data.
- Distributed locks need safe ownership and expiration.
- Protect the source even when coordination fails.

<!-- question:end:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-intermediate-q01 -->

#### How should a .NET application manage Redis connections?

<!-- question:start:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-intermediate-q02 -->
<!-- question-id:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Reuse a long-lived, thread-safe `ConnectionMultiplexer` rather than creating a connection for every operation or request. Configure TLS, cluster support, bounded timeouts, reconnect behavior, and controlled retries.

Per-request connections cause handshake overhead, connection storms, port exhaustion, and client-limit pressure. Monitor client connections, thread-pool behavior, timeouts, and network bandwidth before assuming the Redis server is the only bottleneck.

##### Key Points to Mention

- Share and reuse `ConnectionMultiplexer`.
- Avoid connection creation in request handlers.
- Use bounded timeout and retry settings.
- Diagnose both client and server metrics.

<!-- question:end:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-intermediate-q02 -->

#### How should an application behave when Redis is unavailable?

<!-- question:start:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-intermediate-q03 -->
<!-- question-id:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Behavior depends on the data type. A disposable read cache can fail open to the authoritative store using short Redis timeouts, circuit breaking, and temporary cache bypass. The database must be protected with load shedding, request coalescing, and capacity planning because all traffic can shift to it.

Session or security state may need to fail closed, force reauthentication, or offer limited stateless functionality. The team should not apply one generic fallback to every Redis use case.

##### Key Points to Mention

- Classify the Redis dependency before choosing fallback.
- Cache fallback can overload the source database.
- Use bounded retries and circuit breaking.
- Security-critical state must not bypass checks during failure.

<!-- question:end:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-intermediate-q03 -->

#### What changes should be considered when migrating to Azure Managed Redis?

<!-- question:start:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-intermediate-q04 -->
<!-- question-id:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Update the endpoint and authentication configuration, preferably using Microsoft Entra ID and private networking. Test the client against Azure Managed Redis clustering because multi-key commands can produce `CROSSSLOT` errors when keys map to different hash slots.

Benchmark memory, throughput, bandwidth, latency, and connection limits. Recreate monitoring, persistence, availability, and geo-replication settings. Choose a cutover strategy based on whether values are disposable cache entries or state that must be preserved, and maintain a tested rollback path.

##### Key Points to Mention

- Azure Cache for Redis has announced retirement dates.
- Endpoint, identity, and networking change.
- Cluster compatibility and hash-slot behavior require testing.
- Stateful uses need a stronger continuity plan than disposable caches.

<!-- question:end:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### Design Redis caching for a read-heavy product catalog without making the database fail during a cache outage.

<!-- question:start:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-advanced-q01 -->
<!-- question-id:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use cache-aside with versioned product keys, TTLs based on acceptable staleness, and random jitter. Invalidate after committing catalog changes. Coalesce misses for popular products, optionally serve slightly stale values during refresh, and prewarm known high-traffic items.

Use short Redis timeouts and a circuit breaker. When bypassing Redis, rate-limit or shed noncritical traffic, coalesce database reads, and ensure the database has tested headroom for the expected fallback rate. Monitor cache hit ratio alongside database query rate and latency.

Deploy Azure Managed Redis with HA, private endpoints, managed identity where supported by the client path, and enough memory and bandwidth. Load-test cold cache, mass expiration, Redis failover, and complete cache unavailability.

##### Key Points to Mention

- Cache-aside needs invalidation, TTL, jitter, and stampede protection.
- Fallback capacity must be tested at the source database.
- Circuit breaking prevents repeated cache timeout cost.
- Test cold-start and cache-loss scenarios, not only steady state.

<!-- question:end:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-advanced-q01 -->

#### When is Redis an inappropriate system of record?

<!-- question:start:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-advanced-q02 -->
<!-- question-id:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Redis is inappropriate as the only copy when the workload requires strict multi-entity transactions, complex relational constraints, durable audit history, arbitrary querying, guaranteed retention, or recovery semantics that the chosen Redis configuration cannot provide.

HA, persistence, and geo-replication improve resilience but can still involve asynchronous replication, failover loss, command restrictions, and operational recovery. Orders, payments, financial ledgers, and legal records usually belong in a durable transactional or immutable store, with Redis used as a cache or derived view.

##### Key Points to Mention

- In-memory speed does not imply database durability.
- Persistence and HA solve different failure modes.
- Business records often require stronger transactions and recovery.
- Redis is valuable as a derived, rebuildable acceleration layer.

<!-- question:end:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-advanced-q02 -->

#### How do clustering and Redis hash slots affect key design?

<!-- question:start:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-advanced-q03 -->
<!-- question-id:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Clustered Redis distributes keys across hash slots and shards. Commands involving several keys generally require those keys to be in the same slot, depending on the cluster policy and command. Otherwise, the client can receive a `CROSSSLOT` error.

Use a common hash tag inside braces for a small set of keys that require atomic multi-key operations, such as `cart:{42}:items` and `cart:{42}:totals`. Do not use one global hash tag because it sends all traffic to one shard and defeats horizontal scale. Test scripts, transactions, modules, and client redirection behavior before migration.

##### Key Points to Mention

- Sharding increases throughput by distributing keys.
- Multi-key commands can require one hash slot.
- Hash tags colocate related keys.
- Poor hash-tag design creates hot shards.

<!-- question:end:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-advanced-q03 -->

#### How would you design multi-region session state?

<!-- question:start:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-advanced-q04 -->
<!-- question-id:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

First minimize server-side session state and keep authentication portable across regions using appropriately signed tokens or cookies. Decide whether a user's requests remain region-affine or can move between active regions.

For region affinity, keep a session in the local Redis instance and route the user consistently, with reauthentication or session recreation after regional failover. For globally shared sessions, active geo-replication can help, but the design must tolerate eventual consistency and concurrent updates.

Do not place order submission, payment state, or other strict business transactions only in the session. Store those records durably and treat Redis session data as a convenience layer. Test regional failover, stale session reads, conflicts, cookie validity, and identity behavior.

##### Key Points to Mention

- Reduce session state before replicating it globally.
- Region affinity simplifies consistency.
- Active-active session updates can conflict.
- Durable business state must live outside the session store.

<!-- question:end:azure-cache-for-redis-low-latency-reads-and-session-state-scenarios-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
