---
id: high-availability-and-disaster-recovery-basics
topic: Backup, recovery, HA/DR, security, and temporal data
subtopic: High availability and disaster recovery basics
category: SQL
---

## Overview

High availability and disaster recovery are related but different disciplines. High availability keeps a service running through expected component failures, such as a server or instance failure. Disaster recovery restores service after a larger failure, such as storage loss, data center outage, regional outage, severe corruption, ransomware, or operational mistakes.

This topic matters because production SQL systems need more than fast queries. They need continuity plans. The right design depends on RPO, RTO, cost, edition, licensing, operational skill, network latency, data loss tolerance, read-scale needs, and application failover behavior. Always On availability groups, failover cluster instances, log shipping, backups, replication, and cloud platform features all solve different parts of the problem.

For interviews, HA/DR basics test whether you can match business objectives to database architecture. Strong candidates can explain availability groups, failover modes, synchronous vs asynchronous replication, failover cluster instances, log shipping, backups, RPO/RTO, testing, and why replicas do not eliminate backup or restore planning.

## Core Concepts

### High Availability Vs Disaster Recovery

High availability focuses on keeping service available during common failures.

Examples:

- SQL Server instance failure.
- Operating system patching.
- Server hardware failure.
- Planned maintenance.
- Local failover.

Disaster recovery focuses on recovering from major incidents.

Examples:

- Data center loss.
- Regional outage.
- Storage corruption.
- Ransomware.
- Accidental destructive deployment.
- Loss of primary environment.

HA is about continuity. DR is about recovery after a larger break.

### RPO And RTO

RPO and RTO drive architecture.

| Objective | HA/DR Meaning |
| --- | --- |
| RPO | How much committed data can be lost |
| RTO | How quickly service must be restored |

If the business requires near-zero data loss and quick failover, synchronous replicas and automatic failover may be needed. If the business can tolerate delayed recovery and some data loss, log shipping or backup restore may be enough.

### Always On Availability Groups

An availability group is a SQL Server HA/DR feature that replicates a set of user databases from a primary replica to one or more secondary replicas. The databases in an availability group fail over together.

Key concepts:

- Primary replica accepts read-write workload.
- Secondary replicas receive transaction log records.
- Secondary replicas can be failover targets.
- Some secondary replicas can support read-only workloads.
- A listener can route client connections.
- Backups may be offloaded to suitable secondary replicas.

Availability groups protect at the database group level, not the entire SQL Server instance.

### Synchronous Vs Asynchronous Commit

Availability groups support synchronous and asynchronous commit modes.

| Mode | Behavior | Trade-Off |
| --- | --- | --- |
| Synchronous commit | Primary waits for secondary to harden log before commit completes | Lower data loss risk, higher transaction latency |
| Asynchronous commit | Primary commits without waiting for secondary acknowledgement | Lower latency, possible data loss if primary fails |

Synchronous commit is common for local HA when latency is low. Asynchronous commit is common for distant DR replicas where latency would slow the primary workload too much.

### Failover Types

Common failover types include:

- Automatic failover.
- Planned manual failover.
- Forced failover with possible data loss.

Automatic failover requires the right configuration and a synchronized failover partner. Forced failover is a disaster action when the primary is unavailable and some data loss may be accepted.

Applications must also be designed to reconnect and retry safely after failover.

### Availability Group Listener

An availability group listener is a stable network name that clients use to connect to the current primary replica, and sometimes to read-only replicas through routing configuration.

Without a listener or equivalent connection abstraction, applications may need connection string changes during failover. That increases RTO and operational risk.

### Failover Cluster Instances

A Failover Cluster Instance provides instance-level high availability by running SQL Server as a clustered resource across nodes. It protects the SQL Server instance name and instance-level objects, but usually depends on shared storage.

Key distinction:

- FCI protects an instance.
- Availability group protects databases.

An FCI does not provide readable secondaries. Availability groups can provide readable secondaries and database-level replication.

### Log Shipping

Log shipping backs up transaction logs on a primary database, copies them to one or more secondary servers, and restores them there. It is simpler than availability groups and can be useful for disaster recovery with a relaxed RPO/RTO.

