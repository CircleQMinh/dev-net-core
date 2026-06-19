---
id: data-types-nullability-and-business-rule-enforcement
topic: Relational modeling and normalization
subtopic: Data types, nullability, and business-rule enforcement
category: SQL
---

## Overview

Data types, nullability, and business-rule enforcement define what kind of data a relational database will accept. They are not just storage details. They are part of the contract between the database, application code, reporting queries, integrations, and future maintainers.

Choosing the right data type affects correctness, storage, indexing, sorting, comparisons, rounding, date handling, string behavior, and performance. Choosing nullability defines whether a value is required, optional, unknown, not applicable, or not yet captured. Enforcing business rules with constraints protects the database when data is written by APIs, background jobs, imports, scripts, and multiple applications.

This topic matters in SQL interviews because it tests whether a candidate thinks beyond `SELECT` syntax. A strong candidate can explain why `DECIMAL` is safer than `FLOAT` for money, why `NOT NULL` matters, why `CHECK` constraints are useful, why nullable columns affect filtering, and which rules belong in the database versus application code.

The practical goal is to model the domain accurately, reject invalid data early, and keep the database trustworthy even when application code has bugs.

## Core Concepts

### Data Types Are a Contract

A data type defines the shape of values a column can store.

```sql
CREATE TABLE Products
(
    ProductId BIGINT NOT NULL,
    Sku NVARCHAR(50) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Price DECIMAL(19, 4) NOT NULL,
    IsActive BIT NOT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL,

    CONSTRAINT PK_Products PRIMARY KEY (ProductId),
    CONSTRAINT UQ_Products_Sku UNIQUE (Sku),
    CONSTRAINT CK_Products_Price CHECK (Price >= 0)
);
```

This schema says more than "there is a products table." It says:

- Product IDs are required.
- SKUs are Unicode strings with a bounded length.
- Price is exact numeric data.
- Active state is required.
- Creation time is stored with a clear type and precision.
- Negative prices are invalid.

Good schema design uses types to make invalid data hard to store.

### Exact vs Approximate Numerics

Use exact numeric types for values where exactness matters:

- Counts.
- Quantities.
- Money.
- Tax rates.
- Percentages that must round predictably.
- Inventory levels.

```sql
Price DECIMAL(19, 4) NOT NULL
TaxRate DECIMAL(9, 6) NOT NULL
Quantity INT NOT NULL
```

Avoid approximate types such as `FLOAT` and `REAL` for money or business totals. They are useful for scientific measurements or approximate calculations, but they can produce surprising rounding behavior.

Bad:

```sql
Price FLOAT NOT NULL
```

Better:

```sql
Price DECIMAL(19, 4) NOT NULL
```

### Precision and Scale

`DECIMAL(p, s)` and `NUMERIC(p, s)` store exact numbers. Precision is the total number of digits. Scale is the number of digits after the decimal point.

```sql
Amount DECIMAL(19, 4) NOT NULL
```

This supports 19 total digits with 4 digits after the decimal point.

Common mistakes:

- Choosing too little precision and causing overflow.
- Choosing too little scale and losing fractional values.
- Choosing excessive precision everywhere and increasing storage or index size.
- Using money-like values without a clear rounding strategy.

The data type should match both the domain and the calculations.

### Date and Time Types

Use date and time types that match the meaning of the value:

- `DATE` for calendar dates without time.
- `TIME` for time of day.
- `DATETIME2` for precise date and time values.
- `DATETIMEOFFSET` when the offset is part of the stored value.

Example:

```sql
CREATE TABLE Events
(
    EventId BIGINT NOT NULL PRIMARY KEY,
    EventDate DATE NOT NULL,
    StartsAtUtc DATETIME2(3) NOT NULL,
    SourceOffset DATETIMEOFFSET(3) NULL
);
```

Store instants consistently, often in UTC, and use naming that makes the convention visible, such as `CreatedAtUtc`.

Avoid storing dates as strings:

```sql
CreatedDate NVARCHAR(30) NOT NULL
```

String dates are harder to validate, sort, filter, index, and compare correctly.

### String Types and Lengths

In SQL Server, common string choices include:

- `VARCHAR(n)` for non-Unicode text where the character set is known.
- `NVARCHAR(n)` for Unicode text.
- `CHAR(n)` or `NCHAR(n)` for fixed-length values.
- `VARCHAR(MAX)` or `NVARCHAR(MAX)` for large text when truly needed.

Use explicit lengths:

```sql
Email NVARCHAR(320) NOT NULL
Name NVARCHAR(200) NOT NULL
Status NVARCHAR(30) NOT NULL
```

Avoid `NVARCHAR(MAX)` for every string. It weakens the domain model, can increase memory grants or storage complexity, and makes indexing harder.

For codes and statuses, consider whether a lookup table, check constraint, or application enum plus database constraint is appropriate.

### Boolean and Status Values

SQL Server uses `BIT` for Boolean-like values.

```sql
IsActive BIT NOT NULL
```

Be careful with nullable Boolean columns. `NULL`, `0`, and `1` can create three states. Sometimes that is correct, such as "not answered yet." Often it is accidental complexity.

Bad:

```sql
IsDeleted BIT NULL
```

Better:

```sql
IsDeleted BIT NOT NULL
    CONSTRAINT DF_Users_IsDeleted DEFAULT 0
```

For multi-state workflow values, a status column with a check constraint or reference table is usually clearer.

```sql
Status NVARCHAR(20) NOT NULL
    CONSTRAINT CK_Orders_Status
    CHECK (Status IN (N'Draft', N'Placed', N'Cancelled', N'Shipped'))
```

### NULL Meaning

`NULL` means the database does not have a value. It can represent:

- Unknown.
- Not applicable.
- Not collected yet.
- Optional value.
- Future value.

These meanings are different. A good schema should make the intended meaning clear.

Examples:

- `MiddleName NULL` can mean the person has no middle name or it is unknown.
- `ShippedAtUtc NULL` can mean the order has not shipped yet.
- `CancelledAtUtc NULL` can mean the order was not cancelled.

For important business logic, a separate status can be clearer than relying only on null checks.

### `NOT NULL`

Use `NOT NULL` for required values.

```sql
CREATE TABLE Customers
(
    CustomerId BIGINT NOT NULL PRIMARY KEY,
    Email NVARCHAR(320) NOT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL
);
```

Benefits:

- Prevents incomplete rows.
- Simplifies queries.
- Helps the optimizer reason about data.
- Documents required fields.
- Avoids accidental three-valued logic.

Be explicit about nullability. Do not rely on database defaults or session settings to communicate whether a column is required.

### NULL and Three-Valued Logic

Comparisons involving `NULL` often evaluate to unknown, not true or false.

Bad:

```sql
SELECT *
FROM Orders
WHERE ShippedAtUtc = NULL;
```

Correct:

```sql
SELECT *
FROM Orders
WHERE ShippedAtUtc IS NULL;
```

For non-null:

```sql
SELECT *
FROM Orders
WHERE ShippedAtUtc IS NOT NULL;
```

Nullable columns can affect joins, filters, unique rules, aggregates, and check constraints. Interview answers should mention that `NULL` is not just an empty string or zero.

### Defaults

Defaults provide a value when an insert omits a column.

```sql
CreatedAtUtc DATETIME2(3) NOT NULL
    CONSTRAINT DF_Orders_CreatedAtUtc DEFAULT SYSUTCDATETIME()
```

Defaults are useful for:

- Creation timestamps.
- Required flags with normal defaults.
- Status initial values.
- System-generated values.

Be careful: if a nullable column is explicitly inserted as `NULL`, a default may not apply. Also, defaults are not a replacement for business validation.

### Check Constraints

`CHECK` constraints enforce rules about allowed values in a row.

```sql
CREATE TABLE OrderLines
(
    OrderId BIGINT NOT NULL,
    LineNumber INT NOT NULL,
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(19, 4) NOT NULL,
    DiscountAmount DECIMAL(19, 4) NOT NULL
        CONSTRAINT DF_OrderLines_DiscountAmount DEFAULT 0,

    CONSTRAINT PK_OrderLines PRIMARY KEY (OrderId, LineNumber),
    CONSTRAINT CK_OrderLines_Quantity CHECK (Quantity > 0),
    CONSTRAINT CK_OrderLines_UnitPrice CHECK (UnitPrice >= 0),
    CONSTRAINT CK_OrderLines_Discount CHECK (DiscountAmount >= 0),
    CONSTRAINT CK_OrderLines_DiscountNotGreaterThanPrice
        CHECK (DiscountAmount <= UnitPrice)
);
```

