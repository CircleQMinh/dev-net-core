---
id: throughput-latency-concurrency-availability-consistency-cost-targets
topic: Requirements decomposition and system trade-offs
subtopic: Throughput, latency, concurrency, availability, consistency, and cost targets
category: Design & Architecture
---



## Overview

Throughput, latency, concurrency, availability, consistency, and cost targets are measurable quality requirements used to describe how a system should behave under real-world production conditions. They turn vague goals such as "make it fast", "support many users", "never go down", or "keep it affordable" into concrete engineering targets that influence architecture, infrastructure, database design, testing, monitoring, and operational decisions.

In system design and architecture interviews, these targets are important because they show whether a candidate can move beyond feature requirements and reason about real production behavior. A system is not only judged by whether it works functionally. It must also handle expected traffic, respond within acceptable time, survive failures, preserve the right level of data correctness, and stay within cost limits.

These targets are commonly used when designing APIs, microservices, background job systems, distributed databases, payment flows, reporting systems, file transfer platforms, messaging pipelines, and cloud-hosted applications. They influence decisions such as whether to use caching, queues, partitioning, read replicas, autoscaling, circuit breakers, retries, multi-region deployment, eventual consistency, or stronger transactional guarantees.

A strong interview answer usually starts by clarifying the business flow, user expectations, traffic shape, data criticality, failure tolerance, and budget constraints. Then the answer converts those requirements into measurable targets, explains trade-offs, and proposes how the system will be tested and monitored.

## Core Concepts

### Quality Targets and Requirement Decomposition

Requirement decomposition means breaking a high-level business goal into measurable technical targets.

A vague requirement:

```text
The system must handle high traffic and be reliable.
```

A decomposed requirement:

```text
Feature: Submit order

Traffic:
- Average: 500 requests per second
- Peak: 2,000 requests per second during campaign events
- Burst: 5,000 requests per second for up to 5 minutes

Latency:
- p95 response time below 300 ms
- p99 response time below 1 second

Availability:
- 99.95% monthly availability for order submission
- Graceful degradation for recommendation and analytics features

Consistency:
- Payment and inventory reservation must be strongly consistent
- Order history can be eventually consistent within 30 seconds

Cost:
- Monthly infrastructure budget below $20,000
- Unit cost below $0.002 per order request
```

This style of decomposition helps architects choose appropriate technologies and helps teams validate whether the system is meeting expectations.

Important terms:

- **Functional requirement**: What the system does, such as "create an order" or "upload a file".
- **Non-functional requirement**: How well the system performs, such as speed, reliability, security, scalability, or cost efficiency.
- **SLI**: Service Level Indicator, a measured metric such as request success rate or p95 latency.
- **SLO**: Service Level Objective, the internal target for an SLI.
- **SLA**: Service Level Agreement, an external promise that may include contractual consequences.
- **Error budget**: The allowed amount of unreliability over a period, often derived from the SLO.

### Throughput

Throughput measures how much work a system completes in a period of time.

Common throughput units:

- Requests per second
- Transactions per second
- Messages per second
- Jobs per minute
- Files processed per hour
- Database writes per second
- Events ingested per second

Throughput is not the same as the number of users. A system may have one million registered users but only a few thousand active users at the same time. Interviewers often expect candidates to distinguish between total users, daily active users, peak concurrent users, and actual request rate.

Example:

```text
Assumptions:
- 1,000,000 daily active users
- Each user makes 20 API calls per day
- Traffic is concentrated into 8 active hours
- Peak traffic is 5 times the average

Average requests per second:
1,000,000 * 20 / (8 * 60 * 60) = about 694 RPS

Peak requests per second:
694 * 5 = about 3,470 RPS
```

Throughput matters because it drives capacity planning. It influences the number of application instances, database capacity, queue throughput, cache size, partitioning strategy, network bandwidth, and autoscaling rules.

Common throughput bottlenecks include:

- Database locks or slow queries
- Thread pool starvation
- Synchronous I/O
- Insufficient connection pool size
- Hot partitions
- Slow downstream services
- Excessive serialization or large payloads
- CPU-heavy transformations
- Unbounded retries during failures

Best practices:

- Separate average, peak, and burst throughput.
- Measure throughput per critical workflow, not only per application.
- Design for backpressure when demand exceeds capacity.
- Use queues for asynchronous workloads that do not need immediate completion.
- Avoid scaling only the web tier if the database or downstream dependency is the real bottleneck.
- Track throughput together with latency and error rate.

### Latency

