---
id: primary-keys-foreign-keys-constraints
topic: Core querying and data retrieval
subtopic: Primary keys, foreign keys, and constraints
category: SQL
---

# Primary keys, foreign keys, and database constraints

## Overview

Primary keys, foreign keys, and constraints are core relational database concepts used to protect data integrity. They define what valid data looks like, how rows are uniquely identified, and how tables relate to each other. In SQL Server and most relational databases, constraints are not just documentation. They are rules enforced by the database engine.

A primary key identifies each row in a table. A foreign key connects rows in one table to rows in another table. Other constraints, such as `NOT NULL`, `UNIQUE`, `CHECK`, and `DEFAULT`, control whether values are required, unique, valid, or automatically populated.

This topic matters because application code alone is not enough to protect data. If multiple applications, APIs, jobs, scripts, imports, and users can write to the same database, the database must enforce the most important rules. Constraints prevent invalid rows, orphan records, duplicate business keys, missing required values, and inconsistent relationships.

For interviews, this topic is important because it tests both SQL fundamentals and real-world design judgment. A strong candidate should be able to explain:

- What primary keys and foreign keys are.
- How constraints enforce entity integrity, referential integrity, and domain integrity.
- The difference between primary key, foreign key, unique constraint, check constraint, default constraint, and not-null constraint.
- How constraints affect inserts, updates, deletes, joins, indexing, and query plans.
- Why a foreign key column should often be indexed.
- How cascade delete works and when it is risky.
- How to choose between natural keys, surrogate keys, and composite keys.
- How database constraints relate to application validation.

In practical systems, constraints are part of the contract of the database. They make data safer, queries more reliable, and bugs easier to detect early.

## Core Concepts

### What is a database constraint?

A constraint is a rule defined on a table or column that limits what data can be stored. Constraints help the database enforce correctness.

Common SQL constraints include:

| Constraint | Purpose |
|---|---|
| `PRIMARY KEY` | Uniquely identifies each row in a table |
| `FOREIGN KEY` | Enforces a relationship to a row in another table |
| `UNIQUE` | Ensures one or more columns have unique values |
| `NOT NULL` | Requires a column to contain a value |
| `CHECK` | Requires values to satisfy a Boolean condition |
| `DEFAULT` | Supplies a value when one is not provided |

Constraints are useful because they keep invalid data out of the database even when bugs exist in application code.

Example:

```sql
CREATE TABLE Customers
(
    CustomerId INT IDENTITY(1,1) NOT NULL,
    Email NVARCHAR(320) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,
    Status NVARCHAR(20) NOT NULL,
    CreatedAtUtc DATETIME2 NOT NULL
        CONSTRAINT DF_Customers_CreatedAtUtc DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Customers PRIMARY KEY (CustomerId),
    CONSTRAINT UQ_Customers_Email UNIQUE (Email),
    CONSTRAINT CK_Customers_Status CHECK (Status IN ('Active', 'Inactive', 'Blocked'))
);
```

This table enforces:

- Every customer has an ID.
- Every customer has an email.
- Emails are unique.
- Status must be one of a known set of values.
- Creation time defaults to the current UTC time.

### Why constraints matter

Constraints protect data integrity at the database level. This matters because data can be written from many places:

- Web APIs.
- Admin tools.
- Background jobs.
- ETL imports.
- Stored procedures.
- Data repair scripts.
- Integration services.
- Direct database access.
- Multiple application versions during deployment.

If validation exists only in application code, another writer can bypass it. Database constraints enforce critical rules consistently.

Example problem without a foreign key:

```text
Orders table contains CustomerId = 999
Customers table has no CustomerId = 999
```

This is called an orphan row. It makes joins unreliable and can break reports, APIs, and business workflows.

With a foreign key, the database rejects the invalid order.

### Entity integrity, referential integrity, and domain integrity

Interviewers often expect these terms.

#### Entity integrity

Entity integrity means each row in a table can be uniquely identified. Primary keys enforce entity integrity.

Example:

```sql
CONSTRAINT PK_Orders PRIMARY KEY (OrderId)
```

This prevents duplicate `OrderId` values and prevents `OrderId` from being `NULL`.

#### Referential integrity

Referential integrity means relationships between tables remain valid. Foreign keys enforce referential integrity.

Example:

```sql
CONSTRAINT FK_Orders_Customers
FOREIGN KEY (CustomerId)
REFERENCES Customers(CustomerId)
```

This prevents an order from referencing a customer that does not exist.

#### Domain integrity

Domain integrity means values in a column are valid for that column's business domain. `CHECK`, `NOT NULL`, `DEFAULT`, and data types help enforce domain integrity.

Example:

```sql
CONSTRAINT CK_Products_Price
CHECK (Price >= 0)
```

This prevents negative product prices.

### Primary keys

A primary key is a column or set of columns that uniquely identifies each row in a table.

Example:

```sql
CREATE TABLE Products
(
    ProductId INT IDENTITY(1,1) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Price DECIMAL(18, 2) NOT NULL,

    CONSTRAINT PK_Products PRIMARY KEY (ProductId)
);
```

A primary key has two important properties:

- It must be unique.
- It cannot contain `NULL`.

A table can have only one primary key constraint, but that primary key can be made of one column or multiple columns.

### Primary key and unique index behavior

In SQL Server, a primary key constraint is enforced using a unique index. By default, SQL Server may create it as a clustered index unless specified otherwise and unless a clustered index already exists. You can explicitly choose clustered or nonclustered.

Example:

```sql
CREATE TABLE Orders
(
    OrderId BIGINT NOT NULL,
    CustomerId INT NOT NULL,
    CreatedAtUtc DATETIME2 NOT NULL,

    CONSTRAINT PK_Orders PRIMARY KEY CLUSTERED (OrderId)
);
```

Or:

```sql
CREATE TABLE Orders
(
    OrderId BIGINT NOT NULL,
    CustomerId INT NOT NULL,
    CreatedAtUtc DATETIME2 NOT NULL,

    CONSTRAINT PK_Orders PRIMARY KEY NONCLUSTERED (OrderId)
);
```

Important interview point:

```text
A primary key is a logical constraint.
A clustered index is a physical storage/indexing choice.
They are related in SQL Server, but they are not the same concept.
```

### Surrogate keys vs natural keys

