---
id: stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling
topic: SQL practical interview comparisons and SQL Server-specific features
subtopic: Stored procedure transaction patterns with `TRY...CATCH`, output parameters, and error handling
category: SQL
---

## Overview

Stored procedures often contain multi-step database operations that must succeed or fail as one unit. SQL Server provides transactions, `TRY...CATCH`, `XACT_STATE()`, `@@TRANCOUNT`, output parameters, return codes, `THROW`, and error functions to help procedures handle success, failure, and caller communication.

The hard part is not writing `BEGIN TRY`. The hard part is designing a procedure that starts and ends transactions correctly, does not commit work it should roll back, preserves the original error, returns useful output values, and behaves predictably when called inside an existing transaction.

This topic matters because stored procedures are still common in enterprise systems, reporting workflows, legacy applications, data imports, background jobs, and SQL Server-heavy architectures. A weak transaction pattern can leave data partially updated, hide errors from the application, or make production incidents much harder to diagnose.

For interviews, strong candidates can describe a safe transaction template, explain `XACT_STATE()` and `@@TRANCOUNT`, choose `THROW` over legacy patterns for rethrowing, use output parameters intentionally, and avoid swallowing errors.

## Core Concepts

### Stored Procedure Responsibilities

A stored procedure can encapsulate:

- Validation.
- Multi-table writes.
- Transaction boundaries.
- Error handling.
- Return values and output parameters.
- Security boundaries.
- Data-access contracts for application code.

Example:

```sql
CREATE PROCEDURE dbo.CreateOrder
    @CustomerId BIGINT,
    @OrderId BIGINT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT dbo.Orders (CustomerId, CreatedAt)
    VALUES (@CustomerId, SYSUTCDATETIME());

    SET @OrderId = CONVERT(BIGINT, SCOPE_IDENTITY());
END;
```

This is simple because it performs one insert. More realistic procedures often need transaction handling and error handling.

### TRY...CATCH Basics

`TRY...CATCH` catches many runtime errors inside T-SQL.

Basic shape:

```sql
BEGIN TRY
    -- Work that may fail.
END TRY
BEGIN CATCH
    -- Error handling.
    THROW;
END CATCH;
```

Inside `CATCH`, SQL Server exposes error details through functions:

- `ERROR_NUMBER()`
- `ERROR_SEVERITY()`
- `ERROR_STATE()`
- `ERROR_PROCEDURE()`
- `ERROR_LINE()`
- `ERROR_MESSAGE()`

Example:

```sql
BEGIN CATCH
    SELECT
        ERROR_NUMBER() AS ErrorNumber,
        ERROR_PROCEDURE() AS ErrorProcedure,
        ERROR_LINE() AS ErrorLine,
        ERROR_MESSAGE() AS ErrorMessage;

    THROW;
END CATCH;
```

For production procedures, logging the error can be useful, but swallowing it is usually a bug.

### Transaction Basics

A transaction groups work into an all-or-nothing unit.

Example:

```sql
BEGIN TRANSACTION;

INSERT dbo.Orders (CustomerId, CreatedAt)
VALUES (@CustomerId, SYSUTCDATETIME());

INSERT dbo.OrderEvents (OrderId, EventName, CreatedAt)
VALUES (SCOPE_IDENTITY(), N'Created', SYSUTCDATETIME());

COMMIT TRANSACTION;
```

If a failure happens between the two inserts, the procedure needs to roll back. That is why transaction logic is usually combined with `TRY...CATCH`.

### A Basic Transaction Pattern

Example:

```sql
CREATE PROCEDURE dbo.CreateOrder
    @CustomerId BIGINT,
    @OrderId BIGINT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT dbo.Orders (CustomerId, CreatedAt)
        VALUES (@CustomerId, SYSUTCDATETIME());

        SET @OrderId = CONVERT(BIGINT, SCOPE_IDENTITY());

        INSERT dbo.OrderEvents (OrderId, EventName, CreatedAt)
        VALUES (@OrderId, N'Created', SYSUTCDATETIME());

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
        BEGIN
            ROLLBACK TRANSACTION;
        END;

        THROW;
    END CATCH;
END;
```

This pattern:

- Starts a transaction.
- Commits only after all work succeeds.
- Rolls back when a transaction is still active or uncommittable.
- Rethrows the original error.
- Uses `SET XACT_ABORT ON` to make many runtime errors abort the transaction.

### XACT_STATE

