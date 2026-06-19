---
id: union-vs-union-all-except-intersect-and-duplicate-handling
topic: SQL practical interview comparisons and SQL Server-specific features
subtopic: UNION vs UNION ALL, EXCEPT, INTERSECT, and duplicate handling
category: SQL
---

## Overview

`UNION`, `UNION ALL`, `EXCEPT`, and `INTERSECT` are SQL set operators. They combine or compare the results of two queries that return compatible columns. They are used when the question is about rows from multiple result sets, not about columns from related tables.

The most important interview distinction is duplicate handling. `UNION` removes duplicate rows. `UNION ALL` keeps duplicate rows. `EXCEPT` returns distinct rows from the left input that are not found in the right input. `INTERSECT` returns distinct rows that appear in both inputs.

This topic matters because set operators are common in reporting, data quality checks, migrations, reconciliation jobs, permissions checks, and queries that combine rows from multiple sources. The wrong operator can silently remove rows, preserve rows that should be deduplicated, or produce a result that looks correct on small test data but fails in production.

For interviews, strong candidates can explain the semantic difference, choose the right operator for the business requirement, describe how duplicates and `NULL` values are treated, and compare set operators with joins and `EXISTS` patterns.

## Core Concepts

### Set Operators At A Glance

SQL Server supports these common set operations:

- `UNION`: combine result sets and remove duplicates.
- `UNION ALL`: combine result sets and keep duplicates.
- `EXCEPT`: return distinct rows from the left query that do not appear in the right query.
- `INTERSECT`: return distinct rows that appear in both queries.

Example:

```sql
SELECT Email
FROM dbo.Customers

UNION

SELECT Email
FROM dbo.NewsletterSubscribers;
```

This returns one distinct list of emails from both sources.

### Result Shape Requirements

Set operators compare rows by position, not by column name.

The queries must return:

- The same number of columns.
- Columns in the same logical order.
- Compatible data types in corresponding positions.

Example:

```sql
SELECT CustomerId, Email
FROM dbo.Customers

UNION ALL

SELECT SubscriberId, EmailAddress
FROM dbo.NewsletterSubscribers;
```

This is valid if `CustomerId` is compatible with `SubscriberId`, and `Email` is compatible with `EmailAddress`. The output column names come from the left query.

Common mistake:

```sql
SELECT CustomerId, Email
FROM dbo.Customers

UNION ALL

SELECT EmailAddress, SubscriberId
FROM dbo.NewsletterSubscribers;
```

This query has two columns on both sides, but the column order is wrong. SQL may convert data types or fail, and the logical result is incorrect.

### UNION

`UNION` combines rows from multiple queries and removes duplicate rows.

Example:

```sql
SELECT ProductId
FROM dbo.OnlineSales

UNION

SELECT ProductId
FROM dbo.StoreSales;
```

If product `42` appears in both tables, it appears once in the result.

`UNION` is useful when the business question asks for a distinct set:

- All customers who bought online or in store.
- All permissions assigned directly or through a role.
- All product IDs that appear in any import source.
- All active email addresses from multiple systems.

Trade-off: duplicate removal has a cost. SQL Server must compare rows and remove duplicates, which may require sorting, hashing, memory grants, and extra CPU.

### UNION ALL

`UNION ALL` combines rows and keeps all rows, including duplicates.

Example:

```sql
SELECT ProductId, Quantity
FROM dbo.OnlineSales

UNION ALL

SELECT ProductId, Quantity
FROM dbo.StoreSales;
```

If the same product appears in both sources, both rows remain. This is usually what you want for fact data, audit records, logs, transactions, and reporting inputs where each row represents an event.

`UNION ALL` is often faster than `UNION` because it does not need to remove duplicates.

Use `UNION ALL` when:

- Duplicates are meaningful.
- You know the inputs are already disjoint.
- You plan to aggregate after combining.
- Performance matters and duplicate removal is unnecessary.

Example:

```sql
SELECT ProductId, SUM(Quantity) AS TotalQuantity
FROM
(
    SELECT ProductId, Quantity
    FROM dbo.OnlineSales

    UNION ALL

    SELECT ProductId, Quantity
    FROM dbo.StoreSales
) AS sales
GROUP BY ProductId;
```

Using `UNION` here would incorrectly remove identical sales rows before summing.

### Duplicate Handling

Duplicate handling is based on the full projected row, not one column unless only one column is selected.

Example:

```sql
SELECT CustomerId, SourceSystem
FROM dbo.CustomerImportA

UNION

SELECT CustomerId, SourceSystem
FROM dbo.CustomerImportB;
```

