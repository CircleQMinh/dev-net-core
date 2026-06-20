---
id: knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints
topic: Query tuning, Query Store, and plan stability
subtopic: Knowing when to change SQL, indexes, or schema instead of forcing hints
category: SQL
---

## Overview

Knowing when to change SQL, indexes, or schema instead of forcing hints is a core SQL Server tuning judgment. Query hints, table hints, forced plans, and Query Store hints can be useful, but they are usually targeted interventions. They tell the optimizer to behave in a particular way without necessarily fixing the reason the optimizer struggled.

Durable tuning often comes from improving the query shape, giving the optimizer better indexes and statistics, or changing a schema that makes efficient access impossible. A hint may be the right short-term mitigation during an incident, but it can become technical debt if it locks the system into a plan that no longer fits the data.

For interviews, this topic matters because it separates candidates who can memorize hints from candidates who can diagnose root causes. Strong answers explain the trade-off: hints can stabilize a known problem quickly, while SQL, index, statistics, or schema changes usually address the underlying data access pattern.

## Core Concepts

### What Hints Do

Hints influence the optimizer's choices. They can affect join strategy, memory grants, degree of parallelism, recompilation, index access, locking behavior, cardinality-related behavior, and other plan decisions.

Examples include:

- `OPTION (RECOMPILE)`.
- `OPTIMIZE FOR`.
- `MAXDOP`.
- Join hints such as `HASH JOIN`, `MERGE JOIN`, and `LOOP JOIN`.
- Table hints such as `FORCESEEK`.
- Query Store hints.
- Query Store plan forcing.

Hints can be helpful, but they should usually be applied after understanding the cause.

### Why Hints Are Risky

Hints can make a plan less adaptable. SQL Server's optimizer normally considers statistics, indexes, cardinality estimates, costing, available operators, and compatibility-level features. A hint narrows the search or overrides part of the decision.

Risks include:

- The hint works for one data distribution but fails later.
- The hint helps one parameter value and hurts another.
- The hint hides missing indexes or poor SQL shape.
- The hint becomes stale after schema or data changes.
- The hint prevents newer optimizer features from helping.
- The hint makes future troubleshooting harder.
- Some hints can prevent a valid plan and cause errors.

Hints are not bad by definition. They are sharp tools.

### When Hints Are Reasonable

Hints can be reasonable when:

- There is a production incident and a quick reversible mitigation is needed.
- A known plan regression needs temporary stabilization.
- Application SQL cannot be changed quickly.
- Vendor or ORM-generated SQL is hard to modify.
- A specific optimizer issue is well understood and narrowly scoped.
- A compatibility-level upgrade needs a temporary targeted workaround.
- The hint has been tested across representative parameter values.
- The hint has an owner, reason, monitoring plan, and removal condition.

Query Store hints are especially useful when you need to shape a query plan without changing application code.

### Prefer SQL Changes When The Query Shape Is The Problem

Change the SQL when the text asks the database to do unnecessary or inefficient work.

Common SQL issues include:

- Non-SARGable predicates.
- Functions on indexed columns.
- Implicit conversions.
- Unnecessary `SELECT *`.
- Optional predicates that force generic plans.
- Joins that accidentally multiply rows.
- Filters applied after large intermediate results.
- Repeated scalar UDF calls.
- Correlated subqueries that obscure intent.
- Overly broad result sets.

Example:

```sql
-- Poor shape: function on the column prevents a simple date range seek
WHERE CONVERT(date, OrderDate) = @OrderDate;
```

Better:

```sql
WHERE OrderDate >= @OrderDate
  AND OrderDate < DATEADD(day, 1, @OrderDate);
```

A hint may force a seek, but rewriting the predicate makes the query naturally seekable.

### Prefer Index Changes When Access Paths Are Missing

Change indexes when the query is well-shaped but lacks an efficient access path.

Index change signals include:

- Large scans for selective predicates.
- Expensive key lookups repeated many times.
- Sort operators that match common `ORDER BY` patterns.
- Joins on unindexed foreign key columns.
- High logical reads from hot queries.
- Query Store shows high total read cost.
- A covering index would eliminate repeated base-table access.
- A filtered index would support a common subset.

Example:

```sql
CREATE INDEX IX_Orders_Status_OrderDate
ON dbo.Orders (Status, OrderDate DESC)
INCLUDE (CustomerId, TotalAmount);
```

This can be better than forcing an index because it gives the optimizer a useful access path while still allowing cost-based decisions.

### Avoid Over-Indexing

Indexes are not free.

Every additional index can add:

- Storage cost.
- Memory pressure.
- Insert, update, delete, and merge overhead.
- Transaction log volume.
- Maintenance work.
- Potential blocking or concurrency pressure.
- More optimizer choices to evaluate.

Before adding an index:

- Check existing indexes for overlap.
- Consider modifying an existing index.
- Validate the query workload, not one plan.
- Estimate write impact.
- Monitor usage after deployment.
- Remove unused or duplicate indexes carefully.

### Prefer Statistics Changes When Estimates Are The Problem

Change statistics or statistics strategy when poor cardinality estimates are driving bad plans.

Signals include:

- Estimated rows differ greatly from actual rows.
- Data distribution changed recently.
- A large load, delete, or archive happened.
- Queries use correlated columns.
- Filtered subsets need better estimates.
- Parameter-sensitive behavior depends on skew.

Example:

```sql
UPDATE STATISTICS dbo.Orders IX_Orders_Status_OrderDate WITH FULLSCAN;
```

Or create filtered statistics for a hot subset:

```sql
CREATE STATISTICS ST_Orders_Open_Status
ON dbo.Orders (Status)
WHERE Status IN ('Pending', 'Processing');
```

Do not blindly update all statistics as a substitute for diagnosis, but do consider statistics when estimates are clearly wrong.

### Prefer Schema Changes When The Model Blocks Efficient Queries

Change schema when the data model makes efficient access, integrity, or cardinality estimation difficult.

Schema problem signals include:

- Comma-separated IDs in a string column.
- JSON or XML used for frequently filtered relational attributes.
- Wrong data types causing implicit conversions.
- Missing constraints for known uniqueness or relationships.
- Low-quality surrogate fields replacing real searchable columns.
- Entity-attribute-value design for normal transactional queries.
- Repeated denormalized columns that drift out of sync.
- Date/time values stored as strings.
- Tenant or partitioning design that fights common access patterns.

Example schema issue:

```sql
-- Bad for filtering, joining, validation, and indexing
CREATE TABLE dbo.CustomerPreference
(
    CustomerId int NOT NULL,
    PreferenceIds varchar(2000) NOT NULL
);
```

Better relational design:

```sql
CREATE TABLE dbo.CustomerPreference
(
    CustomerId int NOT NULL,
    PreferenceId int NOT NULL,
    CONSTRAINT PK_CustomerPreference
        PRIMARY KEY (CustomerId, PreferenceId)
);
```

No hint can make a poor data model fully behave like a well-modeled relational structure.

### SARGability Before Hints

SARGable predicates can use indexes efficiently. Non-SARGable predicates often force scans or residual predicates.

Common non-SARGable patterns:

```sql
WHERE LEFT(LastName, 1) = 'S';
WHERE ISNULL(Status, '') = 'Open';
WHERE YEAR(OrderDate) = 2026;
WHERE CONVERT(varchar(10), CreatedAt, 120) = '2026-06-20';
```

Better patterns:

```sql
WHERE LastName >= 'S' AND LastName < 'T';
WHERE Status = 'Open';
WHERE OrderDate >= '20260101' AND OrderDate < '20270101';
WHERE CreatedAt >= '20260620' AND CreatedAt < '20260621';
```

If the predicate is not seekable, forcing a seek may be less useful than fixing the predicate.

### Parameter Sensitivity

Parameter-sensitive plans are a common reason people reach for hints. A plan optimized for a rare value may be bad for a common value, and a plan optimized for a common value may be bad for a rare value.

Possible fixes include:

- Query rewrite.
- Branching for distinct cases.
- Safe dynamic SQL for optional filters.
- `OPTION (RECOMPILE)` for suitable statements.
- `OPTIMIZE FOR` when a representative value exists.
- Parameter Sensitive Plan optimization in newer SQL Server versions.
- Query Store plan forcing only when one plan is good enough for the workload.

The right answer depends on data skew, execution frequency, compile cost, and workload mix.

