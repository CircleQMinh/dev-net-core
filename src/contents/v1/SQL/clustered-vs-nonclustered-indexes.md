---
id: clustered-vs-nonclustered-indexes
topic: Indexes, statistics, and execution plans
subtopic: Clustered vs nonclustered indexes
category: SQL
---

## Overview

Clustered and nonclustered indexes are two core SQL Server rowstore index types. Both help the optimizer find rows more efficiently, but they store and locate data differently. A clustered index defines the logical order of the table's data rows. A nonclustered index is a separate structure that stores index key values plus row locators that point back to the base table.

This difference matters because clustered index choice affects every nonclustered index on the table, range-query performance, insert patterns, storage, fragmentation, and update cost. Nonclustered indexes are more flexible and can be created for many query patterns, but each one adds storage and write overhead.

Interviewers use this topic to test whether candidates understand physical data access rather than just SQL syntax. A strong answer explains not only "one clustered, many nonclustered," but also why clustered keys should usually be narrow, unique, stable, and aligned with important access patterns.

For interviews, you should be able to describe heaps, clustered tables, row locators, key lookups, covering indexes, and how the optimizer chooses between scans, seeks, and lookups.

## Core Concepts

### What An Index Does

An index is a data structure that helps SQL Server find rows without scanning every row in a table.

Example table:

```sql
CREATE TABLE dbo.Orders
(
    OrderId BIGINT IDENTITY(1, 1) NOT NULL,
    CustomerId BIGINT NOT NULL,
    OrderDate DATETIME2 NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    TotalAmount DECIMAL(19, 4) NOT NULL
);
```

Without a useful index, a query may need to scan the whole table:

```sql
SELECT OrderId, OrderDate, TotalAmount
FROM dbo.Orders
WHERE CustomerId = 42;
```

With an index on `CustomerId`, SQL Server can seek to the matching key range instead of reading every row.

### Clustered Index

A clustered index sorts and stores the table rows based on the clustered index key. There can be only one clustered index per table because the data rows can only be stored in one logical order.

Example:

```sql
CREATE CLUSTERED INDEX CX_Orders_OrderId
ON dbo.Orders (OrderId);
```

After this, `dbo.Orders` is a clustered table. The leaf level of the clustered index contains the full data rows.

Common clustered index choices:

- Identity primary key such as `OrderId`.
- Date plus identity key for time-series workloads.
- Tenant plus identity key for some multi-tenant workloads.
- Natural key only when it is narrow, stable, and truly unique.

### Nonclustered Index

A nonclustered index is a separate structure from the base table. It stores key values in sorted order and row locators that point to the actual row.

Example:

```sql
CREATE NONCLUSTERED INDEX IX_Orders_Customer_OrderDate
ON dbo.Orders (CustomerId, OrderDate DESC);
```

This index helps queries that search by customer and order by date:

```sql
SELECT OrderId, OrderDate, TotalAmount
FROM dbo.Orders
WHERE CustomerId = @CustomerId
ORDER BY OrderDate DESC;
```

Unlike a clustered index, a table can have many nonclustered indexes. That flexibility is useful, but every additional index must be maintained when data changes.

### Heap

A heap is a table without a clustered index. Its data rows are not stored in clustered key order.

Example:

```sql
CREATE TABLE dbo.ImportRows
(
    ImportRowId BIGINT IDENTITY(1, 1) NOT NULL,
    BatchId BIGINT NOT NULL,
    RawPayload NVARCHAR(MAX) NOT NULL
);
```

If no clustered index is created, this table is a heap.

Heaps can be useful for some staging or bulk-load scenarios, but many OLTP tables benefit from a clustered index because it provides stable row organization and efficient row locators for nonclustered indexes.

### Row Locators

The row locator in a nonclustered index tells SQL Server how to find the base row.

For a heap:

- The row locator points to the physical row location.

For a clustered table:

- The row locator is the clustered index key.

This is why clustered key design matters. The clustered key is carried in nonclustered indexes. A wide clustered key can make every nonclustered index wider and more expensive.

