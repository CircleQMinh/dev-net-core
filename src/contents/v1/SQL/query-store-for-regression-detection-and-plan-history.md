---
id: query-store-for-regression-detection-and-plan-history
topic: Query tuning, Query Store, and plan stability
subtopic: Query Store for regression detection and plan history
category: SQL
---

## Overview

Query Store is a SQL Server feature that captures query text, execution plans, runtime statistics, and wait statistics over time. It is useful because many query performance problems are not visible from the current plan cache alone. The plan cache can be cleared, evicted under memory pressure, or replaced when a query recompiles, while Query Store keeps historical evidence that helps explain when performance changed and which plan was used.

This topic matters in real systems because production regressions often happen after statistics updates, index changes, deployments, database compatibility level changes, data growth, or parameter-sensitive plan choices. Query Store gives DBAs and developers a database-level flight recorder for answering practical questions: which query regressed, when did it regress, which plan changed, what was the previous good plan, and whether forcing a plan is safe enough as a temporary mitigation.

For interviews, Query Store is important because it connects execution plans, cardinality estimation, plan stability, regression diagnosis, and operational tuning. Strong candidates can explain not only what Query Store stores, but also how to use it responsibly without treating plan forcing as a substitute for query and index design.

## Core Concepts

### What Query Store Captures

Query Store records several related pieces of information:

- Query text, normalized enough for SQL Server to track statements.
- Query metadata, such as query IDs and context settings.
- Execution plans associated with a query.
- Runtime statistics such as duration, CPU, reads, writes, row counts, and execution counts.
- Runtime statistics intervals, which divide data into time windows.
- Wait statistics by query and plan when wait capture is enabled.

The key value is historical comparison. A query that was fast yesterday and slow today can be compared across time windows, plan IDs, and runtime metrics.

Common Query Store catalog views include:

```sql
SELECT
    q.query_id,
    qt.query_sql_text,
    p.plan_id,
    rs.avg_duration,
    rs.avg_cpu_time,
    rs.avg_logical_io_reads,
    rs.count_executions,
    rsi.start_time,
    rsi.end_time
FROM sys.query_store_query_text AS qt
JOIN sys.query_store_query AS q
    ON q.query_text_id = qt.query_text_id
JOIN sys.query_store_plan AS p
    ON p.query_id = q.query_id
JOIN sys.query_store_runtime_stats AS rs
    ON rs.plan_id = p.plan_id
JOIN sys.query_store_runtime_stats_interval AS rsi
    ON rsi.runtime_stats_interval_id = rs.runtime_stats_interval_id
ORDER BY rsi.start_time DESC;
```

This query shape is a common interview-level way to show how Query Store connects query text, plans, and runtime history.

### Why Plan Cache Alone Is Not Enough

The plan cache stores plans that are currently cached. It does not guarantee long-term history. Plans can disappear because of:

- Memory pressure.
- Server restart or failover.
- Database option changes.
- Statistics updates.
- Recompilation.
- Manual cache clearing.

Query Store persists historical plan and runtime information in the user database. That makes it better for regression investigation, upgrade validation, and post-incident analysis.

Plan cache is useful for current state. Query Store is useful for historical state.

### Regression Detection

A query regression means a query now performs worse than a previous baseline. Query Store can help identify regressions by comparing recent runtime statistics to historical runtime statistics.

Common regression signals include:

- Average duration increased.
- CPU time increased.
- Logical reads increased.
- Physical reads increased.
- Memory consumption increased.
- Wait time increased.
- A query started using a different plan.
- A plan that used to seek now scans.
- A plan now spills to tempdb.

A simple historical comparison might look like this:

```sql
DECLARE @recent_start datetimeoffset = DATEADD(hour, -1, SYSUTCDATETIME());
DECLARE @history_start datetimeoffset = DATEADD(day, -1, SYSUTCDATETIME());

WITH query_runtime AS (
    SELECT
        p.query_id,
        p.plan_id,
        rsi.start_time,
        SUM(rs.avg_duration * rs.count_executions) / NULLIF(SUM(rs.count_executions), 0) AS weighted_avg_duration,
        SUM(rs.count_executions) AS execution_count
    FROM sys.query_store_plan AS p
    JOIN sys.query_store_runtime_stats AS rs
        ON rs.plan_id = p.plan_id
    JOIN sys.query_store_runtime_stats_interval AS rsi
        ON rsi.runtime_stats_interval_id = rs.runtime_stats_interval_id
    WHERE rsi.start_time >= @history_start
    GROUP BY p.query_id, p.plan_id, rsi.start_time
)
SELECT
    query_id,
    plan_id,
    AVG(CASE WHEN start_time >= @recent_start THEN weighted_avg_duration END) AS recent_duration,
    AVG(CASE WHEN start_time < @recent_start THEN weighted_avg_duration END) AS historical_duration
FROM query_runtime
GROUP BY query_id, plan_id
HAVING
    AVG(CASE WHEN start_time >= @recent_start THEN weighted_avg_duration END)
        > 2 * AVG(CASE WHEN start_time < @recent_start THEN weighted_avg_duration END);
```

The exact query is less important than the reasoning: compare representative recent performance to a previous baseline, and do it per query and per plan.

### Plan History

Plan history helps answer whether performance changed because the optimizer selected a different plan. A query can have multiple plans because of:

- Statistics changes.
- Index changes.
- Schema changes.
- Parameter-sensitive behavior.
- Compatibility level changes.
- Query Store hints or plan forcing changes.
- Recompilation under different SET options.

Queries with many plans are worth investigating because multiple plans can indicate plan instability or parameter-sensitive workload behavior.

```sql
SELECT
    q.query_id,
    COUNT(DISTINCT p.plan_id) AS plan_count,
    MIN(p.last_compile_start_time) AS first_compile_time,
    MAX(p.last_compile_start_time) AS last_compile_time,
    qt.query_sql_text
FROM sys.query_store_query AS q
JOIN sys.query_store_query_text AS qt
    ON qt.query_text_id = q.query_text_id
JOIN sys.query_store_plan AS p
    ON p.query_id = q.query_id
GROUP BY q.query_id, qt.query_sql_text
HAVING COUNT(DISTINCT p.plan_id) > 1
ORDER BY plan_count DESC;
```

In interviews, a good answer should connect multiple plans to the business symptom. A query can have many plans but still perform acceptably. The goal is to find expensive, unstable, or recently regressed queries.

### Runtime Statistics Intervals

Query Store aggregates runtime statistics into intervals instead of storing one row per execution. This reduces storage overhead and makes trend analysis practical.

Important implications:

- You usually compare intervals, not individual executions.
- Very short spikes can be smoothed out.
- Weighted averages are better than naive averages when execution counts differ.
- Time windows should match the workload pattern.

For example, comparing a busy business hour to a quiet overnight hour can produce misleading results. A better baseline compares similar workload windows.

### Wait Statistics In Query Store

Query Store can capture wait statistics by query and plan. This helps distinguish why a query is slow:

- High CPU wait categories can suggest CPU pressure or inefficient operators.
- Lock waits can suggest blocking.
- Memory waits can suggest excessive memory grants or concurrency pressure.
- Buffer I/O waits can suggest heavy reads, missing indexes, or storage pressure.

Example:

```sql
SELECT TOP (20)
    q.query_id,
    p.plan_id,
    ws.wait_category_desc,
    SUM(ws.total_query_wait_time_ms) AS total_wait_ms
FROM sys.query_store_wait_stats AS ws
JOIN sys.query_store_plan AS p
    ON p.plan_id = ws.plan_id
JOIN sys.query_store_query AS q
    ON q.query_id = p.query_id
GROUP BY q.query_id, p.plan_id, ws.wait_category_desc
ORDER BY total_wait_ms DESC;
```

Wait data should be interpreted with runtime metrics and plans. A wait category tells you where time was spent, not necessarily the root cause by itself.

### Query Store Reports

SQL Server Management Studio includes Query Store reports such as:

- Regressed Queries.
- Overall Resource Consumption.
- Top Resource Consuming Queries.
- Queries With Forced Plans.
- Queries With High Variation.
- Query Wait Statistics.

