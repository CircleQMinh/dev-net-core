---
id: select-where-order-by-top-offset-fetch
topic: Relational modeling and normalization
subtopic: SELECT, WHERE, ORDER BY, TOP/OFFSET-FETCH
category: SQL
---


## Overview

`SELECT`, `WHERE`, `ORDER BY`, `TOP`, and `OFFSET-FETCH` are foundational SQL clauses used to retrieve, filter, sort, and limit data from relational databases. In SQL Server and Azure SQL, these clauses appear in almost every read query, from simple lookup screens to complex reporting, API pagination, dashboard queries, and data validation scripts.

At a high level:

- `SELECT` defines which columns or expressions are returned.
- `WHERE` filters rows before they are returned.
- `ORDER BY` sorts the final result set.
- `TOP` limits the number or percentage of rows returned.
- `OFFSET-FETCH` skips a number of sorted rows and fetches the next page of rows.

Example:

```sql
SELECT TOP (10)
    c.CustomerId,
    c.FullName,
    c.Email,
    c.CreatedAt
FROM dbo.Customers AS c
WHERE c.IsActive = 1
ORDER BY c.CreatedAt DESC, c.CustomerId DESC;
```

Example with pagination:

```sql
DECLARE @PageNumber int = 2;
DECLARE @PageSize int = 20;

SELECT
    o.OrderId,
    o.CustomerId,
    o.OrderDate,
    o.TotalAmount
FROM dbo.Orders AS o
WHERE o.Status = 'Completed'
ORDER BY o.OrderDate DESC, o.OrderId DESC
OFFSET (@PageNumber - 1) * @PageSize ROWS
FETCH NEXT @PageSize ROWS ONLY;
```

These clauses matter because even simple SQL queries can become incorrect, slow, or nondeterministic if written carelessly. For example, using `TOP` without `ORDER BY` can return unpredictable rows. Filtering with non-sargable expressions can prevent index seeks. Pagination with `OFFSET-FETCH` can become slow for deep pages. `SELECT *` can return unnecessary data and make APIs fragile when table schemas change.

This topic is important for interviews because it tests whether a developer understands SQL basics at a practical level. Interviewers often ask candidates to write queries, explain query behavior, reason about sorting and filtering, and discuss performance implications. A strong answer should cover not only syntax but also correctness, determinism, index usage, pagination trade-offs, and common mistakes.

## Core Concepts

### Basic SELECT Syntax

The `SELECT` statement retrieves rows from one or more tables, views, common table expressions, derived tables, or table-valued functions.

Basic syntax:

```sql
SELECT column_list
FROM table_name;
```

Example:

```sql
SELECT
    CustomerId,
    FullName,
    Email
FROM dbo.Customers;
```

The `SELECT` list can contain:

- Column names.
- Aliases.
- Expressions.
- Function calls.
- Constants.
- Calculated values.
- Scalar subqueries.

Example:

```sql
SELECT
    o.OrderId,
    o.TotalAmount,
    o.TotalAmount * 0.10 AS EstimatedTax,
    'Completed Order' AS OrderType
FROM dbo.Orders AS o
WHERE o.Status = 'Completed';
```

Best practices:

- Select only the columns needed.
- Use clear aliases for calculated columns.
- Use table aliases when querying multiple tables.
- Avoid `SELECT *` in production application queries.
- Keep presentation formatting mostly outside SQL unless the query is specifically for reporting.

### SELECT * and Why It Is Usually Avoided

`SELECT *` returns all columns from the source table or joined sources.

Example:

```sql
SELECT *
FROM dbo.Customers;
```

This is convenient for quick exploration but risky in production code.

Problems with `SELECT *`:

- Returns unnecessary data.
- Increases network traffic.
- Can prevent covering-index usage.
- Makes API contracts fragile.
- Can break code when columns are added, removed, or reordered.
- Can expose sensitive columns accidentally.
- Makes query intent less clear.

Better:

```sql
SELECT
    CustomerId,
    FullName,
    Email
FROM dbo.Customers;
```

Use `SELECT *` mainly for quick ad-hoc investigation, not stable application code.

### Column Aliases

An alias gives a result column a readable name.

```sql
SELECT
    c.CustomerId,
    c.FirstName + ' ' + c.LastName AS FullName,
    c.CreatedAt AS RegisteredAt
FROM dbo.Customers AS c;
```

In SQL Server, `ORDER BY` can reference a select-list alias:

```sql
SELECT
    c.FirstName + ' ' + c.LastName AS FullName
FROM dbo.Customers AS c
ORDER BY FullName;
```

But `WHERE` generally cannot reference a select-list alias because `WHERE` is logically evaluated before the `SELECT` list.

Invalid:

```sql
SELECT
    c.FirstName + ' ' + c.LastName AS FullName
FROM dbo.Customers AS c
WHERE FullName LIKE 'A%';
```

Better:

```sql
SELECT
    c.FirstName + ' ' + c.LastName AS FullName
FROM dbo.Customers AS c
WHERE c.FirstName + ' ' + c.LastName LIKE 'A%';
```

Or use a derived table or CTE when the expression should be named first.

```sql
WITH CustomerNames AS
(
    SELECT
        c.CustomerId,
        c.FirstName + ' ' + c.LastName AS FullName
    FROM dbo.Customers AS c
)
SELECT
    CustomerId,
    FullName
FROM CustomerNames
WHERE FullName LIKE 'A%';
```

### Logical Query Processing Order

SQL is declarative. You describe the result you want, and the optimizer decides how to execute it. However, understanding logical query processing helps avoid many mistakes.

A simplified logical order for a basic query is:

```text
FROM
WHERE
SELECT
ORDER BY
TOP / OFFSET-FETCH result limiting
```

This explains why:

- `WHERE` filters rows before final projection.
- `WHERE` usually cannot use a `SELECT` alias.
- `ORDER BY` can sort by selected expressions or aliases.
- `TOP` is only predictable when applied with a deterministic `ORDER BY`.
- `OFFSET-FETCH` requires an `ORDER BY` because paging only makes sense over a defined order.

Important: this is logical reasoning, not necessarily the physical execution order. SQL Server's optimizer can reorder operations internally when it preserves the same result.

### WHERE Clause

The `WHERE` clause filters rows based on a search condition.

Basic syntax:

```sql
SELECT column_list
FROM table_name
WHERE search_condition;
```

