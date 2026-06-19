---
id: ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ
topic: SQL practical interview comparisons and SQL Server-specific features
subtopic: DDL vs DML vs DCL and how schema, data, and permissions changes differ
category: SQL
---

## Overview

DDL, DML, and DCL are categories of SQL statements that change different things. DDL changes database structures, DML changes the data stored in those structures, and DCL changes permissions that control who can access or modify database objects.

DDL stands for Data Definition Language. It includes statements such as `CREATE`, `ALTER`, `DROP`, and `TRUNCATE TABLE`. DML stands for Data Manipulation Language. It includes `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and `MERGE`. DCL commonly refers to Data Control Language. In SQL Server, this maps to permission statements such as `GRANT`, `DENY`, and `REVOKE`.

This topic matters because schema changes, data changes, and permission changes have different review paths, deployment risks, rollback strategies, audit requirements, and production blast radius. Adding a column is not the same kind of change as updating a customer's email or granting `SELECT` on a table.

For interviews, strong candidates can classify SQL statements, explain the operational implications, and describe how they would safely deploy migrations, data fixes, and permission changes.

## Core Concepts

### DDL

Data Definition Language changes database structures.

Common DDL statements include:

- `CREATE`
- `ALTER`
- `DROP`
- `TRUNCATE TABLE`
- `CREATE INDEX`
- `ALTER TABLE`
- `CREATE VIEW`
- `CREATE PROCEDURE`

Example:

```sql
CREATE TABLE dbo.Products
(
    ProductId BIGINT IDENTITY(1, 1) NOT NULL,
    Sku NVARCHAR(50) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Price DECIMAL(19, 4) NOT NULL,

    CONSTRAINT PK_Products PRIMARY KEY (ProductId),
    CONSTRAINT UQ_Products_Sku UNIQUE (Sku),
    CONSTRAINT CK_Products_Price CHECK (Price >= 0)
);
```

This creates a table, columns, data types, and constraints. It changes the schema.

### DML

Data Manipulation Language reads or changes rows stored in database objects.

Common DML statements include:

- `SELECT`
- `INSERT`
- `UPDATE`
- `DELETE`
- `MERGE`
- `BULK INSERT`

Example:

```sql
INSERT INTO dbo.Products (Sku, Name, Price)
VALUES (N'KB-001', N'Wireless Keyboard', 49.99);
```

This does not change the table definition. It adds data to an existing table.

Another DML example:

```sql
UPDATE dbo.Products
SET Price = 44.99
WHERE Sku = N'KB-001';
```

This changes stored row values.

### DCL and Permission Statements

DCL commonly refers to statements that control access. In SQL Server, permission statements include `GRANT`, `DENY`, and `REVOKE`.

Example:

```sql
GRANT SELECT ON dbo.Products TO ReportingUser;
```

This lets `ReportingUser` read from `dbo.Products`.

Deny example:

```sql
DENY DELETE ON dbo.Products TO ReportingUser;
```

Revoke example:

```sql
REVOKE SELECT ON dbo.Products FROM ReportingUser;
```

These statements change security metadata, not table structure or business rows.

### Schema, Data, and Permissions

Think of the categories by what they change:

| Category | Changes | Examples |
|---|---|---|
| DDL | Structure | Create table, add column, drop index, alter constraint |
| DML | Stored data | Insert row, update price, delete old sessions, select rows |
| DCL | Access control | Grant select, deny delete, revoke execute |

This distinction helps teams route changes correctly:

- DDL usually belongs in migrations.
- DML data fixes need data review and row-count safety.
- DCL belongs in security and least-privilege review.

### DDL Examples

Add a column:

```sql
ALTER TABLE dbo.Customers
ADD MarketingOptIn BIT NOT NULL
    CONSTRAINT DF_Customers_MarketingOptIn DEFAULT 0;
