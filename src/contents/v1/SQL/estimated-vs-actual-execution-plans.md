---
id: estimated-vs-actual-execution-plans
topic: Indexes, statistics, and execution plans
subtopic: Estimated vs actual execution plans
category: SQL
---

## Overview

An execution plan describes how SQL Server intends to execute a query: which tables and indexes to access, in what order, with which physical operators, joins, sorts, aggregates, memory grants, and parallelism choices. Estimated and actual execution plans are two different ways to inspect that plan.

An estimated execution plan is generated without running the query. It shows the compiled plan the optimizer would likely use and the estimated row counts. An actual execution plan is available after the query runs. It includes the compiled plan plus runtime information such as actual row counts, runtime warnings, elapsed time, CPU time in newer versions, spills, and other execution details.

This topic matters because execution plans are one of the most important tools for SQL performance diagnosis. Plans reveal whether SQL Server is scanning, seeking, sorting, spilling, looking up rows repeatedly, choosing a poor join algorithm, or making bad row-count estimates.

For interviews, strong candidates can explain when to use estimated versus actual plans, how to compare estimated rows with actual rows, why actual plans require executing the query, and which plan symptoms point to indexes, statistics, query shape, or data distribution problems.

## Core Concepts

### What An Execution Plan Shows

An execution plan shows the strategy SQL Server uses to execute a query.

It can show:

- Table and index access methods.
- Join order.
- Join algorithms.
- Sorts and aggregations.
- Filters and computed expressions.
- Parallelism operators.
- Estimated and actual row counts.
- Memory grant information.
- Missing-index suggestions.
- Warnings such as spills or implicit conversions.

Example query:

```sql
SELECT
    c.CustomerId,
    c.Email,
    SUM(o.TotalAmount) AS TotalSpend
FROM dbo.Customers AS c
JOIN dbo.Orders AS o
    ON o.CustomerId = c.CustomerId
WHERE o.OrderDate >= @StartDate
  AND o.OrderDate < @EndDate
GROUP BY c.CustomerId, c.Email;
```

The plan might show an index seek on `Orders`, a join to `Customers`, and a hash aggregate for totals.

### Estimated Execution Plan

An estimated execution plan is generated without executing the query.

In SSMS, you can use Display Estimated Execution Plan. In T-SQL, `SET SHOWPLAN_XML ON` returns plan XML without running the statement.

Example:

```sql
SET SHOWPLAN_XML ON;
GO

SELECT *
FROM dbo.Orders
WHERE CustomerId = @CustomerId;
GO

SET SHOWPLAN_XML OFF;
GO
```

Use estimated plans when:

- The query is expensive or risky to run.
- You want to see the likely plan before execution.
- The statement modifies data and you do not want to run it.
- The query cannot be run in the current environment.

Limitations:

- No actual row counts.
- No runtime metrics.
- No runtime warnings from execution.
- Estimates may be wrong.

### Actual Execution Plan

An actual execution plan is collected after the query executes.

In SSMS, enable Include Actual Execution Plan before running the query. In T-SQL, `SET STATISTICS XML ON` returns actual plan XML after execution.

Example:

```sql
SET STATISTICS XML ON;

SELECT *
FROM dbo.Orders
WHERE CustomerId = @CustomerId;

SET STATISTICS XML OFF;
```

Use actual plans when:

- You need real row counts.
- You need runtime warnings.
- You are diagnosing a real performance issue.
- You need to compare estimates with actual execution behavior.
- You want to see spills, memory grants, or actual join behavior.

Limitations:

- The query must run.
- Running the query can be expensive.
- Data-changing statements will change data unless wrapped safely.
- Runtime can vary due to cache, concurrency, parameter values, and server load.

### Estimated Rows Vs Actual Rows

One of the most valuable checks is comparing estimated rows with actual rows.

Example symptom:

```text
Estimated Number of Rows: 1
Actual Number of Rows: 250000
```

This mismatch can cause poor plan choices:

- Nested loops chosen when hash join would be better.
- Too-small memory grant causing spills.
- Key lookup repeated many times.
- Wrong join order.
- Underestimated parallelism needs.

Large differences are clues, not final answers. Investigate statistics, predicates, parameter values, table variables, implicit conversions, and data skew.

### Operator Costs

Graphical plans show estimated operator costs as percentages. These are optimizer estimates, not measured runtime percentages.

Mistake:

- "This operator says 80 percent, so it definitely consumed 80 percent of runtime."

Better:

- Treat operator cost as a clue.
- Confirm with actual runtime metrics, row counts, reads, CPU, waits, and Query Store.

Estimated cost can be misleading when cardinality estimates are wrong.

### Common Operators