### Clustered Key Design

A good clustered key is usually:

- Narrow.
- Unique.
- Stable.
- Ever-increasing or mostly insert-friendly.
- Frequently useful for access patterns.

Example:

```sql
CREATE TABLE dbo.Orders
(
    OrderId BIGINT IDENTITY(1, 1) NOT NULL,
    CustomerId BIGINT NOT NULL,
    OrderDate DATETIME2 NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    TotalAmount DECIMAL(19, 4) NOT NULL,
    CONSTRAINT PK_Orders PRIMARY KEY CLUSTERED (OrderId)
);
```

`OrderId` is narrow, unique, and stable. It is usually a reasonable clustered key.

Less ideal clustered key:

```sql
CREATE CLUSTERED INDEX CX_Users_Email
ON dbo.Users (Email);
```

`Email` can be long, can change, and may make nonclustered indexes wider. It might be a good unique nonclustered index, but it is often a poor clustered key.

### Primary Key Vs Clustered Index

A primary key is a constraint. A clustered index is a storage/access structure. They are often created together, but they are not the same thing.

Example:

```sql
CREATE TABLE dbo.Users
(
    UserId BIGINT IDENTITY(1, 1) NOT NULL,
    Email NVARCHAR(320) NOT NULL,
    CONSTRAINT PK_Users PRIMARY KEY NONCLUSTERED (UserId)
);

CREATE CLUSTERED INDEX CX_Users_UserId
ON dbo.Users (UserId);
```

SQL Server often creates a clustered index for a primary key by default unless told otherwise, but a primary key can be nonclustered and a clustered index can be created on different columns.

### Index Seek Vs Index Scan

An index seek navigates directly to a key or key range.

Example:

```sql
SELECT OrderId, CustomerId, OrderDate
FROM dbo.Orders
WHERE OrderId = @OrderId;
```

With a clustered index on `OrderId`, this can become a clustered index seek.

An index scan reads a larger portion of an index or the entire index.

Example:

```sql
SELECT OrderId, CustomerId, OrderDate
FROM dbo.Orders
WHERE YEAR(OrderDate) = 2026;
```

Applying a function to `OrderDate` can make a normal index on `OrderDate` less useful for seeking. A sargable range is usually better:

```sql
WHERE OrderDate >= '20260101'
  AND OrderDate < '20270101';
```

### Key Lookup

A key lookup happens when SQL Server uses a nonclustered index to find matching keys, then looks up missing columns from the clustered index.

Example index:

```sql
CREATE INDEX IX_Orders_CustomerId
ON dbo.Orders (CustomerId);
```

Query:

```sql
SELECT OrderId, CustomerId, OrderDate, TotalAmount
FROM dbo.Orders
WHERE CustomerId = @CustomerId;
```

If `OrderDate` and `TotalAmount` are not in the nonclustered index, SQL Server may seek `IX_Orders_CustomerId` and then perform key lookups to fetch missing columns from the clustered index.

Key lookups are not automatically bad. They are fine for small result sets. They become expensive when many rows require many lookups.

### Covering Nonclustered Index

A covering index contains all columns needed by a query, either as key columns or included columns.

Example:

```sql
CREATE INDEX IX_Orders_Customer_OrderDate
ON dbo.Orders (CustomerId, OrderDate DESC)
INCLUDE (TotalAmount, Status);
```

This can cover:

```sql
SELECT OrderDate, Status, TotalAmount
FROM dbo.Orders
WHERE CustomerId = @CustomerId
ORDER BY OrderDate DESC;
```

The query can be satisfied directly from the nonclustered index without looking up the base row.

### Clustered Index Range Queries

Clustered indexes are strong for range queries that align with the clustered key.

Example:

```sql
CREATE CLUSTERED INDEX CX_OrderEvents_EventTime_EventId
ON dbo.OrderEvents (EventTime, OrderEventId);
```

Query:

```sql
SELECT *
FROM dbo.OrderEvents
WHERE EventTime >= @StartTime
  AND EventTime < @EndTime
ORDER BY EventTime, OrderEventId;
```

The clustered order supports the date range and output ordering. The trade-off is that inserts may concentrate on the latest page if data is always inserted by current time.

### Insert And Update Costs

Indexes speed reads but slow writes.

When a row is inserted:

- The clustered index is updated.
- Every relevant nonclustered index is updated.
- Page splits can occur if inserts land in the middle of an index.

When indexed columns are updated:

- SQL Server may need to move entries within one or more indexes.
- If the clustered key changes, every nonclustered index row locator can be affected.

That is why stable clustered keys matter.

### Clustered Index Width And Nonclustered Indexes

Because a clustered key is used as the row locator in nonclustered indexes, clustered key width affects storage and memory use across the table's indexes.

Problematic pattern:

```sql
CREATE CLUSTERED INDEX CX_Documents_Tenant_Slug_Title
ON dbo.Documents (TenantId, Slug, Title);
```

This clustered key may be wide, and `Title` can change.

Often better:

```sql
CREATE TABLE dbo.Documents
(
    DocumentId BIGINT IDENTITY(1, 1) NOT NULL,
    TenantId INT NOT NULL,
    Slug NVARCHAR(200) NOT NULL,
    Title NVARCHAR(300) NOT NULL,
    CONSTRAINT PK_Documents PRIMARY KEY CLUSTERED (DocumentId),
    CONSTRAINT UX_Documents_Tenant_Slug UNIQUE (TenantId, Slug)
);
```

The clustered key is narrow and stable. The business uniqueness rule is enforced separately.

### Common Mistakes

Common mistakes include:

- Thinking primary key and clustered index always mean the same thing.
- Creating a clustered index on a wide, mutable natural key.
- Creating many nonclustered indexes without considering write cost.
- Ignoring key lookups that happen for many rows.
- Assuming every index seek is good and every scan is bad.
- Creating duplicate or overlapping indexes.
- Forgetting that nonclustered indexes on clustered tables contain the clustered key.
- Indexing tiny tables without measuring benefit.
- Letting missing-index suggestions create overly broad indexes.

### Best Practices

Best practices:

- Use a clustered index on most OLTP tables unless a heap is intentional.
- Prefer narrow, unique, stable clustered keys.
- Keep nonclustered indexes targeted to real query patterns.
- Use included columns to cover important queries without widening key columns.
- Watch for key lookups that run once per many rows.
- Do not create indexes speculatively.
- Review index usage and remove redundant or unused indexes.
- Test index changes against representative read and write workloads.
- Consider filtered indexes for well-defined subsets.
- Read execution plans to verify how indexes are actually used.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is a clustered index?

<!-- question:start:clustered-vs-nonclustered-indexes-beginner-q01 -->
<!-- question-id:clustered-vs-nonclustered-indexes-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A clustered index defines the logical order in which the table's data rows are stored. The leaf level of the clustered index contains the actual data rows. Because the table rows can only be ordered one way, a table can have only one clustered index.

Clustered indexes are commonly created on primary keys, but a primary key and a clustered index are not the same concept.

##### Key Points to Mention

- Stores the data rows at the leaf level.
- Defines table row order.
- Only one per table.
- Often but not always tied to the primary key.
- Clustered key choice affects nonclustered indexes.

<!-- question:end:clustered-vs-nonclustered-indexes-beginner-q01 -->

#### What is a nonclustered index?

<!-- question:start:clustered-vs-nonclustered-indexes-beginner-q02 -->
<!-- question-id:clustered-vs-nonclustered-indexes-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

A nonclustered index is a separate structure from the table's data rows. It stores index key values and row locators that point to the base row. A table can have multiple nonclustered indexes for different query patterns.

Nonclustered indexes are useful for filtering, joining, sorting, and covering queries, but they add storage and write maintenance cost.

##### Key Points to Mention

- Separate from the base data.
- Stores keys plus row locators.
- Many can exist on one table.
- Helps specific query patterns.
- Adds write and storage overhead.

