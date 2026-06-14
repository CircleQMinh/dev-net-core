---
id: correlation-ids-traces-health-checks-and-alertable-telemetry
topic: Scalability, resilience, caching, and observability design
subtopic: Correlation IDs, traces, health checks, and alertable telemetry
category: Design & Architecture
---

## Overview

Observability is the ability to understand a system's internal behavior from the signals it emits. In distributed systems, one user operation can cross HTTP services, message brokers, databases, caches, background workers, and third-party APIs.

Core signals include:

- **Traces:** the path and timing of one distributed operation.
- **Metrics:** aggregated numerical behavior over time.
- **Logs:** discrete contextual records.
- **Health checks:** current ability of an instance or subsystem to serve its intended role.

A correlation ID groups related activity under a business or request identifier. Distributed tracing adds structured parent-child relationships through trace and span IDs, commonly propagated using W3C Trace Context.

Telemetry is useful only when it supports:

- Detection.
- Diagnosis.
- Capacity planning.
- Security investigation.
- SLO measurement.
- Tested operational response.

Alertable telemetry must represent sustained user or business impact and have a clear owner and action. Paging on every exception, retry, or health-check transition creates noise and hides real incidents.

This topic matters in interviews because candidates must design end-to-end context propagation, distinguish health probes, control telemetry cost and cardinality, and define actionable alerts rather than merely saying to add logging.

## Core Concepts

### Observability Versus Monitoring

Monitoring checks known conditions:

```text
Is error rate above 2%?
Is queue age above 5 minutes?
```

Observability provides enough context to investigate unexpected behavior:

```text
Which dependency and tenant caused latency only for checkout requests?
```

Monitoring is built on observable signals. Dashboards without semantic context do not create observability.

### Correlation ID

A correlation ID identifies related work across components:

```http
X-Correlation-ID: order-checkout-7ef2...
```

Useful scopes:

- One inbound request.
- One business workflow.
- One saga.
- One batch job.
- One message chain.

Do not overload one identifier with every purpose. A business operation ID can remain stable for days, while a trace ID normally represents one execution path.

### Correlation ID Safety

Incoming IDs are untrusted input.

Validate:

- Length.
- Character set.
- Header count.
- Format.

Generate a new value if invalid. Do not place secrets, email addresses, or other personal data in identifiers. Propagate only to trusted destinations and prevent attacker-controlled values from causing log injection or excessive cardinality.

### Distributed Trace

A trace represents one operation as a graph of spans:

```text
HTTP POST /orders               trace
  -> validate request           span
  -> SQL insert                 span
  -> publish message            span
  -> inventory consumer         linked span
  -> inventory database update span
```

Each span records:

- Trace ID.
- Span ID.
- Parent or links.
- Start time and duration.
- Operation name.
- Status.
- Attributes.
- Events.
- Resource identity.

Use stable low-cardinality span names such as:

```text
GET /orders/{id}
```

not:

```text
GET /orders/839104
```

### W3C Trace Context

W3C Trace Context standardizes:

```http
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
tracestate: vendor=value
```

`traceparent` contains:

- Version.
- Trace ID.
- Parent span ID.
- Trace flags.

`tracestate` carries optional vendor-specific context.

Use standard propagation rather than inventing incompatible headers. A correlation ID can still exist for business lookup.

### Trace Context Across Messaging

For asynchronous messages:

- Inject trace context into message properties.
- Extract it at the consumer.
- Create a consumer or processing span.
- Use links when one batch combines multiple messages.
- Preserve business message, correlation, and causation IDs.

Do not make a days-long business workflow one continuously open span. Use separate traces connected by business IDs or span links.

### OpenTelemetry

OpenTelemetry provides vendor-neutral APIs, SDKs, semantic conventions, instrumentation, and export protocols for:

- Traces.
- Metrics.
- Logs.

Conceptual .NET setup:

```csharp
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource =>
        resource.AddService("ordering-api"))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddEntityFrameworkCoreInstrumentation()
        .AddSource("Ordering"))
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddMeter("Ordering"));
```

Export through an OpenTelemetry Collector or directly to a compatible backend according to operational needs.

### Custom Spans

Instrument business-relevant work not covered by automatic instrumentation:

```csharp
private static readonly ActivitySource ActivitySource =
    new("Ordering");

using var activity = ActivitySource.StartActivity("order.place");
activity?.SetTag("order.channel", command.Channel);
activity?.SetTag("tenant.tier", tenant.Tier);

await handler.Handle(command, cancellationToken);
```

