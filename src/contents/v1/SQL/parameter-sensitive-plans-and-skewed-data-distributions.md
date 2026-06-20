---
id: parameter-sensitive-plans-and-skewed-data-distributions
topic: Query tuning, Query Store, and plan stability
subtopic: Parameter-sensitive plans and skewed data distributions
category: SQL
---

## Overview

Parameter-sensitive plans happen when one reusable execution plan is not equally good for all parameter values. A query might be fast when a parameter matches a small number of rows, but slow when the same cached plan is reused for a parameter that matches millions of rows. This is common when data is skewed, meaning values are not evenly distributed.

This topic matters because many production SQL Server workloads use stored procedures, parameterized SQL, ORMs, and reusable plans. Plan reuse is usually good because it avoids repeated compilation, but it can become a problem when different parameter values need different plan shapes. A selective customer ID might need an index seek and nested loops join. A high-volume customer ID might need a scan, hash join, parallelism, and a larger memory grant.

For interviews, this topic tests whether a candidate understands query optimization beyond syntax. Strong candidates can explain parameter sniffing, cardinality estimation, histograms, skew, plan reuse, Query Store evidence, and modern SQL Server features such as Parameter Sensitive Plan optimization.

## Core Concepts

### Parameter Sensitivity

Parameter sensitivity means query performance depends heavily on the runtime parameter value. A single query shape can have very different row counts depending on the value passed.

Example:

```sql
CREATE OR ALTER PROCEDURE dbo.GetOrdersByCustomer
    @CustomerId int
AS
BEGIN
    SELECT
        OrderId,
        CustomerId,
        OrderDate,
        TotalAmount
    FROM dbo.Orders
    WHERE CustomerId = @CustomerId;
END;
```

If customer `101` has 5 orders and customer `999` has 2,000,000 orders, the optimal plan may be different for each customer. Reusing one cached plan can cause poor performance for one side of the distribution.

### Skewed Data Distributions

A data distribution is skewed when values are unevenly represented.

Examples:

- One tenant has most of the rows in a multi-tenant table.
- Most orders have `Status = 'Completed'`, but very few have `Status = 'PendingReview'`.
- A country column has many rows for `US` and very few for smaller markets.
- A date column has most active queries against recent rows.

Skew matters because the optimizer estimates row counts from statistics. If a predicate value is common, a scan or hash join may be cheaper. If a predicate value is rare, an index seek and nested loops join may be cheaper.

### Parameter Sniffing

Parameter sniffing is the process where SQL Server uses the parameter value available during compilation to estimate cardinality and choose a plan. Parameter sniffing is not automatically bad. It often improves performance because the optimizer can use a real value instead of a generic guess.

The problem occurs when:

- The first compiled value is not representative.
- The cached plan is reused for very different values.
- Data distribution is skewed.
- The query shape has large plan differences between selective and nonselective values.

In interviews, avoid saying "parameter sniffing is bad." The more accurate answer is: parameter sniffing is normal and useful, but it can create parameter-sensitive plan problems under skewed distributions.

### Plan Reuse

SQL Server caches execution plans to avoid recompiling every execution. Reusing plans reduces CPU and improves throughput. However, plan reuse assumes the cached plan is reasonably good for later executions.

Parameter-sensitive workloads break that assumption when one plan cannot serve all values well.

Example plan differences:

- Rare value: index seek, key lookup, nested loops.
- Common value: clustered index scan, hash join, parallel plan.
- Small result: low memory grant.
- Large result: larger memory grant.

The same SQL text can need different physical strategies based on parameter value.

### Cardinality Estimation And Statistics

Cardinality estimation is the optimizer's estimate of how many rows an operator will process. These estimates affect join choice, index access, memory grants, parallelism, and operator ordering.

Statistics contain distribution information such as histograms. Histograms can help estimate row counts for specific values, but they have limits:

- A histogram has a limited number of steps.
- Not every value gets its own histogram entry.
- Correlated columns can be hard to estimate.
- Local variables and expressions can hide useful parameter values.
- Stale statistics can make estimates inaccurate.

When estimated rows differ greatly from actual rows, SQL Server may choose a poor plan.

### Recognizing Parameter-Sensitive Plan Problems

Symptoms include:

- The same stored procedure is fast for one parameter and slow for another.
- Clearing cache or recompiling temporarily "fixes" the query.
- Query Store shows the same query with multiple plans and high performance variation.
- Actual execution plans show large estimated-vs-actual row differences.
- A plan optimized for a rare value performs badly for a common value.
- A plan optimized for a common value performs badly for a rare value.
- Logical reads, CPU, duration, or memory grants vary widely by parameter value.

Diagnostic questions:

- Which parameter values are fast and slow?
- Is data distribution skewed?
- Does the query have one plan or multiple plans?
- Which value compiled the cached plan?
- Are statistics current?
- Does SQL Server version and compatibility level support PSP optimization?

### Query Store Evidence

Query Store is one of the best tools for parameter-sensitive workload investigation. It can show:

- Multiple plans for the same query.
- Runtime statistics per plan.
- High variation in duration or reads.
- Plan history before and after a regression.
- Whether a forced plan helped or hurt.

Queries with multiple plans are not automatically bad, but they are candidates for review.

```sql
SELECT
    q.query_id,
    COUNT(DISTINCT p.plan_id) AS plan_count,
    MIN(rs.avg_duration) AS best_avg_duration,
    MAX(rs.avg_duration) AS worst_avg_duration,
    MAX(rs.avg_duration) / NULLIF(MIN(rs.avg_duration), 0) AS duration_ratio,
    qt.query_sql_text
FROM sys.query_store_query AS q
JOIN sys.query_store_query_text AS qt
    ON qt.query_text_id = q.query_text_id
JOIN sys.query_store_plan AS p
    ON p.query_id = q.query_id
JOIN sys.query_store_runtime_stats AS rs
    ON rs.plan_id = p.plan_id
GROUP BY q.query_id, qt.query_sql_text
HAVING COUNT(DISTINCT p.plan_id) > 1
ORDER BY duration_ratio DESC;
```

This kind of query helps identify plan-unstable statements that deserve deeper analysis.

### Parameter Sensitive Plan Optimization

Parameter Sensitive Plan optimization is a modern SQL Server feature that can generate multiple plan variants for a single parameterized query. Instead of forcing one reusable plan to serve all parameter values, SQL Server can use a dispatcher plan that routes execution to a query variant based on cardinality ranges.

Conceptually:

- SQL Server identifies an eligible parameter-sensitive predicate.
- It creates a dispatcher plan.
- It creates multiple query variants.
- At runtime, the dispatcher evaluates the parameter value.
- SQL Server executes the variant that matches the estimated cardinality range.

This can reduce the need for manual workarounds in skewed workloads.

### Dispatcher Plans And Query Variants

A dispatcher plan is a cached plan that contains the routing logic. Query variants are separate plans optimized for different parameter value ranges.

For example, a query filtering by tenant might have:

- Variant 1 for small tenants.
- Variant 2 for medium tenants.
- Variant 3 for very large tenants.

The variants can use different join strategies, memory grants, index choices, or degrees of parallelism.

This matters for interviews because it shows that SQL Server can now handle some parameter-sensitive cases adaptively, but the feature has eligibility rules and does not remove the need for good schema, indexes, and query design.

### PSP Optimization Requirements And Limits

Parameter Sensitive Plan optimization depends on SQL Server version, database compatibility level, and query eligibility. It is not guaranteed for every parameterized query.

Potential limitations include:

- The query may not match eligible predicate patterns.
- Query variants increase plan cache and Query Store plan counts.
- Query Store `max_plans_per_query` can matter for heavily variant queries.
- Local variables can prevent useful parameter sensitivity.
- Manual hints can disable or override relevant optimizer behavior.
- Bad indexes or stale statistics can still produce poor plans.

Modern engine features help, but they do not fix every modeling or query design problem.

### Optional Parameter Patterns

Optional filters are a common source of parameter-sensitive behavior:

```sql
SELECT
    ProductId,
    CategoryId,
    Name,
    Price
FROM dbo.Products
WHERE CategoryId = @CategoryId
   OR @CategoryId IS NULL;
```

When `@CategoryId` is `NULL`, the query returns all categories and a scan may be reasonable. When it is not `NULL`, an index seek may be better. A single cached plan has to be valid for both cases, which can lead to conservative plans.