<!-- question:end:clustered-vs-nonclustered-indexes-beginner-q02 -->

#### Can a table have both a clustered index and nonclustered indexes?

<!-- question:start:clustered-vs-nonclustered-indexes-beginner-q03 -->
<!-- question-id:clustered-vs-nonclustered-indexes-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

Yes. A table can have one clustered index and multiple nonclustered indexes. The clustered index stores the table rows, while nonclustered indexes provide additional access paths for other query patterns.

On a clustered table, nonclustered indexes use the clustered key as the row locator, which is why clustered key width and stability matter.

##### Key Points to Mention

- One clustered index.
- Multiple nonclustered indexes.
- Nonclustered indexes support different predicates and sorts.
- Clustered key is used as row locator on clustered tables.
- More indexes mean more write maintenance.

<!-- question:end:clustered-vs-nonclustered-indexes-beginner-q03 -->

#### What is a heap?

<!-- question:start:clustered-vs-nonclustered-indexes-beginner-q04 -->
<!-- question-id:clustered-vs-nonclustered-indexes-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

A heap is a table without a clustered index. Its rows are not stored in clustered key order. Heaps can be useful for some staging or bulk-loading scenarios, but many application tables benefit from a clustered index for organization and predictable row locators.

Heaps are not automatically bad, but they should usually be intentional.

##### Key Points to Mention

- A table without a clustered index.
- Rows are unordered.
- Can be useful for staging.
- Often less ideal for OLTP tables.
- Should be a deliberate design choice.

<!-- question:end:clustered-vs-nonclustered-indexes-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### Why should clustered index keys usually be narrow and stable?

<!-- question:start:clustered-vs-nonclustered-indexes-intermediate-q01 -->
<!-- question-id:clustered-vs-nonclustered-indexes-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

On a clustered table, the clustered key is stored in nonclustered indexes as the row locator. If the clustered key is wide, nonclustered indexes become wider, increasing storage, memory, and I/O. If the clustered key changes, SQL Server may need to update related index entries.

A narrow, stable clustered key reduces overhead across the table's index set.

##### Key Points to Mention

- Clustered key appears in nonclustered indexes.
- Wide keys increase index size.
- Mutable keys increase update cost.
- Narrow keys improve page density.
- Stable keys reduce maintenance overhead.

<!-- question:end:clustered-vs-nonclustered-indexes-intermediate-q01 -->

#### What is a key lookup?

<!-- question:start:clustered-vs-nonclustered-indexes-intermediate-q02 -->
<!-- question-id:clustered-vs-nonclustered-indexes-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

A key lookup happens when SQL Server uses a nonclustered index to find matching rows but needs additional columns that are not in that index. It then uses the clustered key to look up the full row in the clustered index.

Key lookups are fine for small result sets. They become expensive when many rows require lookups.

##### Key Points to Mention

- Happens after a nonclustered index access.
- Fetches missing columns from the clustered index.
- Uses the clustered key as row locator.
- Can be acceptable for few rows.
- Can be expensive for many rows.

<!-- question:end:clustered-vs-nonclustered-indexes-intermediate-q02 -->

#### Is an index seek always better than an index scan?

<!-- question:start:clustered-vs-nonclustered-indexes-intermediate-q03 -->
<!-- question-id:clustered-vs-nonclustered-indexes-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

No. An index seek is often good when the query needs a small selective range, but a scan can be better when the query needs a large percentage of rows or when scanning a narrow index is cheaper than many random lookups.

Performance depends on row counts, selectivity, indexes, statistics, and the overall plan. Do not judge by operator name alone.

##### Key Points to Mention

- Seeks are not automatically best.
- Scans can be efficient for large result sets.
- A narrow index scan may be cheaper than table access.
- Key lookups can make seeks expensive.
- Actual plans and metrics matter.

<!-- question:end:clustered-vs-nonclustered-indexes-intermediate-q03 -->

#### How is a primary key different from a clustered index?

