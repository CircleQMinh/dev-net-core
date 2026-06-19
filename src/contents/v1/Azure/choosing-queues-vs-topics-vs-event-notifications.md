---
id: choosing-queues-vs-topics-vs-event-notifications
topic: Messaging and event-driven Azure integration
subtopic: Choosing queues vs topics vs event notifications
category: Azure
---

## Overview

Choosing between queues, topics, and event notifications is an architecture decision about intent, ownership, delivery semantics, and failure handling.

Use a queue when one logical worker group must process each item. Use a topic when multiple independent subscriber groups need durable copies of the same message. Use an event notification service such as Azure Event Grid when a publisher announces that something happened and subscribers may react independently.

For interviews, the strongest answers do not start with product names. They start with questions:

- Is this a command, event, or telemetry stream?
- Does one consumer need to do required work, or can zero or many consumers react?
- Is the payload high-value business data or a lightweight notification?
- Is durable buffering required?
- Is fan-out required?
- Are retries, duplicate detection, transactions, sessions, or DLQs required?
- Does the consumer need push delivery or pull-based work processing?
- What happens when the consumer is down?

The right answer is often a combination: Event Grid for notification and Service Bus for durable processing.

## Core Concepts

### Message Intent Comes First

Before choosing an Azure service, classify the communication:

| Intent | Meaning | Typical Azure fit |
|---|---|---|
| Command | Do this work | Service Bus queue |
| Business message | Deliver high-value payload to a consumer | Service Bus queue or topic |
| Discrete event notification | Something happened | Event Grid |
| Fan-out to durable subscriber groups | Multiple services need their own copy | Service Bus topic |
| Telemetry stream | Many events over time for analytics | Event Hubs |
| Simple storage-backed queue | Basic decoupling with lower feature needs | Azure Queue Storage |

This page focuses on Service Bus queues, Service Bus topics, and Event Grid notifications.

### Queue

A queue is for work distribution. One message is processed by one consumer from a competing consumer group.

Choose a queue when:

- The producer wants work to be done.
- Only one logical worker should process each message.
- Workers need pull-based processing.
- Load leveling is important.
- The consumer might be offline.
- DLQ handling is required.
- Processing may need retries or lock renewal.

Example:

```text
API -> Service Bus queue -> Worker pool -> SQL / external system
```

### Topic and Subscription

A topic is for durable publish-subscribe messaging. A producer sends once, and Service Bus copies the message into matching subscriptions.

Choose a topic when:

- Several independent services need a copy.
- Each subscriber needs its own backlog.
- Each subscriber needs its own retry and DLQ behavior.
- Filtering by message properties is useful.
- Consumers process at different speeds.
- Subscriber deployment schedules are independent.

Example:

```text
Order service -> Service Bus topic
                 -> Billing subscription
                 -> Fulfillment subscription
                 -> Notifications subscription
```

### Event Notification

An event notification says that something happened. The publisher does not require a specific subscriber to complete a business transaction.

Choose Event Grid when:

- You need to react to Azure service events.
- You want serverless event routing.
- Subscribers can independently react.
- Push delivery to handlers is useful.
- Filtering by event type, subject, or fields is enough.
- The event is lightweight and points to authoritative state.

Example:

```text
Blob created -> Event Grid -> Azure Function
```

### Command Versus Event

A command is a request. An event is a fact.

```text
GenerateInvoice       command
InvoiceGenerated      event
ReserveInventory      command
InventoryReserved     event
SendWelcomeEmail      command
UserRegistered        event
```

If the sender expects a specific action to happen, think queue. If the sender announces a fact and does not know who cares, think event notification or topic depending on durability requirements.

### Queue Versus Topic

Use a queue for one logical consumer group. Use a topic for many logical consumer groups.

The common mistake is using one queue for multiple unrelated consumers. If three systems all need every order message, one queue is wrong because competing consumers divide messages. Use a topic with three subscriptions.

Another mistake is using a topic when there is only one logical worker. That adds management overhead without fan-out value.

