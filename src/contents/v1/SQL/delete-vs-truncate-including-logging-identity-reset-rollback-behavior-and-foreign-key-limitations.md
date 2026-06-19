---
id: delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations
topic: SQL practical interview comparisons and SQL Server-specific features
subtopic: DELETE vs TRUNCATE, including logging, identity reset, rollback behavior, and foreign key limitations
category: SQL
---

## Overview

`DELETE` and `TRUNCATE TABLE` both remove data from a table, but they are not interchangeable. `DELETE` is a row-level data modification statement that can remove selected rows with a `WHERE` clause. `TRUNCATE TABLE` removes all rows from a table, or selected partitions in supported cases, by deallocating data pages.

This difference affects logging, locking, identity values, triggers, permissions, foreign keys, rollback behavior, and operational safety. `DELETE` is flexible and constraint-aware but can be slower and produce more transaction log activity for large removals. `TRUNCATE` is faster for clearing a table, but it has stricter limitations and stronger table-level behavior.

This topic is important for interviews because many candidates memorize "TRUNCATE is faster" but miss the details that matter in production: `TRUNCATE` resets identity values, cannot be used on tables referenced by foreign keys, does not fire delete triggers, and can still be rolled back inside a transaction in SQL Server.

The practical goal is to choose the operation that matches the data-removal intent, integrity requirements, recoverability needs, and operational risk.

## Core Concepts

### DELETE

`DELETE` removes rows from a table or updatable view.

```sql
DELETE FROM dbo.Orders
WHERE Status = N'Draft'
  AND CreatedAtUtc < DATEADD(day, -30, SYSUTCDATETIME());
```

Use `DELETE` when:

- Only some rows should be removed.
- A `WHERE` clause is needed.
- Foreign key cascades or constraint checks must be honored row by row.
- Delete triggers must run.
- Deleted rows must be captured with `OUTPUT`.
- The table is referenced by foreign keys and cannot be truncated.
- You need batching to reduce lock duration and log pressure.

Without a `WHERE` clause, `DELETE` removes all rows:

```sql
DELETE FROM dbo.StageImportRows;
```

That is still different from `TRUNCATE TABLE` because it logs row deletions, does not reset identity automatically, and fires delete triggers.

### TRUNCATE TABLE

`TRUNCATE TABLE` removes all rows from a table by deallocating the pages used by the table and its indexes.

```sql
TRUNCATE TABLE dbo.StageImportRows;
```

Use `TRUNCATE TABLE` when:

- The intent is to clear the entire table.
- No row filter is needed.
- The table is not referenced by a foreign key constraint.
- Delete triggers are not required.
- Resetting identity is acceptable or desired.
- The operation is part of a controlled maintenance or staging workflow.

For partitioned tables, SQL Server can truncate specific partitions when the table and indexes are aligned:

```sql
TRUNCATE TABLE dbo.FactSales
WITH (PARTITIONS (1, 2, 3));
```

### Row Removal vs Page Deallocation

`DELETE` removes rows one at a time from the logical perspective. SQL Server logs the deleted rows and may keep empty pages allocated, especially in heaps.

`TRUNCATE TABLE` removes data by deallocating data pages. SQL Server logs page deallocations instead of logging each individual row deletion. This is why truncation usually uses fewer transaction log resources and is faster for clearing a large table.

Conceptually:

```sql
-- Row-targeted operation.
DELETE FROM dbo.AuditBuffer
WHERE CreatedAtUtc < @Cutoff;

-- Whole-table reset operation.
TRUNCATE TABLE dbo.AuditBuffer;
```

If you need a row predicate, use `DELETE`. If you need to clear a whole eligible table, `TRUNCATE` may be a better fit.

### Logging Behavior

`DELETE` is fully logged. For a large table, deleting millions of rows can generate a large amount of transaction log activity.

```sql
DELETE FROM dbo.EventLog
WHERE CreatedAtUtc < '2026-01-01';
```

This can be correct, but the operation may need batching:

```sql
WHILE 1 = 1
BEGIN
    DELETE TOP (5000)
    FROM dbo.EventLog
    WHERE CreatedAtUtc < '2026-01-01';

    IF @@ROWCOUNT = 0
        BREAK;
END;
```

`TRUNCATE TABLE` logs page deallocations and normally uses much less log space:

```sql
TRUNCATE TABLE dbo.EventLogArchiveWork;
```

This does not mean it is unlogged. It is still logged enough for transaction rollback and recovery.

### Identity Reset