Latency measures how long one operation takes from the user's or caller's perspective. In APIs, latency is often measured as request-response time. In event systems, it may mean end-to-end processing delay from event creation to completion.

Important latency metrics:

- **Average latency**: The mean response time. Useful, but can hide slow outliers.
- **Median latency / p50**: Half of requests are faster than this value.
- **p95 latency**: 95% of requests are faster than this value.
- **p99 latency**: 99% of requests are faster than this value.
- **Tail latency**: High-percentile latency such as p95, p99, or p99.9.
- **End-to-end latency**: Total time across client, network, API, dependencies, database, and response serialization.

Example latency target:

```text
For the product search API:
- p50 below 80 ms
- p95 below 250 ms
- p99 below 800 ms
- timeout at 2 seconds
```

Latency matters because users experience delay directly. A system can have high throughput but still feel slow if each request waits too long. High latency can also reduce throughput because resources remain occupied longer.

Common latency causes:

- Slow database queries
- Cold starts
- Large payloads
- Chatty service-to-service calls
- Blocking calls in async code
- Lock contention
- Cache misses
- Retry storms
- Cross-region network calls
- Garbage collection pressure
- Inefficient serialization

Best practices:

- Define percentile-based latency targets, not only averages.
- Track latency per endpoint or business flow.
- Use timeouts, cancellation, and circuit breakers.
- Avoid unnecessary sequential calls when independent calls can run concurrently.
- Use caching carefully for read-heavy workloads.
- Reduce payload size and avoid over-fetching.
- Treat p95 and p99 latency as first-class production metrics.

### Throughput vs Latency

Throughput and latency are related but different.

- Throughput asks: "How many operations can the system complete per second?"
- Latency asks: "How long does one operation take?"

A system can have:

- High throughput and low latency: ideal but requires efficient design.
- High throughput and high latency: system processes many requests, but users wait.
- Low throughput and low latency: system is fast for a small load but does not scale.
- Low throughput and high latency: system is both slow and capacity-limited.

Trade-off examples:

- Batching can improve throughput but increase latency for individual requests.
- Caching can reduce latency and improve throughput but may introduce stale data.
- Strong consistency can improve correctness but may increase latency.
- Adding replicas can improve read throughput but may complicate consistency.
- Increasing concurrency can improve throughput until the system becomes saturated, after which latency and error rates increase.

Interview habit:

```text
Do not say "the system should be fast."
Say "the checkout API should keep p95 latency below 300 ms at 2,000 RPS with an error rate below 0.1%."
```

### Concurrency

Concurrency describes how many operations are in progress at the same time. It is related to but not identical to throughput.

Common types of concurrency:

- Concurrent users
- Concurrent requests
- Concurrent database connections
- Concurrent background jobs
- Concurrent message consumers
- Concurrent file uploads
- Concurrent transactions
- Concurrent threads or tasks

A useful approximation is:

```text
Concurrency ≈ Throughput × Latency
```

Example:

```text
If an API handles 1,000 requests per second
and average request latency is 200 ms:

Concurrency ≈ 1,000 × 0.2 = 200 active requests
```

This is useful for estimating connection pools, thread usage, memory pressure, queue consumers, and instance count.

Concurrency mistakes:

- Confusing registered users with concurrent users.
- Confusing concurrent users with concurrent requests.
- Allowing unlimited parallel tasks.
- Increasing concurrency without checking database capacity.
- Forgetting connection pool limits.
- Using locks around slow I/O.
- Creating too many threads for I/O-bound workloads.
- Running CPU-bound work on the request path without throttling.

Best practices:

- Limit concurrency at the correct boundary.
- Use `SemaphoreSlim`, bounded channels, queue consumers, or rate limiters when needed.
- Use async I/O for I/O-bound work.
- Use worker pools for background processing.
- Monitor saturation metrics such as CPU, memory, thread pool queue length, queue depth, connection pool usage, and database waits.
- Apply backpressure instead of letting the system collapse under unlimited load.

Example C# concurrency limit:

```csharp
public sealed class ReportProcessor
{
    private readonly SemaphoreSlim _semaphore = new(initialCount: 10);

    public async Task ProcessAsync(IEnumerable<ReportJob> jobs, CancellationToken cancellationToken)
    {
        var tasks = jobs.Select(async job =>
        {
            await _semaphore.WaitAsync(cancellationToken);

            try
            {
                await ProcessOneReportAsync(job, cancellationToken);
            }
            finally
            {
                _semaphore.Release();
            }
        });

        await Task.WhenAll(tasks);
    }

    private static Task ProcessOneReportAsync(ReportJob job, CancellationToken cancellationToken)
    {
        return Task.Delay(TimeSpan.FromMilliseconds(200), cancellationToken);
    }
}

public sealed record ReportJob(Guid Id);
```

