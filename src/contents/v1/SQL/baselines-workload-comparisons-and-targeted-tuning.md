---
id: baselines-workload-comparisons-and-targeted-tuning
topic: Query tuning, Query Store, and plan stability
subtopic: Baselines, workload comparisons, and targeted tuning
category: SQL
---

## Overview

Baselines, workload comparisons, and targeted tuning are the discipline of improving SQL Server performance with evidence instead of guesswork. A baseline captures normal performance for a representative workload. A workload comparison shows what changed between two periods, deployments, compatibility levels, or tuning attempts. Targeted tuning focuses effort on the few queries, indexes, schema choices, or configuration settings that actually move user-facing performance, throughput, stability, or cost.

This topic matters because database performance problems are rarely solved by optimizing random expensive-looking queries. A query that is slow once may not matter to the business. A query that is only moderately slow but runs 100,000 times per hour may dominate CPU, I/O, and user latency. Baselines and workload comparisons help distinguish real regressions from normal variance, workload growth, blocking, bad plans, stale statistics, missing indexes, and application behavior changes.

For interviews, this topic is important because it tests how you troubleshoot production systems. Strong candidates can describe what to measure, how to compare before and after results, how Query Store helps, how to avoid misleading averages, and how to choose focused tuning actions with a measurable success condition.

## Core Concepts

### What A Baseline Is

A baseline is a recorded picture of normal workload behavior. It gives you a reference point for deciding whether performance has changed.

A useful SQL Server baseline usually includes:

- Query duration.
- CPU time.
- Logical reads.
- Physical reads.
- Writes.
- Execution count.
- Row count.
- Wait categories.
- Plan IDs and plan shapes.
- Blocking and deadlock frequency.
- Database and server resource usage.
- Business timing, such as peak hours, batch windows, and reporting periods.

The best baseline is not one number. It is a set of metrics over representative time windows.

### Why Baselines Matter

Without a baseline, every performance discussion becomes a loose story:

- "It feels slower."
- "CPU is high."
- "This query looks expensive."
- "The new release probably caused it."

With a baseline, you can ask better questions:

- Did average duration change for the same query?
- Did execution count increase?
- Did the plan change?
- Did logical reads per execution increase?
- Did waits move from CPU to locks or I/O?
- Did a deployment, index change, statistics update, or data load line up with the regression?

Baselines turn tuning into comparison.

### Workload Comparisons

A workload comparison compares two sets of workload data. Common comparisons include:

- Before vs after a deployment.
- Before vs after a database compatibility level change.
- Before vs after an index change.
- Before vs after a query rewrite.
- Peak hour today vs peak hour last week.
- Current month-end batch vs last month-end batch.
- Primary workload vs readable secondary workload.
- Test run A vs test run B.

The key is to compare similar conditions. Comparing a quiet overnight window to a busy morning peak can mislead you.

### Query Store As A Baseline Tool

Query Store is one of the most useful SQL Server tools for baselining because it records query text, plan history, runtime statistics, and wait statistics over time. It lets you compare query behavior across runtime intervals and plans.

Common Query Store questions include:

- Which queries consumed the most CPU in the last hour?
- Which queries had the highest total duration?
- Which queries regressed compared with a previous period?
- Which queries changed plans?
- Which queries have high variation?
- Which queries have high lock, memory, CPU, or I/O waits?

Example query for recent top CPU consumers:

```sql
SELECT TOP (20)
    q.query_id,
    p.plan_id,
    qt.query_sql_text,
    SUM(rs.avg_cpu_time * rs.count_executions) AS total_cpu,
    SUM(rs.count_executions) AS executions,
    SUM(rs.avg_duration * rs.count_executions) AS total_duration
FROM sys.query_store_query_text AS qt
JOIN sys.query_store_query AS q
    ON q.query_text_id = qt.query_text_id
JOIN sys.query_store_plan AS p
    ON p.query_id = q.query_id
JOIN sys.query_store_runtime_stats AS rs
    ON rs.plan_id = p.plan_id
JOIN sys.query_store_runtime_stats_interval AS rsi
    ON rsi.runtime_stats_interval_id = rs.runtime_stats_interval_id
WHERE rsi.start_time >= DATEADD(hour, -1, SYSUTCDATETIME())
GROUP BY q.query_id, p.plan_id, qt.query_sql_text
ORDER BY total_cpu DESC;
```

The important idea is to rank by total workload impact, not just one execution.

### Representative Time Windows

Choosing the wrong comparison window is a common tuning mistake.

Good comparison windows are:

- Similar in business activity.
- Long enough to smooth noise.
- Short enough to isolate the change.
- Aligned with the incident or deployment.
- Aware of batch jobs and background processes.

