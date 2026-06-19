---
id: where-vs-having-and-filtering-before-vs-after-aggregation
topic: SQL practical interview comparisons and SQL Server-specific features
subtopic: WHERE vs HAVING and filtering before vs after aggregation
category: SQL
---

## Overview

`WHERE` and `HAVING` both filter SQL query results, but they filter at different stages. `WHERE` filters rows before grouping and aggregation. `HAVING` filters groups after grouping and aggregate calculations.

This distinction is central to writing correct SQL. If you filter too late, the query may do unnecessary work or produce the wrong aggregate. If you filter too early, you may exclude rows that should contribute to a group. If you put an aggregate condition in `WHERE`, the query is invalid because aggregates are not available yet.

This topic matters in interviews because it tests whether a candidate understands logical query processing, not just syntax. Strong answers explain row-level filters, group-level filters, aggregate expressions, performance implications, and common mistakes with `GROUP BY`, `COUNT`, joins, and nulls.

The practical rule is simple: use `WHERE` for conditions about individual rows, and use `HAVING` for conditions about grouped results.

## Core Concepts

### WHERE Filters Rows

`WHERE` specifies which source rows qualify before aggregation.

```sql
SELECT
    CustomerId,
    COUNT(*) AS CompletedOrderCount
FROM dbo.Orders
WHERE Status = N'Completed'
GROUP BY CustomerId;
```

This query first keeps only completed orders. Then it groups those completed rows by customer.

Use `WHERE` for:

- Status filters.
- Date ranges.
- Tenant filters.
- Active/inactive flags.
- Exact matches.
- Search predicates.
- Join-related row restrictions.

Example:

```sql
WHERE OrderDate >= '20260101'
  AND OrderDate <  '20260201'
  AND Status = N'Completed'
```

These are row-level conditions.

### HAVING Filters Groups

`HAVING` specifies which groups qualify after aggregation.

```sql
SELECT
    CustomerId,
    COUNT(*) AS CompletedOrderCount
FROM dbo.Orders
WHERE Status = N'Completed'
GROUP BY CustomerId
HAVING COUNT(*) >= 5;
```

This query returns customers with at least five completed orders.

Use `HAVING` for:

- `COUNT(*) >= 5`
- `SUM(TotalAmount) > 1000`
- `AVG(DurationMs) < 200`
- `MAX(OrderDate) >= @Cutoff`
- Conditions involving aggregate expressions.

The group must be formed before these values exist.

### Logical Query Processing Order

SQL is written in one order but conceptually processed in another order.

Common mental model:

- `FROM` and joins identify source rows.
- `WHERE` filters rows.
- `GROUP BY` forms groups.
- Aggregates are calculated for each group.
- `HAVING` filters groups.
- `SELECT` returns expressions.
- `ORDER BY` sorts the final result.

This explains why aggregate expressions belong in `HAVING`, not `WHERE`.

Bad:

```sql
SELECT CustomerId, COUNT(*) AS OrderCount
FROM dbo.Orders
WHERE COUNT(*) >= 5
GROUP BY CustomerId;
```

Correct:

```sql
SELECT CustomerId, COUNT(*) AS OrderCount
FROM dbo.Orders
GROUP BY CustomerId
HAVING COUNT(*) >= 5;
```

### Filtering Before Aggregation

Filtering before aggregation changes which rows contribute to each group.

Example: completed revenue per customer.

```sql
SELECT
    CustomerId,
    SUM(TotalAmount) AS CompletedRevenue
FROM dbo.Orders
WHERE Status = N'Completed'
GROUP BY CustomerId;
```

Only completed orders contribute to the revenue.

If you accidentally move the status filter into `HAVING` incorrectly, you either get an invalid query or a different business question.

Correct row filtering usually improves both correctness and performance because fewer rows need to be grouped.

### Filtering After Aggregation

Filtering after aggregation keeps or removes whole groups.

Example: customers whose completed revenue exceeds 1000.

```sql
SELECT
    CustomerId,
    SUM(TotalAmount) AS CompletedRevenue
FROM dbo.Orders
WHERE Status = N'Completed'
GROUP BY CustomerId
HAVING SUM(TotalAmount) > 1000;
```

