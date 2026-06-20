---
id: replacing-brittle-subqueries-with-clearer-query-structure
topic: Advanced querying with window functions and CTEs
subtopic: Replacing brittle subqueries with clearer query structure
category: SQL
---

## Overview

Subqueries are queries nested inside another SQL statement. They are valid and often useful, but deeply nested, poorly aliased, or repeatedly correlated subqueries can make SQL hard to read, hard to test, and easy to break during maintenance.

Replacing brittle subqueries means rewriting a query into a clearer structure without changing the result. Common replacements include joins, `EXISTS`, `NOT EXISTS`, CTEs, derived tables, `APPLY`, window functions, and temporary tables. The goal is not to eliminate every subquery. The goal is to make intent, row cardinality, filtering, and performance behavior easier to reason about.

This topic matters because interviewers often present SQL that works on small data but is confusing, slow, or subtly wrong. Strong candidates can identify when a scalar subquery might return more than one row, when `NOT IN` breaks with `NULL`, when a correlated subquery should become a join or window function, and when a CTE improves readability without pretending to materialize results.

For interviews, good answers focus on correctness first, then readability, then performance. A clear query structure makes code review safer and makes execution-plan problems easier to diagnose.

## Core Concepts

### What Makes A Subquery Brittle

A subquery becomes brittle when small changes can easily break correctness or readability.

Common signs:

- Multiple nested levels.
- Outer column references that are not obvious.
- Missing or ambiguous aliases.
- Scalar subqueries that assume one row but can return many.
- `NOT IN` logic that does not account for `NULL`.
- Repeated correlated subqueries in the `SELECT` list.
- Business rules hidden in several different nested predicates.
- The same subquery copied in multiple places.
- Poor performance caused by repeated evaluation or bad estimates.

Example of brittle structure:

```sql
SELECT
    c.CustomerId,
    c.Email,
    (SELECT MAX(o.OrderDate)
     FROM dbo.Orders AS o
     WHERE o.CustomerId = c.CustomerId) AS LastOrderDate,
    (SELECT COUNT(*)
     FROM dbo.Orders AS o
     WHERE o.CustomerId = c.CustomerId
       AND o.Status = N'Completed') AS CompletedOrderCount
FROM dbo.Customers AS c
WHERE c.CustomerId IN
(
    SELECT o.CustomerId
    FROM dbo.Orders AS o
    WHERE o.OrderDate >= DATEADD(day, -90, SYSUTCDATETIME())
);
```

This may be valid, but the query repeats access to `Orders` and scatters customer-order rules across several places.

### Subqueries Are Not Always Bad

Subqueries are appropriate when they express intent cleanly.

Good examples:

```sql
SELECT ProductId, Name
FROM dbo.Products
WHERE CategoryId IN
(
    SELECT CategoryId
    FROM dbo.Categories
    WHERE IsActive = 1
);
```

```sql
SELECT CustomerId, Email
FROM dbo.Customers AS c
WHERE EXISTS
(
    SELECT 1
    FROM dbo.Orders AS o
    WHERE o.CustomerId = c.CustomerId
);
```

The problem is not nesting itself. The problem is unclear nesting, fragile assumptions, and subqueries used where another structure expresses the business rule better.

### Use Joins When You Need Columns From Both Sides

If the final result needs columns from both tables, a join is usually clearer than a subquery.

Subquery version:

```sql
SELECT p.ProductId, p.Name
FROM dbo.Products AS p
WHERE p.CategoryId IN
(
    SELECT c.CategoryId
    FROM dbo.Categories AS c
    WHERE c.Name = N'Bikes'
);
```

Join version:

```sql
SELECT
    p.ProductId,
    p.Name,
    c.Name AS CategoryName
FROM dbo.Products AS p
JOIN dbo.Categories AS c
    ON c.CategoryId = p.CategoryId
WHERE c.Name = N'Bikes';
```

The join version makes the relationship explicit and allows the query to return `CategoryName`. It also makes join cardinality easier to review.

Important caution: replacing a subquery with a join can duplicate rows if the joined table has multiple matches. Use constraints, `EXISTS`, grouping, or distinct selection based on the real requirement.

### Use EXISTS For Existence Checks

