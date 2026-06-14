---
id: domain-services-and-domain-events
topic: Domain modeling and Domain-Driven Design
subtopic: Domain services and domain events
category: Design & Architecture
---

## Overview

Domain services and domain events are tactical Domain-Driven Design (DDD) patterns used when important domain behavior does not fit cleanly inside one entity or value object.

A **domain service** represents a meaningful domain operation or policy that involves several domain concepts but is not naturally owned by one of them. It belongs to the domain model and uses the Ubiquitous Language.

A **domain event** is an immutable statement that something meaningful has already happened in the domain. It allows an aggregate to record a fact without directly coordinating every reaction to that fact.

For example:

- A `PricingPolicy` can calculate a price from a product, customer tier, and active promotion.
- An `OrderSubmitted` event can trigger inventory reservation, buyer-history updates, or the creation of an integration event.

These patterns matter because business logic commonly becomes scattered between controllers, application services, repositories, message handlers, and entity classes. Domain services provide a home for genuine domain policies that span objects. Domain events make important outcomes and side effects explicit while reducing direct coupling.

They are important in interviews because candidates must distinguish:

- Domain services from application and infrastructure services.
- Events from commands.
- Domain events from integration events.
- Immediate consistency from eventual consistency.
- Event recording from event dispatch.
- Useful decoupling from unnecessary indirection.

## Core Concepts

### Where Domain Behavior Belongs

Place behavior as close as possible to the state and rules it protects.

Use:

- An **entity method** when the behavior belongs to one entity and uses its state.
- A **value object method** when the behavior belongs to a value and can remain immutable.
- An **aggregate-root method** when the behavior protects aggregate-wide invariants.
- A **domain service** when the operation is a domain concept but does not belong naturally to one object.
- An **application service** when the work coordinates a use case, persistence, transactions, or external systems.
- An **infrastructure service** when the work implements technical details such as SMTP, storage, or an external SDK.

Do not move behavior into a domain service merely because it uses several parameters. First ask whether an entity or value object owns the rule.

### What Is a Domain Service?

A domain service is a stateless domain operation expressed using the language of the business.

Typical characteristics:

- It performs domain logic rather than technical orchestration.
- Its name represents a domain concept or policy.
- It consumes and returns domain types.
- It has no identity or independent lifecycle.
- It is usually stateless.
- It does not own transaction or transport concerns.

Examples include:

- Pricing policy.
- Currency conversion policy.
- Loan affordability assessment.
- Route selection policy.
- Funds-transfer policy.
- Tax calculation.
- Scheduling conflict policy.

A domain service is not simply any class whose name ends in `Service`.

### Entity Method Versus Domain Service

Suppose a bank account controls withdrawals:

```csharp
public sealed class BankAccount
{
    public Money Balance { get; private set; }
    public Money OverdraftLimit { get; }

    public void Withdraw(Money amount)
    {
        if (amount <= Money.Zero(amount.Currency))
        {
            throw new DomainRuleViolation(
                "Withdrawal amount must be positive.");
        }

        if (Balance - amount < -OverdraftLimit)
        {
            throw new DomainRuleViolation(
                "The withdrawal exceeds the overdraft limit.");
        }

        Balance -= amount;
    }
}
```

The rule belongs on `BankAccount` because that entity owns the balance and overdraft invariant.

A transfer involves two accounts and a transfer policy:

```csharp
public sealed class FundsTransferService
{
    public Transfer Transfer(
        BankAccount source,
        BankAccount destination,
        Money amount,
        Instant occurredAt)
    {
        if (source.Currency != destination.Currency)
        {
            throw new DomainRuleViolation(
                "Accounts must use the same currency.");
        }

        source.Withdraw(amount);
        destination.Deposit(amount);

        return Transfer.Record(
            source.Id,
            destination.Id,
            amount,
            occurredAt);
    }
}
```

The operation is a recognizable domain concept and no single account should own both sides.

### Value Object Versus Domain Service

If a calculation depends only on one value object's state, keep it on that value object:

```csharp
public sealed record Money(decimal Amount, string Currency)
{
    public Money Add(Money other)
    {
        EnsureSameCurrency(other);
        return this with { Amount = Amount + other.Amount };
    }
}
```

Use a domain service when a policy combines independent concepts:

```csharp
public sealed class ExchangeService
{
    private readonly IExchangeRateProvider _rates;

    public ExchangeService(IExchangeRateProvider rates)
    {
        _rates = rates;
    }

    public Money Convert(Money source, Currency target)
    {
        var rate = _rates.GetRate(source.Currency, target);
        return Money.Of(source.Amount * rate, target.Code);
    }
}
```

`IExchangeRateProvider` is a domain-facing port. Its implementation can call a database or external provider, but the domain service depends only on the capability it needs.

### Domain Service Versus Application Service

A domain service makes a business decision or calculation. An application service coordinates a use case.

```csharp
public sealed class TransferFundsHandler
{
    private readonly IAccountRepository _accounts;
    private readonly FundsTransferService _transferService;
    private readonly IUnitOfWork _unitOfWork;

    public async Task<TransferId> Handle(
        TransferFunds command,
        CancellationToken cancellationToken)
    {
        var source = await _accounts.GetAsync(
            command.SourceAccountId,
            cancellationToken);

        var destination = await _accounts.GetAsync(
            command.DestinationAccountId,
            cancellationToken);

        var transfer = _transferService.Transfer(
            source,
            destination,
            command.Amount,
            SystemClock.Instance.GetCurrentInstant());

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return transfer.Id;
    }
}
```

The application handler:

- Loads aggregates.
- Defines the transaction.
- Invokes domain behavior.
- Saves changes.
- Handles authorization and external workflow concerns.

The domain service:

- Applies the transfer policy.
- Uses domain types.
- Does not know about HTTP, EF Core, or message brokers.

### Domain Service Versus Infrastructure Service

An infrastructure service implements a technical capability:

```csharp
public sealed class SendGridEmailSender : IEmailSender
{
    public Task SendAsync(
        EmailMessage message,
        CancellationToken cancellationToken)
    {
        // Vendor SDK call.
    }
}
```

The domain may decide **that** a customer should be notified. Infrastructure decides **how** to send the notification.

Names such as `EmailService`, `FileService`, and `CacheService` usually describe technical services, not domain services.

### Keeping Domain Services Focused

A domain service should have one coherent domain responsibility.

Prefer:

```text
PricingPolicy
CreditEligibilityPolicy
ShipmentRoutingPolicy
```

Avoid:

```text
OrderService
BusinessService
DomainManager
```

Generic service names often accumulate unrelated logic and recreate an anemic domain model.

If a domain service repeatedly mutates the internals of one entity, move that behavior into the entity. If it mainly loads repositories and sends messages, it is probably an application service.

### Pure and Impure Domain Services

A **pure domain service** calculates from supplied domain values and has no external dependencies:

```csharp
public sealed class DiscountPolicy
{
    public Percentage Calculate(
        CustomerTier tier,
        Money basketTotal)
    {
        if (tier == CustomerTier.Platinum &&
            basketTotal.Amount >= 500m)
        {
            return Percentage.Of(10);
        }

        return Percentage.Zero;
    }
}
```

An **impure domain service** may need information that is not already loaded:

```csharp
public interface ICreditExposure
{
    Money CurrentExposure(CustomerId customerId);
}

public sealed class CreditApprovalPolicy
{
    private readonly ICreditExposure _exposure;

    public CreditApprovalPolicy(ICreditExposure exposure)
    {
        _exposure = exposure;
    }

    public bool CanApprove(
        Customer customer,
        Money requestedCredit)
    {
        var current = _exposure.CurrentExposure(customer.Id);
        return current + requestedCredit <= customer.CreditLimit;
    }
}
```

Keep the dependency expressed as a domain capability. Avoid injecting `DbContext`, HTTP clients, or vendor SDKs into the domain layer.

