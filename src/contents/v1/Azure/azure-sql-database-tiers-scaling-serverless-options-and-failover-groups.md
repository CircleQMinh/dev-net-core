---
id: azure-sql-database-tiers-scaling-serverless-options-and-failover-groups
topic: Azure data, storage, and caching services
subtopic: Azure SQL Database tiers, scaling, serverless options, and failover groups
category: Azure
---

## Overview

Azure SQL Database is a fully managed relational database service based on the SQL Server engine. Microsoft operates the infrastructure, database engine patching, automated backups, and built-in high availability, while the customer remains responsible for schema design, query performance, security configuration, data access, capacity choices, and disaster-recovery planning.

Choosing an Azure SQL Database configuration involves several independent decisions:

- **Purchasing model:** DTU or vCore.
- **Service tier:** Basic, Standard, and Premium in the DTU model, or General Purpose, Business Critical, and Hyperscale in the vCore model.
- **Compute tier:** Provisioned or serverless where supported.
- **Deployment model:** Single database or elastic pool.
- **Availability design:** Local high availability, zone redundancy, backups, geo-replication, and failover groups.
- **Scaling strategy:** Query tuning, vertical compute scaling, storage scaling, read scale-out, elastic pooling, partitioning, or sharding.

There is no universally best tier. The correct choice depends on:

- CPU, memory, data I/O, and transaction-log requirements.
- Database size and growth.
- Read/write ratio.
- Latency sensitivity.
- Usage predictability.
- Recovery point objective, or RPO.
- Recovery time objective, or RTO.
- Region and zone resilience.
- Feature requirements.
- Cost constraints.

For interviews, candidates should be able to explain why a workload belongs in General Purpose, Business Critical, Hyperscale, serverless, or an elastic pool. They should also understand that changing compute can briefly interrupt connections, that failover groups use asynchronous geo-replication, and that application retry logic and end-to-end disaster-recovery testing remain necessary.

## Core Concepts

### Azure SQL Database as a PaaS Service

Azure SQL Database provides database-as-a-service capabilities. The service manages:

- Database engine installation and patching.
- Infrastructure replacement.
- Automated backups.
- Built-in high availability.
- Monitoring integration.
- Point-in-time restore capabilities.
- Service-level resource governance.

The customer manages:

- Tables, indexes, constraints, and stored procedures.
- Query design and performance.
- Authentication and authorization.
- Network exposure.
- Encryption and auditing configuration.
- Retention and disaster-recovery requirements.
- Application connection and retry behavior.

Azure SQL Database is not the same as running SQL Server on a virtual machine. It reduces infrastructure ownership but also limits operating-system access and some instance-level features. If an application requires full SQL Server instance control, unsupported extensions, or operating-system access, SQL Server on Azure Virtual Machines or Azure SQL Managed Instance might be a better fit.

### Logical Servers

A logical server is a management boundary for Azure SQL databases. It provides:

- A server-level DNS name.
- Firewall and networking configuration.
- Microsoft Entra administration.
- Auditing and threat-protection settings.
- A scope for databases, elastic pools, and failover groups.

It is not a customer-managed virtual machine or a traditional SQL Server instance. Databases on the same logical server do not automatically share compute unless they belong to the same elastic pool.

### DTU Purchasing Model

A database transaction unit, or DTU, is a bundled measure of:

- CPU.
- Memory.
- Data reads and writes.
- Transaction-log throughput.

The DTU model offers:

- **Basic:** Small and infrequently used workloads.
- **Standard:** General workloads with moderate performance needs.
- **Premium:** Higher I/O performance and features for demanding workloads.

DTUs simplify purchasing because the resource mix is packaged into a service objective. The trade-off is less transparency and less control over the individual resource dimensions.

DTU utilization is constrained by the busiest governed dimension. A database can appear CPU-light but still be throttled by data I/O or log-write limits.

Useful indicators include:

```sql
SELECT
    end_time,
    avg_cpu_percent,
    avg_data_io_percent,
    avg_log_write_percent,
    max_worker_percent,
    max_session_percent
FROM sys.dm_db_resource_stats
ORDER BY end_time DESC;
```

