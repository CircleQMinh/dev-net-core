---
id: capacity-planning-and-identifying-likely-bottlenecks
topic: Requirements decomposition and system trade-offs
subtopic: Capacity Planning and Identifying Likely Bottlenecks
category: Design & Architecture
---



## Overview

Capacity planning is the process of estimating the resources a system needs to meet expected demand while satisfying performance, reliability, and cost targets. It helps answer questions such as:

- How many users can the system support?
- How many requests per second should the API handle?
- How much CPU, memory, storage, network bandwidth, and database capacity are needed?
- What happens during a traffic spike?
- Which component is likely to become the bottleneck first?
- When should the system scale up, scale out, cache, partition, queue, or redesign?
- How much capacity is enough without wasting money?

Identifying bottlenecks means finding the component or resource that limits overall system throughput, latency, availability, or growth. A bottleneck can be a database, CPU, memory, network bandwidth, disk I/O, connection pool, thread pool, lock, external API, queue consumer, cache, storage account, file system, rate limit, or even a manual operational process.

Capacity planning matters because a system can be functionally correct but still fail when real traffic arrives. A login API may work perfectly for 10 users but fail when 10,000 users sign in at 9:00 AM. A checkout service may pass all unit tests but slow down because the database cannot handle concurrent writes. A reporting worker may work in development but fall behind when thousands of report jobs are queued.

Capacity planning is used in:

- System design interviews.
- Cloud architecture.
- Web API design.
- Database design.
- Microservices and distributed systems.
- E-commerce platforms.
- SaaS applications.
- Background job processing.
- Data pipelines.
- File upload/download systems.
- Real-time messaging systems.
- Incident prevention.
- Cost optimization.
- Launch readiness.
- Seasonal traffic planning.
- Disaster recovery planning.

This topic is important for interviews because capacity planning shows whether a candidate can think beyond features. Interviewers expect candidates to reason about scale, traffic patterns, latency, throughput, storage growth, bottlenecks, trade-offs, and observability. A strong candidate should be able to make rough estimates, identify likely bottlenecks, propose mitigation strategies, and explain how to validate assumptions with testing and monitoring.

A strong interview answer does not need perfect math. It needs a structured approach:

1. Clarify requirements and traffic assumptions.
2. Estimate demand.
3. Translate demand into resource needs.
4. Identify likely bottlenecks.
5. Propose scaling and optimization strategies.
6. Validate with load tests and production monitoring.
7. Revisit the plan as traffic and architecture change.

Capacity planning is not a one-time spreadsheet. It is an ongoing process. Assumptions change, usage patterns change, features change, user behavior changes, dependencies change, and cloud limits change. Good systems are designed so capacity can be measured, adjusted, and improved continuously.

## Core Concepts

### What Capacity Planning Means

Capacity planning means predicting how much capacity a workload needs to meet its performance and reliability goals.

Capacity can include:

- Compute capacity.
- CPU cores.
- Memory.
- Thread pool capacity.
- Database CPU.
- Database connections.
- Database IOPS.
- Storage capacity.
- Storage throughput.
- Network bandwidth.
- Cache memory.
- Queue throughput.
- Background worker concurrency.
- External API rate limits.
- Message broker partitions.
- CDN capacity.
- Human operational capacity.

A simple definition:

```text
Capacity planning = expected demand + performance target + resource model + safety margin + validation.
```

Example:

```text
Requirement:
The order API must handle 2,000 requests per second at p95 latency under 500 ms.

Capacity planning questions:
- How much CPU is needed per request?
- How many app instances are needed?
- How many database writes per second are required?
- How many database connections are needed?
- What is the peak-to-average traffic ratio?
- What happens if one instance fails?
- How much spare capacity is required?
- Which resource saturates first?
```

The goal is not only to avoid underprovisioning. It is also to avoid overprovisioning. Too little capacity causes latency, errors, outages, and failed launches. Too much capacity increases cloud cost and operational waste.

### What a Bottleneck Is

A bottleneck is the limiting component that restricts system performance or scalability.

Example:

```text
The API servers can handle 10,000 requests per second.
The database can handle 2,000 writes per second.
The system performs one database write per request.

Likely bottleneck:
The database write capacity.
```

A bottleneck can appear in different forms:

| Bottleneck Type | Example |
|---|---|
| CPU | Application instances reach 95% CPU |
| Memory | Garbage collection increases latency |
| Disk I/O | Database writes wait on storage |
| Network | Large file downloads saturate bandwidth |
| Database locks | Concurrent updates block each other |
| Connection pool | Requests wait for database connections |
| Thread pool | Blocking calls consume worker threads |
| External API | Payment provider allows only 100 RPS |
| Queue consumers | Messages arrive faster than workers process them |
| Cache | Cache memory limit causes evictions |
| Rate limit | Cloud service throttles requests |
| Serialization | Large JSON payloads consume CPU |
| Hot partition | One tenant or key receives most traffic |
| Manual process | Human approval cannot keep up with volume |

A bottleneck is not always bad. Every system has a limiting factor. The problem is when the bottleneck prevents the system from meeting requirements or causes unacceptable cost, latency, or failure risk.

### Capacity Planning vs Performance Optimization

Capacity planning and performance optimization are related but different.

| Concept | Focus | Example |
|---|---|---|
| Capacity planning | How much resource is needed for expected demand | Need 6 API instances for launch traffic |
| Performance optimization | Make the system use resources more efficiently | Reduce database query from 500 ms to 50 ms |
| Scalability planning | How the system grows as demand increases | Add instances, shard database, partition queue |
| Bottleneck analysis | Find what limits performance | Database CPU reaches 90% before app CPU |
| Cost optimization | Meet demand at acceptable cost | Use autoscaling and reserved capacity |

Capacity planning asks:

```text
How much do we need?
```

Performance optimization asks:

```text
How can we do the same work with less time or fewer resources?
```

Both are needed. If a query is inefficient, simply adding more database capacity may be expensive and temporary. If a system is well optimized but traffic grows 20x, it still needs capacity planning.

### Capacity Planning Inputs

Good capacity planning starts with inputs.

Important inputs include:

- Number of users.
- Active users.
- Concurrent users.
- Requests per second.
- Reads per second.
- Writes per second.
- Peak traffic.
- Average traffic.
- Traffic growth rate.
- Data size.
- Data growth rate.
- Request payload size.
- Response payload size.
- File size.
- Job arrival rate.
- Job processing time.
- Latency targets.
- Throughput targets.
- Availability targets.
- Consistency requirements.
- Retention requirements.
- Backup requirements.
- External dependency limits.
- Cloud service quotas.
- Deployment topology.
- Regional requirements.
- Cost constraints.

Example input table:

```text
Registered users: 1,000,000
Daily active users: 100,000
Peak concurrent users: 10,000
Average API requests per active user per day: 50
Peak-to-average multiplier: 5x
Read/write ratio: 90/10
Average response size: 20 KB
Average request size: 2 KB
Target API p95 latency: 300 ms
Availability target: 99.9%
```

These inputs are rarely perfect. In interviews, make reasonable assumptions and state them clearly.

### Demand Forecasting

Demand forecasting estimates future workload.

Common demand signals:

- Historical traffic.
- Product launch estimates.
- Marketing campaign plans.
- Seasonal patterns.
- Business growth projections.
- Customer onboarding plans.
- Similar product benchmarks.
- Market research.
- Pilot data.
- Load test results.
- Sales forecasts.
- User behavior analytics.

Existing systems can use historical data. New systems often require assumptions, prototypes, market estimates, and stakeholder input.

Example:

```text
Current traffic:
500 RPS average
2,500 RPS peak

Expected campaign:
3x normal peak

Planned capacity target:
2,500 * 3 = 7,500 RPS

Add safety margin:
7,500 * 1.3 = 9,750 RPS
```

The safety margin protects against forecasting error, uneven traffic, node failures, and unexpected usage patterns.

### Peak vs Average Load

Average load can be misleading. Systems usually fail during peak load.

Example:

```text
Daily requests: 86,400,000
Seconds per day: 86,400

Average RPS:
86,400,000 / 86,400 = 1,000 RPS
```

But traffic may not be evenly distributed. If 40% of daily traffic occurs in a 2-hour window:

```text
Peak-window requests:
86,400,000 * 0.40 = 34,560,000

Peak-window seconds:
2 * 60 * 60 = 7,200

Peak-window average:
34,560,000 / 7,200 = 4,800 RPS
```

If there are minute-level bursts, actual peak may be even higher.

In interviews, always ask about:

- Daily traffic.
- Peak hour traffic.
- Peak minute traffic.
- Burst behavior.
- Seasonal events.
- Launch traffic.
- Regional traffic patterns.