The query still uses `WHERE` to define which rows count as completed revenue. Then it uses `HAVING` to keep only groups whose aggregate result exceeds the threshold.

This pattern is common:

```sql
WHERE row_condition
GROUP BY grouping_columns
HAVING aggregate_condition
```

### Non-Aggregate Conditions in HAVING

Sometimes SQL Server allows a condition in `HAVING` if the column is part of the grouping key.

```sql
SELECT
    Status,
    COUNT(*) AS OrderCount
FROM dbo.Orders
GROUP BY Status
HAVING Status = N'Completed';
```

This works, but it is usually worse than:

```sql
SELECT
    Status,
    COUNT(*) AS OrderCount
FROM dbo.Orders
WHERE Status = N'Completed'
GROUP BY Status;
```

The second query filters rows before grouping. It is clearer and usually gives the optimizer a better chance to reduce work early.

Use `HAVING` for group-level conditions, not as a substitute for `WHERE`.

### Aggregate Conditions in WHERE Are Invalid

Aggregate functions are not available in `WHERE` because `WHERE` happens before grouping.

Invalid:

```sql
SELECT
    CustomerId,
    SUM(TotalAmount) AS Revenue
FROM dbo.Orders
WHERE SUM(TotalAmount) > 1000
GROUP BY CustomerId;
```

Valid:

```sql
SELECT
    CustomerId,
    SUM(TotalAmount) AS Revenue
FROM dbo.Orders
GROUP BY CustomerId
HAVING SUM(TotalAmount) > 1000;
```

If you need to filter by an aggregate in an outer query, use a derived table or common table expression:

```sql
WITH CustomerRevenue AS
(
    SELECT
        CustomerId,
        SUM(TotalAmount) AS Revenue
    FROM dbo.Orders
    GROUP BY CustomerId
)
SELECT *
FROM CustomerRevenue
WHERE Revenue > 1000;
```

Here `Revenue` is a real column of the CTE result, so the outer `WHERE` can filter it.

### WHERE, HAVING, and Aliases

In SQL Server, a `SELECT` alias is not available to `WHERE` or `HAVING` at the same query level.

Invalid:

```sql
SELECT
    CustomerId,
    SUM(TotalAmount) AS Revenue
FROM dbo.Orders
GROUP BY CustomerId
HAVING Revenue > 1000;
```

Use the aggregate expression:

```sql
HAVING SUM(TotalAmount) > 1000
```

Or use a CTE:

```sql
WITH CustomerRevenue AS
(
    SELECT
        CustomerId,
        SUM(TotalAmount) AS Revenue
    FROM dbo.Orders
    GROUP BY CustomerId
)
SELECT *
FROM CustomerRevenue
WHERE Revenue > 1000;
```

CTEs and derived tables are useful when you want to name intermediate aggregate results and filter them more readably.

### HAVING Without GROUP BY

`HAVING` is usually used with `GROUP BY`, but SQL can apply it to an implicit single group when no `GROUP BY` exists.

```sql
SELECT COUNT(*) AS OrderCount
FROM dbo.Orders
HAVING COUNT(*) > 0;
```

This returns one row only if the whole table has at least one row.

This is uncommon in application queries but useful to understand. `HAVING` filters aggregate groups; without `GROUP BY`, the entire result is one group.

### Conditional Aggregation

Sometimes the right answer is not moving conditions between `WHERE` and `HAVING`, but using conditional aggregation.

Example: find customers with at least five completed orders and at least one cancelled order.

```sql
SELECT
    CustomerId,
    SUM(CASE WHEN Status = N'Completed' THEN 1 ELSE 0 END) AS CompletedOrders,
    SUM(CASE WHEN Status = N'Cancelled' THEN 1 ELSE 0 END) AS CancelledOrders
FROM dbo.Orders
GROUP BY CustomerId
HAVING SUM(CASE WHEN Status = N'Completed' THEN 1 ELSE 0 END) >= 5
   AND SUM(CASE WHEN Status = N'Cancelled' THEN 1 ELSE 0 END) >= 1;
```

If you put `WHERE Status = N'Completed'`, cancelled orders would be removed before grouping and the cancelled-order count would always be zero.