Scaling DTUs can address a genuine resource ceiling, but it should not replace query and index analysis.

### vCore Purchasing Model

A virtual core, or vCore, represents a logical CPU. The vCore model exposes resource choices more directly:

- Number of vCores.
- Memory characteristics.
- Hardware family where supported.
- Compute tier.
- Storage allocation and performance characteristics.
- Service tier.

The vCore model is often preferred when teams need:

- Easier mapping from an existing SQL Server workload.
- Greater resource transparency.
- Azure Hybrid Benefit.
- Reserved capacity pricing.
- Serverless compute.
- Hyperscale.
- More granular hardware and compute choices.

The vCore model does not eliminate performance testing. Two workloads with the same CPU requirement can have very different memory, log, or I/O behavior.

### DTU Versus vCore

| Concern | DTU model | vCore model |
| --- | --- | --- |
| Resource expression | Bundled DTU or eDTU | vCores, memory, storage, hardware |
| Simplicity | Higher | More explicit choices |
| Serverless | Not supported | Supported where available |
| Hyperscale | Not supported | Supported |
| Azure Hybrid Benefit | Not available | Available where eligible |
| Best fit | Simple sizing and existing DTU workloads | Transparent sizing and advanced options |

Do not choose solely by comparing a DTU count with a vCore count. Benchmark the real workload and measure CPU, memory pressure, data I/O, log rate, workers, sessions, latency, and storage growth.

### General Purpose Tier

General Purpose is the default vCore tier for many business workloads. It separates compute from remote storage.

Typical characteristics include:

- Balanced cost and performance.
- Remote premium storage.
- Built-in high availability.
- Optional zone redundancy in supported configurations.
- Provisioned and serverless compute options.
- Storage latency suitable for many transactional applications.

General Purpose is a strong starting point when:

- The workload does not require consistently very low storage latency.
- Database size is within supported limits.
- A built-in readable secondary is not a core requirement.
- Cost efficiency matters more than maximum I/O performance.

A compute failover can start with a cold cache because the replacement compute node must rebuild memory state from storage. Applications should tolerate transient connection failures.

### Business Critical Tier

Business Critical uses multiple database engine replicas with local SSD storage. It targets workloads that require:

- Low and predictable I/O latency.
- High transaction throughput.
- Fast local high-availability failover.
- A built-in read-only replica for read scale-out.
- Features such as In-Memory OLTP where applicable.
- Stronger resilience characteristics.

Business Critical costs more because it maintains multiple replicas and uses local high-performance storage. It is not justified simply because an application is "important." The workload should have measurable latency, throughput, availability, or feature requirements that General Purpose cannot meet cost-effectively.

### Hyperscale Tier

Hyperscale uses a cloud-native architecture that separates compute, log processing, page serving, and storage. It is designed for:

- Very large databases.
- Rapid storage growth.
- Fast backup and restore behavior independent of traditional full database copies.
- Fast compute scaling.
- Multiple read scale-out replicas.
- Workloads that benefit from independently scalable compute and storage.

Current supported configurations can reach very large database sizes, including up to 128 TB for supported single-database scenarios. Exact limits depend on configuration and evolve, so architecture decisions should verify current regional and hardware constraints.

Hyperscale can provide:

- High-availability replicas selected according to resilience needs.
- Named replicas with independently sized compute for read workloads.
- Geo-replicas for regional resilience.
- Serverless compute in supported configurations.

Hyperscale is not only for enormous databases, but it adds architectural and cost considerations. Evaluate:

- Replica cost.
- Migration and reverse-migration constraints.
- Feature compatibility.
- Backup retention behavior.
- Geo-replication design.
- Workload sensitivity to its distributed storage architecture.

### Provisioned Compute

Provisioned compute reserves a configured compute size continuously, independent of actual utilization. It is a good fit for:

- Predictable workloads.
- Sustained utilization.
- Low tolerance for warm-up delay.
- Stable performance requirements.
- Elastic pools.

