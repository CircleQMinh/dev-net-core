---
id: acid-basics-and-transaction-scope
topic: Transactions, isolation, locking, and deadlocks
subtopic: ACID basics and transaction scope
category: SQL
---

## Overview

ACID describes the core reliability guarantees expected from database transactions: atomicity, consistency, isolation, and durability. A transaction is a unit of work that should either complete successfully as a whole or be undone as a whole. In SQL Server, transactions are controlled with statements such as `BEGIN TRANSACTION`, `COMMIT TRANSACTION`, `ROLLBACK TRANSACTION`, and `SAVE TRANSACTION`.

Transaction scope defines which statements belong to the same unit of work, who owns the transaction boundary, and when changes become permanent or are rolled back. This is not just syntax. Scope decisions affect locks, blocking, error handling, retry behavior, logging, and whether the database can be left in a partially updated state.

This topic matters because almost every real application has multi-step operations: creating an order and its order lines, moving money between accounts, reserving inventory, importing batches, approving workflows, and updating related tables. Without correct transaction scope, failures can leave inconsistent data.

For interviews, strong candidates can explain the ACID properties, know when explicit transactions are needed, keep transactions short, handle errors with rollback, understand `@@TRANCOUNT` and `XACT_STATE()`, and avoid pretending that nested `BEGIN TRANSACTION` statements are independent transactions.

## Core Concepts

### What A Transaction Is

A transaction is one unit of work.

Simple example:

```sql
BEGIN TRANSACTION;

UPDATE dbo.Accounts
SET Balance = Balance - 100.00
WHERE AccountId = @FromAccountId;

UPDATE dbo.Accounts
SET Balance = Balance + 100.00
WHERE AccountId = @ToAccountId;

COMMIT TRANSACTION;
```

Both updates should succeed together. If the debit succeeds but the credit fails, the transaction should roll back so money is not lost.

Rollback example:

```sql
BEGIN TRANSACTION;

UPDATE dbo.Accounts
SET Balance = Balance - 100.00
WHERE AccountId = @FromAccountId;

-- Something fails before the second update.

ROLLBACK TRANSACTION;
```

`ROLLBACK` undoes the data modifications in the transaction scope.

### Atomicity

Atomicity means all-or-nothing behavior. Either every required step in the transaction commits, or none of the changes remain.

Example:

```sql
BEGIN TRY
    BEGIN TRANSACTION;

    INSERT dbo.Orders (CustomerId, CreatedAt)
    VALUES (@CustomerId, SYSUTCDATETIME());

    DECLARE @OrderId BIGINT = CONVERT(BIGINT, SCOPE_IDENTITY());

    INSERT dbo.OrderLines (OrderId, ProductId, Quantity)
    SELECT @OrderId, ProductId, Quantity
    FROM @OrderLineInput;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
    BEGIN
        ROLLBACK TRANSACTION;
    END;

    THROW;
END CATCH;
```

If inserting order lines fails, the order header is rolled back too.

### Consistency

Consistency means the transaction moves the database from one valid state to another valid state. It should preserve constraints and business rules.

Examples of consistency rules:

- Foreign keys must reference existing parent rows.
- Account balances must not go below allowed limits.
- Inventory reservations must not exceed available stock.
- An order total should match the sum of its lines.
- A user email should remain unique inside a tenant.

SQL Server enforces some consistency rules through constraints, such as primary keys, foreign keys, unique constraints, check constraints, and triggers. Application and stored procedure logic may enforce additional business rules.

Important interview nuance: consistency is a shared responsibility between schema design, transaction logic, isolation choices, and application rules.

### Isolation

Isolation controls how much one transaction can see or affect another transaction's in-progress work.

Without enough isolation, transactions can experience:

- Dirty reads.
- Nonrepeatable reads.
- Phantom reads.
- Lost updates.
- Write skew in some versioning scenarios.

Example problem:

```sql
-- Session 1
BEGIN TRANSACTION;

UPDATE dbo.Products
SET StockQuantity = StockQuantity - 1
WHERE ProductId = 10;

-- Not committed yet.
```

Another session should not make a business decision based on the uncommitted value unless the application explicitly accepts dirty-read risk.

Isolation is covered more deeply in the related isolation-level subtopic, but for ACID, the core idea is that concurrent transactions should not corrupt each other's correctness.

### Durability

Durability means that once a transaction commits, its changes survive failures according to the database's durability guarantees.

Example:

```sql
COMMIT TRANSACTION;
```

After commit succeeds, the application can treat the changes as permanent. SQL Server uses the transaction log as part of making committed changes recoverable.

Interview nuance: durability does not mean the application can ignore backups, replication, disaster recovery, or delayed durability settings. It means committed database changes are not merely in application memory.

### Transaction Modes In SQL Server

SQL Server supports several transaction modes:

- Autocommit: each individual statement is its own transaction.
- Explicit: the application or procedure starts with `BEGIN TRANSACTION` and ends with `COMMIT` or `ROLLBACK`.
- Implicit: SQL Server starts a new transaction automatically for certain statements, but the caller must explicitly commit or roll back.
- Batch-scoped: applies to certain multiple active result set scenarios.

Autocommit example:

```sql
UPDATE dbo.Users
SET LastLoginAt = SYSUTCDATETIME()
WHERE UserId = @UserId;
```

This statement is its own transaction unless an explicit or implicit transaction is already active.

Explicit transaction example:

```sql
BEGIN TRANSACTION;

UPDATE dbo.Inventory
SET QuantityAvailable = QuantityAvailable - @Quantity
WHERE ProductId = @ProductId;

INSERT dbo.InventoryReservations (ProductId, Quantity, CreatedAt)
VALUES (@ProductId, @Quantity, SYSUTCDATETIME());

COMMIT TRANSACTION;
```

### Transaction Scope

Transaction scope is the boundary around the work protected by the transaction.

Good scope:

- Starts just before the related data changes.
- Includes all statements that must succeed or fail together.
- Avoids user interaction while open.
- Avoids slow network calls while open.
- Commits or rolls back as soon as possible.

Bad scope:

```sql
BEGIN TRANSACTION;

SELECT *
FROM dbo.Orders
WHERE CustomerId = @CustomerId;

-- Application waits for user input here.
-- Locks may remain open much longer than needed.

UPDATE dbo.Orders
SET Status = N'Approved'
WHERE OrderId = @OrderId;

COMMIT TRANSACTION;
```

Long transaction scopes increase blocking, deadlock risk, version store pressure under row versioning, and transaction log growth.

### COMMIT

`COMMIT TRANSACTION` marks a successful transaction complete. When the outermost transaction commits, data modifications become permanent.

Example:

```sql
BEGIN TRANSACTION;

DELETE dbo.CartItems
WHERE CartId = @CartId;

COMMIT TRANSACTION;
```

In SQL Server, if `@@TRANCOUNT` is greater than 1, `COMMIT` only decrements the count by one. It does not make the work permanent until the outermost transaction commits.

### ROLLBACK

`ROLLBACK TRANSACTION` undoes data modifications made in the transaction.

Example:

```sql
BEGIN TRANSACTION;

UPDATE dbo.Products
SET Price = Price * 1.10;

ROLLBACK TRANSACTION;
```

Without a savepoint, `ROLLBACK` rolls back the full transaction and sets `@@TRANCOUNT` to 0.

Important nuance: rollback does not undo changes to local variables or table variables in the same way it undoes table data. Do not use variable state as proof that a database change committed.

### @@TRANCOUNT

`@@TRANCOUNT` returns the number of active `BEGIN TRANSACTION` statements on the current connection.

Example:

```sql
SELECT @@TRANCOUNT AS BeforeBegin;

BEGIN TRANSACTION;
SELECT @@TRANCOUNT AS AfterOuterBegin;

BEGIN TRANSACTION;
SELECT @@TRANCOUNT AS AfterInnerBegin;

COMMIT TRANSACTION;
SELECT @@TRANCOUNT AS AfterInnerCommit;

ROLLBACK TRANSACTION;
SELECT @@TRANCOUNT AS AfterRollback;
```

`BEGIN TRANSACTION` increments `@@TRANCOUNT`. `COMMIT` decrements it by one. A full `ROLLBACK` sets it to zero.

Interview trap: SQL Server does not provide independently committable nested transactions just because `@@TRANCOUNT` is greater than one.

### Nested Transactions Are Not Independent

This pattern is misleading:

```sql
BEGIN TRANSACTION OuterTran;

INSERT dbo.AuditLog (Message)
VALUES (N'Outer work');

BEGIN TRANSACTION InnerTran;

INSERT dbo.AuditLog (Message)
VALUES (N'Inner work');

COMMIT TRANSACTION InnerTran;

ROLLBACK TRANSACTION OuterTran;
```

