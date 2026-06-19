---
id: event-grid-for-event-publication-and-fan-out
topic: Messaging and event-driven Azure integration
subtopic: Event Grid for event publication and fan-out
category: Azure
---

## Overview

Azure Event Grid is a managed publish-subscribe service for routing events. It is designed for event notification: one system announces that something happened, and interested subscribers react independently.

Event Grid is commonly used to:

- React to Azure resource events.
- Trigger serverless workflows.
- Fan out application events to multiple handlers.
- Connect SaaS partner events to Azure workloads.
- Route storage, resource, security, or operational events.
- Build lightweight event-driven integrations.

For interviews, the important distinction is that Event Grid is not a general work queue. It delivers events that describe state changes. A publisher should not expect a specific subscriber to complete a business transaction. Subscribers must be idempotent because delivery is at least once and ordering is not guaranteed.

## Core Concepts

### Event Notification

An Event Grid event says that something happened:

```text
BlobCreated
OrderSubmitted
UserRegistered
InvoiceApproved
ResourceWriteSuccess
```

The event should be a fact, not an instruction. A good event lets consumers decide whether they care and what to do.

Events are different from commands:

| Concept | Meaning |
|---|---|
| Event | "Something happened" |
| Command | "Please do this work" |
| Publisher expectation | Usually no specific consumer response |
| Consumer behavior | React independently |

If the sender needs one worker to complete a required task, Service Bus is usually a better fit.

### Publisher

A publisher sends events to Event Grid. Publishers can be:

- Azure services.
- Custom applications.
- Partner SaaS systems.
- MQTT clients in namespace scenarios.

The publisher should set stable event metadata and avoid depending on a particular subscriber. Event publication should usually happen after the source system commits its own state.

### Event Source

The event source is where the event happened. Azure Storage can be the source for a blob-created event. A custom order service can be the source for an order-submitted event.

Good event-source design matters because subscribers often filter by source, subject, and event type.

### Topic

A topic is the Event Grid resource that receives events. Topic types include:

- System topics for Azure service events.
- Custom topics for application events.
- Partner topics for SaaS provider events.
- Namespace topics in newer Event Grid namespace scenarios.

Use one topic for a related family of events. Avoid dumping unrelated domains into one topic because filtering and ownership become messy.

### Event Subscription

An event subscription connects a topic to a destination. It defines:

- Which events are selected.
- Where selected events are delivered.
- Delivery mode and endpoint.
- Retry and dead-letter behavior.
- Optional filters.

One topic can have many event subscriptions. This is how Event Grid supports fan-out.

### Event Handler

An event handler is the destination that receives the event. Common handlers include:

- Azure Functions.
- Webhooks.
- Service Bus queues or topics.
- Storage queues.
- Event Hubs.
- Logic Apps through webhooks.

Use an event handler that matches the workload. A short lightweight reaction can go directly to an Azure Function. Work that needs buffering, competing consumers, or DLQ processing may route Event Grid to Service Bus.

### Fan-Out

Fan-out means one published event is delivered to multiple subscribers. For example, an `OrderSubmitted` event might trigger:

- Fraud checks.
- Customer notification.
- Analytics.
- CRM synchronization.
- Audit logging.

Each subscriber is independent. A failure in one subscription should not be treated as failure of the original event publication.

### Event Shape

Event Grid supports CloudEvents and Event Grid schema. CloudEvents is preferred for interoperability.

A CloudEvents-style event includes common metadata:

```json
{
  "specversion": "1.0",
  "type": "Contoso.Orders.OrderSubmitted",
  "source": "/services/orders",
  "id": "7a8f4df3a4b54d9f9a3fd3e3",
  "time": "2026-06-18T10:20:00Z",
  "subject": "/tenants/42/orders/100187",
  "datacontenttype": "application/json",
  "data": {
    "orderId": "100187",
    "tenantId": "42",
    "total": 149.95
  }
}
```

Keep event payloads small. If consumers need a large document, publish a pointer to durable storage.

### Subject Design

The `subject` should help subscribers filter. Use a consistent path-like structure:

```text
/tenants/{tenantId}/orders/{orderId}
/containers/{containerName}/blobs/{blobName}
/regions/{region}/shipments/{shipmentId}
```

Good subjects support broad and narrow filters. Poor subjects force every subscriber to receive and discard irrelevant events.

### Filtering

Event subscriptions can filter by:

- Event type.
- Subject prefix or suffix.
- Advanced fields and operators.

Use filtering to reduce noise and isolate subscribers. Do not rely on filters as the only authorization mechanism. The handler must still validate and authorize any follow-up action it performs.

