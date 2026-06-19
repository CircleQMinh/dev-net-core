---
id: metrics-vs-logs-vs-traces
topic: Monitoring, tracing, and incident response on Azure
subtopic: Metrics vs logs vs traces
category: Azure
---

## Overview

Metrics, logs, and traces are the three core telemetry signals used to understand production systems. Azure Monitor brings these signals together across Azure resources, applications, infrastructure, and hybrid environments.

Each signal answers a different kind of question:

- Metrics answer "What is happening over time?"
- Logs answer "What happened in detail?"
- Distributed traces answer "Where did this request go and where did time or failure occur?"

A strong monitoring design does not choose one signal and ignore the others. Metrics are excellent for dashboards and fast alerts. Logs are excellent for investigation and detailed evidence. Traces are excellent for following a request across services and dependencies.

For interviews, candidates should be able to explain signal differences, storage and query trade-offs, cardinality, sampling, correlation IDs, KQL, metric dimensions, alert design, and how to use telemetry during an incident.

## Core Concepts

### Observability Signals

Observability is the ability to understand a system's internal behavior from the telemetry it emits.

The main signals are:

| Signal | Shape | Best for |
|---|---|---|
| Metrics | Numeric time series | Trends, alerting, dashboards, SLOs |
| Logs | Timestamped records | Investigation, audit, detailed diagnostics |
| Traces | Connected spans | End-to-end request flow and latency analysis |

These signals complement each other. A metric tells you error rate increased. A log tells you which errors occurred. A trace tells you which dependency caused the failed request.

### Metrics

Metrics are numeric values collected at regular intervals. In Azure Monitor, native platform metrics are stored in a time-series database and are optimized for fast charting and alerting.

Examples:

- CPU percentage.
- Request count.
- Failed request rate.
- Queue length.
- Database DTU or CPU usage.
- Service Bus active message count.
- App response time.

Metrics are usually aggregated over a time window using functions such as average, minimum, maximum, count, percentile, or total.

### Metric Dimensions

Dimensions are name/value pairs that provide context for a metric.

Example:

```text
Metric: Request duration
Dimensions:
  route = /api/orders/{id}
  statusCode = 200
  region = eastus
```

Dimensions let you split and filter metrics, but every additional dimension increases cardinality. High-cardinality dimensions such as user ID, request ID, or full URL can make metrics expensive or impractical. Put high-cardinality details in logs or traces instead.

### Platform Metrics and Custom Metrics

Platform metrics are emitted by Azure resources without extra configuration. They are useful for infrastructure health and service-level alerting.

Custom metrics are emitted by applications or agents. They are useful for business and application health signals such as:

- Orders submitted per minute.
- Payment failures.
- Cart checkout latency.
- Background job backlog.
- Cache hit rate.

Good custom metrics are stable, low-cardinality, and tied to user impact or system health.

### Logs

Logs are timestamped records with structured fields and message text. Azure Monitor Logs stores log data in Log Analytics workspaces, where it can be queried with Kusto Query Language.

Examples:

- Application log events.
- Exceptions.
- Dependency failures.
- Audit records.
- Azure Activity Log entries.
- Diagnostic logs from Azure resources.
- Container logs.

Logs are richer than metrics, but they are usually more expensive to query and alert on. They are best for investigation, not every-second heartbeat alerting.

### Structured Logging

Structured logs store important values as fields rather than hiding everything in a string.

Less useful:

```text
Failed to process order 100187 for tenant 42
```

More useful:

```json
{
  "message": "Failed to process order",
  "orderId": "100187",
  "tenantId": "42",
  "operation": "ProcessOrder",
  "exceptionType": "TimeoutException"
}
```

Structured logs make KQL filtering, grouping, and dashboarding far easier.

### Distributed Traces

Distributed traces represent one operation as a tree or graph of spans. A span is a timed unit of work, such as an HTTP request, database call, queue handler, or dependency call.

Traces answer:

- Which services handled this request?
- Which dependency was slow?
- Where did the error first occur?
- Did retries increase latency?
- Did a queue message originate from a specific API request?

In Azure, Application Insights and OpenTelemetry are commonly used to collect request, dependency, exception, and span data.

### Trace Context and Correlation

Correlation connects telemetry from the same operation. Without correlation, an incident becomes a scavenger hunt.

Common correlation identifiers include:

- Trace ID.
- Span ID.
- Parent span ID.
- Operation ID.
- Correlation ID.
- Request ID.
- Message ID.

For asynchronous systems, propagate correlation IDs through messages, events, and background work. A queue consumer should log the incoming message ID and the original request correlation ID.

### Metrics Versus Logs

