---
id: cqrs-and-when-separate-read-and-write-models-make-sense
topic: Distributed systems patterns
subtopic: CQRS and when separate read and write models make sense
category: Design & Architecture
---

## Overview

Command Query Responsibility Segregation (CQRS) separates operations that change state from operations that read state.

- A **command** expresses an intent to change the system.
- A **query** retrieves data without changing observable business state.

CQRS is a spectrum rather than one fixed architecture. A small implementation can use separate command and query handlers over the same database. A more advanced implementation can use different models, schemas, databases, deployment units, and scaling policies for reads and writes.

The pattern is useful when read and write concerns are meaningfully asymmetric:

- Writes enforce complex business rules and invariants.
- Reads need denormalized, presentation-specific shapes.
- Read traffic is much larger than write traffic.
- Reads and writes need independent scaling or storage technology.
- Multiple clients require different query projections.
- Contention or security requirements differ between the two paths.

CQRS adds costs:

- More code and concepts.
- Synchronization between models.
- Eventual consistency when stores are separated.
- Message delivery, duplicate handling, and replay concerns.
- More deployment, monitoring, and testing work.

It is usually unnecessary for straightforward CRUD applications where one model and one transactional database satisfy both reads and writes.

This topic matters in interviews because candidates must explain not only how CQRS works, but when the extra model separation creates enough value to justify its complexity. Strong answers distinguish CQRS from event sourcing and from simply using a mediator library.

## Core Concepts

### Commands and Queries

A command requests a state transition:

```csharp
public sealed record PlaceOrder(
    Guid OrderId,
    Guid CustomerId,
    IReadOnlyList<OrderLineRequest> Lines);
```

A query requests information:

```csharp
public sealed record GetOrderDetails(Guid OrderId);
```

Commands should describe business intent:

```text
PlaceOrder
ApproveExpense
CancelReservation
ChangeShippingAddress
```

They are clearer than generic data-edit commands:

```text
UpdateOrder
SetStatus
PatchEntity
```

A command can be rejected because current state, authorization, or business rules do not permit the transition.

### Command Handlers

A command handler coordinates one use case:

```csharp
public sealed class PlaceOrderHandler
{
    private readonly IOrderRepository orders;
    private readonly IUnitOfWork unitOfWork;

    public async Task<Guid> Handle(
        PlaceOrder command,
        CancellationToken cancellationToken)
    {
        var order = Order.Place(
            command.OrderId,
            command.CustomerId,
            command.Lines);

        orders.Add(order);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return order.Id;
    }
}
```

The handler typically:

- Authorizes the operation.
- Loads required domain state.
- Invokes domain behavior.
- Persists changes atomically within one local transaction.
- Records events or outbox messages when integration is required.
- Returns a small acknowledgement or identifier.

It should not build large presentation models or expose persistence entities directly.

### Query Handlers

A query handler can bypass the write-domain model and project directly into a read DTO:

```csharp
public sealed class GetOrderDetailsHandler
{
    private readonly OrderingDbContext db;

    public Task<OrderDetails?> Handle(
        GetOrderDetails query,
        CancellationToken cancellationToken)
    {
        return db.Orders
            .AsNoTracking()
            .Where(order => order.Id == query.OrderId)
            .Select(order => new OrderDetails(
                order.Id,
                order.Status,
                order.CustomerName,
                order.Lines.Sum(line => line.Quantity * line.UnitPrice)))
            .SingleOrDefaultAsync(cancellationToken);
    }
}
```

Query models should be optimized for consumers:

- Flat DTOs.
- Denormalized documents.
- Search indexes.
- Precomputed summaries.
- Client-specific projections.

Queries should not change business state. Operational telemetry such as access logs does not usually violate this rule, but hidden business side effects do.

### Basic CQRS with One Database

The lowest-cost form uses:

```text
Commands -> domain model -> shared database
Queries  -> projections   -> shared database
```

Benefits:

- Clear separation of business changes from reads.
- Query-specific DTOs without polluting domain entities.
- One transactional source of truth.
- No projection synchronization delay.
- Lower operational complexity than separate stores.

This is often the right starting point. Separate databases should be introduced only when independent scaling, storage, availability, or schema needs justify them.

### Separate Read and Write Stores

Advanced CQRS can use:

```text
Command
  -> write model
  -> write database
  -> committed event/outbox
  -> projection worker
  -> read database
  -> query
```

The write store is optimized for:

- Invariants.
- Transactions.
- Concurrency control.
- Normalized state.
- Aggregate updates.

