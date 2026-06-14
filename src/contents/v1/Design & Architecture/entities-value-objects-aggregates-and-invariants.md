---
id: entities-value-objects-aggregates-and-invariants
topic: Domain modeling and Domain-Driven Design
subtopic: Entities, value objects, aggregates, and invariants
category: Design & Architecture
---

## Overview

Entities, value objects, aggregates, and invariants are tactical Domain-Driven Design (DDD) building blocks used to model behavior inside a bounded context.

An **entity** is defined by its identity and lifecycle. A **value object** is defined by its attributes and has no independent identity. An **aggregate** is a consistency boundary containing one or more entities and value objects, with one entity designated as the aggregate root. An **invariant** is a business condition that must remain true for the model to be valid.

These concepts help move business rules out of controllers, UI code, database scripts, and loosely coordinated services into a model that protects its own valid state.

They are useful when:

- Business rules are more complex than straightforward CRUD.
- State transitions must be controlled.
- Several values must change consistently.
- Identity and lifecycle matter.
- Concurrency can violate business rules.
- The model must communicate business intent clearly.

They are important in interviews because candidates are often expected to explain not only definitions but also design judgment:

- Why a concept is an entity rather than a value object.
- Where an aggregate boundary should be drawn.
- Which rules are true invariants.
- How invariants remain protected under concurrency.
- Why aggregates should usually be small.
- How EF Core persistence can support the model without defining it.

## Core Concepts

### Domain Objects Versus Data Containers

A domain object represents business meaning and behavior. A data container mainly transfers or persists values.

For example, this class exposes state but does not protect it:

```csharp
public sealed class Order
{
    public Guid Id { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal Total { get; set; }
}
```

Any caller can create impossible combinations:

```csharp
var order = new Order
{
    Status = "Shipped",
    Total = -500
};
```

A behavioral model restricts state changes:

```csharp
public sealed class Order
{
    private readonly List<OrderLine> _lines = [];

    public OrderId Id { get; }
    public OrderStatus Status { get; private set; }
    public IReadOnlyCollection<OrderLine> Lines => _lines.AsReadOnly();

    public void Submit()
    {
        if (_lines.Count == 0)
        {
            throw new DomainRuleViolation(
                "An order must contain at least one line.");
        }

        if (Status != OrderStatus.Draft)
        {
            throw new DomainRuleViolation(
                "Only a draft order can be submitted.");
        }

        Status = OrderStatus.PendingPayment;
    }
}
```

The second model makes valid operations explicit and prevents arbitrary mutation.

### Entities

An entity has a stable identity that distinguishes it from other instances, even when its attributes change.

Examples include:

- Customer.
- Order.
- Subscription.
- Bank account.
- Support ticket.
- Shipment.

An order remains the same order when its delivery address or status changes.

Entity identity may be:

- A GUID.
- A database-generated number.
- A business identifier such as a policy number.
- A composite key.
- A strongly typed identifier.

Example:

```csharp
public readonly record struct OrderId(Guid Value)
{
    public static OrderId New() => new(Guid.NewGuid());
}

public sealed class Order
{
    public OrderId Id { get; }

    public Order(OrderId id)
    {
        if (id == default)
        {
            throw new ArgumentException(
                "An order ID is required.",
                nameof(id));
        }

        Id = id;
    }
}
```

Strongly typed IDs reduce accidental mixing:

```csharp
public readonly record struct CustomerId(Guid Value);
public readonly record struct OrderId(Guid Value);

// A method accepting OrderId cannot accidentally receive CustomerId.
```

### Entity Equality

Entity equality is based on identity, not all attributes.

Two loaded instances representing the same order ID refer to the same conceptual entity:

```text
Order A: Id 42, status Draft
Order B: Id 42, status Submitted
```

They may represent different snapshots in time, but they are not different orders.

Important considerations:

- A transient entity may not yet have a database-generated ID.
- Equality must not change when mutable properties change.
- ORM tracking identity and domain identity are related but not identical concerns.
- Strongly typed identifiers make identity explicit.