### Topic Versus Event Grid

Both support fan-out, but they optimize for different things.

| Need | Service Bus topic | Event Grid |
|---|---|---|
| Durable work backlog per subscriber | Strong fit | Usually route to queue |
| Broker transactions | Supported in Service Bus scope | Not the purpose |
| Sessions and ordering by key | Supported | No ordering guarantee |
| Duplicate detection | Supported | Subscriber handles duplicates |
| Azure resource notifications | Possible but not primary | Strong fit |
| Push to serverless handlers | Possible through integrations | Strong fit |
| Lightweight event routing | Good when durable subscriber backlog matters | Strong fit |

Use Event Grid when the event is a notification. Use Service Bus topics when each subscriber needs durable queue-like processing.

### Event Grid Plus Service Bus

Combining services is common:

```text
Azure Storage -> Event Grid -> Service Bus queue -> Worker
```

This pattern works well when:

- The source naturally emits Event Grid events.
- The handler needs durable buffering.
- Processing can be slow or fail repeatedly.
- DLQ tooling is important.
- Workers should scale with backlog.

Event Grid detects and routes the event. Service Bus owns work processing.

### Pull Versus Push

Service Bus is typically pull-based. Consumers receive messages when they are ready. This fits worker pools, backpressure, private consumers, and durable processing.

Event Grid push delivery calls the subscriber when events happen. This fits reactive serverless workflows, webhooks, and notifications.

Event Grid namespace topics can also support pull delivery, but the interview-level distinction remains useful: queues are for controlled work consumption; event notifications are for reacting to state changes.

### Durable Backlog

Ask whether each consumer needs a durable backlog.

If yes:

- Use a Service Bus queue for one consumer group.
- Use a Service Bus topic subscription for each independent group.
- Or route Event Grid to Service Bus if the source event comes from Event Grid.

If no:

- Event Grid may be enough for lightweight notification.

Durable backlog matters when downtime, replay, and independent recovery are important.

### Delivery Guarantees

All these systems require duplicate-tolerant consumers, but their semantics differ.

Service Bus provides brokered message handling with peek-lock, settlement, DLQ, sessions, duplicate detection, and transactions within Service Bus.

Event Grid provides at least once event delivery, filtering, retry, and optional dead-lettering. It does not guarantee ordering and is not designed around command processing.

The application still owns idempotency.

### Ordering Requirements

If strict per-aggregate ordering is required, Service Bus sessions are often the best Azure messaging fit.

Event Grid does not guarantee ordering. A subscriber should treat events as notifications and re-read authoritative state when order matters.

If you need high-throughput ordered streams by partition for analytics, that points toward Event Hubs rather than queues, topics, or basic notifications.

### Payload Size and Claim Check

Message brokers are not file stores. For large payloads:

1. Store the data in Blob Storage.
2. Send a small message or event containing a pointer.
3. Include checksum, content type, length, and version metadata.
4. Authorize the consumer before reading the blob.

This is the claim-check pattern.

### Failure Handling

Queues and subscriptions are strong when failure handling needs to be explicit:

- Message lock.
- Delivery count.
- Abandon.
- Complete.
- Dead-letter.
- Replay.
- Backlog monitoring.

Event Grid is strong when the main goal is event routing. For important handlers, configure dead-lettering or route into Service Bus for more operational control.

### Cost and Operational Complexity

Do not overbuild messaging.

Questions to ask:

- Is there really more than one subscriber?
- Does the subscriber need its own backlog?
- Are sessions, transactions, or duplicate detection required?
- Will operations monitor DLQs?
- Can a simpler direct call or scheduled job work?
- Is this a notification or required work?

The simplest correct option is usually best. The wrong simple option becomes expensive later; the wrong complex option becomes expensive immediately.

### Decision Checklist

Use this checklist:

```text
One worker group must process each item?
  Use Service Bus queue.

Multiple independent worker groups need each message?
  Use Service Bus topic with one subscription per group.

Azure resource or application state-change notification?
  Use Event Grid.

Event notification triggers slow or high-value work?
  Event Grid -> Service Bus queue or topic.

Need per-key ordering?
  Use Service Bus sessions.

Need analytics over high-volume streams?
  Consider Event Hubs.

Need only simple storage-backed background work?
  Consider Azure Queue Storage if advanced broker features are unnecessary.
```

### Common Mistakes

- Choosing Event Grid for required command processing.
- Using one queue for multiple independent subscribers.
- Using topics when there is no fan-out.
- Assuming Event Grid ordering.
- Ignoring duplicate delivery.
- Sending large payloads through the broker.
- Creating one subscription shared by unrelated services.
- Forgetting each Service Bus subscription needs DLQ monitoring.
- Using filters as a substitute for authorization.
- Choosing by product familiarity instead of message intent.

### Best Practices

- Model intent before selecting the service.
- Use queues for commands and work items.
- Use topics when subscribers need independent durable copies.
- Use Event Grid for event notifications and Azure service events.
- Combine Event Grid and Service Bus when notification triggers durable work.
- Make all consumers idempotent.
- Keep payloads small and versioned.
- Use correlation IDs across asynchronous boundaries.
- Monitor backlog, age, retries, and dead-letter paths.
- Document the reason for the chosen messaging pattern.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### When should you use a queue?

<!-- question:start:choosing-queues-vs-topics-vs-event-notifications-beginner-q01 -->
<!-- question-id:choosing-queues-vs-topics-vs-event-notifications-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Use a queue when one logical consumer group should process each message. Queues are useful for background jobs, commands, load leveling, and worker pools. Multiple worker instances can compete for messages, but each message is processed by one worker.

Azure Service Bus queues are a good fit when reliable processing, retries, peek-lock, DLQ, sessions, or duplicate detection are needed.

##### Key Points to Mention

- One logical consumer group.
- Competing consumers split work.
- Good for commands and work items.
- Supports durable buffering.
- Service Bus adds enterprise broker features.

<!-- question:end:choosing-queues-vs-topics-vs-event-notifications-beginner-q01 -->

#### When should you use a topic?

<!-- question:start:choosing-queues-vs-topics-vs-event-notifications-beginner-q02 -->
<!-- question-id:choosing-queues-vs-topics-vs-event-notifications-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Use a topic when multiple independent consumer groups need their own copy of a message. Each subscription under the topic behaves like a durable queue for one subscriber group and can have its own filters, backlog, retry behavior, and DLQ.

Topics are useful for durable fan-out between business services.

##### Key Points to Mention

- Topic supports publish-subscribe.
- Each subscription receives a matching copy.
- One subscription per logical subscriber group.
- Subscriptions can filter messages.
- Each subscription must be monitored.

<!-- question:end:choosing-queues-vs-topics-vs-event-notifications-beginner-q02 -->

#### When should you use Event Grid?

<!-- question:start:choosing-queues-vs-topics-vs-event-notifications-beginner-q03 -->
<!-- question-id:choosing-queues-vs-topics-vs-event-notifications-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Use Event Grid when you need to route event notifications, especially Azure service events or lightweight application events. It is good for reacting to state changes, triggering serverless handlers, and fan-out to multiple destinations.

It is not the best default for required work commands. If processing needs durable queue semantics, route Event Grid to Service Bus.

##### Key Points to Mention

- Event Grid routes notifications.
- Good for Azure resource events.
- Supports fan-out and filtering.
- Delivery is at least once and unordered.
- Pair with Service Bus for durable work.

<!-- question:end:choosing-queues-vs-topics-vs-event-notifications-beginner-q03 -->

#### What is the main difference between a message and an event?

<!-- question:start:choosing-queues-vs-topics-vs-event-notifications-beginner-q04 -->
<!-- question-id:choosing-queues-vs-topics-vs-event-notifications-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A message usually carries data or a command that a consumer is expected to process. An event announces that something happened, and subscribers may react independently. A command has an intended action. An event is a fact.