`TRUNCATE TABLE` resets the identity counter to the seed value defined for the column. If no seed is defined, the default seed is used.

```sql
CREATE TABLE dbo.ImportBatch
(
    ImportBatchId INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    SourceFileName NVARCHAR(260) NOT NULL
);

TRUNCATE TABLE dbo.ImportBatch;
```

After truncation, the next inserted row starts again at the identity seed.

`DELETE` does not reset the identity counter:

```sql
DELETE FROM dbo.ImportBatch;
```

After deleting all rows, the next inserted identity value continues from the previous identity sequence unless the identity is reseeded manually.

Manual reseed:

```sql
DBCC CHECKIDENT ('dbo.ImportBatch', RESEED, 0);
```

For an identity defined as `IDENTITY(1, 1)`, reseeding to `0` after `DELETE` usually makes the next inserted value `1`.

### Rollback Behavior

Both `DELETE` and `TRUNCATE TABLE` can be rolled back when executed inside an explicit transaction in SQL Server.

```sql
BEGIN TRANSACTION;

TRUNCATE TABLE dbo.StageImportRows;

ROLLBACK TRANSACTION;
```

After rollback, the rows are restored.

This is a common interview misconception. `TRUNCATE` is often described as "DDL-like" because it changes data allocation and requires stronger permissions, but in SQL Server it is still transactionally logged enough to roll back.

Be careful: rollback behavior in interviews may depend on the database platform. For SQL Server, `TRUNCATE TABLE` can be rolled back inside a transaction.

### Foreign Key Limitations

`DELETE` can be used on a table involved in foreign key relationships, subject to the foreign key rules.

Example:

```sql
DELETE FROM dbo.Customers
WHERE CustomerId = 42;
```

This fails if child rows reference the customer and no cascade rule allows the delete.

`TRUNCATE TABLE` cannot be used on a table that is referenced by a foreign key constraint, even if the referencing table is empty. SQL Server allows truncation for a table with a self-referencing foreign key, but not for a table referenced by another table.

Example:

```sql
-- If Orders.CustomerId references Customers.CustomerId,
-- this is not allowed.
TRUNCATE TABLE dbo.Customers;
```

Use `DELETE`, drop and recreate the constraint in controlled maintenance, or truncate child tables first when the schema and business process allow it.

### Trigger Behavior

`DELETE` fires delete triggers.

```sql
CREATE TRIGGER dbo.trg_Customers_Delete
ON dbo.Customers
AFTER DELETE
AS
BEGIN
    INSERT INTO dbo.CustomerDeleteAudit(CustomerId, DeletedAtUtc)
    SELECT CustomerId, SYSUTCDATETIME()
    FROM deleted;
END;
```

If rows are removed with `DELETE`, the trigger can audit the deleted rows through the `deleted` pseudo-table.

`TRUNCATE TABLE` does not fire delete triggers because it does not log individual row deletions.

If auditing, cleanup, or downstream logic depends on delete triggers, do not use `TRUNCATE TABLE` unless that missing trigger behavior is explicitly acceptable.

### WHERE Clause Support

`DELETE` supports filtering:

```sql
DELETE FROM dbo.Sessions
WHERE ExpiresAtUtc < SYSUTCDATETIME();
```

`TRUNCATE TABLE` does not support `WHERE`.

```sql
-- Invalid.
TRUNCATE TABLE dbo.Sessions
WHERE ExpiresAtUtc < SYSUTCDATETIME();
```

If you need to remove only old, inactive, invalid, or tenant-specific rows, use `DELETE`.

### OUTPUT Clause

`DELETE` can return deleted rows with the `OUTPUT` clause.

```sql
DELETE FROM dbo.CartItems
OUTPUT
    deleted.CartItemId,
    deleted.ProductId,
    deleted.Quantity
WHERE CartId = @CartId;
```

This is useful for auditing, application feedback, queues, or migration scripts.

`TRUNCATE TABLE` cannot return individual removed rows because it does not process rows individually.

### Permissions

`DELETE` requires `DELETE` permission on the target table. If the `WHERE` clause reads columns, `SELECT` permission may also be required.

`TRUNCATE TABLE` requires stronger permission, such as `ALTER` on the table. This is another sign that truncation is a schema-level maintenance operation, not just a normal row deletion.

In interviews, mention permissions when discussing operational safety. A user allowed to delete rows may not be allowed to truncate a table.

### Locking and Concurrency

`DELETE` typically locks rows or pages it modifies and holds locks according to the transaction and isolation behavior.

