---
id: deadlocks-detection-and-mitigation
topic: Transactions, isolation, locking, and deadlocks
subtopic: Deadlocks, detection, and mitigation
category: SQL
---

## Overview

A deadlock happens when two or more tasks each hold resources that the others need, creating a circular dependency. Because no participant can continue, SQL Server detects the cycle, chooses one participant as the deadlock victim, rolls back that transaction, and returns error 1205 to the application.

Deadlocks are different from ordinary blocking. Blocking can resolve when the blocking transaction commits or rolls back. A deadlock cannot resolve naturally because each participant is waiting for another participant in the same cycle.

This topic matters because deadlocks are common in busy OLTP systems. They can happen even when every individual query is valid. Typical causes include inconsistent object access order, long transactions, missing indexes, high isolation levels, lookup-heavy plans, competing updates, and read/write interactions.

For interviews, strong candidates can explain what a deadlock is, how SQL Server chooses a victim, how to read a deadlock graph, how to handle error 1205 safely, and how to reduce deadlocks through transaction design, indexing, access order, batching, row versioning, and retry logic.

## Core Concepts

### What A Deadlock Is

A deadlock is a circular wait.

Example:

```text
Session A holds a lock on row 1 and wants row 2.
Session B holds a lock on row 2 and wants row 1.
Neither session can continue.
```

SQL Server's deadlock monitor detects this cycle and breaks it by choosing a victim.

Example pattern:

```sql
-- Session A
BEGIN TRANSACTION;
UPDATE dbo.Accounts SET Balance = Balance - 100 WHERE AccountId = 1;
UPDATE dbo.Accounts SET Balance = Balance + 100 WHERE AccountId = 2;
COMMIT TRANSACTION;

-- Session B, at the same time
BEGIN TRANSACTION;
UPDATE dbo.Accounts SET Balance = Balance - 50 WHERE AccountId = 2;
UPDATE dbo.Accounts SET Balance = Balance + 50 WHERE AccountId = 1;
COMMIT TRANSACTION;
```

The sessions access the same resources in opposite order, which creates a classic deadlock risk.

### Deadlock Vs Blocking

Blocking:

```text
Session B waits for Session A.
Session A can still complete.
```

Deadlock:

```text
Session A waits for Session B.
Session B waits for Session A.
```

SQL Server resolves deadlocks automatically by rolling back one transaction. It does not automatically resolve ordinary blocking unless the blocking transaction completes, times out, disconnects, is killed, or rolls back.

### Deadlock Victim

When SQL Server detects a deadlock, it chooses a victim.

The victim's transaction is rolled back, locks are released, and the other participant can continue. SQL Server returns error 1205 to the victim session.

Example error:

```text
Transaction (Process ID 51) was deadlocked on lock resources with another process
and has been chosen as the deadlock victim. Rerun the transaction.
```

Victim selection considers deadlock priority and rollback cost. If one session has lower deadlock priority, it is more likely to be chosen. If priorities are equal, SQL Server generally chooses the transaction that is cheaper to roll back.

### SET DEADLOCK_PRIORITY

`SET DEADLOCK_PRIORITY` influences which session is chosen as the victim.

Example:

```sql
SET DEADLOCK_PRIORITY LOW;
```

This can be appropriate for background cleanup work that should yield to user-facing transactions.

Example:

```sql
SET DEADLOCK_PRIORITY HIGH;
```

This may be appropriate for critical short transactions, but it should be used sparingly. It does not prevent deadlocks; it only affects victim choice.

### Common Deadlock Pattern: Opposite Access Order

Deadlock-prone pattern:

```sql
-- Session A
BEGIN TRANSACTION;
UPDATE dbo.Customers SET LastUpdatedAt = SYSUTCDATETIME() WHERE CustomerId = 1;
UPDATE dbo.Orders SET Status = N'Reviewed' WHERE CustomerId = 1;
COMMIT TRANSACTION;

-- Session B
BEGIN TRANSACTION;
UPDATE dbo.Orders SET Status = N'Packed' WHERE CustomerId = 1;
UPDATE dbo.Customers SET LastUpdatedAt = SYSUTCDATETIME() WHERE CustomerId = 1;
COMMIT TRANSACTION;
```

If Session A locks `Customers` first and Session B locks `Orders` first, they can deadlock.