When the question is "does a matching row exist?", `EXISTS` is often clearer than `IN` or a join.

Example:

```sql
SELECT c.CustomerId, c.Email
FROM dbo.Customers AS c
WHERE EXISTS
(
    SELECT 1
    FROM dbo.Orders AS o
    WHERE o.CustomerId = c.CustomerId
      AND o.Status = N'Completed'
);
```

This expresses a semi-join: return customers that have at least one completed order.

Using a join can accidentally duplicate customers:

```sql
SELECT c.CustomerId, c.Email
FROM dbo.Customers AS c
JOIN dbo.Orders AS o
    ON o.CustomerId = c.CustomerId
WHERE o.Status = N'Completed';
```

If a customer has five completed orders, this returns five customer rows unless you add `DISTINCT` or grouping. `EXISTS` avoids that duplication because it only asks whether a match exists.

### Use NOT EXISTS Instead Of NOT IN With Nullable Data

`NOT IN` can behave unexpectedly when the subquery returns `NULL`.

Risky:

```sql
SELECT c.CustomerId, c.Email
FROM dbo.Customers AS c
WHERE c.CustomerId NOT IN
(
    SELECT o.CustomerId
    FROM dbo.Orders AS o
);
```

If `Orders.CustomerId` contains `NULL`, the `NOT IN` logic can return no rows because comparisons with `NULL` produce unknown results.

Safer:

```sql
SELECT c.CustomerId, c.Email
FROM dbo.Customers AS c
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.Orders AS o
    WHERE o.CustomerId = c.CustomerId
);
```

This expresses the anti-semi join directly and avoids the `NULL` trap.

### Use CTEs To Name Query Steps

CTEs are useful when a query has logical phases.

Brittle nested version:

```sql
SELECT *
FROM
(
    SELECT
        o.OrderId,
        o.CustomerId,
        o.OrderDate,
        ROW_NUMBER() OVER
        (
            PARTITION BY o.CustomerId
            ORDER BY o.OrderDate DESC, o.OrderId DESC
        ) AS rn
    FROM dbo.Orders AS o
    WHERE o.Status = N'Completed'
) AS x
WHERE x.rn = 1;
```

Clearer CTE version:

```sql
WITH RankedCompletedOrders AS
(
    SELECT
        o.OrderId,
        o.CustomerId,
        o.OrderDate,
        ROW_NUMBER() OVER
        (
            PARTITION BY o.CustomerId
            ORDER BY o.OrderDate DESC, o.OrderId DESC
        ) AS rn
    FROM dbo.Orders AS o
    WHERE o.Status = N'Completed'
)
SELECT
    OrderId,
    CustomerId,
    OrderDate
FROM RankedCompletedOrders
WHERE rn = 1;
```

The CTE names the intermediate result. It does not automatically materialize it. It mainly improves readability and creates a clean place to filter on window function output.

### Use Derived Tables For Local Inline Structure

A derived table is a subquery in the `FROM` clause. It is useful when the transformation is short and local.

Example:

```sql
SELECT
    totals.CustomerId,
    totals.CompletedOrderCount
FROM
(
    SELECT
        CustomerId,
        COUNT(*) AS CompletedOrderCount
    FROM dbo.Orders
    WHERE Status = N'Completed'
    GROUP BY CustomerId
) AS totals
WHERE totals.CompletedOrderCount >= 3;
```

This can be fine. If the query grows into several phases, a CTE may be easier to read.

### Use APPLY For Per-Row Top-N Logic

`CROSS APPLY` and `OUTER APPLY` can make per-row correlated logic clearer, especially for "top one child row per parent" queries.

Example:

```sql
SELECT
    c.CustomerId,
    c.Email,
    lastOrder.OrderId,
    lastOrder.OrderDate
FROM dbo.Customers AS c
OUTER APPLY
(
    SELECT TOP (1)
        o.OrderId,
        o.OrderDate
    FROM dbo.Orders AS o
    WHERE o.CustomerId = c.CustomerId
    ORDER BY o.OrderDate DESC, o.OrderId DESC
) AS lastOrder;
```

`OUTER APPLY` keeps customers with no orders and returns `NULL` for the order columns. `CROSS APPLY` would return only customers with a matching row from the apply input.

