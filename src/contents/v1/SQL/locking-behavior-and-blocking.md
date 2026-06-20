---
id: locking-behavior-and-blocking
topic: Transactions, isolation, locking, and deadlocks
subtopic: Locking behavior and blocking
category: SQL
---

## Overview

Locking is how SQL Server protects data while multiple sessions read and modify it at the same time. A lock is a temporary claim on a resource, such as a row, key, page, table, database, or metadata object. Blocking happens when one session holds a lock and another session needs an incompatible lock on the same resource.

Blocking is not automatically bad. It is a normal part of protecting correctness in a relational database. The problem is prolonged blocking, where one transaction holds locks too long and other sessions wait behind it. Long blocking chains can slow APIs, reports, background jobs, and user workflows.

This topic matters because many production SQL incidents are not caused by broken syntax. They are caused by long transactions, missing indexes, large scans, lock escalation, inappropriate isolation levels, uncommitted transactions, or application behavior that holds locks while waiting on users or external services.

For interviews, strong candidates can explain shared, update, exclusive, intent, and schema locks; distinguish blocking from deadlocks; find the head blocker; understand how isolation level affects lock duration; and suggest practical mitigation without blindly using `NOLOCK`.

## Core Concepts

### Why SQL Server Uses Locks

SQL Server uses locks to preserve transaction isolation and data consistency.

Example:

```sql
BEGIN TRANSACTION;

UPDATE dbo.Products
SET StockQuantity = StockQuantity - 1
WHERE ProductId = @ProductId;

-- Transaction remains open here.
```

While this transaction is open, SQL Server must protect the modified row so another transaction cannot make an incompatible change based on an unstable state.

Locks help prevent:

- Dirty reads under lock-based read committed behavior.
- Lost updates.
- Corrupt or inconsistent writes.
- Concurrent modifications that violate transaction isolation.
- Reads that observe intermediate states under stronger isolation levels.

### What Blocking Means

Blocking occurs when a session waits because another session holds an incompatible lock.

Example:

```sql
-- Session 1
BEGIN TRANSACTION;

UPDATE dbo.Users
SET DisplayName = N'New Name'
WHERE UserId = 42;

-- Session 2
UPDATE dbo.Users
SET LastLoginAt = SYSUTCDATETIME()
WHERE UserId = 42;
```

Session 2 waits until Session 1 commits or rolls back. Session 2 is blocked, not necessarily deadlocked.

Blocking becomes a problem when:

- The blocking transaction stays open too long.
- Many sessions queue behind one head blocker.
- The blocked work is latency-sensitive.
- The blocking session is idle or waiting on the application.
- The query holds more locks than expected because of poor indexing or isolation level.

### Blocking Vs Deadlocking

Blocking is one-way waiting. Session B waits for Session A, and Session A can eventually complete.

Deadlocking is circular waiting. Session A waits for Session B while Session B waits for Session A. Neither can continue until SQL Server chooses a victim and rolls it back.

Blocking example:

```text
Session B waits for Session A.
Session A is not waiting for Session B.
```

Deadlock example:

```text
Session A waits for Session B.
Session B waits for Session A.
```

Interview shortcut: blocking may resolve naturally. A deadlock cannot resolve without intervention, so SQL Server detects it and rolls back one participant.

### Lock Resources

SQL Server can lock different resource types.

Common resources:

- Row identifiers in heaps.
- Keys in indexes.
- Pages.
- HoBTs, which are heap-or-B-tree structures.
- Tables.
- Databases.
- Metadata.
- Application locks when `sp_getapplock` is used.

Granularity matters. A row or key lock affects a small resource. A table lock affects all rows in the table. SQL Server chooses lock granularity based on the statement, plan, isolation level, hints, memory pressure, and lock escalation behavior.

### Shared Locks

Shared locks are commonly used for reads under pessimistic locking.

Example:

```sql
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

SELECT Email
FROM dbo.Users
WHERE UserId = @UserId;
```

Under lock-based `READ COMMITTED`, SQL Server can take shared locks while reading committed data. Shared locks are compatible with other shared locks, so multiple readers can read the same data at the same time.

Shared locks are not compatible with exclusive locks. If another transaction has modified a row and is holding an exclusive lock, a shared-lock reader may wait.

### Exclusive Locks

Exclusive locks protect data modifications.

Example:

```sql
UPDATE dbo.Users
SET Email = @Email
WHERE UserId = @UserId;
```

