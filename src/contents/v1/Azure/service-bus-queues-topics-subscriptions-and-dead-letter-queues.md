---
id: service-bus-queues-topics-subscriptions-and-dead-letter-queues
topic: Messaging and event-driven Azure integration
subtopic: Service Bus queues, topics, subscriptions, and dead-letter queues
category: Azure
---

## Overview

Azure Service Bus is a fully managed enterprise message broker. It is used when applications need durable asynchronous communication, load leveling, competing consumers, publish-subscribe routing, delayed processing, dead-letter handling, transactions, sessions, duplicate detection, or reliable integration between independently deployed systems.

The core entities are:

- A queue receives messages from producers and delivers each message to one consumer.
- A topic receives messages from producers and fan-outs copies to subscriptions.
- A subscription behaves like a virtual queue under a topic.
- A dead-letter queue stores messages that could not be delivered or processed successfully.

For interviews, Service Bus questions usually test whether the candidate understands brokered messaging rather than just "send a message and read it." Strong answers cover temporal decoupling, at least once delivery, peek-lock settlement, duplicate handling, max delivery count, DLQ operations, topic filters, subscription isolation, sessions, message size limits, and idempotent consumers.

## Core Concepts

### Service Bus as a Broker

Service Bus accepts messages from producers and stores them durably until consumers receive them. This gives the system:

- Temporal decoupling between producer and consumer availability.
- Load leveling during traffic spikes.
- Competing-consumer scaling.
- Reliable retries when consumers fail.
- Loose coupling between applications.
- Broker-level routing through topics and subscriptions.

Use Service Bus for commands, work items, and high-value business messages where the sender expects some consumer to perform work.

### Queue

A queue is a point-to-point messaging entity. Producers send messages to the queue, and consumers compete for messages. Each message is processed by only one consumer instance.

Common queue scenarios:

- Process an order.
- Generate a report.
- Send an email.
- Run an image conversion.
- Sync a record with another system.
- Buffer a burst of API requests.

Queues are a good default when there is one logical type of work and a pool of workers can process items independently.

### Competing Consumers

Multiple consumers can read from the same queue. Service Bus locks each message for one consumer while it is being processed. This lets a team scale workers horizontally without designing custom coordination.

Benefits:

- More workers increase throughput.
- Failed workers do not permanently own messages.
- Consumers process at their own rate.
- The queue buffers spikes.

Risks:

- Processing order is not guaranteed across multiple consumers unless sessions are used.
- Consumers must be idempotent.
- Downstream services can still be overloaded if worker count is too high.

### Topic

A topic is a publish-subscribe entity. Producers send messages to the topic. Service Bus copies matching messages into one or more subscriptions.

Use a topic when multiple independent consumers need to react to the same business message. For example:

- Billing records the order.
- Fulfillment reserves inventory.
- Analytics updates projections.
- Notifications sends a confirmation.

The publisher sends one message and does not need to know every consuming system.

### Subscription

A subscription is a durable receiver under a topic. It behaves like a queue for one subscriber or one subscriber group.

Each subscription has:

- Its own message backlog.
- Its own lock and delivery count behavior.
- Its own dead-letter queue.
- Optional filters and actions.
- Its own scaling and monitoring surface.

One slow subscription does not directly block another subscription, although all of them still share the namespace and topic capacity.

### Subscription Filters

Subscription filters decide which messages are copied to a subscription. Filters can use message system properties and application properties.

Example message:

```csharp
var message = new ServiceBusMessage(BinaryData.FromObjectAsJson(order))
{
    MessageId = $"order-{order.Id}-created",
    Subject = "OrderCreated",
    ContentType = "application/json"
};

message.ApplicationProperties["region"] = order.Region;
message.ApplicationProperties["priority"] = order.Priority;
```

A subscription might receive only `OrderCreated` messages for a region. Keep filters simple. Service Bus is a broker, not a business-rules engine.

### Queue Versus Topic

Use a queue when one logical consumer should process each message. Use a topic when multiple independent consumers need their own copy.

| Need | Better fit |
|---|---|
| One worker group processes each item | Queue |
| Multiple systems react independently | Topic |
| Selective subscriber routing | Topic subscription filters |
| Workload buffering | Queue or subscription |
| One backlog per consumer group | Topic subscription |

A topic subscription can be processed by competing consumers, so topics do not prevent horizontal scaling.

