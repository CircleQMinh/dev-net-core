---
id: isolation-levels-and-row-versioning
topic: Transactions, isolation, locking, and deadlocks
subtopic: Isolation levels and row versioning
category: SQL
---

## Overview

Isolation levels control what one transaction can see when other transactions are reading or modifying the same data. In SQL Server, isolation levels affect read behavior through locking and row versioning. The main isolation levels are `READ UNCOMMITTED`, `READ COMMITTED`, `REPEATABLE READ`, `SNAPSHOT`, and `SERIALIZABLE`.

Row versioning is an alternative to many reader-writer blocking patterns. Instead of making readers wait for writers or writers wait for readers, SQL Server can give readers an older committed version of a row. The two common row-versioning options are read committed snapshot isolation, usually called RCSI, and explicit `SNAPSHOT` isolation.

This topic matters because isolation is a trade-off between correctness and concurrency. Weak isolation can allow dirty reads or inconsistent decisions. Strong isolation can reduce concurrency and increase blocking. Row versioning can reduce blocking for reads, but it adds version store overhead and has different update-conflict behavior.

For interviews, strong candidates can explain dirty reads, nonrepeatable reads, phantom reads, default `READ COMMITTED`, `SERIALIZABLE` range locks, RCSI statement-level snapshots, `SNAPSHOT` transaction-level snapshots, and why `NOLOCK` is not a safe performance strategy.

## Core Concepts

### Why Isolation Exists

Isolation protects transactions from unsafe interaction with concurrent work.

Example risk:

```sql
-- Session 1
BEGIN TRANSACTION;

UPDATE dbo.Accounts
SET Balance = Balance - 100.00
WHERE AccountId = 1;

-- Not committed yet.
```

If Session 2 reads that uncommitted balance and makes a decision, it may act on data that later rolls back.

Isolation determines whether Session 2 waits, reads an older committed version, or reads the uncommitted value.

### Common Concurrency Phenomena

Dirty read:

- A transaction reads data modified by another transaction that has not committed.
- If the writer rolls back, the reader saw data that never truly existed.

Nonrepeatable read:

- A transaction reads the same row twice and sees different committed values because another transaction updated it between reads.

Phantom read:

- A transaction reruns a range query and sees new rows that another transaction inserted into the range.

Lost update:

- Two transactions read the same value and both write back changes, causing one change to overwrite the other.

Different isolation levels protect against different issues.

### READ UNCOMMITTED

`READ UNCOMMITTED` allows dirty reads.

Example:

```sql
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

SELECT Balance
FROM dbo.Accounts
WHERE AccountId = 1;
```

This read can see uncommitted changes from another transaction.

`NOLOCK` has similar behavior for table reads:

```sql
SELECT *
FROM dbo.Orders WITH (NOLOCK);
```

Interview answer: `NOLOCK` is not "free speed." It allows dirty reads and other inconsistent results. It may be acceptable for rare diagnostic cases, but it is usually a bad default for application correctness.

### READ COMMITTED

`READ COMMITTED` prevents dirty reads. It is the SQL Server default isolation level.

With traditional locking behavior, a statement running under `READ COMMITTED` cannot read rows modified but not committed by another transaction. Shared locks are used for reads and generally released as the statement progresses or completes.

Example:

```sql
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

SELECT Balance
FROM dbo.Accounts
WHERE AccountId = 1;
```

`READ COMMITTED` prevents dirty reads, but it can still allow nonrepeatable reads and phantom reads across multiple statements in the same transaction.

### READ COMMITTED SNAPSHOT Isolation

Read committed snapshot isolation, or RCSI, changes `READ COMMITTED` behavior at the database level. When `READ_COMMITTED_SNAPSHOT` is on, `READ COMMITTED` readers use row versions instead of shared locks for read consistency.

Enable example:

```sql
ALTER DATABASE CurrentDatabase
SET READ_COMMITTED_SNAPSHOT ON;
```

Under RCSI:

- Each statement sees a transactionally consistent snapshot as of the start of that statement.
- Readers do not take shared locks to block writers.
- Writers do not block readers in the same way.
- The application can still use normal `READ COMMITTED`.

Important nuance: RCSI is statement-level versioning. Two `SELECT` statements in one transaction can see different committed snapshots if other transactions commit between those statements.

### REPEATABLE READ