The inner `COMMIT` only decrements `@@TRANCOUNT`. The outer rollback still rolls back all work, including the inner work.

Use savepoints when you need partial rollback inside a larger transaction.

### Savepoints

A savepoint marks a location inside a transaction that can be rolled back to without rolling back all previous work.

Example:

```sql
BEGIN TRANSACTION;

INSERT dbo.BatchImports (BatchId, CreatedAt)
VALUES (@BatchId, SYSUTCDATETIME());

SAVE TRANSACTION BeforeOptionalRows;

BEGIN TRY
    INSERT dbo.OptionalImportRows (BatchId, Payload)
    SELECT @BatchId, Payload
    FROM @OptionalRows;
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION BeforeOptionalRows;
END CATCH;

COMMIT TRANSACTION;
```

Savepoints are useful, but they add complexity. Many application workflows are clearer when a procedure either owns the full transaction or lets the caller own it.

### XACT_STATE

`XACT_STATE()` reports whether the current session has an active transaction and whether it can be committed.

Common values:

- `1`: active and committable transaction.
- `0`: no active user transaction.
- `-1`: active but uncommittable transaction.

Typical error pattern:

```sql
BEGIN TRY
    BEGIN TRANSACTION;

    -- Work here.

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
    BEGIN
        ROLLBACK TRANSACTION;
    END;

    THROW;
END CATCH;
```

Use `XACT_STATE()` in `CATCH` because some errors leave the transaction uncommittable.

### SET XACT_ABORT ON

`SET XACT_ABORT ON` causes many runtime errors to automatically abort and roll back the current transaction.

Example:

```sql
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    INSERT dbo.Payments (PaymentId, Amount)
    VALUES (@PaymentId, @Amount);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
    BEGIN
        ROLLBACK TRANSACTION;
    END;

    THROW;
END CATCH;
```

This is common in stored procedures that perform transactional writes. It does not replace `TRY...CATCH`; it makes the failure behavior less surprising.

### Transaction Scope In Application Code

A database transaction should usually stay close to the database work.

Avoid:

- Holding a transaction open while calling an external API.
- Holding a transaction open while waiting for user input.
- Running long reports inside write transactions.
- Mixing unrelated changes into one large transaction.
- Retrying non-idempotent work without a stable key.

Better design:

- Validate inputs before opening the transaction.
- Open the transaction for the minimum necessary writes.
- Commit quickly.
- Use an outbox, queue, or background process for external side effects.
- Use idempotency keys when retries are possible.

### Common Mistakes

Common mistakes include:

- Forgetting to roll back in error paths.
- Swallowing errors after rollback.
- Holding transactions open too long.
- Assuming nested transactions commit independently.
- Using `@@TRANCOUNT` when `XACT_STATE()` is needed.
- Committing work after a transaction is uncommittable.
- Doing external service calls inside an open transaction.
- Assuming constraints are optional because the application checks first.
- Using one huge transaction for unrelated work.
- Retrying operations without idempotency.

### Best Practices

Best practices:

- Keep transactions short and focused.
- Include only work that must succeed or fail together.
- Use constraints to protect consistency.
- Use `TRY...CATCH`, `XACT_STATE()`, and `THROW`.
- Use `SET XACT_ABORT ON` for many transactional write procedures.
- Track transaction ownership when procedures can be called inside existing transactions.
- Do not commit a transaction you did not start unless that is the documented contract.
- Use savepoints sparingly and intentionally.
- Avoid user input and external calls inside open transactions.
- Test failure paths, deadlocks, timeouts, and retries.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What does ACID stand for?

<!-- question:start:acid-basics-and-transaction-scope-beginner-q01 -->
<!-- question-id:acid-basics-and-transaction-scope-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

ACID stands for atomicity, consistency, isolation, and durability. These are transaction guarantees that help databases handle failures and concurrency safely. Atomicity means all-or-nothing, consistency means valid state transitions, isolation means transactions should not corrupt each other, and durability means committed changes survive failures according to the database's durability guarantees.

##### Key Points to Mention

- Atomicity is all-or-nothing.
- Consistency preserves valid rules.
- Isolation controls concurrent visibility and interference.
- Durability protects committed work.
- Transactions are the unit where ACID is applied.

<!-- question:end:acid-basics-and-transaction-scope-beginner-q01 -->

#### What is a transaction?