Provisioned compute is billed according to the capacity provisioned. Cost optimization usually involves right-sizing, reservations, Azure Hybrid Benefit where eligible, and scaling schedules for predictable environments.

### Serverless Compute

Serverless automatically scales compute within configured minimum and maximum vCore limits. Billing reflects compute used per second, subject to the configured minimum, plus storage costs.

Serverless is well suited to:

- Intermittent single-database workloads.
- Unpredictable bursts.
- Development or low-duty-cycle applications.
- New applications without reliable sizing history.

Important configuration includes:

- Minimum vCores.
- Maximum vCores.
- Auto-pause delay where supported.
- Whether auto-pause is enabled.

Auto-pause and auto-resume are currently supported for serverless databases in General Purpose, not Hyperscale. Hyperscale serverless can autoscale compute but does not provide the same auto-pause behavior.

When a General Purpose serverless database is paused:

- Compute billing stops.
- Storage billing continues.
- The next connection triggers resume.
- The application can experience resume latency.
- Memory caches must warm again.

Features such as active geo-replication, failover groups, and some retention or scheduling features prevent auto-pause even though autoscaling can still operate.

Open sessions are a common reason a database does not pause. Connection pools, health checks, monitoring, and administrative tools can generate enough activity to keep it online.

### Serverless Trade-Offs

Serverless is not automatically cheaper. It can cost more than provisioned compute when:

- Average utilization is consistently high.
- The configured minimum is too large.
- Background activity prevents pause.
- Frequent cache reclamation increases query work.
- Resume latency causes timeouts or poor user experience.

Before choosing serverless, model:

```text
Compute cost while active
+ minimum compute floor
+ storage
+ backup storage
+ expected active hours
+ operational impact of warm-up
```

Load testing should include first-request behavior after inactivity, not only steady-state throughput.

### Elastic Pools

An elastic pool lets multiple databases share a configured pool of compute and storage resources. Each database can consume resources within per-database minimum and maximum limits.

Elastic pools are effective for:

- Many tenant databases.
- Low average utilization per database.
- Usage spikes that occur at different times.
- A need for predictable aggregate cost.

Pools are a poor fit when:

- Most databases are busy at the same time.
- One database has consistently high utilization.
- Tenants require strict dedicated performance.
- Aggregate log or I/O demand regularly reaches pool limits.

The main risk is the noisy-neighbor effect. Per-database maximums protect the pool, while minimums reserve capacity but can reduce consolidation efficiency.

Monitor both pool-level and database-level metrics. A database may be throttled by its own maximum even when the pool has capacity, or the pool may be saturated while individual databases appear moderate.

### Vertical Scaling

Vertical scaling changes the service objective, tier, or compute size. It can increase or decrease:

- CPU.
- Memory.
- I/O capacity.
- Log throughput.
- Worker and session limits.
- Storage capabilities.

Azure performs most of the scale operation online, but the final switchover can terminate open connections and roll back uncommitted transactions. Applications need transient-fault retry logic.

A safe scaling plan includes:

1. Identify the actual bottleneck.
2. Validate the target tier supports required features.
3. Check regional capacity and quotas.
4. Avoid unnecessary long-running transactions.
5. Scale during a controlled window when risk warrants it.
6. Monitor connection failures and performance.
7. Keep a rollback or scale-down plan.

Scaling is not a substitute for fixing scans, missing indexes, excessive chatty queries, or poor transaction design.

### Application Retry Logic

Database connections can be interrupted by scaling, maintenance, failover, throttling, or transient network conditions. Retry logic should:

- Retry only transient failures.
- Use bounded exponential backoff with jitter.
- Open a new connection for the retry.
- Limit total attempts and elapsed time.
- Preserve cancellation and request deadlines.
- Avoid automatically replaying unsafe business operations.

For a transaction that fails after an uncertain commit outcome, the application needs idempotency or reconciliation. Blindly retrying a payment or order operation can create duplicates.

### Storage Scaling

Storage decisions include:

- Maximum configured data size.
- Actual allocated storage.
- Data and log growth.
- `tempdb` limits.
- Backup storage.
- Long-term retention.