```

Add a constraint:

```sql
ALTER TABLE dbo.Products
ADD CONSTRAINT CK_Products_Price
CHECK (Price >= 0);
```

Create an index:

```sql
CREATE INDEX IX_Orders_CustomerId_OrderDate
ON dbo.Orders(CustomerId, OrderDate DESC);
```

DDL changes can affect application compatibility. Adding a nullable column is usually safer than renaming or dropping a column. Adding a non-null column to a large table requires migration planning.

### DML Examples

Insert:

```sql
INSERT INTO dbo.Customers (Email, DisplayName)
VALUES (N'ada@example.com', N'Ada Lovelace');
```

Update:

```sql
UPDATE dbo.Customers
SET DisplayName = N'Ada Byron'
WHERE Email = N'ada@example.com';
```

Delete:

```sql
DELETE FROM dbo.Sessions
WHERE ExpiresAtUtc < SYSUTCDATETIME();
```

Select:

```sql
SELECT CustomerId, Email, DisplayName
FROM dbo.Customers
WHERE IsActive = 1;
```

DML changes should be scoped carefully. For destructive statements, verify the `WHERE` clause and expected row count before execution.

### DCL Examples

Grant:

```sql
GRANT SELECT ON SCHEMA::Reporting TO ReportReaders;
```

Deny:

```sql
DENY DELETE ON dbo.Orders TO AppReadOnlyRole;
```

Revoke:

```sql
REVOKE EXECUTE ON dbo.RebuildCustomerSummary FROM SupportUser;
```

`GRANT` gives a permission. `DENY` explicitly blocks a permission, often overriding permissions inherited through roles. `REVOKE` removes a previous grant or deny, returning permission resolution to whatever other roles or permissions apply.

### TRUNCATE TABLE Classification

`TRUNCATE TABLE` removes data, so it feels like DML, but SQL Server groups it under DDL-style statements because it deallocates data pages and changes table allocation metadata.

```sql
TRUNCATE TABLE dbo.ImportStage;
```

Operationally, it behaves differently from `DELETE`:

- It removes all rows.
- It does not support `WHERE`.
- It resets identity.
- It does not fire delete triggers.
- It requires stronger permissions.
- It can be rolled back inside a transaction in SQL Server.

This is a good interview example because categories are useful, but behavior matters more than memorized labels.

### Transactions and Rollback

SQL Server supports transactions for many DDL and DML operations.

```sql
BEGIN TRANSACTION;

UPDATE dbo.Products
SET Price = Price * 1.10
WHERE CategoryId = 5;

ROLLBACK TRANSACTION;
```

DDL can also participate in transactions in SQL Server:

```sql
BEGIN TRANSACTION;

ALTER TABLE dbo.Products
ADD TemporaryColumn INT NULL;

ROLLBACK TRANSACTION;
```

Do not assume every database platform behaves the same. Also remember that rollback ability does not remove operational risk. A long-running schema change can still block production traffic or fill the transaction log.

### Deployment Risk

DDL risk:

- Breaking application code.
- Locking large tables.
- Long-running index builds.
- Failed migrations because existing data violates new constraints.
- Difficult rollback after destructive schema changes.

DML risk:

- Updating or deleting too many rows.
- Corrupting business data.
- Creating inconsistent states.
- Long transactions and log growth.
- Race conditions with live application writes.

DCL risk:

- Over-permissioning users or applications.
- Breaking jobs by revoking needed access.
- Failing least-privilege audits.
- Creating hidden access through roles.
- Confusing `DENY` and `REVOKE`.

Each category needs a different review mindset.

### Safe DDL Practices

Safer schema changes often follow expand-contract deployment:

- Add new nullable column or new table.
- Deploy code that writes both old and new shape.
- Backfill data in batches.
- Validate data.
- Add `NOT NULL`, `UNIQUE`, or foreign key constraints.
- Switch reads to the new shape.
- Remove old columns later.

Example:

```sql
ALTER TABLE dbo.Customers
ADD NormalizedEmail NVARCHAR(320) NULL;
```

Backfill:

```sql
UPDATE dbo.Customers
SET NormalizedEmail = UPPER(Email)
WHERE NormalizedEmail IS NULL;
```

Then after validation:

```sql
ALTER TABLE dbo.Customers
ALTER COLUMN NormalizedEmail NVARCHAR(320) NOT NULL;
```

This is safer than one large breaking change.

### Safe DML Practices

For data changes:

- Preview with `SELECT`.
- Use explicit transactions when appropriate.
- Check `@@ROWCOUNT`.
- Batch large updates or deletes.
- Use backups or restore points for high-risk changes.
- Log changed row keys when possible.
- Avoid running ad hoc scripts without review.

Example:

```sql
BEGIN TRANSACTION;