`REPEATABLE READ` prevents dirty reads and nonrepeatable reads for rows that were read.

Example:

```sql
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

BEGIN TRANSACTION;

SELECT Balance
FROM dbo.Accounts
WHERE AccountId = 1;

-- Another transaction cannot modify that read row until this transaction completes.

SELECT Balance
FROM dbo.Accounts
WHERE AccountId = 1;

COMMIT TRANSACTION;
```

Shared locks on read rows are held until the transaction completes. This protects rows already read, but it does not prevent other transactions from inserting new rows that match a range predicate. Phantom rows can still appear.

### SERIALIZABLE

`SERIALIZABLE` is the strictest locking isolation level.

Example:

```sql
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

BEGIN TRANSACTION;

SELECT *
FROM dbo.Appointments
WHERE DoctorId = @DoctorId
  AND StartTime < @RequestedEnd
  AND EndTime > @RequestedStart;

-- If no conflict exists, insert appointment.

INSERT dbo.Appointments (DoctorId, StartTime, EndTime)
VALUES (@DoctorId, @RequestedStart, @RequestedEnd);

COMMIT TRANSACTION;
```

`SERIALIZABLE` can protect key ranges so another transaction cannot insert rows into the range that was checked. This helps prevent phantom reads and some race conditions.

Trade-off: `SERIALIZABLE` can significantly reduce concurrency and increase blocking because range locks are held until the transaction completes.

### SNAPSHOT Isolation

`SNAPSHOT` isolation gives a transaction a consistent view of committed data as of the start of the transaction.

Enable example:

```sql
ALTER DATABASE CurrentDatabase
SET ALLOW_SNAPSHOT_ISOLATION ON;
```

Use example:

```sql
SET TRANSACTION ISOLATION LEVEL SNAPSHOT;

BEGIN TRANSACTION;

SELECT Balance
FROM dbo.Accounts
WHERE AccountId = 1;

-- Later statements in this transaction see the same snapshot
-- for data committed before the transaction began.

COMMIT TRANSACTION;
```

Under `SNAPSHOT`, readers generally do not block writers and writers generally do not block readers. However, update conflicts can occur if a snapshot transaction tries to update data that another transaction changed after the snapshot transaction began.

### RCSI Vs SNAPSHOT

RCSI and `SNAPSHOT` both use row versions, but their consistency scope differs.

RCSI:

- Enabled with `READ_COMMITTED_SNAPSHOT`.
- Used by normal `READ COMMITTED` statements.
- Snapshot is statement-level.
- Each statement can see a different committed point in time.

`SNAPSHOT`:

- Enabled with `ALLOW_SNAPSHOT_ISOLATION`.
- Requested with `SET TRANSACTION ISOLATION LEVEL SNAPSHOT`.
- Snapshot is transaction-level.
- Statements in the transaction see the same committed data as of transaction start.

Example difference:

```sql
-- Under RCSI, these two statements may see different committed versions.
BEGIN TRANSACTION;
SELECT Status FROM dbo.Orders WHERE OrderId = 1;
SELECT Status FROM dbo.Orders WHERE OrderId = 1;
COMMIT TRANSACTION;
```

Under explicit `SNAPSHOT`, both reads use the transaction-start snapshot.

### Row Versioning

Row versioning stores previous committed row versions so readers can access a consistent older version while writers continue.

When a row is updated:

- The writer modifies the current row.
- SQL Server maintains a previous version for versioned readers.
- Versioned readers can read the older committed row instead of blocking.

Row versioning helps read-heavy workloads where blocking between readers and writers is a problem.

Costs include:

- Additional storage for versions.
- More tempdb or persistent version store pressure depending on platform and feature.
- Cleanup work.
- Long-running transactions can keep old versions alive longer.
- Different conflict behavior for updates under `SNAPSHOT`.

### Locking Still Matters Under Row Versioning

Row versioning reduces read/write blocking, but it does not remove all locks.

Important points:

- Writers still take exclusive locks for data they modify.
- Isolation level mainly changes read behavior.
- Schema stability and schema modification locks can still matter.
- Updates must still protect data integrity.
- Long-running versioned transactions can create storage pressure.

Interview trap: "We enabled RCSI, so locking no longer matters" is wrong.

### Dirty Reads And NOLOCK

