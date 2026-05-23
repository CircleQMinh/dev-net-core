---
id: structured-logging-and-correlation
topic: Dependency injection, configuration, middleware, and logging
subtopic: Structured Logging and Correlation
category: .NET
---


## Overview

Structured logging is the practice of writing log events as machine-readable data instead of only plain text. In .NET, this usually means writing logs through `ILogger<T>` with named message-template placeholders such as `{OrderId}`, `{UserId}`, or `{ElapsedMilliseconds}`. The log message still has a readable template, but the values are also captured as separate properties that can be searched, filtered, grouped, and analyzed by log systems.

Correlation is the practice of connecting log events that belong to the same logical operation. In a simple application, this could mean adding a `RequestId` or `CorrelationId` to every log created while handling one HTTP request. In a distributed system, it often means propagating trace context across services so that logs, traces, and sometimes metrics can be connected using identifiers such as `TraceId`, `SpanId`, request IDs, or business transaction IDs.

This topic matters because production debugging is rarely about one isolated log line. Real incidents usually require answering questions such as:

- Which request caused this exception?
- Which user, order, tenant, or file transfer was involved?
- Which downstream service failed?
- Did the same request produce warnings in another service?
- Can we search all logs for this transaction without manually guessing timestamps?

For interviews, structured logging and correlation are important because they show whether a developer can build observable, supportable applications. A strong candidate should understand not only how to call `LogInformation`, but also how to design useful log messages, choose appropriate log levels, avoid sensitive data leaks, propagate correlation IDs, use scopes, work with distributed tracing, and make logs useful during real production incidents.

## Core Concepts

### Logging, Observability, and Diagnostics

Logging is one part of observability. Observability usually includes logs, metrics, and traces:

- **Logs** are timestamped events that describe something that happened.
- **Metrics** are numeric measurements aggregated over time, such as request count, error rate, or CPU usage.
- **Traces** show the path of a request or operation across components, often split into spans.

Structured logging improves logs by making them queryable. Correlation improves logs by connecting related events. Together, they allow developers and support teams to move from isolated messages to a full picture of what happened.

Example plain-text log:

```text
Payment failed for order 12345 because gateway timeout
```

Example structured log template:

```csharp
_logger.LogWarning(
    "Payment failed for order {OrderId}. Reason: {Reason}",
    orderId,
    reason);
```

The rendered message is readable, but the logging provider can also store `OrderId` and `Reason` as separate searchable fields.

### `ILogger<T>` and Log Categories

The common .NET logging abstraction is `Microsoft.Extensions.Logging.ILogger<T>`. It is usually injected through dependency injection:

```csharp
public sealed class OrderService
{
    private readonly ILogger<OrderService> _logger;

    public OrderService(ILogger<OrderService> logger)
    {
        _logger = logger;
    }

    public async Task SubmitAsync(Guid orderId, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Submitting order {OrderId}", orderId);

        await Task.Delay(100, cancellationToken);

        _logger.LogInformation("Order {OrderId} submitted", orderId);
    }
}
```

`ILogger<T>` uses the type name as the log category. This helps filter logs by namespace or class, for example:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "MyCompany.Payments": "Debug"
    }
  }
}
```

In interviews, it is useful to mention that the logger abstraction separates application code from the concrete logging provider. The application can use `ILogger<T>`, while the host can configure Console, Debug, Application Insights, OpenTelemetry, Serilog, NLog, or another provider.

### Log Levels

Log levels describe event severity and importance. Common .NET log levels are:

| Level | Typical use |
|---|---|
| `Trace` | Very detailed diagnostics, usually disabled in production. |
| `Debug` | Developer-focused information useful during debugging. |
| `Information` | Normal application flow, such as a request completed or a job started. |
| `Warning` | Unexpected but recoverable situation. |
| `Error` | A failure in an operation, usually with an exception or failed dependency. |
| `Critical` | Severe failure that may crash the app or make it unusable. |

Good logging is not about logging everything. It is about logging the right information at the right level.

Example:

```csharp
_logger.LogDebug("Querying product cache for {ProductId}", productId);

_logger.LogInformation("Created order {OrderId} for customer {CustomerId}", orderId, customerId);

_logger.LogWarning("Inventory is low for product {ProductId}. Remaining: {RemainingQuantity}", productId, quantity);

_logger.LogError(exception, "Failed to create order {OrderId}", orderId);
```

Common mistakes:

- Logging normal expected validation errors as `Error`.
- Logging every step of a high-volume code path at `Information`.
- Using `Critical` for ordinary business failures.
- Writing logs without enough context to diagnose the issue.

### Structured Logging and Message Templates

Structured logging in .NET usually uses message templates:

```csharp
_logger.LogInformation(
    "Processed file {FileName} with {RecordCount} records in {ElapsedMilliseconds} ms",
    fileName,
    recordCount,
    elapsedMilliseconds);
```

The placeholders are not the same as string interpolation. They become named properties.

Prefer this:

```csharp
_logger.LogInformation("User {UserId} logged in", userId);
```

Avoid this:

```csharp
_logger.LogInformation($"User {userId} logged in");
```

The interpolated version creates a final string before the logger receives it. The logging system cannot reliably capture `UserId` as a separate structured property.

Good placeholder names should be stable, descriptive, and consistent:

```csharp
_logger.LogInformation(
    "Payment authorized for order {OrderId} using provider {PaymentProvider}",
    orderId,
    paymentProvider);
