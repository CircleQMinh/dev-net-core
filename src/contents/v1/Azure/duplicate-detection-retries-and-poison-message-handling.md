---
id: duplicate-detection-retries-and-poison-message-handling
topic: Messaging and event-driven Azure integration
subtopic: Duplicate detection, retries, and poison-message handling
category: Azure
---

## Overview

Azure messaging systems provide reliable delivery, but reliable does not mean exactly once. Producers can retry after uncertain sends. Brokers can redeliver after consumer crashes. Handlers can fail after partially completing work. Endpoints can time out after accepting an event.

This makes duplicate detection, retry strategy, and poison-message handling essential parts of production design.

In Azure, the common tools are:

- Service Bus duplicate detection for repeated sends with the same `MessageId`.
- Service Bus peek-lock, delivery count, lock renewal, max delivery count, and dead-letter queues.
- Event Grid retry policy and optional dead-lettering.
- Application-level idempotency for all durable side effects.
- Backoff, retry classification, and poison-message runbooks.

For interviews, strong candidates explain that duplicate detection is useful but limited. It does not remove the need for idempotent consumers, stable business keys, outbox and inbox patterns, DLQ monitoring, replay tools, and careful separation of transient failures from permanent data defects.

## Core Concepts

### Why Duplicates Happen

Duplicates happen because distributed systems often have uncertain outcomes.

Examples:

- A producer sends a message, Service Bus accepts it, but the acknowledgment is lost.
- A consumer updates a database, then crashes before completing the message.
- A message lock expires during long processing.
- A webhook processes an Event Grid event but returns a timeout.
- A retry policy repeats a request after a transient network failure.
- Two application instances submit the same business command.

The safest assumption is at least once delivery. Design every handler as if a duplicate will eventually arrive.

### Duplicate Detection in Service Bus

Service Bus duplicate detection can discard duplicate sends during a configured time window. The application sets a stable `MessageId`. If another message with the same identifier arrives within the window, Service Bus accepts the send request but drops the duplicate.

Example:

```csharp
var message = new ServiceBusMessage(BinaryData.FromObjectAsJson(order))
{
    MessageId = $"order-{order.Id}-submit",
    Subject = "SubmitOrder",
    ContentType = "application/json"
};

await sender.SendMessageAsync(message, cancellationToken);
```

The key is predictable repeatability. A random GUID generated on every retry defeats broker-side duplicate detection.

### Duplicate Detection Window

The duplicate detection window is the time range during which Service Bus remembers message IDs. A longer window catches more duplicate sends but increases broker work and can reduce throughput.

Choose a window based on:

- Expected producer retry duration.
- Recovery time after producer crash.
- Business tolerance for duplicate sends.
- Throughput requirements.
- Cost of application-level deduplication.

Do not use an arbitrarily long window as a substitute for consumer idempotency.

### What Service Bus Duplicate Detection Does Not Solve

Duplicate detection applies when messages are sent to the broker. It does not guarantee exactly once processing by consumers.

It does not prevent:

- Redelivery after lock expiration.
- Duplicate side effects after settlement failure.
- Duplicate business operations caused by different `MessageId` values.
- Event Grid duplicate delivery.
- Duplicates outside the configured window.
- Duplicates across separate entities unless the same feature and keying strategy apply.

Consumers still need idempotency.

### Idempotent Consumer

An idempotent consumer can process the same message more than once without changing the final result incorrectly.

Common techniques:

- Store processed message IDs in an inbox table.
- Use a business key with a unique constraint.
- Make state transitions conditional.
- Use natural idempotency keys in downstream APIs.
- Ignore duplicate commands that already reached a terminal state.
- Complete duplicate messages after confirming the work is already done.

Example:

```sql
CREATE TABLE ProcessedMessage (
    ConsumerName nvarchar(100) NOT NULL,
    MessageId nvarchar(200) NOT NULL,
    ProcessedAtUtc datetime2 NOT NULL,
    PRIMARY KEY (ConsumerName, MessageId)
);
```

### Inbox Pattern

An inbox table records messages a consumer has already processed. The consumer inserts the message ID in the same database transaction as the business update.

Processing flow:

1. Receive message.
2. Begin database transaction.
3. Try to insert inbox record.
4. If insert fails because the record exists, treat the message as duplicate.
5. Apply business changes.
6. Commit transaction.
7. Complete the broker message.

This protects against redelivery after consumer crash or settlement failure.

### Outbox Pattern

The outbox pattern handles reliable publishing. The service writes its business change and an outgoing message record in the same database transaction. A dispatcher later publishes the message and marks the outbox record dispatched.

This avoids:

- Database commit succeeded but message was never sent.
- Message was sent but database transaction rolled back.
- Retrying publication with a different message ID.

The outbox dispatcher should use stable `MessageId` values and tolerate publish retries.

### Retry Classification

Not every failure should be retried.

| Failure type | Example | Handling |
|---|---|---|
| Transient infrastructure | Timeout, throttling, temporary 503 | Retry with backoff |
| Dependency unavailable | Database failover, downstream outage | Retry, pause, or circuit break |
| Concurrency conflict | Duplicate key, stale version | Re-read and decide |
| Invalid message | Missing required field | Dead-letter |
| Unauthorized business action | Tenant mismatch | Dead-letter or security path |
| Permanent external rejection | Invalid account number | Dead-letter or compensate |

Retrying invalid data only burns capacity and delays good messages.

### Retry Backoff

Retries should use backoff rather than tight loops. Backoff protects the broker, consumer, and downstream dependency.

Good retry behavior:

- Short retry for brief transient errors.
- Exponential or progressive delay.
- Jitter to avoid synchronized retries.
- Maximum attempts or deadline.
- Observability for every retry family.
- Stop retrying when the error is permanent.

Service Bus SDK retries handle client-side transient operations. Message redelivery handles consumer failures. Application code still decides whether business work should be retried or dead-lettered.

### Peek-Lock Redelivery

With Service Bus peek-lock, a consumer receives a locked message. If processing succeeds, it completes the message. If the consumer abandons the message, crashes, or lets the lock expire, Service Bus can redeliver it.

The delivery count increases when the message is abandoned or lock expiration makes it available again. When delivery count exceeds max delivery count, Service Bus moves the message to the DLQ.

This is the core mechanism for poison-message protection.

### Lock Renewal

Long-running handlers can renew message locks, or use automatic lock renewal through SDK processor options.

Lock renewal helps avoid duplicate concurrent processing, but it should not hide bad design. If one message takes many minutes, consider:

- Splitting work into smaller messages.
- Using Durable Functions or a workflow engine.
- Using a database work item with explicit checkpoints.
- Sending a command that starts work and another message for the next step.

### Poison Message

A poison message is a message that repeatedly fails and cannot be processed successfully without intervention.

Common causes:

- Malformed JSON.
- Unknown schema version.
- Missing required business data.
- Referential integrity failure.
- Authorization or tenant mismatch.
- A handler bug triggered by a specific payload.
- A downstream API permanently rejects the request.

Poison messages should eventually leave the active queue so they do not block healthy work.

### Max Delivery Count

Max delivery count limits how many times Service Bus will deliver a message before moving it to the DLQ. The default is often suitable as a starting point, but real systems should choose intentionally.

Consider:

- Typical transient outage duration.
- Processing time.
- Downstream rate limits.
- Message value.
- How quickly operations needs to see the failure.
- Whether retries are also happening inside the handler.

Too low can dead-letter messages during brief outages. Too high can retry poison messages for too long.

### Explicit Dead-Lettering

Do not wait for max delivery count when retrying cannot help. A consumer can explicitly dead-letter a message with a reason and description.

```csharp
await receiver.DeadLetterMessageAsync(
    message,
    deadLetterReason: "UnsupportedSchemaVersion",
    deadLetterErrorDescription: "Schema version 99 is not supported.",
    cancellationToken: cancellationToken);
```

Use structured reason codes so DLQ tooling can group failures.

### Event Grid Retries

Event Grid uses retry behavior for failed event delivery. Push handlers must return success only after they have durably accepted the event. A handler that performs side effects and then times out can receive the event again.

Event Grid does not guarantee ordering, and duplicate events are possible. The subscriber should use event ID or business key for idempotency.

### Event Grid Dead-Lettering

Event Grid can dead-letter events that cannot be delivered within configured retry limits or time-to-live. Dead-lettering must be configured on important subscriptions.