These reports are useful in interviews because they show practical troubleshooting flow. You can begin with Regressed Queries, identify the affected query, compare plans, inspect runtime metrics, and decide whether to tune, force a known good plan, or apply a Query Store hint.

### Plan Forcing

Plan forcing tells SQL Server to prefer a specific Query Store plan for a query.

```sql
EXEC sys.sp_query_store_force_plan
    @query_id = 42,
    @plan_id = 7;
```

Plan forcing can quickly mitigate a regression when:

- The old plan is known to be better for the current workload.
- The regression is caused by a plan choice change.
- You need a fast operational fix while investigating the root cause.

Plan forcing is not a universal fix. It can fail, become stale, or make performance worse when data distribution changes. A strong interview answer treats it as controlled mitigation, not magic.

To remove plan forcing:

```sql
EXEC sys.sp_query_store_unforce_plan
    @query_id = 42,
    @plan_id = 7;
```

### Automatic Plan Correction

Automatic plan correction can detect plan choice regressions and force the last known good plan. It depends on Query Store because Query Store provides the plan and runtime history needed to compare behavior.

This is useful during compatibility-level upgrades or after deployments where plan regressions are possible. However, teams still need monitoring because automatic correction addresses plan choice regressions, not every performance problem.

For interviews, explain that automatic tuning watches the workload, applies a corrective action such as forcing a previous good plan, and continues monitoring so it can stop or revert if the correction does not help.

### Query Store Hints

Query Store hints let you apply certain query hints without changing application SQL text. This is helpful when SQL is generated by an ORM, hard-coded in an application, or difficult to deploy quickly.

Example:

```sql
EXEC sys.sp_query_store_set_hints
    @query_id = 42,
    @value = N'OPTION (MAXDOP 1)';
```

Query Store hints can be useful for:

- Temporarily disabling a problematic optimizer behavior.
- Applying `RECOMPILE` for a specific query.
- Controlling memory grants.
- Testing compatibility-level behavior for one query.

Use hints carefully. They should be documented, monitored, and revisited because they can hide the underlying issue.

### Query Store Configuration

Important configuration areas include:

- Operation mode: `READ_WRITE` or read-only.
- Capture mode: which queries are captured.
- Max storage size.
- Retention period.
- Stale query cleanup.
- Runtime statistics interval length.
- Wait statistics capture.
- Maximum plans per query.

Basic enablement:

```sql
ALTER DATABASE SalesDb
SET QUERY_STORE = ON
(
    OPERATION_MODE = READ_WRITE,
    WAIT_STATS_CAPTURE_MODE = ON
);
```

In SQL Server 2022 and newer, Query Store is enabled by default for new databases. In older versions, it may need to be enabled manually.

### Operational Risks

Query Store is powerful but still has operational trade-offs:

- It uses database storage.
- It can become read-only if storage limits are reached.
- Aggressive capture settings can collect too much low-value query data.
- High-frequency ad hoc workloads can create many query texts and plans.
- Forced plans can become inappropriate as data changes.
- Max plans per query can matter for plan-unstable or parameter-sensitive workloads.

Good operations include checking Query Store state, right-sizing storage, cleaning stale data, monitoring forced plans, and using capture settings that match workload volume.

```sql
SELECT
    actual_state_desc,
    desired_state_desc,
    current_storage_size_mb,
    max_storage_size_mb,
    readonly_reason,
    query_capture_mode_desc
FROM sys.database_query_store_options;
```

### Query Store In Upgrade Testing

Query Store is especially useful during SQL Server upgrades and database compatibility level changes. A typical workflow is:

- Enable Query Store before the change.
- Let it capture a representative baseline.
- Apply the upgrade or compatibility change.
- Compare performance before and after.
- Identify regressed queries.
- Use plan forcing, Query Store hints, indexing, statistics updates, or query rewrites as appropriate.

This is a strong interview example because it shows controlled risk management rather than reactive tuning after users complain.

### Common Mistakes

Common mistakes include:

- Enabling Query Store but never checking its state.
- Comparing nonrepresentative time windows.
- Looking only at average duration and ignoring execution count.
- Treating a high plan count as automatically bad.
- Forcing a plan without understanding why it was better.
- Leaving forced plans forever without review.
- Ignoring waits, reads, CPU, and row counts.
- Forgetting that Query Store records history only after it is enabled.
- Using Query Store as a replacement for proper indexing and query design.

