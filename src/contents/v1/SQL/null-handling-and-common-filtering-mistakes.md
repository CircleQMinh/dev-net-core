---
id: null-handling-and-common-filtering-mistakes
topic: Core querying and data retrieval
subtopic: NULL handling and common filtering mistakes
category: SQL
---

## Overview

`NULL` in SQL means a value is missing, unknown, not applicable, or not yet supplied. It is not the same as zero, an empty string, or a false Boolean value. Because SQL uses three-valued logic, expressions involving `NULL` can evaluate to `UNKNOWN`, not just `TRUE` or `FALSE`.

This topic matters because many SQL bugs are caused by filtering as if `NULL` were an ordinary value. Common mistakes include writing `Column = NULL`, using `<>` and accidentally excluding null rows, using `NOT IN` with nullable subqueries, filtering a `LEFT JOIN` in the wrong place, replacing nulls too early, and misunderstanding how aggregates treat null values.

For interviews, strong candidates can explain `IS NULL`, `IS NOT NULL`, `UNKNOWN`, `COUNT(*)` versus `COUNT(column)`, `NOT IN` versus `NOT EXISTS`, null behavior in joins, and how to write filters that match the business meaning of missing data.

The practical goal is to make missing data explicit. Decide what `NULL` means in the model, write predicates that handle it intentionally, and avoid hiding null-related bugs with broad replacement functions.

## Core Concepts

### What NULL Means

`NULL` means the database does not have a value for that column in that row.

Possible meanings:

- Unknown: the customer's middle name has not been collected.
- Not applicable: an order has no cancellation reason because it was not cancelled.
- Not yet happened: `ShippedAtUtc` is null because the order has not shipped.
- Optional: a secondary phone number is not provided.

These meanings are different. A good schema and query should make the intended meaning clear.

Example:

```sql
CREATE TABLE dbo.Orders
(
    OrderId BIGINT NOT NULL PRIMARY KEY,
    Status NVARCHAR(20) NOT NULL,
    OrderedAtUtc DATETIME2(3) NOT NULL,
    ShippedAtUtc DATETIME2(3) NULL,
    CancelledAtUtc DATETIME2(3) NULL
);
```

Here `ShippedAtUtc IS NULL` can mean the order has not shipped yet. `CancelledAtUtc IS NULL` can mean the order has not been cancelled. Those are meaningful business states.

### NULL Is Not Zero or Empty String

`NULL`, `0`, and `''` are different.

```sql
SELECT *
FROM dbo.Products
WHERE Weight IS NULL;
```

This finds rows where weight is missing.

```sql
SELECT *
FROM dbo.Products
WHERE Weight = 0;
```

This finds rows where weight is known to be zero.

For strings:

```sql
WHERE MiddleName IS NULL
```

means there is no stored value.

```sql
WHERE MiddleName = N''
```

means there is a stored empty string. Whether that should be allowed is a data modeling decision.

### Three-Valued Logic

SQL predicates can evaluate to:

- `TRUE`
- `FALSE`
- `UNKNOWN`

The `WHERE` clause returns rows where the predicate is `TRUE`. It does not return rows where the predicate is `FALSE` or `UNKNOWN`.

Example:

```sql
SELECT *
FROM dbo.Customers
WHERE MiddleName = N'Lee';
```

For rows where `MiddleName` is `NULL`, the comparison is `UNKNOWN`, not `FALSE`. Those rows are not returned.

This is why `NULL` requires explicit handling.

### Use IS NULL and IS NOT NULL

Use `IS NULL` and `IS NOT NULL` to test nullness.

Bad:

```sql
SELECT *
FROM dbo.Orders
WHERE ShippedAtUtc = NULL;
```

Correct:

```sql
SELECT *
FROM dbo.Orders
WHERE ShippedAtUtc IS NULL;
```

For non-null values:

```sql
SELECT *
FROM dbo.Orders
WHERE ShippedAtUtc IS NOT NULL;
```

Do not depend on old settings that change null comparison behavior. Modern SQL Server uses ANSI null behavior, and new code should use `IS NULL` and `IS NOT NULL`.

