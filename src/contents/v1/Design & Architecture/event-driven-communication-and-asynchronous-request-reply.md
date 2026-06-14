---
id: event-driven-communication-and-asynchronous-request-reply
topic: Distributed systems patterns
subtopic: Event-driven communication and asynchronous request-reply
category: Design & Architecture
---

## Overview

Event-driven communication allows components to react to facts or messages without requiring the producer and every consumer to be available at the same time. A broker, queue, topic, or event stream carries messages between independently deployed components.

An event describes something that already happened:

```text
OrderPlaced
PaymentAuthorized
InventoryAdjusted
```

An asynchronous command requests work:

```text
ReserveInventory
GenerateReport
SendWelcomeEmail
```

Asynchronous request-reply extends one-way messaging when a caller needs an eventual outcome. The caller submits work, receives an acknowledgement and correlation identifier, and obtains the result later through polling, a callback, a reply queue, a webhook, or a real-time channel.

Benefits include:

- Temporal decoupling.
- Load leveling.
- Independent scaling.
- Failure isolation.
- Extensibility through new subscribers.
- Support for long-running operations.

Costs include:

- Eventual consistency.
- Duplicate and out-of-order delivery.
- More difficult debugging.
- Contract evolution.
- Broker operations.
- Explicit retry, dead-letter, timeout, and cancellation behavior.

This topic matters in interviews because distributed systems rarely provide simple exactly-once, globally ordered behavior. Candidates must explain the message contract, ownership, delivery semantics, failure states, and user experience rather than saying only that a queue makes a system scalable.

## Core Concepts

### Events, Commands, and Messages

A **message** is the transport envelope.

A **command** asks one logical owner to perform an action:

```csharp
public sealed record ReserveInventory(
    Guid CommandId,
    Guid OrderId,
    IReadOnlyList<ReservationLine> Lines);
```

An **event** reports a completed fact:

```csharp
public sealed record InventoryReserved(
    Guid EventId,
    Guid OrderId,
    DateTimeOffset OccurredAt);
```

Useful semantic differences:

| Concern | Command | Event |
|---|---|---|
| Meaning | Request to perform work | Fact that occurred |
| Target | One logical handler | Zero or more subscribers |
| Naming | Imperative | Past tense |
| Rejection | Can be rejected | Fact should not be rejected |
| Ownership | Target owns decision | Publisher owns fact |

Do not disguise commands as events to create the appearance of loose coupling.

### Queue, Publish-Subscribe, and Event Stream

**Queue**

- Multiple consumers can compete for work.
- One logical consumer processes each message.
- Suitable for commands, jobs, and load leveling.

**Publish-subscribe topic**

- Each subscription receives a copy.
- Suitable for notifying independent consumers of events.
- Subscribers can have different retry and filtering policies.

**Event stream**

- Events are retained in an ordered log.
- Consumers track their own position.
- Replay and late consumers are supported.
- Ordering is normally scoped to a partition.

Choose based on delivery and retention needs, not product naming.

### Temporal and Spatial Decoupling

Synchronous call:

```text
Service A must know Service B's address.
Service B must be available now.
A waits for B's response.
```

Brokered message:

```text
A publishes to a stable destination.
B processes later.
A and B scale independently.
```

This reduces temporal coupling but introduces dependency on:

- The broker.
- Message contracts.
- Destination configuration.
- Eventual processing.
- Operational recovery.

The producer and consumer are still semantically coupled through the meaning of the message.

### Event Notification Versus Event-Carried State

A small notification can contain identifiers:

```json
{
  "type": "OrderPlaced",
  "orderId": "9af2...",
  "version": 7
}
```

The consumer fetches required data from the authoritative service.

Benefits:

- Small stable contracts.
- Less duplicated data.
- Current data can be fetched.

Costs:

- Extra synchronous dependency.
- The data may change before retrieval.
- Replay may not reproduce historical state.

An event-carried state transfer includes consumer-relevant values:

```json
{
  "type": "OrderPlaced",
  "orderId": "9af2...",
  "customerId": "c103...",
  "total": 149.50,
  "currency": "USD",
  "version": 7
}
```

This improves consumer autonomy but increases payload, privacy, duplication, and contract-evolution concerns.

### Event Envelope

A consistent envelope can include:

```csharp
public sealed record IntegrationEvent<T>(
    Guid MessageId,
    string Type,
    int SchemaVersion,
    DateTimeOffset OccurredAt,
    string CorrelationId,
    string? CausationId,
    string Producer,
    T Data);
```

Common metadata:

- Unique message ID.
- Event or command type.
- Schema version.
- Occurrence time.
- Correlation ID.
- Causation ID.
- Tenant or partition key when appropriate.
- Trace context.
- Producer identity.

Avoid placing secrets or unnecessary personal data in headers or payloads.

### Delivery Semantics

Common delivery models are:

**At most once**

- A message may be lost.
- It is not redelivered.

**At least once**

- The broker retries when acknowledgement is uncertain.
- A message can be processed more than once.
- Consumers must be idempotent.

**Exactly once**

- Usually scoped to a broker operation or tightly defined transactional boundary.
- Does not automatically make external side effects exactly once.

If a consumer commits to a database and crashes before acknowledging the broker, redelivery is expected. Design for it.

### Acknowledgement and Settlement

Typical consumer flow:

```text
receive message
validate envelope
perform local transaction
commit durable state
acknowledge message
```

Acknowledging before durable work risks message loss. Acknowledging after work permits duplicate delivery when the acknowledgement is lost.

Broker settlement options commonly include:

- Complete or acknowledge.
- Abandon or retry.
- Defer.
- Dead-letter.

The handler should classify transient failures, permanent validation failures, and business rejections deliberately.

### Reliable Publication

A database update followed by publication creates a dual-write problem:

```text
commit succeeds
publish fails
```

The transactional outbox stores the outgoing message with the business update in one local transaction. A publisher sends outbox records later.

The reverse problem occurs on consumption:

```text
message processed
database commit succeeds
acknowledgement fails
```

An inbox or processed-message record can make consumer effects idempotent.

### Ordering

Global ordering is expensive and often unnecessary.

Most systems guarantee order only:

- Within one queue.
- Within one partition.
- Within a session or key.
- Under restricted concurrency.

Choose a partition key such as `OrderId` when events for one aggregate must be ordered.

Consumers should use versions:

```csharp
if (message.OrderVersion <= projection.OrderVersion)
{
    return;
}

if (message.OrderVersion != projection.OrderVersion + 1)
{
    throw new MissingMessageException();
}
```

Do not assume timestamps from different machines establish reliable total order.

### Schema Evolution

Messages outlive deployments and may be replayed.

Safe evolution practices:

- Add optional fields with defaults.
- Avoid changing the meaning of existing fields.
- Keep stable type identifiers.
- Version incompatible contracts.
- Run old and new consumers during migration.
- Preserve old schemas for retained messages.
- Test producers and consumers independently.

Do not expose internal entity serialization as an integration contract. Internal refactoring should not break every consumer.

### Consumer Independence

An event publisher should not know:

- How many consumers exist.
- Which database they use.
- Whether they send email, update search, or calculate analytics.
- Whether they are currently online.

Each consumer owns:

- Its subscription.
- Retry and dead-letter policy.
- Idempotency.
- Storage transaction.
- Scaling.
- Monitoring.

A slow analytics consumer should not block an order-confirmation consumer.

### Backpressure and Load Leveling

A queue buffers bursts:

```text
producer rate temporarily > consumer rate
    -> queue depth grows
    -> consumers process at controlled rate
```

This protects downstream systems only if consumer scaling and concurrency are bounded. Unrestricted autoscaling can move the overload from the broker to the database.

Monitor:

- Queue depth.
- Oldest-message age.
- Arrival rate.
- Completion rate.
- Processing duration.
- Retry and dead-letter counts.
- Downstream saturation.