This can be clearer than a scalar subquery for each selected column. It also keeps all values from the chosen child row together.

### Use Window Functions To Replace Repeated Aggregate Subqueries

Window functions can replace repeated subqueries when you need row detail plus group-level values.

Correlated aggregate subquery:

```sql
SELECT
    o.OrderId,
    o.CustomerId,
    o.TotalAmount,
    (SELECT SUM(o2.TotalAmount)
     FROM dbo.Orders AS o2
     WHERE o2.CustomerId = o.CustomerId) AS CustomerTotal
FROM dbo.Orders AS o;
```

Window function:

```sql
SELECT
    o.OrderId,
    o.CustomerId,
    o.TotalAmount,
    SUM(o.TotalAmount) OVER
    (
        PARTITION BY o.CustomerId
    ) AS CustomerTotal
FROM dbo.Orders AS o;
```

The window version states that the customer total is calculated over each customer's partition while preserving order rows.

### Use Aggregation Once, Then Join

If you need several aggregate values from the same child table, compute them once and join.

Clear structure:

```sql
WITH OrderSummary AS
(
    SELECT
        CustomerId,
        COUNT(*) AS OrderCount,
        SUM(CASE WHEN Status = N'Completed' THEN 1 ELSE 0 END) AS CompletedOrderCount,
        MAX(OrderDate) AS LastOrderDate
    FROM dbo.Orders
    GROUP BY CustomerId
)
SELECT
    c.CustomerId,
    c.Email,
    COALESCE(os.OrderCount, 0) AS OrderCount,
    COALESCE(os.CompletedOrderCount, 0) AS CompletedOrderCount,
    os.LastOrderDate
FROM dbo.Customers AS c
LEFT JOIN OrderSummary AS os
    ON os.CustomerId = c.CustomerId;
```

This is easier to maintain than three separate scalar subqueries against `Orders`.

### Scalar Subquery Risk

A scalar subquery must return at most one value. If it returns more than one row, SQL Server raises an error.

Risky:

```sql
SELECT
    c.CustomerId,
    (SELECT o.OrderDate
     FROM dbo.Orders AS o
     WHERE o.CustomerId = c.CustomerId) AS SomeOrderDate
FROM dbo.Customers AS c;
```

If a customer has more than one order, this fails.

Better options:

- Use `MAX(OrderDate)` if the rule is latest date.
- Use `TOP (1) ... ORDER BY` if the rule is one chosen row.
- Use `APPLY` if several columns from the chosen row are needed.
- Use a join if all matching child rows should be returned.

### Correlated Subqueries

A correlated subquery references columns from the outer query.

Example:

```sql
SELECT c.CustomerId, c.Email
FROM dbo.Customers AS c
WHERE EXISTS
(
    SELECT 1
    FROM dbo.Orders AS o
    WHERE o.CustomerId = c.CustomerId
);
```

This is a good use of correlation because it expresses existence clearly.

Correlation becomes brittle when:

- It is deeply nested.
- The same child table is queried repeatedly.
- Outer references are hidden by weak aliases.
- The query returns values rather than testing existence.
- The query is hard to reason about under duplicates.

### Aliasing And Column Qualification

Clear aliases prevent dangerous ambiguity.

Risky:

```sql
SELECT CustomerId
FROM dbo.Customers
WHERE CustomerId IN
(
    SELECT CustomerId
    FROM dbo.Orders
);
```

Better:

```sql
SELECT c.CustomerId
FROM dbo.Customers AS c
WHERE EXISTS
(
    SELECT 1
    FROM dbo.Orders AS o
    WHERE o.CustomerId = c.CustomerId
);
```

The second version makes each column's source obvious. This matters because SQL Server can resolve unqualified columns in subqueries in ways that surprise developers when a column name exists in an outer scope.

### When To Use Temporary Tables

Use a temp table when a query needs a real phase break.

Example:

```sql
CREATE TABLE #EligibleCustomers
(
    CustomerId BIGINT NOT NULL PRIMARY KEY
);

INSERT INTO #EligibleCustomers (CustomerId)
SELECT c.CustomerId
FROM dbo.Customers AS c
WHERE c.IsActive = 1;

SELECT
    ec.CustomerId,
    COUNT(*) AS OrderCount
FROM #EligibleCustomers AS ec
JOIN dbo.Orders AS o
    ON o.CustomerId = ec.CustomerId
GROUP BY ec.CustomerId;
```