### Equality and Inequality With NULL

Equality and inequality comparisons with `NULL` do not behave like comparisons with ordinary values.

```sql
-- Does not return rows where Status is NULL.
SELECT *
FROM dbo.Orders
WHERE Status <> N'Cancelled';
```

If the business rule is "all orders that are not cancelled, including rows with no status yet," write that explicitly:

```sql
SELECT *
FROM dbo.Orders
WHERE Status <> N'Cancelled'
   OR Status IS NULL;
```

If `Status` should never be missing, the better fix is schema enforcement:

```sql
Status NVARCHAR(20) NOT NULL
```

and a check constraint for allowed values.

### NOT IN With NULL

`NOT IN` can produce surprising results when the list or subquery contains `NULL`.

Problem:

```sql
SELECT c.CustomerId
FROM dbo.Customers AS c
WHERE c.CustomerId NOT IN
(
    SELECT o.CustomerId
    FROM dbo.Orders AS o
);
```

If `Orders.CustomerId` contains a `NULL`, the `NOT IN` comparison can become `UNKNOWN` for every customer, returning no rows.

Safer anti-join:

```sql
SELECT c.CustomerId
FROM dbo.Customers AS c
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.Orders AS o
    WHERE o.CustomerId = c.CustomerId
);
```

If using `NOT IN`, filter nulls inside the subquery:

```sql
WHERE c.CustomerId NOT IN
(
    SELECT o.CustomerId
    FROM dbo.Orders AS o
    WHERE o.CustomerId IS NOT NULL
);
```

`NOT EXISTS` is often clearer for "find rows with no matching row."

### IN With Nullable Values

`IN` is usually safe for positive matching, but it still does not match `NULL` using normal equality.

```sql
SELECT *
FROM dbo.Products
WHERE Color IN (N'Red', N'Blue', NULL);
```

This does not find rows where `Color IS NULL` in the way many beginners expect.

Write:

```sql
SELECT *
FROM dbo.Products
WHERE Color IN (N'Red', N'Blue')
   OR Color IS NULL;
```

Be explicit when nulls are part of the intended result.

### LEFT JOIN Filtering Mistakes

A `LEFT JOIN` keeps rows from the left table even when no matching right-side row exists. But a `WHERE` condition on the right table can accidentally turn it into an inner join.

Bad:

```sql
SELECT
    c.CustomerId,
    o.OrderId
FROM dbo.Customers AS c
LEFT JOIN dbo.Orders AS o
    ON o.CustomerId = c.CustomerId
WHERE o.Status = N'Completed';
```

Rows with no order have `o.Status` as `NULL`, so the `WHERE` predicate removes them.

If the goal is "all customers, with completed orders if they exist," put the right-side filter in the join condition:

```sql
SELECT
    c.CustomerId,
    o.OrderId
FROM dbo.Customers AS c
LEFT JOIN dbo.Orders AS o
    ON o.CustomerId = c.CustomerId
   AND o.Status = N'Completed';
```

If the goal is "customers with completed orders," use an inner join or `EXISTS`.

### Finding Missing Matches

To find rows with no match, use `NOT EXISTS` or a careful `LEFT JOIN ... IS NULL` pattern.

Using `NOT EXISTS`:

```sql
SELECT c.CustomerId
FROM dbo.Customers AS c
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.Orders AS o
    WHERE o.CustomerId = c.CustomerId
);
```

Using `LEFT JOIN`:

```sql
SELECT c.CustomerId
FROM dbo.Customers AS c
LEFT JOIN dbo.Orders AS o
    ON o.CustomerId = c.CustomerId
WHERE o.OrderId IS NULL;
```

Use a non-nullable key from the right table in the `IS NULL` check. Checking a nullable non-key column can produce false positives.

### COALESCE and ISNULL

`COALESCE` returns the first non-null expression.

```sql
SELECT
    CustomerId,
    COALESCE(DisplayName, Email, N'Unknown customer') AS CustomerLabel
FROM dbo.Customers;
```