Example:

```sql
SELECT
    CustomerId,
    FullName,
    Email
FROM dbo.Customers
WHERE IsActive = 1;
```

Common predicates:

```sql
-- Equality
WHERE Status = 'Completed'

-- Inequality
WHERE Status <> 'Cancelled'

-- Range
WHERE CreatedAt >= '2026-01-01'
  AND CreatedAt <  '2026-02-01'

-- IN list
WHERE Status IN ('Completed', 'Shipped')

-- Pattern matching
WHERE Email LIKE '%@example.com'

-- NULL check
WHERE DeletedAt IS NULL

-- Multiple conditions
WHERE IsActive = 1
  AND CreatedAt >= '2026-01-01'
```

`WHERE` is one of the most important clauses for performance because it determines how many rows are read, filtered, joined, sorted, and returned.

### Boolean Logic in WHERE

SQL uses Boolean logic with `AND`, `OR`, and `NOT`.

```sql
SELECT
    ProductId,
    Name,
    Price
FROM dbo.Products
WHERE CategoryId = 5
  AND Price >= 100
  AND IsActive = 1;
```

`AND` requires all conditions to be true.

```sql
SELECT
    ProductId,
    Name,
    Price
FROM dbo.Products
WHERE CategoryId = 5
   OR CategoryId = 8;
```

`OR` requires at least one condition to be true.

Use parentheses to make intent explicit:

```sql
SELECT
    ProductId,
    Name,
    Price
FROM dbo.Products
WHERE IsActive = 1
  AND (CategoryId = 5 OR CategoryId = 8);
```

Without parentheses, operator precedence can produce unexpected results.

### NULL Handling in WHERE

`NULL` means unknown or missing value. It is not equal to anything, including another `NULL`.

Incorrect:

```sql
SELECT
    CustomerId,
    FullName
FROM dbo.Customers
WHERE DeletedAt = NULL;
```

Correct:

```sql
SELECT
    CustomerId,
    FullName
FROM dbo.Customers
WHERE DeletedAt IS NULL;
```

To find non-null values:

```sql
SELECT
    CustomerId,
    FullName
FROM dbo.Customers
WHERE DeletedAt IS NOT NULL;
```

Important behavior:

```sql
WHERE MiddleName <> 'John'
```

This does not return rows where `MiddleName` is `NULL`, because the comparison is unknown, not true.

If you want rows that are either not `John` or missing:

```sql
WHERE MiddleName <> 'John'
   OR MiddleName IS NULL;
```

Interview point: SQL uses three-valued logic: true, false, and unknown.

### BETWEEN, IN, and LIKE

`BETWEEN` checks an inclusive range.

```sql
SELECT
    OrderId,
    OrderDate
FROM dbo.Orders
WHERE OrderDate BETWEEN '2026-01-01' AND '2026-01-31';
```

For datetime columns, this can be risky because it includes only rows exactly up to midnight at the end date if the end value is interpreted as `2026-01-31 00:00:00`.

Safer date range:

```sql
SELECT
    OrderId,
    OrderDate
FROM dbo.Orders
WHERE OrderDate >= '2026-01-01'
  AND OrderDate <  '2026-02-01';
```

`IN` checks membership in a list.

```sql
SELECT
    OrderId,
    Status
FROM dbo.Orders
WHERE Status IN ('Completed', 'Shipped', 'Delivered');
```

`LIKE` performs pattern matching.

```sql
SELECT
    CustomerId,
    Email
FROM dbo.Customers
WHERE Email LIKE 'admin%';
```

Common wildcards:

| Wildcard | Meaning |
|---|---|
| `%` | Any sequence of characters |
| `_` | Any single character |
| `[abc]` | Any one character in the list |
| `[a-z]` | Any one character in the range |

Performance note:

```sql
WHERE Email LIKE 'admin%'
```

can often use an index more effectively than:

```sql
WHERE Email LIKE '%admin%'
```

A leading wildcard usually prevents a normal index seek.

### Sargability

Sargability means a predicate can effectively use an index seek. A sargable predicate allows SQL Server to search directly for matching rows instead of scanning many rows.

Sargable:

```sql
WHERE CreatedAt >= '2026-01-01'
  AND CreatedAt <  '2026-02-01'
```

Often non-sargable:

```sql
WHERE YEAR(CreatedAt) = 2026
  AND MONTH(CreatedAt) = 1
```

The second query applies functions to the column, which can make it harder for SQL Server to use an index on `CreatedAt` efficiently.

Better:

```sql
WHERE CreatedAt >= '2026-01-01'
  AND CreatedAt <  '2026-02-01'
```

Other common non-sargable patterns:

```sql
WHERE LOWER(Email) = 'user@example.com'
WHERE ISNULL(Status, '') = 'Completed'
WHERE Price + 10 > 100
WHERE CAST(CreatedAt AS date) = '2026-01-01'
```

Better patterns:

```sql
WHERE Email = 'user@example.com'
WHERE Status = 'Completed'
WHERE Price > 90
WHERE CreatedAt >= '2026-01-01'
  AND CreatedAt <  '2026-01-02'
```

Sargability is a frequent interview topic because it connects basic SQL syntax to real performance.

### ORDER BY Clause

`ORDER BY` sorts the result set.

Basic syntax:

```sql
SELECT column_list
FROM table_name
ORDER BY column_name [ASC | DESC];
```

Example:

```sql
SELECT
    ProductId,
    Name,
    Price
FROM dbo.Products
ORDER BY Price DESC;
```

`ASC` means ascending order and is the default. `DESC` means descending order.

Multiple columns:

```sql
SELECT
    OrderId,
    CustomerId,
    OrderDate,
    TotalAmount
FROM dbo.Orders
ORDER BY OrderDate DESC, OrderId DESC;
```

This sorts newest orders first. If two orders have the same `OrderDate`, `OrderId` breaks the tie.

Best practices:

- Use `ORDER BY` whenever result order matters.
- Include a unique tie-breaker for deterministic pagination.
- Avoid ordinal positions like `ORDER BY 2` in production code.
- Be aware that sorting large result sets can be expensive.
- Use indexes that support common sort patterns when performance matters.

### Result Order Is Not Guaranteed Without ORDER BY

SQL tables represent unordered sets of rows. Without `ORDER BY`, SQL Server does not guarantee result order.

Unreliable:

```sql
SELECT
    CustomerId,
    FullName
FROM dbo.Customers;
```

Even if rows appear ordered during testing, that order can change because of:

- Different execution plans.
- Index changes.
- Parallelism.
- Statistics updates.
- New rows.
- Page splits.
- SQL Server version changes.

Reliable:

```sql
SELECT
    CustomerId,
    FullName
FROM dbo.Customers
ORDER BY FullName ASC, CustomerId ASC;
```

Interview point: if order matters, always use `ORDER BY`.

### Deterministic Ordering

A deterministic order means rows are returned in a stable, predictable sequence. This is especially important for `TOP` and pagination.

Potentially nondeterministic:

```sql
SELECT TOP (10)
    OrderId,
    OrderDate,
    TotalAmount
FROM dbo.Orders
ORDER BY OrderDate DESC;
```

If many rows share the same `OrderDate`, SQL Server can return any 10 among tied rows.

More deterministic:

```sql
SELECT TOP (10)
    OrderId,
    OrderDate,
    TotalAmount
FROM dbo.Orders
ORDER BY OrderDate DESC, OrderId DESC;
```

`OrderId` acts as a tie-breaker.

For pagination, deterministic ordering is critical. Without a unique tie-breaker, rows can appear on multiple pages or be skipped when ties exist.

### ORDER BY and Indexes

Sorting can be expensive. SQL Server may need a Sort operator if no useful index supports the order.

Query:

```sql
SELECT
    OrderId,
    CustomerId,
    OrderDate,
    TotalAmount
FROM dbo.Orders
WHERE CustomerId = @CustomerId
ORDER BY OrderDate DESC, OrderId DESC;
```

Helpful index:

```sql
CREATE INDEX IX_Orders_CustomerId_OrderDate_OrderId
ON dbo.Orders (CustomerId, OrderDate DESC, OrderId DESC)
INCLUDE (TotalAmount);
```

This index helps because it supports both the filter and the sort.

Important trade-off:

- Indexes improve reads.
- Indexes add storage cost.
- Indexes slow writes because they must be maintained.
- Too many indexes can hurt insert/update/delete performance.

Interview point: `WHERE` and `ORDER BY` should be considered together when designing indexes.

### TOP Clause

`TOP` limits the number or percentage of rows returned by a query.

Syntax:

```sql
SELECT TOP (expression) column_list
FROM table_name
ORDER BY column_name;
```

Example:

```sql
SELECT TOP (5)
    ProductId,
    Name,
    Price
FROM dbo.Products
ORDER BY Price DESC;
```

This returns the five most expensive products.

`TOP` can also use variables:

```sql
DECLARE @Limit int = 10;

SELECT TOP (@Limit)
    OrderId,
    OrderDate,
    TotalAmount
FROM dbo.Orders
ORDER BY OrderDate DESC;
```

Best practice: use parentheses around the `TOP` expression.

### TOP Without ORDER BY

`TOP` without `ORDER BY` returns an arbitrary set of rows. It does not mean the first rows inserted, newest rows, or lowest primary keys unless you explicitly sort.

Unreliable:

```sql
SELECT TOP (10)
    OrderId,
    OrderDate
FROM dbo.Orders;
```

Reliable newest orders:

```sql
SELECT TOP (10)
    OrderId,
    OrderDate
FROM dbo.Orders
ORDER BY OrderDate DESC, OrderId DESC;
```

Interview point: `TOP` should almost always be paired with `ORDER BY` in `SELECT` queries when the specific rows matter.

### TOP WITH TIES

`WITH TIES` returns additional rows that tie with the last row based on the `ORDER BY` expression.

Example:

```sql
SELECT TOP (3) WITH TIES
    EmployeeId,
    FullName,
    SalesAmount
FROM dbo.EmployeeSales
ORDER BY SalesAmount DESC;
```

If the third-highest sales amount is shared by multiple employees, all tied employees are returned. This means the result can contain more than 3 rows.

Use `WITH TIES` when business logic requires all rows tied at the cutoff.

Example use cases:

- Top-scoring students.
- Highest-selling employees.
- Top products by rating.
- Shared ranking cutoff.

### TOP PERCENT

`TOP PERCENT` returns a percentage of rows.

```sql
SELECT TOP (10) PERCENT
    ProductId,
    Name,
    Price
FROM dbo.Products
ORDER BY Price DESC;
```

This returns approximately the top 10 percent of products by price.

In application development, `TOP (n)` is more common than `TOP PERCENT` because APIs and pages usually need a fixed number of rows.

### OFFSET-FETCH

`OFFSET-FETCH` is part of the `ORDER BY` clause and is used for pagination.

Syntax:

```sql
SELECT column_list
FROM table_name
ORDER BY sort_column
OFFSET @Offset ROWS
FETCH NEXT @PageSize ROWS ONLY;
```

Example:

```sql
DECLARE @PageNumber int = 3;
DECLARE @PageSize int = 25;

SELECT
    ProductId,
    Name,
    Price
FROM dbo.Products
ORDER BY Name ASC, ProductId ASC
OFFSET (@PageNumber - 1) * @PageSize ROWS
FETCH NEXT @PageSize ROWS ONLY;
```

This skips rows from earlier pages and returns the next page.

Important rules:

- `OFFSET-FETCH` requires `ORDER BY`.
- `OFFSET` can be used without `FETCH` to skip rows.
- `FETCH` requires `OFFSET`.
- Deterministic ordering is important.
- Deep pagination can become slow.

### TOP vs OFFSET-FETCH

`TOP` and `OFFSET-FETCH` both limit rows, but they are used for different scenarios.

| Feature | TOP | OFFSET-FETCH |
|---|---|---|
| Main use | Return first N rows | Pagination |
| Requires ORDER BY syntactically | No | Yes |
| Requires ORDER BY for predictable rows | Yes | Yes |
| Can skip rows | No | Yes |
| Can return ties | Yes, with `WITH TIES` | No direct `WITH TIES` |
| Common API use | Latest 10, top 5, sample preview | Page 1, page 2, page 3 |

Use `TOP` for:

```sql
SELECT TOP (10) ... ORDER BY CreatedAt DESC;
```

Use `OFFSET-FETCH` for:

```sql
ORDER BY CreatedAt DESC, Id DESC
OFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY;
```

### Pagination with OFFSET-FETCH

Typical pagination query:

```sql
DECLARE @PageNumber int = 1;
DECLARE @PageSize int = 20;

SELECT
    c.CustomerId,
    c.FullName,
    c.Email,
    c.CreatedAt
FROM dbo.Customers AS c
WHERE c.IsActive = 1
ORDER BY c.CreatedAt DESC, c.CustomerId DESC
OFFSET (@PageNumber - 1) * @PageSize ROWS
FETCH NEXT @PageSize ROWS ONLY;
```

Important details:

- Always use a stable `ORDER BY`.
- Add a unique tie-breaker such as primary key.
- Validate page number and page size.
- Set a maximum page size.
- Add indexes for common filter and sort patterns.
- Avoid deep pagination when performance matters.

Example validation rule in application code:

```text
PageNumber must be >= 1.
PageSize must be between 1 and 100.
```

### Deep Pagination Problem

`OFFSET-FETCH` can become slow for deep pages because SQL Server still has to process and skip many rows.

Example:

```sql
SELECT
    OrderId,
    OrderDate,
    TotalAmount
FROM dbo.Orders
ORDER BY OrderDate DESC, OrderId DESC
OFFSET 100000 ROWS
FETCH NEXT 50 ROWS ONLY;
```

This asks SQL Server to skip 100,000 rows and return 50. Even with indexes, deep offsets can be expensive.

Possible alternatives:

- Keyset pagination.
- Seek method pagination.
- Search-after pagination.
- Restrict maximum page depth.
- Use filters to reduce the result set.
- Use cursor-like continuation tokens.

### Keyset Pagination

Keyset pagination uses the last seen sort key instead of an offset. It is often faster and more stable for large tables.

First page:

```sql
SELECT TOP (@PageSize)
    OrderId,
    OrderDate,
    TotalAmount
FROM dbo.Orders
WHERE Status = 'Completed'
ORDER BY OrderDate DESC, OrderId DESC;
```

Next page using the last row from the previous page:

```sql
DECLARE @LastOrderDate datetime2 = '2026-05-01T10:30:00';
DECLARE @LastOrderId bigint = 12345;
DECLARE @PageSize int = 20;

SELECT TOP (@PageSize)
    OrderId,
    OrderDate,
    TotalAmount
FROM dbo.Orders
WHERE Status = 'Completed'
  AND
  (
      OrderDate < @LastOrderDate
      OR (OrderDate = @LastOrderDate AND OrderId < @LastOrderId)
  )
ORDER BY OrderDate DESC, OrderId DESC;
```

Benefits:

- Avoids skipping large numbers of rows.
- More efficient for deep browsing.
- More stable when rows are inserted between page requests.

Trade-offs:

- Harder to jump directly to page 50.
- Requires stable sort keys.
- Client must remember the last key.
- More complex than `OFFSET-FETCH`.

Use keyset pagination for infinite scroll, activity feeds, large order lists, and high-scale APIs.

### Filtering Before Sorting and Paging

A typical query filters first, then sorts and limits the matching result set.

```sql
SELECT
    OrderId,
    CustomerId,
    OrderDate,
    TotalAmount
FROM dbo.Orders
WHERE CustomerId = @CustomerId
  AND Status = 'Completed'
ORDER BY OrderDate DESC, OrderId DESC
OFFSET 0 ROWS
FETCH NEXT 20 ROWS ONLY;
```

The index should often support both filtering and sorting.

Possible index:

```sql
CREATE INDEX IX_Orders_Customer_Status_Date_Id
ON dbo.Orders (CustomerId, Status, OrderDate DESC, OrderId DESC)
INCLUDE (TotalAmount);
```

This can reduce the need to scan, sort, and lookup extra data.

### Common Query Patterns

#### Latest N Records

```sql
SELECT TOP (10)
    OrderId,
    CustomerId,
    OrderDate,
    TotalAmount
FROM dbo.Orders
ORDER BY OrderDate DESC, OrderId DESC;
```

#### Active Records Only

```sql
SELECT
    ProductId,
    Name,
    Price
FROM dbo.Products
WHERE IsActive = 1
ORDER BY Name ASC;
```

#### Search by Prefix

```sql
SELECT
    CustomerId,
    FullName,
    Email
FROM dbo.Customers
WHERE FullName LIKE @SearchText + '%'
ORDER BY FullName ASC, CustomerId ASC;
```

#### API Pagination

```sql
SELECT
    TicketId,
    Title,
    Status,
    CreatedAt
FROM dbo.SupportTickets
WHERE Status = @Status
ORDER BY CreatedAt DESC, TicketId DESC
OFFSET @Offset ROWS
FETCH NEXT @PageSize ROWS ONLY;
```

#### Top Customers by Revenue

```sql
SELECT TOP (10)
    c.CustomerId,
    c.FullName,
    SUM(o.TotalAmount) AS TotalRevenue
FROM dbo.Customers AS c
INNER JOIN dbo.Orders AS o
    ON o.CustomerId = c.CustomerId
WHERE o.Status = 'Completed'
GROUP BY
    c.CustomerId,
    c.FullName
ORDER BY TotalRevenue DESC, c.CustomerId ASC;
```

### Performance Considerations

Important performance points:

- `WHERE` predicates should be sargable when possible.
- Use indexes that match common filters and sort orders.
- Avoid returning unnecessary columns.
- Avoid sorting huge result sets without indexes.
- Use `TOP` with `ORDER BY` for predictable limited results.
- Use `OFFSET-FETCH` for simple pagination.
- Avoid deep `OFFSET` pagination for large tables.
- Use keyset pagination for large or high-traffic lists.
- Watch for implicit conversions that prevent index usage.
- Avoid functions on indexed columns in predicates.
- Use query execution plans to validate assumptions.
- Parameterize queries from application code.

### Implicit Conversion Problems

Implicit conversions can hurt performance when SQL Server must convert a column value before comparison.

Example problem:

```sql
-- CustomerId is int, but @CustomerId is nvarchar
WHERE CustomerId = @CustomerId
```

If data types do not match, SQL Server may convert values and reduce index effectiveness.

Better:

```sql
-- @CustomerId should be int
WHERE CustomerId = @CustomerId
```

Best practices:

- Match parameter types to column types.
- Avoid comparing strings to numeric columns.
- Avoid comparing different date/time types carelessly.
- Use correct parameter sizes for strings.
- Watch execution plans for implicit conversion warnings.