If the long-term producer rate exceeds capacity, the queue only delays failure.

### Poison Messages and Dead-Letter Queues

A message can fail permanently because it is:

- Malformed.
- Incompatible with the schema.
- Missing required referenced data.
- Violating a business rule.
- Triggering a reproducible software defect.

After bounded attempts, move it to a dead-letter queue instead of retrying forever.

Dead-letter handling needs:

- Alerts.
- Reason and diagnostic metadata.
- Safe inspection tooling.
- Repair or replay procedures.
- Retention policy.
- Authorization and privacy controls.

A dead-letter queue is not a successful terminal state; it is operational debt requiring ownership.

### Asynchronous HTTP Request-Reply

For long-running work:

```http
POST /reports
Idempotency-Key: 5ad9...
```

The server validates and accepts the operation:

```http
HTTP/1.1 202 Accepted
Location: /operations/7c42...
Retry-After: 5
```

The client polls:

```http
GET /operations/7c42...
```

Pending response:

```json
{
  "status": "Running",
  "createdAt": "2026-06-14T08:00:00Z",
  "lastUpdatedAt": "2026-06-14T08:00:12Z",
  "percentComplete": 60
}
```

Completed response can:

- Include the result.
- Link to the created resource.
- Return `303 See Other` to the result resource.

`202 Accepted` means accepted for processing, not completed successfully.

### Operation Resource Design

An operation resource should define states such as:

```text
Pending
Running
Succeeded
Failed
Canceled
```

It should include:

- Operation ID.
- Current state.
- Creation and update times.
- Progress when meaningful.
- Result link.
- Structured failure details.
- Expiration or retention.

Security requirements:

- Authorize access to the operation.
- Avoid predictable cross-user identifiers without authorization.
- Do not leak internal exception details.
- Apply polling rate limits.
- Clean up old operation records.

### Idempotent Submission

The client may retry because it did not receive the `202` response.

Use an idempotency key:

```text
Client request + stable idempotency key
    -> first call creates operation
    -> duplicate call returns same operation
```

Store:

- Caller scope.
- Endpoint or operation type.
- Request fingerprint when useful.
- Operation ID.
- Result or status.
- Expiration.

The same key with a materially different request should be rejected rather than silently reusing the old result.

### Broker-Based Request-Reply

Service-to-service request-reply can use:

- Request queue.
- Reply queue or topic.
- Correlation ID.
- Reply destination.
- Deadline.

```csharp
public sealed record PriceQuoteRequest(
    Guid RequestId,
    Guid ProductId,
    int Quantity,
    string ReplyTo);
```

The requester stores pending correlation state, sends the request, and waits asynchronously for a matching reply.

Risks include:

- Reply arriving after timeout.
- Duplicate replies.
- Requester restart.
- Unbounded pending state.
- Reply queue buildup.
- Coupling that disguises a synchronous dependency.

If the caller cannot make progress without an immediate response, a normal synchronous call may be simpler.

### Callbacks, Webhooks, and Real-Time Channels

Alternatives to polling:

**Webhook**

- Server calls a client-provided endpoint.
- Requires endpoint verification, authentication, retries, and SSRF protection.

**WebSocket or SignalR**

- Server pushes progress over an established channel.
- Requires connection lifecycle and authorization design.

**Reply queue**

- Works well for broker-connected services.
- Requires correlation and expiry.

Polling remains practical for browser clients because it is simple and firewall-friendly.

### Cancellation and Timeouts

Cancellation is a business operation, not merely cancellation of one thread.

Expose:

```http
DELETE /operations/7c42...
```

Define:

- Whether cancellation is best effort.
- Which steps are still reversible.
- Whether compensation is required.
- What happens if completion races with cancellation.
- The final observable state.

Every request message should carry or imply a deadline. A consumer should avoid starting obsolete work after the caller's business deadline has passed.

### Observability

Propagate:

- Correlation ID across the workflow.
- Causation ID from triggering message to emitted messages.
- Distributed trace context.
- Business operation ID.

Record:

- Publish and receive time.
- Processing duration.
- Attempts.
- Settlement.
- Operation state transitions.
- Projection or consumer lag.

Logs alone are not enough. Metrics and traces must expose stuck workflows, growing backlog, repeated retries, and dead-lettered messages.

### Security

Messaging security includes:

- Producer and consumer workload identity.
- Destination-level authorization.
- Encryption in transit and at rest.
- Tenant isolation.
- Payload minimization.
- Schema validation.
- Replay and duplicate controls.
- Secret-free telemetry.
- Restricted dead-letter access.

Treat messages as untrusted input even when they arrive from an internal broker.

### When Event-Driven Communication Makes Sense

Use it when:

- Multiple independent consumers react to a fact.
- Producers and consumers need independent availability and scaling.
- Work is naturally asynchronous.
- Bursts require buffering.
- Replay or event-stream processing is valuable.
- Eventual consistency is acceptable.

Avoid it when:

- The workflow needs immediate strong consistency.
- One simple synchronous call is clearer.
- The team lacks operational support for brokers and asynchronous failures.
- The "event" is really a tightly coupled remote procedure call with extra latency.

### Common Mistakes

Common failures include:

- Using events as hidden commands.
- Assuming exactly-once end-to-end processing.
- Publishing database changes without an outbox.
- Acknowledging before durable work.
- Retrying permanent failures forever.
- Depending on global ordering.
- Sending entire internal entities as contracts.
- Omitting idempotency and correlation IDs.
- Returning `202` without a usable status resource.
- Polling too aggressively.
- Ignoring cancellation, expiry, and cleanup.
- Autoscaling consumers until the database fails.
- Leaving dead-letter queues unmonitored.

### Best-Practice Decision Process

1. Decide whether the message is a command, event, or reply.
2. Select queue, pub/sub, or stream semantics deliberately.
3. Define ownership, schema, identity, and versioning.
4. Choose an explicit delivery and ordering model.
5. Use outbox publication and idempotent consumers.
6. Bound retries and own dead-letter recovery.
7. Define consistency, timeout, cancellation, and user experience.
8. For HTTP, use `202`, `Location`, `Retry-After`, and an authorized operation resource.
9. Correlate every step and monitor backlog age and business completion.
10. Load-test downstream limits, not only broker throughput.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is event-driven architecture?

<!-- question:start:event-driven-communication-and-asynchronous-request-reply-beginner-q01 -->
<!-- question-id:event-driven-communication-and-asynchronous-request-reply-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Event-driven architecture lets producers publish facts about completed state changes and lets independent consumers react asynchronously. A broker, topic, or stream decouples producer availability and scaling from consumers. The trade-offs are eventual consistency, duplicate and out-of-order delivery, contract management, and more complex monitoring and recovery.

##### Key Points to Mention

- Producers do not call every subscriber directly.
- New consumers can be added independently.
- Events are facts, not requests.
- Consumers need explicit failure and idempotency behavior.

<!-- question:end:event-driven-communication-and-asynchronous-request-reply-beginner-q01 -->

#### What is the difference between a command and an event?

<!-- question:start:event-driven-communication-and-asynchronous-request-reply-beginner-q02 -->
<!-- question-id:event-driven-communication-and-asynchronous-request-reply-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A command asks one logical owner to perform an action and can be accepted or rejected. An event reports a fact that the publishing service has already committed, and zero or more subscribers may react. Commands use imperative names such as `ReserveInventory`; events use past-tense names such as `InventoryReserved`.

##### Key Points to Mention

- Commands have an intended handler.
- Events should not ask consumers to make the publisher's decision.
- The publisher owns the truth of an event.
- Clear semantics reduce hidden coupling.

<!-- question:end:event-driven-communication-and-asynchronous-request-reply-beginner-q02 -->

#### What is asynchronous request-reply?

<!-- question:start:event-driven-communication-and-asynchronous-request-reply-beginner-q03 -->
<!-- question-id:event-driven-communication-and-asynchronous-request-reply-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