A primary key can be a surrogate key or a natural key.

#### Surrogate key

A surrogate key is an artificial identifier created by the system.

Examples:

```sql
CustomerId INT IDENTITY(1,1)
OrderId UNIQUEIDENTIFIER
ProductId BIGINT
```

Benefits:

- Usually small and stable.
- Does not change when business attributes change.
- Good for joins and relationships.
- Hides business meaning.
- Easy to reference from child tables.

Trade-offs:

- Does not prevent duplicate real-world business values by itself.
- Often needs additional `UNIQUE` constraints.

Example:

```sql
CREATE TABLE Customers
(
    CustomerId INT IDENTITY(1,1) NOT NULL,
    Email NVARCHAR(320) NOT NULL,

    CONSTRAINT PK_Customers PRIMARY KEY (CustomerId),
    CONSTRAINT UQ_Customers_Email UNIQUE (Email)
);
```

Here `CustomerId` is the surrogate primary key, while `Email` is a business key protected by a unique constraint.

#### Natural key

A natural key is a real business value that uniquely identifies a row.

Examples:

```text
Email
NationalId
CountryCode
SKU
ISBN
```

Benefits:

- Meaningful to the business.
- Can prevent duplicate business records directly.
- Sometimes avoids an extra column.

Trade-offs:

- Business values can change.
- Values may be long or composite.
- Privacy concerns may exist.
- Business uniqueness rules can evolve.
- Foreign keys become larger if the natural key is referenced by many tables.

Practical recommendation:

```text
Use surrogate keys for stable internal identity.
Use unique constraints for important natural/business keys.
```

### Composite primary keys

A composite primary key uses multiple columns to uniquely identify a row.

Example many-to-many join table:

```sql
CREATE TABLE StudentCourses
(
    StudentId INT NOT NULL,
    CourseId INT NOT NULL,
    EnrolledAtUtc DATETIME2 NOT NULL
        CONSTRAINT DF_StudentCourses_EnrolledAtUtc DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_StudentCourses PRIMARY KEY (StudentId, CourseId)
);
```

This means a student can enroll in a course only once.

Composite keys are common in:

- Join tables.
- Associative entities.
- Multi-tenant tables.
- Historical/versioned tables.
- Tables where identity is naturally made from multiple attributes.

Example multi-tenant key:

```sql
CREATE TABLE TenantUsers
(
    TenantId INT NOT NULL,
    UserId INT NOT NULL,
    DisplayName NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_TenantUsers PRIMARY KEY (TenantId, UserId)
);
```

Composite keys can be useful but may make foreign keys and joins more verbose.

### Foreign keys

A foreign key is a column or group of columns in one table that references a candidate key in another table, usually the primary key.

Example:

```sql
CREATE TABLE Orders
(
    OrderId INT IDENTITY(1,1) NOT NULL,
    CustomerId INT NOT NULL,
    OrderDateUtc DATETIME2 NOT NULL,

    CONSTRAINT PK_Orders PRIMARY KEY (OrderId),
    CONSTRAINT FK_Orders_Customers
        FOREIGN KEY (CustomerId)
        REFERENCES Customers(CustomerId)
);
```

Terminology:

| Term | Meaning |
|---|---|
| Parent table | The referenced table |
| Child table | The table containing the foreign key |
| Referenced key | The primary or unique key being referenced |
| Referencing column | The foreign key column in the child table |

In this example:

- `Customers` is the parent table.
- `Orders` is the child table.
- `Customers.CustomerId` is the referenced key.
- `Orders.CustomerId` is the foreign key column.

### What a foreign key prevents

A foreign key prevents invalid relationships.

Example:

```sql
INSERT INTO Orders (CustomerId, OrderDateUtc)
VALUES (999, SYSUTCDATETIME());
```

If no customer with `CustomerId = 999` exists, the database rejects the insert.

A foreign key also affects parent row updates and deletes. If an order references a customer, the database prevents deleting that customer unless a referential action such as cascade delete is configured or the child rows are handled first.

### Nullable foreign keys

A foreign key column can be nullable unless you explicitly define it as `NOT NULL`.

Example:

```sql
CREATE TABLE Orders
(
    OrderId INT IDENTITY(1,1) NOT NULL,
    SalesRepId INT NULL,

    CONSTRAINT PK_Orders PRIMARY KEY (OrderId),
    CONSTRAINT FK_Orders_SalesReps
        FOREIGN KEY (SalesRepId)
        REFERENCES SalesReps(SalesRepId)
);
```

If `SalesRepId` is `NULL`, the row does not need to match a parent row. If it has a non-null value, it must reference a valid `SalesRepId`.

Design meaning:

- `NULL` foreign key means the relationship is optional.
- `NOT NULL` foreign key means the relationship is required.

Example:

```sql
CustomerId INT NOT NULL -- every order must have a customer
SalesRepId INT NULL     -- an order may or may not have a sales rep
```

### Foreign key actions on delete and update

Foreign keys can define what happens when the referenced parent row is deleted or updated.

Common actions:

| Action | Meaning |
|---|---|
| `NO ACTION` | Reject the parent change if child rows exist |
| `CASCADE` | Apply the delete/update to child rows |
| `SET NULL` | Set child foreign key values to `NULL` |
| `SET DEFAULT` | Set child foreign key values to their default value |

Example cascade delete:

```sql
CREATE TABLE OrderItems
(
    OrderItemId INT IDENTITY(1,1) NOT NULL,
    OrderId INT NOT NULL,
    ProductId INT NOT NULL,
    Quantity INT NOT NULL,

    CONSTRAINT PK_OrderItems PRIMARY KEY (OrderItemId),
    CONSTRAINT FK_OrderItems_Orders
        FOREIGN KEY (OrderId)
        REFERENCES Orders(OrderId)
        ON DELETE CASCADE
);
```

If an order is deleted, its order items are deleted automatically.

### Cascade delete trade-offs

Cascade delete can be useful for dependent child rows that have no meaning without the parent.

Good candidates:

- Order items when an unsaved draft order is deleted.
- Temporary child records.
- Join table rows.
- Owned/dependent records.

Risky candidates:

- Financial transactions.
- Audit logs.
- Historical records.
- Records with legal or compliance requirements.
- Shared child records referenced by multiple workflows.
- Tables with deep cascade chains.