Temp tables help when:

- The intermediate result is reused by multiple statements.
- You need indexes or statistics on staged rows.
- You need to debug or inspect a phase.
- Breaking the query improves estimates or plan quality.
- The CTE or derived table is too large and repeated.

### Refactoring Process

A safe refactoring process:

- Write down the business question.
- Identify the expected output grain, such as one row per customer.
- Identify whether each child relationship is one-to-one or one-to-many.
- Replace existence checks with `EXISTS` or `NOT EXISTS`.
- Replace repeated scalar aggregates with a grouped CTE or window function.
- Replace "choose one child row" logic with `ROW_NUMBER` or `APPLY`.
- Add deterministic `ORDER BY` for top-one logic.
- Test with duplicates, missing children, and `NULL` values.
- Compare row counts before and after.
- Review actual execution plans for important queries.

### Common Mistakes

Common mistakes include:

- Replacing `EXISTS` with a join and accidentally duplicating rows.
- Using `DISTINCT` to hide a bad join.
- Using `NOT IN` when the subquery can return `NULL`.
- Writing scalar subqueries that can return multiple rows.
- Assuming a CTE is materialized like a temp table.
- Forgetting deterministic ordering in `TOP (1)` or `ROW_NUMBER`.
- Repeating the same correlated subquery several times.
- Not checking output grain after refactoring.
- Optimizing for style while changing business semantics.

### Best Practices

Best practices:

- Keep subqueries when they express intent clearly.
- Use `EXISTS` and `NOT EXISTS` for existence checks.
- Use joins when the result needs columns from both sides.
- Use CTEs to name logical query phases.
- Use window functions for row detail plus group-level calculations.
- Use `APPLY` for clear per-row top-N child selection.
- Use temp tables when you need reuse, indexes, statistics, or debugging visibility.
- Always test refactors with duplicate rows and `NULL` values.
- Compare row counts and key sets before and after.
- Prefer clarity first, then tune based on actual execution plans.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is a subquery?

<!-- question:start:replacing-brittle-subqueries-with-clearer-query-structure-beginner-q01 -->
<!-- question-id:replacing-brittle-subqueries-with-clearer-query-structure-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A subquery is a query nested inside another SQL statement. It can appear in places such as `WHERE`, `HAVING`, `SELECT`, or `FROM`, depending on what the query needs to express. Subqueries can return scalar values, lists, or existence tests.

Subqueries are not inherently bad, but they can become hard to maintain when deeply nested, repeated, poorly aliased, or used for logic that is clearer as a join, CTE, window function, or `EXISTS` predicate.

##### Key Points to Mention

- A nested query inside another statement.
- Can be used for scalar values, lists, or existence checks.
- Can be correlated with the outer query.
- Useful when clear and scoped.
- Brittle when deeply nested or ambiguous.

<!-- question:end:replacing-brittle-subqueries-with-clearer-query-structure-beginner-q01 -->

#### When should you replace a subquery with a join?

<!-- question:start:replacing-brittle-subqueries-with-clearer-query-structure-beginner-q02 -->
<!-- question-id:replacing-brittle-subqueries-with-clearer-query-structure-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

Replace a subquery with a join when the query needs columns from both tables or when the relationship is clearer as a table-to-table match. Joins make relationships explicit and often make the output shape easier to review.

However, a join can duplicate rows when the joined table has multiple matches. If the goal is only to test whether a row exists, `EXISTS` may be better than a join.

##### Key Points to Mention

- Joins are good when columns from both tables are needed.
- Joins make relationships explicit.
- Joins can multiply rows.
- `EXISTS` is often better for pure existence checks.
- Output grain must be verified.

<!-- question:end:replacing-brittle-subqueries-with-clearer-query-structure-beginner-q02 -->

#### Why is EXISTS useful?

<!-- question:start:replacing-brittle-subqueries-with-clearer-query-structure-beginner-q03 -->
<!-- question-id:replacing-brittle-subqueries-with-clearer-query-structure-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