`TRUNCATE TABLE` takes a table-level lock and schema modification lock. It is fast, but it is not subtle. It can block concurrent access and should be used carefully in production workflows.

For large `DELETE` operations, batching can reduce transaction size:

```sql
WHILE 1 = 1
BEGIN
    DELETE TOP (10000)
    FROM dbo.AuditEvents
    WHERE CreatedAtUtc < @Cutoff;

    IF @@ROWCOUNT = 0
        BREAK;
END;
```

For staging tables used by one job at a time, `TRUNCATE TABLE` is often simpler.

### Space Reuse

`DELETE` removes rows but may leave allocated empty pages behind, especially in heaps.

`TRUNCATE TABLE` deallocates the data pages. That usually makes it better when the goal is to clear all data and release storage pages for reuse.

For very large tables, SQL Server may use deferred deallocation after truncation. The table is logically empty immediately, but physical page cleanup can happen after the transaction commits.

### DELETE With JOIN

`DELETE` can use another table to identify rows to remove.

```sql
DELETE o
FROM dbo.Orders AS o
JOIN dbo.Customers AS c
    ON c.CustomerId = o.CustomerId
WHERE c.IsTestAccount = 1;
```

This deletes matching rows from `Orders`, not from `Customers`.

Always make the target table clear when deleting with joins. Review the result with a `SELECT` first:

```sql
SELECT o.*
FROM dbo.Orders AS o
JOIN dbo.Customers AS c
    ON c.CustomerId = o.CustomerId
WHERE c.IsTestAccount = 1;
```

### DELETE TOP and Ordering

`DELETE TOP (n)` can limit the number of rows deleted, but direct ordering is not part of the `DELETE` syntax.

Unsafe assumption:

```sql
DELETE TOP (1000)
FROM dbo.AuditEvents
WHERE CreatedAtUtc < @Cutoff;
```

This deletes an arbitrary qualifying set of rows.

If deletion order matters, select the keys first:

```sql
WITH RowsToDelete AS
(
    SELECT TOP (1000) AuditEventId
    FROM dbo.AuditEvents
    WHERE CreatedAtUtc < @Cutoff
    ORDER BY CreatedAtUtc, AuditEventId
)
DELETE ae
FROM dbo.AuditEvents AS ae
JOIN RowsToDelete AS d
    ON d.AuditEventId = ae.AuditEventId;
```

This pattern is useful for batching old data in a predictable order.

### Operational Safety

Before running either operation in production, especially without a narrow filter, check:

- Is there a backup or recovery plan?
- Is this the correct database and environment?
- Is the `WHERE` clause correct?
- Is the row count expected?
- Are foreign keys, cascades, and triggers understood?
- Is identity reset acceptable?
- Will the transaction log have enough space?
- Could the operation block critical workloads?
- Should the operation run in batches?
- Should deleted rows be archived or audited first?

For destructive operations, a cautious workflow is healthy engineering, not hesitation.

### Common Mistakes

Common mistakes include:

- Saying `TRUNCATE` cannot be rolled back in SQL Server.
- Using `TRUNCATE` when delete triggers must fire.
- Forgetting that `TRUNCATE` resets identity.
- Running `DELETE` without a `WHERE` clause accidentally.
- Using `TRUNCATE` on a table referenced by a foreign key.
- Assuming `DELETE TOP` deletes the oldest rows without an ordered key selection.
- Deleting huge tables in one transaction without considering log growth.
- Dropping foreign keys to truncate without a controlled process.
- Using `TRUNCATE` in a shared production table while other sessions need access.

### Best Practices

Best practices include:

- Use `DELETE` for selective removal.
- Use `TRUNCATE TABLE` for controlled whole-table clearing.
- Verify row counts with `SELECT COUNT(*)` before deleting.
- Wrap dangerous maintenance operations in explicit transactions when appropriate.
- Use batches for large deletes.
- Check foreign keys and triggers before choosing truncation.
- Confirm identity reset behavior before truncating.
- Use `OUTPUT` with `DELETE` when audit or downstream processing needs removed rows.
- Keep staging-table truncation separate from business-data deletion.
- Test scripts in nonproduction with realistic constraints.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the main difference between `DELETE` and `TRUNCATE TABLE`?

<!-- question:start:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-beginner-q01 -->
<!-- question-id:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

`DELETE` removes rows and can use a `WHERE` clause to remove only selected rows. `TRUNCATE TABLE` removes all rows from a table by deallocating data pages and does not support a `WHERE` clause.