Examples:

- Compare Tuesday 9:00-10:00 AM to last Tuesday 9:00-10:00 AM.
- Compare the hour before deployment to the hour after deployment only if traffic is stable.
- Compare the same month-end batch step across months.
- Compare a test replay with the same data volume and parameter mix.

Avoid comparing unrelated periods unless you explicitly account for differences.

### Per-Execution Metrics Vs Total Workload

You need both per-execution and total metrics.

Total metrics answer: "What is hurting the system overall?"

Per-execution metrics answer: "Did this query become less efficient?"

Example:

- Query A runs once and takes 30 seconds.
- Query B runs 200,000 times and takes 20 milliseconds each.

Query A has the worst single execution. Query B may consume more total CPU and user time.

Weighted averages help avoid misleading comparisons:

```sql
SELECT
    p.query_id,
    SUM(rs.avg_duration * rs.count_executions)
        / NULLIF(SUM(rs.count_executions), 0) AS weighted_avg_duration,
    SUM(rs.count_executions) AS execution_count,
    SUM(rs.avg_logical_io_reads * rs.count_executions) AS total_logical_reads
FROM sys.query_store_plan AS p
JOIN sys.query_store_runtime_stats AS rs
    ON rs.plan_id = p.plan_id
GROUP BY p.query_id
ORDER BY total_logical_reads DESC;
```

This treats an interval with many executions as more important than an interval with one execution.

### Regression Detection

A regression is a meaningful performance drop compared with a baseline. It might show up as:

- Higher duration.
- Higher CPU.
- Higher logical reads.
- Higher physical reads.
- More lock waits.
- More memory grant waits.
- More tempdb spills.
- Lower throughput.
- More timeouts.
- A different execution plan.

Not every increase is a regression. More total CPU might simply mean more users or more executions. A true efficiency regression usually appears in per-execution cost, plan shape, row estimates, waits, or error rates.

### Targeted Tuning

Targeted tuning means selecting changes based on measurable workload impact.

A typical targeted tuning workflow:

- Identify top workload contributors.
- Confirm the business symptom.
- Inspect Query Store, actual plans, waits, and data distribution.
- Form a hypothesis.
- Make the smallest useful change.
- Test with representative parameters and data volume.
- Compare before and after metrics.
- Monitor production after release.

The goal is not to make every query perfect. The goal is to remove the bottleneck that matters.

### Choosing What To Tune First

Prioritize by impact and risk.

High-value candidates usually have:

- High total CPU.
- High total logical reads.
- High execution count.
- High user-facing latency.
- Frequent timeouts.
- Important business workflow impact.
- Clear regression after a change.
- A plan problem with a plausible fix.

Lower priority candidates include:

- Rare admin queries.
- Slow queries outside the critical path.
- Queries with high duration but tiny business impact.
- Queries already dominated by external waits.
- Queries where the proposed fix has high risk and low benefit.

### Before And After Validation

A tuning change is not done when the query is faster once. You need before-and-after validation.

Compare:

- Duration per execution.
- Total duration.
- CPU per execution.
- Total CPU.
- Logical reads.
- Physical reads.
- Writes.
- Execution count.
- Row counts.
- Wait categories.
- Plan shape.
- Memory grants.
- tempdb spills.
- Blocking impact.

A simple before/after table can prevent vague claims:

| Metric | Before | After | Better? |
| --- | ---: | ---: | --- |
| Avg duration | 850 ms | 120 ms | Yes |
| Avg CPU | 700 ms | 95 ms | Yes |
| Avg logical reads | 120,000 | 8,500 | Yes |
| Executions per hour | 5,000 | 5,200 | Similar |
| Plan changed | Scan + hash join | Seek + nested loops | Expected |

### Testing With Representative Parameters

SQL Server performance can vary by parameter value. A query that improves for one parameter can worsen for another.

Representative testing includes:

- Common parameter values.
- Rare parameter values.
- Large tenant and small tenant cases.
- Empty result cases.
- Peak data ranges.
- Recent and historical date ranges.
- High-cardinality and low-cardinality filters.

This is especially important before forcing a plan, adding a hint, or changing an index.

### Targeted Index Tuning

Index tuning should come from workload evidence, not wishful thinking.

Good index candidates are tied to:

- Frequent predicates.
- Join columns.
- Sort and grouping patterns.
- Covering needs for hot queries.
- Selectivity and data distribution.
- Existing index overlap.
- Write cost and maintenance cost.

Example:

```sql
CREATE INDEX IX_Orders_CustomerId_OrderDate
ON dbo.Orders (CustomerId, OrderDate DESC)
INCLUDE (OrderStatus, TotalAmount);
```

