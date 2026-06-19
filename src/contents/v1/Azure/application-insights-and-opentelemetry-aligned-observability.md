---
id: application-insights-and-opentelemetry-aligned-observability
topic: Monitoring, tracing, and incident response on Azure
subtopic: Application Insights and OpenTelemetry-aligned observability
category: Azure
---

## Overview

Application Insights is the application performance monitoring feature of Azure Monitor. It helps teams monitor live applications by collecting requests, dependencies, exceptions, traces, metrics, availability results, and user behavior telemetry.

Modern Application Insights guidance is aligned with OpenTelemetry for supported server-side scenarios. OpenTelemetry provides a vendor-neutral model for traces, metrics, and logs. Azure Monitor provides the managed ingestion, analysis, dashboards, alerts, and Application Insights experiences.

For interviews, the important idea is not just "turn on Application Insights." A strong candidate should explain what is automatically collected, what must be instrumented manually, how trace context is propagated, how OpenTelemetry spans map to requests and dependencies, how sampling and cardinality affect cost, and how Application Insights supports incident investigation.

## Core Concepts

### Application Performance Monitoring

Application performance monitoring focuses on application behavior from the user's point of view and from the runtime's point of view.

Application Insights commonly helps answer:

- Is the application available?
- Are requests failing?
- Which routes are slow?
- Which dependencies are failing?
- Which exceptions increased after deployment?
- Which users or regions are affected?
- Which service in a distributed transaction caused the delay?

It is most valuable when it is connected to deployment, infrastructure, and business telemetry.

### OpenTelemetry Alignment

OpenTelemetry defines vendor-neutral APIs, SDKs, semantic conventions, and exporters for observability telemetry.

Why it matters:

- Instrumentation is less tied to one vendor.
- Common libraries can emit standard spans and metrics.
- Trace context can flow across service boundaries.
- Teams can use the same concepts across cloud providers and tools.
- Migration and multi-tool strategies are easier.

In Azure, the Azure Monitor OpenTelemetry Distro is the recommended setup for most new code-based server-side Application Insights scenarios.

### What Application Insights Collects

Depending on platform and instrumentation, Application Insights can collect:

- Incoming requests.
- Outgoing dependencies.
- Exceptions.
- Logs and traces.
- Custom metrics.
- Custom events.
- Page views and browser telemetry.
- Availability test results.
- Live metrics.
- Performance counters or runtime metrics.

Automatic collection is useful, but production systems usually need additional domain-specific metrics and logs.

### Workspace-Based Application Insights

Modern Application Insights resources are workspace-based. Telemetry is stored in a Log Analytics workspace, which enables KQL queries, retention management, cross-resource queries, access control, and integration with other Azure Monitor features.

This matters because:

- Application logs and traces can be queried with other resource telemetry.
- Access can be controlled through workspace and table permissions.
- Retention and cost settings are managed at the workspace or table level.
- Dashboards and alerts can use KQL across related data.

### Requests and Dependencies

An incoming HTTP request is typically represented as a server-side request span. Outbound calls are dependencies.

Examples of dependencies:

- SQL queries.
- HTTP calls to another service.
- Azure Service Bus sends or receives.
- Azure Storage operations.
- Redis calls.
- Cosmos DB calls.

Application Insights uses this data to build transaction timelines and application maps.

### Exceptions and Failure Analysis

Exception telemetry helps identify the type, message, stack, affected operation, and frequency of failures.

Useful exception context includes:

- Operation name.
- Trace ID.
- Request route.
- Deployment version.
- Tenant or bounded customer segment.
- Dependency name.
- Retry attempt.
- Message or job ID.

Do not log secrets, tokens, full personal data, or raw request bodies just because an exception occurred.

### Distributed Tracing

Distributed tracing links work across services. An API request might call another API, write to SQL, publish a Service Bus message, and later run a background handler.

The trace should show:

- Root operation.
- Child spans.
- Duration of each span.
- Errors.
- Dependency names.
- Attributes such as route, status code, and service name.