### Receive Modes

Service Bus supports two receive modes:

- Receive and delete.
- Peek-lock.

Receive and delete removes the message as soon as Service Bus sends it to the consumer. It is fast but can lose messages if the consumer crashes before processing.

Peek-lock is the usual mode for reliable processing. Service Bus locks the message, the consumer processes it, then explicitly settles it.

### Peek-Lock Settlement

In peek-lock mode, the consumer decides what happens next:

- `Complete`: processing succeeded; remove the message.
- `Abandon`: release the lock and make the message available again.
- `DeadLetter`: move the message to the DLQ because retrying will not help.
- `Defer`: hide the message until it is requested later by sequence number.

Example:

```csharp
await using var client = new ServiceBusClient(
    fullyQualifiedNamespace,
    new DefaultAzureCredential());

ServiceBusReceiver receiver = client.CreateReceiver("orders");
ServiceBusReceivedMessage message = await receiver.ReceiveMessageAsync();

try
{
    await ProcessOrderAsync(message, cancellationToken);
    await receiver.CompleteMessageAsync(message, cancellationToken);
}
catch (ValidationException ex)
{
    await receiver.DeadLetterMessageAsync(
        message,
        deadLetterReason: "InvalidPayload",
        deadLetterErrorDescription: ex.Message,
        cancellationToken: cancellationToken);
}
catch
{
    await receiver.AbandonMessageAsync(message, cancellationToken);
    throw;
}
```

### Lock Duration and Renewal

A lock is temporary. If processing takes longer than the lock duration and the lock is not renewed, the message becomes visible again and can be delivered to another consumer.

Good practice:

- Set the lock duration longer than normal processing time.
- Use automatic lock renewal for long-running handlers.
- Keep handlers bounded and observable.
- Break very long work into smaller messages.
- Make processing idempotent because lock loss can cause redelivery.

### At Least Once Delivery

Service Bus reliable processing is at least once. A message can be delivered more than once if:

- The consumer crashes after doing work but before completing the message.
- The lock expires.
- Settlement fails because of a transient network issue.
- The sender retries after an uncertain send outcome.

Consumers must be idempotent. The broker can help with duplicate detection at send time, but it cannot make every consumer side effect exactly once.

### Sessions and Ordering

Service Bus sessions group related messages by `SessionId`. A consumer locks a session and processes its messages as a group.

Use sessions when:

- Messages for the same aggregate must be processed in order.
- A workflow needs session state.
- Only one consumer should process a related stream at a time.

Avoid sessions when messages are independent and maximum parallelism matters. A hot session can become a bottleneck.

### Dead-Letter Queue

Every queue and subscription has a dead-letter subqueue. It is used for messages that cannot be delivered or cannot be processed.

Service Bus can dead-letter messages when:

- The message exceeds maximum delivery count.
- The message expires and dead-lettering on expiration is enabled.
- The message violates entity rules.
- Auto-forwarding fails.
- A session-enabled entity receives a message without a session ID.

Applications can also explicitly dead-letter messages that are invalid or permanently unprocessable.

### DLQ Is Not a Trash Can

The DLQ is an operational backlog. Messages remain there until they are inspected and completed from the DLQ.

A healthy DLQ process includes:

- Alerts on nonzero or rising DLQ counts.
- Reason codes and descriptions.
- Payload inspection with privacy controls.
- Categorization into retryable, data-fixable, and discardable cases.
- Safe resubmission tooling.
- Runbooks for common causes.

Ignoring DLQ messages hides production defects.

### Reading from the DLQ

Use a DLQ receiver rather than manually constructing entity paths in application code.

```csharp
var options = new ServiceBusReceiverOptions
{
    SubQueue = SubQueue.DeadLetter
};

ServiceBusReceiver receiver =
    client.CreateReceiver("orders", options);

ServiceBusReceivedMessage dlqMessage =
    await receiver.ReceiveMessageAsync(cancellationToken: cancellationToken);
```

For a topic subscription, create the receiver with topic name, subscription name, and the same subqueue option.

### Message Design

A Service Bus message has a binary body plus broker and application properties. Good messages usually include:

- Stable `MessageId`.
- `CorrelationId` or trace context.
- `Subject` that names the event or command type.
- `ContentType`.
- Tenant or partition key when needed.
- Schema version.
- Small payload or a claim-check pointer for large payloads.