It is a pattern where a caller submits work, receives an acknowledgement and correlation identifier, and receives or retrieves the final result later. Over HTTP, the server commonly returns `202 Accepted` with a status URL. Over messaging, a reply queue and correlation ID can connect the eventual reply to the original request.

##### Key Points to Mention

- Acceptance is not successful completion.
- The operation needs explicit pending and terminal states.
- Polling, callbacks, push, and reply queues are options.
- Timeouts, cancellation, and duplicate submission must be defined.

<!-- question:end:event-driven-communication-and-asynchronous-request-reply-beginner-q03 -->

#### What is the difference between a queue and a publish-subscribe topic?

<!-- question:start:event-driven-communication-and-asynchronous-request-reply-beginner-q04 -->
<!-- question-id:event-driven-communication-and-asynchronous-request-reply-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A queue normally distributes each message to one logical consumer among competing workers, making it suitable for commands and jobs. A publish-subscribe topic creates independent deliveries for subscriptions, making it suitable for events consumed by multiple components. Each subscription owns its retries, backlog, and dead-letter behavior.

##### Key Points to Mention

- Queues load-balance work.
- Topics fan out facts.
- Event streams add durable replay and consumer-managed positions.
- Product terminology should not replace semantic analysis.

<!-- question:end:event-driven-communication-and-asynchronous-request-reply-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How should an HTTP API represent a long-running operation?

<!-- question:start:event-driven-communication-and-asynchronous-request-reply-intermediate-q01 -->
<!-- question-id:event-driven-communication-and-asynchronous-request-reply-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Validate and authorize the request, persist or enqueue the operation, then return `202 Accepted` with a `Location` status URL and a reasonable `Retry-After`. The status resource should expose documented pending and terminal states, timestamps, progress when meaningful, result links, structured errors, cancellation semantics, authorization, and retention. A completed operation can redirect with `303 See Other`.

##### Key Points to Mention

- Do not return `202` before reliably accepting the work.
- Protect the status resource from cross-user access.
- Idempotency keys prevent duplicate submissions.
- Polling and operation records need rate and retention limits.

<!-- question:end:event-driven-communication-and-asynchronous-request-reply-intermediate-q01 -->

#### How do you reliably publish an event after a database transaction?

<!-- question:start:event-driven-communication-and-asynchronous-request-reply-intermediate-q02 -->
<!-- question-id:event-driven-communication-and-asynchronous-request-reply-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use a transactional outbox: write the business state and outgoing message record in the same local database transaction. A background publisher sends unsent records and marks progress. This avoids losing an event after the business commit, but publication can repeat, so stable message IDs and idempotent consumers remain necessary.

##### Key Points to Mention

- Database and broker writes are otherwise a dual-write problem.
- Monitor outbox age and publication failures.
- Retain enough history for audit and retry.
- Do not assume the outbox creates exactly-once side effects.

<!-- question:end:event-driven-communication-and-asynchronous-request-reply-intermediate-q02 -->

#### How should message schema evolution be handled?

<!-- question:start:event-driven-communication-and-asynchronous-request-reply-intermediate-q03 -->
<!-- question-id:event-driven-communication-and-asynchronous-request-reply-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Treat messages as versioned integration contracts. Prefer additive optional fields and stable semantics, version incompatible changes, support overlapping producer and consumer deployments, and preserve schemas needed for retained or replayed messages. Use contract tests and avoid serializing internal domain or persistence entities directly.

##### Key Points to Mention

- Messages can outlive the code that produced them.
- Producers and consumers deploy independently.
- Removing or reinterpreting fields is risky.
- Privacy and deletion requirements apply to retained payloads.

<!-- question:end:event-driven-communication-and-asynchronous-request-reply-intermediate-q03 -->

#### How do queues provide load leveling without merely moving overload downstream?

<!-- question:start:event-driven-communication-and-asynchronous-request-reply-intermediate-q04 -->
<!-- question-id:event-driven-communication-and-asynchronous-request-reply-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

