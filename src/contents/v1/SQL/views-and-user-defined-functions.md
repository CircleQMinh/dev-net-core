---
id: views-and-user-defined-functions
topic: Database programmability and schema evolution
subtopic: Views and user-defined functions
category: SQL
---

## Overview

Views and user-defined functions are SQL Server programmability features that package reusable query logic. A view presents a named query as a virtual table. A user-defined function packages reusable logic that can return a scalar value or a table. Both can improve clarity and reuse, but both can also hide complexity and create performance surprises when used carelessly.

This topic matters because views and functions appear in application queries, reporting layers, data-access APIs, security models, and legacy databases. They can simplify a schema, expose a stable interface, and reduce duplicated SQL. They can also stack layers of abstraction until queries become hard to understand, hard to tune, or accidentally expensive.

For interviews, views and functions test whether you understand the difference between logical abstraction and physical performance. Strong candidates can explain ordinary views, indexed views, updatable views, inline table-valued functions, multi-statement table-valued functions, scalar functions, schema binding, and when a function in a predicate can hurt index usage.

## Core Concepts

### Views

A view is a stored `SELECT` statement that appears to callers like a table.

```sql
CREATE OR ALTER VIEW sales.vwCustomerOrderSummary
AS
SELECT
    c.CustomerId,
    c.CustomerName,
    COUNT(o.OrderId) AS OrderCount,
    SUM(o.TotalAmount) AS TotalAmount
FROM sales.Customers AS c
LEFT JOIN sales.Orders AS o
    ON o.CustomerId = c.CustomerId
GROUP BY
    c.CustomerId,
    c.CustomerName;
```

Common uses include:

- Simplifying complex joins.
- Hiding columns from users.
- Providing a stable compatibility layer.
- Centralizing common reporting projections.
- Exposing a smaller interface over base tables.

Most views are virtual. SQL Server expands the view definition into the outer query and optimizes the combined query.

### View Limitations

A view is not automatically a performance feature. It is usually an abstraction over a query.

Important limitations include:

- A view does not guarantee ordered results unless the outer query uses `ORDER BY`.
- Deeply nested views can hide expensive joins and filters.
- `SELECT *` inside a view can create fragile contracts.
- A view can become invalid or stale when underlying objects change.
- Updating through a view has restrictions.
- Indexed views have strict requirements and write-side costs.

Example:

```sql
SELECT *
FROM sales.vwCustomerOrderSummary
WHERE TotalAmount > 10000;
```

This may be readable, but the optimizer still needs to execute the underlying joins and aggregation unless an appropriate indexed view is used.

### SCHEMABINDING

`SCHEMABINDING` binds a view or function to referenced objects. It prevents underlying schema changes that would break the module.

```sql
CREATE OR ALTER VIEW sales.vwActiveCustomer
WITH SCHEMABINDING
AS
SELECT
    CustomerId,
    CustomerName,
    Status
FROM sales.Customers
WHERE Status = 'Active';
```

Schema binding can improve safety because dependent columns and tables cannot be changed in incompatible ways without first changing the view or function. It is also required for indexed views.

### WITH CHECK OPTION

`WITH CHECK OPTION` applies to updates through a view. It ensures modified rows still satisfy the view predicate after the change.

```sql
CREATE OR ALTER VIEW sales.vwActiveCustomer
AS
SELECT CustomerId, CustomerName, Status
FROM sales.Customers
WHERE Status = 'Active'
WITH CHECK OPTION;
```

If a caller updates a row through this view and sets `Status = 'Inactive'`, the row would no longer be visible through the view, so the update is rejected.

### Updatable Views

Some simple views can be updated. SQL Server must be able to map the modification unambiguously to one base table. Views with aggregates, grouping, distinct results, computed expressions, or multi-table ambiguity are usually not directly updatable.

`INSTEAD OF` triggers can make more complex views accept writes, but this adds hidden procedural behavior and should be used carefully.

### Indexed Views

An indexed view materializes view results in a unique clustered index. This can help expensive aggregate or join-heavy workloads, but it adds maintenance cost to writes on the underlying tables.

```sql
CREATE VIEW sales.vwDailySales
WITH SCHEMABINDING
AS
SELECT
    OrderDate,
    COUNT_BIG(*) AS OrderCount,
    SUM(TotalAmount) AS TotalAmount
FROM sales.Orders
GROUP BY OrderDate;
```

```sql
CREATE UNIQUE CLUSTERED INDEX CX_vwDailySales
ON sales.vwDailySales (OrderDate);
```

Use indexed views when read benefits justify write overhead and when the strict requirements are acceptable.

### User-Defined Functions

A user-defined function packages reusable logic and returns either a scalar value or a table.

