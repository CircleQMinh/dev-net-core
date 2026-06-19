---
id: computed-columns-persisted-computed-columns-and-indexed-views
topic: SQL practical interview comparisons and SQL Server-specific features
subtopic: Computed columns, persisted computed columns, and indexed views
category: SQL
---

## Overview

Computed columns and indexed views are SQL Server features for defining reusable derived data in the database. A computed column derives a value from other columns in the same row. A persisted computed column stores that derived value physically. An indexed view stores the result of a schema-bound view by creating a unique clustered index on the view.

These features are useful when a repeated calculation, normalized search key, derived business value, or aggregate query is important enough to be modeled and optimized in the database. They can make queries simpler and faster, but they also add write overhead and come with strict rules.

This topic matters because interviewers often use it to test whether a candidate understands the difference between logical convenience and physical optimization. A computed column may just be a reusable expression. A persisted computed column trades storage and write cost for read performance and indexing options. An indexed view can precompute expensive joins or aggregations, but it has many restrictions and must be maintained during base-table changes.

For interviews, strong candidates can explain when these features help, when they become unnecessary complexity, and what requirements SQL Server enforces around determinism, precision, schema binding, `SET` options, and DML maintenance cost.

## Core Concepts

### Computed Columns

A computed column is a column whose value is calculated from an expression instead of being directly inserted by the application.

Example:

```sql
CREATE TABLE dbo.OrderLine
(
    OrderLineId BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(19, 4) NOT NULL,
    DiscountAmount DECIMAL(19, 4) NOT NULL,
    LineTotal AS ((Quantity * UnitPrice) - DiscountAmount)
);
```

`LineTotal` is computed from other columns in the same row. The application does not insert it directly.

Benefits:

- Avoids repeating formulas in many queries.
- Keeps business calculations consistent.
- Makes query code easier to read.
- Can sometimes be indexed if requirements are met.
- Reduces application/database mismatch for derived values.

Limitations:

- The expression must be based on allowed deterministic logic.
- It cannot depend on rows from other tables.
- It is not a replacement for all business logic.
- Complex expressions can make writes and reads harder to reason about.

### Non-Persisted Computed Columns

By default, a computed column is not physically stored. SQL Server calculates it when needed.

Example:

```sql
CREATE TABLE dbo.Customer
(
    CustomerId BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    FirstName NVARCHAR(100) NOT NULL,
    LastName NVARCHAR(100) NOT NULL,
    FullName AS (FirstName + N' ' + LastName)
);
```

`FullName` is convenient for queries, but it does not store a separate copy of the full name unless the column is persisted or indexed in a way that stores values.

Use non-persisted computed columns when:

- The calculation is cheap.
- The value is mostly for readability.
- The expression is not heavily filtered or joined.
- You do not need to store the result physically.

### Persisted Computed Columns

A persisted computed column stores the calculated value in the table and updates it when dependent columns change.

Example:

```sql
CREATE TABLE dbo.Customer
(
    CustomerId BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    Email NVARCHAR(320) NOT NULL,
    NormalizedEmail AS (UPPER(Email)) PERSISTED
);

CREATE UNIQUE INDEX UX_Customer_NormalizedEmail
ON dbo.Customer (NormalizedEmail);
```

Persisting can help when the expression is expensive, frequently queried, or needs to be indexed. It trades storage and write cost for read efficiency.

Important point: persisted does not mean manually maintained. SQL Server maintains the value as dependent columns change.

Use persisted computed columns when:

- The expression is deterministic.
- The value is frequently filtered, joined, or indexed.
- Recomputing the value repeatedly is expensive.
- The storage and write overhead are acceptable.
- You need SQL Server to store the computed result.

### Determinism And Precision

Computed columns must meet requirements before they can be indexed. Two major concepts are determinism and precision.

A deterministic expression always returns the same result for the same input values.

Deterministic example:

```sql
Total AS (Quantity * UnitPrice)
```

Nondeterministic example:

```sql
CreatedAgeSeconds AS (DATEDIFF(second, CreatedAt, SYSUTCDATETIME()))
```

The second expression changes as time passes, even when the row values do not change.

Precision matters when floating-point types are involved. Expressions involving `FLOAT` or `REAL` can be imprecise and may not be allowed as index keys.

Interview rule: if you want to index a computed column, expect SQL Server to care about ownership, determinism, precision, data type, and session `SET` options.

### Indexes On Computed Columns