Useful operators to recognize:

- Index Seek: navigates to a key or key range.
- Index Scan: reads many or all rows from an index.
- Clustered Index Seek: uses the clustered index to find rows.
- Clustered Index Scan: scans the clustered table.
- Key Lookup: fetches missing columns from the clustered index.
- Nested Loops Join: often good for small outer inputs and indexed lookups.
- Hash Match Join: often used for larger unsorted inputs.
- Merge Join: efficient when both inputs are sorted on join keys.
- Sort: orders rows and can be expensive.
- Hash Match Aggregate: groups rows using hashing.
- Stream Aggregate: groups rows that arrive in order.

Do not judge operators in isolation. The right operator depends on row counts, ordering, indexes, and memory.

### Scans Are Not Always Bad

A scan can be appropriate when:

- The query returns a large percentage of the table.
- The table is small.
- A narrow nonclustered index covers the query.
- No selective predicate exists.
- Reading sequential pages is cheaper than many random lookups.

Example:

```sql
SELECT Status, COUNT(*) AS OrderCount
FROM dbo.Orders
GROUP BY Status;
```

If the query needs every row to count statuses, a scan is natural.

### Seeks Are Not Always Good

A seek can still produce poor performance when followed by many lookups.

Example:

```sql
SELECT *
FROM dbo.Orders
WHERE Status = N'Completed';
```

If most orders are completed and SQL Server seeks an index on `Status` then performs key lookups for many rows, the plan can be worse than a scan.

Always check actual rows and lookup counts.

### Key Lookup Warnings

Key lookups are common.

Potential issue:

```text
Nested Loops
  Index Seek
  Key Lookup
```

If the lookup executes thousands or millions of times, consider:

- Adding included columns.
- Changing the index key.
- Returning fewer columns.
- Rewriting the query.
- Accepting a scan if many rows are needed.

If the lookup executes once or a few times, it may be perfectly fine.

### Sort And Spill Warnings

Sorts and hash operations may spill to tempdb when the memory grant is insufficient.

Possible causes:

- Bad cardinality estimates.
- Large row sizes.
- Missing indexes that could provide ordering.
- Underestimated groups or join rows.
- Parameter-sensitive plans.

Example index to avoid a sort:

```sql
CREATE INDEX IX_Orders_Customer_OrderDate
ON dbo.Orders (CustomerId, OrderDate DESC);
```

This can support:

```sql
WHERE CustomerId = @CustomerId
ORDER BY OrderDate DESC;
```

### Implicit Conversion Warnings

Implicit conversions can prevent efficient index usage.

Example:

```sql
-- Column is VARCHAR, parameter is NVARCHAR
WHERE Email = @Email;
```

If SQL Server converts the column side or cannot use statistics effectively, the plan can degrade.

Execution plans may show conversion warnings. Fix by aligning data types between columns, parameters, and literals.

### Missing Index Suggestions

Execution plans can show missing-index suggestions. These are helpful clues, but not complete designs.

Before creating a suggested index:

- Check existing indexes.
- Check whether the suggestion overlaps with another index.
- Consider key order and included columns.
- Estimate write overhead.
- Validate against the full workload.
- Avoid creating many similar indexes.

Missing-index suggestions do not know your whole workload or maintenance budget.

### Estimated Plan Use Cases

Estimated plans are useful when:

- You cannot run the query safely.
- The query modifies data.
- You need quick compile-time insight.
- You want to inspect object access choices before testing.
- You are reviewing a migration script.

Example:

```sql
SET SHOWPLAN_XML ON;

DELETE FROM dbo.Orders
WHERE OrderDate < @ArchiveBefore;

SET SHOWPLAN_XML OFF;
```

This helps inspect the likely plan without deleting rows.

### Actual Plan Use Cases

Actual plans are usually better for troubleshooting because they include runtime reality.

Use actual plans to answer:

- How many rows actually flowed through each operator?
- Did memory spill to tempdb?
- Did the plan use parallelism?
- Did a lookup execute many times?
- Did an operator produce warnings?
- Were estimates accurate?

Pair actual plans with:

- `SET STATISTICS IO ON`.
- `SET STATISTICS TIME ON`.
- Query Store runtime data.
- Wait statistics and blocking analysis.

### Common Mistakes

Common mistakes include:

- Treating estimated operator cost percentages as actual runtime.
- Assuming scans are always bad.
- Assuming seeks are always good.
- Ignoring estimated versus actual row differences.
- Blindly creating every missing-index suggestion.
- Forgetting actual plans require executing the query.
- Running actual plans for data-changing statements without a safe transaction plan.
- Looking only at the first expensive-looking operator instead of following row flow.
- Ignoring parameter values used when the plan was compiled.
- Not checking warnings such as spills and implicit conversions.