When trace context cannot be propagated automatically, pass an explicit correlation ID through message properties or headers.

### .NET OpenTelemetry Setup

A simplified .NET setup often includes resource identity, ASP.NET Core instrumentation, HTTP client instrumentation, and Azure Monitor export.

```csharp
builder.Services.AddOpenTelemetry()
    .UseAzureMonitor(options =>
    {
        options.ConnectionString =
            builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"];
    });
```

Production setup usually also defines service name, service version, custom instrumentation, sampling, and logging integration.

### Service Identity in Telemetry

Every service should emit consistent identity attributes:

```text
service.name = checkout-api
service.namespace = commerce
service.version = 2026.06.18.1
deployment.environment = production
cloud.region = eastus
```

These fields make dashboards, application maps, and incident analysis much sharper. Without service identity, telemetry from different deployments can blur together.

### Custom Spans

Automatic instrumentation does not know every business operation. Add custom spans around important work.

```csharp
using var activity = activitySource.StartActivity("ReserveInventory");
activity?.SetTag("inventory.reservation_type", "standard");
activity?.SetTag("messaging.message_id", messageId);

await inventoryService.ReserveAsync(orderId, cancellationToken);
```

Use bounded tags. Avoid high-cardinality or sensitive values unless there is a clear diagnostic purpose.

### Custom Metrics

Custom metrics should describe business or application health.

Examples:

- Checkout attempts.
- Payment authorization failures.
- Queue processing latency.
- Cache hit ratio.
- Background job success rate.
- Documents scanned per minute.

Use metrics for trends and alertable signals. Do not create a metric dimension for every user or order.

### Logs and OpenTelemetry

OpenTelemetry can collect logs in supported scenarios, but many .NET applications still think in terms of `ILogger`. The important design principle is consistent structured fields and correlation.

```csharp
logger.LogWarning(
    "Payment authorization failed for order {OrderId} with provider {Provider}",
    orderId,
    providerName);
```

The message template creates structured fields that can be queried later. Correlation should connect the log to the active trace.

### Application Map

Application Map visualizes components and dependencies. It helps identify:

- Which services call each other.
- Which dependency has high failure rate.
- Which component is slow.
- Whether a failure is localized or widespread.

Application Map is only as good as the telemetry identity and dependency tracking. Ambiguous service names create ambiguous maps.

### Live Metrics

Live metrics provide near real-time visibility into request rate, failure rate, dependency behavior, and server health. They are useful during deployments and active incidents.

Live metrics are not a long-term analysis store. Use metrics, logs, and traces for historical investigation and reporting.

### Availability Tests

Application Insights availability tests are synthetic checks that call HTTP or HTTPS endpoints from configured locations.

They help detect:

- Public endpoint downtime.
- Slow response.
- TLS certificate problems.
- Region-specific connectivity issues.
- Broken critical dependencies when the test exercises them.

Use current Standard tests for availability monitoring. Classic URL ping tests are retired on September 30, 2026, so new designs should not depend on them.

### Browser Telemetry

Browser telemetry can track page views, client-side exceptions, performance, and user behavior. Browser Application Insights currently uses the JavaScript SDK rather than OpenTelemetry.

Be careful with:

- Personal data.
- Query strings.
- User identifiers.
- Session tracking.
- Client-side sampling.
- Consent and privacy requirements.

Client telemetry should complement server telemetry, not replace it.

### Sampling and Cost

Application telemetry can be high volume. Sampling reduces ingestion, but bad sampling can hide rare failures.

Recommended thinking:

- Keep errors and slow operations.
- Sample high-volume successful requests if needed.
- Keep enough successful traffic for comparison.
- Understand how sampling affects counts and metrics.
- Monitor SDK or exporter drops and ingestion failures.

Cost control should never silently remove the evidence needed for incidents.

### Migration from Classic SDKs

For new applications, prefer OpenTelemetry-based instrumentation where supported. Classic Application Insights SDKs may still exist in older applications, but migration planning matters.