This is a subtle but common reporting issue.

### WHERE vs HAVING With Joins

With joins, decide whether a filter should remove source rows before grouping or remove groups after aggregation.

Example: customers with at least three completed orders:

```sql
SELECT
    c.CustomerId,
    COUNT(*) AS CompletedOrderCount
FROM dbo.Customers AS c
JOIN dbo.Orders AS o
    ON o.CustomerId = c.CustomerId
WHERE o.Status = N'Completed'
GROUP BY c.CustomerId
HAVING COUNT(*) >= 3;
```

The `WHERE` clause says only completed orders count. The `HAVING` clause says only customers with three or more such orders should be returned.

For `LEFT JOIN`, be careful. A right-side filter in `WHERE` can remove unmatched left rows:

```sql
SELECT
    c.CustomerId,
    COUNT(o.OrderId) AS CompletedOrderCount
FROM dbo.Customers AS c
LEFT JOIN dbo.Orders AS o
    ON o.CustomerId = c.CustomerId
   AND o.Status = N'Completed'
GROUP BY c.CustomerId
HAVING COUNT(o.OrderId) = 0;
```

This finds customers with zero completed orders while preserving customers with no orders.

### WHERE, HAVING, and NULL

`WHERE` keeps rows where the predicate is `TRUE`. Rows where the predicate is `FALSE` or `UNKNOWN` are removed. This matters for nullable columns.

```sql
WHERE Status <> N'Cancelled'
```

This does not keep rows where `Status IS NULL` because the comparison is `UNKNOWN`.

If missing status should count as not cancelled:

```sql
WHERE Status <> N'Cancelled'
   OR Status IS NULL
```

Aggregates also interact with nulls:

```sql
HAVING COUNT(ShippedAtUtc) = 0
```

This keeps groups where no row has a non-null `ShippedAtUtc`. It is different from `COUNT(*) = 0`, which cannot happen for a group produced from existing rows unless using an outer join pattern.

### Performance Implications

`WHERE` usually reduces the input rows before grouping. This can reduce CPU, memory, spills, and sorting or hashing work.

Better:

```sql
SELECT
    CustomerId,
    SUM(TotalAmount) AS Revenue
FROM dbo.Orders
WHERE Status = N'Completed'
GROUP BY CustomerId;
```

Worse style:

```sql
SELECT
    CustomerId,
    SUM(TotalAmount) AS Revenue
FROM dbo.Orders
GROUP BY CustomerId, Status
HAVING Status = N'Completed';
```

The second query groups by an unnecessary column and filters later. The optimizer may simplify some cases, but code should communicate intent clearly and avoid unnecessary work.

Indexes that support `WHERE` filters and grouping keys often help:

```sql
CREATE INDEX IX_Orders_Status_CustomerId
ON dbo.Orders(Status, CustomerId)
INCLUDE (TotalAmount);
```

### Readability Pattern

A clean aggregate query often reads like this:

```sql
SELECT
    GroupingColumn,
    AggregateExpression AS MetricName
FROM SourceTables
WHERE RowLevelCondition
GROUP BY GroupingColumn
HAVING AggregateCondition
ORDER BY MetricName DESC;
```

Example:

```sql
SELECT
    CustomerId,
    COUNT(*) AS CompletedOrderCount,
    SUM(TotalAmount) AS CompletedRevenue
FROM dbo.Orders
WHERE Status = N'Completed'
  AND OrderDate >= '20260101'
  AND OrderDate <  '20270101'
GROUP BY CustomerId
HAVING COUNT(*) >= 5
ORDER BY CompletedRevenue DESC;
```

Each clause has one job.

### Common Mistakes

Common mistakes include:

- Putting aggregate functions in `WHERE`.
- Using `HAVING` for simple row filters.
- Filtering completed rows after grouping when only completed rows should contribute.
- Filtering too early when multiple statuses are needed for conditional aggregates.
- Selecting columns that are not grouped or aggregated.
- Assuming a `SELECT` alias is available in `HAVING`.
- Forgetting that `WHERE` runs before `GROUP BY`.
- Filtering a `LEFT JOIN` in `WHERE` and losing unmatched rows.
- Using `COUNT(*)` when `COUNT(column)` was intended, or the reverse.
- Ignoring null behavior in filters and aggregates.

