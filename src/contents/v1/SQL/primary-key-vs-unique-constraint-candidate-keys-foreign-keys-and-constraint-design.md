---
id: primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design
topic: SQL practical interview comparisons and SQL Server-specific features
subtopic: Primary key vs unique constraint, candidate keys, foreign keys, and constraint design
category: SQL
---

## Overview

Primary keys, unique constraints, candidate keys, foreign keys, and constraint design are about making relational data trustworthy. These constraints tell the database which rows are unique, which business values must not duplicate, and which child rows must reference valid parent rows.

A primary key is the chosen main identifier for a table. A unique constraint enforces another uniqueness rule, often a business key such as email, SKU, tenant code, or external reference number. A candidate key is any column or set of columns that could uniquely identify a row. A foreign key enforces a relationship from a child table to a candidate key in a parent table.

This topic matters because many production bugs are not caused by missing SQL syntax knowledge. They are caused by weak schema contracts: duplicate users, orphan orders, optional relationships modeled as required, required relationships modeled as nullable, soft-delete uniqueness bugs, or foreign keys that exist but are not indexed.

For interviews, strong candidates can explain more than "primary key is unique." They can describe why a table has one primary key but may have many unique constraints, why foreign keys reference primary or unique keys, why SQL Server does not automatically index foreign key columns, and how constraint choices affect integrity, performance, migrations, and API behavior.

## Core Concepts

### Primary Key

A primary key identifies each row in a table. In SQL Server, a table can have only one primary key constraint. The primary key columns must be unique and not nullable.

```sql
CREATE TABLE dbo.Customers
(
    CustomerId BIGINT IDENTITY(1, 1) NOT NULL,
    Email NVARCHAR(320) NOT NULL,
    DisplayName NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_Customers PRIMARY KEY (CustomerId)
);
```

The primary key is commonly used by:

- Foreign keys from child tables.
- Joins.
- API routes and internal references.
- ORM identity tracking.
- Clustered or nonclustered indexes, depending on design.

The primary key should be stable, unique, and always present. It should not change just because a business value changes.

### Unique Constraint

A unique constraint enforces that values in one column or combination of columns do not repeat.

```sql
ALTER TABLE dbo.Customers
ADD CONSTRAINT UQ_Customers_Email UNIQUE (Email);
```

Use unique constraints for business uniqueness rules:

- Email must be unique.
- SKU must be unique.
- Username must be unique.
- Tenant slug must be unique.
- External provider and external subject must be unique together.

```sql
CREATE TABLE dbo.Users
(
    UserId BIGINT IDENTITY(1, 1) NOT NULL,
    Email NVARCHAR(320) NOT NULL,
    ExternalProvider NVARCHAR(50) NOT NULL,
    ExternalSubject NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_Users PRIMARY KEY (UserId),
    CONSTRAINT UQ_Users_Email UNIQUE (Email),
    CONSTRAINT UQ_Users_ExternalIdentity
        UNIQUE (ExternalProvider, ExternalSubject)
);
```

A table can have many unique constraints. This is how a table can protect multiple candidate keys while still choosing one primary key.

### Primary Key vs Unique Constraint

Both primary keys and unique constraints enforce uniqueness. The differences are design intent and restrictions.

| Feature | Primary key | Unique constraint |
|---|---|---|
| Main purpose | Main row identity | Additional uniqueness rule |
| Count per table | One | Many |
| Nullability | Not nullable | Can involve nullable columns, with SQL Server-specific null behavior |
| Foreign key target | Yes | Yes |
| Common use | Surrogate ID or natural row identity | Email, SKU, external ID, business key |
| Index | Enforced by a unique index | Enforced by a unique index |

Example design:

```sql
CREATE TABLE dbo.Products
(
    ProductId BIGINT IDENTITY(1, 1) NOT NULL,
    Sku NVARCHAR(50) NOT NULL,
    Name NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_Products PRIMARY KEY (ProductId),
    CONSTRAINT UQ_Products_Sku UNIQUE (Sku)
);
```

`ProductId` is the main row identity. `Sku` is still a real business key and must also be protected.

### Candidate Key

A candidate key is any column or combination of columns that can uniquely identify a row. A table can have multiple candidate keys.

Example candidates for `Users`:

- `UserId`
- `Email`
- `(ExternalProvider, ExternalSubject)`

One candidate becomes the primary key. Other candidate keys should usually be enforced with unique constraints or unique indexes.

If you use a surrogate primary key but forget unique constraints on business keys, the database can accept duplicate business records:

```sql
-- Bad schema: duplicate email is possible.
CREATE TABLE dbo.Users
(
    UserId BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    Email NVARCHAR(320) NOT NULL
);
```

Better:

```sql
CREATE TABLE dbo.Users
(
    UserId BIGINT IDENTITY(1, 1) NOT NULL,
    Email NVARCHAR(320) NOT NULL,

    CONSTRAINT PK_Users PRIMARY KEY (UserId),
    CONSTRAINT UQ_Users_Email UNIQUE (Email)
);
```

### Natural Key vs Surrogate Key

A natural key is based on real business data. A surrogate key is generated by the system and has no business meaning.

Natural key example:

```sql
CONSTRAINT PK_Countries PRIMARY KEY (CountryCode)
```

Surrogate key example:

```sql
CountryId INT IDENTITY(1, 1) NOT NULL PRIMARY KEY
```

Natural keys can be good when they are stable, short, and truly unique. Surrogate keys are common when the business value can change, is long, is composite, or comes from an external system.

Practical design often uses both:

```sql
CREATE TABLE dbo.Countries
(
    CountryId INT IDENTITY(1, 1) NOT NULL,
    CountryCode CHAR(2) NOT NULL,
    Name NVARCHAR(100) NOT NULL,

    CONSTRAINT PK_Countries PRIMARY KEY (CountryId),
    CONSTRAINT UQ_Countries_CountryCode UNIQUE (CountryCode)
);
```

The surrogate key makes foreign keys simple. The unique constraint protects the real business code.

### Composite Keys

A composite key uses multiple columns.

```sql
CREATE TABLE dbo.StudentCourses
(
    StudentId BIGINT NOT NULL,
    CourseId BIGINT NOT NULL,
    EnrolledAtUtc DATETIME2(3) NOT NULL,

    CONSTRAINT PK_StudentCourses PRIMARY KEY (StudentId, CourseId)
);
```

Composite keys are useful for:

- Many-to-many join tables.
- Multi-tenant uniqueness such as `(TenantId, Slug)`.
- Natural keys that are only unique in combination.

Trade-offs:

- They make foreign keys more verbose.
- They can make indexes wider.
- They may complicate ORM mapping and API URLs.
- They can be the clearest model when the combination is the real identity.

### Foreign Key

A foreign key enforces a relationship from a child table to a parent table.

```sql
CREATE TABLE dbo.Orders
(
    OrderId BIGINT IDENTITY(1, 1) NOT NULL,
    CustomerId BIGINT NOT NULL,
    OrderedAtUtc DATETIME2(3) NOT NULL,

    CONSTRAINT PK_Orders PRIMARY KEY (OrderId),
    CONSTRAINT FK_Orders_Customers
        FOREIGN KEY (CustomerId)
        REFERENCES dbo.Customers(CustomerId)
);
```

This prevents inserting an order for a customer that does not exist.

Foreign keys enforce referential integrity:

- Child rows must reference valid parent rows.
- Parent deletes or key updates may be restricted.
- Optional relationships can be modeled with nullable foreign keys.
- Required relationships should use `NOT NULL` foreign key columns.

### Foreign Keys Can Reference Unique Constraints

A foreign key does not have to reference only a primary key. It can reference a candidate key enforced by a primary key or unique constraint.

```sql
CREATE TABLE dbo.Products
(
    ProductId BIGINT IDENTITY(1, 1) NOT NULL,
    Sku NVARCHAR(50) NOT NULL,

    CONSTRAINT PK_Products PRIMARY KEY (ProductId),
    CONSTRAINT UQ_Products_Sku UNIQUE (Sku)
);

CREATE TABLE dbo.InventoryAdjustments
(
    AdjustmentId BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    ProductSku NVARCHAR(50) NOT NULL,

    CONSTRAINT FK_InventoryAdjustments_Products_Sku
        FOREIGN KEY (ProductSku)
        REFERENCES dbo.Products(Sku)
);
```

This can be useful, but surrogate-key references are often simpler and more stable. Referencing natural keys means key changes have wider impact.

### Nullable Foreign Keys

A nullable foreign key means the relationship is optional.

```sql
CREATE TABLE dbo.Orders
(
    OrderId BIGINT NOT NULL PRIMARY KEY,
    SalesPersonId BIGINT NULL,

    CONSTRAINT FK_Orders_SalesPeople
        FOREIGN KEY (SalesPersonId)
        REFERENCES dbo.SalesPeople(SalesPersonId)
);
```