This distinction helps choose Service Bus for required processing and Event Grid for notifications.

##### Key Points to Mention

- Command asks for action.
- Event announces a fact.
- Messages often imply a contract with a consumer.
- Events can have zero or many subscribers.
- Intent drives service choice.

<!-- question:end:choosing-queues-vs-topics-vs-event-notifications-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why is one queue wrong for multiple independent subscribers?

<!-- question:start:choosing-queues-vs-topics-vs-event-notifications-intermediate-q01 -->
<!-- question-id:choosing-queues-vs-topics-vs-event-notifications-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Consumers on one queue compete for messages. If billing, fulfillment, and notifications all read the same queue, each message goes to one of them, not all of them. That means some services will miss messages they need.

Use a Service Bus topic with separate subscriptions so each independent subscriber gets its own copy and backlog.

##### Key Points to Mention

- Queues distribute work across competing consumers.
- Competing consumers do not all receive every message.
- Independent subscribers need separate subscriptions.
- Topics provide durable fan-out.
- Each subscription has its own DLQ and retry behavior.

<!-- question:end:choosing-queues-vs-topics-vs-event-notifications-intermediate-q01 -->

#### When should Event Grid route into Service Bus?

<!-- question:start:choosing-queues-vs-topics-vs-event-notifications-intermediate-q02 -->
<!-- question-id:choosing-queues-vs-topics-vs-event-notifications-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Route Event Grid into Service Bus when the source is naturally an event notification but the handler requires durable work processing. Examples include blob-created processing, image conversion, document scanning, or long-running integration work.

Event Grid handles event detection and routing. Service Bus handles work buffering, competing consumers, retries, DLQ, and operational replay.

##### Key Points to Mention

- Event Grid is good for notification.
- Service Bus is good for durable work.
- Long-running handlers should not block Event Grid delivery.
- Service Bus gives DLQ and worker scaling.
- The combination is common and practical.

<!-- question:end:choosing-queues-vs-topics-vs-event-notifications-intermediate-q02 -->

#### How does ordering affect the service choice?

<!-- question:start:choosing-queues-vs-topics-vs-event-notifications-intermediate-q03 -->
<!-- question-id:choosing-queues-vs-topics-vs-event-notifications-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

If per-key ordered processing is required, Service Bus sessions are often the right tool. Messages with the same session ID can be processed by one locked session consumer in order. This is useful for aggregate or workflow ordering.

Event Grid does not guarantee order, so subscribers should not depend on event sequence. For high-throughput ordered analytics streams, Event Hubs may be a better option.

##### Key Points to Mention

- Event Grid does not guarantee ordering.
- Service Bus sessions support grouped ordering.
- Ordering reduces parallelism.
- Re-read authoritative state when event order is uncertain.
- Event Hubs fits streaming and partitioned analytics.

<!-- question:end:choosing-queues-vs-topics-vs-event-notifications-intermediate-q03 -->

#### What questions would you ask before choosing an Azure messaging service?

<!-- question:start:choosing-queues-vs-topics-vs-event-notifications-intermediate-q04 -->
<!-- question-id:choosing-queues-vs-topics-vs-event-notifications-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Ask whether the communication is a command, event, or telemetry stream; whether one consumer or multiple subscribers need the data; whether durable backlog is required; whether ordering, sessions, transactions, duplicate detection, or DLQ is required; how large the payload is; what happens when consumers are down; and how operations will monitor and replay failures.

The answers usually narrow the choice to queue, topic, Event Grid, Event Hubs, or a combination.

##### Key Points to Mention

- Start with intent and semantics.
- Identify consumer count and independence.
- Decide durability and replay needs.
- Check ordering and duplicate requirements.
- Include operational monitoring and failure handling.

<!-- question:end:choosing-queues-vs-topics-vs-event-notifications-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### Design messaging for a file-upload system that must scan files and notify several services.