In General Purpose and Business Critical, billing and performance behavior can depend on configured maximum storage. In Hyperscale, storage grows automatically and is billed based on allocated data storage.

Monitor both used and allocated space. Deleting rows does not necessarily return allocated file space immediately, and shrinking files can be disruptive and should not be routine maintenance.

### Read Scale-Out

Read-heavy workloads can be scaled by directing read-only queries to replicas:

- Business Critical provides a readable secondary.
- Hyperscale supports high-availability and named replicas.
- Failover groups provide a read-only listener for the geo-secondary.

Read replicas are eventually consistent with the primary to varying degrees. Do not send operations that require immediate read-after-write consistency to a lagging geo-secondary.

Connection strings commonly signal read intent:

```text
ApplicationIntent=ReadOnly
```

The application should separate read-only and read-write data-access paths explicitly.

### Scaling Beyond One Database

If one database cannot meet the workload cost-effectively, options include:

- Partitioning large tables.
- Archiving old data.
- Caching repeated reads.
- Read replicas.
- Tenant-per-database architecture.
- Sharding by tenant, geography, or another stable key.
- Moving analytical workloads to a separate platform.

Sharding adds routing, cross-shard query, transaction, schema deployment, and rebalancing complexity. It should follow measured limits, not speculative scale concerns.

### Built-In High Availability Versus Disaster Recovery

Built-in high availability protects against local infrastructure failures. Zone redundancy improves resilience to availability-zone failures. Neither automatically provides complete recovery from a regional outage.

Disaster recovery may require:

- Active geo-replication or failover groups.
- Application deployment in another region.
- Replicated storage and messaging services.
- Regional networking and DNS.
- Secrets and configuration.
- Tested operational procedures.

Backups protect against corruption, accidental deletion, and point-in-time recovery. They do not provide the same RTO as a warm geo-secondary.

### Failover Groups

A failover group manages geo-replication and failover for one or more databases between logical servers in different Azure regions.

It provides stable DNS listener names:

- **Read-write listener:** Routes to the current primary.
- **Read-only listener:** Routes read workloads to the configured secondary.

After failover, Azure updates listener DNS records. Applications still need:

- Connection retry logic.
- Sensible DNS caching.
- Region-ready application components.
- Network access to both logical servers.
- Credentials and identities that work in both regions.

Failover groups are a convenience over active geo-replication. They do not make the entire application multi-region.

### Planned and Forced Failover

A planned failover synchronizes the databases before switching roles and is intended to avoid data loss when both sides are reachable.

A forced failover promotes the secondary without waiting for full synchronization. It is used when the primary is unavailable and can lose recent transactions because geo-replication is asynchronous.

This distinction connects directly to:

- **RPO:** Maximum acceptable data loss.
- **RTO:** Maximum acceptable recovery time.

If the business requires zero data loss during a regional disaster, asynchronous cross-region replication may not satisfy that requirement. The architecture or business process must address the gap explicitly.

### Customer-Managed and Microsoft-Managed Failover Policies

Customer-managed failover is the recommended policy for most designs because the organization controls when to fail over after evaluating application health and dependencies.

Microsoft-managed failover applies to widespread regional events and can occur only after its configured grace period and service evaluation. It is not a fast per-application health mechanism. The application must tolerate an extended outage and potential data loss if this model is selected.

Disaster-recovery automation should make the decision process explicit:

- What signals declare the primary region unavailable?
- Who or what authorizes forced failover?
- How is replication lag evaluated?
- Which application components move with the database?
- How is split-brain or accidental failback avoided?

### Failover and Application Consistency

All databases in a failover group switch as a unit, but this does not create distributed transactions across databases. Applications using several databases should ensure that the group boundary aligns with the recovery unit.

After failover:

- DNS caches may briefly point to the previous primary.
- Existing connections fail and must reconnect.
- Read-only workloads may have different routing.
- Cross-region latency can increase if application components did not move.
- Recent asynchronous writes can be absent after forced failover.

Failback is another migration event and must be planned and tested, not assumed to be automatic and risk-free.

### Security and Networking

Secure Azure SQL Database design normally includes:

- Microsoft Entra authentication where practical.
- Managed identities for workloads.
- Least-privilege database permissions.
- Private endpoints for private access requirements.
- Disabled or restricted public network access.
- Encryption in transit.
- Transparent Data Encryption.
- Auditing and threat detection.
- Key management aligned with compliance requirements.

A failover group requires equivalent networking and identity configuration in both regions. A secondary that is replicated correctly but unreachable by the application does not satisfy disaster-recovery objectives.

### Monitoring and Capacity Management

Monitor:

- CPU and memory pressure.
- Data I/O and log-write utilization.
- Worker and session limits.
- Deadlocks and blocking.
- Query duration and regressions.
- Storage growth.
- Serverless active and paused behavior.
- Elastic pool utilization.
- Geo-replication lag.
- Failed connections and throttling.
- Backup and restore tests.

Use Query Store, Query Performance Insight, Azure Monitor metrics, dynamic management views, alerts, and workload-level service indicators.

Do not scale from CPU alone. High latency might result from blocking, an inefficient plan, log throughput, or application round trips.

### Common Mistakes

Common mistakes include:

- Selecting Business Critical based only on business importance.
- Assuming serverless always pauses or is always cheaper.
- Leaving connection pools or monitoring sessions that prevent auto-pause.
- Scaling without transient retry logic.
- Treating a failover group as complete application disaster recovery.
- Assuming forced failover cannot lose data.
- Sending consistency-sensitive reads to a geo-secondary.
- Putting uniformly busy databases into an elastic pool.
- Scaling compute before investigating query and index problems.
- Ignoring log-write, worker, session, or storage limits.
- Testing only initial failover and never failback.
- Configuring the secondary region without equivalent networking and identity.

### Best-Practice Selection Process

A practical selection process is:

1. Measure the workload over representative business cycles.
2. Identify CPU, memory, I/O, log, storage, and concurrency requirements.
3. Define latency, RPO, RTO, and availability targets.
4. Start with the simplest tier that meets measurable requirements.
5. Choose serverless only for suitable duty cycles and warm-up tolerance.
6. Use elastic pools when database peaks are statistically independent.
7. Add read replicas or Hyperscale for demonstrated scale requirements.
8. Implement retries and idempotency before relying on online scaling.
9. Design disaster recovery for the complete application.
10. Test scaling, failover, failback, restore, and regional connectivity.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the difference between the DTU and vCore purchasing models?

<!-- question:start:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-beginner-q01 -->
<!-- question-id:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

The DTU model bundles CPU, memory, data I/O, and log throughput into a single DTU measure. It is simpler to purchase but provides less visibility into the individual resource dimensions.

The vCore model exposes compute, storage, hardware, and service-tier choices more directly. It supports options such as Azure Hybrid Benefit, reserved capacity, serverless compute, and Hyperscale. The correct model should be selected through workload measurement and cost comparison rather than a direct DTU-to-vCore number conversion.

##### Key Points to Mention

- DTU is a bundled resource measure.
- vCore offers greater transparency and configuration control.
- Serverless and Hyperscale require the vCore model.
- Benchmark the real workload before changing models.

<!-- question:end:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-beginner-q01 -->

#### When would you choose General Purpose, Business Critical, or Hyperscale?

<!-- question:start:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-beginner-q02 -->
<!-- question-id:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

General Purpose fits many standard business workloads that need balanced cost and performance. Business Critical fits workloads requiring consistently low storage latency, high I/O performance, fast local failover, a built-in readable replica, or tier-specific features. Hyperscale fits very large or rapidly growing databases, fast scaling, and extensive read scale-out requirements.

The selection should be based on measured latency, throughput, storage, availability, recovery, and feature needs. Business importance alone does not justify Business Critical.

##### Key Points to Mention

- General Purpose is the balanced default for many workloads.
- Business Critical uses local SSD replicas for low latency and resilience.
- Hyperscale separates compute and storage for large scale.
- Use measurable requirements rather than tier names.

<!-- question:end:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-beginner-q02 -->

#### What is Azure SQL Database serverless compute?