Use check constraints for domain rules that must always be true for a row:

- Quantity must be positive.
- End date must be after start date.
- Status must be one of known values.
- Discount must be within a valid range.
- Percent must be between 0 and 100.

### Unique Constraints and Unique Indexes

Use unique constraints or unique indexes to enforce candidate keys and business uniqueness.

```sql
CREATE TABLE Customers
(
    CustomerId BIGINT NOT NULL PRIMARY KEY,
    Email NVARCHAR(320) NOT NULL,
    CONSTRAINT UQ_Customers_Email UNIQUE (Email)
);
```

For optional values, a filtered unique index can enforce uniqueness only when the value exists.

```sql
CREATE UNIQUE INDEX UX_Customers_Phone
ON Customers(PhoneNumber)
WHERE PhoneNumber IS NOT NULL;
```

This is useful when phone number is optional but no two customers should share the same non-null phone number.

### Foreign Keys

Foreign keys enforce relationships between tables.

```sql
CREATE TABLE Orders
(
    OrderId BIGINT NOT NULL PRIMARY KEY,
    CustomerId BIGINT NOT NULL,
    CONSTRAINT FK_Orders_Customers
        FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId)
);
```

Foreign keys prevent orphan records and help express the domain. If `Orders.CustomerId` is required, make it `NOT NULL`. If an order can exist without a customer, make the business meaning explicit and consider whether a nullable foreign key is really correct.

### Business Rule Enforcement Layers

Business rules can be enforced in multiple places:

- UI validation for user feedback.
- API validation for request contracts.
- Domain/application logic for workflows.
- Database constraints for durable invariants.
- Triggers for rare cross-row or side-effect rules.
- Jobs or audits for reconciliation.

Rules that must never be violated should usually have database enforcement when possible.

Examples:

- Email must be unique.
- Quantity must be positive.
- Order status must be valid.
- Order line must reference an existing order.
- A user cannot have two active primary email rows.

The application should still validate early for good user experience, but the database should protect the data.

### Rules That Need More Than a Check Constraint

Some rules cannot be expressed cleanly with a row-level check constraint:

- "Only one active subscription per customer."
- "Order total must equal the sum of its lines."
- "A booking must not overlap another booking."
- "A manager cannot approve their own expense."
- "A status transition must follow a workflow."

Possible tools:

- Unique filtered indexes.
- Foreign keys.
- Transactions and appropriate isolation.
- Stored procedures or application services.
- Triggers, used carefully.
- Periodic reconciliation queries.

Example filtered unique index:

```sql
CREATE TABLE CustomerEmails
(
    CustomerEmailId BIGINT NOT NULL PRIMARY KEY,
    CustomerId BIGINT NOT NULL,
    Email NVARCHAR(320) NOT NULL,
    IsPrimary BIT NOT NULL,
    CONSTRAINT FK_CustomerEmails_Customers
        FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId)
);

CREATE UNIQUE INDEX UX_CustomerEmails_OnePrimary
ON CustomerEmails(CustomerId)
WHERE IsPrimary = 1;
```

This enforces at most one primary email per customer.

### Sentinel Values

Avoid sentinel values when `NULL` or a proper status is clearer.

Bad:

```sql
ShippedAtUtc DATETIME2 NOT NULL
    CONSTRAINT DF_Orders_ShippedAtUtc DEFAULT '19000101'
```

Better:

```sql
ShippedAtUtc DATETIME2 NULL
```

Or:

```sql
Status NVARCHAR(20) NOT NULL
ShippedAtUtc DATETIME2 NULL
```

Sentinel values pollute queries and can be mistaken for real data. If a value is unknown or not applicable, model that truth directly.

### Schema Evolution

Changing data types or nullability in production can be risky:

- Existing data may violate the new rule.
- Long-running table changes may lock data.
- Application versions may disagree during deployment.
- Backfills may need batching.
- Constraints may need to be added with validation.

Safer migration flow:

- Add nullable column or permissive rule.
- Backfill data.
- Deploy application changes.
- Validate data.
- Add `NOT NULL`, `CHECK`, or `UNIQUE` constraint.
- Remove old column or old rule after compatibility period.

Business-rule enforcement must consider deployment safety, not only final schema correctness.

### Common Mistakes

Common mistakes include:

- Using `NVARCHAR(MAX)` for every string.
- Storing dates as strings.
- Using `FLOAT` for money.
- Making required columns nullable.
- Using `NULL` to mean several different things.
- Using sentinel values such as `1900-01-01`.
- Forgetting unique constraints for business keys.
- Relying only on application validation.
- Writing check constraints that do not handle nullability intentionally.
- Letting status columns accept any string.
- Skipping database constraints because tests currently pass.

### Best Practices

Best practices include:

- Choose the narrowest type that accurately fits the domain.
- Use exact numerics for money and counts.
- Use clear date/time types and naming conventions.
- Specify string lengths intentionally.
- Make required fields `NOT NULL`.
- Use `CHECK` constraints for row-level invariants.
- Use `UNIQUE` constraints or indexes for candidate keys.
- Use foreign keys for relationships.
- Use filtered indexes for conditional uniqueness.
- Keep UI validation and database constraints aligned.
- Name constraints clearly.
- Test migrations against realistic data.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### Why do SQL data types matter?

<!-- question:start:data-types-nullability-and-business-rule-enforcement-beginner-q01 -->
<!-- question-id:data-types-nullability-and-business-rule-enforcement-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

SQL data types define what values a column can store and how those values behave in comparisons, sorting, indexing, arithmetic, storage, and validation. They are part of the database contract, not just implementation details.

Choosing the wrong type can cause correctness bugs. For example, storing dates as strings makes date filtering unreliable, using `FLOAT` for money can introduce rounding problems, and using huge string columns everywhere can make constraints and indexes weaker.

##### Key Points to Mention

- Data types affect correctness and storage.
- They affect indexing and comparisons.
- They document the domain.
- Wrong types can create rounding, sorting, and validation bugs.
- Types should match business meaning.

<!-- question:end:data-types-nullability-and-business-rule-enforcement-beginner-q01 -->

#### What is the difference between `NULL` and an empty string or zero?

<!-- question:start:data-types-nullability-and-business-rule-enforcement-beginner-q02 -->
<!-- question-id:data-types-nullability-and-business-rule-enforcement-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

`NULL` means the database does not have a value. It is different from an empty string, which is a known string with length zero, and different from zero, which is a known numeric value.

This matters because comparisons with `NULL` use SQL's three-valued logic. To check for missing values, use `IS NULL` or `IS NOT NULL`, not `= NULL`.

##### Key Points to Mention

- `NULL` means missing, unknown, optional, or not applicable.
- Empty string is a real string value.
- Zero is a real numeric value.
- Use `IS NULL`, not `= NULL`.
- Nullable columns affect filters and joins.

<!-- question:end:data-types-nullability-and-business-rule-enforcement-beginner-q02 -->

#### When should a column be `NOT NULL`?

<!-- question:start:data-types-nullability-and-business-rule-enforcement-beginner-q03 -->
<!-- question-id:data-types-nullability-and-business-rule-enforcement-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

A column should be `NOT NULL` when the value is required for a valid row. For example, a customer email, order creation timestamp, product SKU, or order line quantity may be required by the business model.

`NOT NULL` prevents incomplete data, makes queries simpler, and documents the schema. If a value is genuinely optional or not known at creation time, then `NULL` may be appropriate, but the meaning should be clear.

##### Key Points to Mention

- Use `NOT NULL` for required values.
- It prevents incomplete rows.
- It simplifies query logic.
- It documents the contract.
- Nullable should mean something intentional.

<!-- question:end:data-types-nullability-and-business-rule-enforcement-beginner-q03 -->

#### What is a check constraint?