Computed columns can be indexed when SQL Server's requirements are satisfied.

Example:

```sql
CREATE TABLE dbo.Users
(
    UserId BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    Email NVARCHAR(320) NOT NULL,
    NormalizedEmail AS (UPPER(Email)) PERSISTED
);

CREATE UNIQUE INDEX UX_Users_NormalizedEmail
ON dbo.Users (NormalizedEmail);
```

This supports case-normalized uniqueness and lookup patterns.

Example query:

```sql
SELECT UserId, Email
FROM dbo.Users
WHERE NormalizedEmail = UPPER(@Email);
```

The computed-column index can avoid recomputing the expression for every row.

Requirements can include:

- Same owner for referenced functions and the table.
- Deterministic expression.
- Precise expression for index keys.
- Supported data type.
- Required `SET` options.
- `QUOTED_IDENTIFIER` and `ANSI_NULLS` expectations at creation time.

### SARGability And Computed Columns

Computed columns are often used to make expression-based searches more indexable.

Problem pattern:

```sql
SELECT UserId, Email
FROM dbo.Users
WHERE UPPER(Email) = UPPER(@Email);
```

Applying a function to the column can prevent efficient use of a normal index on `Email`.

Computed column pattern:

```sql
ALTER TABLE dbo.Users
ADD NormalizedEmail AS (UPPER(Email)) PERSISTED;

CREATE INDEX IX_Users_NormalizedEmail
ON dbo.Users (NormalizedEmail);

SELECT UserId, Email
FROM dbo.Users
WHERE NormalizedEmail = UPPER(@Email);
```

This turns a repeated expression into a modeled, indexable value. It is especially useful for normalized search keys, date buckets, trimmed codes, and business calculations used in predicates.

### Indexed Views

An indexed view is a view with a unique clustered index. Creating that index stores the view result set in the database similarly to a table with a clustered index.

Example:

```sql
CREATE VIEW dbo.vDailyProductSales
WITH SCHEMABINDING
AS
SELECT
    o.OrderDate,
    ol.ProductId,
    COUNT_BIG(*) AS RowCount,
    SUM(ol.Quantity) AS TotalQuantity,
    SUM(ol.Quantity * ol.UnitPrice) AS TotalRevenue
FROM dbo.Orders AS o
JOIN dbo.OrderLines AS ol
    ON ol.OrderId = o.OrderId
GROUP BY
    o.OrderDate,
    ol.ProductId;
GO

CREATE UNIQUE CLUSTERED INDEX CX_vDailyProductSales
ON dbo.vDailyProductSales (OrderDate, ProductId);
```

This can speed up repeated aggregation queries. Instead of recalculating daily product sales from base tables every time, SQL Server maintains the indexed view as base data changes.

### Indexed View Requirements

Indexed views have stricter rules than ordinary views.

Important requirements include:

- The view must use `WITH SCHEMABINDING`.
- The first index on the view must be a unique clustered index.
- Referenced tables must use two-part names such as `dbo.Orders`.
- The view expression must be deterministic.
- The base table and view ownership chain must be compatible.
- Required `SET` options must be correct.
- Aggregated indexed views need `COUNT_BIG(*)`.
- Many constructs are not allowed, including `SELECT *`, `TOP`, `DISTINCT`, `UNION`, outer joins, subqueries, common table expressions, window functions, and some aggregate forms.

These restrictions exist because SQL Server must maintain the indexed view reliably as base rows change.

### Computed Columns Vs Indexed Views

Computed columns and indexed views solve different problems.

Use a computed column when:

- The derived value comes from columns in the same row.
- You want to reuse or index a row-level expression.
- The value belongs naturally to the table.
- The query filters or joins on an expression of that row.

Use an indexed view when:

- The derived result spans multiple rows or tables.
- You need precomputed aggregation.
- You need a materialized projection of joined data.
- The read benefit outweighs write overhead and restrictions.

Example distinction:

```sql
-- Row-level derived value
LineTotal AS ((Quantity * UnitPrice) - DiscountAmount)
```

This belongs as a computed column.

```sql
-- Multi-row aggregate by day and product
SUM(Quantity * UnitPrice)
GROUP BY OrderDate, ProductId
```

This is a better fit for an indexed view or reporting table.

### Write Overhead And Maintenance Cost

Persisted computed columns and indexed views speed up some reads by doing more work during writes.

When base data changes, SQL Server must maintain:

- Persisted computed column values.
- Indexes on computed columns.
- Indexed view rows.
- Nonclustered indexes on indexed views.

This can slow `INSERT`, `UPDATE`, and `DELETE` operations. It can also increase locking, logging, storage, and deployment complexity.

Interview answer: do not add persisted computed columns or indexed views just because they are clever. Add them when a measured read workload benefits enough to justify the write cost.

### SET Options And Operational Surprises

SQL Server requires specific session `SET` options for indexed computed columns and indexed views. If connection settings are wrong, index creation may fail or the optimizer may ignore the indexed structure for query plans.

Important options include:

- `ANSI_NULLS`
- `ANSI_PADDING`
- `ANSI_WARNINGS`
- `ARITHABORT`
- `CONCAT_NULL_YIELDS_NULL`
- `QUOTED_IDENTIFIER`
- `NUMERIC_ROUNDABORT`

The usual pattern is that most must be `ON`, while `NUMERIC_ROUNDABORT` must be `OFF`.

This is why indexed views and computed-column indexes should be created through controlled migrations, not ad hoc manual scripts with unknown connection settings.

### Indexed Views Vs Reporting Tables

An indexed view is maintained synchronously by SQL Server as base tables change. A reporting table is usually maintained by a job, ETL process, trigger, queue, or application workflow.

Indexed view advantages:

- Automatically maintained.
- Query optimizer may use it.
- Good for stable, deterministic aggregations.
- Lives inside the relational schema.

Reporting table advantages:

- More flexible transformation logic.
- Can tolerate eventual consistency.
- Can include data from multiple databases or services.
- Easier to customize for analytics workloads.
- Avoids some indexed view restrictions.

Choose based on freshness needs, write overhead, query frequency, complexity, and operational ownership.

### Common Mistakes

Common mistakes include:

- Using `GETDATE()` or other nondeterministic functions in computed columns intended for indexing.
- Expecting computed columns to pull data from other tables.
- Persisting every computed column without measuring write overhead.
- Forgetting that indexed views require `WITH SCHEMABINDING`.
- Forgetting `COUNT_BIG(*)` in grouped indexed views.
- Using unsupported syntax such as `SELECT *`, `UNION`, `TOP`, CTEs, or outer joins in indexed view definitions.
- Ignoring required `SET` options.
- Creating indexed views on highly volatile tables without testing DML cost.
- Using indexed views as a substitute for a proper reporting model.

### Best Practices

Best practices:

- Use non-persisted computed columns for cheap row-level convenience.
- Use persisted computed columns for expensive or indexed row-level expressions.
- Use computed-column indexes for normalized search keys and repeated predicates.
- Use indexed views only when read performance clearly justifies write overhead.
- Keep computed expressions deterministic and precise.
- Use schema-bound, explicit, two-part object names in indexed views.
- Benchmark with realistic read and write workloads.
- Include `SET` options in migrations.
- Prefer simpler indexes or query rewrites before adding complex materialized structures.
- Document why the derived structure exists and what query pattern it supports.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is a computed column?

<!-- question:start:computed-columns-persisted-computed-columns-and-indexed-views-beginner-q01 -->
<!-- question-id:computed-columns-persisted-computed-columns-and-indexed-views-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A computed column is a table column whose value is calculated from an expression, usually based on other columns in the same row. The application does not directly insert the computed value. SQL Server calculates it from the expression.

For example, `LineTotal AS Quantity * UnitPrice` can define a derived line total on an order line table.

##### Key Points to Mention

- Defined with an expression.
- Usually depends on columns in the same row.
- Avoids repeating formulas.
- Can improve consistency.
- May be persisted or non-persisted.

<!-- question:end:computed-columns-persisted-computed-columns-and-indexed-views-beginner-q01 -->

#### What does persisted mean for a computed column?

<!-- question:start:computed-columns-persisted-computed-columns-and-indexed-views-beginner-q02 -->
<!-- question-id:computed-columns-persisted-computed-columns-and-indexed-views-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

Persisted means SQL Server stores the computed value physically in the table and keeps it updated when the columns it depends on change. A non-persisted computed column is calculated when needed. Persisting can improve reads and support indexing scenarios, but it uses storage and adds write overhead.

Persisted does not mean manually maintained by the application. SQL Server maintains it.

##### Key Points to Mention

- Persisted values are stored.
- SQL Server maintains them.
- Non-persisted values are computed when needed.
- Persisting can help read performance.
- Persisting adds storage and write cost.