```

Avoid inconsistent names:

```csharp
_logger.LogInformation("Payment authorized for {Id}", orderId);
_logger.LogInformation("Payment captured for {Order}", orderId);
_logger.LogInformation("Payment refunded for {OrderNumber}", orderId);
```

If these all refer to the same concept, use the same property name, such as `{OrderId}`.

### Structured Properties vs Rendered Messages

A log event has at least two audiences:

1. Humans reading the message.
2. Machines indexing fields.

For example:

```csharp
_logger.LogWarning(
    "Customer {CustomerId} exceeded payment retry limit. AttemptCount: {AttemptCount}",
    customerId,
    attemptCount);
```

The rendered message helps a human understand the event quickly. The structured fields let a log platform answer questions such as:

- Show all logs for `CustomerId = 42`.
- Count warnings by `AttemptCount`.
- Find all payment retry-limit failures in the last hour.

This is one of the main interview points: structured logging is not just a style choice; it directly affects production support and incident response.

### Correlation IDs

A correlation ID is an identifier used to connect related logs for one operation.

In an ASP.NET Core API, a correlation ID is commonly:

- Generated at the edge if the request does not provide one.
- Read from a header such as `X-Correlation-ID` if provided by a trusted caller.
- Added to response headers so clients can report it.
- Added to all logs created during the request.
- Passed to downstream HTTP calls, queues, or messages.

Simple middleware example:

```csharp
public sealed class CorrelationIdMiddleware
{
    private const string HeaderName = "X-Correlation-ID";
    private readonly RequestDelegate _next;
    private readonly ILogger<CorrelationIdMiddleware> _logger;

    public CorrelationIdMiddleware(
        RequestDelegate next,
        ILogger<CorrelationIdMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        string correlationId = context.Request.Headers.TryGetValue(HeaderName, out var values)
            ? values.FirstOrDefault() ?? Guid.NewGuid().ToString("N")
            : Guid.NewGuid().ToString("N");

        context.Response.Headers[HeaderName] = correlationId;

        using (_logger.BeginScope(new Dictionary<string, object>
        {
            ["CorrelationId"] = correlationId
        }))
        {
            await _next(context);
        }
    }
}
```

Registering the middleware:

```csharp
app.UseMiddleware<CorrelationIdMiddleware>();
```

This pattern makes every log inside the request scope include the same `CorrelationId`, as long as the provider supports scopes and is configured to include them.

### `BeginScope` and Contextual Logging

`ILogger.BeginScope` attaches contextual properties to all logs within a logical operation.

Example:

```csharp
using (_logger.BeginScope(new Dictionary<string, object>
{
    ["OrderId"] = orderId,
    ["CustomerId"] = customerId
}))
{
    _logger.LogInformation("Starting order checkout");
    await _paymentService.AuthorizeAsync(orderId, cancellationToken);
    _logger.LogInformation("Finished order checkout");
}
```

Instead of repeating `OrderId` and `CustomerId` in every message, the scope can enrich all log events produced inside it.

Scopes are useful for:

- Request IDs.
- Correlation IDs.
- Tenant IDs.
- User IDs.
- Job IDs.
- Message IDs.
- Business transaction IDs.

However, scopes should be used carefully. A scope that contains too much data can make every log event expensive or risky. A scope should contain small, stable identifiers rather than large objects or sensitive data.

### Request ID, Correlation ID, Trace ID, and Span ID

These terms are related but not identical.

| Term | Meaning |
|---|---|
| Request ID | Identifier for a single request in one service or host. |
| Correlation ID | Identifier used to connect related events across one business operation or transaction. |
| Trace ID | Distributed tracing identifier representing the full trace across services. |
| Span ID | Identifier for one unit of work inside a trace. |
| Parent ID | Identifier linking a span to its parent span. |

In simple systems, `CorrelationId` and `TraceId` may feel similar. In distributed tracing, the trace ID is part of a standardized trace context. A custom correlation ID can still be useful when the business wants a stable transaction ID that exists outside tracing tools.

Good practical approach:

- Use distributed tracing identifiers such as `TraceId` and `SpanId` for technical trace correlation.
- Use a business correlation ID such as `OrderId`, `TransferId`, `MessageId`, or `CorrelationId` when support teams and clients need a stable reference.
- Avoid inventing many unrelated IDs that duplicate each other without a clear purpose.

### Distributed Tracing and `Activity`

In .NET, distributed tracing uses `System.Diagnostics.Activity` to represent units of work. ASP.NET Core and many libraries can create activities automatically for inbound and outbound calls.

During a request, logs can be connected to the current activity through values such as:

- `TraceId`
- `SpanId`
- `ParentId`

Example:

```csharp
using System.Diagnostics;

_logger.LogInformation(
    "Current trace: {TraceId}, span: {SpanId}",
    Activity.Current?.TraceId,
    Activity.Current?.SpanId);