The queue absorbs short arrival bursts while consumers process at a controlled rate. Consumer concurrency and autoscaling must be capped according to database and dependency capacity. Monitor oldest-message age and arrival versus completion rate. If sustained production exceeds safe consumption, apply backpressure, admission limits, prioritization, or load shedding rather than allowing unbounded backlog.

##### Key Points to Mention

- Queue depth alone does not show latency.
- Unbounded autoscaling can overload the database.
- Bounded queues and dead-letter handling are required.
- Load-test the whole processing path.

<!-- question:end:event-driven-communication-and-asynchronous-request-reply-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design broker-based request-reply for resilient services?

<!-- question:start:event-driven-communication-and-asynchronous-request-reply-advanced-q01 -->
<!-- question-id:event-driven-communication-and-asynchronous-request-reply-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use a stable request ID, correlation ID, reply destination, deadline, and idempotency key. Persist pending state before sending, publish reliably through an outbox, and make both request and reply handlers idempotent. Expire abandoned requests and late replies, define duplicate and timeout behavior, authorize destinations, and restore pending correlation after requester restarts. Avoid this pattern when the caller is simply blocking for a fast mandatory response.

##### Key Points to Mention

- Pending in-memory tasks alone are lost on restart.
- Replies can arrive late, more than once, or out of order.
- Correlation state needs bounded retention.
- Asynchronous transport does not remove semantic coupling.

<!-- question:end:event-driven-communication-and-asynchronous-request-reply-advanced-q01 -->

#### How do you reason about ordering in an event-driven system?

<!-- question:start:event-driven-communication-and-asynchronous-request-reply-advanced-q02 -->
<!-- question-id:event-driven-communication-and-asynchronous-request-reply-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Define the smallest scope that requires order, usually one aggregate or business key, and route that key to one partition or session. Include aggregate versions, reject or buffer gaps, and ignore older duplicates. Avoid global ordering because it limits throughput and availability. Design independent or commutative operations to tolerate reordering where possible.

##### Key Points to Mention

- Broker order is normally partition-scoped.
- Parallel consumers can change completion order.
- Wall-clock timestamps are not a reliable total order.
- Reprocessing must preserve the same ordering assumptions.

<!-- question:end:event-driven-communication-and-asynchronous-request-reply-advanced-q02 -->

#### What does exactly-once processing mean in practice?

<!-- question:start:event-driven-communication-and-asynchronous-request-reply-advanced-q03 -->
<!-- question-id:event-driven-communication-and-asynchronous-request-reply-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Exactly-once claims are scoped to a specific platform and transaction boundary. A broker may deduplicate sends or atomically advance a stream offset with a broker-managed output, but it cannot automatically make an external payment, email, database, or third-party API side effect exactly once. End-to-end systems usually combine at-least-once delivery with idempotent operations, deduplication records, transactional writes, and reconciliation.

##### Key Points to Mention

- Clarify exactly once for which state and boundary.
- Lost acknowledgements create ambiguity.
- External systems need their own idempotency keys.
- Business reconciliation remains important.

<!-- question:end:event-driven-communication-and-asynchronous-request-reply-advanced-q03 -->

#### How would you operate and troubleshoot an event-driven workflow end to end?

<!-- question:start:event-driven-communication-and-asynchronous-request-reply-advanced-q04 -->
<!-- question-id:event-driven-communication-and-asynchronous-request-reply-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Propagate trace context, correlation IDs, causation IDs, message IDs, and business operation IDs. Measure publish failures, outbox age, queue depth, oldest-message age, processing latency, attempts, dead-letter volume, and business completion. Provide message inspection, safe replay, quarantine, and reconciliation tools. Dashboards should show where a workflow stopped rather than only whether each service is running.

##### Key Points to Mention

- Infrastructure health does not prove business convergence.
- Logs must avoid sensitive payload exposure.
- Replay tooling needs authorization and idempotency safeguards.
- Define ownership for dead letters and stuck operations.

<!-- question:end:event-driven-communication-and-asynchronous-request-reply-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