Capacity should be planned for expected peak plus safety margin, not only daily average.

### Concurrency vs Throughput

Concurrency and throughput are related but not the same.

Throughput is work completed per unit of time.

```text
Requests per second
Messages per second
Transactions per second
Files per hour
Jobs per minute
```

Concurrency is how many operations are in progress at the same time.

```text
Concurrent users
Concurrent HTTP requests
Concurrent database queries
Concurrent file uploads
Concurrent background jobs
```

A useful relationship is:

```text
Concurrency ≈ Throughput × Average response time
```

Example:

```text
Throughput: 1,000 requests/second
Average response time: 200 ms = 0.2 seconds

Estimated concurrent in-flight requests:
1,000 * 0.2 = 200 concurrent requests
```

If response time increases to 2 seconds:

```text
1,000 * 2 = 2,000 concurrent requests
```

This shows why latency affects capacity. Slow dependencies increase concurrency, which increases memory, connection usage, thread pressure, and queue length.

### Little's Law

Little's Law is a useful mental model for capacity planning.

```text
L = λ × W
```

Where:

```text
L = average number of items in the system
λ = arrival rate
W = average time an item spends in the system
```

Example for a queue:

```text
Arrival rate: 100 jobs/second
Average processing time: 2 seconds

Average jobs in processing:
100 * 2 = 200 jobs
```

If processing time grows to 10 seconds:

```text
100 * 10 = 1,000 jobs
```

This means slow processing increases the number of in-flight jobs, which may require more memory, more workers, more queue capacity, or a redesign.

In interviews, Little's Law helps explain why improving latency can reduce required capacity.

### Basic Capacity Estimation Workflow

A practical capacity estimation workflow:

```text
1. Define target workload.
2. Estimate request rate and data volume.
3. Break requests into operations.
4. Estimate resource cost per operation.
5. Multiply by peak demand.
6. Add safety margin.
7. Identify the first limiting resource.
8. Propose mitigation.
9. Validate with load testing.
10. Monitor in production and adjust.
```

Example:

```text
Target:
5,000 peak RPS for product search.

Per request:
1 cache lookup
If cache miss: 1 search index query
Average response size: 30 KB
Cache hit rate: 90%

Estimated cache RPS:
5,000

Estimated search index RPS:
5,000 * 10% = 500

Estimated outbound bandwidth:
5,000 * 30 KB = 150,000 KB/s ≈ 150 MB/s
```

Likely bottlenecks:

```text
Cache throughput
Search index query latency
Network egress
API CPU for JSON serialization
```

This kind of rough math is often enough to guide system design discussions.

### Back-of-the-Envelope Estimation

Back-of-the-envelope estimation is a quick approximation used in system design.

Example: estimating storage for messages

```text
Users: 1,000,000
Daily active users: 200,000
Messages per active user per day: 20
Average message size: 1 KB
Metadata overhead: 1 KB

Daily messages:
200,000 * 20 = 4,000,000 messages/day

Average stored size per message:
1 KB + 1 KB = 2 KB

Daily storage:
4,000,000 * 2 KB = 8,000,000 KB ≈ 8 GB/day

Yearly storage:
8 GB * 365 ≈ 2.9 TB/year
```

Add replication, indexes, backups, and overhead:

```text
2.9 TB raw * 3 replication * 1.5 index/metadata overhead ≈ 13 TB/year
```

The exact number may be wrong, but the estimate reveals important design implications.

### Estimating API Capacity

Example: API instance capacity

```text
Load test result:
One API instance handles 500 RPS at p95 latency under 300 ms.

Target peak:
4,000 RPS

Base instance count:
4,000 / 500 = 8 instances

Add 30% safety margin:
8 * 1.3 = 10.4

Rounded:
11 instances

N+1 failure tolerance:
12 instances
```

This estimate assumes the bottleneck is API compute. If the database saturates at 2,000 RPS, adding more API instances will not solve the problem.

Always compare instance capacity with downstream capacity.

### Estimating Database Capacity

Database capacity often becomes the bottleneck because many API instances share one database.

Inputs:

```text
Peak API RPS: 3,000
Read/write ratio: 80/20
Queries per read request: 2
Queries per write request: 4
```

Estimate:

```text
Read requests:
3,000 * 80% = 2,400 RPS

Write requests:
3,000 * 20% = 600 RPS

Read queries:
2,400 * 2 = 4,800 queries/sec

Write queries:
600 * 4 = 2,400 queries/sec

Total database operations:
7,200 operations/sec
```

Likely database bottlenecks:

- CPU.
- IOPS.
- Lock contention.
- Slow queries.
- Missing indexes.
- Connection pool exhaustion.
- Transaction log throughput.
- Hot rows.
- Hot partitions.
- Replication lag.
- Storage size.
- Backup/restore time.

Mitigations:

- Add indexes.
- Optimize queries.
- Reduce round trips.
- Use caching.
- Use read replicas.
- Use CQRS/read models.
- Batch writes.
- Partition data.
- Shard by tenant or key.
- Move long-running work to queues.
- Denormalize carefully.
- Use a more suitable database type for the access pattern.

### Estimating Storage Capacity

Storage capacity planning includes more than raw data size.

Consider:

- Raw data.
- Indexes.
- Metadata.
- Replication.
- Backups.
- Logs.
- Audit trails.
- Soft deletes.
- Versioning.
- Temporary files.
- Retention period.
- Growth rate.
- Compression.
- Encryption overhead.
- Data lifecycle policies.

Example:

```text
Uploads per day: 50,000
Average file size: 5 MB
Metadata per file: 2 KB
Retention: 365 days

Daily file storage:
50,000 * 5 MB = 250,000 MB ≈ 250 GB/day

Yearly raw file storage:
250 GB * 365 = 91,250 GB ≈ 91 TB/year
```

With replication:

```text
91 TB * 3 copies = 273 TB physical storage equivalent
```

Design implications:

- Use object storage.
- Use lifecycle tiers.
- Add retention rules.
- Avoid storing large files in relational database rows.
- Plan backup and restore time.
- Monitor storage growth and cost.

### Estimating Network Bandwidth

Network can become a bottleneck for large responses, file downloads, video, images, or chat/media systems.

Example:

```text
Peak downloads: 2,000 downloads/second
Average file size: 2 MB

Bandwidth:
2,000 * 2 MB = 4,000 MB/s ≈ 4 GB/s
```

Design implications:

- Use CDN.
- Use object storage direct download.
- Use compression.
- Use pagination.
- Use response caching.
- Avoid returning huge JSON payloads.
- Use streaming.
- Use regional deployment.
- Consider egress cost.

For APIs:

```text
Peak RPS: 5,000
Average response size: 50 KB

Outbound bandwidth:
5,000 * 50 KB = 250,000 KB/s ≈ 250 MB/s
```

Large responses can saturate network and increase serialization CPU.

### Estimating Background Job Capacity

For background jobs, compare arrival rate with processing rate.

Example:

```text
Jobs arrive: 10,000 jobs/hour
Average processing time: 2 seconds/job
One worker processes:
3,600 seconds/hour / 2 = 1,800 jobs/hour

Workers needed:
10,000 / 1,800 = 5.56

Round up:
6 workers

Add safety margin:
8 workers
```

If each job calls an external API with a limit of 100 requests/second, the external API might become the bottleneck before worker CPU.

Important questions:

- How many jobs arrive per second?
- How long does each job take?
- Can jobs run concurrently?
- Are jobs CPU-bound or I/O-bound?
- Is processing idempotent?
- What is the retry policy?
- What is acceptable queue delay?
- What happens to poison messages?
- How large can the queue become?
- What is the worker scale-out strategy?

### Queue Capacity and Backlog

A queue absorbs spikes, but it does not remove work. If arrival rate exceeds processing rate for long enough, backlog grows.

Formula:

```text
Backlog growth rate = arrival rate - processing rate
```

Example:

```text
Arrival rate: 500 jobs/minute
Processing rate: 300 jobs/minute

Backlog growth:
200 jobs/minute
```

After one hour:

```text
200 * 60 = 12,000 queued jobs
```

If each job must complete within 10 minutes, the system is under-capacity.

Mitigations:

- Increase worker count.
- Improve job processing time.
- Batch jobs.
- Reduce unnecessary work.
- Split heavy jobs.
- Use priority queues.
- Apply backpressure.
- Use autoscaling based on queue length or queue age.
- Add dead-letter handling.
- Separate slow job types from fast job types.

Queue length alone can be misleading. Queue age is often more important.