The read store is optimized for:

- Query latency.
- Filtering and search.
- Denormalized views.
- Read replicas.
- Client-facing schemas.

The models are synchronized asynchronously, so reads may temporarily be stale.

### Eventual Consistency

With separate stores, a successful command does not imply that every read projection is immediately current.

Example:

```text
10:00:00.000 Order accepted by write model
10:00:00.020 Event published
10:00:00.180 Read projection updated
```

During the gap, a query can return the previous state.

The product must define acceptable behavior:

- Show a pending operation state.
- Return the command result directly for immediate confirmation.
- Poll until the projection reaches a known version.
- Route the user temporarily to the write model.
- Include a consistency token or expected version.
- Explain that processing continues asynchronously.

"Eventual consistency" is not an excuse for unspecified user experience.

### Read-Your-Writes

Users often expect to see their own change immediately.

Possible strategies:

- Return enough data from the command to update the UI optimistically.
- Return an operation ID and expose a status resource.
- Include the committed aggregate version and wait until the read model reaches it.
- Read the authoritative write store for a limited workflow.
- Use synchronous projection only when latency and coupling are acceptable.

The system should not promise global strong consistency if it only provides session-level or operation-level read-your-writes behavior.

### Materialized Views and Projections

A projection transforms authoritative changes into a query model:

```csharp
public async Task Handle(
    OrderPlaced message,
    CancellationToken cancellationToken)
{
    var view = new OrderSummaryDocument
    {
        OrderId = message.OrderId,
        CustomerId = message.CustomerId,
        Status = "Placed",
        Total = message.Total,
        Version = message.OrderVersion
    };

    await readStore.UpsertAsync(view, cancellationToken);
}
```

Projection handlers need:

- Idempotency.
- Version or ordering rules.
- Retry and dead-letter handling.
- Rebuild procedures.
- Monitoring for lag and failures.
- Schema migration strategy.

A projection is derived data. The system should know how to repair or rebuild it from an authoritative source.

### Commands Are Not Events

A command is directed and imperative:

```text
ReserveInventory for Order 123
```

An event states a fact that already occurred:

```text
OrderPlaced for Order 123
```

Commands can be rejected. Events should not be phrased as requests that a consumer may reinterpret as a fact.

Using clear semantics improves ownership:

- The command target owns whether to perform an action.
- The event publisher owns the fact it emits.
- Event consumers independently decide how to react.

### CQRS Does Not Require Messaging

Commands can be handled synchronously in process:

```text
HTTP request -> command handler -> database transaction -> HTTP response
```

Messaging becomes useful when:

- Work is long-running.
- Load must be leveled.
- The caller need not wait.
- Services need loose temporal coupling.
- Projections or integrations update asynchronously.

Adding a mediator package or message bus does not by itself create meaningful CQRS. The architectural value comes from separating responsibilities and models.

### CQRS Does Not Require Event Sourcing

CQRS and event sourcing are independent patterns.

CQRS with current-state persistence:

```text
Write model -> current rows
Read model  -> query projections
```

CQRS with event sourcing:

```text
Write model -> append-only event stream
Read model  -> projections built from events
```

Event sourcing can make projections rebuildable and preserve history, but adds:

- Event schema evolution.
- Replay behavior.
- Snapshot strategy.
- Event-store operations.
- More difficult deletion and privacy requirements.
- New debugging and testing techniques.

Do not introduce event sourcing merely because commands and queries are separated.

### Transactional Outbox

When a command updates a database and publishes a message, two independent operations create a failure window:

```text
database commit succeeds
message publish fails
```

The transactional outbox writes both domain changes and an outgoing-message record in the same local database transaction:

```csharp
await using var transaction =
    await db.Database.BeginTransactionAsync(cancellationToken);

order.Place();
db.OutboxMessages.Add(OutboxMessage.From(order.DomainEvents));

await db.SaveChangesAsync(cancellationToken);
await transaction.CommitAsync(cancellationToken);
```

A separate publisher reads unsent outbox records and sends them to the broker. Publishing can occur more than once, so consumers still need idempotency.

### Concurrency on the Write Side

Commands must protect invariants under concurrent updates.

Optimistic concurrency example:

```csharp
public sealed class Order
{
    public Guid Id { get; private set; }
    public byte[] RowVersion { get; private set; } = [];
}
```

EF Core configuration:

```csharp
builder.Property(order => order.RowVersion)
    .IsRowVersion();
```

On conflict, the application can:

- Reject and ask the client to refresh.
- Reload and retry if the operation is safe.
- Merge using domain-specific rules.
- Serialize operations for one aggregate key.

CQRS does not remove concurrency; it gives the command model a focused place to manage it.

### Validation and Authorization

Commands need:

- Structural validation.
- Authorization for the requested operation and resource.
- Business-rule validation in the domain model.
- Concurrency checks.

Queries need:

- Authorization and tenant filtering.
- Field-level data protection.
- Pagination and cost limits.

Read stores often contain denormalized sensitive data. Separating stores can reduce write exposure, but also creates more copies requiring access control, encryption, retention, and deletion handling.

### Independent Scaling

CQRS is valuable when workloads differ:

```text
95% reads
5% writes
```

The query side may use:

- Many replicas.
- Aggressive caching.
- Search infrastructure.
- Geographically distributed copies.

The write side may use:

- Fewer instances.
- Stronger consistency.
- Serialized aggregate updates.
- A relational transactional store.

Independent scaling matters only when measured workload asymmetry or reliability requirements justify the extra system.

### Schema Evolution

Read models are consumer contracts. Evolve them deliberately:

- Add fields compatibly.
- Version event or message contracts.
- Run old and new projections in parallel.
- Backfill or replay data.
- Switch readers after verification.
- Retire old projections after the migration window.

Avoid coupling external consumers directly to internal write-domain types.

### Testing Strategy

Test the write side with:

- Domain invariant tests.
- Command-handler integration tests.
- Authorization tests.
- Concurrency tests.
- Transaction and outbox tests.

Test the read side with:

- Projection tests.
- Query contract tests.
- Idempotency and replay tests.
- Stale and out-of-order event tests.
- Migration and rebuild tests.

End-to-end tests should verify the consistency window and user-visible pending behavior, not assume immediate projection updates.

### When CQRS Makes Sense

CQRS is a strong candidate when:

- The domain has rich state transitions and invariants.
- Read shapes differ significantly from write models.
- Read and write traffic have different scale characteristics.
- Multiple read experiences need specialized projections.
- Eventual consistency is acceptable and can be explained.
- Independent teams own stable boundaries.
- Operational maturity exists for messaging and projections.

### When CQRS Does Not Make Sense

Avoid or limit CQRS when:

- The application is simple CRUD.
- One database model serves both paths clearly.
- Strong immediate consistency is required everywhere.
- The team cannot operate brokers, projections, and repair workflows.
- Read and write loads are similar and modest.
- The pattern is being added only to follow a trend or framework template.

Start with separate code paths over one store. Increase physical separation only in response to evidence.

### Common Mistakes

Common failures include:

- Treating every setter as a command.
- Returning domain entities from queries.
- Assuming commands always succeed.
- Calling any mediator-based architecture CQRS.
- Introducing a separate database before measuring need.
- Hiding eventual consistency from the product experience.
- Publishing messages outside the database transaction without an outbox.
- Assuming broker delivery is exactly once.
- Failing to rebuild or repair projections.
- Combining CQRS and event sourcing without a clear reason.
- Duplicating business rules in read projections.
- Forgetting authorization in denormalized read stores.

### Best-Practice Decision Process

1. Describe the concrete pain in the current read/write model.
2. Separate command and query code paths first.
3. Keep one database unless independent stores solve a measured problem.
4. Model commands as business intent and queries as consumer-focused DTOs.
5. Define concurrency and transaction boundaries on the write side.
6. Define acceptable consistency delay and read-your-writes behavior.
7. Use an outbox for reliable post-commit messaging.
8. Make projections idempotent, observable, and rebuildable.
9. Test stale reads, duplicates, ordering, and projection failure.
10. Reassess whether the operational cost remains justified.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is CQRS?

<!-- question:start:cqrs-and-when-separate-read-and-write-models-make-sense-beginner-q01 -->
<!-- question-id:cqrs-and-when-separate-read-and-write-models-make-sense-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

CQRS separates commands that change state from queries that retrieve state. The two paths can use different handlers and models while sharing one database, or they can use separate stores and deployment units. The purpose is to optimize and reason about reads and writes independently when their business, performance, security, or scaling needs differ.

##### Key Points to Mention

- Commands express intent and may be rejected.
- Queries return data without business side effects.
- Separate databases are optional.
- CQRS adds complexity and is not automatically better than CRUD.

<!-- question:end:cqrs-and-when-separate-read-and-write-models-make-sense-beginner-q01 -->

#### What is the difference between a command and a query?