`NOLOCK` is often used as a quick attempt to avoid blocking, but it changes correctness.

Possible problems:

- Dirty reads.
- Reading rows that later roll back.
- Missing rows.
- Duplicate rows.
- Inconsistent aggregates.
- Decisions based on uncommitted data.

Better options:

- Fix slow queries.
- Add appropriate indexes.
- Keep write transactions short.
- Use RCSI where appropriate.
- Use reporting replicas or snapshots for reporting workloads.

### Write Conflicts Under SNAPSHOT

`SNAPSHOT` isolation can produce update conflicts.

Example flow:

- Transaction A starts under `SNAPSHOT` and reads row 10.
- Transaction B updates row 10 and commits.
- Transaction A tries to update row 10.
- SQL Server detects that the row changed after Transaction A's snapshot began.
- Transaction A fails and must be retried or handled.

Applications using `SNAPSHOT` for writes must handle update conflicts.

### Choosing An Isolation Level

Use `READ COMMITTED` when:

- Default correctness is enough.
- Dirty reads are not acceptable.
- Some change between statements is acceptable.

Use RCSI when:

- Reader/writer blocking is a major issue.
- Statement-level committed consistency is acceptable.
- The workload can support version store overhead.

Use `SNAPSHOT` when:

- A transaction needs a consistent point-in-time view across multiple statements.
- You can handle update conflicts.

Use `SERIALIZABLE` when:

- You must protect ranges from inserts or phantoms.
- Correctness requires serial execution semantics for that transaction.
- You can tolerate lower concurrency.

Avoid `READ UNCOMMITTED` for business-critical application logic.

### Common Mistakes

Common mistakes include:

- Using `NOLOCK` to hide blocking without accepting dirty-read risk.
- Assuming `READ COMMITTED` gives repeatable results across a transaction.
- Using RCSI and expecting transaction-level snapshots.
- Using `SNAPSHOT` without handling update conflicts.
- Using `SERIALIZABLE` broadly and causing heavy blocking.
- Forgetting that writers still take locks under row versioning.
- Leaving long transactions open and growing version store pressure.
- Assuming isolation level changes protect data modifications from exclusive locks.
- Changing isolation level without testing concurrency behavior.
- Solving all blocking with isolation changes instead of fixing transaction scope and indexes.

### Best Practices

Best practices:

- Start with the correctness requirement, not the fastest-looking isolation level.
- Avoid dirty reads for business decisions.
- Keep transactions short to reduce blocking and version pressure.
- Use RCSI carefully for read/write blocking problems.
- Use explicit `SNAPSHOT` when multi-statement point-in-time consistency is required.
- Handle snapshot update conflicts with retries or user-visible conflict handling.
- Use `SERIALIZABLE` only when range protection is necessary.
- Make predicates and indexes support the locks or versions you expect.
- Test concurrent sessions, not only single-user behavior.
- Monitor blocking, deadlocks, and version store usage after isolation changes.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is a transaction isolation level?

<!-- question:start:isolation-levels-and-row-versioning-beginner-q01 -->
<!-- question-id:isolation-levels-and-row-versioning-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A transaction isolation level controls what data a transaction can read when other transactions are changing the same data. It defines protection from concurrency effects such as dirty reads, nonrepeatable reads, and phantom reads.

In SQL Server, isolation levels include `READ UNCOMMITTED`, `READ COMMITTED`, `REPEATABLE READ`, `SNAPSHOT`, and `SERIALIZABLE`.

##### Key Points to Mention

- Controls concurrent read behavior.
- Protects against some concurrency anomalies.
- Affects locking or row versioning.
- Stronger isolation can reduce concurrency.
- SQL Server default is `READ COMMITTED`.

<!-- question:end:isolation-levels-and-row-versioning-beginner-q01 -->

#### What is a dirty read?

<!-- question:start:isolation-levels-and-row-versioning-beginner-q02 -->
<!-- question-id:isolation-levels-and-row-versioning-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

A dirty read happens when a transaction reads data changed by another transaction that has not committed yet. If the other transaction rolls back, the reader saw data that never became permanent.

`READ UNCOMMITTED` and `NOLOCK` allow dirty reads.

##### Key Points to Mention

- Reads uncommitted data.
- The writer may roll back.
- Can produce incorrect business decisions.
- Allowed by `READ UNCOMMITTED`.
- `NOLOCK` has this risk.

