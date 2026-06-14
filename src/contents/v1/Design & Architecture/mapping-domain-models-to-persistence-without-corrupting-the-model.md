---
id: mapping-domain-models-to-persistence-without-corrupting-the-model
topic: Domain modeling and Domain-Driven Design
subtopic: Mapping domain models to persistence without corrupting the model
category: Design & Architecture
---

## Overview

Mapping a domain model to persistence means storing and restoring entities, value objects, aggregates, and domain state without allowing database or ORM concerns to dictate the model's business meaning.

The goal is not to make the domain completely unaware that persistence exists. The goal is to preserve:

- Intention-revealing domain behavior.
- Encapsulation.
- Valid state and invariants.
- Aggregate boundaries.
- Domain-specific types.
- Independence from accidental schema details.

In .NET, Entity Framework Core can map rich domain models using constructors, private setters, backing fields, field-only properties, owned entity types, complex types, value converters, explicit configuration, and concurrency tokens. These features often allow one domain class to serve as the persisted entity without adding public mutation or persistence attributes to the domain layer.

Sometimes the mismatch between the domain and storage models is too large. A separate persistence model and explicit mapping can then preserve the domain at the cost of more code and synchronization.

This topic is important in interviews because it tests practical architectural judgment. A strong candidate can explain:

- Persistence ignorance without treating it as absolute purity.
- How to map encapsulated aggregates with EF Core.
- When to use a domain model directly and when to separate persistence models.
- How repositories and units of work relate to aggregate roots.
- How to preserve invariants during materialization and updates.
- How concurrency and database constraints support domain correctness.
- Which query paths should bypass the write model.

## Core Concepts

### The Persistence Impedance Mismatch

Object-oriented domain models and relational databases represent data differently.

Domain models emphasize:

- Behavior.
- Encapsulation.
- Identity and lifecycle.
- Aggregate consistency.
- Value objects.
- References by domain identity.

Relational databases emphasize:

- Tables and rows.
- Primary and foreign keys.
- Normalization.
- Set-based queries.
- Constraints and indexes.
- Joins.

The **object-relational impedance mismatch** is the friction between these models.

Examples include:

- A value object maps to several columns.
- A private child collection maps to another table.
- An inheritance hierarchy maps awkwardly to relational structures.
- A strongly typed ID must map to a primitive column.
- An aggregate boundary does not match every foreign-key relationship.

An ORM reduces this mismatch but does not remove it.

### Persistence Ignorance

Persistence ignorance means the domain model is designed around domain concepts rather than storage mechanics.

A persistence-ignorant model does not expose:

- Public setters only for an ORM.
- `Save`, `Delete`, or `Load` methods on entities.
- SQL queries.
- `DbContext`.
- Lazy-loading proxies as domain behavior.
- Database column names as business terminology.

It may still make pragmatic accommodations:

- A private parameterless constructor.
- A private setter for a generated key.
- A concurrency token.
- Backing fields.
- Persistence configuration outside the domain assembly.

The test is whether persistence concerns change the model's public meaning or permit invalid behavior.

### Persistence Ignorance Is Not Persistence Unawareness

Storage capabilities affect architecture:

- Relational transactions influence aggregate consistency.
- Document databases favor whole-aggregate storage.
- Query and index requirements influence read models.
- Concurrency mechanisms determine how invariants survive races.
- Identifier generation affects entity construction.

Ignoring these facts can create an elegant model that performs poorly or cannot preserve its rules.

Good design keeps technical details outside the domain's public API while considering them during architecture and mapping.

### Domain Model First

Start by modeling:

- Business identity.
- Valid construction.
- State transitions.
- Invariants.
- Aggregate boundaries.
- Value semantics.

Then design persistence mapping around that model.

Avoid beginning with:

```text
Table -> generated entity -> public setters -> service-layer rules
```

Prefer:

```text
Domain behavior and invariants
  -> aggregate model
  -> explicit persistence mapping
  -> relational schema
```

Database constraints and performance requirements still feed back into the design, but they should not erase domain meaning.

### Direct Mapping Versus Separate Persistence Models

There are two common approaches.

**Direct mapping**

EF Core maps domain entities and value objects directly.

Benefits:

- Less duplication.
- No domain-to-persistence mapping layer.
- Change tracking works naturally.
- Simpler for many business applications.