`ISNULL` replaces `NULL` with a specified value in SQL Server.

```sql
SELECT
    ProductId,
    ISNULL(Color, N'Unknown') AS ColorName
FROM dbo.Products;
```

Use these functions for display values and intentional replacement. Be careful when using them in filters because wrapping a column in a function can make indexes harder to use and can change business meaning.

Problem:

```sql
WHERE ISNULL(Status, N'') <> N'Cancelled'
```

Clearer:

```sql
WHERE Status <> N'Cancelled'
   OR Status IS NULL;
```

### NULL and Aggregates

Most aggregate functions ignore `NULL`. `COUNT(*)` counts rows.

```sql
SELECT
    COUNT(*) AS RowCount,
    COUNT(ShippedAtUtc) AS ShippedCount,
    AVG(DiscountAmount) AS AverageDiscountForRowsWithDiscount,
    AVG(COALESCE(DiscountAmount, 0)) AS AverageDiscountAcrossAllRows
FROM dbo.Orders;
```

`AVG(DiscountAmount)` and `AVG(COALESCE(DiscountAmount, 0))` answer different questions. Do not replace nulls with zero unless zero is the intended business value.

### NULL and GROUP BY

When a grouping column contains `NULL`, SQL Server puts all null values into one group.

```sql
SELECT
    Region,
    COUNT(*) AS CustomerCount
FROM dbo.Customers
GROUP BY Region;
```

Rows with no region appear in a single `NULL` group.

For reporting display:

```sql
SELECT
    COALESCE(Region, N'Unknown') AS RegionName,
    COUNT(*) AS CustomerCount
FROM dbo.Customers
GROUP BY COALESCE(Region, N'Unknown');
```

This is fine for display if `Unknown` is not also a legitimate region value.

### Optional Parameter Filtering

A common stored procedure pattern uses nullable parameters:

```sql
WHERE (@Status IS NULL OR Status = @Status)
  AND (@CustomerId IS NULL OR CustomerId = @CustomerId)
```

This means:

- If `@Status` is null, do not filter by status.
- If `@Status` has a value, filter by status.

This pattern is convenient but can produce poor plans for complex searches because one query shape must handle many selectivity patterns. For important search endpoints, consider dynamic SQL with parameters, separate query paths, or carefully designed indexes.

Do not confuse a null parameter meaning "no filter" with a search for rows where the column itself is null. Those are different requirements.

### NULL in CHECK Constraints

Check constraints and nullability should be designed together.

```sql
Quantity INT NOT NULL
    CONSTRAINT CK_OrderLines_Quantity CHECK (Quantity > 0)
```

`NOT NULL` says the value is required. `CHECK` says the value must be positive.

If a column is nullable, test what your constraint allows. Nullable values can interact with logical expressions in ways that surprise developers. Use explicit `NOT NULL` when presence is required.

### Sargability and NULL Filters

A predicate is sargable when the optimizer can efficiently use an index seek or range seek. Wrapping an indexed column in a function often makes filtering less efficient.

Less ideal:

```sql
WHERE COALESCE(Status, N'Unknown') = N'Completed'
```

Better:

```sql
WHERE Status = N'Completed'
```

For a null-aware filter:

```sql
WHERE Status = N'Completed'
   OR Status IS NULL;
```

Depending on the data and workload, filtered indexes can help:

```sql
CREATE INDEX IX_Orders_Unshipped
ON dbo.Orders(OrderDate)
WHERE ShippedAtUtc IS NULL;
```

This supports queries that frequently find unshipped orders.

### Common Filtering Mistakes

Common mistakes include:

- Writing `Column = NULL` or `Column <> NULL`.
- Forgetting that `WHERE` returns only `TRUE`, not `UNKNOWN`.
- Using `<>` and accidentally excluding null rows.
- Using `NOT IN` with nullable subqueries.
- Adding right-table filters in `WHERE` after a `LEFT JOIN`.
- Counting `COUNT(column)` when `COUNT(*)` was intended.
- Replacing nulls with zero before understanding the business meaning.
- Using `COALESCE` or `ISNULL` in predicates and hurting index usage.
- Treating empty string, zero, and null as interchangeable.
- Using nullable flags where `NOT NULL DEFAULT 0` would be clearer.

