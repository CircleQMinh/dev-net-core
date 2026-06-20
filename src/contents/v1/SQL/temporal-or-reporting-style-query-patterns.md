---
id: temporal-or-reporting-style-query-patterns
topic: Advanced querying with window functions and CTEs
subtopic: Temporal or reporting-style query patterns
category: SQL
---

## Overview

Temporal and reporting-style SQL queries answer questions about data over time. They include point-in-time lookups, historical comparisons, period-based reports, as-of snapshots, running totals, month-to-date metrics, cohort views, and grouped summaries across dimensions such as date, customer, product, tenant, or region.

In SQL Server, temporal querying can mean querying system-versioned temporal tables with `FOR SYSTEM_TIME`, or it can mean more general time-aware reporting over normal tables that contain dates, effective periods, or event timestamps. Reporting-style patterns often combine date range filters, `GROUP BY`, window functions, CTEs, calendar tables, `ROLLUP`, `CUBE`, and `GROUPING SETS`.

This topic matters because production systems constantly ask time-based questions: "What did this customer look like last week?", "What were sales by month?", "Which subscriptions were active on this date?", "What is the running balance?", and "How did the metric change compared with the previous period?"

For interviews, strong candidates can write sargable date filters, avoid off-by-one date bugs, choose between event, snapshot, and system-versioned temporal designs, use `FOR SYSTEM_TIME` correctly, and build reporting queries that preserve the right grain.

## Core Concepts

### Temporal Querying

Temporal querying means asking about data with respect to time.

Common questions:

- What rows were valid at a specific point in time?
- What changed during a time interval?
- What did the data look like at the end of each month?
- Which records were active during a date range?
- What was the previous value before the current value?
- How does this period compare with the previous period?

The table design determines the query style. A system-versioned temporal table is queried differently from an append-only event table or a table with `EffectiveFrom` and `EffectiveTo` columns.

### System-Versioned Temporal Tables

SQL Server system-versioned temporal tables track current and historical row versions. The current table stores active rows, and a linked history table stores previous versions. SQL Server maintains period columns that indicate when each row version was valid.

Example query:

```sql
SELECT
    CustomerId,
    Email,
    Status
FROM dbo.Customers
FOR SYSTEM_TIME AS OF @AsOfTime
WHERE CustomerId = @CustomerId;
```

This returns the row version that was valid at `@AsOfTime`.

Temporal tables are useful when:

- You need audit-like history of row versions.
- You need point-in-time reconstruction.
- You need to compare current and historical values.
- You want SQL Server to maintain history automatically.

They are not a replacement for every audit or event-sourcing requirement. They track row versions, not necessarily business events or user intent.

### FOR SYSTEM_TIME Forms

SQL Server supports several temporal query forms:

- `AS OF`: row versions valid at a specific time.
- `FROM ... TO`: row versions active in a half-open interval.
- `BETWEEN ... AND`: row versions active in an interval that includes the upper boundary.
- `CONTAINED IN`: row versions that started and ended within the interval.
- `ALL`: all current and historical row versions.

Example:

```sql
SELECT
    CustomerId,
    Email,
    Status,
    ValidFrom,
    ValidTo
FROM dbo.Customers
FOR SYSTEM_TIME FROM @StartTime TO @EndTime
WHERE CustomerId = @CustomerId
ORDER BY ValidFrom;
```

Use the form that matches the business question. "As of midnight" and "changed during last month" are not the same question.

### Effective-Dated Tables

Some systems model time explicitly with effective start and end columns.

Example:

```sql
CREATE TABLE dbo.ProductPriceHistory
(
    ProductId BIGINT NOT NULL,
    Price DECIMAL(19, 4) NOT NULL,
    EffectiveFrom DATETIME2 NOT NULL,
    EffectiveTo DATETIME2 NULL,
    CONSTRAINT PK_ProductPriceHistory PRIMARY KEY (ProductId, EffectiveFrom)
);
```

As-of query:

```sql
SELECT ProductId, Price
FROM dbo.ProductPriceHistory
WHERE ProductId = @ProductId
  AND EffectiveFrom <= @AsOfTime
  AND (EffectiveTo > @AsOfTime OR EffectiveTo IS NULL);
```