`XACT_STATE()` tells whether the current session has an active transaction and whether it can be committed.

Common values:

- `1`: active and committable transaction.
- `0`: no active transaction.
- `-1`: active but uncommittable transaction.

Inside `CATCH`, this matters because not every failed transaction can be committed.

Example:

```sql
BEGIN CATCH
    IF XACT_STATE() = -1
    BEGIN
        ROLLBACK TRANSACTION;
    END;
    ELSE IF XACT_STATE() = 1
    BEGIN
        ROLLBACK TRANSACTION;
    END;

    THROW;
END CATCH;
```

Most procedure templates simply roll back when `XACT_STATE() <> 0`, but understanding the difference is useful in interviews.

### @@TRANCOUNT And Nested Procedure Calls

`@@TRANCOUNT` returns the number of active `BEGIN TRANSACTION` statements for the current session.

This matters when a stored procedure may be called inside an existing transaction.

Problem pattern:

```sql
CREATE PROCEDURE dbo.DoWork
AS
BEGIN
    BEGIN TRANSACTION;

    -- Work

    COMMIT TRANSACTION;
END;
```

If the caller already has a transaction, this procedure increments the transaction count and then commits one level. It does not truly commit all outer work, but it does make transaction ownership confusing.

Safer pattern:

```sql
DECLARE @StartedTransaction BIT = 0;

IF @@TRANCOUNT = 0
BEGIN
    SET @StartedTransaction = 1;
    BEGIN TRANSACTION;
END;

BEGIN TRY
    -- Work

    IF @StartedTransaction = 1
    BEGIN
        COMMIT TRANSACTION;
    END;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 AND @StartedTransaction = 1
    BEGIN
        ROLLBACK TRANSACTION;
    END;

    THROW;
END CATCH;
```

This pattern makes transaction ownership explicit. If the procedure started the transaction, it finishes it. If the caller owns the transaction, the procedure does not commit it.

### Savepoints For Caller-Owned Transactions

When a procedure is called inside an existing transaction, savepoints can let the procedure roll back its own work without rolling back the caller's entire transaction.

Example:

```sql
DECLARE @StartedTransaction BIT = 0;

IF @@TRANCOUNT = 0
BEGIN
    SET @StartedTransaction = 1;
    BEGIN TRANSACTION;
END
ELSE
BEGIN
    SAVE TRANSACTION BeforeProcedureWork;
END;

BEGIN TRY
    -- Procedure work here.

    IF @StartedTransaction = 1
    BEGIN
        COMMIT TRANSACTION;
    END;
END TRY
BEGIN CATCH
    IF XACT_STATE() = -1
    BEGIN
        ROLLBACK TRANSACTION;
    END
    ELSE IF @StartedTransaction = 1
    BEGIN
        ROLLBACK TRANSACTION;
    END
    ELSE IF XACT_STATE() = 1
    BEGIN
        ROLLBACK TRANSACTION BeforeProcedureWork;
    END;

    THROW;
END CATCH;
```

Savepoints add complexity, so they should be used when the procedure truly needs to participate in caller-owned transactions. Many teams instead establish a simpler rule: procedures either own their transactions or require the caller to own them, but not both.

### SET XACT_ABORT ON

`SET XACT_ABORT ON` tells SQL Server to automatically roll back the current transaction when many runtime errors occur.

Example:

```sql
SET XACT_ABORT ON;
```

This is commonly used in stored procedures that perform transactional writes. It reduces the chance that a runtime error leaves a transaction open or partially committable.

Important nuance:

- `THROW` honors `XACT_ABORT`.
- `RAISERROR` does not behave the same way with `XACT_ABORT`.
- You still need `TRY...CATCH` to log, clean up, and rethrow.

### THROW Vs RAISERROR

`THROW` is the modern way to raise or rethrow errors in T-SQL.

Rethrow original error:

```sql
BEGIN CATCH
    IF XACT_STATE() <> 0
    BEGIN
        ROLLBACK TRANSACTION;
    END;

    THROW;
END CATCH;
```

Using `THROW;` without arguments inside `CATCH` preserves the original error details.

Custom error:

```sql
THROW 51000, 'Customer is not active.', 1;
```

`RAISERROR` still exists in old code, but for new procedure error handling, `THROW` is usually preferred because it integrates better with modern error handling and preserves original errors cleanly when rethrowing.

### Output Parameters

Output parameters let a stored procedure return scalar values to the caller.

Example:

```sql
CREATE PROCEDURE dbo.CreateCustomer
    @Email NVARCHAR(320),
    @CustomerId BIGINT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT dbo.Customers (Email, CreatedAt)
    VALUES (@Email, SYSUTCDATETIME());

    SET @CustomerId = CONVERT(BIGINT, SCOPE_IDENTITY());
END;
```

Caller:

```sql
DECLARE @NewCustomerId BIGINT;

EXEC dbo.CreateCustomer
    @Email = N'a@example.com',
    @CustomerId = @NewCustomerId OUTPUT;

SELECT @NewCustomerId AS NewCustomerId;
```

Output parameters are good for:

- New identity values.
- Status codes.
- Row counts.
- Calculated totals.
- Simple messages or flags.

Do not use many output parameters to return relational result sets. Use result sets for rows.

### Return Codes Vs Output Parameters Vs Result Sets

SQL Server procedures can communicate in several ways:

- Result sets: return rows to the caller.
- Output parameters: return named scalar values.
- Return code: return an integer status.
- Errors: signal failure through exceptions.

Practical guidance:

- Use result sets for data.
- Use output parameters for scalar outputs.
- Use return codes sparingly for simple status values.
- Use errors for failure.
- Do not return "success with hidden error message" when the operation actually failed.

Example:

```sql
CREATE PROCEDURE dbo.TryReserveInventory
    @ProductId BIGINT,
    @Quantity INT,
    @ReservationId BIGINT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Procedure either succeeds and sets @ReservationId,
    -- or throws an error that the caller must handle.
END;
```

### Error Logging

Error logging should capture enough information to diagnose the failure without hiding the failure.

Example:

```sql
BEGIN CATCH
    DECLARE
        @ErrorNumber INT = ERROR_NUMBER(),
        @ErrorProcedure SYSNAME = ERROR_PROCEDURE(),
        @ErrorLine INT = ERROR_LINE(),
        @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();

    IF XACT_STATE() <> 0
    BEGIN
        ROLLBACK TRANSACTION;
    END;

    INSERT dbo.ErrorLog (ErrorNumber, ErrorProcedure, ErrorLine, ErrorMessage, CreatedAt)
    VALUES (@ErrorNumber, @ErrorProcedure, @ErrorLine, @ErrorMessage, SYSUTCDATETIME());

    THROW;
END CATCH;
```

Important caution: if the transaction is uncommittable, logging inside the same transaction may fail or be rolled back. Some systems log errors outside the failed transaction, in application code, through separate logging procedures, or in external observability tools.

### Idempotency And Retries

Stored procedures that are called by applications or background jobs should be designed with retries in mind.

If the application retries after a timeout, did the first execution commit or roll back? If the procedure creates an order, charges a customer, or reserves inventory, blindly retrying can create duplicate side effects.

Good patterns include:

- Use idempotency keys for operations that may be retried.
- Enforce unique constraints on idempotency keys.
- Return existing results for repeated requests.
- Keep transactions short.
- Make errors explicit.
- Let the application distinguish retryable and non-retryable failures.

### Common Mistakes

Common mistakes include:

- Starting a transaction and forgetting to roll it back in `CATCH`.
- Committing in `CATCH` without checking transaction state.
- Swallowing errors and returning a success code.
- Using `RAISERROR` by habit instead of `THROW` for new code.
- Losing the original error line and message.
- Ignoring `@@TRANCOUNT` when procedures are nested.
- Leaving transactions open after errors.
- Logging inside an uncommittable transaction without testing.
- Using output parameters for large result sets.
- Setting output parameters before rollback and assuming they prove success.

### Best Practices

Best practices:

- Use `SET NOCOUNT ON` in procedures unless rowcount messages are intentionally needed.
- Use `SET XACT_ABORT ON` for transactional write procedures.
- Keep transactions short.
- Start and commit only transactions the procedure owns.
- Use `XACT_STATE()` in `CATCH`.
- Use `THROW;` to preserve the original error.
- Use output parameters for clear scalar results.
- Return rows as result sets, not many output parameters.
- Do not hide real failures behind status codes.
- Test success, expected failure, deadlock, timeout, and nested-transaction scenarios.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What does TRY...CATCH do in a SQL Server stored procedure?

<!-- question:start:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-beginner-q01 -->
<!-- question-id:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

`TRY...CATCH` lets a stored procedure handle runtime errors. Code that may fail goes in the `TRY` block. Error handling, transaction cleanup, logging, and rethrowing usually go in the `CATCH` block.