If `SalesPersonId` is `NULL`, no parent row is required. If it is non-null, it must reference a valid salesperson.

Use nullable foreign keys only when the relationship is genuinely optional. If every order must have a customer, `CustomerId` should be `NOT NULL`.

### Cascading Actions

Foreign keys can define what happens when a parent key is updated or deleted.

Common actions:

- `NO ACTION`: reject parent change if child rows exist.
- `CASCADE`: update or delete child rows when parent changes.
- `SET NULL`: set child foreign key values to null.
- `SET DEFAULT`: set child foreign key values to their default.

Example:

```sql
CREATE TABLE dbo.OrderLines
(
    OrderId BIGINT NOT NULL,
    LineNumber INT NOT NULL,
    ProductId BIGINT NOT NULL,

    CONSTRAINT PK_OrderLines PRIMARY KEY (OrderId, LineNumber),
    CONSTRAINT FK_OrderLines_Orders
        FOREIGN KEY (OrderId)
        REFERENCES dbo.Orders(OrderId)
        ON DELETE CASCADE
);
```

Cascades are useful when child rows have no independent life without the parent. They are risky when accidental parent deletion would remove important history.

### Constraint Design Principles

Good constraint design starts from business invariants:

- What identifies a row?
- What values must be unique?
- Which relationships are required?
- Which relationships are optional?
- What should happen when a parent row is deleted?
- Are soft-deleted rows included in uniqueness?
- Are keys tenant-scoped or globally unique?
- Can business keys change?

Example multi-tenant uniqueness:

```sql
CREATE TABLE dbo.Projects
(
    ProjectId BIGINT IDENTITY(1, 1) NOT NULL,
    TenantId BIGINT NOT NULL,
    Slug NVARCHAR(100) NOT NULL,
    Name NVARCHAR(200) NOT NULL,

    CONSTRAINT PK_Projects PRIMARY KEY (ProjectId),
    CONSTRAINT UQ_Projects_Tenant_Slug UNIQUE (TenantId, Slug)
);
```

`Slug` may repeat across tenants, but not within the same tenant.

### Soft Delete and Unique Constraints

Soft delete marks rows as deleted instead of physically removing them.

```sql
DeletedAtUtc DATETIME2(3) NULL
```

If `Email` is unique, should a deleted user still reserve the email? The answer depends on the business.

If only active rows must be unique, use a filtered unique index in SQL Server:

```sql
CREATE UNIQUE INDEX UX_Users_Email_Active
ON dbo.Users(Email)
WHERE DeletedAtUtc IS NULL;
```

This is not the same as a normal unique constraint. It enforces conditional uniqueness for active rows only.

### Indexing Foreign Keys

In SQL Server, creating a foreign key does not automatically create an index on the child foreign key columns.

Add indexes when foreign key columns are used for:

- Joins.
- Child lookups.
- Parent delete or update checks.
- Common filters.
- Cascading actions.

Example:

```sql
CREATE INDEX IX_Orders_CustomerId
ON dbo.Orders(CustomerId);
```

Not every foreign key needs a separate index, especially on small tables, but important relationships should be reviewed. Missing foreign key indexes can cause slow joins and blocking during parent-row changes.

### Constraints and Application Validation

Application validation gives fast user feedback. Database constraints protect the source of truth.

Example race condition:

- Request A checks whether email exists.
- Request B checks whether email exists.
- Both see no row.
- Both insert the same email.

Only a database unique constraint reliably prevents the duplicate.

Applications should handle constraint violations and translate them into meaningful API errors, such as conflict for duplicate business keys or bad request for invalid relationships.

### Common Mistakes

Common mistakes include:

- Using a surrogate primary key but forgetting unique constraints on business keys.
- Treating a primary key and unique constraint as identical concepts.
- Making optional relationships required accidentally.
- Making required relationships nullable accidentally.
- Assuming SQL Server automatically indexes foreign key columns.
- Using cascade delete on important historical data without review.
- Using index keys instead of real constraints for documentation and integrity.
- Ignoring soft-delete uniqueness requirements.
- Using natural keys as foreign keys when they can change.
- Adding constraints to dirty existing data without a cleanup plan.

### Best Practices

Best practices include:

- Choose a stable primary key.
- Enforce every real candidate key.
- Use unique constraints or filtered unique indexes for business uniqueness.
- Use foreign keys for important relationships.
- Make required foreign keys `NOT NULL`.
- Index foreign keys when they support joins, filters, or parent-row changes.
- Use cascading actions deliberately.
- Name constraints consistently.
- Validate existing data before adding constraints.
- Keep database constraints aligned with domain rules and API validation.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the difference between a primary key and a unique constraint?