These two rows are not duplicates:

```text
CustomerId  SourceSystem
----------  ------------
100         CRM
100         Billing
```

They have the same `CustomerId`, but the full projected row differs.

If you want distinct customer IDs only, project only the customer ID:

```sql
SELECT CustomerId
FROM dbo.CustomerImportA

UNION

SELECT CustomerId
FROM dbo.CustomerImportB;
```

This distinction is a common source of interview traps. SQL removes duplicate rows based on the columns you selected, not based on what you mentally consider the business key.

### EXCEPT

`EXCEPT` returns distinct rows from the left query that are not returned by the right query.

Example:

```sql
SELECT CustomerId
FROM dbo.Customers

EXCEPT

SELECT CustomerId
FROM dbo.Orders;
```

This returns customers with no matching customer ID in `Orders`, as a distinct set.

`EXCEPT` is useful for:

- Finding missing rows between systems.
- Validating migration results.
- Identifying orphaned records.
- Comparing expected versus actual outputs.
- Checking which permissions or assignments are absent.

Direction matters. These are not equivalent:

```sql
SELECT CustomerId FROM dbo.Customers
EXCEPT
SELECT CustomerId FROM dbo.Orders;

SELECT CustomerId FROM dbo.Orders
EXCEPT
SELECT CustomerId FROM dbo.Customers;
```

The first asks for customers with no orders. The second asks for order customer IDs that do not exist in customers.

### INTERSECT

`INTERSECT` returns distinct rows that appear in both queries.

Example:

```sql
SELECT CustomerId
FROM dbo.Customers
WHERE IsActive = 1

INTERSECT

SELECT CustomerId
FROM dbo.Orders
WHERE OrderDate >= DATEADD(year, -1, SYSUTCDATETIME());
```

This returns active customers who also have recent orders.

`INTERSECT` is useful for:

- Finding overlap between two sets.
- Checking which migrated rows exist in both systems.
- Finding users who meet multiple independent criteria.
- Comparing test output against expected output.

Like `EXCEPT`, `INTERSECT` returns distinct rows. If the same value appears many times on both sides, it appears once in the result.

### NULL Handling

For `EXCEPT` and `INTERSECT`, SQL Server treats two `NULL` values as equal when determining distinct rows. This can surprise developers because normal comparisons with `NULL` using `=` do not behave that way.

Example:

```sql
SELECT CAST(NULL AS INT) AS Value

INTERSECT

SELECT CAST(NULL AS INT) AS Value;
```

This returns one row with `NULL`.

For duplicate removal with set operators, think in terms of set comparison over projected rows, not normal `WHERE Column = NULL` predicates.

### Operator Precedence

When combining set operators, parentheses make intent clear.

SQL Server evaluates set operator expressions using this precedence:

- Parentheses first.
- `INTERSECT` before `EXCEPT` and `UNION`.
- `EXCEPT` and `UNION` from left to right.

Example:

```sql
SELECT CustomerId FROM dbo.A
UNION
SELECT CustomerId FROM dbo.B
INTERSECT
SELECT CustomerId FROM dbo.C;
```

This may not mean what a reader casually expects. Prefer parentheses:

```sql
(
    SELECT CustomerId FROM dbo.A
    UNION
    SELECT CustomerId FROM dbo.B
)
INTERSECT
SELECT CustomerId FROM dbo.C;
```

Parentheses are not just style; they prevent business logic bugs.

### ORDER BY Rules

Set operator results are unordered unless the final query uses `ORDER BY`.

Correct:

```sql
SELECT CustomerId, Email
FROM dbo.Customers

UNION

SELECT SubscriberId, EmailAddress
FROM dbo.NewsletterSubscribers

ORDER BY Email;
```

Do not rely on the physical order of rows from individual inputs. Also remember that output column names come from the left query, so `ORDER BY` should reference the final output names or positions.

### Set Operators Vs Joins

Set operators combine or compare rows from separate result sets. Joins combine columns from related rows.

Use a join when:

- You need columns from both tables in the same output row.
- You are matching related entities.
- You need one-to-many detail rows.

Use a set operator when:

- The two queries already return the same shape.
- You want a union, difference, or intersection of rows.
- You are comparing two sets of keys or records.

Join example:

```sql
SELECT c.CustomerId, c.Email, o.OrderId
FROM dbo.Customers AS c
JOIN dbo.Orders AS o
    ON o.CustomerId = c.CustomerId;
```

Set operator example:

```sql
SELECT CustomerId
FROM dbo.Customers

INTERSECT

SELECT CustomerId
FROM dbo.Orders;
```

### EXCEPT And INTERSECT Vs EXISTS

`EXCEPT` and `INTERSECT` return distinct rows. `EXISTS` and `NOT EXISTS` can be better when you want semi-join logic tied to keys and do not want implicit distinct behavior across the full projection.

Example with `NOT EXISTS`:

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

This often expresses "customers with no orders" more explicitly than `EXCEPT`, especially when returning columns from one table and matching on a specific key.

Example with `EXCEPT`:

```sql
SELECT CustomerId
FROM dbo.Customers

EXCEPT

SELECT CustomerId
FROM dbo.Orders;
```

This is concise for comparing sets of IDs.

### Performance Considerations

Performance depends on data size, indexes, row width, duplicates, and plan choices.

General rules:

- `UNION ALL` is usually cheaper than `UNION`.
- `UNION`, `EXCEPT`, and `INTERSECT` perform distinct-style comparison.
- Wider projected rows cost more to compare.
- Indexes on compared columns can help.
- Sorting or hashing may require memory.
- Duplicate removal can hide data quality problems if used accidentally.

Example of avoiding unnecessary duplicate removal:

```sql
SELECT OrderId, OrderDate, Total
FROM dbo.CurrentOrders

UNION ALL

SELECT OrderId, OrderDate, Total
FROM dbo.ArchivedOrders;
```

If `CurrentOrders` and `ArchivedOrders` are guaranteed disjoint, `UNION ALL` avoids unnecessary duplicate elimination.

### Common Mistakes

Common mistakes include:

- Using `UNION` by habit when `UNION ALL` is correct.
- Accidentally removing duplicate transaction rows.
- Forgetting that duplicates are based on the full selected row.
- Reversing the sides of `EXCEPT`.
- Expecting `INTERSECT` to preserve duplicate counts.
- Mixing columns in the wrong order.
- Relying on order without a final `ORDER BY`.
- Ignoring `NULL` behavior in set comparisons.
- Combining several set operators without parentheses.

### Best Practices

Best practices:

- Use `UNION ALL` unless you explicitly need duplicate removal.
- Use `UNION` when you need a distinct combined set.
- Use `EXCEPT` for concise set difference checks.
- Use `INTERSECT` for concise overlap checks.
- Project only the columns that define equality for the business question.
- Add parentheses when mixing set operators.
- Use a final `ORDER BY` for deterministic presentation.
- Compare `EXCEPT` or `INTERSECT` with `EXISTS` or joins when performance or key-based semantics matter.
- Test with duplicates and `NULL` values, not only clean sample data.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is the difference between UNION and UNION ALL?

<!-- question:start:union-vs-union-all-except-intersect-and-duplicate-handling-beginner-q01 -->
<!-- question-id:union-vs-union-all-except-intersect-and-duplicate-handling-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

`UNION` combines result sets and removes duplicate rows. `UNION ALL` combines result sets and keeps all rows, including duplicates. `UNION ALL` is often faster because it does not need to perform duplicate elimination.

Use `UNION` when the business requirement is a distinct combined set. Use `UNION ALL` when duplicate rows are meaningful or when the inputs are already known to be disjoint.

##### Key Points to Mention

- `UNION` removes duplicates.
- `UNION ALL` keeps duplicates.
- `UNION ALL` is usually cheaper.
- Duplicates are based on the full projected row.
- Choose based on business meaning, not habit.

<!-- question:end:union-vs-union-all-except-intersect-and-duplicate-handling-beginner-q01 -->

#### What does EXCEPT do?

<!-- question:start:union-vs-union-all-except-intersect-and-duplicate-handling-beginner-q02 -->
<!-- question-id:union-vs-union-all-except-intersect-and-duplicate-handling-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

`EXCEPT` returns distinct rows from the left query that do not appear in the right query. It is useful for finding missing rows, comparing expected and actual results, and identifying records that exist in one source but not another.

Direction matters because `A EXCEPT B` is different from `B EXCEPT A`.

##### Key Points to Mention

- Returns rows from the left side only.
- Removes rows that also appear on the right side.
- Returns distinct rows.
- Direction matters.
- Useful for data comparison and reconciliation.

<!-- question:end:union-vs-union-all-except-intersect-and-duplicate-handling-beginner-q02 -->

#### What does INTERSECT do?