Mitigation:

- Access objects in the same order in all code paths.
- Standardize updates through stored procedures or shared data-access patterns.
- Keep transactions short.
- Add indexes so each update touches fewer rows.

### Common Deadlock Pattern: Lookup Deadlocks

Lookup-heavy plans can deadlock when sessions access indexes and base rows in conflicting orders.

Example symptoms in a deadlock graph:

- One process owns a key lock in one index and waits on another key or clustered index row.
- Another process owns the second resource and waits on the first.
- Plans include nested loops and key lookups.

Mitigation:

- Add included columns to cover important queries.
- Update indexes so access paths are consistent.
- Reduce lookup counts.
- Review actual execution plans.
- Avoid returning unnecessary columns.

### Common Deadlock Pattern: Range Checks

Check-then-insert logic can deadlock or race when ranges are not protected consistently.

Example:

```sql
BEGIN TRANSACTION;

SELECT *
FROM dbo.Appointments
WHERE DoctorId = @DoctorId
  AND StartTime < @RequestedEnd
  AND EndTime > @RequestedStart;

INSERT dbo.Appointments (DoctorId, StartTime, EndTime)
VALUES (@DoctorId, @RequestedStart, @RequestedEnd);

COMMIT TRANSACTION;
```

If multiple sessions run this at once, they can conflict. Depending on the business rule, you may need proper indexes plus `SERIALIZABLE` or locking hints such as `UPDLOCK, HOLDLOCK` on the range.

### Common Deadlock Pattern: Reader And Writer Deadlocks

Reader/writer deadlocks can happen when read queries take shared locks and write queries take exclusive or update locks in a conflicting order.

Mitigation options:

- Keep read and write transactions short.
- Add indexes to reduce scan size.
- Avoid higher isolation levels unless needed.
- Use row versioning isolation, such as RCSI, when statement-level committed snapshots are acceptable.
- Avoid large reports against hot OLTP tables under locking reads.

Row versioning can reduce read/write deadlocks, but writers can still deadlock with writers.

### Detecting Deadlocks

The recommended way to capture deadlock details is the `xml_deadlock_report` Extended Event.

SQL Server's `system_health` Extended Events session captures deadlock graphs by default in many SQL Server environments.

Deadlock information can include:

- Victim process.
- Processes involved.
- Resources involved.
- Locks held.
- Locks requested.
- Statements or execution stack.
- Isolation level.
- Deadlock priority.
- Transaction start time.
- Client application and host.

Do not troubleshoot only from the 1205 error message. The deadlock graph contains the evidence.

### Reading A Deadlock Graph

A deadlock graph usually has three major parts:

- Victim list.
- Process list.
- Resource list.

Process list shows sessions involved, including:

- Session ID.
- Transaction name.
- Isolation level.
- Current statement or input buffer.
- Wait resource.
- Lock mode requested.
- Deadlock priority.

Resource list shows:

- The locked resource.
- The owner process.
- The waiter process.
- Lock modes held and requested.
- Object and index names when available.

Interview answer: find what each process owns, what it waits for, and why the access pattern created a cycle.

### Capturing Deadlocks From system_health

Example query pattern:

```sql
SELECT
    xdr.value('@timestamp', 'datetime2') AS deadlock_time,
    xdr.query('.') AS deadlock_xml
FROM
(
    SELECT CAST(target_data AS XML) AS target_data
    FROM sys.dm_xe_sessions AS xs
    JOIN sys.dm_xe_session_targets AS xst
        ON xs.address = xst.event_session_address
    WHERE xs.name = N'system_health'
      AND xst.target_name = N'ring_buffer'
) AS data
CROSS APPLY target_data.nodes('RingBufferTarget/event[@name="xml_deadlock_report"]') AS XEventData(xdr)
ORDER BY deadlock_time DESC;
```

In production, an event file target is often better than relying only on ring buffer history because the ring buffer can roll over.

### Handling Error 1205

Applications should handle SQL Server deadlock error 1205.

Basic pattern:

- Catch error 1205.
- Roll back any active transaction.
- Wait briefly.
- Retry if the operation is safe to repeat.
- Use a bounded retry count.
- Log repeated failures with correlation IDs and query context.