```

For most application code, you should not manually log the trace IDs in every message. Instead, configure the logging provider or observability pipeline to include activity tracking properties automatically.

### W3C Trace Context

W3C Trace Context is a standard way to propagate tracing information between services, commonly through HTTP headers such as `traceparent` and `tracestate`.

For example, when Service A calls Service B:

1. Service A receives or creates a trace context.
2. Service A logs messages with the current trace context.
3. Service A sends an HTTP request to Service B with trace headers.
4. Service B reads the headers and continues the same trace.
5. Logs in both services can be connected by the same trace ID.

This is more reliable than manually passing only a custom header in modern distributed systems because many frameworks and observability tools understand trace context.

### OpenTelemetry and Log Correlation

OpenTelemetry is a vendor-neutral observability standard and ecosystem. In .NET, OpenTelemetry can collect traces, metrics, and logs and export them to backends such as Azure Monitor, Grafana, Jaeger, Zipkin, Datadog, or other systems.

A common production design is:

```text
Application code -> ILogger<T> -> logging provider/exporter -> observability backend
Application code -> Activity/OpenTelemetry tracing -> exporter -> observability backend
```

When log correlation is enabled, logs can include trace fields such as `TraceId` and `SpanId`. This allows a developer to move from a log event to the full trace, or from a trace span to related logs.

The important interview point is that OpenTelemetry does not remove the need for good log design. It can carry and correlate telemetry, but developers still need to choose useful log levels, message templates, properties, and redaction rules.

### Logging in ASP.NET Core

ASP.NET Core has built-in logging integration. Common examples include:

- Request logs.
- Hosting lifetime logs.
- Middleware logs.
- Controller or endpoint logs.
- Entity Framework Core logs.
- Application service logs.

Typical usage in a controller or minimal API service:

```csharp
app.MapPost("/orders/{orderId:guid}/submit", async (
    Guid orderId,
    OrderService orderService,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    logger.LogInformation("Submitting order {OrderId}", orderId);

    await orderService.SubmitAsync(orderId, cancellationToken);

    return Results.Accepted($"/orders/{orderId}");
});
```

For production APIs, logs are most useful when they include:

- Request path or endpoint name.
- Status code.
- Duration.
- Correlation or trace ID.
- Authenticated user or tenant identifier when safe and appropriate.
- Business identifiers such as order ID, payment ID, or file transfer ID.

### HTTP Logging and Payload Logging

ASP.NET Core can log HTTP request and response information. This can be useful, but it must be used carefully.

HTTP logging may include:

- Request method.
- Path.
- Query string.
- Headers.
- Status code.
- Duration.
- Request or response body, if enabled.

Payload logging is risky because request and response bodies may contain:

- Passwords.
- Tokens.
- Personal information.
- Payment data.
- Health information.
- Confidential business data.

Best practices:

- Do not log request or response bodies by default.
- Prefer logging identifiers and outcomes instead of full payloads.
- Use allowlists for safe fields rather than relying only on blocklists.
- Redact or omit sensitive fields before logs leave the application.
- Be careful with headers such as `Authorization`, `Cookie`, and API keys.
- Test the performance impact of HTTP logging.

Example of safer application-level logging:

```csharp
_logger.LogInformation(
    "Create customer request received for tenant {TenantId}. ExternalReference: {ExternalReference}",
    tenantId,
    request.ExternalReference);
```

Avoid logging the entire request object:

```csharp
// Avoid this in production unless the object is explicitly safe and redacted.
_logger.LogInformation("Create customer request: {@Request}", request);
```

### Sensitive Data and Redaction

Logs often live longer and are accessible to more people than application databases. Therefore, logs must be treated as a data security boundary.

Do not log:

- Passwords.
- Access tokens or refresh tokens.
- API keys.
- Full credit card numbers.
- Sensitive personal data.
- Full request bodies unless explicitly approved and redacted.
- Large domain objects containing unknown fields.

Prefer:

```csharp
_logger.LogInformation(
    "Password reset requested for user {UserId}",
    userId);
```

Avoid:

```csharp
_logger.LogInformation(
    "Password reset requested for email {Email} with token {Token}",
    email,
    resetToken);
```

Even if the email is acceptable in some systems, the token should not be logged.

### Logging Exceptions Correctly

When logging exceptions, pass the exception object to the logging method:

```csharp
try
{
    await paymentGateway.AuthorizeAsync(command, cancellationToken);
}
catch (PaymentGatewayException ex)
{
    _logger.LogError(
        ex,
        "Payment authorization failed for order {OrderId} using provider {PaymentProvider}",
        command.OrderId,
        command.Provider);

    throw;
}
```

Avoid logging only the exception message:

```csharp
_logger.LogError("Payment failed: {Message}", ex.Message);
```

Passing the exception object preserves stack trace and exception details for the logging provider.

Avoid double logging the same exception at every layer. Usually, log at the boundary where the exception is handled or where important context exists. If a lower layer logs and rethrows, and an upper layer also logs the same exception, logs can become noisy and misleading.

### Correlation Across HTTP Calls

For service-to-service calls, correlation must leave the current process.

With distributed tracing, modern HTTP clients and ASP.NET Core can propagate trace context. For a custom correlation header, you may still need a delegating handler.

Example using a custom correlation context:

```csharp
public interface ICorrelationContext
{
    string? CorrelationId { get; }
}

public sealed class CorrelationHeaderHandler : DelegatingHandler
{
    private readonly ICorrelationContext _correlationContext;