### What Is a Domain Event?

A domain event is an immutable description of a domain fact that has already occurred.

Examples:

- `OrderSubmitted`.
- `PaymentCaptured`.
- `SubscriptionExpired`.
- `InventoryReserved`.
- `LoanApplicationApproved`.

Events should:

- Use past tense.
- Use the Ubiquitous Language.
- Contain enough information for intended handlers.
- Be immutable.
- Represent something meaningful to the domain.
- Record facts rather than requests.

```csharp
public sealed record OrderSubmittedDomainEvent(
    OrderId OrderId,
    CustomerId CustomerId,
    Money Total,
    Instant SubmittedAt) : IDomainEvent;
```

### Commands Versus Events

A command requests an action:

```text
SubmitOrder
CapturePayment
CancelSubscription
```

An event reports an outcome:

```text
OrderSubmitted
PaymentCaptured
SubscriptionCancelled
```

Important differences:

| Command | Event |
| --- | --- |
| Imperative request | Past-tense fact |
| May be rejected | Has already happened |
| Usually one logical handler | May have zero or many handlers |
| Directed to an owner | Published to interested consumers |
| Caller expects an outcome | Publisher does not control reactions |

Do not name an event `SubmitOrderEvent`. That is a command disguised as an event.

### Recording Events Inside Aggregates

An aggregate can record events when domain behavior succeeds:

```csharp
public abstract class AggregateRoot
{
    private readonly List<IDomainEvent> _domainEvents = [];

    public IReadOnlyCollection<IDomainEvent> DomainEvents =>
        _domainEvents.AsReadOnly();

    protected void Raise(IDomainEvent domainEvent) =>
        _domainEvents.Add(domainEvent);

    public void ClearDomainEvents() =>
        _domainEvents.Clear();
}
```

```csharp
public sealed class Order : AggregateRoot
{
    public void Submit(Instant submittedAt)
    {
        EnsureCanSubmit();

        Status = OrderStatus.Submitted;
        SubmittedAt = submittedAt;

        Raise(new OrderSubmittedDomainEvent(
            Id,
            CustomerId,
            CalculateTotal(),
            submittedAt));
    }
}
```

Recording does not necessarily dispatch the event immediately. The aggregate remains focused on its state transition.

### Immediate Versus Deferred Dispatch

**Immediate dispatch** invokes handlers as soon as the event is raised. It can make side effects happen during an aggregate method, which complicates testing, transaction reasoning, and error handling.

**Deferred dispatch** records events and publishes them near the unit-of-work boundary. This separates the domain decision from side-effect execution.

A common flow is:

```text
Command handler
  -> load aggregate
  -> invoke domain behavior
  -> aggregate records events
  -> unit of work dispatches events
  -> persist changes
  -> clear recorded events
```

Deferred dispatch makes the transaction policy explicit and is generally easier to test.

### Dispatch Before or After Commit

Dispatching events **before** the database commit can include handler changes in the same local transaction:

```text
Change aggregate
  -> dispatch domain handlers
  -> save all changes
  -> commit once
```

Advantages:

- Atomic local side effects.
- Straightforward rollback.
- Simpler consistency model.

Costs:

- A larger transaction.
- More locks and coupling between handlers.
- Slow handlers extend transaction time.

Dispatching events **after** commit separates transactions:

```text
Commit aggregate
  -> dispatch handlers
  -> handlers commit separately
```

Advantages:

- Smaller original transaction.
- Better isolation of independent reactions.

Costs:

- Eventual consistency.
- A process crash can occur after commit but before dispatch.
- Retries, idempotency, and durable event storage may be required.

The correct choice follows business consistency and reliability requirements.

### Domain Event Handlers

Handlers react to domain events. They commonly live in the application layer because they may:

- Load another aggregate.
- Invoke a repository.
- Start an external workflow.
- Create an integration event.
- Send a notification through a port.