<!-- question:start:cqrs-and-when-separate-read-and-write-models-make-sense-beginner-q02 -->
<!-- question-id:cqrs-and-when-separate-read-and-write-models-make-sense-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A command requests a business state transition, such as `PlaceOrder`, and normally returns an acknowledgement, identifier, or operation status. A query retrieves a consumer-oriented representation and should not change observable business state. Commands focus on invariants and authorization, while queries focus on efficient filtering and projection.

##### Key Points to Mention

- Prefer task-oriented command names.
- Commands are not guaranteed to succeed.
- Query DTOs need not match domain entities.
- Logging a read is different from a hidden business side effect.

<!-- question:end:cqrs-and-when-separate-read-and-write-models-make-sense-beginner-q02 -->

#### Does CQRS require event sourcing or a message broker?

<!-- question:start:cqrs-and-when-separate-read-and-write-models-make-sense-beginner-q03 -->
<!-- question-id:cqrs-and-when-separate-read-and-write-models-make-sense-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

No. CQRS only requires separation of command and query responsibilities. Both can run synchronously in one process and use one database. Event sourcing is an optional persistence model, and messaging is an optional communication mechanism used for asynchronous commands, projections, or integration.

##### Key Points to Mention

- CQRS is independent of event sourcing.
- In-process handlers can implement CQRS.
- A mediator library is not the defining feature.
- Add infrastructure only when its benefits are required.

<!-- question:end:cqrs-and-when-separate-read-and-write-models-make-sense-beginner-q03 -->

#### When is simple CRUD preferable to CQRS?

<!-- question:start:cqrs-and-when-separate-read-and-write-models-make-sense-beginner-q04 -->
<!-- question-id:cqrs-and-when-separate-read-and-write-models-make-sense-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

CRUD is preferable when business rules are simple, read and write shapes are similar, traffic is modest, one transactional model provides the required consistency, and the team gains little from independent scaling. It has fewer components, less duplication, simpler debugging, and no projection synchronization problem.

##### Key Points to Mention

- Complexity must solve a real problem.
- One model is often sufficient for administrative applications.
- Eventual consistency may be unacceptable.
- CQRS can be introduced incrementally later.

<!-- question:end:cqrs-and-when-separate-read-and-write-models-make-sense-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### What changes when CQRS uses separate read and write databases?

<!-- question:start:cqrs-and-when-separate-read-and-write-models-make-sense-intermediate-q01 -->
<!-- question-id:cqrs-and-when-separate-read-and-write-models-make-sense-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

The write model commits authoritative state and publishes changes that projection workers apply to the read store. Reads and writes can scale and use storage independently, but the system becomes eventually consistent. It must handle reliable publication, duplicates, ordering, projection lag, schema evolution, rebuilding, monitoring, and user-visible read-your-writes behavior.

##### Key Points to Mention

- Separate stores create a consistency window.
- Projection data is derived and should be repairable.
- Broker delivery normally requires idempotent consumers.
- Independent scaling must justify the operational cost.

<!-- question:end:cqrs-and-when-separate-read-and-write-models-make-sense-intermediate-q01 -->

#### How can a CQRS application provide read-your-writes behavior?

<!-- question:start:cqrs-and-when-separate-read-and-write-models-make-sense-intermediate-q02 -->
<!-- question-id:cqrs-and-when-separate-read-and-write-models-make-sense-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

The command can return enough confirmed data for the client to update optimistically, return an operation resource for polling, or include the committed version so the client waits until a projection reaches it. A limited workflow can read the write store directly. The chosen approach should define timeout and failure behavior without pretending the entire system is strongly consistent.

##### Key Points to Mention

- Read-your-writes can be narrower than global consistency.
- Pending UI states make asynchronous processing explicit.
- Version or checkpoint comparison is more reliable than fixed delays.
- The authoritative write result should not be confused with projection state.

<!-- question:end:cqrs-and-when-separate-read-and-write-models-make-sense-intermediate-q02 -->

#### Why is a transactional outbox useful in CQRS?

<!-- question:start:cqrs-and-when-separate-read-and-write-models-make-sense-intermediate-q03 -->
<!-- question-id:cqrs-and-when-separate-read-and-write-models-make-sense-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

It atomically stores the business update and an outgoing-message record in the same local database transaction. A background publisher later sends the message to the broker. This closes the failure window where the database commits but publication is lost. Because the publisher can resend, downstream projection and integration handlers must remain idempotent.

##### Key Points to Mention

