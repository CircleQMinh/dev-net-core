---
id: selectivity-covering-indexes-and-index-maintenance-trade-offs
topic: Indexes, statistics, and execution plans
subtopic: Selectivity, covering indexes, and index maintenance trade-offs
category: SQL
---

## Overview

Selectivity describes how well a predicate narrows a query to a smaller set of rows. A highly selective predicate returns a small percentage of the table, such as one customer by `CustomerId`. A low-selectivity predicate returns many rows, such as `IsActive = 1` when almost every row is active.

Covering indexes are indexes that contain every column needed by a query, so SQL Server can satisfy the query from the index without returning to the base table. Covering can be powerful, but every extra key or included column increases storage, memory, I/O, and write-maintenance cost.

This topic matters because indexing is a balancing act. Good indexes make important reads fast. Too many or too-wide indexes slow inserts, updates, deletes, and merges. Interviewers expect candidates to explain not only how to create an index, but how to decide whether an index is worth its cost.

For interviews, strong candidates can discuss selectivity, SARGability, key column order, included columns, filtered indexes, key lookups, write overhead, index fragmentation, statistics, and workload-based tuning.

## Core Concepts

### Selectivity

Selectivity measures how much a predicate filters data.

Highly selective:

```sql
WHERE OrderId = 12345
```

This likely returns one row.

Low selectivity:

```sql
WHERE IsActive = 1
```

If 98 percent of rows are active, this predicate does not narrow the table much.

High selectivity usually makes an index more valuable because SQL Server can seek to a small set of rows. Low selectivity may still use an index, but a scan may be cheaper when many rows are needed.

### Cardinality Vs Selectivity

Cardinality is a count. Selectivity is a fraction or degree of filtering.

Example table:

```text
Rows: 10,000,000
Rows where Status = 'Cancelled': 50,000
```

The predicate cardinality is 50,000 rows. The selectivity is 0.5 percent.

SQL Server uses statistics to estimate cardinality, and those estimates influence whether it chooses a seek, scan, join type, memory grant, and parallelism strategy.

### SARGable Predicates

A SARGable predicate can use an index search argument efficiently.

Good:

```sql
WHERE OrderDate >= @StartDate
  AND OrderDate < @EndDate
```

Poor:

```sql
WHERE CAST(OrderDate AS DATE) = @ReportDate
```

The second query applies a function to the column, making it harder to seek on a normal index on `OrderDate`.

Index design and query design work together. A good index cannot fully compensate for predicates that hide searchable values behind functions, implicit conversions, or non-sargable expressions.

### Key Column Order

Column order in a composite index matters.

Example:

```sql
CREATE INDEX IX_Orders_Customer_OrderDate
ON dbo.Orders (CustomerId, OrderDate DESC);
```

This index helps:

```sql
WHERE CustomerId = @CustomerId
ORDER BY OrderDate DESC;
```

It is less helpful for:

```sql
WHERE OrderDate >= @StartDate
  AND OrderDate < @EndDate;
```

because `OrderDate` is not the leading key.

General guideline:

- Put equality predicates early.
- Then range predicates.
- Then ordering/grouping columns when useful.
- Keep keys narrow.
- Use included columns for output columns that are not needed for seeking or sorting.

### Covering Index

A covering index contains all columns needed by a query.

Example query:

```sql
SELECT
    OrderDate,
    Status,
    TotalAmount
FROM dbo.Orders
WHERE CustomerId = @CustomerId
ORDER BY OrderDate DESC;
```

Covering index:

```sql
CREATE INDEX IX_Orders_Customer_OrderDate
ON dbo.Orders (CustomerId, OrderDate DESC)
INCLUDE (Status, TotalAmount);
```

The key columns support filtering and ordering. The included columns satisfy the `SELECT` list without increasing the key size.

### Key Columns Vs Included Columns

Key columns are part of the sorted index key. They can support seeks, range scans, joins, grouping, and ordering.