<!-- question:start:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-beginner-q01 -->
<!-- question-id:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A primary key is the chosen main identifier for rows in a table. A table can have only one primary key, and primary key columns must be unique and not nullable. A unique constraint enforces uniqueness for another column or set of columns, often a business key.

A table can have multiple unique constraints. For example, `UserId` might be the primary key, while `Email` and `UserName` are protected by unique constraints.

##### Key Points to Mention

- Primary key is the main row identity.
- A table has one primary key.
- Primary key columns are not nullable.
- Unique constraints enforce additional uniqueness rules.
- A table can have many unique constraints.

<!-- question:end:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-beginner-q01 -->

#### What is a candidate key?

<!-- question:start:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-beginner-q02 -->
<!-- question-id:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

A candidate key is any column or set of columns that can uniquely identify a row. A table can have multiple candidate keys. One candidate key is chosen as the primary key, and the others should usually be enforced with unique constraints or unique indexes.

For example, a `Users` table might have `UserId`, `Email`, and `(ExternalProvider, ExternalSubject)` as candidate keys.

##### Key Points to Mention

- Candidate keys uniquely identify rows.
- There can be multiple candidate keys.
- One becomes the primary key.
- Others are enforced with unique constraints or indexes.
- Candidate keys represent real uniqueness rules.

<!-- question:end:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-beginner-q02 -->

#### What is a foreign key?

<!-- question:start:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-beginner-q03 -->
<!-- question-id:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

A foreign key is a column or set of columns in one table that references a key in another table. It enforces referential integrity by preventing child rows from referencing parent rows that do not exist.

For example, `Orders.CustomerId` can reference `Customers.CustomerId`, ensuring every order belongs to a valid customer.

##### Key Points to Mention

- Enforces relationships between tables.
- Child row references a parent key.
- Prevents orphan records.
- Can reference primary or unique keys.
- Required relationships should use `NOT NULL`.

<!-- question:end:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-beginner-q03 -->

#### Can a table have more than one unique constraint?

<!-- question:start:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-beginner-q04 -->
<!-- question-id:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Yes. A table can have multiple unique constraints. This is common when the table has several business values that must be unique, such as email, username, SKU, or an external identity pair.

Only one key is chosen as the primary key, but other candidate keys still need database enforcement if duplicates would violate business rules.

##### Key Points to Mention

- Multiple unique constraints are allowed.
- They enforce different business keys.
- One primary key does not protect every unique business value.
- Unique constraints are enforced by unique indexes in SQL Server.

<!-- question:end:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why use a surrogate primary key plus a unique business key?

<!-- question:start:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-intermediate-q01 -->
<!-- question-id:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

A surrogate primary key gives the database a stable, narrow row identifier that is convenient for joins, foreign keys, APIs, and ORM mapping. A unique business key enforces real-world uniqueness, such as email or SKU.

Using only the surrogate key can allow duplicate business records. Using only the business key can be painful if the business key changes, is long, or is composite. Combining both is often pragmatic.

##### Key Points to Mention

- Surrogate keys are stable technical identifiers.
- Business keys enforce domain uniqueness.
- Surrogate keys alone do not prevent duplicate business data.
- Natural keys can change or be wide.
- Many production schemas use both.

<!-- question:end:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-intermediate-q01 -->

#### Does SQL Server automatically index foreign keys?

<!-- question:start:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-intermediate-q02 -->
<!-- question-id:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

No. SQL Server automatically creates a unique index to enforce primary keys and unique constraints, but it does not automatically create an index on the child columns of a foreign key.

Indexing foreign key columns is often useful for joins, child lookups, parent-row updates or deletes, and cascading actions. It is still a design decision; tiny or rarely queried tables may not need separate indexes.

##### Key Points to Mention

- Foreign keys are not automatically indexed in SQL Server.
- Primary and unique constraints are enforced with unique indexes.
- Foreign key indexes often help joins.
- They can help parent delete or update checks.
- Indexing should be reviewed per workload.

<!-- question:end:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-intermediate-q02 -->

#### When should a foreign key be nullable?

<!-- question:start:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-intermediate-q03 -->
<!-- question-id:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

A foreign key should be nullable only when the relationship is genuinely optional. If the value is null, the database does not require a matching parent row. If the value is present, it must match a valid parent row.