UPDATE dbo.Orders
SET Status = N'Archived'
WHERE Status = N'Completed'
  AND CompletedAtUtc < '2025-01-01';

SELECT @@ROWCOUNT AS UpdatedRows;

-- COMMIT TRANSACTION;
-- ROLLBACK TRANSACTION;
```

In production scripts, do not leave commit decisions ambiguous. Use a reviewed process.

### Safe DCL Practices

For permission changes:

- Grant to roles, not individual users, when possible.
- Follow least privilege.
- Prefer schema-level permissions only when the schema boundary is meaningful.
- Avoid granting broad permissions such as `db_owner` to applications.
- Document why access is needed.
- Test jobs and application paths after permission changes.
- Periodically review grants, denies, and role memberships.

Example:

```sql
CREATE ROLE ReportReaders;

GRANT SELECT ON SCHEMA::Reporting TO ReportReaders;

ALTER ROLE ReportReaders ADD MEMBER AnalystUser;
```

This is easier to manage than granting permissions directly to many users.

### GRANT vs DENY vs REVOKE

`GRANT` gives permission.

```sql
GRANT SELECT ON dbo.Orders TO ReportReaders;
```

`DENY` explicitly blocks permission.

```sql
DENY DELETE ON dbo.Orders TO ReportReaders;
```

`REVOKE` removes a previous grant or deny.

```sql
REVOKE SELECT ON dbo.Orders FROM ReportReaders;
```

Important distinction: `REVOKE` does not necessarily mean "deny access." If the user gets the permission through another role, access may still be allowed. `DENY` is stronger and usually blocks inherited grants, except for special cases such as object owners and sysadmin.

### Auditing and Review

Different statement types need different audit questions.

DDL review questions:

- Does this break existing code?
- Is it backward compatible?
- Will it lock large tables?
- Does existing data satisfy the new constraint?
- Is rollback possible?

DML review questions:

- Which rows will change?
- How many rows will change?
- Is the predicate correct?
- Can the change be rerun safely?
- Is there a backup or audit trail?

DCL review questions:

- Who gets access?
- What exact permission is granted or denied?
- Is a role better than a direct user grant?
- Is the permission too broad?
- Does this satisfy least privilege?

### Common Mistakes

Common mistakes include:

- Treating DDL, DML, and DCL as trivia instead of operational categories.
- Running `UPDATE` or `DELETE` without previewing affected rows.
- Adding a `NOT NULL` column to a large existing table without a backfill plan.
- Dropping columns before all application versions stop using them.
- Granting permissions directly to users instead of roles.
- Confusing `REVOKE` with `DENY`.
- Granting broad database owner permissions to applications.
- Assuming `TRUNCATE TABLE` behaves exactly like `DELETE`.
- Forgetting that schema changes and permission changes need source control and review.

### Best Practices

Best practices include:

- Put DDL changes in version-controlled migrations.
- Review DML data fixes with row counts and rollback plans.
- Manage DCL through roles and least privilege.
- Test schema changes against realistic data.
- Separate application deployments from destructive schema cleanup.
- Use explicit transactions carefully.
- Document high-risk permission changes.
- Prefer additive schema changes before breaking ones.
- Monitor long-running data and schema operations.
- Audit production access regularly.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is DDL?

<!-- question:start:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-beginner-q01 -->
<!-- question-id:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

DDL stands for Data Definition Language. It changes database structures such as tables, indexes, views, procedures, constraints, and schemas. Examples include `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `CREATE INDEX`, and `TRUNCATE TABLE`.

DDL changes are usually deployed through migrations because they change the shape of the database that applications depend on.

##### Key Points to Mention