### Query Store Hints Vs Code Changes

Query Store hints are useful when the SQL text cannot be changed quickly. They can apply hints without editing application code.

Use Query Store hints when:

- The SQL comes from an ORM or vendor package.
- Deployment lead time is too long for an incident.
- You need a reversible production mitigation.
- You want to test a targeted hint safely.

Prefer code changes when:

- The query is clearly written inefficiently.
- The application can be deployed safely.
- The fix improves clarity and maintainability.
- The query needs different logic, not just a different plan choice.

### Plan Forcing Vs Root Cause Fixes

Query Store plan forcing can stabilize a query by making SQL Server try to use a previously captured plan.

This is useful when:

- A query regressed because of a plan choice change.
- A previous plan is known to be better for most workload cases.
- A quick mitigation is needed.

It is less appropriate when:

- Data distribution is changing quickly.
- The query is parameter-sensitive and needs multiple plan shapes.
- The old plan relies on obsolete indexes.
- The root problem is bad SQL or schema.
- You have not tested representative parameter values.

Plan forcing should have a review date. Otherwise, it quietly becomes permanent technical debt.

### Decision Framework

Use this decision flow:

| Evidence | Prefer |
| --- | --- |
| Predicate is non-SARGable | Change SQL |
| Query returns or joins unnecessary rows | Change SQL |
| Access path is missing for a good query | Change indexes |
| Existing indexes overlap heavily | Modify indexes |
| Estimates are wrong because statistics are stale or incomplete | Update or create statistics |
| Data model stores relational data in strings or generic attributes | Change schema |
| Query is generated and cannot be changed quickly | Query Store hint may be appropriate |
| Known plan regression needs emergency mitigation | Plan forcing may be appropriate |
| One plan is bad for different parameter groups | Rewrite, branch, dynamic SQL, PSP optimization, or recompile |

The stronger the root-cause evidence, the less attractive a hint becomes.

### Common Mistakes

Common mistakes include:

- Adding hints because they made one test faster.
- Forcing an index without checking write cost or index overlap.
- Using `NOLOCK` to hide blocking while accepting inconsistent reads.
- Applying `OPTION (RECOMPILE)` to high-frequency lightweight queries.
- Forcing one plan for a parameter-sensitive query.
- Ignoring implicit conversions caused by mismatched data types.
- Treating missing index suggestions as automatic instructions.
- Leaving Query Store hints undocumented.
- Forgetting to revisit forced plans after data changes.
- Using hints to avoid fixing a broken data model.

### Best Practices

Best practices include:

- Start with evidence from Query Store, actual execution plans, waits, and workload metrics.
- Understand the root cause before choosing a fix.
- Prefer SQL rewrites for bad query shape.
- Prefer index changes for missing access paths.
- Prefer statistics work for bad estimates.
- Prefer schema changes for structural modeling problems.
- Use hints as targeted, documented, monitored interventions.
- Test with representative parameter values and data volume.
- Validate workload-level impact after release.
- Remove or revisit hints when the durable fix is available.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is a query hint?

<!-- question:start:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-beginner-q01 -->
<!-- question-id:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A query hint is an instruction that influences how SQL Server optimizes or executes a query. Hints can affect join choices, recompilation, parallelism, memory grants, index access, and other plan decisions. They are usually specified with the `OPTION` clause or through features such as Query Store hints.

Hints can solve specific problems, but they should be used carefully because they can override normal optimizer choices and become stale as data, indexes, or workload patterns change.

##### Key Points to Mention

- Influences optimizer or execution behavior.
- Examples include `RECOMPILE`, `MAXDOP`, join hints, and `OPTIMIZE FOR`.
- Query Store hints can apply hints without changing application SQL.
- Useful in targeted cases.
- Risky if used without diagnosis.

<!-- question:end:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-beginner-q01 -->

#### Why are hints usually not the first tuning choice?

<!-- question:start:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-beginner-q02 -->
<!-- question-id:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

Hints are usually not first because they influence the plan without necessarily fixing the underlying reason the optimizer chose a bad plan. The root cause may be bad SQL shape, missing indexes, stale statistics, parameter sensitivity, or poor schema design. Fixing those issues usually gives the optimizer better information or better access paths.