The important point is not only that the code runs tasks concurrently, but that concurrency is intentionally bounded.

### Availability

Availability measures whether a system is usable when users need it. It is usually expressed as a percentage over a time period.

Common availability examples:

```text
99.0% monthly availability   = about 7.2 hours downtime per month
99.9% monthly availability   = about 43.8 minutes downtime per month
99.95% monthly availability  = about 21.9 minutes downtime per month
99.99% monthly availability  = about 4.4 minutes downtime per month
```

Availability is not only about server uptime. A service may be "up" but unusable if:

- Error rates are high.
- Latency is extreme.
- Database writes fail.
- Authentication is broken.
- A critical dependency is unavailable.
- The UI loads but checkout cannot complete.

Related concepts:

- **Reliability**: The ability to perform correctly over time.
- **Resiliency**: The ability to recover from failures.
- **Fault tolerance**: The ability to continue operating despite component failures.
- **RTO**: Recovery Time Objective, how quickly the system must recover.
- **RPO**: Recovery Point Objective, how much data loss is acceptable.
- **Graceful degradation**: Keeping critical features available while non-critical features are disabled or reduced.

Availability design patterns:

- Health checks
- Load balancing
- Multiple application instances
- Database replication
- Zone redundancy
- Multi-region deployment
- Circuit breakers
- Retries with exponential backoff and jitter
- Timeouts
- Bulkheads
- Queues for temporary buffering
- Read-only fallback mode
- Cache fallback for non-critical reads
- Disaster recovery plans

Trade-offs:

- Higher availability usually increases cost and operational complexity.
- Multi-region systems improve resilience but complicate data consistency.
- Aggressive retries can improve availability during transient failures but can also overload dependencies.
- Graceful degradation requires product decisions about which features are critical.

### Consistency

Consistency describes how correct and up to date data appears across reads, writes, replicas, caches, and distributed services.

Common consistency models:

- **Strong consistency**: A read returns the latest committed write.
- **Eventual consistency**: Replicas or read models become consistent after some delay.
- **Read-your-writes consistency**: A user sees their own updates immediately.
- **Monotonic reads**: A user does not see data move backward in time.
- **Bounded staleness**: Reads may be stale, but only within a known time or version limit.
- **Session consistency**: Consistency is preserved within a user session.
- **Transactional consistency**: A group of changes succeeds or fails as a unit.

Consistency matters because not all data has the same correctness requirements.

Examples:

```text
Strong consistency usually needed:
- Payment capture
- Bank balance update
- Inventory reservation
- Password change
- Authorization policy update

Eventual consistency often acceptable:
- Analytics dashboard
- Search index
- Email notification status
- Recommendation list
- Activity feed
- Reporting read model
```

Common architecture examples:

- A write database is strongly consistent, while read replicas may lag.
- A cache improves read performance but can return stale data.
- A message-driven workflow improves resilience but introduces eventual consistency.
- A search index may lag behind the source database.
- A CQRS read model may be temporarily behind the write model.

Best practices:

- Define consistency requirements per business operation.
- Avoid applying strong consistency everywhere by default.
- Use transactions for local database invariants.
- Use idempotency keys for retry-safe commands.
- Use outbox patterns for reliable event publishing.
- Use version numbers, ETags, or concurrency tokens for conflict detection.
- Communicate eventual consistency clearly in the UI when needed.
- Design compensation workflows for distributed operations that cannot use one transaction.

### Availability vs Consistency

In distributed systems, availability and consistency often compete during network partitions, replication lag, or dependency failures.

Example trade-off:

```text
Scenario: Product inventory service is unavailable.

Option A:
Reject checkout to avoid selling unavailable inventory.
- Better consistency
- Lower availability

Option B:
Accept orders and reconcile inventory later.
- Better availability
- Weaker consistency
- Requires compensation if inventory is insufficient
```

The right answer depends on business rules. A banking system may reject operations rather than show stale balances. A social feed may accept eventual consistency to stay available and responsive.

Interviewers often test whether candidates can reason about this instead of blindly choosing "strong consistency" or "eventual consistency" everywhere.

### Cost Targets

Cost targets define acceptable spending for building, running, scaling, and operating the system.

Cost can be expressed as:

- Monthly infrastructure budget
- Cost per request
- Cost per transaction
- Cost per customer
- Cost per GB stored
- Cost per GB transferred
- Cost per report generated
- Cost per message processed
- Engineering and operational cost