A safer alternative is often soft delete, explicit delete workflow, or restricted delete.

Example restricted delete:

```sql
CONSTRAINT FK_Orders_Customers
    FOREIGN KEY (CustomerId)
    REFERENCES Customers(CustomerId)
    ON DELETE NO ACTION
```

This forces the application or database procedure to decide what should happen to child records.

### Unique constraints

A unique constraint ensures that values in one or more columns are unique across the table.

Example:

```sql
CREATE TABLE Users
(
    UserId INT IDENTITY(1,1) NOT NULL,
    Email NVARCHAR(320) NOT NULL,
    UserName NVARCHAR(100) NOT NULL,

    CONSTRAINT PK_Users PRIMARY KEY (UserId),
    CONSTRAINT UQ_Users_Email UNIQUE (Email),
    CONSTRAINT UQ_Users_UserName UNIQUE (UserName)
);
```

A table can have multiple unique constraints.

Primary key vs unique constraint:

| Feature | Primary key | Unique constraint |
|---|---|---|
| Purpose | Main row identity | Alternate/business key |
| Count per table | One primary key | Many unique constraints |
| Allows `NULL` | No | Database-specific behavior |
| Referenced by FK | Yes | Yes, if candidate key |
| Creates unique index | Yes | Yes |

In SQL Server, a unique constraint creates a unique index. Unique constraints are often used for business rules such as unique email, username, SKU, or external reference number.

### Unique constraints and NULL

Handling of `NULL` in unique constraints depends on the database system. In SQL Server, a unique constraint generally allows only one `NULL` value for a single nullable column.

Example:

```sql
CREATE TABLE Employees
(
    EmployeeId INT IDENTITY(1,1) NOT NULL,
    BadgeNumber NVARCHAR(50) NULL,

    CONSTRAINT PK_Employees PRIMARY KEY (EmployeeId),
    CONSTRAINT UQ_Employees_BadgeNumber UNIQUE (BadgeNumber)
);
```

If multiple employees can have no badge number, this unique constraint may not match the intended business rule in SQL Server.

A filtered unique index can be a better SQL Server approach:

```sql
CREATE UNIQUE INDEX UX_Employees_BadgeNumber_NotNull
ON Employees(BadgeNumber)
WHERE BadgeNumber IS NOT NULL;
```

This enforces uniqueness only when `BadgeNumber` is not null.

### Check constraints

A check constraint enforces a Boolean condition on column values.

Example:

```sql
CREATE TABLE Products
(
    ProductId INT IDENTITY(1,1) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Price DECIMAL(18, 2) NOT NULL,
    StockQuantity INT NOT NULL,

    CONSTRAINT PK_Products PRIMARY KEY (ProductId),
    CONSTRAINT CK_Products_Price CHECK (Price >= 0),
    CONSTRAINT CK_Products_StockQuantity CHECK (StockQuantity >= 0)
);
```

Check constraints are useful for domain rules:

```sql
CHECK (Age >= 0)
CHECK (Price >= 0)
CHECK (Status IN ('Pending', 'Paid', 'Cancelled'))
CHECK (StartDate <= EndDate)
CHECK (DiscountPercent BETWEEN 0 AND 100)
```

Important detail:

```text
A CHECK constraint rejects FALSE.
If the expression evaluates to UNKNOWN because of NULL, it may pass.
Use NOT NULL when the value is required.
```

Example:

```sql
CREATE TABLE Products
(
    ProductId INT NOT NULL,
    Price DECIMAL(18, 2) NULL,

    CONSTRAINT CK_Products_Price CHECK (Price >= 0)
);
```

If `Price` is `NULL`, `Price >= 0` is unknown, not false. If price is required, also define `Price NOT NULL`.

### NOT NULL constraints

`NOT NULL` requires a column to have a value.

Example:

```sql
CREATE TABLE Customers
(
    CustomerId INT IDENTITY(1,1) NOT NULL,
    Email NVARCHAR(320) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_Customers PRIMARY KEY (CustomerId)
);
```

Use `NOT NULL` when a value is required for the row to be meaningful.

Common examples:

- `Email` for a user account.
- `OrderDateUtc` for an order.
- `Status` for a workflow record.
- `CreatedAtUtc` for auditability.
- `CustomerId` for a required relationship.

Avoid making everything nullable by default. Nullable columns should represent a real optional value or unknown state.

### DEFAULT constraints

A default constraint provides a value when an insert does not supply one.

Example:

```sql
CREATE TABLE Orders
(
    OrderId INT IDENTITY(1,1) NOT NULL,
    Status NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Orders_Status DEFAULT 'Pending',
    CreatedAtUtc DATETIME2 NOT NULL
        CONSTRAINT DF_Orders_CreatedAtUtc DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Orders PRIMARY KEY (OrderId)
);
```

Insert:

```sql
INSERT INTO Orders DEFAULT VALUES;
```

The database supplies:

```text
Status = 'Pending'
CreatedAtUtc = current UTC date/time
```

Defaults are useful for:

- Created timestamps.
- Initial status.
- Boolean flags.
- Default quantity.
- Tenant or system-generated values in controlled scenarios.

Important:

```text
A DEFAULT is used only when the column is omitted or DEFAULT is explicitly requested.
It does not override an explicit NULL unless the column is NOT NULL and NULL is rejected.
```

### Composite foreign keys

A foreign key can reference a composite primary key or unique key.

Example:

```sql
CREATE TABLE TenantUsers
(
    TenantId INT NOT NULL,
    UserId INT NOT NULL,
    DisplayName NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_TenantUsers PRIMARY KEY (TenantId, UserId)
);

CREATE TABLE TenantUserSessions
(
    TenantId INT NOT NULL,
    UserId INT NOT NULL,
    SessionId UNIQUEIDENTIFIER NOT NULL,

    CONSTRAINT PK_TenantUserSessions PRIMARY KEY (SessionId),
    CONSTRAINT FK_TenantUserSessions_TenantUsers
        FOREIGN KEY (TenantId, UserId)
        REFERENCES TenantUsers(TenantId, UserId)
);
```

Composite foreign keys are useful when the parent identity is composite. They are common in multi-tenant schemas and join tables.

### Many-to-many relationships

Many-to-many relationships are usually modeled with a join table.

Example:

```sql
CREATE TABLE Students
(
    StudentId INT IDENTITY(1,1) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,
    CONSTRAINT PK_Students PRIMARY KEY (StudentId)
);

CREATE TABLE Courses
(
    CourseId INT IDENTITY(1,1) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    CONSTRAINT PK_Courses PRIMARY KEY (CourseId)
);

CREATE TABLE StudentCourses
(
    StudentId INT NOT NULL,
    CourseId INT NOT NULL,
    EnrolledAtUtc DATETIME2 NOT NULL
        CONSTRAINT DF_StudentCourses_EnrolledAtUtc DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_StudentCourses PRIMARY KEY (StudentId, CourseId),
    CONSTRAINT FK_StudentCourses_Students
        FOREIGN KEY (StudentId)
        REFERENCES Students(StudentId),
    CONSTRAINT FK_StudentCourses_Courses
        FOREIGN KEY (CourseId)
        REFERENCES Courses(CourseId)
);
```

The composite primary key prevents duplicate enrollment for the same student and course.

### One-to-one relationships

One-to-one relationships can be modeled by making a foreign key unique.

Example:

```sql
CREATE TABLE Users
(
    UserId INT IDENTITY(1,1) NOT NULL,
    Email NVARCHAR(320) NOT NULL,

    CONSTRAINT PK_Users PRIMARY KEY (UserId),
    CONSTRAINT UQ_Users_Email UNIQUE (Email)
);

CREATE TABLE UserProfiles
(
    UserProfileId INT IDENTITY(1,1) NOT NULL,
    UserId INT NOT NULL,
    DisplayName NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_UserProfiles PRIMARY KEY (UserProfileId),
    CONSTRAINT UQ_UserProfiles_UserId UNIQUE (UserId),
    CONSTRAINT FK_UserProfiles_Users
        FOREIGN KEY (UserId)
        REFERENCES Users(UserId)
);
```

The foreign key ensures the profile belongs to a real user. The unique constraint ensures one user has at most one profile.

Another pattern is using the same key as both primary key and foreign key:

```sql
CREATE TABLE UserProfiles
(
    UserId INT NOT NULL,
    DisplayName NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_UserProfiles PRIMARY KEY (UserId),
    CONSTRAINT FK_UserProfiles_Users
        FOREIGN KEY (UserId)
        REFERENCES Users(UserId)
);
```

This is common when the child row is an extension of the parent row.

### Constraints and joins

Primary keys and foreign keys make joins meaningful and reliable.

Example:

```sql
SELECT
    o.OrderId,
    c.Email,
    o.OrderDateUtc
FROM Orders AS o
INNER JOIN Customers AS c
    ON c.CustomerId = o.CustomerId;
```

The foreign key tells the database that each `Orders.CustomerId` must reference a valid customer. This improves data correctness and can help the optimizer reason about relationships.

Without a foreign key, an inner join might silently drop orphan orders:

```text
Order exists, but customer does not exist.
INNER JOIN removes that order from the result.
```

With a foreign key, that invalid state is prevented.

### Indexing foreign keys

In SQL Server, creating a foreign key does not automatically create an index on the foreign key column. However, indexing foreign keys is often important.

Example:

```sql
CREATE INDEX IX_Orders_CustomerId
ON Orders(CustomerId);
```

This can help with:

- Joins from child to parent.
- Finding all orders for a customer.
- Deletes or updates on the parent table.
- Referential integrity checks.
- Reducing locking and blocking in some workloads.

Example query:

```sql
SELECT *
FROM Orders
WHERE CustomerId = @CustomerId;
```

Without an index on `CustomerId`, SQL Server may need to scan the `Orders` table.

Not every foreign key needs a separate index, especially on small tables or rarely queried relationships, but foreign key indexing should be reviewed during schema design.

### Constraint naming

Good constraint names make errors, migrations, and database maintenance easier.

Recommended naming style:

```text
PK_<TableName>
FK_<ChildTable>_<ParentTable>
UQ_<TableName>_<ColumnName>
CK_<TableName>_<RuleName>
DF_<TableName>_<ColumnName>
```

Example:

```sql
CONSTRAINT PK_Orders PRIMARY KEY (OrderId),
CONSTRAINT FK_Orders_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId),
CONSTRAINT CK_Orders_Total CHECK (TotalAmount >= 0),
CONSTRAINT DF_Orders_Status DEFAULT 'Pending' FOR Status
```

Avoid relying on system-generated names such as:

```text
DF__Orders__Status__5AEE82B9
```

Generated names make migration scripts and troubleshooting harder.

### Adding constraints to existing tables

Constraints can be added after table creation.

Example:

```sql
ALTER TABLE Orders
ADD CONSTRAINT FK_Orders_Customers
FOREIGN KEY (CustomerId)
REFERENCES Customers(CustomerId);
```

If existing data violates the new constraint, the statement fails. Before adding constraints to existing tables, you may need to clean bad data.

Find orphan orders:

```sql
SELECT o.*
FROM Orders AS o
LEFT JOIN Customers AS c
    ON c.CustomerId = o.CustomerId
WHERE c.CustomerId IS NULL;
```

After fixing invalid rows, add the constraint.

### Disabling or not trusting constraints

In SQL Server, constraints can be disabled or created in ways that existing data is not fully checked. This can lead to untrusted constraints.

A trusted constraint means SQL Server knows all existing data satisfies it. A not-trusted constraint may still check future changes but cannot be fully relied on by the optimizer.

For interview purposes, the main point is:

```text
Do not disable constraints casually.
If constraints were disabled during bulk loads, re-enable and validate them.
```

Bulk imports sometimes disable constraints for performance, but the data must be validated afterward.

### Constraints vs application validation

Application validation and database constraints serve different purposes.

| Layer | Purpose |
|---|---|
| Application validation | Provide friendly errors, enforce workflow rules, avoid unnecessary database calls |
| Database constraints | Protect data integrity permanently and consistently |
| Domain validation | Protect business invariants in code |
| API contract validation | Ensure request shape and required fields are valid |

Example:

Application validation:

```csharp
if (request.Price < 0)
{
    return BadRequest("Price must be greater than or equal to zero.");
}
```

Database constraint:

```sql
CONSTRAINT CK_Products_Price CHECK (Price >= 0)
```