```text
Queue length: 10,000 messages
Oldest message age: 5 seconds
Probably healthy for high-throughput system.

Queue length: 100 messages
Oldest message age: 2 hours
Probably unhealthy for low-throughput urgent workflow.
```

### Common Bottleneck Locations in Web Applications

Common bottlenecks in web applications include:

#### Client and Frontend

- Large JavaScript bundles.
- Slow rendering.
- Too many API calls.
- Large images.
- No caching.
- Layout shifts.
- Blocking scripts.
- Slow third-party scripts.

#### API Layer

- CPU saturation.
- Synchronous blocking calls.
- Thread pool starvation.
- Large JSON serialization.
- Inefficient middleware.
- Too many dependency calls per request.
- Poor connection reuse.
- Inefficient authorization checks.
- Excessive logging.

#### Database

- Missing indexes.
- N+1 queries.
- Table scans.
- Lock contention.
- Slow joins.
- Large transactions.
- Connection pool exhaustion.
- Hot rows.
- Hot partitions.
- Transaction log bottleneck.

#### Cache

- Low hit rate.
- Hot keys.
- Evictions.
- Cache stampede.
- Cache server memory pressure.
- Network latency to cache.

#### External Dependencies

- API rate limits.
- Slow payment provider.
- Identity provider latency.
- Third-party outages.
- DNS issues.
- TLS handshake overhead.
- Retry storms.

#### Infrastructure

- Load balancer limits.
- Network bandwidth.
- Disk I/O.
- Container CPU throttling.
- Memory limits.
- Autoscaling delay.
- Cloud service quotas.
- Regional capacity.

### Bottleneck Symptoms

Symptoms of bottlenecks include:

| Symptom | Possible Cause |
|---|---|
| High p95/p99 latency | Slow dependency, queueing, CPU saturation |
| High CPU | Expensive computation, serialization, inefficient code |
| High memory | Leaks, large objects, cache growth, buffering |
| High GC time | Allocation-heavy code, large object heap pressure |
| Database CPU high | Slow queries, missing indexes, too many queries |
| Database lock waits | Long transactions, hot rows, contention |
| Connection timeouts | Connection pool exhaustion, network issues |
| Queue backlog increasing | Worker under-capacity or downstream bottleneck |
| Error rate rising under load | Resource exhaustion, timeouts, throttling |
| 429 responses | Rate limit exceeded |
| 503 responses | Overloaded service or dependency unavailable |
| Autoscaling does not help | Bottleneck is downstream or shared resource |
| One partition hot | Poor partition key or skewed traffic |
| Long deployment warmup | Cold starts, cache warmup, JIT, migrations |

A good capacity plan defines which signals will be monitored.

### CPU Bottlenecks

CPU bottlenecks occur when processing demand exceeds available CPU.

Common causes:

- Expensive algorithms.
- Serialization and deserialization.
- Encryption/compression.
- Image/video processing.
- Complex validation.
- Regular expressions.
- Excessive logging.
- Busy waiting.
- CPU-bound work inside web request threads.
- Inefficient JSON transformations.
- High garbage collection overhead.

Mitigations:

- Optimize hot code paths.
- Cache computed results.
- Reduce payload size.
- Move CPU-heavy work to background workers.
- Scale out API instances.
- Use better algorithms.
- Use streaming.
- Use compiled expressions carefully.
- Profile before optimizing.
- Use specialized services for media processing.

Interview signal:

```text
If CPU scales linearly with request rate and no downstream dependency is saturated, horizontal scaling may help.
```

But if CPU is high because each request performs unnecessary work, optimization may be cheaper than scaling.

### Memory Bottlenecks

Memory bottlenecks occur when the application stores too much data or allocates too frequently.

Common causes:

- Loading entire files into memory.
- Loading huge result sets.
- In-memory caches without limits.
- Memory leaks through static references.
- Large object heap pressure.
- Too many concurrent requests.
- Excessive buffering.
- Large JSON payloads.
- Unbounded queues.
- Poor object lifecycle management.

Mitigations:

- Stream large files.
- Add pagination.
- Limit request and response size.
- Bound in-memory queues.
- Set cache size limits.
- Avoid static mutable collections.
- Use memory profiling.
- Reduce allocations.
- Use pooling only when justified.
- Scale out or scale up memory.
- Move large storage to external systems.

Example bad pattern:

```csharp
var bytes = await File.ReadAllBytesAsync(path);
return File(bytes, "application/octet-stream");
```

Better for large files:

```csharp
var stream = File.OpenRead(path);
return File(stream, "application/octet-stream");
```

### Database Bottlenecks

Databases are common bottlenecks because they are shared stateful components.

Common causes:

- Missing indexes.
- N+1 queries.
- Too many round trips.
- Large result sets.
- Unbounded queries.
- Full table scans.
- Lock contention.
- Hot rows.
- Long transactions.
- Inefficient schema design.
- Over-normalization for read-heavy workloads.
- Under-normalization causing write anomalies.
- Connection pool exhaustion.
- Poor partition key.
- Transaction log saturation.

Mitigations:

- Add appropriate indexes.
- Use query plans.
- Avoid N+1 queries.
- Use projections instead of loading full entities.
- Add pagination.
- Use read replicas.
- Cache read-heavy data.
- Split read and write models.
- Use background processing.
- Batch writes.
- Use optimistic concurrency.
- Partition or shard.
- Reduce transaction scope.
- Tune connection pool settings carefully.
- Use the right database for the access pattern.

Example N+1 pattern:

```csharp
var orders = await context.Orders.ToListAsync();

foreach (var order in orders)
{
    var items = await context.OrderItems
        .Where(item => item.OrderId == order.Id)
        .ToListAsync();
}
```

Better:

```csharp
var orders = await context.Orders
    .Include(order => order.Items)
    .ToListAsync();
```

Or better for API responses:

```csharp
var orders = await context.Orders
    .Select(order => new OrderDto
    {
        Id = order.Id,
        Total = order.Total,
        ItemCount = order.Items.Count
    })
    .ToListAsync();
```

### Connection Pool Bottlenecks

Connection pools limit how many simultaneous connections can be used for a dependency.

Common pools:

- Database connection pool.
- HTTP connection pool.
- Redis connection pool.
- Message broker connections.
- Thread pool.
- Browser automation pool.
- File handle pool.

Symptoms:

- Requests wait for connections.
- Timeout errors.
- High latency under load.
- Database CPU not high but app requests still slow.
- Increasing app instances makes the database overloaded with connections.

Example:

```text
API instances: 20
Max DB connections per instance: 100

Potential database connections:
20 * 100 = 2,000
```

If the database can safely handle only 500 connections, scaling API instances without controlling connection use can make the problem worse.

Mitigations:

- Reduce unnecessary database calls.
- Use short-lived connections correctly.
- Avoid long-running transactions.
- Tune pool size with evidence.
- Add backpressure.
- Use read replicas.
- Use queue-based processing.
- Limit app instance count if database cannot support more connections.
- Use multiplexing where supported.

### Network Bottlenecks

Network bottlenecks appear when data transfer or network round trips dominate performance.

Causes:

- Large payloads.
- Too many chatty service calls.
- Cross-region calls.
- No compression.
- Inefficient protocols.
- Repeated TLS handshakes.
- No connection reuse.
- Large file downloads through API servers.
- Slow DNS or external dependencies.

Mitigations:

- Place services closer together.
- Use CDN for static assets and downloads.
- Compress responses.
- Reduce payload size.
- Use pagination.
- Use binary formats when justified.
- Use connection reuse.
- Avoid unnecessary cross-region calls.
- Batch requests.
- Use async messaging.
- Let clients upload/download directly to object storage when appropriate.

### External Dependency Bottlenecks

External APIs often limit system capacity.

Examples:

```text
Payment provider: 200 requests/sec
Email provider: 10,000 emails/hour
Identity provider: token endpoint limit
Shipping API: p95 latency 2 seconds
Credit bureau: strict rate limit
```

If your system needs more capacity than the dependency allows, the external service becomes the bottleneck.

Mitigations:

- Cache where valid.
- Queue and process asynchronously.
- Batch requests.
- Use provider rate limits explicitly.
- Add backoff and circuit breakers.
- Use idempotency keys.
- Add fallback providers.
- Degrade gracefully.
- Negotiate higher limits.
- Split traffic across regions/providers if contract allows.
- Do not retry blindly during outages.

Capacity planning must include external dependency limits, not only internal resources.

### Hot Partitions and Skew

A hot partition happens when traffic is unevenly concentrated on one partition, shard, tenant, key, or database row.

Examples:

- One tenant generates 70% of traffic.
- One viral post receives most reads.
- One product has a flash sale.
- All writes use today's date as partition key.
- Sequential IDs concentrate writes.
- All users update one global counter.
- One queue partition receives most messages.

Symptoms:

- Overall system capacity looks available, but one partition throttles.
- Some tenants/users experience poor performance.
- Scaling out does not help evenly.
- One shard has high CPU while others are idle.

Mitigations:

- Choose better partition keys.
- Add key salting.
- Use fan-out/fan-in carefully.
- Cache hot items.
- Split hot tenants.
- Avoid global counters.
- Use per-partition metrics.
- Use load-aware routing.
- Precompute popular content.
- Use CDN for hot static content.

### Autoscaling and Capacity

Autoscaling adjusts capacity based on metrics such as CPU, memory, request count, queue length, or custom signals.

Autoscaling helps with variable demand, but it is not instant.

Important considerations:

- Scale-out delay.
- Cold start time.
- Warmup behavior.
- Minimum instance count.
- Maximum instance count.
- Cooldown periods.
- Metric delay.
- Dependency capacity.
- Cost.
- Load balancing.
- Stateful components.
- Database connections created by new instances.

Example issue:

```text
Traffic spike lasts 3 minutes.
Autoscaling takes 5 minutes to add ready instances.
Result: autoscaling reacts too late.
```

Mitigations:

- Keep minimum warm capacity.
- Use scheduled scaling for predictable spikes.
- Use faster scale-out triggers.
- Use queue-based load leveling.
- Pre-warm before launch or campaign.
- Optimize startup time.
- Use readiness probes.
- Scale dependencies too.
- Test autoscaling behavior under load.

### Headroom and Safety Margin

Headroom is spare capacity above expected demand.

Example:

```text
Expected peak: 5,000 RPS
Planned capacity: 7,000 RPS
Headroom: 2,000 RPS = 40%
```

Headroom protects against:

- Forecasting error.
- Traffic spikes.
- Instance failure.
- Slow dependency.
- Deployment warmup.
- Noisy neighbors.
- Cloud service throttling.
- Batch jobs overlapping with traffic.
- Retry storms.
- Seasonal load.

Too little headroom causes risk. Too much headroom increases cost.

A common interview approach is to state a safety margin, such as 20% to 50%, then explain that the actual margin depends on business criticality, cost, autoscaling speed, traffic volatility, and failure tolerance.

### N+1 and Redundant Work as Bottlenecks

Many bottlenecks are not caused by raw traffic, but by inefficient work per request.

Example:

```text
One API request should need 1 database query.
Implementation performs 101 database queries.
```

At 100 RPS:

```text
Expected database queries: 100/sec
Actual database queries: 10,100/sec
```

This turns a moderate traffic system into a database bottleneck.

Other redundant work:

- Calling the same external API multiple times per request.
- Recalculating expensive data that could be cached.
- Returning unused fields.
- Serializing large object graphs.
- Re-checking permissions repeatedly.
- Loading full entities when projection is enough.
- Repeating configuration or secret lookups.

Capacity planning should estimate work per request, not only request count.

### Latency Percentiles

Average latency is not enough. Use percentiles.

Common percentiles:

```text
p50: median user experience
p95: slowest 5% of requests
p99: slowest 1% of requests
p99.9: rare but severe tail latency
```

Example:

```text
Average latency: 100 ms
p95 latency: 900 ms
p99 latency: 4 seconds
```

The average looks good, but many users experience slow requests.

Capacity planning should define targets such as:

```text
Search p95 <= 300 ms under 2,000 RPS.
Checkout p95 <= 1 second under campaign traffic.
Payment confirmation p99 <= 3 seconds.
```

Tail latency often reveals bottlenecks caused by locks, garbage collection, slow queries, cold starts, retries, or overloaded dependencies.

### Load Testing

Load testing validates whether the system can handle expected traffic.

Types of tests:

| Test Type | Purpose |
|---|---|
| Smoke test | Verify system works with minimal load |
| Load test | Validate expected normal and peak load |
| Stress test | Push beyond expected capacity to find breaking point |
| Spike test | Sudden traffic increase |
| Soak test | Long-running test for leaks and degradation |
| Scalability test | Measure behavior as instances/resources increase |
| Failover test | Validate capacity during instance/zone/dependency failure |

A good load test should define:

- Target workload.
- User behavior model.
- Read/write mix.
- Request distribution.
- Data volume.
- Ramp-up pattern.
- Test duration.
- Success criteria.
- Environment similarity.
- Monitoring metrics.
- Failure thresholds.

Bad load test:

```text
Hit one endpoint repeatedly with unrealistic data.
```

Better load test:

```text
Simulate realistic user journeys with proper traffic mix, data volume, authentication, cache behavior, and peak traffic pattern.
```

### Capacity Testing Metrics

Monitor metrics at every layer.

Application metrics:

- Request rate.
- Error rate.
- Latency percentiles.
- CPU.
- Memory.
- GC time.
- Thread pool usage.
- Active requests.
- Dependency latency.
- Retry count.
- Timeout count.

Database metrics:

- CPU.
- IOPS.
- Query duration.
- Lock waits.
- Deadlocks.
- Connection count.
- Buffer/cache hit rate.
- Log write waits.
- Slow queries.
- Replication lag.
- Index usage.

Queue metrics:

- Arrival rate.
- Processing rate.
- Queue length.
- Oldest message age.
- Dead-letter count.
- Retry count.
- Consumer lag.

Cache metrics:

- Hit rate.
- Miss rate.
- Eviction count.
- Memory usage.
- CPU.
- Latency.
- Hot keys.

Infrastructure metrics:

- Load balancer status.
- Network throughput.
- Disk throughput.
- Container restarts.
- Autoscaling events.
- Throttling.
- Cloud service quotas.

Capacity planning without metrics is guessing.

### Identifying the Bottleneck During Load Testing

A structured bottleneck investigation:

```text
1. Observe user-facing symptom:
   latency, errors, throughput plateau, queue backlog.

2. Check application resource metrics:
   CPU, memory, thread pool, GC, active requests.

3. Check dependency metrics:
   database, cache, queue, external API.

4. Look for saturation:
   high utilization, wait time, throttling, connection limits.

5. Compare throughput:
   Does adding app instances increase throughput?

6. Isolate:
   Test endpoints separately, disable optional dependencies, profile hot paths.

7. Validate:
   Fix or scale suspected bottleneck and retest.
```

Important rule:

```text
A saturated component is not always the root cause.
```

Example:

```text
Database CPU is high.
Root cause may be N+1 queries from application code.
```

Fixing the database size may help temporarily, but fixing the query pattern may solve the real cause.

### Throughput Plateau

A throughput plateau occurs when increasing load no longer increases completed work.

Example:

```text
500 RPS load -> 500 RPS handled
1,000 RPS load -> 1,000 RPS handled
1,500 RPS load -> 1,200 RPS handled
2,000 RPS load -> 1,200 RPS handled with high latency
```

The system maximum is around 1,200 RPS in that environment. Additional requests queue, time out, or fail.

Next step: find what saturates at 1,200 RPS.

Possible bottlenecks:

- API CPU.
- Database CPU.
- Database connections.
- Locks.
- External dependency rate limit.
- Network.
- Thread pool.
- Cache.

### Scaling Up vs Scaling Out

Scaling up means using a larger resource.

```text
Bigger VM
More CPU
More memory
Higher database tier
More IOPS
```

Scaling out means adding more resources.

```text
More API instances
More workers
More queue consumers
More database replicas
More partitions
More shards
```

Comparison:

| Strategy | Benefits | Risks |
|---|---|---|
| Scale up | Simple, fewer moving parts | Has upper limit, can be costly, still single point of failure |
| Scale out | Better availability and elasticity | Requires stateless design, load balancing, coordination, data partitioning |

Examples:

- Stateless API servers usually scale out well.
- A relational database often scales up first, then uses replicas, partitioning, or sharding.
- Background workers usually scale out if jobs are independent.
- A single hot row does not scale out easily without design changes.

### Vertical Scaling Limits

Vertical scaling is limited by available instance sizes, cost, and single-resource failure risk.

Example:

```text
Database is scaled to largest available SKU.
CPU still reaches 95% at peak.
```

At this point, options include:

- Query optimization.
- Index tuning.
- Caching.
- Read replicas.
- Data partitioning.
- Sharding.
- CQRS.
- Archiving old data.
- Moving analytical workload away from OLTP database.
- Redesigning write path.
- Using a different storage engine.

A mature answer should not assume "just use a bigger database" forever.

### Horizontal Scaling Requirements