Avoid using every property in entity equality because changing an address or status would make the entity appear to become a different object.

### Entity Lifecycle

Entities have meaningful lifecycle transitions:

```text
Draft -> Submitted -> Paid -> Shipped
                  \-> Cancelled
```

Methods should represent allowed domain transitions:

```csharp
public void Cancel(CancellationReason reason)
{
    if (Status is OrderStatus.Shipped or OrderStatus.Cancelled)
    {
        throw new DomainRuleViolation(
            $"An order in status {Status} cannot be cancelled.");
    }

    CancellationReason = reason;
    Status = OrderStatus.Cancelled;
}
```

A generic `SetStatus` method would let callers bypass transition rules.

### Value Objects

A value object has no independent identity. Its meaning is determined by its attributes.

Examples include:

- Money.
- Date range.
- Address.
- Email address.
- Geographic coordinate.
- Measurement.
- Percentage.

Two value objects with the same values are conceptually equal:

```text
Money(10, "USD") equals Money(10, "USD")
```

Value objects should usually be:

- Immutable.
- Structurally equal.
- Self-validating.
- Side-effect free.
- Replaceable as a whole.

### Implementing a Value Object in C#

C# records provide structural equality and concise immutable modeling:

```csharp
public sealed record Money
{
    public decimal Amount { get; }
    public string Currency { get; }

    private Money(decimal amount, string currency)
    {
        if (currency.Length != 3)
        {
            throw new ArgumentException(
                "Currency must be a three-letter code.",
                nameof(currency));
        }

        Amount = amount;
        Currency = currency.ToUpperInvariant();
    }

    public static Money Of(decimal amount, string currency) =>
        new(amount, currency);

    public Money Add(Money other)
    {
        if (Currency != other.Currency)
        {
            throw new DomainRuleViolation(
                "Money values must use the same currency.");
        }

        return Of(Amount + other.Amount, Currency);
    }
}
```

Usage:

```csharp
var first = Money.Of(10m, "usd");
var second = Money.Of(10m, "USD");

Console.WriteLine(first == second); // True
```

The factory validates and normalizes the value so invalid currency codes do not enter the model.

### Value Object Versus Entity

Ask whether the concept must be tracked independently through time.

Model it as an entity when:

- Identity matters beyond its current values.
- Its history or lifecycle matters.
- Other objects reference that specific instance.
- Two instances with equal attributes can still be distinct.

Model it as a value object when:

- Only its attributes matter.
- Equal values are interchangeable.
- It should be replaced rather than mutated.
- It belongs to another object's state.

An address illustrates the contextual nature of the decision:

- A shipping address captured on an order can be a value object.
- A managed property address with verification history may be an entity.

The correct choice depends on the bounded context, not on the noun alone.

### Primitive Obsession

Primitive obsession occurs when domain concepts are represented only by strings, numbers, and booleans.

```csharp
Task Register(string email, decimal creditLimit, string currency);
```

This allows invalid and mixed values. Domain types improve meaning:

```csharp
Task Register(
    EmailAddress email,
    Money creditLimit);
```

Benefits include:

- Validation in one place.
- Fewer parameter-order mistakes.
- Clearer method signatures.
- Domain operations on the correct type.
- Better compiler assistance.

Not every primitive needs a wrapper. Introduce a domain type when it carries rules, units, normalization, or meaningful behavior.

### Aggregates

An aggregate is a cluster of domain objects treated as one consistency and transactional boundary.

It contains:

- One aggregate root entity.
- Zero or more child entities.
- Zero or more value objects.
- Invariants that the root protects.

External code accesses the aggregate through the root. It should not directly change child entities.

Example:

```text
Order aggregate

Order (root)
  OrderLine (child entity)
  ShippingAddress (value object)
  Money (value object)
```

The aggregate root controls operations:

```csharp
public sealed class Order
{
    private readonly List<OrderLine> _lines = [];

    public OrderId Id { get; }
    public OrderStatus Status { get; private set; }
    public IReadOnlyCollection<OrderLine> Lines => _lines.AsReadOnly();

    public void AddLine(
        ProductId productId,
        string productName,
        Money unitPrice,
        int quantity)
    {
        EnsureDraft();

        if (quantity <= 0)
        {
            throw new DomainRuleViolation(
                "Quantity must be greater than zero.");
        }

        var existing = _lines.SingleOrDefault(
            line => line.ProductId == productId);

        if (existing is null)
        {
            _lines.Add(new OrderLine(
                OrderLineId.New(),
                productId,
                productName,
                unitPrice,
                quantity));
        }
        else
        {
            existing.IncreaseQuantity(quantity);
        }
    }

    private void EnsureDraft()
    {
        if (Status != OrderStatus.Draft)
        {
            throw new DomainRuleViolation(
                "Only draft orders can be changed.");
        }
    }
}
```

Callers cannot add invalid lines directly to the collection.

### Aggregate Root Responsibilities

The aggregate root:

- Provides the public entry point for aggregate changes.
- Protects invariants.
- Coordinates child entities and value objects.
- Defines the unit loaded and saved by a repository.
- Emits domain events when relevant facts occur.
- Controls references exposed outside the aggregate.

The root should not become a container for every operation related to a concept. Behavior that does not require aggregate state may belong in a value object, domain service, application service, or another aggregate.

### Invariants

An invariant is a business condition that must remain true whenever an aggregate operation completes.

Examples:

- An order must contain at least one line before submission.
- A line quantity must be positive.
- A bank account cannot exceed its overdraft limit.
- A booking end time must be after its start time.
- A shipment cannot be dispatched twice.
- A discount cannot make a total negative.

An invariant is stronger than a UI validation rule. Every write path must preserve it, including APIs, background jobs, imports, tests, and administrative tools.

### Enforcing Invariants

Protect invariants by:

- Restricting property setters.
- Validating constructors and factories.
- Exposing intention-revealing methods.
- Keeping collections private.
- Rejecting invalid transitions.
- Performing operations atomically within the aggregate.
- Using database constraints as defense in depth.

Example:

```csharp
public sealed record DateRange
{
    public DateOnly Start { get; }
    public DateOnly End { get; }

    public DateRange(DateOnly start, DateOnly end)
    {
        if (end < start)
        {
            throw new DomainRuleViolation(
                "The end date cannot precede the start date.");
        }

        Start = start;
        End = end;
    }
}
```

No valid `DateRange` instance can contain reversed dates.

### Validation Versus Invariants

The terms overlap but have useful distinctions.

**Input validation** checks whether a request is well formed:

- A required field is present.
- A string has an allowed length.
- A value can be parsed.
- A request follows an API schema.

**Domain invariants** protect business truth:

- Only an approved customer can place an order on credit.
- A confirmed booking cannot overlap another confirmed booking.
- A paid order cannot return to draft.

Input validation can provide friendly errors before invoking the domain. The domain must still protect invariants because it cannot trust every caller.

### Always-Valid Versus Deferred Validation

The always-valid model approach rejects invalid state immediately. It works well for rules that must never be violated.

Some workflows legitimately collect incomplete information:

```text
Application form:
  Draft -> Submitted -> Approved
```

A draft may omit information required for submission. Model this explicitly:

- Allow incomplete fields only in the `Draft` state.
- Enforce submission requirements in `Submit`.
- Use distinct types or states when that improves clarity.

Do not weaken all invariants merely because one workflow has staged validation.

### Choosing Aggregate Boundaries

An aggregate boundary should contain state that must be immediately consistent to enforce a business rule.

Questions to ask:

- Which values must change atomically?
- Which rules require this state to be inspected together?
- What is the true consistency boundary?
- Can another concept be referenced by ID?
- How large is the object graph under normal load?
- How much concurrent editing occurs?