    public CorrelationHeaderHandler(ICorrelationContext correlationContext)
    {
        _correlationContext = correlationContext;
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(_correlationContext.CorrelationId))
        {
            request.Headers.TryAddWithoutValidation(
                "X-Correlation-ID",
                _correlationContext.CorrelationId);
        }

        return base.SendAsync(request, cancellationToken);
    }
}
```

Registration:

```csharp
builder.Services.AddTransient<CorrelationHeaderHandler>();

builder.Services.AddHttpClient<PaymentClient>()
    .AddHttpMessageHandler<CorrelationHeaderHandler>();
```

In real systems, prefer standard trace context propagation where possible, and use custom correlation headers for business or legacy needs.

### Correlation Across Queues and Background Jobs

Correlation can break when work moves to a queue, background service, or scheduled job. HTTP trace context flows automatically in many cases, but queue messages require explicit propagation.

When publishing a message, include correlation metadata:

```csharp
public sealed record OrderSubmittedMessage(
    Guid OrderId,
    string CorrelationId,
    string? TraceParent);
```

Publishing example:

```csharp
var message = new OrderSubmittedMessage(
    OrderId: orderId,
    CorrelationId: correlationId,
    TraceParent: Activity.Current?.Id);

await messageBus.PublishAsync(message, cancellationToken);
```

Consuming example:

```csharp
using (_logger.BeginScope(new Dictionary<string, object>
{
    ["CorrelationId"] = message.CorrelationId,
    ["OrderId"] = message.OrderId
}))
{
    _logger.LogInformation("Processing submitted order message");
    await orderProcessor.ProcessAsync(message.OrderId, cancellationToken);
}
```

For advanced tracing, use a propagator or message header approach compatible with your messaging library and observability tooling.

### Business Correlation vs Technical Correlation

Technical correlation connects logs by infrastructure context, such as trace ID or request ID. Business correlation connects logs by domain identifiers, such as:

- `OrderId`
- `CustomerId`
- `TenantId`
- `PaymentId`
- `FileTransferId`
- `BatchId`
- `InvoiceId`

For production support, business identifiers are often more useful than raw trace IDs because users and support teams can understand them.

Example:

```csharp
_logger.LogInformation(
    "Generated invoice {InvoiceId} for tenant {TenantId} and customer {CustomerId}",
    invoiceId,
    tenantId,
    customerId);
```

A good logging strategy uses both:

- Trace/correlation IDs for technical request flow.
- Business IDs for domain-level troubleshooting.

### Event IDs

`EventId` can give important log messages a stable identifier independent of the text message.

Example:

```csharp
public static class LogEvents
{
    public static readonly EventId PaymentAuthorized = new(1001, nameof(PaymentAuthorized));
    public static readonly EventId PaymentFailed = new(1002, nameof(PaymentFailed));
}

_logger.LogInformation(
    LogEvents.PaymentAuthorized,
    "Payment authorized for order {OrderId}",
    orderId);
```

Event IDs are useful when:

- Log message text changes but dashboards should remain stable.
- Alerts are based on specific application events.
- Large systems need consistent event classification.

Not every log needs a custom event ID, but important business or operational events often benefit from one.

### High-Performance Logging

For normal application logs, `ILogger` extension methods are usually sufficient. For hot paths or high-volume logs, consider source-generated logging with `LoggerMessageAttribute`.

Example:

```csharp
public static partial class OrderLog
{
    [LoggerMessage(
        EventId = 1001,
        Level = LogLevel.Information,
        Message = "Order {OrderId} processed in {ElapsedMilliseconds} ms")]
    public static partial void OrderProcessed(
        ILogger logger,
        Guid orderId,
        double elapsedMilliseconds);
}
```

Usage:

```csharp
OrderLog.OrderProcessed(_logger, orderId, elapsedMilliseconds);
```

Source-generated logging can reduce allocations and avoid repeatedly parsing message templates at runtime. This matters most for performance-sensitive code paths.

For expensive log arguments, check whether the level is enabled:

```csharp
if (_logger.IsEnabled(LogLevel.Debug))
{
    var diagnosticDetails = BuildExpensiveDiagnosticDetails(order);
    _logger.LogDebug("Order diagnostic details: {Details}", diagnosticDetails);
}
```

### Logging Configuration

Logging should be configurable by environment. A common setup is:

- Development: more verbose logs.
- Production: `Information` or `Warning` by default, with selected categories enabled when needed.
- Incident response: temporarily increase logging for specific categories.

Example:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore.Database.Command": "Warning",
      "MyCompany.Payments": "Debug"
    }
  }
}
```

Avoid enabling very verbose logs globally in production for long periods. It can increase cost, reduce performance, and make important events harder to find.

### Logging Providers and Sinks

A logging provider controls where logs go and how they are formatted. Common destinations include:

- Console output.
- Files.
- Azure Application Insights or Azure Monitor.
- OpenTelemetry exporters.
- Elasticsearch or OpenSearch.
- Seq.
- Datadog.
- Splunk.
- SQL-based sinks.

Application code should usually depend on `ILogger<T>`, not on a specific provider API. Provider-specific features can be useful, but coupling all application code to one logging framework makes future changes harder.

### Good Log Message Design

A useful log message should answer:

- What happened?
- Where did it happen?
- Which operation was involved?
- Which identifiers allow us to search related events?
- Was it normal, unexpected, failed, or critical?

Good example:

```csharp
_logger.LogWarning(
    "Failed to send invoice email {InvoiceId} to customer {CustomerId}. RetryAttempt: {RetryAttempt}",
    invoiceId,
    customerId,
    retryAttempt);
```

Poor example:

```csharp
_logger.LogWarning("Email failed");
```

The poor example may be readable, but it is not actionable in production.

### Common Mistakes

Common mistakes include:

- Using string interpolation instead of message templates.
- Logging sensitive data.
- Logging entire request or domain objects without redaction.
- Missing correlation IDs in background jobs or queued messages.
- Logging exceptions without passing the exception object.
- Logging and rethrowing the same exception in every layer.
- Using inconsistent property names such as `{User}`, `{UserId}`, `{Customer}`, and `{CustomerId}` for the same concept.
- Logging too much at `Information` and creating noise.
- Not configuring scopes or trace IDs in the production logging provider.
- Depending only on logs and ignoring metrics/traces.

### Best Practices

Practical best practices:

- Use `ILogger<T>` through dependency injection.
- Use structured message templates with stable property names.
- Include business identifiers that help production support.
- Use scopes for request-wide or operation-wide context.
- Use distributed tracing and trace context for service-to-service correlation.
- Propagate correlation across HTTP, queues, and background jobs.
- Keep log levels meaningful and consistent.
- Avoid sensitive data and use redaction for approved sensitive fields.
- Pass exception objects to logging methods.
- Avoid logging huge objects or payloads by default.
- Use source-generated logging for hot paths.
- Configure log levels by environment and category.
- Test that logs contain the fields needed during real incident scenarios.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:structured-logging-and-correlation-beginner-q01 -->
#### Beginner Q01: What is structured logging?
<!-- question-id:structured-logging-and-correlation-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Structured logging is a way of writing logs as structured data instead of only plain text. In .NET, this usually means using `ILogger<T>` message templates with named placeholders:

```csharp
_logger.LogInformation("Created order {OrderId} for customer {CustomerId}", orderId, customerId);
```

The message is readable by humans, and the values are also captured as searchable properties such as `OrderId` and `CustomerId`. This makes logs easier to query, filter, aggregate, and use in dashboards or incident investigations.

##### Key Points to Mention

- Structured logs contain named fields/properties.
- Message templates are preferred over string interpolation.
- Structured fields make logs searchable and filterable.
- Useful for production debugging and monitoring.

<!-- question:end:structured-logging-and-correlation-beginner-q01 -->

<!-- question:start:structured-logging-and-correlation-beginner-q02 -->
#### Beginner Q02: Why should you avoid string interpolation in logging calls?
<!-- question-id:structured-logging-and-correlation-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

String interpolation creates the final message before the logger receives it. This means the logging provider receives only text and may not capture the values as structured fields.

Avoid:

```csharp
_logger.LogInformation($"Created order {orderId}");
```

Prefer:

```csharp
_logger.LogInformation("Created order {OrderId}", orderId);
```

The second version lets the logging provider store `OrderId` as a named property. It can also avoid unnecessary formatting work if the log level is disabled.

##### Key Points to Mention

- Interpolation loses structured property names.
- Message templates allow indexing and filtering by property.
- Template-based logging can be more efficient.
- Placeholder names should be meaningful and consistent.

<!-- question:end:structured-logging-and-correlation-beginner-q02 -->

<!-- question:start:structured-logging-and-correlation-beginner-q03 -->
#### Beginner Q03: What are common log levels in .NET and when should they be used?
<!-- question-id:structured-logging-and-correlation-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Common .NET log levels are `Trace`, `Debug`, `Information`, `Warning`, `Error`, and `Critical`.

`Trace` is for very detailed diagnostics. `Debug` is useful during development and troubleshooting. `Information` describes normal application flow. `Warning` indicates an unexpected but recoverable situation. `Error` means an operation failed. `Critical` means a severe failure that may make the application unusable.

Example:

```csharp
_logger.LogInformation("Order {OrderId} submitted", orderId);
_logger.LogWarning("Order {OrderId} has low inventory", orderId);
_logger.LogError(ex, "Failed to submit order {OrderId}", orderId);
```

##### Key Points to Mention

- Log level describes severity and importance.
- Normal business flow is usually `Information`.
- Recoverable unexpected conditions are often `Warning`.
- Failed operations should usually be `Error`.
- `Critical` should be reserved for severe system failures.

<!-- question:end:structured-logging-and-correlation-beginner-q03 -->

<!-- question:start:structured-logging-and-correlation-beginner-q04 -->
#### Beginner Q04: What is a correlation ID?
<!-- question-id:structured-logging-and-correlation-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A correlation ID is an identifier used to connect all logs that belong to the same logical operation. For example, an API can assign a correlation ID to an incoming request and include that ID in every log created while processing the request. If the request calls another service, the same ID can be sent to the downstream service.

This allows developers to search logs by one ID and see the full flow of an operation across components.

##### Key Points to Mention

- Connects related log events.
- Often stored in a request header such as `X-Correlation-ID`.
- Should be propagated to downstream services or messages.
- Helps production support and incident debugging.