Avoid putting large documents in the message body. Store large payloads in Blob Storage and send a pointer.

### Transactions

Service Bus supports transactional operations within Service Bus. This is useful for patterns such as receive from one entity and send to another atomically within the broker.

Do not assume a normal transaction across Service Bus, SQL, HTTP APIs, and external systems. For cross-resource workflows, use idempotency, outbox or inbox tables, sagas, and reconciliation.

### Security

Prefer Microsoft Entra authentication and managed identities for Azure-hosted workloads. Assign least-privilege data-plane roles.

Use Shared Access Signatures only when appropriate, and scope them narrowly. Separate send and receive permissions. Do not give worker identities permission to manage namespace configuration unless they need it.

### Common Mistakes

- Using receive and delete for business-critical work.
- Treating at least once as exactly once.
- Completing a message before durable side effects are committed.
- Dead-lettering transient failures too early.
- Retrying poison messages forever.
- Using one subscription for multiple independent consumers that need separate backlogs.
- Placing complex business routing in subscription filters.
- Forgetting every subscription has its own DLQ.
- Ignoring lock renewal for long processing.
- Sending large binary payloads directly through Service Bus.

### Best Practices

- Use queues for work distribution and topics for fan-out.
- Use peek-lock for reliable processing.
- Make consumers idempotent.
- Set meaningful `MessageId`, `CorrelationId`, and `Subject`.
- Keep messages small and versioned.
- Use DLQ alerts and replay tooling.
- Set max delivery count based on failure type and recovery time.
- Use sessions only when ordering or grouped state is required.
- Monitor active messages, scheduled messages, dead-letter counts, delivery counts, lock lost errors, and processing latency.
- Use the latest Azure SDK libraries.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is Azure Service Bus used for?

<!-- question:start:service-bus-queues-topics-subscriptions-and-dead-letter-queues-beginner-q01 -->
<!-- question-id:service-bus-queues-topics-subscriptions-and-dead-letter-queues-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Azure Service Bus is a managed message broker for reliable asynchronous communication between applications. It stores messages durably, lets producers and consumers run independently, and supports queues, topics, subscriptions, dead-letter queues, sessions, transactions, duplicate detection, and other enterprise messaging features.

It is commonly used for commands and work items such as processing orders, background jobs, workflow steps, and integration between services.

##### Key Points to Mention

- Durable brokered messaging.
- Temporal decoupling between producer and consumer.
- Queues for one consumer group.
- Topics and subscriptions for fan-out.
- Reliable processing still requires idempotent consumers.

<!-- question:end:service-bus-queues-topics-subscriptions-and-dead-letter-queues-beginner-q01 -->

#### What is the difference between a Service Bus queue and a topic?

<!-- question:start:service-bus-queues-topics-subscriptions-and-dead-letter-queues-beginner-q02 -->
<!-- question-id:service-bus-queues-topics-subscriptions-and-dead-letter-queues-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A queue delivers each message to one consumer from a competing consumer group. A topic publishes each message to one or more subscriptions, and each subscription receives its own copy if the message matches its filters.

Use a queue for task distribution. Use a topic when multiple independent systems need to react to the same message.

##### Key Points to Mention

- Queue is point-to-point.
- Topic is publish-subscribe.
- Subscriptions act like virtual queues.
- Topic subscriptions can have filters.
- Each subscription has its own backlog and DLQ.

<!-- question:end:service-bus-queues-topics-subscriptions-and-dead-letter-queues-beginner-q02 -->

#### What is a Service Bus subscription?

<!-- question:start:service-bus-queues-topics-subscriptions-and-dead-letter-queues-beginner-q03 -->
<!-- question-id:service-bus-queues-topics-subscriptions-and-dead-letter-queues-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A subscription is a durable receiver under a topic. When a topic receives a message, Service Bus copies the message into matching subscriptions. Consumers then read from the subscription much like they would read from a queue.

A subscription can define filters so it receives only relevant messages. It also has its own delivery count, dead-letter queue, and consumer scaling.

##### Key Points to Mention

- Subscriptions belong to topics.
- Each subscription receives its own matching copy.
- Filters control which messages are selected.
- Consumers read from subscriptions, not directly from the topic.
- Slow subscribers have their own backlog.

<!-- question:end:service-bus-queues-topics-subscriptions-and-dead-letter-queues-beginner-q03 -->