<!-- question:end:isolation-levels-and-row-versioning-beginner-q02 -->

#### What is the default isolation level in SQL Server?

<!-- question:start:isolation-levels-and-row-versioning-beginner-q03 -->
<!-- question-id:isolation-levels-and-row-versioning-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

The default isolation level in SQL Server is `READ COMMITTED`. It prevents dirty reads. Its behavior depends on the database setting: with `READ_COMMITTED_SNAPSHOT` off, it uses shared locks for reads; with it on, it uses row versioning for statement-level read consistency.

It can still allow nonrepeatable reads and phantom reads across multiple statements.

##### Key Points to Mention

- Default is `READ COMMITTED`.
- Prevents dirty reads.
- Locking behavior when RCSI is off.
- Row-versioning behavior when RCSI is on.
- Does not guarantee repeatable multi-statement reads.

<!-- question:end:isolation-levels-and-row-versioning-beginner-q03 -->

#### What is row versioning?

<!-- question:start:isolation-levels-and-row-versioning-beginner-q04 -->
<!-- question-id:isolation-levels-and-row-versioning-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Row versioning lets SQL Server keep older committed versions of rows so readers can access a consistent version without blocking writers. It is used by read committed snapshot isolation and snapshot isolation.

It improves read concurrency, but it adds version storage and cleanup overhead.

##### Key Points to Mention

- Keeps older committed row versions.
- Helps readers avoid blocking writers.
- Used by RCSI and `SNAPSHOT`.
- Adds storage overhead.
- Long transactions can keep versions alive.

<!-- question:end:isolation-levels-and-row-versioning-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### How does READ COMMITTED differ with READ_COMMITTED_SNAPSHOT ON?

<!-- question:start:isolation-levels-and-row-versioning-intermediate-q01 -->
<!-- question-id:isolation-levels-and-row-versioning-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

With `READ_COMMITTED_SNAPSHOT` off, `READ COMMITTED` uses shared locks for reads and waits rather than reading uncommitted changes. With `READ_COMMITTED_SNAPSHOT` on, `READ COMMITTED` uses row versions and gives each statement a consistent snapshot as of the start of that statement.

RCSI reduces reader-writer blocking but adds version store overhead and does not provide transaction-level repeatable reads.

##### Key Points to Mention

- RCSI changes `READ COMMITTED` read behavior.
- Off means shared-lock based reads.
- On means statement-level row versioning.
- Reduces reader-writer blocking.
- Not the same as transaction-level `SNAPSHOT`.

<!-- question:end:isolation-levels-and-row-versioning-intermediate-q01 -->

#### What is the difference between RCSI and SNAPSHOT isolation?

<!-- question:start:isolation-levels-and-row-versioning-intermediate-q02 -->
<!-- question-id:isolation-levels-and-row-versioning-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

RCSI applies to `READ COMMITTED` statements and gives each statement its own committed snapshot. `SNAPSHOT` isolation is explicitly requested for a transaction and gives the whole transaction a consistent view as of the transaction start.

RCSI is statement-scoped. `SNAPSHOT` is transaction-scoped and can produce update conflicts that the application must handle.

##### Key Points to Mention

- RCSI is statement-level.
- `SNAPSHOT` is transaction-level.
- Different database options enable them.
- `SNAPSHOT` must be requested by the session.
- Snapshot write conflicts require handling.

<!-- question:end:isolation-levels-and-row-versioning-intermediate-q02 -->

#### What does SERIALIZABLE protect against?

<!-- question:start:isolation-levels-and-row-versioning-intermediate-q03 -->
<!-- question-id:isolation-levels-and-row-versioning-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

`SERIALIZABLE` protects against dirty reads, nonrepeatable reads, and phantom reads. SQL Server can use range locks so other transactions cannot insert rows into key ranges read by the serializable transaction.

It provides strong correctness for range checks but can reduce concurrency and increase blocking.

##### Key Points to Mention

- Strongest locking isolation level.
- Prevents phantom rows.
- Uses range locks.
- Holds locks until transaction completion.
- Lower concurrency, so use only when needed.

<!-- question:end:isolation-levels-and-row-versioning-intermediate-q03 -->

#### Why is NOLOCK risky?

<!-- question:start:isolation-levels-and-row-versioning-intermediate-q04 -->
<!-- question-id:isolation-levels-and-row-versioning-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