### Best Practices

Best practices include:

- Decide what `NULL` means for each nullable column.
- Use `NOT NULL` for required values.
- Use `IS NULL` and `IS NOT NULL`.
- Write null-inclusive filters explicitly.
- Prefer `NOT EXISTS` for anti-joins when nulls may appear.
- Keep right-side filters in the `ON` clause when preserving left rows.
- Use `COUNT(*)` for rows and `COUNT(column)` for non-null values.
- Use replacement functions for display, not as a default filtering habit.
- Add filtered indexes for common null-state queries when justified.
- Test queries with nulls, no matches, and duplicate matches.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What does `NULL` mean in SQL?

<!-- question:start:null-handling-and-common-filtering-mistakes-beginner-q01 -->
<!-- question-id:null-handling-and-common-filtering-mistakes-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

`NULL` means the database does not have a value for that column in that row. It can mean unknown, not applicable, not yet supplied, or optional depending on the business model. It is different from zero, false, or an empty string.

Because `NULL` is not an ordinary value, comparisons involving `NULL` can evaluate to `UNKNOWN`, which affects filtering and joins.

##### Key Points to Mention

- `NULL` means missing or unknown value.
- It is not zero.
- It is not an empty string.
- It is not false.
- The meaning should be clear in the schema.

<!-- question:end:null-handling-and-common-filtering-mistakes-beginner-q01 -->

#### How do you test for `NULL` in a `WHERE` clause?

<!-- question:start:null-handling-and-common-filtering-mistakes-beginner-q02 -->
<!-- question-id:null-handling-and-common-filtering-mistakes-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

Use `IS NULL` or `IS NOT NULL`. Do not use `= NULL` or `<> NULL` because ordinary comparison operators with `NULL` return `UNKNOWN` under ANSI null behavior.

For example, use `WHERE ShippedAtUtc IS NULL` to find unshipped orders and `WHERE ShippedAtUtc IS NOT NULL` to find shipped orders.

##### Key Points to Mention

- Use `IS NULL`.
- Use `IS NOT NULL`.
- Do not use `= NULL`.
- Do not use `<> NULL`.
- Comparison operators with null produce `UNKNOWN`.

<!-- question:end:null-handling-and-common-filtering-mistakes-beginner-q02 -->

#### Why can `Column <> 'X'` miss rows where the column is `NULL`?

<!-- question:start:null-handling-and-common-filtering-mistakes-beginner-q03 -->
<!-- question-id:null-handling-and-common-filtering-mistakes-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

When `Column` is `NULL`, the predicate `Column <> 'X'` evaluates to `UNKNOWN`, not `TRUE`. The `WHERE` clause returns only rows where the predicate is `TRUE`, so null rows are filtered out.

If the business rule is "not X or missing," write `Column <> 'X' OR Column IS NULL`. If the column should never be missing, make it `NOT NULL` and enforce valid values.

##### Key Points to Mention

- `NULL <> 'X'` is `UNKNOWN`.
- `WHERE` keeps only `TRUE`.
- Null rows are not included automatically.
- Add `OR Column IS NULL` if intended.
- Prefer `NOT NULL` when missing values are invalid.

<!-- question:end:null-handling-and-common-filtering-mistakes-beginner-q03 -->

#### What is the difference between `COUNT(*)` and `COUNT(column)` with nulls?

<!-- question:start:null-handling-and-common-filtering-mistakes-beginner-q04 -->
<!-- question-id:null-handling-and-common-filtering-mistakes-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

`COUNT(*)` counts rows. `COUNT(column)` counts only rows where the column is not `NULL`. If the column is nullable, the results can be different.

For example, `COUNT(*)` can count all orders, while `COUNT(ShippedAtUtc)` counts only shipped orders if `ShippedAtUtc` is null until shipment.

##### Key Points to Mention