### SQL Injection and Parameterized Queries

`WHERE` clauses are often built from user input. Never concatenate raw user input into SQL strings.

Unsafe:

```csharp
var sql = "SELECT * FROM dbo.Customers WHERE Email = '" + email + "'";
```

Safe with parameters:

```csharp
var sql = "SELECT CustomerId, FullName, Email FROM dbo.Customers WHERE Email = @Email";
```

In application code, use parameterized queries, stored procedures with parameters, or an ORM that parameterizes values correctly.

Parameterized SQL protects against SQL injection and helps query plan reuse.

### Common Mistakes

Common mistakes include:

- Using `SELECT *` in application queries.
- Using `TOP` without `ORDER BY` when specific rows matter.
- Using `ORDER BY` only during testing and assuming natural order in production.
- Using `OFFSET-FETCH` without a unique tie-breaker.
- Allowing very large page sizes.
- Using deep offset pagination on large tables.
- Applying functions to indexed columns in `WHERE`.
- Using `BETWEEN` incorrectly with datetime ranges.
- Comparing to `NULL` with `=` instead of `IS NULL`.
- Forgetting parentheses around mixed `AND` and `OR` logic.
- Creating indexes for every query without considering write cost.
- Ignoring implicit conversions.
- Sorting by ordinal position such as `ORDER BY 1` in production code.
- Building SQL with string concatenation from user input.

### Best Practices

Select only needed columns.

Use explicit column names instead of `SELECT *` in production queries.

Use `WHERE` to reduce rows as early as possible logically.

Write sargable predicates.

Use `IS NULL` and `IS NOT NULL` for null checks.

Use half-open date ranges for datetime filtering.

Use `ORDER BY` whenever result order matters.

Add a unique tie-breaker to `ORDER BY` for deterministic results.

Use `TOP` with `ORDER BY` when returning the first N rows.

Use `OFFSET-FETCH` for simple page-number pagination.

Use keyset pagination for large, deep, or high-traffic pagination.

Validate page size and page number in application code.

Match parameter data types to column data types.

Use parameterized queries to avoid SQL injection.

Design indexes based on common `WHERE` and `ORDER BY` patterns.

Read execution plans when performance matters.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:select-where-order-by-top-offset-fetch-beginner-q01 -->
#### Beginner Q01: What does the SELECT statement do?

<!-- question-id:select-where-order-by-top-offset-fetch-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

`SELECT` retrieves data from a database. It defines which columns, expressions, or calculated values should be returned in the result set.

Example:

```sql
SELECT
    CustomerId,
    FullName,
    Email
FROM dbo.Customers;
```

This query returns three columns from the `Customers` table.

##### Key Points to Mention

- `SELECT` retrieves rows and columns.
- The select list controls returned columns.
- It can include expressions and aliases.
- Usually used with `FROM`.
- Avoid `SELECT *` in production queries.
- It is the basic read operation in SQL.

<!-- question:end:select-where-order-by-top-offset-fetch-beginner-q01 -->

<!-- question:start:select-where-order-by-top-offset-fetch-beginner-q02 -->
#### Beginner Q02: What does the WHERE clause do?

<!-- question-id:select-where-order-by-top-offset-fetch-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`WHERE` filters rows based on a condition. Only rows where the condition evaluates to true are returned.

Example:

```sql
SELECT
    CustomerId,
    FullName
FROM dbo.Customers
WHERE IsActive = 1;
```

This query returns only active customers.

##### Key Points to Mention

- `WHERE` filters rows.
- It uses predicates or search conditions.
- Common operators include `=`, `<>`, `>`, `<`, `IN`, `LIKE`, and `BETWEEN`.
- Use `IS NULL` for null checks.
- Good `WHERE` clauses improve performance by reducing rows.
- Sargable predicates can use indexes more effectively.

<!-- question:end:select-where-order-by-top-offset-fetch-beginner-q02 -->

<!-- question:start:select-where-order-by-top-offset-fetch-beginner-q03 -->
#### Beginner Q03: What does ORDER BY do?

<!-- question-id:select-where-order-by-top-offset-fetch-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`ORDER BY` sorts the result set. It can sort ascending with `ASC` or descending with `DESC`. If no direction is specified, ascending order is the default.

Example:

```sql
SELECT
    ProductId,
    Name,
    Price
FROM dbo.Products
ORDER BY Price DESC;
```

This returns products sorted by price from highest to lowest.

##### Key Points to Mention

- `ORDER BY` controls result order.
- `ASC` means ascending.
- `DESC` means descending.
- Without `ORDER BY`, result order is not guaranteed.
- Multiple columns can be used.
- Sorting can be expensive for large result sets.

<!-- question:end:select-where-order-by-top-offset-fetch-beginner-q03 -->

<!-- question:start:select-where-order-by-top-offset-fetch-beginner-q04 -->
#### Beginner Q04: Why is result order not guaranteed without ORDER BY?

<!-- question-id:select-where-order-by-top-offset-fetch-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Relational tables do not represent rows in a guaranteed order. Without `ORDER BY`, SQL Server can return rows in any order based on the execution plan, indexes, parallelism, statistics, or storage layout. The order may appear stable during testing but change later.

If the application needs a specific order, the query must include `ORDER BY`.

##### Key Points to Mention

- Tables are unordered logical sets.
- Physical storage order is not a reliable result order.
- Execution plans can change.
- Index changes can change output order.
- Always use `ORDER BY` when order matters.
- This is especially important with `TOP` and pagination.

<!-- question:end:select-where-order-by-top-offset-fetch-beginner-q04 -->

<!-- question:start:select-where-order-by-top-offset-fetch-beginner-q05 -->
#### Beginner Q05: What does TOP do in SQL Server?

<!-- question-id:select-where-order-by-top-offset-fetch-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

`TOP` limits the number or percentage of rows returned by a query.

Example:

```sql
SELECT TOP (10)
    OrderId,
    OrderDate,
    TotalAmount
FROM dbo.Orders
ORDER BY OrderDate DESC;
```

This returns the 10 most recent orders based on `OrderDate`.

`TOP` should normally be used with `ORDER BY` when the specific rows matter.

##### Key Points to Mention

- `TOP` limits rows.
- Use parentheses: `TOP (10)`.
- Use `ORDER BY` for predictable results.
- Can use variables.
- Supports `PERCENT` and `WITH TIES`.
- Useful for top N queries and previews.

