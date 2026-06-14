---
id: saga-and-compensating-transaction-patterns
topic: Distributed systems patterns
subtopic: Saga and compensating transaction patterns
category: Design & Architecture
---

## Overview

A saga coordinates a business operation that spans multiple services or data stores without relying on one distributed ACID transaction.

The operation is divided into local transactions:

```text
Create order
    -> reserve inventory
    -> authorize payment
    -> arrange shipment
```

Each service commits its own state independently. If a later step cannot complete, the workflow executes compensating actions for completed steps:

```text
release inventory
void or refund payment
cancel order
```

A compensating action is not a technical rollback of a previously committed transaction. It is a new business operation that attempts to restore an acceptable state while respecting concurrent changes and real-world side effects.

Sagas usually use:

- **Choreography:** participants react to events without a central coordinator.
- **Orchestration:** a durable coordinator sends commands and records workflow state.

The pattern supports eventual consistency and service autonomy, but introduces partial states, concurrency anomalies, retry and idempotency requirements, complex monitoring, and cases that need manual intervention.

This topic matters in interviews because candidates must reason about business semantics under failure. Strong answers identify which steps are compensable, which are retryable, where the point of no return occurs, and how the system recovers after process crashes, duplicate messages, timeouts, and failed compensation.

## Core Concepts

### Why Distributed Transactions Are Difficult

Inside one database transaction, the database can provide:

- Atomicity.
- Consistency.
- Isolation.
- Durability.

Across independently owned services:

- Each service has a separate database.
- Services fail independently.
- Networks delay, duplicate, or lose acknowledgements.
- One service cannot directly roll back another service's commit.
- Long-running locks reduce availability.

Two-phase commit can provide stronger coordination in limited environments, but it increases coupling, coordinator dependency, lock duration, and operational constraints. Many cloud and microservice systems instead use local transactions plus eventual consistency.

### Saga Structure

A saga is a persistent state machine:

```text
Started
  -> InventoryReserved
  -> PaymentAuthorized
  -> ShipmentScheduled
  -> Completed
```

Failure path:

```text
PaymentDeclined
  -> ReleaseInventory
  -> CancelOrder
  -> Compensated
```

The saga must record:

- Saga or business-operation ID.
- Current state.
- Completed steps.
- Pending command.
- Attempts and deadlines.
- Data needed for compensation.
- Failure details.
- Final outcome.

In-memory control flow is not sufficient because the process can restart between steps.

### Local Transactions

Each participant performs one atomic local transaction:

```csharp
public async Task Handle(
    ReserveInventory command,
    CancellationToken cancellationToken)
{
    await using var transaction =
        await db.Database.BeginTransactionAsync(cancellationToken);

    var reservation = InventoryReservation.Create(
        command.ReservationId,
        command.OrderId,
        command.Lines);

    db.Reservations.Add(reservation);
    db.OutboxMessages.Add(
        OutboxMessage.From(new InventoryReserved(
            command.MessageId,
            command.OrderId,
            reservation.Id)));

    await db.SaveChangesAsync(cancellationToken);
    await transaction.CommitAsync(cancellationToken);
}
```

The state change and outgoing message are recorded together. A separate outbox publisher delivers the event.

### Compensating Transactions

Compensation applies business logic that offsets a completed action.

Examples:

| Forward action | Possible compensation |
|---|---|
| Reserve stock | Release reservation |
| Authorize card | Void authorization |
| Capture payment | Issue refund |
| Book flight | Cancel booking under fare rules |
| Create account | Disable or close account |
| Send parcel | Request return or intercept |

Compensation may:

- Have fees.
- Be partial.
- Be delayed.
- Require approval.
- Be impossible after a deadline.
- Produce a different final state from the original state.

The goal is a valid business outcome, not byte-for-byte restoration.

### Compensation Data

The workflow must retain enough information to compensate safely:

- External transaction IDs.
- Reservation IDs.
- Original amounts and currencies.
- Terms or policy version.
- Actor and tenant.
- Timestamps and deadlines.
- Idempotency keys.
- Which forward step committed.

Do not reconstruct compensation solely from current mutable data. Concurrent changes may have occurred.

### Compensable, Pivot, and Retryable Steps

Saga steps can be classified as:

**Compensable**

- Can be undone through a business operation.
- Usually placed before the point of no return.

**Pivot**

- The point after which the workflow is committed to completing.
- May be the last compensable step or first irreversible step.

**Retryable**

- Must eventually succeed after the pivot.
- Designed to be safely retried.

Example:

```text
Reserve inventory       -> compensable
Authorize payment       -> compensable
Capture nonrefundable payment -> pivot
Create fulfillment task -> retryable
Send confirmation       -> retryable or best effort
```

Place irreversible actions as late as possible after validations and reservations succeed.

### Choreography

In choreography, each service reacts to events:

```text
Order service publishes OrderCreated
Inventory service publishes InventoryReserved
Payment service publishes PaymentAuthorized
Shipping service publishes ShipmentScheduled
```

Benefits:

- No separate central coordinator.
- Participants remain autonomous.
- Simple flows can be easy to extend.

Costs:

- Workflow is distributed across subscriptions.
- Cyclic dependencies can emerge.
- It is harder to see the current saga state.
- Changes may require coordinated understanding across teams.
- Failure and compensation paths become difficult to reason about.

Choreography works best for short, loosely connected flows with few participants.

### Orchestration

An orchestrator owns workflow state and sends commands:

```text
Orchestrator -> ReserveInventory
Inventory    -> InventoryReserved
Orchestrator -> AuthorizePayment
Payment      -> PaymentAuthorized
Orchestrator -> ScheduleShipment
```

Benefits:

- The process is explicit.
- State and timeout handling are centralized.
- Complex branching is easier to understand.
- Participants do not need to know the entire workflow.

Costs:

- The orchestrator adds infrastructure and code.
- It can become too coupled to participant internals.
- Its state store and processing must be highly reliable.
- Poor design can create a central business-logic monolith.

The orchestrator coordinates; each service still owns its local rules and transaction.

### Durable Orchestration

A durable workflow engine or explicit saga state store should persist progress before waiting for external work.

Conceptual state:

```csharp
public sealed class OrderSagaState
{
    public Guid SagaId { get; init; }
    public Guid OrderId { get; init; }
    public OrderSagaStatus Status { get; set; }
    public Guid? InventoryReservationId { get; set; }
    public string? PaymentAuthorizationId { get; set; }
    public int Version { get; set; }
    public DateTimeOffset Deadline { get; set; }
}
```

State transitions should be:

- Persisted atomically with outgoing commands.
- Idempotent.
- Protected by optimistic concurrency or partitioned serialization.
- Observable.
- Recoverable after restart.

### Timeouts and Unknown Outcomes

A timeout does not prove that a remote action failed:

```text
Payment service committed authorization.
Reply was delayed or lost.
Orchestrator timed out.
```

Before compensating or retrying:

- Use a stable idempotency key.
- Query the participant's operation status if supported.
- Classify timeout as an unknown outcome.
- Avoid issuing a second independent charge.

Timeout policy is part of business semantics:

- How long is inventory held?
- When does the customer see failure?
- Can the operation continue after a late response?
- Which side owns expiration?

### Retries

Retry transient failures before compensating when safe:

```text
temporary network failure -> retry with backoff
business rejection        -> do not retry unchanged request
unknown outcome           -> reconcile by idempotency key
permanent validation error -> fail and compensate
```

Use:

- Bounded retries.
- Exponential backoff with jitter.
- Deadlines.
- Circuit breakers.
- Idempotent commands.
- Dead-letter or manual review after exhaustion.

Unbounded retries can keep a saga stuck forever and overload a failing participant.