Types include:

- Scalar functions.
- Inline table-valued functions.
- Multi-statement table-valued functions.
- CLR functions in some SQL Server environments.

Functions are useful for reusable calculations and reusable parameterized table expressions. However, they have restrictions and performance characteristics that must be understood.

### Scalar Functions

A scalar function returns a single value.

```sql
CREATE OR ALTER FUNCTION dbo.CalculateDiscount
(
    @Subtotal decimal(12, 2),
    @CustomerTier varchar(20)
)
RETURNS decimal(12, 2)
AS
BEGIN
    RETURN
        CASE @CustomerTier
            WHEN 'Gold' THEN @Subtotal * 0.10
            WHEN 'Silver' THEN @Subtotal * 0.05
            ELSE 0
        END;
END;
```

Scalar functions can make code readable, but they can be expensive when called once per row in a large query. Modern SQL Server versions can inline some scalar UDFs, but not all functions are eligible.

### Inline Table-Valued Functions

An inline table-valued function returns a table from a single `RETURN SELECT` expression. It is often optimized like a parameterized view.

```sql
CREATE OR ALTER FUNCTION sales.GetOrdersForCustomer
(
    @CustomerId int
)
RETURNS TABLE
AS
RETURN
(
    SELECT OrderId, CustomerId, OrderDate, TotalAmount
    FROM sales.Orders
    WHERE CustomerId = @CustomerId
);
```

Usage:

```sql
SELECT *
FROM sales.GetOrdersForCustomer(42)
WHERE TotalAmount > 100;
```

Inline table-valued functions are usually preferred over multi-statement table-valued functions for query performance because the optimizer can reason about the function body more directly.

### Multi-Statement Table-Valued Functions

A multi-statement table-valued function fills and returns a table variable.

```sql
CREATE OR ALTER FUNCTION sales.GetRecentHighValueOrders
(
    @Days int
)
RETURNS @Result TABLE
(
    OrderId bigint,
    CustomerId int,
    TotalAmount decimal(12, 2)
)
AS
BEGIN
    INSERT @Result (OrderId, CustomerId, TotalAmount)
    SELECT OrderId, CustomerId, TotalAmount
    FROM sales.Orders
    WHERE OrderDate >= DATEADD(day, -@Days, SYSUTCDATETIME())
      AND TotalAmount >= 1000;

    RETURN;
END;
```

This style can express multi-step logic, but it can hide cardinality and indexing information from the optimizer. Use it only when the extra procedural flexibility is worth the performance trade-off.

### Views Vs Inline Table-Valued Functions

Views and inline table-valued functions are similar because both expose reusable table-shaped logic.

Key difference:

- A view has no parameters.
- An inline table-valued function can accept parameters.

If you need a reusable filtered projection with parameters, an inline table-valued function is often cleaner than a view plus broad filtering outside the view.

### Functions In Predicates

Wrapping a column in a function can make a predicate non-SARGable.

Poor:

```sql
WHERE dbo.NormalizeEmail(EmailAddress) = @Email;
```

Better options:

- Store normalized values in a computed persisted column.
- Normalize input before querying.
- Use a SARGable predicate against indexed data.
- Use a computed column index when appropriate.

A function call can be logically correct and still make a query slow.

### Determinism And Side Effects

Functions are expected to return results based on inputs and allowed database context. They cannot perform arbitrary side effects like modifying tables in the way stored procedures can. This makes functions useful inside queries, but it also limits what they should contain.

For business workflows, use stored procedures or application code. For reusable expressions or table expressions, use functions.

### Common Mistakes

Common mistakes include:

- Treating a view as a materialized performance cache.
- Nesting many views until the real query is unreadable.
- Using `ORDER BY` inside a view and assuming callers get ordered results.
- Using scalar functions row-by-row in large queries without checking performance.
- Using multi-statement table-valued functions where inline functions would work.
- Returning broad `SELECT *` view contracts.
- Using functions in predicates that prevent index seeks.
- Forgetting to refresh or schema-bind views when base tables change.

### Best Practices

Best practices include:

- Use views to simplify and secure common projections.
- Keep views focused and avoid deep nesting.
- Use explicit column lists.
- Use `SCHEMABINDING` when dependency safety matters.
- Use indexed views only when read benefits justify write overhead.
- Prefer inline table-valued functions for parameterized reusable queries.
- Be cautious with scalar functions in large result sets.
- Test view and function usage inside the full calling query.
- Source-control definitions and review changes.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is a view?

<!-- question:start:views-and-user-defined-functions-beginner-q01 -->
<!-- question-id:views-and-user-defined-functions-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A view is a named query that presents data as if it were a table. It can simplify joins, hide columns, provide a stable interface over base tables, and support security by granting access to the view instead of the underlying tables.