Example cost target:

```text
The file processing platform must process 10 million files per month
with total cloud cost below $8,000 per month
and average processing cost below $0.0008 per file.
```

Cost matters because many architecture choices improve performance or availability by spending more money. Good architecture balances user experience, reliability, correctness, and budget.

Cost drivers:

- Always-on compute
- Over-provisioned instances
- Expensive database tiers
- Cross-region replication
- Data transfer between regions
- Large log volume
- Inefficient queries
- Unbounded queue processing
- High cache memory size
- Excessive retries
- Excessive storage retention
- Large payloads and frequent polling

Cost optimization techniques:

- Autoscaling based on realistic metrics
- Right-sizing compute and database resources
- Reserved capacity or savings plans for predictable workloads
- Serverless or consumption-based services for bursty workloads
- Caching to reduce expensive reads
- Data lifecycle policies
- Compression and efficient payload formats
- Tiered storage
- Queue-based load leveling
- Removing unused resources
- Monitoring unit cost over time

Important trade-off:

```text
The cheapest system is not always the best system.
The most available system is not always worth the cost.
A good design justifies cost based on business value and risk.
```

### Common System Trade-Offs

System design is often about choosing the best trade-off, not finding a perfect solution.

| Target | Improving It Usually Helps | But Can Hurt |
|---|---|---|
| Throughput | More completed work per second | Latency, cost, consistency, downstream stability |
| Latency | Better user experience | Cost, complexity, cache consistency |
| Concurrency | More simultaneous work | Memory, CPU, database connections, lock contention |
| Availability | Fewer user-visible outages | Cost, complexity, consistency |
| Consistency | More correct and predictable data | Latency, availability, scalability |
| Cost efficiency | Lower spend and better unit economics | Availability, performance headroom, operational simplicity |

Examples:

- Adding a cache can improve latency, throughput, and cost, but introduces invalidation and stale data risks.
- Adding a queue can improve availability and absorb bursts, but increases end-to-end latency.
- Using read replicas can improve read throughput, but introduces replication lag.
- Using strong distributed transactions can improve consistency, but reduces scalability and increases latency.
- Deploying multi-region improves availability, but increases cost and consistency complexity.
- Limiting concurrency protects dependencies, but may reduce throughput under load.

### Architecture Decisions Driven by Targets

Different targets lead to different architecture choices.

For high throughput:

- Horizontal scaling
- Stateless application instances
- Partitioning and sharding
- Queue-based processing
- Efficient database indexes
- Batch processing
- Caching
- Avoiding unnecessary synchronous dependencies

For low latency:

- Fewer network hops
- Local or regional data placement
- Optimized queries
- Read models
- Caching
- Smaller payloads
- Parallel independent calls
- Avoiding cold starts for critical paths

For high concurrency:

- Async I/O
- Bounded concurrency
- Connection pool tuning
- Backpressure
- Bulkheads
- Avoiding shared locks
- Efficient memory usage
- Separating CPU-bound and I/O-bound workloads

For high availability:

- Redundancy
- Health checks
- Failover
- Multi-zone or multi-region deployment
- Graceful degradation
- Retry and circuit breaker policies
- Disaster recovery testing
- Operational runbooks

For stronger consistency:

- Database transactions
- Unique constraints
- Concurrency tokens
- Idempotency keys
- Single-writer patterns
- Sagas with compensation
- Outbox/inbox patterns
- Careful cache invalidation

For cost control:

- Autoscaling
- Right-sizing
- Serverless for bursty workloads
- Storage lifecycle policies
- Reducing log noise
- Efficient queries
- Avoiding over-replication
- Tracking unit cost

### Measuring and Validating Targets

Targets are only useful if they can be measured.

Important validation techniques:

- Load testing
- Stress testing
- Spike testing
- Soak testing
- Chaos testing
- Synthetic monitoring
- Real-user monitoring
- Distributed tracing
- Metrics dashboards
- Alerting based on SLOs
- Cost monitoring
- Capacity reviews

Example measurement plan:

```text
Checkout API targets:
- Throughput: 2,000 RPS for 30 minutes
- Latency: p95 below 300 ms and p99 below 1 second
- Error rate: below 0.1%
- Availability: 99.95% monthly SLO
- Consistency: no double payment and no negative inventory
- Cost: below $0.002 per successful checkout

Validation:
- Run load test before release
- Monitor p95/p99 latency per endpoint
- Track payment failure and duplicate charge metrics
- Alert when error budget burn rate is too high
- Review cost per checkout weekly
```