### Idempotent Saga Steps

Every forward and compensation command may be delivered more than once.

Example:

```csharp
public async Task ReleaseReservation(
    ReleaseInventory command,
    CancellationToken cancellationToken)
{
    var reservation = await db.Reservations
        .SingleOrDefaultAsync(
            x => x.Id == command.ReservationId,
            cancellationToken);

    if (reservation is null || reservation.Status == Released)
    {
        return;
    }

    reservation.Release(command.Reason);
    await db.SaveChangesAsync(cancellationToken);
}
```

Business idempotency may require storing the operation ID, not merely checking current state.

### Compensation Can Fail

Compensation is another distributed workflow and can fail because:

- The participant is unavailable.
- The external transaction is no longer reversible.
- Policy or state changed.
- The compensation message is duplicated.
- A software defect occurs.

The system needs:

- Retries and idempotency.
- Durable compensation progress.
- Alerts and escalation.
- Manual repair tools.
- Reconciliation reports.
- A visible state such as `CompensationPending`.

Do not report the business operation as fully canceled while compensation remains incomplete.

### Isolation Anomalies

Sagas do not provide database-style isolation across services.

Possible anomalies:

- **Dirty read:** another workflow reads tentative saga state.
- **Lost update:** concurrent sagas overwrite each other's effects.
- **Nonrepeatable read:** a value changes between steps.
- **Overselling:** multiple sagas reserve the same limited resource.

Mitigations include:

- Semantic locks or pending states.
- Optimistic versions.
- Conditional writes.
- Reservations with expiry.
- Commutative operations.
- Reordering risky steps.
- Rereading before commit.
- Partitioning by aggregate key.
- Escrow or quota allocation.

The correct technique depends on the business invariant.

### Semantic Locks and Pending States

A semantic lock marks a resource as participating in an incomplete saga:

```text
Order.Status = PendingPayment
```

Other operations can:

- Reject changes.
- Queue behind the saga.
- Allow only safe actions.
- Display the pending state.

Unlike a long database lock, the semantic state survives process restarts and is visible to business logic. It needs timeout and repair behavior to avoid permanent limbo.

### Reservation Pattern

Reserve scarce resources before irreversible commitment:

```text
hold inventory for 10 minutes
authorize payment
confirm inventory deduction
capture payment
```

Reservations should define:

- Expiration.
- Ownership.
- Quantity.
- Confirmation.
- Release.
- Renewal.
- Idempotency.

Expired reservations and late messages must be handled consistently.

### Choreography Versus Orchestration Decision

Prefer choreography when:

- The flow is simple and short.
- Services react independently to facts.
- No participant needs the complete process state.
- Adding a consumer should not change the producer.

Prefer orchestration when:

- The process has many steps or branches.
- Timeouts and compensation are complex.
- The current business status must be visible.
- Central audit and operational control are important.
- Participants should not know the whole workflow.

Hybrid designs are common. Use events for broad notification and an orchestrator for one complex business transaction.

### Human Intervention

Some failures need a person:

- A refund exceeds an automated limit.
- A travel reservation has changed fare rules.
- A shipment already left the warehouse.
- Customer choice is preferable to automatic cancellation.

The workflow should:

- Enter an explicit review state.
- Preserve all relevant context.
- Assign an owner and deadline.
- Prevent conflicting automated actions.
- Audit the decision.
- Resume deterministically.

Manual intervention should be designed, not improvised from logs and database edits.

### Observability

Track:

- Saga ID and business ID.
- Current state and version.
- Step start and completion times.
- Command, event, and causation IDs.
- Attempts and deadlines.
- Compensation status.
- Stuck-state age.
- Manual-review queue.

Useful metrics:

- Completion rate and duration.
- Compensation rate.
- Compensation failure rate.
- Time spent in each state.
- Timeout and retry count.
- Number of sagas past deadline.