`DELETE` is more flexible and row-oriented. `TRUNCATE` is usually faster for clearing an entire eligible table, uses fewer transaction log resources, resets identity, and has restrictions such as foreign key limitations.

##### Key Points to Mention

- `DELETE` can be selective.
- `TRUNCATE` clears the whole table or eligible partitions.
- `DELETE` logs row deletions.
- `TRUNCATE` logs page deallocations.
- `TRUNCATE` resets identity in SQL Server.

<!-- question:end:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-beginner-q01 -->

#### Can `TRUNCATE TABLE` use a `WHERE` clause?

<!-- question:start:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-beginner-q02 -->
<!-- question-id:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

No. `TRUNCATE TABLE` does not support a `WHERE` clause. It removes all rows from the table, or selected partitions in supported partitioned-table scenarios.

If only some rows should be removed, use `DELETE` with a `WHERE` clause. For example, deleting expired sessions or old audit rows requires `DELETE`.

##### Key Points to Mention

- `TRUNCATE TABLE` has no row predicate.
- Use `DELETE` for selective removal.
- Partition truncation is a separate supported scenario.
- Never use `DELETE` without checking the `WHERE` clause.

<!-- question:end:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-beginner-q02 -->

#### Which operation resets identity values?

<!-- question:start:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-beginner-q03 -->
<!-- question-id:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

In SQL Server, `TRUNCATE TABLE` resets the identity counter to the seed value. `DELETE` does not reset the identity counter, even if every row is deleted.

If rows are removed with `DELETE` and the identity must be reset, use `DBCC CHECKIDENT` carefully. In production, identity reset should be intentional because duplicate identity values can cause constraint errors if existing rows remain.

##### Key Points to Mention

- `TRUNCATE` resets identity.
- `DELETE` does not.
- `DBCC CHECKIDENT` can reseed manually.
- Reseeding is risky when rows still exist.
- Identity behavior matters for staging tables and tests.

<!-- question:end:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-beginner-q03 -->

#### Can `TRUNCATE TABLE` be rolled back in SQL Server?

<!-- question:start:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-beginner-q04 -->
<!-- question-id:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Yes. In SQL Server, `TRUNCATE TABLE` can be rolled back when it is executed inside an explicit transaction. This surprises many candidates because truncation is often described as DDL-like and minimally logged.

It is still logged enough for rollback and recovery. The key interview wording is: in SQL Server, `TRUNCATE TABLE` can be rolled back inside a transaction.

##### Key Points to Mention

- SQL Server supports rollback of truncation in a transaction.
- `TRUNCATE` is not unlogged.
- It logs page deallocations.
- Platform differences may exist.
- Do not repeat the myth that truncate is never rollbackable.

<!-- question:end:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why is `TRUNCATE TABLE` usually faster than `DELETE` for clearing a table?

<!-- question:start:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-intermediate-q01 -->
<!-- question-id:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

`TRUNCATE TABLE` is usually faster because it deallocates the data pages used by the table and indexes instead of deleting rows one by one. SQL Server logs the page deallocations rather than logging each individual row deletion.

`DELETE` is fully logged and can lock many individual rows or pages. It also fires delete triggers and checks row-level delete behavior. That flexibility costs more for very large whole-table removals.

##### Key Points to Mention

- `TRUNCATE` deallocates pages.
- `DELETE` removes rows.
- `DELETE` is fully logged.
- `TRUNCATE` uses fewer log resources.
- `TRUNCATE` usually uses table-level locks.

<!-- question:end:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-intermediate-q01 -->

#### Why can `TRUNCATE TABLE` fail on tables with foreign keys?

<!-- question:start:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-intermediate-q02 -->
<!-- question-id:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

SQL Server does not allow `TRUNCATE TABLE` on a table that is referenced by a foreign key constraint from another table. This is true even if the referencing table is empty. A self-referencing foreign key is an exception.

Use `DELETE` when the table participates in normal parent-child relationships and referential integrity must be enforced. If a maintenance process needs truncation, it must handle child tables and constraints in a controlled, reviewed way.

##### Key Points to Mention

- Referenced tables cannot be truncated.
- Empty child tables do not remove the limitation.
- Self-referencing foreign key is an exception.
- `DELETE` respects foreign key behavior.
- Dropping constraints just to truncate is risky.

<!-- question:end:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-intermediate-q02 -->

#### How do triggers differ between `DELETE` and `TRUNCATE TABLE`?

<!-- question:start:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-intermediate-q03 -->
<!-- question-id:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

`DELETE` fires delete triggers because it removes rows as a DML operation. Triggers can inspect deleted rows through the `deleted` pseudo-table.

