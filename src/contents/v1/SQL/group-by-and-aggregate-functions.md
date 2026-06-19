---
id: group-by-and-aggregate-functions
topic: Core querying and data retrieval
subtopic: GROUP BY and aggregate functions
category: SQL
---

## Overview

`GROUP BY` and aggregate functions are used to summarize rows in SQL. Instead of returning every detail row, a grouped query returns one row per group, such as total sales by customer, order count by status, average response time by day, or maximum invoice amount by region.

Aggregate functions calculate a single value from a set of rows. Common examples include `COUNT`, `SUM`, `AVG`, `MIN`, and `MAX`. `GROUP BY` defines which rows belong together before those aggregate calculations are returned.

This topic matters because many real applications need reporting, dashboards, billing summaries, analytics, validation queries, and operational metrics. It is also a common interview area because candidates often confuse `WHERE` and `HAVING`, select non-grouped columns incorrectly, misunderstand `COUNT(*)` versus `COUNT(column)`, or forget how `NULL` affects aggregates.

The practical goal is to write grouped queries that are correct, readable, and efficient, while understanding how filtering, null handling, joins, indexing, and result shape affect the answer.

## Core Concepts

### Basic Aggregate Query

An aggregate function summarizes multiple rows into one value.

```sql
SELECT COUNT(*) AS OrderCount
FROM dbo.Orders;
```

This returns one row with the total number of rows in `Orders`.

Other common aggregates:

```sql
SELECT
    COUNT(*) AS OrderCount,
    SUM(TotalAmount) AS TotalRevenue,
    AVG(TotalAmount) AS AverageOrderValue,
    MIN(TotalAmount) AS SmallestOrder,
    MAX(TotalAmount) AS LargestOrder
FROM dbo.Orders;
```

Without `GROUP BY`, aggregate functions summarize the entire filtered result set.

### GROUP BY Basics

`GROUP BY` divides rows into groups and returns one row per group.

```sql
SELECT
    Status,
    COUNT(*) AS OrderCount,
    SUM(TotalAmount) AS TotalRevenue
FROM dbo.Orders
GROUP BY Status;
```

If the table contains `Draft`, `Placed`, `Cancelled`, and `Shipped` statuses, this query returns one row per status.

The grouping column defines the granularity of the result. If you add more grouping columns, the result becomes more detailed.

```sql
SELECT
    CustomerId,
    Status,
    COUNT(*) AS OrderCount
FROM dbo.Orders
GROUP BY CustomerId, Status;
```

This returns one row per customer and status combination.

### SELECT List Rule

In a grouped query, every expression in the `SELECT` list must be either:

- Part of the `GROUP BY`.
- An aggregate expression.
- A constant or expression derived only from grouped columns.

Bad:

```sql
SELECT
    CustomerId,
    OrderDate,
    COUNT(*) AS OrderCount
FROM dbo.Orders
GROUP BY CustomerId;
```

`OrderDate` is not grouped or aggregated. SQL Server cannot know which order date to return for each customer.

Better:

```sql
SELECT
    CustomerId,
    MIN(OrderDate) AS FirstOrderDate,
    MAX(OrderDate) AS LastOrderDate,
    COUNT(*) AS OrderCount
FROM dbo.Orders
GROUP BY CustomerId;
```

Now every selected value has a clear meaning for the customer group.

### WHERE vs HAVING

`WHERE` filters rows before grouping. `HAVING` filters groups after aggregation.

```sql
SELECT
    CustomerId,
    COUNT(*) AS CompletedOrderCount
FROM dbo.Orders
WHERE Status = N'Completed'
GROUP BY CustomerId
HAVING COUNT(*) >= 5;
```

Execution conceptually works like this:

- `FROM` finds the source rows.
- `WHERE` removes non-completed orders.
- `GROUP BY` groups remaining rows by customer.
- `COUNT(*)` counts rows per customer.
- `HAVING` keeps only groups with at least five completed orders.
- `SELECT` returns the final grouped result.
- `ORDER BY` sorts the final result if specified.

Use `WHERE` for row-level filters and `HAVING` for aggregate filters.

Bad:

```sql
SELECT CustomerId, COUNT(*) AS OrderCount
FROM dbo.Orders
GROUP BY CustomerId
HAVING Status = N'Completed';
```