Costs:

- ORM constraints can influence class design.
- Complex mappings require careful configuration.
- Persistence concerns can leak if discipline is weak.

**Separate persistence model**

Infrastructure defines storage-specific records or entities and maps them to the domain.

Benefits:

- Strong separation from ORM and schema.
- Domain and storage can evolve independently.
- Useful for legacy schemas, event stores, or large mismatches.

Costs:

- Duplicate structures.
- Mapping code and tests.
- Risk of mappings becoming incomplete.
- More work for inserts, updates, identity, and concurrency.

Use the simplest approach that preserves the model. Separate models are not automatically more correct.

### An Encapsulated Aggregate

Consider an order aggregate:

```csharp
public sealed class Order : AggregateRoot
{
    private readonly List<OrderLine> _lines = [];

    private Order()
    {
        // Used by the persistence mechanism.
    }

    private Order(
        OrderId id,
        CustomerId customerId,
        ShippingAddress shippingAddress)
    {
        Id = id;
        CustomerId = customerId;
        ShippingAddress = shippingAddress;
        Status = OrderStatus.Draft;
    }

    public OrderId Id { get; private set; }
    public CustomerId CustomerId { get; private set; }
    public ShippingAddress ShippingAddress { get; private set; }
    public OrderStatus Status { get; private set; }
    public IReadOnlyCollection<OrderLine> Lines => _lines.AsReadOnly();

    public static Order Create(
        CustomerId customerId,
        ShippingAddress shippingAddress) =>
        new(OrderId.New(), customerId, shippingAddress);

    public void AddLine(
        ProductId productId,
        Money unitPrice,
        int quantity)
    {
        EnsureDraft();

        if (quantity <= 0)
        {
            throw new DomainRuleViolation(
                "Quantity must be positive.");
        }

        _lines.Add(OrderLine.Create(
            OrderLineId.New(),
            productId,
            unitPrice,
            quantity));
    }
}
```

The public API exposes construction and behavior, not persistence mutation.

### Keep EF Core Configuration in Infrastructure

Use `IEntityTypeConfiguration<T>` to separate mappings from domain classes:

```csharp
internal sealed class OrderConfiguration
    : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Orders", "ordering");

        builder.HasKey(order => order.Id);

        builder.Property(order => order.Id)
            .HasConversion(
                id => id.Value,
                value => new OrderId(value))
            .ValueGeneratedNever();

        builder.Property(order => order.Status)
            .HasConversion<string>()
            .HasMaxLength(30);
    }
}
```

Benefits:

- The domain assembly has no EF Core attribute dependency.
- Schema changes remain infrastructure concerns.
- Mapping is centralized and testable.
- The domain model's public API stays focused.

Attributes can be acceptable in simple applications, but fluent mapping gives stronger separation and more control.

### Constructors and Materialization

EF Core can use parameterized constructors when parameters match mapped properties. It can also set private properties and fields through configured access.

A useful pattern is:

- Public or static factories for valid new instances.
- Private or protected constructors for materialization.
- Private setters or fields for persisted state.
- Domain methods for all normal changes.

Be careful with constructor validation during materialization:

- The stored data may predate a new invariant.
- A migration may temporarily transform values.
- EF may construct objects in an order different from business creation.

Do not silently accept corrupt data, but plan how schema migration and model evolution will bring historical data into the new valid form.

### Private Setters

Private setters let EF Core materialize data while preventing normal callers from mutating state:

```csharp
public sealed class Subscription
{
    public SubscriptionId Id { get; private set; }
    public SubscriptionStatus Status { get; private set; }
    public DateRange ActivePeriod { get; private set; }

    private Subscription()
    {
    }

    public void Cancel(Instant cancelledAt)
    {
        // Domain transition rules.
    }
}
```

A private setter is not complete encapsulation by itself. The public methods must still enforce valid transitions, and reflection-based infrastructure should remain confined to persistence.

### Backing Fields

Backing fields allow persistence without exposing mutable properties.

```csharp
public sealed class Customer
{
    private string _normalizedEmail = string.Empty;

    public EmailAddress Email =>
        EmailAddress.FromNormalized(_normalizedEmail);

    public void ChangeEmail(EmailAddress email)
    {
        _normalizedEmail = email.Normalized;
    }
}
```