### Best Practices

Best practices include:

- Use `WHERE` for row-level predicates.
- Use `HAVING` for aggregate predicates.
- Filter early when it does not change the business meaning.
- Keep conditional aggregation when multiple row categories must contribute.
- Use CTEs or derived tables for readability when filtering aggregate aliases.
- Check join grain before aggregating.
- Be explicit with null-inclusive filters.
- Add indexes for common `WHERE` filters and grouping keys.
- Test with empty groups, null values, and duplicate joins.
- Use clear aggregate aliases in the final `SELECT`.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the difference between `WHERE` and `HAVING`?

<!-- question:start:where-vs-having-and-filtering-before-vs-after-aggregation-beginner-q01 -->
<!-- question-id:where-vs-having-and-filtering-before-vs-after-aggregation-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

`WHERE` filters rows before grouping and aggregation. `HAVING` filters groups after aggregation. Use `WHERE` for row-level conditions such as status, date range, or active flag. Use `HAVING` for aggregate conditions such as `COUNT(*) > 5` or `SUM(TotalAmount) > 1000`.

The difference matters because filtering before aggregation changes which rows contribute to the aggregate, while filtering after aggregation keeps or removes whole groups.

##### Key Points to Mention

- `WHERE` filters rows.
- `HAVING` filters groups.
- `WHERE` happens before `GROUP BY`.
- `HAVING` happens after aggregate calculation.
- Aggregate conditions belong in `HAVING`.

<!-- question:end:where-vs-having-and-filtering-before-vs-after-aggregation-beginner-q01 -->

#### Can you use aggregate functions in `WHERE`?

<!-- question:start:where-vs-having-and-filtering-before-vs-after-aggregation-beginner-q02 -->
<!-- question-id:where-vs-having-and-filtering-before-vs-after-aggregation-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

No, not at the same query level. `WHERE` is evaluated before grouping and aggregation, so aggregate values such as `COUNT(*)` or `SUM(TotalAmount)` do not exist yet. Use `HAVING` for aggregate filters.

If you want to filter an aggregate alias, put the aggregate query in a CTE or derived table, then use `WHERE` in the outer query.

##### Key Points to Mention

- Aggregates are not available to `WHERE`.
- Use `HAVING COUNT(*) > ...`.
- Logical processing order explains the rule.
- CTEs and derived tables can expose aggregate results to an outer `WHERE`.

<!-- question:end:where-vs-having-and-filtering-before-vs-after-aggregation-beginner-q02 -->

#### What kind of condition belongs in `WHERE`?

<!-- question:start:where-vs-having-and-filtering-before-vs-after-aggregation-beginner-q03 -->
<!-- question-id:where-vs-having-and-filtering-before-vs-after-aggregation-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

Row-level conditions belong in `WHERE`. Examples include filtering by `Status = 'Completed'`, a date range, `CustomerId = @CustomerId`, `IsActive = 1`, or `DeletedAtUtc IS NULL`.

These conditions decide which individual rows enter the grouping and aggregation step. Filtering them early is usually clearer and more efficient.

##### Key Points to Mention

- Row-level predicates belong in `WHERE`.
- Date ranges belong in `WHERE`.
- Status and tenant filters usually belong in `WHERE`.
- `WHERE` affects which rows contribute to aggregates.
- Filtering early often improves performance.

<!-- question:end:where-vs-having-and-filtering-before-vs-after-aggregation-beginner-q03 -->

#### What kind of condition belongs in `HAVING`?

<!-- question:start:where-vs-having-and-filtering-before-vs-after-aggregation-beginner-q04 -->
<!-- question-id:where-vs-having-and-filtering-before-vs-after-aggregation-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Group-level or aggregate conditions belong in `HAVING`. Examples include `COUNT(*) >= 5`, `SUM(TotalAmount) > 1000`, `AVG(DurationMs) < 200`, or `MAX(OrderDate) >= @Cutoff`.

These values are only known after rows have been grouped and aggregate functions have been calculated.

##### Key Points to Mention

