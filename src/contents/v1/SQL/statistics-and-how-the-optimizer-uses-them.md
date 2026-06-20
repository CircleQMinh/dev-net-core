---
id: statistics-and-how-the-optimizer-uses-them
topic: Indexes, statistics, and execution plans
subtopic: Statistics and how the optimizer uses them
category: SQL
---

## Overview

Statistics are metadata objects that describe the distribution of values in one or more table or indexed-view columns. SQL Server's query optimizer uses statistics to estimate how many rows a query operator will process. Those cardinality estimates drive plan choices such as index seek versus scan, join order, join type, memory grant, aggregation strategy, and parallelism.

Good statistics do not guarantee a perfect plan, but poor or stale statistics are a common reason for bad plans. If the optimizer thinks a predicate will return 10 rows when it actually returns 10 million, it can choose a plan that looks cheap at compile time but performs badly at runtime.

This topic matters because many performance problems are not caused by missing indexes alone. They come from wrong row-count estimates, stale statistics after data changes, skewed data distributions, parameter sensitivity, correlated predicates, ascending keys, or predicates that make estimation hard.

For interviews, strong candidates can explain histograms, density, cardinality estimation, automatic statistics creation and updates, when manual updates help, and how to compare estimated rows with actual rows in execution plans.

## Core Concepts

### What Statistics Are

Statistics contain information about data distribution.

SQL Server can create statistics:

- Automatically on columns used in query predicates.
- Automatically for indexes.
- Manually with `CREATE STATISTICS`.
- As filtered statistics for a subset of rows.

Example:

```sql
CREATE STATISTICS ST_Orders_Status_OrderDate
ON dbo.Orders (Status, OrderDate);
```

Statistics are not indexes. They do not store row locators or speed data access directly. They help the optimizer choose a plan.

### Cardinality Estimation

Cardinality estimation predicts how many rows will flow through an operator.

Example:

```sql
SELECT OrderId, CustomerId, TotalAmount
FROM dbo.Orders
WHERE Status = N'Cancelled';
```

If statistics show that only 0.5 percent of orders are cancelled, the optimizer may choose an index seek. If most orders are cancelled, it may choose a scan.

Cardinality estimates influence:

- Access method.
- Join order.
- Join algorithm.
- Memory grants.
- Parallelism.
- Sort and hash strategy.
- Spool decisions.

### Histogram

A histogram describes value distribution for the first key column of a statistics object. SQL Server histograms have up to 200 steps.

Example:

```sql
DBCC SHOW_STATISTICS ('dbo.Orders', 'IX_Orders_OrderDate');
```

The histogram can help estimate predicates such as:

```sql
WHERE OrderDate >= @StartDate
  AND OrderDate < @EndDate;
```

Important detail: in multi-column statistics, the histogram is only on the first column. Additional columns contribute density information, but not full histograms.

### Density

Density describes uniqueness or correlation information for statistics columns. It helps estimate equality predicates and joins, especially for multi-column statistics.

Example:

```sql
CREATE STATISTICS ST_Orders_Tenant_Status
ON dbo.Orders (TenantId, Status);
```

This can help when queries filter by both tenant and status:

```sql
WHERE TenantId = @TenantId
  AND Status = N'Open';
```

However, statistics still may not fully capture complex correlation between columns. If one tenant has very different status distribution than another tenant, estimates may still be wrong.

### Auto Create Statistics

When automatic statistics creation is enabled, SQL Server can create statistics on columns used in predicates to help optimize queries.

Example:

```sql
SELECT *
FROM dbo.Orders
WHERE ExternalReference = @ExternalReference;
```

If no statistics exist on `ExternalReference`, SQL Server may create them automatically during compilation, depending on database settings and query conditions.

Auto-created statistics can help, but they are not a substitute for well-designed indexes. A statistic can tell the optimizer how many rows may qualify, but it does not provide a physical access path.

### Auto Update Statistics

Statistics become stale when data changes through inserts, updates, deletes, or merges. With automatic statistics updates enabled, SQL Server determines when statistics are out of date and updates them when needed.

Example scenario:

- A table had 1 million rows last month.
- A bulk import added 5 million new rows.
- Statistics still describe the old distribution.
- Queries against new values get poor estimates.

Manual update:

```sql
UPDATE STATISTICS dbo.Orders IX_Orders_OrderDate;
```

Or table-wide:

```sql
UPDATE STATISTICS dbo.Orders;
```

Do not update statistics constantly without reason. Updating statistics can cause recompilation and consumes resources.

### Synchronous Vs Asynchronous Statistics Updates

With synchronous statistics updates, a query may wait for stale statistics to update before compilation finishes. This can produce a better plan but increase compile latency.

