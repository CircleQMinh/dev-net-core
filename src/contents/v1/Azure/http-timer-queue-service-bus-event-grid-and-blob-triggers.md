---
id: http-timer-queue-service-bus-event-grid-and-blob-triggers
topic: Azure Functions and Durable Functions
subtopic: HTTP, timer, queue, Service Bus, Event Grid, and Blob triggers
category: Azure
---

## Overview

An Azure Functions trigger defines the event that starts a function. Every function has exactly one trigger, although it can also use input and output bindings or Azure SDK clients to read and write other resources.

The trigger determines important runtime behavior:

- How work arrives.
- Whether a caller waits for a response.
- How failed work is retried.
- Whether delivery can be duplicated.
- How concurrency and scale are calculated.
- Which authentication and network paths are required.
- How poison work is isolated.
- Which ordering guarantees are available.

Common trigger choices include:

- **HTTP:** Synchronous APIs and webhooks.
- **Timer:** Scheduled work.
- **Azure Queue Storage:** Simple asynchronous work queues.
- **Azure Service Bus:** Enterprise messaging with queues, topics, sessions, dead-lettering, and richer broker semantics.
- **Azure Event Grid:** Push-based notification of discrete events.
- **Azure Blob Storage:** Processing newly created or updated blobs.

These triggers are not interchangeable. An HTTP trigger is a poor fit for a process that can take several minutes because the caller and HTTP infrastructure impose response limits. A timer trigger is not a durable work queue. Event Grid notifies subscribers that an event occurred but is not designed as a command queue. A Blob trigger is convenient for file processing, but the event-based implementation should normally be preferred for lower latency and is required by Flex Consumption.

For interviews, a strong candidate should explain:

- Trigger and binding differences.
- At-least-once delivery and idempotency.
- Retry and poison-message behavior.
- Concurrency and scale implications.
- Queue Storage versus Service Bus.
- Event Grid versus messaging.
- Polling-based versus event-based blob detection.
- Authentication through managed identity.
- Why function-app grouping affects deployment, configuration, scaling, and failure isolation.

## Core Concepts

### Trigger Versus Binding

A trigger starts a function and can provide trigger data. A function must have exactly one trigger.

An input binding reads additional data without requiring the function to create a client manually. An output binding writes data after successful execution. Bindings are optional.

```text
Trigger -> starts execution
Input binding -> provides additional data
Function code -> applies behavior
Output binding -> writes a result
```

Bindings reduce integration code, but Azure SDK clients are often better when code needs transactions, conditional operations, pagination, advanced retries, or precise control over calls.

### Choose by Delivery Semantics

| Trigger | Primary model | Typical use |
| --- | --- | --- |
| HTTP | Synchronous request-response | APIs and webhooks |
| Timer | Schedule | Cleanup, reporting, periodic synchronization |
| Queue Storage | Simple pull-based work queue | Background commands and buffering |
| Service Bus | Brokered enterprise messaging | Commands, topics, sessions, transactions |
| Event Grid | Push-based event notification | Reacting to Azure or domain events |
| Blob | File creation or update | Image, document, and data-file processing |

The choice should follow the required semantics rather than the team familiarity with a service.

### HTTP Triggers

HTTP triggers support APIs and webhook receivers. Their binding configuration defines:

- Allowed HTTP methods.
- Route template.
- Authorization level.
- Request and response types.

In .NET isolated Functions with ASP.NET Core integration:

```csharp
public sealed class GetOrderFunction
{
    [Function("GetOrder")]
    public IActionResult Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "orders/{id:guid}")] HttpRequest request,
        Guid id)
    {
        return new OkObjectResult(new { id, status = "Pending" });
    }
}
```

HTTP functions should validate input, authorize access, use appropriate status codes, and return consistent error contracts.

### Function Keys Are Not Complete Authorization

HTTP authorization levels include values such as anonymous, function, and admin. Function and host keys can restrict invocation, but a shared key does not provide user identity, object-level authorization, or fine-grained permissions.

