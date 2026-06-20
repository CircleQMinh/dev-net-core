---
id: triggers-and-their-trade-offs
topic: Database programmability and schema evolution
subtopic: Triggers and their trade-offs
category: SQL
---

## Overview

Triggers are database modules that run automatically when a specific event occurs. In SQL Server, DML triggers respond to `INSERT`, `UPDATE`, or `DELETE` operations on a table or view. DDL triggers respond to schema-level events such as `CREATE`, `ALTER`, or `DROP`. Logon triggers respond to login events.

Triggers matter because they can enforce rules and record changes even when data is modified from many different applications, jobs, scripts, or admin tools. They can be useful for auditing, complex integrity checks, cross-table validation, and controlled behavior behind updatable views. They are also risky because they execute implicitly, can hide side effects, slow down writes, create recursion problems, and surprise maintainers.

For interviews, triggers are a classic trade-off topic. Strong candidates can explain `AFTER` vs `INSTEAD OF`, `inserted` and `deleted` pseudo-tables, multi-row trigger design, transaction behavior, why constraints are usually preferred for simple rules, and why triggers should be used sparingly and reviewed carefully.

## Core Concepts

### What A Trigger Is

A trigger is a special database module that automatically executes in response to an event.

Example DML trigger:

```sql
CREATE OR ALTER TRIGGER sales.trg_Orders_Audit
ON sales.Orders
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT audit.OrderAudit (OrderId, AuditAction, AuditAt)
    SELECT OrderId, 'INSERT', SYSUTCDATETIME()
    FROM inserted
    WHERE NOT EXISTS (SELECT 1 FROM deleted WHERE deleted.OrderId = inserted.OrderId);

    INSERT audit.OrderAudit (OrderId, AuditAction, AuditAt)
    SELECT OrderId, 'DELETE', SYSUTCDATETIME()
    FROM deleted
    WHERE NOT EXISTS (SELECT 1 FROM inserted WHERE inserted.OrderId = deleted.OrderId);

    INSERT audit.OrderAudit (OrderId, AuditAction, AuditAt)
    SELECT inserted.OrderId, 'UPDATE', SYSUTCDATETIME()
    FROM inserted
    JOIN deleted
        ON deleted.OrderId = inserted.OrderId;
END;
```

The trigger runs because a data modification happened, not because the application explicitly called it.

### DML Triggers

DML triggers fire for data modifications:

- `INSERT`
- `UPDATE`
- `DELETE`

They can be created on tables or views depending on trigger type. They are often used for auditing, complex validation, derived writes, and protecting rules that cannot be expressed through normal constraints.

### AFTER Triggers

An `AFTER` trigger runs after the triggering statement and after constraint checks for the operation have succeeded.

```sql
CREATE OR ALTER TRIGGER sales.trg_OrderLine_AfterInsert
ON sales.OrderLine
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE o
    SET UpdatedAt = SYSUTCDATETIME()
    FROM sales.Orders AS o
    JOIN inserted AS i
        ON i.OrderId = o.OrderId;
END;
```

Use `AFTER` triggers for work that should happen only after the base modification is accepted, such as audit rows or derived updates.

### INSTEAD OF Triggers

An `INSTEAD OF` trigger runs instead of the triggering statement. It can be used to customize modifications against a view or intercept modifications before applying them.

```sql
CREATE OR ALTER TRIGGER sales.trg_vwOrderUpdate
ON sales.vwOrderEdit
INSTEAD OF UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE o
    SET Status = i.Status
    FROM sales.Orders AS o
    JOIN inserted AS i
        ON i.OrderId = o.OrderId;
END;
```

This can make a view writable, but it also hides write behavior behind the view.

### inserted And deleted Tables

DML triggers use logical tables called `inserted` and `deleted`.

- `inserted` contains new rows for `INSERT` and `UPDATE`.
- `deleted` contains old rows for `DELETE` and `UPDATE`.
- An `UPDATE` can be understood as old rows in `deleted` and new rows in `inserted`.

Triggers should use these tables set-wise, not as if they contain only one row.

### Multi-Row Trigger Design

SQL Server triggers fire once per statement, not once per row. A single `UPDATE` statement can affect 10,000 rows and fire the trigger once with 10,000 rows in `inserted` and `deleted`.

Bad pattern:

```sql
DECLARE @OrderId int;

SELECT @OrderId = OrderId
FROM inserted;
```

This silently picks one row when multiple rows are present.

Better pattern:

```sql
UPDATE o
SET UpdatedAt = SYSUTCDATETIME()
FROM sales.Orders AS o
JOIN inserted AS i
    ON i.OrderId = o.OrderId;
```