```csharp
public sealed class ReserveInventoryWhenOrderSubmitted
    : IDomainEventHandler<OrderSubmittedDomainEvent>
{
    private readonly IInventoryRepository _inventory;

    public async Task Handle(
        OrderSubmittedDomainEvent domainEvent,
        CancellationToken cancellationToken)
    {
        var reservation = await _inventory.GetForOrderAsync(
            domainEvent.OrderId,
            cancellationToken);

        reservation.Reserve();
    }
}
```

The handler coordinates the reaction, while the loaded aggregate protects its own rules.

### Domain Events Versus Integration Events

Both represent facts, but they have different boundaries and delivery requirements.

**Domain events**:

- Are internal to a bounded context.
- Often run in-process.
- Can contain domain-specific types.
- Can evolve with the internal model.
- May participate in a local transaction.

**Integration events**:

- Cross process or bounded-context boundaries.
- Are asynchronous contracts.
- Must be serializable and versionable.
- Should contain stable, consumer-safe data.
- Must be published only for committed state.
- Require delivery, retry, and observability mechanisms.

Do not publish internal domain objects directly:

```csharp
public sealed record OrderSubmittedIntegrationEvent(
    Guid OrderId,
    Guid CustomerId,
    decimal Total,
    string Currency,
    DateTimeOffset SubmittedAt);
```

An application handler can translate a domain event into this public contract.

### The Transactional Outbox

If state is committed and an integration event must be published reliably, saving the database change and publishing to a broker are two separate operations.

Failure scenario:

```text
1. Database commit succeeds.
2. Process crashes.
3. Broker publish never occurs.
```

The transactional outbox addresses this:

```text
One database transaction:
  - Save aggregate changes.
  - Save an outbox message.

Background publisher:
  - Read unpublished messages.
  - Publish to broker.
  - Mark messages as published.
```

The outbox provides at-least-once delivery in common implementations. Consumers must therefore be idempotent.

### Idempotency and Duplicate Delivery

Distributed messaging cannot generally promise that a handler runs exactly once from the business perspective. Retries can produce duplicate delivery.

An idempotent consumer can:

- Store processed message IDs.
- Use a unique business key.
- Make the state transition conditional.
- Use an inbox table.
- Treat repeated facts as no-ops.

```csharp
if (await _inbox.HasProcessedAsync(
    message.Id,
    cancellationToken))
{
    return;
}

await HandleBusinessOperation(message, cancellationToken);
await _inbox.MarkProcessedAsync(message.Id, cancellationToken);
```

The inbox update and business change should be atomic where practical.

### Ordering and Stale Events

Events can arrive out of order:

```text
OrderSubmitted version 3
OrderCancelled version 4
OrderAddressChanged version 2
```

Possible strategies include:

- Aggregate sequence numbers.
- Expected-version checks.
- Per-key ordered partitions.
- Ignoring stale versions.
- Designing commutative handlers.
- Reconciliation jobs.

Do not assume global event ordering unless the infrastructure and design explicitly provide it.

### Domain Events and Eventual Consistency

Domain events can coordinate reactions across aggregates:

```text
Order.Submit()
  -> OrderSubmitted
      -> reserve inventory
      -> update customer history
```

If handlers execute in separate transactions, temporary inconsistency exists. The design must specify:

- Acceptable delay.
- Retry policy.
- Failure visibility.
- Compensation.
- Idempotency.
- Manual recovery.

Eventual consistency is a business behavior, not merely a technical implementation detail.

### Event Cascades

One event handler can change another aggregate, which raises another event:

```text
OrderSubmitted
  -> InventoryReserved
      -> ShipmentRequested
```

Long cascades make control flow difficult to understand and can create loops.

Keep event chains manageable by:

- Modeling a process manager or saga for long workflows.
- Making workflow state explicit.
- Limiting hidden synchronous cascades.
- Adding correlation and causation IDs.
- Monitoring event flow.
- Detecting cycles.

### Domain Events Are Not Event Sourcing

Using domain events does not mean the application is event-sourced.

With ordinary domain events:

- Current state is persisted normally.
- Events communicate completed facts or trigger side effects.
- The event list may be transient or stored only for delivery.

With event sourcing:

- The event stream is the source of truth.
- Aggregate state is rebuilt by replaying events.
- Event schema evolution and projection rebuilding are core concerns.

The patterns can coexist, but they solve different problems.

### Testing Domain Services

Pure domain services are easy to test:

```csharp
[Fact]
public void Platinum_customer_receives_discount_for_large_basket()
{
    var policy = new DiscountPolicy();

    var discount = policy.Calculate(
        CustomerTier.Platinum,
        Money.Usd(600m));

    discount.Should().Be(Percentage.Of(10));
}
```

Tests should cover:

- Policy boundaries.
- Invalid combinations.
- Relevant value-object behavior.
- Interaction with domain ports where necessary.

Avoid tests that only verify that a method was called. Verify the business result.

### Testing Domain Events

Aggregate tests can verify recorded facts:

```csharp
[Fact]
public void Submitting_an_order_records_the_domain_event()
{
    var order = OrderBuilder.ValidDraft();
    var now = Instant.FromUtc(2026, 6, 14, 10, 0);

    order.Submit(now);

    order.DomainEvents.Should().ContainSingle()
        .Which.Should().BeOfType<OrderSubmittedDomainEvent>();
}
```

Also test:

- Event payload values.
- Events are not raised when an operation fails.
- Handler effects.
- Transaction timing.
- Duplicate delivery.
- Outbox publication and retry.
- Contract compatibility for integration events.

### When Not to Use a Domain Service

Avoid a domain service when:

- The behavior clearly belongs to an entity or value object.
- The class only forwards to a repository.
- It only maps DTOs.
- It coordinates HTTP, persistence, and transactions.
- It is a generic container for all business logic.
- The context is simple CRUD with no meaningful domain policy.

### When Not to Use a Domain Event

Avoid a domain event when:

- A direct method call is clearer.
- The caller requires an immediate result from one known collaborator.
- The occurrence has no domain significance.
- The event only reports a property setter.
- It hides a required synchronous invariant.
- The team cannot operate the resulting asynchronous workflow reliably.

Events trade direct coupling for indirect control flow and operational concerns. Use that trade deliberately.

### Common Mistakes

- Moving all entity behavior into domain services.
- Naming technical helpers as domain services.
- Injecting `DbContext`, HTTP clients, or message brokers into the domain model.
- Using commands and events interchangeably.
- Naming events in the present or imperative tense.
- Making events mutable.
- Publishing integration events before the transaction commits.
- Assuming event delivery is exactly once.
- Dispatching immediately from static global infrastructure.
- Hiding mandatory consistency behind asynchronous handlers.
- Creating long, invisible event cascades.
- Putting every side effect in the aggregate itself.
- Treating domain events as event sourcing.
- Adding events where a direct call is easier to understand.

### Best Practices

- Keep behavior on entities and value objects when they naturally own it.
- Name domain services after specific domain policies.
- Keep domain services stateless and independent of infrastructure.
- Model events as immutable past-tense facts.
- Record events in aggregates and dispatch them at an explicit unit-of-work boundary.
- Decide before-commit versus after-commit behavior from consistency requirements.
- Keep handlers small and single-purpose.
- Translate internal domain events into stable integration contracts.
- Use an outbox when committed facts must be published reliably.
- Design consumers for duplicate and out-of-order delivery.
- Make eventual consistency, retries, and recovery visible to the business and operations.
- Test domain decisions separately from delivery infrastructure.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is a domain service?

<!-- question:start:domain-services-and-domain-events-beginner-q01 -->
<!-- question-id:domain-services-and-domain-events-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A domain service represents a meaningful business operation or policy that does not naturally belong to one entity or value object. It uses domain language and types, is normally stateless, and contains domain logic rather than persistence, transport, or workflow orchestration. Examples include pricing, credit eligibility, and funds-transfer policies.

##### Key Points to Mention