Configuration:

```csharp
builder.Property<string>("_normalizedEmail")
    .HasColumnName("NormalizedEmail")
    .HasMaxLength(320);
```

Backing fields are also useful for collections:

```csharp
private readonly List<OrderLine> _lines = [];
public IReadOnlyCollection<OrderLine> Lines => _lines.AsReadOnly();
```

```csharp
builder.HasMany<OrderLine>("_lines")
    .WithOne()
    .HasForeignKey("OrderId");

builder.Navigation("_lines")
    .UsePropertyAccessMode(PropertyAccessMode.Field);
```

This prevents callers from bypassing aggregate methods.

### Field-Only Properties

Some persisted state does not need a public domain property:

```csharp
builder.Property<DateTimeOffset>("_lastPersistedAt")
    .HasColumnName("LastPersistedAt");
```

Field-only properties can store technical metadata such as:

- Persistence timestamps.
- Row versions.
- Internal keys.

Do not expose technical metadata through the domain API unless it has domain meaning.

### Strongly Typed Identifiers

Strongly typed IDs prevent accidental identifier mixing:

```csharp
public readonly record struct OrderId(Guid Value);
public readonly record struct CustomerId(Guid Value);
```

Map them with value converters:

```csharp
builder.Property(order => order.Id)
    .HasConversion(
        id => id.Value,
        value => new OrderId(value));

builder.Property(order => order.CustomerId)
    .HasConversion(
        id => id.Value,
        value => new CustomerId(value));
```

Reusable conventions can reduce repeated configuration, but keep converter behavior explicit and tested.

### Value Objects

Value objects can be persisted using:

- Complex types.
- Owned entity types.
- Multiple explicitly mapped columns.
- A value converter for a single-column representation.
- JSON storage where appropriate.

The choice depends on semantics and query needs.

For an address:

```csharp
public sealed record ShippingAddress(
    string Line1,
    string City,
    string PostalCode,
    string CountryCode);
```

A complex-property mapping can represent a structured value without independent identity:

```csharp
builder.ComplexProperty(
    order => order.ShippingAddress,
    address =>
    {
        address.Property(value => value.Line1)
            .HasColumnName("ShipLine1")
            .HasMaxLength(200);

        address.Property(value => value.City)
            .HasColumnName("ShipCity")
            .HasMaxLength(100);

        address.Property(value => value.PostalCode)
            .HasColumnName("ShipPostalCode")
            .HasMaxLength(20);

        address.Property(value => value.CountryCode)
            .HasColumnName("ShipCountryCode")
            .HasMaxLength(2);
    });
```

Owned entity types are another option when ownership and table-splitting semantics are appropriate. Choose based on the EF Core version and required model behavior.

### Single-Column Value Converters

A simple value object can map to one column:

```csharp
public readonly record struct EmailAddress(string Value);
```

```csharp
builder.Property(customer => customer.Email)
    .HasConversion(
        email => email.Value,
        value => new EmailAddress(value))
    .HasMaxLength(320);
```

Value converters are well suited to:

- Strongly typed IDs.
- Small immutable wrappers.
- Enums with explicit storage.
- Simple encoded values.

Avoid serializing a complex, frequently queried value into one opaque string merely to simplify mapping. It reduces indexing, constraints, and queryability.

### Value Comparers

EF Core change tracking must know how to compare and snapshot converted values. Immutable value types often work naturally. Mutable or collection-backed values may require a `ValueComparer`.

Prefer immutable domain values. If a custom comparer is necessary:

- Define structural equality.
- Define a stable hash.
- Create a correct snapshot.
- Test update detection.

An incorrect comparer can cause missed updates or unnecessary writes.

### Owned Entities Versus Complex Types

Both can map value-like structures, but they are not identical.

Consider:

- Whether the object has persistence identity.
- Whether it is exclusively owned.
- Whether it can be shared by multiple owners.
- Collection support.
- Table mapping needs.
- EF Core version capabilities.

The domain concept should remain a value object if it has value semantics. Do not promote it to a domain entity merely because the ORM uses internal keys for tracking.

### Mapping Child Entities

A child entity inside an aggregate has identity within that aggregate:

```csharp
public sealed class OrderLine
{
    public OrderLineId Id { get; private set; }
    public ProductId ProductId { get; private set; }
    public Money UnitPrice { get; private set; }
    public int Quantity { get; private set; }
}
```

Map it as part of the aggregate:

```csharp
builder.HasMany<OrderLine>("_lines")
    .WithOne()
    .HasForeignKey("OrderId")
    .IsRequired()
    .OnDelete(DeleteBehavior.Cascade);
```

Do not expose an `OrderLineRepository`. Loading and saving the child independently would bypass the root's consistency rules.

### Aggregate References

Reference other aggregates by ID rather than a mutable navigation object:

```csharp
public CustomerId CustomerId { get; private set; }
```

This makes the boundary visible and avoids loading a graph that implies one transaction:

```csharp
// Usually avoid across aggregate boundaries:
public Customer Customer { get; private set; }
```

Foreign keys can exist in the database without exposing an object navigation in the domain model.

### Repositories for Aggregate Roots

A repository provides collection-like access to aggregate roots:

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

The interface is commonly owned by the application or domain layer, while EF Core implements it in infrastructure.

Repositories should:

- Load enough state to enforce aggregate invariants.
- Add or remove aggregate roots.
- Express meaningful retrieval operations.
- Avoid exposing persistence-specific APIs.

Avoid:

- A generic repository for every table.
- Repositories for value objects or child entities.
- Returning `IQueryable` across the boundary.
- Hiding all EF Core features behind a weaker CRUD abstraction without a reason.

### Unit of Work

EF Core `DbContext` already implements change tracking and unit-of-work behavior.

An application-facing abstraction can make commit explicit:

```csharp
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(
        CancellationToken cancellationToken);
}
```

Do not add a separate unit-of-work wrapper merely to rename every `DbContext` method. Add an abstraction when it:

- Defines the application transaction boundary.
- Dispatches domain events.
- Coordinates repositories.
- Protects the application layer from infrastructure details.

### Tracking and Aggregate Updates

For command handling:

```text
Load tracked aggregate
  -> invoke domain method
  -> EF detects changes
  -> commit unit of work
```

Avoid replacing a tracked aggregate with a DTO copied from the client. A client should submit intent:

```csharp
public sealed record ChangeShippingAddress(
    OrderId OrderId,
    ShippingAddress NewAddress);
```

The handler loads the aggregate and calls:

```csharp
order.ChangeShippingAddress(command.NewAddress);
```

This preserves transition rules and avoids overposting.

### Disconnected Updates

Web applications receive disconnected requests. Do not trust a complete client-supplied entity graph:

```csharp
dbContext.Update(request.Order);
```

Risks include:

- Overwriting properties the user cannot change.
- Missing invariants.
- Incorrect added, modified, or deleted states.
- Accidental child replacement.
- Security vulnerabilities.

Prefer command-specific input, reload the aggregate, invoke behavior, and save.

### Query Models

The write-side domain model is optimized for behavior and consistency, not every read shape.

For reads:

- Project directly to DTOs.
- Use `AsNoTracking`.
- Select only required columns.
- Join across read-owned data when appropriate.
- Use dedicated read models or views.

```csharp
var result = await dbContext.Orders
    .AsNoTracking()
    .Where(order => order.Id == id)
    .Select(order => new OrderDetailsDto(
        order.Id,
        order.Status,
        order.Lines.Sum(line =>
            line.UnitPrice.Amount * line.Quantity)))
    .SingleOrDefaultAsync(cancellationToken);
```

Not every query needs to materialize an aggregate. An aggregate should be loaded when domain behavior needs to run.

### Avoid Lazy Loading in Domain Models

Lazy loading hides database access behind property navigation:

```text
order.Customer.Address.Country
```

Risks include:

- Unexpected queries.
- N+1 performance problems.
- Database access during domain methods.
- Dependence on an active `DbContext`.
- Difficult testing.

Prefer explicit loading for command aggregates and explicit projections for queries.

### Concurrency Tokens

Optimistic concurrency protects aggregates from lost updates:

```csharp
public byte[] Version { get; private set; } = [];
```

```csharp
builder.Property(order => order.Version)
    .IsRowVersion();
```

On conflict, the application must choose:

- Reject and ask the user to retry.
- Reload and reapply the command.
- Merge nonconflicting changes.
- Use a domain-specific resolution.