This pattern is common for prices, tax rates, plan assignments, employee roles, contracts, and rules that change over time.

Important design rule: define interval boundaries clearly. Half-open intervals such as `[EffectiveFrom, EffectiveTo)` often reduce overlap and end-of-day bugs.

### Event Tables

Event tables store facts that happened at a point in time.

Example:

```sql
CREATE TABLE dbo.OrderEvents
(
    OrderEventId BIGINT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    OrderId BIGINT NOT NULL,
    EventName NVARCHAR(50) NOT NULL,
    EventTime DATETIME2 NOT NULL,
    Payload NVARCHAR(MAX) NULL
);
```

Event tables are useful for:

- Audit trails.
- Workflow history.
- Status transitions.
- User activity.
- Metrics and analytics.

Reporting over event tables usually groups by date buckets, filters by time ranges, and uses window functions to compare events or calculate running counts.

### Snapshot Tables

Snapshot tables store a state at a reporting point.

Example:

```sql
CREATE TABLE dbo.MonthlyAccountSnapshot
(
    SnapshotMonth DATE NOT NULL,
    AccountId BIGINT NOT NULL,
    Balance DECIMAL(19, 4) NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    CONSTRAINT PK_MonthlyAccountSnapshot PRIMARY KEY (SnapshotMonth, AccountId)
);
```

Snapshots are useful when reports need stable, repeatable totals and the source data is expensive to recalculate. They trade storage and ETL complexity for reporting speed and consistency.

Use snapshots when:

- Reports must match what users saw at period close.
- Recomputing history is expensive.
- Business definitions change over time.
- Data is sourced from multiple systems.
- You need a consistent reporting grain.

### Sargable Date Range Filters

Date filters should allow indexes to be used efficiently.

Avoid:

```sql
WHERE CAST(OrderDate AS DATE) = @ReportDate;
```

This applies a function to the column and can make index usage worse.

Prefer a half-open range:

```sql
WHERE OrderDate >= @ReportDate
  AND OrderDate < DATEADD(day, 1, @ReportDate);
```

For monthly reports:

```sql
WHERE OrderDate >= @MonthStart
  AND OrderDate < DATEADD(month, 1, @MonthStart);
```

This pattern handles time components safely and is usually easier for the optimizer to match to an index on `OrderDate`.

### Date Bucketing

Reporting queries often group timestamps into days, months, quarters, or years.

Example with `DATETRUNC`:

```sql
SELECT
    DATETRUNC(month, OrderDate) AS OrderMonth,
    COUNT(*) AS OrderCount,
    SUM(TotalAmount) AS TotalSales
FROM dbo.Orders
WHERE OrderDate >= @StartDate
  AND OrderDate < @EndDate
GROUP BY DATETRUNC(month, OrderDate)
ORDER BY OrderMonth;
```

For older compatibility or different requirements, teams may use `DATEFROMPARTS`, calendar tables, or persisted computed columns for reporting buckets.

### Calendar Tables

A calendar table is a table with one row per date and useful attributes such as month, quarter, fiscal period, weekday, holiday flag, and reporting week.

Example:

```sql
SELECT
    cal.CalendarMonth,
    COUNT(o.OrderId) AS OrderCount,
    COALESCE(SUM(o.TotalAmount), 0) AS TotalSales
FROM dbo.Calendar AS cal
LEFT JOIN dbo.Orders AS o
    ON o.OrderDate >= cal.DateValue
   AND o.OrderDate < DATEADD(day, 1, cal.DateValue)
WHERE cal.DateValue >= @StartDate
  AND cal.DateValue < @EndDate
GROUP BY cal.CalendarMonth
ORDER BY cal.CalendarMonth;
```

Calendar tables help when:

- Reports need rows for dates with no activity.
- Fiscal calendars differ from calendar months.
- Week definitions are business-specific.
- Holidays and working days matter.
- Time zones or local reporting periods need consistent handling.

### GROUP BY For Reporting

Basic reporting often starts with `GROUP BY`.

Example:

```sql
SELECT
    CustomerId,
    COUNT(*) AS OrderCount,
    SUM(TotalAmount) AS TotalSales,
    AVG(TotalAmount) AS AverageOrderValue
FROM dbo.Orders
WHERE OrderDate >= @StartDate
  AND OrderDate < @EndDate
GROUP BY CustomerId;
```

Every selected column must either be grouped or aggregated, except expressions derived from grouped columns. The output grain is one row per group. In this example, one row per customer.

### ROLLUP, CUBE, And GROUPING SETS

Reporting often needs detail rows and subtotal rows.

`ROLLUP` is useful for hierarchical subtotals:

```sql
SELECT
    Region,
    ProductCategory,
    SUM(SalesAmount) AS SalesAmount
FROM dbo.Sales
GROUP BY ROLLUP (Region, ProductCategory);
```

`GROUPING SETS` gives explicit control:

```sql
SELECT
    Region,
    ProductCategory,
    SUM(SalesAmount) AS SalesAmount
FROM dbo.Sales
GROUP BY GROUPING SETS
(
    (Region, ProductCategory),
    (Region),
    ()
);
```

These patterns avoid writing several separate aggregate queries and combining them with `UNION ALL`.

### Running Totals And Period Comparisons

Window functions are common in reporting.

Running monthly revenue:

```sql
WITH MonthlySales AS
(
    SELECT
        DATETRUNC(month, OrderDate) AS SalesMonth,
        SUM(TotalAmount) AS MonthlyRevenue
    FROM dbo.Orders
    WHERE OrderDate >= @StartDate
      AND OrderDate < @EndDate
    GROUP BY DATETRUNC(month, OrderDate)
)
SELECT
    SalesMonth,
    MonthlyRevenue,
    SUM(MonthlyRevenue) OVER
    (
        ORDER BY SalesMonth
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS RunningRevenue
FROM MonthlySales
ORDER BY SalesMonth;
```

Previous-period comparison:

```sql
WITH MonthlySales AS
(
    SELECT
        DATETRUNC(month, OrderDate) AS SalesMonth,
        SUM(TotalAmount) AS MonthlyRevenue
    FROM dbo.Orders
    GROUP BY DATETRUNC(month, OrderDate)
)
SELECT
    SalesMonth,
    MonthlyRevenue,
    LAG(MonthlyRevenue) OVER (ORDER BY SalesMonth) AS PreviousMonthRevenue,
    MonthlyRevenue - LAG(MonthlyRevenue) OVER (ORDER BY SalesMonth) AS RevenueChange
FROM MonthlySales;
```

The CTE defines the reporting grain first, then the window function compares rows at that grain.

### As-Of Reporting

As-of reporting reconstructs state at a point in time.

System-versioned temporal table:

```sql
SELECT
    CustomerId,
    Status,
    CreditLimit
FROM dbo.Customers
FOR SYSTEM_TIME AS OF @AsOfTime
WHERE TenantId = @TenantId;
```

Effective-dated table:

```sql
SELECT
    ProductId,
    Price
FROM dbo.ProductPriceHistory
WHERE EffectiveFrom <= @AsOfTime
  AND (EffectiveTo > @AsOfTime OR EffectiveTo IS NULL);
```

Snapshot table:

```sql
SELECT
    AccountId,
    Balance
FROM dbo.MonthlyAccountSnapshot
WHERE SnapshotMonth = @ReportMonth;
```

Each design answers as-of questions differently. Interviewers often care that you can explain the trade-off.

### Time Zones And Boundaries

Reporting queries often fail at date boundaries.

Common issues:

- Using local time and UTC inconsistently.
- Filtering with `BETWEEN` when the upper boundary should be exclusive.
- Grouping by server time when reports need business-local time.
- Ignoring daylight saving time.
- Using `datetime` precision assumptions.
- Treating a date as if it has no time component.

Practical guidance:

- Store event instants in UTC when possible.
- Convert to reporting time zone at the boundary of reporting logic.
- Use half-open intervals: `>= start` and `< end`.
- Define fiscal and local reporting periods explicitly.
- Test rows exactly at midnight and period boundaries.