An order and its lines often form one aggregate because totals and submission rules require immediate consistency. A customer and every order the customer has ever placed usually should not be one aggregate.

### Keep Aggregates Small

Large aggregates cause:

- Excessive data loading.
- More lock and concurrency contention.
- Long transactions.
- Accidental coupling.
- Difficult serialization and testing.
- Changes to unrelated child objects conflicting.

Prefer:

- One root with only the state needed for its invariants.
- References to other aggregates by ID.
- Separate transactions for independent consistency boundaries.
- Domain events for cross-aggregate reactions.

Small does not mean one entity per aggregate. It means no larger than required for transactional consistency.

### References Between Aggregates

Reference another aggregate by identity:

```csharp
public sealed class Order
{
    public CustomerId CustomerId { get; private set; }
}
```

rather than retaining a mutable object graph:

```csharp
public sealed class Order
{
    public Customer Customer { get; private set; }
}
```

Identity references:

- Make boundaries visible.
- Avoid accidental cross-aggregate mutation.
- Reduce graph loading.
- Allow independent persistence and lifecycle.

The application layer can load multiple aggregates when a use case needs them, but one aggregate should not silently modify another.

### Repositories and Aggregates

A repository should normally operate on aggregate roots:

```csharp
public interface IOrderRepository
{
    Task<Order?> GetAsync(
        OrderId id,
        CancellationToken cancellationToken);

    Task AddAsync(
        Order order,
        CancellationToken cancellationToken);
}
```

Avoid repositories for every child entity:

```text
IOrderRepository
IOrderLineRepository
IShippingAddressRepository
```

Saving child objects independently can bypass root invariants.

Repository methods should express useful retrieval and persistence needs, not expose unrestricted `IQueryable` across architectural boundaries.

### Transactions and Aggregate Consistency

One transaction should generally update one aggregate. This keeps locking and failure handling local.

There are exceptions, especially in a monolith with a business rule that truly spans state, but frequent multi-aggregate transactions may indicate:

- Incorrect aggregate boundaries.
- A workflow that should use eventual consistency.
- A missing domain concept.
- Excessively strict consistency requirements.

The transaction boundary should follow the invariant, not an arbitrary table or service boundary.

### Cross-Aggregate Rules

Some rules involve several aggregates:

- A customer credit limit compared with new orders.
- Inventory availability across multiple reservations.
- Unique usernames.
- Scheduling conflicts across bookings.

Possible enforcement mechanisms include:

- A domain service querying authoritative state.
- A database uniqueness or check constraint.
- Serializable or appropriately isolated transactions.
- Optimistic concurrency with retry.
- Reservation models.
- Eventually consistent policies and compensation.

Do not pretend an in-memory object method alone can guarantee a rule under concurrent requests.

### Concurrency and Invariants

Two requests can each observe valid state and collectively violate a rule.

Example:

```text
Available inventory: 1

Request A reads 1 and reserves 1.
Request B reads 1 and reserves 1.
```

Domain validation in both requests succeeds unless persistence provides concurrency control.

Options include:

- Optimistic concurrency tokens.
- Pessimistic locking.
- Unique constraints.
- Appropriate transaction isolation.
- Atomic database updates.
- Queued or single-writer processing.
- Reservation with expiration.

EF Core optimistic concurrency example:

```csharp
public sealed class InventoryItem
{
    public ProductId Id { get; private set; }
    public int AvailableQuantity { get; private set; }
    public byte[] Version { get; private set; } = [];
}
```

```csharp
builder.Property(item => item.Version)
    .IsRowVersion();
```

The application must handle `DbUpdateConcurrencyException`, reload or reject the operation, and preserve the business rule.

### Domain Events and Aggregate Boundaries

An aggregate can record a domain event when a meaningful state change occurs:

```csharp
public sealed record OrderSubmittedDomainEvent(
    OrderId OrderId,
    CustomerId CustomerId);
```

Domain events can:

- Trigger reactions in the same bounded context.
- Coordinate eventual consistency across aggregates.
- Keep the aggregate focused on its own invariants.