<!-- question:end:computed-columns-persisted-computed-columns-and-indexed-views-beginner-q02 -->

#### What is an indexed view?

<!-- question:start:computed-columns-persisted-computed-columns-and-indexed-views-beginner-q03 -->
<!-- question-id:computed-columns-persisted-computed-columns-and-indexed-views-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

An indexed view is a view with a unique clustered index. Creating that index stores the view result set in the database, and SQL Server maintains it when base tables change. It can improve performance for repeated expensive joins or aggregations.

Indexed views are more restricted than ordinary views and can slow writes because the stored view result must be maintained.

##### Key Points to Mention

- Requires a unique clustered index first.
- Stores the view result set.
- Maintained as base tables change.
- Useful for repeated aggregations or joins.
- Adds write and storage overhead.

<!-- question:end:computed-columns-persisted-computed-columns-and-indexed-views-beginner-q03 -->

#### When would you use a computed column?

<!-- question:start:computed-columns-persisted-computed-columns-and-indexed-views-beginner-q04 -->
<!-- question-id:computed-columns-persisted-computed-columns-and-indexed-views-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Use a computed column when a row-level derived value is used repeatedly and belongs naturally to the table. Examples include line totals, normalized email values, date buckets, full names, or calculated flags.

It is most useful when it improves consistency, readability, or indexability without adding unnecessary complexity.

##### Key Points to Mention

- Good for row-level derived values.
- Helps avoid repeated formulas.
- Can support normalized search keys.
- Should represent table-level meaning.
- Avoid if the calculation is rarely used or confusing.

<!-- question:end:computed-columns-persisted-computed-columns-and-indexed-views-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### What requirements matter when indexing a computed column?

<!-- question:start:computed-columns-persisted-computed-columns-and-indexed-views-intermediate-q01 -->
<!-- question-id:computed-columns-persisted-computed-columns-and-indexed-views-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

SQL Server requires indexed computed columns to satisfy rules around ownership, determinism, precision, data type, and session `SET` options. The expression must be deterministic, meaning it returns the same result for the same input values. Index key expressions must also be precise, so floating-point expressions can be problematic.

The migration or deployment script must use the required settings, including options such as `QUOTED_IDENTIFIER` and `ANSI_NULLS`.

##### Key Points to Mention

- Determinism is required.
- Precision matters for index keys.
- Data type must be indexable.
- Ownership requirements can apply.
- Required `SET` options matter.

<!-- question:end:computed-columns-persisted-computed-columns-and-indexed-views-intermediate-q01 -->

#### How can a computed column improve SARGability?

<!-- question:start:computed-columns-persisted-computed-columns-and-indexed-views-intermediate-q02 -->
<!-- question-id:computed-columns-persisted-computed-columns-and-indexed-views-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

If a query filters by an expression such as `UPPER(Email)`, a normal index on `Email` may not be used efficiently because the function is applied to the column. A computed column such as `NormalizedEmail AS UPPER(Email)` can make that expression explicit and indexable.

Then queries can filter on `NormalizedEmail`, allowing SQL Server to use an index on the computed column.

##### Key Points to Mention

- Functions on columns can hurt index usage.
- Computed columns model the expression.
- Indexing the computed column can support seeks.
- Useful for normalized search keys.
- The expression must satisfy indexing rules.

<!-- question:end:computed-columns-persisted-computed-columns-and-indexed-views-intermediate-q02 -->

#### What are key requirements for creating an indexed view?

<!-- question:start:computed-columns-persisted-computed-columns-and-indexed-views-intermediate-q03 -->
<!-- question-id:computed-columns-persisted-computed-columns-and-indexed-views-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

An indexed view must be created with `WITH SCHEMABINDING`, and the first index must be a unique clustered index. The view definition must be deterministic, use two-part table names, satisfy ownership requirements, and be created with required `SET` options. If it uses `GROUP BY`, it must include `COUNT_BIG(*)`.

Many constructs allowed in normal views are not allowed in indexed views, so the definition must be simple and explicit.

##### Key Points to Mention

- Requires `WITH SCHEMABINDING`.
- First index must be unique clustered.
- Requires deterministic expressions.
- Required `SET` options matter.
- `COUNT_BIG(*)` is needed with grouped indexed views.

<!-- question:end:computed-columns-persisted-computed-columns-and-indexed-views-intermediate-q03 -->

#### How do indexed views affect writes?