### Reporting Grain

Reporting grain means what one output row represents.

Examples:

- One row per customer per month.
- One row per product per day.
- One row per region with a subtotal.
- One row per account as of a point in time.

Example:

```sql
SELECT
    DATETRUNC(month, OrderDate) AS SalesMonth,
    CustomerId,
    SUM(TotalAmount) AS TotalSales
FROM dbo.Orders
WHERE OrderDate >= @StartDate
  AND OrderDate < @EndDate
GROUP BY
    DATETRUNC(month, OrderDate),
    CustomerId;
```

This output grain is one row per customer per month. Adding `ProductId` changes the grain to one row per customer per month per product.

### Performance Considerations

Temporal and reporting queries can scan a lot of data.

Helpful practices:

- Use sargable date ranges.
- Index the timestamp or period columns used for filtering.
- Include common grouping dimensions in useful indexes when appropriate.
- Pre-aggregate into snapshot or summary tables for heavy reports.
- Use partitioning or archival strategies for very large history tables.
- Avoid applying functions to date columns in `WHERE`.
- Filter early before grouping.
- Review execution plans for scans, sorts, hash aggregates, and spills.

Example index:

```sql
CREATE INDEX IX_Orders_OrderDate_Customer
ON dbo.Orders (OrderDate, CustomerId)
INCLUDE (TotalAmount, Status);
```

This supports date range filtering and customer-level reporting over orders.

### Common Mistakes

Common mistakes include:

- Using `BETWEEN` with datetime values and accidentally excluding or including boundary rows.
- Applying `CAST(OrderDate AS DATE)` in the `WHERE` clause on large tables.
- Grouping by formatted strings instead of date values.
- Mixing UTC and local time without a clear rule.
- Forgetting rows with no activity in reports.
- Changing report grain by adding extra columns.
- Assuming system-versioned temporal tables represent business events.
- Querying all history without limiting the time range.
- Using `ROLLUP` or `CUBE` without identifying subtotal rows.
- Comparing period totals without aligning periods correctly.

### Best Practices

Best practices:

- Define the reporting question and output grain first.
- Use half-open date ranges.
- Keep `WHERE` predicates sargable.
- Use calendar tables for fiscal calendars and missing-date rows.
- Use `FOR SYSTEM_TIME AS OF` for point-in-time temporal table queries.
- Use effective-dated tables for business-valid intervals.
- Use snapshots when reports need stable period-end state.
- Use window functions for running totals and period-over-period comparisons.
- Use `GROUPING SETS` for explicit subtotal requirements.
- Test boundary times, empty periods, duplicate events, and changed historical rows.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is a temporal query?

<!-- question:start:temporal-or-reporting-style-query-patterns-beginner-q01 -->
<!-- question-id:temporal-or-reporting-style-query-patterns-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A temporal query asks about data with respect to time. It might ask what data looked like at a specific time, what changed during a period, which records were active in a date range, or how metrics changed across reporting periods.

In SQL Server, temporal querying can include system-versioned temporal tables with `FOR SYSTEM_TIME`, effective-dated tables, event tables, and reporting queries over timestamped facts.

##### Key Points to Mention

- Time-aware querying.
- Includes point-in-time and period-based questions.
- Can use system-versioned temporal tables.
- Can also use normal date columns or effective periods.
- Common in audit, reporting, and analytics.

<!-- question:end:temporal-or-reporting-style-query-patterns-beginner-q01 -->

#### What does FOR SYSTEM_TIME AS OF do?

<!-- question:start:temporal-or-reporting-style-query-patterns-beginner-q02 -->
<!-- question-id:temporal-or-reporting-style-query-patterns-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

`FOR SYSTEM_TIME AS OF` queries a system-versioned temporal table as it existed at a specific point in time. SQL Server uses the current table and history table to return row versions that were valid at that time.

It is useful for point-in-time reconstruction and historical lookups.

##### Key Points to Mention

- Used with system-versioned temporal tables.
- Returns rows valid at one point in time.
- Reads current and history data.
- Useful for as-of reporting.
- Different from querying all history.

