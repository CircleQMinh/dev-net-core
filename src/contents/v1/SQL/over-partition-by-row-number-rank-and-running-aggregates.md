---
id: over-partition-by-row-number-rank-and-running-aggregates
topic: Advanced querying with window functions and CTEs
subtopic: OVER, PARTITION BY, ROW_NUMBER, RANK, and running aggregates
category: SQL
---

## Overview

Window functions let SQL Server calculate values across a related set of rows while still returning one output row per input row. The `OVER` clause defines that related set. `PARTITION BY` splits the result into independent groups, `ORDER BY` defines the logical order inside each group, and ranking or aggregate functions calculate values over that window.

This is different from `GROUP BY`. `GROUP BY` collapses rows into one result row per group. Window functions keep row-level detail and add analytical values such as row numbers, ranks, totals, running totals, moving averages, percentages, and top-N-per-group markers.

This topic matters because many interview SQL problems are easier and clearer with window functions: finding the latest row per customer, ranking products by sales, calculating running balances, detecting duplicates, paginating result sets, and comparing each row with its group total.

For interviews, strong candidates can explain `OVER`, `PARTITION BY`, `ROW_NUMBER`, `RANK`, and aggregate windows; know when `ORDER BY` is required; understand tie behavior; and avoid common mistakes around nondeterministic ordering and default window frames.

## Core Concepts

### Window Functions

A window function calculates a value over a set of rows related to the current row.

Example:

```sql
SELECT
    OrderId,
    CustomerId,
    OrderDate,
    TotalAmount,
    SUM(TotalAmount) OVER (PARTITION BY CustomerId) AS CustomerLifetimeTotal
FROM dbo.Orders;
```

This returns every order row while also showing the customer's lifetime total on each row. A `GROUP BY CustomerId` query would collapse the orders into one row per customer.

Common window function categories:

- Ranking functions such as `ROW_NUMBER`, `RANK`, and `DENSE_RANK`.
- Aggregate functions used as windows, such as `SUM`, `AVG`, `COUNT`, `MIN`, and `MAX`.
- Offset functions such as `LAG` and `LEAD`.
- Distribution functions such as `NTILE`, `PERCENT_RANK`, and `CUME_DIST`.

This subtopic focuses on `OVER`, `PARTITION BY`, `ROW_NUMBER`, `RANK`, and running aggregates.

### The OVER Clause

The `OVER` clause defines the window that the function uses.

General shape:

```sql
FunctionName(...) OVER
(
    PARTITION BY partition_column
    ORDER BY ordering_column
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
)
```

The parts mean:

- `PARTITION BY`: divide rows into independent groups.
- `ORDER BY`: define logical order inside each partition.
- `ROWS` or `RANGE`: define which rows inside the ordered partition are included in the frame.

Not every function supports every part. Ranking functions require an `ORDER BY` inside `OVER`, but they do not accept `ROWS` or `RANGE` window frames.

### PARTITION BY

`PARTITION BY` resets the window calculation for each group.

Example:

```sql
SELECT
    OrderId,
    CustomerId,
    OrderDate,
    TotalAmount,
    ROW_NUMBER() OVER
    (
        PARTITION BY CustomerId
        ORDER BY OrderDate DESC, OrderId DESC
    ) AS CustomerOrderNumber
FROM dbo.Orders;
```

This numbers orders separately for each customer. Without `PARTITION BY`, all rows would be numbered as one global result set.

Use `PARTITION BY` for:

- Ranking rows inside each customer, product, tenant, department, or category.
- Calculating totals per group while retaining row details.
- Finding the latest row per entity.
- Detecting duplicates within a business key.

### Window ORDER BY Vs Final ORDER BY

There are two different `ORDER BY` concepts.

The `ORDER BY` inside `OVER` controls how the window function calculates its value:

```sql
ROW_NUMBER() OVER (PARTITION BY CustomerId ORDER BY OrderDate DESC)
```