### Best Practices

Best practices include:

- Enable Query Store before major changes so you have a baseline.
- Compare recent performance against representative historical windows.
- Prioritize queries by business impact and total resource consumption.
- Investigate plan changes alongside statistics, indexes, deployments, and parameter values.
- Use plan forcing as a reversible mitigation.
- Document every forced plan or Query Store hint.
- Monitor forced plan failures and Query Store read-only state.
- Prefer root-cause fixes when practical.
- Keep Query Store configuration aligned with workload volume.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is Query Store in SQL Server?

<!-- question:start:query-store-for-regression-detection-and-plan-history-beginner-q01 -->
<!-- question-id:query-store-for-regression-detection-and-plan-history-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

Query Store is a SQL Server feature that captures query text, execution plans, runtime statistics, and optionally wait statistics over time. It helps troubleshoot query performance by showing how a query behaved historically, which plans it used, and whether performance changed after a plan change, deployment, statistics update, or upgrade.

Unlike the plan cache, Query Store is designed for historical analysis. The plan cache only shows currently cached plans and can lose information after restart, memory pressure, or recompilation. Query Store persists data in the database and makes it easier to compare performance across time windows.

##### Key Points to Mention

- Captures query text, plans, runtime stats, and wait stats.
- Useful for historical performance troubleshooting.
- Helps detect plan regressions.
- More durable for analysis than the current plan cache.
- Available in SQL Server, Azure SQL Database, and related Microsoft SQL platforms.

<!-- question:end:query-store-for-regression-detection-and-plan-history-beginner-q01 -->

#### Why is Query Store useful for performance regression troubleshooting?

<!-- question:start:query-store-for-regression-detection-and-plan-history-beginner-q02 -->
<!-- question-id:query-store-for-regression-detection-and-plan-history-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

Query Store is useful because regressions are usually discovered after the bad plan or bad behavior has already happened. It lets you compare recent performance to historical performance and see whether the query started using a different execution plan. This helps narrow the problem from "the database is slow" to a specific query, plan, time window, and metric.

For example, if a query's average duration doubled after a statistics update, Query Store can show the old plan, the new plan, runtime stats for each plan, and when the change occurred.

##### Key Points to Mention

- Regressions are detected by comparing time windows.
- Query Store can show plan changes.
- Metrics include duration, CPU, reads, writes, row counts, and waits.
- It helps connect performance changes to deployments or database changes.
- It supports faster root-cause analysis.

<!-- question:end:query-store-for-regression-detection-and-plan-history-beginner-q02 -->

#### What is the difference between Query Store and the plan cache?

<!-- question:start:query-store-for-regression-detection-and-plan-history-beginner-q03 -->
<!-- question-id:query-store-for-regression-detection-and-plan-history-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

The plan cache contains execution plans that are currently cached for reuse. It is volatile and can lose entries because of memory pressure, server restart, failover, recompilation, or manual cache clearing. Query Store stores query and plan history in the database so you can analyze past performance even after the current plan cache has changed.

Plan cache is better for inspecting current cached plans. Query Store is better for trend analysis, regression detection, plan history, and comparing performance before and after changes.

##### Key Points to Mention

- Plan cache is current and volatile.
- Query Store is historical and persisted.
- Plan cache can lose plans.
- Query Store stores runtime statistics over time.
- Use Query Store for before-and-after comparisons.

<!-- question:end:query-store-for-regression-detection-and-plan-history-beginner-q03 -->

#### What kinds of metrics can Query Store help compare?

<!-- question:start:query-store-for-regression-detection-and-plan-history-beginner-q04 -->
<!-- question-id:query-store-for-regression-detection-and-plan-history-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Query Store can compare execution duration, CPU time, logical reads, physical reads, writes, row counts, execution counts, memory-related metrics, and wait statistics when wait capture is enabled. These metrics are aggregated into runtime intervals, which makes it possible to analyze trends over time.

A good performance investigation usually looks at multiple metrics. Duration alone can be misleading if execution count, row count, blocking, CPU, or I/O changed.