Avoid recording:

- Full request bodies.
- Secrets or tokens.
- Personal information.
- Unbounded object IDs as metric dimensions.

Trace attributes can have higher cardinality than metric labels, but still affect cost and privacy.

### Metrics

Common metric types:

- Counter.
- Up-down counter.
- Histogram.
- Gauge or observable measurement.

Useful service metrics:

- Request rate.
- Error rate.
- Latency histogram.
- Active requests.
- Queue depth and age.
- Retry attempts.
- Circuit state.
- Cache hit ratio.
- Database pool utilization.
- Business completions and failures.

Prefer histograms and percentiles for latency rather than averages alone.

### Cardinality

Metric cardinality is the number of unique label combinations.

Dangerous labels:

- User ID.
- Request ID.
- Order ID.
- Raw URL.
- Exception message.

Safe bounded labels:

- Route template.
- HTTP method.
- Status class.
- Region.
- Dependency name.
- Known operation type.

High cardinality increases memory, storage, query cost, and alert instability. Put per-request identifiers in traces or logs, not metric dimensions.

### Logs

Structured logs:

```csharp
logger.LogInformation(
    "Order {OrderId} accepted for tenant {TenantId}",
    order.Id,
    tenant.Id);
```

Benefits:

- Searchable named properties.
- Correlation with trace context.
- Consistent redaction.
- Better aggregation.

Log levels should reflect action:

- Debug for development detail.
- Information for normal state transitions.
- Warning for recoverable abnormal conditions.
- Error for failed operations requiring investigation.
- Critical for severe service impact.

Do not log every successful retry as an error.

### Logs, Metrics, and Traces Together

Use:

- Metrics to detect and quantify.
- Traces to locate latency and failure paths.
- Logs for detailed events and state transitions.

Exemplars can connect a metric sample to representative traces. Include trace and span IDs in structured logs so an operator can pivot between signals.

### Sampling

Recording every trace can be too expensive.

Strategies:

- Head sampling at trace start.
- Tail sampling after outcome is known.
- Probability sampling.
- Always sample errors or high latency.
- Different rates by operation or environment.

Sampling must preserve enough evidence for rare failures. Metrics should continue to represent all traffic even when traces are sampled.

### Health Checks

A health check answers a narrow operational question.

ASP.NET Core:

```csharp
builder.Services.AddHealthChecks()
    .AddCheck<DatabaseReadinessCheck>(
        "database",
        tags: ["ready"]);

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

Keep public responses minimal. Detailed dependency information can expose architecture and should be restricted.

### Liveness, Readiness, and Startup

**Liveness**

- Is the process alive and making progress?
- Failure may trigger restart.
- Should avoid broad dependency checks.

**Readiness**

- Can this instance safely receive traffic?
- Failure removes it from load balancing.

**Startup**

- Has long initialization completed?
- Prevents premature liveness failure during startup.

If every instance fails liveness because a shared database is down, the orchestrator can restart the entire fleet and make recovery worse.

### Dependency Health

Checking a dependency can itself create load.

Use:

- Cheap bounded probes.
- Timeouts.
- Separate readiness semantics.
- Cached or scheduled checks when appropriate.
- Degraded status for optional dependencies.

Do not use deep business transactions as high-frequency liveness probes.

### Health Endpoint Security

Protect detailed endpoints:

- Network restriction.
- Authentication.
- Separate management port.
- Minimal response body.
- No secrets or internal exception text.
- No response caching.

A simple liveness endpoint often needs only an HTTP status.

### Service-Level Indicators and Objectives

An **SLI** is a measured service behavior:

- Successful request ratio.
- Latency under threshold.
- Fresh processing within deadline.

An **SLO** is a target:

```text
99.9% of checkout requests succeed within 500 ms over 30 days.
```

An error budget is the allowed unreliability implied by the SLO. Alerts should connect to meaningful consumption of that budget.

### Alert Design

An actionable alert has:

- Clear symptom.
- User or business impact.
- Threshold and evaluation window.
- Owner.
- Severity.
- Runbook.
- Useful context and dashboard links.
- Deduplication and routing.

Prefer symptom-based alerts:

```text
checkout success rate below SLO
queue oldest age threatens deadline
```

over cause-only alerts:

```text
CPU above 80%
one exception occurred
```

Cause metrics remain valuable for diagnosis.

### Multi-Window Alerting

A brief spike and a slow burn require different detection.

Use:

- Short window for severe rapid impact.
- Longer window for sustained degradation.
- Error-budget burn rates where available.

Avoid static thresholds without traffic context. A 5% error rate at 2 requests per minute differs from the same rate at 20,000 requests per second.

### Alert Fatigue

Reduce noise by:

- Paging only for urgent actionable impact.
- Sending lower-severity notifications to tickets or dashboards.
- Grouping related alerts.
- Suppressing dependent symptom storms.
- Requiring sustained conditions.
- Reviewing alerts after incidents.
- Deleting alerts with no owner or action.

If operators routinely ignore an alert, the system is not safer because it exists.

### Golden Signals and RED/USE

For request-driven services, RED:

- Rate.
- Errors.
- Duration.

For resources, USE:

- Utilization.
- Saturation.
- Errors.

Additional business signals are essential:

- Orders completed.
- Payments unresolved.
- Messages past deadline.
- Projection lag.

Infrastructure health can be green while the business workflow is broken.

### Queue and Async Telemetry

Measure:

- Arrival rate.
- Completion rate.
- Queue depth.
- Oldest-message age.
- Processing duration.
- Attempts.
- Dead-letter count.
- End-to-end business latency.

Propagate message and business IDs. Acknowledgement success alone does not prove the intended side effect occurred.

### Deployment Telemetry

Tag telemetry with bounded deployment context:

- Service version.
- Environment.
- Region.
- Deployment ring.

Compare errors and latency before and after deployment. Avoid per-instance dashboards as the only view; aggregate and preserve drill-down.

### Telemetry Pipeline Reliability

The telemetry system has limits too.

Design:

- Bounded application buffers.
- Nonblocking export.
- Batch export.
- Sampling.
- Backpressure or dropping policy.
- Collector redundancy.
- Cost and retention.

Application availability should not normally depend on synchronous telemetry export.

### Privacy and Security

Telemetry can contain sensitive data.

Apply:

- Data classification.
- Redaction before export.
- Access control.
- Encryption.
- Retention limits.
- Audit.
- Tenant separation.

Never log passwords, tokens, secrets, raw authorization headers, or unrestricted request bodies.

### Testing Observability

Test:

- Trace propagation across HTTP and messaging.
- Missing or malformed incoming context.
- Log and trace correlation.
- Sampling behavior.
- Health endpoint status.
- Dependency timeout in readiness.
- Alert rule with synthetic failures.
- Runbook and notification routing.
- Telemetry backend outage.
- Redaction.

An untested alert is a hypothesis, not an operational control.

### Common Mistakes

Common failures include:

- Treating correlation ID and trace ID as identical for every workflow.
- Creating custom trace headers instead of standards.
- Losing context at message boundaries.
- High-cardinality metric labels.
- Logging secrets or request bodies.
- Using averages for latency.
- Making liveness depend on every shared service.
- Exposing detailed health information publicly.
- Alerting on every exception or retry.
- Paging on causes without user impact.
- Sampling away all rare failures.
- Blocking application requests on telemetry export.
- Having dashboards without ownership or runbooks.

### Best-Practice Design Process

1. Define critical user and business journeys.
2. Define SLIs and SLOs.
3. Instrument standard HTTP, database, broker, and runtime signals.
4. Propagate W3C trace context across boundaries.
5. Preserve business correlation and causation IDs.
6. Add bounded custom spans, metrics, and structured logs.
7. Separate liveness, readiness, and startup semantics.
8. Control cardinality, sampling, privacy, cost, and retention.
9. Alert on sustained actionable impact.
10. Link alerts to dashboards, traces, logs, owners, and runbooks.
11. Test telemetry and incident response under failure.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is a correlation ID?

<!-- question:start:correlation-ids-traces-health-checks-and-alertable-telemetry-beginner-q01 -->
<!-- question-id:correlation-ids-traces-health-checks-and-alertable-telemetry-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A correlation ID groups logs and operations that belong to one request or business workflow across components. It should be propagated through HTTP and messages, validated when supplied externally, and included in structured telemetry. It may differ from a distributed trace ID when a workflow spans multiple executions.

##### Key Points to Mention

- Generate one when incoming context is missing or invalid.
- Do not include personal or secret data.
- Correlation supports search but not parent-child timing by itself.
- Business and technical identifiers can have different lifetimes.

<!-- question:end:correlation-ids-traces-health-checks-and-alertable-telemetry-beginner-q01 -->

#### What is a distributed trace?

<!-- question:start:correlation-ids-traces-health-checks-and-alertable-telemetry-beginner-q02 -->
<!-- question-id:correlation-ids-traces-health-checks-and-alertable-telemetry-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A distributed trace represents one operation as related spans across services and dependencies. Each span records timing, status, attributes, and parent relationships. It helps locate where latency or errors occur. W3C `traceparent` and `tracestate` provide interoperable context propagation.

##### Key Points to Mention

- A trace ID identifies the overall trace.
- A span ID identifies one operation.
- Context must cross HTTP and messaging boundaries.
- Sampling controls cost.

<!-- question:end:correlation-ids-traces-health-checks-and-alertable-telemetry-beginner-q02 -->

#### What is the difference between liveness and readiness?

<!-- question:start:correlation-ids-traces-health-checks-and-alertable-telemetry-beginner-q03 -->
<!-- question-id:correlation-ids-traces-health-checks-and-alertable-telemetry-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Liveness indicates whether the process is alive and should be restarted if stuck. Readiness indicates whether the instance can safely receive traffic now. A temporary shared dependency outage may make an instance unready or degraded without making it non-live, because restarting every instance may worsen the incident.

##### Key Points to Mention

- Startup probes cover slow initialization.
- Readiness controls traffic routing.
- Liveness should be simple and stable.
- Dependency checks need timeouts and intentional semantics.

<!-- question:end:correlation-ids-traces-health-checks-and-alertable-telemetry-beginner-q03 -->

#### What makes an alert actionable?

<!-- question:start:correlation-ids-traces-health-checks-and-alertable-telemetry-beginner-q04 -->
<!-- question-id:correlation-ids-traces-health-checks-and-alertable-telemetry-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

An actionable alert identifies meaningful user or business impact, has a clear owner and severity, includes enough context to investigate, and links to a tested runbook. It uses an evaluation window that avoids transient noise and pages only when timely human action is required.

##### Key Points to Mention

- Alert on symptoms and SLO impact.
- Avoid paging for every retry or exception.
- Group related failures.
- Review noisy or ignored alerts.

<!-- question:end:correlation-ids-traces-health-checks-and-alertable-telemetry-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you correlate logs, metrics, and traces?

<!-- question:start:correlation-ids-traces-health-checks-and-alertable-telemetry-intermediate-q01 -->
<!-- question-id:correlation-ids-traces-health-checks-and-alertable-telemetry-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Propagate standard trace context, include trace and span IDs plus business correlation IDs in structured logs, and use consistent service, route, region, and version attributes. Metrics detect impact; exemplars or links lead to representative traces; traces identify the failing path; logs provide detailed state transitions.

##### Key Points to Mention

- Use consistent naming and semantic conventions.
- Do not use request IDs as metric labels.
- Preserve context across asynchronous messages.
- Time synchronization and deployment metadata help diagnosis.

<!-- question:end:correlation-ids-traces-health-checks-and-alertable-telemetry-intermediate-q01 -->

#### How should ASP.NET Core health endpoints be designed?

<!-- question:start:correlation-ids-traces-health-checks-and-alertable-telemetry-intermediate-q02 -->
<!-- question-id:correlation-ids-traces-health-checks-and-alertable-telemetry-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Expose separate minimal liveness and tagged readiness checks. Liveness should verify process progress without expensive shared dependencies. Readiness can check required dependencies using short timeouts and report degraded or unhealthy according to whether useful traffic is possible. Restrict detailed output and disable response caching.

##### Key Points to Mention

- Orchestrators act differently on liveness and readiness.
- Probes must be cheap and bounded.
- Optional dependencies should not necessarily remove all traffic.
- Detailed diagnostics require authorization or network restriction.

<!-- question:end:correlation-ids-traces-health-checks-and-alertable-telemetry-intermediate-q02 -->

#### How do you control telemetry cardinality and cost?

<!-- question:start:correlation-ids-traces-health-checks-and-alertable-telemetry-intermediate-q03 -->
<!-- question-id:correlation-ids-traces-health-checks-and-alertable-telemetry-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use bounded metric dimensions such as route template, status class, region, and operation type. Keep user, object, request, raw URL, and exception text out of metric labels. Apply trace sampling, log-level policies, retention tiers, aggregation, and redaction. Monitor telemetry volume and dropped data.

##### Key Points to Mention

- High cardinality can destabilize monitoring systems.
- Metrics should represent all traffic even when traces are sampled.
- Tail sampling can retain errors and slow traces.
- Cost controls must preserve critical incident evidence.

<!-- question:end:correlation-ids-traces-health-checks-and-alertable-telemetry-intermediate-q03 -->

#### What telemetry would you collect for a queue consumer?

<!-- question:start:correlation-ids-traces-health-checks-and-alertable-telemetry-intermediate-q04 -->
<!-- question-id:correlation-ids-traces-health-checks-and-alertable-telemetry-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Collect arrival and completion rate, queue depth, oldest-message age, processing latency, attempts, lock loss, dead-letter count, and end-to-end business completion. Propagate trace, message, correlation, and causation IDs. Alert when backlog age threatens the business deadline rather than only when count is high.

##### Key Points to Mention

- Acknowledgement is not the same as business success.
- Age captures latency better than count alone.
- Separate poison-message and capacity failures.
- Trace message publication and consumption.

<!-- question:end:correlation-ids-traces-health-checks-and-alertable-telemetry-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design SLO-based alerting for a critical API?

<!-- question:start:correlation-ids-traces-health-checks-and-alertable-telemetry-advanced-q01 -->
<!-- question-id:correlation-ids-traces-health-checks-and-alertable-telemetry-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Define availability and latency SLIs from the caller's perspective, set an SLO and error budget, and alert on rapid and sustained budget burn using multiple windows. Page for urgent impact with a runbook; route slower degradation to investigation. Include minimum traffic safeguards and diagnostic links to routes, regions, dependencies, deployments, and traces.

##### Key Points to Mention

- Error-budget burn connects alerts to reliability targets.
- Short and long windows catch fast and slow incidents.
- Infrastructure causes support diagnosis but are not the primary symptom.
- Validate alert behavior with synthetic failures.

<!-- question:end:correlation-ids-traces-health-checks-and-alertable-telemetry-advanced-q01 -->

#### How should trace context work across a long-running asynchronous workflow?

<!-- question:start:correlation-ids-traces-health-checks-and-alertable-telemetry-advanced-q02 -->
<!-- question-id:correlation-ids-traces-health-checks-and-alertable-telemetry-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Inject W3C context into each message and create producer and consumer spans, using links when processing batches or when causal work is not a strict parent-child continuation. Preserve a stable business operation and causation ID across retries and days-long workflow stages. Use separate traces when appropriate instead of one permanently open span.

##### Key Points to Mention

- Trace IDs and business workflow IDs have different lifetimes.
- Duplicate messages should remain identifiable.
- Sampling decisions can cross service boundaries but are not blindly trusted.
- Durable workflow state remains the operational source of truth.

<!-- question:end:correlation-ids-traces-health-checks-and-alertable-telemetry-advanced-q02 -->

#### How do health checks cause cascading failure when designed poorly?

<!-- question:start:correlation-ids-traces-health-checks-and-alertable-telemetry-advanced-q03 -->
<!-- question-id:correlation-ids-traces-health-checks-and-alertable-telemetry-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Expensive probes can overload dependencies, and liveness checks tied to a shared outage can restart every instance. Strict readiness failure can remove all capacity even when degraded service is possible. Use cheap bounded probes, separate probe purposes, cache scheduled dependency results when appropriate, and configure orchestrator actions and thresholds deliberately.

##### Key Points to Mention

- Probe traffic is production traffic.
- Restarting does not repair an external dependency.
- Readiness should reflect ability to serve useful work.
- Protect detailed health endpoints from disclosure and abuse.

<!-- question:end:correlation-ids-traces-health-checks-and-alertable-telemetry-advanced-q03 -->

#### How would you design observability for a partial regional failure?

<!-- question:start:correlation-ids-traces-health-checks-and-alertable-telemetry-advanced-q04 -->
<!-- question-id:correlation-ids-traces-health-checks-and-alertable-telemetry-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Tag bounded telemetry by region, zone, service version, route, and dependency; measure regional success, latency, saturation, and failover routing; and preserve global business SLIs. Traces should expose cross-region calls and fallback. Alerts distinguish one-region degradation from global impact, and telemetry collectors and storage must remain available when the affected region is impaired.

##### Key Points to Mention

- Global averages can hide one failed region.
- Telemetry needs an independent failure strategy.
- Compare failover capacity and dependency health.
- Runbooks should define routing, rollback, and recovery verification.

<!-- question:end:correlation-ids-traces-health-checks-and-alertable-telemetry-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