The final query `ORDER BY` controls how the result rows are displayed:

```sql
ORDER BY CustomerId, OrderDate DESC;
```

Example:

```sql
SELECT
    OrderId,
    CustomerId,
    OrderDate,
    ROW_NUMBER() OVER
    (
        PARTITION BY CustomerId
        ORDER BY OrderDate DESC, OrderId DESC
    ) AS rn
FROM dbo.Orders
ORDER BY CustomerId, rn;
```

The window order calculates `rn`. The final order makes the output readable. Do not assume a window `ORDER BY` controls final result ordering.

### ROW_NUMBER

`ROW_NUMBER()` assigns a unique sequential number to each row in the ordered window.

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

This returns one latest order per customer. The `OrderId DESC` tie-breaker is important because multiple orders can share the same `OrderDate`.

Use `ROW_NUMBER` when:

- You need exactly one row per group.
- You need deterministic tie-breaking.
- You are deduplicating rows.
- You are implementing stable pagination.
- You need a temporary sequence in the query result.

Important: `ROW_NUMBER` does not store permanent row numbers. It calculates them when the query runs.

### Deterministic Ordering

`ROW_NUMBER` can be nondeterministic when the ordering columns are not unique.

Problem:

```sql
ROW_NUMBER() OVER
(
    PARTITION BY CustomerId
    ORDER BY OrderDate DESC
) AS rn
```

If two orders for the same customer have the same `OrderDate`, SQL Server can choose either one first. The result may appear stable in testing and still be unsafe.

Better:

```sql
ROW_NUMBER() OVER
(
    PARTITION BY CustomerId
    ORDER BY OrderDate DESC, OrderId DESC
) AS rn
```

Interview rule: if you use `ROW_NUMBER` to pick a single row, include a tie-breaker that makes the order unique and meaningful.

### RANK

`RANK()` assigns the same rank to tied rows and leaves gaps after ties.

Example:

```sql
SELECT
    ProductId,
    CategoryId,
    Revenue,
    RANK() OVER
    (
        PARTITION BY CategoryId
        ORDER BY Revenue DESC
    ) AS RevenueRank
FROM dbo.ProductRevenue;
```

If two products tie for rank 1, the next product gets rank 3.

Use `RANK` when:

- Ties should receive the same rank.
- Gaps after ties are acceptable or desired.
- You want a competition-style ranking.

Related concept: `DENSE_RANK` also gives ties the same rank but does not leave gaps. If two rows tie for rank 1, the next rank is 2.

### ROW_NUMBER Vs RANK

`ROW_NUMBER` and `RANK` answer different questions.

Example data:

```text
ProductId  Revenue
---------  -------
10         500
11         500
12         300
```

`ROW_NUMBER` result:

```text
ProductId  RowNumber
---------  ---------
10         1
11         2
12         3
```

`RANK` result:

```text
ProductId  Rank
---------  ----
10         1
11         1
12         3
```

Choose `ROW_NUMBER` when you need one row to win. Choose `RANK` when ties are meaningful and should remain visible.

### Running Aggregates

A running aggregate calculates a cumulative value as rows progress through an ordered window.

Example: running account balance.

```sql
SELECT
    AccountId,
    TransactionId,
    TransactionDate,
    Amount,
    SUM(Amount) OVER
    (
        PARTITION BY AccountId
        ORDER BY TransactionDate, TransactionId
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS RunningBalance
FROM dbo.AccountTransactions
ORDER BY AccountId, TransactionDate, TransactionId;
```

This computes a cumulative balance per account.

Key ideas:

- `PARTITION BY AccountId` restarts the balance per account.
- `ORDER BY TransactionDate, TransactionId` defines the transaction order.
- `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` includes all prior rows in that account plus the current row.

### ROWS Vs RANGE

For running totals in SQL Server, prefer an explicit `ROWS` frame in most practical queries.

Example:

```sql
SUM(Amount) OVER
(
    PARTITION BY AccountId
    ORDER BY TransactionDate
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
) AS RunningBalance
```

If you specify an `ORDER BY` for an aggregate window but omit `ROWS` or `RANGE`, SQL Server uses a default frame for functions that accept frames. That default can behave like `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, which treats tied ordering values as peers.

This can surprise developers when multiple rows have the same `TransactionDate`. Explicit `ROWS` plus a deterministic tie-breaker usually produces clearer running-total behavior.

### Moving Averages

Window frames can limit the calculation to a sliding range of rows.

Example: three-order moving average.

```sql
SELECT
    CustomerId,
    OrderId,
    OrderDate,
    TotalAmount,
    AVG(TotalAmount) OVER
    (
        PARTITION BY CustomerId
        ORDER BY OrderDate, OrderId
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS MovingAverage3Orders
FROM dbo.Orders;
```

This averages the current order and the two previous orders for each customer.

### Top N Per Group

Top-N-per-group is a classic interview use case.

Example: top three products by revenue in each category.

```sql
WITH RankedProducts AS
(
    SELECT
        ProductId,
        CategoryId,
        Revenue,
        ROW_NUMBER() OVER
        (
            PARTITION BY CategoryId
            ORDER BY Revenue DESC, ProductId
        ) AS rn
    FROM dbo.ProductRevenue
)
SELECT
    ProductId,
    CategoryId,
    Revenue
FROM RankedProducts
WHERE rn <= 3
ORDER BY CategoryId, rn;
```

If ties should be included, use `RANK` instead:

```sql
WITH RankedProducts AS
(
    SELECT
        ProductId,
        CategoryId,
        Revenue,
        RANK() OVER
        (
            PARTITION BY CategoryId
            ORDER BY Revenue DESC
        ) AS RevenueRank
    FROM dbo.ProductRevenue
)
SELECT
    ProductId,
    CategoryId,
    Revenue
FROM RankedProducts
WHERE RevenueRank <= 3;
```

The first version returns at most three rows per category. The second version may return more than three rows when there are ties.

### Deduplication With ROW_NUMBER

`ROW_NUMBER` is often used to identify duplicate rows while keeping one preferred row.

Example:

```sql
WITH Duplicates AS
(
    SELECT
        CustomerId,
        Email,
        UpdatedAt,
        ROW_NUMBER() OVER
        (
            PARTITION BY Email
            ORDER BY UpdatedAt DESC, CustomerId DESC
        ) AS rn
    FROM dbo.Customers
)
SELECT *
FROM Duplicates
WHERE rn > 1;
```

This identifies duplicate email rows except the most recently updated row for each email.

In production, deduplication should usually be followed by a unique constraint or unique index so duplicates do not return.

### Window Functions And WHERE

Window functions are calculated after `WHERE`, so you cannot directly use a window function in the same query's `WHERE` clause.

Invalid pattern:

```sql
SELECT
    OrderId,
    CustomerId,
    ROW_NUMBER() OVER (PARTITION BY CustomerId ORDER BY OrderDate DESC) AS rn
FROM dbo.Orders
WHERE rn = 1;
```

Correct pattern:

```sql
WITH RankedOrders AS
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
)
SELECT *
FROM RankedOrders
WHERE rn = 1;
```

Use a CTE, derived table, or subquery to filter on a window result.

### Performance Considerations

Window functions often require sorting by partition and order columns. Large sorts can use memory, spill to tempdb, and become expensive.

Helpful indexing pattern:

```sql
CREATE INDEX IX_Orders_Customer_OrderDate
ON dbo.Orders (CustomerId, OrderDate DESC, OrderId DESC)
INCLUDE (TotalAmount);
```

This supports a query like:

```sql
ROW_NUMBER() OVER
(
    PARTITION BY CustomerId
    ORDER BY OrderDate DESC, OrderId DESC
)
```

General performance guidance:

- Filter early to reduce input rows.
- Index partition columns followed by order columns when the query is important.
- Include columns needed by the query to reduce lookups.
- Use deterministic order keys.
- Watch for sort spills in actual execution plans.
- Avoid calculating multiple unrelated windows over huge row sets without measuring.

### Common Mistakes

Common mistakes include:

- Confusing window `ORDER BY` with final result `ORDER BY`.
- Using `ROW_NUMBER` without a deterministic tie-breaker.
- Using `ROW_NUMBER` when ties should be preserved with `RANK`.
- Forgetting that `RANK` leaves gaps after ties.
- Omitting an explicit `ROWS` frame for running totals.
- Expecting window functions to reduce rows like `GROUP BY`.
- Trying to use a window function directly in `WHERE`.
- Filtering rows before the window calculation when the window should include them.
- Ignoring indexes and sort cost on large tables.

### Best Practices

Best practices:

- Use `ROW_NUMBER` when one deterministic winner is needed.
- Use `RANK` when ties should share a rank.
- Include stable tie-breakers in window `ORDER BY` clauses.
- Use explicit `ROWS` frames for running totals and moving calculations.
- Use CTEs or derived tables to filter windowed results.
- Keep the final `ORDER BY` separate and explicit.
- Add indexes that match `PARTITION BY` then `ORDER BY` for high-value queries.
- Test with duplicates, ties, and same-date rows.
- Compare window functions with simpler `GROUP BY` queries when row detail is not needed.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What does the OVER clause do?

<!-- question:start:over-partition-by-row-number-rank-and-running-aggregates-beginner-q01 -->
<!-- question-id:over-partition-by-row-number-rank-and-running-aggregates-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

The `OVER` clause defines the window of rows used by a window function. It can partition rows into groups, order rows inside each group, and define the frame of rows included in the calculation.

For example, `SUM(TotalAmount) OVER (PARTITION BY CustomerId)` calculates a customer total while still returning each order row.

##### Key Points to Mention

- Defines the row set for a window function.
- Can include `PARTITION BY`, `ORDER BY`, and a frame.
- Keeps row-level detail.
- Works with ranking and aggregate functions.
- Different from final query ordering.

<!-- question:end:over-partition-by-row-number-rank-and-running-aggregates-beginner-q01 -->

#### What does PARTITION BY do in a window function?

<!-- question:start:over-partition-by-row-number-rank-and-running-aggregates-beginner-q02 -->
<!-- question-id:over-partition-by-row-number-rank-and-running-aggregates-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

`PARTITION BY` splits the query result into independent groups for the window function. The function restarts for each partition. For example, `ROW_NUMBER() OVER (PARTITION BY CustomerId ORDER BY OrderDate)` numbers orders separately for each customer.

If `PARTITION BY` is omitted, the function treats the entire result set as one partition.

##### Key Points to Mention

- Splits rows into groups.
- Calculation restarts per group.
- Similar grouping idea but without collapsing rows.
- Optional for many window functions.
- Common for per-customer or per-category ranking.

<!-- question:end:over-partition-by-row-number-rank-and-running-aggregates-beginner-q02 -->

#### What is ROW_NUMBER used for?

<!-- question:start:over-partition-by-row-number-rank-and-running-aggregates-beginner-q03 -->
<!-- question-id:over-partition-by-row-number-rank-and-running-aggregates-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

`ROW_NUMBER()` assigns a unique sequential number to rows within the ordered window. It is commonly used for top-N-per-group queries, latest-row-per-group queries, deduplication, and pagination.

When using it to choose one row, the `ORDER BY` inside `OVER` should include a deterministic tie-breaker.

##### Key Points to Mention

- Assigns unique sequential numbers.
- Requires window ordering.
- Useful for latest row per group.
- Useful for deduplication.
- Needs deterministic ordering for stable results.

<!-- question:end:over-partition-by-row-number-rank-and-running-aggregates-beginner-q03 -->

#### What is the difference between ROW_NUMBER and RANK?

<!-- question:start:over-partition-by-row-number-rank-and-running-aggregates-beginner-q04 -->
<!-- question-id:over-partition-by-row-number-rank-and-running-aggregates-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

`ROW_NUMBER` gives every row a unique sequence number, even when values tie. `RANK` gives tied rows the same rank and leaves gaps after ties. If two rows tie for rank 1, the next row gets rank 3.

Use `ROW_NUMBER` when one row must win. Use `RANK` when ties should be preserved.

##### Key Points to Mention

- `ROW_NUMBER` is unique per row.
- `RANK` gives ties the same value.
- `RANK` leaves gaps after ties.
- Business rules decide which one to use.
- Tie handling is an interview favorite.

<!-- question:end:over-partition-by-row-number-rank-and-running-aggregates-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### How do you calculate a running total in SQL Server?

<!-- question:start:over-partition-by-row-number-rank-and-running-aggregates-intermediate-q01 -->
<!-- question-id:over-partition-by-row-number-rank-and-running-aggregates-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

Use an aggregate function with `OVER`, an ordering clause, and an explicit row frame. For example, `SUM(Amount) OVER (PARTITION BY AccountId ORDER BY TransactionDate, TransactionId ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)` calculates a running balance per account.

The partition resets the total per account, the order defines transaction sequence, and the frame includes all previous rows plus the current row.

##### Key Points to Mention

- Use `SUM` as a window aggregate.
- Use `PARTITION BY` to reset by group.
- Use `ORDER BY` to define sequence.
- Prefer explicit `ROWS` frame.
- Include tie-breakers in the order.

<!-- question:end:over-partition-by-row-number-rank-and-running-aggregates-intermediate-q01 -->

#### Why can ROW_NUMBER return unstable results?

<!-- question:start:over-partition-by-row-number-rank-and-running-aggregates-intermediate-q02 -->
<!-- question-id:over-partition-by-row-number-rank-and-running-aggregates-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

`ROW_NUMBER` can return unstable results when the `ORDER BY` columns are not unique within the partition. If two rows have the same ordering values, SQL Server is free to choose either order unless another tie-breaker is provided.

For stable results, include enough columns in the window `ORDER BY` to make the order deterministic, such as `OrderDate DESC, OrderId DESC`.

##### Key Points to Mention

- Non-unique order values create ties.
- SQL Server may choose either tied row first.
- Add a deterministic tie-breaker.
- This matters for latest-row and dedupe queries.
- Final `ORDER BY` does not fix window ordering.

<!-- question:end:over-partition-by-row-number-rank-and-running-aggregates-intermediate-q02 -->

#### Why use ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW?

<!-- question:start:over-partition-by-row-number-rank-and-running-aggregates-intermediate-q03 -->
<!-- question-id:over-partition-by-row-number-rank-and-running-aggregates-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

This frame tells SQL Server to include all prior rows in the current partition plus the current row. It is commonly used for running totals and cumulative counts. Writing it explicitly avoids confusion around default frame behavior when `ORDER BY` is present.

It also makes the query's intent clear to reviewers.

##### Key Points to Mention

- Defines a cumulative frame.
- Includes rows from partition start to current row.
- Useful for running totals.
- Avoids default-frame surprises.
- Works best with deterministic ordering.

<!-- question:end:over-partition-by-row-number-rank-and-running-aggregates-intermediate-q03 -->

#### Why can window functions not be filtered directly in WHERE?

<!-- question:start:over-partition-by-row-number-rank-and-running-aggregates-intermediate-q04 -->
<!-- question-id:over-partition-by-row-number-rank-and-running-aggregates-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

The `WHERE` clause is logically processed before window functions are calculated, so a window function alias such as `rn` is not available in the same query's `WHERE` clause. To filter on window results, put the window function in a CTE, derived table, or subquery, then filter in the outer query.

This pattern is common for latest-row-per-group and top-N-per-group queries.

##### Key Points to Mention

- `WHERE` happens before window calculation.
- Window aliases are not available in the same `WHERE`.
- Use a CTE or derived table.
- Common with `ROW_NUMBER`.
- Improves readability for top-N queries.

<!-- question:end:over-partition-by-row-number-rank-and-running-aggregates-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you return the top three products per category and handle ties correctly?

<!-- question:start:over-partition-by-row-number-rank-and-running-aggregates-advanced-q01 -->
<!-- question-id:over-partition-by-row-number-rank-and-running-aggregates-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

If exactly three rows per category are required, use `ROW_NUMBER` with a deterministic tie-breaker and filter `rn <= 3`. If all products tied within the top three ranks should be included, use `RANK` and filter `rank <= 3`, knowing it can return more than three rows per category.

The key is to ask whether ties should be included or broken. That business rule determines the function.

##### Key Points to Mention

- `ROW_NUMBER` returns a fixed number when filtered.
- `RANK` preserves ties.
- `RANK` can return more rows than N.
- Include deterministic tie-breakers for `ROW_NUMBER`.
- Clarify the business tie rule.

<!-- question:end:over-partition-by-row-number-rank-and-running-aggregates-advanced-q01 -->

#### How would you tune a slow query that uses window functions?

<!-- question:start:over-partition-by-row-number-rank-and-running-aggregates-advanced-q02 -->
<!-- question-id:over-partition-by-row-number-rank-and-running-aggregates-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Start with the actual execution plan and look for large sorts, spills, scans, memory grants, and row count misestimates. Filter input rows earlier if possible. For important queries, consider an index whose key columns match the `PARTITION BY` columns followed by the `ORDER BY` columns, with included columns for the select list.

Also check whether multiple window functions use compatible partitioning and ordering or force separate sorts.

##### Key Points to Mention

- Inspect the actual plan.
- Watch for sort spills.
- Filter early.
- Index partition columns then order columns.
- Include needed columns.
- Check multiple windows for extra sorts.

<!-- question:end:over-partition-by-row-number-rank-and-running-aggregates-advanced-q02 -->

#### How do GROUP BY and window aggregates differ?

<!-- question:start:over-partition-by-row-number-rank-and-running-aggregates-advanced-q03 -->
<!-- question-id:over-partition-by-row-number-rank-and-running-aggregates-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

`GROUP BY` collapses rows into one row per group. A window aggregate calculates a value over a group while preserving each original row. Use `GROUP BY` when you only need grouped output. Use a window aggregate when you need row detail plus group-level context, such as each order with the customer's total spend.

Choosing the simpler `GROUP BY` can be better when row-level detail is not needed.

##### Key Points to Mention

- `GROUP BY` reduces rows.
- Window aggregates preserve rows.
- Window aggregates add context to detail rows.
- Use the simpler shape when possible.
- Both can require sorting or hashing.

<!-- question:end:over-partition-by-row-number-rank-and-running-aggregates-advanced-q03 -->

#### What bugs can happen with running totals when dates are tied?

<!-- question:start:over-partition-by-row-number-rank-and-running-aggregates-advanced-q04 -->
<!-- question-id:over-partition-by-row-number-rank-and-running-aggregates-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

If the running total orders only by date and multiple rows share the same date, the row sequence may not be deterministic. Also, default `RANGE`-style frame behavior can group peer rows with the same ordering value, producing results that surprise developers who expected row-by-row accumulation.

Use a deterministic order such as `TransactionDate, TransactionId` and specify `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`.

##### Key Points to Mention

- Tied dates make order ambiguous.
- Running totals need stable sequence.
- Default frames can surprise with peers.
- Use explicit `ROWS` frame.
- Add a unique tie-breaker.

<!-- question:end:over-partition-by-row-number-rank-and-running-aggregates-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