<!-- question:end:select-where-order-by-top-offset-fetch-beginner-q05 -->

<!-- question:start:select-where-order-by-top-offset-fetch-beginner-q06 -->
#### Beginner Q06: What is OFFSET-FETCH used for?

<!-- question-id:select-where-order-by-top-offset-fetch-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

`OFFSET-FETCH` is used for pagination. It skips a number of rows and returns the next set of rows. It is part of the `ORDER BY` clause.

Example:

```sql
SELECT
    ProductId,
    Name
FROM dbo.Products
ORDER BY Name ASC, ProductId ASC
OFFSET 20 ROWS
FETCH NEXT 10 ROWS ONLY;
```

This skips the first 20 sorted rows and returns the next 10.

##### Key Points to Mention

- Used for pagination.
- Requires `ORDER BY`.
- `OFFSET` skips rows.
- `FETCH NEXT` returns the next rows.
- Use deterministic ordering.
- Deep pagination can be slow.

<!-- question:end:select-where-order-by-top-offset-fetch-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:select-where-order-by-top-offset-fetch-intermediate-q01 -->
#### Intermediate Q01: Why should TOP usually be used with ORDER BY?

<!-- question-id:select-where-order-by-top-offset-fetch-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

`TOP` limits rows, but without `ORDER BY`, SQL Server does not know which rows are considered first in a meaningful way. The query can return any matching rows depending on the execution plan. If the requirement is top 10 newest orders, top 5 highest prices, or first 20 alphabetically, `ORDER BY` is required.

Example:

```sql
SELECT TOP (10)
    OrderId,
    OrderDate
FROM dbo.Orders
ORDER BY OrderDate DESC, OrderId DESC;
```

The tie-breaker makes the result more deterministic.

##### Key Points to Mention

- `TOP` without `ORDER BY` is nondeterministic.
- `ORDER BY` defines which rows are first.
- Add a tie-breaker for stable results.
- Important for correctness, not just performance.
- SQL Server may change row order between executions.
- Use `WITH TIES` if tied rows at the cutoff should be included.

<!-- question:end:select-where-order-by-top-offset-fetch-intermediate-q01 -->

<!-- question:start:select-where-order-by-top-offset-fetch-intermediate-q02 -->
#### Intermediate Q02: What is the difference between TOP and OFFSET-FETCH?

<!-- question-id:select-where-order-by-top-offset-fetch-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

`TOP` returns the first N rows from a query result, usually after sorting. It is best for top N scenarios such as latest 10 orders or highest 5 prices.

`OFFSET-FETCH` is used for pagination. It skips a number of sorted rows and fetches the next page.

Example `TOP`:

```sql
SELECT TOP (10) *
FROM dbo.Orders
ORDER BY OrderDate DESC;
```

Example `OFFSET-FETCH`:

```sql
SELECT *
FROM dbo.Orders
ORDER BY OrderDate DESC, OrderId DESC
OFFSET 20 ROWS
FETCH NEXT 10 ROWS ONLY;
```

##### Key Points to Mention

- `TOP` limits first N rows.
- `OFFSET-FETCH` supports paging.
- `OFFSET-FETCH` requires `ORDER BY`.
- `TOP` should use `ORDER BY` for predictable results.
- `TOP` supports `WITH TIES`.
- `OFFSET-FETCH` can be slow for deep pages.

<!-- question:end:select-where-order-by-top-offset-fetch-intermediate-q02 -->

<!-- question:start:select-where-order-by-top-offset-fetch-intermediate-q03 -->
#### Intermediate Q03: What is a sargable WHERE predicate?

<!-- question-id:select-where-order-by-top-offset-fetch-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A sargable predicate is a search condition that can effectively use an index seek. It usually avoids applying functions or calculations to the indexed column.

Non-sargable example:

```sql
WHERE YEAR(CreatedAt) = 2026
```

Better:

```sql
WHERE CreatedAt >= '2026-01-01'
  AND CreatedAt <  '2027-01-01'
```

The second form is more index-friendly because it compares the column directly to range values.

##### Key Points to Mention

- Sargable predicates help index seeks.
- Avoid functions on indexed columns.
- Avoid calculations on columns in predicates.
- Use range predicates for dates.
- Match parameter types to column types.
- Sargability affects performance significantly.

<!-- question:end:select-where-order-by-top-offset-fetch-intermediate-q03 -->

<!-- question:start:select-where-order-by-top-offset-fetch-intermediate-q04 -->
#### Intermediate Q04: Why can SELECT * hurt performance and maintainability?

<!-- question-id:select-where-order-by-top-offset-fetch-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

`SELECT *` returns all columns, including columns the application may not need. This increases network traffic, memory usage, and sometimes prevents efficient use of covering indexes. It also makes code fragile because adding a column to a table changes the result shape.

It can also expose sensitive data accidentally.

Production queries should usually list only required columns.

##### Key Points to Mention

- Returns unnecessary data.
- Increases network and memory usage.
- Can prevent covering-index benefits.
- Makes result contracts fragile.
- Can expose sensitive columns.
- Use explicit column lists in application code.

<!-- question:end:select-where-order-by-top-offset-fetch-intermediate-q04 -->

<!-- question:start:select-where-order-by-top-offset-fetch-intermediate-q05 -->
#### Intermediate Q05: How do you write a safe date filter for one month?

<!-- question-id:select-where-order-by-top-offset-fetch-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use a half-open range: greater than or equal to the start date and less than the next period start.

Example:

```sql
SELECT
    OrderId,
    OrderDate
FROM dbo.Orders
WHERE OrderDate >= '2026-01-01'
  AND OrderDate <  '2026-02-01';
```

This works correctly for datetime values throughout January. It is usually safer than `BETWEEN '2026-01-01' AND '2026-01-31'`, which can miss rows later on January 31 depending on time precision.

##### Key Points to Mention

- Use `>= start` and `< nextStart`.
- Avoid applying functions to the date column.
- Avoid `BETWEEN` for datetime month ranges.
- Keeps predicate sargable.
- Handles time portions correctly.
- Works well with indexes on date columns.

<!-- question:end:select-where-order-by-top-offset-fetch-intermediate-q05 -->

<!-- question:start:select-where-order-by-top-offset-fetch-intermediate-q06 -->
#### Intermediate Q06: Why is deterministic ordering important for pagination?