<!-- question:start:acid-basics-and-transaction-scope-beginner-q02 -->
<!-- question-id:acid-basics-and-transaction-scope-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

A transaction is a unit of work that should complete successfully as a whole or be undone as a whole. In SQL Server, an explicit transaction starts with `BEGIN TRANSACTION` and ends with `COMMIT TRANSACTION` or `ROLLBACK TRANSACTION`.

Transactions are used when multiple statements must keep the database consistent together.

##### Key Points to Mention

- Unit of work.
- Uses `BEGIN`, `COMMIT`, and `ROLLBACK`.
- Protects multi-step changes.
- Prevents partial updates.
- Scope should be intentional.

<!-- question:end:acid-basics-and-transaction-scope-beginner-q02 -->

#### What is the difference between COMMIT and ROLLBACK?

<!-- question:start:acid-basics-and-transaction-scope-beginner-q03 -->
<!-- question-id:acid-basics-and-transaction-scope-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

`COMMIT` completes a successful transaction and makes its changes permanent when the outermost transaction commits. `ROLLBACK` undoes changes made in the transaction and releases transaction resources.

Use `COMMIT` only after all required work succeeds. Use `ROLLBACK` when the transaction cannot safely complete.

##### Key Points to Mention

- `COMMIT` keeps successful changes.
- `ROLLBACK` undoes transaction changes.
- Outermost commit makes work permanent.
- Rollback protects against partial updates.
- Error paths should roll back.

<!-- question:end:acid-basics-and-transaction-scope-beginner-q03 -->

#### What is transaction scope?

<!-- question:start:acid-basics-and-transaction-scope-beginner-q04 -->
<!-- question-id:acid-basics-and-transaction-scope-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Transaction scope is the set of statements included in the transaction boundary. It defines what work commits or rolls back together. A good transaction scope includes all related changes that must be atomic, but avoids unrelated work, long waits, user interaction, or external service calls.

Good scope keeps data safe without holding locks longer than necessary.

##### Key Points to Mention

- Defines the transaction boundary.
- Includes work that must succeed or fail together.
- Should be short and focused.
- Long scopes increase blocking.
- Avoid external calls inside the transaction.

<!-- question:end:acid-basics-and-transaction-scope-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### Why are nested transactions in SQL Server not independently committed?

<!-- question:start:acid-basics-and-transaction-scope-intermediate-q01 -->
<!-- question-id:acid-basics-and-transaction-scope-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

In SQL Server, nested `BEGIN TRANSACTION` statements increase `@@TRANCOUNT`, but inner `COMMIT` statements only decrement the count. The changes are not made permanent until the outermost transaction commits. A full rollback rolls back the whole transaction scope, including work inside inner transaction blocks.

If partial rollback is needed, use savepoints rather than assuming inner transactions are independent.

##### Key Points to Mention

- `BEGIN` increments `@@TRANCOUNT`.
- Inner `COMMIT` only decrements `@@TRANCOUNT`.
- Outermost commit makes changes permanent.
- Full rollback rolls back all inner work.
- Savepoints support partial rollback.

<!-- question:end:acid-basics-and-transaction-scope-intermediate-q01 -->

#### What is @@TRANCOUNT used for?

<!-- question:start:acid-basics-and-transaction-scope-intermediate-q02 -->
<!-- question-id:acid-basics-and-transaction-scope-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

`@@TRANCOUNT` returns the number of active `BEGIN TRANSACTION` statements on the current connection. It is useful for detecting whether a procedure was called inside an existing transaction and for tracking transaction ownership.

However, it does not tell whether the transaction is committable. Use `XACT_STATE()` for that.

##### Key Points to Mention

- Counts active transaction nesting.
- Helps detect caller-owned transactions.
- `COMMIT` decrements by one.
- Full `ROLLBACK` sets it to zero.
- Does not indicate committable state.

<!-- question:end:acid-basics-and-transaction-scope-intermediate-q02 -->

#### What is XACT_STATE used for?

<!-- question:start:acid-basics-and-transaction-scope-intermediate-q03 -->
<!-- question-id:acid-basics-and-transaction-scope-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

`XACT_STATE()` reports whether the current session has an active user transaction and whether that transaction can be committed. It returns `1` for active and committable, `0` for no active transaction, and `-1` for active but uncommittable.

It is especially useful in `CATCH` blocks because some errors leave a transaction active but unable to commit.

##### Key Points to Mention