<!-- question:start:computed-columns-persisted-computed-columns-and-indexed-views-intermediate-q04 -->
<!-- question-id:computed-columns-persisted-computed-columns-and-indexed-views-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Indexed views are maintained when base tables change. That means inserts, updates, and deletes against the base tables may also update the indexed view and its indexes. This can increase write latency, logging, locking, and plan complexity.

Indexed views are useful only when the read performance improvement justifies the extra write cost and operational complexity.

##### Key Points to Mention

- Base table DML must maintain the indexed view.
- Writes can become slower.
- Storage and logging increase.
- Complex indexed views can hurt DML plans.
- Benchmark both reads and writes.

<!-- question:end:computed-columns-persisted-computed-columns-and-indexed-views-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you choose between a persisted computed column and an indexed view?

<!-- question:start:computed-columns-persisted-computed-columns-and-indexed-views-advanced-q01 -->
<!-- question-id:computed-columns-persisted-computed-columns-and-indexed-views-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Use a persisted computed column for a row-level expression that belongs to one table, such as a normalized email or line total. Use an indexed view for a derived result that spans multiple rows or tables, such as a precomputed aggregation by product and day.

The decision should consider query frequency, write overhead, storage, restrictions, and whether a simpler normal index or query rewrite would solve the problem.

##### Key Points to Mention

- Computed columns are row-level.
- Indexed views can precompute joins or aggregations.
- Both add maintenance cost.
- Indexed views have more restrictions.
- Measure read benefit against write overhead.

<!-- question:end:computed-columns-persisted-computed-columns-and-indexed-views-advanced-q01 -->

#### Why might GETDATE be invalid in an indexed computed column or indexed view?

<!-- question:start:computed-columns-persisted-computed-columns-and-indexed-views-advanced-q02 -->
<!-- question-id:computed-columns-persisted-computed-columns-and-indexed-views-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

`GETDATE()` is nondeterministic because it can return a different value each time it runs even when the row data is unchanged. Indexed computed columns and indexed views require deterministic expressions so SQL Server can maintain stored index values correctly.

For time-based logic, store the relevant timestamp as data and compute relative values at query time, or materialize time buckets using deterministic expressions based on stored columns.

##### Key Points to Mention

- `GETDATE()` changes over time.
- Indexed derived structures require deterministic expressions.
- Stored index values must be maintainable.
- Use stored timestamps as inputs.
- Avoid nondeterministic functions in indexed expressions.

<!-- question:end:computed-columns-persisted-computed-columns-and-indexed-views-advanced-q02 -->

#### How would you troubleshoot an indexed view that the optimizer is not using?

<!-- question:start:computed-columns-persisted-computed-columns-and-indexed-views-advanced-q03 -->
<!-- question-id:computed-columns-persisted-computed-columns-and-indexed-views-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Check whether the view has a valid unique clustered index, whether required `SET` options are active, whether the query shape can match the view, and whether the SQL Server edition or platform requires direct reference with `NOEXPAND`. Review the actual execution plan and compare costs.

Also verify statistics, predicates, grouping columns, and whether the optimizer has a cheaper plan without the indexed view. The optimizer is not obligated to use an indexed view just because it exists.

##### Key Points to Mention

- Verify the unique clustered index exists.
- Check required `SET` options.
- Review actual execution plan.
- Consider `NOEXPAND` where relevant.
- Query shape and predicates must be compatible.
- The optimizer may choose another plan.

<!-- question:end:computed-columns-persisted-computed-columns-and-indexed-views-advanced-q03 -->

#### When is an indexed view the wrong solution?

<!-- question:start:computed-columns-persisted-computed-columns-and-indexed-views-advanced-q04 -->
<!-- question-id:computed-columns-persisted-computed-columns-and-indexed-views-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

An indexed view is the wrong solution when the base tables are highly write-heavy, the query is rarely executed, the view definition is complex or unsupported, the freshness requirement can tolerate asynchronous reporting, or a simpler index, query rewrite, or reporting table would solve the problem with less operational cost.

Indexed views are powerful but rigid. They should be justified by measured read performance needs, not added as a default caching mechanism.

##### Key Points to Mention

- Bad fit for very write-heavy tables.
- Bad fit for rarely used queries.
- Many query constructs are unsupported.
- Reporting tables may be more flexible.
- Simpler indexes should be considered first.
- Measure before and after.

<!-- question:end:computed-columns-persisted-computed-columns-and-indexed-views-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