<!-- question-id:select-where-order-by-top-offset-fetch-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Pagination needs a stable order so rows do not randomly move between pages. If the `ORDER BY` column has duplicate values and no unique tie-breaker, the database can return tied rows in different orders across executions.

For example:

```sql
ORDER BY CreatedAt DESC
```

may not be stable if many rows share the same `CreatedAt`. Better:

```sql
ORDER BY CreatedAt DESC, Id DESC
```

The unique ID breaks ties and makes page results more predictable.

##### Key Points to Mention

- Pagination depends on stable ordering.
- Non-unique sort columns can cause unstable pages.
- Rows can be skipped or duplicated between pages.
- Add a unique tie-breaker.
- Common tie-breaker is primary key.
- This matters for both `TOP` and `OFFSET-FETCH`.

<!-- question:end:select-where-order-by-top-offset-fetch-intermediate-q06 -->

<!-- question:start:select-where-order-by-top-offset-fetch-intermediate-q07 -->
#### Intermediate Q07: What is the deep pagination problem?

<!-- question-id:select-where-order-by-top-offset-fetch-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

Deep pagination happens when a query skips a very large number of rows with `OFFSET`. SQL Server still has to identify and skip those rows before returning the requested page, which can become expensive.

Example:

```sql
ORDER BY CreatedAt DESC, Id DESC
OFFSET 100000 ROWS
FETCH NEXT 50 ROWS ONLY;
```

This can be slow on large tables. Alternatives include keyset pagination, filtering, limiting maximum page depth, or using continuation tokens.

##### Key Points to Mention

- Large offsets can be expensive.
- SQL Server still processes skipped rows.
- Indexes help but do not eliminate the issue.
- Keyset pagination can be faster.
- Limit maximum page depth when appropriate.
- Use continuation tokens for large scrolling APIs.

<!-- question:end:select-where-order-by-top-offset-fetch-intermediate-q07 -->

<!-- question:start:select-where-order-by-top-offset-fetch-intermediate-q08 -->
#### Intermediate Q08: How should indexes support WHERE and ORDER BY?

<!-- question-id:select-where-order-by-top-offset-fetch-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

Indexes should be designed around common filtering and sorting patterns. Columns used for equality filters often appear first, followed by range or ordering columns. Included columns can help avoid extra lookups.

Example query:

```sql
SELECT
    OrderId,
    OrderDate,
    TotalAmount
FROM dbo.Orders
WHERE CustomerId = @CustomerId
ORDER BY OrderDate DESC, OrderId DESC;
```

Possible index:

```sql
CREATE INDEX IX_Orders_CustomerId_OrderDate_OrderId
ON dbo.Orders (CustomerId, OrderDate DESC, OrderId DESC)
INCLUDE (TotalAmount);
```

##### Key Points to Mention

- Indexes should match query patterns.
- Equality filters often go before sort columns.
- Index order can reduce sorting.
- Included columns can avoid lookups.
- Indexes improve reads but add write/storage cost.
- Validate with execution plans.

<!-- question:end:select-where-order-by-top-offset-fetch-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:select-where-order-by-top-offset-fetch-advanced-q01 -->
#### Advanced Q01: How would you design pagination for a high-traffic API?

<!-- question-id:select-where-order-by-top-offset-fetch-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

For simple low-depth pagination, `OFFSET-FETCH` is acceptable if the query has a stable `ORDER BY`, a maximum page size, and supporting indexes. For large datasets or infinite scroll, I would prefer keyset pagination using the last seen sort key.

Example keyset approach:

```sql
SELECT TOP (@PageSize)
    OrderId,
    OrderDate,
    TotalAmount
FROM dbo.Orders
WHERE Status = 'Completed'
  AND
  (
      OrderDate < @LastOrderDate
      OR (OrderDate = @LastOrderDate AND OrderId < @LastOrderId)
  )
ORDER BY OrderDate DESC, OrderId DESC;
```

This avoids skipping a large number of rows and is more stable when new rows are inserted.

##### Key Points to Mention

- `OFFSET-FETCH` is fine for simple shallow pages.
- Use deterministic ordering.
- Add maximum page size.
- Add supporting indexes.
- Deep offset pagination can be slow.
- Keyset pagination is better for large datasets.
- Continuation tokens can represent last seen keys.

<!-- question:end:select-where-order-by-top-offset-fetch-advanced-q01 -->

<!-- question:start:select-where-order-by-top-offset-fetch-advanced-q02 -->
#### Advanced Q02: How can WHERE predicates accidentally prevent index usage?

<!-- question-id:select-where-order-by-top-offset-fetch-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Predicates can prevent efficient index usage when they apply functions, calculations, or implicit conversions to indexed columns. This makes SQL Server process many rows instead of seeking directly.

Examples:

```sql
WHERE YEAR(CreatedAt) = 2026
WHERE LOWER(Email) = 'user@example.com'
WHERE CAST(OrderDate AS date) = '2026-01-01'
WHERE CustomerId = @CustomerIdAsString
```

Better forms compare the column directly to correctly typed values:

```sql
WHERE CreatedAt >= '2026-01-01'
  AND CreatedAt <  '2027-01-01'
```

##### Key Points to Mention

- Functions on columns can make predicates non-sargable.
- Calculations on columns can hurt index seeks.
- Implicit conversions can hurt plans.
- Use correctly typed parameters.
- Use range predicates for dates.
- Check execution plans for scans and conversion warnings.

<!-- question:end:select-where-order-by-top-offset-fetch-advanced-q02 -->

<!-- question:start:select-where-order-by-top-offset-fetch-advanced-q03 -->
#### Advanced Q03: How does TOP WITH TIES work and when would you use it?

<!-- question-id:select-where-order-by-top-offset-fetch-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

`TOP WITH TIES` returns the requested top rows plus any additional rows that tie with the last returned row according to the `ORDER BY` expression.

Example:

```sql
SELECT TOP (3) WITH TIES
    EmployeeId,
    FullName,
    SalesAmount
FROM dbo.EmployeeSales
ORDER BY SalesAmount DESC;
```

If multiple employees have the same sales amount as the third row, they are all returned. This is useful when business logic requires all tied results at the cutoff.

##### Key Points to Mention

