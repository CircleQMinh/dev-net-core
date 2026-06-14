---
id: horizontal-scaling-stateless-services-and-backpressure
topic: Scalability, resilience, caching, and observability design
subtopic: Horizontal scaling, stateless services, and backpressure
category: Design & Architecture
---

## Overview

Horizontal scaling increases capacity by adding service instances rather than only making one instance larger. It works best when any healthy instance can process any request and when shared bottlenecks do not prevent throughput from increasing.

A stateless service does not keep durable request or user state only in one process. Durable state belongs in databases, object storage, distributed caches, brokers, or workflow stores. Instances can then start, stop, fail, and receive traffic without losing business state.

Horizontal scaling is not unlimited. More web instances can overwhelm:

- A database.
- A shared cache.
- An external API.
- A connection pool.
- A broker partition.
- A lock or serialized resource.

Backpressure prevents fast producers from overwhelming slower consumers. It uses bounded queues, concurrency limits, throttling, flow control, admission control, or load shedding so work does not grow without limit.

This topic matters in interviews because candidates must explain capacity bottlenecks, statelessness, autoscaling delays, graceful scale-in, consistency, and overload behavior rather than assuming that adding instances automatically increases throughput.

## Core Concepts

### Scale Up and Scale Out

**Vertical scaling**

- Add CPU, memory, or faster storage to one node.
- Simple but limited by machine size.
- Can require restart or migration.
- Keeps a larger failure domain.

**Horizontal scaling**

- Add more instances.
- Improves elasticity and potential availability.
- Requires traffic distribution and shared-state design.
- Introduces coordination and distributed-system concerns.

Most systems combine both.

### Scalability and Elasticity

**Scalability** is the ability to increase capacity as resources increase.

**Elasticity** is the ability to add and remove capacity in response to demand.

Ideal:

```text
2x instances -> close to 2x useful throughput
```

Real systems lose efficiency because of:

- Shared bottlenecks.
- Coordination.
- Lock contention.
- Uneven partitions.
- Network overhead.
- Cache warmup.
- Serial work.

Measure useful business throughput, not only CPU.

### Stateless Service Meaning

Stateless does not mean the application has no state. It means an instance does not uniquely own durable state required by later requests.

Instance-local state can safely include:

- Immutable configuration.
- Reconstructable caches.
- Connection pools.
- Temporary request data.
- Metrics buffers.

State that should be externalized:

- User sessions when continuity is required.
- Shopping carts.
- Workflow progress.
- Idempotency records.
- Job ownership.
- Uploaded files.
- Distributed locks and leases.

Loss of one instance should not lose committed business state.

### Session Affinity

Sticky sessions route a user repeatedly to one instance.

Problems:

- Uneven load.
- Difficult scale-in.
- Lost session on failure.
- Reduced failover.
- Hot users cannot spread across instances.
- Deployment complexity.

Prefer:

- Secure self-contained authentication tickets where appropriate.
- Distributed session storage.
- Durable workflow stores.
- Client-visible resource IDs.

Affinity can be pragmatic for legacy systems, but it is a constraint and should not be mistaken for horizontal scalability.

### Shared Cryptographic Keys

Instances must share keys needed to validate data created by other instances, such as ASP.NET Core Data Protection keys for authentication cookies.

If every instance uses machine-local keys:

```text
instance A issues cookie
request reaches instance B
instance B cannot decrypt cookie
```

Persist and protect shared keys appropriately, rotate them, and separate environments.

### Load Balancing

A load balancer distributes requests using:

- Round robin.
- Least connections.
- Weighted routing.
- Latency or health.
- Consistent hashing.

Health probes should remove instances that cannot safely receive traffic. Traffic distribution must consider long-lived connections, uneven request cost, and zone or region capacity.

### Bottleneck Analysis

Adding application instances does not help if the database is saturated.

Measure:

- CPU and memory.
- Thread or event-loop saturation.
- Connection pools.
- Database CPU, locks, I/O, and query latency.
- Cache throughput.
- External quotas.
- Queue partitions.
- Network bandwidth.
- Serialized critical sections.

Use load tests and production telemetry to identify the limiting resource.

### Amdahl's Law Intuition