Trade-offs:

- Data can lag behind based on backup/copy/restore frequency.
- Failover is usually manual.
- Secondary database may be in restoring or standby mode.
- Useful for low-cost DR and reporting scenarios when latency is acceptable.

### Backups In HA/DR

Backups remain mandatory even with HA/DR replicas. Replication can copy bad changes, corruption scenarios, accidental drops, or malicious updates. Backups provide historical recovery points and independent protection.

Availability groups, FCIs, and log shipping improve availability and recovery options. Backups protect recoverability across time.

### Readable Secondaries

Readable secondary replicas can offload read-only workloads such as reporting or some backups. This can reduce load on the primary, but it introduces design questions:

- Is read latency acceptable?
- Are queries safe against slightly stale data?
- Is read-only routing configured?
- Are statistics and plans appropriate on secondaries?
- Will reporting workload affect redo or failover readiness?

Readable secondaries are not free capacity without operational trade-offs.

### Quorum And Split-Brain

Clustered HA systems require quorum or consensus to decide which node can own resources. Quorum helps avoid split-brain, where two nodes both think they are primary.

Interview-level understanding: automatic failover depends not only on SQL Server health but also on cluster configuration, voting, witness design, and network behavior.

### Testing HA/DR

HA/DR plans must be tested.

Testing should include:

- Planned failover.
- Unplanned failover simulation.
- Application reconnect behavior.
- Data loss measurement.
- Restore from backups.
- DR environment activation.
- Runbook timing.
- Monitoring and alerting.

Untested HA/DR architecture is a diagram, not a proven plan.

### Common Mistakes

Common mistakes include:

- Confusing HA with backup.
- Assuming replicas prevent user error.
- Not testing application reconnect behavior.
- Ignoring RPO/RTO when choosing architecture.
- Using synchronous replication across high-latency links without measuring write impact.
- Forgetting SQL Agent jobs, logins, linked servers, and instance-level dependencies.
- Not monitoring replica lag.
- Not documenting forced failover data-loss decisions.
- Failing to practice DR restore.

### Best Practices

Best practices include:

- Define RPO and RTO first.
- Pick HA/DR technology based on business needs.
- Keep backups independent and tested.
- Use synchronous commit only where latency is acceptable.
- Use asynchronous DR replicas when distance makes synchronous commit too expensive.
- Use listeners or stable connection abstractions.
- Test failover and application retries.
- Monitor synchronization health and lag.
- Document manual and forced failover procedures.
- Include security, jobs, maintenance, and dependent services in the plan.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is the difference between high availability and disaster recovery?

<!-- question:start:high-availability-and-disaster-recovery-basics-beginner-q01 -->
<!-- question-id:high-availability-and-disaster-recovery-basics-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

High availability keeps a system running through expected component failures or maintenance, usually with fast failover. Disaster recovery restores service after a larger event such as data center loss, regional outage, ransomware, or severe corruption.

HA is about continuity during failures. DR is about recovering the system when the primary environment is unusable.

##### Key Points to Mention

- HA reduces downtime for common failures.
- DR handles larger disasters.
- HA often uses failover.
- DR may involve another site or region.
- Both are driven by RPO and RTO.

<!-- question:end:high-availability-and-disaster-recovery-basics-beginner-q01 -->

#### What is an Always On availability group?

<!-- question:start:high-availability-and-disaster-recovery-basics-beginner-q02 -->
<!-- question-id:high-availability-and-disaster-recovery-basics-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

An Always On availability group is a SQL Server feature that replicates a group of user databases from a primary replica to one or more secondary replicas. The primary handles read-write workload, and secondary replicas can be used for failover, read-only access, and some backup operations.

Availability groups provide high availability and disaster recovery at the database group level.

##### Key Points to Mention

- Replicates user databases.
- Has primary and secondary replicas.
- Databases in the group fail over together.
- Can support read-only secondaries.
- Does not replace backups.

<!-- question:end:high-availability-and-disaster-recovery-basics-beginner-q02 -->

#### What is log shipping?

<!-- question:start:high-availability-and-disaster-recovery-basics-beginner-q03 -->
<!-- question-id:high-availability-and-disaster-recovery-basics-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