- Requires `ORDER BY` to define ties.
- Can return more rows than the specified number.
- Useful for rankings and leaderboards.
- Prevents unfair exclusion of tied rows.
- Result order among ties may still need additional tie-breakers.
- Different from plain `TOP`.

<!-- question:end:select-where-order-by-top-offset-fetch-advanced-q03 -->

<!-- question:start:select-where-order-by-top-offset-fetch-advanced-q04 -->
#### Advanced Q04: Why can OFFSET-FETCH produce inconsistent pages when data changes?

<!-- question-id:select-where-order-by-top-offset-fetch-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

`OFFSET-FETCH` uses row positions in a sorted result. If rows are inserted, deleted, or updated between page requests, row positions can shift. A user may see duplicate rows or miss rows while moving between pages.

For example, if a new latest order is inserted after the user loads page 1, the rows on page 2 may shift by one position.

Keyset pagination is more stable because it asks for rows after the last seen key rather than rows at a numeric offset.

##### Key Points to Mention

- Offset pagination depends on row positions.
- Inserts/deletes can shift row positions.
- Rows can be skipped or duplicated.
- Deterministic ordering helps but does not solve changing data completely.
- Keyset pagination is more stable for changing datasets.
- Snapshot isolation or fixed result snapshots can also help in specific reporting scenarios.

<!-- question:end:select-where-order-by-top-offset-fetch-advanced-q04 -->

<!-- question:start:select-where-order-by-top-offset-fetch-advanced-q05 -->
#### Advanced Q05: How would you troubleshoot a slow SELECT query with WHERE and ORDER BY?

<!-- question-id:select-where-order-by-top-offset-fetch-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

I would start by checking the actual execution plan. I would look for table scans, index scans, key lookups, expensive Sort operators, implicit conversions, missing index suggestions, incorrect estimates, spills, and large row counts.

Then I would review the query predicates for sargability, verify parameter data types, check whether the index supports both the `WHERE` filter and `ORDER BY`, and reduce selected columns if possible.

I would also check statistics, data distribution, parameter sniffing symptoms, and whether pagination is using a deep offset.

##### Key Points to Mention

- Use actual execution plan.
- Look for scans, sorts, lookups, spills, and conversions.
- Check sargability.
- Check parameter types.
- Check index design for filter and sort.
- Avoid unnecessary columns.
- Consider keyset pagination for deep pages.
- Review statistics and cardinality estimates.

<!-- question:end:select-where-order-by-top-offset-fetch-advanced-q05 -->

<!-- question:start:select-where-order-by-top-offset-fetch-advanced-q06 -->
#### Advanced Q06: What is the relationship between ORDER BY and indexes?

<!-- question-id:select-where-order-by-top-offset-fetch-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

An index can store rows in an order that matches the query's filtering and sorting needs. If the optimizer can use such an index, SQL Server may avoid a separate Sort operation.

For example, if a query filters by `CustomerId` and sorts by `OrderDate DESC, OrderId DESC`, an index on `(CustomerId, OrderDate DESC, OrderId DESC)` can be helpful.

However, indexes have trade-offs. They use storage and slow writes because they must be maintained.

##### Key Points to Mention

- Index key order matters.
- A useful index can avoid expensive Sort operators.
- Equality filters often come before sort columns.
- Included columns can make a covering index.
- Indexes improve reads but add write/storage cost.
- Validate index usefulness with execution plans.

<!-- question:end:select-where-order-by-top-offset-fetch-advanced-q06 -->

<!-- question:start:select-where-order-by-top-offset-fetch-advanced-q07 -->
#### Advanced Q07: How do NULL values affect WHERE conditions?

<!-- question-id:select-where-order-by-top-offset-fetch-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

SQL uses three-valued logic: true, false, and unknown. Comparisons with `NULL` usually evaluate to unknown, not true. Therefore, `WHERE Column = NULL` does not work as expected. Use `IS NULL` or `IS NOT NULL`.

Also, predicates such as `Column <> 'X'` do not return rows where `Column` is `NULL`, because the comparison is unknown.

To include nulls explicitly:

```sql
WHERE Column <> 'X'
   OR Column IS NULL;
```

##### Key Points to Mention

- `NULL` means unknown or missing.
- Use `IS NULL`, not `= NULL`.
- Use `IS NOT NULL`, not `<> NULL`.
- SQL has true, false, and unknown.
- Comparisons with null are usually unknown.
- Explicitly include nulls when needed.

<!-- question:end:select-where-order-by-top-offset-fetch-advanced-q07 -->

<!-- question:start:select-where-order-by-top-offset-fetch-advanced-q08 -->
#### Advanced Q08: How would you safely implement user-driven sorting and paging from an API?

<!-- question-id:select-where-order-by-top-offset-fetch-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

I would whitelist allowed sort columns and directions instead of directly injecting user input into SQL. The page number and page size should be validated, and the page size should have a maximum. The query should always include a deterministic tie-breaker.

Example allowed sort values:

```text
name
createdAt
price
```

The application maps those values to known SQL fragments. User input should never be concatenated directly as raw SQL identifiers or clauses.

##### Key Points to Mention

- Whitelist sort columns.
- Whitelist sort direction.
- Validate page number and page size.
- Set maximum page size.
- Add deterministic tie-breaker.
- Parameterize values.
- Do not concatenate raw user input into SQL.
- Consider keyset pagination for high-scale APIs.

<!-- question:end:select-where-order-by-top-offset-fetch-advanced-q08 -->

<!-- question:start:select-where-order-by-top-offset-fetch-advanced-q09 -->
#### Advanced Q09: When would you prefer keyset pagination over OFFSET-FETCH?

<!-- question-id:select-where-order-by-top-offset-fetch-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

I would prefer keyset pagination for large tables, infinite scrolling, activity feeds, high-traffic APIs, or scenarios where users navigate deeply through sorted results. Keyset pagination avoids skipping large numbers of rows and is more stable when data changes between requests.

`OFFSET-FETCH` is simpler and works well for shallow pages or admin screens where direct page numbers are required. Keyset pagination is better when performance and stability matter more than jumping to arbitrary page numbers.

##### Key Points to Mention

- Better for large datasets.
- Better for deep browsing.
- Avoids expensive large offsets.
- More stable when data changes.
- Requires last seen key or continuation token.
- Harder to jump to arbitrary page numbers.
- Works best with deterministic ordered keys and indexes.

<!-- question:end:select-where-order-by-top-offset-fetch-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