### Push Delivery

With push delivery, Event Grid sends events to the configured destination. This is common for webhooks, Azure Functions, Service Bus, Event Hubs, and Storage Queue handlers.

The handler must acknowledge quickly. Long-running work should be handed off to a queue or durable workflow rather than holding the delivery request open.

### Pull Delivery

With pull delivery in namespace topics, the subscriber connects to Event Grid and reads events. This gives the subscriber more control over when it consumes events and can be useful when a public inbound endpoint is not desirable.

Choose pull when:

- The consumer cannot expose a suitable endpoint.
- Private connectivity is important.
- The consumer wants explicit control over consumption.
- Processing must be paused without losing the subscription.

### Delivery Guarantees

Event Grid delivery is at least once. It does not guarantee global ordering. A subscriber can receive duplicates or events out of order.

Subscriber code must:

- Use the event ID or business ID for idempotency.
- Tolerate missing prior events.
- Re-read authoritative state when necessary.
- Handle old events safely.
- Avoid assuming delivery order.

### Retry Behavior

For push delivery, Event Grid retries failed delivery attempts according to its retry policy. Retry behavior protects transient endpoint failures, but it does not make the handler's side effects exactly once.

Handlers should return success only after they have durably accepted the event or safely handed it to a queue. If a handler does work and then fails before responding, Event Grid can redeliver the same event.

### Dead-Lettering

Event Grid can send undelivered events to a dead-letter destination when delivery cannot succeed within retry limits or time-to-live.

Dead-lettering is not enabled by default. Configure it for important integrations where dropped events would be difficult to reconstruct.

A dead-letter process should inspect:

- Event subscription name.
- Event ID.
- Delivery attempts.
- Failure reason.
- Destination endpoint.
- Event age.

Then decide whether to replay, compensate, or ignore.

### Event Grid and Service Bus Together

Event Grid and Service Bus are often used together:

- Event Grid reacts to a system event.
- It routes the event to a Service Bus queue.
- Service Bus buffers work and manages retries.
- Workers process messages with DLQ handling and idempotency.

This combination is useful when the event is a notification but the handling requires durable work distribution.

### Security

Secure Event Grid at both sides:

- Publishers need permission to publish.
- Subscribers need permission to create subscriptions.
- Push delivery to Azure services can use managed identity where supported.
- Webhook endpoints must validate Event Grid handshakes and authenticate requests as appropriate.
- Handlers must authorize any business operation caused by the event.

Do not treat possession of an event as permission to perform privileged work.

### Observability

Track:

- Publish failures.
- Delivery failures.
- Retry count.
- Dead-letter count.
- Handler latency.
- Handler response codes.
- Event age.
- Subscriber-specific error rates.
- Correlation IDs across event and handler logs.

Asynchronous fan-out failures are easy to miss when each subscriber owns a separate path.

### Common Mistakes

- Using Event Grid as a required work queue.
- Assuming exactly once delivery.
- Assuming event ordering.
- Sending large payloads.
- Publishing before the source state is committed.
- Making webhooks perform long synchronous work.
- Omitting dead-lettering for important subscriptions.
- Putting secrets or sensitive data in event payloads.
- Creating topics with unclear ownership.
- Forgetting to make subscribers idempotent.

### Best Practices

- Publish facts, not commands.
- Use CloudEvents for interoperability when possible.
- Design stable event types and subjects.
- Keep payloads small and versioned.
- Filter subscriptions to reduce irrelevant delivery.
- Use queues for long-running or high-value processing.
- Configure dead-lettering for important delivery paths.
- Make handlers idempotent.
- Log event ID, type, source, subject, and correlation ID.
- Treat event publication as part of the source system's consistency design.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is Azure Event Grid?

<!-- question:start:event-grid-for-event-publication-and-fan-out-beginner-q01 -->
<!-- question-id:event-grid-for-event-publication-and-fan-out-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Azure Event Grid is a managed publish-subscribe service for routing events. It lets publishers announce that something happened and lets subscribers receive matching events through event subscriptions.

It is commonly used for Azure resource events, custom application events, serverless triggers, and fan-out to multiple handlers.

##### Key Points to Mention

- Event Grid routes event notifications.
- It supports topics and event subscriptions.
- One event can fan out to multiple handlers.
- Delivery is at least once.
- It is not a replacement for a transactional work queue.

<!-- question:end:event-grid-for-event-publication-and-fan-out-beginner-q01 -->

#### What is fan-out in Event Grid?