<!-- question:start:data-types-nullability-and-business-rule-enforcement-beginner-q04 -->
<!-- question-id:data-types-nullability-and-business-rule-enforcement-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

A check constraint is a database rule that restricts allowed values in a row. It can enforce rules such as quantity must be greater than zero, price must not be negative, status must be one of a known set, or end date must be after start date.

Check constraints are useful because they protect the database even when data is inserted by different applications, jobs, scripts, or imports.

##### Key Points to Mention

- Enforces allowed values.
- Usually applies to row-level rules.
- Protects data at the database level.
- Complements application validation.
- Should be named clearly.

<!-- question:end:data-types-nullability-and-business-rule-enforcement-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why should money usually use `DECIMAL` instead of `FLOAT`?

<!-- question:start:data-types-nullability-and-business-rule-enforcement-intermediate-q01 -->
<!-- question-id:data-types-nullability-and-business-rule-enforcement-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

Money should usually use an exact numeric type such as `DECIMAL(p, s)` because financial values need predictable precision and rounding. `FLOAT` and `REAL` are approximate numeric types, so they can represent values with small binary rounding differences.

For example, prices, totals, taxes, and balances should usually be `DECIMAL(19, 4)` or another precision and scale chosen for the domain. Scientific measurements or approximate calculations may be valid uses for `FLOAT`, but not ordinary financial storage.

##### Key Points to Mention

- `DECIMAL` is exact numeric.
- `FLOAT` is approximate.
- Financial values need predictable rounding.
- Choose precision and scale intentionally.
- Use domain requirements to pick the exact type.

<!-- question:end:data-types-nullability-and-business-rule-enforcement-intermediate-q01 -->

#### How do defaults differ from `NOT NULL` constraints?

<!-- question:start:data-types-nullability-and-business-rule-enforcement-intermediate-q02 -->
<!-- question-id:data-types-nullability-and-business-rule-enforcement-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

A default supplies a value when an insert omits the column. A `NOT NULL` constraint rejects rows where the column has no value. They solve different problems and are often used together.

For example, `CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()` means a row must have a creation timestamp, and the database can provide one if the insert does not specify it. If code explicitly inserts `NULL`, the `NOT NULL` constraint still protects the column.

##### Key Points to Mention

- Defaults fill omitted values.
- `NOT NULL` requires a value.
- They are often combined.
- Defaults do not replace validation.
- Explicit `NULL` can still be rejected by `NOT NULL`.

<!-- question:end:data-types-nullability-and-business-rule-enforcement-intermediate-q02 -->

#### Which business rules belong in the database?

<!-- question:start:data-types-nullability-and-business-rule-enforcement-intermediate-q03 -->
<!-- question-id:data-types-nullability-and-business-rule-enforcement-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Rules that must always be true for the data should usually be enforced in the database when possible. Examples include required fields, valid ranges, valid statuses, uniqueness, foreign key relationships, and conditional uniqueness. The application should also validate these rules for user experience, but database constraints protect the source of truth.

Rules involving complex workflows, external services, permissions, or multi-step business processes may need application logic as well. The database can still enforce important final invariants.

##### Key Points to Mention

- Durable invariants belong in the database when possible.
- Use `NOT NULL`, `CHECK`, `UNIQUE`, and foreign keys.
- Application validation is still useful.
- Complex workflows may need application services.
- Database constraints protect against all write paths.

<!-- question:end:data-types-nullability-and-business-rule-enforcement-intermediate-q03 -->

#### How can you enforce uniqueness for optional values?

<!-- question:start:data-types-nullability-and-business-rule-enforcement-intermediate-q04 -->
<!-- question-id:data-types-nullability-and-business-rule-enforcement-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

For optional values, a filtered unique index is often useful in SQL Server. It can enforce uniqueness only for rows where the optional value is present. For example, if phone number is nullable but must be unique when provided, create a unique index with `WHERE PhoneNumber IS NOT NULL`.

This avoids treating missing values like real duplicates while still protecting non-null values from duplication.

##### Key Points to Mention

- Optional values can be nullable.
- Non-null values may still need uniqueness.
- Use a filtered unique index.
- Define the filter clearly.
- Test how the database handles `NULL` with uniqueness.