Metrics are compact and optimized for aggregation. Logs are detailed and optimized for investigation.

Use metrics when:

- You need fast dashboards.
- You need low-latency alerting.
- You need trends or SLO calculations.
- The value is numeric and regularly sampled.

Use logs when:

- You need details.
- You need text or structured event fields.
- You need audit evidence.
- You need ad hoc investigation.

Do not log every request only to compute basic request rate if a metric already gives the answer.

### Logs Versus Traces

Logs are independent records. Traces connect related work into an end-to-end path.

Use logs when:

- You need business details.
- You need exception context.
- You need audit records.
- You need custom diagnostic messages.

Use traces when:

- A request crosses services.
- Latency must be broken down by dependency.
- You need causal relationships.
- You need a transaction timeline.

Good systems link logs to trace IDs so investigators can move between both views.

### Sampling

Sampling reduces telemetry volume by keeping only a subset of events or traces. It helps control cost and overhead, but it can hide rare failures if applied carelessly.

Sampling strategy should preserve:

- Errors.
- Slow requests.
- Security-relevant events.
- Business-critical operations.
- Representative successful traffic.

Do not blindly sample away the exact data needed to explain production incidents.

### Cardinality

Cardinality is the number of distinct values for a field or dimension. High cardinality is dangerous for metrics and dashboards.

High-cardinality examples:

- User ID.
- Email address.
- Full URL with query string.
- Request ID.
- Order ID.

These are useful in logs and traces, but usually poor metric dimensions. For metrics, prefer bounded values such as route template, region, status code family, dependency type, or operation name.

### Latency, Ingestion Delay, and Freshness

Telemetry is not always available instantly. Platform metrics, logs, traces, and exported diagnostic data can have different ingestion delays.

Interview-worthy design point:

- Use metric alerts for fast operational detection.
- Use logs and traces for deeper diagnosis.
- Avoid alert rules that assume every log arrives immediately.
- Make dashboards show the time range and query freshness clearly.

### SLI, SLO, and Error Budget

A service-level indicator is a measurement such as availability, latency, or error rate. A service-level objective is the target for that measurement.

Examples:

```text
SLI: Percentage of successful checkout requests
SLO: 99.9% success over 30 days

SLI: p95 API latency
SLO: p95 under 500 ms for 99% of 5-minute windows
```

Metrics usually power SLIs. Logs and traces explain why SLOs are missed.

### Azure Monitor Data Stores

Azure Monitor uses different stores for different telemetry:

- Azure Monitor Metrics stores numeric time-series data.
- Log Analytics workspaces store logs and trace data queried with KQL.
- Azure Monitor workspaces store Prometheus and OpenTelemetry metrics queried with PromQL.

The names are similar, but the resource types and query languages differ. A good candidate will not blur them together.

### Practical Incident Workflow

A typical investigation flow:

1. Metric alert fires for error rate or latency.
2. Dashboard confirms scope and impact.
3. Logs identify the dominant exception, route, tenant, or deployment version.
4. Traces show the failing dependency or slow span.
5. Deployment, configuration, and dependency telemetry identify the likely cause.
6. Incident notes record actions and evidence.
7. Post-incident work adds missing telemetry or better alerts.

Metrics detect. Logs explain. Traces connect.

### Common Mistakes

- Logging unstructured strings that cannot be queried reliably.
- Using high-cardinality metric dimensions.
- Alerting on noisy logs without grouping or suppression.
- Forgetting correlation IDs across queues and events.
- Sampling away all successful requests and losing baseline behavior.
- Treating traces as a substitute for business audit logs.
- Treating logs as a substitute for fast metric alerts.
- Creating dashboards with dozens of charts and no user-impact signal.
- Monitoring infrastructure but not business outcomes.
- Storing secrets, tokens, or personal data in telemetry.

### Best Practices

- Define user-impact SLIs first.
- Use metrics for fast detection and trends.
- Use logs for detailed diagnosis and audit.
- Use traces for cross-service request flow.
- Emit structured logs.
- Propagate trace context and correlation IDs.
- Keep metric dimensions bounded.
- Use sampling deliberately.
- Redact sensitive data before ingestion.
- Build dashboards around symptoms, saturation, errors, and latency.
- Review telemetry gaps after incidents.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the difference between metrics, logs, and traces?

<!-- question:start:metrics-vs-logs-vs-traces-beginner-q01 -->
<!-- question-id:metrics-vs-logs-vs-traces-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Metrics are numeric time-series values used for trends, dashboards, and alerts. Logs are timestamped records with detailed diagnostic or audit information. Traces connect related operations into an end-to-end request path across services and dependencies.