<!-- question:start:event-grid-for-event-publication-and-fan-out-beginner-q02 -->
<!-- question-id:event-grid-for-event-publication-and-fan-out-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Fan-out means a single event is delivered to multiple independent subscriptions. Each subscription can route the event to a different handler, such as an Azure Function, webhook, Service Bus queue, or Event Hubs.

This lets services react independently without the publisher knowing every consumer.

##### Key Points to Mention

- One published event can have many subscribers.
- Subscribers are configured through event subscriptions.
- Each subscriber can filter events.
- Subscriber failures are isolated by subscription.
- Fan-out supports loose coupling.

<!-- question:end:event-grid-for-event-publication-and-fan-out-beginner-q02 -->

#### What is the difference between an event and a command?

<!-- question:start:event-grid-for-event-publication-and-fan-out-beginner-q03 -->
<!-- question-id:event-grid-for-event-publication-and-fan-out-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

An event announces that something already happened. A command asks a consumer to perform a specific action. Event Grid is a good fit for events. Service Bus queues are often a better fit for commands that must be processed by one worker.

The distinction matters because event publishers should not depend on a specific subscriber completing a business task.

##### Key Points to Mention

- Event means "something happened."
- Command means "do this."
- Events can have zero, one, or many subscribers.
- Commands usually require processing by a target worker.
- Choosing incorrectly affects reliability and ownership.

<!-- question:end:event-grid-for-event-publication-and-fan-out-beginner-q03 -->

#### What kinds of destinations can Event Grid deliver to?

<!-- question:start:event-grid-for-event-publication-and-fan-out-beginner-q04 -->
<!-- question-id:event-grid-for-event-publication-and-fan-out-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Event Grid can deliver to supported Azure services and webhooks. Common destinations include Azure Functions, webhooks, Service Bus queues and topics, Event Hubs, Storage queues, and other Event Grid topics depending on the model used.

The destination should match the processing need. Lightweight reactions can go directly to a function, while durable work can be routed to Service Bus.

##### Key Points to Mention

- Azure Functions are common event handlers.
- Webhooks are supported over HTTPS.
- Service Bus can buffer durable work.
- Event Hubs can support streaming pipelines.
- Destination choice affects reliability and processing model.

<!-- question:end:event-grid-for-event-publication-and-fan-out-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How should you design Event Grid event payloads?

<!-- question:start:event-grid-for-event-publication-and-fan-out-intermediate-q01 -->
<!-- question-id:event-grid-for-event-publication-and-fan-out-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Event payloads should be small, stable, versioned notifications that contain enough information for a subscriber to identify what happened and retrieve authoritative state if needed. Include event ID, type, source, subject, time, schema version, correlation ID, and business identifiers.

Avoid large payloads and sensitive data. Use a claim-check pointer to Blob Storage or an API resource when consumers need larger content.

##### Key Points to Mention

- Events describe facts.
- Include stable IDs and event type.
- Use versioning for schema evolution.
- Keep payloads small.
- Re-read authoritative state for critical decisions.

<!-- question:end:event-grid-for-event-publication-and-fan-out-intermediate-q01 -->

#### How do Event Grid filters work and when should you use them?

<!-- question:start:event-grid-for-event-publication-and-fan-out-intermediate-q02 -->
<!-- question-id:event-grid-for-event-publication-and-fan-out-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Event subscriptions can filter by event type, subject prefix or suffix, and advanced fields. Filters reduce irrelevant deliveries and let subscribers receive only the events they care about.

Use filters for routing and noise reduction, not as the only security boundary. The handler must still validate the event and authorize any follow-up action.

##### Key Points to Mention

- Filter by event type.
- Filter by subject path patterns.
- Advanced filters can inspect event fields.
- Good subject design improves filtering.
- Filtering does not replace authorization.

<!-- question:end:event-grid-for-event-publication-and-fan-out-intermediate-q02 -->

#### What should an Event Grid handler do when processing may take a long time?

<!-- question:start:event-grid-for-event-publication-and-fan-out-intermediate-q03 -->
<!-- question-id:event-grid-for-event-publication-and-fan-out-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

The handler should durably accept the event quickly and hand long-running work to a queue, workflow, or background processor. For example, Event Grid can deliver to a Service Bus queue, or a webhook can write a work item and return success.

Holding the delivery request open while doing long work increases retries, duplicates, and timeout risk.

##### Key Points to Mention

- Acknowledge only after durable acceptance.
- Use Service Bus or another durable worker path for long work.
- Avoid long synchronous webhook processing.
- Make downstream processing idempotent.
- Monitor delivery failures and handler latency.