Always write triggers to handle multi-row operations unless there is a clear and enforced reason that only one row can change.

### Transaction Behavior

The triggering statement and trigger run in the same transaction. If the trigger raises an error and the transaction is rolled back, the original data modification is rolled back too.

This is powerful because it lets triggers enforce rules. It is also risky because slow trigger work keeps locks open longer and can increase blocking, deadlocks, and transaction log pressure.

### Triggers Vs Constraints

Prefer declarative constraints when they can express the rule.

Use constraints for:

- Primary keys.
- Unique rules.
- Foreign keys.
- Not-null rules.
- Check constraints.
- Defaults.

Consider triggers only when the rule cannot be expressed cleanly as a constraint, such as complex cross-table validation or custom auditing.

Constraints are easier to discover, reason about, optimize, and validate.

### Auditing With Triggers

Triggers are often used to write audit rows because they can capture modifications regardless of which application performed them.

Example:

```sql
CREATE OR ALTER TRIGGER sales.trg_Customer_AuditUpdate
ON sales.Customers
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT audit.CustomerChange
    (
        CustomerId,
        OldEmail,
        NewEmail,
        ChangedAt
    )
    SELECT
        d.CustomerId,
        d.Email,
        i.Email,
        SYSUTCDATETIME()
    FROM inserted AS i
    JOIN deleted AS d
        ON d.CustomerId = i.CustomerId
    WHERE ISNULL(i.Email, '') <> ISNULL(d.Email, '');
END;
```

For larger audit needs, also consider built-in features such as temporal tables, change data capture, or application-level audit events, depending on requirements.

### Hidden Side Effects

Triggers are implicit. A developer may run a simple `UPDATE` but unknowingly cause extra writes, validations, calls, or errors through a trigger.

Hidden side effects can cause:

- Surprise performance overhead.
- Unexpected transaction rollbacks.
- Harder debugging.
- Migration failures.
- Replication or bulk-load issues.
- Complex dependency chains.

Good trigger usage requires clear naming, documentation, tests, and operational awareness.

### Recursion And Nesting

Triggers can lead to nested or recursive behavior when trigger actions modify tables that fire other triggers. This can be intentional, but it can also cause loops, repeated work, or difficult debugging.

Design triggers to avoid unnecessary cascading behavior. If nesting or recursion is required, document it and test failure paths.

### Performance Trade-Offs

Triggers add work to the original transaction.

Performance concerns include:

- Extra reads and writes.
- Longer lock duration.
- More transaction log usage.
- Blocking and deadlock risk.
- Slow audit tables.
- Row-by-row trigger logic.
- Trigger chains.
- Poor indexing on tables touched by the trigger.

A trigger that is fast for one-row updates may be dangerous for batch updates.

### Security Risks

Triggers can run under elevated execution context. Malicious or careless trigger code can perform actions the original caller did not expect. Trigger definitions should be source-controlled, reviewed, and permissioned carefully.

Avoid using triggers as a place for broad privileged behavior that would be unsafe if called directly.

### Common Mistakes

Common mistakes include:

- Assuming one row in `inserted` or `deleted`.
- Using triggers instead of simple constraints.
- Performing slow row-by-row cursor work inside triggers.
- Hiding business workflows in triggers.
- Creating recursive trigger chains accidentally.
- Forgetting triggers fire during bulk or maintenance operations.
- Writing audit triggers without indexing audit tables.
- Returning result sets from triggers.
- Ignoring error and rollback behavior.
- Failing to document trigger side effects.

### Best Practices

Best practices include:

- Use triggers sparingly.
- Prefer constraints for declarative rules.
- Write set-based trigger logic.
- Always handle multi-row operations.
- Keep trigger work short and deterministic.
- Avoid external calls and long-running work.
- Document side effects.
- Source-control and review trigger definitions.
- Test inserts, updates, deletes, and batch operations.
- Monitor performance and blocking after deployment.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is a database trigger?

<!-- question:start:triggers-and-their-trade-offs-beginner-q01 -->
<!-- question-id:triggers-and-their-trade-offs-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A trigger is a database module that runs automatically when a specific event occurs. In SQL Server, DML triggers run for `INSERT`, `UPDATE`, or `DELETE` operations. DDL triggers run for schema events, and logon triggers run when sessions are established.

Triggers are useful for database-side auditing, complex rules, and controlled side effects, but they should be used carefully because they execute implicitly.

##### Key Points to Mention