<!-- question:end:structured-logging-and-correlation-beginner-q04 -->

<!-- question:start:structured-logging-and-correlation-beginner-q05 -->
#### Beginner Q05: How do you log an exception correctly with `ILogger`?
<!-- question-id:structured-logging-and-correlation-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Pass the exception object as the first argument after the log level method, then provide a structured message template:

```csharp
try
{
    await service.ProcessAsync(orderId, cancellationToken);
}
catch (Exception ex)
{
    _logger.LogError(ex, "Failed to process order {OrderId}", orderId);
    throw;
}
```

This allows the logging provider to capture exception details such as type, message, stack trace, and inner exception. Logging only `ex.Message` loses important diagnostic information.

##### Key Points to Mention

- Pass the exception object to the logging method.
- Include contextual identifiers such as `OrderId`.
- Do not log only `ex.Message`.
- Avoid logging the same exception repeatedly at every layer.

<!-- question:end:structured-logging-and-correlation-beginner-q05 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:structured-logging-and-correlation-intermediate-q01 -->
#### Intermediate Q01: What is `ILogger.BeginScope` and when would you use it?
<!-- question-id:structured-logging-and-correlation-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

`BeginScope` creates a logical logging scope. Properties added to the scope can be attached to all log events created inside that scope.

Example:

```csharp
using (_logger.BeginScope(new Dictionary<string, object>
{
    ["CorrelationId"] = correlationId,
    ["TenantId"] = tenantId
}))
{
    _logger.LogInformation("Processing request");
    await next();
}
```

This is useful for request-wide or operation-wide values such as correlation IDs, tenant IDs, user IDs, job IDs, or order IDs. It avoids repeating the same properties in every log message.

##### Key Points to Mention

- A scope attaches shared context to multiple logs.
- Commonly used for request or transaction context.
- Scope values are useful for correlation and filtering.
- Provider must support and be configured to include scopes.
- Avoid large objects or sensitive data in scopes.

<!-- question:end:structured-logging-and-correlation-intermediate-q01 -->

<!-- question:start:structured-logging-and-correlation-intermediate-q02 -->
#### Intermediate Q02: What is the difference between a correlation ID, request ID, trace ID, and span ID?
<!-- question-id:structured-logging-and-correlation-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A request ID usually identifies a single request in one application. A correlation ID connects related events across a logical operation and may be custom or business-defined. A trace ID identifies a distributed trace across services. A span ID identifies one operation or unit of work within that trace.

In distributed tracing, a request may have one trace ID and multiple span IDs as it flows through services and dependencies. A custom correlation ID can still be useful for business support, especially when clients or users need to report a reference ID.

##### Key Points to Mention

- Request ID is often local to one request or service.
- Correlation ID connects related logs or business operations.
- Trace ID represents the full distributed trace.
- Span ID represents one unit of work inside the trace.
- Business correlation IDs and technical trace IDs can coexist.

<!-- question:end:structured-logging-and-correlation-intermediate-q02 -->

<!-- question:start:structured-logging-and-correlation-intermediate-q03 -->
#### Intermediate Q03: How would you add a correlation ID to every log in an ASP.NET Core request?
<!-- question-id:structured-logging-and-correlation-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A common approach is to create middleware that reads a correlation ID from a request header or creates a new one. The middleware adds the ID to the response and creates a logging scope around the rest of the pipeline.

```csharp
public async Task InvokeAsync(HttpContext context)
{
    var correlationId = context.Request.Headers.TryGetValue("X-Correlation-ID", out var values)
        ? values.FirstOrDefault() ?? Guid.NewGuid().ToString("N")
        : Guid.NewGuid().ToString("N");

    context.Response.Headers["X-Correlation-ID"] = correlationId;

    using (_logger.BeginScope(new Dictionary<string, object>
    {
        ["CorrelationId"] = correlationId
    }))
    {
        await _next(context);
    }
}
```

This ensures logs created during the request include the same correlation ID, assuming the logging provider captures scopes.

##### Key Points to Mention

- Use middleware near the start of the pipeline.
- Read an existing trusted header or generate a new ID.
- Add the ID to response headers.
- Use `BeginScope` to attach it to logs.
- Propagate the ID to downstream services if needed.

<!-- question:end:structured-logging-and-correlation-intermediate-q03 -->

<!-- question:start:structured-logging-and-correlation-intermediate-q04 -->
#### Intermediate Q04: How do you propagate correlation across service-to-service HTTP calls?
<!-- question-id:structured-logging-and-correlation-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

For distributed tracing, prefer standard trace context propagation. Modern .NET and observability tools can propagate trace context using headers such as `traceparent`.

For custom business correlation, a common approach is to use a `DelegatingHandler` with `HttpClientFactory` to add a header such as `X-Correlation-ID` to outgoing requests.

```csharp
public sealed class CorrelationHeaderHandler : DelegatingHandler
{
    private readonly ICorrelationContext _context;

    public CorrelationHeaderHandler(ICorrelationContext context)
    {
        _context = context;
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(_context.CorrelationId))
        {
            request.Headers.TryAddWithoutValidation("X-Correlation-ID", _context.CorrelationId);
        }

        return base.SendAsync(request, cancellationToken);
    }
}
```

##### Key Points to Mention