<!-- question:start:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-beginner-q03 -->
<!-- question-id:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Serverless is a vCore compute tier for single databases that automatically scales compute between configured minimum and maximum limits. Billing is based on compute used per second, subject to the minimum, plus storage.

General Purpose serverless can auto-pause after an inactivity delay and resume when activity returns. Resume and cache warm-up can add latency. Hyperscale serverless supports autoscaling, but auto-pause and auto-resume are currently limited to General Purpose.

##### Key Points to Mention

- Serverless autoscaling stays within customer-defined limits.
- It fits intermittent and unpredictable workloads.
- Storage is billed even while compute is paused.
- Auto-pause support and warm-up behavior must be verified.

<!-- question:end:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-beginner-q03 -->

#### What problem does an elastic pool solve?

<!-- question:start:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-beginner-q04 -->
<!-- question-id:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

An elastic pool lets multiple Azure SQL databases share a configured resource pool. It is cost-effective when many databases have low average utilization and infrequent peaks that occur at different times.

Per-database minimum and maximum settings control resource reservation and noisy-neighbor behavior. Pools are less suitable when most databases are consistently busy at the same time or one database needs dedicated predictable capacity.

##### Key Points to Mention

- Pooling improves utilization across many databases.
- Independent tenant peaks are a strong use case.
- Per-database limits control fairness.
- Monitor both pool and individual database saturation.

<!-- question:end:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### What happens to application connections when an Azure SQL database is scaled?

<!-- question:start:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-intermediate-q01 -->
<!-- question-id:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Most of the scale operation occurs online, but the final switchover can terminate existing connections and roll back uncommitted transactions. New connections are directed to the target compute.

Applications should implement bounded retry logic for transient failures, reopen connections, and preserve cancellation deadlines. Business operations must be idempotent or reconcile uncertain outcomes because blindly replaying a transaction after a connection loss can create duplicates.

##### Key Points to Mention

- Scaling can cause a short connection interruption.
- Open transactions may be rolled back.
- Retry only transient errors with backoff and limits.
- Idempotency is required for uncertain write outcomes.

<!-- question:end:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-intermediate-q01 -->

#### Why might a serverless database fail to auto-pause?

<!-- question:start:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-intermediate-q02 -->
<!-- question-id:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Open sessions or background activity can prevent the inactivity conditions from being met. Connection pools, monitoring agents, health checks, administrative tools, and scheduled jobs are common causes.

Some features, including active geo-replication and failover groups, require auto-pause to be disabled. The team should inspect active sessions and audit activity, verify the configured delay, and confirm that the selected service tier and enabled features support auto-pause.

##### Key Points to Mention

- No sessions and no user CPU activity are required.
- Monitoring and connection pools can keep the database active.
- Some features are incompatible with auto-pause.
- Autoscaling can still work even when auto-pause is disabled.

<!-- question:end:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-intermediate-q02 -->

#### How do failover-group listener endpoints help an application?

<!-- question:start:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-intermediate-q03 -->
<!-- question-id:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

The read-write listener provides a stable DNS name that points to the current primary. The read-only listener points to the configured secondary for eligible read workloads. After failover, Azure updates DNS so applications can reconnect without changing connection strings.

The listener does not eliminate interruption. Existing connections fail, DNS caches take time to refresh, and clients must reconnect with retry logic. Both regions also need working network rules, identities, and application components.

##### Key Points to Mention

- Listener names remain stable across role changes.
- Read-write and read-only workloads use different listeners.
- DNS update and reconnection still take time.
- Region-equivalent networking and identity are required.

<!-- question:end:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-intermediate-q03 -->

#### How would you determine whether to scale compute or tune the database?

<!-- question:start:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-intermediate-q04 -->
<!-- question-id:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Examine Query Store, execution plans, waits, blocking, indexes, CPU, data I/O, log-write utilization, worker limits, sessions, and application call patterns. If a few inefficient queries dominate resource use, tuning is usually more cost-effective. If an optimized representative workload consistently reaches a valid resource ceiling, scaling is appropriate.