#### What is a dead-letter queue?

<!-- question:start:service-bus-queues-topics-subscriptions-and-dead-letter-queues-beginner-q04 -->
<!-- question-id:service-bus-queues-topics-subscriptions-and-dead-letter-queues-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A dead-letter queue is a subqueue that stores messages that could not be delivered or processed successfully. Each queue and each topic subscription has its own DLQ. Messages can enter the DLQ automatically, such as after exceeding maximum delivery count, or explicitly when application code rejects a permanently invalid message.

The DLQ must be monitored and drained deliberately. Messages remain there until a consumer reads and completes them from the DLQ.

##### Key Points to Mention

- DLQ exists per queue or subscription.
- It stores unprocessable or undeliverable messages.
- Max delivery count commonly moves poison messages to the DLQ.
- DLQ messages require inspection and action.
- It is an operational backlog, not automatic cleanup.

<!-- question:end:service-bus-queues-topics-subscriptions-and-dead-letter-queues-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How does peek-lock processing work?

<!-- question:start:service-bus-queues-topics-subscriptions-and-dead-letter-queues-intermediate-q01 -->
<!-- question-id:service-bus-queues-topics-subscriptions-and-dead-letter-queues-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

In peek-lock mode, Service Bus locks a message for one receiver without removing it. The receiver processes the message and then settles it. `Complete` removes it, `Abandon` releases it for redelivery, `DeadLetter` moves it to the DLQ, and `Defer` hides it until requested later.

If the lock expires or the consumer crashes before completion, the message becomes available again. This protects against message loss but means handlers must tolerate duplicates.

##### Key Points to Mention

- Peek-lock is the normal reliable receive mode.
- The lock is temporary and can expire.
- Complete only after durable processing succeeds.
- Redelivery is possible.
- Idempotency is required.

<!-- question:end:service-bus-queues-topics-subscriptions-and-dead-letter-queues-intermediate-q01 -->

#### How should you choose between one topic subscription and multiple subscriptions?

<!-- question:start:service-bus-queues-topics-subscriptions-and-dead-letter-queues-intermediate-q02 -->
<!-- question-id:service-bus-queues-topics-subscriptions-and-dead-letter-queues-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use one subscription for one logical subscriber group. Multiple instances of the same service can compete on the same subscription. Use separate subscriptions when different services need independent copies, independent retry behavior, independent DLQs, different filters, or different release schedules.

Do not share a subscription between unrelated consumers that each need to see every message, because competing consumers on the same subscription divide messages rather than duplicate them.

##### Key Points to Mention

- A subscription is a durable backlog for one subscriber group.
- Instances of the same service can share a subscription.
- Independent services need separate subscriptions.
- Each subscription has separate retry and DLQ behavior.
- Filters should stay simple.

<!-- question:end:service-bus-queues-topics-subscriptions-and-dead-letter-queues-intermediate-q02 -->

#### When would you use sessions in Service Bus?

<!-- question:start:service-bus-queues-topics-subscriptions-and-dead-letter-queues-intermediate-q03 -->
<!-- question-id:service-bus-queues-topics-subscriptions-and-dead-letter-queues-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use sessions when related messages must be processed in order or when only one consumer should process a group at a time. Messages with the same `SessionId` are processed under a session lock, and the consumer can use session state for checkpointing.

Sessions reduce parallelism when a session is hot, so they should be used for real ordering or grouped workflow requirements, not as a default.

##### Key Points to Mention

- Sessions group messages by `SessionId`.
- They support ordered processing within a group.
- A consumer locks a session, not only one message.
- Session state can support workflow checkpoints.
- Hot sessions can limit throughput.

<!-- question:end:service-bus-queues-topics-subscriptions-and-dead-letter-queues-intermediate-q03 -->

#### What should a DLQ processing runbook include?

<!-- question:start:service-bus-queues-topics-subscriptions-and-dead-letter-queues-intermediate-q04 -->
<!-- question-id:service-bus-queues-topics-subscriptions-and-dead-letter-queues-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

A DLQ runbook should alert on DLQ growth, inspect dead-letter reason and description, classify messages by cause, protect sensitive payloads, decide whether to fix data, resubmit, compensate, or discard, and record the outcome. It should include tooling to replay safely without duplicating side effects.

The runbook should also feed defects back to producers and consumers so the same message type does not repeatedly poison the system.