With asynchronous statistics updates, a query can compile using existing stale statistics while SQL Server updates statistics in the background. Later queries can benefit from the updated statistics.

The choice is workload-dependent:

- Synchronous favors plan quality for the current query.
- Asynchronous favors avoiding compile-time waits.

Interview answer: know the trade-off and test in the workload rather than choosing by habit.

### Statistics And Indexes

Creating an index also creates statistics on the index key. Rebuilding an index recreates the index and updates the associated index statistics as part of that process.

However:

- Reorganizing an index does not update statistics the same way.
- Auto-created column statistics are separate from index statistics.
- Updating statistics does not rebuild indexes.
- Rebuilding indexes is not a complete substitute for targeted statistics strategy.

Index and statistics maintenance overlap, but they are not identical.

### Filtered Statistics

Filtered statistics describe a subset of rows.

Example:

```sql
CREATE STATISTICS ST_Orders_Open_OrderDate
ON dbo.Orders (OrderDate)
WHERE Status = N'Open';
```

This can help the optimizer estimate queries that target the filtered subset:

```sql
WHERE Status = N'Open'
  AND OrderDate >= @StartDate
  AND OrderDate < @EndDate;
```

Filtered statistics are useful when a subset has different distribution from the full table, such as active rows, unprocessed messages, or non-null optional columns.

### Ascending Key Problem

Ascending keys such as identity columns and increasing timestamps can cause estimate problems when new values appear beyond the histogram's known range.

Example:

```sql
SELECT *
FROM dbo.Orders
WHERE OrderDate >= DATEADD(hour, -1, SYSUTCDATETIME());
```

If many new rows arrived after the last statistics update, the histogram may not represent the newest values well. The optimizer can underestimate recent rows.

Possible mitigations:

- Let auto update statistics run.
- Manually update statistics after large loads.
- Use appropriate maintenance jobs.
- Consider filtered statistics for recent active subsets.
- Monitor actual versus estimated rows.

### Parameter Sensitivity

One query shape can need different plans for different parameter values.

Example:

```sql
CREATE PROCEDURE dbo.GetOrdersByStatus
    @Status NVARCHAR(30)
AS
BEGIN
    SELECT *
    FROM dbo.Orders
    WHERE Status = @Status;
END;
```

If `@Status = 'Cancelled'` returns very few rows but `@Status = 'Completed'` returns millions, one cached plan may not be good for both.

Statistics help estimate distribution, but plan reuse can still create parameter-sensitive performance. This is related to parameter sniffing and parameter-sensitive plan behavior.

### Estimated Rows Vs Actual Rows

Execution plans show estimated rows and actual rows.

Example plan symptom:

```text
Estimated rows: 1
Actual rows: 500000
```

This mismatch is a strong clue that the optimizer made decisions based on bad or incomplete cardinality estimates.

Possible causes:

- Stale statistics.
- Missing statistics.
- Skewed data.
- Correlated predicates.
- Table variables or temporary structures with poor estimates.
- Non-sargable predicates.
- Parameter sensitivity.
- Implicit conversions.

### Statistics Inspection

Useful commands and tools:

```sql
DBCC SHOW_STATISTICS ('dbo.Orders', 'IX_Orders_OrderDate');
```

```sql
SELECT
    s.name,
    sp.last_updated,
    sp.rows,
    sp.modification_counter
FROM sys.stats AS s
CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) AS sp
WHERE s.object_id = OBJECT_ID(N'dbo.Orders');
```

Execution plan XML can also show statistics used during optimization through optimizer statistics usage information.

### Common Mistakes

Common mistakes include:

- Assuming indexes and statistics are the same thing.
- Disabling auto update statistics without a strong maintenance replacement.
- Updating statistics too frequently and causing unnecessary recompiles.
- Rebuilding indexes and assuming all statistics are handled.
- Ignoring stale statistics after bulk loads.
- Ignoring ascending timestamp or identity patterns.
- Looking only at operator cost instead of estimated versus actual rows.
- Creating multi-column statistics with the wrong leading column.
- Assuming statistics perfectly understand correlated predicates.
- Blaming the optimizer before checking data distribution.

### Best Practices

Best practices:

- Keep automatic statistics creation and updates enabled unless there is a proven reason not to.
- Check estimated versus actual rows in actual execution plans.
- Update statistics after large data changes when auto thresholds are not enough.
- Use filtered statistics for important skewed subsets.
- Create multi-column statistics when correlated predicates matter.
- Avoid non-sargable predicates that make estimation and index use harder.
- Monitor statistics age and modification counts for critical tables.
- Understand parameter sensitivity before forcing hints.
- Use Query Store and actual plans to focus on real workload regressions.
- Treat statistics maintenance as workload-specific, not a universal nightly ritual.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What are SQL Server statistics?