Modern SQL Server versions include Optional Parameter Plan Optimization for some optional parameter patterns. Without that feature, common fixes include dynamic SQL, branching, separate procedures, or carefully chosen recompilation.

### Mitigation Strategies

Common mitigation strategies include:

- Updating statistics so estimates reflect current data.
- Creating indexes that support both selective and common values where practical.
- Rewriting the query to separate very different cases.
- Using `OPTION (RECOMPILE)` for statements where per-execution optimization is worth the compile cost.
- Using dynamic SQL with parameterization to produce better plans for optional filters.
- Using `OPTIMIZE FOR` only when a representative value is known.
- Using Query Store plan forcing as a short-term mitigation.
- Using Query Store hints for targeted operational fixes.
- Enabling appropriate compatibility levels for PSP optimization.

No single mitigation is always best. The right choice depends on execution frequency, compile cost, data skew, business criticality, and SQL Server version.

### Branching For Different Selectivity

If parameter values clearly fall into different categories, branching can let each statement compile independently.

```sql
CREATE OR ALTER PROCEDURE dbo.SearchOrders
    @CustomerId int = NULL
AS
BEGIN
    IF @CustomerId IS NULL
    BEGIN
        SELECT OrderId, CustomerId, OrderDate, TotalAmount
        FROM dbo.Orders
        WHERE OrderDate >= DATEADD(day, -7, SYSUTCDATETIME());
    END
    ELSE
    BEGIN
        SELECT OrderId, CustomerId, OrderDate, TotalAmount
        FROM dbo.Orders
        WHERE CustomerId = @CustomerId;
    END
END;
```

This avoids forcing one predicate pattern to handle all cases. It works best when branches are meaningfully different and easy to reason about.

### OPTION RECOMPILE

`OPTION (RECOMPILE)` tells SQL Server to compile the statement for each execution.

```sql
SELECT
    OrderId,
    CustomerId,
    OrderDate
FROM dbo.Orders
WHERE CustomerId = @CustomerId
OPTION (RECOMPILE);
```

Benefits:

- Uses current parameter values.
- Can produce better estimates for skewed values.
- Avoids reusing a bad cached plan.

Trade-offs:

- More compilation CPU.
- Less plan reuse.
- Not ideal for very high-frequency queries.
- Can hide deeper indexing or query design issues.

Use it when execution cost dominates compile cost and parameter values vary enough to require different plans.

### OPTIMIZE FOR

`OPTIMIZE FOR` tells SQL Server to optimize as if a specific parameter value were used.

```sql
SELECT
    OrderId,
    CustomerId,
    OrderDate
FROM dbo.Orders
WHERE CustomerId = @CustomerId
OPTION (OPTIMIZE FOR (@CustomerId = 101));
```

This is useful only when the chosen value is representative enough for the workload. It can make performance worse for other values if distribution is highly skewed.

`OPTIMIZE FOR UNKNOWN` asks SQL Server to use a more generic estimate rather than sniffing the exact value. That can stabilize performance, but it may also prevent excellent plans for selective values.

### Dynamic SQL For Optional Filters

Dynamic SQL can be appropriate when optional filters produce many different query shapes. The goal is to generate only the predicates that are needed while still parameterizing values safely.

```sql
DECLARE @sql nvarchar(max) = N'
SELECT OrderId, CustomerId, Status, OrderDate
FROM dbo.Orders
WHERE 1 = 1';

IF @CustomerId IS NOT NULL
    SET @sql += N' AND CustomerId = @CustomerId';

IF @Status IS NOT NULL
    SET @sql += N' AND Status = @Status';

EXEC sys.sp_executesql
    @sql,
    N'@CustomerId int, @Status varchar(20)',
    @CustomerId = @CustomerId,
    @Status = @Status;
```

The important rule is to parameterize values. Dynamic SQL that concatenates user input is a security problem and a plan-cache problem.

### Common Mistakes

Common mistakes include:

- Blaming parameter sniffing without proving skew or plan reuse issues.
- Disabling parameter sniffing globally for one bad query.
- Using local variables to hide parameters and accepting poor generic estimates.
- Adding `OPTION (RECOMPILE)` everywhere.
- Forcing a plan that is good for one parameter but bad for another.
- Ignoring statistics quality.
- Ignoring data distribution and tenant skew.
- Treating average performance as enough when tail latency matters.
- Using unsafe dynamic SQL.