Events do not make all rules immediately consistent. If a business rule requires atomic enforcement, an asynchronous event may be insufficient.

Distinguish:

- **Domain event**: internal domain fact, often rich and scoped to a bounded context.
- **Integration event**: stable external contract published after persistence succeeds.

### Domain Services

A domain service contains domain logic that does not naturally belong to one entity or value object.

Example:

```csharp
public sealed class PricingPolicy
{
    public Money CalculatePrice(
        Product product,
        CustomerTier tier,
        Promotion? promotion)
    {
        // Domain calculation involving several concepts.
    }
}
```

Use a domain service when:

- The operation is a meaningful domain concept.
- It needs several domain objects.
- Assigning it to one object would distort responsibility.

Do not move all behavior into services. That produces an anemic domain model where entities are passive data containers.

### Application Services Versus Domain Objects

An application service coordinates a use case:

- Loads aggregates.
- Calls domain behavior.
- Invokes external ports.
- Saves changes.
- Manages the transaction.

```csharp
public sealed class SubmitOrderHandler
{
    private readonly IOrderRepository _orders;
    private readonly IUnitOfWork _unitOfWork;

    public async Task Handle(
        SubmitOrder command,
        CancellationToken cancellationToken)
    {
        var order = await _orders.GetAsync(
            command.OrderId,
            cancellationToken)
            ?? throw new OrderNotFoundException(command.OrderId);

        order.Submit();

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
```

The application service controls workflow. The aggregate decides whether submission is valid.

### Persistence Ignorance

Persistence ignorance means the domain model is not designed primarily around storage technology. It does not mean the team ignores persistence constraints.

A practical domain model may include:

- Private parameterless constructors for an ORM.
- Backing fields.
- Persistence-compatible collection mappings.
- Concurrency properties.

The important point is that database concerns should not determine business meaning or expose invalid operations.

### Mapping Value Objects With EF Core

EF Core can map value-like structures using complex types or owned entity types, depending on the model and framework version.

Example complex property configuration:

```csharp
builder.ComplexProperty(
    order => order.ShippingAddress,
    address =>
    {
        address.Property(value => value.Line1)
            .HasMaxLength(200);
        address.Property(value => value.City)
            .HasMaxLength(100);
        address.Property(value => value.PostalCode)
            .HasMaxLength(20);
    });
```

Owned-type configuration is another option:

```csharp
builder.OwnsOne(
    order => order.Total,
    money =>
    {
        money.Property(value => value.Amount)
            .HasColumnName("TotalAmount");
        money.Property(value => value.Currency)
            .HasColumnName("TotalCurrency")
            .HasMaxLength(3);
    });
```

Choose mapping based on semantic needs and supported EF Core capabilities. Do not give a value object artificial domain identity merely to satisfy a persistence design.

### Mapping Aggregate Collections

Private collections can be mapped while preserving encapsulation:

```csharp
public sealed class Order
{
    private readonly List<OrderLine> _lines = [];

    public IReadOnlyCollection<OrderLine> Lines => _lines;
}
```

Configuration:

```csharp
builder.HasMany<OrderLine>("_lines")
    .WithOne()
    .HasForeignKey("OrderId")
    .OnDelete(DeleteBehavior.Cascade);

builder.Navigation("_lines")
    .UsePropertyAccessMode(PropertyAccessMode.Field);
```

Persistence configuration adapts to the domain model rather than requiring public mutable collections.

### Database Constraints as Defense in Depth

The domain model should enforce business rules, but database constraints protect against:

- Concurrent writes.
- Migration scripts.
- Administrative tools.
- Bugs in alternate write paths.

Useful constraints include:

- Unique indexes.
- Foreign keys.
- Check constraints.
- Non-null constraints.
- Concurrency tokens.

Database constraints should reinforce rather than replace meaningful domain behavior.

### Error Handling

Invariant violations can be represented with:

- Domain-specific exceptions.
- Result types.
- Validation error collections.
- Explicit state-transition results.

Choose based on local conventions and expected control flow.

For expected user-correctable failures:

```csharp
public sealed record DomainError(
    string Code,
    string Message);
```

For impossible programmer misuse, an exception may be clearer. Do not silently accept invalid state.

### When a Rich Domain Model Is Unnecessary

Not every part of an application needs entities, aggregates, and domain services.

A simpler transaction-script or CRUD model may be appropriate when:

- Rules are minimal.
- Data is mainly captured and displayed.
- Workflows are straightforward.
- The context is generic or administrative.
- Complexity lies in integration rather than domain behavior.

Apply DDD patterns where they reduce real business complexity. Excessive factories, repositories, and aggregate wrappers around simple records can obscure rather than clarify.

### Trade-Offs

Benefits include:

- Business rules live near the state they protect.
- Invalid states are harder to represent.
- Code communicates domain intent.
- Aggregate boundaries clarify transactions and ownership.
- Tests can target business behavior.

Costs include:

- More modeling effort.
- Additional domain types.
- ORM mapping complexity.
- Need for domain expertise.
- Potential performance issues if aggregate boundaries are too large.
- Risk of ceremony in simple contexts.

### Common Mistakes

- Treating every database row as an aggregate root.
- Using entities as mutable data bags with public setters.
- Creating value objects that remain mutable.
- Giving value objects artificial identity.
- Comparing entities by every property.
- Making aggregates too large.
- Letting callers modify child collections directly.
- Creating repositories for child entities.
- Holding direct object references to many other aggregates.
- Enforcing rules only in controllers or validators.
- Ignoring concurrency when protecting cross-request invariants.
- Assuming domain events provide immediate consistency.
- Designing the domain model around ORM convenience.
- Applying tactical DDD to simple CRUD without benefit.

### Best Practices

- Model identity explicitly for entities.
- Use immutable, structurally equal value objects for meaningful values.
- Put state-changing behavior on the object that owns the rule.
- Make invalid transitions impossible or explicit.
- Draw aggregate boundaries around true consistency needs.
- Keep aggregates as small as their invariants permit.
- Access child entities through the aggregate root.
- Reference other aggregates by identity.
- Use one repository per aggregate root where repositories add value.
- Reinforce critical invariants with database and concurrency controls.
- Keep application orchestration separate from domain decisions.
- Use domain events for meaningful facts, not every property change.
- Let persistence adapt to the model while acknowledging practical constraints.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the difference between an entity and a value object?

<!-- question:start:entities-value-objects-aggregates-and-invariants-beginner-q01 -->
<!-- question-id:entities-value-objects-aggregates-and-invariants-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

An entity is distinguished by stable identity and has a lifecycle, even when its attributes change. A value object has no independent identity and is defined by its attributes, so equal values are interchangeable. Value objects are usually immutable and replaced as a whole. The same real-world noun can be either depending on the bounded context and whether independent identity matters.

##### Key Points to Mention

- Entity equality is identity-based.
- Value-object equality is structural.
- Entities have lifecycle and continuity.
- Modeling depends on context, not grammatical category.

<!-- question:end:entities-value-objects-aggregates-and-invariants-beginner-q01 -->

#### What is an aggregate in Domain-Driven Design?

<!-- question:start:entities-value-objects-aggregates-and-invariants-beginner-q02 -->
<!-- question-id:entities-value-objects-aggregates-and-invariants-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

An aggregate is a cluster of entities and value objects treated as one consistency and transactional boundary. One entity is the aggregate root. External code uses the root to perform changes, and the root protects the invariants of the whole aggregate. The aggregate should contain only state that must remain immediately consistent together.

##### Key Points to Mention

- It is a consistency boundary, not just an object graph.
- One entity acts as the aggregate root.
- Child objects should not be changed directly by external callers.
- Repositories normally load and save roots.

<!-- question:end:entities-value-objects-aggregates-and-invariants-beginner-q02 -->

