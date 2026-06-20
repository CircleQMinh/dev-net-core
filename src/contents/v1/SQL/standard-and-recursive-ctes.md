---
id: standard-and-recursive-ctes
topic: Advanced querying with window functions and CTEs
subtopic: Standard and recursive CTEs
category: SQL
---

## Overview

A common table expression, or CTE, is a named temporary result set defined within a single SQL statement. In SQL Server, a CTE starts with `WITH`, gives a name to a query expression, and can then be referenced by the immediately following `SELECT`, `INSERT`, `UPDATE`, `DELETE`, or `MERGE` statement.

Standard CTEs make complex queries easier to read by breaking logic into named steps. Recursive CTEs reference themselves and are commonly used to traverse hierarchical or graph-like data, such as employee-manager trees, category trees, bill-of-materials structures, and parent-child relationships.

This topic matters because CTEs are heavily used in interview SQL problems. They pair naturally with window functions, deduplication, top-N-per-group logic, multi-step filtering, hierarchy traversal, and query refactoring.

For interviews, strong candidates can explain what CTEs are, how long they live, when they are not materialized, how recursive anchor and recursive members work, how `MAXRECURSION` prevents runaway recursion, and when a temp table is a better choice.

## Core Concepts

### What A CTE Is

A CTE is a named query expression scoped to one following statement.

Example:

```sql
WITH RecentOrders AS
(
    SELECT
        OrderId,
        CustomerId,
        OrderDate,
        TotalAmount
    FROM dbo.Orders
    WHERE OrderDate >= DATEADD(day, -30, SYSUTCDATETIME())
)
SELECT
    CustomerId,
    COUNT(*) AS RecentOrderCount,
    SUM(TotalAmount) AS RecentOrderTotal
FROM RecentOrders
GROUP BY CustomerId;
```

`RecentOrders` exists only for the statement immediately after the CTE definition. It is not a permanent table and not a session-scoped temp table.

### Standard CTE Syntax

Basic syntax:

```sql
WITH CteName AS
(
    SELECT ...
)
SELECT ...
FROM CteName;
```

When the previous statement in a batch does not already end with a semicolon, place a semicolon before `WITH`:

```sql
;WITH CteName AS
(
    SELECT ...
)
SELECT *
FROM CteName;
```

Many teams always write `;WITH` defensively in scripts because SQL Server requires the prior statement to be terminated before a CTE begins.

### CTE Scope

A CTE is available only to the single statement immediately following it.

Valid:

```sql
WITH HighValueOrders AS
(
    SELECT OrderId, CustomerId, TotalAmount
    FROM dbo.Orders
    WHERE TotalAmount >= 1000
)
SELECT *
FROM HighValueOrders;
```

Invalid:

```sql
WITH HighValueOrders AS
(
    SELECT OrderId, CustomerId, TotalAmount
    FROM dbo.Orders
    WHERE TotalAmount >= 1000
)
SELECT COUNT(*) FROM HighValueOrders;

SELECT SUM(TotalAmount) FROM HighValueOrders;
```

The second `SELECT` cannot see the CTE. Use a temp table if the intermediate result must be reused by multiple statements.

### CTEs Are Usually Not Materialized

A common misconception is that a CTE always stores results like a temp table. In SQL Server, a CTE is usually more like an inline named query expression. The optimizer can expand it into the outer query, and each outer reference may require re-execution of the CTE definition.

This means a CTE is good for readability, but it is not automatically a performance feature.

If an expensive intermediate result is reused many times, consider:

- A local temporary table.
- A table variable for small scoped data.
- A persisted staging table.
- An indexed view or computed column when appropriate.

### Multiple CTEs

You can define multiple CTEs in one `WITH` clause.

Example:

```sql
WITH RecentOrders AS
(
    SELECT OrderId, CustomerId, TotalAmount
    FROM dbo.Orders
    WHERE OrderDate >= DATEADD(day, -30, SYSUTCDATETIME())
),
CustomerTotals AS
(
    SELECT
        CustomerId,
        SUM(TotalAmount) AS TotalAmount
    FROM RecentOrders
    GROUP BY CustomerId
)
SELECT
    c.CustomerId,
    c.Email,
    ct.TotalAmount
FROM CustomerTotals AS ct
JOIN dbo.Customers AS c
    ON c.CustomerId = ct.CustomerId;
```

Later CTEs can reference earlier CTEs in the same `WITH` clause. Forward references are not allowed.

### CTEs With Window Functions