An interview answer should mention:

- Avoid mixing incompatible instrumentation paths blindly.
- Preserve operation names and correlation behavior.
- Validate dashboards and alerts after migration.
- Compare telemetry volume and sampling behavior.
- Keep business-critical custom telemetry.

### Security and Privacy

Observability data can be sensitive. Treat it as production data.

Controls include:

- Redaction before ingestion.
- Workspace access control.
- Table-level access where needed.
- Retention policies.
- Private networking or firewall configuration where required.
- Avoiding secrets in attributes, logs, and exception details.

Telemetry should help operations without becoming a data leak.

### Common Mistakes

- Assuming automatic instrumentation captures business health.
- Not setting service name and version.
- Forgetting async message correlation.
- Creating high-cardinality custom metric dimensions.
- Logging raw request bodies.
- Sampling away all interesting failures.
- Not validating telemetry after deployment.
- Building alerts on noisy implementation details.
- Treating Application Insights as only a dashboard tool.
- Using legacy instrumentation for new apps without a reason.

### Best Practices

- Use Azure Monitor OpenTelemetry Distro for new supported server-side apps.
- Set consistent service identity attributes.
- Instrument key business operations manually.
- Propagate trace context across HTTP, messaging, and background work.
- Use structured logs and bounded tags.
- Protect sensitive data before ingestion.
- Create availability tests for critical endpoints.
- Build dashboards around user impact, dependencies, and recent deployments.
- Alert on symptoms and SLOs, not every exception.
- Review telemetry gaps after incidents.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is Application Insights?

<!-- question:start:application-insights-and-opentelemetry-aligned-observability-beginner-q01 -->
<!-- question-id:application-insights-and-opentelemetry-aligned-observability-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Application Insights is the application performance monitoring feature of Azure Monitor. It collects and analyzes application telemetry such as requests, dependencies, exceptions, traces, metrics, availability results, and user behavior data.

It helps developers and operators understand application health, performance, failures, and user impact.

##### Key Points to Mention

- Part of Azure Monitor.
- Focused on application monitoring.
- Captures requests, dependencies, and exceptions.
- Supports dashboards, logs, alerts, and transaction diagnostics.
- Modern server-side instrumentation aligns with OpenTelemetry.

<!-- question:end:application-insights-and-opentelemetry-aligned-observability-beginner-q01 -->

#### What is OpenTelemetry?

<!-- question:start:application-insights-and-opentelemetry-aligned-observability-beginner-q02 -->
<!-- question-id:application-insights-and-opentelemetry-aligned-observability-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

OpenTelemetry is a vendor-neutral observability framework for collecting telemetry such as traces, metrics, and logs. It provides common APIs, SDKs, instrumentation libraries, semantic conventions, and exporters.

In Azure, OpenTelemetry can be used with Application Insights through Azure Monitor instrumentation and export paths.

##### Key Points to Mention

- Vendor-neutral observability standard.
- Supports traces, metrics, and logs.
- Helps avoid tool-specific instrumentation lock-in.
- Enables trace context propagation.
- Azure Monitor provides ingestion and analysis.

<!-- question:end:application-insights-and-opentelemetry-aligned-observability-beginner-q02 -->

#### What telemetry does Application Insights commonly collect?

<!-- question:start:application-insights-and-opentelemetry-aligned-observability-beginner-q03 -->
<!-- question-id:application-insights-and-opentelemetry-aligned-observability-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Application Insights commonly collects incoming requests, outgoing dependencies, exceptions, logs, traces, custom metrics, custom events, browser page views, and availability test results.

The exact telemetry depends on the platform, SDK, automatic instrumentation, and manual instrumentation used by the application.

##### Key Points to Mention

- Requests and dependencies are core APM telemetry.
- Exceptions support failure analysis.
- Custom metrics and events capture business behavior.
- Availability tests monitor endpoints synthetically.
- Manual instrumentation is still needed for domain-specific signals.