<!-- question:start:statistics-and-how-the-optimizer-uses-them-beginner-q01 -->
<!-- question-id:statistics-and-how-the-optimizer-uses-them-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

Statistics are metadata objects that describe the distribution of values in one or more columns. SQL Server's query optimizer uses them to estimate how many rows a query will return or process.

Statistics help the optimizer choose indexes, joins, memory grants, and other plan details. They do not directly store data access paths like indexes do.

##### Key Points to Mention

- Describe value distribution.
- Used by the optimizer.
- Help estimate row counts.
- Different from indexes.
- Can be automatic or manually created.

<!-- question:end:statistics-and-how-the-optimizer-uses-them-beginner-q01 -->

#### What is cardinality estimation?

<!-- question:start:statistics-and-how-the-optimizer-uses-them-beginner-q02 -->
<!-- question-id:statistics-and-how-the-optimizer-uses-them-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

Cardinality estimation is the optimizer's prediction of how many rows will flow through a query operator or result. These estimates influence plan choices such as seek versus scan, join order, join type, memory grant, and parallelism.

Bad cardinality estimates can lead to poor execution plans.

##### Key Points to Mention

- Predicts row counts.
- Based largely on statistics.
- Influences plan choices.
- Bad estimates cause bad plans.
- Compare estimated rows with actual rows.

<!-- question:end:statistics-and-how-the-optimizer-uses-them-beginner-q02 -->

#### What is a histogram in SQL Server statistics?

<!-- question:start:statistics-and-how-the-optimizer-uses-them-beginner-q03 -->
<!-- question-id:statistics-and-how-the-optimizer-uses-them-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

A histogram describes the distribution of values for the first key column in a statistics object. SQL Server uses it to estimate how many rows match equality or range predicates on that column.

Histograms have a limited number of steps, so they summarize the data distribution rather than storing every value.

##### Key Points to Mention

- Describes value distribution.
- Built on the first statistics key column.
- Helps estimate equality and range predicates.
- Has limited steps.
- Can become stale as data changes.

<!-- question:end:statistics-and-how-the-optimizer-uses-them-beginner-q03 -->

#### Why do stale statistics matter?

<!-- question:start:statistics-and-how-the-optimizer-uses-them-beginner-q04 -->
<!-- question-id:statistics-and-how-the-optimizer-uses-them-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Stale statistics describe an old version of the data distribution. If many rows were inserted, updated, or deleted, the optimizer may estimate row counts incorrectly and choose a poor plan.

For example, stale statistics can cause the optimizer to choose a nested loops plan for a query that actually returns many rows.

##### Key Points to Mention

- Data changes can make statistics inaccurate.
- Bad statistics lead to bad row estimates.
- Bad estimates affect plan choices.
- Large loads often require attention.
- Auto update statistics usually helps.

<!-- question:end:statistics-and-how-the-optimizer-uses-them-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### How does the optimizer use statistics to choose a plan?

<!-- question:start:statistics-and-how-the-optimizer-uses-them-intermediate-q01 -->
<!-- question-id:statistics-and-how-the-optimizer-uses-them-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

The optimizer uses statistics to estimate cardinality for predicates, joins, grouping, and other operators. Those estimates feed the cost model. Based on estimated costs, the optimizer chooses access methods, join order, join algorithms, memory grants, and parallelism.

Accurate estimates usually give the optimizer a better chance of choosing an efficient plan.

##### Key Points to Mention

- Statistics estimate cardinality.
- Cardinality feeds the cost model.
- Cost model influences operator choices.
- Estimates affect memory grants.
- Estimates affect join order and join type.

<!-- question:end:statistics-and-how-the-optimizer-uses-them-intermediate-q01 -->

#### When should you manually update statistics?

<!-- question:start:statistics-and-how-the-optimizer-uses-them-intermediate-q02 -->
<!-- question-id:statistics-and-how-the-optimizer-uses-them-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Manual updates can help after large data loads, large deletes, major distribution changes, maintenance operations that change data distribution, or when important queries show poor estimates and stale statistics. They can also help with ascending key columns where recent values are not represented well.

Do not update statistics constantly without evidence, because updates consume resources and can cause recompilation.

##### Key Points to Mention

- After large data changes.
- After bulk loads.
- When estimates are clearly wrong.
- For ascending keys with recent values.
- Avoid unnecessary frequent updates.

<!-- question:end:statistics-and-how-the-optimizer-uses-them-intermediate-q02 -->

#### How are statistics different from indexes?

<!-- question:start:statistics-and-how-the-optimizer-uses-them-intermediate-q03 -->
<!-- question-id:statistics-and-how-the-optimizer-uses-them-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Statistics describe data distribution and help the optimizer estimate row counts. Indexes provide physical access paths to find rows efficiently. Creating an index creates statistics on the index key, but statistics alone do not let SQL Server seek directly to rows.