The update takes exclusive locks on rows or keys it modifies. Exclusive locks are incompatible with shared, update, and exclusive locks on the same resource.

Exclusive locks are held until the transaction completes. This is true even if the session's isolation level is weak for reads, because writes must remain protected until commit or rollback.

### Update Locks

Update locks help avoid some conversion deadlocks. They are often used when a session reads a row with intent to update it later.

Example:

```sql
BEGIN TRANSACTION;

SELECT StockQuantity
FROM dbo.Products WITH (UPDLOCK)
WHERE ProductId = @ProductId;

UPDATE dbo.Products
SET StockQuantity = StockQuantity - @Quantity
WHERE ProductId = @ProductId;

COMMIT TRANSACTION;
```

`UPDLOCK` tells SQL Server to use update locks during the read. Update locks are compatible with shared locks but not with other update locks on the same resource. This helps ensure that only one writer-intent session queues for the later exclusive lock.

### Intent Locks

Intent locks signal that a transaction has or wants locks at a lower level in the hierarchy.

Example:

- A transaction takes row-level exclusive locks.
- SQL Server also takes intent exclusive locks at page or table level.

Intent locks help SQL Server efficiently determine whether a table-level lock conflicts with lower-level locks without checking every row lock.

Common intent modes:

- Intent shared (`IS`).
- Intent exclusive (`IX`).
- Shared with intent exclusive (`SIX`).

Interview answer: intent locks do not mean "the row is locked later." They are hierarchy signals that protect lower-level lock intent.

### Schema Locks

Schema stability and schema modification locks affect query compilation, execution, and DDL.

Examples:

```sql
ALTER TABLE dbo.Users
ADD LastSeenAt DATETIME2 NULL;
```

DDL changes can require schema modification locks. Queries often require schema stability locks. Schema locks can explain blocking even when no obvious row update is happening.

Important nuance: even queries using `NOLOCK` may still need schema stability locks and can be blocked by schema modification locks.

### Isolation Level And Lock Duration

Isolation level affects how long read locks are held.

At lock-based `READ COMMITTED`:

- Shared locks are usually released as the statement progresses or completes.
- Dirty reads are prevented.
- Rows can change between statements.

At `REPEATABLE READ`:

- Shared locks on read rows are held until transaction end.
- Read rows cannot be modified by others before the transaction completes.
- New matching rows can still appear for range queries.

At `SERIALIZABLE`:

- Key-range locks can protect ranges.
- Phantom inserts into the range are prevented.
- Blocking can increase significantly.

With row versioning isolation such as RCSI:

- Many reads use row versions instead of shared locks.
- Reader-writer blocking is reduced.
- Writers still take locks.

### Lock Escalation

Lock escalation is when SQL Server changes many fine-grained locks into a coarser table-level lock.

Example:

```sql
BEGIN TRANSACTION;

DELETE dbo.AuditLog
WHERE CreatedAt < DATEADD(year, -2, SYSUTCDATETIME());

COMMIT TRANSACTION;
```

If the delete touches many rows, SQL Server may escalate from many row or key locks to a table lock. This can block unrelated queries that need the same table.

Mitigation patterns:

- Delete or update in smaller batches.
- Add indexes so the statement touches fewer rows.
- Keep transactions short.
- Avoid broad scans in transactions.
- Use partitioning or archival strategies where appropriate.

### Head Blocker

A head blocker is the session at the top of a blocking chain. It blocks others but is not itself blocked by another session.

Example chain:

```text
Session 80 blocks Session 81.
Session 81 blocks Session 82.
Session 82 blocks Session 83.
```

Session 80 is the head blocker.

The first troubleshooting task is to identify the head blocker, then determine:

- What statement or transaction it is running.
- Whether it has an open transaction.
- What resource it holds.
- Why it is holding locks for so long.
- Whether it is active, sleeping, waiting on the application, or stuck.

### Diagnosing Blocking With DMVs

Useful DMVs include:

- `sys.dm_exec_requests`
- `sys.dm_exec_sessions`
- `sys.dm_os_waiting_tasks`
- `sys.dm_tran_locks`
- `sys.dm_tran_session_transactions`
- `sys.dm_exec_connections`

Basic blocking query:

```sql
SELECT
    r.session_id,
    r.blocking_session_id,
    r.wait_type,
    r.wait_time,
    r.wait_resource,
    r.status,
    r.command
FROM sys.dm_exec_requests AS r
WHERE r.blocking_session_id <> 0;
```