- Prefer standard trace context for distributed tracing.
- Use custom headers for business or legacy correlation needs.
- Use `HttpClientFactory` and `DelegatingHandler` for consistency.
- Do not manually duplicate propagation logic in every service method.
- Ensure downstream services read and log the propagated ID.

<!-- question:end:structured-logging-and-correlation-intermediate-q04 -->

<!-- question:start:structured-logging-and-correlation-intermediate-q05 -->
#### Intermediate Q05: What should you avoid logging in production?
<!-- question-id:structured-logging-and-correlation-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Avoid logging sensitive data, secrets, and large raw payloads. Examples include passwords, access tokens, refresh tokens, API keys, authorization headers, cookies, payment details, personal data, and full request/response bodies unless explicitly approved and redacted.

Instead, log safe identifiers and outcomes:

```csharp
_logger.LogInformation(
    "Password reset requested for user {UserId}",
    userId);
```

Do not log the reset token:

```csharp
_logger.LogInformation("Password reset token: {Token}", resetToken);
```

##### Key Points to Mention

- Logs are a security and privacy boundary.
- Avoid passwords, tokens, keys, and sensitive personal data.
- Avoid full payload logging by default.
- Prefer allowlisted safe fields.
- Use redaction where sensitive fields must be logged.

<!-- question:end:structured-logging-and-correlation-intermediate-q05 -->

<!-- question:start:structured-logging-and-correlation-intermediate-q06 -->
#### Intermediate Q06: How should you choose structured property names?
<!-- question-id:structured-logging-and-correlation-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Structured property names should be stable, descriptive, and consistent across the codebase. If the application uses `OrderId`, then all logs referring to the same concept should use `{OrderId}`, not `{Order}`, `{Id}`, or `{OrderNumber}` inconsistently.

Good:

```csharp
_logger.LogInformation("Order {OrderId} submitted", orderId);
_logger.LogWarning("Order {OrderId} payment retry failed", orderId);
```

Poor:

```csharp
_logger.LogInformation("Order {Id} submitted", orderId);
_logger.LogWarning("Order {OrderNumber} payment retry failed", orderId);
```

Consistent names make queries, dashboards, alerts, and support workflows much easier.

##### Key Points to Mention

- Use stable domain names like `OrderId`, `TenantId`, `CustomerId`.
- Avoid generic names like `Id` when context matters.
- Keep names consistent across services.
- Good naming improves search, dashboards, and alerts.

<!-- question:end:structured-logging-and-correlation-intermediate-q06 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:structured-logging-and-correlation-advanced-q01 -->
#### Advanced Q01: How does structured logging relate to distributed tracing?
<!-- question-id:structured-logging-and-correlation-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Structured logging and distributed tracing solve related but different problems. Structured logs capture individual events with searchable properties. Distributed tracing captures the flow of an operation across services using traces and spans.

When logs include trace context such as `TraceId` and `SpanId`, developers can correlate logs with traces. This allows them to start from an error log and open the related trace, or start from a slow trace and inspect related logs.

A strong production setup usually uses both:

- Logs for detailed event information.
- Traces for request flow and dependency timing.
- Shared identifiers for correlation.

##### Key Points to Mention

- Logs are event records; traces show operation flow.
- Trace ID connects logs across services.
- Span ID connects a log to a specific operation inside a trace.
- OpenTelemetry can help correlate logs and traces.
- Good log design is still required even with tracing.

<!-- question:end:structured-logging-and-correlation-advanced-q01 -->

<!-- question:start:structured-logging-and-correlation-advanced-q02 -->
#### Advanced Q02: How do you handle correlation across asynchronous messaging or background jobs?
<!-- question-id:structured-logging-and-correlation-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Correlation can break when work leaves the original request and moves to a queue, event bus, or background worker. To preserve it, include correlation metadata in the message headers or payload, such as `CorrelationId`, `TraceParent`, `MessageId`, or a business identifier.

When the consumer processes the message, it should restore the logging scope and, for distributed tracing, continue or link the trace context using the tracing tools supported by the messaging framework.

Example:

```csharp
using (_logger.BeginScope(new Dictionary<string, object>
{
    ["CorrelationId"] = message.CorrelationId,
    ["OrderId"] = message.OrderId,
    ["MessageId"] = message.MessageId
}))
{
    _logger.LogInformation("Processing order submitted message");
    await handler.HandleAsync(message, cancellationToken);
}
```

##### Key Points to Mention

- Async boundaries often lose ambient request context.
- Put correlation metadata in message headers or payload.
- Restore logging scopes in consumers.
- Continue trace context where supported.
- Include business IDs for supportability.

<!-- question:end:structured-logging-and-correlation-advanced-q02 -->

<!-- question:start:structured-logging-and-correlation-advanced-q03 -->
#### Advanced Q03: When should you use source-generated logging?
<!-- question-id:structured-logging-and-correlation-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Source-generated logging is useful for high-performance or high-volume paths. It uses `LoggerMessageAttribute` on partial methods so the compiler generates optimized logging code.

Example:

```csharp
public static partial class PaymentLog
{
    [LoggerMessage(
        EventId = 2001,
        Level = LogLevel.Information,
        Message = "Payment {PaymentId} completed in {ElapsedMilliseconds} ms")]
    public static partial void PaymentCompleted(
        ILogger logger,
        Guid paymentId,
        double elapsedMilliseconds);
}
```