Both can affect performance, but they solve different parts of query optimization.

##### Key Points to Mention

- Statistics help estimates.
- Indexes help access data.
- Indexes have associated statistics.
- Statistics alone are not access paths.
- Both can influence plan quality.

<!-- question:end:statistics-and-how-the-optimizer-uses-them-intermediate-q03 -->

#### What can cause estimated rows and actual rows to differ greatly?

<!-- question:start:statistics-and-how-the-optimizer-uses-them-intermediate-q04 -->
<!-- question-id:statistics-and-how-the-optimizer-uses-them-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Large estimate mismatches can come from stale or missing statistics, skewed data, correlated predicates, non-sargable filters, implicit conversions, table variables, parameter sensitivity, or values outside the histogram range.

The fix depends on the cause. It might be updating statistics, adding filtered or multi-column statistics, rewriting the query, changing indexes, or addressing parameter sensitivity.

##### Key Points to Mention

- Stale or missing statistics.
- Skewed data.
- Correlated predicates.
- Non-sargable predicates.
- Parameter sensitivity.
- Ascending key issues.

<!-- question:end:statistics-and-how-the-optimizer-uses-them-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you diagnose a plan caused by bad statistics?

<!-- question:start:statistics-and-how-the-optimizer-uses-them-advanced-q01 -->
<!-- question-id:statistics-and-how-the-optimizer-uses-them-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Start with the actual execution plan. Compare estimated rows with actual rows at operators where the plan goes wrong. Check which predicates and joins have bad estimates. Inspect the relevant statistics with `DBCC SHOW_STATISTICS`, `sys.dm_db_stats_properties`, or plan XML statistics usage. Check last updated time, modification count, sampling, histogram boundaries, and whether the leading statistics column matches the predicate.

Then test a targeted statistics update or better statistics design, and verify the plan and runtime metrics afterward.

##### Key Points to Mention

- Compare estimated and actual rows.
- Identify where estimates diverge.
- Inspect statistics objects.
- Check last updated and modification count.
- Review histogram and leading column.
- Validate fixes with actual runtime.

<!-- question:end:statistics-and-how-the-optimizer-uses-them-advanced-q01 -->

#### When are filtered statistics useful?

<!-- question:start:statistics-and-how-the-optimizer-uses-them-advanced-q02 -->
<!-- question-id:statistics-and-how-the-optimizer-uses-them-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Filtered statistics are useful when an important query targets a subset whose distribution differs from the whole table, such as active rows, open orders, unprocessed queue messages, or non-null optional values. They provide more accurate estimates for that subset.

They work best when query predicates align clearly with the filter definition.

##### Key Points to Mention

- Describe a subset of rows.
- Useful for skewed subsets.
- Help estimate filtered workloads.
- Query predicate should match the filter.
- Can pair with filtered indexes.

<!-- question:end:statistics-and-how-the-optimizer-uses-them-advanced-q02 -->

#### How do multi-column statistics help and what is their limitation?

<!-- question:start:statistics-and-how-the-optimizer-uses-them-advanced-q03 -->
<!-- question-id:statistics-and-how-the-optimizer-uses-them-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Multi-column statistics can help the optimizer understand density and correlation for combinations of columns. This is useful when predicates often filter on related columns such as `TenantId` and `Status`.

The limitation is that the histogram is only on the first key column. If the leading column is not aligned with important predicates, the statistic may be less useful than expected.

##### Key Points to Mention

- Help with column combinations.
- Store density information.
- Useful for correlated predicates.
- Histogram is on the first column only.
- Leading column choice matters.

<!-- question:end:statistics-and-how-the-optimizer-uses-them-advanced-q03 -->

#### How do statistics relate to parameter-sensitive plans?

<!-- question:start:statistics-and-how-the-optimizer-uses-them-advanced-q04 -->
<!-- question-id:statistics-and-how-the-optimizer-uses-them-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

Statistics describe the distribution of parameter values, but a cached plan may be compiled for one parameter value and reused for another value with very different selectivity. For skewed data, one plan may not fit all parameter values.

Diagnose by comparing plans and runtime for different parameter values. Possible solutions include better indexes or statistics, query rewrites, recompilation for specific statements, or SQL Server features designed for parameter-sensitive plan behavior.

##### Key Points to Mention

- Skewed values can need different plans.
- Cached plans may be reused.
- Statistics reveal distribution but do not guarantee one plan fits all.
- Compare behavior across parameter values.
- Avoid forcing hints before understanding the cause.

<!-- question:end:statistics-and-how-the-optimizer-uses-them-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