<!-- question:end:event-grid-for-event-publication-and-fan-out-intermediate-q03 -->

#### How does Event Grid handle failed delivery?

<!-- question:start:event-grid-for-event-publication-and-fan-out-intermediate-q04 -->
<!-- question-id:event-grid-for-event-publication-and-fan-out-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Event Grid retries failed push deliveries according to a retry policy. Some configuration-related errors can be dropped or dead-lettered depending on configuration. For important subscriptions, dead-lettering should be configured so undelivered events can be inspected and replayed or compensated.

Because delivery is at least once, handlers must tolerate duplicates.

##### Key Points to Mention

- Event Grid uses retry for transient failures.
- Delivery is at least once.
- Ordering is not guaranteed.
- Dead-lettering must be configured when needed.
- Handlers should be idempotent.

<!-- question:end:event-grid-for-event-publication-and-fan-out-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you publish domain events from a business service safely?

<!-- question:start:event-grid-for-event-publication-and-fan-out-advanced-q01 -->
<!-- question-id:event-grid-for-event-publication-and-fan-out-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Publish only after the business state is durably committed. In many systems, use an outbox table in the same database transaction as the business change. A dispatcher reads the outbox and publishes events to Event Grid with stable IDs, event types, subjects, schema versions, and correlation IDs.

This prevents publishing an event for a transaction that later rolls back and helps recover if the process fails after committing the business change but before publishing.

##### Key Points to Mention

- Source state must be committed before publication.
- Outbox pattern prevents lost or phantom events.
- Use stable event IDs for idempotency.
- Include correlation and schema metadata.
- Publication failures need retry and monitoring.

<!-- question:end:event-grid-for-event-publication-and-fan-out-advanced-q01 -->

#### How would you design Event Grid fan-out for a multi-tenant SaaS system?

<!-- question:start:event-grid-for-event-publication-and-fan-out-advanced-q02 -->
<!-- question-id:event-grid-for-event-publication-and-fan-out-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use clear topic ownership and event subjects that include tenant or domain segments. Apply event subscription filters so subscribers receive only relevant events. Include tenant ID in the payload for validation, but do not trust filters as authorization.

Handlers must enforce tenant authorization before reading or mutating data. For high-value work, route events to Service Bus queues per service or tenant isolation boundary. Monitor delivery and dead-lettering per subscription.

##### Key Points to Mention

- Design subject paths for tenant-aware filtering.
- Keep topic ownership explicit.
- Handlers still enforce authorization.
- Service Bus can buffer durable downstream work.
- Monitor fan-out paths independently.

<!-- question:end:event-grid-for-event-publication-and-fan-out-advanced-q02 -->

#### What are the trade-offs between push and pull delivery in Event Grid?

<!-- question:start:event-grid-for-event-publication-and-fan-out-advanced-q03 -->
<!-- question-id:event-grid-for-event-publication-and-fan-out-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Push delivery is simple for reactive integrations because Event Grid calls the destination when an event arrives. It works well for Azure Functions and webhooks, but the handler must be reachable and able to acknowledge promptly.

Pull delivery gives the consumer more control over when it receives and settles events. It can help when the consumer cannot expose a public endpoint, needs private connectivity, or wants to pause consumption. The trade-off is that the consumer owns more polling and processing logic.

##### Key Points to Mention

- Push is reactive and simple.
- Push requires a reachable handler.
- Pull gives consumer-side control.
- Pull can help with private access requirements.
- Both still need idempotent processing.

<!-- question:end:event-grid-for-event-publication-and-fan-out-advanced-q03 -->

#### How would you troubleshoot missing or duplicated Event Grid events?

<!-- question:start:event-grid-for-event-publication-and-fan-out-advanced-q04 -->
<!-- question-id:event-grid-for-event-publication-and-fan-out-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

First determine whether the event was published, matched by the subscription filter, delivered to the handler, retried, dead-lettered, or dropped. Check publisher logs, Event Grid metrics, event subscription filters, handler response codes, dead-letter destinations, and correlation IDs.

Duplicates are expected under at least once delivery. The handler should use event ID or business ID to deduplicate. Missing processing may be caused by filter mismatch, endpoint errors, absent dead-lettering, handler bugs, or publishing before source commit.

##### Key Points to Mention

- Separate publish, filter, delivery, and handler stages.
- Check subscription filters and dead-letter destination.
- Handler response codes affect retry behavior.
- Duplicates must be handled by idempotency.
- Correlation IDs are essential for tracing.

<!-- question:end:event-grid-for-event-publication-and-fan-out-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
