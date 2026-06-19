---
id: log-analytics-queries-dashboards-and-availability-tests
topic: Monitoring, tracing, and incident response on Azure
subtopic: Log Analytics queries, dashboards, and availability tests
category: Azure
---

## Overview

Log Analytics is the query experience for Azure Monitor Logs. It lets teams analyze telemetry stored in Log Analytics workspaces using Kusto Query Language. Dashboards, workbooks, and availability tests turn that telemetry into operational views and proactive checks.

This subtopic covers three practical skills:

- Writing useful KQL queries for troubleshooting and reporting.
- Designing dashboards and workbooks that show system health clearly.
- Using Application Insights availability tests to monitor endpoints from outside the application.

For interviews, candidates should be able to write basic KQL, explain query scope and time filters, choose between dashboards and workbooks, design useful availability checks, avoid noisy visualizations, and connect synthetic test failures back to logs and traces.

## Core Concepts

### Log Analytics Workspace

A Log Analytics workspace is a data store for Azure Monitor Logs. It contains tables such as application request telemetry, exceptions, dependencies, availability results, Azure resource logs, activity logs, container logs, and custom tables.

Workspace design affects:

- Query scope.
- Access control.
- Retention.
- Cost.
- Cross-resource investigation.
- Dashboard and alert design.

For most application teams, the important skill is understanding which tables contain the data they need and how to query them safely.

### Kusto Query Language

Kusto Query Language, or KQL, is used to query Azure Monitor Logs. A KQL query is usually a pipeline of operators.

Basic shape:

```kusto
requests
| where timestamp > ago(1h)
| where success == false
| summarize failures = count() by operation_Name
| order by failures desc
```

Common operators:

- `where` filters rows.
- `project` selects columns.
- `extend` creates calculated columns.
- `summarize` groups and aggregates.
- `order by` sorts results.
- `join` combines tables.
- `render` visualizes results.

### Query Scope

Query scope defines what data the query can see. You can query:

- One resource.
- One workspace.
- A resource group scope.
- Multiple workspaces or resources when configured and authorized.

A common mistake is assuming missing results mean no problem exists. The query might simply be scoped to the wrong resource or time range.

### Time Filtering

Always bound production queries by time.

```kusto
exceptions
| where timestamp between (ago(24h) .. now())
| summarize count() by type
| order by count_ desc
```

Time filters improve performance, reduce cost, and make results easier to interpret. Dashboards and alerts should use time windows that match the operational question.

### Request Failure Query

Find failing routes:

```kusto
requests
| where timestamp > ago(1h)
| where success == false
| summarize failures = count(), users = dcount(user_Id) by operation_Name, resultCode
| order by failures desc
```

This is a practical incident query because it groups failures by operation and status code rather than dumping raw rows.

### Latency Query

Find slow operations:

```kusto
requests
| where timestamp > ago(6h)
| summarize
    p50 = percentile(duration, 50),
    p95 = percentile(duration, 95),
    p99 = percentile(duration, 99),
    count = count()
  by operation_Name
| order by p95 desc
```

Percentiles are often more useful than average latency because averages hide tail behavior.

### Dependency Failure Query

Identify failing dependencies:

```kusto
dependencies
| where timestamp > ago(1h)
| where success == false
| summarize failures = count() by type, target, name, resultCode
| order by failures desc
```

This helps determine whether an API incident is caused by internal code, SQL, storage, Redis, Service Bus, or an external HTTP dependency.

### Exception Query

Find the most frequent exceptions:

```kusto
exceptions
| where timestamp > ago(24h)
| summarize occurrences = count(), impactedOperations = dcount(operation_Id)
    by type, outerMessage
| order by occurrences desc
```

Use exception type and message carefully. Messages may include high-cardinality values unless logging is designed well.

### Trace Correlation Query

Follow one operation:

```kusto
union requests, dependencies, exceptions, traces
| where operation_Id == "replace-with-operation-id"
| project timestamp, itemType, operation_Name, message, name, target, resultCode, success
| order by timestamp asc
```

Correlation queries are powerful during incidents because they reconstruct the operation timeline.

### Availability Results Query

Analyze synthetic tests:

```kusto
availabilityResults
| where timestamp > ago(24h)
| summarize
    availability = 100.0 * countif(success == true) / count(),
    avgDuration = avg(duration),
    failures = countif(success == false)
  by name, location
| order by availability asc
```

This helps distinguish a single regional test problem from a global endpoint failure.

### Joins

KQL joins connect related tables.

Example: failed requests with matching exceptions:

```kusto
requests
| where timestamp > ago(1h)
| where success == false
| project operation_Id, requestName = operation_Name, resultCode, requestDuration = duration
| join kind=leftouter (
    exceptions
    | project operation_Id, exceptionType = type, outerMessage
) on operation_Id
| order by requestDuration desc
```

Join carefully. Large joins can be expensive and slow. Filter both sides first.

### Saved Queries and Query Packs

Saved queries and query packs help teams reuse tested KQL instead of rebuilding investigation queries during an incident.

Good saved queries:

- Have clear names.
- Include comments for parameters.
- Use safe time ranges.
- Return summarized results first.
- Link to runbooks or dashboards when useful.

Query reuse is part of operational maturity.

### Dashboards

Dashboards present important metrics and query results at a glance.

A useful production dashboard shows:

- Availability.
- Error rate.
- Request rate.
- Latency percentiles.
- Saturation or backlog.
- Dependency failures.
- Recent deployments.
- Active alerts.

Avoid dashboards that contain many charts but no decision support. A dashboard should answer "Is the system healthy?" and "Where should I look next?"

### Workbooks

Azure Workbooks are interactive reports for Azure Monitor data. They can combine text, parameters, metrics, logs, charts, grids, and links.

Use workbooks when:

- You need an interactive troubleshooting view.
- Users should choose time range, service, region, or operation.
- You want documentation and charts in one place.
- You need a reusable operational report.

Dashboards are better for at-a-glance monitoring. Workbooks are better for guided investigation.

### Grafana and Azure Dashboards

Azure Monitor data can also be visualized in managed Grafana and Azure dashboards. Choose based on audience and existing operational tooling.

Consider:

- Who owns the dashboard?
- Which data sources are required?
- Does the team already use Grafana?
- Are Prometheus metrics involved?
- Is access control aligned with the data shown?
- Can the dashboard be deployed as code?

### Availability Tests

Application Insights availability tests are recurring synthetic checks against HTTP or HTTPS endpoints. They measure availability and response time from external locations.

Use them to monitor:

- Homepage or health endpoint reachability.
- Login or lightweight API flow.
- Critical public APIs.
- External dependency endpoints.
- TLS certificate validity.

Availability tests do not require application code changes, but the endpoint must be reachable from the test locations unless a supported private testing approach is used.

### Standard Availability Tests

Standard tests are the current availability-test option for single-request checks. They can validate status code, response time, content match, HTTP method, headers, request body, TLS certificate validity, and proactive certificate lifetime.

Use Standard tests rather than classic URL ping tests. Classic URL ping tests are retired on September 30, 2026.

### Test Locations and Thresholds

Run availability tests from multiple locations. A single failed location may indicate a regional network path issue rather than an application outage.

Good alert design considers:

- Number of locations.
- Failure threshold.
- Test frequency.
- Expected maintenance windows.
- Endpoint timeout.
- Whether retries are enabled.

For public user-facing apps, at least five locations is a common starting point.

### Synthetic Versus Real User Monitoring

Availability tests are synthetic. They test configured paths from test agents. Real user monitoring observes actual browser or client behavior.

Use both when possible:

- Synthetic checks detect known critical path failures proactively.
- Real user telemetry shows what actual users experience.
- Server telemetry explains backend causes.