In practice, metrics detect problems quickly, logs provide detail, and traces show where a request spent time or failed.

##### Key Points to Mention

- Metrics are numeric and aggregated.
- Logs contain detailed events.
- Traces contain spans and relationships.
- The signals complement each other.
- Azure Monitor supports all three.

<!-- question:end:metrics-vs-logs-vs-traces-beginner-q01 -->

#### When would you use a metric instead of a log?

<!-- question:start:metrics-vs-logs-vs-traces-beginner-q02 -->
<!-- question-id:metrics-vs-logs-vs-traces-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Use a metric when the data is numeric, regularly measured, and useful for aggregation or alerting. Examples include CPU percentage, request count, error rate, latency percentile, queue depth, and cache hit rate.

Metrics are usually better for fast dashboards and alerts because they are compact and optimized for time-series analysis.

##### Key Points to Mention

- Metrics are good for trends.
- Metrics are efficient for alerting.
- Metrics can have dimensions.
- Logs are better for rich detail.
- User-impact metrics are more valuable than vanity metrics.

<!-- question:end:metrics-vs-logs-vs-traces-beginner-q02 -->

#### What is a distributed trace?

<!-- question:start:metrics-vs-logs-vs-traces-beginner-q03 -->
<!-- question-id:metrics-vs-logs-vs-traces-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A distributed trace shows the path of one operation across services and dependencies. It is made of spans, where each span represents timed work such as an HTTP request, database call, queue handler, or external API call.

Traces help identify where latency or failure occurred in a distributed system.

##### Key Points to Mention

- A trace contains spans.
- Spans have timing and parent-child relationships.
- Trace context must be propagated.
- Traces are useful for microservices and async workflows.
- Application Insights can visualize traces and dependencies.

<!-- question:end:metrics-vs-logs-vs-traces-beginner-q03 -->

#### Why is correlation important in monitoring?

<!-- question:start:metrics-vs-logs-vs-traces-beginner-q04 -->
<!-- question-id:metrics-vs-logs-vs-traces-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Correlation connects telemetry from the same operation, such as logs, spans, dependency calls, and queue messages. Without correlation, engineers must manually guess which records belong together.

Correlation IDs, trace IDs, message IDs, and operation IDs make incidents faster to diagnose.

##### Key Points to Mention

- Correlation links telemetry records.
- Trace IDs connect spans.
- Correlation IDs should cross async boundaries.
- Logs should include correlation fields.
- Missing correlation slows incident response.

<!-- question:end:metrics-vs-logs-vs-traces-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How do metric dimensions differ from log fields?

<!-- question:start:metrics-vs-logs-vs-traces-intermediate-q01 -->
<!-- question-id:metrics-vs-logs-vs-traces-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Metric dimensions are bounded labels used to split and filter numeric time series. Log fields are structured properties stored with individual records and can be much more detailed.

Metric dimensions must be kept low-cardinality because every distinct combination can create another time series. High-cardinality values such as user ID, request ID, or order ID usually belong in logs or traces, not metric dimensions.

##### Key Points to Mention

- Dimensions label metric series.
- Log fields can carry richer details.
- High-cardinality dimensions are risky.
- Use route templates, not full URLs, for metrics.
- Use logs and traces for unique identifiers.

<!-- question:end:metrics-vs-logs-vs-traces-intermediate-q01 -->

#### How would you instrument an API for production observability?

<!-- question:start:metrics-vs-logs-vs-traces-intermediate-q02 -->
<!-- question-id:metrics-vs-logs-vs-traces-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Instrument request count, error rate, latency percentiles, dependency calls, exceptions, and key business outcomes. Emit structured logs with operation names, tenant or bounded category fields, correlation IDs, and error context. Use distributed tracing for incoming requests, outbound HTTP calls, database calls, and queue processing.

Avoid sensitive data in telemetry and keep metric dimensions bounded. Build dashboards and alerts around user-impact signals.

##### Key Points to Mention

- Capture requests, dependencies, exceptions, and latency.
- Emit business metrics.
- Use structured logs.
- Propagate trace context.
- Redact secrets and personal data.

<!-- question:end:metrics-vs-logs-vs-traces-intermediate-q02 -->

#### How should sampling be handled?

<!-- question:start:metrics-vs-logs-vs-traces-intermediate-q03 -->
<!-- question-id:metrics-vs-logs-vs-traces-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Sampling should reduce volume while preserving diagnostic value. Keep errors, slow requests, security-relevant events, and critical business operations. Sample successful high-volume traffic if needed, but make sure enough baseline data remains to compare failures with normal behavior.