- `COUNT(*)` counts all rows.
- `COUNT(column)` counts non-null values.
- Nulls are ignored by `COUNT(column)`.
- Use the function that matches the question.
- This affects grouped queries too.

<!-- question:end:null-handling-and-common-filtering-mistakes-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why can `NOT IN` return no rows when the subquery contains `NULL`?

<!-- question:start:null-handling-and-common-filtering-mistakes-intermediate-q01 -->
<!-- question-id:null-handling-and-common-filtering-mistakes-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

`NOT IN` compares a value against every value returned by the list or subquery. If the list contains `NULL`, some comparisons become `UNKNOWN`. The overall predicate may not become `TRUE` for any row, so the query can return no rows unexpectedly.

For anti-join logic, `NOT EXISTS` is often safer and clearer because it checks for the absence of a matching row using a correlated predicate. If using `NOT IN`, filter out nulls in the subquery.

##### Key Points to Mention

- `NULL` inside `NOT IN` can poison the predicate.
- Comparisons can become `UNKNOWN`.
- `WHERE` keeps only `TRUE`.
- Prefer `NOT EXISTS` for anti-joins.
- Or filter nulls from the subquery.

<!-- question:end:null-handling-and-common-filtering-mistakes-intermediate-q01 -->

#### How can a `LEFT JOIN` accidentally become an inner join?

<!-- question:start:null-handling-and-common-filtering-mistakes-intermediate-q02 -->
<!-- question-id:null-handling-and-common-filtering-mistakes-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

A `LEFT JOIN` can effectively become an inner join when the `WHERE` clause filters on a right-side column. Rows without a right-side match have nulls for right-side columns, so a predicate like `WHERE o.Status = 'Completed'` removes them.

If the goal is to keep all left-side rows and only match completed right-side rows, put the right-side condition in the `ON` clause. If the goal is only rows with completed matches, use an inner join or `EXISTS`.

##### Key Points to Mention

- `LEFT JOIN` produces nulls for missing right-side rows.
- `WHERE` filters after the join.
- Right-side filters in `WHERE` can remove unmatched rows.
- Put match filters in `ON` to preserve left rows.
- Use inner join when unmatched rows are not needed.

<!-- question:end:null-handling-and-common-filtering-mistakes-intermediate-q02 -->

#### When should you use `COALESCE` or `ISNULL`?

<!-- question:start:null-handling-and-common-filtering-mistakes-intermediate-q03 -->
<!-- question-id:null-handling-and-common-filtering-mistakes-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Use `COALESCE` or `ISNULL` when you intentionally want to replace a null value, commonly for display labels, fallback values, or calculations where the replacement has clear business meaning. `COALESCE` returns the first non-null expression. `ISNULL` is SQL Server-specific and returns a replacement for one checked expression.

Be careful using these functions in predicates because they can change business meaning and may reduce index usefulness. For null tests, use `IS NULL` or `IS NOT NULL`.

##### Key Points to Mention

- `COALESCE` returns the first non-null value.
- `ISNULL` replaces one null expression in SQL Server.
- Useful for display and intentional defaults.
- Avoid using them as a reflex in filters.
- Use `IS NULL` for null tests.

<!-- question:end:null-handling-and-common-filtering-mistakes-intermediate-q03 -->

#### How do aggregates handle `NULL` values?

<!-- question:start:null-handling-and-common-filtering-mistakes-intermediate-q04 -->
<!-- question-id:null-handling-and-common-filtering-mistakes-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Most aggregates ignore `NULL` values. `SUM`, `AVG`, `MIN`, and `MAX` skip null inputs. `COUNT(column)` counts non-null values. `COUNT(*)` counts rows.

This means `AVG(DiscountAmount)` ignores rows where discount is null, while `AVG(COALESCE(DiscountAmount, 0))` treats missing discounts as zero. Those are different business questions, so the query should be explicit.

##### Key Points to Mention

- Most aggregates ignore `NULL`.
- `COUNT(*)` counts rows.
- `COUNT(column)` counts non-null values.
- Replacing null with zero changes results.
- Pick behavior based on business meaning.

