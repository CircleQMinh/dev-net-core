---
id: local-vs-global-temporary-tables-and-table-variables
topic: SQL practical interview comparisons and SQL Server-specific features
subtopic: Local vs global temporary tables and table variables
category: SQL
---

## Overview

Temporary tables and table variables are SQL Server tools for storing intermediate rows while a query, stored procedure, batch, or workflow is running. They are commonly used for staging data, breaking complex queries into readable steps, capturing output rows, preparing reporting results, and simplifying procedural database logic.

Local temporary tables, global temporary tables, and table variables all look table-like, but they differ in scope, lifetime, optimizer behavior, indexing options, transaction behavior, and visibility across sessions or dynamic SQL. Those differences can decide whether a query is simple and fast or unexpectedly slow and difficult to debug.

This topic matters in real applications because SQL code often needs a temporary working set before inserting final results, validating imports, calculating totals, or joining against a filtered subset of data. Choosing the wrong temporary structure can create contention, wrong assumptions about visibility, poor execution plans, or hard-to-reproduce production behavior.

For interviews, strong candidates can explain the difference between `#temp` tables, `##global` temp tables, and `@table` variables; choose the right option for small versus large row sets; and describe how scope, statistics, indexing, recompilation, and transactions affect performance and correctness.

## Core Concepts

### Temporary Data Structures In SQL Server

SQL Server supports several ways to hold temporary relational data:

- Local temporary tables, such as `#OrderIds`
- Global temporary tables, such as `##ImportProgress`
- Table variables, such as `@OrderIds`
- Common table expressions and derived tables for single-statement logic
- Permanent staging tables for durable, shared, or audited workflows

The first interview skill is knowing that these tools are not interchangeable. They solve overlapping problems, but each has a different scope and cost model.

Example use cases:

- Store a filtered list of customer IDs before applying multiple joins.
- Stage rows imported from a file before validating and merging them.
- Capture rows affected by an `UPDATE` using the `OUTPUT` clause.
- Split a large stored procedure into readable phases.
- Share a short-lived result with another session or diagnostic process.

### Local Temporary Tables

A local temporary table is created with a single number sign prefix, such as `#RecentOrders`. It is visible only to the session that creates it, plus nested stored procedures executed by that session.

Example:

```sql
CREATE TABLE #RecentOrders
(
    OrderId BIGINT NOT NULL PRIMARY KEY,
    CustomerId BIGINT NOT NULL,
    OrderDate DATETIME2 NOT NULL
);

INSERT INTO #RecentOrders (OrderId, CustomerId, OrderDate)
SELECT OrderId, CustomerId, OrderDate
FROM dbo.Orders
WHERE OrderDate >= DATEADD(day, -30, SYSUTCDATETIME());

SELECT c.CustomerName, COUNT(*) AS RecentOrderCount
FROM #RecentOrders AS ro
JOIN dbo.Customers AS c
    ON c.CustomerId = ro.CustomerId
GROUP BY c.CustomerName;
```

Local temp tables are useful when intermediate data is reused more than once, row counts may be meaningful, or indexes and statistics are important to query performance.

Common characteristics:

- Created in `tempdb`.
- Scoped to the current session.
- Automatically dropped when the session ends.
- Can be explicitly dropped with `DROP TABLE #RecentOrders`.
- Can have indexes, constraints, and statistics.
- Can be referenced by nested stored procedures called by the session.
- Can often produce better execution plans than table variables for larger or repeatedly joined data sets.

### Global Temporary Tables

A global temporary table is created with two number sign prefixes, such as `##ImportProgress`. It is visible to all sessions while it exists.

Example:

```sql
CREATE TABLE ##ImportProgress
(
    ImportId UNIQUEIDENTIFIER NOT NULL,
    StepName NVARCHAR(100) NOT NULL,
    RowsProcessed INT NOT NULL,
    UpdatedAt DATETIME2 NOT NULL
);

INSERT INTO ##ImportProgress (ImportId, StepName, RowsProcessed, UpdatedAt)
VALUES (NEWID(), N'Validate rows', 1200, SYSUTCDATETIME());
```

Global temp tables are less common in application code because shared temporary state introduces naming collisions, lifecycle surprises, and concurrency risks. They can be useful for administrative scripts, diagnostics, cross-session troubleshooting, or controlled workflows where multiple sessions must see the same temporary data.