`NOLOCK` allows reads similar to `READ UNCOMMITTED`, which means the query can read uncommitted data. It can return values that roll back, inconsistent aggregates, missing rows, or duplicated rows. It may reduce blocking, but it does so by weakening correctness.

For business-critical reads, better options include fixing query/index problems, shortening write transactions, using RCSI, or using a reporting copy.

##### Key Points to Mention

- Allows dirty reads.
- Can return inconsistent results.
- Does not mean "no risk."
- Hides blocking rather than fixing the cause.
- RCSI may be a safer alternative for many workloads.

<!-- question:end:isolation-levels-and-row-versioning-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you choose an isolation level for checking appointment availability?

<!-- question:start:isolation-levels-and-row-versioning-advanced-q01 -->
<!-- question-id:isolation-levels-and-row-versioning-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

If the operation checks for overlapping appointments and then inserts a new appointment, it must prevent another transaction from inserting a conflicting row between the check and insert. `SERIALIZABLE` or explicit range-locking hints such as `UPDLOCK, HOLDLOCK` on a properly indexed range may be appropriate.

RCSI alone is not enough for this write decision because it can read a consistent snapshot while another transaction inserts a conflicting appointment.

##### Key Points to Mention

- This is a check-then-insert race.
- Need range protection.
- `SERIALIZABLE` or equivalent locks may be needed.
- Proper indexes matter for lock scope.
- RCSI improves reads but does not protect the write invariant alone.

<!-- question:end:isolation-levels-and-row-versioning-advanced-q01 -->

#### How would you diagnose blocking after enabling RCSI?

<!-- question:start:isolation-levels-and-row-versioning-advanced-q02 -->
<!-- question-id:isolation-levels-and-row-versioning-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

First confirm which sessions are blocked and what locks they wait on. RCSI reduces shared-lock reader/writer blocking, but writers still block writers, schema locks still matter, explicit locking hints may override versioning, and long transactions may create version store pressure. Check transaction scope, indexes, query plans, waits, open transactions, and whether queries use table hints such as `READCOMMITTEDLOCK`.

RCSI is not a universal blocking cure. It only changes read behavior for `READ COMMITTED`.

##### Key Points to Mention

- Writers still take exclusive locks.
- Schema locks still matter.
- Locking hints can override versioning behavior.
- Long transactions can cause version pressure.
- Check waits, open transactions, and plans.
- RCSI only changes certain read behavior.

<!-- question:end:isolation-levels-and-row-versioning-advanced-q02 -->

#### What are the trade-offs of SNAPSHOT isolation?

<!-- question:start:isolation-levels-and-row-versioning-advanced-q03 -->
<!-- question-id:isolation-levels-and-row-versioning-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

`SNAPSHOT` isolation gives a transaction a consistent view as of transaction start and reduces reader-writer blocking. The trade-offs are version storage overhead, cleanup work, long-running transaction pressure, and possible update conflicts when the transaction tries to modify rows changed after its snapshot began.

It is useful for consistent multi-statement reads, but write paths must handle conflicts and retries.

##### Key Points to Mention

- Transaction-level consistent snapshot.
- Readers and writers block each other less.
- Adds version storage overhead.
- Long transactions keep versions alive.
- Update conflicts must be handled.

<!-- question:end:isolation-levels-and-row-versioning-advanced-q03 -->

#### How do isolation levels relate to lost updates?

<!-- question:start:isolation-levels-and-row-versioning-advanced-q04 -->
<!-- question-id:isolation-levels-and-row-versioning-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

A lost update can happen when two sessions read the same value, compute a new value, and write back without coordination. Isolation alone is not always enough if the application reads data, computes outside the database, and writes later. Use atomic update statements, appropriate locks such as `UPDLOCK`, optimistic concurrency tokens such as `rowversion`, or higher isolation when the business invariant requires it.

The correct pattern depends on whether conflicts should wait, fail fast, or be retried.

##### Key Points to Mention

- Lost update is an overwrite race.
- Atomic updates reduce risk.
- `UPDLOCK` can coordinate writers.
- `rowversion` supports optimistic concurrency.
- Higher isolation may be needed for some invariants.
- Conflict behavior should match business rules.

<!-- question:end:isolation-levels-and-row-versioning-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