<!-- question:end:null-handling-and-common-filtering-mistakes-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design filters for optional search parameters?

<!-- question:start:null-handling-and-common-filtering-mistakes-advanced-q01 -->
<!-- question-id:null-handling-and-common-filtering-mistakes-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

First define whether a null parameter means "do not filter" or "search for rows where the column is null." Those are different. A common pattern for optional filters is `(@Status IS NULL OR Status = @Status)`, but this can produce less optimal plans when many optional filters exist.

For important search endpoints, I would consider separate query shapes, parameterized dynamic SQL, or query generation that includes only active filters. I would also keep null-column searches explicit, such as a separate `@OnlyUnshipped` flag or a specific predicate using `IS NULL`.

##### Key Points to Mention

- Separate "no filter" from "column is null."
- Optional parameter patterns are convenient.
- Many optional predicates can hurt plan quality.
- Dynamic SQL must be parameterized safely.
- Use explicit flags for null-state searches.

<!-- question:end:null-handling-and-common-filtering-mistakes-advanced-q01 -->

#### How would you find customers with no orders safely?

<!-- question:start:null-handling-and-common-filtering-mistakes-advanced-q02 -->
<!-- question-id:null-handling-and-common-filtering-mistakes-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

I would usually use `NOT EXISTS` with a correlated subquery: select customers where no order row exists with the same customer ID. This avoids `NOT IN` null problems and clearly expresses an anti-join.

A `LEFT JOIN ... WHERE o.OrderId IS NULL` pattern can also work if `OrderId` is a non-nullable key from the right table. I would avoid checking a nullable non-key column because that can falsely classify matched rows as missing.

##### Key Points to Mention

- `NOT EXISTS` is clear for anti-joins.
- Avoid nullable `NOT IN` traps.
- `LEFT JOIN ... IS NULL` can work.
- Check a non-nullable right-side key.
- Index the join column for performance.

<!-- question:end:null-handling-and-common-filtering-mistakes-advanced-q02 -->

#### How do you handle nullable columns in performance-sensitive filters?

<!-- question:start:null-handling-and-common-filtering-mistakes-advanced-q03 -->
<!-- question-id:null-handling-and-common-filtering-mistakes-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

I try to keep predicates sargable and explicit. Instead of wrapping an indexed column in `COALESCE` or `ISNULL`, I write predicates such as `Status = @Status` or `Status IS NULL`. If the application frequently queries a null state, I might use a filtered index, such as an index on unshipped orders where `ShippedAtUtc IS NULL`.

I would also check whether the column should be nullable at all. If missing values are not meaningful, a `NOT NULL` column with a default and check constraint may simplify both data integrity and query performance.

##### Key Points to Mention

- Avoid wrapping indexed columns in functions when filtering.
- Use `IS NULL` and `IS NOT NULL` directly.
- Consider filtered indexes for common null-state queries.
- Check actual execution plans.
- Reconsider nullability if missing values are invalid.

<!-- question:end:null-handling-and-common-filtering-mistakes-advanced-q03 -->

#### How would you review a query for null-related bugs?

<!-- question:start:null-handling-and-common-filtering-mistakes-advanced-q04 -->
<!-- question-id:null-handling-and-common-filtering-mistakes-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

I would inspect every predicate involving nullable columns. I would look for `= NULL`, `<> NULL`, `NOT IN` subqueries, `<>` filters that unintentionally exclude nulls, `LEFT JOIN` predicates in the `WHERE` clause, aggregate functions over nullable columns, and replacement functions used in filters.

Then I would test edge cases: rows with null values, no matching rows, multiple matches, empty strings, zero values, and mixed null/non-null data. Finally, I would decide whether the schema should enforce `NOT NULL` or constraints to prevent invalid missing data.

##### Key Points to Mention

- Check nullable predicates.
- Look for `NOT IN` and `LEFT JOIN` mistakes.
- Review aggregate behavior.
- Test null and non-null edge cases.
- Consider schema constraints.
- Make business meaning explicit.

<!-- question:end:null-handling-and-common-filtering-mistakes-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