Production APIs commonly use:

- Microsoft Entra ID.
- App Service authentication.
- API Management policies.
- OAuth access tokens.
- Application-level authorization.

The function must still enforce authorization for the requested resource and operation.

### Keep HTTP Work Bounded

Regardless of a function app's `functionTimeout`, an HTTP-triggered function has a platform response limit of approximately 230 seconds because of the Azure Load Balancer idle timeout.

For longer work:

1. Validate the request.
2. Persist or enqueue a command.
3. Return `202 Accepted` with an operation identifier.
4. Process asynchronously.
5. Expose status or send completion notification.

Durable Functions provides a built-in asynchronous HTTP pattern for orchestrated workflows.

### HTTP Idempotency

Clients, proxies, and gateways can retry requests. Design state-changing operations with:

- Client-provided idempotency keys.
- Unique business identifiers.
- Conditional writes.
- Duplicate-result storage.
- Safe retry status behavior.

Do not assume a request executes exactly once because it arrived over HTTP.

### Timer Triggers

Timer triggers execute on a schedule. Azure Functions commonly uses a six-field NCRONTAB expression:

```csharp
[Function("NightlyCleanup")]
public Task Run(
    [TimerTrigger("0 0 2 * * *")] TimerInfo timer,
    CancellationToken cancellationToken)
{
    return cleanupService.RunAsync(cancellationToken);
}
```

The fields represent:

```text
second minute hour day month day-of-week
```

Store environment-specific schedules in application settings rather than recompiling code.

### Time Zones and Daylight Saving

Schedules are evaluated in UTC by default. A configurable time-zone setting is available in supported hosting and operating-system combinations, but UTC is usually easier to reason about.

If a business schedule depends on local time:

- Confirm hosting-plan support.
- Test daylight-saving transitions.
- Decide how skipped or repeated local times should behave.
- Record the effective time zone in telemetry.

### Timer Coordination

When a function app scales to multiple instances, only one instance runs a given timer-triggered function. The timer trigger uses host storage locks for coordination. It also does not start another scheduled invocation while the previous invocation remains outstanding.

Function apps sharing the same host storage need distinct host identities. Incorrect host-ID collisions can prevent one app's timer from running.

### Timer Failure Behavior

Unlike a queue trigger, a timer trigger does not automatically retry a failed invocation. The next invocation occurs at the next scheduled time.

For important scheduled work:

- Make the operation idempotent.
- Persist execution checkpoints.
- Alert on failure.
- Consider having the timer enqueue durable work.
- Use Durable Functions when workflow state and retry policy are required.

Avoid `RunOnStartup` for normal production schedules because restarts and scale events can cause unexpected executions.

### Azure Queue Storage Triggers

Queue Storage triggers are useful for simple asynchronous commands and buffering:

```csharp
[Function("ProcessThumbnail")]
public Task Run(
    [QueueTrigger("thumbnail-requests",
        Connection = "StorageConnection")] ThumbnailRequest request,
    CancellationToken cancellationToken)
{
    return processor.ProcessAsync(request, cancellationToken);
}
```

Queue messages are delivered at least once. A message becomes temporarily invisible while being processed. If execution fails, it becomes visible again after the configured visibility timeout.

### Queue Retries and Poison Messages

The Queue Storage extension uses settings such as:

- `batchSize`.
- `newBatchThreshold`.
- `visibilityTimeout`.
- `maxDequeueCount`.
- `maxPollingInterval`.
- `messageEncoding`.

After the message reaches `maxDequeueCount`, the runtime moves it to a queue named `<original-queue>-poison`.

The poison queue needs:

- Monitoring and alerts.
- Diagnostic context.
- A correction and replay process.
- Access controls for sensitive message data.

Moving a message does not resolve the underlying defect.

### Queue Concurrency