<!-- question:start:choosing-queues-vs-topics-vs-event-notifications-advanced-q01 -->
<!-- question-id:choosing-queues-vs-topics-vs-event-notifications-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use Blob Storage for the binary content. Blob-created events can publish through Event Grid. If scanning is required and can be slow or retryable, route the event to a Service Bus queue for scanner workers. After scanning commits an approved state, publish a domain event to a Service Bus topic or Event Grid topic depending on whether subscribers need durable backlogs.

Services such as search indexing, notifications, and audit can subscribe independently. Use idempotency keys, correlation IDs, DLQ monitoring, and a claim-check pointer rather than sending the file through the broker.

##### Key Points to Mention

- Blob Storage owns file content.
- Event Grid detects storage events.
- Service Bus queue buffers scanning work.
- Topic or Event Grid fans out approved domain events.
- Use claim-check, idempotency, and DLQ monitoring.

<!-- question:end:choosing-queues-vs-topics-vs-event-notifications-advanced-q01 -->

#### How would you choose between Service Bus topic and Event Grid for business events?

<!-- question:start:choosing-queues-vs-topics-vs-event-notifications-advanced-q02 -->
<!-- question-id:choosing-queues-vs-topics-vs-event-notifications-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use Service Bus topics when subscribers need durable queue-like processing, independent backlogs, DLQs, sessions, transactions, or duplicate detection. Use Event Grid when the event is primarily a lightweight notification, when Azure service integration and push delivery are important, and when subscribers can tolerate unordered at least once delivery.

If both are true, combine them. Event Grid can route notifications into Service Bus for durable processing, or a domain service can publish high-value business messages to a Service Bus topic.

##### Key Points to Mention

- Topic gives durable subscriber queues.
- Event Grid gives notification routing and push delivery.
- Service Bus has richer broker semantics.
- Event Grid is not ordered and not a command queue.
- Combining services is often correct.

<!-- question:end:choosing-queues-vs-topics-vs-event-notifications-advanced-q02 -->

#### How do cost and operational complexity influence the choice?

<!-- question:start:choosing-queues-vs-topics-vs-event-notifications-advanced-q03 -->
<!-- question-id:choosing-queues-vs-topics-vs-event-notifications-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Choose the simplest service that satisfies the reliability and operational requirements. A topic with many subscriptions adds monitoring, DLQ handling, schema governance, and replay responsibility. Event Grid adds subscription filters, delivery metrics, and dead-letter configuration. Queues add worker scaling and poison-message handling.

Avoid adding topics or eventing just because future subscribers might exist. But also avoid a queue when multiple services already need every message, because fixing that later may require contract and replay migration.

##### Key Points to Mention

- Simplicity matters, but semantics matter more.
- Every subscription creates an operational surface.
- DLQs require ownership and runbooks.
- Over-architecting slows teams.
- Under-modeling fan-out creates future migration pain.

<!-- question:end:choosing-queues-vs-topics-vs-event-notifications-advanced-q03 -->

#### How would you explain the choice in an architecture review?

<!-- question:start:choosing-queues-vs-topics-vs-event-notifications-advanced-q04 -->
<!-- question-id:choosing-queues-vs-topics-vs-event-notifications-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Explain the message intent, consumer ownership, delivery semantics, failure model, and operational plan. For example: "This is a command that one worker group must process, so we use a Service Bus queue with peek-lock, idempotency, DLQ alerts, and bounded worker concurrency." Or: "This is a state-change notification with several optional subscribers, so we use Event Grid with filters and dead-lettering."

Also document alternatives rejected, such as why a queue was not enough for fan-out or why Event Grid alone was not enough for durable processing.

##### Key Points to Mention

- State the intent: command, event, or stream.
- Identify consumer count and ownership.
- Name delivery and ordering assumptions.
- Describe retry, DLQ, and idempotency strategy.
- Document rejected alternatives.

<!-- question:end:choosing-queues-vs-topics-vs-event-notifications-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