Common characteristics:

- Created in `tempdb`.
- Visible to all sessions.
- Dropped when the creating session ends and the last active statement referencing it finishes.
- Can have indexes and constraints.
- Need careful naming to avoid collisions.
- Usually should not be used as a general application coordination mechanism.

### Table Variables

A table variable is declared using the `table` data type. It behaves like a local variable whose value is a set of rows.

Example:

```sql
DECLARE @ChangedOrders TABLE
(
    OrderId BIGINT NOT NULL PRIMARY KEY,
    OldStatus NVARCHAR(30) NOT NULL,
    NewStatus NVARCHAR(30) NOT NULL
);

UPDATE dbo.Orders
SET Status = N'Archived'
OUTPUT inserted.OrderId, deleted.Status, inserted.Status
INTO @ChangedOrders
WHERE Status = N'Completed'
  AND CompletedAt < DATEADD(year, -2, SYSUTCDATETIME());

SELECT OrderId, OldStatus, NewStatus
FROM @ChangedOrders;
```

Table variables are often a good fit for small row sets, simple logic, and cases where variable-like scope is useful. They are also common for capturing `OUTPUT` rows from DML statements.

Common characteristics:

- Declared with `DECLARE @Name TABLE (...)`.
- Scoped to the batch, stored procedure, or function where they are declared.
- Automatically cleaned up when that scope ends.
- Can be used in functions.
- Can define primary key, unique, nullability, check, and default constraints in the declaration.
- Cannot be altered after declaration.
- Cannot be the target of `SELECT ... INTO`.
- Cannot be referenced by dynamic SQL outside the scope where the table variable is declared.

### Scope And Lifetime

Scope is one of the most important differences.

Local temp table scope:

```sql
CREATE TABLE #Ids (Id INT NOT NULL PRIMARY KEY);

EXEC dbo.ProcessIds; -- A nested procedure can reference #Ids if it knows the name.
```

The `#Ids` table exists for the creating session. Nested procedures can access it, but other sessions cannot.

Table variable scope:

```sql
DECLARE @Ids TABLE (Id INT NOT NULL PRIMARY KEY);

EXEC sys.sp_executesql N'SELECT COUNT(*) FROM @Ids';
```

The dynamic SQL example fails because the table variable is not in scope inside the separate dynamic SQL batch.

Global temp table scope:

```sql
CREATE TABLE ##SharedIds (Id INT NOT NULL PRIMARY KEY);
```

Other sessions can reference `##SharedIds` while it exists. That visibility is powerful, but it also means the name is shared server-wide within `tempdb`.

### Optimizer Behavior, Statistics, And Cardinality

Optimizer behavior is a major interview topic.

Local temp tables can have statistics, and SQL Server can use those statistics to estimate row counts. This matters when the temp table is joined to other tables or used multiple times.

Table variables historically had weaker cardinality information. SQL Server documentation warns that table variables do not have distribution statistics, which can lead the optimizer to choose a plan based on poor row-count assumptions. Newer compatibility levels include deferred compilation improvements, but table variables still have restrictions compared with temp tables.

Practical implication:

```sql
DECLARE @Ids TABLE (CustomerId BIGINT NOT NULL PRIMARY KEY);

INSERT INTO @Ids (CustomerId)
SELECT CustomerId
FROM dbo.Customers
WHERE IsActive = 1;

SELECT o.OrderId, o.Total
FROM dbo.Orders AS o
JOIN @Ids AS i
    ON i.CustomerId = o.CustomerId;
```

If `@Ids` has only 10 rows, this may be fine. If it has 500,000 rows, the optimizer may not choose the best plan. A local temp table with indexes and statistics may be safer:

```sql
CREATE TABLE #Ids
(
    CustomerId BIGINT NOT NULL PRIMARY KEY
);

INSERT INTO #Ids (CustomerId)
SELECT CustomerId
FROM dbo.Customers
WHERE IsActive = 1;

SELECT o.OrderId, o.Total
FROM dbo.Orders AS o
JOIN #Ids AS i
    ON i.CustomerId = o.CustomerId;
```

### Indexing And Constraints

Local and global temp tables can be indexed like regular tables.