Log shipping is a SQL Server disaster recovery approach where transaction log backups are taken on the primary database, copied to a secondary server, and restored there. The secondary database is behind the primary by the backup, copy, and restore schedule.

It is usually simpler and cheaper than availability groups, but failover is typically manual and data loss depends on how much log has not yet been copied and restored.

##### Key Points to Mention

- Uses transaction log backups.
- Copies and restores logs to secondary.
- Secondary lags behind primary.
- Failover is usually manual.
- Useful for simpler DR scenarios.

<!-- question:end:high-availability-and-disaster-recovery-basics-beginner-q03 -->

#### Why do HA systems still need backups?

<!-- question:start:high-availability-and-disaster-recovery-basics-beginner-q04 -->
<!-- question-id:high-availability-and-disaster-recovery-basics-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

HA systems still need backups because replicas usually copy logical changes, including bad changes. If a user deletes data or an application corrupts rows, that change may replicate to secondaries. Backups provide historical restore points and protection from mistakes, corruption scenarios, ransomware, and retention requirements.

HA reduces downtime. Backups provide recoverability.

##### Key Points to Mention

- Replicas can copy bad changes.
- Backups provide historical recovery.
- HA and backups solve different problems.
- Backups support point-in-time restore.
- Restore testing is still required.

<!-- question:end:high-availability-and-disaster-recovery-basics-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### What is the difference between synchronous and asynchronous commit?

<!-- question:start:high-availability-and-disaster-recovery-basics-intermediate-q01 -->
<!-- question-id:high-availability-and-disaster-recovery-basics-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

In synchronous commit, the primary waits for a synchronous secondary to harden the log before the transaction commit completes. This reduces data-loss risk but adds latency. In asynchronous commit, the primary commits without waiting for the secondary, so primary latency is lower but the secondary can lag and data loss is possible if the primary fails.

Synchronous commit is usually better for low-latency HA. Asynchronous commit is often better for distant DR replicas.

##### Key Points to Mention

- Synchronous waits for secondary hardening.
- Asynchronous does not wait.
- Synchronous reduces data-loss risk.
- Asynchronous reduces primary latency.
- Network distance affects the decision.

<!-- question:end:high-availability-and-disaster-recovery-basics-intermediate-q01 -->

#### How does a Failover Cluster Instance differ from an availability group?

<!-- question:start:high-availability-and-disaster-recovery-basics-intermediate-q02 -->
<!-- question-id:high-availability-and-disaster-recovery-basics-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

A Failover Cluster Instance provides instance-level high availability. The SQL Server instance fails over between nodes and usually uses shared storage. It protects the instance name and instance-level objects.

An availability group provides database-level replication. It has primary and secondary database replicas and can support readable secondaries. Availability groups protect a set of user databases rather than the whole instance.

##### Key Points to Mention

- FCI protects the SQL Server instance.
- Availability group protects databases.
- FCI often uses shared storage.
- Availability groups replicate database changes.
- Availability groups can have readable secondaries.

<!-- question:end:high-availability-and-disaster-recovery-basics-intermediate-q02 -->

#### What should applications do during database failover?

<!-- question:start:high-availability-and-disaster-recovery-basics-intermediate-q03 -->
<!-- question-id:high-availability-and-disaster-recovery-basics-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Applications should use a stable connection target such as an availability group listener where appropriate. They should handle transient failures, reconnect, retry idempotent operations safely, and avoid assuming an open connection remains valid during failover.

The application should also account for in-flight transactions. A failed command may have committed or rolled back, so retry logic should use idempotency keys or business keys for operations that can be retried.

##### Key Points to Mention

- Use listener or stable connection abstraction.
- Expect transient connection failures.
- Reconnect after failover.
- Retry only when safe.
- Design write operations for idempotency where needed.

<!-- question:end:high-availability-and-disaster-recovery-basics-intermediate-q03 -->

#### What should you monitor in an HA/DR setup?