<!-- question:end:application-insights-and-opentelemetry-aligned-observability-beginner-q03 -->

#### Why does service name matter in OpenTelemetry?

<!-- question:start:application-insights-and-opentelemetry-aligned-observability-beginner-q04 -->
<!-- question-id:application-insights-and-opentelemetry-aligned-observability-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

The service name identifies which application or component emitted telemetry. Without a clear service name, telemetry from multiple apps can be hard to separate and application maps become confusing.

Service name, version, and environment help teams filter telemetry by deployment and diagnose whether a problem is isolated to a specific service or release.

##### Key Points to Mention

- Service name identifies the emitting component.
- Version helps diagnose deployment regressions.
- Environment separates dev, test, and production.
- Good identity improves application maps.
- Consistency matters across services.

<!-- question:end:application-insights-and-opentelemetry-aligned-observability-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### What should be automatically instrumented versus manually instrumented?

<!-- question:start:application-insights-and-opentelemetry-aligned-observability-intermediate-q01 -->
<!-- question-id:application-insights-and-opentelemetry-aligned-observability-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Automatically instrument framework-level operations such as HTTP requests, outbound HTTP calls, common database calls, exceptions, and runtime metrics. Manually instrument domain-specific operations such as checkout, payment authorization, inventory reservation, document scanning, or queue workflow stages.

Automatic instrumentation gives broad coverage. Manual instrumentation explains business health and the meaning of important operations.

##### Key Points to Mention

- Automatic instrumentation covers common libraries.
- Manual spans capture business operations.
- Custom metrics capture business outcomes.
- Use bounded tags and structured fields.
- Avoid sensitive or high-cardinality attributes.

<!-- question:end:application-insights-and-opentelemetry-aligned-observability-intermediate-q01 -->

#### How do Application Insights requests and dependencies relate to traces?

<!-- question:start:application-insights-and-opentelemetry-aligned-observability-intermediate-q02 -->
<!-- question-id:application-insights-and-opentelemetry-aligned-observability-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

An incoming request is usually represented as a server span. Outgoing calls to databases, HTTP services, queues, or storage are dependency spans. Together they form a distributed trace that shows the path, timing, and failures of one operation.

This lets engineers see whether latency came from application code, a database, a downstream API, or messaging work.

##### Key Points to Mention

- Requests are server-side operations.
- Dependencies are outbound calls.
- Spans connect through trace context.
- Application Map uses dependency relationships.
- Traces show latency breakdown and failure location.

<!-- question:end:application-insights-and-opentelemetry-aligned-observability-intermediate-q02 -->

#### How should you propagate correlation across queues and background workers?

<!-- question:start:application-insights-and-opentelemetry-aligned-observability-intermediate-q03 -->
<!-- question-id:application-insights-and-opentelemetry-aligned-observability-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

When sending a message, include trace context or a correlation ID in message properties. The worker should read that context, start processing telemetry as part of the same logical operation when possible, and include the message ID and correlation ID in logs.

This connects the original request, message send, queue processing, dependencies, and failures in one investigation path.

##### Key Points to Mention

- Async boundaries break correlation unless context is propagated.
- Put correlation data in message headers or properties.
- Log message ID and operation ID.
- Start worker spans with the correct parent or link.
- Use consistent naming across producers and consumers.

<!-- question:end:application-insights-and-opentelemetry-aligned-observability-intermediate-q03 -->

#### What are common Application Insights cost controls?

<!-- question:start:application-insights-and-opentelemetry-aligned-observability-intermediate-q04 -->
<!-- question-id:application-insights-and-opentelemetry-aligned-observability-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Common controls include sampling high-volume successful telemetry, reducing noisy logs, avoiding high-cardinality attributes, setting appropriate retention, using table plans intentionally, and filtering or transforming data before ingestion when appropriate.

The design should preserve failures, slow requests, critical business telemetry, and enough successful traffic for comparison.

##### Key Points to Mention

- Sampling reduces volume.
- Avoid high-cardinality dimensions and tags.
- Reduce noisy debug logs.
- Retention affects cost.
- Do not remove incident-critical telemetry.