### Best Practices

Best practices include:

- Confirm the problem with actual plans, Query Store, and representative parameter values.
- Compare estimated and actual row counts.
- Identify whether data is skewed.
- Keep statistics updated.
- Build indexes around real access patterns.
- Use Query Store to observe plan variation and regressions.
- Prefer targeted mitigations over global settings.
- Consider modern PSP optimization behavior before adding manual workarounds.
- Use `OPTION (RECOMPILE)`, `OPTIMIZE FOR`, dynamic SQL, and plan forcing only with a clear reason.
- Revisit mitigations as data and workloads change.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is a parameter-sensitive plan?

<!-- question:start:parameter-sensitive-plans-and-skewed-data-distributions-beginner-q01 -->
<!-- question-id:parameter-sensitive-plans-and-skewed-data-distributions-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A parameter-sensitive plan is a situation where one cached execution plan is not good for all parameter values. The same parameterized query may need different plan shapes depending on whether the parameter is selective or nonselective.

For example, a query for a customer with five orders might work best with an index seek, while a query for a customer with millions of orders might work better with a scan or a different join strategy. If SQL Server reuses the wrong plan, performance can vary dramatically.

##### Key Points to Mention

- Same query, different parameter values.
- One reusable plan may not fit all values.
- Common with skewed data.
- Affects joins, indexes, memory grants, and parallelism.
- Often related to parameter sniffing and plan reuse.

<!-- question:end:parameter-sensitive-plans-and-skewed-data-distributions-beginner-q01 -->

#### What is skewed data distribution?

<!-- question:start:parameter-sensitive-plans-and-skewed-data-distributions-beginner-q02 -->
<!-- question-id:parameter-sensitive-plans-and-skewed-data-distributions-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

Skewed data distribution means values are not evenly spread across a table. Some values occur very frequently, while others occur rarely. This matters because the optimizer chooses plans based on estimated row counts. A common value and a rare value may need different access methods and join strategies.

For example, in a multi-tenant database, one tenant might own half the table while most tenants own only a few rows. A plan optimized for a small tenant may perform badly for the large tenant.

##### Key Points to Mention

- Values are unevenly distributed.
- Common in tenant, status, country, customer, and date columns.
- Affects cardinality estimates.
- Rare and common values may need different plans.
- Causes parameter-sensitive behavior.

<!-- question:end:parameter-sensitive-plans-and-skewed-data-distributions-beginner-q02 -->

#### Is parameter sniffing always bad?

<!-- question:start:parameter-sensitive-plans-and-skewed-data-distributions-beginner-q03 -->
<!-- question-id:parameter-sensitive-plans-and-skewed-data-distributions-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

No. Parameter sniffing is normal optimizer behavior where SQL Server uses the parameter value available during compilation to estimate row counts and choose a plan. It is often beneficial because a real value can produce a better plan than a generic estimate.

It becomes a problem when the compiled value is not representative and the resulting cached plan is reused for very different parameter values. The issue is not parameter sniffing by itself, but poor plan reuse under skewed data distributions.

##### Key Points to Mention

- Parameter sniffing is normal behavior.
- It often helps produce better estimates.
- Problems happen with skew and plan reuse.
- Do not treat all parameter sniffing as bad.
- Prove the issue before applying fixes.

<!-- question:end:parameter-sensitive-plans-and-skewed-data-distributions-beginner-q03 -->

#### How can you recognize a parameter-sensitive plan issue?

<!-- question:start:parameter-sensitive-plans-and-skewed-data-distributions-beginner-q04 -->
<!-- question-id:parameter-sensitive-plans-and-skewed-data-distributions-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Common signs include the same stored procedure being fast for some parameter values and slow for others, performance changing after recompilation, Query Store showing multiple plans or high runtime variation, and execution plans showing large differences between estimated and actual row counts.

You should test representative parameter values, inspect actual execution plans, and compare Query Store runtime data across plan IDs and time windows.

##### Key Points to Mention

- Fast for some values, slow for others.
- Cache clearing or recompilation changes behavior.
- Query Store shows high variation or multiple plans.
- Estimated and actual row counts differ significantly.
- Representative parameter testing is required.