- DDL changes structure.
- Examples include `CREATE`, `ALTER`, `DROP`.
- Constraints and indexes are schema objects.
- DDL usually belongs in migrations.
- Schema changes can affect application compatibility.

<!-- question:end:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-beginner-q01 -->

#### What is DML?

<!-- question:start:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-beginner-q02 -->
<!-- question-id:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

DML stands for Data Manipulation Language. It reads or changes rows stored in database tables. Examples include `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and `MERGE`.

DML does not change the schema definition. It changes or retrieves the data inside existing structures.

##### Key Points to Mention

- DML works with stored rows.
- `SELECT`, `INSERT`, `UPDATE`, and `DELETE` are DML.
- DML can be transactional.
- Predicates and row counts matter for safety.
- DML data fixes need careful review.

<!-- question:end:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-beginner-q02 -->

#### What is DCL?

<!-- question:start:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-beginner-q03 -->
<!-- question-id:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

DCL commonly stands for Data Control Language. It controls access to database objects. In SQL Server, this maps to permission statements such as `GRANT`, `DENY`, and `REVOKE`.

For example, granting `SELECT` on a reporting schema lets a role read reporting data. Denying `DELETE` can explicitly block a user or role from deleting rows.

##### Key Points to Mention

- DCL controls permissions.
- `GRANT`, `DENY`, and `REVOKE` are key examples.
- DCL changes security metadata.
- Permissions should follow least privilege.
- Roles are usually better than direct user grants.

<!-- question:end:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-beginner-q03 -->

#### How do schema, data, and permissions changes differ?

<!-- question:start:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-beginner-q04 -->
<!-- question-id:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Schema changes alter database structures, such as tables and columns. Data changes alter rows stored in those structures. Permission changes alter who can access or modify database securables.

For example, adding `Customers.NormalizedEmail` is a schema change, updating existing customer emails is a data change, and granting read access to a reporting role is a permission change.

##### Key Points to Mention

- Schema changes affect structure.
- Data changes affect rows.
- Permission changes affect access.
- Each category has different risks.
- Each category needs different review and rollback planning.

<!-- question:end:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why is `TRUNCATE TABLE` often classified with DDL even though it removes data?

<!-- question:start:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-intermediate-q01 -->
<!-- question-id:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

`TRUNCATE TABLE` removes all rows, but it does so by deallocating data pages and changing allocation metadata rather than deleting rows one by one. It has schema-level characteristics: stronger permissions, no `WHERE` clause, identity reset, no delete triggers, and foreign key restrictions.

So although its visible result is data removal, its behavior is different from `DELETE`. This is why categories are useful, but exact statement behavior matters more.

##### Key Points to Mention

- It removes data by page deallocation.
- It does not support `WHERE`.
- It resets identity.
- It requires stronger permissions.
- It behaves differently from row-level `DELETE`.

<!-- question:end:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-intermediate-q01 -->

#### What is the difference between `GRANT`, `DENY`, and `REVOKE`?

<!-- question:start:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-intermediate-q02 -->
<!-- question-id:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

`GRANT` gives a permission. `DENY` explicitly blocks a permission, often overriding permissions inherited through roles. `REVOKE` removes a previous grant or deny and lets the normal permission resolution process apply.

`REVOKE` does not always mean the user loses access, because they may still receive the permission through another role. `DENY` is stronger and should be used carefully.

##### Key Points to Mention

- `GRANT` allows.
- `DENY` explicitly blocks.
- `REVOKE` removes a grant or deny.
- `REVOKE` is not the same as deny.
- Role memberships can still provide access after revoke.

<!-- question:end:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-intermediate-q02 -->

#### How would you safely run a production data fix?

<!-- question:start:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-intermediate-q03 -->
<!-- question-id:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

I would first write a `SELECT` using the same predicate to preview affected rows and row count. Then I would run the `UPDATE` or `DELETE` in a reviewed script, often inside a transaction or in batches depending on size. I would capture affected row counts and changed keys where useful.

For high-risk fixes, I would confirm backups, test in nonproduction, plan rollback, and avoid ad hoc manual edits.

##### Key Points to Mention

- Preview affected rows with `SELECT`.
- Verify expected row count.
- Use transactions or batching when appropriate.
- Log changed keys or output.
- Test and review before production.

<!-- question:end:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-intermediate-q03 -->

#### How would you safely add a required column to a large table?

<!-- question:start:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-intermediate-q04 -->
<!-- question-id:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

I would usually use an expand-contract approach. Add the column as nullable or with a safe default, deploy application code that writes it, backfill existing rows in batches, validate the data, then add the `NOT NULL` constraint. Later, remove any old column or old behavior after all application versions are compatible.

This reduces locking, deployment coupling, and rollback risk compared with one large breaking schema change.

##### Key Points to Mention

- Use expand-contract deployment.
- Add compatible schema first.
- Backfill existing rows.
- Validate before enforcing `NOT NULL`.
- Separate destructive cleanup from initial rollout.

<!-- question:end:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How do DDL, DML, and DCL differ in code review?

<!-- question:start:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-advanced-q01 -->
<!-- question-id:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

DDL review focuses on compatibility, locking, migration order, existing data, rollback, and application deployment sequencing. DML review focuses on predicates, affected row counts, idempotency, transaction size, auditability, and data correctness. DCL review focuses on least privilege, roles, inheritance, denies, ownership, and audit requirements.

The same SQL syntax knowledge is not enough. Each category changes a different part of the system and therefore has a different failure mode.

##### Key Points to Mention

- DDL review checks schema compatibility and migration risk.
- DML review checks affected rows and data correctness.
- DCL review checks access control and least privilege.
- Rollback strategies differ.
- Audit requirements differ.

<!-- question:end:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-advanced-q01 -->

#### How would you manage database permissions for an application service?

<!-- question:start:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-advanced-q02 -->
<!-- question-id:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

I would create database roles that match application responsibilities and grant only the permissions each role needs. For example, a read-only reporting role might get `SELECT` on a reporting schema, while an application writer role gets execute permissions on stored procedures or limited DML permissions on specific schemas.

I would avoid broad roles such as `db_owner` for application identities. I would document grants, review them periodically, and test deployments with the same permissions used in production.

##### Key Points to Mention

- Use roles rather than direct user grants.
- Follow least privilege.
- Avoid `db_owner` for applications.
- Prefer schema or procedure boundaries when meaningful.
- Audit permissions regularly.
- Test with production-like permissions.

<!-- question:end:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-advanced-q02 -->

#### What makes a schema migration rollback difficult?

<!-- question:start:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-advanced-q03 -->
<!-- question-id:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Rollback is difficult when the migration destroys information, changes application contracts, or transforms data in a way that cannot be reversed exactly. Dropping a column, changing data type with truncation, renaming a column while old app versions still run, or splitting one column into several can be risky.

Safer migrations are additive first. Keep old and new structures during a compatibility window, backfill carefully, switch application reads and writes, and only later remove old structures.

##### Key Points to Mention

- Destructive DDL is hard to roll back.
- Data transformations may lose information.
- Old and new app versions may overlap.
- Additive migrations are safer.
- Separate cleanup from rollout.

<!-- question:end:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-advanced-q03 -->

#### How would you classify and review a script that creates a table, inserts seed rows, and grants access?

<!-- question:start:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-advanced-q04 -->
<!-- question-id:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

The script contains all three categories. Creating the table is DDL. Inserting seed rows is DML. Granting access is DCL or a permission statement. I would review each part differently.

For the table, I would check schema design, constraints, indexes, and deployment compatibility. For seed data, I would check idempotency and whether rerunning the script causes duplicates. For permissions, I would check least privilege and whether access is granted to a role instead of directly to users.

##### Key Points to Mention

- `CREATE TABLE` is DDL.
- `INSERT` seed rows are DML.
- `GRANT` is DCL or permission change.
- Review schema, data, and access separately.
- Seed scripts should be idempotent.
- Permissions should use least privilege.

<!-- question:end:ddl-vs-dml-vs-dcl-and-how-schema-data-and-permissions-changes-differ-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