`Status` is neither grouped nor aggregated. The row-level status filter belongs in `WHERE`.

### COUNT Star vs COUNT Column

`COUNT(*)` counts rows.

```sql
SELECT COUNT(*) AS RowCount
FROM dbo.Customers;
```

`COUNT(column)` counts non-null values in that column.

```sql
SELECT
    COUNT(*) AS CustomerRows,
    COUNT(MiddleName) AS CustomersWithMiddleName
FROM dbo.Customers;
```

If `MiddleName` is nullable, `COUNT(MiddleName)` can be smaller than `COUNT(*)`.

This is a common interview trap. Use `COUNT(*)` when you mean rows. Use `COUNT(column)` when you intentionally mean rows where that column has a value.

### SUM and AVG

`SUM` adds numeric values. `AVG` calculates the average of non-null values.

```sql
SELECT
    CustomerId,
    SUM(TotalAmount) AS TotalSpent,
    AVG(TotalAmount) AS AverageOrderValue
FROM dbo.Orders
WHERE Status = N'Completed'
GROUP BY CustomerId;
```

Be careful with nullable values:

```sql
SELECT
    AVG(DiscountAmount) AS AverageDiscountAmongDiscountedRows,
    AVG(COALESCE(DiscountAmount, 0)) AS AverageDiscountAcrossAllRows
FROM dbo.OrderLines;
```

These two averages answer different questions. The first ignores rows where `DiscountAmount` is `NULL`. The second treats missing discount as zero.

### MIN and MAX

`MIN` and `MAX` return the smallest and largest values in a group.

```sql
SELECT
    CustomerId,
    MIN(OrderDate) AS FirstOrderDate,
    MAX(OrderDate) AS LastOrderDate
FROM dbo.Orders
GROUP BY CustomerId;
```

They work with numbers, dates, and comparable strings. In most business queries, they are used for:

- First or last date.
- Lowest or highest value.
- Earliest or latest event.
- Lexicographically smallest or largest code.

Do not assume `MAX(OrderId)` means latest order unless the key ordering truly matches creation order and the business accepts that assumption. Prefer an actual timestamp when recency matters.

### DISTINCT Aggregates

`COUNT(DISTINCT column)` counts unique non-null values.

```sql
SELECT
    COUNT(*) AS OrderRows,
    COUNT(CustomerId) AS CustomerReferences,
    COUNT(DISTINCT CustomerId) AS DistinctCustomers
FROM dbo.Orders;
```

Use distinct aggregates when the question is about unique values, not rows.

Common examples:

- Count distinct customers who ordered.
- Count distinct products sold.
- Count distinct login days per user.

Be careful with joins. A join can multiply rows and make `COUNT(*)` larger than expected. Sometimes `COUNT(DISTINCT ...)` is correct; other times the query should aggregate before joining.

### Conditional Aggregation

Conditional aggregation calculates multiple related counts or totals in one grouped query.

```sql
SELECT
    CustomerId,
    COUNT(*) AS TotalOrders,
    SUM(CASE WHEN Status = N'Completed' THEN 1 ELSE 0 END) AS CompletedOrders,
    SUM(CASE WHEN Status = N'Cancelled' THEN 1 ELSE 0 END) AS CancelledOrders,
    SUM(CASE WHEN Status = N'Completed' THEN TotalAmount ELSE 0 END) AS CompletedRevenue
FROM dbo.Orders
GROUP BY CustomerId;
```

This pattern is common for dashboards and reports.

For counts, you may also see:

```sql
COUNT(CASE WHEN Status = N'Completed' THEN 1 END) AS CompletedOrders
```

This works because `COUNT(expression)` counts non-null expressions. The `SUM(CASE...)` version is often clearer when the result is numeric and explicit.

### Grouping By Expressions

You can group by expressions, not only raw columns.

```sql
SELECT
    CAST(OrderDate AS date) AS OrderDay,
    COUNT(*) AS OrderCount
FROM dbo.Orders
GROUP BY CAST(OrderDate AS date);
```

This returns one row per calendar day.

Be careful with performance. Applying functions to a column can make filtering less efficient if used in `WHERE`.

Less efficient filter:

```sql
WHERE CAST(OrderDate AS date) = '2026-06-19'
```

Often better:

```sql
WHERE OrderDate >= '20260619'
  AND OrderDate <  '20260620'
```

Then group by the date expression if needed for display.

### Grouping NULL Values

When a grouping column contains `NULL`, SQL Server groups all `NULL` values together.

```sql
SELECT
    Region,
    COUNT(*) AS CustomerCount
FROM dbo.Customers
GROUP BY Region;
```

Rows with `Region IS NULL` appear as one group where `Region` is `NULL`.

If you want a display label, use a separate expression:

```sql
SELECT
    COALESCE(Region, N'Unknown') AS RegionName,
    COUNT(*) AS CustomerCount
FROM dbo.Customers
GROUP BY COALESCE(Region, N'Unknown');
```

Be cautious: replacing `NULL` with a label can merge true unknowns with a real value if that label also exists in the data.

### Aggregates and NULL Values

Most aggregate functions ignore `NULL` values. `COUNT(*)` is the major exception because it counts rows.

```sql
SELECT
    COUNT(*) AS RowsInGroup,
    COUNT(ShippedAtUtc) AS ShippedRows,
    MIN(ShippedAtUtc) AS FirstShippedAt,
    MAX(ShippedAtUtc) AS LastShippedAt
FROM dbo.Orders;
```

If `ShippedAtUtc` is nullable, `COUNT(ShippedAtUtc)` counts only shipped rows.

This can be useful, but it must be intentional.

### HAVING Without GROUP BY

`HAVING` is usually used with `GROUP BY`, but SQL can also apply it to a single implicit group.

```sql
SELECT COUNT(*) AS OrderCount
FROM dbo.Orders
HAVING COUNT(*) > 0;
```

This returns the aggregate row only if the aggregate condition is true. It is less common in application code but useful to understand for interviews.

### ROLLUP, CUBE, and GROUPING SETS

SQL Server supports extended grouping options for subtotal and reporting queries.

`ROLLUP` produces hierarchical totals:

```sql
SELECT
    Region,
    SalesPersonId,
    SUM(TotalAmount) AS Revenue
FROM dbo.Orders
GROUP BY ROLLUP (Region, SalesPersonId);
```

`GROUPING SETS` lets you specify exact grouping combinations:

```sql
SELECT
    Region,
    Status,
    SUM(TotalAmount) AS Revenue
FROM dbo.Orders
GROUP BY GROUPING SETS
(
    (Region, Status),
    (Region),
    ()
);
```

These are useful for reports that need detail rows, subtotals, and grand totals in one result. They can be overkill for simple API queries.

### GROUP BY Does Not Sort

`GROUP BY` defines groups. It does not guarantee output order.

Bad assumption:

```sql
SELECT Status, COUNT(*) AS OrderCount
FROM dbo.Orders
GROUP BY Status;
```

If order matters, add `ORDER BY`:

```sql
SELECT Status, COUNT(*) AS OrderCount
FROM dbo.Orders
GROUP BY Status
ORDER BY OrderCount DESC, Status;
```

This matters for deterministic reports and tests.

### Join Multiplication

Aggregates after joins can be wrong when joins multiply rows.

Example:

```sql
SELECT
    c.CustomerId,
    COUNT(*) AS OrderCount
FROM dbo.Customers AS c
JOIN dbo.Orders AS o
    ON o.CustomerId = c.CustomerId
JOIN dbo.OrderLines AS ol
    ON ol.OrderId = o.OrderId
GROUP BY c.CustomerId;
```

This counts order lines, not orders. If an order has three lines, it contributes three rows.

Better:

```sql
SELECT
    c.CustomerId,
    COUNT(DISTINCT o.OrderId) AS OrderCount
FROM dbo.Customers AS c
JOIN dbo.Orders AS o
    ON o.CustomerId = c.CustomerId
JOIN dbo.OrderLines AS ol
    ON ol.OrderId = o.OrderId
GROUP BY c.CustomerId;
```

Or aggregate orders before joining to order lines if that better matches the report.

### Performance Considerations

Grouped queries often benefit from indexes that match filters and grouping keys.

Example:

```sql
CREATE INDEX IX_Orders_Status_CustomerId
ON dbo.Orders(Status, CustomerId)
INCLUDE (TotalAmount);
```

This can help a query like:

```sql
SELECT
    CustomerId,
    SUM(TotalAmount) AS CompletedRevenue
FROM dbo.Orders
WHERE Status = N'Completed'
GROUP BY CustomerId;
```

Performance depends on data distribution, statistics, indexes, query shape, and result size. Avoid assuming all aggregation problems are solved by indexes. Sometimes the correct answer is a summary table, indexed view, filtered index, partitioning, or a separate reporting model.

### Common Mistakes

Common mistakes include:

- Selecting columns that are not grouped or aggregated.
- Using `HAVING` for row filters that belong in `WHERE`.
- Forgetting that `COUNT(column)` ignores `NULL`.
- Assuming `GROUP BY` sorts results.
- Counting multiplied join rows accidentally.
- Using `COUNT(DISTINCT ...)` as a bandage instead of fixing the join shape.
- Treating `NULL` and zero as the same in averages.
- Grouping at the wrong granularity.
- Using `MAX(Id)` as a proxy for latest date without proving it.
- Returning subtotals from `ROLLUP` without labeling them clearly.

### Best Practices

Best practices include:

- Decide the granularity before writing the query.
- Filter rows in `WHERE` before grouping.
- Filter aggregate results in `HAVING`.
- Use `COUNT(*)` for row count.
- Use `COUNT(column)` only when non-null count is intended.
- Use clear aggregate aliases.
- Check joins for row multiplication.
- Add `ORDER BY` when result order matters.
- Test edge cases with no rows, null values, and duplicate joins.
- Use indexes or summary structures based on measured workload.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What does `GROUP BY` do in SQL?

<!-- question:start:group-by-and-aggregate-functions-beginner-q01 -->
<!-- question-id:group-by-and-aggregate-functions-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

`GROUP BY` divides rows into groups based on one or more expressions and returns one result row per group. It is usually used with aggregate functions such as `COUNT`, `SUM`, `AVG`, `MIN`, and `MAX`.

For example, grouping orders by `CustomerId` can return each customer's order count or total revenue. The grouping columns define the granularity of the result.

##### Key Points to Mention

- Creates one result row per group.
- Grouping columns define result granularity.
- Usually used with aggregate functions.
- Non-aggregated selected columns must be grouped.
- `GROUP BY` does not guarantee sort order.

<!-- question:end:group-by-and-aggregate-functions-beginner-q01 -->

#### What is the difference between `COUNT(*)` and `COUNT(column)`?

<!-- question:start:group-by-and-aggregate-functions-beginner-q02 -->
<!-- question-id:group-by-and-aggregate-functions-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

`COUNT(*)` counts rows. `COUNT(column)` counts only rows where that column is not `NULL`. If the column is nullable, these can return different numbers.

Use `COUNT(*)` when the question is "how many rows?" Use `COUNT(column)` when the question is "how many rows have a value in this column?"

##### Key Points to Mention

- `COUNT(*)` counts all rows.
- `COUNT(column)` ignores `NULL`.
- Nullable columns can change the result.
- Use the one that matches the business question.
- This difference is a common interview trap.

<!-- question:end:group-by-and-aggregate-functions-beginner-q02 -->

#### What is the difference between `WHERE` and `HAVING`?

<!-- question:start:group-by-and-aggregate-functions-beginner-q03 -->
<!-- question-id:group-by-and-aggregate-functions-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

`WHERE` filters rows before grouping and aggregation. `HAVING` filters groups after aggregation. Use `WHERE` for row-level conditions such as `Status = 'Completed'`. Use `HAVING` for aggregate conditions such as `COUNT(*) >= 5` or `SUM(TotalAmount) > 1000`.

Using `WHERE` early can also reduce the number of rows that must be grouped, which is often better for performance.

##### Key Points to Mention

- `WHERE` runs before grouping.
- `HAVING` runs after grouping.
- Row filters belong in `WHERE`.
- Aggregate filters belong in `HAVING`.
- Filtering early can reduce aggregation work.

<!-- question:end:group-by-and-aggregate-functions-beginner-q03 -->

#### Which aggregate functions are commonly used with `GROUP BY`?