### Best Practices

Best practices:

- Use estimated plans before running expensive or risky statements.
- Use actual plans for real performance diagnosis.
- Compare estimated rows with actual rows.
- Investigate warnings.
- Check access methods, joins, sorts, lookups, and memory grants.
- Pair plans with runtime metrics.
- Validate missing-index suggestions against the workload.
- Test with representative parameter values.
- Save plans before and after tuning changes.
- Use Query Store for plan history and regression analysis.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is an execution plan?

<!-- question:start:estimated-vs-actual-execution-plans-beginner-q01 -->
<!-- question-id:estimated-vs-actual-execution-plans-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

An execution plan shows how SQL Server intends to execute a query. It includes table and index access methods, join order, join algorithms, filters, sorts, aggregates, and other operators.

Execution plans help diagnose why a query is fast or slow.

##### Key Points to Mention

- Shows the query execution strategy.
- Created by the optimizer.
- Includes operators and data access choices.
- Helps performance tuning.
- Can be estimated or actual.

<!-- question:end:estimated-vs-actual-execution-plans-beginner-q01 -->

#### What is an estimated execution plan?

<!-- question:start:estimated-vs-actual-execution-plans-beginner-q02 -->
<!-- question-id:estimated-vs-actual-execution-plans-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

An estimated execution plan is the compiled plan SQL Server would likely use if the query ran. It is generated without executing the query, so it contains estimated row counts but no runtime information.

It is useful when the query is expensive or unsafe to run.

##### Key Points to Mention

- Generated without executing.
- Shows likely compiled plan.
- Contains estimated rows.
- No actual runtime metrics.
- Useful before risky statements.

<!-- question:end:estimated-vs-actual-execution-plans-beginner-q02 -->

#### What is an actual execution plan?

<!-- question:start:estimated-vs-actual-execution-plans-beginner-q03 -->
<!-- question-id:estimated-vs-actual-execution-plans-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

An actual execution plan is produced after the query runs. It includes the compiled plan plus runtime information such as actual row counts, warnings, and execution metrics.

It is usually more useful for troubleshooting a real performance issue because it shows what happened during execution.

##### Key Points to Mention

- Requires executing the query.
- Includes actual row counts.
- Can include runtime warnings.
- Better for troubleshooting.
- Be careful with data-changing statements.

<!-- question:end:estimated-vs-actual-execution-plans-beginner-q03 -->

#### Why compare estimated rows and actual rows?

<!-- question:start:estimated-vs-actual-execution-plans-beginner-q04 -->
<!-- question-id:estimated-vs-actual-execution-plans-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Comparing estimated rows and actual rows shows whether the optimizer predicted row counts accurately. Large differences can explain poor join choices, bad memory grants, excessive lookups, or scans that were not expected.

Estimate errors often point to stale statistics, skewed data, parameter sensitivity, or non-sargable predicates.

##### Key Points to Mention

- Shows estimate quality.
- Large mismatches can cause bad plans.
- Helps identify statistics problems.
- Helps diagnose join and memory issues.
- Use actual plans for this comparison.

<!-- question:end:estimated-vs-actual-execution-plans-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### Are scans always bad in an execution plan?

<!-- question:start:estimated-vs-actual-execution-plans-intermediate-q01 -->
<!-- question-id:estimated-vs-actual-execution-plans-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

No. Scans can be appropriate when a query needs many rows, the table is small, or a narrow covering index can be scanned efficiently. A scan is not automatically a problem.

The real question is whether the scan reads too much data for the business requirement and whether a selective, useful index or query rewrite would reduce work.

##### Key Points to Mention

- Scans can be correct.
- Large result sets often scan.
- Small tables may scan efficiently.
- Narrow index scans can be cheap.
- Judge by reads, rows, and workload.

<!-- question:end:estimated-vs-actual-execution-plans-intermediate-q01 -->

#### Are seeks always good in an execution plan?

<!-- question:start:estimated-vs-actual-execution-plans-intermediate-q02 -->
<!-- question-id:estimated-vs-actual-execution-plans-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

No. A seek can still be part of a slow plan if it returns many rows or if it is followed by many key lookups. A seek with millions of lookups can be worse than a scan.

Review actual row counts, lookup counts, logical reads, and whether the index matches the real query pattern.

##### Key Points to Mention

- Seeks are not automatically fast.
- Many lookups can be expensive.
- Low-selectivity seeks may return many rows.
- Actual rows matter.
- Reads and runtime confirm quality.

<!-- question:end:estimated-vs-actual-execution-plans-intermediate-q02 -->

#### What does a key lookup in a plan mean?