- Runs automatically on an event.
- DML triggers respond to insert, update, delete.
- DDL triggers respond to schema changes.
- Useful but implicit.
- Can affect performance and transactions.

<!-- question:end:triggers-and-their-trade-offs-beginner-q01 -->

#### What are inserted and deleted tables?

<!-- question:start:triggers-and-their-trade-offs-beginner-q02 -->
<!-- question-id:triggers-and-their-trade-offs-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

`inserted` and `deleted` are logical tables available inside DML triggers. `inserted` contains the new rows for inserts and updates. `deleted` contains the old rows for deletes and updates. For an update, SQL Server provides old values in `deleted` and new values in `inserted`.

They can contain multiple rows because triggers fire once per statement, not once per row.

##### Key Points to Mention

- Available inside DML triggers.
- `inserted` contains new versions.
- `deleted` contains old versions.
- Updates use both.
- They can contain many rows.

<!-- question:end:triggers-and-their-trade-offs-beginner-q02 -->

#### What is the difference between AFTER and INSTEAD OF triggers?

<!-- question:start:triggers-and-their-trade-offs-beginner-q03 -->
<!-- question-id:triggers-and-their-trade-offs-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

An `AFTER` trigger runs after the triggering statement has executed and relevant constraints have been checked. It is commonly used for auditing or derived updates after a successful modification.

An `INSTEAD OF` trigger runs instead of the triggering statement. It can customize how writes are handled, especially for views that would not otherwise be directly updatable.

##### Key Points to Mention

- `AFTER` runs after the base action.
- `INSTEAD OF` replaces the base action.
- `AFTER` is common on tables.
- `INSTEAD OF` is useful for views.
- Both require careful transaction handling.

<!-- question:end:triggers-and-their-trade-offs-beginner-q03 -->

#### Are triggers executed once per row or once per statement?

<!-- question:start:triggers-and-their-trade-offs-beginner-q04 -->
<!-- question-id:triggers-and-their-trade-offs-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

In SQL Server, DML triggers execute once per statement. If one `UPDATE` statement changes 5,000 rows, the trigger fires once, and the `inserted` and `deleted` tables can contain 5,000 rows.

This is why trigger code must be set-based and must not assume that only one row is present.

##### Key Points to Mention

- SQL Server triggers fire per statement.
- `inserted` and `deleted` can hold multiple rows.
- Single-row assumptions are bugs.
- Use set-based logic.
- Test batch modifications.

<!-- question:end:triggers-and-their-trade-offs-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### When should you use a trigger instead of a constraint?

<!-- question:start:triggers-and-their-trade-offs-intermediate-q01 -->
<!-- question-id:triggers-and-their-trade-offs-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

Use a constraint when the rule can be expressed declaratively with primary keys, unique constraints, foreign keys, check constraints, not-null constraints, or defaults. Constraints are easier to understand, optimize, and maintain.

Use a trigger only when the rule cannot be expressed well as a constraint, such as complex cross-table validation, custom audit rows, or special behavior behind a view. Even then, keep the trigger focused and well documented.

##### Key Points to Mention

- Prefer constraints for simple rules.
- Constraints are more discoverable and declarative.
- Triggers are useful for complex or cross-table logic.
- Triggers add hidden behavior.
- Use sparingly.

<!-- question:end:triggers-and-their-trade-offs-intermediate-q01 -->

#### Why can triggers cause performance problems?

<!-- question:start:triggers-and-their-trade-offs-intermediate-q02 -->
<!-- question-id:triggers-and-their-trade-offs-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Triggers add extra work to the same transaction as the original statement. They can perform additional reads and writes, hold locks longer, write more transaction log records, and cause blocking or deadlocks. Row-by-row trigger logic is especially dangerous for multi-row updates.

Triggers also hide cost. A simple application update may be slow because of trigger logic that the developer did not know existed.

##### Key Points to Mention

- Extra work in the same transaction.
- Longer locks and more logging.
- Blocking and deadlock risk.
- Row-by-row logic is dangerous.
- Hidden cost makes troubleshooting harder.

<!-- question:end:triggers-and-their-trade-offs-intermediate-q02 -->

#### How should a trigger handle multi-row updates?

<!-- question:start:triggers-and-their-trade-offs-intermediate-q03 -->
<!-- question-id:triggers-and-their-trade-offs-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

A trigger should use set-based logic against the `inserted` and `deleted` tables. It should join, aggregate, or filter those logical tables as sets. It should not assign a value from `inserted` to a scalar variable and assume only one row changed.

The trigger should be tested with single-row and multi-row statements because production updates, deletes, merges, and imports often affect many rows at once.

##### Key Points to Mention