<!-- question:end:data-types-nullability-and-business-rule-enforcement-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you model order status and status transitions?

<!-- question:start:data-types-nullability-and-business-rule-enforcement-advanced-q01 -->
<!-- question-id:data-types-nullability-and-business-rule-enforcement-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

I would start by modeling the current status with a constrained value, such as a status lookup table or a `CHECK` constraint for a small stable set. The column should be `NOT NULL` if every order must have a status. This prevents invalid values like misspellings or unsupported states.

Status transitions are often more complex than a single check constraint because they depend on previous state, actor, timing, and workflow rules. I would enforce transitions in application or domain logic, use transactions, and keep audit history if needed. The database can still protect the final status value and important invariants.

##### Key Points to Mention

- Constrain allowed status values.
- Use `NOT NULL` if status is required.
- Use check constraint or lookup table.
- Transitions often need application/domain logic.
- Use transactions and audit history for workflows.
- Database still enforces final valid states.

<!-- question:end:data-types-nullability-and-business-rule-enforcement-advanced-q01 -->

#### How would you safely add a new `NOT NULL` column to a large production table?

<!-- question:start:data-types-nullability-and-business-rule-enforcement-advanced-q02 -->
<!-- question-id:data-types-nullability-and-business-rule-enforcement-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

I would avoid a risky one-step change if the table is large or heavily used. A safer approach is to add the column as nullable or with a safe default, backfill existing rows in batches, deploy application code that writes the column, validate that no rows are missing values, and then add the `NOT NULL` constraint.

The exact migration depends on database size, locking behavior, deployment model, and rollback needs. The key is to preserve compatibility between old and new application versions while gradually enforcing the stricter rule.

##### Key Points to Mention

- Avoid unsafe one-step changes on large tables.
- Add nullable or defaulted column first.
- Backfill in batches.
- Deploy compatible application changes.
- Validate data before enforcing `NOT NULL`.
- Plan rollback and locking impact.

<!-- question:end:data-types-nullability-and-business-rule-enforcement-advanced-q02 -->

#### How do check constraints interact with nullable columns?

<!-- question:start:data-types-nullability-and-business-rule-enforcement-advanced-q03 -->
<!-- question-id:data-types-nullability-and-business-rule-enforcement-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Check constraints evaluate the logical expression for each row, but nullable values can produce unknown results. In SQL Server, a check constraint rejects values that violate the expression, but nullable columns require careful design because `NULL` may not behave like an ordinary value in comparisons.

If a value must be present, use `NOT NULL` in addition to the check constraint. For example, `CHECK (Quantity > 0)` expresses the positive range, while `Quantity INT NOT NULL` expresses required presence. Together they are clearer than relying on one rule to imply the other.

##### Key Points to Mention

- Nullable values affect constraint logic.
- Use `NOT NULL` for required presence.
- Use `CHECK` for valid range or domain.
- Test nullable cases explicitly.
- Do not assume `NULL` behaves like zero or empty string.

<!-- question:end:data-types-nullability-and-business-rule-enforcement-advanced-q03 -->

#### How do you decide between enforcing a rule with a constraint, trigger, or application code?

<!-- question:start:data-types-nullability-and-business-rule-enforcement-advanced-q04 -->
<!-- question-id:data-types-nullability-and-business-rule-enforcement-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

Use constraints for simple, declarative invariants the database can enforce directly: required fields, valid ranges, uniqueness, and relationships. They are clear, optimized, and hard to bypass. Use application code for workflows, authorization, cross-service rules, and decisions that need user context or external systems.

Use triggers sparingly for rules that must run inside the database and cannot be expressed with constraints, especially cross-row or audit behaviors. Triggers can be powerful, but they are harder to discover, test, and debug. If a filtered unique index or constraint can express the rule, prefer that over a trigger.

##### Key Points to Mention

- Prefer declarative constraints when possible.
- Use application code for workflow and context-heavy rules.
- Use triggers carefully and document them.
- Avoid hidden side effects.
- Consider transactions and isolation for cross-row rules.
- Keep enforcement close to the source of truth.

<!-- question:end:data-types-nullability-and-business-rule-enforcement-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