Horizontal scaling requires design support.

For API servers:

- Stateless application instances.
- Shared external session storage if sessions are needed.
- Load balancing.
- Health checks.
- Configuration consistency.
- Distributed cache if needed.
- No local-only file storage for shared data.

For workers:

- Idempotent processing.
- Work partitioning.
- Queue visibility timeout.
- Duplicate handling.
- Concurrency limits.
- Dead-letter handling.
- Distributed locks only when necessary.

For data:

- Partition key design.
- Shard routing.
- Cross-shard query strategy.
- Replication.
- Data consistency model.
- Rebalancing plan.

Scaling out a stateful system is harder than scaling out stateless compute.

### Caching and Capacity

Caching can reduce load on expensive resources.

Use caching for:

- Frequently read data.
- Expensive computations.
- Slow external API results.
- Static or rarely changing data.
- Search suggestions.
- Product catalog.
- Permissions or metadata with short TTL.
- Configuration.

Caching benefits:

- Lower latency.
- Reduced database load.
- Reduced external API calls.
- Better peak handling.
- Lower cost.

Caching risks:

- Stale data.
- Cache invalidation complexity.
- Cache stampede.
- Hot keys.
- Memory pressure.
- Inconsistent user experience.
- Security issues if user-specific data is cached incorrectly.

Cache capacity planning includes:

- Cache hit rate.
- Memory size.
- Eviction rate.
- TTL.
- Key count.
- Value size.
- Hot key distribution.
- Cache server CPU/network.
- Fallback load if cache fails.

Important question:

```text
If the cache is down, can the database handle the fallback traffic?
```

If not, the cache has become a critical dependency and needs reliability planning.

### Backpressure

Backpressure means slowing producers when consumers cannot keep up.

Without backpressure:

```text
API accepts unlimited work.
Queue grows without limit.
Memory grows.
Database grows.
Workers fall behind.
Eventually system fails.
```

With backpressure:

```text
When queue is full or dependency is saturated:
- reject requests with 429 or 503
- slow producers
- shed low-priority work
- degrade optional features
- apply rate limits
```

Backpressure protects the system from collapse.

Examples:

- Limit concurrent background jobs.
- Use bounded channels.
- Return 429 when rate limit is exceeded.
- Use queue max length.
- Disable expensive optional work during overload.
- Use circuit breakers for failing dependencies.
- Apply per-tenant quotas.

Backpressure is a capacity planning tool because it defines what happens when demand exceeds capacity.

### Load Shedding and Graceful Degradation

Load shedding means dropping or rejecting work to preserve critical functionality.

Graceful degradation means reducing functionality instead of failing completely.

Examples:

```text
Disable recommendations if recommendation service is slow.
Return cached product data if search is degraded.
Reject report generation requests during overload.
Serve static fallback page if personalization fails.
Prioritize checkout over analytics.
```

This is important because not all traffic has the same business value.

Capacity planning should identify:

- Critical flows.
- Optional flows.
- Low-priority background work.
- Work that can be delayed.
- Work that can be rejected.
- Work that must never be lost.

### Cost and Capacity Trade-Offs

Capacity planning is not only about performance. It is also about cost.

Overprovisioning:

```text
Pros:
- More headroom
- Lower outage risk during spikes
- Simpler planning

Cons:
- Higher cloud cost
- Waste during low usage
- May hide inefficiencies
```

Underprovisioning:

```text
Pros:
- Lower immediate cost

Cons:
- Higher latency
- Errors
- Outages
- Failed launches
- Poor user experience
- Emergency scaling
```

Autoscaling:

```text
Pros:
- Matches capacity to demand
- Reduces idle cost
- Handles variable traffic

Cons:
- Has scaling delay
- Needs good metrics
- Can cause dependency pressure
- May be hard for stateful systems
```

A strong architecture answer balances cost, user experience, reliability, and operational complexity.

### Capacity Planning for Different System Types

#### Read-Heavy Systems

Examples:

- Product catalog.
- News feed.
- Documentation site.
- Public profile pages.
- Search.

Likely bottlenecks:

- Database reads.
- Search index.
- Cache.
- Network bandwidth.
- CDN.
- Serialization.

Common strategies:

- CDN.
- Caching.
- Read replicas.
- Search indexes.
- Denormalized read models.
- Pagination.
- Precomputation.
- Compression.

#### Write-Heavy Systems

Examples:

- Analytics ingestion.
- Chat messages.
- IoT telemetry.
- Payment events.
- Logging pipeline.

Likely bottlenecks:

- Database writes.
- Transaction log.
- Partition hot spots.
- Queue throughput.
- Disk I/O.
- Consumer lag.

Common strategies:

- Queue ingestion.
- Batching.
- Partitioning.
- Append-only storage.
- Event streaming.
- Sharding.
- Asynchronous processing.
- Backpressure.

#### Mixed Workloads

Examples:

- E-commerce checkout.
- Banking application.
- SaaS dashboard.
- Course management system.

Likely bottlenecks:

- Database contention.
- Mixed read/write pressure.
- External dependencies.
- Authorization checks.
- Cache invalidation.

Common strategies:

- Separate read and write models.
- Cache read-heavy data.
- Keep transactions short.
- Use queues for side effects.
- Use idempotency.
- Prioritize critical paths.

#### Background Job Systems

Examples:

- Report generation.
- Email sending.
- File processing.
- Data import/export.

Likely bottlenecks:

- Worker count.
- Job processing time.
- External APIs.
- Queue backlog.
- Storage throughput.
- CPU for transformations.

Common strategies:

- Queue-based architecture.
- Worker autoscaling.
- Batch processing.
- Idempotency.
- Dead-letter queues.
- Priority queues.
- Backpressure.
- Job status tracking.

### Capacity Planning for Databases

Database planning should include:

- Read/write ratio.
- Query complexity.
- Index strategy.
- Transaction volume.
- Data growth.
- Retention.
- Archive strategy.
- Backup and restore time.
- Connection limits.
- Replication.
- Sharding or partitioning.
- Migration impact.
- Maintenance windows.
- Analytical workloads.

Common interview answer:

```text
I would avoid putting all read, write, reporting, and analytics load on the same OLTP database. I would separate heavy analytical queries into a read replica, data warehouse, or reporting pipeline if needed.
```

This shows awareness that different workloads stress databases differently.

### Capacity Planning for File Upload Systems

Inputs:

- Number of uploads per day.
- Peak uploads per second.
- Average file size.
- Maximum file size.
- Upload duration.
- Download frequency.
- Retention period.
- Virus scanning time.
- Metadata size.
- Encryption requirements.
- Regional storage.
- Bandwidth and egress.

Likely bottlenecks:

- API server memory if files are proxied.
- Network bandwidth.
- Object storage request limits.
- Virus scanning worker capacity.
- Metadata database.
- Download bandwidth.
- Storage growth.
- CDN.

Common design:

```text
Client uploads directly to object storage using signed URL.
API stores metadata.
Object storage event triggers scanner.
Scanner updates file status.
Download uses signed URL after scan passes.
```

This avoids API servers becoming the file transfer bottleneck.

### Capacity Planning for Real-Time Systems

Examples:

- Chat.
- Live notifications.
- Trading dashboards.
- Multiplayer games.
- Collaboration tools.

Important metrics:

- Concurrent connections.
- Messages per second.
- Fan-out count.
- Connection memory.
- Presence updates.
- Delivery latency.
- Regional latency.
- Reconnect storms.
- Message persistence.
- Backpressure behavior.

Likely bottlenecks:

- Connection count per server.
- Message broker throughput.
- Fan-out amplification.
- Hot rooms/channels.
- Network bandwidth.
- Presence state store.
- Database writes.

Example:

```text
1 message sent to a group with 10,000 members creates 10,000 delivery operations.
```

Fan-out can become the real bottleneck, not message creation.

### Capacity Planning for Multi-Tenant Systems

Multi-tenant systems introduce uneven load.

Questions:

- How many tenants?
- What is average tenant size?
- What is largest tenant size?
- Can one tenant affect others?
- Are there tenant quotas?
- Is data shared or isolated?
- Are noisy tenants throttled?
- Can large tenants be moved to dedicated resources?
- Are metrics available per tenant?

Likely bottlenecks:

- Hot tenant.
- Shared database.
- Shared cache.
- Shared queue.
- Per-tenant reporting jobs.
- Noisy neighbor effects.
- Large tenant migrations.

Mitigations:

- Per-tenant rate limits.
- Tenant-level metrics.
- Tenant partitioning.
- Dedicated resources for large tenants.
- Fair scheduling.
- Quotas.
- Bulkhead isolation.