#### What is a domain invariant?

<!-- question:start:entities-value-objects-aggregates-and-invariants-beginner-q03 -->
<!-- question-id:entities-value-objects-aggregates-and-invariants-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A domain invariant is a business condition that must remain true whenever a domain operation completes. Examples include a positive order-line quantity or preventing a shipped order from returning to draft. The model protects invariants through constructors, restricted setters, intention-revealing methods, private collections, and transactional or database controls.

##### Key Points to Mention

- An invariant expresses business truth.
- Every write path must preserve it.
- UI validation alone is insufficient.
- Concurrency and persistence constraints may be necessary.

<!-- question:end:entities-value-objects-aggregates-and-invariants-beginner-q03 -->

#### Why are value objects usually immutable?

<!-- question:start:entities-value-objects-aggregates-and-invariants-beginner-q04 -->
<!-- question-id:entities-value-objects-aggregates-and-invariants-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A value object represents one complete value. Immutability ensures it cannot change into an invalid value after construction, keeps structural equality stable, avoids hidden shared-state mutations, and makes operations easier to reason about. A change produces a new value object rather than altering the existing one.

##### Key Points to Mention

- Construction validates the complete value.
- Equality remains predictable.
- Replacement avoids partial mutation.
- C# records are useful but validation may still be required.

<!-- question:end:entities-value-objects-aggregates-and-invariants-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How do you choose an aggregate boundary?

<!-- question:start:entities-value-objects-aggregates-and-invariants-intermediate-q01 -->
<!-- question-id:entities-value-objects-aggregates-and-invariants-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Identify the business invariants and state that must be inspected and changed atomically. Place that state under one root and keep unrelated lifecycle or consistency concerns in separate aggregates. Consider load size, concurrency, transaction duration, and whether another concept can be referenced by ID. The boundary should be no larger than required to protect immediate consistency.

##### Key Points to Mention

- Start from invariants, not table relationships.
- Keep aggregates small.
- Reference other aggregates by identity.
- Repeated multi-aggregate transactions may reveal a boundary problem.

<!-- question:end:entities-value-objects-aggregates-and-invariants-intermediate-q01 -->

#### What is the difference between application validation and domain invariant enforcement?

<!-- question:start:entities-value-objects-aggregates-and-invariants-intermediate-q02 -->
<!-- question-id:entities-value-objects-aggregates-and-invariants-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Application or input validation checks whether a request is complete and well formed and can return friendly errors early. Domain invariant enforcement protects business truth regardless of the caller. The same domain operation may be invoked from an API, import, background job, or test, so the aggregate must not rely on one external validator.

##### Key Points to Mention

- Validation at the boundary improves usability.
- Domain rules remain inside the model.
- Duplicate simple checks can be acceptable for defense and error quality.
- Staged workflows should model when stricter rules become active.

<!-- question:end:entities-value-objects-aggregates-and-invariants-intermediate-q02 -->

#### Why should other aggregates usually be referenced by ID?

<!-- question:start:entities-value-objects-aggregates-and-invariants-intermediate-q03 -->
<!-- question-id:entities-value-objects-aggregates-and-invariants-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

An identity reference keeps aggregate boundaries explicit and prevents one aggregate from directly mutating another. It reduces object-graph loading, persistence coupling, and transaction scope. The application layer can load another aggregate or query a read model when required. Direct references are acceptable only when the referenced object is actually part of the same consistency boundary.

##### Key Points to Mention

- IDs preserve independent lifecycle and ownership.
- Avoid navigation graphs that imply one giant aggregate.
- Cross-aggregate coordination belongs outside one root.
- Read needs do not automatically define write boundaries.

<!-- question:end:entities-value-objects-aggregates-and-invariants-intermediate-q03 -->

#### How would you persist value objects and private aggregate collections with EF Core?