Distributed traces should connect participant calls, but durable saga state is the authoritative operational record.

### Testing Sagas

Test:

- Every successful path.
- Each step failing before commit.
- Commit succeeding but reply being lost.
- Duplicate commands and events.
- Out-of-order responses.
- Process restart after every transition.
- Timeout and late completion races.
- Compensation failure and retry.
- Concurrent sagas on the same resource.
- Manual intervention and resume.

State-machine tests can assert valid transitions independently from transport. Integration tests verify outbox, broker, and participant behavior.

### When to Use a Saga

Use a saga when:

- One business operation spans independently owned transactional boundaries.
- Temporary inconsistency is acceptable.
- Business compensation can restore a valid outcome.
- Services need autonomy and cannot share one database transaction.
- The organization can operate durable workflows and reconciliation.

### When Not to Use a Saga

Avoid it when:

- The data belongs in one service and one local transaction.
- Strong isolation is required throughout.
- Compensation cannot produce an acceptable state.
- The workflow is simple enough for one synchronous operation.
- A retry alone handles the only realistic failure.
- Service boundaries were split artificially.

Sometimes the best solution is to redraw the service boundary so the invariant fits inside one transaction.

### Common Mistakes

Common failures include:

- Calling compensation a rollback.
- Not persisting workflow progress.
- Publishing events outside local transactions.
- Compensating on every transient timeout.
- Omitting idempotency from forward and reverse steps.
- Placing irreversible actions too early.
- Assuming compensation always succeeds.
- Hiding intermediate states from users and support.
- Using choreography for a workflow no one can understand.
- Moving domain logic into a central orchestrator.
- Ignoring concurrent sagas and isolation anomalies.
- Lacking reconciliation and manual repair tools.

### Best-Practice Design Process

1. Confirm the operation truly spans independent transaction boundaries.
2. Define the successful and acceptable failure outcomes.
3. List local transactions and owning services.
4. Classify each step as compensable, pivot, retryable, or best effort.
5. Define idempotency keys, timeouts, and unknown-outcome reconciliation.
6. Choose choreography or orchestration based on workflow complexity.
7. Persist state and use outbox/inbox patterns.
8. Model concurrency and intermediate-state visibility.
9. Design compensation failure and human intervention.
10. Test crashes, duplicates, late messages, and every failure point.
11. Monitor business completion and reconciliation, not only broker health.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the Saga pattern?

<!-- question:start:saga-and-compensating-transaction-patterns-beginner-q01 -->
<!-- question-id:saga-and-compensating-transaction-patterns-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A saga coordinates a business operation across multiple services as a sequence of local transactions. Each participant commits independently and triggers the next step. If a later step fails, compensating business actions offset completed steps so the system eventually reaches a valid outcome without one distributed ACID transaction.

##### Key Points to Mention

- Sagas provide eventual consistency, not global atomicity.
- Each service owns its local transaction.
- Messages and workflow state must survive failures.
- Forward and compensation steps must be idempotent.

<!-- question:end:saga-and-compensating-transaction-patterns-beginner-q01 -->

#### What is a compensating transaction?

<!-- question:start:saga-and-compensating-transaction-patterns-beginner-q02 -->
<!-- question-id:saga-and-compensating-transaction-patterns-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A compensating transaction is a new business operation that offsets the effect of a previously committed step, such as releasing inventory or refunding a payment. It is not a database rollback and may be partial, delayed, fee-bearing, or unable to restore the exact original state. It must account for concurrent work and current business rules.

##### Key Points to Mention

- Compensation occurs after the original commit.
- Reverse order is not always required.
- Compensation can fail and need retries or manual action.
- Preserve the identifiers and facts needed to compensate.

<!-- question:end:saga-and-compensating-transaction-patterns-beginner-q02 -->

#### What is the difference between saga choreography and orchestration?