- Triggers fire once per statement.
- Use set-based operations.
- Avoid scalar variable assumptions.
- Test multi-row inserts, updates, and deletes.
- Aggregate where needed.

<!-- question:end:triggers-and-their-trade-offs-intermediate-q03 -->

#### What happens when a trigger raises an error?

<!-- question:start:triggers-and-their-trade-offs-intermediate-q04 -->
<!-- question-id:triggers-and-their-trade-offs-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

The trigger runs in the same transaction as the triggering statement. If the trigger raises an error and the transaction is rolled back, the original modification is rolled back too. This lets triggers enforce rules, but it also means trigger failures can cause application statements to fail unexpectedly.

Trigger error handling should be intentional. Do not swallow errors silently, and avoid doing slow or unreliable work inside a trigger.

##### Key Points to Mention

- Same transaction as triggering statement.
- Trigger failure can roll back original work.
- Useful for enforcement.
- Risky when side effects are hidden.
- Avoid unreliable long-running trigger work.

<!-- question:end:triggers-and-their-trade-offs-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you review a trigger before approving it for production?

<!-- question:start:triggers-and-their-trade-offs-advanced-q01 -->
<!-- question-id:triggers-and-their-trade-offs-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

I would first ask whether a constraint, computed column, foreign key, temporal table, CDC, application event, or stored procedure would be clearer. If a trigger is justified, I would check that it handles multi-row operations, is set-based, avoids external calls, keeps work short, has appropriate indexes, handles errors intentionally, and has tests for insert, update, delete, and batch scenarios.

I would also review security context, recursion or nesting risk, deployment ordering, and whether the trigger side effects are documented for developers and operators.

##### Key Points to Mention

- Challenge whether a trigger is needed.
- Prefer declarative alternatives when possible.
- Verify set-based multi-row logic.
- Check performance, indexing, and transaction impact.
- Review security and documentation.

<!-- question:end:triggers-and-their-trade-offs-advanced-q01 -->

#### Why are hidden side effects a major trigger risk?

<!-- question:start:triggers-and-their-trade-offs-advanced-q02 -->
<!-- question-id:triggers-and-their-trade-offs-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Triggers execute automatically, so callers may not know that extra validation, writes, errors, or cascading behavior are happening. This makes the system harder to reason about. A simple update can fail because of a trigger, slow down because of audit writes, or cause unexpected changes in another table.

Hidden side effects also complicate migrations and incident response. The mitigation is to keep triggers rare, focused, named clearly, source-controlled, reviewed, documented, and monitored.

##### Key Points to Mention

- Trigger behavior is implicit.
- Callers may not expect extra work or errors.
- Debugging and migrations become harder.
- Side effects should be documented.
- Keep triggers focused and visible in review.

<!-- question:end:triggers-and-their-trade-offs-advanced-q02 -->

#### How can triggers contribute to deadlocks or blocking?

<!-- question:start:triggers-and-their-trade-offs-advanced-q03 -->
<!-- question-id:triggers-and-their-trade-offs-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Triggers run inside the same transaction as the triggering statement, so any extra reads or writes extend transaction duration and lock lifetime. If trigger code touches tables in a different order than other procedures, or updates audit and summary tables under heavy concurrency, it can increase deadlock risk.

Mitigation includes keeping trigger logic short, indexing tables touched by the trigger, using consistent access order, avoiding row-by-row logic, and moving noncritical work outside the transaction when possible.

##### Key Points to Mention

- Triggers extend transaction work.
- Locks are held longer.
- Extra table access can conflict with other code paths.
- Consistent access order matters.
- Keep trigger work minimal.

<!-- question:end:triggers-and-their-trade-offs-advanced-q03 -->

#### When might an INSTEAD OF trigger on a view be appropriate?

<!-- question:start:triggers-and-their-trade-offs-advanced-q04 -->
<!-- question-id:triggers-and-their-trade-offs-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

An `INSTEAD OF` trigger on a view can be appropriate when you need a controlled write interface over a view that joins multiple tables or exposes a simplified shape. The trigger can translate a caller's insert, update, or delete into the correct base-table operations.

The trade-off is that write behavior becomes hidden behind the view. It must be carefully documented, tested, and protected from ambiguous multi-row or partial-update cases. For many systems, a stored procedure may be a clearer write contract.

##### Key Points to Mention

- Useful for controlled writes through complex views.
- Translates view writes into base-table operations.
- Can simplify caller interface.
- Hidden behavior is a risk.
- Stored procedures may be clearer for commands.

<!-- question:end:triggers-and-their-trade-offs-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