CTEs are often used to filter window function results.

Example: latest order per customer.

```sql
WITH RankedOrders AS
(
    SELECT
        OrderId,
        CustomerId,
        OrderDate,
        TotalAmount,
        ROW_NUMBER() OVER
        (
            PARTITION BY CustomerId
            ORDER BY OrderDate DESC, OrderId DESC
        ) AS rn
    FROM dbo.Orders
)
SELECT
    OrderId,
    CustomerId,
    OrderDate,
    TotalAmount
FROM RankedOrders
WHERE rn = 1;
```

This works because the outer query can filter on the window result produced inside the CTE.

### CTEs With UPDATE, DELETE, INSERT, And MERGE

A CTE can feed more than a `SELECT`.

Example: delete duplicate rows after reviewing the logic carefully.

```sql
WITH DuplicateCustomers AS
(
    SELECT
        CustomerId,
        ROW_NUMBER() OVER
        (
            PARTITION BY Email
            ORDER BY UpdatedAt DESC, CustomerId DESC
        ) AS rn
    FROM dbo.Customers
)
DELETE FROM DuplicateCustomers
WHERE rn > 1;
```

This pattern can be powerful, but it should be used carefully. Always run the CTE as a `SELECT` first, confirm the affected rows, and make sure constraints prevent the duplicates from returning.

### Recursive CTEs

A recursive CTE references itself. It has at least two parts:

- Anchor member: returns the starting rows.
- Recursive member: joins back to the CTE to find the next level.

Example: employee hierarchy.

```sql
WITH EmployeeTree AS
(
    -- Anchor member: start with the CEO.
    SELECT
        EmployeeId,
        ManagerId,
        FullName,
        0 AS Level
    FROM dbo.Employees
    WHERE ManagerId IS NULL

    UNION ALL

    -- Recursive member: find direct reports of the previous level.
    SELECT
        e.EmployeeId,
        e.ManagerId,
        e.FullName,
        et.Level + 1 AS Level
    FROM dbo.Employees AS e
    JOIN EmployeeTree AS et
        ON e.ManagerId = et.EmployeeId
)
SELECT
    EmployeeId,
    ManagerId,
    FullName,
    Level
FROM EmployeeTree
ORDER BY Level, FullName;
```

The anchor query runs first. The recursive query runs repeatedly using the previous iteration's output until it returns no more rows.

### Anchor Member

The anchor member defines the starting point.

Examples:

- Root employees where `ManagerId IS NULL`.
- A specific category where `CategoryId = @RootCategoryId`.
- Top-level bill-of-materials item.
- A starting node in a dependency graph.

Example:

```sql
SELECT
    CategoryId,
    ParentCategoryId,
    Name,
    0 AS Depth
FROM dbo.Categories
WHERE CategoryId = @RootCategoryId
```

The anchor determines what tree or branch you traverse.

### Recursive Member

The recursive member references the CTE name and moves one step deeper.

Example:

```sql
SELECT
    c.CategoryId,
    c.ParentCategoryId,
    c.Name,
    tree.Depth + 1 AS Depth
FROM dbo.Categories AS c
JOIN CategoryTree AS tree
    ON c.ParentCategoryId = tree.CategoryId
```

The recursive member should make progress. If it returns the same rows repeatedly, recursion can loop.

### UNION ALL In Recursive CTEs

Recursive CTEs usually use `UNION ALL` between the anchor and recursive member.

Example:

```sql
WITH CategoryTree AS
(
    SELECT CategoryId, ParentCategoryId, Name, 0 AS Depth
    FROM dbo.Categories
    WHERE ParentCategoryId IS NULL

    UNION ALL

    SELECT c.CategoryId, c.ParentCategoryId, c.Name, tree.Depth + 1
    FROM dbo.Categories AS c
    JOIN CategoryTree AS tree
        ON c.ParentCategoryId = tree.CategoryId
)
SELECT *
FROM CategoryTree;
```

`UNION ALL` does not remove duplicates. If the hierarchy contains cycles or bad data, recursion can repeat rows. Handle cycles and add safety limits when needed.

### MAXRECURSION

SQL Server uses a default recursion limit of 100 for recursive CTEs. You can override it with the `MAXRECURSION` query hint on the outer statement.

Example:

```sql
WITH CategoryTree AS
(
    SELECT CategoryId, ParentCategoryId, Name, 0 AS Depth
    FROM dbo.Categories
    WHERE CategoryId = @RootCategoryId

    UNION ALL

    SELECT c.CategoryId, c.ParentCategoryId, c.Name, tree.Depth + 1
    FROM dbo.Categories AS c
    JOIN CategoryTree AS tree
        ON c.ParentCategoryId = tree.CategoryId
)
SELECT *
FROM CategoryTree
OPTION (MAXRECURSION 200);
```

Use `MAXRECURSION` to guard against bad data or broken recursive logic. A value of `0` removes the limit, which should be used carefully.

### Cycle Prevention

Recursive data can contain cycles.

Example:

- Category 10's parent is 20.
- Category 20's parent is 30.
- Category 30's parent is 10.

The recursive query can loop through the same nodes repeatedly.

One simple cycle-detection pattern stores a path:

```sql
WITH CategoryTree AS
(
    SELECT
        CategoryId,
        ParentCategoryId,
        Name,
        CAST(CONCAT('/', CategoryId, '/') AS VARCHAR(4000)) AS Path,
        0 AS Depth
    FROM dbo.Categories
    WHERE CategoryId = @RootCategoryId

    UNION ALL

    SELECT
        c.CategoryId,
        c.ParentCategoryId,
        c.Name,
        CAST(CONCAT(tree.Path, c.CategoryId, '/') AS VARCHAR(4000)) AS Path,
        tree.Depth + 1 AS Depth
    FROM dbo.Categories AS c
    JOIN CategoryTree AS tree
        ON c.ParentCategoryId = tree.CategoryId
    WHERE tree.Path NOT LIKE CONCAT('%/', c.CategoryId, '/%')
)
SELECT *
FROM CategoryTree;
```

This is not the only solution, and it may not be ideal for very large graphs, but it demonstrates the concept: recursive queries need a termination strategy.

### Recursive CTE Restrictions

Recursive CTEs have restrictions, especially in the recursive member.

Common limitations include:

- The anchor and recursive members must return the same number of columns.
- Corresponding columns must have compatible data types.
- The recursive member references the CTE name.
- The recursive member should reference the CTE only once.
- Some clauses and operators are not allowed in the recursive member.
- Recursive logic must eventually stop returning rows.

These restrictions exist because SQL Server must repeatedly apply the recursive member and combine intermediate results.

### CTEs Vs Derived Tables

A derived table is an inline subquery in the `FROM` clause.

Example:

```sql
SELECT *
FROM
(
    SELECT
        OrderId,
        CustomerId,
        ROW_NUMBER() OVER
        (
            PARTITION BY CustomerId
            ORDER BY OrderDate DESC, OrderId DESC
        ) AS rn
    FROM dbo.Orders
) AS RankedOrders
WHERE rn = 1;
```

This is similar to a CTE. A CTE often reads better when the query has several named steps or recursion. A derived table may be fine for one short transformation.

### CTEs Vs Temporary Tables

Use a CTE when:

- The intermediate result is used once.
- The goal is readability.
- The query optimizer can handle the full expression well.
- You want to combine naturally with one statement.

Use a temp table when:

- The intermediate result is reused across multiple statements.
- You need indexes or statistics on staged data.
- You need to inspect or debug the intermediate result.
- The CTE definition is expensive and referenced multiple times.
- Breaking the query into steps improves the execution plan.

Interview rule: a CTE is a readability and expression tool, not a guaranteed materialization or performance tool.

### Common Mistakes

Common mistakes include:

- Thinking a CTE is automatically stored like a temp table.
- Trying to reference a CTE from multiple following statements.
- Forgetting the semicolon before `WITH` when the previous statement is not terminated.
- Putting `ORDER BY` inside a CTE without `TOP` or `OFFSET/FETCH`.
- Using a CTE many times and expecting it to execute only once.
- Writing recursive logic with no termination condition.
- Ignoring cycles in hierarchy data.
- Removing `MAXRECURSION` too early.
- Using recursive CTEs for very deep or graph-heavy workloads without testing performance.

### Best Practices

Best practices:

- Use CTEs to make complex query steps readable.
- Keep each CTE focused and named by intent.
- Use temp tables when intermediate results need reuse, indexing, or inspection.
- Test CTEs with realistic row counts and actual execution plans.
- For recursive CTEs, define a clear anchor and progress-making recursive member.
- Use `MAXRECURSION` while developing and for defensive production limits when appropriate.
- Protect recursive queries against cycles when data can be malformed.
- Use explicit data types in recursive columns when needed to avoid type mismatch surprises.
- Review data-modifying CTEs carefully before executing them.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is a CTE in SQL Server?