<!-- question:start:clustered-vs-nonclustered-indexes-intermediate-q04 -->
<!-- question-id:clustered-vs-nonclustered-indexes-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

A primary key is a constraint that enforces entity identity and uniqueness. A clustered index is a storage and access structure that orders table rows. SQL Server often creates a clustered index for a primary key by default, but the primary key can be nonclustered, and the clustered index can be created on another key.

Good schema design separates logical identity from physical access choices when needed.

##### Key Points to Mention

- Primary key is a constraint.
- Clustered index is a storage/access structure.
- They are often but not always combined.
- Primary key can be nonclustered.
- Clustered index can use another key.

<!-- question:end:clustered-vs-nonclustered-indexes-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you choose a clustered index for an Orders table?

<!-- question:start:clustered-vs-nonclustered-indexes-advanced-q01 -->
<!-- question-id:clustered-vs-nonclustered-indexes-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Start with the workload. For a typical OLTP `Orders` table, a narrow identity `OrderId` clustered primary key is often reasonable because it is unique, stable, narrow, and insert-friendly. If the workload is dominated by date-range queries, a clustered key involving `OrderDate` might be considered, but it must handle uniqueness, insert hot spots, and nonclustered index width.

The final decision should consider query patterns, insert/update behavior, partitioning, foreign keys, and nonclustered index impact.

##### Key Points to Mention

- Workload drives the decision.
- Narrow identity keys are common for OLTP.
- Date-range clustering can help reporting workloads.
- Clustered key affects all nonclustered indexes.
- Test read and write patterns.

<!-- question:end:clustered-vs-nonclustered-indexes-advanced-q01 -->

#### How do nonclustered indexes affect writes?

<!-- question:start:clustered-vs-nonclustered-indexes-advanced-q02 -->
<!-- question-id:clustered-vs-nonclustered-indexes-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Every insert, delete, or relevant update may need to maintain each nonclustered index. This adds logging, CPU, I/O, memory pressure, potential page splits, and concurrency overhead. Indexes that improve reads can slow write-heavy workloads.

That is why indexes should be based on important query patterns and monitored for usage rather than created speculatively.

##### Key Points to Mention

- Writes maintain every affected index.
- More indexes mean more logging and I/O.
- Updates to indexed columns are more expensive.
- Over-indexing can hurt OLTP throughput.
- Monitor and remove unused indexes.

<!-- question:end:clustered-vs-nonclustered-indexes-advanced-q02 -->

#### How would you investigate whether a nonclustered index should include more columns?

<!-- question:start:clustered-vs-nonclustered-indexes-advanced-q03 -->
<!-- question-id:clustered-vs-nonclustered-indexes-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Review the actual execution plan and look for key lookups, number of lookup executions, row counts, and cost relative to the query. If the lookup happens for many rows and the query is important, consider adding included columns to cover the query.

Do not blindly include every selected column. Check index width, write overhead, storage, memory use, and whether a different query or index design would be better.

##### Key Points to Mention

- Look for key lookups in the actual plan.
- Check how many rows are looked up.
- Include columns can cover the query.
- Wider indexes increase maintenance cost.
- Tune for important workload queries.

<!-- question:end:clustered-vs-nonclustered-indexes-advanced-q03 -->

#### What are signs of a poor clustered index choice?

<!-- question:start:clustered-vs-nonclustered-indexes-advanced-q04 -->
<!-- question-id:clustered-vs-nonclustered-indexes-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

Signs include a wide clustered key, a key that changes frequently, non-unique keys requiring hidden uniquifiers, random insert patterns causing fragmentation and page splits, and poor alignment with important range queries. Another sign is that all nonclustered indexes are large because the clustered key is large.

Fixing clustered index choice can be disruptive, so it should be planned carefully and validated against the workload.

##### Key Points to Mention

- Wide key.
- Mutable key.
- Non-unique key.
- Random insert pattern.
- Large nonclustered indexes.
- Poor fit for key workload access paths.

<!-- question:end:clustered-vs-nonclustered-indexes-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