Synthetic success does not prove every real user path is healthy.

### Dashboard Design Example

A practical API dashboard can include:

```text
Top row:
  Availability, request rate, failed request rate, p95 latency

Second row:
  Dependency failures by target
  Exceptions by type
  Queue backlog or oldest message age

Third row:
  Failed requests by operation
  Availability test failures by location
  Recent deployments
```

This layout starts with user impact, then guides diagnosis.

### Alert Query Design

KQL alert queries should be:

- Time bounded.
- Summarized to a small result set.
- Stable under normal traffic variation.
- Focused on user impact or actionable symptoms.
- Tested against historical incident windows.

Avoid alerts that fire for every individual exception. Alert on rates, ratios, burn rate, or grouped failure conditions.

### Common Mistakes

- Querying the wrong scope.
- Forgetting time filters.
- Building dashboards that show vanity metrics.
- Using average latency instead of percentiles.
- Alerting on raw exception count without traffic context.
- Not saving useful incident queries.
- Using availability tests that only check a static page.
- Running tests from one location only.
- Ignoring synthetic test failures because "real users look fine."
- Putting sensitive data in logs that dashboards expose broadly.

### Best Practices

- Learn the key tables for your app.
- Keep KQL queries time bounded and summarized.
- Use percentiles for latency.
- Build dashboards around symptoms, not implementation trivia.
- Use workbooks for guided troubleshooting.
- Create Standard availability tests for critical endpoints.
- Configure availability alerts with action groups.
- Save tested incident queries.
- Review dashboards after incidents.
- Manage workspace access and retention deliberately.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is Log Analytics?

<!-- question:start:log-analytics-queries-dashboards-and-availability-tests-beginner-q01 -->
<!-- question-id:log-analytics-queries-dashboards-and-availability-tests-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Log Analytics is the Azure Monitor experience for querying logs stored in Log Analytics workspaces. It uses Kusto Query Language to analyze application telemetry, resource logs, exceptions, traces, dependencies, activity logs, and other collected data.

It is mainly used for troubleshooting, investigation, dashboards, reporting, and log-based alerts.

##### Key Points to Mention

- Queries Azure Monitor Logs.
- Uses KQL.
- Data is stored in Log Analytics workspaces.
- Useful for investigation and reporting.
- Query scope and time range matter.

<!-- question:end:log-analytics-queries-dashboards-and-availability-tests-beginner-q01 -->

#### What is KQL used for in Azure Monitor?

<!-- question:start:log-analytics-queries-dashboards-and-availability-tests-beginner-q02 -->
<!-- question-id:log-analytics-queries-dashboards-and-availability-tests-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

KQL is used to query and analyze Azure Monitor Logs. It can filter records, project columns, group and summarize data, join tables, calculate percentiles, and render charts.

KQL is important for incident response because it lets engineers ask detailed questions about failures, latency, dependencies, and affected users.

##### Key Points to Mention

- KQL stands for Kusto Query Language.
- Operators are chained with pipes.
- `where`, `summarize`, and `project` are common.
- It works against tables in a workspace.
- Time filtering is important.

<!-- question:end:log-analytics-queries-dashboards-and-availability-tests-beginner-q02 -->

#### What is an availability test?

<!-- question:start:log-analytics-queries-dashboards-and-availability-tests-beginner-q03 -->
<!-- question-id:log-analytics-queries-dashboards-and-availability-tests-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

An availability test is a recurring synthetic check that sends requests to an HTTP or HTTPS endpoint from configured test locations. It measures whether the endpoint responds successfully and how long the response takes.

Availability tests help detect downtime, slow responses, regional connectivity problems, and TLS certificate issues.

##### Key Points to Mention

- It is synthetic monitoring.
- It runs from selected locations.
- It can check status code and response time.
- Standard tests are the current option.
- Alerts can notify teams when tests fail.