- Use it only when no domain object naturally owns the behavior.
- It belongs to the domain layer.
- It should express a specific business concept.
- It should not become a generic container for all business logic.

<!-- question:end:domain-services-and-domain-events-beginner-q01 -->

#### What is a domain event?

<!-- question:start:domain-services-and-domain-events-beginner-q02 -->
<!-- question-id:domain-services-and-domain-events-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A domain event is an immutable statement that a meaningful fact has already occurred inside a domain. An aggregate records it after a successful state transition, and zero or more handlers can react. Events use past-tense Ubiquitous Language, such as `OrderSubmitted` or `PaymentCaptured`.

##### Key Points to Mention

- It represents a fact, not a request.
- It should be immutable and named in past tense.
- It makes domain side effects explicit.
- Multiple handlers may react independently.

<!-- question:end:domain-services-and-domain-events-beginner-q02 -->

#### What is the difference between a command and a domain event?

<!-- question:start:domain-services-and-domain-events-beginner-q03 -->
<!-- question-id:domain-services-and-domain-events-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A command asks an owner to perform an action and can be accepted or rejected. It is normally imperative and has one logical handler. A domain event reports that an action has already succeeded and may have zero or many handlers. `SubmitOrder` is a command; `OrderSubmitted` is an event.

##### Key Points to Mention

- Commands express intent; events express facts.
- Commands can fail validation.
- Events cannot be rejected as if they had not happened.
- Events support multiple independent reactions.

<!-- question:end:domain-services-and-domain-events-beginner-q03 -->

#### How does a domain service differ from an application service?

<!-- question:start:domain-services-and-domain-events-beginner-q04 -->
<!-- question-id:domain-services-and-domain-events-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A domain service performs a business calculation or decision. An application service coordinates a use case by loading aggregates, invoking domain behavior, managing a transaction, saving state, and interacting with external ports. Application services should delegate core business validity to entities, value objects, aggregates, or domain services.

##### Key Points to Mention

- Domain service means business policy.
- Application service means use-case orchestration.
- Infrastructure details should not enter the domain service.
- The distinction prevents an anemic domain model.

<!-- question:end:domain-services-and-domain-events-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### When should behavior remain on an entity instead of moving to a domain service?

<!-- question:start:domain-services-and-domain-events-intermediate-q01 -->
<!-- question-id:domain-services-and-domain-events-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Keep behavior on an entity or aggregate root when that object owns the state and invariant being changed. For example, an account should enforce its own withdrawal limit. Use a domain service only when a meaningful operation spans independent domain concepts and assigning it to one object would distort responsibility.

##### Key Points to Mention

- Behavior should stay near the state it protects.
- Domain services are not a substitute for entity methods.
- Avoid service classes that mutate entity internals.
- Use the Ubiquitous Language to identify the natural owner.

<!-- question:end:domain-services-and-domain-events-intermediate-q01 -->

#### What is the difference between a domain event and an integration event?

<!-- question:start:domain-services-and-domain-events-intermediate-q02 -->
<!-- question-id:domain-services-and-domain-events-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A domain event is an internal fact within a bounded context and often runs in-process. An integration event is a stable, serializable, versioned contract sent asynchronously to another process or bounded context. Integration events must represent committed state and require reliable publication, retry, compatibility, and observability. A handler can translate a domain event into an integration event.

##### Key Points to Mention

- The boundary and reliability requirements differ.
- Do not expose internal aggregate objects in public events.
- Integration events are published after successful persistence.
- Cross-process consumers require idempotency.

<!-- question:end:domain-services-and-domain-events-intermediate-q02 -->

#### Why record domain events and dispatch them later?

<!-- question:start:domain-services-and-domain-events-intermediate-q03 -->
<!-- question-id:domain-services-and-domain-events-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Deferred dispatch lets an aggregate record a domain fact without immediately invoking handlers and infrastructure during its method. The unit of work can later dispatch events at a deliberate transaction boundary. This improves test isolation, makes consistency policy explicit, and avoids hidden side effects from static global dispatchers.

