---
id: sql-server-core-concepts
topic: SQL Server Core Concepts
category: SQL
---

## Indexes in SQL Server

### Clustered vs Non-Clustered Index

SQL Server indexes use a **B-Tree structure** to locate rows efficiently.

#### Clustered Index

- Determines the **physical order** of data in a table
- Only **one clustered index** allowed per table
- Leaf level contains the **actual data pages**
- Best for **range queries** and sorting operations

#### Non-Clustered Index

- Separate structure containing key values and a pointer (RID or clustered key)
- Multiple indexes allowed per table
- Optimized for selective lookups

### When to Use

**Clustered Index**

- Primary keys
- Frequently sorted columns
- Range filtering queries

**Non-Clustered Index**

- Frequently searched columns
- Covering queries

---

## Changing a Clustered Index

A table can only have one clustered index.

```sql
-- Drop existing clustered index
DROP INDEX IX_OldClusteredIndex ON dbo.TableName;

-- Create new clustered index
CREATE CLUSTERED INDEX IX_NewClusteredIndex
ON dbo.TableName(ColumnName);
````

If the clustered index is tied to a PRIMARY KEY, the constraint must be dropped and recreated.

---

## DELETE vs TRUNCATE

| Feature               | DELETE           | TRUNCATE                 |
| --------------------- | ---------------- | ------------------------ |
| Removes specific rows | Yes (with WHERE) | No (all rows)            |
| Logging               | Fully logged     | Minimally logged         |
| Rollback              | Yes              | Yes (inside transaction) |
| Resets identity       | No               | Yes                      |
| WHERE allowed         | Yes              | No                       |
| Locks                 | Row/Page locks   | Table lock               |

**Important**

* TRUNCATE is **minimally logged**, not unlogged.
* TRUNCATE can be rolled back inside an explicit transaction.
* TRUNCATE cannot run when referenced by a foreign key.

---

## WHERE vs HAVING

| Feature            | WHERE           | HAVING         |
| ------------------ | --------------- | -------------- |
| Applied            | Before GROUP BY | After GROUP BY |
| Aggregates allowed | No              | Yes            |
| Filters            | Rows            | Groups         |

---

## Primary Key vs Unique Constraint

| Feature       | Primary Key                | Unique Constraint                       |
| ------------- | -------------------------- | --------------------------------------- |
| NULL allowed  | No                         | Yes (one NULL per column in SQL Server) |
| Per table     | One                        | Multiple                                |
| Default index | Clustered (if none exists) | Nonclustered (default)                  |
| Purpose       | Main identifier            | Enforce uniqueness                      |

> NULL behavior is SQL Server specific.

---

## Temporary Tables

| Feature       | #Local          | ##Global                      |
| ------------- | --------------- | ----------------------------- |
| Scope         | Current session | All sessions                  |
| Auto deletion | Session ends    | When last session disconnects |

---

## Database Keys

* **Super Key** — Any unique column(s)
* **Candidate Key** — Potential primary keys
* **Primary Key** — Selected candidate key (NOT NULL + UNIQUE)
* **Foreign Key** — References primary key of another table

---

## Database Normalization

Normalization organizes tables to:

* Reduce redundancy
* Improve data integrity
* Prevent anomalies

Normal forms include:

* 1NF
* 2NF
* 3NF
* BCNF

---

## What is SQL?

SQL (Structured Query Language) is used to:

* Query data
* Define schemas
* Manage transactions
* Control access
* Modify data

---

## DDL vs DML vs DCL

| Type | Purpose                               | Rollback?                         |
| ---- | ------------------------------------- | --------------------------------- |
| DDL  | Structure (CREATE, ALTER, DROP)       | Yes (inside explicit transaction) |
| DML  | Data (SELECT, INSERT, UPDATE, DELETE) | Yes                               |
| DCL  | Permissions (GRANT, REVOKE)           | Yes                               |

> DDL is transactional in SQL Server when executed within `BEGIN TRAN`.

---

## Transactions & ACID

ACID properties:

* **Atomicity** — All or nothing
* **Consistency** — Valid database state
* **Isolation** — Controlled concurrency
* **Durability** — Permanent once committed

Isolation levels:

* READ UNCOMMITTED
* READ COMMITTED
* REPEATABLE READ
* SERIALIZABLE
* SNAPSHOT

---

## Materialized View Equivalent

SQL Server uses **Indexed Views** instead of traditional materialized views.

* Regular View → No physical storage
* Indexed View → Physically stored and indexed

---

## Set Operators

| Operator  | Removes Duplicates |
| --------- | ------------------ |
| UNION     | Yes                |
| UNION ALL | No                 |
| EXCEPT    | Yes                |
| INTERSECT | Yes                |

SQL Server uses **EXCEPT**, not `MINUS`.

---

## SQL Server Limits

* Max row size: 8,060 bytes (excluding LOB)
* Max columns per table: 1,024
* Large objects (LOB) stored off-row

---

## Constraints

* PRIMARY KEY
* UNIQUE
* FOREIGN KEY
* CHECK
* DEFAULT
* NOT NULL

---

## Query Optimization Steps

1. Check execution plan
2. Proper indexing
3. Avoid `SELECT *`
4. Reduce key lookups
5. Use `EXISTS` vs `IN` appropriately
6. Proper filtering in WHERE
7. Correct data types
8. Partition large tables

---

## Securing SQL Server

* Windows Authentication
* Role-Based Access Control (RBAC)
* Disable `xp_cmdshell`
* Encryption (TDE, Always Encrypted)
* Regular patching
* Backup encryption
* Audit logging

---

## Deadlock vs Live Lock

* **Deadlock** — Cyclic lock dependency
* **Live Lock** — Continuous retry without progress

### Mitigation

* Consistent locking order
* Short transactions
* Proper indexing
* Snapshot isolation
* Adjust `DEADLOCK_PRIORITY`

Avoid using `NOLOCK` as a deadlock solution.

---

## Blocking

Troubleshooting tools:

```sql
sp_who2
sys.dm_exec_requests
sys.dm_tran_locks
```

Avoid:

* Long transactions
* Missing indexes

---

## SELECT Syntax (SQL Server)

```sql
SELECT [DISTINCT] columns
FROM table
JOIN ...
WHERE ...
GROUP BY ...
HAVING ...
ORDER BY ...
OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY;
```

SQL Server does **not** use `LIMIT`.

---

## JOIN Types

* INNER JOIN
* LEFT JOIN
* RIGHT JOIN
* FULL OUTER JOIN
* CROSS JOIN
* SELF JOIN

---

## Nested Transactions

SQL Server does **not** support independent nested transactions.

* `ROLLBACK` rolls back the entire transaction unless a SAVEPOINT is used.
* Only the outermost `COMMIT` finalizes the transaction.

---

## Fact vs Dimension Tables

**Fact Table**

* Numeric metrics
* Large datasets
* Contains foreign keys

**Dimension Table**

* Descriptive attributes
* Smaller tables
* Contains primary keys

---

## Nested Triggers

A nested trigger occurs when one trigger causes another trigger to fire through cascading DML operations.

---

## Cursors

Cursor types:

* STATIC
* DYNAMIC
* KEYSET
* FAST_FORWARD (optimized forward-only)

Prefer **set-based operations** over cursors whenever possible.

---

## Stored Procedures

* Execution plan cached
* Can modify data
* Supports transactions
* Supports TRY...CATCH

---

## Views

* Virtual tables
* No storage unless indexed view
* Used for abstraction and security

---

## Index Overview

* Uses B-tree structure
* Improves read performance
* Slows write operations
* Requires maintenance

---

## Triggers

Types:

* AFTER
* INSTEAD OF

Use `inserted` and `deleted` pseudo tables properly.

---

## Functions

Types:

* Scalar Function
* Inline Table-Valued Function (preferred)
* Multi-statement Table-Valued Function

Scalar UDF performance improved starting SQL Server 2019 via inlining.

---

## Stored Procedure vs Function

| Feature        | Stored Procedure | Function                    |
| -------------- | ---------------- | --------------------------- |
| Returns value  | Optional         | Mandatory                   |
| Used in SELECT | No               | Yes                         |
| Modifies data  | Yes              | No (direct DML not allowed) |
| Transactions   | Yes              | Limited                     |

---

## CHAR vs VARCHAR vs NVARCHAR

* `CHAR(n)` — Fixed length, non-Unicode
* `VARCHAR(n)` — Variable length, non-Unicode
* `NCHAR(n)` — Fixed length, Unicode
* `NVARCHAR(n)` — Variable length, Unicode

Unicode supports **all languages**, including English.

---

## Function vs Stored Procedure (Performance)

* Both use cached execution plans.
* Scalar UDFs may degrade performance.
* Stored procedures are typically better for complex logic.

---

## AFTER vs INSTEAD OF Trigger

* AFTER — Executes after DML completes
* INSTEAD OF — Replaces the DML operation

---

## View vs CTE

| Feature        | View               | CTE           |
| -------------- | ------------------ | ------------- |
| Stored in DB   | Yes                | No            |
| Scope          | Persistent         | Single query  |
| Reusable       | Yes                | No            |
| Performance    | Same as query      | Same as query |
| Indexed option | Yes (Indexed View) | No            |

---