- Aggregate predicates belong in `HAVING`.
- `HAVING` filters whole groups.
- Use it after `GROUP BY`.
- It can also work with an implicit single group.
- Do not use it as a replacement for simple row filters.

<!-- question:end:where-vs-having-and-filtering-before-vs-after-aggregation-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why is using `HAVING Status = 'Completed'` usually worse than using `WHERE Status = 'Completed'`?

<!-- question:start:where-vs-having-and-filtering-before-vs-after-aggregation-intermediate-q01 -->
<!-- question-id:where-vs-having-and-filtering-before-vs-after-aggregation-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

`Status = 'Completed'` is a row-level condition. Putting it in `WHERE` removes non-completed rows before grouping, making the query clearer and usually reducing the amount of work. Putting it in `HAVING` means the query groups first and filters groups later, or requires `Status` to be part of the grouping key.

The optimizer may simplify some cases, but code should express intent. Use `WHERE` for row filters and reserve `HAVING` for aggregate filters.

##### Key Points to Mention

- Status is a row-level condition.
- `WHERE` filters before grouping.
- `HAVING` filters after grouping.
- Early filtering can reduce work.
- Clear intent matters.

<!-- question:end:where-vs-having-and-filtering-before-vs-after-aggregation-intermediate-q01 -->

#### How would you find customers with at least five completed orders?

<!-- question:start:where-vs-having-and-filtering-before-vs-after-aggregation-intermediate-q02 -->
<!-- question-id:where-vs-having-and-filtering-before-vs-after-aggregation-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Filter completed orders in `WHERE`, group by customer, and then use `HAVING` to keep customers whose completed order count is at least five.

```sql
SELECT CustomerId, COUNT(*) AS CompletedOrderCount
FROM dbo.Orders
WHERE Status = N'Completed'
GROUP BY CustomerId
HAVING COUNT(*) >= 5;
```

This query says only completed orders contribute to the count, and only customers with enough completed orders are returned.

##### Key Points to Mention

- `WHERE` filters completed rows.
- `GROUP BY CustomerId` creates customer groups.
- `COUNT(*)` counts completed rows per customer.
- `HAVING COUNT(*) >= 5` filters groups.
- This is the standard pattern.

<!-- question:end:where-vs-having-and-filtering-before-vs-after-aggregation-intermediate-q02 -->

#### When can moving a filter from `HAVING` to `WHERE` change the result?

<!-- question:start:where-vs-having-and-filtering-before-vs-after-aggregation-intermediate-q03 -->
<!-- question-id:where-vs-having-and-filtering-before-vs-after-aggregation-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Moving a filter changes the result when the filter controls which rows contribute to the aggregate. For example, if a report needs both completed and cancelled order counts per customer, using `WHERE Status = 'Completed'` removes cancelled rows before the query can count them.

In that case, conditional aggregation is better. Keep all needed rows, then use `SUM(CASE WHEN Status = ... THEN 1 ELSE 0 END)` and filter the aggregate results in `HAVING`.

##### Key Points to Mention

- `WHERE` changes aggregate input rows.
- `HAVING` filters completed groups.
- Moving filters can change business meaning.
- Conditional aggregation is useful for multiple categories.
- Do not filter away rows needed by another metric.

<!-- question:end:where-vs-having-and-filtering-before-vs-after-aggregation-intermediate-q03 -->

#### Can `HAVING` be used without `GROUP BY`?

<!-- question:start:where-vs-having-and-filtering-before-vs-after-aggregation-intermediate-q04 -->
<!-- question-id:where-vs-having-and-filtering-before-vs-after-aggregation-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Yes. Without an explicit `GROUP BY`, the query result can be treated as one implicit aggregate group. For example, `SELECT COUNT(*) FROM Orders HAVING COUNT(*) > 0` returns a row only if the aggregate condition is true.

This is less common than using `HAVING` with `GROUP BY`, but it reinforces the idea that `HAVING` filters aggregate groups.

##### Key Points to Mention

- `HAVING` can work with an implicit single group.
- It is still an aggregate/group filter.
- It is uncommon in everyday application queries.
- It can be useful for aggregate existence checks.

<!-- question:end:where-vs-having-and-filtering-before-vs-after-aggregation-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How do `WHERE` and `HAVING` interact with `LEFT JOIN`?