Inside `CATCH`, SQL Server provides functions like `ERROR_NUMBER()`, `ERROR_LINE()`, and `ERROR_MESSAGE()` to inspect the failure.

##### Key Points to Mention

- `TRY` contains work that may fail.
- `CATCH` handles errors.
- Error functions expose details.
- Transaction cleanup usually belongs in `CATCH`.
- Errors should usually be rethrown.

<!-- question:end:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-beginner-q01 -->

#### What is an output parameter?

<!-- question:start:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-beginner-q02 -->
<!-- question-id:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

An output parameter is a stored procedure parameter that returns a scalar value to the caller. The procedure declares it with `OUTPUT`, assigns a value inside the procedure, and the caller must also specify `OUTPUT` when executing the procedure.

Output parameters are useful for identity values, status flags, row counts, totals, and simple messages.

##### Key Points to Mention

- Declared with `OUTPUT`.
- Caller also uses `OUTPUT`.
- Good for scalar values.
- Not ideal for returning result sets.
- Common for newly created IDs.

<!-- question:end:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-beginner-q02 -->

#### Why do stored procedures use transactions?

<!-- question:start:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-beginner-q03 -->
<!-- question-id:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

Transactions group multiple database changes into one all-or-nothing unit. If every step succeeds, the procedure commits. If a step fails, the procedure rolls back so the database does not keep partial changes.

This is important for operations such as creating an order and order lines, transferring money, reserving inventory, or updating related tables.

##### Key Points to Mention

- Transactions protect consistency.
- Commit means keep all changes.
- Rollback means undo changes.
- Useful for multi-step writes.
- Error handling should clean up failed transactions.

<!-- question:end:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-beginner-q03 -->

#### What is THROW used for?

<!-- question:start:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-beginner-q04 -->
<!-- question-id:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

`THROW` raises an error. Inside a `CATCH` block, `THROW;` without arguments rethrows the original error and preserves its details. It is commonly used after rolling back a transaction or logging the error.

For new code, `THROW` is usually preferred over older `RAISERROR` patterns for rethrowing errors.

##### Key Points to Mention

- Raises an error.
- `THROW;` rethrows the original error in `CATCH`.
- Preserves error details.
- Used after cleanup.
- Preferred for modern error handling.

<!-- question:end:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### What is XACT_STATE used for?

<!-- question:start:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-intermediate-q01 -->
<!-- question-id:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

`XACT_STATE()` tells whether the current session has an active transaction and whether it can be committed. A value of `1` means there is an active committable transaction, `0` means no active transaction, and `-1` means there is an active uncommittable transaction.

Inside `CATCH`, it helps decide whether to roll back and prevents code from trying to commit a transaction that cannot be committed.

##### Key Points to Mention

- `1` means active and committable.
- `0` means no active transaction.
- `-1` means active but uncommittable.
- Used in `CATCH`.
- Helps avoid invalid commit logic.

<!-- question:end:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-intermediate-q01 -->

#### Why does @@TRANCOUNT matter in stored procedures?

<!-- question:start:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-intermediate-q02 -->
<!-- question-id:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

`@@TRANCOUNT` shows how many active transaction levels exist in the current session. It matters when a stored procedure may be called inside an existing transaction. If a procedure starts and commits a transaction without checking `@@TRANCOUNT`, it can confuse ownership and accidentally interfere with caller-controlled transaction flow.

A common pattern is to start a transaction only when `@@TRANCOUNT = 0`, track whether the procedure started it, and commit only if it owns the transaction.

##### Key Points to Mention

- Shows active transaction nesting count.
- Helps detect caller-owned transactions.
- Procedure should not commit a transaction it does not own.
- Rollback behavior can affect outer work.
- Savepoints may be used for nested scenarios.

<!-- question:end:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-intermediate-q02 -->

#### Why use SET XACT_ABORT ON?

<!-- question:start:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-intermediate-q03 -->
<!-- question-id:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

`SET XACT_ABORT ON` causes many runtime errors to automatically abort and roll back the current transaction. It is commonly used in procedures that perform transactional writes because it reduces the chance of leaving a transaction open or partially completed after an error.

It does not replace `TRY...CATCH`. Procedures still need `CATCH` blocks for cleanup, logging, and rethrowing.

##### Key Points to Mention

- Helps ensure runtime errors abort transactions.
- Common in write procedures.
- Does not replace `TRY...CATCH`.
- `THROW` honors `XACT_ABORT`.
- Reduces partial-transaction surprises.