### Capacity Planning and Reliability

Capacity and reliability are connected.

A system running at 95% CPU during normal traffic has little room for:

- Failover.
- Traffic spikes.
- Retry storms.
- Deployment warmup.
- Node failure.
- Background jobs.
- Garbage collection pauses.
- Slow dependencies.

Reliability planning often requires spare capacity.

Example:

```text
System has 4 instances.
Each instance normally runs at 70% CPU.
If one instance fails, remaining 3 must handle the same load.

New average per remaining instance:
4 * 70% / 3 = 93.3%
```

This may be unsafe.

For N+1 capacity:

```text
The system should handle peak load even if one instance is unavailable.
```

This requirement directly increases required capacity.

### Capacity Planning and Consistency

Consistency requirements affect capacity.

Strong consistency may require:

- Synchronous writes.
- Distributed transactions.
- Locks.
- Single leader.
- Quorum writes.
- Serial processing.
- Lower concurrency.

Eventual consistency may allow:

- Queues.
- Async processing.
- Read replicas.
- Caches.
- Denormalized views.
- Higher availability.
- Higher throughput.

Example:

```text
Inventory reservation must be strongly consistent.
Product recommendation updates can be eventually consistent.
```

Design implication:

```text
Use transactional inventory reservation for checkout.
Use async event processing for recommendations.
```

This avoids forcing the whole system to use the strictest consistency model.

### Capacity Planning and Security

Security features can affect capacity.

Examples:

- Password hashing consumes CPU.
- Encryption/decryption consumes CPU.
- TLS consumes CPU and network overhead.
- Audit logging increases write volume.
- Authorization checks add database/cache calls.
- Rate limiting requires counters.
- Malware scanning requires worker capacity.
- Security monitoring increases log volume.

Capacity planning should include security workloads.

Example:

```text
If every login requires a strong password hash and peak login traffic is 2,000 attempts/second, CPU capacity for authentication must be planned carefully.
```

Security should not be removed to improve capacity. Instead, plan capacity for required security behavior.

### Capacity Planning and Observability

Observability itself consumes capacity.

Logging every request with large payloads can increase:

- CPU.
- Disk.
- Network.
- Storage cost.
- Log ingestion cost.
- Query cost.
- Privacy risk.

Good observability planning includes:

- Log levels.
- Sampling.
- Structured logs.
- Metrics.
- Traces.
- Retention periods.
- Redaction.
- Cost controls.
- Alert thresholds.

Example:

```text
At 10,000 RPS, logging 5 KB per request creates:
10,000 * 5 KB = 50 MB/sec
50 MB/sec * 86,400 sec/day ≈ 4.3 TB/day
```

This can become a storage and cost bottleneck.

### Identifying Bottlenecks Before Building

For a new system, use likely bottleneck analysis.

Steps:

```text
1. Identify main user flows.
2. Estimate traffic per flow.
3. Break each flow into component calls.
4. Identify shared resources.
5. Check limits of each resource.
6. Find resources where demand is close to limits.
7. Plan mitigation.
```

Example: checkout

```text
Flow:
Validate cart
Reserve inventory
Create payment
Create order
Send confirmation email
Update analytics
```

Likely bottlenecks:

```text
Inventory reservation database
Payment provider latency/rate limit
Order database writes
Email provider throughput
Analytics should not block checkout
```

Design decision:

```text
Keep inventory/payment/order synchronous.
Move email and analytics to background queue.
Use idempotency key for payment.
Monitor provider latency and error rate.
```

This identifies likely bottlenecks before writing code.

### Bottleneck Mitigation Strategies

Common strategies:

| Bottleneck | Possible Mitigation |
|---|---|
| API CPU | Scale out, optimize code, cache, reduce serialization |
| API memory | Stream, paginate, limit payloads, bound queues |
| Database reads | Indexes, caching, read replicas, projections |
| Database writes | Batch, partition, queue, optimize transactions |
| Database locks | Short transactions, optimistic concurrency, redesign hot rows |
| Search latency | Search index, caching, precompute |
| External API | Queue, rate limit, fallback, cache, negotiate limits |
| Queue backlog | Add workers, optimize jobs, autoscale, priority queues |
| Network bandwidth | CDN, compression, direct object storage access |
| Hot partition | Better partition key, salting, split hot tenant |
| Cache stampede | Locking, request coalescing, stale-while-revalidate |
| Thread pool starvation | Avoid sync-over-async, use async I/O |
| Connection pool exhaustion | Reduce long operations, tune pool, limit concurrency |

A strong interview answer matches the mitigation to the bottleneck instead of applying generic solutions.

### Common Capacity Planning Mistakes

Common mistakes include:

- Planning for average load instead of peak load.
- Ignoring burst traffic.
- Ignoring external API limits.
- Assuming autoscaling is instant.
- Scaling API servers while the database is the bottleneck.
- Not accounting for database connections per instance.
- Ignoring background jobs and batch workloads.
- Ignoring retries and retry storms.
- Ignoring data growth and retention.
- Ignoring backup and restore time.
- Ignoring log volume and observability cost.
- Using unrealistic load tests.
- Testing only one endpoint instead of real user journeys.
- Not monitoring p95 and p99 latency.
- Ignoring queue age.
- Ignoring hot partitions.
- Assuming cache hit rate will always be high.
- Not planning for cache failure.
- Overprovisioning without fixing inefficient code.
- Underprovisioning to save cost.
- Not validating assumptions before launch.
- Not updating capacity plans after product changes.

### Best Practices

Start with measurable performance and reliability targets.

Estimate demand using historical data, business forecasts, pilots, and assumptions.

Plan for peak traffic, not only average traffic.

Include safety margin and failure scenarios.

Break user flows into component-level operations.

Identify shared resources and external dependency limits.

Estimate database, storage, network, cache, and queue needs separately.

Use back-of-the-envelope math to reveal likely risks.

Validate assumptions with realistic load testing.

Monitor application, database, queue, cache, and infrastructure metrics.

Use p95 and p99 latency, not only averages.

Track queue age, not only queue length.

Use autoscaling, but understand its delay and dependency impact.

Add backpressure and load shedding for overload protection.

Cache carefully and plan for cache failure.

Optimize inefficient code before blindly scaling expensive resources.

Use queues for burst smoothing and long-running work.

Make background jobs idempotent.

Avoid unbounded queues and unlimited concurrency.

Review capacity before launches, campaigns, migrations, seasonal peaks, and major feature releases.

Treat capacity planning as continuous, not one-time.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-beginner-q01 -->
#### Beginner Q01: What is capacity planning?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Capacity planning is the process of estimating the resources a system needs to meet expected demand while satisfying performance, reliability, and cost targets. It includes estimating compute, memory, storage, database capacity, network bandwidth, queue throughput, external dependency limits, and safety margin.

The goal is to avoid both underprovisioning and overprovisioning. Underprovisioning causes slow responses, errors, and outages. Overprovisioning wastes money.

##### Key Points to Mention

- Estimates resources needed for expected demand.
- Includes CPU, memory, database, storage, network, queues, and external limits.
- Should use peak load, not only average load.
- Helps avoid performance degradation and outages.
- Helps avoid unnecessary cost.
- Should be validated with testing and monitoring.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-beginner-q01 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-beginner-q02 -->
#### Beginner Q02: What is a bottleneck?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A bottleneck is the component or resource that limits overall system performance or scalability. It is the first part of the system to saturate when demand increases.

Examples include CPU, memory, database queries, database locks, network bandwidth, storage I/O, connection pools, queues, external API rate limits, and hot partitions.

A system can have many resources, but the bottleneck is the one currently preventing higher throughput or lower latency.

##### Key Points to Mention

- A bottleneck limits system throughput or latency.
- It can be application, database, network, storage, queue, cache, or external dependency.
- Every system has a limiting factor.
- The problem is when the bottleneck prevents meeting requirements.
- Bottlenecks should be identified with metrics and load testing.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-beginner-q02 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-beginner-q03 -->
#### Beginner Q03: Why should capacity planning use peak load instead of average load?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Average load hides spikes. Systems usually fail during peak traffic, not during average traffic. For example, if most users log in at 9:00 AM or traffic spikes during a sale, the system must handle that peak even if the daily average is much lower.

Capacity planning should consider peak hour, peak minute, burst traffic, seasonal events, launches, marketing campaigns, and safety margin.

##### Key Points to Mention