Concurrency handling is part of preserving invariants, not only a technical exception policy.

### Database Constraints as Defense in Depth

The domain model protects business behavior, while the database protects persisted integrity.

Use:

- Unique indexes.
- Foreign keys.
- Check constraints.
- Required columns.
- Appropriate data types and lengths.
- Concurrency constraints.

Examples:

- Unique normalized email.
- Positive quantity.
- Valid key relationships.

Some rules, especially uniqueness under concurrency, cannot be guaranteed by an earlier application query alone.

### Domain Events and Persistence

Recorded domain events are usually transient:

```csharp
[NotMapped]
public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents;
```

Prefer fluent exclusion if avoiding persistence attributes:

```csharp
builder.Ignore(order => order.DomainEvents);
```

The unit of work can:

- Collect events from tracked aggregates.
- Dispatch them before or after commit.
- Clear them after successful processing.
- Translate committed facts into outbox messages.

Do not accidentally serialize handler objects or internal event collections into aggregate tables.

### Temporal and Audit Data

Audit data can be:

- Domain data, such as who approved a loan.
- Technical metadata, such as row-update timestamps.
- Compliance records requiring immutable history.

Model domain-significant history explicitly. Keep technical auditing in interceptors, database features, or infrastructure where appropriate.

Do not assume generic created/updated columns satisfy a business audit requirement.

### Migrations and Model Evolution

Changing a domain model often requires a staged schema migration:

```text
1. Add a nullable or compatible column.
2. Deploy code that writes both old and new representations.
3. Backfill historical data.
4. Switch reads to the new representation.
5. Enforce constraints.
6. Remove the old representation.
```

This expand-and-contract approach supports rolling deployments and large datasets.

When a new invariant is introduced:

- Identify historical violations.
- Define remediation with domain experts.
- Backfill or quarantine invalid records.
- Add domain and database enforcement.

Do not add strict constructor validation without planning how existing data will materialize.

### Legacy Schemas

A legacy schema may have:

- Shared tables.
- Encoded status values.
- Composite keys.
- Unclear ownership.
- Stored procedures.
- Names that conflict with the Ubiquitous Language.

Options include:

- Explicit EF Core mapping.
- Database views.
- An anti-corruption layer.
- A separate persistence model.
- Incremental schema migration.

Do not rename domain concepts to match poor legacy terminology. Translate at the boundary.

### Separate Persistence Model Example

When direct mapping becomes harmful:

```csharp
internal sealed class OrderRow
{
    public Guid OrderId { get; set; }
    public string StateCode { get; set; } = string.Empty;
    public string AddressJson { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public string TotalCurrency { get; set; } = string.Empty;
}
```

Map explicitly:

```csharp
internal static class OrderPersistenceMapper
{
    public static Order ToDomain(OrderRow row)
    {
        return Order.Rehydrate(
            new OrderId(row.OrderId),
            OrderStatus.FromStorageCode(row.StateCode),
            ShippingAddress.FromJson(row.AddressJson));
    }

    public static void Apply(Order source, OrderRow target)
    {
        target.StateCode = source.Status.StorageCode;
        target.AddressJson = source.ShippingAddress.ToJson();
        target.TotalAmount = source.Total.Amount;
        target.TotalCurrency = source.Total.Currency;
    }
}
```

This adds mapping work but prevents the legacy representation from becoming the domain API.

### Rehydration

Rehydration reconstructs an aggregate from persisted state without pretending a historical entity is being created for the first time.

Options include:

- ORM materialization through private members.
- An internal rehydration factory.
- A persistence mapper.
- Event replay in event-sourced systems.

A rehydration path should not be part of the public application API. It must preserve model integrity while allowing valid historical state to load.

### Testing Persistence Mapping

Unit tests do not prove that ORM mappings work.

Use integration tests with the real database provider for:

- Constructor and private-member materialization.
- Value converters and comparers.
- Owned or complex value-object mapping.
- Child collection persistence.
- Cascade behavior.
- Concurrency tokens.
- Constraints and indexes.
- Transactions.
- Query translations.

Avoid relying only on EF Core's in-memory provider when relational behavior matters. A lightweight real database or containerized target provides more realistic verification.

Round-trip tests are useful:

```text
Create aggregate through domain behavior
  -> save
  -> clear change tracker
  -> reload
  -> compare business-relevant state
```

### Performance Without Model Corruption

Performance techniques include:

- Query projections.
- Read models.
- Compiled queries for hot paths.
- Appropriate indexes.
- Explicit aggregate loading.
- Batch operations outside aggregate behavior when semantically safe.
- Avoiding large tracked graphs.

Do not add public setters or merge aggregates merely to reduce one query. First separate command and query needs and measure the actual bottleneck.

### When Direct EF Core Use Is Appropriate

Directly mapping the domain model is often appropriate when:

- The schema is under the team's control.
- The relational shape is reasonably close to the aggregate.
- EF Core supports the required encapsulation.
- Mapping remains understandable.
- The context is not shared with incompatible systems.

A separate persistence model is more likely useful when:

- The schema is legacy or externally owned.
- One domain model maps to several storage systems.
- The mismatch causes ORM concerns to dominate the domain.
- Stored representations differ significantly from domain concepts.
- Independent model evolution is strategically important.

### Common Mistakes

- Adding public setters for ORM convenience.
- Designing entities as one-to-one copies of tables.
- Putting EF Core attributes and types throughout the domain without evaluating coupling.
- Returning `IQueryable` from repositories.
- Creating repositories for child entities.
- Loading an entire aggregate for every read.
- Updating client-supplied detached graphs.
- Using navigation properties across every aggregate boundary.
- Allowing lazy loading to trigger hidden database access.
- Treating database-generated IDs as the only possible domain identity.
- Serializing complex values into opaque strings despite query needs.
- Ignoring concurrency and database constraints.
- Adding separate persistence models with no meaningful mismatch.
- Assuming unit tests validate relational mappings.

### Best Practices

- Design the domain model around behavior, identity, invariants, and aggregate boundaries.
- Keep EF Core configuration in infrastructure.
- Use private constructors, private setters, and backing fields deliberately.
- Map strongly typed IDs and value objects explicitly.
- Keep child collections encapsulated and save them through the aggregate root.
- Reference other aggregates by identity.
- Use repositories only where they protect aggregate access or application boundaries.
- Treat `DbContext` as the underlying unit of work.
- Reload aggregates and apply commands rather than attaching client graphs.
- Project queries directly to read DTOs.
- Reinforce critical rules with constraints and concurrency control.
- Test mappings against realistic relational behavior.
- Introduce a separate persistence model only when the mismatch justifies its cost.
- Evolve schema and domain rules through staged migrations.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What does persistence ignorance mean?

<!-- question:start:mapping-domain-models-to-persistence-without-corrupting-the-model-beginner-q01 -->
<!-- question-id:mapping-domain-models-to-persistence-without-corrupting-the-model-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Persistence ignorance means the domain model is designed around business concepts and behavior rather than database or ORM mechanics. Entities should not expose public mutation, SQL, `DbContext`, or save methods merely for persistence. Practical accommodations such as private constructors, private setters, backing fields, and concurrency tokens are acceptable when they do not corrupt the model's public meaning.

##### Key Points to Mention

- It is not absolute unawareness of storage constraints.
- Persistence details should remain outside the public domain API.
- Business invariants and language drive the model.
- Pragmatic mapping support is compatible with the principle.

<!-- question:end:mapping-domain-models-to-persistence-without-corrupting-the-model-beginner-q01 -->

#### How can EF Core map an entity without public setters?

<!-- question:start:mapping-domain-models-to-persistence-without-corrupting-the-model-beginner-q02 -->
<!-- question-id:mapping-domain-models-to-persistence-without-corrupting-the-model-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

EF Core can materialize entities through compatible constructors, private setters, fields, and explicitly configured backing fields. Fluent configuration can map keys, properties, and private collections while the public API exposes only domain methods and read-only views. This preserves encapsulation without requiring a separate persistence class.

##### Key Points to Mention

- Use a private materialization constructor where necessary.
- Configure field access for private collections.
- Keep normal state changes behind domain methods.
- Put mapping configuration in infrastructure.

<!-- question:end:mapping-domain-models-to-persistence-without-corrupting-the-model-beginner-q02 -->

#### How are value objects commonly persisted with EF Core?