##### Key Points to Mention

- Alert on count and age.
- Inspect reason, description, delivery count, and payload.
- Classify retryable versus permanently invalid messages.
- Replay only with idempotency and authorization.
- Track root cause and remediation.

<!-- question:end:service-bus-queues-topics-subscriptions-and-dead-letter-queues-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design Service Bus messaging for order processing with billing, fulfillment, and notifications?

<!-- question:start:service-bus-queues-topics-subscriptions-and-dead-letter-queues-advanced-q01 -->
<!-- question-id:service-bus-queues-topics-subscriptions-and-dead-letter-queues-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Publish an order event or command to a topic when the order reaches a durable state. Create separate subscriptions for billing, fulfillment, notifications, and analytics so each service has its own backlog, retry policy, DLQ, and deployment lifecycle. Use filters only for broad routing such as event type or region.

Each consumer should be idempotent using a stable message ID or business key. Critical workflows can use commands and response queues or saga coordination. Monitor active counts, DLQs, processing latency, and downstream failures per subscription.

##### Key Points to Mention

- Topic fan-out decouples independent consumers.
- One subscription per logical service.
- Consumers need idempotency and durable state.
- DLQ and retry behavior are isolated by subscription.
- Complex workflow state belongs in services or sagas, not filters.

<!-- question:end:service-bus-queues-topics-subscriptions-and-dead-letter-queues-advanced-q01 -->

#### How do you prevent message loss and duplicate side effects in a Service Bus consumer?

<!-- question:start:service-bus-queues-topics-subscriptions-and-dead-letter-queues-advanced-q02 -->
<!-- question-id:service-bus-queues-topics-subscriptions-and-dead-letter-queues-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use peek-lock mode and complete the message only after durable side effects succeed. Store a processed-message record or use a natural idempotency key so redelivery can be ignored safely. Make external calls idempotent where possible. Use lock renewal for long work, but prefer breaking long work into smaller steps.

Handle settlement failures as uncertain outcomes. If work succeeded but complete failed, a duplicate may arrive later. The consumer should detect that the work is already done and complete the duplicate without repeating side effects.

##### Key Points to Mention

- Complete after durable work, not before.
- Track processed message IDs or business keys.
- Use idempotent external operations.
- Renew locks or split long work.
- Settlement can fail after processing succeeds.

<!-- question:end:service-bus-queues-topics-subscriptions-and-dead-letter-queues-advanced-q02 -->

#### What are the risks of putting complex business logic in subscription filters?

<!-- question:start:service-bus-queues-topics-subscriptions-and-dead-letter-queues-advanced-q03 -->
<!-- question-id:service-bus-queues-topics-subscriptions-and-dead-letter-queues-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Subscription filters are useful for broad routing, but complex business logic in filters becomes hard to test, version, observe, and change safely. It can also hide routing behavior from application code and make incidents harder to diagnose.

A better design is to use filters for simple event type, tenant, region, or category selection, then let the consuming service apply business decisions with normal code, tests, telemetry, and deployment controls.

##### Key Points to Mention

- Broker filters are harder to version and test than code.
- Complex filters reduce observability.
- Misconfigured filters can silently drop expected deliveries.
- Use filters for coarse routing.
- Keep business decisions in service code.

<!-- question:end:service-bus-queues-topics-subscriptions-and-dead-letter-queues-advanced-q03 -->

#### How would you monitor a production Service Bus namespace?

<!-- question:start:service-bus-queues-topics-subscriptions-and-dead-letter-queues-advanced-q04 -->
<!-- question-id:service-bus-queues-topics-subscriptions-and-dead-letter-queues-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Monitor active message count, scheduled message count, dead-letter count, oldest message age, incoming and outgoing messages, processing latency, lock lost errors, throttling, server errors, authorization failures, and consumer health. Alert per queue or subscription because a single failing subscription can hide inside a healthy namespace-level view.

Add correlation IDs and distributed tracing so messages can be tied back to API requests and downstream work. DLQ alerts should include runbooks and ownership.

##### Key Points to Mention

- Monitor per entity and subscription.
- DLQ count and oldest age are critical.
- Backlog growth indicates consumers cannot keep up.
- Track lock lost, throttling, and handler failures.
- Correlation IDs make asynchronous incidents diagnosable.

<!-- question:end:service-bus-queues-topics-subscriptions-and-dead-letter-queues-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