Best practices:

- Measure business flows, not only infrastructure metrics.
- Use percentiles instead of averages for latency.
- Track saturation before failure happens.
- Validate failure behavior, not only happy-path load.
- Define alerts based on user impact.
- Keep targets visible in architecture documents and runbooks.

### Common Mistakes

Common mistakes in interviews and real projects include:

- Saying "fast" instead of specifying latency targets.
- Saying "highly available" without an uptime target or failure model.
- Designing for total registered users instead of peak request rate.
- Ignoring p95 and p99 latency.
- Treating all data as requiring strong consistency.
- Using caching without an invalidation strategy.
- Adding retries without timeouts or circuit breakers.
- Allowing unlimited concurrency.
- Scaling the application tier while ignoring the database bottleneck.
- Ignoring cost until after the architecture is already too expensive.
- Over-engineering multi-region architecture for a low-risk internal tool.
- Under-engineering reliability for a revenue-critical workflow.
- Failing to define RTO and RPO.
- Not testing production-like traffic.
- Treating SLOs as purely operational instead of architectural requirements.

### Best Practices for Interviews

A strong interview answer should:

1. Clarify the business-critical flows.
2. Estimate traffic using assumptions.
3. Separate average, peak, and burst load.
4. Define latency using p95 and p99, not only average.
5. Define availability targets per critical workflow.
6. Identify which data needs strong consistency and which can be eventual.
7. Discuss cost as a design constraint.
8. Explain trade-offs clearly.
9. Propose architecture choices that match the targets.
10. Explain how the targets will be tested and monitored.

A practical answer pattern:

```text
For this system, I would first identify the critical user journeys.
Then I would estimate average and peak throughput, expected concurrency, and latency targets.
For consistency, I would classify each operation as strong or eventual based on business risk.
For availability, I would define an SLO and decide what can degrade during failure.
For cost, I would define a monthly budget or unit-cost target.
After that, I would choose architecture patterns such as caching, queues, partitioning,
replication, autoscaling, and failover based on those targets.
Finally, I would validate the design using load tests, failure tests, observability, and cost monitoring.
```

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

<!-- question:start:throughput-latency-targets-beginner-q01 -->
<!-- question-id:throughput-latency-targets-beginner-q01 -->
<!-- question-level:beginner -->
#### 1. What is the difference between throughput and latency?

##### Expected Answer

Throughput is the amount of work a system completes in a given time period, such as requests per second or messages per minute. Latency is how long one operation takes, such as the response time of one API request.

They are related but not the same. A system can process many requests per second but still have poor user experience if each request takes too long. A system can also respond quickly for a small number of users but fail when throughput increases.

In architecture discussions, throughput helps estimate capacity, scaling, and bottlenecks. Latency helps define user experience and responsiveness. Both should be measured under expected and peak load.

##### Key Points to Mention

- Throughput measures volume over time.
- Latency measures duration of one operation.
- High throughput does not automatically mean low latency.
- Latency should usually be measured with percentiles such as p95 and p99.
- Throughput and latency should be tested together under realistic load.

<!-- question:end:throughput-latency-targets-beginner-q01 -->

<!-- question:start:throughput-latency-targets-beginner-q02 -->
<!-- question-id:throughput-latency-targets-beginner-q02 -->
<!-- question-level:beginner -->
#### 2. What does concurrency mean in system design?

##### Expected Answer

Concurrency means how many operations are in progress at the same time. It can refer to concurrent users, concurrent API requests, concurrent database connections, concurrent background jobs, or concurrent message consumers.

Concurrency is different from throughput. Throughput measures completed operations per second, while concurrency measures active operations at a point in time. A useful approximation is that concurrency is throughput multiplied by latency. For example, if a system handles 1,000 requests per second and each request takes 200 ms on average, the system has about 200 active requests at any moment.

Concurrency matters because it affects memory usage, connection pools, thread pool behavior, locking, and dependency load.

##### Key Points to Mention

- Concurrency means simultaneous in-progress work.
- It is not the same as total registered users.
- Concurrent users and concurrent requests are different.
- Concurrency can be estimated from throughput and latency.
- Unlimited concurrency can overload databases and downstream services.

<!-- question:end:throughput-latency-targets-beginner-q02 -->

<!-- question:start:throughput-latency-targets-beginner-q03 -->
<!-- question-id:throughput-latency-targets-beginner-q03 -->
<!-- question-level:beginner -->
#### 3. What is availability, and why is it important?

##### Expected Answer