If every order must belong to a customer, `CustomerId` should be `NOT NULL`. If an order may or may not have an assigned salesperson, `SalesPersonId` might be nullable.

##### Key Points to Mention

- Nullable foreign key means optional relationship.
- Non-null value must still reference a valid parent.
- Required relationships should use `NOT NULL`.
- Nullability should match business meaning.
- Avoid nullable FKs as a convenience default.

<!-- question:end:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-intermediate-q03 -->

#### How would you handle soft delete with unique constraints?

<!-- question:start:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-intermediate-q04 -->
<!-- question-id:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

First decide the business rule. If soft-deleted rows should still reserve the value, use a normal unique constraint. If only active rows must be unique, use a filtered unique index in SQL Server, such as a unique index on email where `DeletedAtUtc IS NULL`.

This design should be explicit because soft delete can otherwise block valid re-use or allow duplicates unexpectedly.

##### Key Points to Mention

- Decide whether deleted rows still reserve the key.
- Normal unique constraints include soft-deleted rows.
- Filtered unique indexes can enforce active-only uniqueness.
- The rule should match product behavior.
- Tests should cover restore and re-create cases.

<!-- question:end:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design constraints for a multi-tenant table?

<!-- question:start:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-advanced-q01 -->
<!-- question-id:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

I would decide whether keys are globally unique or tenant-scoped. Many business keys, such as project slug or role name, are unique only within a tenant. In that case, use a unique constraint like `(TenantId, Slug)`.

For relationships, I would make sure foreign keys cannot accidentally cross tenant boundaries. Depending on the schema, that may mean composite foreign keys that include `TenantId`, or strict application and database patterns that guarantee tenant consistency.

##### Key Points to Mention

- Identify tenant-scoped uniqueness.
- Use composite unique constraints such as `(TenantId, Slug)`.
- Prevent cross-tenant references.
- Consider composite foreign keys involving `TenantId`.
- Align constraints with security boundaries.

<!-- question:end:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-advanced-q01 -->

#### How do cascading foreign key actions affect design?

<!-- question:start:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-advanced-q02 -->
<!-- question-id:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Cascading actions define what happens to child rows when a parent key is deleted or updated. `CASCADE` can be appropriate when child rows have no independent life, such as order draft lines under a draft order. `NO ACTION` is safer when deleting the parent should be blocked if important child history exists.

`SET NULL` or `SET DEFAULT` can model optional relationships, but the columns and defaults must support that behavior. Cascades should be reviewed carefully because one parent delete can affect many tables.

##### Key Points to Mention

- Cascades automate child updates or deletes.
- Use cascade when child rows depend fully on parent.
- Use `NO ACTION` to protect important child history.
- `SET NULL` requires nullable foreign key columns.
- Cascades need operational and audit review.

<!-- question:end:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-advanced-q02 -->

#### How would you add a unique constraint to a table that already has duplicate data?

<!-- question:start:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-advanced-q03 -->
<!-- question-id:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

I would first find duplicates with a grouped query, decide the business cleanup rule, and fix or merge existing rows. Then I would add the unique constraint or filtered unique index in a migration. The migration should be tested against realistic data and deployed with a rollback plan.

If application code can still write duplicates during the migration window, I would coordinate deployment order or temporarily block conflicting writes. The final database constraint is what prevents future duplicates.

##### Key Points to Mention

- Detect duplicates before adding the constraint.
- Define cleanup or merge rules.
- Fix existing data first.
- Add the constraint in a reviewed migration.
- Coordinate application deployment.
- Handle future violations in API errors.

<!-- question:end:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-advanced-q03 -->

#### How do constraints affect performance?

<!-- question:start:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-advanced-q04 -->
<!-- question-id:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

Constraints add validation work to writes. Unique constraints must check for duplicates, and foreign keys must check parent or child relationships. Cascades can multiply write work. However, constraints also protect data and can help query performance because primary and unique constraints create indexes, and foreign key relationships help the optimizer reason about data.

The right answer is not to avoid constraints. It is to design them correctly, index supporting foreign key columns where useful, and test write-heavy workloads with realistic data.

##### Key Points to Mention

- Constraints add write validation cost.
- Unique constraints are enforced with indexes.
- Foreign keys may need child-column indexes.
- Constraints protect data quality.
- Good constraints can improve reads and optimizer reasoning.
- Test performance with realistic workloads.

<!-- question:end:primary-key-vs-unique-constraint-candidate-keys-foreign-keys-and-constraint-design-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
