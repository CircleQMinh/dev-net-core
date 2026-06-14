---
id: idempotent-consumers-and-duplicate-message-handling
topic: Distributed systems patterns
subtopic: Idempotent consumers and duplicate-message handling
category: Design & Architecture
---

## Overview

An idempotent consumer can process the same logical message more than once without producing an incorrect additional business effect.

Duplicate delivery is normal in systems that provide at-least-once messaging. A typical failure sequence is:

```text
consumer receives message
consumer commits database update
consumer crashes before acknowledgement
broker redelivers message
```

The broker cannot know whether the first attempt committed. Redelivery protects against message loss, but the application must protect against duplicate charges, records, emails, inventory changes, or workflow transitions.

Idempotency can be achieved through:

- Naturally idempotent state assignment.
- A processed-message or inbox table.
- Database uniqueness constraints.
- Conditional updates and business keys.
- Version checks.
- Idempotency keys supported by external services.
- Reconciliation when prevention cannot be guaranteed.

Broker duplicate detection is useful but limited by identifiers, retention windows, broker scope, and downstream side effects. It does not replace consumer-level correctness.

This topic matters in interviews because candidates must reason about ambiguous outcomes and transaction boundaries. Strong answers explain why acknowledgements are placed after durable work, why that creates duplicates, and how deduplication is committed atomically with the business effect.

## Core Concepts

### Why Duplicate Messages Occur

Duplicates can be created by:

- Lost broker acknowledgements.
- Consumer crash after commit.
- Producer retry after a lost send acknowledgement.
- Outbox publisher retry.
- Broker redelivery after lock expiry.
- Network timeout with an unknown outcome.
- Manual replay from a dead-letter queue.
- Stream consumer offset reset.
- Disaster recovery or replication behavior.
- Two producers emitting the same logical operation.

Duplicates are not always byte-for-byte identical. Two different message IDs can represent the same business request.

### Delivery Semantics

**At most once**

- Process zero or one time.
- A failure can lose the message.

**At least once**

- Retries until acknowledged or dead-lettered.
- A message may be delivered repeatedly.
- Most business consumers should expect this model.

**Exactly once**

- Requires precise scope.
- A broker may deduplicate sends or atomically manage its own log.
- External databases, email, payments, and third-party APIs remain separate transaction boundaries.

End-to-end correctness usually comes from at-least-once delivery plus idempotent effects and reconciliation.

### Transport Duplicate Versus Business Duplicate

A transport duplicate reuses the same message ID:

```text
MessageId = 84a2...
```

A business duplicate represents the same intent with another transport ID:

```text
Charge invoice 123 for settlement attempt 7
```

Use identifiers at the correct level:

- Message ID for transport processing.
- Command ID for one requested action.
- Business key for a domain operation.
- Aggregate version for ordered state transition.

A random ID generated for every retry defeats deduplication.

### Natural Idempotency

Some operations are naturally idempotent:

```text
Set order status to Canceled
Upsert projection version 12
Set user email to a specific value
```

Others are not:

```text
Increment balance by 10
Send an email
Charge a card
Append a row
```

Prefer state-setting operations over relative operations when business semantics permit.

Unsafe:

```csharp
account.Balance += message.Amount;
```

Safer when the event provides authoritative state and version:

```csharp
if (message.Version > account.Version)
{
    account.SetBalance(message.NewBalance, message.Version);
}
```

Do not change the meaning of a domain operation merely to make implementation convenient.

### Inbox or Processed-Message Table

A common pattern stores the message ID in the same database transaction as the business change.

Schema concept:

```text
ProcessedMessages
  ConsumerName
  MessageId
  ProcessedAt

Unique(ConsumerName, MessageId)
```

Handler:

```csharp
public async Task Handle(
    PaymentReceived message,
    CancellationToken cancellationToken)
{
    await using var transaction =
        await db.Database.BeginTransactionAsync(cancellationToken);

    var alreadyProcessed = await db.ProcessedMessages.AnyAsync(
        item => item.ConsumerName == nameof(PaymentReceivedHandler) &&
                item.MessageId == message.MessageId,
        cancellationToken);

    if (alreadyProcessed)
    {
        await transaction.CommitAsync(cancellationToken);
        return;
    }

    var invoice = await db.Invoices.SingleAsync(
        item => item.Id == message.InvoiceId,
        cancellationToken);

    invoice.RecordPayment(message.PaymentId, message.Amount);

    db.ProcessedMessages.Add(new ProcessedMessage(
        nameof(PaymentReceivedHandler),
        message.MessageId,
        DateTimeOffset.UtcNow));

    await db.SaveChangesAsync(cancellationToken);
    await transaction.CommitAsync(cancellationToken);
}
```

The unique constraint is essential because two deliveries can race between the existence check and insert.

### Atomicity of Deduplication and Business Effect

This is unsafe:

```text
mark message processed
crash
business update never occurs
```

This is also unsafe:

```text
business update commits
crash
processed marker never commits
```

The deduplication record and business effect must commit atomically in the same local transaction when they use the same database.

If side effects span multiple systems, no inbox table can make them one atomic transaction. Use the external system's idempotency support, an outbox, state reconciliation, or a saga.

### Unique Business Constraints

Sometimes the business entity provides the deduplication boundary:

```text
Payments
  Provider
  ProviderTransactionId

Unique(Provider, ProviderTransactionId)
```

Attempting to record the same provider transaction twice becomes a harmless conflict that the handler interprets as already processed.

Business uniqueness can be stronger than transport-message deduplication because it catches logically duplicate messages with different message IDs.

### Conditional Writes

Use state and version in the update predicate:

```csharp
var affected = await db.Orders
    .Where(order =>
        order.Id == message.OrderId &&
        order.Version < message.OrderVersion)
    .ExecuteUpdateAsync(
        setters => setters
            .SetProperty(order => order.Status, message.Status)
            .SetProperty(order => order.Version, message.OrderVersion),
        cancellationToken);
```

This prevents an older or duplicate projection message from overwriting newer state.

The handler must define behavior for:

- Equal version: duplicate.
- Next version: expected update.
- Older version: stale message.
- Future version with a gap: missing or reordered message.

### Concurrency Races

Two consumer instances may receive the same message concurrently:

```text
consumer A checks inbox -> not found
consumer B checks inbox -> not found
both attempt business update
```

Protection requires:

- A database unique constraint.
- Appropriate transaction isolation.
- Conditional updates.
- Aggregate concurrency tokens.
- Partitioned or session-based serialization when needed.

An in-memory set is not sufficient in a scaled or restarted service.

### External Side Effects

External actions are difficult:

- Payment capture.
- Email or SMS.
- Webhook delivery.
- Cloud resource creation.
- Shipping-label purchase.

Strategies:

**External idempotency key**

```http
POST /charges
Idempotency-Key: settlement-123-attempt-7
```

**Local outbox**

- Commit business state and outgoing intent locally.
- A dedicated publisher performs the external call.

**Provider transaction lookup**

- Reconcile an unknown timeout using the stable operation ID.

**Business reconciliation**

- Compare internal and provider records and repair mismatches.

Do not generate a new external idempotency key on every retry.

### Email and Notification Idempotency

Sending the same message twice may be undesirable but not always transactionally preventable.

Possible design:

```text
NotificationIntent has unique BusinessNotificationId
Dispatcher sends using provider key if supported
Dispatcher records provider response
Reconciliation handles unknown outcome
```

Distinguish:

- Transactional notifications that must be sent once logically.
- Reminder campaigns where repeated delivery may be expected.
- Best-effort telemetry notifications.

Idempotency requirements are business-specific.

### Broker Duplicate Detection