Included columns are stored at the leaf level of a nonclustered index. They are not part of the sorted key, but they can cover query output and avoid lookups.

Example:

```sql
CREATE INDEX IX_Users_Tenant_Email
ON dbo.Users (TenantId, Email)
INCLUDE (DisplayName, Status, LastLoginAt);
```

`TenantId` and `Email` are key columns because they support search. `DisplayName`, `Status`, and `LastLoginAt` are included because the query needs to return them.

Interview rule: key columns are for access and order. Included columns are for coverage.

### Key Lookups And Covering Trade-Offs

A key lookup is not automatically a problem.

Example:

```sql
SELECT Email, DisplayName, LastLoginAt
FROM dbo.Users
WHERE TenantId = @TenantId
  AND Email = @Email;
```

If this returns one row, a key lookup to fetch `DisplayName` and `LastLoginAt` may be fine.

For this query:

```sql
SELECT Email, DisplayName, LastLoginAt
FROM dbo.Users
WHERE TenantId = @TenantId
  AND Status = N'Active';
```

If it returns 200,000 rows, one lookup per row can be painful. A covering index may help, but it increases write cost and index size.

### Filtered Indexes

A filtered index stores only a subset of rows.

Example:

```sql
CREATE INDEX IX_Orders_Open_ByCustomer
ON dbo.Orders (CustomerId, OrderDate)
INCLUDE (TotalAmount)
WHERE Status = N'Open';
```

This can be useful when queries frequently target a small, well-defined subset of a large table.

Filtered indexes can:

- Reduce storage.
- Reduce maintenance cost compared with a full-table index.
- Improve selectivity.
- Provide filtered statistics for the subset.

They require query predicates to match the filter closely enough for the optimizer to use them.

### Index Maintenance Cost

Indexes are maintained automatically as table data changes.

Costs include:

- Additional storage.
- Additional logging.
- More work during `INSERT`, `UPDATE`, `DELETE`, and `MERGE`.
- More memory and buffer pool usage.
- Page splits and fragmentation.
- Longer maintenance windows for rebuilds or reorganizations.
- Potential concurrency overhead.

Example:

```sql
UPDATE dbo.Users
SET Email = @NewEmail
WHERE UserId = @UserId;
```

If `Email` appears in three nonclustered indexes, all three may need maintenance.

### Read-Heavy Vs Write-Heavy Workloads

Index choices should reflect the workload.

Read-heavy reporting table:

- More indexes may be acceptable.
- Covering indexes can be valuable.
- Columnstore indexes may be considered for analytics.

Write-heavy OLTP table:

- Fewer, narrower indexes are usually better.
- Indexes should support the most critical queries.
- Over-indexing can reduce throughput.

There is no universal best index. There is only a best index for a workload and set of trade-offs.

### Duplicate And Overlapping Indexes

Duplicate indexes waste resources.

Example:

```sql
CREATE INDEX IX_Orders_CustomerId
ON dbo.Orders (CustomerId);

CREATE INDEX IX_Orders_CustomerId_OrderDate
ON dbo.Orders (CustomerId, OrderDate);
```

The second index may make the first one redundant, depending on workload and included columns.

Before creating a new index:

- Check existing indexes.
- Check whether an existing index can be modified.
- Check usage DMVs.
- Check actual plans.
- Avoid blindly accepting missing-index suggestions.

### Index Maintenance Operations

Maintenance can include:

- Rebuilding indexes.
- Reorganizing indexes.
- Updating statistics.
- Dropping unused indexes.
- Adjusting fill factor for some write patterns.
- Monitoring fragmentation and page density.

Index rebuilds can update index statistics as a byproduct. Reorganizing an index does not update statistics in the same way. Do not assume every maintenance command solves every optimizer problem.

Index maintenance should be targeted. Rebuilding everything every night can waste resources and may not improve performance.