If part of a workload is serialized, it limits total speedup.

```text
95% parallel work
5% serialized work
```

Even unlimited workers cannot eliminate the serialized portion.

Reduce coordination, partition data, remove locks, or redesign the invariant rather than adding instances indefinitely.

### Data Partitioning

Partition data and work by:

- Tenant.
- Customer.
- Aggregate ID.
- Geography.
- Time.
- Hash of a stable key.

Good partition keys:

- Distribute load.
- Preserve required locality.
- Avoid one hot partition.
- Support routing and rebalancing.

Skewed tenants or popular keys can create hotspots even when average capacity appears healthy.

### Autoscaling Signals

Possible signals:

- CPU or memory.
- Request concurrency.
- Requests per second.
- Latency.
- Queue depth.
- Oldest-message age.
- Custom business workload.
- Dependency saturation.

CPU alone can be misleading:

- I/O-bound services may saturate connections with low CPU.
- A downstream dependency may be overloaded.
- High CPU may be efficient work rather than distress.

Use signals tied to workload and service objectives.

### Autoscaling Delay

Scale-out is not immediate:

```text
detect demand
  -> make decision
  -> provision instance
  -> start process
  -> load configuration
  -> warm caches and connections
  -> pass readiness
  -> receive traffic
```

Keep headroom for sudden bursts and use queues, admission control, or pre-scaling for predictable events.

### Scale-In and Graceful Shutdown

Before terminating an instance:

1. Stop sending new work.
2. Mark it unready.
3. Drain in-flight requests.
4. Stop receiving new queue messages.
5. Complete or safely abandon leased work.
6. Flush critical telemetry.
7. Respect a bounded shutdown timeout.

Jobs need leases, visibility timeouts, or checkpoints so another worker can resume.

### Readiness, Liveness, and Startup

**Startup**

- Has initialization completed?

**Readiness**

- Can this instance safely receive traffic now?

**Liveness**

- Is the process making progress, or should it restart?

Do not make liveness fail merely because a shared dependency is temporarily down. Restarting every instance can amplify the incident. Readiness and degraded operation depend on whether the service can handle useful traffic.

### Backpressure

Backpressure communicates or enforces that producers must slow down because downstream capacity is constrained.

Mechanisms:

- Bounded channel.
- Semaphore or concurrency limiter.
- Broker prefetch limits.
- TCP flow control.
- Reactive demand signals.
- HTTP `429 Too Many Requests`.
- Queue capacity.
- Consumer pause.
- Admission control.

Without backpressure, work accumulates in memory, threads, sockets, queues, or databases until latency and failure cascade.

### Bounded Channels in .NET

```csharp
var channel = Channel.CreateBounded<WorkItem>(
    new BoundedChannelOptions(capacity: 1_000)
    {
        FullMode = BoundedChannelFullMode.Wait,
        SingleReader = false,
        SingleWriter = false
    });
```

Full-mode choices include:

- Wait and slow producers.
- Reject new work.
- Drop newest.
- Drop oldest.

Choose from business semantics. Dropping a payment request is different from dropping an outdated telemetry sample.

### Load Shedding

Load shedding rejects lower-value work to preserve critical functions.

Examples:

- Reject optional recommendations.
- Reduce expensive response detail.
- Disable exports.
- Return cached data.
- Reject anonymous traffic before authenticated traffic.
- Sample low-value telemetry.

Use explicit priority and fairness rules. Avoid silently dropping committed business work.

### Throttling

Throttling limits work by:

- User.
- Tenant.
- API key.
- IP or network.
- Endpoint.
- Workload cost.
- Global capacity.

Return:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 10
```

Clients should back off with jitter. Server limits must prevent one noisy tenant from consuming all capacity.

### Backpressure Versus Buffering

Buffering absorbs short bursts. Backpressure prevents unbounded accumulation.

```text
bounded buffer has space -> accept
buffer near capacity -> slow or reject
buffer full -> explicit overload behavior
```

An unbounded queue is not backpressure.

### Queue Backlog and Staleness

For time-sensitive work, old messages may no longer be useful.

Define:

- Business deadline.
- Maximum queue age.
- Cancellation.
- Expiration.
- Priority.
- What to do with stale work.

Processing obsolete work wastes capacity and delays current work.

### Fan-Out and Downstream Multiplication

One request can generate many downstream calls:

```text
1 request
  -> 20 parallel service calls
  -> each performs 5 database queries