Use Event Grid DLQ data to decide:

- Whether the endpoint was misconfigured.
- Whether a schema changed unexpectedly.
- Whether the destination was unavailable.
- Whether replay is safe.

If the event triggers high-value work, routing Event Grid to Service Bus can provide richer queue-based handling.

### Retry Storms

A retry storm happens when many failed operations retry at once and make the outage worse.

Avoid retry storms by:

- Using jittered backoff.
- Bounding concurrency.
- Pausing consumers when dependencies are unhealthy.
- Using circuit breakers.
- Respecting rate-limit responses.
- Separating retryable from poison failures.
- Monitoring queue age and dependency errors.

Retries are a recovery tool, but uncontrolled retries are a traffic amplifier.

### Replay and Resubmission

Replay must be designed, not improvised.

A safe replay tool should:

- Require authorization.
- Preserve or intentionally replace message IDs.
- Show dead-letter reason and payload.
- Allow correction when data is fixable.
- Rate-limit resubmitted messages.
- Record who replayed what and why.
- Avoid replaying messages into consumers that are still broken.

Replaying without idempotency can create duplicate side effects.

### Observability

Track:

- Duplicate-detection drops where visible.
- Message delivery count.
- Lock lost errors.
- Abandon count.
- DLQ count and oldest DLQ age.
- Retry attempts by error category.
- Handler latency.
- Poison-message reason codes.
- Event Grid delivery failures and dead-letter count.
- Dependency health during retries.

Without this data, teams usually discover problems only after customers report missing work.

### Common Mistakes

- Generating a new `MessageId` on every retry.
- Assuming duplicate detection gives exactly once processing.
- Completing messages before durable side effects succeed.
- Retrying validation errors repeatedly.
- Dead-lettering transient failures immediately.
- Ignoring DLQ messages.
- Replaying DLQ messages without fixing the cause.
- Letting retry loops overwhelm downstream systems.
- Omitting idempotency keys in database writes and external API calls.
- Treating Event Grid as ordered and exactly once.

### Best Practices

- Use stable message IDs derived from business context.
- Keep duplicate detection windows as small as practical.
- Make every consumer idempotent.
- Use inbox and outbox patterns for important workflows.
- Classify errors before retrying.
- Use jittered backoff and bounded concurrency.
- Dead-letter permanent failures with structured reasons.
- Monitor DLQ count, age, and reason distribution.
- Build safe replay tools.
- Test crash-after-side-effect and settlement-failure scenarios.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### Why can duplicate messages happen in Azure messaging?

<!-- question:start:duplicate-detection-retries-and-poison-message-handling-beginner-q01 -->
<!-- question-id:duplicate-detection-retries-and-poison-message-handling-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Duplicates happen because producers, brokers, and consumers can fail after partially completing an operation. A send might succeed but the acknowledgment can be lost. A consumer might update a database and crash before completing the message. An Event Grid handler might process an event but time out before returning success.

Azure messaging systems generally provide at least once delivery, so applications must expect duplicates.

##### Key Points to Mention

- Network failures create uncertain outcomes.
- Consumer crashes can cause redelivery.
- Lock expiration can cause redelivery.
- Event Grid can redeliver failed or timed-out events.
- Idempotency is required.

<!-- question:end:duplicate-detection-retries-and-poison-message-handling-beginner-q01 -->

#### What is Service Bus duplicate detection?

<!-- question:start:duplicate-detection-retries-and-poison-message-handling-beginner-q02 -->
<!-- question-id:duplicate-detection-retries-and-poison-message-handling-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Service Bus duplicate detection lets a queue or topic remember message IDs for a configured time window. If the producer sends another message with the same `MessageId` during that window, Service Bus accepts the send but drops the duplicate.

The application must set a stable message ID. A new random ID on every retry prevents duplicate detection from working.

##### Key Points to Mention

- It works on `MessageId`.
- It has a configured time window.
- It helps with duplicate sends.
- It does not eliminate consumer redelivery.
- Stable business-derived IDs work best.

<!-- question:end:duplicate-detection-retries-and-poison-message-handling-beginner-q02 -->

#### What is a poison message?