<!-- question:start:entities-value-objects-aggregates-and-invariants-intermediate-q04 -->
<!-- question-id:entities-value-objects-aggregates-and-invariants-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Map value-like properties using EF Core complex types or owned entity types according to the required semantics and supported version. Configure private backing fields and field access for child collections so the aggregate can expose read-only views. Keep persistence configuration in infrastructure and avoid adding public setters or artificial identity solely for ORM convenience.

##### Key Points to Mention

- Complex and owned mappings serve different persistence semantics.
- Backing fields preserve encapsulation.
- Persistence should adapt to the domain model.
- Practical ORM accommodations are acceptable when they do not expose invalid behavior.

<!-- question:end:entities-value-objects-aggregates-and-invariants-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How do you protect an invariant that spans multiple requests under concurrency?

<!-- question:start:entities-value-objects-aggregates-and-invariants-advanced-q01 -->
<!-- question-id:entities-value-objects-aggregates-and-invariants-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

In-memory checks are insufficient because concurrent requests can read the same valid state. Use a persistence mechanism appropriate to the invariant: optimistic concurrency and retry, pessimistic locking, unique or check constraints, atomic updates, transaction isolation, reservations, or serialized processing. The application must handle conflicts explicitly rather than treating a concurrency exception as an unexpected technical failure.

##### Key Points to Mention

- Domain code and storage controls work together.
- Choose the mechanism from contention and consistency requirements.
- Database constraints provide authoritative enforcement for some rules.
- Conflict handling is part of the use-case design.

<!-- question:end:entities-value-objects-aggregates-and-invariants-advanced-q01 -->

#### How should a business process that spans several aggregates be modeled?

<!-- question:start:entities-value-objects-aggregates-and-invariants-advanced-q02 -->
<!-- question-id:entities-value-objects-aggregates-and-invariants-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

First determine whether the rule truly requires atomic consistency. If it does, reconsider the aggregate boundary or use a carefully scoped transaction and concurrency controls. If delayed consistency is acceptable, coordinate the process with an application service, process manager, or domain events. Each aggregate preserves its own invariants, while the workflow handles retries, idempotency, compensation, and observable progress.

##### Key Points to Mention

- Do not enlarge aggregates solely to avoid workflow design.
- Immediate versus eventual consistency is a business decision.
- Events do not make cross-aggregate rules atomic.
- Long-running processes need explicit state and recovery.

<!-- question:end:entities-value-objects-aggregates-and-invariants-advanced-q02 -->

#### What problems result from making an aggregate too large?

<!-- question:start:entities-value-objects-aggregates-and-invariants-advanced-q03 -->
<!-- question-id:entities-value-objects-aggregates-and-invariants-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

A large aggregate loads and locks more data, increases transaction duration, creates concurrency conflicts between unrelated changes, and couples independent lifecycles. It can also become difficult to test and reason about. Split state that does not need immediate consistency into separate aggregates and coordinate through IDs, queries, or events.

##### Key Points to Mention

- Database relationships do not determine aggregate boundaries.
- Concurrency contention is an important design signal.
- Keep only invariant-critical state together.
- Reads can use projections without expanding the write aggregate.

<!-- question:end:entities-value-objects-aggregates-and-invariants-advanced-q03 -->

#### How do you avoid an anemic domain model without putting all logic into aggregate roots?

<!-- question:start:entities-value-objects-aggregates-and-invariants-advanced-q04 -->
<!-- question-id:entities-value-objects-aggregates-and-invariants-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Place behavior with the state and rules it naturally owns: entities manage lifecycle, value objects manage value semantics, and aggregate roots protect aggregate invariants. Use domain services for meaningful operations that span several domain concepts without belonging to one object. Keep application services focused on orchestration, persistence, and external calls. Avoid both passive data bags and oversized roots that absorb unrelated responsibilities.

##### Key Points to Mention

- Behavior follows domain responsibility.
- Domain services are not generic application service classes.
- Application services coordinate but should not decide core business validity.
- Rich modeling should remain proportional to domain complexity.

<!-- question:end:entities-value-objects-aggregates-and-invariants-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