### Measuring Index Value

Useful evidence:

- Actual execution plans.
- Query duration, CPU, reads, and writes.
- Query Store data.
- `sys.dm_db_index_usage_stats`.
- `sys.dm_db_index_operational_stats`.
- Waits and blocking patterns.
- Workload replay or representative load tests.

Do not create an index just because a single plan suggests it. Consider how often the query runs, how expensive it is, and what write cost the index adds.

### Common Mistakes

Common mistakes include:

- Indexing low-selectivity columns alone and expecting major improvement.
- Creating one index per query without considering overlap.
- Adding every selected column as an included column.
- Treating missing-index suggestions as complete designs.
- Ignoring write overhead.
- Ignoring key column order.
- Adding indexes to fix non-sargable predicates instead of rewriting the query.
- Forgetting filtered indexes for narrow subsets.
- Not checking whether an index is actually used.
- Rebuilding indexes frequently without measuring benefit.

### Best Practices

Best practices:

- Start with important workload queries, not isolated guesses.
- Make predicates SARGable before adding indexes.
- Use high-selectivity columns and common join/filter columns in keys.
- Put equality columns before range columns when appropriate.
- Use included columns to cover targeted queries without widening keys.
- Prefer narrow indexes on write-heavy tables.
- Consider filtered indexes for common subsets.
- Review overlapping and unused indexes.
- Validate with actual execution plans and runtime metrics.
- Treat index design as ongoing workload maintenance.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is selectivity?

<!-- question:start:selectivity-covering-indexes-and-index-maintenance-trade-offs-beginner-q01 -->
<!-- question-id:selectivity-covering-indexes-and-index-maintenance-trade-offs-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

Selectivity describes how much a predicate narrows the data. A highly selective predicate returns a small percentage of rows, while a low-selectivity predicate returns many rows. Indexes are often more useful for highly selective predicates because the optimizer can seek to a small row set.

For example, `OrderId = 123` is usually highly selective. `IsActive = 1` may be low selectivity if most rows are active.

##### Key Points to Mention

- Measures filtering power.
- High selectivity returns few rows.
- Low selectivity returns many rows.
- High selectivity often makes indexes more useful.
- Data distribution matters.

<!-- question:end:selectivity-covering-indexes-and-index-maintenance-trade-offs-beginner-q01 -->

#### What is a covering index?

<!-- question:start:selectivity-covering-indexes-and-index-maintenance-trade-offs-beginner-q02 -->
<!-- question-id:selectivity-covering-indexes-and-index-maintenance-trade-offs-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

A covering index is an index that contains all columns needed by a query. The query can be satisfied from the index without reading the base table or clustered index for missing columns.

Covering indexes can reduce I/O, but they make indexes wider and more expensive to maintain.

##### Key Points to Mention

- Contains all columns needed by the query.
- Uses key and included columns.
- Avoids key lookups.
- Can reduce I/O.
- Adds storage and write cost.

<!-- question:end:selectivity-covering-indexes-and-index-maintenance-trade-offs-beginner-q02 -->

#### What are included columns?

<!-- question:start:selectivity-covering-indexes-and-index-maintenance-trade-offs-beginner-q03 -->
<!-- question-id:selectivity-covering-indexes-and-index-maintenance-trade-offs-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

Included columns are nonkey columns stored at the leaf level of a nonclustered index. They are not part of the sorted key, but they can cover a query by providing columns needed in the output.

Use included columns for values that the query returns but does not need for seeking, joining, or ordering.

##### Key Points to Mention

- Nonkey columns in a nonclustered index.
- Stored at the leaf level.
- Help cover queries.
- Do not affect key column order.
- Still add storage and maintenance cost.

<!-- question:end:selectivity-covering-indexes-and-index-maintenance-trade-offs-beginner-q03 -->

#### Why do indexes slow down writes?

