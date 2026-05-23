---
id: inner-left-other-join-patterns
topic: Relational modeling and normalization
subtopic: INNER, LEFT, and other join patterns
category: SQL
---

## Overview

SQL joins combine rows from two or more tables based on related columns or logical conditions. They are central to relational databases because normalized models intentionally split data into separate tables such as customers, orders, products, payments, users, roles, and audit records. Joins let you reconstruct meaningful business results from those related tables.

The most common join patterns are `INNER JOIN`, `LEFT JOIN`, `RIGHT JOIN`, `FULL OUTER JOIN`, `CROSS JOIN`, and self joins. In practical SQL, you will also see semi-join and anti-join patterns using `EXISTS`, `NOT EXISTS`, and `LEFT JOIN ... IS NULL`.

This topic is important for interviews because joins reveal whether a candidate understands relational modeling, primary keys, foreign keys, optional relationships, cardinality, null behavior, aggregation, and query correctness. Many real production SQL bugs are caused by choosing the wrong join type, placing filters in the wrong clause, accidentally multiplying rows, or using `DISTINCT` to hide a bad join.

A strong interview answer should explain not only the syntax, but also the business meaning of each join type. For example, `INNER JOIN` means “only rows with a match,” while `LEFT JOIN` means “keep all rows from the left side, even when the optional related data is missing.”

## Core Concepts

### Basic sample schema

The examples below use a simple sales schema:

```sql
CREATE TABLE Customers
(
    CustomerId int PRIMARY KEY,
    CustomerName varchar(100) NOT NULL
);

CREATE TABLE Orders
(
    OrderId int PRIMARY KEY,
    CustomerId int NOT NULL,
    OrderDate date NOT NULL,
    Status varchar(20) NOT NULL,
    CONSTRAINT FK_Orders_Customers
        FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId)
);

CREATE TABLE Products
(
    ProductId int PRIMARY KEY,
    ProductName varchar(100) NOT NULL
);

CREATE TABLE OrderItems
(
    OrderItemId int PRIMARY KEY,
    OrderId int NOT NULL,
    ProductId int NOT NULL,
    Quantity int NOT NULL,
    UnitPrice decimal(10, 2) NOT NULL,
    CONSTRAINT FK_OrderItems_Orders
        FOREIGN KEY (OrderId) REFERENCES Orders(OrderId),
    CONSTRAINT FK_OrderItems_Products
        FOREIGN KEY (ProductId) REFERENCES Products(ProductId)
);

CREATE TABLE Payments
(
    PaymentId int PRIMARY KEY,
    OrderId int NOT NULL,
    PaidAmount decimal(10, 2) NOT NULL,
    PaidAt datetime2 NOT NULL,
    CONSTRAINT FK_Payments_Orders
        FOREIGN KEY (OrderId) REFERENCES Orders(OrderId)
);
```

Relationship examples:

```text
Customers -> Orders      : one-to-many
Orders -> OrderItems     : one-to-many
Products -> OrderItems   : one-to-many
Orders -> Payments       : one-to-zero/many depending on business rules
```

Before writing a join, always understand the relationship between the tables. Join correctness depends on business meaning, not only syntax.

### What a join does

A join combines rows using a predicate, usually matching a foreign key to a primary key.

```sql
SELECT
    c.CustomerId,
    c.CustomerName,
    o.OrderId,
    o.OrderDate
FROM Customers AS c
INNER JOIN Orders AS o
    ON o.CustomerId = c.CustomerId;
```

The condition:

```sql
o.CustomerId = c.CustomerId
```

means “match each order to its customer.”

### INNER JOIN

`INNER JOIN` returns only rows where both sides match.

```sql
SELECT
    c.CustomerName,
    o.OrderId,
    o.OrderDate
FROM Customers AS c
INNER JOIN Orders AS o
    ON o.CustomerId = c.CustomerId;
```

Business meaning:

```text
Show customers that have matching orders.
```

Customers without orders do not appear in the result.

Use `INNER JOIN` when:

- A related row is required.
- You only want rows that exist in both tables.
- Missing related data should exclude the row.
- You need columns from both tables for matched rows.

Common examples:

- Orders with their customer.
- Order items with their product.
- Payments with their order.
- Employees with a mandatory department.

### LEFT JOIN

`LEFT JOIN` returns all rows from the left table and matching rows from the right table. If no right-side match exists, right-side columns are returned as `NULL`.

```sql
SELECT
    c.CustomerId,
    c.CustomerName,
    o.OrderId,
    o.OrderDate
FROM Customers AS c
LEFT JOIN Orders AS o
    ON o.CustomerId = c.CustomerId;
```

Business meaning:

```text
Show all customers, including customers with no orders.
```

Use `LEFT JOIN` when:

- The left-side row must be preserved.
- Related data is optional.
- You need to show missing related data.
- You are building a report that includes all parent records.

Common examples:

- All customers and their orders, including customers with no orders.
- All products and sales, including products never sold.
- All employees and managers, including top-level employees.
- All users and last login, including users who never logged in.

### RIGHT JOIN

`RIGHT JOIN` returns all rows from the right table and matching rows from the left table. If no left-side match exists, left-side columns are `NULL`.

```sql
SELECT
    c.CustomerName,
    o.OrderId,
    o.OrderDate
FROM Customers AS c
RIGHT JOIN Orders AS o
    ON o.CustomerId = c.CustomerId;
```

In practice, many teams avoid `RIGHT JOIN` because the same logic can usually be written more readably as a `LEFT JOIN` by swapping table order:

```sql
SELECT
    c.CustomerName,
    o.OrderId,
    o.OrderDate
FROM Orders AS o
LEFT JOIN Customers AS c
    ON c.CustomerId = o.CustomerId;
```

Use `RIGHT JOIN` only when it genuinely improves readability. Most production SQL codebases prefer `LEFT JOIN` for preserved-side logic.

### FULL OUTER JOIN

`FULL OUTER JOIN` returns matched rows and unmatched rows from both sides.