A hint can be appropriate as a short-term or targeted fix, but it should be tested and monitored.

##### Key Points to Mention

- Hints can hide root causes.
- SQL, indexes, statistics, or schema may be the real issue.
- Hints can become stale.
- Hints can hurt other parameter values or future workloads.
- Use hints only with evidence and monitoring.

<!-- question:end:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-beginner-q02 -->

#### When should you change SQL instead of adding a hint?

<!-- question:start:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-beginner-q03 -->
<!-- question-id:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

Change the SQL when the query shape is inefficient. Examples include non-SARGable predicates, functions on indexed columns, implicit conversions, unnecessary columns, joins that multiply rows, filters applied too late, or optional predicates that force one generic plan.

For example, replacing `YEAR(OrderDate) = 2026` with a date range can let SQL Server use an index seek naturally. That is better than forcing an access method on a poorly shaped predicate.

##### Key Points to Mention

- Fix bad query shape.
- Make predicates SARGable.
- Remove unnecessary work.
- Avoid implicit conversions.
- Prefer clear SQL over forcing a plan.

<!-- question:end:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-beginner-q03 -->

#### When should you add or change an index instead of forcing a hint?

<!-- question:start:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-beginner-q04 -->
<!-- question-id:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Add or change an index when the query is logically well-written but lacks an efficient access path. If a hot query repeatedly scans a large table for selective predicates, performs expensive lookups, or sorts data that could be delivered in index order, an index may be the durable fix.

The index should be designed for the workload and checked against existing indexes. Adding too many indexes can hurt writes and maintenance, so the decision should be evidence-based.

##### Key Points to Mention

- Use indexes for missing access paths.
- Match predicates, joins, sorting, and covering needs.
- Check existing index overlap.
- Consider write and storage cost.
- Validate with workload metrics.

<!-- question:end:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### How do you decide whether a slow query needs SQL rewrite, index change, statistics update, or a hint?

<!-- question:start:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-intermediate-q01 -->
<!-- question-id:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

I would inspect the actual execution plan, Query Store history, row estimates, waits, indexes, and query text. If the predicate is non-SARGable or the query does unnecessary work, I would rewrite SQL. If the query is well-shaped but scans too much data, I would consider an index. If estimates are wrong because statistics are stale or insufficient, I would address statistics. If the SQL cannot be changed quickly or there is a known plan regression, a hint or forced plan may be a temporary targeted option.

The choice should be based on evidence and validated with representative parameters and workload metrics.

##### Key Points to Mention

- Inspect query text and actual plan.
- Compare estimated vs actual rows.
- Review Query Store history.
- Choose the fix that matches the root cause.
- Use hints as targeted mitigation, not guesswork.

<!-- question:end:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-intermediate-q01 -->

#### Why can forcing an index be worse than creating a better index?

<!-- question:start:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-intermediate-q02 -->
<!-- question-id:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Forcing an index tells SQL Server to use a specific index even when the cost model might prefer a different access path for some parameter values or future data distributions. If the forced index is incomplete, stale, or only good for one case, performance can degrade.

Creating or modifying a better index gives the optimizer a useful option while preserving cost-based choice. It can support predicates, joins, order, and covering columns without locking the query to one access path.

##### Key Points to Mention

- Forced index narrows optimizer choice.
- It may be bad for different parameter values.
- It can become stale as data changes.
- A good index provides an option, not a command.
- Validate against the whole workload.

<!-- question:end:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-intermediate-q02 -->

#### When are Query Store hints useful?

<!-- question:start:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-intermediate-q03 -->
<!-- question-id:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Query Store hints are useful when you need to apply a supported hint to a query without changing the application SQL text. This is common with ORM-generated SQL, vendor code, long deployment cycles, or production incidents where a targeted mitigation is needed quickly.

They should still be treated carefully. The hint should be documented, monitored, tested with representative parameter values, and revisited when a durable SQL, index, statistics, or schema fix is available.

##### Key Points to Mention

- Applies hints through Query Store.
- No application SQL change required.
- Useful for ORM, vendor, or incident cases.
- Should be documented and monitored.
- Should not replace root-cause analysis.

<!-- question:end:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-intermediate-q03 -->

#### How do statistics influence the decision to avoid hints?