<!-- question:end:parameter-sensitive-plans-and-skewed-data-distributions-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### How does parameter sniffing interact with plan reuse?

<!-- question:start:parameter-sensitive-plans-and-skewed-data-distributions-intermediate-q01 -->
<!-- question-id:parameter-sensitive-plans-and-skewed-data-distributions-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

When a parameterized query or stored procedure is compiled, SQL Server may use the current parameter value to estimate cardinality and choose a plan. That plan can then be cached and reused for later executions with different parameter values. If the first value is representative, reuse works well. If it is unusual, later executions may reuse a plan that is inappropriate.

For example, compiling for a rare value may create a seek-and-lookup plan. Reusing that plan for a very common value can cause excessive lookups and reads. Compiling for a common value may create a scan plan that is wasteful for rare values.

##### Key Points to Mention

- Compile-time value influences the cached plan.
- The cached plan may be reused for later values.
- Reuse improves performance when values are similar.
- Reuse hurts when values need different plan shapes.
- Skew makes this more likely.

<!-- question:end:parameter-sensitive-plans-and-skewed-data-distributions-intermediate-q01 -->

#### How can Query Store help diagnose parameter-sensitive plans?

<!-- question:start:parameter-sensitive-plans-and-skewed-data-distributions-intermediate-q02 -->
<!-- question-id:parameter-sensitive-plans-and-skewed-data-distributions-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Query Store can show that a query has multiple plans, high variation in runtime metrics, or regressions tied to plan changes. By comparing plan IDs, average duration, CPU, reads, execution count, and wait statistics, you can identify whether different plans perform better for different workload periods.

Query Store also helps avoid guessing. Instead of assuming parameter sensitivity, you can show historical evidence that the same query text has unstable plans or that a forced plan helped only some executions.

##### Key Points to Mention

- Shows plan history for a query.
- Shows runtime stats per plan.
- Helps identify high variation.
- Helps compare before-and-after behavior.
- Supports evidence-based mitigation.

<!-- question:end:parameter-sensitive-plans-and-skewed-data-distributions-intermediate-q02 -->

#### What are common ways to mitigate parameter-sensitive plan problems?

<!-- question:start:parameter-sensitive-plans-and-skewed-data-distributions-intermediate-q03 -->
<!-- question-id:parameter-sensitive-plans-and-skewed-data-distributions-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Common mitigations include updating statistics, improving indexes, rewriting queries to separate different selectivity cases, using `OPTION (RECOMPILE)` when per-execution optimization is worth the compile cost, using safe dynamic SQL for optional filters, using `OPTIMIZE FOR` when a representative value is known, and using Query Store plan forcing or hints as targeted mitigations.

On modern SQL Server versions, Parameter Sensitive Plan optimization can generate multiple plan variants automatically for eligible queries, reducing the need for manual workarounds.

##### Key Points to Mention

- Update statistics and review indexes first.
- Separate very different query cases.
- Use `OPTION (RECOMPILE)` selectively.
- Use safe dynamic SQL for optional filters.
- Consider PSP optimization in newer SQL Server versions.

<!-- question:end:parameter-sensitive-plans-and-skewed-data-distributions-intermediate-q03 -->

#### When would you use OPTION RECOMPILE?

<!-- question:start:parameter-sensitive-plans-and-skewed-data-distributions-intermediate-q04 -->
<!-- question-id:parameter-sensitive-plans-and-skewed-data-distributions-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Use `OPTION (RECOMPILE)` when parameter values vary enough that a fresh plan per execution is valuable and when the compilation cost is acceptable compared with the query execution cost. It is often useful for complex reporting queries, optional search screens, or queries where a bad reused plan is much more expensive than recompilation.

Do not apply it blindly to high-frequency lightweight queries because repeated compilation can create CPU overhead and reduce plan reuse benefits.

##### Key Points to Mention

- Compiles the statement per execution.
- Uses current parameter values.
- Useful when execution cost dominates compile cost.
- Helps with skewed parameters and optional filters.
- Can hurt high-frequency queries due to compile CPU.

<!-- question:end:parameter-sensitive-plans-and-skewed-data-distributions-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How does Parameter Sensitive Plan optimization work at a high level?