- Average load can be misleading.
- Failures often happen during spikes.
- Peak hour and burst traffic matter.
- Seasonal and campaign traffic should be planned.
- Use safety margin above expected peak.
- Validate with load or spike testing.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-beginner-q03 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-beginner-q04 -->
#### Beginner Q04: What resources should be considered in capacity planning?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Capacity planning should consider all resources that can limit the system. This includes application CPU and memory, database CPU and I/O, database connections, storage size, storage throughput, network bandwidth, cache size and throughput, queue throughput, worker capacity, external API rate limits, cloud service quotas, and operational capacity.

It is not enough to estimate only web server instances because shared dependencies can become the real bottleneck.

##### Key Points to Mention

- Application compute.
- Memory.
- Database capacity.
- Storage size and throughput.
- Network bandwidth.
- Cache capacity.
- Queue and worker capacity.
- External API limits.
- Cloud quotas.
- Human operational capacity when relevant.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-beginner-q04 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-beginner-q05 -->
#### Beginner Q05: What is the difference between throughput and latency?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Throughput is how much work the system completes per unit of time, such as requests per second or jobs per minute. Latency is how long one request or job takes to complete.

A system can have high throughput but poor latency if many requests are processed slowly. A system can have low latency at small load but fail to maintain it as throughput increases.

Capacity planning needs both because users care about response time, and the business cares about how much work the system can handle.

##### Key Points to Mention

- Throughput = work per time.
- Latency = time per operation.
- Both matter.
- High throughput does not guarantee low latency.
- Latency often increases when resources saturate.
- Use p95/p99 latency, not only averages.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-beginner-q05 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-beginner-q06 -->
#### Beginner Q06: Why is the database often a bottleneck?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

The database is often a bottleneck because many application instances share the same database, and the database handles stateful operations such as queries, writes, indexes, transactions, locks, and consistency. If queries are slow, indexes are missing, transactions are long, or connections are exhausted, the whole application can slow down.

Adding more API instances may increase database pressure instead of solving the problem.

##### Key Points to Mention

- Database is a shared stateful dependency.
- Slow queries and missing indexes hurt capacity.
- Writes and transactions can cause locks.
- Connection pools can be exhausted.
- Scaling app instances can increase DB pressure.
- Mitigations include indexing, caching, read replicas, query optimization, partitioning, and batching.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q01 -->
#### Intermediate Q01: How would you estimate how many API instances are needed?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

First, define the peak target throughput and latency requirement. Then measure or estimate how much throughput one API instance can handle while meeting the latency target. Divide target throughput by per-instance capacity, then add safety margin and failure headroom.

Example:

```text
One instance handles 500 RPS at p95 <= 300 ms.
Target peak is 4,000 RPS.

Base instances:
4,000 / 500 = 8

Add 30% safety margin:
8 * 1.3 = 10.4

Round up and include failure headroom:
11 or 12 instances
```

However, this is valid only if the API layer is the bottleneck. You must also check downstream capacity such as database, cache, queue, and external APIs.

##### Key Points to Mention

- Start with target RPS and latency.
- Use load test result per instance.
- Divide target by instance capacity.
- Add safety margin.
- Include N+1 or failure headroom if required.
- Verify downstream dependencies are not the real bottleneck.
- Validate with load testing.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q01 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q02 -->
#### Intermediate Q02: How do you identify the likely bottleneck in a system design interview?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Start by identifying the main user flows and estimating traffic for each flow. Break each request into operations such as API calls, database reads/writes, cache lookups, queue messages, file operations, and external API calls. Then identify shared resources and known limits.

The likely bottleneck is often the shared resource with the highest demand relative to its capacity, such as the database, external API, queue consumer, hot partition, network bandwidth, or CPU-heavy service.

A good answer should also mention validation: use load tests, metrics, profiling, and production monitoring to confirm the bottleneck.

##### Key Points to Mention

- Identify main flows.
- Estimate traffic per flow.
- Break flows into component operations.
- Identify shared resources.
- Compare demand to known limits.
- Look for database, external API, queue, network, or hot partition risks.
- Validate with metrics and load testing.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q02 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q03 -->
#### Intermediate Q03: How does Little's Law help with capacity planning?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Little's Law states that the average number of items in a system equals the arrival rate multiplied by the average time an item spends in the system.

```text
L = λ × W
```

For example, if jobs arrive at 100 jobs per second and each job takes 2 seconds to process, about 200 jobs are being processed on average.

This helps estimate concurrency, queue size, worker needs, and the effect of latency. If processing time increases, the number of in-flight items increases, which can increase memory usage, connection usage, and queue backlog.

##### Key Points to Mention

- Formula: `L = λ × W`.
- Useful for estimating concurrency.
- Helps reason about queues and worker systems.
- Higher latency increases in-flight work.
- Can reveal required worker capacity.
- Good for back-of-the-envelope estimates.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q03 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q04 -->
#### Intermediate Q04: How would you capacity plan a background job system?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Estimate the job arrival rate, average processing time, acceptable queue delay, concurrency per worker, and external dependency limits. Then calculate how many workers are needed to process jobs faster than they arrive.

Example:

```text
Jobs arrive: 10,000/hour
Average processing time: 2 seconds
One worker processes: 1,800/hour

Workers needed:
10,000 / 1,800 = 5.56
Round up and add margin:
8 workers
```

Also monitor queue length, oldest message age, processing rate, retry count, and dead-letter count. If jobs call an external API, that API rate limit may become the real bottleneck.

##### Key Points to Mention

- Estimate job arrival rate.
- Estimate processing time.
- Calculate worker throughput.
- Add safety margin.
- Watch queue age, not only queue length.
- Include external API limits.
- Use autoscaling based on queue metrics when appropriate.
- Design idempotency and retry handling.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q04 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q05 -->
#### Intermediate Q05: Why can autoscaling fail to solve a capacity problem?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Autoscaling can fail if the bottleneck is not the scalable layer. For example, adding API instances will not help if the database, external API, or message broker is already saturated. Autoscaling can also react too slowly to sudden spikes because new instances need time to start and warm up.

Autoscaling can even make problems worse by increasing database connections, downstream calls, retries, and contention.

Good capacity planning includes autoscaling delay, warmup time, minimum capacity, maximum capacity, dependency capacity, and predictive or scheduled scaling for known spikes.

##### Key Points to Mention

- Autoscaling is not instant.
- It may scale the wrong layer.
- Downstream dependencies may be the bottleneck.
- New instances can increase database pressure.
- Cold starts and warmup matter.
- Use minimum warm capacity for predictable spikes.
- Test autoscaling behavior under load.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q05 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q06 -->
#### Intermediate Q06: How do caching decisions affect capacity planning?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Caching can reduce load on databases, external APIs, and expensive computations. A high cache hit rate can greatly improve capacity and latency. However, caching introduces its own capacity concerns such as memory size, eviction rate, hot keys, cache stampede, stale data, and cache failure behavior.

Capacity planning should estimate cache hit rate and ask whether the backend can survive if the cache is cold or unavailable. If the system cannot handle fallback traffic, the cache is a critical dependency and needs reliability planning.

##### Key Points to Mention

- Caching reduces expensive backend calls.
- Hit rate is a key metric.
- Cache memory and throughput must be planned.
- Hot keys and stampedes can become bottlenecks.
- Stale data and invalidation are trade-offs.
- Plan for cache failure or cold cache.
- Do not cache sensitive user data incorrectly.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q06 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q07 -->
#### Intermediate Q07: How do you detect a database bottleneck during load testing?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

Look for database metrics and symptoms such as high database CPU, high I/O wait, slow queries, lock waits, deadlocks, connection pool timeouts, long transaction duration, increasing query latency, full table scans, replication lag, or transaction log pressure.

Also check whether application throughput stops increasing even when more API instances are added. If app CPU is not saturated but requests wait on database calls, the database or its connection pool is likely the bottleneck.

Use query plans, slow-query logs, application dependency telemetry, and database monitoring to confirm.

##### Key Points to Mention

- High database CPU or I/O.
- Slow queries.
- Lock waits and deadlocks.
- Connection pool exhaustion.
- Throughput plateau.
- App waiting on database calls.
- Query plans and slow-query logs.
- Adding API instances does not improve throughput.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q07 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q08 -->
#### Intermediate Q08: What is backpressure and why is it important?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

Backpressure is a mechanism that slows or limits producers when consumers or dependencies cannot keep up. It prevents the system from accepting unlimited work that it cannot process.

Examples include returning `429 Too Many Requests`, limiting queue size, using bounded channels, throttling per tenant, rejecting low-priority requests, or delaying producers.

Backpressure is important because without it, queues can grow indefinitely, memory can be exhausted, databases can be overloaded, and the system can collapse under excess demand.

##### Key Points to Mention