Example:

```sql
CREATE TABLE #OrderWork
(
    OrderId BIGINT NOT NULL PRIMARY KEY,
    CustomerId BIGINT NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    CreatedAt DATETIME2 NOT NULL
);

CREATE INDEX IX_OrderWork_CustomerId
ON #OrderWork (CustomerId);
```

Table variables can declare some constraints and inline indexes as part of the declaration, but they do not support the same full post-creation flexibility.

Example:

```sql
DECLARE @OrderWork TABLE
(
    OrderId BIGINT NOT NULL PRIMARY KEY,
    CustomerId BIGINT NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    CreatedAt DATETIME2 NOT NULL,
    INDEX IX_OrderWork_CustomerId (CustomerId)
);
```

Interview rule of thumb: if you need several indexes, meaningful statistics, or repeated joins against many rows, start by considering a temp table.

### Transactions And Rollback Behavior

Temporary tables participate more like regular tables inside transactions.

Example:

```sql
CREATE TABLE #AuditWork
(
    Id INT NOT NULL PRIMARY KEY
);

BEGIN TRANSACTION;

INSERT INTO #AuditWork (Id)
VALUES (1);

ROLLBACK TRANSACTION;

SELECT *
FROM #AuditWork;
```

The inserted row is rolled back.

Table variables have more limited transaction behavior. SQL Server documentation describes table variables as requiring fewer locking and logging resources, and transaction rollbacks do not affect them in the same way as regular or temporary table data.

Example:

```sql
DECLARE @AuditWork TABLE
(
    Id INT NOT NULL PRIMARY KEY
);

BEGIN TRANSACTION;

INSERT INTO @AuditWork (Id)
VALUES (1);

ROLLBACK TRANSACTION;

SELECT *
FROM @AuditWork;
```

In SQL Server, the table variable itself remains in scope, and rollback behavior can surprise developers who expect it to behave exactly like a temp table. For workflows where rollback semantics of staged rows matter, use a temp table and test the behavior explicitly.

### Dynamic SQL Visibility

Dynamic SQL often exposes scope differences.

A local temp table created before dynamic SQL can be visible inside that dynamic SQL:

```sql
CREATE TABLE #Ids (Id INT NOT NULL PRIMARY KEY);
INSERT INTO #Ids (Id) VALUES (1), (2), (3);

EXEC sys.sp_executesql N'
    SELECT COUNT(*) AS IdCount
    FROM #Ids;
';
```

A table variable declared outside the dynamic SQL cannot be referenced inside that dynamic SQL batch:

```sql
DECLARE @Ids TABLE (Id INT NOT NULL PRIMARY KEY);
INSERT INTO @Ids (Id) VALUES (1), (2), (3);

EXEC sys.sp_executesql N'
    SELECT COUNT(*) AS IdCount
    FROM @Ids;
';
```

This fails because `@Ids` is outside the dynamic SQL scope. If dynamic SQL must work with table-shaped data, common choices include temp tables, table-valued parameters, JSON input, or creating the table variable inside the dynamic SQL batch.

### Choosing Between The Three

Use a local temp table when:

- The row count may be large.
- The intermediate data is joined multiple times.
- You need indexes, statistics, or better optimizer estimates.
- You need dynamic SQL or nested procedures to access the data.
- Transaction rollback behavior matters.

Use a table variable when:

- The row count is small.
- The logic is simple.
- You want variable-like scope.
- You are capturing DML `OUTPUT`.
- You are writing a function where temp tables are not allowed.

Use a global temp table when:

- Multiple sessions genuinely need to access the same temporary data.
- You are writing a controlled administrative script.
- You are doing diagnostics or troubleshooting.
- You can safely manage naming, concurrency, and cleanup.

Avoid global temp tables for normal web application request processing. They create shared state, and shared state is usually a liability in concurrent systems.

### Temporary Tables Vs CTEs

A common interview comparison is temp tables versus CTEs.

A CTE is usually scoped to a single statement:

```sql
WITH RecentOrders AS
(
    SELECT OrderId, CustomerId, OrderDate
    FROM dbo.Orders
    WHERE OrderDate >= DATEADD(day, -30, SYSUTCDATETIME())
)
SELECT CustomerId, COUNT(*) AS OrderCount
FROM RecentOrders
GROUP BY CustomerId;
```