Some brokers track message IDs for a configured time window and discard repeated sends.

Benefits:

- Reduces producer-side duplicates.
- Handles a lost send acknowledgement when the producer retries with the same ID.

Limitations:

- Detection expires after the configured window.
- Throughput can be affected.
- The producer must reuse a stable message ID.
- It does not cover different IDs for the same business operation.
- It does not prevent consumer redelivery after processing ambiguity.
- It does not make external side effects exactly once.

Use broker deduplication as defense in depth.

### Deduplication Retention

Processed IDs cannot always be stored forever.

Retention depends on:

- Broker maximum redelivery or replay window.
- Message retention.
- Dead-letter replay policy.
- Business operation lifetime.
- Audit and regulatory requirements.
- Storage volume.

If inbox records expire before old messages can reappear, duplicates can be processed again.

Options:

- Retain for the full replay horizon.
- Archive compact business keys.
- Make the underlying operation naturally idempotent.
- Prevent replay beyond a checkpoint.
- Rebuild into a clean destination designed for replay.

### Ordering and Idempotency

Idempotency does not solve ordering.

Events:

```text
OrderVersion 5 -> Shipped
OrderVersion 4 -> Packed
```

Processing version 4 after version 5 must not regress the projection.

Use:

- Partition key by aggregate.
- Sequence or version numbers.
- Conditional writes.
- Gap detection.
- Buffering or replay.

Duplicate and out-of-order handling should be designed together.

### Retry Classification

Classify failures:

**Transient**

- Broker connection interruption.
- Temporary database unavailability.
- Dependency throttling.

Retry with bounded backoff and jitter.

**Permanent technical**

- Invalid schema.
- Unsupported version.
- Corrupt payload.

Dead-letter after limited attempts.

**Business rejection**

- Order already canceled.
- Credit limit exceeded.

Record the defined outcome; retrying unchanged data is usually not useful.

**Unknown outcome**

- Remote call timed out after possibly committing.

Reconcile by idempotency key before retrying.

### Dead-Letter Replay

Replaying dead-lettered messages can reintroduce old duplicates.

Before replay:

- Fix the underlying cause.
- Confirm schema compatibility.
- Preserve the original message and business IDs.
- Verify deduplication retention.
- Limit replay rate.
- Observe downstream capacity.
- Separate dry-run or validation when possible.

Changing every message ID during replay bypasses transport deduplication and may create new side effects.

### Poison Messages

A poison message repeatedly fails for deterministic reasons.

The consumer should:

- Avoid infinite immediate retry.
- Capture a safe failure reason.
- Move the message to quarantine or dead letter.
- Alert an owner.
- Continue processing unrelated messages when ordering rules allow.

Do not acknowledge and silently discard a message merely to clear backlog unless the business explicitly accepts the loss.

### Idempotency Key Scope

An idempotency key should be scoped to:

- Caller or tenant.
- Operation type.
- Resource.
- Business request.
- Defined retention period.

The server can store a request fingerprint:

```text
(tenant, operation, idempotency key) -> request hash, outcome
```

If the same key arrives with different input, return a conflict rather than reusing an unrelated result.

### Handler Outcome for Duplicates

A duplicate should normally:

- Avoid repeating effects.
- Return or record the original outcome when needed.
- Acknowledge the message successfully.
- Emit metrics without creating alert noise.

Do not throw an error for an expected duplicate, because the broker will redeliver it again.

### Side Effects Produced by a Consumer

A consumer can update state and publish a new message.

Use:

```text
incoming message
  -> inbox record
  -> business state update
  -> outgoing outbox record
  -> one local transaction
```

This makes the consumer an atomic bridge between incoming and outgoing durable intent. The downstream consumer still applies its own idempotency.

### Idempotent Projection Rebuilds

Projection handlers should be safe during:

- Normal redelivery.
- Full replay.
- Partial replay.
- Parallel backfill.
- Version migration.