<!-- question:start:estimated-vs-actual-execution-plans-intermediate-q03 -->
<!-- question-id:estimated-vs-actual-execution-plans-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

A key lookup means SQL Server used a nonclustered index to find rows but needed extra columns from the clustered index. It looked up the base row using the clustered key.

Key lookups are acceptable for small row counts but can be expensive when repeated many times. A covering index or query change may help.

##### Key Points to Mention

- Fetches missing columns.
- Usually follows a nonclustered index seek.
- Uses clustered key as locator.
- Fine for small row counts.
- Expensive when repeated many times.

<!-- question:end:estimated-vs-actual-execution-plans-intermediate-q03 -->

#### How should missing-index suggestions be interpreted?

<!-- question:start:estimated-vs-actual-execution-plans-intermediate-q04 -->
<!-- question-id:estimated-vs-actual-execution-plans-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Missing-index suggestions are clues from the optimizer for one query context. They are not complete index designs. They may overlap with existing indexes, create too-wide indexes, or ignore write overhead.

Use them as a starting point, then review the workload, existing indexes, key order, included columns, and maintenance cost.

##### Key Points to Mention

- Helpful but incomplete.
- Based on a query context.
- Can overlap with existing indexes.
- Can increase write cost.
- Validate against the whole workload.

<!-- question:end:estimated-vs-actual-execution-plans-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you analyze a slow query using an actual execution plan?

<!-- question:start:estimated-vs-actual-execution-plans-advanced-q01 -->
<!-- question-id:estimated-vs-actual-execution-plans-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Start with the actual plan and runtime metrics. Compare estimated and actual rows, then follow the row flow through scans, seeks, joins, sorts, aggregates, and lookups. Look for large estimate errors, expensive key lookups, spills, implicit conversions, missing indexes, wrong join choices, and large memory grants.

Then connect the symptom to a cause: stale statistics, missing or wrong indexes, non-sargable predicates, parameter sensitivity, or query shape. Test one change at a time and compare before and after metrics.

##### Key Points to Mention

- Use actual row counts.
- Compare estimates and actuals.
- Look for warnings and spills.
- Inspect access paths and joins.
- Pair with IO and time metrics.
- Validate tuning changes.

<!-- question:end:estimated-vs-actual-execution-plans-advanced-q01 -->

#### When would you prefer an estimated plan over an actual plan?

<!-- question:start:estimated-vs-actual-execution-plans-advanced-q02 -->
<!-- question-id:estimated-vs-actual-execution-plans-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Use an estimated plan when running the query is too expensive, unsafe, or impossible in the current environment. This is common for large data-changing statements, long-running reports, production review, or migration scripts.

The trade-off is that estimated plans lack runtime information, so they can miss spills, actual row-count differences, and runtime warnings.

##### Key Points to Mention

- Does not execute the query.
- Safer for risky DML review.
- Useful for expensive queries.
- Lacks runtime data.
- Follow up with actual plan when possible.

<!-- question:end:estimated-vs-actual-execution-plans-advanced-q02 -->

#### What plan symptoms suggest a statistics problem?

<!-- question:start:estimated-vs-actual-execution-plans-advanced-q03 -->
<!-- question-id:estimated-vs-actual-execution-plans-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Large estimated-versus-actual row mismatches are the main clue. Other symptoms include bad join choices, memory spills from underestimated rows, excessive key lookups, scans chosen unexpectedly, or plans that vary badly for different parameter values.

The next step is to inspect the relevant statistics, check last updated time and modification counts, review data skew, and test targeted statistics updates or better statistics design.

##### Key Points to Mention

- Large row estimate mismatch.
- Bad join choice.
- Spill from underestimated rows.
- Parameter-sensitive behavior.
- Check statistics freshness and histogram.
- Validate with actual plan after fixes.

<!-- question:end:estimated-vs-actual-execution-plans-advanced-q03 -->

#### How do you compare two execution plans after a tuning change?

<!-- question:start:estimated-vs-actual-execution-plans-advanced-q04 -->
<!-- question-id:estimated-vs-actual-execution-plans-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

Compare both plan shape and runtime metrics. Look at access methods, join order, join types, memory grants, spills, estimated versus actual row counts, reads, CPU, duration, and returned row counts. Make sure the tuned query returns the same results and improves the right workload metric.

Plan comparison tools and Query Store can help, but the final decision should be based on correctness and representative workload performance.

##### Key Points to Mention

- Compare returned results first.
- Compare reads, CPU, and duration.
- Compare plan operators and join choices.
- Check memory grants and spills.
- Use representative parameters.
- Query Store helps with plan history.

<!-- question:end:estimated-vs-actual-execution-plans-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