<!-- question:start:mapping-domain-models-to-persistence-without-corrupting-the-model-beginner-q03 -->
<!-- question-id:mapping-domain-models-to-persistence-without-corrupting-the-model-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Value objects can be mapped as complex types, owned entity types, multiple columns, or through value converters for single-column values. The choice depends on structure, query requirements, ownership semantics, and the EF Core version. The domain value should remain immutable and structurally equal even if EF uses internal tracking details.

##### Key Points to Mention

- Use converters for strongly typed IDs and simple wrappers.
- Use structured mappings for multi-property values.
- Do not give a value object artificial domain identity.
- Consider indexing and queryability before serializing to one column.

<!-- question:end:mapping-domain-models-to-persistence-without-corrupting-the-model-beginner-q03 -->

#### Why should repositories normally operate on aggregate roots?

<!-- question:start:mapping-domain-models-to-persistence-without-corrupting-the-model-beginner-q04 -->
<!-- question-id:mapping-domain-models-to-persistence-without-corrupting-the-model-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

The aggregate root is the entry point that protects the consistency of the aggregate. Loading or saving child entities independently can bypass its invariants. A repository therefore retrieves and persists the root with enough state to perform domain behavior, while child collections remain encapsulated.

##### Key Points to Mention

- Repository boundaries should follow aggregate boundaries.
- Avoid repositories for value objects and child entities.
- The root controls modifications.
- Reads can use separate projections without repositories.

<!-- question:end:mapping-domain-models-to-persistence-without-corrupting-the-model-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### When should you use a separate persistence model instead of directly mapping domain entities?

<!-- question:start:mapping-domain-models-to-persistence-without-corrupting-the-model-intermediate-q01 -->
<!-- question-id:mapping-domain-models-to-persistence-without-corrupting-the-model-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use a separate persistence model when the schema is legacy or externally owned, the domain and storage shapes differ substantially, several stores must be coordinated, or ORM requirements are distorting domain behavior. Direct mapping is usually simpler when the team controls the schema and EF Core can map the encapsulated aggregate cleanly. Separation adds duplication, mapping code, and synchronization risk, so it should solve a concrete mismatch.

##### Key Points to Mention

- Direct mapping is not inherently domain corruption.
- Separate models maximize independence but cost more.
- Evaluate schema ownership and mismatch.
- Choose the least complex option that preserves invariants.

<!-- question:end:mapping-domain-models-to-persistence-without-corrupting-the-model-intermediate-q01 -->

#### How should a web API update a disconnected aggregate safely?

<!-- question:start:mapping-domain-models-to-persistence-without-corrupting-the-model-intermediate-q02 -->
<!-- question-id:mapping-domain-models-to-persistence-without-corrupting-the-model-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Accept a command-specific request rather than a complete entity graph. Reload the tracked aggregate from the repository, invoke an intention-revealing domain method, and commit the unit of work. This prevents overposting, preserves invariants, and lets EF Core detect the actual changes. Concurrency conflicts should be handled explicitly.

##### Key Points to Mention

- Client DTOs are not trusted domain entities.
- Avoid attaching a graph and marking it modified.
- Reload authoritative state before applying behavior.
- Validate authorization and expected version.

<!-- question:end:mapping-domain-models-to-persistence-without-corrupting-the-model-intermediate-q02 -->

#### Why should query models often be separate from the persisted domain aggregate?

<!-- question:start:mapping-domain-models-to-persistence-without-corrupting-the-model-intermediate-q03 -->
<!-- question-id:mapping-domain-models-to-persistence-without-corrupting-the-model-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

An aggregate is shaped for behavior and transactional consistency, while screens and reports need efficient flattened data. Querying directly into DTOs with no tracking avoids loading large object graphs and does not expose persistence mutation. Separate read models can join, denormalize, or cache data without weakening write-side aggregate boundaries.

##### Key Points to Mention

- Read requirements do not define write consistency boundaries.
- Use projection and `AsNoTracking` for read-only work.
- Load aggregates only when domain behavior must execute.
- This is a pragmatic form of command-query separation.

<!-- question:end:mapping-domain-models-to-persistence-without-corrupting-the-model-intermediate-q03 -->

#### How do database constraints and optimistic concurrency support domain invariants?