Retry logic must be safe. If the operation has external side effects, use idempotency keys or an outbox pattern so a retry does not duplicate work.

### Retrying Deadlocks

Deadlock retry is normal because SQL Server already rolled back the victim transaction.

Good retry behavior:

- Retries only known transient failures.
- Uses exponential backoff or random jitter.
- Has a maximum attempt count.
- Logs final failure.
- Does not retry non-idempotent external side effects blindly.

Example application-level idea:

```text
try operation
if SQL error is 1205:
    wait random short delay
    retry up to configured limit
else:
    fail normally
```

The database code should still be improved. Retry is resilience, not the only mitigation.

### Preventing Deadlocks By Access Order

A reliable mitigation is consistent access order.

Instead of:

```text
Path 1: update Customer, then Order.
Path 2: update Order, then Customer.
```

Prefer:

```text
All paths: update Customer, then Order.
```

Consistent ordering reduces circular waits because sessions queue in the same order instead of crossing.

Stored procedures can help standardize access order for important write workflows.

### Preventing Deadlocks With Indexes

Indexes reduce deadlocks by reducing the number of rows and pages touched.

Example:

```sql
CREATE INDEX IX_Orders_Customer_Status
ON dbo.Orders (CustomerId, Status)
INCLUDE (OrderDate);
```

This can reduce a broad scan:

```sql
UPDATE dbo.Orders
SET Status = N'Archived'
WHERE CustomerId = @CustomerId
  AND Status = N'Completed';
```

Better indexing can:

- Shorten transaction duration.
- Reduce lock footprint.
- Avoid unnecessary key lookups.
- Make range locks narrower under `SERIALIZABLE`.
- Make access order more predictable.

### Preventing Deadlocks With Short Transactions

Long transactions create more opportunity for circular waits.

Avoid:

- User interaction inside transactions.
- External HTTP calls inside transactions.
- Large batch updates in one transaction.
- Reports mixed into write transactions.
- Holding transactions open while the application processes result sets slowly.

Prefer:

- Validate before opening the transaction.
- Open transaction only for required data changes.
- Commit or roll back quickly.
- Batch large writes.
- Use asynchronous outbox messages for external work.

### Row Versioning And Deadlocks

RCSI and `SNAPSHOT` can reduce deadlocks between readers and writers because readers can use row versions instead of shared locks.

However:

- Writers still take locks.
- Writer/writer deadlocks can still happen.
- `SNAPSHOT` write conflicts need handling.
- Long-running versioned transactions create version store pressure.
- Some locks, such as schema locks, still matter.

Row versioning is a useful tool, not a replacement for good transaction design and indexing.

### Common Mistakes

Common mistakes include:

- Treating deadlocks as random instead of analyzing the graph.
- Retrying forever without fixing the cause.
- Retrying non-idempotent workflows.
- Ignoring inconsistent table access order.
- Ignoring missing indexes and lookup-heavy plans.
- Holding transactions open during user interaction or external calls.
- Using high isolation levels broadly.
- Using `NOLOCK` as a deadlock cure.
- Not capturing deadlock graphs.
- Not logging enough application context to connect deadlocks to code paths.

### Best Practices

Best practices:

- Capture `xml_deadlock_report` with Extended Events.
- Read the victim, process, and resource lists.
- Standardize object access order.
- Keep transactions short and in one batch when possible.
- Add targeted indexes to reduce lock footprint.
- Use row versioning where it matches correctness requirements.
- Use `SET DEADLOCK_PRIORITY` sparingly for background work.
- Handle error 1205 with bounded safe retries.
- Use idempotency keys for retryable business operations.
- Test high-contention workflows with concurrent sessions.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is a deadlock in SQL Server?

<!-- question:start:deadlocks-detection-and-mitigation-beginner-q01 -->
<!-- question-id:deadlocks-detection-and-mitigation-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A deadlock happens when two or more sessions each hold resources that the others need, creating a circular wait. Because no session can continue, SQL Server detects the cycle and chooses one transaction as the deadlock victim.

The victim transaction is rolled back and SQL Server returns error 1205.

##### Key Points to Mention

- Circular wait.
- Involves two or more tasks.
- Cannot resolve naturally.
- SQL Server chooses a victim.
- Victim receives error 1205.