This is clean when the intermediate result is used once. A temp table is often better when the result is expensive to produce, reused across multiple statements, or needs indexing.

### Common Mistakes

Common mistakes include:

- Using a table variable for thousands or millions of rows and then blaming the join.
- Assuming table variables always live only in memory.
- Expecting a table variable to be visible inside dynamic SQL.
- Using a global temp table for normal application request state.
- Forgetting to add indexes to temp tables that are joined repeatedly.
- Assuming `#Temp` names are unique without considering nested procedure behavior.
- Not testing with realistic row counts.
- Leaving temp table creation and query logic in one huge procedure that is difficult to reason about.

### Best Practices

Best practices:

- Prefer the simplest structure that preserves correctness and performance.
- Use local temp tables for medium-to-large staged data sets.
- Use table variables for small, simple, scoped row sets.
- Add indexes to temp tables based on real query predicates and join columns.
- Avoid global temp tables unless cross-session visibility is explicitly required.
- Explicitly drop temp tables when it improves readability or reduces long-running resource usage.
- Benchmark with realistic row counts, not toy examples.
- Check actual execution plans when table variables participate in joins.
- Consider table-valued parameters when passing row sets from application code into stored procedures.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is a local temporary table in SQL Server?

<!-- question:start:local-vs-global-temporary-tables-and-table-variables-beginner-q01 -->
<!-- question-id:local-vs-global-temporary-tables-and-table-variables-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A local temporary table is a temporary table whose name starts with a single number sign, such as `#Orders`. It is created in `tempdb` and is scoped to the current session. It can store intermediate rows, support indexes and constraints, and be used across multiple statements in the same session.

It is automatically dropped when the session ends, although developers can explicitly drop it earlier with `DROP TABLE`.

##### Key Points to Mention

- Uses a single number sign prefix.
- Exists in `tempdb`.
- Visible to the creating session.
- Can be used across multiple statements.
- Supports indexes and statistics.
- Good for staged data that may be joined or reused.

<!-- question:end:local-vs-global-temporary-tables-and-table-variables-beginner-q01 -->

#### What is a global temporary table?

<!-- question:start:local-vs-global-temporary-tables-and-table-variables-beginner-q02 -->
<!-- question-id:local-vs-global-temporary-tables-and-table-variables-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

A global temporary table is a temporary table whose name starts with two number signs, such as `##ImportStatus`. Unlike a local temp table, it is visible to other sessions while it exists. It is dropped after the creating session ends and after active statements that reference it complete.

Global temporary tables are mainly useful for controlled cross-session workflows, administrative scripts, or diagnostics. They are usually not a good default for application request processing because they introduce shared state and naming risks.

##### Key Points to Mention

- Uses a double number sign prefix.
- Visible across sessions.
- Created in `tempdb`.
- Useful for diagnostics or controlled shared temporary data.
- Risky for normal concurrent application workflows.
- Needs careful lifecycle and naming management.

<!-- question:end:local-vs-global-temporary-tables-and-table-variables-beginner-q02 -->

#### What is a table variable?

<!-- question:start:local-vs-global-temporary-tables-and-table-variables-beginner-q03 -->
<!-- question-id:local-vs-global-temporary-tables-and-table-variables-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