<!-- question:end:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-intermediate-q03 -->

#### How should a stored procedure return a new identity value?

<!-- question:start:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-intermediate-q04 -->
<!-- question-id:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

A stored procedure can use an output parameter and assign it after the insert. For identity values, `SCOPE_IDENTITY()` is commonly used to get the identity generated in the current scope, or the `OUTPUT inserted.Id` clause can capture inserted keys more explicitly.

The procedure should assign the output only after the insert succeeds and should still throw errors if the transaction fails.

##### Key Points to Mention

- Use an `OUTPUT` parameter for scalar IDs.
- `SCOPE_IDENTITY()` gets current-scope identity.
- `OUTPUT inserted.Id` is useful for inserted rows.
- Do not treat an output value as proof of commit.
- Errors should still be surfaced.

<!-- question:end:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you design a stored procedure that can be called inside or outside a transaction?

<!-- question:start:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-advanced-q01 -->
<!-- question-id:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Check `@@TRANCOUNT` at the start. If it is zero, the procedure starts a transaction and records that it owns it. If it is greater than zero, either use a savepoint or follow a documented rule that the caller owns rollback and commit behavior. In `CATCH`, use `XACT_STATE()` to decide whether to roll back the owned transaction, roll back to a savepoint, or roll back the entire uncommittable transaction.

The procedure should never commit a transaction it did not start, and it should rethrow errors so the caller can decide how to handle the overall operation.

##### Key Points to Mention

- Inspect `@@TRANCOUNT`.
- Track transaction ownership.
- Use savepoints when appropriate.
- Use `XACT_STATE()` in `CATCH`.
- Do not commit caller-owned transactions.
- Rethrow errors.

<!-- question:end:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-advanced-q01 -->

#### How would you handle error logging in a procedure with a failed transaction?

<!-- question:start:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-advanced-q02 -->
<!-- question-id:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Capture error details immediately in the `CATCH` block using `ERROR_NUMBER()`, `ERROR_MESSAGE()`, `ERROR_PROCEDURE()`, and `ERROR_LINE()`. Then use `XACT_STATE()` to handle rollback correctly. Be careful logging inside the same transaction, because if the transaction is uncommittable or rolled back, the log insert may fail or disappear.

Depending on requirements, log after rollback, use a separate logging mechanism, or let application-level observability capture the failure. Always rethrow the error after cleanup.

##### Key Points to Mention

- Capture error functions early.
- Check `XACT_STATE()`.
- Logging inside failed transactions can be rolled back.
- Application logging may be safer.
- Do not swallow the original error.
- Rethrow after cleanup.

<!-- question:end:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-advanced-q02 -->

#### How should stored procedures support retry-safe operations?

<!-- question:start:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-advanced-q03 -->
<!-- question-id:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Use idempotency keys or natural business keys for operations that may be retried. Enforce uniqueness on those keys, keep transactions short, and make the procedure return the existing result when a duplicate retry represents the same logical request. The procedure should distinguish expected idempotent repeats from real conflicts.

Retries should be bounded and usually handled by the application or job runner, while the procedure enforces database consistency.

##### Key Points to Mention

- Use idempotency keys for retryable commands.
- Enforce uniqueness in the database.
- Return existing results for duplicate retries.
- Keep transactions short.
- Distinguish retry from conflict.
- Let errors surface for the caller's retry policy.

<!-- question:end:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-advanced-q03 -->

#### What makes a stored procedure error-handling pattern production-ready?

<!-- question:start:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-advanced-q04 -->
<!-- question-id:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

A production-ready pattern uses `SET NOCOUNT ON`, uses `SET XACT_ABORT ON` for transactional writes, starts only transactions it owns, commits only after all work succeeds, rolls back correctly in `CATCH`, checks `XACT_STATE()`, preserves the original error with `THROW`, and returns scalar outputs through clear output parameters only on success.

It should also be tested for expected constraint failures, unexpected runtime errors, deadlocks, timeouts, nested transaction calls, and application retries.

##### Key Points to Mention

- Clear transaction ownership.
- Correct rollback behavior.
- `XACT_STATE()` checks.
- `THROW;` preserves errors.
- Output parameters have clear success semantics.
- Tests cover failure and concurrency cases.

<!-- question:end:stored-procedure-transaction-patterns-with-try-catch-output-parameters-and-error-handling-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