<!-- question:start:group-by-and-aggregate-functions-beginner-q04 -->
<!-- question-id:group-by-and-aggregate-functions-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Common aggregate functions include `COUNT`, `SUM`, `AVG`, `MIN`, and `MAX`. `COUNT` counts rows or non-null values. `SUM` totals numeric values. `AVG` calculates an average. `MIN` and `MAX` return the smallest and largest values in a group.

These functions are used for reports, dashboards, validation queries, and analytics.

##### Key Points to Mention

- `COUNT` for counts.
- `SUM` for totals.
- `AVG` for averages.
- `MIN` for smallest or earliest values.
- `MAX` for largest or latest values.
- Most aggregates ignore `NULL`.

<!-- question:end:group-by-and-aggregate-functions-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why does SQL require selected columns to be grouped or aggregated?

<!-- question:start:group-by-and-aggregate-functions-intermediate-q01 -->
<!-- question-id:group-by-and-aggregate-functions-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

After grouping, each group may contain many detail rows. If a selected column is not part of the grouping key and is not aggregated, SQL cannot know which value from the group should be returned.

For example, grouping orders by `CustomerId` and selecting `OrderDate` is ambiguous because a customer may have many order dates. The query should use an aggregate such as `MIN(OrderDate)` or `MAX(OrderDate)`, or include `OrderDate` in the grouping key if the result should be per customer and date.

##### Key Points to Mention

- One output row represents many input rows.
- Non-grouped detail columns are ambiguous.
- Use aggregates for meaningful group-level values.
- Add columns to `GROUP BY` only when they define the intended granularity.
- Avoid hiding ambiguity with arbitrary values.

<!-- question:end:group-by-and-aggregate-functions-intermediate-q01 -->

#### How do aggregate functions handle `NULL` values?

<!-- question:start:group-by-and-aggregate-functions-intermediate-q02 -->
<!-- question-id:group-by-and-aggregate-functions-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Most aggregate functions ignore `NULL` values. `SUM`, `AVG`, `MIN`, and `MAX` skip null inputs. `COUNT(column)` counts non-null values. `COUNT(*)` is different because it counts rows regardless of null values.

This matters when null means unknown or not applicable. For example, `AVG(DiscountAmount)` averages only rows where discount is not null, while `AVG(COALESCE(DiscountAmount, 0))` treats missing discounts as zero. Those answer different questions.

##### Key Points to Mention

- Most aggregates ignore `NULL`.
- `COUNT(*)` counts rows.
- `COUNT(column)` counts non-null values.
- Replacing null with zero changes meaning.
- Be explicit about the business question.

<!-- question:end:group-by-and-aggregate-functions-intermediate-q02 -->

#### How can joins make aggregate results incorrect?

<!-- question:start:group-by-and-aggregate-functions-intermediate-q03 -->
<!-- question-id:group-by-and-aggregate-functions-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Joins can multiply rows. If a customer has one order with three order lines, joining orders to order lines produces three joined rows for that order. A `COUNT(*)` after that join counts line rows, not order rows.

The fix depends on the question. Use `COUNT(DISTINCT OrderId)` if distinct orders are needed, aggregate at the correct level before joining, or change the query shape so each fact is counted once.

##### Key Points to Mention

- One-to-many joins multiply rows.
- Aggregates run after the join result is formed.
- `COUNT(*)` may count child rows accidentally.
- `COUNT(DISTINCT ...)` can help but is not always the best fix.
- Aggregate at the correct grain.

<!-- question:end:group-by-and-aggregate-functions-intermediate-q03 -->

#### When would you use conditional aggregation?

<!-- question:start:group-by-and-aggregate-functions-intermediate-q04 -->
<!-- question-id:group-by-and-aggregate-functions-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Conditional aggregation is useful when a report needs multiple metrics from the same grouped data. For example, a query can return total orders, completed orders, cancelled orders, and completed revenue per customer using `SUM(CASE WHEN ... THEN ... ELSE ... END)`.

It avoids running many separate queries and keeps related metrics at the same grouping level. The conditions should be clear, and the result should match the business definitions.

##### Key Points to Mention

- Uses `CASE` inside aggregate functions.
- Good for multiple counts or totals in one query.
- Common in dashboards and reports.
- Keeps metrics at the same grain.
- Conditions must match business definitions.