Prefer deterministic upsert by stable key and source version. Do not send emails, charge cards, or trigger unrelated external side effects while rebuilding a read model.

### Observability

Measure:

- Duplicate count by message type and source.
- Processing attempts.
- Inbox conflicts.
- Oldest unprocessed message.
- Retry and dead-letter volume.
- Unknown-outcome reconciliation.
- External idempotency-key conflicts.
- Business duplicate prevented.

A sudden duplicate increase may indicate producer retry problems, broker instability, lock expiry, or slow consumers.

Log message IDs and business IDs, but avoid full sensitive payloads.

### Testing

Test:

- The same message delivered sequentially.
- The same message delivered concurrently.
- Crash after business commit but before acknowledgement.
- Crash before commit.
- Duplicate business request with a different message ID.
- Out-of-order versions.
- Expired deduplication record.
- External timeout after possible success.
- Dead-letter replay.
- Full projection rebuild.

Fault-injection tests are more valuable than happy-path unit tests alone.

### Common Mistakes

Common failures include:

- Assuming the broker guarantees end-to-end exactly once.
- Acknowledging before durable work.
- Storing processed IDs outside the business transaction.
- Checking for duplicates without a unique constraint.
- Using in-memory deduplication.
- Generating a new ID for every retry.
- Deduplicating only transport IDs when business duplicates matter.
- Keeping inbox records for less time than messages can be replayed.
- Treating out-of-order messages as duplicates.
- Retrying permanent business failures indefinitely.
- Replaying dead letters with new IDs.
- Calling external APIs without stable idempotency keys.

### Best-Practice Design Process

1. Identify every source of redelivery and ambiguous outcome.
2. Define the logical operation and stable identifiers.
3. Prefer naturally idempotent state transitions.
4. Add business uniqueness constraints where appropriate.
5. Commit inbox state and business effects atomically.
6. Use an outbox for emitted messages.
7. Apply external idempotency keys and reconciliation.
8. Define ordering and version behavior separately.
9. Retain deduplication state for the replay horizon.
10. Bound retries and own dead-letter recovery.
11. Test concurrent duplicates and crash windows.
12. Monitor both transport duplicates and prevented business duplicates.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is an idempotent message consumer?

<!-- question:start:idempotent-consumers-and-duplicate-message-handling-beginner-q01 -->
<!-- question-id:idempotent-consumers-and-duplicate-message-handling-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

An idempotent consumer can receive and handle the same logical message more than once without producing an incorrect extra business effect. It may achieve this through state-setting operations, processed-message records, uniqueness constraints, versions, or external idempotency keys. The duplicate is acknowledged after the consumer confirms the original effect.

##### Key Points to Mention

- Idempotency concerns observable business outcome.
- It is required for normal at-least-once delivery.
- Message IDs and business operation IDs may both matter.
- Duplicate handling should be an expected success path.

<!-- question:end:idempotent-consumers-and-duplicate-message-handling-beginner-q01 -->

#### Why do brokers deliver duplicate messages?

<!-- question:start:idempotent-consumers-and-duplicate-message-handling-beginner-q02 -->
<!-- question-id:idempotent-consumers-and-duplicate-message-handling-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

The consumer can commit its work and crash before the acknowledgement reaches the broker. The broker cannot know whether processing completed, so it redelivers to avoid losing the message. Producers and outbox publishers can also retry after lost acknowledgements, and operators may replay messages.

##### Key Points to Mention

- Redelivery is a reliability feature.
- Networks create unknown outcomes.
- Acknowledging early risks loss.
- Processing before acknowledgement requires idempotency.

<!-- question:end:idempotent-consumers-and-duplicate-message-handling-beginner-q02 -->

#### What is a naturally idempotent operation?