##### Key Points to Mention

- Recording and dispatch are separate concerns.
- The aggregate remains focused on its transition.
- Dispatch timing determines transaction behavior.
- Recorded events must be cleared after successful handling.

<!-- question:end:domain-services-and-domain-events-intermediate-q03 -->

#### Should domain events be dispatched before or after the database commit?

<!-- question:start:domain-services-and-domain-events-intermediate-q04 -->
<!-- question-id:domain-services-and-domain-events-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Either can be correct. Before-commit dispatch can include local handler changes in one transaction, providing atomic rollback but increasing transaction duration and coupling. After-commit dispatch allows separate transactions and smaller locks but introduces eventual consistency and a failure window. Durable storage such as an outbox is needed when post-commit publication must survive crashes.

##### Key Points to Mention

- Decide from business consistency requirements.
- Before commit favors local atomicity.
- After commit requires retry and recovery.
- External integration events should represent committed state.

<!-- question:end:domain-services-and-domain-events-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How does the transactional outbox prevent lost integration events?

<!-- question:start:domain-services-and-domain-events-advanced-q01 -->
<!-- question-id:domain-services-and-domain-events-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

The application saves aggregate changes and an outbox message in the same database transaction. A separate publisher reads pending outbox rows, sends them to the broker, and marks them published. Therefore, a crash cannot commit business state without also recording the publication intent. Publishing may be retried, so consumers must be idempotent.

##### Key Points to Mention

- It solves the dual-write failure between database and broker.
- The database transaction stores both state and message intent.
- Delivery is commonly at least once.
- Monitor backlog and handle poison messages.

<!-- question:end:domain-services-and-domain-events-advanced-q01 -->

#### How do you preserve business correctness with duplicate or out-of-order events?

<!-- question:start:domain-services-and-domain-events-advanced-q02 -->
<!-- question-id:domain-services-and-domain-events-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use event IDs or business keys to detect duplicates, make state transitions conditional, and store inbox records atomically with consumer changes. For ordering, use aggregate sequence numbers, expected versions, key-based partitions, or stale-event rejection. The chosen mechanism depends on whether order matters for the business operation; do not assume global broker ordering.

##### Key Points to Mention

- Exactly-once business execution should not be assumed.
- Idempotency is a consumer responsibility.
- Sequence and version checks protect ordered state transitions.
- Reconciliation is needed when automatic recovery cannot resolve a conflict.

<!-- question:end:domain-services-and-domain-events-advanced-q02 -->

#### How would you model a long-running process caused by several domain events?

<!-- question:start:domain-services-and-domain-events-advanced-q03 -->
<!-- question-id:domain-services-and-domain-events-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Use an explicit process manager or saga when a workflow spans several aggregates, messages, and time periods. Persist workflow state, correlate events, issue commands to participants, and define timeouts, retries, compensation, and terminal states. This is clearer and more recoverable than a long hidden chain of event handlers.

##### Key Points to Mention

- Long workflows need explicit durable state.
- Correlation and causation IDs support tracing.
- Compensation is business behavior, not automatic rollback.
- Each aggregate continues to protect its own invariants.

<!-- question:end:domain-services-and-domain-events-advanced-q03 -->

#### When do domain events create more complexity than value?

<!-- question:start:domain-services-and-domain-events-advanced-q04 -->
<!-- question-id:domain-services-and-domain-events-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Events are excessive when a direct call to one known collaborator is clearer, when an immediate result is required, or when the occurrence has no domain significance. They also become harmful when they hide mandatory consistency, create hard-to-trace cascades, or introduce asynchronous operations the team cannot monitor and recover. Use events when explicit facts and independent reactions justify the indirect flow.

##### Key Points to Mention

- Decoupling trades direct dependencies for indirect control flow.
- Not every state change deserves an event.
- Operational readiness matters for asynchronous delivery.
- Prefer the simplest mechanism that satisfies consistency and evolution needs.

<!-- question:end:domain-services-and-domain-events-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