##### Key Points to Mention

- Duration and CPU.
- Logical and physical reads.
- Execution count and row count.
- Wait statistics when enabled.
- Compare metrics across representative time windows.

<!-- question:end:query-store-for-regression-detection-and-plan-history-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### How would you use Query Store to find a regressed query?

<!-- question:start:query-store-for-regression-detection-and-plan-history-intermediate-q01 -->
<!-- question-id:query-store-for-regression-detection-and-plan-history-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

Start by choosing a relevant recent time window, such as the last hour when users reported slowness, and compare it to a representative historical baseline. Use the Regressed Queries report or Query Store catalog views to find queries whose duration, CPU, reads, or wait time increased. Then inspect whether the regressed query changed plans, whether execution count changed, and whether the plan shape explains the new cost.

After identifying the query, compare the previous good plan with the current bad plan. Look for changes such as scans replacing seeks, different join strategies, missing indexes, spills, bad cardinality estimates, or parameter-sensitive behavior.

##### Key Points to Mention

- Pick representative recent and historical windows.
- Compare weighted metrics, not just raw averages.
- Check if the query has multiple plans.
- Compare good and bad plans.
- Tie findings to changes in statistics, indexes, code, data volume, or compatibility level.

<!-- question:end:query-store-for-regression-detection-and-plan-history-intermediate-q01 -->

#### What does it mean to force a plan in Query Store?

<!-- question:start:query-store-for-regression-detection-and-plan-history-intermediate-q02 -->
<!-- question-id:query-store-for-regression-detection-and-plan-history-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Forcing a plan tells SQL Server to try to use a specific execution plan that Query Store has already captured for a query. It is often used as a fast mitigation when a query regressed because the optimizer selected a worse plan than before.

Plan forcing should be used carefully. It can stabilize performance quickly, but the forced plan may become inappropriate as data distribution, indexes, or workload patterns change. It should be monitored and treated as a reversible operational decision.

##### Key Points to Mention

- Uses a captured Query Store plan.
- Can mitigate plan choice regression quickly.
- Done with `sys.sp_query_store_force_plan`.
- Remove with `sys.sp_query_store_unforce_plan`.
- Monitor forced plan failures and revisit later.

<!-- question:end:query-store-for-regression-detection-and-plan-history-intermediate-q02 -->

#### How can Query Store help during a SQL Server upgrade or compatibility level change?

<!-- question:start:query-store-for-regression-detection-and-plan-history-intermediate-q03 -->
<!-- question-id:query-store-for-regression-detection-and-plan-history-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Before an upgrade or compatibility level change, enable Query Store and let it capture a representative workload baseline. After the change, compare the same queries across the before-and-after windows. Query Store can reveal which queries improved, which regressed, and whether regressions are tied to different plans.

If a critical query regresses, you can use plan forcing or Query Store hints as a temporary mitigation while you investigate statistics, indexing, query design, or optimizer behavior under the new compatibility level.

##### Key Points to Mention

- Capture a baseline before the change.
- Compare equivalent workload periods.
- Identify regressed queries and plan changes.
- Use plan forcing or hints for targeted mitigation.
- Avoid rolling back the whole upgrade for one query if a targeted fix is possible.

<!-- question:end:query-store-for-regression-detection-and-plan-history-intermediate-q03 -->

#### What are Query Store hints and when are they useful?

<!-- question:start:query-store-for-regression-detection-and-plan-history-intermediate-q04 -->
<!-- question-id:query-store-for-regression-detection-and-plan-history-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Query Store hints let you apply supported query hints to a captured query without changing the application SQL text. They are useful when the SQL is generated by an ORM, embedded in vendor code, difficult to deploy quickly, or when a team wants a targeted operational mitigation.

Examples include applying a recompile hint, limiting maximum degree of parallelism, changing memory grant behavior, or disabling a specific optimizer behavior for one query. They should be used carefully because hints can become stale and can mask the root cause.

##### Key Points to Mention

- Applies hints through Query Store.
- Does not require changing application SQL.
- Useful for targeted mitigation.
- Can help with ORM or vendor-generated SQL.
- Should be documented, monitored, and revisited.