<!-- question:end:application-insights-and-opentelemetry-aligned-observability-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you migrate an existing app from classic Application Insights SDKs to OpenTelemetry?

<!-- question:start:application-insights-and-opentelemetry-aligned-observability-advanced-q01 -->
<!-- question-id:application-insights-and-opentelemetry-aligned-observability-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Inventory current telemetry, dashboards, alerts, custom events, custom metrics, sampling, telemetry initializers, and correlation behavior. Add OpenTelemetry instrumentation in a controlled environment, set service identity, preserve critical custom telemetry, and compare request counts, failures, dependency tracking, and trace correlation against the old setup.

Avoid double-instrumenting the same libraries in production. Validate KQL queries, dashboards, and alert rules before switching. Plan rollback and monitor ingestion volume after migration.

##### Key Points to Mention

- Inventory existing telemetry and dependencies.
- Preserve dashboards and alerts.
- Avoid duplicate telemetry from mixed instrumentation.
- Validate correlation and sampling behavior.
- Compare volume, cost, and diagnostic quality.

<!-- question:end:application-insights-and-opentelemetry-aligned-observability-advanced-q01 -->

#### How would you design observability for a microservices system in Azure?

<!-- question:start:application-insights-and-opentelemetry-aligned-observability-advanced-q02 -->
<!-- question-id:application-insights-and-opentelemetry-aligned-observability-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use consistent OpenTelemetry instrumentation across services. Set service name, version, environment, and region for every component. Capture requests, dependencies, exceptions, custom business metrics, and queue processing spans. Propagate trace context through HTTP, messaging, and background workflows.

Use Application Insights for application maps, transaction diagnostics, failures, performance, availability, and live metrics. Use Log Analytics for KQL investigation and Azure Monitor alerts for user-impact conditions.

##### Key Points to Mention

- Consistent service identity is essential.
- Trace context must cross service and async boundaries.
- Business metrics complement automatic telemetry.
- Application Map and transaction diagnostics help localize failures.
- Alerts should focus on symptoms and SLOs.

<!-- question:end:application-insights-and-opentelemetry-aligned-observability-advanced-q02 -->

#### How do you decide what custom telemetry to add?

<!-- question:start:application-insights-and-opentelemetry-aligned-observability-advanced-q03 -->
<!-- question-id:application-insights-and-opentelemetry-aligned-observability-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Start with operational questions the team must answer during incidents and reviews. Add custom metrics for business health and alertable trends. Add custom spans around important operations that automatic instrumentation cannot see. Add structured logs for decisions, state transitions, and exceptional conditions.

Do not add telemetry merely because a value is available. Every custom field should have a diagnostic, alerting, audit, or business-analysis purpose.

##### Key Points to Mention

- Start from incident and SLO questions.
- Metrics for trends and alerting.
- Spans for important timed work.
- Logs for decisions and detail.
- Avoid noisy or sensitive telemetry.

<!-- question:end:application-insights-and-opentelemetry-aligned-observability-advanced-q03 -->

#### How would you validate that Application Insights is production-ready?

<!-- question:start:application-insights-and-opentelemetry-aligned-observability-advanced-q04 -->
<!-- question-id:application-insights-and-opentelemetry-aligned-observability-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Run the application through real workflows and verify that requests, dependencies, exceptions, logs, custom metrics, traces, service identity, and correlation appear correctly. Confirm dashboards, alerts, availability tests, sampling, retention, access controls, and privacy rules. Test a failure path and a slow dependency path to ensure the team can diagnose them.

Production readiness means the telemetry answers operational questions, not merely that data is arriving.

##### Key Points to Mention

- Validate happy path and failure path telemetry.
- Confirm correlation across dependencies and queues.
- Test alerts and action groups.
- Check sampling, retention, and cost.
- Verify sensitive data is not collected.

<!-- question:end:application-insights-and-opentelemetry-aligned-observability-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