<!-- question:start:parameter-sensitive-plans-and-skewed-data-distributions-advanced-q01 -->
<!-- question-id:parameter-sensitive-plans-and-skewed-data-distributions-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

Parameter Sensitive Plan optimization allows SQL Server to create multiple plan variants for eligible parameterized queries. SQL Server creates a dispatcher plan that evaluates the parameter value at runtime and routes execution to a query variant optimized for a particular cardinality range.

This helps when a single cached plan cannot handle all parameter values well. For example, one variant can serve highly selective values, while another serves nonselective values. The feature reduces the need for manual hints or recompilation in some skewed workloads, but it depends on version, compatibility level, and query eligibility.

##### Key Points to Mention

- Creates a dispatcher plan.
- Creates multiple query variants.
- Routes based on parameter cardinality ranges.
- Helps with skewed values.
- Has eligibility and version requirements.

<!-- question:end:parameter-sensitive-plans-and-skewed-data-distributions-advanced-q01 -->

#### Why can forcing one plan be risky for parameter-sensitive workloads?

<!-- question:start:parameter-sensitive-plans-and-skewed-data-distributions-advanced-q02 -->
<!-- question-id:parameter-sensitive-plans-and-skewed-data-distributions-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

Forcing one plan can stabilize one parameter case while hurting another. In a parameter-sensitive workload, the core problem is that different values need different strategies. A forced seek plan might be excellent for rare values but terrible for common values. A forced scan plan might be stable for common values but too expensive for selective values.

If plan forcing is used, it should be based on workload-level evidence, monitored carefully, and treated as a mitigation. In some cases, a rewrite, branching, PSP optimization, dynamic SQL, or targeted indexing is safer than forcing a single plan.

##### Key Points to Mention

- One plan may not fit all parameter values.
- A forced plan can improve one case and hurt another.
- Evaluate workload-level impact, not one execution.
- Monitor forced plans after applying them.
- Consider alternatives that allow multiple plan shapes.

<!-- question:end:parameter-sensitive-plans-and-skewed-data-distributions-advanced-q02 -->

#### How would you design a fix for an optional search procedure with many nullable parameters?

<!-- question:start:parameter-sensitive-plans-and-skewed-data-distributions-advanced-q03 -->
<!-- question-id:parameter-sensitive-plans-and-skewed-data-distributions-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

First, identify the most common and most expensive search patterns. Avoid assuming every combination needs a perfect plan. If the procedure uses predicates like `Column = @p OR @p IS NULL`, a single reusable plan may be too generic. Options include branching for common cases, safe dynamic SQL that includes only active predicates, `OPTION (RECOMPILE)` for lower-frequency complex searches, or using modern optional parameter optimization if the platform supports it.

The fix should preserve security by parameterizing values, support useful indexes, and be tested with representative parameter combinations. For very high-frequency paths, separate procedures or explicit branches may be better than recompiling every time.

##### Key Points to Mention

- Identify real search patterns first.
- Optional predicates often produce generic plans.
- Dynamic SQL can generate better query shapes.
- Always parameterize dynamic SQL values.
- Balance compile cost, security, index design, and maintainability.

<!-- question:end:parameter-sensitive-plans-and-skewed-data-distributions-advanced-q03 -->

#### How do statistics and histograms relate to skewed parameter problems?

<!-- question:start:parameter-sensitive-plans-and-skewed-data-distributions-advanced-q04 -->
<!-- question-id:parameter-sensitive-plans-and-skewed-data-distributions-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

Statistics help SQL Server estimate how many rows a predicate will return. Histograms store distribution information for a leading statistics column, so they can help the optimizer distinguish common values from rare values. In skewed data, accurate statistics are critical because a small estimate error can lead to the wrong join type, access method, memory grant, or parallelism decision.

However, histograms have limits. They do not store every value in large domains, multi-column correlation can be hard to estimate, and stale statistics can misrepresent current data. This is why parameter-sensitive issues often require a combination of statistics review, actual plan analysis, and workload evidence from Query Store.

##### Key Points to Mention

- Statistics drive cardinality estimates.
- Histograms describe value distribution.
- Skew makes accurate estimates more important.
- Stale or limited statistics can cause bad plans.
- Compare estimated rows to actual rows.

<!-- question:end:parameter-sensitive-plans-and-skewed-data-distributions-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