<!-- question:start:duplicate-detection-retries-and-poison-message-handling-beginner-q03 -->
<!-- question-id:duplicate-detection-retries-and-poison-message-handling-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A poison message is a message that repeatedly fails processing and is unlikely to succeed without correction. It may be malformed, invalid for the current schema, unauthorized, or incompatible with business rules.

Service Bus can move poison messages to the DLQ after the maximum delivery count is exceeded. Applications can also explicitly dead-letter messages when retrying will not help.

##### Key Points to Mention

- Poison messages fail repeatedly.
- Retrying permanent failures wastes capacity.
- Max delivery count protects active queues.
- DLQ preserves the message for inspection.
- Include useful dead-letter reason codes.

<!-- question:end:duplicate-detection-retries-and-poison-message-handling-beginner-q03 -->

#### What does idempotent processing mean?

<!-- question:start:duplicate-detection-retries-and-poison-message-handling-beginner-q04 -->
<!-- question-id:duplicate-detection-retries-and-poison-message-handling-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Idempotent processing means handling the same message multiple times produces the same final result as handling it once. For example, a consumer can detect that order `123` was already marked paid and avoid charging the customer again.

Idempotency is essential because broker retries and redelivery are normal in reliable messaging.

##### Key Points to Mention

- Same input can be safely processed more than once.
- Use message IDs or business keys.
- Unique constraints can enforce idempotency.
- External side effects need idempotency too.
- Idempotency is separate from broker duplicate detection.

<!-- question:end:duplicate-detection-retries-and-poison-message-handling-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How do you choose a duplicate detection window?

<!-- question:start:duplicate-detection-retries-and-poison-message-handling-intermediate-q01 -->
<!-- question-id:duplicate-detection-retries-and-poison-message-handling-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Choose a window that covers the realistic period in which the producer may retry the same send after an uncertain outcome. Consider retry policies, crash recovery time, network instability, and business tolerance.

A larger window catches more duplicate sends but increases broker tracking work and can reduce throughput. Keep the window as small as practical and still implement consumer idempotency.

##### Key Points to Mention

- Base it on producer retry behavior.
- Longer windows have throughput cost.
- It only handles duplicate sends within the window.
- It requires stable `MessageId`.
- It does not replace inbox or idempotency logic.

<!-- question:end:duplicate-detection-retries-and-poison-message-handling-intermediate-q01 -->

#### How should a consumer decide whether to retry or dead-letter a message?

<!-- question:start:duplicate-detection-retries-and-poison-message-handling-intermediate-q02 -->
<!-- question-id:duplicate-detection-retries-and-poison-message-handling-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

The consumer should classify the failure. Transient infrastructure and dependency failures should be retried with backoff. Permanent validation, authorization, unsupported schema, or unrecoverable business failures should be dead-lettered with a structured reason.

Unknown errors may be retried a limited number of times, but if they repeat they should move to DLQ for investigation rather than blocking healthy work forever.

##### Key Points to Mention

- Retry transient failures.
- Dead-letter permanent failures.
- Use structured reason codes.
- Avoid infinite retries.
- Monitor error categories and DLQ growth.

<!-- question:end:duplicate-detection-retries-and-poison-message-handling-intermediate-q02 -->

#### What is the inbox pattern and why is it useful?

<!-- question:start:duplicate-detection-retries-and-poison-message-handling-intermediate-q03 -->
<!-- question-id:duplicate-detection-retries-and-poison-message-handling-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

The inbox pattern records consumed message IDs in the consumer's database, usually in the same transaction as the business update. If the same message is delivered again, the consumer detects that it was already processed and completes it without repeating side effects.

This is useful because a consumer can crash after updating the database but before completing the Service Bus message, causing redelivery.

##### Key Points to Mention

- Store processed message IDs.
- Use a unique constraint.
- Commit inbox record and business change together.
- Detect duplicates on redelivery.
- Complete duplicate messages safely.

<!-- question:end:duplicate-detection-retries-and-poison-message-handling-intermediate-q03 -->

#### How can retries create outages?

<!-- question:start:duplicate-detection-retries-and-poison-message-handling-intermediate-q04 -->
<!-- question-id:duplicate-detection-retries-and-poison-message-handling-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Retries can create a retry storm when many clients or consumers repeat failed operations at the same time. This can overwhelm a recovering dependency, increase queue backlogs, and turn a small outage into a larger one.