Availability measures whether a system is usable when users need it. It is often expressed as a percentage over a time period, such as 99.9% monthly availability.

Availability matters because users and businesses depend on critical workflows being accessible. However, availability should be defined per workflow. For example, checkout may require a higher availability target than recommendations or analytics.

A system can be technically running but still unavailable from a user's perspective if it returns many errors, has extreme latency, or cannot complete critical operations.

##### Key Points to Mention

- Availability is usually expressed as uptime or successful service behavior over time.
- It should be defined for critical business flows.
- Error rate and latency affect real availability.
- Higher availability usually increases cost and complexity.
- Availability design often uses redundancy, health checks, failover, retries, and graceful degradation.

<!-- question:end:throughput-latency-targets-beginner-q03 -->

<!-- question:start:throughput-latency-targets-beginner-q04 -->
<!-- question-id:throughput-latency-targets-beginner-q04 -->
<!-- question-level:beginner -->
#### 4. Why should cost be treated as a requirement?

##### Expected Answer

Cost should be treated as a requirement because architecture choices directly affect cloud spend, licensing, storage, network transfer, logging, and operational effort. A system that meets performance and availability goals but is too expensive may not be successful for the business.

Cost targets help the team choose between options such as always-on compute, serverless, caching, database tiers, multi-region deployment, reserved capacity, or queue-based processing. Cost should be connected to business value, such as monthly budget or cost per transaction.

##### Key Points to Mention

- Cost is an architectural constraint, not only a finance concern.
- Higher performance and availability often increase cost.
- Unit cost is often more useful than only total monthly cost.
- Cost targets help avoid over-engineering.
- Cost should be monitored continuously after release.

<!-- question:end:throughput-latency-targets-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

<!-- question:start:throughput-latency-targets-intermediate-q01 -->
<!-- question-id:throughput-latency-targets-intermediate-q01 -->
<!-- question-level:intermediate -->
#### 1. How would you decompose a vague requirement like "the system must handle one million users"?

##### Expected Answer

I would first clarify what "one million users" means. It could mean registered users, monthly active users, daily active users, peak active users, or concurrent users. These values lead to very different architecture decisions.

Then I would estimate behavior. For example, how many requests each active user makes per day, what percentage of traffic occurs during peak hours, and what burst multiplier is expected during events. From there, I would calculate average and peak requests per second.

I would also define latency targets, availability targets, consistency needs, and cost limits for critical workflows. For example, login, checkout, search, and reporting may have different targets.

##### Key Points to Mention

- Clarify registered users versus active users versus concurrent users.
- Estimate average, peak, and burst traffic.
- Break requirements down by business flow.
- Include latency, availability, consistency, and cost targets.
- State assumptions clearly.

<!-- question:end:throughput-latency-targets-intermediate-q01 -->

<!-- question:start:throughput-latency-targets-intermediate-q02 -->
<!-- question-id:throughput-latency-targets-intermediate-q02 -->
<!-- question-level:intermediate -->
#### 2. How do caching and queues affect throughput, latency, consistency, and cost?

##### Expected Answer

Caching can improve throughput and reduce latency by serving repeated reads from a faster storage layer. It can also reduce database load and cost. However, caching introduces consistency challenges because cached data may become stale. A good design needs an expiration, invalidation, or refresh strategy.

Queues can improve throughput handling and availability by absorbing bursts and decoupling producers from consumers. They help prevent immediate failure when downstream processing is slower. However, queues increase end-to-end latency because work may wait before processing. They also introduce eventual consistency because the user may not see results immediately.

Both patterns are useful, but they should be chosen based on business requirements rather than applied blindly.

##### Key Points to Mention

- Cache improves read latency and reduces backend load.
- Cache can return stale data.
- Queues absorb bursts and decouple services.
- Queues increase end-to-end latency.
- Both patterns often change consistency behavior.

<!-- question:end:throughput-latency-targets-intermediate-q02 -->

<!-- question:start:throughput-latency-targets-intermediate-q03 -->
<!-- question-id:throughput-latency-targets-intermediate-q03 -->
<!-- question-level:intermediate -->
#### 3. How would you choose between strong consistency and eventual consistency?

##### Expected Answer

I would choose based on business risk and user expectations. Strong consistency is appropriate when stale or conflicting data can cause financial loss, security issues, legal problems, or broken invariants. Examples include payment capture, account balance updates, inventory reservation, and permission changes.

Eventual consistency is acceptable when temporary staleness is tolerable and improves scalability, availability, or performance. Examples include search indexes, analytics dashboards, activity feeds, reports, recommendations, and notification status.