<!-- question:start:where-vs-having-and-filtering-before-vs-after-aggregation-advanced-q01 -->
<!-- question-id:where-vs-having-and-filtering-before-vs-after-aggregation-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

With `LEFT JOIN`, a right-side filter in `WHERE` can remove unmatched left-side rows because right-side columns are `NULL` for unmatched rows. If the intent is to preserve all left-side rows and only count certain right-side matches, put the right-side condition in the `ON` clause.

Then group by the left-side key and use `HAVING` for aggregate conditions. For example, to find customers with zero completed orders, left join completed orders in the `ON` clause and use `HAVING COUNT(o.OrderId) = 0`.

##### Key Points to Mention

- `WHERE` after a `LEFT JOIN` can remove unmatched rows.
- Right-side match filters often belong in `ON`.
- Use `COUNT(right_key)` to count matches.
- Use `HAVING` to filter groups after the left join.
- Check nullable columns carefully.

<!-- question:end:where-vs-having-and-filtering-before-vs-after-aggregation-advanced-q01 -->

#### How would you improve a query that uses `HAVING` for all filters?

<!-- question:start:where-vs-having-and-filtering-before-vs-after-aggregation-advanced-q02 -->
<!-- question-id:where-vs-having-and-filtering-before-vs-after-aggregation-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

I would separate row-level filters from group-level filters. Status, date range, tenant, and active flags usually move to `WHERE`. Aggregate thresholds such as `COUNT`, `SUM`, and `AVG` stay in `HAVING`.

Then I would check the execution plan and indexes. Moving true row filters to `WHERE` often reduces rows before aggregation and makes the query easier to optimize. I would also confirm that moving filters does not remove rows needed for conditional aggregates.

##### Key Points to Mention

- Classify each predicate by row-level or group-level meaning.
- Move row filters to `WHERE`.
- Keep aggregate filters in `HAVING`.
- Preserve conditional aggregation semantics.
- Check execution plan and indexes after rewriting.

<!-- question:end:where-vs-having-and-filtering-before-vs-after-aggregation-advanced-q02 -->

#### How would you filter on an aggregate alias cleanly?

<!-- question:start:where-vs-having-and-filtering-before-vs-after-aggregation-advanced-q03 -->
<!-- question-id:where-vs-having-and-filtering-before-vs-after-aggregation-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

In SQL Server, a `SELECT` alias is not available to `HAVING` at the same query level. You can repeat the aggregate expression in `HAVING`, or use a CTE or derived table and filter the alias in an outer `WHERE`.

For readability, I often use a CTE when the aggregate expression is complex or reused. The inner query calculates `Revenue`; the outer query filters `WHERE Revenue > 1000`.

##### Key Points to Mention

- Same-level `SELECT` aliases are not available to `HAVING`.
- Repeating the aggregate expression is valid.
- CTEs and derived tables improve readability.
- Outer `WHERE` can filter named aggregate columns.
- Avoid relying on alias behavior from another database dialect.

<!-- question:end:where-vs-having-and-filtering-before-vs-after-aggregation-advanced-q03 -->

#### How would you reason about performance for `WHERE` vs `HAVING`?

<!-- question:start:where-vs-having-and-filtering-before-vs-after-aggregation-advanced-q04 -->
<!-- question-id:where-vs-having-and-filtering-before-vs-after-aggregation-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

`WHERE` can reduce the number of rows before grouping, which often reduces CPU, memory, sorting, hashing, and spill risk. It can also use indexes on filter columns. `HAVING` filters after grouping, so it is necessary for aggregate conditions but should not be used as a dumping ground for row filters.

I would inspect the execution plan, row counts, memory grants, spills, and indexes. The right rewrite depends on correctness first; performance improvements are useful only if the filtered rows and aggregate meaning stay correct.

##### Key Points to Mention

- `WHERE` can reduce input rows early.
- `HAVING` is required for aggregate filters.
- Indexes often support `WHERE` predicates.
- Check actual execution plans.
- Correct business meaning comes before tuning.
- Conditional aggregation can require keeping rows until grouping.

<!-- question:end:where-vs-having-and-filtering-before-vs-after-aggregation-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