The runtime retrieves messages in batches and processes them concurrently. Per-instance concurrency is influenced by `batchSize` and `newBatchThreshold`, and total concurrency increases when the app scales out.

Setting `batchSize` to one reduces concurrency on one instance, but multiple scaled-out instances can still process messages in parallel. Global serialization needs a different design, such as partitioning, broker sessions, or an external lock.

### Queue Storage Limitations

Queue Storage is intentionally simple. It does not provide the full set of Service Bus capabilities such as:

- Topics and subscriptions.
- Sessions for ordered processing.
- Broker transactions.
- Scheduled delivery with the same messaging model.
- Duplicate detection.
- Rich dead-letter metadata and forwarding.

Use Queue Storage when those features are unnecessary and simplicity and cost are priorities.

### Azure Service Bus Triggers

Service Bus triggers process messages from:

- Queues.
- Topic subscriptions.

Service Bus is useful when the solution needs richer broker semantics:

- Competing consumers.
- Publish-subscribe.
- Dead-letter queues.
- Scheduled delivery.
- Message deferral.
- Sessions.
- Duplicate detection.
- Transactions.

```csharp
[Function("ProcessPayment")]
public Task Run(
    [ServiceBusTrigger(
        "payment-commands",
        Connection = "ServiceBusConnection")]
    ServiceBusReceivedMessage message,
    CancellationToken cancellationToken)
{
    return handler.HandleAsync(message, cancellationToken);
}
```

Current isolated-worker extensions can bind to types from `Azure.Messaging.ServiceBus`.

### Peek-Lock and Settlement

The common processing mode is Peek-Lock:

1. The consumer receives and locks a message.
2. Successful execution completes the message.
3. Failure or lock expiration makes it available again.
4. Repeated failure can move it to the dead-letter queue.

Automatic lock renewal has limits. Long processing should either complete within the lock-renewal design or be decomposed into durable steps.

Advanced handlers can use `ServiceBusMessageActions` to complete, abandon, defer, or dead-letter explicitly. When manual settlement is used, automatic completion must be configured consistently.

### Service Bus Sessions

Sessions group related messages and enable ordered, exclusive processing for one session at a time. A session ID can represent an order, workflow, tenant, or aggregate.

Sessions help when ordering is required within a group, but they affect scale:

- One session is processed by one receiver at a time.
- A hot session can become a bottleneck.
- Session concurrency and message concurrency require separate tuning.

Do not require global ordering unless the business requirement genuinely needs it.

### Service Bus Concurrency

Host settings include values such as:

- `maxConcurrentCalls`.
- `maxConcurrentSessions`.
- `prefetchCount`.
- `maxAutoLockRenewalDuration`.

Higher concurrency improves throughput only until CPU, memory, connections, or downstream services saturate. Prefetching can improve throughput but consumes message locks before processing and can increase lock expiration when configured too aggressively.

### Queue Storage Versus Service Bus

| Concern | Queue Storage | Service Bus |
| --- | --- | --- |
| Simple work queue | Strong fit | Supported |
| Topic subscriptions | No | Yes |
| Sessions and ordered groups | No | Yes |
| Duplicate detection | No | Yes |
| Broker transactions | No | Yes |
| Dead-letter features | Poison queue | Native dead-letter queue |
| Operational complexity | Lower | Higher |
| Typical choice | Simple buffering | Enterprise messaging |

Both normally provide at-least-once delivery. Consumers must be idempotent.

### Event Grid Triggers

Event Grid is a push-based event-routing service. It delivers discrete event notifications from Azure resources, custom topics, domains, or partner sources to subscriptions.

The trigger receives events through a webhook endpoint managed by the Functions integration. The function can bind to:

- `EventGridEvent`.
- `CloudEvent`.
- `BinaryData`.
- A custom deserializable type.
- Arrays for batched delivery where supported.

An event subscription is required. Filters can select event type, subject, and other event properties.

### Event Grid Is Notification, Not Command Queuing

Event Grid is a good fit for:

- Blob-created notifications.
- Resource lifecycle events.
- Domain event fan-out.
- Lightweight event-driven integration.

It is not the preferred tool when consumers need:

- Long retention and pull-based control.
- Sessions or strict ordered groups.
- Broker transactions.
- Command semantics.
- Complex message settlement.

Use Service Bus for durable brokered commands and workflows. Use Event Grid for event notification and fan-out.

### Event Grid Reliability

Event Grid retries failed delivery according to subscription policy and can dead-letter undeliverable events when configured. Delivery is at least once, and ordering is not generally guaranteed.

Consumers should:

- Deduplicate by event ID or business key.
- Tolerate out-of-order events.
- Validate event type and schema version.
- Make handlers idempotent.
- Monitor delivery failures and dead-letter destinations.

Returning success before durable processing is secured can lose work. For heavier processing, validate the event, enqueue durable work, and then return success.

### Blob Triggers

Blob triggers start a function when a blob is created or updated. Common scenarios include:

- Image resizing.
- Document extraction.
- Malware scanning.
- Import pipelines.
- Data transformation.
- Media processing.

The path can capture binding expressions:

```csharp
[Function("ProcessInvoice")]
public Task Run(
    [BlobTrigger(
        "incoming-invoices/{name}",
        Source = BlobTriggerSource.EventGrid,
        Connection = "StorageConnection")]
    Stream content,
    string name,
    CancellationToken cancellationToken)
{
    return processor.ProcessAsync(name, content, cancellationToken);
}
```

### Event-Based Versus Polling Blob Triggers

Two Blob trigger implementations exist:

- **Polling-based:** Scans storage and uses control queues and receipts.
- **Event-based:** Uses Event Grid notifications and has lower detection latency.

Microsoft recommends the event-based implementation. Flex Consumption supports only the event-based Blob trigger.

Use a direct Event Grid trigger instead when only event metadata is needed or when custom routing and filtering are central. Use the Blob trigger when binding directly to the blob content or SDK type is convenient.

### Large Blob Processing

Avoid loading a large blob into a `byte[]` because it can consume substantial memory and reduce per-instance concurrency. Prefer:

- A stream.
- `BlobClient`.
- Chunked processing.
- External batch systems for very large or compute-intensive workloads.

Estimate memory as total concurrent executions multiplied by per-execution working set, not just one blob's size.

### Blob Idempotency and Reprocessing

Blob updates and event retries can cause repeated processing. Use:

- Blob URI plus ETag or version ID.
- A processing-state record with a unique constraint.
- Deterministic output names.
- Conditional writes.
- Safe overwrite or compare-and-swap behavior.

Do not rely solely on trigger receipts as the business guarantee of exactly-once processing.

### Managed Identity Connections

Modern binding extensions support identity-based connections. A connection name can represent a group of application settings rather than a connection string.

Use managed identity and grant the narrowest data-plane role:

- Storage Queue Data Message Processor or appropriate storage data roles.
- Azure Service Bus Data Receiver.
- Storage Blob Data Reader or Contributor as required.

Management roles such as Owner do not automatically provide required data-plane access, and they are usually excessive.

### Function App Grouping

Functions in one function app share:

- Deployment package.
- Configuration and identity.
- Host runtime and language worker.
- Hosting plan.
- `host.json` settings.
- Scale behavior, with plan-specific exceptions.
- Failure and deployment lifecycle.

Separate functions when they need different security boundaries, deployment cadence, resource behavior, or scale limits. Avoid one large function app containing unrelated HTTP APIs, high-volume queues, and memory-heavy blob processors.

### Reliable Event Processing

For queue, Service Bus, Event Grid, and Blob triggers:

1. Assume duplicate delivery.
2. Validate the message or event.
3. Establish an idempotency key.
4. Perform business state changes transactionally where possible.
5. Publish follow-up events through a reliable pattern such as an outbox.
6. Throw or fail when processing must be retried.
7. Isolate poison work after bounded attempts.
8. Provide replay tooling and audit information.