Most views are virtual. They do not store rows by default; SQL Server uses the view definition as part of the query that references it.

##### Key Points to Mention

- Named `SELECT` statement.
- Presents data like a table.
- Usually virtual, not stored.
- Useful for simplification and security.
- Does not guarantee performance by itself.

<!-- question:end:views-and-user-defined-functions-beginner-q01 -->

#### What is a user-defined function?

<!-- question:start:views-and-user-defined-functions-beginner-q02 -->
<!-- question-id:views-and-user-defined-functions-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

A user-defined function is a database object that packages reusable logic and returns a value. It can return a scalar value, such as a calculated discount, or a table, such as filtered rows for a customer.

Functions are commonly used inside queries, but their performance depends on the function type and how they are used.

##### Key Points to Mention

- Reusable database logic.
- Returns scalar or table results.
- Can be called from queries.
- Scalar, inline table-valued, and multi-statement table-valued are common types.
- Performance characteristics differ by type.

<!-- question:end:views-and-user-defined-functions-beginner-q02 -->

#### What is the difference between a view and an inline table-valued function?

<!-- question:start:views-and-user-defined-functions-beginner-q03 -->
<!-- question-id:views-and-user-defined-functions-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

A view is a named query without parameters. An inline table-valued function is similar to a parameterized view because it returns a table from a single query and can accept parameters.

Use a view for a common projection or security boundary. Use an inline table-valued function when the reusable table expression needs parameters such as customer ID, date range, or tenant ID.

##### Key Points to Mention

- Views do not accept parameters.
- Inline TVFs accept parameters.
- Both return table-shaped results.
- Inline TVFs are often optimizer-friendly.
- Choose based on whether parameters are needed.

<!-- question:end:views-and-user-defined-functions-beginner-q03 -->

#### Does a view guarantee sorted results?

<!-- question:start:views-and-user-defined-functions-beginner-q04 -->
<!-- question-id:views-and-user-defined-functions-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

No. A view does not guarantee sorted results for callers. The outer query must use `ORDER BY` if ordering matters. Even if an `ORDER BY` appears in a view definition with `TOP` or another allowed construct, callers should not rely on the view to provide final result ordering.

Ordering is a property of the final query result, not a reliable property of a normal view abstraction.

##### Key Points to Mention

- Use `ORDER BY` in the outer query.
- Views do not guarantee caller ordering.
- `ORDER BY` in views is restricted.
- Do not rely on accidental plan order.
- Ordering must be explicit.

<!-- question:end:views-and-user-defined-functions-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### What is SCHEMABINDING and why would you use it?

<!-- question:start:views-and-user-defined-functions-intermediate-q01 -->
<!-- question-id:views-and-user-defined-functions-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

`SCHEMABINDING` binds a view or function to the schema of the underlying objects it references. This prevents incompatible schema changes, such as dropping a referenced column, until the dependent view or function is changed or removed.

It is useful when dependency safety matters, and it is required for indexed views. It makes dependencies more explicit, but it also means schema changes must be coordinated.

##### Key Points to Mention

- Prevents breaking changes to referenced objects.
- Makes dependencies explicit.
- Required for indexed views.
- Requires qualified object names.
- Adds safety but affects schema-change workflow.

<!-- question:end:views-and-user-defined-functions-intermediate-q01 -->

#### What is an indexed view and what is the trade-off?

<!-- question:start:views-and-user-defined-functions-intermediate-q02 -->
<!-- question-id:views-and-user-defined-functions-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

An indexed view materializes the view result by creating a unique clustered index on the view. It can speed up expensive aggregation or join workloads because SQL Server can read precomputed results instead of recalculating everything each time.

The trade-off is write overhead. Inserts, updates, and deletes on underlying tables must also maintain the indexed view. Indexed views also have strict definition and session-setting requirements, so they should be used only when the read benefit justifies the cost.

##### Key Points to Mention

- Materialized through a unique clustered index.
- Can speed expensive reads.
- Requires schema binding and specific rules.
- Adds write and maintenance cost.
- Best for stable, high-value read patterns.

<!-- question:end:views-and-user-defined-functions-intermediate-q02 -->

#### Why are inline table-valued functions often preferred over multi-statement table-valued functions?

<!-- question:start:views-and-user-defined-functions-intermediate-q03 -->
<!-- question-id:views-and-user-defined-functions-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Inline table-valued functions are defined as a single table expression, so the optimizer can usually reason about them more directly as part of the calling query. Multi-statement table-valued functions populate a table variable, which can hide cardinality and distribution information and lead to poor plans.