<!-- question:end:log-analytics-queries-dashboards-and-availability-tests-beginner-q03 -->

#### What is the difference between a dashboard and a workbook?

<!-- question:start:log-analytics-queries-dashboards-and-availability-tests-beginner-q04 -->
<!-- question-id:log-analytics-queries-dashboards-and-availability-tests-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A dashboard is usually an at-a-glance operational view. A workbook is an interactive report that can combine text, parameters, metrics, logs, charts, and grids.

Use dashboards for quick health checks. Use workbooks for guided investigation, troubleshooting, and richer analysis.

##### Key Points to Mention

- Dashboards are quick visual summaries.
- Workbooks are interactive and parameterized.
- Workbooks can include explanatory text.
- Both can use Azure Monitor data.
- Choose based on audience and workflow.

<!-- question:end:log-analytics-queries-dashboards-and-availability-tests-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you write a KQL query to find failing API routes?

<!-- question:start:log-analytics-queries-dashboards-and-availability-tests-intermediate-q01 -->
<!-- question-id:log-analytics-queries-dashboards-and-availability-tests-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Query the request table, filter to a recent time range, filter failed requests, group by operation name and result code, then sort by failure count.

```kusto
requests
| where timestamp > ago(1h)
| where success == false
| summarize failures = count() by operation_Name, resultCode
| order by failures desc
```

This gives a useful summary instead of raw log noise.

##### Key Points to Mention

- Always include a time filter.
- Filter failed requests.
- Group by route or operation.
- Include status or result code.
- Summarize before drilling into individual records.

<!-- question:end:log-analytics-queries-dashboards-and-availability-tests-intermediate-q01 -->

#### How should you design an operational dashboard?

<!-- question:start:log-analytics-queries-dashboards-and-availability-tests-intermediate-q02 -->
<!-- question-id:log-analytics-queries-dashboards-and-availability-tests-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Start with user-impact signals: availability, request rate, error rate, and latency percentiles. Then add diagnostic panels for dependency failures, exceptions, saturation, queue backlog, availability test failures, and recent deployments.

The dashboard should answer whether the system is healthy and where to investigate next. Avoid filling it with low-value infrastructure charts that do not change decisions.

##### Key Points to Mention

- Put user-impact indicators first.
- Use p95 or p99 latency, not only average.
- Include dependencies and saturation.
- Show time range clearly.
- Dashboards should guide action.

<!-- question:end:log-analytics-queries-dashboards-and-availability-tests-intermediate-q02 -->

#### How do you design a good availability test?

<!-- question:start:log-analytics-queries-dashboards-and-availability-tests-intermediate-q03 -->
<!-- question-id:log-analytics-queries-dashboards-and-availability-tests-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Choose an endpoint that represents a critical user path or dependency. Configure a Standard test with expected status code, timeout, locations, frequency, optional content match, and TLS certificate checks. Use multiple locations so the alert can distinguish a real outage from one regional test path.

The endpoint should be safe to call repeatedly and should not mutate production data unless specifically designed for synthetic testing.

##### Key Points to Mention

- Test critical paths, not only static pages.
- Use multiple locations.
- Set timeout and success criteria.
- Use Standard tests for current monitoring.
- Avoid unsafe mutating operations.

<!-- question:end:log-analytics-queries-dashboards-and-availability-tests-intermediate-q03 -->

#### When should you use a workbook instead of a dashboard?

<!-- question:start:log-analytics-queries-dashboards-and-availability-tests-intermediate-q04 -->
<!-- question-id:log-analytics-queries-dashboards-and-availability-tests-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use a workbook when the audience needs an interactive investigation flow. Workbooks can include parameters, explanatory text, KQL results, metrics, charts, links, and multiple views. They are useful for incident runbooks, service health reports, cost analysis, and team-specific troubleshooting.

Use a dashboard when the goal is quick shared visibility into current health.