<!-- question:start:standard-and-recursive-ctes-beginner-q01 -->
<!-- question-id:standard-and-recursive-ctes-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A CTE, or common table expression, is a named temporary result set defined within a single SQL statement. It starts with `WITH`, defines a query, and can be referenced by the immediately following statement.

It is commonly used to make complex queries easier to read, especially when combined with window functions or multi-step filtering.

##### Key Points to Mention

- Stands for common table expression.
- Defined with `WITH`.
- Scoped to one following statement.
- Improves readability.
- Not a permanent table.

<!-- question:end:standard-and-recursive-ctes-beginner-q01 -->

#### How long does a CTE exist?

<!-- question:start:standard-and-recursive-ctes-beginner-q02 -->
<!-- question-id:standard-and-recursive-ctes-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

A CTE exists only for the single statement immediately following the CTE definition. It cannot be referenced by later statements in the batch.

If the same intermediate result must be reused by multiple statements, a temporary table or table variable may be more appropriate.

##### Key Points to Mention

- One-statement scope.
- Not session-scoped.
- Not reusable across multiple statements.
- Use temp tables for reuse.
- Scope is a common interview trap.

<!-- question:end:standard-and-recursive-ctes-beginner-q02 -->

#### What is a recursive CTE?

<!-- question:start:standard-and-recursive-ctes-beginner-q03 -->
<!-- question-id:standard-and-recursive-ctes-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

A recursive CTE is a CTE that references itself. It has an anchor member that returns the starting rows and a recursive member that repeatedly finds the next level until no more rows are returned.

Recursive CTEs are commonly used for hierarchies such as employee-manager trees, category trees, and bill-of-materials structures.

##### Key Points to Mention

- References itself.
- Has an anchor member.
- Has a recursive member.
- Runs until no new rows are returned.
- Useful for hierarchical data.

<!-- question:end:standard-and-recursive-ctes-beginner-q03 -->

#### Why would you use a CTE instead of a subquery?

<!-- question:start:standard-and-recursive-ctes-beginner-q04 -->
<!-- question-id:standard-and-recursive-ctes-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Use a CTE when naming an intermediate result makes the query easier to read or when the logic has multiple steps. A CTE can be clearer than deeply nested subqueries, especially with ranking, deduplication, and filtering window function results.

A short subquery is still fine when it is simple. The choice is often about readability and maintainability.

##### Key Points to Mention

- CTEs improve readability.
- Good for multi-step logic.
- Good with window functions.
- Subqueries are fine for simple cases.
- CTEs do not automatically improve performance.

<!-- question:end:standard-and-recursive-ctes-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### Are CTEs materialized in SQL Server?

<!-- question:start:standard-and-recursive-ctes-intermediate-q01 -->
<!-- question-id:standard-and-recursive-ctes-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

Usually no. A CTE is generally an inline query expression, not a stored intermediate result. The optimizer can expand it into the outer query, and if the CTE is referenced multiple times, the underlying query may be re-executed.

If you need materialization, reuse, indexes, statistics, or debugging visibility, consider using a temp table.

##### Key Points to Mention

- CTEs are usually not materialized.
- They are scoped query expressions.
- Multiple references can mean repeated work.
- Temp tables are better for reusable staged data.
- Performance must be checked with execution plans.

<!-- question:end:standard-and-recursive-ctes-intermediate-q01 -->

#### Why is a semicolon often written before WITH?

<!-- question:start:standard-and-recursive-ctes-intermediate-q02 -->
<!-- question-id:standard-and-recursive-ctes-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

In SQL Server, a CTE must be preceded by a statement terminator if another statement comes before it in the same batch. Developers often write `;WITH` to ensure the previous statement is terminated and the CTE parses correctly.

The semicolon belongs to the previous statement, but `;WITH` is a common defensive style in scripts.

##### Key Points to Mention

- CTE syntax starts with `WITH`.
- The previous statement must be terminated.
- `;WITH` avoids parser errors.
- The semicolon terminates the prior statement.
- This is SQL Server-specific interview trivia.

<!-- question:end:standard-and-recursive-ctes-intermediate-q02 -->

#### How does a recursive CTE execute?

<!-- question:start:standard-and-recursive-ctes-intermediate-q03 -->
<!-- question-id:standard-and-recursive-ctes-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