This shows currently blocked requests and who blocks them.

Query text pattern:

```sql
SELECT
    r.session_id,
    r.blocking_session_id,
    r.wait_type,
    r.wait_time,
    t.text AS sql_text
FROM sys.dm_exec_requests AS r
OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) AS t
WHERE r.blocking_session_id <> 0;
```

For an idle blocker, the currently executing request may be gone, so you may need connection input buffer, session data, transaction DMVs, application logs, or Extended Events.

### Blocked Process Reports And Extended Events

Blocked process reports can capture blocking that exceeds a configured threshold. Extended Events can collect these reports along with batch and RPC activity.

Useful events for blocking investigations include:

- `blocked_process_report`
- `sql_batch_starting`
- `sql_batch_completed`
- `rpc_starting`
- `rpc_completed`
- `lock_deadlock`
- `error_reported`

This helps when blocking is intermittent and you cannot catch it live with DMVs.

### Common Causes Of Prolonged Blocking

Common causes:

- Uncommitted transaction left open by application code.
- User interaction inside a transaction.
- External API call inside a transaction.
- Long-running update or delete.
- Missing index causing a broad scan under locks.
- Higher isolation level than needed.
- Lock escalation to table level.
- Large batch job running during peak workload.
- Reporting query using locking hints.
- Schema changes during active workload.
- Slow client that does not consume results promptly.

Blocking is often an application and query-design issue, not only a database setting issue.

### Reducing Blocking

Common mitigation patterns:

- Keep transactions short.
- Commit or roll back explicitly.
- Add indexes that reduce scanned rows.
- Make predicates SARGable.
- Process large changes in batches.
- Access tables in a consistent order.
- Avoid user prompts and service calls inside transactions.
- Use RCSI for read/write blocking where appropriate.
- Tune slow queries so locks are held for less time.
- Move heavy reports to replicas, snapshots, or reporting tables.
- Schedule maintenance and batch jobs away from peak OLTP windows.

Avoid using `NOLOCK` as the default answer. It changes correctness and can return inconsistent data.

### LOCK_TIMEOUT

`LOCK_TIMEOUT` controls how long a session waits for a lock before returning an error.

Example:

```sql
SET LOCK_TIMEOUT 5000;

UPDATE dbo.Users
SET DisplayName = @DisplayName
WHERE UserId = @UserId;
```

This waits up to five seconds. If the lock cannot be acquired, SQL Server returns an error.

`LOCK_TIMEOUT` does not solve the root cause of blocking. It is a fail-fast behavior. The application still needs error handling and retry or user feedback.

### Common Mistakes

Common mistakes include:

- Treating all blocking as a database bug.
- Killing blockers without understanding whether they own critical work.
- Using `NOLOCK` everywhere.
- Leaving transactions open while waiting on application logic.
- Running large deletes in one transaction during peak hours.
- Ignoring missing indexes that cause large locked scans.
- Assuming RCSI removes all locks.
- Ignoring schema locks.
- Looking only at blocked sessions instead of the head blocker.
- Not capturing query text and application context during incidents.

### Best Practices

Best practices:

- Design transaction scope carefully.
- Keep read and write statements efficient.
- Use the lowest isolation level that preserves correctness.
- Use row versioning intentionally where reader/writer blocking is a recurring issue.
- Add supporting indexes for frequent update and lookup predicates.
- Batch large data modifications.
- Monitor blocking with DMVs and Extended Events.
- Capture the head blocker, wait resource, query text, transaction state, and application name.
- Fix root causes rather than only increasing timeouts.
- Test concurrency patterns with multiple sessions.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is blocking in SQL Server?

<!-- question:start:locking-behavior-and-blocking-beginner-q01 -->
<!-- question-id:locking-behavior-and-blocking-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

Blocking happens when one session holds a lock on a resource and another session needs an incompatible lock on that same resource. The waiting session cannot continue until the blocking session releases its lock by committing, rolling back, or otherwise completing the relevant work.

Blocking is normal in a lock-based database. It becomes a problem when locks are held too long or many sessions wait behind one blocker.

##### Key Points to Mention

- One session waits on another session's lock.
- Blocking is normal but can become harmful.
- Locks protect transaction correctness.
- Long transactions often cause blocking.
- The head blocker is the first session to investigate.

<!-- question:end:locking-behavior-and-blocking-beginner-q01 -->

#### What is the difference between blocking and a deadlock?