```sql
SELECT
    c.CustomerId,
    c.CustomerName,
    o.OrderId,
    o.OrderDate
FROM Customers AS c
FULL OUTER JOIN Orders AS o
    ON o.CustomerId = c.CustomerId;
```

Business meaning:

```text
Show all customers and all orders, whether or not a match exists.
```

This is useful for reconciliation, migration validation, and comparing two data sets.

Example: compare customers from two systems:

```sql
SELECT
    old.CustomerId AS OldCustomerId,
    new.CustomerId AS NewCustomerId,
    old.CustomerName AS OldCustomerName,
    new.CustomerName AS NewCustomerName
FROM OldSystemCustomers AS old
FULL OUTER JOIN NewSystemCustomers AS new
    ON new.CustomerId = old.CustomerId
WHERE old.CustomerId IS NULL
   OR new.CustomerId IS NULL
   OR old.CustomerName <> new.CustomerName;
```

This finds records missing from either system or records with changed values.

### CROSS JOIN

`CROSS JOIN` returns every combination of rows from both tables. It has no `ON` condition.

```sql
SELECT
    c.CustomerName,
    p.ProductName
FROM Customers AS c
CROSS JOIN Products AS p;
```

If there are 100 customers and 50 products, the result contains:

```text
100 * 50 = 5,000 rows
```

Use `CROSS JOIN` when every combination is intentional, such as:

- Building product-by-month reporting grids.
- Creating date/customer/product combinations.
- Generating test data.
- Combining small lookup sets.

Common mistake: accidentally creating a cross join by forgetting the join condition.

### SELF JOIN

A self join joins a table to itself. This is useful when rows in the same table relate to other rows in that same table.

Example employee hierarchy:

```sql
CREATE TABLE Employees
(
    EmployeeId int PRIMARY KEY,
    EmployeeName varchar(100) NOT NULL,
    ManagerId int NULL,
    CONSTRAINT FK_Employees_Manager
        FOREIGN KEY (ManagerId) REFERENCES Employees(EmployeeId)
);
```

Query employees and their managers:

```sql
SELECT
    e.EmployeeName AS EmployeeName,
    m.EmployeeName AS ManagerName
FROM Employees AS e
LEFT JOIN Employees AS m
    ON m.EmployeeId = e.ManagerId;
```

A `LEFT JOIN` is used because top-level employees may not have a manager.

Self joins are common for:

- Employee-manager hierarchy.
- Category-parent category hierarchy.
- Related products.
- Previous/next records.
- Comparing rows in the same table.

### Joining more than two tables

Real queries often join several tables.

```sql
SELECT
    c.CustomerName,
    o.OrderId,
    o.OrderDate,
    p.ProductName,
    oi.Quantity,
    oi.UnitPrice,
    oi.Quantity * oi.UnitPrice AS LineTotal
FROM Orders AS o
INNER JOIN Customers AS c
    ON c.CustomerId = o.CustomerId
INNER JOIN OrderItems AS oi
    ON oi.OrderId = o.OrderId
INNER JOIN Products AS p
    ON p.ProductId = oi.ProductId;
```

This returns one row per order item, with customer and product details.

Important point: joining one-to-many tables increases row count. One order with five items becomes five result rows.

### Join cardinality

Cardinality describes how many rows from one table can relate to rows in another table.

| Relationship | Meaning | Join impact |
|---|---|---|
| One-to-one | One row relates to at most one row | Usually does not multiply rows |
| One-to-many | One parent has many children | Parent rows can repeat |
| Many-to-many | Many rows relate through a junction table | Can multiply rows significantly |
| Optional relationship | Related row may not exist | Often requires `LEFT JOIN` |

Example one-to-many multiplication:

```sql
SELECT
    o.OrderId,
    oi.OrderItemId
FROM Orders AS o
INNER JOIN OrderItems AS oi
    ON oi.OrderId = o.OrderId;
```

If one order has three items, that order appears three times. This is expected, not automatically a duplicate bug.

### Many-to-many join pattern

A many-to-many relationship is usually modeled with a junction table.

```sql
CREATE TABLE Students
(
    StudentId int PRIMARY KEY,
    StudentName varchar(100) NOT NULL
);

CREATE TABLE Courses
(
    CourseId int PRIMARY KEY,
    CourseName varchar(100) NOT NULL
);

CREATE TABLE StudentCourses
(
    StudentId int NOT NULL,
    CourseId int NOT NULL,
    PRIMARY KEY (StudentId, CourseId),
    FOREIGN KEY (StudentId) REFERENCES Students(StudentId),
    FOREIGN KEY (CourseId) REFERENCES Courses(CourseId)
);
```

Query students and their courses:

```sql
SELECT
    s.StudentName,
    c.CourseName
FROM Students AS s
INNER JOIN StudentCourses AS sc
    ON sc.StudentId = s.StudentId
INNER JOIN Courses AS c
    ON c.CourseId = sc.CourseId;
```

The junction table stores the relationship. The query joins through it.

### LEFT JOIN for missing data

A common anti-join pattern is `LEFT JOIN` plus `IS NULL`.

Customers with no orders:

```sql
SELECT
    c.CustomerId,
    c.CustomerName
FROM Customers AS c
LEFT JOIN Orders AS o
    ON o.CustomerId = c.CustomerId
WHERE o.OrderId IS NULL;
```

Business meaning:

```text
Find customers that do not have any orders.
```

This works because customers without matching orders get `NULL` right-side columns.

### NOT EXISTS anti-join pattern

`NOT EXISTS` is another common way to find rows without a match.

```sql
SELECT
    c.CustomerId,
    c.CustomerName
FROM Customers AS c
WHERE NOT EXISTS
(
    SELECT 1
    FROM Orders AS o
    WHERE o.CustomerId = c.CustomerId
);
```

`NOT EXISTS` is often preferred because it clearly expresses the intent and avoids null-related pitfalls that can occur with `NOT IN`.

### EXISTS semi-join pattern

Use `EXISTS` when you only need to know whether a related row exists.

Customers with at least one paid order:

```sql
SELECT
    c.CustomerId,
    c.CustomerName
FROM Customers AS c
WHERE EXISTS
(
    SELECT 1
    FROM Orders AS o
    WHERE o.CustomerId = c.CustomerId
      AND o.Status = 'Paid'
);
```