The important habit is to define consistency per operation. A system can use strong consistency for commands that protect business invariants and eventual consistency for read models or derived data.

##### Key Points to Mention

- Strong consistency improves correctness but can reduce scalability and availability.
- Eventual consistency improves scalability and availability but allows temporary staleness.
- Different workflows can use different consistency models.
- Business impact should drive the decision.
- UI and user expectations must reflect the chosen consistency model.

<!-- question:end:throughput-latency-targets-intermediate-q03 -->

<!-- question:start:throughput-latency-targets-intermediate-q04 -->
<!-- question-id:throughput-latency-targets-intermediate-q04 -->
<!-- question-level:intermediate -->
#### 4. What metrics would you monitor to know whether a system is meeting its targets?

##### Expected Answer

I would monitor metrics tied to user impact and system saturation. For throughput, I would track requests per second, messages per second, or jobs completed per minute. For latency, I would track p50, p95, and p99 per endpoint or workflow. For availability, I would track success rate, error rate, dependency failures, and SLO compliance.

For concurrency and saturation, I would monitor CPU, memory, thread pool behavior, database connection pool usage, queue depth, consumer lag, lock waits, and dependency response times. For consistency, I might track replication lag, stale read rate, duplicate processing, or reconciliation errors. For cost, I would track total cost, cost per transaction, and cost by service.

##### Key Points to Mention

- Metrics should map to business-critical flows.
- Percentile latency is more useful than only average latency.
- Error rate and latency both affect user-perceived availability.
- Saturation metrics help detect problems before failure.
- Cost should be tracked as both total spend and unit cost.

<!-- question:end:throughput-latency-targets-intermediate-q04 -->

<!-- question:start:throughput-latency-targets-intermediate-q05 -->
<!-- question-id:throughput-latency-targets-intermediate-q05 -->
<!-- question-level:intermediate -->
#### 5. Why can increasing concurrency make a system slower?

##### Expected Answer

Increasing concurrency can improve throughput up to the point where the system reaches a bottleneck. After saturation, more concurrency can make the system slower because requests compete for CPU, memory, locks, database connections, network bandwidth, and downstream service capacity.

For example, allowing unlimited parallel database calls may exhaust the connection pool or overload the database. Requests then wait longer, retry more often, and increase latency further. This can create a feedback loop where the system becomes slower even though more work is being attempted.

A better design uses bounded concurrency, rate limiting, queues, backpressure, timeouts, and circuit breakers to protect the system.

##### Key Points to Mention

- More concurrency is useful only until saturation.
- Bottlenecks can be CPU, memory, locks, database connections, or downstream dependencies.
- Unlimited concurrency can increase latency and errors.
- Backpressure protects systems under overload.
- Bounded concurrency is often better than uncontrolled parallelism.

<!-- question:end:throughput-latency-targets-intermediate-q05 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

<!-- question:start:throughput-latency-targets-advanced-q01 -->
<!-- question-id:throughput-latency-targets-advanced-q01 -->
<!-- question-level:advanced -->
#### 1. How would you design targets for a checkout system?

##### Expected Answer

I would start by identifying the critical checkout flow: cart review, inventory reservation, payment authorization, order creation, confirmation, and notification. Then I would define targets per step and for the end-to-end flow.

For throughput, I would estimate normal, peak, and burst checkout requests per second, especially during sales events. For latency, I would define p95 and p99 targets for user-facing operations. For availability, I would set a high SLO because checkout is revenue-critical. For consistency, I would require strong consistency around payment and inventory reservation to avoid duplicate charges or overselling. For cost, I would define a cost per successful checkout and monitor expensive dependencies.

The architecture might use synchronous processing for payment authorization and inventory reservation, but asynchronous processing for email confirmation, analytics, invoice generation, and recommendation updates. It might also use idempotency keys, database transactions, an outbox pattern, retries with safeguards, circuit breakers, and graceful degradation for non-critical features.

##### Key Points to Mention

- Define targets per critical workflow, not only globally.
- Payment and inventory usually need stronger consistency.
- Non-critical side effects can be asynchronous.
- Use idempotency for retry-safe operations.
- Monitor latency, error rate, duplicate charges, inventory conflicts, and cost per checkout.

<!-- question:end:throughput-latency-targets-advanced-q01 -->

<!-- question:start:throughput-latency-targets-advanced-q02 -->
<!-- question-id:throughput-latency-targets-advanced-q02 -->
<!-- question-level:advanced -->
#### 2. How would you handle p99 latency problems in a distributed system?

##### Expected Answer