<!-- question:start:saga-and-compensating-transaction-patterns-beginner-q03 -->
<!-- question-id:saga-and-compensating-transaction-patterns-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

In choreography, services react to each other's events without a central coordinator. It suits simple flows but can hide the overall workflow and create cyclic dependencies. In orchestration, a durable coordinator records state and sends commands to participants. It makes complex branching, timeouts, and compensation clearer but adds a central workflow component.

##### Key Points to Mention

- Choreography distributes control.
- Orchestration makes process state explicit.
- Participants still own local business rules.
- Hybrid approaches are common.

<!-- question:end:saga-and-compensating-transaction-patterns-beginner-q03 -->

#### When should a saga not be used?

<!-- question:start:saga-and-compensating-transaction-patterns-beginner-q04 -->
<!-- question-id:saga-and-compensating-transaction-patterns-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Do not use a saga when the invariant can and should be enforced inside one service and one database transaction, when temporary inconsistency is unacceptable, or when no meaningful compensation exists. A saga is also unnecessary when a bounded retry solves the failure or the workflow is simple and synchronous.

##### Key Points to Mention

- Reconsider service boundaries first.
- Sagas add significant operational complexity.
- Compensation must produce an acceptable business result.
- Strong isolation requirements may need another design.

<!-- question:end:saga-and-compensating-transaction-patterns-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How should saga steps be classified and ordered?

<!-- question:start:saga-and-compensating-transaction-patterns-intermediate-q01 -->
<!-- question-id:saga-and-compensating-transaction-patterns-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Classify steps as compensable, pivot, retryable, or best effort. Place validations and reversible reservations first, put irreversible or externally committed work as late as possible, and ensure post-pivot steps are retryable and idempotent. Order compensation according to business risk rather than blindly reversing the forward list.

##### Key Points to Mention

- The pivot is the point of no return.
- Retryable steps help the saga complete after the pivot.
- Sensitive inconsistencies may determine compensation order.
- Business semantics drive classification.

<!-- question:end:saga-and-compensating-transaction-patterns-intermediate-q01 -->

#### How should a saga handle a timeout with an unknown remote outcome?

<!-- question:start:saga-and-compensating-transaction-patterns-intermediate-q02 -->
<!-- question-id:saga-and-compensating-transaction-patterns-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Treat a timeout as uncertainty, not proof of failure. Retry with the same idempotency key or query the participant by operation ID to discover whether it committed. Only compensate after the outcome is known or a business deadline defines the result. Persist the deadline and handle late replies so they cannot incorrectly advance or reverse a completed saga.

##### Key Points to Mention

- Lost replies are common in distributed systems.
- New operation IDs can create duplicate charges or reservations.
- Reconciliation is required for ambiguous outcomes.
- Late responses need explicit state-machine rules.

<!-- question:end:saga-and-compensating-transaction-patterns-intermediate-q02 -->

#### How do you make an orchestrated saga durable?

<!-- question:start:saga-and-compensating-transaction-patterns-intermediate-q03 -->
<!-- question-id:saga-and-compensating-transaction-patterns-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Persist the saga state, completed steps, version, deadlines, and compensation data. Atomically record each state transition with its outgoing command through an outbox. Use optimistic concurrency or key-based serialization, idempotent handlers, bounded retries, and durable timers. On restart, the orchestrator resumes from persisted state rather than reconstructing progress from memory.

##### Key Points to Mention

- Workflow state is business data.
- Sending and state transition form a dual-write problem.
- Duplicate events must not advance state twice.
- Stuck-state monitoring and repair tooling are required.

<!-- question:end:saga-and-compensating-transaction-patterns-intermediate-q03 -->

#### What isolation anomalies can occur in sagas?

<!-- question:start:saga-and-compensating-transaction-patterns-intermediate-q04 -->
<!-- question-id:saga-and-compensating-transaction-patterns-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Concurrent sagas can produce dirty reads, lost updates, nonrepeatable reads, overselling, or decisions based on intermediate state because there is no cross-service isolation. Use reservations, pending statuses, optimistic versions, conditional writes, semantic locks, partitioned processing, rereads, and commutative operations according to the invariant.