This avoids accidental row multiplication. If a customer has five paid orders, the customer still appears once.

Compare with an inner join:

```sql
SELECT
    c.CustomerId,
    c.CustomerName
FROM Customers AS c
INNER JOIN Orders AS o
    ON o.CustomerId = c.CustomerId
WHERE o.Status = 'Paid';
```

This returns one row per paid order unless `DISTINCT` or grouping is added.

### INNER JOIN vs EXISTS

Use `INNER JOIN` when:

- You need columns from both tables.
- You want one row per matching combination.
- Row multiplication is expected and meaningful.

Use `EXISTS` when:

- You only need to test whether a match exists.
- You only return columns from the outer table.
- You want to avoid duplicate parent rows.
- The related table is only used as a filter.

### LEFT JOIN filter placement: ON vs WHERE

A very common SQL interview trap is filtering the right table of a `LEFT JOIN` in the `WHERE` clause.

Requirement:

```text
Show all customers and their paid orders if they have any.
```

Correct:

```sql
SELECT
    c.CustomerName,
    o.OrderId,
    o.Status
FROM Customers AS c
LEFT JOIN Orders AS o
    ON o.CustomerId = c.CustomerId
   AND o.Status = 'Paid';
```

This keeps all customers. Customers with no paid orders still appear with `NULL` order columns.

Incorrect for that requirement:

```sql
SELECT
    c.CustomerName,
    o.OrderId,
    o.Status
FROM Customers AS c
LEFT JOIN Orders AS o
    ON o.CustomerId = c.CustomerId
WHERE o.Status = 'Paid';
```

This removes rows where `o.Status` is `NULL`, so the query behaves like an `INNER JOIN` for paid orders.

Rule of thumb:

```text
Filters that decide which right-side rows match usually belong in ON.
Filters that decide which final result rows to keep usually belong in WHERE.
```

### Filtering the preserved side of a LEFT JOIN

Filtering the preserved left table in `WHERE` is usually safe.

```sql
SELECT
    c.CustomerName,
    o.OrderId
FROM Customers AS c
LEFT JOIN Orders AS o
    ON o.CustomerId = c.CustomerId
WHERE c.CustomerName LIKE 'A%';
```

This means:

```text
Show customers whose names start with A, and include their orders if any.
```

The filter applies to customers, not optional order rows.

### Null handling in joins

SQL `NULL` means unknown or missing. In normal SQL equality comparisons:

```sql
NULL = NULL
```

does not evaluate as true.

This means nullable join columns do not match each other using `=` when both sides are `NULL`.

```sql
SELECT
    a.Id,
    b.Id
FROM TableA AS a
INNER JOIN TableB AS b
    ON a.OptionalCode = b.OptionalCode;
```

Rows where both `OptionalCode` values are `NULL` will not match.

If the business rule requires nulls to match, you must express that explicitly:

```sql
SELECT
    a.Id,
    b.Id
FROM TableA AS a
INNER JOIN TableB AS b
    ON a.OptionalCode = b.OptionalCode
    OR (a.OptionalCode IS NULL AND b.OptionalCode IS NULL);
```

Be careful because this can affect performance. A better model may avoid nullable join keys when the relationship is mandatory.

### NULL values produced by outer joins

Outer joins produce `NULL` values for missing related rows.

```sql
SELECT
    c.CustomerName,
    o.OrderId
FROM Customers AS c
LEFT JOIN Orders AS o
    ON o.CustomerId = c.CustomerId;
```

If a customer has no orders, `o.OrderId` is `NULL`.

For display, you can use `COALESCE`:

```sql
SELECT
    c.CustomerName,
    COALESCE(CAST(o.OrderId AS varchar(20)), 'No order') AS OrderDisplay
FROM Customers AS c
LEFT JOIN Orders AS o
    ON o.CustomerId = c.CustomerId;
```

Use display replacement separately from join logic. Replacing nulls inside join predicates can hide data quality problems or reduce index usage.

### Joining with multiple conditions

A join can use multiple conditions, especially with composite keys.

```sql
SELECT
    s.Sku,
    s.WarehouseId,
    i.QuantityOnHand
FROM ShipmentLines AS s
INNER JOIN Inventory AS i
    ON i.Sku = s.Sku
   AND i.WarehouseId = s.WarehouseId;
```

Best practices:

- Join on all parts of a composite key.
- Do not join only on one column if the relationship requires multiple columns.
- Use clear aliases.
- Keep join column data types consistent.

### Non-key and range joins

Most joins use key relationships, but SQL can join on ranges or other predicates.

```sql
SELECT
    o.OrderId,
    o.OrderDate,
    p.PromotionName
FROM Orders AS o
INNER JOIN Promotions AS p
    ON o.OrderDate >= p.StartDate
   AND o.OrderDate < p.EndDate;
```

Business meaning:

```text
Match each order to the promotion active on the order date.
```

Non-key joins are common in reporting, temporal records, price ranges, and data warehouses. They require careful testing because they can easily produce multiple matches per row.

### Aliases and readability

Good aliases make joins easier to read.

```sql
SELECT
    c.CustomerName,
    o.OrderId
FROM Customers AS c
INNER JOIN Orders AS o
    ON o.CustomerId = c.CustomerId;
```

Use short but meaningful aliases:

- `c` for Customers.
- `o` for Orders.
- `oi` for OrderItems.
- `p` for Products.

Avoid unclear aliases in large queries.

### Explicit JOIN syntax vs old-style joins

Old-style comma joins put tables in the `FROM` clause and conditions in `WHERE`.

```sql
SELECT
    c.CustomerName,
    o.OrderId
FROM Customers AS c, Orders AS o
WHERE o.CustomerId = c.CustomerId;
```

Modern explicit join syntax is preferred:

```sql
SELECT
    c.CustomerName,
    o.OrderId
FROM Customers AS c
INNER JOIN Orders AS o
    ON o.CustomerId = c.CustomerId;
```

Reasons to prefer explicit `JOIN` syntax:

- It separates join conditions from filters.
- It improves readability.
- It reduces accidental cross joins.
- It handles outer joins clearly.
- It is the standard style in modern SQL codebases.

### Joining and aggregation

Joining one-to-many tables before aggregating can multiply rows. This is expected, but it must be handled correctly.

Total sales by customer:

```sql
SELECT
    c.CustomerId,
    c.CustomerName,
    SUM(oi.Quantity * oi.UnitPrice) AS TotalSales
FROM Customers AS c
INNER JOIN Orders AS o
    ON o.CustomerId = c.CustomerId
INNER JOIN OrderItems AS oi
    ON oi.OrderId = o.OrderId
GROUP BY
    c.CustomerId,
    c.CustomerName;
```

This is correct because the total is calculated at the order-item level.

However, joining multiple child tables can cause double counting.

Problem example:

```sql
SELECT
    o.OrderId,
    SUM(oi.Quantity * oi.UnitPrice) AS ItemTotal,
    SUM(p.PaidAmount) AS PaidTotal
FROM Orders AS o
LEFT JOIN OrderItems AS oi
    ON oi.OrderId = o.OrderId
LEFT JOIN Payments AS p
    ON p.OrderId = o.OrderId
GROUP BY
    o.OrderId;
```

If an order has three items and two payments, the join produces six rows. Both totals may be inflated.

Better approach: aggregate each child table first, then join the aggregated results.

```sql
WITH ItemTotals AS
(
    SELECT
        OrderId,
        SUM(Quantity * UnitPrice) AS ItemTotal
    FROM OrderItems
    GROUP BY OrderId
),
PaymentTotals AS
(
    SELECT
        OrderId,
        SUM(PaidAmount) AS PaidTotal
    FROM Payments
    GROUP BY OrderId
)
SELECT
    o.OrderId,
    COALESCE(i.ItemTotal, 0) AS ItemTotal,
    COALESCE(p.PaidTotal, 0) AS PaidTotal
FROM Orders AS o
LEFT JOIN ItemTotals AS i
    ON i.OrderId = o.OrderId
LEFT JOIN PaymentTotals AS p
    ON p.OrderId = o.OrderId;
```

### DISTINCT is not a join fix

Developers sometimes add `DISTINCT` when a join returns more rows than expected.

```sql
SELECT DISTINCT
    c.CustomerId,
    c.CustomerName
FROM Customers AS c
INNER JOIN Orders AS o
    ON o.CustomerId = c.CustomerId;
```

This may produce a list of customers with orders, but it hides the reason rows multiplied. A clearer query is:

```sql
SELECT
    c.CustomerId,
    c.CustomerName
FROM Customers AS c
WHERE EXISTS
(
    SELECT 1
    FROM Orders AS o
    WHERE o.CustomerId = c.CustomerId
);
```

Use `DISTINCT` when the requirement is truly to remove duplicate rows, not as a quick fix for a misunderstood join.

### Logical query processing and join filters

A simplified logical order is:

```text
FROM and JOIN
ON
WHERE
GROUP BY
HAVING
SELECT
ORDER BY
```

This matters because joins happen before `WHERE` filtering. For outer joins, `WHERE` filters can remove rows that the outer join preserved.

### Physical join algorithms

SQL join syntax describes logical result behavior. The database optimizer chooses a physical algorithm to execute it.

Common physical join algorithms:

- **Nested loops join**: often good when one input is small and the other has an efficient index lookup.
- **Hash join**: often good for large unsorted inputs.
- **Merge join**: often good when both inputs are sorted by the join key.

Interview point:

```text
INNER JOIN describes result semantics.
Nested loops, hash, and merge describe execution strategy.
```

Do not confuse logical join type with physical join algorithm.

### Join performance basics

Join performance depends on:

- Indexes on join keys.
- Correct statistics.
- Row counts and data distribution.
- Join type.
- Predicate selectivity.
- Projection size.
- Sargability.
- Avoiding unnecessary joins.
- Avoiding functions on indexed join columns.
- Matching data types on both sides of the join.
- Avoiding accidental many-to-many multiplication.

Useful indexes:

```sql
CREATE INDEX IX_Orders_CustomerId
ON Orders(CustomerId);

CREATE INDEX IX_OrderItems_OrderId
ON OrderItems(OrderId);

CREATE INDEX IX_OrderItems_ProductId
ON OrderItems(ProductId);
```

Foreign key columns are often important index candidates because they are frequently used in joins.

### Data type mismatch in joins

Joining columns with different data types can cause implicit conversions and poor performance.

Problem:

```sql
-- Customers.CustomerId is int
-- Orders.CustomerIdText is varchar
SELECT
    c.CustomerName,
    o.OrderId
FROM Customers AS c
INNER JOIN Orders AS o
    ON o.CustomerIdText = c.CustomerId;
```

Better practices:

- Use consistent data types in schema design.
- Fix schema mismatches where possible.
- Avoid joining numeric IDs to text columns.
- Avoid conversion functions on indexed join keys in high-volume queries.

### Joining on functions

Joining on expressions can reduce index usage.

Problem:

```sql
SELECT
    a.Id,
    b.Id
FROM TableA AS a
INNER JOIN TableB AS b
    ON LOWER(a.Email) = LOWER(b.Email);
```

Better options:

- Store normalized email values.
- Use an appropriate collation.
- Use computed indexed columns where appropriate.
- Clean data before storing it.

### OUTER APPLY and CROSS APPLY

In SQL Server, `APPLY` is useful when the right side depends on each row from the left side.

Example: latest order for each customer:

```sql
SELECT
    c.CustomerId,
    c.CustomerName,
    latest.OrderId,
    latest.OrderDate
FROM Customers AS c
OUTER APPLY
(
    SELECT TOP (1)
        o.OrderId,
        o.OrderDate
    FROM Orders AS o
    WHERE o.CustomerId = c.CustomerId
    ORDER BY o.OrderDate DESC, o.OrderId DESC
) AS latest;
```

`OUTER APPLY` keeps customers without orders. `CROSS APPLY` removes left-side rows when the right-side query returns no rows.

Use `APPLY` when:

- The right-side query depends on each left-side row.
- You need top 1 or top N related rows per parent.
- You are calling table-valued functions.
- A normal join would be less readable.

### Latest row per group pattern

A common interview task is “get each customer’s latest order.”

Using `OUTER APPLY`:

```sql
SELECT
    c.CustomerId,
    c.CustomerName,
    latest.OrderId,
    latest.OrderDate
FROM Customers AS c
OUTER APPLY
(
    SELECT TOP (1)
        o.OrderId,
        o.OrderDate
    FROM Orders AS o
    WHERE o.CustomerId = c.CustomerId
    ORDER BY o.OrderDate DESC, o.OrderId DESC
) AS latest;
```

Using `ROW_NUMBER`:

```sql
WITH RankedOrders AS
(
    SELECT
        o.OrderId,
        o.CustomerId,
        o.OrderDate,
        ROW_NUMBER() OVER
        (
            PARTITION BY o.CustomerId
            ORDER BY o.OrderDate DESC, o.OrderId DESC
        ) AS RowNumber
    FROM Orders AS o
)
SELECT
    c.CustomerId,
    c.CustomerName,
    r.OrderId,
    r.OrderDate
FROM Customers AS c
LEFT JOIN RankedOrders AS r
    ON r.CustomerId = c.CustomerId
   AND r.RowNumber = 1;
```

Both can be valid. The better option depends on indexing, data volume, and readability.

### Reporting grid pattern

Sometimes a report must show rows even when data is missing. A common pattern is:

1. Create the complete grid with `CROSS JOIN`.
2. `LEFT JOIN` actual facts.
3. Use `COALESCE` to show zero when no data exists.

```sql
WITH Months AS
(
    SELECT DATEFROMPARTS(2026, 1, 1) AS MonthStart
    UNION ALL
    SELECT DATEFROMPARTS(2026, 2, 1)
    UNION ALL
    SELECT DATEFROMPARTS(2026, 3, 1)
),
SalesByProductMonth AS
(
    SELECT
        oi.ProductId,
        DATEFROMPARTS(YEAR(o.OrderDate), MONTH(o.OrderDate), 1) AS MonthStart,
        SUM(oi.Quantity * oi.UnitPrice) AS SalesAmount
    FROM Orders AS o
    INNER JOIN OrderItems AS oi
        ON oi.OrderId = o.OrderId
    GROUP BY
        oi.ProductId,
        DATEFROMPARTS(YEAR(o.OrderDate), MONTH(o.OrderDate), 1)
)
SELECT
    p.ProductName,
    m.MonthStart,
    COALESCE(s.SalesAmount, 0) AS SalesAmount
FROM Products AS p
CROSS JOIN Months AS m
LEFT JOIN SalesByProductMonth AS s
    ON s.ProductId = p.ProductId
   AND s.MonthStart = m.MonthStart;
```

This shows every product-month combination, even if sales are zero.

### Common join mistakes

Common mistakes include:

- Using `INNER JOIN` when optional rows should be preserved.
- Filtering the right side of a `LEFT JOIN` in `WHERE` and accidentally removing unmatched rows.
- Forgetting the join condition and creating a cross join.
- Joining on the wrong key, such as joining by name instead of ID.
- Ignoring one-to-many row multiplication.
- Using `DISTINCT` to hide a bad join.
- Using `NOT IN` with nullable data.
- Selecting too many columns.
- Not indexing join keys.
- Joining columns with mismatched data types.
- Using functions on join columns.
- Mixing old-style comma joins with explicit joins.

### Best practices

Good SQL join habits include:

- Use explicit `JOIN ... ON` syntax.
- Use meaningful table aliases.
- Join on keys, preferably primary key to foreign key.
- Understand the table relationship before writing the query.
- Choose `INNER JOIN` when a match is required.
- Choose `LEFT JOIN` when the left row must be preserved.
- Prefer `LEFT JOIN` over `RIGHT JOIN` for readability in most cases.
- Use `FULL OUTER JOIN` for reconciliation and data comparison.
- Use `EXISTS` when only existence matters.
- Use `NOT EXISTS` for anti-join logic.
- Put right-side filters for a `LEFT JOIN` in the `ON` clause when left rows must remain.
- Aggregate child tables before joining when joining multiple one-to-many relationships.
- Avoid `DISTINCT` as a quick fix for row multiplication.
- Index foreign key columns and common join keys.
- Keep join column data types consistent.
- Review execution plans for expensive queries.
- Test queries with rows that have no match.
- Test queries with multiple child rows.
- Test queries with nulls when nullable columns are involved.

### Practical join selection guide

```text
Do I need only rows that match on both sides?
  -> Use INNER JOIN.

Do I need all rows from the left table, even without a match?
  -> Use LEFT JOIN.

Do I need all rows from both tables, matched and unmatched?
  -> Use FULL OUTER JOIN.

Do I need every combination of two sets?
  -> Use CROSS JOIN.

Do I need to join a table to itself?
  -> Use SELF JOIN.

Do I only need to know whether a match exists?
  -> Use EXISTS.

Do I need rows where no match exists?
  -> Use NOT EXISTS or LEFT JOIN ... IS NULL.

Do I need the latest or top related row per parent?
  -> Consider OUTER APPLY or a window function.
```

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is a SQL join?

<!-- question:start:sql-join-patterns-beginner-q01 -->
<!-- question-id:sql-join-patterns-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A SQL join combines rows from two or more tables based on a related column or condition. Joins are needed because relational databases usually store related data in separate normalized tables.

For example, customers may be stored in a `Customers` table and orders may be stored in an `Orders` table. A join can combine customer information with order information by matching `Customers.CustomerId` to `Orders.CustomerId`.

Joins are fundamental for retrieving meaningful data from a relational model.

##### Key Points to Mention

- Joins combine rows from related tables.
- They are commonly based on primary key and foreign key relationships.
- Joins are required because normalized data is split across tables.
- Common join types include inner, left, right, full outer, cross, and self joins.
- Correct join choice depends on business requirements.

<!-- question:end:sql-join-patterns-beginner-q01 -->