```

Horizontal scaling at the edge multiplies downstream pressure.

Bound fan-out, batch requests, cache appropriately, and include downstream cost in admission decisions.

### Stateless Background Workers

Workers can scale horizontally when work ownership is external:

- Queue lease.
- Broker lock.
- Partition assignment.
- Database job claim.

Workers need:

- Idempotent processing.
- Checkpoints.
- Visibility timeout renewal.
- Graceful shutdown.
- Poison-message handling.
- Per-key ordering where required.

### Distributed Coordination

Avoid global locks when possible. Prefer:

- Partition ownership.
- Optimistic concurrency.
- Idempotency.
- Commutative updates.
- Leases with expiry.
- Single-writer per key.

Distributed locks add failure and timeout semantics. A lock holder can pause or lose connectivity, so fencing tokens may be required to stop stale owners from writing.

### Deployment and Warmup

New instances can be slower because:

- JIT compilation.
- Empty caches.
- New connections.
- Model loading.
- DNS and certificate work.

Use readiness gates, controlled ramp-up, minimum replicas, prewarming, and connection reuse. Do not route full production traffic before initialization completes.

### State and Multi-Region Scaling

Stateless compute can run in multiple regions, but state consistency remains difficult.

Decide:

- Active-active or active-passive.
- Data ownership.
- Replication delay.
- Conflict resolution.
- Session routing.
- Regional failover.
- Recovery point and recovery time objectives.

Compute scaling cannot make a single-region database globally available.

### Observability

Measure:

- Throughput per instance and globally.
- Scaling efficiency.
- Instance count and startup time.
- CPU, memory, thread pool, connections.
- Request concurrency and latency.
- Rejection and throttling rates.
- Queue depth and oldest age.
- Partition skew.
- Database saturation.
- Graceful shutdown failures.

Correlate scaling decisions with user outcomes and downstream load.

### Testing

Test:

- Sudden burst and sustained overload.
- Scale-out lag.
- Cache-cold new instances.
- Uneven tenant load.
- Dependency bottleneck.
- Queue full behavior.
- Instance termination with in-flight work.
- Zone failure.
- Scale-in during long jobs.
- Recovery after load drops.

Capacity tests should find the knee where latency rises sharply before catastrophic failure.

### Common Mistakes

Common failures include:

- Calling a service stateless while keeping sessions in memory.
- Depending on sticky sessions.
- Adding web servers while the database is saturated.
- Scaling consumers only from queue count.
- Using unbounded in-memory queues.
- Ignoring startup and scale-out delay.
- Failing liveness on every dependency outage.
- Dropping committed work without semantics.
- Allowing one tenant to consume global capacity.
- Terminating workers without drain or leases.
- Using distributed locks without expiry and fencing.
- Measuring instance count instead of useful throughput.

### Best-Practice Design Process

1. Define workload, SLOs, and capacity units.
2. Externalize durable and session state.
3. Ensure any instance can handle any request.
4. Identify shared bottlenecks and partition where needed.
5. Select autoscaling signals tied to workload.
6. Maintain headroom for scaling delay.
7. Bound concurrency, fan-out, and queues.
8. Define throttling, fairness, and load shedding.
9. Implement readiness and graceful drain.
10. Test bursts, hotspots, dependency limits, and scale-in.
11. Measure scaling efficiency and user impact.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is horizontal scaling?

<!-- question:start:horizontal-scaling-stateless-services-and-backpressure-beginner-q01 -->
<!-- question-id:horizontal-scaling-stateless-services-and-backpressure-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Horizontal scaling adds or removes service instances to match demand. A load balancer distributes work across them. It improves elasticity and potential availability, but throughput increases only if shared dependencies, locks, partitions, and state do not remain bottlenecks.

##### Key Points to Mention

- It differs from adding resources to one machine.
- Any healthy instance should handle any request.
- Shared state must be externalized.
- Measure useful throughput per added resource.

<!-- question:end:horizontal-scaling-stateless-services-and-backpressure-beginner-q01 -->

#### What does it mean for a service to be stateless?

<!-- question:start:horizontal-scaling-stateless-services-and-backpressure-beginner-q02 -->
<!-- question-id:horizontal-scaling-stateless-services-and-backpressure-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A stateless instance does not uniquely hold durable state required for future requests. Business data, sessions, jobs, and workflows live in shared durable systems. Local caches and connection pools are acceptable because they can be recreated after restart.

##### Key Points to Mention

- Stateless does not mean the overall system has no state.
- Instance loss must not lose committed business data.
- Sticky sessions usually signal local state coupling.
- Shared encryption keys may be required across instances.

<!-- question:end:horizontal-scaling-stateless-services-and-backpressure-beginner-q02 -->

#### What is backpressure?

<!-- question:start:horizontal-scaling-stateless-services-and-backpressure-beginner-q03 -->
<!-- question-id:horizontal-scaling-stateless-services-and-backpressure-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Backpressure slows or rejects producers when downstream consumers cannot safely keep up. It prevents unbounded growth of queued work, memory, connections, and latency. Mechanisms include bounded queues, concurrency limits, throttling, broker prefetch limits, and `429` responses.

##### Key Points to Mention

- An unbounded queue is not backpressure.
- Overload behavior must be explicit.
- Different workloads may wait, reject, or drop.
- Backpressure protects downstream dependencies.

<!-- question:end:horizontal-scaling-stateless-services-and-backpressure-beginner-q03 -->

#### Why can sticky sessions limit scalability?

<!-- question:start:horizontal-scaling-stateless-services-and-backpressure-beginner-q04 -->
<!-- question-id:horizontal-scaling-stateless-services-and-backpressure-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Sticky sessions bind a client to one instance, causing uneven load, weaker failover, difficult scale-in, and possible session loss when the instance fails. External session storage or secure portable session tickets let any instance serve the client.

##### Key Points to Mention

- High-volume users can create hot instances.
- Affinity reduces deployment flexibility.
- It may be a temporary legacy compromise.
- Externalizing state has latency and availability trade-offs.

<!-- question:end:horizontal-scaling-stateless-services-and-backpressure-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you choose autoscaling signals?

<!-- question:start:horizontal-scaling-stateless-services-and-backpressure-intermediate-q01 -->
<!-- question-id:horizontal-scaling-stateless-services-and-backpressure-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Choose signals tied to constrained capacity and user outcomes, such as request concurrency, latency, queue age, throughput, and dependency saturation. CPU can supplement them but may miss I/O bottlenecks. Include minimum and maximum instances, cooldown, headroom, and separate scale-out from scale-in sensitivity.

##### Key Points to Mention

- Scaling has detection and startup delay.
- Queue age is often more meaningful than count.
- Maximum scale should respect downstream capacity.
- Prevent oscillation with stable windows and cooldowns.

<!-- question:end:horizontal-scaling-stateless-services-and-backpressure-intermediate-q01 -->

#### How should a service handle graceful scale-in?

<!-- question:start:horizontal-scaling-stateless-services-and-backpressure-intermediate-q02 -->
<!-- question-id:horizontal-scaling-stateless-services-and-backpressure-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Mark the instance unready, stop new traffic and message intake, drain in-flight requests, complete or safely abandon leased jobs, flush required telemetry, and terminate within a bounded grace period. Long work should use checkpoints and leases so another instance can resume.

##### Key Points to Mention

- Liveness should not be used to initiate normal drain.
- Shutdown cancellation must propagate.
- Broker locks may need renewal or abandonment.
- Test deployment and autoscaler termination paths.

<!-- question:end:horizontal-scaling-stateless-services-and-backpressure-intermediate-q02 -->

#### How do bounded queues improve overload behavior?

<!-- question:start:horizontal-scaling-stateless-services-and-backpressure-intermediate-q03 -->
<!-- question-id:horizontal-scaling-stateless-services-and-backpressure-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A bounded queue sets a maximum amount of waiting work and forces a policy when full: wait, reject, drop, or replace. This keeps memory and latency finite and signals producers to slow down. The policy must match business value and deadline; durable critical work should not be silently dropped.

##### Key Points to Mention

- Capacity should be derived from latency and memory budgets.
- Queue length hides age distribution.
- Separate priorities to prevent starvation.
- Full-queue events require telemetry.

<!-- question:end:horizontal-scaling-stateless-services-and-backpressure-intermediate-q03 -->

#### Why can adding instances reduce reliability?

<!-- question:start:horizontal-scaling-stateless-services-and-backpressure-intermediate-q04 -->
<!-- question-id:horizontal-scaling-stateless-services-and-backpressure-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

More instances can create more database connections, retries, cache misses, fan-out, and concurrent writes. They can exceed downstream quotas or increase contention without increasing useful throughput. Scaling policy must include downstream budgets, connection limits, and bottleneck telemetry.

##### Key Points to Mention

- Autoscaling can amplify a dependency incident.
- Cold instances create warmup load.
- Shared bottlenecks cap scaling efficiency.
- Scale different workloads independently.

<!-- question:end:horizontal-scaling-stateless-services-and-backpressure-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design fairness and noisy-neighbor protection?

<!-- question:start:horizontal-scaling-stateless-services-and-backpressure-advanced-q01 -->
<!-- question-id:horizontal-scaling-stateless-services-and-backpressure-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Partition quotas and concurrency by tenant or workload class, enforce global safety limits, use weighted queues or schedulers, and isolate exceptionally large tenants when justified. Charge by request cost rather than count where operations differ. Monitor rejection, latency, and utilization per tenant without unbounded metric cardinality.

##### Key Points to Mention

- Per-tenant limits protect shared capacity.
- Reserved capacity improves critical-work guarantees.
- Strict isolation can waste idle resources.
- Fairness policy is a product and architecture decision.

<!-- question:end:horizontal-scaling-stateless-services-and-backpressure-advanced-q01 -->

#### How would you scale a queue consumer safely?

<!-- question:start:horizontal-scaling-stateless-services-and-backpressure-advanced-q02 -->
<!-- question-id:horizontal-scaling-stateless-services-and-backpressure-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Scale from arrival rate, processing rate, oldest-message age, and business deadline, while capping total concurrency to downstream capacity. Partition work for parallelism, preserve per-key ordering when required, tune prefetch, and use idempotent handlers. Reduce scale when throttling, lock contention, or database latency indicates saturation.

##### Key Points to Mention

- Queue depth without processing rate is ambiguous.
- Scale-out time must fit the backlog deadline.
- Poison messages and hot partitions distort metrics.
- Consumer scale and database connections must be coordinated.

<!-- question:end:horizontal-scaling-stateless-services-and-backpressure-advanced-q02 -->

#### How would you design overload behavior for a public API?

<!-- question:start:horizontal-scaling-stateless-services-and-backpressure-advanced-q03 -->
<!-- question-id:horizontal-scaling-stateless-services-and-backpressure-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Reject excessive work near the edge before expensive parsing or dependency calls, partition quotas by identity and endpoint cost, cap concurrency, and return `429` or `503` with bounded retry guidance. Shed optional features, preserve critical authenticated operations, and avoid retries that amplify load. Autoscale within downstream-safe limits.

##### Key Points to Mention

- Admission control should occur early.
- Load shedding is preferable to total collapse.
- Clients need backoff and jitter.
- Protect recovery from a queued traffic surge.

<!-- question:end:horizontal-scaling-stateless-services-and-backpressure-advanced-q03 -->

#### How would you prove that a service scales horizontally?

<!-- question:start:horizontal-scaling-stateless-services-and-backpressure-advanced-q04 -->
<!-- question-id:horizontal-scaling-stateless-services-and-backpressure-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Run repeatable load tests at increasing instance counts and compare useful throughput, latency percentiles, error rate, cost, and downstream saturation. Include cold starts, skewed partitions, cache misses, failure and scale-in. Determine the scaling efficiency and identify the point where a shared resource or coordination cost dominates.

##### Key Points to Mention

- Linear instance growth does not imply linear throughput.
- Test representative request-cost distribution.
- Measure SLO compliance, not only maximum throughput.
- Use results to set autoscaling bounds and capacity headroom.

<!-- question:end:horizontal-scaling-stateless-services-and-backpressure-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