<!-- question:end:query-store-for-regression-detection-and-plan-history-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### What are the risks of forcing a plan?

<!-- question:start:query-store-for-regression-detection-and-plan-history-advanced-q01 -->
<!-- question-id:query-store-for-regression-detection-and-plan-history-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Forcing a plan can stabilize a regressed query, but it can also lock the query into a plan that is no longer appropriate. Data distribution can change, indexes can be added or removed, table size can grow, and the workload can shift. A plan that was good for yesterday's parameter values may be bad for today's.

Plan forcing can also fail if the plan is no longer valid. For example, schema changes may prevent SQL Server from applying the forced plan. Forced plans should be monitored, documented, and periodically reviewed. A mature answer treats plan forcing as a mitigation while the team investigates root causes such as statistics, indexes, query shape, or parameter sensitivity.

##### Key Points to Mention

- Forced plans can become stale.
- They can fail after schema or index changes.
- They may be bad for different parameter values.
- They should be monitored and reviewed.
- Prefer root-cause fixes when feasible.

<!-- question:end:query-store-for-regression-detection-and-plan-history-advanced-q01 -->

#### How would you distinguish a plan regression from increased workload volume?

<!-- question:start:query-store-for-regression-detection-and-plan-history-advanced-q02 -->
<!-- question-id:query-store-for-regression-detection-and-plan-history-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Compare per-execution metrics and total workload metrics separately. If total CPU increased because execution count doubled but average duration and reads per execution stayed stable, that is likely workload growth rather than a plan regression. If average duration, reads, CPU per execution, or wait time per execution increased while execution count stayed similar, a plan or data distribution issue is more likely.

Also check whether the query changed plans during the regression window. If the plan ID changed and the new plan has worse per-execution metrics, that supports a plan regression. If the plan stayed the same, investigate data volume, blocking, memory pressure, stale statistics, or infrastructure pressure.

##### Key Points to Mention

- Separate total cost from per-execution cost.
- Check execution count changes.
- Compare plan IDs across time windows.
- Look at reads, CPU, duration, waits, and row counts.
- Increased workload is not the same as a worse plan.

<!-- question:end:query-store-for-regression-detection-and-plan-history-advanced-q02 -->

#### How do runtime statistics intervals affect Query Store analysis?

<!-- question:start:query-store-for-regression-detection-and-plan-history-advanced-q03 -->
<!-- question-id:query-store-for-regression-detection-and-plan-history-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Query Store aggregates runtime stats into intervals, so analysis is based on summarized behavior rather than each individual execution. This makes historical storage efficient but requires careful interpretation. Short spikes may be hidden in averages, and comparing a busy interval to a quiet interval can produce misleading conclusions.

When comparing periods, use representative windows and weighted calculations where needed. For example, average duration should often be weighted by execution count, because an interval with one slow execution should not have the same influence as an interval with thousands of executions.

##### Key Points to Mention

- Runtime stats are aggregated into intervals.
- Choose representative comparison windows.
- Be careful with averages.
- Weight metrics by execution count when appropriate.
- Spikes can be smoothed by interval aggregation.

<!-- question:end:query-store-for-regression-detection-and-plan-history-advanced-q03 -->

#### How would you operationalize Query Store in a production environment?

<!-- question:start:query-store-for-regression-detection-and-plan-history-advanced-q04 -->
<!-- question-id:query-store-for-regression-detection-and-plan-history-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

Operationalizing Query Store means enabling it with settings appropriate for the workload, monitoring its health, and integrating it into performance review workflows. A team should check whether Query Store is read-write, whether storage limits are close to being hit, whether cleanup is working, and whether forced plans or hints exist.

For performance operations, Query Store should be used during deployments, upgrades, incident reviews, and routine tuning. Forced plans and Query Store hints should be documented with an owner, reason, date, expected removal condition, and monitoring strategy.

##### Key Points to Mention

- Monitor `sys.database_query_store_options`.
- Size storage and retention appropriately.
- Enable wait stats when useful.
- Review forced plans and hints.
- Use Query Store for baselines, deployments, upgrades, and incident analysis.

<!-- question:end:query-store-for-regression-detection-and-plan-history-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