<!-- question:start:union-vs-union-all-except-intersect-and-duplicate-handling-beginner-q03 -->
<!-- question-id:union-vs-union-all-except-intersect-and-duplicate-handling-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

`INTERSECT` returns distinct rows that appear in both input queries. It is useful for finding overlap between two sets, such as customers that exist in both systems or users who satisfy two independent criteria.

It does not preserve duplicate counts. If a row appears many times on both sides, it still appears once in the result.

##### Key Points to Mention

- Returns common rows.
- Returns distinct rows.
- Useful for overlap checks.
- Does not preserve duplicate counts.
- Both sides must have compatible result shapes.

<!-- question:end:union-vs-union-all-except-intersect-and-duplicate-handling-beginner-q03 -->

#### What requirements must queries meet to use set operators?

<!-- question:start:union-vs-union-all-except-intersect-and-duplicate-handling-beginner-q04 -->
<!-- question-id:union-vs-union-all-except-intersect-and-duplicate-handling-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

The queries must return the same number of columns, the columns must be in the intended order, and corresponding columns must have compatible data types. SQL compares columns by ordinal position, not by name.

The final output column names are taken from the left query, so aliases and `ORDER BY` should be written with that in mind.

##### Key Points to Mention

- Same number of columns.
- Compatible data types.
- Column order matters.
- Column names do not drive matching.
- Output names come from the left query.

<!-- question:end:union-vs-union-all-except-intersect-and-duplicate-handling-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### Why can UNION produce incorrect reports for transaction data?

<!-- question:start:union-vs-union-all-except-intersect-and-duplicate-handling-intermediate-q01 -->
<!-- question-id:union-vs-union-all-except-intersect-and-duplicate-handling-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

`UNION` removes duplicate rows. In transaction data, two rows can be identical but still represent two real events. If `UNION` is used before aggregation, it can remove legitimate transactions and undercount totals.

For transaction streams, logs, audit records, and fact tables, `UNION ALL` is usually safer unless there is a clear requirement to deduplicate.

##### Key Points to Mention

- Duplicate transaction rows can be legitimate.
- `UNION` removes duplicates before later processing.
- Aggregates can become wrong.
- `UNION ALL` preserves event rows.
- Deduplicate only when the business rule requires it.

<!-- question:end:union-vs-union-all-except-intersect-and-duplicate-handling-intermediate-q01 -->

#### How are duplicates determined in a UNION query?

<!-- question:start:union-vs-union-all-except-intersect-and-duplicate-handling-intermediate-q02 -->
<!-- question-id:union-vs-union-all-except-intersect-and-duplicate-handling-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Duplicates are determined by the complete projected row. If two rows have the same value for one column but differ in another selected column, they are not duplicates. If the business definition of duplicate is based only on a key, then the query should project that key or use grouping, window functions, or a key-based filtering pattern.

This matters because adding an extra column to a `UNION` can change which rows are considered duplicates.

##### Key Points to Mention

- Duplicate comparison uses all selected columns.
- A business key may not match the projected row.
- Adding columns can change deduplication.
- Use `GROUP BY` or window functions for custom dedupe rules.
- Test with rows that differ in non-key columns.

<!-- question:end:union-vs-union-all-except-intersect-and-duplicate-handling-intermediate-q02 -->

#### How do EXCEPT and NOT EXISTS compare?

<!-- question:start:union-vs-union-all-except-intersect-and-duplicate-handling-intermediate-q03 -->
<!-- question-id:union-vs-union-all-except-intersect-and-duplicate-handling-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

`EXCEPT` compares two result sets and returns distinct rows from the left side that are not on the right side. `NOT EXISTS` tests for the absence of matching rows using a correlated condition, usually on a key.

`EXCEPT` is concise for comparing sets of projected values. `NOT EXISTS` is often clearer when matching by a specific key while returning columns from the left table.

##### Key Points to Mention

- `EXCEPT` is set difference.
- `NOT EXISTS` is a predicate-based anti-semi join pattern.
- `EXCEPT` returns distinct projected rows.
- `NOT EXISTS` makes matching keys explicit.
- Performance depends on indexes and query shape.

<!-- question:end:union-vs-union-all-except-intersect-and-duplicate-handling-intermediate-q03 -->

#### How does NULL behave with EXCEPT and INTERSECT?

<!-- question:start:union-vs-union-all-except-intersect-and-duplicate-handling-intermediate-q04 -->
<!-- question-id:union-vs-union-all-except-intersect-and-duplicate-handling-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