This may be useful if the workload often retrieves recent orders for one customer and needs `OrderStatus` and `TotalAmount` without lookups.

Do not create indexes only because one execution plan suggests a missing index. Validate the workload, existing indexes, write cost, and whether modifying an existing index is better.

### Query Rewrites

Sometimes the best tuning target is SQL text, not indexing.

Common query issues include:

- Non-SARGable predicates.
- Functions wrapped around indexed columns.
- Implicit conversions.
- Unnecessary `SELECT *`.
- Optional filters that force generic plans.
- Correlated subqueries that can be rewritten clearly.
- Joins that multiply rows accidentally.
- Filters applied after unnecessary work.

Example non-SARGable predicate:

```sql
-- Harder to seek efficiently
WHERE YEAR(OrderDate) = 2026;
```

Better range predicate:

```sql
WHERE OrderDate >= '20260101'
  AND OrderDate <  '20270101';
```

This kind of rewrite can reduce reads without adding a new index.

### Workload-Level Trade-Offs

Tuning one query can hurt another. Every index, schema change, query rewrite, or hint has a workload trade-off.

Examples:

- Adding an index can speed reads but slow writes.
- Covering one query with a wide index can increase storage and memory pressure.
- Forcing a plan can help one parameter value and hurt another.
- Rewriting a query can change locking behavior.
- Denormalization can improve reads but complicate writes and consistency.
- Reducing duration can increase CPU if the new plan uses more parallelism.

A good tuning decision considers the whole workload.

### Common Mistakes

Common mistakes include:

- Tuning the slowest single query instead of the largest workload contributor.
- Comparing nonrepresentative time windows.
- Looking only at average duration.
- Ignoring execution count.
- Ignoring logical reads and CPU.
- Ignoring waits and blocking.
- Declaring success after one test execution.
- Creating duplicate or speculative indexes.
- Using hints before understanding the root cause.
- Failing to monitor after deployment.

### Best Practices

Best practices include:

- Enable Query Store before major changes.
- Capture a representative baseline.
- Compare similar workload windows.
- Rank candidates by total workload impact and business priority.
- Validate with actual execution plans and Query Store history.
- Test with representative parameter values.
- Prefer small, targeted, reversible changes.
- Measure both per-execution efficiency and total workload impact.
- Document what changed, why it changed, and how success is measured.
- Revisit tuning decisions as data and workload patterns change.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is a SQL Server performance baseline?

<!-- question:start:baselines-workload-comparisons-and-targeted-tuning-beginner-q01 -->
<!-- question-id:baselines-workload-comparisons-and-targeted-tuning-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A performance baseline is a recorded picture of normal database workload behavior. It usually includes query duration, CPU, reads, writes, execution counts, waits, plans, and resource usage over representative time windows. The baseline gives you something concrete to compare against when users report slowness, a deployment changes behavior, or a tuning change is tested.

Without a baseline, it is hard to know whether performance is actually worse, whether workload volume increased, or whether the system is behaving normally for that time period.

##### Key Points to Mention

- Captures normal workload behavior.
- Includes query and system metrics.
- Must use representative time windows.
- Enables before-and-after comparison.
- Helps separate real regressions from noise.

<!-- question:end:baselines-workload-comparisons-and-targeted-tuning-beginner-q01 -->

#### Why is workload comparison better than tuning one slow query in isolation?

<!-- question:start:baselines-workload-comparisons-and-targeted-tuning-beginner-q02 -->
<!-- question-id:baselines-workload-comparisons-and-targeted-tuning-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

Workload comparison shows which queries matter most to the whole system. A query that is slow once may have little business impact, while a query that is moderately slow but runs thousands of times per minute may consume most of the CPU or I/O. Tuning in isolation can also make one query faster while hurting writes, memory, concurrency, or other queries.

Workload comparison helps prioritize changes based on total impact and validates whether the overall system improved after the change.

##### Key Points to Mention

- Total workload impact matters.
- Execution count changes priority.
- One-query improvements can hurt the wider workload.
- Compare before and after results.
- Tune the bottleneck that affects users or cost.

<!-- question:end:baselines-workload-comparisons-and-targeted-tuning-beginner-q02 -->

#### What metrics should you compare before and after tuning?

<!-- question:start:baselines-workload-comparisons-and-targeted-tuning-beginner-q03 -->
<!-- question-id:baselines-workload-comparisons-and-targeted-tuning-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

Compare duration, CPU, logical reads, physical reads, writes, execution count, row count, wait categories, plan shape, memory grants, tempdb spills, blocking, and user-facing error or timeout rates. Duration alone is not enough because a query can become faster by using more CPU, or total cost can increase because execution count increased.