<!-- question:end:temporal-or-reporting-style-query-patterns-beginner-q02 -->

#### What is a reporting grain?

<!-- question:start:temporal-or-reporting-style-query-patterns-beginner-q03 -->
<!-- question-id:temporal-or-reporting-style-query-patterns-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

Reporting grain describes what one output row represents. For example, a report may have one row per customer per month, one row per product per day, or one row per region subtotal.

Knowing the grain is important because adding extra grouped columns or joining to detail tables can change the meaning and count of output rows.

##### Key Points to Mention

- Defines one row's meaning.
- Examples include customer-month or product-day.
- Drives `GROUP BY` columns.
- Helps prevent accidental row multiplication.
- Should be stated before writing the query.

<!-- question:end:temporal-or-reporting-style-query-patterns-beginner-q03 -->

#### Why are date range filters important in reports?

<!-- question:start:temporal-or-reporting-style-query-patterns-beginner-q04 -->
<!-- question-id:temporal-or-reporting-style-query-patterns-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

Date range filters define which rows belong in a reporting period. They need to handle time components and boundaries correctly. A common safe pattern is a half-open range, such as `OrderDate >= @StartDate AND OrderDate < @EndDate`.

This avoids many bugs caused by inclusive end dates and supports indexes better than applying functions to the date column.

##### Key Points to Mention

- Date boundaries affect correctness.
- Use `>= start` and `< end`.
- Avoid functions on indexed date columns in `WHERE`.
- Handles time-of-day values.
- Helps performance and correctness.

<!-- question:end:temporal-or-reporting-style-query-patterns-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### How do system-versioned temporal tables differ from event tables?

<!-- question:start:temporal-or-reporting-style-query-patterns-intermediate-q01 -->
<!-- question-id:temporal-or-reporting-style-query-patterns-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

System-versioned temporal tables store row versions and let SQL Server maintain history of changes to table rows. Event tables store business events that happened at specific times, such as `OrderCreated`, `StatusChanged`, or `PaymentCaptured`.

Temporal tables are good for reconstructing row state. Event tables are better for explaining what happened and why, especially when business events carry intent or payloads.

##### Key Points to Mention

- Temporal tables track row versions.
- Event tables track business events.
- Temporal tables support point-in-time state.
- Event tables explain activity and intent.
- They can be complementary.

<!-- question:end:temporal-or-reporting-style-query-patterns-intermediate-q01 -->

#### How would you write a sargable daily report filter?

<!-- question:start:temporal-or-reporting-style-query-patterns-intermediate-q02 -->
<!-- question-id:temporal-or-reporting-style-query-patterns-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

Use a half-open range that does not apply a function to the column. For a report date, use `OrderDate >= @ReportDate AND OrderDate < DATEADD(day, 1, @ReportDate)`. This handles all times during that day and can use an index on `OrderDate`.

Avoid `CAST(OrderDate AS DATE) = @ReportDate` on large tables because it applies a function to the column.

##### Key Points to Mention

- Use `>=` lower bound.
- Use `<` upper bound.
- Do not cast the column in `WHERE`.
- Handles time components.
- More index-friendly.

<!-- question:end:temporal-or-reporting-style-query-patterns-intermediate-q02 -->

#### When would you use a calendar table?

<!-- question:start:temporal-or-reporting-style-query-patterns-intermediate-q03 -->
<!-- question-id:temporal-or-reporting-style-query-patterns-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Use a calendar table when reports need a complete set of dates, fiscal calendar logic, holidays, working days, custom weeks, or rows for periods with no activity. Joining facts to a calendar table makes period definitions explicit and repeatable.

It is especially useful when business reporting periods are not the same as simple calendar months.

##### Key Points to Mention

- Provides one row per date.
- Supports fiscal periods and holidays.
- Helps show zero-activity periods.
- Makes reporting definitions consistent.
- Avoids scattering date logic across queries.

<!-- question:end:temporal-or-reporting-style-query-patterns-intermediate-q03 -->

#### How do ROLLUP and GROUPING SETS help reports?

<!-- question:start:temporal-or-reporting-style-query-patterns-intermediate-q04 -->
<!-- question-id:temporal-or-reporting-style-query-patterns-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