#### What is the difference between INNER JOIN and LEFT JOIN?

<!-- question:start:sql-join-patterns-beginner-q02 -->
<!-- question-id:sql-join-patterns-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

An `INNER JOIN` returns only rows where both tables have a matching row. If there is no match, the row is excluded.

A `LEFT JOIN` returns all rows from the left table and matching rows from the right table. If there is no match on the right side, the result still includes the left row, but the right-side columns are returned as `NULL`.

Use `INNER JOIN` when a match is required. Use `LEFT JOIN` when you need to preserve all rows from the left table.

##### Key Points to Mention

- `INNER JOIN` returns matching rows only.
- `LEFT JOIN` preserves all rows from the left table.
- Missing right-side data appears as `NULL`.
- `LEFT JOIN` is useful for optional relationships.
- Business requirement determines the join type.

<!-- question:end:sql-join-patterns-beginner-q02 -->

#### What does a FULL OUTER JOIN do?

<!-- question:start:sql-join-patterns-beginner-q03 -->
<!-- question-id:sql-join-patterns-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A `FULL OUTER JOIN` returns all matching and non-matching rows from both tables. If a row exists only in the left table, right-side columns are `NULL`. If a row exists only in the right table, left-side columns are `NULL`.

It is useful for reconciliation and data comparison, such as comparing records between two systems and finding missing or mismatched rows.

##### Key Points to Mention

- Returns matched rows.
- Preserves unmatched rows from both sides.
- Missing side is represented by `NULL`.
- Useful for reconciliation, migration validation, and data quality checks.
- Less common than `INNER JOIN` and `LEFT JOIN` in application queries.

<!-- question:end:sql-join-patterns-beginner-q03 -->

#### What is a CROSS JOIN?

<!-- question:start:sql-join-patterns-beginner-q04 -->
<!-- question-id:sql-join-patterns-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A `CROSS JOIN` returns every combination of rows from two tables. If one table has 10 rows and the other table has 5 rows, the result has 50 rows.

It is useful when all combinations are intentionally needed, such as generating a product-by-month reporting grid. It can be dangerous if created accidentally by forgetting a join condition.

##### Key Points to Mention

- Produces Cartesian product.
- Row count equals left rows multiplied by right rows.
- Does not use an `ON` condition.
- Useful for generating combinations.
- Can create huge result sets accidentally.

<!-- question:end:sql-join-patterns-beginner-q04 -->

#### What is a self join?

<!-- question:start:sql-join-patterns-beginner-q05 -->
<!-- question-id:sql-join-patterns-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

A self join joins a table to itself. It is used when rows in the same table are related to other rows in that table.

A common example is an `Employees` table where each employee has a `ManagerId` that references another employee. The table can be joined to itself to show each employee and their manager.

##### Key Points to Mention

- A self join uses the same table twice.
- Table aliases are required for clarity.
- Common for hierarchies.
- Examples include employees and managers, categories and parent categories, or related records.
- Can use inner or outer join depending on whether related rows are optional.

<!-- question:end:sql-join-patterns-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why can a LEFT JOIN accidentally behave like an INNER JOIN?

<!-- question:start:sql-join-patterns-intermediate-q01 -->
<!-- question-id:sql-join-patterns-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

A `LEFT JOIN` can accidentally behave like an `INNER JOIN` when a filter on the right-side table is placed in the `WHERE` clause.

Example:

```sql
SELECT
    c.CustomerName,
    o.OrderId
FROM Customers AS c
LEFT JOIN Orders AS o
    ON o.CustomerId = c.CustomerId
WHERE o.Status = 'Paid';
```

This removes rows where `o.Status` is `NULL`, which removes customers without paid orders. If the requirement is to keep all customers and show paid orders when available, the filter should be in the `ON` clause:

```sql
SELECT
    c.CustomerName,
    o.OrderId
FROM Customers AS c
LEFT JOIN Orders AS o
    ON o.CustomerId = c.CustomerId
   AND o.Status = 'Paid';
```

##### Key Points to Mention

- `LEFT JOIN` preserves left rows.
- Missing right-side rows produce `NULL`.
- `WHERE` filters are applied after the join.
- A `WHERE` condition on right-side columns can remove preserved rows.
- Put right-side match filters in `ON` when preserving left rows matters.

<!-- question:end:sql-join-patterns-intermediate-q01 -->

#### How do you find rows in one table that do not have a match in another table?

<!-- question:start:sql-join-patterns-intermediate-q02 -->
<!-- question-id:sql-join-patterns-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

There are two common anti-join patterns.

Using `LEFT JOIN` and `IS NULL`:

```sql
SELECT
    c.CustomerId,
    c.CustomerName
FROM Customers AS c
LEFT JOIN Orders AS o
    ON o.CustomerId = c.CustomerId
WHERE o.OrderId IS NULL;
```

Using `NOT EXISTS`:

```sql
SELECT
    c.CustomerId,
    c.CustomerName
FROM Customers AS c
WHERE NOT EXISTS
(
    SELECT 1
    FROM Orders AS o
    WHERE o.CustomerId = c.CustomerId
);
```

Both can find customers with no orders. `NOT EXISTS` is often preferred because it clearly expresses the intent and avoids common null pitfalls associated with `NOT IN`.

##### Key Points to Mention

- This is an anti-join pattern.
- `LEFT JOIN ... IS NULL` is common.
- `NOT EXISTS` is also common and clear.
- Avoid `NOT IN` when nullable values are possible.
- Use indexes on the join/filter columns.

<!-- question:end:sql-join-patterns-intermediate-q02 -->

#### When should you use EXISTS instead of INNER JOIN?

<!-- question:start:sql-join-patterns-intermediate-q03 -->
<!-- question-id:sql-join-patterns-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use `EXISTS` when you only need to know whether a related row exists and do not need to return columns from the related table.

For example, to find customers who have at least one paid order:

```sql
SELECT
    c.CustomerId,
    c.CustomerName
FROM Customers AS c
WHERE EXISTS
(
    SELECT 1
    FROM Orders AS o
    WHERE o.CustomerId = c.CustomerId
      AND o.Status = 'Paid'
);
```