The best comparison includes both per-execution metrics and total workload metrics.

##### Key Points to Mention

- Duration, CPU, reads, writes, and waits.
- Execution count and row count.
- Plan shape and memory grant changes.
- User-facing timeouts or errors.
- Per-execution and total workload metrics.

<!-- question:end:baselines-workload-comparisons-and-targeted-tuning-beginner-q03 -->

#### What does targeted tuning mean?

<!-- question:start:baselines-workload-comparisons-and-targeted-tuning-beginner-q04 -->
<!-- question-id:baselines-workload-comparisons-and-targeted-tuning-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Targeted tuning means using evidence to focus on the few changes that will meaningfully improve the workload. Instead of randomly adding indexes or rewriting queries, you identify the highest-impact queries or bottlenecks, understand the cause, make a focused change, and compare before-and-after results.

It is practical because most systems have many queries, but only a smaller number usually account for most resource usage or user pain.

##### Key Points to Mention

- Evidence-driven tuning.
- Focuses on high-impact bottlenecks.
- Uses Query Store, execution plans, waits, and metrics.
- Makes small focused changes.
- Validates results after the change.

<!-- question:end:baselines-workload-comparisons-and-targeted-tuning-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### How would you use Query Store to compare performance before and after a deployment?

<!-- question:start:baselines-workload-comparisons-and-targeted-tuning-intermediate-q01 -->
<!-- question-id:baselines-workload-comparisons-and-targeted-tuning-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

I would choose a representative window before the deployment and a comparable window after the deployment. In Query Store, I would compare duration, CPU, logical reads, execution count, waits, and plan IDs for the most important queries. I would look for queries whose per-execution cost increased, whose plan changed, or whose total workload contribution increased unexpectedly.

If a query regressed, I would inspect the old and new plans, check row estimates, indexes, statistics, parameter values, waits, and deployment changes. Then I would test a targeted fix and monitor after release.

##### Key Points to Mention

- Compare similar before-and-after windows.
- Use Query Store runtime stats and plan history.
- Check both total and per-execution metrics.
- Identify plan changes and wait changes.
- Validate any fix after deployment.

<!-- question:end:baselines-workload-comparisons-and-targeted-tuning-intermediate-q01 -->

#### Why are weighted averages useful in Query Store analysis?

<!-- question:start:baselines-workload-comparisons-and-targeted-tuning-intermediate-q02 -->
<!-- question-id:baselines-workload-comparisons-and-targeted-tuning-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Query Store stores runtime statistics in intervals. A simple average across intervals can be misleading because one interval may have one execution and another may have thousands. Weighted averages account for execution count, so high-volume intervals influence the result appropriately.

For example, average duration should often be calculated as the sum of average duration times execution count divided by total executions. That better represents the workload experienced by users.

##### Key Points to Mention

- Query Store aggregates by runtime intervals.
- Intervals can have different execution counts.
- Simple averages can mislead.
- Weight by execution count for workload accuracy.
- Especially useful for before-and-after comparisons.

<!-- question:end:baselines-workload-comparisons-and-targeted-tuning-intermediate-q02 -->

#### How do you avoid tuning the wrong query?

<!-- question:start:baselines-workload-comparisons-and-targeted-tuning-intermediate-q03 -->
<!-- question-id:baselines-workload-comparisons-and-targeted-tuning-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Start from the business symptom and workload impact. Rank queries by total CPU, total duration, total reads, waits, execution count, and user-facing importance. Then confirm that the query is part of the slow workflow or resource bottleneck. A query that looks expensive in isolation may be irrelevant if it runs rarely or outside the critical path.

I would also check whether the query is the cause or a victim. For example, a query with high duration might be blocked by another process, so tuning its SQL text may not solve the real problem.

##### Key Points to Mention

- Tie tuning to business symptoms.
- Rank by total impact, not only single-execution duration.
- Check execution count and waits.
- Distinguish cause from victim.
- Confirm the query is in the critical path.

<!-- question:end:baselines-workload-comparisons-and-targeted-tuning-intermediate-q03 -->

#### What makes a comparison window representative?

<!-- question:start:baselines-workload-comparisons-and-targeted-tuning-intermediate-q04 -->
<!-- question-id:baselines-workload-comparisons-and-targeted-tuning-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

A representative comparison window has similar business activity, traffic level, data volume, parameter mix, and background job activity. It should be close enough to the incident or change to isolate the behavior, but long enough to avoid being dominated by random noise.