##### Key Points to Mention

- Eventual consistency is not only about delayed reads.
- Intermediate state must be represented deliberately.
- Long database locks are usually not the answer.
- Concurrency tests should run multiple sagas against the same resource.

<!-- question:end:saga-and-compensating-transaction-patterns-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design an order saga involving inventory, payment, and shipping?

<!-- question:start:saga-and-compensating-transaction-patterns-advanced-q01 -->
<!-- question-id:saga-and-compensating-transaction-patterns-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Create an explicit order saga with a stable ID. Reserve inventory with expiry, authorize payment, confirm fulfillment capacity, then place the irreversible pivot as late as business rules permit, such as payment capture or shipment release. Persist every transition with an outbox, use stable operation IDs, and define release, void, refund, and cancellation compensations. Handle unknown outcomes, late replies, concurrent stock reservations, and manual review when shipment or refund cannot be automated.

##### Key Points to Mention

- Distinguish authorization from capture.
- Reservation expiry is part of the workflow.
- Customer-visible states should include pending and compensation.
- Reconciliation compares order, inventory, payment, and shipment records.

<!-- question:end:saga-and-compensating-transaction-patterns-advanced-q01 -->

#### How do you recover when a compensating action repeatedly fails?

<!-- question:start:saga-and-compensating-transaction-patterns-advanced-q02 -->
<!-- question-id:saga-and-compensating-transaction-patterns-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Keep the saga in an explicit compensation-pending or failed state, retry only classified transient failures with bounded backoff, and preserve the stable compensation idempotency key. Alert an owned operational queue with full correlation and safe diagnostic data. Provide authorized repair or manual-decision tools, then resume the state machine and reconcile all participants before reporting the final business outcome.

##### Key Points to Mention

- Compensation is not guaranteed to succeed.
- Do not hide incomplete refunds or releases behind a canceled status.
- Manual database edits should not be the normal recovery mechanism.
- Audit both automated and human recovery actions.

<!-- question:end:saga-and-compensating-transaction-patterns-advanced-q02 -->

#### How do choreography and orchestration affect coupling?

<!-- question:start:saga-and-compensating-transaction-patterns-advanced-q03 -->
<!-- question-id:saga-and-compensating-transaction-patterns-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Choreography reduces direct coordinator coupling but creates semantic coupling among participants that must understand event sequences and compensation. Orchestration centralizes process knowledge and keeps participants focused, but couples the orchestrator to commands, replies, and workflow rules. Choose where process knowledge should live, keep contracts stable, and avoid both cyclic event chains and a coordinator that absorbs participant domain logic.

##### Key Points to Mention

- No approach eliminates coupling.
- Process visibility is a design requirement.
- Team ownership and change frequency affect the choice.
- Events for general notification can coexist with orchestrated commands.

<!-- question:end:saga-and-compensating-transaction-patterns-advanced-q03 -->

#### How would you test and observe a saga in production?

<!-- question:start:saga-and-compensating-transaction-patterns-advanced-q04 -->
<!-- question-id:saga-and-compensating-transaction-patterns-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Use state-machine tests for every transition and integration tests that inject failure before and after each commit, lose replies, duplicate and reorder messages, restart processes, expire timers, and fail compensation. In production, correlate saga, command, event, and business IDs; monitor state age, deadline breaches, attempts, compensation rates, and reconciliation mismatches; and provide safe replay and intervention tools.

##### Key Points to Mention

- Test ambiguous outcomes, not only explicit errors.
- Durable state is the source for workflow status.
- Distributed traces complement but do not replace saga records.
- Operational recovery procedures should be rehearsed.

<!-- question:end:saga-and-compensating-transaction-patterns-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