`EXISTS` is useful when the business question is whether at least one matching row exists. It expresses a semi-join and avoids duplicating outer rows when the child table has multiple matches.

For example, `WHERE EXISTS (...)` is a clear way to find customers that have at least one order.

##### Key Points to Mention

- Tests for matching rows.
- Returns true or false.
- Avoids duplicate outer rows.
- Good for parent-child existence checks.
- Often clearer than `IN` or join plus `DISTINCT`.

<!-- question:end:replacing-brittle-subqueries-with-clearer-query-structure-beginner-q03 -->

#### Why are CTEs useful for query readability?

<!-- question:start:replacing-brittle-subqueries-with-clearer-query-structure-beginner-q04 -->
<!-- question-id:replacing-brittle-subqueries-with-clearer-query-structure-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

CTEs let developers name intermediate query steps. This makes complex logic easier to read, especially when the query ranks rows, filters window function results, aggregates child data, or has several logical phases.

A CTE improves structure, but it does not automatically store results or improve performance.

##### Key Points to Mention

- CTEs name intermediate results.
- Useful for multi-step logic.
- Helpful with window functions.
- Scope is one following statement.
- Not automatically materialized.

<!-- question:end:replacing-brittle-subqueries-with-clearer-query-structure-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### Why can NOT IN be dangerous with subqueries?

<!-- question:start:replacing-brittle-subqueries-with-clearer-query-structure-intermediate-q01 -->
<!-- question-id:replacing-brittle-subqueries-with-clearer-query-structure-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

`NOT IN` can produce surprising results when the subquery returns `NULL`. Because SQL uses three-valued logic, comparison against `NULL` can make the predicate evaluate to unknown, and the query may return no rows.

`NOT EXISTS` is usually safer for anti-existence checks because it directly tests whether no matching row exists.

##### Key Points to Mention

- `NULL` affects `NOT IN`.
- SQL predicates can evaluate to unknown.
- `NOT EXISTS` avoids the common nullable-subquery trap.
- Anti-join logic should be tested with `NULL`.
- Nullable foreign keys require extra care.

<!-- question:end:replacing-brittle-subqueries-with-clearer-query-structure-intermediate-q01 -->

#### How do you replace repeated scalar aggregate subqueries?

<!-- question:start:replacing-brittle-subqueries-with-clearer-query-structure-intermediate-q02 -->
<!-- question-id:replacing-brittle-subqueries-with-clearer-query-structure-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

If the query repeats aggregate subqueries against the same child table, compute the aggregate once in a grouped CTE or derived table, then join it to the parent table. If row detail must be preserved and the aggregate is over the same row set, a window aggregate may be clearer.

This reduces duplicated logic and makes the output grain easier to inspect.

##### Key Points to Mention

- Aggregate once by the business key.
- Join the aggregate result to the parent.
- Use window aggregates when row detail is needed.
- Avoid repeated correlated subqueries.
- Confirm row counts after refactoring.

<!-- question:end:replacing-brittle-subqueries-with-clearer-query-structure-intermediate-q02 -->

#### When is APPLY clearer than a scalar subquery?

<!-- question:start:replacing-brittle-subqueries-with-clearer-query-structure-intermediate-q03 -->
<!-- question-id:replacing-brittle-subqueries-with-clearer-query-structure-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

`APPLY` is clearer when each outer row needs a related row set or top child row, especially when multiple columns from that chosen child row are needed. `OUTER APPLY` can return outer rows even when the apply input returns no rows, while `CROSS APPLY` only returns rows with a match.

For example, selecting the latest order's ID, date, and total for each customer is often clearer with `OUTER APPLY` than with three separate scalar subqueries.

##### Key Points to Mention

- Good for per-row related row sets.
- Useful for top-one or top-N child rows.
- Keeps columns from the chosen child row together.
- `OUTER APPLY` preserves unmatched outer rows.
- `CROSS APPLY` requires a match.

<!-- question:end:replacing-brittle-subqueries-with-clearer-query-structure-intermediate-q03 -->

#### Why is output grain important when refactoring subqueries?

<!-- question:start:replacing-brittle-subqueries-with-clearer-query-structure-intermediate-q04 -->
<!-- question-id:replacing-brittle-subqueries-with-clearer-query-structure-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Output grain defines what one result row represents, such as one row per customer or one row per order. Refactoring a subquery to a join can accidentally change the grain by multiplying rows when the joined table has multiple matches.