A table variable is a variable declared with the `table` data type, such as `DECLARE @Ids TABLE (...)`. It stores a set of rows within the scope of a batch, stored procedure, or function. It behaves like a local variable but can be queried with `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.

Table variables are commonly used for small intermediate row sets and for capturing rows from DML operations using the `OUTPUT` clause.

##### Key Points to Mention

- Declared with `DECLARE @Name TABLE`.
- Scoped like a local variable.
- Automatically cleaned up when scope ends.
- Useful for small row sets.
- Can be used in functions.
- Not the same as a memory-only table.

<!-- question:end:local-vs-global-temporary-tables-and-table-variables-beginner-q03 -->

#### When would you choose a temp table instead of a table variable?

<!-- question:start:local-vs-global-temporary-tables-and-table-variables-beginner-q04 -->
<!-- question-id:local-vs-global-temporary-tables-and-table-variables-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Choose a temp table when the row count may be large, when the data will be joined to other tables, when the data is reused across multiple statements, or when indexes and optimizer statistics matter. Temp tables provide more flexibility for indexing and generally give SQL Server better information for plan selection.

A table variable is usually better for smaller, simpler, tightly scoped data.

##### Key Points to Mention

- Temp tables are better for larger intermediate data.
- Temp tables support statistics.
- Temp tables support more flexible indexing.
- Table variables are simpler for small row sets.
- Realistic row count matters more than habit.

<!-- question:end:local-vs-global-temporary-tables-and-table-variables-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### How do temp tables and table variables differ for query optimization?

<!-- question:start:local-vs-global-temporary-tables-and-table-variables-intermediate-q01 -->
<!-- question-id:local-vs-global-temporary-tables-and-table-variables-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

Temp tables can have statistics, and SQL Server can use those statistics to estimate row counts and choose join strategies. Table variables have more limited optimizer information and do not maintain distribution statistics in the same way. That can lead to poor cardinality estimates, especially when a table variable contains many rows or participates in complex joins.

Modern SQL Server compatibility levels improve table variable behavior with deferred compilation, but temp tables still provide stronger indexing and statistics support for many performance-sensitive workloads.

##### Key Points to Mention

- Optimizer estimates affect join order and join type.
- Temp tables can have statistics.
- Table variables can produce poor estimates for larger row sets.
- Deferred compilation helps but does not make table variables identical to temp tables.
- Actual execution plans are important when diagnosing this.

<!-- question:end:local-vs-global-temporary-tables-and-table-variables-intermediate-q01 -->

#### Can a table variable be used inside dynamic SQL?

<!-- question:start:local-vs-global-temporary-tables-and-table-variables-intermediate-q02 -->
<!-- question-id:local-vs-global-temporary-tables-and-table-variables-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

A table variable declared outside a dynamic SQL batch cannot be referenced inside that dynamic SQL batch because it is outside the variable's scope. A local temp table created before dynamic SQL can often be referenced inside the dynamic SQL because it belongs to the session.

If dynamic SQL needs table-shaped input, common options include using a temp table, passing a table-valued parameter to a stored procedure, passing JSON or delimited input and parsing it, or declaring the table variable inside the dynamic SQL itself.

##### Key Points to Mention

- Table variables are scoped to the declaring batch or procedure.
- Dynamic SQL runs in a separate batch.
- Local temp tables are session-scoped and can be visible to dynamic SQL.
- Scope bugs are common in stored procedure interviews.
- Avoid dynamic SQL unless it solves a real problem.

<!-- question:end:local-vs-global-temporary-tables-and-table-variables-intermediate-q02 -->

#### How do transaction rollbacks affect temp tables and table variables?

<!-- question:start:local-vs-global-temporary-tables-and-table-variables-intermediate-q03 -->
<!-- question-id:local-vs-global-temporary-tables-and-table-variables-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Rows inserted into a temp table inside a transaction are generally rolled back if the transaction is rolled back, because temp tables behave much like regular tables for transactional data changes. Table variables have more limited transaction behavior, and rollback behavior can surprise developers who expect them to behave exactly like temp tables.

For interview purposes, the safest answer is that temp tables are the better choice when the staged rows must participate clearly in transaction rollback semantics, and table variable behavior should be tested if rollback correctness matters.

##### Key Points to Mention

- Temp table data changes participate in transactions.
- Table variables have limited transaction behavior.
- Rollback semantics matter in error-handling procedures.
- Do not assume both structures behave identically.
- Test transaction behavior for critical workflows.

<!-- question:end:local-vs-global-temporary-tables-and-table-variables-intermediate-q03 -->

#### What indexing options do temp tables and table variables support?

<!-- question:start:local-vs-global-temporary-tables-and-table-variables-intermediate-q04 -->
<!-- question-id:local-vs-global-temporary-tables-and-table-variables-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Temp tables support normal index creation after the table is created, including indexes added to support joins, filters, and ordering. Table variables can define primary keys, unique constraints, and some inline indexes in the declaration, but they are less flexible because they cannot be altered after declaration.

If the intermediate data needs multiple indexes or careful performance tuning, a temp table is usually the better option.

##### Key Points to Mention

- Temp tables support `CREATE INDEX`.
- Table variables define constraints and inline indexes at declaration time.
- Table variables cannot be altered after creation.
- Indexing should match join and filter predicates.
- Too many indexes can slow inserts into temporary data.

<!-- question:end:local-vs-global-temporary-tables-and-table-variables-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you debug a slow stored procedure that uses a large table variable?

<!-- question:start:local-vs-global-temporary-tables-and-table-variables-advanced-q01 -->
<!-- question-id:local-vs-global-temporary-tables-and-table-variables-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Start by checking actual execution plans and actual row counts. If the table variable contains many rows and joins to large tables, poor cardinality estimates may be causing bad join choices, bad memory grants, or repeated lookups. Compare the plan with a local temp table version that has appropriate indexes.

Also check compatibility level, deferred compilation behavior, parameter sensitivity, row count variation, and whether `OPTION (RECOMPILE)` improves estimates for that specific query. The goal is not blindly replacing every table variable, but proving whether optimizer information is the bottleneck.

##### Key Points to Mention

- Review actual execution plan and actual row counts.
- Compare estimates versus actuals.
- Test a temp table with indexes.
- Consider `OPTION (RECOMPILE)` selectively.
- Check row count variability.
- Measure with realistic production-like data.

<!-- question:end:local-vs-global-temporary-tables-and-table-variables-advanced-q01 -->

#### Why can global temp tables be dangerous in application code?

<!-- question:start:local-vs-global-temporary-tables-and-table-variables-advanced-q02 -->
<!-- question-id:local-vs-global-temporary-tables-and-table-variables-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Global temp tables are visible across sessions, so they create shared mutable state. In application code, that can lead to naming collisions, data leakage between requests, race conditions, accidental reads of another workflow's data, and lifecycle problems when one session expects the table to exist but another session affects timing.

For web applications and APIs, request-scoped local temp tables or durable staging tables with explicit ownership keys are usually safer than global temp tables.

##### Key Points to Mention

- Global temp tables are cross-session.
- Shared state can create concurrency bugs.
- Naming collisions are possible.
- Lifecycle depends on sessions and active references.
- Prefer explicit durable staging tables for shared workflows.
- Prefer local temp tables for request-scoped work.

<!-- question:end:local-vs-global-temporary-tables-and-table-variables-advanced-q02 -->

#### How would you design a stored procedure that stages rows before applying a complex update?

<!-- question:start:local-vs-global-temporary-tables-and-table-variables-advanced-q03 -->
<!-- question-id:local-vs-global-temporary-tables-and-table-variables-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

For a complex update with many rows, use a local temp table to stage the target keys and any computed values. Add a primary key and indexes that support the final update join. Validate row counts before applying changes, run the update in a transaction, and capture affected rows with `OUTPUT` if auditing is required.

A table variable may be acceptable if the staged set is small and simple, but a temp table is usually easier to inspect, index, and tune for larger updates.

##### Key Points to Mention

- Stage keys and computed values first.
- Use a local temp table for larger or reused data.
- Add indexes based on update joins.
- Validate row counts before updating.
- Use transactions and error handling.
- Capture changed rows when auditability matters.

<!-- question:end:local-vs-global-temporary-tables-and-table-variables-advanced-q03 -->

#### What are good alternatives when temporary structures become overused?

<!-- question:start:local-vs-global-temporary-tables-and-table-variables-advanced-q04 -->
<!-- question-id:local-vs-global-temporary-tables-and-table-variables-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

If temporary structures are being overused, first ask why they exist. Some can be replaced by a simpler set-based query, a CTE, a derived table, or a window function. Repeated cross-step workflows may deserve a permanent staging table with status, ownership, audit columns, and cleanup rules. Application-to-database row-set passing may be better handled with table-valued parameters.

The right answer depends on scope, row count, reuse, durability, audit needs, and performance. Temporary structures are useful, but they should not become a substitute for clear query design.

##### Key Points to Mention

- CTEs and derived tables help single-statement logic.
- Window functions can remove staging steps.
- Permanent staging tables help durable workflows.
- Table-valued parameters help pass row sets from app code.
- Overuse can hide unclear design.
- Choose based on scope, durability, and performance.

<!-- question:end:local-vs-global-temporary-tables-and-table-variables-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