This can reduce allocations, avoid boxing, and avoid parsing message templates repeatedly at runtime. It is not required for every log, but it is useful for hot paths, libraries, and high-throughput services.

##### Key Points to Mention

- Uses `LoggerMessageAttribute` and partial methods.
- Reduces allocations and runtime template parsing.
- Useful for hot paths or high-volume services.
- Regular `ILogger` extension methods are fine for most application code.
- Keep readability and maintainability in mind.

<!-- question:end:structured-logging-and-correlation-advanced-q03 -->

<!-- question:start:structured-logging-and-correlation-advanced-q04 -->
#### Advanced Q04: How would you design a logging strategy for a microservices system?
<!-- question-id:structured-logging-and-correlation-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

A strong logging strategy for microservices should standardize log format, property names, correlation, log levels, sensitive data rules, and export destinations.

Important elements include:

- Use `ILogger<T>` or a consistent logging abstraction.
- Emit structured logs with consistent fields such as `ServiceName`, `Environment`, `TraceId`, `SpanId`, `CorrelationId`, `TenantId`, and relevant business IDs.
- Use distributed tracing with standard trace context propagation.
- Propagate correlation across HTTP calls, queues, and background jobs.
- Centralize logs in an observability platform.
- Define redaction rules and avoid sensitive payload logging.
- Configure log levels by environment and category.
- Create alerts for important error patterns, not just all errors.
- Use dashboards that connect logs, traces, and metrics.

##### Key Points to Mention

- Standardize fields and naming across services.
- Use trace context and correlation IDs.
- Centralize logs and make them searchable.
- Include business IDs for support teams.
- Control sensitive data and log volume.
- Combine logs with traces and metrics.

<!-- question:end:structured-logging-and-correlation-advanced-q04 -->

<!-- question:start:structured-logging-and-correlation-advanced-q05 -->
#### Advanced Q05: What are the risks of logging request and response bodies, and how can they be reduced?
<!-- question-id:structured-logging-and-correlation-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Logging request and response bodies can expose sensitive data and increase performance overhead, storage cost, and compliance risk. Bodies may contain passwords, tokens, personal data, payment details, or confidential business data.

Risk reduction strategies include:

- Do not log bodies by default.
- Use allowlists for safe endpoints and fields.
- Redact sensitive fields before logs leave the process.
- Exclude authentication, payment, identity, and sensitive form endpoints.
- Capture payloads only for selected error scenarios if approved.
- Limit body size.
- Review log access control and retention.

The safest default is to log identifiers, status, duration, and error context rather than full payloads.

##### Key Points to Mention

- Payload logs can leak secrets and PII.
- Body logging has performance and cost impact.
- Use allowlists and redaction.
- Avoid sensitive endpoints.
- Prefer safe identifiers and outcomes.

<!-- question:end:structured-logging-and-correlation-advanced-q05 -->

<!-- question:start:structured-logging-and-correlation-advanced-q06 -->
#### Advanced Q06: How do you avoid noisy or duplicate logs in layered applications?
<!-- question-id:structured-logging-and-correlation-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Avoid logging the same exception or failure at every layer. A good approach is to log where the application has enough context to make the log useful, usually at a boundary such as an API endpoint, message consumer, background job, or integration boundary.

Lower layers can either throw meaningful exceptions or return results. The boundary logs the failure once with business context and correlation identifiers.

Bad pattern:

```csharp
catch (Exception ex)
{
    _logger.LogError(ex, "Repository failed");
    throw;
}
```

If every layer does this, one failure can produce many error logs.

Better pattern:

```csharp
catch (Exception ex)
{
    _logger.LogError(
        ex,
        "Failed to submit order {OrderId} for tenant {TenantId}",
        orderId,
        tenantId);

    return Results.Problem("Failed to submit order.");
}
```

##### Key Points to Mention

- Log failures once at the right boundary.
- Include business context when logging.
- Avoid catch-log-rethrow everywhere.
- Use log levels consistently.
- Use correlation to connect lower-level warnings with boundary errors.

<!-- question:end:structured-logging-and-correlation-advanced-q06 -->

<!-- question:start:structured-logging-and-correlation-advanced-q07 -->
#### Advanced Q07: What is the relationship between `Activity.Current`, `TraceId`, and log correlation in .NET?
<!-- question-id:structured-logging-and-correlation-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

`Activity.Current` represents the current diagnostic activity in .NET. During an ASP.NET Core request, there is usually an active activity that contains trace context. The activity has identifiers such as `TraceId`, `SpanId`, and parent information.

Logging providers or observability exporters can enrich log records with the current activity context. This makes logs correlate with distributed traces without manually adding trace IDs to every log message.

Application code can inspect `Activity.Current`, but in most cases it should rely on logging and telemetry configuration to attach trace context automatically.

##### Key Points to Mention

- `Activity` is the .NET abstraction for trace spans/operations.
- `Activity.Current` flows with the current async context.
- `TraceId` identifies the distributed trace.
- `SpanId` identifies the current operation/span.
- Providers/exporters can add these values to logs automatically.

<!-- question:end:structured-logging-and-correlation-advanced-q07 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