`TRUNCATE TABLE` does not fire delete triggers because it does not log individual row deletions. If audit, cleanup, or integration logic depends on delete triggers, `TRUNCATE` is not equivalent to `DELETE`.

##### Key Points to Mention

- `DELETE` fires delete triggers.
- `TRUNCATE` does not.
- Triggers can audit deleted rows for `DELETE`.
- Missing trigger behavior may break business logic.
- Do not use `TRUNCATE` when trigger side effects are required.

<!-- question:end:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-intermediate-q03 -->

#### When should you use batched `DELETE` instead of `TRUNCATE TABLE`?

<!-- question:start:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-intermediate-q04 -->
<!-- question-id:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Use batched `DELETE` when only part of the table should be removed, when the table is referenced by foreign keys, when triggers must fire, or when a single massive delete would create too much log growth or blocking.

Batched deletes remove rows in smaller transactions, often by selecting a top set of keys in a predictable order and deleting those rows repeatedly until no qualifying rows remain.

##### Key Points to Mention

- Needed for selective deletion.
- Useful for large production cleanup.
- Reduces transaction size and log pressure.
- Can reduce lock duration.
- Select keys first if delete order matters.

<!-- question:end:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you safely clear a large staging table after each import?

<!-- question:start:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-advanced-q01 -->
<!-- question-id:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

If the staging table is isolated, not referenced by foreign keys, does not need delete triggers, and identity reset is acceptable, I would usually use `TRUNCATE TABLE`. It is fast, uses fewer transaction log resources, and leaves the table structure ready for the next import.

I would still check permissions, concurrency, and transactional behavior. If the staging table is shared with other processes or the import needs audit rows, I would reconsider and possibly use `DELETE` or partition switching patterns.

##### Key Points to Mention

- Staging tables are common truncate candidates.
- Verify no foreign key reference blocks truncation.
- Confirm identity reset is acceptable.
- Confirm triggers are not needed.
- Consider job isolation and concurrency.

<!-- question:end:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-advanced-q01 -->

#### How would you delete old audit rows safely in production?

<!-- question:start:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-advanced-q02 -->
<!-- question-id:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

I would not use `TRUNCATE` because the goal is selective deletion by date. I would use `DELETE` with a cutoff predicate, often in batches. I would ensure an index supports the date predicate, test the row count first, monitor log growth and blocking, and keep the batch size small enough for the production workload.

If the audit table is partitioned by date, a partition-based archival or truncation approach might be better, but only if the partitioning design and retention policy support it.

##### Key Points to Mention

- Use `DELETE` for selective cleanup.
- Batch large deletes.
- Index the cutoff column.
- Check row count before deleting.
- Monitor log growth and blocking.
- Consider partition maintenance for very large audit tables.

<!-- question:end:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-advanced-q02 -->

#### How do logging and rollback fit together for `TRUNCATE TABLE`?

<!-- question:start:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-advanced-q03 -->
<!-- question-id:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

`TRUNCATE TABLE` is minimally logged compared with `DELETE`, but it is not unlogged. SQL Server logs the deallocation of data pages. That is enough for the database engine to roll the operation back inside a transaction and recover consistently.

The phrase "minimally logged" should not be confused with "cannot be rolled back." The operation uses fewer log records because it does not log each row deletion.

##### Key Points to Mention

- `TRUNCATE` logs page deallocations.
- `DELETE` logs individual row deletions.
- `TRUNCATE` can roll back in SQL Server.
- Minimal logging is still logging.
- Recovery and rollback still need log information.

<!-- question:end:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-advanced-q03 -->

#### How would you review a pull request that replaces `DELETE` with `TRUNCATE TABLE`?

<!-- question:start:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-advanced-q04 -->
<!-- question-id:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

I would ask whether the operation truly intends to remove every row. Then I would check foreign keys, triggers, identity behavior, permissions, replication or temporal-table involvement, transaction handling, concurrency, and whether deleted-row auditing is required.

If the table is a private staging table, the change may be good. If it is business data, referenced data, audited data, or a table where identity continuity matters, replacing `DELETE` with `TRUNCATE` may introduce a serious behavioral change.

##### Key Points to Mention

- Verify whole-table removal is intended.
- Check foreign keys and triggers.
- Check identity reset impact.
- Check permissions and environment.
- Check auditing and recovery needs.
- Staging table and business table risk levels differ.

<!-- question:end:delete-vs-truncate-including-logging-identity-reset-rollback-behavior-and-foreign-key-limitations-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