Use both for important rules. Application validation improves user experience. Database constraints guarantee integrity.

### Constraints and transactions

Constraints are checked as part of data modification statements and transactions. If a constraint violation occurs, the statement fails. Depending on transaction handling, the transaction may be rolled back.

Example:

```sql
BEGIN TRANSACTION;

INSERT INTO Orders (CustomerId, OrderDateUtc)
VALUES (999, SYSUTCDATETIME());

COMMIT TRANSACTION;
```

If `CustomerId = 999` does not exist and a foreign key is defined, the insert fails. The transaction should be handled appropriately.

In application code, constraint violations often surface as database exceptions. A production application should translate important known constraint errors into meaningful API responses where appropriate.

### Constraints and normalization

Constraints support normalized relational design.

Examples:

- Primary keys identify entities.
- Foreign keys represent relationships between entities.
- Unique constraints enforce candidate keys.
- Check constraints enforce valid domains.
- Not-null constraints enforce required attributes.

For example, instead of storing repeated customer information on every order, a normalized design uses a `Customers` table and an `Orders` table connected by a foreign key.

```text
Customers(CustomerId, Email, FullName)
Orders(OrderId, CustomerId, OrderDateUtc)
```

This reduces duplication and improves consistency.

### Constraints and soft deletes

Soft delete means marking a row as deleted instead of physically deleting it.

Example:

```sql
ALTER TABLE Customers
ADD IsDeleted BIT NOT NULL
    CONSTRAINT DF_Customers_IsDeleted DEFAULT 0;
```

Soft delete complicates uniqueness and foreign keys.

Example problem:

```text
A customer with Email = a@example.com is soft deleted.
Can a new customer reuse the same email?
```

If yes, a normal unique constraint on `Email` may be too strict. A filtered unique index may be needed:

```sql
CREATE UNIQUE INDEX UX_Customers_Email_Active
ON Customers(Email)
WHERE IsDeleted = 0;
```

Foreign keys still reference physical rows, even if the parent row is soft deleted. Application logic must decide whether child rows can reference soft-deleted parents.

### Constraints and multi-tenancy

In multi-tenant systems, constraints often need to include `TenantId`.

Example:

```sql
CREATE TABLE Customers
(
    TenantId INT NOT NULL,
    CustomerId INT NOT NULL,
    Email NVARCHAR(320) NOT NULL,

    CONSTRAINT PK_Customers PRIMARY KEY (TenantId, CustomerId),
    CONSTRAINT UQ_Customers_Tenant_Email UNIQUE (TenantId, Email)
);
```

This allows the same email to exist in different tenants while enforcing uniqueness within each tenant.

Foreign keys should also include `TenantId` to prevent cross-tenant references:

```sql
CREATE TABLE Orders
(
    TenantId INT NOT NULL,
    OrderId INT NOT NULL,
    CustomerId INT NOT NULL,

    CONSTRAINT PK_Orders PRIMARY KEY (TenantId, OrderId),
    CONSTRAINT FK_Orders_Customers
        FOREIGN KEY (TenantId, CustomerId)
        REFERENCES Customers(TenantId, CustomerId)
);
```

This prevents an order in tenant A from referencing a customer in tenant B.

### Constraint errors in applications

Constraint violations are common in real applications. Examples:

- Duplicate email violates a unique constraint.
- Missing required value violates `NOT NULL`.
- Invalid status violates `CHECK`.
- Invalid parent ID violates `FOREIGN KEY`.
- Deleting a parent row violates a child foreign key.

A good application should handle expected constraint errors gracefully.

Example API behavior:

| Database error | API response |
|---|---|
| Duplicate email | `409 Conflict` |
| Foreign key parent missing | `400 Bad Request` or `404 Not Found`, depending on API design |
| Check constraint violation | `400 Bad Request` |
| Required value missing | `400 Bad Request` |
| Delete restricted by children | `409 Conflict` |

The database should protect the data, while the API should provide clear error messages.

### Common mistakes

Common mistakes include:

- Creating tables without primary keys.
- Using natural keys as primary keys when they can change.
- Using surrogate keys but forgetting unique constraints on business keys.
- Not indexing foreign key columns.
- Confusing primary keys with clustered indexes.
- Assuming a foreign key automatically creates an index.
- Using cascade delete on important historical data.
- Making optional relationships required by mistake.
- Making required relationships nullable by mistake.
- Forgetting that `CHECK` constraints may allow `NULL` unless combined with `NOT NULL`.
- Relying only on application validation.
- Using inconsistent constraint names.
- Disabling constraints during bulk load and not validating afterward.
- Ignoring multi-tenant uniqueness and cross-tenant reference rules.
- Using composite keys everywhere without considering complexity.
- Handling database constraint exceptions as generic `500 Internal Server Error`.

### Best practices

Good constraint design habits include:

- Define a primary key on every table.
- Prefer stable primary keys.
- Add unique constraints for real business uniqueness rules.
- Use foreign keys to enforce relationships.
- Index foreign key columns when they are used in joins, filters, or parent deletes.
- Use `NOT NULL` for required fields.
- Use `CHECK` constraints for simple domain rules.
- Use `DEFAULT` constraints for safe initial values.
- Name constraints explicitly.
- Be careful with cascade delete.
- Use composite keys where they model the relationship clearly.
- Use filtered unique indexes for conditional uniqueness in SQL Server.
- Keep database constraints and application validation aligned.
- Test migrations against realistic data.
- Review constraints as part of schema design, not as an afterthought.
- Treat the database as the final guard for critical integrity rules.

### Practical design example

A realistic order schema might look like this:

```sql
CREATE TABLE Customers
(
    CustomerId INT IDENTITY(1,1) NOT NULL,
    Email NVARCHAR(320) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,
    CreatedAtUtc DATETIME2 NOT NULL
        CONSTRAINT DF_Customers_CreatedAtUtc DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Customers PRIMARY KEY (CustomerId),
    CONSTRAINT UQ_Customers_Email UNIQUE (Email)
);

CREATE TABLE Products
(
    ProductId INT IDENTITY(1,1) NOT NULL,
    Sku NVARCHAR(50) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Price DECIMAL(18, 2) NOT NULL,

    CONSTRAINT PK_Products PRIMARY KEY (ProductId),
    CONSTRAINT UQ_Products_Sku UNIQUE (Sku),
    CONSTRAINT CK_Products_Price CHECK (Price >= 0)
);

CREATE TABLE Orders
(
    OrderId INT IDENTITY(1,1) NOT NULL,
    CustomerId INT NOT NULL,
    Status NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Orders_Status DEFAULT 'Pending',
    CreatedAtUtc DATETIME2 NOT NULL
        CONSTRAINT DF_Orders_CreatedAtUtc DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Orders PRIMARY KEY (OrderId),
    CONSTRAINT FK_Orders_Customers
        FOREIGN KEY (CustomerId)
        REFERENCES Customers(CustomerId),
    CONSTRAINT CK_Orders_Status
        CHECK (Status IN ('Pending', 'Paid', 'Cancelled'))
);

CREATE TABLE OrderItems
(
    OrderItemId INT IDENTITY(1,1) NOT NULL,
    OrderId INT NOT NULL,
    ProductId INT NOT NULL,
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(18, 2) NOT NULL,

    CONSTRAINT PK_OrderItems PRIMARY KEY (OrderItemId),
    CONSTRAINT FK_OrderItems_Orders
        FOREIGN KEY (OrderId)
        REFERENCES Orders(OrderId)
        ON DELETE CASCADE,
    CONSTRAINT FK_OrderItems_Products
        FOREIGN KEY (ProductId)
        REFERENCES Products(ProductId),
    CONSTRAINT CK_OrderItems_Quantity CHECK (Quantity > 0),
    CONSTRAINT CK_OrderItems_UnitPrice CHECK (UnitPrice >= 0)
);

CREATE INDEX IX_Orders_CustomerId
ON Orders(CustomerId);

CREATE INDEX IX_OrderItems_OrderId
ON OrderItems(OrderId);

CREATE INDEX IX_OrderItems_ProductId
ON OrderItems(ProductId);
```

This schema enforces:

- Unique customers by email.
- Unique products by SKU.
- Orders must belong to valid customers.
- Order items must belong to valid orders and products.
- Quantity and price must be valid.
- Deleting an order deletes its dependent order items.
- Foreign key columns are indexed for common joins.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is a primary key?

<!-- question:start:primary-keys-foreign-keys-constraints-beginner-q01 -->
<!-- question-id:primary-keys-foreign-keys-constraints-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A primary key is a column or set of columns that uniquely identifies each row in a table. It enforces uniqueness and does not allow `NULL` values.

A table can have one primary key constraint. The primary key can be a single column, such as `CustomerId`, or a composite key made of multiple columns, such as `(StudentId, CourseId)` in a join table.

In SQL Server, a primary key is enforced using a unique index. It is a logical identity rule, not just an indexing choice.

##### Key Points to Mention

- Uniquely identifies each row.
- Cannot contain `NULL`.
- One primary key constraint per table.
- Can be single-column or composite.
- Enforces entity integrity.
- SQL Server enforces it with a unique index.

<!-- question:end:primary-keys-foreign-keys-constraints-beginner-q01 -->

#### What is a foreign key?

<!-- question:start:primary-keys-foreign-keys-constraints-beginner-q02 -->
<!-- question-id:primary-keys-foreign-keys-constraints-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A foreign key is a column or group of columns in one table that references a key in another table. It enforces referential integrity by making sure a child row references a valid parent row.

For example, `Orders.CustomerId` can reference `Customers.CustomerId`. This prevents inserting an order for a customer that does not exist.

Foreign keys also affect parent updates and deletes. The database can restrict the operation or apply actions such as cascade delete, depending on the foreign key definition.

##### Key Points to Mention

- Connects child table to parent table.
- Enforces referential integrity.
- Prevents orphan rows.
- Can reference primary keys or unique keys.
- Can be nullable if the relationship is optional.
- Delete/update behavior depends on referential actions.

<!-- question:end:primary-keys-foreign-keys-constraints-beginner-q02 -->

#### What is the difference between a primary key and a unique constraint?

<!-- question:start:primary-keys-foreign-keys-constraints-beginner-q03 -->
<!-- question-id:primary-keys-foreign-keys-constraints-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A primary key identifies the main identity of each row. A table can have only one primary key, and primary key columns cannot be `NULL`.

A unique constraint enforces uniqueness for one or more columns that are not necessarily the main row identity. A table can have multiple unique constraints.

For example, a `Users` table may use `UserId` as the primary key and also have unique constraints on `Email` and `UserName`.

##### Key Points to Mention

- Primary key is the main row identifier.
- Unique constraint enforces alternate/business keys.
- One primary key per table.
- Multiple unique constraints are allowed.
- Primary key does not allow `NULL`.
- Unique constraints are useful for email, username, SKU, and external IDs.

<!-- question:end:primary-keys-foreign-keys-constraints-beginner-q03 -->

#### What are common SQL constraints?