<!-- question:start:mapping-domain-models-to-persistence-without-corrupting-the-model-intermediate-q04 -->
<!-- question-id:mapping-domain-models-to-persistence-without-corrupting-the-model-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Domain methods reject invalid operations in memory, but concurrent requests and alternate write paths require persistence enforcement. Unique indexes, check constraints, foreign keys, and required columns defend stored integrity. A row-version or other concurrency token detects stale updates. The application then retries, merges, or rejects according to business policy.

##### Key Points to Mention

- Application checks alone cannot guarantee uniqueness under races.
- Constraints are defense in depth, not replacements for domain behavior.
- Concurrency conflict handling belongs to the use case.
- Select isolation and locking from the invariant and contention level.

<!-- question:end:mapping-domain-models-to-persistence-without-corrupting-the-model-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How do you introduce a new invariant when historical database rows violate it?

<!-- question:start:mapping-domain-models-to-persistence-without-corrupting-the-model-advanced-q01 -->
<!-- question-id:mapping-domain-models-to-persistence-without-corrupting-the-model-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Identify invalid historical states with domain experts and define remediation rather than allowing new constructor validation to break materialization. Use a staged migration: add compatible storage, deploy transitional code, backfill or quarantine data, switch reads and writes, then add strict domain and database enforcement. Preserve audit needs and make exceptional legacy states explicit.

##### Key Points to Mention

- Model evolution and data migration must be coordinated.
- Do not silently reinterpret historical facts.
- Expand-and-contract supports safe deployment.
- Enforce the invariant only after data is compatible.

<!-- question:end:mapping-domain-models-to-persistence-without-corrupting-the-model-advanced-q01 -->

#### How would you map a rich aggregate to a difficult legacy schema?

<!-- question:start:mapping-domain-models-to-persistence-without-corrupting-the-model-advanced-q02 -->
<!-- question-id:mapping-domain-models-to-persistence-without-corrupting-the-model-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

First attempt explicit infrastructure mapping with table, column, key, conversion, and backing-field configuration. If legacy encodings, shared tables, stored procedures, or lifecycle differences would leak into the domain, introduce an anti-corruption layer or separate persistence records with explicit rehydration and update mapping. Test round trips and concurrency against the real provider.

##### Key Points to Mention

- Keep legacy terminology and encodings at the boundary.
- A separate model is justified by significant mismatch.
- Mapping must preserve identity and aggregate invariants.
- Plan incremental schema improvement where possible.

<!-- question:end:mapping-domain-models-to-persistence-without-corrupting-the-model-advanced-q02 -->

#### How should domain events participate in persistence and transaction handling?

<!-- question:start:mapping-domain-models-to-persistence-without-corrupting-the-model-advanced-q03 -->
<!-- question-id:mapping-domain-models-to-persistence-without-corrupting-the-model-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Aggregates record transient domain events, and the unit of work gathers them from tracked roots. Events may be dispatched before commit for one local transaction or after commit for eventual consistency. Integration events must represent committed state; save them to an outbox in the same transaction when reliable publication is required. Clear recorded events only after the chosen handling succeeds.

##### Key Points to Mention

- Exclude transient event collections from ordinary entity mapping.
- Dispatch timing defines consistency and failure behavior.
- Outbox storage solves the database-and-broker dual write.
- Handlers and publishers need retry and idempotency policies.

<!-- question:end:mapping-domain-models-to-persistence-without-corrupting-the-model-advanced-q03 -->

#### How do you test that persistence mapping has not corrupted the domain model?

<!-- question:start:mapping-domain-models-to-persistence-without-corrupting-the-model-advanced-q04 -->
<!-- question-id:mapping-domain-models-to-persistence-without-corrupting-the-model-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Keep domain tests focused on behavior without EF Core, then add integration tests using the real relational provider. Create aggregates through valid domain methods, save them, clear tracking, reload them, and verify business-relevant state and behavior. Test private collection mapping, value conversions, constraints, concurrency, cascades, transaction rollback, and query translation. Also review that no public persistence-only mutation has entered the domain API.

##### Key Points to Mention

- Unit tests cannot validate ORM or database behavior.
- Round-trip tests expose materialization and conversion problems.
- Real-provider tests catch relational differences.
- Architectural review verifies dependency and encapsulation boundaries.

<!-- question:end:mapping-domain-models-to-persistence-without-corrupting-the-model-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