<!-- question:end:deadlocks-detection-and-mitigation-beginner-q01 -->

#### How is a deadlock different from blocking?

<!-- question:start:deadlocks-detection-and-mitigation-beginner-q02 -->
<!-- question-id:deadlocks-detection-and-mitigation-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

Blocking is a normal wait where one session waits for another session to release a lock. A deadlock is a circular wait where each participant is waiting for another participant in the same cycle. Blocking can resolve when the blocker commits or rolls back. A deadlock requires SQL Server to break the cycle.

SQL Server breaks a deadlock by rolling back one victim transaction.

##### Key Points to Mention

- Blocking is one-way waiting.
- Deadlock is circular waiting.
- Blocking can resolve naturally.
- Deadlock requires victim selection.
- Both involve locks or resources.

<!-- question:end:deadlocks-detection-and-mitigation-beginner-q02 -->

#### What is error 1205?

<!-- question:start:deadlocks-detection-and-mitigation-beginner-q03 -->
<!-- question-id:deadlocks-detection-and-mitigation-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

Error 1205 is the SQL Server error returned when a transaction is chosen as the deadlock victim. SQL Server rolls back the victim transaction so another transaction in the deadlock can continue.

Applications should catch this error and retry only if the operation is safe to repeat.

##### Key Points to Mention

- Deadlock victim error.
- Victim transaction is rolled back.
- Application should handle it.
- Retry can be appropriate.
- Retry must be bounded and safe.

<!-- question:end:deadlocks-detection-and-mitigation-beginner-q03 -->

#### What is a deadlock graph?

<!-- question:start:deadlocks-detection-and-mitigation-beginner-q04 -->
<!-- question-id:deadlocks-detection-and-mitigation-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

A deadlock graph is diagnostic information that shows the sessions and resources involved in a deadlock. It identifies the victim, the processes, the locked resources, and the lock modes held or requested.

It is the main evidence used to understand why a deadlock happened.

##### Key Points to Mention

- Shows victim, processes, and resources.
- Captured by `xml_deadlock_report`.
- Helps identify the cycle.
- Shows held and requested locks.
- Needed for root-cause analysis.

<!-- question:end:deadlocks-detection-and-mitigation-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### How does SQL Server choose a deadlock victim?

<!-- question:start:deadlocks-detection-and-mitigation-intermediate-q01 -->
<!-- question-id:deadlocks-detection-and-mitigation-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

SQL Server considers deadlock priority and rollback cost. A session with lower deadlock priority is more likely to be chosen. If priorities are the same, SQL Server generally chooses the transaction that is cheaper to roll back.

Developers can influence victim choice with `SET DEADLOCK_PRIORITY`, but that does not prevent deadlocks.

##### Key Points to Mention

- Considers deadlock priority.
- Considers rollback cost.
- Lower priority loses first.
- Error 1205 is returned to the victim.
- Priority affects victim choice, not deadlock prevention.

<!-- question:end:deadlocks-detection-and-mitigation-intermediate-q01 -->

#### How do you capture deadlock information?

<!-- question:start:deadlocks-detection-and-mitigation-intermediate-q02 -->
<!-- question-id:deadlocks-detection-and-mitigation-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Use Extended Events, especially the `xml_deadlock_report` event. The default `system_health` session captures deadlock reports in many SQL Server environments, and a custom Extended Events session with an event file target can be used for reliable history.

The deadlock graph should be saved and analyzed rather than relying only on the error message.

##### Key Points to Mention

- Use Extended Events.
- Capture `xml_deadlock_report`.
- `system_health` often captures deadlocks by default.
- Event file target is useful for history.
- Analyze the graph for victim, process, and resource lists.

<!-- question:end:deadlocks-detection-and-mitigation-intermediate-q02 -->

#### Why does consistent table access order reduce deadlocks?

<!-- question:start:deadlocks-detection-and-mitigation-intermediate-q03 -->
<!-- question-id:deadlocks-detection-and-mitigation-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Deadlocks often happen when transactions access the same resources in different orders. If all code paths access resources in the same order, sessions tend to queue behind each other rather than forming a cycle.

For example, always update `Customer` before `Order` instead of having one path update `Customer` then `Order` and another path update `Order` then `Customer`.

##### Key Points to Mention