<!-- question:start:selectivity-covering-indexes-and-index-maintenance-trade-offs-beginner-q04 -->
<!-- question-id:selectivity-covering-indexes-and-index-maintenance-trade-offs-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Indexes slow down writes because SQL Server must maintain each affected index when rows are inserted, updated, deleted, or merged. More indexes mean more pages to update, more logging, more storage, and sometimes more locking or page splits.

Indexes are a read optimization with write costs.

##### Key Points to Mention

- Inserts update indexes.
- Deletes remove index entries.
- Updates may change index keys or included values.
- More indexes mean more maintenance.
- Write-heavy tables need narrow targeted indexes.

<!-- question:end:selectivity-covering-indexes-and-index-maintenance-trade-offs-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### How do key columns differ from included columns?

<!-- question:start:selectivity-covering-indexes-and-index-maintenance-trade-offs-intermediate-q01 -->
<!-- question-id:selectivity-covering-indexes-and-index-maintenance-trade-offs-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

Key columns are part of the sorted index key and can support seeking, range scans, joins, grouping, and ordering. Included columns are stored only at the leaf level and are mainly used to cover the query output.

A good index keeps key columns focused on access and order, then uses included columns for extra output values when coverage is worth the cost.

##### Key Points to Mention

- Key columns define index order.
- Key columns support seeks and sort order.
- Included columns cover output.
- Included columns do not define seek order.
- Both increase index size.

<!-- question:end:selectivity-covering-indexes-and-index-maintenance-trade-offs-intermediate-q01 -->

#### Why is indexing a low-selectivity column often ineffective?

<!-- question:start:selectivity-covering-indexes-and-index-maintenance-trade-offs-intermediate-q02 -->
<!-- question-id:selectivity-covering-indexes-and-index-maintenance-trade-offs-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

If a column has very few distinct values and a predicate returns a large percentage of the table, an index on that column alone may not reduce enough work. SQL Server may choose a scan because reading many rows through the index plus lookups can cost more than scanning the table or a wider index.

Low-selectivity columns can still be useful in composite or filtered indexes when paired with more selective predicates or a narrow filtered subset.

##### Key Points to Mention

- Low selectivity returns many rows.
- Scans can be cheaper for large result sets.
- Lookups can make the index path expensive.
- Composite indexes may still help.
- Filtered indexes can help narrow subsets.

<!-- question:end:selectivity-covering-indexes-and-index-maintenance-trade-offs-intermediate-q02 -->

#### How do you choose column order in a composite index?

<!-- question:start:selectivity-covering-indexes-and-index-maintenance-trade-offs-intermediate-q03 -->
<!-- question-id:selectivity-covering-indexes-and-index-maintenance-trade-offs-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Choose column order based on query predicates and required ordering. Equality columns commonly come first, followed by range columns, then columns useful for ordering or grouping. The order should support the most important queries, not just maximize distinctness mechanically.

The leading key matters because an index on `(CustomerId, OrderDate)` is not equivalent to `(OrderDate, CustomerId)`.

##### Key Points to Mention

- Workload predicates drive order.
- Equality columns often come before range columns.
- Ordering and grouping can influence design.
- Leading key is important.
- Avoid adding unnecessary key columns.

<!-- question:end:selectivity-covering-indexes-and-index-maintenance-trade-offs-intermediate-q03 -->

#### When would you use a filtered index?

<!-- question:start:selectivity-covering-indexes-and-index-maintenance-trade-offs-intermediate-q04 -->
<!-- question-id:selectivity-covering-indexes-and-index-maintenance-trade-offs-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Use a filtered index when queries repeatedly target a well-defined subset of a table, such as open orders, unprocessed messages, active subscriptions, or rows where a nullable column is not null. A filtered index can be smaller, cheaper to maintain, and more selective than a full-table index.

The query predicate must align with the filter for the optimizer to use it reliably.

##### Key Points to Mention