Use bounded concurrency, exponential backoff with jitter, circuit breakers, rate-limit handling, and failure classification to keep retries from amplifying traffic.

##### Key Points to Mention

- Tight retry loops amplify load.
- Jitter prevents synchronized retries.
- Bound concurrency during failures.
- Pause or circuit-break unhealthy dependencies.
- Monitor retry rates and queue age.

<!-- question:end:duplicate-detection-retries-and-poison-message-handling-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design exactly-once-like behavior with Service Bus and SQL?

<!-- question:start:duplicate-detection-retries-and-poison-message-handling-advanced-q01 -->
<!-- question-id:duplicate-detection-retries-and-poison-message-handling-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

You cannot rely on the broker alone for exactly once side effects across Service Bus and SQL. Use at least once delivery plus idempotent application design. On the producer side, use an outbox table and stable `MessageId`. On the consumer side, use an inbox table or business unique constraint in the same SQL transaction as the state change.

Complete the message only after the SQL transaction commits. If completion fails and the message is redelivered, the inbox or unique constraint detects the duplicate and prevents repeating the side effect.

##### Key Points to Mention

- Broker exactly once does not cover external side effects.
- Use outbox for reliable publication.
- Use inbox for reliable consumption.
- Complete after durable commit.
- Redelivery becomes safe through idempotency.

<!-- question:end:duplicate-detection-retries-and-poison-message-handling-advanced-q01 -->

#### How would you handle a consumer that sometimes loses the message lock?

<!-- question:start:duplicate-detection-retries-and-poison-message-handling-advanced-q02 -->
<!-- question-id:duplicate-detection-retries-and-poison-message-handling-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

First determine whether processing time regularly exceeds the lock duration or whether lock loss is caused by transient connectivity, host restarts, or entity configuration changes. For legitimate long processing, use auto lock renewal or increase lock duration within limits. Better yet, split long work into smaller idempotent steps.

Because lock loss can cause duplicate concurrent processing, the handler must use durable idempotency and conditional state transitions. Monitoring should track lock-lost exceptions and processing duration.

##### Key Points to Mention

- Measure processing time against lock duration.
- Use auto lock renewal when appropriate.
- Split long jobs into smaller messages.
- Guard side effects with idempotency.
- Monitor lock lost errors.

<!-- question:end:duplicate-detection-retries-and-poison-message-handling-advanced-q02 -->

#### How would you build a safe DLQ replay tool?

<!-- question:start:duplicate-detection-retries-and-poison-message-handling-advanced-q03 -->
<!-- question-id:duplicate-detection-retries-and-poison-message-handling-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

A safe replay tool should display the original message, dead-letter reason, delivery history, schema version, and correlation ID. It should require authorization, allow approved corrections where appropriate, preserve or deliberately replace idempotency keys, rate-limit replay, and log who replayed the message and why.

It should prevent replay while the original bug is still active. Ideally it supports dry runs or replay to a staging entity for validation.

##### Key Points to Mention

- Replay requires authorization and audit.
- Show reason codes and payload safely.
- Preserve idempotency semantics.
- Rate-limit resubmission.
- Do not replay before fixing root cause.

<!-- question:end:duplicate-detection-retries-and-poison-message-handling-advanced-q03 -->

#### How do you handle duplicates in Event Grid subscribers?

<!-- question:start:duplicate-detection-retries-and-poison-message-handling-advanced-q04 -->
<!-- question-id:duplicate-detection-retries-and-poison-message-handling-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Treat Event Grid delivery as at least once and unordered. Use the event ID or a business identifier as an idempotency key. Store processed event IDs or make state transitions conditional. When the event only says that something changed, re-read the authoritative resource state instead of trusting event order.

For high-value or long-running processing, have Event Grid deliver to Service Bus and let workers handle retries, DLQ, and idempotent processing.

##### Key Points to Mention

- Event Grid can deliver duplicates.
- Ordering is not guaranteed.
- Use event ID or business ID for dedupe.
- Re-read authoritative state when needed.
- Service Bus can provide durable work handling behind Event Grid.

<!-- question:end:duplicate-detection-retries-and-poison-message-handling-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