##### Key Points to Mention

- Workbooks support parameters.
- Workbooks can mix explanation and telemetry.
- Good for guided troubleshooting.
- Dashboards are better for wallboard-style health views.
- Both should be owned and maintained.

<!-- question:end:log-analytics-queries-dashboards-and-availability-tests-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you build a KQL-based incident workbook for an API?

<!-- question:start:log-analytics-queries-dashboards-and-availability-tests-advanced-q01 -->
<!-- question-id:log-analytics-queries-dashboards-and-availability-tests-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Create parameters for time range, environment, region, operation, and deployment version. Start with summary tiles for availability, traffic, error rate, and p95 latency. Add sections for failed requests, slow requests, dependency failures, exceptions, availability test failures, and correlated operation drill-down.

Include explanatory text and links to runbooks. Queries should filter early, summarize before drilling down, and avoid expensive joins until the user selects a narrower scope.

##### Key Points to Mention

- Use parameters for focused investigation.
- Start with user-impact summary.
- Add dependency, exception, and availability sections.
- Include operation-level drill-down.
- Optimize queries with early filters.

<!-- question:end:log-analytics-queries-dashboards-and-availability-tests-advanced-q01 -->

#### How do you avoid noisy or misleading KQL alerts?

<!-- question:start:log-analytics-queries-dashboards-and-availability-tests-advanced-q02 -->
<!-- question-id:log-analytics-queries-dashboards-and-availability-tests-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Design alerts around ratios, rates, percentiles, or grouped conditions rather than raw individual events. Use an evaluation window that matches the signal, filter known benign cases, require enough traffic to make a percentage meaningful, and test the query against historical normal and incident periods.

The query should return a small actionable result and should include context needed for triage.

##### Key Points to Mention

- Alert on symptoms and user impact.
- Use rates and ratios with minimum volume checks.
- Avoid one-alert-per-exception patterns.
- Test against historical data.
- Include useful dimensions for routing and triage.

<!-- question:end:log-analytics-queries-dashboards-and-availability-tests-advanced-q02 -->

#### How would you troubleshoot a failed availability test?

<!-- question:start:log-analytics-queries-dashboards-and-availability-tests-advanced-q03 -->
<!-- question-id:log-analytics-queries-dashboards-and-availability-tests-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Check whether failures are from one location or many, whether the failure is timeout, DNS, TLS, status code, content match, or dependency-related. Query `availabilityResults`, inspect end-to-end transaction details, then correlate the failed synthetic request with server-side requests, dependencies, exceptions, and traces.

Also check recent deployments, configuration changes, firewall rules, certificate expiry, and whether the synthetic endpoint exercises the same path real users use.

##### Key Points to Mention

- Compare locations and failure types.
- Query `availabilityResults`.
- Correlate with server-side telemetry.
- Check TLS, DNS, firewall, and deployment changes.
- Distinguish synthetic path problems from real outage.

<!-- question:end:log-analytics-queries-dashboards-and-availability-tests-advanced-q03 -->

#### How do query scope and workspace architecture affect incident response?

<!-- question:start:log-analytics-queries-dashboards-and-availability-tests-advanced-q04 -->
<!-- question-id:log-analytics-queries-dashboards-and-availability-tests-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Query scope determines which resources and workspaces are searched. If telemetry is split across many workspaces without a clear design, responders may miss related logs or spend time switching scopes. If everything is in one workspace without access and retention planning, cost and data exposure can become problems.

Good workspace architecture balances operational investigation, access control, retention, data residency, and cost. Incident queries and workbooks should make the intended scope obvious.

##### Key Points to Mention

- Scope mistakes can look like missing data.
- Cross-resource incidents need queryable related telemetry.
- Workspace access control matters.
- Retention and table plans affect investigation.
- Workbooks should make scope visible.

<!-- question:end:log-analytics-queries-dashboards-and-availability-tests-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