The anchor member runs first and produces the initial rows. Then the recursive member runs repeatedly, using the previous iteration's rows as input. Recursion stops when the recursive member returns no rows. SQL Server combines the anchor and recursive results into the final result set.

The recursive member must make progress; otherwise the query can loop until the recursion limit is reached.

##### Key Points to Mention

- Anchor runs first.
- Recursive member runs repeatedly.
- Each iteration uses prior output.
- Stops when no rows are returned.
- Bad recursion can loop.

<!-- question:end:standard-and-recursive-ctes-intermediate-q03 -->

#### What is MAXRECURSION used for?

<!-- question:start:standard-and-recursive-ctes-intermediate-q04 -->
<!-- question-id:standard-and-recursive-ctes-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

`MAXRECURSION` limits how many recursive levels SQL Server allows for a recursive CTE. It helps prevent runaway recursion from bad logic or cyclic data. SQL Server has a default recursion limit, and the query can override it with `OPTION (MAXRECURSION n)`.

A value of `0` removes the limit, so it should be used carefully.

##### Key Points to Mention

- Limits recursive depth.
- Protects against infinite loops.
- Default limit exists.
- Used in the outer query option.
- `0` means no limit.

<!-- question:end:standard-and-recursive-ctes-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### When would you choose a temp table instead of a CTE?

<!-- question:start:standard-and-recursive-ctes-advanced-q01 -->
<!-- question-id:standard-and-recursive-ctes-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Choose a temp table when the intermediate result is reused across multiple statements, needs indexes or statistics, is expensive to recompute, needs to be inspected during debugging, or helps break a complex query into better execution-plan phases. A CTE is better when the result is used once and the main goal is readability.

The decision should be based on scope, reuse, row count, indexing needs, and actual execution plans.

##### Key Points to Mention

- CTEs are one-statement expressions.
- Temp tables can be reused.
- Temp tables can be indexed.
- Expensive repeated CTEs may cost more.
- Execution plans and row counts matter.

<!-- question:end:standard-and-recursive-ctes-advanced-q01 -->

#### How would you protect a recursive CTE from cycles?

<!-- question:start:standard-and-recursive-ctes-advanced-q02 -->
<!-- question-id:standard-and-recursive-ctes-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Use a combination of data constraints, query logic, and recursion limits. The data model should prevent invalid parent-child cycles where possible. The recursive query can track a visited path or visited IDs and avoid revisiting nodes. `MAXRECURSION` should be used as a safety limit, not as the only correctness mechanism.

For complex graph traversal, a recursive CTE may not be the best tool.

##### Key Points to Mention

- Prevent cycles with constraints when possible.
- Track visited nodes or paths.
- Use `MAXRECURSION` defensively.
- Do not rely only on recursion limits.
- Consider other designs for complex graphs.

<!-- question:end:standard-and-recursive-ctes-advanced-q02 -->

#### How can CTEs be used safely with DELETE or UPDATE?

<!-- question:start:standard-and-recursive-ctes-advanced-q03 -->
<!-- question-id:standard-and-recursive-ctes-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

A CTE can identify rows to update or delete, such as duplicates ranked with `ROW_NUMBER`. To use it safely, first run the CTE as a `SELECT`, verify affected rows, wrap changes in a transaction when appropriate, capture affected rows with `OUTPUT` if needed, and ensure constraints prevent the same bad data from returning.

Data-modifying CTEs are powerful but deserve careful review because a small predicate error can affect many rows.

##### Key Points to Mention

- Preview the CTE with `SELECT`.
- Use transactions for risky changes.
- Capture affected rows when useful.
- Review predicates carefully.
- Add constraints after cleanup when appropriate.

<!-- question:end:standard-and-recursive-ctes-advanced-q03 -->

#### What are common performance risks with CTE-heavy queries?

<!-- question:start:standard-and-recursive-ctes-advanced-q04 -->
<!-- question-id:standard-and-recursive-ctes-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

CTE-heavy queries can become hard for the optimizer when many steps are chained, when a CTE is referenced multiple times, or when large intermediate results are repeatedly sorted or joined. Because CTEs are usually not materialized, repeated references can mean repeated work.

Use actual execution plans to check scans, spools, sorts, row estimates, and memory grants. If needed, split the query with temp tables and indexes.

##### Key Points to Mention

- CTEs are usually inline.
- Multiple references can repeat work.
- Large sorts and joins can become expensive.
- Actual execution plans matter.
- Temp tables can create useful phase breaks.

<!-- question:end:standard-and-recursive-ctes-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