- Avoid a distributed transaction between database and broker.
- Outbox records need retention and monitoring.
- Publication is at least once, not magically exactly once.
- Message identity must survive retries.

<!-- question:end:cqrs-and-when-separate-read-and-write-models-make-sense-intermediate-q03 -->

#### How should concurrency be handled on the command side?

<!-- question:start:cqrs-and-when-separate-read-and-write-models-make-sense-intermediate-q04 -->
<!-- question-id:cqrs-and-when-separate-read-and-write-models-make-sense-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Protect aggregate invariants within a local transaction and use optimistic version checks, conditional updates, or serialized processing where necessary. On conflict, reject, reload and retry only if safe, or apply a domain-specific merge rule. A stale read model must never be trusted as the final authority for accepting a command.

##### Key Points to Mention

- CQRS does not eliminate write conflicts.
- The write model owns invariant enforcement.
- Retries require command idempotency or conflict awareness.
- Include expected versions for state-sensitive operations.

<!-- question:end:cqrs-and-when-separate-read-and-write-models-make-sense-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you decide whether to introduce separate physical read and write stores?

<!-- question:start:cqrs-and-when-separate-read-and-write-models-make-sense-advanced-q01 -->
<!-- question-id:cqrs-and-when-separate-read-and-write-models-make-sense-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Measure whether read volume, query complexity, geographic distribution, availability, storage technology, or team ownership cannot be addressed adequately with projections, indexes, caching, or read replicas over one store. Then evaluate tolerated consistency delay, recovery requirements, operational maturity, data duplication, privacy obligations, and total cost. Start with logical separation and move physically only when evidence supports it.

##### Key Points to Mention

- Independent scaling is valuable only with real asymmetry.
- Separate stores create messaging and repair responsibilities.
- Security and deletion rules apply to every read copy.
- Define success metrics before migration.

<!-- question:end:cqrs-and-when-separate-read-and-write-models-make-sense-advanced-q01 -->

#### How would you rebuild a failed or changed read projection safely?

<!-- question:start:cqrs-and-when-separate-read-and-write-models-make-sense-advanced-q02 -->
<!-- question-id:cqrs-and-when-separate-read-and-write-models-make-sense-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Build a new version of the projection beside the active one, replay authoritative events or backfill from a consistent write-store snapshot, then catch up with changes after the snapshot checkpoint. Validate counts, versions, and business samples, switch readers atomically, and retain rollback capability. Projection handlers must be deterministic and idempotent, and replay must avoid emitting external side effects.

##### Key Points to Mention

- Rebuild into a new store or version rather than corrupting the live view.
- Coordinate snapshot position and event checkpoint.
- Monitor lag and poison messages.
- Separate projection updates from irreversible integrations.

<!-- question:end:cqrs-and-when-separate-read-and-write-models-make-sense-advanced-q02 -->

#### What consistency anomalies should clients expect in a CQRS system?

<!-- question:start:cqrs-and-when-separate-read-and-write-models-make-sense-advanced-q03 -->
<!-- question-id:cqrs-and-when-separate-read-and-write-models-make-sense-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Clients may see stale values, missing newly created resources, old list membership, or projections updated in different orders. Design commands against authoritative state, expose pending status, use versions or monotonic checkpoints, make events order-aware per aggregate, and prevent old projection messages from overwriting newer data. The acceptable inconsistency window must be tied to business impact.

##### Key Points to Mention

- Different projections can converge at different times.
- Fixed sleep delays are not a consistency protocol.
- Ordering is often guaranteed only within a partition or aggregate.
- High-risk decisions may require authoritative reads.

<!-- question:end:cqrs-and-when-separate-read-and-write-models-make-sense-advanced-q03 -->

#### What are the main operational risks of advanced CQRS?

<!-- question:start:cqrs-and-when-separate-read-and-write-models-make-sense-advanced-q04 -->
<!-- question-id:cqrs-and-when-separate-read-and-write-models-make-sense-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

The system can accept writes while projections are delayed, silently lose integration events without reliable publication, repeatedly apply duplicates, process events out of order, accumulate poison messages, or fail projection migrations. Operations need end-to-end correlation, outbox age, queue depth, projection lag, failure and dead-letter metrics, replay tooling, reconciliation, and clear ownership.

##### Key Points to Mention

- A successful command and a current read model are separate health concerns.
- Monitor business convergence, not only infrastructure uptime.
- Repair and replay procedures must be tested.
- Simpler CQRS over one store avoids many of these risks.

<!-- question:end:cqrs-and-when-separate-read-and-write-models-make-sense-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