<!-- question:end:group-by-and-aggregate-functions-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you optimize a slow grouped reporting query?

<!-- question:start:group-by-and-aggregate-functions-advanced-q01 -->
<!-- question-id:group-by-and-aggregate-functions-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

I would first confirm the required grain and correctness, then inspect the execution plan and actual row counts. I would check whether filters are selective, whether indexes support the `WHERE` and `GROUP BY` columns, whether joins multiply rows, whether statistics are accurate, and whether the query is aggregating more data than needed.

Possible fixes include better indexes, filtered indexes, pre-aggregating before joins, rewriting non-sargable filters, reducing selected data, partitioning large tables, using indexed views where appropriate, or creating summary tables or reporting models for repeated expensive aggregations.

##### Key Points to Mention

- Validate correctness before tuning.
- Inspect execution plan and row counts.
- Check filters, joins, indexes, and statistics.
- Avoid non-sargable predicates.
- Aggregate at the right level.
- Consider summary tables or indexed views for repeated heavy reports.

<!-- question:end:group-by-and-aggregate-functions-advanced-q01 -->

#### What are `ROLLUP`, `CUBE`, and `GROUPING SETS` used for?

<!-- question:start:group-by-and-aggregate-functions-advanced-q02 -->
<!-- question-id:group-by-and-aggregate-functions-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

`ROLLUP`, `CUBE`, and `GROUPING SETS` are extended grouping features for subtotal and reporting queries. `ROLLUP` produces hierarchical subtotals and a grand total. `CUBE` produces combinations across multiple dimensions. `GROUPING SETS` lets the query specify exactly which grouping combinations to return.

They are useful when a report needs detail, subtotal, and total rows in one result. They should be used carefully because subtotal rows can contain `NULL` placeholders that need clear labeling.

##### Key Points to Mention

- `ROLLUP` is hierarchical.
- `CUBE` produces all combinations.
- `GROUPING SETS` specifies exact groupings.
- Useful for reports with subtotals and grand totals.
- Subtotal rows need clear interpretation.

<!-- question:end:group-by-and-aggregate-functions-advanced-q02 -->

#### How do you avoid using `COUNT(DISTINCT ...)` as a performance bandage?

<!-- question:start:group-by-and-aggregate-functions-advanced-q03 -->
<!-- question-id:group-by-and-aggregate-functions-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

I would first understand why duplicates exist. If duplicates come from a legitimate one-to-many join, the query may be aggregating at the wrong grain. In that case, pre-aggregate the child table, aggregate orders before joining lines, or use a semi-join with `EXISTS` if the question is about existence.

`COUNT(DISTINCT ...)` is correct when the business question is truly about unique values. It is not ideal when it hides an accidental join problem, because it can be expensive and may still produce incorrect results for other aggregates such as `SUM`.

##### Key Points to Mention

- Understand the source of duplication.
- Check query grain.
- Pre-aggregate before joining when appropriate.
- Use `EXISTS` for existence questions.
- Use `COUNT(DISTINCT ...)` only when unique count is the real metric.
- Other aggregates may still be wrong after duplicated joins.

<!-- question:end:group-by-and-aggregate-functions-advanced-q03 -->

#### How would you design a query for daily revenue and customer count?

<!-- question:start:group-by-and-aggregate-functions-advanced-q04 -->
<!-- question-id:group-by-and-aggregate-functions-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

I would filter to the date range with a sargable predicate, group by the date expression needed for reporting, and calculate revenue and distinct customers at the correct grain. I would be careful that joins do not multiply revenue, and I would use a half-open date range rather than casting the column in the `WHERE` clause.

For example, filter with `OrderDate >= @StartDate AND OrderDate < @EndDate`, group by `CAST(OrderDate AS date)`, use `SUM(TotalAmount)` if one row equals one order, and use `COUNT(DISTINCT CustomerId)` if the report needs unique customers per day.

##### Key Points to Mention

- Use a half-open date range.
- Avoid functions on filtered date columns.
- Group by reporting day.
- Match aggregation to table grain.
- Use distinct count only for unique customers.
- Check indexes on date and grouping columns.

<!-- question:end:group-by-and-aggregate-functions-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