<!-- question:start:idempotent-consumers-and-duplicate-message-handling-beginner-q03 -->
<!-- question-id:idempotent-consumers-and-duplicate-message-handling-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A naturally idempotent operation produces the same final state when repeated, such as setting an order to `Canceled` or upserting projection version 10. Incrementing a counter, sending an email, or charging a card is not naturally idempotent and needs a business key, deduplication record, or provider-supported idempotency mechanism.

##### Key Points to Mention

- State assignment is often safer than relative change.
- Repetition must not create another business effect.
- Current state alone may not identify every duplicate.
- Preserve domain semantics rather than forcing artificial behavior.

<!-- question:end:idempotent-consumers-and-duplicate-message-handling-beginner-q03 -->

#### Does broker duplicate detection remove the need for idempotent consumers?

<!-- question:start:idempotent-consumers-and-duplicate-message-handling-beginner-q04 -->
<!-- question-id:idempotent-consumers-and-duplicate-message-handling-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

No. Broker duplicate detection usually covers repeated sends with the same message ID during a finite window. It may not cover consumer redelivery, replay after the window, different IDs for the same business operation, or external side effects. Consumer idempotency remains the end-to-end correctness control.

##### Key Points to Mention

- Broker deduplication is defense in depth.
- Stable producer message IDs are required.
- Detection windows expire.
- Business duplicates can differ at the transport level.

<!-- question:end:idempotent-consumers-and-duplicate-message-handling-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How does an inbox table prevent duplicate processing?

<!-- question:start:idempotent-consumers-and-duplicate-message-handling-intermediate-q01 -->
<!-- question-id:idempotent-consumers-and-duplicate-message-handling-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

The handler inserts a processed-message key and applies the business update in the same local database transaction. A unique constraint on consumer and message ID prevents concurrent deliveries from both committing. On redelivery, the existing key tells the handler to skip the effect and acknowledge successfully.

##### Key Points to Mention

- Deduplication and the effect must be atomic.
- The unique constraint closes the check-then-insert race.
- Scope the key per logical consumer.
- Define retention according to the replay horizon.

<!-- question:end:idempotent-consumers-and-duplicate-message-handling-intermediate-q01 -->

#### How should a consumer handle an external API call such as a payment charge?

<!-- question:start:idempotent-consumers-and-duplicate-message-handling-intermediate-q02 -->
<!-- question-id:idempotent-consumers-and-duplicate-message-handling-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Create a stable business operation ID and send it as the provider's idempotency key. Persist the outgoing intent through an outbox, record the provider transaction ID and result, and reconcile timeouts because the provider may have committed despite a lost response. Retry with the same key, never a new key, and monitor unresolved outcomes.

##### Key Points to Mention

- A local database transaction cannot include an arbitrary provider.
- Timeouts produce uncertainty, not definite failure.
- Provider lookup and reconciliation are required fallbacks.
- Business uniqueness should prevent a second logical charge.

<!-- question:end:idempotent-consumers-and-duplicate-message-handling-intermediate-q02 -->

#### How do duplicate handling and message ordering interact?

<!-- question:start:idempotent-consumers-and-duplicate-message-handling-intermediate-q03 -->
<!-- question-id:idempotent-consumers-and-duplicate-message-handling-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A duplicate repeats a processed logical message, while an out-of-order message may be new but older or ahead of expected state. Include aggregate versions or sequence numbers. Ignore equal or older versions, apply the expected next version, and detect gaps for buffering or replay. Idempotency alone must not allow version 4 to overwrite version 5.

##### Key Points to Mention

- Ordering and deduplication are separate concerns.
- Partition by aggregate when sequence matters.
- Use conditional writes against the stored version.
- Do not rely on cross-machine timestamps for total ordering.

<!-- question:end:idempotent-consumers-and-duplicate-message-handling-intermediate-q03 -->

#### How should dead-letter messages be replayed safely?