For example, comparing Monday peak checkout traffic to Sunday overnight maintenance traffic is not representative. Comparing this Tuesday's 9-10 AM peak to last Tuesday's 9-10 AM peak is usually more meaningful.

##### Key Points to Mention

- Similar traffic and business activity.
- Similar parameter mix and data volume.
- Aware of batch jobs and maintenance windows.
- Long enough to reduce noise.
- Short enough to isolate the change.

<!-- question:end:baselines-workload-comparisons-and-targeted-tuning-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you design a baseline process before a database compatibility level upgrade?

<!-- question:start:baselines-workload-comparisons-and-targeted-tuning-advanced-q01 -->
<!-- question-id:baselines-workload-comparisons-and-targeted-tuning-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

I would enable and verify Query Store well before the upgrade, then capture a representative workload baseline across peak hours, batch windows, and critical business workflows. I would record top queries by CPU, duration, reads, writes, waits, execution count, and plan IDs. I would also document current forced plans, Query Store hints, index changes, and known parameter-sensitive queries.

After the compatibility level change, I would compare similar workload windows and identify regressions, improvements, and plan changes. For critical regressions, I would use targeted mitigations such as Query Store plan forcing, Query Store hints, statistics updates, index changes, or query rewrites while keeping the upgrade scope controlled.

##### Key Points to Mention

- Enable Query Store before the upgrade.
- Capture representative peak and batch baselines.
- Record plans, waits, and top workload contributors.
- Compare equivalent windows after the change.
- Use targeted mitigation instead of blindly rolling back.

<!-- question:end:baselines-workload-comparisons-and-targeted-tuning-advanced-q01 -->

#### How can a tuning change improve one query but hurt the workload?

<!-- question:start:baselines-workload-comparisons-and-targeted-tuning-advanced-q02 -->
<!-- question-id:baselines-workload-comparisons-and-targeted-tuning-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

A tuning change can shift cost elsewhere. Adding a wide covering index may speed one read query but increase storage, memory use, write latency, transaction log volume, and index maintenance. Forcing a plan may help one parameter value but hurt other values. Increasing parallelism may reduce duration but increase CPU pressure and reduce concurrency.

That is why tuning must compare workload-level metrics, not just a single successful execution. The goal is better system behavior for the relevant workload, not a better-looking isolated plan.

##### Key Points to Mention

- Indexes help reads but cost writes and storage.
- Forced plans can hurt different parameter values.
- Parallelism can trade duration for CPU pressure.
- Query rewrites can change locking or row counts.
- Validate workload-level impact.

<!-- question:end:baselines-workload-comparisons-and-targeted-tuning-advanced-q02 -->

#### How would you prove that a tuning change really worked?

<!-- question:start:baselines-workload-comparisons-and-targeted-tuning-advanced-q03 -->
<!-- question-id:baselines-workload-comparisons-and-targeted-tuning-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

I would define success before making the change. For example, reduce weighted average duration by 50 percent, reduce logical reads by 80 percent, remove timeouts, or reduce CPU during peak checkout. Then I would test with representative data and parameter values, compare actual execution plans, and monitor Query Store after deployment across a comparable workload window.

I would also check for side effects: write latency, blocking, memory grants, tempdb spills, plan instability, and impact on other high-volume queries. A change works only if it improves the intended workload without unacceptable regression elsewhere.

##### Key Points to Mention

- Define success criteria upfront.
- Test with representative data and parameters.
- Compare before and after Query Store metrics.
- Inspect actual plans and waits.
- Check for side effects on the wider workload.

<!-- question:end:baselines-workload-comparisons-and-targeted-tuning-advanced-q03 -->

#### How do you handle a regression that appears only during peak load?

<!-- question:start:baselines-workload-comparisons-and-targeted-tuning-advanced-q04 -->
<!-- question-id:baselines-workload-comparisons-and-targeted-tuning-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

I would compare the affected peak window with a similar historical peak window. Then I would look at Query Store metrics, waits, blocking, CPU, memory grants, tempdb, and execution counts. A query may look fine under light load but regress during peak because of concurrency, lock waits, memory pressure, parameter mix, or plan choice under higher volume.

The fix should be tested under realistic concurrency if possible. If an immediate production mitigation is needed, I might use a targeted Query Store force plan or hint, but I would still investigate whether the durable fix is SQL rewrite, index change, statistics maintenance, schema adjustment, or workload throttling.

##### Key Points to Mention

- Compare peak to similar peak.
- Check waits and concurrency, not just query duration.
- Consider parameter mix and execution count changes.
- Test under realistic load.
- Separate emergency mitigation from durable fix.

<!-- question:end:baselines-workload-comparisons-and-targeted-tuning-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