An `INNER JOIN` may return multiple rows for the same customer if the customer has multiple paid orders. `EXISTS` avoids accidental row multiplication and communicates the intent more clearly.

##### Key Points to Mention

- Use `EXISTS` for existence checks.
- Use `JOIN` when columns from both tables are needed.
- `EXISTS` avoids duplicate parent rows.
- Good for filtering parent rows by related data.
- Often clearer than `JOIN` plus `DISTINCT`.

<!-- question:end:sql-join-patterns-intermediate-q03 -->

#### Why can joins create duplicate-looking rows?

<!-- question:start:sql-join-patterns-intermediate-q04 -->
<!-- question-id:sql-join-patterns-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Joins can create duplicate-looking rows because of one-to-many or many-to-many relationships. For example, one customer can have many orders. When customers are joined to orders, the customer columns repeat once for each matching order.

This is not always a mistake. It is often the correct relational result. The mistake is usually misunderstanding the cardinality or expecting one row per parent when the join naturally returns one row per child.

If the requirement is one row per customer, use aggregation, `EXISTS`, window functions, or a subquery depending on the goal.

##### Key Points to Mention

- One-to-many joins repeat parent data.
- Many-to-many joins can multiply rows significantly.
- Repeated parent values are not necessarily duplicates.
- `DISTINCT` may hide a misunderstanding.
- Use aggregation or `EXISTS` when one row per parent is required.
- Understand cardinality before writing the query.

<!-- question:end:sql-join-patterns-intermediate-q04 -->

#### Why is DISTINCT not always the right fix for join duplicates?

<!-- question:start:sql-join-patterns-intermediate-q05 -->
<!-- question-id:sql-join-patterns-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

`DISTINCT` removes duplicate result rows, but it may hide an incorrect join or misunderstood cardinality. If a customer appears multiple times because they have multiple orders, that is not necessarily a duplicate; it is the natural result of the join.

If the goal is to find customers who have orders, `EXISTS` may be clearer. If the goal is one row per customer with totals, use `GROUP BY`. If the goal is the latest order, use a window function or `OUTER APPLY`.

`DISTINCT` should be used when the business requirement is truly to remove duplicate rows, not as a quick fix.

##### Key Points to Mention

- `DISTINCT` may hide logic errors.
- Repeated rows can be caused by valid one-to-many relationships.
- Use `EXISTS` for existence checks.
- Use `GROUP BY` for aggregates.
- Use window functions or `APPLY` for top row per group.
- Understand why rows are multiplied first.

<!-- question:end:sql-join-patterns-intermediate-q05 -->

#### How do NULL values affect joins?

<!-- question:start:sql-join-patterns-intermediate-q06 -->
<!-- question-id:sql-join-patterns-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

In SQL, `NULL` represents unknown or missing data. A normal equality comparison does not treat `NULL = NULL` as true. Therefore, if two nullable join columns both contain `NULL`, they do not match with a normal `=` join condition.

Outer joins can also produce `NULL` values for missing related rows. For example, a `LEFT JOIN` returns `NULL` for right-side columns when no match exists.

If business rules require nulls to match, the query must explicitly handle it, but this should be done carefully because it can affect performance and may indicate a schema design issue.

##### Key Points to Mention

- `NULL = NULL` is not true in normal SQL comparisons.
- Nullable join keys may not match as expected.
- Outer joins produce `NULL` for missing rows.
- Use `IS NULL` for null checks.
- Be careful with `NOT IN` and nulls.
- Avoid nullable join keys when the relationship should be mandatory.

<!-- question:end:sql-join-patterns-intermediate-q06 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How do you avoid double counting when joining multiple one-to-many tables?

<!-- question:start:sql-join-patterns-advanced-q01 -->
<!-- question-id:sql-join-patterns-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Double counting happens when a parent table is joined to multiple child tables at the same time. For example, an order with three order items and two payments produces six joined rows. Aggregating after that join can inflate totals.

A common fix is to aggregate each child table first and then join the aggregated results back to the parent.

```sql
WITH ItemTotals AS
(
    SELECT
        OrderId,
        SUM(Quantity * UnitPrice) AS ItemTotal
    FROM OrderItems
    GROUP BY OrderId
),
PaymentTotals AS
(
    SELECT
        OrderId,
        SUM(PaidAmount) AS PaidTotal
    FROM Payments
    GROUP BY OrderId
)
SELECT
    o.OrderId,
    COALESCE(i.ItemTotal, 0) AS ItemTotal,
    COALESCE(p.PaidTotal, 0) AS PaidTotal
FROM Orders AS o
LEFT JOIN ItemTotals AS i
    ON i.OrderId = o.OrderId
LEFT JOIN PaymentTotals AS p
    ON p.OrderId = o.OrderId;
```

##### Key Points to Mention

- Multiple one-to-many joins can multiply rows.
- Aggregating after multiplication can inflate totals.
- Aggregate each child table first.
- Join aggregated results to the parent.
- Understand the grain of each result set.
- Validate with test data containing multiple children on both sides.

<!-- question:end:sql-join-patterns-advanced-q01 -->

#### What is the difference between logical join types and physical join algorithms?

<!-- question:start:sql-join-patterns-advanced-q02 -->
<!-- question-id:sql-join-patterns-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Logical join types describe the result semantics of the query. Examples include `INNER JOIN`, `LEFT JOIN`, `FULL OUTER JOIN`, and `CROSS JOIN`.

Physical join algorithms describe how the database engine executes the join. Common physical algorithms include nested loops join, hash join, and merge join.

Developers write logical join types in SQL. The optimizer chooses the physical algorithm based on indexes, statistics, row estimates, sorting, and cost. For example, an `INNER JOIN` could be executed as a nested loops join, hash join, or merge join.

##### Key Points to Mention

- Logical join type defines result behavior.
- Physical join algorithm defines execution strategy.
- Nested loops works well for small/selective lookups.
- Hash join works well for larger unsorted sets.
- Merge join works well for sorted inputs.
- The optimizer chooses based on cost estimates.

<!-- question:end:sql-join-patterns-advanced-q02 -->