- `1` means active and committable.
- `0` means no active transaction.
- `-1` means active but uncommittable.
- Important in error handling.
- Different from `@@TRANCOUNT`.

<!-- question:end:acid-basics-and-transaction-scope-intermediate-q03 -->

#### Why should transactions be kept short?

<!-- question:start:acid-basics-and-transaction-scope-intermediate-q04 -->
<!-- question-id:acid-basics-and-transaction-scope-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Transactions should be kept short because open transactions can hold locks, block other sessions, increase deadlock risk, delay log truncation, and increase row-versioning storage pressure. Long-running transactions also make failure recovery and troubleshooting harder.

Do validation before opening the transaction, perform the necessary database work, and commit or roll back quickly.

##### Key Points to Mention

- Reduces blocking.
- Reduces deadlock risk.
- Reduces transaction log pressure.
- Reduces version store pressure under row versioning.
- Avoid waiting on users or services inside transactions.

<!-- question:end:acid-basics-and-transaction-scope-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you design a transaction for creating an order?

<!-- question:start:acid-basics-and-transaction-scope-advanced-q01 -->
<!-- question-id:acid-basics-and-transaction-scope-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Validate request data before opening the transaction. Inside a short explicit transaction, insert the order header, insert order lines, reserve or decrement inventory if that must be atomic with the order, and write required audit or outbox rows. Commit only after all required changes succeed. In `CATCH`, roll back if a transaction is active and rethrow the error.

External calls such as payment capture, email, or shipping APIs should usually be coordinated with idempotency keys, outbox messages, or workflow state rather than called while the database transaction is open.

##### Key Points to Mention

- Validate before opening transaction.
- Keep scope short.
- Include all changes that must be atomic.
- Use constraints for consistency.
- Roll back and rethrow on failure.
- Avoid external calls inside the transaction.

<!-- question:end:acid-basics-and-transaction-scope-advanced-q01 -->

#### How should a stored procedure handle transaction ownership?

<!-- question:start:acid-basics-and-transaction-scope-advanced-q02 -->
<!-- question-id:acid-basics-and-transaction-scope-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

The procedure should have a clear contract. If it owns the transaction, it starts, commits, and rolls back it. If it may be called inside an existing transaction, it should check `@@TRANCOUNT`, track whether it started the transaction, and avoid committing a caller-owned transaction. Savepoints can be used when partial rollback inside a caller-owned transaction is required.

The worst design is ambiguous ownership where a procedure commits or rolls back work the caller expected to control.

##### Key Points to Mention

- Define ownership contract.
- Check `@@TRANCOUNT`.
- Commit only transactions the procedure owns.
- Use savepoints when needed.
- Use `XACT_STATE()` in error handling.
- Rethrow errors to the caller.

<!-- question:end:acid-basics-and-transaction-scope-advanced-q02 -->

#### How do transactions interact with retries?

<!-- question:start:acid-basics-and-transaction-scope-advanced-q03 -->
<!-- question-id:acid-basics-and-transaction-scope-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Retries must be designed around idempotency. If a transaction commits but the caller times out before receiving the response, a blind retry can duplicate work. Use stable business keys or idempotency keys, enforce uniqueness in the database, and make repeated requests return the existing result when appropriate.

Retries should be bounded and targeted to retryable errors such as deadlocks or transient failures.

##### Key Points to Mention

- Timeouts can hide whether commit happened.
- Idempotency keys prevent duplicate side effects.
- Unique constraints enforce retry safety.
- Deadlocks may be retried.
- Retries must be bounded and logged.

<!-- question:end:acid-basics-and-transaction-scope-advanced-q03 -->

#### What makes a transaction pattern production-ready?

<!-- question:start:acid-basics-and-transaction-scope-advanced-q04 -->
<!-- question-id:acid-basics-and-transaction-scope-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

A production-ready pattern has a clear transaction owner, keeps scope short, uses constraints to protect invariants, handles errors with `TRY...CATCH`, rolls back safely using `XACT_STATE()`, rethrows errors with `THROW`, and avoids external calls while the transaction is open. It also accounts for retries, deadlocks, timeouts, and observability.

The pattern should be tested on both success and failure paths, not just happy-path inserts.

##### Key Points to Mention

- Clear owner.
- Short scope.
- Constraints protect consistency.
- Safe rollback in `CATCH`.
- Rethrow errors.
- Tested failure and retry paths.

<!-- question:end:acid-basics-and-transaction-scope-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