Scaling can also provide emergency relief while a deeper fix is developed. The decision should include before-and-after performance and cost measurements rather than relying only on average CPU.

##### Key Points to Mention

- Diagnose the constrained resource, not only CPU.
- Query and index problems should be corrected.
- Scaling is justified for sustained real capacity needs.
- Measure performance and cost before and after the change.

<!-- question:end:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### Design Azure SQL Database disaster recovery for a multi-region application.

<!-- question:start:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-advanced-q01 -->
<!-- question-id:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Define business RPO and RTO first. Create a failover group between logical servers in separate regions and use the stable read-write listener. Configure equivalent service tiers, private networking, DNS, identity, auditing, and security in both regions. Deploy the application, messaging, storage, secrets, and dependent services in the recovery region.

Use customer-managed failover unless the requirements explicitly justify Microsoft-managed behavior. Monitor geo-replication lag and regional health. Automate the runbook, but require appropriate safeguards before forced failover because it can lose recent asynchronous transactions. Test planned failover, forced-failover decision procedures, DNS reconnection, application consistency, and failback.

##### Key Points to Mention

- RPO and RTO drive the design.
- A database failover group is only one part of application DR.
- Forced failover can lose recent writes.
- Test both failover and failback with full dependencies.

<!-- question:end:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-advanced-q01 -->

#### How would you choose between serverless databases and an elastic pool for many tenant databases?

<!-- question:start:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-advanced-q02 -->
<!-- question-id:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Model the aggregate workload. An elastic pool is usually attractive when many tenants have low average utilization and peaks at different times because unused capacity is shared. It also avoids independent resume delays for each database.

Serverless can fit a smaller number of independently intermittent databases when auto-scaling and possible auto-pause savings exceed the minimum-compute and warm-up costs. It is less compelling if monitoring prevents pause, tenants are frequently active, or predictable latency is required.

Compare total cost, peak concurrency, isolation, minimum resources, operational complexity, warm-up latency, and disaster-recovery requirements using production-like traces.

##### Key Points to Mention

- Elastic pools benefit from statistically independent peaks.
- Serverless optimizes intermittent individual databases.
- Warm-up and minimum compute affect serverless economics.
- Use aggregate workload traces rather than tenant averages alone.

<!-- question:end:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-advanced-q02 -->

#### What consistency risks exist when using read replicas and geo-secondaries?

<!-- question:start:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-advanced-q03 -->
<!-- question-id:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Replicas can lag behind the primary. A user might write data and immediately query a replica that has not applied the change. Forced failover can also promote a geo-secondary before the latest transactions arrive.

Classify reads by consistency requirement. Route read-after-write and decision-critical operations to the primary, while reporting and stale-tolerant workloads can use replicas. Monitor replication lag, expose data freshness where needed, and design reconciliation for potential lost writes after forced failover.

##### Key Points to Mention

- Read scale-out trades some freshness for capacity.
- Not every read is safe for a replica.
- Forced regional failover can introduce data loss.
- Routing, lag monitoring, and reconciliation must be explicit.

<!-- question:end:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-advanced-q03 -->

#### A database has high latency but only moderate CPU. How would you investigate it?

<!-- question:start:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-advanced-q04 -->
<!-- question-id:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Check data I/O and log-write utilization, waits, blocking, deadlocks, worker exhaustion, storage latency, execution-plan regressions, statistics, memory grants, and application round trips. Query Store can identify changed plans and high-duration queries. Dynamic management views and Azure Monitor show whether resource governance is throttling a dimension other than CPU.

Also inspect transaction duration, connection-pool saturation, network latency, and replica routing. Scale only after identifying a tier or resource limit that matches the observed bottleneck. For persistent low-latency I/O requirements, Business Critical may be appropriate; for inefficient access patterns, tuning is the better fix.

##### Key Points to Mention

- Moderate CPU does not rule out resource saturation.
- I/O, log, locks, workers, plans, and application behavior matter.
- Use Query Store and wait analysis.
- Match any tier change to the measured bottleneck.

<!-- question:end:azure-sql-database-tiers-scaling-serverless-options-and-failover-groups-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