- Indexes a subset of rows.
- Good for common narrow filters.
- Smaller than full indexes.
- Can reduce maintenance cost.
- Query predicate must match the filter.

<!-- question:end:selectivity-covering-indexes-and-index-maintenance-trade-offs-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you decide whether a covering index is worth adding?

<!-- question:start:selectivity-covering-indexes-and-index-maintenance-trade-offs-advanced-q01 -->
<!-- question-id:selectivity-covering-indexes-and-index-maintenance-trade-offs-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Start with the query's importance, frequency, current runtime, reads, CPU, and execution plan. If the plan performs many key lookups or reads far more data than needed, a covering index may help. Then estimate the cost: added storage, write overhead, overlap with existing indexes, and maintenance impact.

The index is worth adding when measured read improvement for important workload queries outweighs write and operational cost.

##### Key Points to Mention

- Measure query frequency and cost.
- Look for many key lookups.
- Check reads and CPU.
- Compare with existing indexes.
- Account for write and storage cost.
- Validate after deployment.

<!-- question:end:selectivity-covering-indexes-and-index-maintenance-trade-offs-advanced-q01 -->

#### How should missing-index recommendations be used?

<!-- question:start:selectivity-covering-indexes-and-index-maintenance-trade-offs-advanced-q02 -->
<!-- question-id:selectivity-covering-indexes-and-index-maintenance-trade-offs-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Missing-index recommendations are starting points, not final designs. They often reflect one query and may suggest overlapping or too-wide indexes. Review the actual workload, existing indexes, key order, included columns, write cost, and whether a query rewrite would be better.

Before creating a suggested index, consolidate similar recommendations and test the change against representative workload data.

##### Key Points to Mention

- Treat as hints, not commands.
- Check existing indexes.
- Avoid duplicate or overlapping indexes.
- Consider write cost.
- Test with workload evidence.
- Query rewrite may be better.

<!-- question:end:selectivity-covering-indexes-and-index-maintenance-trade-offs-advanced-q02 -->

#### How do you tune indexes differently for OLTP and reporting workloads?

<!-- question:start:selectivity-covering-indexes-and-index-maintenance-trade-offs-advanced-q03 -->
<!-- question-id:selectivity-covering-indexes-and-index-maintenance-trade-offs-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

For OLTP, keep indexes narrow and targeted because writes are frequent and latency matters. Prioritize primary access paths, foreign-key joins, uniqueness, and critical lookups. For reporting, wider covering indexes, filtered indexes, columnstore indexes, or summary structures may be acceptable because reads dominate and queries scan or aggregate more data.

The tuning strategy should reflect the actual workload mix and service-level goals.

##### Key Points to Mention

- OLTP favors fewer narrow indexes.
- Reporting can tolerate more read-focused structures.
- Writes maintain every affected index.
- Columnstore may help analytics.
- Workload goals drive trade-offs.

<!-- question:end:selectivity-covering-indexes-and-index-maintenance-trade-offs-advanced-q03 -->

#### What is a practical process for index cleanup?

<!-- question:start:selectivity-covering-indexes-and-index-maintenance-trade-offs-advanced-q04 -->
<!-- question-id:selectivity-covering-indexes-and-index-maintenance-trade-offs-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

Inventory existing indexes, identify duplicates or heavy overlap, review usage and operational DMVs, check Query Store or workload history, and evaluate write-heavy tables carefully. Before dropping an index, verify whether it supports constraints, rare but critical reports, maintenance jobs, or foreign-key-related queries.

Drop or consolidate indexes gradually, monitor performance, and keep rollback scripts ready.

##### Key Points to Mention

- Inventory indexes.
- Find duplicate and overlapping definitions.
- Review usage and operational stats.
- Check critical but infrequent queries.
- Consolidate before adding new indexes.
- Monitor after changes.

<!-- question:end:selectivity-covering-indexes-and-index-maintenance-trade-offs-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