<!-- question:start:idempotent-consumers-and-duplicate-message-handling-intermediate-q04 -->
<!-- question-id:idempotent-consumers-and-duplicate-message-handling-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Fix and verify the root cause, preserve original message and business IDs, confirm consumers and schemas are compatible, and ensure inbox retention still covers the messages. Replay at a bounded rate with monitoring and authorization. Do not assign fresh IDs merely to bypass deduplication, because that can repeat business effects.

##### Key Points to Mention

- Dead-letter queues require operational ownership.
- Old messages may violate current assumptions.
- Replay can overload downstream dependencies.
- Reconciliation should confirm the final business state.

<!-- question:end:idempotent-consumers-and-duplicate-message-handling-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you close the race between duplicate detection and business updates?

<!-- question:start:idempotent-consumers-and-duplicate-message-handling-advanced-q01 -->
<!-- question-id:idempotent-consumers-and-duplicate-message-handling-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use one database transaction containing both the business mutation and insertion of a deduplication key protected by a unique constraint. Handle the unique-conflict path as an already-processed outcome. Add optimistic concurrency or conditional updates for the domain entity. In-memory locks or a preliminary existence query alone cannot protect multiple instances or process restarts.

##### Key Points to Mention

- Two consumers can pass an existence check concurrently.
- The database constraint is the final arbiter.
- Transaction boundaries must include all local effects.
- Outgoing messages should be added to an outbox in that transaction.

<!-- question:end:idempotent-consumers-and-duplicate-message-handling-advanced-q01 -->

#### How do you choose deduplication keys and retention?

<!-- question:start:idempotent-consumers-and-duplicate-message-handling-advanced-q02 -->
<!-- question-id:idempotent-consumers-and-duplicate-message-handling-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use a transport message ID for repeated delivery and a stable business operation key where logically equivalent requests can have different messages. Scope keys by tenant, caller, operation, or consumer to prevent collisions. Retain them for at least the maximum broker retention, replay, retry, and business-operation horizon, or make the underlying operation independently idempotent if indefinite replay is possible.

##### Key Points to Mention

- Random IDs generated per retry are ineffective.
- Request fingerprints can detect key reuse with different input.
- Retention is a correctness decision, not only storage cleanup.
- Regulatory and privacy rules can constrain stored metadata.

<!-- question:end:idempotent-consumers-and-duplicate-message-handling-advanced-q02 -->

#### What does end-to-end exactly once require across multiple systems?

<!-- question:start:idempotent-consumers-and-duplicate-message-handling-advanced-q03 -->
<!-- question-id:idempotent-consumers-and-duplicate-message-handling-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

There is rarely one transaction covering broker, database, payment provider, email provider, and other services. End-to-end correctness uses local atomic transactions, outbox and inbox records, stable business keys, provider idempotency, conditional writes, bounded retries, and reconciliation. Exactly-once claims must identify the precise platform boundary and side effect they cover.

##### Key Points to Mention

- Broker exactly-once features do not govern external systems.
- Unknown outcomes require lookup and reconciliation.
- Some side effects can only be made effectively once.
- Business records should expose unresolved discrepancies.

<!-- question:end:idempotent-consumers-and-duplicate-message-handling-advanced-q03 -->

#### How would you test an idempotent consumer under realistic failures?

<!-- question:start:idempotent-consumers-and-duplicate-message-handling-advanced-q04 -->
<!-- question-id:idempotent-consumers-and-duplicate-message-handling-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Deliver the same message sequentially and concurrently, crash after the business commit but before acknowledgement, restart before commit, send a different message ID for the same business operation, reorder versions, expire inbox records, replay dead letters, and simulate external timeouts after possible success. Assert both final business state and emitted outbox messages, not only handler return values.

##### Key Points to Mention

- Fault injection exposes ambiguous commit windows.
- Integration tests need the real database constraints.
- Verify duplicates are acknowledged without extra effects.
- Monitor duplicate and reconciliation metrics during load tests.

<!-- question:end:idempotent-consumers-and-duplicate-message-handling-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