Before and after refactoring, compare row counts and key sets, and make sure the rewritten query still returns the intended grain.

##### Key Points to Mention

- Grain is the meaning of one output row.
- Joins can multiply rows.
- `DISTINCT` can hide bugs.
- Compare row counts before and after.
- Match the rewrite to the business question.

<!-- question:end:replacing-brittle-subqueries-with-clearer-query-structure-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you refactor a query with several correlated subqueries in the SELECT list?

<!-- question:start:replacing-brittle-subqueries-with-clearer-query-structure-advanced-q01 -->
<!-- question-id:replacing-brittle-subqueries-with-clearer-query-structure-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

First identify the parent grain and each correlated subquery's relationship to that grain. If several subqueries aggregate the same child table, create one grouped CTE or derived table that calculates all needed aggregates, then `LEFT JOIN` it to the parent. If the subqueries select columns from one chosen child row, use `ROW_NUMBER` in a CTE or use `OUTER APPLY TOP (1)` with deterministic ordering.

Then compare row counts, key sets, and important values against the original query.

##### Key Points to Mention

- Identify parent grain first.
- Group child aggregates once.
- Use `LEFT JOIN` to preserve parents with no children.
- Use `ROW_NUMBER` or `APPLY` for chosen child rows.
- Test duplicates, no-match rows, and ties.

<!-- question:end:replacing-brittle-subqueries-with-clearer-query-structure-advanced-q01 -->

#### How do you decide between a CTE and a temp table during refactoring?

<!-- question:start:replacing-brittle-subqueries-with-clearer-query-structure-advanced-q02 -->
<!-- question-id:replacing-brittle-subqueries-with-clearer-query-structure-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Use a CTE when the intermediate result is used once and naming the step improves readability. Use a temp table when the intermediate result is reused across multiple statements, needs indexes or statistics, must be inspected during debugging, or creates a useful phase break for the optimizer.

The choice should be based on scope, reuse, row count, indexing needs, and actual execution plans.

##### Key Points to Mention

- CTEs improve single-statement readability.
- CTEs are usually not materialized.
- Temp tables can be indexed.
- Temp tables can be reused and inspected.
- Execution plans and row counts drive the decision.

<!-- question:end:replacing-brittle-subqueries-with-clearer-query-structure-advanced-q02 -->

#### What review checks help ensure a query refactor preserves behavior?

<!-- question:start:replacing-brittle-subqueries-with-clearer-query-structure-advanced-q03 -->
<!-- question-id:replacing-brittle-subqueries-with-clearer-query-structure-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Check the expected output grain, row counts, key sets, duplicate behavior, `NULL` behavior, tie-breaking rules, and filters applied before or after aggregation. Compare representative results between the old and new query. Use actual execution plans for important queries, but do not accept a faster query that changes the business result.

Also review aliases and predicates for accidental outer references or join changes.

##### Key Points to Mention

- Confirm output grain.
- Compare row counts and key sets.
- Test duplicates and `NULL`.
- Verify tie-breaking.
- Check filter placement.
- Review actual execution plans after correctness.

<!-- question:end:replacing-brittle-subqueries-with-clearer-query-structure-advanced-q03 -->

#### When is a subquery still the best structure?

<!-- question:start:replacing-brittle-subqueries-with-clearer-query-structure-advanced-q04 -->
<!-- question-id:replacing-brittle-subqueries-with-clearer-query-structure-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

A subquery is still a good structure when it expresses the business rule directly, stays small, has clear aliases, and does not hide cardinality assumptions. Examples include simple `EXISTS` predicates, small `IN` lists from another table, scalar aggregate subqueries that are guaranteed to return one value, and isolated filters that are easier to read nested than joined.

Refactoring should improve clarity or correctness, not just replace one syntax with another.

##### Key Points to Mention

- Subqueries are valid tools.
- Clear `EXISTS` predicates are often ideal.
- Small scoped subqueries can be readable.
- Do not refactor for style alone.
- Correctness and maintainability drive the choice.

<!-- question:end:replacing-brittle-subqueries-with-clearer-query-structure-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