Logging an exception and returning success can acknowledge work that was not completed.

### Observability

Monitor trigger-specific signals:

- HTTP request rate, latency, status, and authorization failures.
- Timer lateness, duration, and missed business outcomes.
- Queue depth, oldest-message age, dequeue count, and poison messages.
- Service Bus active, dead-lettered, deferred, and locked messages.
- Event Grid delivery failures and dead-letter events.
- Blob processing latency, size distribution, duplicates, and failure queues.
- Function executions, exceptions, retries, scale, and dependency calls.

Include event IDs, message IDs, correlation IDs, subject, queue or subscription, and business identifiers without logging secrets or sensitive payloads.

### Common Mistakes

- Using function keys as user-level authorization.
- Holding an HTTP request open for long processing.
- Assuming timer failures retry automatically.
- Assuming queue or event delivery is exactly once.
- Ignoring poison queues and dead-letter queues.
- Increasing concurrency without checking dependencies.
- Depending on global message ordering.
- Treating Event Grid as a command queue.
- Using polling Blob triggers for new low-latency designs.
- Loading large blobs fully into memory.
- Swallowing exceptions and accidentally acknowledging failed work.
- Sharing one function app across unrelated scale and security profiles.
- Storing connection strings when managed identity is supported.

### Practical Best Practices

- Select triggers by lifecycle and delivery requirements.
- Keep HTTP work bounded and asynchronous when necessary.
- Make all event handlers idempotent.
- Tune concurrency through end-to-end load testing.
- Monitor poison and dead-letter destinations.
- Prefer managed identity and least privilege.
- Use Service Bus only when its richer features provide value.
- Prefer event-based Blob triggers.
- Stream large payloads.
- Separate functions with different operational profiles.
- Test retries, duplicates, lock loss, and replay.
- Keep extension packages current and compatible with the worker model.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the difference between an Azure Functions trigger and a binding?

<!-- question:start:http-timer-queue-service-bus-event-grid-and-blob-triggers-beginner-q01 -->
<!-- question-id:http-timer-queue-service-bus-event-grid-and-blob-triggers-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A trigger defines the event that starts a function, and each function has exactly one trigger. An input binding provides additional data, while an output binding writes data. Bindings are optional, and code can use Azure SDK clients directly when it needs capabilities beyond declarative bindings.

##### Key Points to Mention

- A trigger is a special input binding.
- Exactly one trigger starts each function.
- Multiple input and output bindings are possible.
- SDK clients provide more explicit control.

<!-- question:end:http-timer-queue-service-bus-event-grid-and-blob-triggers-beginner-q01 -->

#### When should you use an HTTP trigger?

<!-- question:start:http-timer-queue-service-bus-event-grid-and-blob-triggers-beginner-q02 -->
<!-- question-id:http-timer-queue-service-bus-event-grid-and-blob-triggers-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Use an HTTP trigger for synchronous APIs and webhook endpoints where a caller sends a request and expects an HTTP response. Keep work within the response window, validate and authorize requests, and return appropriate status codes. For long-running work, enqueue or orchestrate the operation and return `202 Accepted`.

##### Key Points to Mention

- HTTP is request-response.
- Function keys are not full user authorization.
- The HTTP response limit is about 230 seconds.
- State-changing requests should support safe retries.

<!-- question:end:http-timer-queue-service-bus-event-grid-and-blob-triggers-beginner-q02 -->

#### How does a timer trigger behave when a function app scales out?

<!-- question:start:http-timer-queue-service-bus-event-grid-and-blob-triggers-beginner-q03 -->
<!-- question-id:http-timer-queue-service-bus-event-grid-and-blob-triggers-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Only one instance runs a particular timer-triggered function across the scaled-out app. The trigger coordinates through host storage locks and does not start the next occurrence while a previous invocation remains outstanding. A failed timer invocation is not automatically retried before the next scheduled occurrence.