<!-- question:start:high-availability-and-disaster-recovery-basics-intermediate-q04 -->
<!-- question-id:high-availability-and-disaster-recovery-basics-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Monitor replica health, synchronization state, send and redo queues, replica lag, failover readiness, backup success, log shipping copy and restore jobs, cluster health, quorum, listener connectivity, errors, and application-level availability. Also monitor whether RPO and RTO assumptions are being met.

Monitoring should alert on conditions that threaten failover or recovery, not only on complete outages.

##### Key Points to Mention

- Replica health and synchronization state.
- Send/redo queues or log shipping lag.
- Cluster and quorum health.
- Backup success.
- Application connectivity and failover readiness.

<!-- question:end:high-availability-and-disaster-recovery-basics-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you choose between availability groups, failover cluster instances, and log shipping?

<!-- question:start:high-availability-and-disaster-recovery-basics-advanced-q01 -->
<!-- question-id:high-availability-and-disaster-recovery-basics-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

I would start with RPO, RTO, budget, SQL Server edition, operational skill, network latency, and whether the requirement is instance-level HA, database-level HA, read-scale, or distant DR. Availability groups are strong for database-level HA/DR and readable secondaries. Failover Cluster Instances are useful for instance-level HA and protecting instance names and instance-level dependencies. Log shipping is simpler and can be good for lower-cost DR with manual failover and relaxed RPO/RTO.

The right choice often combines technologies. For example, local HA with an availability group plus backups and a remote asynchronous DR replica or log shipping target.

##### Key Points to Mention

- Start with RPO and RTO.
- AG: database-level HA/DR and readable secondaries.
- FCI: instance-level HA.
- Log shipping: simpler manual DR.
- Consider cost, edition, latency, and operations.

<!-- question:end:high-availability-and-disaster-recovery-basics-advanced-q01 -->

#### What are the risks of forced failover?

<!-- question:start:high-availability-and-disaster-recovery-basics-advanced-q02 -->
<!-- question-id:high-availability-and-disaster-recovery-basics-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Forced failover can bring a secondary online when the primary is unavailable, but it may involve data loss if the secondary was not fully synchronized. It can also create operational risk if the old primary later comes back and must be handled carefully to avoid split-brain or divergent data states.

Forced failover should be documented as a disaster action with clear authority, expected data-loss decision criteria, and post-failover validation steps.

##### Key Points to Mention

- May cause data loss.
- Used when normal failover is not possible.
- Requires clear decision authority.
- Old primary must be handled carefully.
- Validate data and application behavior after failover.

<!-- question:end:high-availability-and-disaster-recovery-basics-advanced-q02 -->

#### How would you test a disaster recovery plan?

<!-- question:start:high-availability-and-disaster-recovery-basics-advanced-q03 -->
<!-- question-id:high-availability-and-disaster-recovery-basics-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

I would run scheduled DR exercises that restore or activate the secondary environment, measure actual RTO and RPO, validate database consistency, test application connectivity, verify jobs and permissions, run smoke tests, and confirm monitoring and communication workflows. The test should include both technical restore steps and human decision-making steps.

The result should update the runbook with measured timings, gaps, owners, and improvements.

##### Key Points to Mention

- Exercise the runbook.
- Measure actual RPO and RTO.
- Validate database and application behavior.
- Include jobs, permissions, and dependencies.
- Feed results back into improvements.

<!-- question:end:high-availability-and-disaster-recovery-basics-advanced-q03 -->

#### Why can synchronous replication hurt performance?

<!-- question:start:high-availability-and-disaster-recovery-basics-advanced-q04 -->
<!-- question-id:high-availability-and-disaster-recovery-basics-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

Synchronous replication can hurt performance because the primary must wait for the secondary to harden log records before commit completes. Network latency, secondary storage latency, or secondary load can add to transaction latency on the primary.

This is why synchronous commit is usually used where latency is low and the data-loss requirement justifies the cost. Distant DR replicas often use asynchronous commit to avoid slowing the primary workload.

##### Key Points to Mention

- Primary waits for secondary acknowledgement.
- Network and storage latency affect commits.
- Protects data at the cost of latency.
- Best for low-latency HA.
- Asynchronous is common for distant DR.

<!-- question:end:high-availability-and-disaster-recovery-basics-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