For `EXCEPT` and `INTERSECT`, SQL Server considers two `NULL` values equal when determining distinct rows. This differs from normal predicate logic where `Column = NULL` is not true and should be written as `Column IS NULL`.

This distinction matters in reconciliation queries because rows with `NULL` values may match or be removed by set operations.

##### Key Points to Mention

- Set comparison treats two `NULL` values as equal for distinct rows.
- Normal `WHERE` equality with `NULL` behaves differently.
- Reconciliation queries should test `NULL` cases.
- `NULL` behavior can change missing-row results.
- Avoid assuming all comparison rules are identical.

<!-- question:end:union-vs-union-all-except-intersect-and-duplicate-handling-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you choose between UNION, UNION ALL, and GROUP BY for deduplication?

<!-- question:start:union-vs-union-all-except-intersect-and-duplicate-handling-advanced-q01 -->
<!-- question-id:union-vs-union-all-except-intersect-and-duplicate-handling-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Use `UNION` when the business requirement is to combine result sets and remove duplicates across the full projected row. Use `UNION ALL` when duplicates are meaningful or when you will handle aggregation later. Use `GROUP BY` when deduplication has custom rules, such as grouping by a business key while calculating totals or choosing representative values.

For performance, avoid unnecessary duplicate removal and project only the columns needed for the dedupe rule.

##### Key Points to Mention

- `UNION` deduplicates the full projected row.
- `UNION ALL` preserves rows.
- `GROUP BY` supports custom aggregation.
- Business definition of duplicate drives the choice.
- Projecting fewer columns can reduce comparison cost.

<!-- question:end:union-vs-union-all-except-intersect-and-duplicate-handling-advanced-q01 -->

#### How can mixing INTERSECT, EXCEPT, and UNION create subtle bugs?

<!-- question:start:union-vs-union-all-except-intersect-and-duplicate-handling-advanced-q02 -->
<!-- question-id:union-vs-union-all-except-intersect-and-duplicate-handling-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Mixed set operators have precedence rules. SQL Server evaluates parentheses first, then `INTERSECT`, then `EXCEPT` and `UNION` from left to right. A developer may read the query in a different order and get the wrong business result.

Use parentheses to make intent explicit, especially in reconciliation, authorization, or reporting queries where a small logic change can affect many rows.

##### Key Points to Mention

- Operator precedence matters.
- `INTERSECT` has higher precedence than `EXCEPT` and `UNION`.
- `EXCEPT` and `UNION` are evaluated left to right.
- Parentheses clarify business logic.
- Mixed set operator queries should have tests.

<!-- question:end:union-vs-union-all-except-intersect-and-duplicate-handling-advanced-q02 -->

#### How would you compare two tables after a migration?

<!-- question:start:union-vs-union-all-except-intersect-and-duplicate-handling-advanced-q03 -->
<!-- question-id:union-vs-union-all-except-intersect-and-duplicate-handling-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Use `EXCEPT` in both directions to find rows missing from either side. First compare keys, then compare important normalized columns. For large tables, compare counts, checksums or hashes, and targeted samples, but do not rely only on aggregate checks because they can hide row-level mismatches.

Also handle `NULL` values intentionally, align data types and collations, and project columns in the same order.

##### Key Points to Mention

- Run `source EXCEPT target`.
- Run `target EXCEPT source`.
- Compare keys before full rows.
- Align column order and data types.
- Test `NULL` and collation issues.
- Use aggregates as signals, not complete proof.

<!-- question:end:union-vs-union-all-except-intersect-and-duplicate-handling-advanced-q03 -->

#### How do set operators affect execution plans and performance?

<!-- question:start:union-vs-union-all-except-intersect-and-duplicate-handling-advanced-q04 -->
<!-- question-id:union-vs-union-all-except-intersect-and-duplicate-handling-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

`UNION ALL` can often concatenate inputs without duplicate elimination. `UNION`, `EXCEPT`, and `INTERSECT` require distinct-style comparison, which may use sorting or hashing and can require memory. Wider rows and large inputs increase cost.

Indexes on compared columns, smaller projections, filtering early, and using `UNION ALL` when duplicates are allowed can improve performance. For key-based existence checks, `EXISTS` or `NOT EXISTS` may be clearer and sometimes faster.

##### Key Points to Mention

- `UNION ALL` avoids duplicate elimination.
- Distinct set operators can sort or hash.
- Row width and input size matter.
- Memory grants can become important.
- Filter early and project only needed columns.
- Compare with `EXISTS` patterns when appropriate.

<!-- question:end:union-vs-union-all-except-intersect-and-duplicate-handling-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