##### Key Points to Mention

- Timer execution is coordinated across instances.
- Host storage is required for coordination.
- Failed timer work needs explicit recovery design.
- Timer operations should be idempotent.

<!-- question:end:http-timer-queue-service-bus-event-grid-and-blob-triggers-beginner-q03 -->

#### What is the difference between Queue Storage and Service Bus?

<!-- question:start:http-timer-queue-service-bus-event-grid-and-blob-triggers-beginner-q04 -->
<!-- question-id:http-timer-queue-service-bus-event-grid-and-blob-triggers-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Queue Storage is a simple, scalable work queue with at-least-once delivery and poison-queue behavior. Service Bus is a richer message broker with queues, topics, subscriptions, sessions, duplicate detection, dead-letter queues, scheduled delivery, and transactions. Choose Queue Storage for simple buffering and Service Bus when broker semantics are required.

##### Key Points to Mention

- Both require idempotent consumers.
- Service Bus supports publish-subscribe.
- Sessions can preserve order within a group.
- Richer features add cost and operational concepts.

<!-- question:end:http-timer-queue-service-bus-event-grid-and-blob-triggers-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How should a queue-triggered function handle duplicate messages?

<!-- question:start:http-timer-queue-service-bus-event-grid-and-blob-triggers-intermediate-q01 -->
<!-- question-id:http-timer-queue-service-bus-event-grid-and-blob-triggers-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Derive a stable idempotency key from the message or business command, then persist processing state with a unique constraint or use conditional business writes. If the same message arrives again, return the previous outcome or safely perform no additional change. Follow-up event publication should use a reliable pattern such as an outbox.

##### Key Points to Mention

- At-least-once delivery creates duplicates.
- In-memory deduplication is insufficient.
- Business operations should be repeatable or guarded.
- Idempotency records need retention and cleanup.

<!-- question:end:http-timer-queue-service-bus-event-grid-and-blob-triggers-intermediate-q01 -->

#### When would you choose Event Grid instead of Service Bus?

<!-- question:start:http-timer-queue-service-bus-event-grid-and-blob-triggers-intermediate-q02 -->
<!-- question-id:http-timer-queue-service-bus-event-grid-and-blob-triggers-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Choose Event Grid to push discrete event notifications to one or more subscribers, especially for Azure resource events and fan-out. Choose Service Bus for durable commands, pull-based consumers, sessions, transactions, and explicit message settlement. Event Grid tells consumers that something happened; Service Bus commonly coordinates work that must be processed.

##### Key Points to Mention

- Event Grid is push-based event routing.
- Service Bus is brokered messaging.
- Both can redeliver.
- Event Grid ordering is not generally guaranteed.
- Event Grid filters subscriptions efficiently.

<!-- question:end:http-timer-queue-service-bus-event-grid-and-blob-triggers-intermediate-q02 -->

#### How would you tune a high-volume Service Bus function?

<!-- question:start:http-timer-queue-service-bus-event-grid-and-blob-triggers-intermediate-q03 -->
<!-- question-id:http-timer-queue-service-bus-event-grid-and-blob-triggers-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Measure message processing cost and downstream capacity, then tune per-instance concurrency, session concurrency, prefetch, lock renewal, and maximum scale. Use batches only when processing semantics support them. Monitor backlog age, lock loss, retries, dead-letter count, throttling, CPU, memory, and dependency saturation.

##### Key Points to Mention

- More concurrency is not always more throughput.
- Prefetch consumes locks before processing.
- Long work must respect lock duration.
- Downstream systems determine safe scale.

<!-- question:end:http-timer-queue-service-bus-event-grid-and-blob-triggers-intermediate-q03 -->

#### Why is the event-based Blob trigger preferred?

<!-- question:start:http-timer-queue-service-bus-event-grid-and-blob-triggers-intermediate-q04 -->
<!-- question-id:http-timer-queue-service-bus-event-grid-and-blob-triggers-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