- Opposite access order creates circular wait risk.
- Consistent order creates normal blocking instead.
- Stored procedures can standardize order.
- Useful for multi-table writes.
- Still need short transactions and good indexes.

<!-- question:end:deadlocks-detection-and-mitigation-intermediate-q03 -->

#### Why can missing indexes contribute to deadlocks?

<!-- question:start:deadlocks-detection-and-mitigation-intermediate-q04 -->
<!-- question-id:deadlocks-detection-and-mitigation-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Missing indexes can force scans that touch many rows and pages. This increases transaction duration, lock footprint, lock escalation risk, and the chance that two transactions will touch resources in conflicting orders.

Targeted indexes can reduce the amount of data read or modified, making locks more focused and shorter-lived.

##### Key Points to Mention

- Missing indexes cause broad scans.
- Broad scans take more locks.
- Longer statements increase overlap between transactions.
- Key lookup patterns can also deadlock.
- Better indexes reduce lock footprint.

<!-- question:end:deadlocks-detection-and-mitigation-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you analyze a deadlock graph?

<!-- question:start:deadlocks-detection-and-mitigation-advanced-q01 -->
<!-- question-id:deadlocks-detection-and-mitigation-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Start with the victim list, then inspect each process in the process list and each resource in the resource list. Identify what each process owned, what it waited for, the lock modes involved, the object and index names, the current statement, transaction start time, isolation level, and application context.

Then map the graph back to code paths and execution plans. The fix usually comes from changing access order, indexes, transaction scope, isolation level, batching, or retry behavior.

##### Key Points to Mention

- Start with victim, process, and resource lists.
- Identify held and requested locks.
- Check object and index names.
- Review statements and isolation levels.
- Map back to application code paths.
- Fix the pattern, not only the victim statement.

<!-- question:end:deadlocks-detection-and-mitigation-advanced-q01 -->

#### How should an application handle deadlock error 1205?

<!-- question:start:deadlocks-detection-and-mitigation-advanced-q02 -->
<!-- question-id:deadlocks-detection-and-mitigation-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

The application should catch error 1205, ensure the transaction is rolled back or no longer active, wait briefly, and retry if the operation is safe to repeat. Retries should be bounded, use backoff or jitter, and log repeated failures.

For operations with external side effects, use idempotency keys or an outbox pattern so retries do not create duplicate effects.

##### Key Points to Mention

- Catch error 1205.
- Retry only safe operations.
- Use bounded retries.
- Add backoff or jitter.
- Log repeated failures.
- Protect side effects with idempotency.

<!-- question:end:deadlocks-detection-and-mitigation-advanced-q02 -->

#### How can row versioning reduce deadlocks?

<!-- question:start:deadlocks-detection-and-mitigation-advanced-q03 -->
<!-- question-id:deadlocks-detection-and-mitigation-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Row versioning, such as RCSI or `SNAPSHOT`, can reduce deadlocks between readers and writers because reads can use committed row versions instead of shared locks. That reduces cycles where readers and writers block each other.

It does not eliminate deadlocks. Writer/writer deadlocks can still happen, schema locks still matter, and `SNAPSHOT` write conflicts must be handled.

##### Key Points to Mention

- Reduces shared-lock read behavior.
- Helps reader/writer deadlocks.
- Does not eliminate writer/writer deadlocks.
- Adds version store overhead.
- Snapshot write conflicts still need handling.

<!-- question:end:deadlocks-detection-and-mitigation-advanced-q03 -->

#### How would you reduce deadlocks in a high-throughput order system?

<!-- question:start:deadlocks-detection-and-mitigation-advanced-q04 -->
<!-- question-id:deadlocks-detection-and-mitigation-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

Standardize resource access order across order, inventory, payment, and customer updates. Keep transactions short, add indexes for lookup and update predicates, avoid external calls inside transactions, batch background work, and use row versioning for read-heavy paths when correctness allows. Capture deadlock graphs and group them by pattern rather than treating each one as unique.

The application should also handle error 1205 with bounded idempotent retries.

##### Key Points to Mention

- Standardize table access order.
- Keep transactions short.
- Add targeted indexes.
- Avoid external calls inside transactions.
- Use row versioning where appropriate.
- Implement safe bounded retries.

<!-- question:end:deadlocks-detection-and-mitigation-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