<!-- question:start:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-intermediate-q04 -->
<!-- question-id:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Statistics drive cardinality estimates, and cardinality estimates influence join choice, index choice, memory grants, and parallelism. If estimates are wrong because statistics are stale, sampled poorly, missing for important predicates, or unable to represent a filtered subset, the optimizer may choose a bad plan.

In that case, updating or creating appropriate statistics may be better than forcing a hint. The goal is to give the optimizer better information rather than override it blindly.

##### Key Points to Mention

- Statistics support row estimates.
- Estimates affect plan choices.
- Stale or incomplete statistics can cause bad plans.
- Filtered statistics can help subsets.
- Better information can remove the need for hints.

<!-- question:end:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you handle a production plan regression when code changes take days?

<!-- question:start:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-advanced-q01 -->
<!-- question-id:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

I would first confirm the regression with Query Store: affected query, old plan, new plan, runtime metrics, waits, and business impact. If a previous plan was clearly better for the representative workload, I might use Query Store plan forcing or a Query Store hint as a reversible mitigation. I would monitor forced plan failures, duration, CPU, reads, waits, and user impact.

In parallel, I would work on the durable fix. Depending on root cause, that might be SQL rewrite, index change, statistics update, schema change, or application change. I would document the temporary hint or forced plan with an owner and removal condition.

##### Key Points to Mention

- Confirm with Query Store evidence.
- Use plan forcing or Query Store hints only as targeted mitigation.
- Monitor after applying.
- Work toward a durable fix.
- Document owner, reason, and removal criteria.

<!-- question:end:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-advanced-q01 -->

#### Why is forcing one plan dangerous for parameter-sensitive queries?

<!-- question:start:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-advanced-q02 -->
<!-- question-id:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Parameter-sensitive queries may need different plans for different parameter values. A forced plan that is excellent for a selective value can be terrible for a nonselective value, and the reverse is also true. Forcing one plan can hide the variability instead of solving it.

Better approaches might include branching, safe dynamic SQL, `OPTION (RECOMPILE)` for suitable statements, `OPTIMIZE FOR` when a representative value exists, modern Parameter Sensitive Plan optimization, or an index strategy that supports the real distribution. If a plan is forced, it should be tested across representative values.

##### Key Points to Mention

- Different parameter values may need different plans.
- One forced plan can help one case and hurt another.
- Test with representative values.
- Consider branching, dynamic SQL, recompile, or PSP optimization.
- Use workload-level evidence.

<!-- question:end:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-advanced-q02 -->

#### When is a schema change the right performance fix?

<!-- question:start:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-advanced-q03 -->
<!-- question-id:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

A schema change is appropriate when the data model prevents efficient, correct querying. Examples include storing relational IDs in comma-separated strings, storing dates as text, using wrong data types that cause implicit conversions, missing constraints that prevent optimizer assumptions, or using generic key-value tables for core transactional queries.

Hints cannot fully fix a model that hides relationships, types, or searchable attributes from the database engine. A schema change may be more expensive, but it can improve performance, integrity, maintainability, and future query design.

##### Key Points to Mention

- Schema fixes structural problems.
- Wrong data types cause implicit conversions.
- CSV or generic attributes block relational access.
- Constraints and keys help integrity and sometimes optimization.
- Hints cannot compensate for a poor data model indefinitely.

<!-- question:end:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-advanced-q03 -->

#### How would you review an existing system with many hints and forced plans?

<!-- question:start:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-advanced-q04 -->
<!-- question-id:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

I would inventory all forced plans, Query Store hints, query hints, and table hints. For each one, I would identify the owner, original reason, affected query, current runtime metrics, failure status, and whether the underlying issue still exists. I would compare current performance with and without the hint in a safe environment when possible.

Then I would prioritize removal or replacement based on risk and benefit. Some hints may still be justified. Others may be obsolete because data, indexes, SQL Server version, or optimizer behavior changed. For each removed hint, I would monitor Query Store after release.

##### Key Points to Mention

- Inventory all hints and forced plans.
- Determine owner and original reason.
- Check current Query Store metrics.
- Test safely before removing.
- Replace stale hints with SQL, index, statistics, or schema fixes.

<!-- question:end:knowing-when-to-change-sql-indexes-or-schema-instead-of-forcing-hints-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