Use inline table-valued functions when the logic can be expressed as one query. Use multi-statement functions only when the procedural flexibility is worth the performance trade-off.

##### Key Points to Mention

- Inline TVFs are optimizer-friendly.
- Multi-statement TVFs use a table variable result.
- Cardinality can be harder to estimate for multi-statement TVFs.
- Inline TVFs are good parameterized query abstractions.
- Test the full calling query.

<!-- question:end:views-and-user-defined-functions-intermediate-q03 -->

#### Why can scalar functions hurt query performance?

<!-- question:start:views-and-user-defined-functions-intermediate-q04 -->
<!-- question-id:views-and-user-defined-functions-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Scalar functions can hurt performance when they are executed once per row over large result sets or when they hide logic from the optimizer. They can also make predicates non-SARGable when applied to indexed columns. Modern SQL Server can inline some scalar UDFs, but not every scalar function is eligible.

A better approach may be to rewrite the logic inline, use a computed column, normalize values before querying, or use an inline table-valued function when table-shaped logic is needed.

##### Key Points to Mention

- Can execute row by row.
- Can hide cost and cardinality from optimizer.
- Functions on columns can prevent index seeks.
- Some scalar UDFs can be inlined in newer versions.
- Always test with realistic row counts.

<!-- question:end:views-and-user-defined-functions-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you decide between a view, inline TVF, stored procedure, and application query?

<!-- question:start:views-and-user-defined-functions-advanced-q01 -->
<!-- question-id:views-and-user-defined-functions-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Use a view for a reusable table-shaped projection without parameters, especially for simplification, compatibility, or security. Use an inline TVF when the reusable table expression needs parameters and should compose with other queries. Use a stored procedure when the operation is a command, multi-step workflow, security boundary, or result contract that should not be freely composed. Use application queries when the logic is application-specific and easier to test or evolve there.

The decision should consider composability, security, performance, ownership, deployment, and how stable the contract must be.

##### Key Points to Mention

- View: reusable projection without parameters.
- Inline TVF: parameterized table expression.
- Stored procedure: command or controlled operation.
- Application query: application-owned logic.
- Consider composability and deployment ownership.

<!-- question:end:views-and-user-defined-functions-advanced-q01 -->

#### What problems can deeply nested views cause?

<!-- question:start:views-and-user-defined-functions-advanced-q02 -->
<!-- question-id:views-and-user-defined-functions-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Deeply nested views can hide joins, filters, aggregations, and duplicate work. A simple-looking query against one view may expand into many layers of logic. This makes troubleshooting difficult, can create poor plans, and can cause developers to join to the same tables repeatedly without noticing.

The fix is usually to inspect the expanded query, simplify layers, remove unused columns and joins, and create clearer query structures or purpose-built views.

##### Key Points to Mention

- Hides complexity.
- Can repeat joins or aggregations.
- Makes plans harder to understand.
- Can harm performance and maintainability.
- Prefer focused views with clear purpose.

<!-- question:end:views-and-user-defined-functions-advanced-q02 -->

#### How can schema changes break views and functions?

<!-- question:start:views-and-user-defined-functions-advanced-q03 -->
<!-- question-id:views-and-user-defined-functions-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Views and functions depend on underlying tables, columns, and other modules. Dropping or changing a referenced column can break them. Without schema binding, some metadata can become stale until the module is refreshed or recreated. With schema binding, incompatible changes are blocked until the dependent object is changed first.

Good release practice includes source-controlling definitions, checking dependencies, building database projects or scripts in CI, and deploying changes in an order that does not break callers.

##### Key Points to Mention

- Dependencies can break after table changes.
- Non-schema-bound views may need refresh.
- Schema binding blocks incompatible changes.
- Build validation can catch missing references.
- Release order matters.

<!-- question:end:views-and-user-defined-functions-advanced-q03 -->

#### When would you use an indexed view instead of a normal index or summary table?

<!-- question:start:views-and-user-defined-functions-advanced-q04 -->
<!-- question-id:views-and-user-defined-functions-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

I would consider an indexed view when a stable, high-value read workload repeatedly needs the same expensive join or aggregation and the write overhead is acceptable. It can be useful when the optimizer can use the materialized result and when maintaining a separate summary table would add too much custom code.

I would prefer a normal index when the query just needs a better access path on one table. I would prefer a summary table when refresh timing, custom aggregation rules, or ETL ownership needs more control than an indexed view provides.

##### Key Points to Mention

- Good for repeated expensive aggregations or joins.
- Requires strict indexed-view rules.
- Adds write maintenance cost.
- Normal indexes are simpler for single-table access.
- Summary tables offer more refresh control.

<!-- question:end:views-and-user-defined-functions-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