#### How would you optimize a slow join query?

<!-- question:start:sql-join-patterns-advanced-q03 -->
<!-- question-id:sql-join-patterns-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

I would start by checking the execution plan and identifying expensive operators, estimated vs actual row counts, scans, lookups, spills, missing indexes, and implicit conversions.

Then I would verify that join columns have appropriate indexes, foreign key columns are indexed where useful, data types match, predicates are selective and sargable, and unnecessary columns or joins are removed.

I would also check whether the query is joining at the wrong grain, multiplying rows, filtering too late, or using functions on join columns. Sometimes aggregating first, rewriting with `EXISTS`, or projecting fewer columns improves performance.

##### Key Points to Mention

- Review the execution plan.
- Check indexes on join and filter columns.
- Check statistics and row estimates.
- Avoid implicit conversions.
- Avoid functions on join columns.
- Remove unnecessary joins and columns.
- Consider `EXISTS`, pre-aggregation, or better predicates.
- Validate improvements with realistic data volume.

<!-- question:end:sql-join-patterns-advanced-q03 -->

#### How do you get the latest related row per parent?

<!-- question:start:sql-join-patterns-advanced-q04 -->
<!-- question-id:sql-join-patterns-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Two common patterns are `OUTER APPLY` and window functions.

Using `OUTER APPLY`:

```sql
SELECT
    c.CustomerId,
    c.CustomerName,
    latest.OrderId,
    latest.OrderDate
FROM Customers AS c
OUTER APPLY
(
    SELECT TOP (1)
        o.OrderId,
        o.OrderDate
    FROM Orders AS o
    WHERE o.CustomerId = c.CustomerId
    ORDER BY o.OrderDate DESC, o.OrderId DESC
) AS latest;
```

Using `ROW_NUMBER`:

```sql
WITH RankedOrders AS
(
    SELECT
        o.OrderId,
        o.CustomerId,
        o.OrderDate,
        ROW_NUMBER() OVER
        (
            PARTITION BY o.CustomerId
            ORDER BY o.OrderDate DESC, o.OrderId DESC
        ) AS RowNumber
    FROM Orders AS o
)
SELECT
    c.CustomerId,
    c.CustomerName,
    r.OrderId,
    r.OrderDate
FROM Customers AS c
LEFT JOIN RankedOrders AS r
    ON r.CustomerId = c.CustomerId
   AND r.RowNumber = 1;
```

Both approaches can be valid. The best choice depends on indexes, data volume, and readability.

##### Key Points to Mention

- Latest row per group is common in interviews.
- `OUTER APPLY` works well for correlated top-one queries.
- `ROW_NUMBER` is a common window-function solution.
- Use deterministic ordering with tie-breakers.
- Use `LEFT JOIN` or `OUTER APPLY` if parents without children should remain.
- Indexes on parent key and date/order columns are important.

<!-- question:end:sql-join-patterns-advanced-q04 -->

#### How would you compare two tables and find missing or mismatched rows?

<!-- question:start:sql-join-patterns-advanced-q05 -->
<!-- question-id:sql-join-patterns-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

A `FULL OUTER JOIN` is useful for comparing two data sets because it preserves rows from both sides. You can then filter for rows missing from either side or rows with different values.

```sql
SELECT
    a.Id AS SourceAId,
    b.Id AS SourceBId,
    a.Amount AS SourceAAmount,
    b.Amount AS SourceBAmount
FROM SourceA AS a
FULL OUTER JOIN SourceB AS b
    ON b.Id = a.Id
WHERE a.Id IS NULL
   OR b.Id IS NULL
   OR a.Amount <> b.Amount;
```

This identifies records missing from `SourceA`, records missing from `SourceB`, and records where the amounts differ.

For nullable compared columns, additional null-safe comparison logic may be required.

##### Key Points to Mention

- `FULL OUTER JOIN` preserves unmatched rows from both sides.
- Useful for reconciliation and migration validation.
- Filter where one side is null to find missing rows.
- Compare selected columns to find mismatches.
- Handle nullable compared columns carefully.
- Use consistent keys and data types.

<!-- question:end:sql-join-patterns-advanced-q05 -->

#### Why can joining on expressions or different data types hurt performance?

<!-- question:start:sql-join-patterns-advanced-q06 -->
<!-- question-id:sql-join-patterns-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Joining on expressions or mismatched data types can prevent efficient index usage. For example, joining `LOWER(a.Email)` to `LOWER(b.Email)` requires computing a function for rows before comparison. Joining an `int` column to a `varchar` column may cause implicit conversion.

These issues can lead to scans, poor estimates, conversion errors, or slower joins. A better design uses consistent data types, normalized stored values, appropriate collations, computed indexed columns when needed, and clean schema design.

##### Key Points to Mention

- Functions on join columns can make predicates non-sargable.
- Mismatched data types can cause implicit conversions.
- Implicit conversions can prevent index seeks.
- Use consistent data types for related keys.
- Normalize data before storing when possible.
- Consider indexed computed columns for special cases.

<!-- question:end:sql-join-patterns-advanced-q06 -->

#### How does join choice relate to relational modeling?

<!-- question:start:sql-join-patterns-advanced-q07 -->
<!-- question-id:sql-join-patterns-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Join choice depends on the relationship between tables and the business requirement. In a normalized relational model, data is split into tables with primary keys, foreign keys, and relationship constraints. Joins reconstruct data across those relationships.

For mandatory relationships, `INNER JOIN` is often correct. For optional relationships, `LEFT JOIN` may be needed. For many-to-many relationships, a junction table is required. For reconciliation, `FULL OUTER JOIN` may be appropriate.

Understanding the model prevents common mistakes such as wrong join keys, accidental row multiplication, filtering away optional rows, and using `DISTINCT` to hide cardinality problems.

##### Key Points to Mention

- Joins reflect table relationships.
- Primary keys and foreign keys guide join conditions.
- Optional relationships often need outer joins.
- Many-to-many relationships use junction tables.
- Cardinality affects row counts.
- Good relational modeling makes joins safer and clearer.

<!-- question:end:sql-join-patterns-advanced-q07 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