Sampling strategy should be documented and tested because aggressive sampling can hide rare incidents.

##### Key Points to Mention

- Sampling controls cost and overhead.
- Preserve failures and slow requests.
- Avoid hiding rare critical issues.
- Keep enough successful traffic for baseline comparison.
- Document sampling assumptions.

<!-- question:end:metrics-vs-logs-vs-traces-intermediate-q03 -->

#### How do you investigate a latency incident using all three signals?

<!-- question:start:metrics-vs-logs-vs-traces-intermediate-q04 -->
<!-- question-id:metrics-vs-logs-vs-traces-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Start with metrics to confirm the latency increase, time window, scope, and affected routes or regions. Use logs to find exceptions, deployment changes, throttling, or unusual request properties. Use traces to follow slow requests across services and identify the slow span or dependency.

The signals should be correlated by operation or trace ID so the investigation moves from symptom to cause quickly.

##### Key Points to Mention

- Metrics confirm impact and trend.
- Logs provide detailed evidence.
- Traces identify slow dependencies.
- Correlation IDs connect the data.
- Compare current behavior with a known-good window.

<!-- question:end:metrics-vs-logs-vs-traces-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design telemetry for an asynchronous order workflow?

<!-- question:start:metrics-vs-logs-vs-traces-advanced-q01 -->
<!-- question-id:metrics-vs-logs-vs-traces-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Define business and technical signals for each step: order submitted, payment authorized, inventory reserved, message queued, message processed, retry count, DLQ count, and end-to-end completion latency. Emit metrics for throughput, failure rate, queue age, and latency. Emit structured logs for state transitions and failures. Propagate trace context or correlation IDs through messages so API requests and background consumers can be connected.

Use dashboards for workflow health and alerts for user-impact failures, stuck messages, and delayed processing.

##### Key Points to Mention

- Measure business outcomes, not only infrastructure.
- Track queue backlog and oldest message age.
- Log state transitions with correlation IDs.
- Propagate context through messages.
- Alert on stuck or failed workflow stages.

<!-- question:end:metrics-vs-logs-vs-traces-advanced-q01 -->

#### How do you control telemetry cost without losing incident visibility?

<!-- question:start:metrics-vs-logs-vs-traces-advanced-q02 -->
<!-- question-id:metrics-vs-logs-vs-traces-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Start by defining which telemetry supports alerts, incident response, audit, and long-term analysis. Reduce noisy debug logs, use structured fields instead of verbose strings, avoid high-cardinality metric dimensions, sample high-volume successful traces, and retain different tables for different periods.

Preserve errors, security events, key business operations, and enough successful traffic for comparison. Cost control should be reviewed after incidents to ensure the team did not remove the evidence needed for diagnosis.

##### Key Points to Mention

- Tie telemetry to operational use cases.
- Reduce noise before reducing useful data.
- Avoid high-cardinality metrics.
- Use sampling carefully.
- Use retention and table plans intentionally.

<!-- question:end:metrics-vs-logs-vs-traces-advanced-q02 -->

#### What makes a telemetry design interview answer strong?

<!-- question:start:metrics-vs-logs-vs-traces-advanced-q03 -->
<!-- question-id:metrics-vs-logs-vs-traces-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

A strong answer starts with user-impact questions, then maps those questions to metrics, logs, and traces. It includes alert strategy, dashboards, correlation, cost controls, privacy controls, ownership, and incident workflow. It also describes what telemetry is needed for both detection and diagnosis.

Weak answers list tools without explaining how the team uses the data during production incidents.

##### Key Points to Mention

- Start with operational questions and SLOs.
- Map each signal to a purpose.
- Include correlation and context propagation.
- Discuss cost, privacy, and retention.
- Explain how incidents are detected and diagnosed.

<!-- question:end:metrics-vs-logs-vs-traces-advanced-q03 -->

#### How would you prevent telemetry from leaking sensitive data?

<!-- question:start:metrics-vs-logs-vs-traces-advanced-q04 -->
<!-- question-id:metrics-vs-logs-vs-traces-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Define a telemetry data classification policy. Do not log secrets, tokens, passwords, full payment data, sensitive personal data, or raw request bodies by default. Redact or hash identifiers where possible, use allowlists for logged fields, restrict workspace access, and set retention based on business need.

Review telemetry during code review and incident review. Sensitive data leakage in logs is a production security issue, not just a logging mistake.

##### Key Points to Mention

- Use allowlists instead of logging everything.
- Redact secrets and personal data.
- Avoid full request and response bodies.
- Restrict Log Analytics access.
- Include telemetry safety in reviews.

<!-- question:end:metrics-vs-logs-vs-traces-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