I would first identify where the p99 latency is coming from using distributed tracing, endpoint-level metrics, dependency timing, database query metrics, and saturation metrics. Tail latency often comes from slow dependencies, lock contention, queueing, garbage collection, retries, cache misses, connection pool exhaustion, or cross-region calls.

Then I would reduce unnecessary sequential work, optimize slow queries, tune connection pools, add timeouts, use circuit breakers, limit retries, reduce payload size, and cache safe read-heavy data. If some dependencies are non-critical, I would make them asynchronous or optional. I would also consider bulkheads so one slow dependency does not consume all resources.

The goal is not only to improve average latency but to reduce outliers that users experience during peak load or partial failures.

##### Key Points to Mention

- Tail latency requires p95/p99 metrics and tracing.
- Slow dependencies and retries are common causes.
- Sequential calls amplify tail latency.
- Timeouts, circuit breakers, and bulkheads protect the request path.
- Non-critical work can be moved off the synchronous path.

<!-- question:end:throughput-latency-targets-advanced-q02 -->

<!-- question:start:throughput-latency-targets-advanced-q03 -->
<!-- question-id:throughput-latency-targets-advanced-q03 -->
<!-- question-level:advanced -->
#### 3. How do multi-region systems affect availability, latency, consistency, and cost?

##### Expected Answer

Multi-region systems can improve availability because the application can continue operating if one region has a major failure. They can also reduce latency for global users by serving traffic from a nearby region.

However, multi-region systems increase complexity and cost. Data replication, traffic routing, failover, observability, deployment coordination, and disaster recovery testing become harder. Consistency also becomes more difficult because writes in multiple regions can conflict or require replication delay. Strong cross-region consistency can increase latency, while eventual consistency can improve availability and performance but allow temporary stale reads.

A good answer should choose active-active, active-passive, or regional read replicas based on business requirements, not by default.

##### Key Points to Mention

- Multi-region improves resilience and can improve global latency.
- It increases cost and operational complexity.
- Strong cross-region consistency can hurt latency.
- Eventual consistency can improve availability but allows stale data.
- Failover strategy and data conflict handling must be designed explicitly.

<!-- question:end:throughput-latency-targets-advanced-q03 -->

<!-- question:start:throughput-latency-targets-advanced-q04 -->
<!-- question-id:throughput-latency-targets-advanced-q04 -->
<!-- question-level:advanced -->
#### 4. How would you balance cost optimization with high availability?

##### Expected Answer

I would first classify workloads by business criticality. Critical revenue-generating or safety-related workflows may justify higher availability and cost, while internal tools or non-critical features may use simpler, cheaper designs.

Then I would set availability targets per workflow. For example, checkout might need 99.95% or higher, while analytics exports may tolerate lower availability or delayed processing. I would use redundancy, autoscaling, backups, and failover where justified, but avoid expensive multi-region active-active architecture unless the business impact supports it.

I would also track unit economics, such as cost per transaction, and use right-sizing, autoscaling, lifecycle policies, reserved capacity, and graceful degradation. The goal is not the lowest possible cost; it is the best cost for the required reliability and business value.

##### Key Points to Mention

- Availability targets should be business-driven.
- Not every feature needs the same reliability level.
- Higher availability usually costs more.
- Graceful degradation can reduce cost while protecting critical flows.
- Track both total cost and unit cost.

<!-- question:end:throughput-latency-targets-advanced-q04 -->

<!-- question:start:throughput-latency-targets-advanced-q05 -->
<!-- question-id:throughput-latency-targets-advanced-q05 -->
<!-- question-level:advanced -->
#### 5. How do error budgets help with architecture and release decisions?

##### Expected Answer

An error budget represents the amount of unreliability allowed by an SLO. For example, if a service has a 99.9% monthly availability objective, the remaining 0.1% is the error budget.

Error budgets help balance reliability and feature delivery. If the system is within its error budget, the team may continue releasing features. If the system is burning the error budget too quickly, the team may pause risky releases and focus on reliability improvements, performance work, incident prevention, or dependency stabilization.

Architecturally, error budgets encourage teams to measure real user impact rather than aiming for unrealistic perfect reliability. They also help justify investments in automation, observability, capacity, failover, and resilience patterns.

##### Key Points to Mention

- Error budget is derived from an SLO.
- It balances reliability work and feature delivery.
- Fast error-budget burn indicates user-impacting risk.
- It supports objective release and operational decisions.
- It prevents both under-investing and over-investing in reliability.

<!-- question:end:throughput-latency-targets-advanced-q05 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