The event-based implementation uses Event Grid notifications and provides lower detection latency than polling. Microsoft recommends it for new designs, and Flex Consumption supports only the event-based Blob trigger. The function must still handle duplicate events, large payload memory, retries, and idempotent output.

##### Key Points to Mention

- Polling can introduce detection delay.
- Flex Consumption requires event-based Blob triggers.
- Stream large blobs or use SDK types.
- Blob updates can cause repeated processing.

<!-- question:end:http-timer-queue-service-bus-event-grid-and-blob-triggers-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design a reliable file-processing pipeline with Azure Functions?

<!-- question:start:http-timer-queue-service-bus-event-grid-and-blob-triggers-advanced-q01 -->
<!-- question-id:http-timer-queue-service-bus-event-grid-and-blob-triggers-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use an event-based Blob trigger or Event Grid subscription to detect the file, validate metadata, and record a unique processing key based on blob identity and version. Stream the content, bound concurrency by memory and downstream capacity, write outputs conditionally, and route failures to a durable retry or poison path. Emit correlation, blob version, duration, and outcome telemetry and provide controlled replay.

##### Key Points to Mention

- Avoid loading large files fully into memory.
- Assume duplicate and out-of-order notifications.
- Persist processing state.
- Quarantine invalid or malicious files.
- Separate detection from heavy processing when needed.

<!-- question:end:http-timer-queue-service-bus-event-grid-and-blob-triggers-advanced-q01 -->

#### How would you prevent a poison message from blocking event processing?

<!-- question:start:http-timer-queue-service-bus-event-grid-and-blob-triggers-advanced-q02 -->
<!-- question-id:http-timer-queue-service-bus-event-grid-and-blob-triggers-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use bounded retries for transient failures, classify permanent failures, and move exhausted work to the Queue Storage poison queue or Service Bus dead-letter queue. Include diagnostic metadata without exposing secrets, alert on arrival and age, and provide a controlled fix-and-replay tool. Avoid infinite retries because they consume capacity and hide backlog health.

##### Key Points to Mention

- Distinguish transient and permanent failures.
- Dead-lettering needs operational ownership.
- Replay must remain idempotent.
- Monitor poison count and oldest age.

<!-- question:end:http-timer-queue-service-bus-event-grid-and-blob-triggers-advanced-q02 -->

#### How would you group functions that use different triggers?

<!-- question:start:http-timer-queue-service-bus-event-grid-and-blob-triggers-advanced-q03 -->
<!-- question-id:http-timer-queue-service-bus-event-grid-and-blob-triggers-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Group functions that share deployment, configuration, identity, security boundary, runtime, ownership, and compatible scale behavior. Separate a public HTTP API from a memory-heavy blob processor or high-volume queue consumer when they need different resources, access, release cadence, or failure isolation. Avoid both one function app per tiny function and one app for an unrelated system.

##### Key Points to Mention

- Function app is a deployment and configuration boundary.
- Trigger load can affect shared resources.
- Flex has per-function scaling with documented scale groups.
- Security and ownership are valid separation reasons.

<!-- question:end:http-timer-queue-service-bus-event-grid-and-blob-triggers-advanced-q03 -->

#### How do you preserve consistency when a function updates a database and publishes a message?

<!-- question:start:http-timer-queue-service-bus-event-grid-and-blob-triggers-advanced-q04 -->
<!-- question-id:http-timer-queue-service-bus-event-grid-and-blob-triggers-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Use a transactional outbox when the database and broker cannot participate in one transaction. Store the business change and outbound event in the same database transaction, then have a separate publisher deliver the outbox record with retries. Consumers remain idempotent because publication can still be duplicated.

##### Key Points to Mention

- Direct dual writes can partially fail.
- Output bindings do not create cross-service atomicity.
- Outbox publication is at least once.
- Monitor undispatched records and delivery latency.

<!-- question:end:http-timer-queue-service-bus-event-grid-and-blob-triggers-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