- Slows producers when capacity is limited.
- Prevents unbounded queues and memory growth.
- Protects downstream dependencies.
- Can use rate limits, bounded queues, and request rejection.
- Helps preserve critical functionality.
- Should be part of overload design.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-advanced-q01 -->
#### Advanced Q01: How would you perform capacity planning for a new system with no historical traffic?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

For a new system, I would start with business assumptions and comparable systems. I would estimate registered users, active users, peak concurrency, request rate, read/write ratio, data growth, payload sizes, and expected launch or campaign spikes. I would document assumptions clearly and use back-of-the-envelope calculations to estimate API, database, storage, network, cache, and worker needs.

Then I would build a prototype or MVP and run load tests to validate assumptions. I would instrument the system early so real usage can replace assumptions after launch. I would also design with safety margin and autoscaling, but I would not assume autoscaling solves all bottlenecks.

##### Key Points to Mention

- Use business forecasts and comparable systems.
- State assumptions clearly.
- Estimate users, RPS, data growth, and peak traffic.
- Break flows into resource usage.
- Add safety margin.
- Validate with prototype and load tests.
- Instrument production to replace guesses with real data.
- Revisit the plan after launch.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-advanced-q01 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-advanced-q02 -->
#### Advanced Q02: How do you find the true bottleneck when multiple metrics look bad?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

I would start from the user-facing symptom, such as high p95 latency or error rate, then trace the request path and identify where time is spent. I would check application metrics, dependency telemetry, database metrics, queue metrics, cache metrics, and infrastructure metrics.

A saturated component is not always the root cause. For example, database CPU may be high because application code performs N+1 queries. The true fix may be query optimization rather than scaling the database.

I would isolate variables by testing specific endpoints, reviewing traces and query plans, profiling hot paths, and applying one change at a time. Then I would retest to verify the bottleneck moved or improved.

##### Key Points to Mention

- Start from user-facing symptoms.
- Use traces to see where time is spent.
- Check all layers.
- Saturation is not always root cause.
- Look for inefficient work per request.
- Isolate variables.
- Apply one change at a time.
- Retest to confirm.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-advanced-q02 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-advanced-q03 -->
#### Advanced Q03: How would you capacity plan a high-read product catalog?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

I would estimate product count, read RPS, search/filter traffic, response size, cacheability, update frequency, and peak campaign traffic. Since it is read-heavy, likely bottlenecks include database reads, search index latency, cache throughput, API serialization CPU, and network bandwidth.

A typical design would use caching, CDN where appropriate, search indexing, read replicas or denormalized read models, pagination, and projections. Writes can update the primary database and publish events to update search indexes and caches asynchronously if some staleness is acceptable.

I would validate cache hit rate, search index capacity, p95 latency, and network egress under load.

##### Key Points to Mention

- Estimate read RPS and product count.
- Identify search and filtering load.
- Use caching and CDN.
- Use search index for search-heavy queries.
- Use projections and pagination.
- Consider read replicas or denormalized read models.
- Plan for cache invalidation and acceptable staleness.
- Monitor p95/p99 latency and cache hit rate.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-advanced-q03 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-advanced-q04 -->
#### Advanced Q04: How would you capacity plan a write-heavy event ingestion system?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

I would estimate events per second, event size, peak bursts, retention period, partitioning needs, processing latency target, and downstream consumers. Likely bottlenecks include broker throughput, partition hot spots, storage writes, consumer lag, network bandwidth, and downstream database or analytics systems.

A typical design would use an append-only event stream or queue, partitioning by a key that spreads load, batching, backpressure, idempotent consumers, and separate storage for raw events and processed views. I would monitor event ingestion rate, consumer lag, partition load, write throughput, error rate, and oldest unprocessed event age.

##### Key Points to Mention

- Estimate events per second and event size.
- Account for bursts and retention.
- Use queues or event streams.
- Partition to avoid hot spots.
- Use batching for throughput.
- Consumers must be idempotent.
- Monitor consumer lag and partition load.
- Apply backpressure when downstream systems cannot keep up.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-advanced-q04 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-advanced-q05 -->
#### Advanced Q05: How do capacity planning and reliability requirements interact?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Reliability requirements often require extra capacity. If the system must survive an instance, zone, or dependency failure, the remaining capacity must still handle expected load. Running at high utilization during normal traffic leaves no room for failover, retries, deployments, or spikes.

For example, if four instances each run at 70% CPU and one fails, the remaining three instances may need to handle the same load at about 93% CPU each, which may be unsafe. Capacity planning should include headroom, N+1 capacity, failover scenarios, retry behavior, and degraded modes.

##### Key Points to Mention

- Reliability requires headroom.
- Failover reduces available capacity.
- Normal utilization should not be too high.
- Retries increase load during failures.
- N+1 capacity may be required.
- Degraded modes can protect critical flows.
- Capacity plans should include failure scenarios.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-advanced-q05 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-advanced-q06 -->
#### Advanced Q06: Why can retries create capacity problems?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Retries increase traffic when a dependency is already slow or failing. If many clients retry at the same time, they can amplify load and make the outage worse. This is called a retry storm.

For example, if a service receives 1,000 RPS and each failed request retries three times, the downstream dependency may receive up to 4,000 RPS during failure. This can overload the dependency and delay recovery.

Retries should be limited, use exponential backoff and jitter, respect timeouts, avoid unsafe non-idempotent operations, and be combined with circuit breakers and backpressure.

##### Key Points to Mention

- Retries multiply traffic.
- Retry storms can worsen outages.
- Failed dependencies may receive more load.
- Use retry limits, backoff, and jitter.
- Use circuit breakers.
- Respect timeouts and request budgets.
- Avoid unsafe retries for non-idempotent writes.
- Monitor retry counts.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-advanced-q06 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-advanced-q07 -->
#### Advanced Q07: How do you design for hot partitions or noisy tenants?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

First, measure load per partition, tenant, key, or shard. If one tenant or key receives disproportionate traffic, the system needs isolation or better partitioning. Strategies include choosing a more balanced partition key, salting hot keys, caching hot data, splitting large tenants, using per-tenant quotas, applying rate limits, and routing large tenants to dedicated resources.

For multi-tenant systems, capacity planning should include largest-tenant behavior, not only average tenant behavior. Otherwise one noisy tenant can degrade the experience for everyone.

##### Key Points to Mention

- Measure per tenant or partition.
- Average load can hide skew.
- Hot partitions limit scale.
- Use better partition keys or salting.
- Cache hot data.
- Apply quotas or rate limits.
- Isolate large tenants.
- Monitor noisy neighbor behavior.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-advanced-q07 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-advanced-q08 -->
#### Advanced Q08: How would you validate a capacity plan before launch?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

I would validate the plan with realistic load testing in an environment that is close enough to production. The test should model realistic user journeys, read/write ratios, authentication, payload sizes, data volume, cache behavior, and traffic ramp-up. I would include normal peak load, expected spike load, stress testing beyond expected capacity, and soak testing for leaks or degradation.

During the test, I would monitor application, database, cache, queue, network, and external dependency metrics. Success criteria should include throughput, p95/p99 latency, error rate, queue age, resource utilization, and cost expectations.

After the test, I would tune the design, retest, and document the measured capacity and bottlenecks.

##### Key Points to Mention

- Use realistic load tests.
- Model real user journeys.
- Include peak, spike, stress, and soak tests.
- Use production-like data volume.
- Monitor all layers.
- Define success criteria.
- Identify and fix bottlenecks.
- Document measured capacity and limits.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-advanced-q08 -->

<!-- question:start:capacity-planning-and-identifying-likely-bottlenecks-advanced-q09 -->
#### Advanced Q09: How do you balance capacity, performance, and cost?

<!-- question-id:capacity-planning-and-identifying-likely-bottlenecks-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

Capacity, performance, and cost must be balanced based on business requirements. Overprovisioning improves headroom but increases cost. Underprovisioning saves money initially but risks latency, errors, outages, and poor user experience. Autoscaling can reduce waste but has scaling delay and must not overload shared dependencies.

The best approach is to define measurable targets, provision enough headroom for peak and failure scenarios, optimize inefficient hot paths, use autoscaling for variable demand, use caching and queues where appropriate, and continuously monitor real usage. Cost optimization should not remove required reliability or security behavior.

##### Key Points to Mention

- Overprovisioning costs more.
- Underprovisioning risks outages and latency.
- Autoscaling helps but is not instant.
- Optimize before blindly scaling.
- Use measurable performance targets.
- Keep headroom for spikes and failures.
- Monitor real usage and adjust.
- Business criticality determines acceptable cost.

<!-- question:end:capacity-planning-and-identifying-likely-bottlenecks-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