<!-- question:start:primary-keys-foreign-keys-constraints-beginner-q04 -->
<!-- question-id:primary-keys-foreign-keys-constraints-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Common SQL constraints include `PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `NOT NULL`, `CHECK`, and `DEFAULT`.

`PRIMARY KEY` identifies rows. `FOREIGN KEY` enforces relationships. `UNIQUE` prevents duplicate values. `NOT NULL` requires a value. `CHECK` enforces a condition. `DEFAULT` supplies a value when one is not provided.

Together, these constraints protect data integrity at the database level.

##### Key Points to Mention

- `PRIMARY KEY`: unique row identity.
- `FOREIGN KEY`: valid relationship.
- `UNIQUE`: no duplicate values.
- `NOT NULL`: required value.
- `CHECK`: domain rule.
- `DEFAULT`: automatic value.
- Constraints protect integrity even if application code has bugs.

<!-- question:end:primary-keys-foreign-keys-constraints-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Does a foreign key automatically create an index?

<!-- question:start:primary-keys-foreign-keys-constraints-intermediate-q01 -->
<!-- question-id:primary-keys-foreign-keys-constraints-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

In SQL Server, creating a foreign key does not automatically create an index on the foreign key column. The foreign key enforces referential integrity, but indexing is a separate design decision.

Foreign key columns are often good index candidates because they are commonly used in joins, filters, and referential checks when parent rows are updated or deleted.

For example, `Orders.CustomerId` should often be indexed because queries frequently retrieve orders for a customer and join orders to customers.

##### Key Points to Mention

- SQL Server does not automatically index foreign keys.
- Foreign keys enforce relationships, not query performance by themselves.
- Indexing foreign keys often improves joins and filters.
- Indexes can help parent delete/update checks.
- Not every foreign key needs an index, but most important ones should be reviewed.
- Indexing has write and storage cost.

<!-- question:end:primary-keys-foreign-keys-constraints-intermediate-q01 -->

#### What is cascade delete, and when is it risky?

<!-- question:start:primary-keys-foreign-keys-constraints-intermediate-q02 -->
<!-- question-id:primary-keys-foreign-keys-constraints-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Cascade delete means that when a parent row is deleted, related child rows are automatically deleted by the database.

It is useful for dependent rows that have no meaning without the parent, such as rows in a join table or certain child detail records.

It is risky for important historical data, audit logs, financial records, or deep relationship chains because a single delete can remove many rows unintentionally. In those cases, restricted delete, soft delete, or explicit deletion logic may be safer.

##### Key Points to Mention

- Cascade delete automatically deletes child rows.
- Useful for dependent records.
- Risky for audit, financial, historical, or shared data.
- Can delete more than expected.
- Restrict delete is safer for important records.
- Soft delete may be better for business history.

<!-- question:end:primary-keys-foreign-keys-constraints-intermediate-q02 -->

#### What is the difference between surrogate and natural keys?

<!-- question:start:primary-keys-foreign-keys-constraints-intermediate-q03 -->
<!-- question-id:primary-keys-foreign-keys-constraints-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A surrogate key is an artificial system-generated identifier, such as `CustomerId` or `OrderId`. It usually has no business meaning.

A natural key is a real business value that identifies a row, such as email, SKU, ISBN, or country code.

Surrogate keys are stable and efficient for relationships, but they do not protect business uniqueness by themselves. Natural keys are meaningful but can change or become more complex over time.

A common design is to use a surrogate primary key and add unique constraints on important natural business keys.

##### Key Points to Mention

- Surrogate key is artificial.
- Natural key has business meaning.
- Surrogate keys are usually stable and join-friendly.
- Natural keys may change.
- Use unique constraints for business uniqueness.
- Good design often combines surrogate PK with natural unique constraints.

<!-- question:end:primary-keys-foreign-keys-constraints-intermediate-q03 -->

#### How do CHECK constraints handle NULL values?

<!-- question:start:primary-keys-foreign-keys-constraints-intermediate-q04 -->
<!-- question-id:primary-keys-foreign-keys-constraints-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

A `CHECK` constraint rejects rows when the condition evaluates to false. If the condition evaluates to unknown because of `NULL`, the row may pass.

For example, `CHECK (Price >= 0)` prevents negative prices, but if `Price` is nullable, `NULL` does not evaluate to false. If the price is required, the column should also be defined as `NOT NULL`.

So for required valid values, use both `NOT NULL` and `CHECK`.

##### Key Points to Mention

- `CHECK` rejects false conditions.
- `NULL` can produce unknown.
- Unknown may pass the check.
- Use `NOT NULL` if the value is required.
- Combine `NOT NULL` and `CHECK` for required domain rules.
- Understand SQL three-valued logic.

<!-- question:end:primary-keys-foreign-keys-constraints-intermediate-q04 -->

#### How do you model a many-to-many relationship?

<!-- question:start:primary-keys-foreign-keys-constraints-intermediate-q05 -->
<!-- question-id:primary-keys-foreign-keys-constraints-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

A many-to-many relationship is usually modeled with a join table. The join table contains foreign keys to both related tables and often uses a composite primary key.

For example, `StudentCourses` can have `StudentId` and `CourseId`. `StudentId` references `Students`, and `CourseId` references `Courses`. The composite primary key `(StudentId, CourseId)` prevents duplicate enrollment for the same student and course.

The join table can also contain relationship attributes, such as `EnrolledAtUtc` or `Grade`.

##### Key Points to Mention

- Use a join/bridge table.
- Include foreign keys to both parent tables.
- Composite primary key can prevent duplicates.
- Relationship-specific columns can live in the join table.
- Index foreign keys for joins.
- Good example: students and courses, users and roles, products and tags.

<!-- question:end:primary-keys-foreign-keys-constraints-intermediate-q05 -->

#### Why should important rules be enforced in the database and not only in application code?

<!-- question:start:primary-keys-foreign-keys-constraints-intermediate-q06 -->
<!-- question-id:primary-keys-foreign-keys-constraints-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Important rules should be enforced in the database because data can be modified from many places, not only one application. Background jobs, imports, scripts, admin tools, and future services may all write to the same database.

Application validation is still useful because it provides friendly errors and avoids unnecessary database calls, but database constraints are the final guard for integrity.

For example, an API can validate that an email is unique, but a unique constraint is still needed to prevent race conditions and writes from other processes.

##### Key Points to Mention

- Many writers can modify the database.
- Application validation can be bypassed.
- Constraints protect data permanently.
- Unique constraints prevent race-condition duplicates.
- Application validation improves user experience.
- Use both layers for important rules.

<!-- question:end:primary-keys-foreign-keys-constraints-intermediate-q06 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design constraints for a multi-tenant table?

<!-- question:start:primary-keys-foreign-keys-constraints-advanced-q01 -->
<!-- question-id:primary-keys-foreign-keys-constraints-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

In a multi-tenant table, constraints often need to include `TenantId` to enforce tenant-specific uniqueness and prevent cross-tenant references.

For example, a customer email may need to be unique within a tenant but not globally. That can be enforced with `UNIQUE (TenantId, Email)`.

Foreign keys should often include `TenantId` as part of the relationship. For example, `Orders(TenantId, CustomerId)` should reference `Customers(TenantId, CustomerId)`. This prevents an order in one tenant from referencing a customer in another tenant.

##### Key Points to Mention

- Include `TenantId` in uniqueness rules when uniqueness is tenant-scoped.
- Use composite keys or unique constraints involving `TenantId`.
- Foreign keys should prevent cross-tenant references.
- Avoid global uniqueness unless required.
- Index tenant-scoped access patterns.
- Align constraints with security and data isolation rules.

<!-- question:end:primary-keys-foreign-keys-constraints-advanced-q01 -->

#### How would you handle soft delete with unique constraints?

<!-- question:start:primary-keys-foreign-keys-constraints-advanced-q02 -->
<!-- question-id:primary-keys-foreign-keys-constraints-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Soft delete marks rows as deleted instead of physically removing them. This can conflict with unique constraints.

For example, if `Customers.Email` is unique and a customer is soft deleted, the business may want to allow a new active customer with the same email. A normal unique constraint would block that.

In SQL Server, a filtered unique index can enforce uniqueness only for active rows:

```sql
CREATE UNIQUE INDEX UX_Customers_Email_Active
ON Customers(Email)
WHERE IsDeleted = 0;
```

The design depends on business rules. Sometimes historical uniqueness must remain global, and sometimes uniqueness only applies to active rows.

##### Key Points to Mention

- Soft-deleted rows still exist physically.
- Normal unique constraints still include soft-deleted rows.
- Filtered unique indexes can enforce uniqueness for active rows.
- Business rules determine whether reuse is allowed.
- Foreign keys still reference soft-deleted rows.
- Application queries must consistently filter deleted rows.

<!-- question:end:primary-keys-foreign-keys-constraints-advanced-q02 -->

#### What are the performance implications of constraints?

<!-- question:start:primary-keys-foreign-keys-constraints-advanced-q03 -->
<!-- question-id:primary-keys-foreign-keys-constraints-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Constraints can add overhead to inserts, updates, and deletes because the database must validate rules. For example, unique constraints require checking for duplicates, and foreign keys require checking parent or child relationships.

However, constraints also help data quality and can help the optimizer reason about relationships. Primary and unique constraints are enforced with unique indexes, which can improve query performance for lookups. Foreign keys often need separate indexes on child columns to support joins and referential checks efficiently.

The trade-off is usually worth it for critical integrity rules. Removing constraints for performance can lead to corrupt or inconsistent data.

##### Key Points to Mention

- Constraints add validation cost on writes.
- Unique and primary constraints use indexes.
- Foreign keys enforce referential checks.
- Index foreign key columns where useful.
- Constraints protect data quality.
- Do not remove integrity constraints casually.
- Measure performance rather than guessing.

<!-- question:end:primary-keys-foreign-keys-constraints-advanced-q03 -->

#### How would you add a foreign key to a table that already has bad data?

<!-- question:start:primary-keys-foreign-keys-constraints-advanced-q04 -->
<!-- question-id:primary-keys-foreign-keys-constraints-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

First, identify invalid existing rows, such as child rows that do not have a matching parent. This can be done with a `LEFT JOIN` query that finds rows where the parent is missing.

Then decide how to fix the data: insert missing parent rows, update child rows, delete invalid child rows, or set optional foreign keys to `NULL` if the relationship is optional.

After the data is cleaned, add the foreign key constraint and validate it. The migration should be tested on realistic data before production.

##### Key Points to Mention

- Existing bad data can block constraint creation.
- Use `LEFT JOIN` to find orphan rows.
- Clean or migrate the data first.
- Add and validate the constraint after cleanup.
- Test migration scripts before production.
- Avoid leaving constraints disabled or untrusted.

<!-- question:end:primary-keys-foreign-keys-constraints-advanced-q04 -->

#### How do you choose between composite keys and surrogate keys?

<!-- question:start:primary-keys-foreign-keys-constraints-advanced-q05 -->
<!-- question-id:primary-keys-foreign-keys-constraints-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Composite keys are useful when identity is naturally made from multiple values, such as join tables, tenant-scoped entities, or versioned records. They can enforce business rules directly and prevent duplicates.

Surrogate keys are useful when a stable, simple, single-column identity is easier for joins, foreign keys, APIs, and ORM mapping. They are often paired with unique constraints on business keys.

The choice depends on relationship complexity, key stability, query patterns, ORM behavior, and business rules. A common approach is to use surrogate primary keys for main entities and composite keys for join tables or tenant-scoped uniqueness.

##### Key Points to Mention

- Composite keys directly model multi-column identity.
- Surrogate keys are stable and simple.
- Composite keys make foreign keys more verbose.
- Surrogate keys need unique constraints for business rules.
- Join tables often use composite keys.
- Multi-tenant designs may need composite constraints.

<!-- question:end:primary-keys-foreign-keys-constraints-advanced-q05 -->

#### What is the difference between a primary key and a clustered index?

<!-- question:start:primary-keys-foreign-keys-constraints-advanced-q06 -->
<!-- question-id:primary-keys-foreign-keys-constraints-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

A primary key is a logical constraint that enforces unique, non-null row identity. A clustered index is a physical storage/indexing structure that determines the order of data rows in SQL Server.

In SQL Server, a primary key is often created as a clustered index by default, but it does not have to be. A primary key can be nonclustered, and a clustered index can be created on a different column if that better supports the workload.

The important distinction is that primary key is about data integrity, while clustered index is about physical data access and storage.

##### Key Points to Mention

- Primary key is logical.
- Clustered index is physical.
- SQL Server often defaults primary key to clustered.
- Primary key can be nonclustered.
- Clustered index can be on another column.
- Choose clustered key based on access patterns and write behavior.

<!-- question:end:primary-keys-foreign-keys-constraints-advanced-q06 -->

#### How should an API handle database constraint violations?

<!-- question:start:primary-keys-foreign-keys-constraints-advanced-q07 -->
<!-- question-id:primary-keys-foreign-keys-constraints-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

An API should handle expected constraint violations and translate them into meaningful responses instead of returning a generic `500 Internal Server Error`.

For example, a duplicate email unique constraint can return `409 Conflict`. A missing parent foreign key might return `400 Bad Request` or `404 Not Found`, depending on the API design. A check constraint violation usually maps to `400 Bad Request`.

The application should still validate inputs before writing to the database, but the database constraint remains the final guard. For known constraints, use clear error messages without exposing sensitive database internals.

##### Key Points to Mention

- Do not expose raw database errors to users.
- Duplicate unique key can map to `409 Conflict`.
- Invalid foreign key can map to `400` or `404`.
- Check constraint violation can map to `400`.
- Keep database as final integrity guard.
- Log detailed errors internally.
- Avoid leaking schema details or sensitive data.

<!-- question:end:primary-keys-foreign-keys-constraints-advanced-q07 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