`ROLLUP` and `GROUPING SETS` let a query return detail groups and subtotal groups in one result. `ROLLUP` follows a hierarchy of subtotals, while `GROUPING SETS` lets the developer specify exactly which groupings are needed.

They can replace several aggregate queries combined with `UNION ALL`, but the result should identify subtotal rows clearly.

##### Key Points to Mention

- Produce subtotals.
- `ROLLUP` follows a hierarchy.
- `GROUPING SETS` is explicit.
- Can simplify reporting queries.
- Use grouping indicators to label subtotal rows.

<!-- question:end:temporal-or-reporting-style-query-patterns-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you design a report that shows monthly sales and running yearly sales?

<!-- question:start:temporal-or-reporting-style-query-patterns-advanced-q01 -->
<!-- question-id:temporal-or-reporting-style-query-patterns-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

First define the reporting grain as one row per month. Aggregate orders into monthly totals in a CTE or derived table, using a sargable date range. Then apply a window function over the monthly result to calculate the running yearly total.

This separates detail aggregation from reporting analytics and avoids calculating running totals over raw order rows by accident.

##### Key Points to Mention

- Define one row per month.
- Filter with a sargable date range.
- Aggregate to monthly grain first.
- Use `SUM(...) OVER (ORDER BY Month ROWS ...)`.
- Keep period boundaries explicit.

<!-- question:end:temporal-or-reporting-style-query-patterns-advanced-q01 -->

#### How would you query records active during a time interval?

<!-- question:start:temporal-or-reporting-style-query-patterns-advanced-q02 -->
<!-- question-id:temporal-or-reporting-style-query-patterns-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

For effective-dated rows, use interval-overlap logic. A common half-open interval test is `EffectiveFrom < @EndTime AND (EffectiveTo > @StartTime OR EffectiveTo IS NULL)`. This returns rows whose active interval overlaps the requested interval.

For system-versioned temporal tables, choose the `FOR SYSTEM_TIME` form that matches the question, such as `FROM ... TO` for versions active during a period.

##### Key Points to Mention

- Use interval-overlap logic.
- Half-open intervals reduce boundary bugs.
- Handle open-ended rows with `EffectiveTo IS NULL`.
- Choose the right `FOR SYSTEM_TIME` form.
- Test boundary values exactly at start and end.

<!-- question:end:temporal-or-reporting-style-query-patterns-advanced-q02 -->

#### What are common mistakes in point-in-time reporting?

<!-- question:start:temporal-or-reporting-style-query-patterns-advanced-q03 -->
<!-- question-id:temporal-or-reporting-style-query-patterns-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

Common mistakes include mixing UTC and local time, using inclusive end dates incorrectly, querying all history without a time filter, assuming temporal row versions explain business intent, ignoring deleted or missing rows, and not defining the report grain.

A strong point-in-time report clearly defines the as-of timestamp, time zone, source table design, and whether the report needs row state, business events, or period snapshots.

##### Key Points to Mention

- Time zone consistency matters.
- Inclusive boundaries can be wrong.
- Historical state is not the same as business intent.
- Deleted or missing rows need a rule.
- Report grain and as-of time must be explicit.

<!-- question:end:temporal-or-reporting-style-query-patterns-advanced-q03 -->

#### When should a team use snapshot tables instead of calculating reports live?

<!-- question:start:temporal-or-reporting-style-query-patterns-advanced-q04 -->
<!-- question-id:temporal-or-reporting-style-query-patterns-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

Use snapshot tables when reports must be stable, repeatable, fast, and aligned with period-close definitions, or when live calculation is too expensive. Snapshots are also helpful when business definitions change over time and the organization needs to preserve what was reported historically.

The trade-off is extra storage, ETL or job complexity, backfill logic, and operational ownership of snapshot generation.

##### Key Points to Mention

- Good for stable period-end reporting.
- Improves expensive report performance.
- Preserves historical reported values.
- Requires ETL or job ownership.
- Adds storage and backfill complexity.

<!-- question:end:temporal-or-reporting-style-query-patterns-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