<!-- question:start:locking-behavior-and-blocking-beginner-q02 -->
<!-- question-id:locking-behavior-and-blocking-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

Blocking is one session waiting for another session that can eventually complete. A deadlock is circular waiting, where two or more sessions each hold resources the others need, so none of them can continue. SQL Server detects deadlocks and rolls back one transaction as the victim.

Blocking can last until the blocker finishes. A deadlock requires SQL Server to break the cycle.

##### Key Points to Mention

- Blocking is one-way waiting.
- Deadlocking is circular waiting.
- Blocking can resolve naturally.
- SQL Server resolves deadlocks by choosing a victim.
- Deadlocks return error 1205.

<!-- question:end:locking-behavior-and-blocking-beginner-q02 -->

#### What is a shared lock?

<!-- question:start:locking-behavior-and-blocking-beginner-q03 -->
<!-- question-id:locking-behavior-and-blocking-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

A shared lock is commonly used for reading data under pessimistic locking. Multiple sessions can usually hold shared locks on the same resource at the same time, but a shared lock is incompatible with an exclusive lock on that resource.

Under default lock-based `READ COMMITTED`, shared locks are typically held only briefly while a statement reads data.

##### Key Points to Mention

- Used for reads.
- Compatible with other shared locks.
- Incompatible with exclusive locks.
- Duration depends on isolation level.
- Row versioning can reduce shared-lock reads.

<!-- question:end:locking-behavior-and-blocking-beginner-q03 -->

#### What is an exclusive lock?

<!-- question:start:locking-behavior-and-blocking-beginner-q04 -->
<!-- question-id:locking-behavior-and-blocking-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

An exclusive lock protects data being modified by `INSERT`, `UPDATE`, `DELETE`, or `MERGE`. While an exclusive lock is held, other sessions cannot acquire incompatible locks on the same resource.

Exclusive locks for modifications are held until the transaction commits or rolls back.

##### Key Points to Mention

- Used for writes.
- Incompatible with most other lock modes.
- Protects modified data.
- Held until transaction end.
- Long write transactions often block other sessions.

<!-- question:end:locking-behavior-and-blocking-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### How do you find the head blocker?

<!-- question:start:locking-behavior-and-blocking-intermediate-q01 -->
<!-- question-id:locking-behavior-and-blocking-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

Start with `sys.dm_exec_requests` and the `blocking_session_id` column to find blocked sessions. Walk the blocking chain until you find a session that blocks others but is not itself blocked. Then inspect that session's current or most recent SQL text, open transaction count, wait state, locks, application name, and transaction start time.

The goal is to identify what is holding locks for too long and why.

##### Key Points to Mention

- Use `blocking_session_id`.
- Walk the blocking chain.
- Identify the session blocking others.
- Check SQL text and open transaction state.
- Investigate why locks are held.

<!-- question:end:locking-behavior-and-blocking-intermediate-q01 -->

#### How does isolation level affect blocking?

<!-- question:start:locking-behavior-and-blocking-intermediate-q02 -->
<!-- question-id:locking-behavior-and-blocking-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Isolation level affects read behavior and lock duration. At lock-based `READ COMMITTED`, shared locks are usually released quickly. At `REPEATABLE READ`, shared locks on read rows are held until the transaction ends. At `SERIALIZABLE`, SQL Server can hold range locks to prevent phantom rows.

Row versioning options such as RCSI can reduce reader-writer blocking by allowing readers to read committed row versions instead of taking shared locks.

##### Key Points to Mention

- Stronger isolation can hold locks longer.
- `REPEATABLE READ` holds read locks to transaction end.
- `SERIALIZABLE` can use range locks.
- RCSI reduces reader-writer blocking.
- Writers still take locks under row versioning.

<!-- question:end:locking-behavior-and-blocking-intermediate-q02 -->

#### What is lock escalation?

<!-- question:start:locking-behavior-and-blocking-intermediate-q03 -->
<!-- question-id:locking-behavior-and-blocking-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Lock escalation is when SQL Server replaces many fine-grained row, key, or page locks with a coarser table-level lock. This reduces lock management overhead but can increase blocking because the larger lock affects more work.

It often appears during large updates, deletes, scans, or transactions that touch many rows. Batching, better indexes, and shorter transactions can reduce the risk.

##### Key Points to Mention

- Converts many small locks into a larger lock.
- Usually escalates to a table-level lock.
- Reduces lock overhead.
- Can increase blocking.
- Large scans and modifications are common triggers.

<!-- question:end:locking-behavior-and-blocking-intermediate-q03 -->

#### Why is NOLOCK not a safe fix for blocking?

<!-- question:start:locking-behavior-and-blocking-intermediate-q04 -->
<!-- question-id:locking-behavior-and-blocking-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

`NOLOCK` allows read behavior similar to `READ UNCOMMITTED`, which means the query can read uncommitted data. It can return dirty reads, inconsistent aggregates, duplicate rows, missing rows, or data that later rolls back. It may reduce some blocking, but it weakens correctness.

Better fixes include shortening transactions, adding indexes, improving query plans, batching writes, or using RCSI when statement-level committed snapshots are acceptable.

##### Key Points to Mention

- Allows dirty reads.
- Can return inconsistent results.
- Hides symptoms instead of fixing root cause.
- Not safe for business-critical decisions.
- RCSI is often a safer reader/writer blocking strategy.

<!-- question:end:locking-behavior-and-blocking-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you troubleshoot a production blocking incident?

<!-- question:start:locking-behavior-and-blocking-advanced-q01 -->
<!-- question-id:locking-behavior-and-blocking-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

First identify the head blocker using DMVs such as `sys.dm_exec_requests`, `sys.dm_exec_sessions`, and `sys.dm_os_waiting_tasks`. Capture the blocker and blocked session IDs, wait types, wait resources, SQL text, open transaction count, transaction start time, application name, host, and relevant locks from `sys.dm_tran_locks`.

Then determine why the blocker holds locks: long transaction, missing index, large batch, schema change, slow client, higher isolation level, or application waiting. Resolve by fixing transaction scope, query shape, indexing, batching, scheduling, or isolation strategy rather than immediately killing sessions without context.

##### Key Points to Mention

- Find the head blocker.
- Capture SQL text and transaction state.
- Check wait resources and locks.
- Identify why locks are held.
- Fix root cause, not only the symptom.
- Be careful before killing a blocker.

<!-- question:end:locking-behavior-and-blocking-advanced-q01 -->

#### How can missing indexes cause blocking?

<!-- question:start:locking-behavior-and-blocking-advanced-q02 -->
<!-- question-id:locking-behavior-and-blocking-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Missing indexes can force SQL Server to scan many more rows than necessary. During updates or reads under stronger locking isolation, that larger scan can acquire more locks, hold locks longer, increase lock escalation risk, and block unrelated sessions.

A targeted index can reduce the number of rows touched, shorten statement duration, and reduce the lock footprint.

##### Key Points to Mention

- Missing indexes cause broad scans.
- Broad scans touch more rows and pages.
- More locks increase blocking risk.
- Longer queries hold locks longer.
- Better indexes reduce lock footprint.

<!-- question:end:locking-behavior-and-blocking-advanced-q02 -->

#### How would you reduce blocking from a large delete job?

<!-- question:start:locking-behavior-and-blocking-advanced-q03 -->
<!-- question-id:locking-behavior-and-blocking-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Delete in small batches, commit between batches, make sure the delete predicate is indexed, run the job outside peak workload when possible, and monitor row counts, log growth, lock escalation, and blocking. If the data is partitioned by date, partition switching or archival strategies may be better.

The key is to reduce transaction duration and lock footprint while preserving correctness.

##### Key Points to Mention

- Batch the delete.
- Commit between batches.
- Index the delete predicate.
- Schedule off peak.
- Monitor log growth and blocking.
- Consider partitioning or archival designs.

<!-- question:end:locking-behavior-and-blocking-advanced-q03 -->

#### How does RCSI change blocking behavior?

<!-- question:start:locking-behavior-and-blocking-advanced-q04 -->
<!-- question-id:locking-behavior-and-blocking-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

With `READ_COMMITTED_SNAPSHOT` enabled, `READ COMMITTED` readers use row versions for statement-level consistency instead of taking shared locks to protect reads. This reduces reader-writer blocking because readers can read the previously committed version while writers continue.

RCSI does not remove all blocking. Writers still take exclusive locks, schema locks still matter, locking hints can override behavior, and long-running transactions can create version store pressure.

##### Key Points to Mention

- RCSI uses row versions for `READ COMMITTED` reads.
- Reduces reader-writer blocking.
- Snapshot is statement-level.
- Writers still block writers.
- Version store overhead must be monitored.

<!-- question:end:locking-behavior-and-blocking-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
