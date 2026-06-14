---
id: when-not-to-over-architect-a-simple-application
topic: Clean Architecture and modular boundaries
subtopic: When not to over-architect a simple application
category: Design & Architecture
---

## Overview

Over-architecture occurs when a design introduces more boundaries, abstractions, infrastructure, or indirection than the application's current requirements justify. The result may look sophisticated while making ordinary changes slower, behavior harder to trace, and the system more expensive to operate.

A simple application is not necessarily unimportant. It may handle valuable business data while having a small scope, modest scale, one deployment team, straightforward workflows, and limited integration needs. Such an application still needs clear code, validation, security, error handling, tests, and observability. It does not automatically need microservices, event sourcing, multiple architectural layers, or an interface for every class.

The correct goal is **the simplest architecture that satisfies known functional and quality requirements while leaving reasonable options for likely change**. Simplicity is not the absence of design. It is deliberate control of complexity.

This topic is important in interviews because candidates are expected to demonstrate judgment, not only pattern knowledge. A strong candidate can explain:

- Which problem an architectural pattern solves.
- What complexity the pattern introduces.
- What evidence justifies that trade-off.
- How to keep a simple design evolvable.
- Which signals should trigger a later architectural change.

## Core Concepts

### Essential Complexity and Accidental Complexity

**Essential complexity** comes from the problem itself:

- Business rules.
- Regulatory requirements.
- Security constraints.
- Required availability and performance.
- Data consistency needs.
- Integration behavior.

**Accidental complexity** comes from the chosen solution:

- Extra layers and mappings.
- Network boundaries.
- Messaging infrastructure.
- Framework-specific ceremony.
- Generic abstractions.
- Multiple deployment pipelines.
- Distributed transactions and eventual consistency.

Architecture cannot remove essential complexity, but it should avoid adding accidental complexity without a corresponding benefit.

### What Counts as Over-Architecture?

An architectural choice is excessive when its cost is concrete but its expected benefit is speculative or irrelevant.

Common examples include:

- Splitting a small CRUD application into microservices.
- Applying CQRS with separate read and write stores when both paths use the same model and database.
- Introducing event sourcing without audit, temporal-query, or domain-reconstruction requirements.
- Creating an interface for every concrete class despite having one stable implementation.
- Wrapping EF Core in generic repositories that hide useful query capabilities without adding domain meaning.
- Adding a mediator to a handful of direct application-service calls when no pipeline behavior is needed.
- Building a plugin system for variants that do not exist.
- Creating many projects and mapping layers around simple data flow.
- Using a message broker for work that must complete synchronously in one process.

The same pattern can be appropriate in another context. The problem is not the pattern itself; it is applying it without the forces that make its trade-offs worthwhile.

### Architecture Is a Trade-Off, Not a Maturity Ladder

Architectures are not levels where every application should eventually progress from monolith to microservices or from simple services to event sourcing.

Each style optimizes for different forces:

| Choice | Potential benefit | Added cost |
| --- | --- | --- |
| Additional layer | Separation and policy isolation | More indirection and mapping |
| Interface | Substitution and boundary ownership | More types and navigation |
| Mediator | Decoupled dispatch and pipeline behaviors | Indirect control flow |
| CQRS | Independent read/write models | Duplication and synchronization |
| Message broker | Durable asynchronous communication | Delivery, ordering, retries, and operations |
| Microservices | Independent deployment and scaling | Network failures and distributed data |
| Event sourcing | Complete history and temporal reconstruction | Event evolution and projection complexity |

The interview-quality question is: **Which requirement pays for this cost?**

### YAGNI, KISS, and Evolutionary Design

**YAGNI**, or "You Aren't Gonna Need It," advises against building functionality or flexibility before it is needed. It does not mean ignoring foreseeable risks. It means distinguishing evidence from imagination.

**KISS**, or "Keep It Simple," favors designs that are easy to understand and operate while still meeting requirements.

Evolutionary design accepts that architecture can change:

- Make current behavior clear.
- Protect important behavior with tests.
- Keep responsibilities cohesive.
- Isolate volatile external dependencies.
- Monitor explicit triggers for change.
- Refactor when evidence appears.

This is safer than paying permanent complexity costs for every possible future.

### Simple Does Not Mean Unstructured

A simple application can have clear boundaries without adopting a full architectural template.

For example:

```text
src/
  Todo.Api/
    Features/
      Todos/
        CreateTodo.cs
        CompleteTodo.cs
        GetTodos.cs
    Data/
      TodoDbContext.cs
    Program.cs
tests/
  Todo.Api.Tests/
```

This structure can support:

- Feature-local validation.
- Direct EF Core access in focused handlers.
- DTOs at the HTTP boundary.
- Centralized authentication and error handling.
- Unit tests for nontrivial rules.
- Integration tests against the API and database.

It avoids projects and abstractions that do not yet protect a real boundary.

### Start With Requirements and Quality Attributes

Architecture should respond to requirements such as:

- Expected traffic and data volume.
- Latency targets.
- Availability and recovery objectives.
- Security and compliance boundaries.
- Consistency requirements.
- Number and autonomy of teams.
- Release frequency.
- Integration reliability.
- Expected rate and type of change.

A single-team internal application with hundreds of requests per day has different needs from a global payment platform. Applying the same architecture to both ignores the forces architecture is meant to address.

When requirements are uncertain:

- Record assumptions.
- Choose a reversible default.
- Measure actual behavior.
- Define thresholds that would force a different decision.

### The Cost Model for Architectural Complexity

Architectural complexity has several dimensions.

**Cognitive cost**

- More concepts to learn.
- Longer navigation paths.
- Indirect control flow.
- More difficult debugging.

**Development cost**

- More files and mappings per feature.
- Additional tests and mocks.
- More cross-boundary contract work.

**Runtime cost**

- Serialization.
- Network latency.
- More failure modes.
- Synchronization and consistency work.

**Operational cost**

- More deployments and infrastructure.
- Monitoring, alerting, tracing, and on-call burden.
- Backup and recovery across multiple stores.

**Change cost**

- Contract versioning.
- Coordinated migrations.
- Boilerplate that must change with each feature.

A design should be evaluated by total lifecycle cost, not only by how clean its diagram appears.

### Abstractions Must Earn Their Place

An abstraction is valuable when it represents a stable concept and protects callers from meaningful variation or volatility.

Good reasons to introduce an abstraction include:

- Multiple implementations exist now.
- An external service or vendor is volatile.
- The application owns a port that infrastructure must implement.
- Testing a nondeterministic boundary such as time is important.
- A policy must remain independent of a framework.
- Cross-cutting behavior needs a consistent extension point.

Weak reasons include:

- "We might replace the database someday."
- "Interfaces are always best practice."
- "Every service should be mockable."
- "The architecture template includes this layer."

Compare an unnecessary interface:

```csharp
public interface ITodoService
{
    Task<TodoDto> GetAsync(Guid id, CancellationToken cancellationToken);
}

public sealed class TodoService : ITodoService
{
    // The only implementation simply forwards to one repository.
}
```

with a useful boundary:

```csharp
public interface IPaymentGateway
{
    Task<PaymentResult> ChargeAsync(
        Money amount,
        PaymentMethod paymentMethod,
        CancellationToken cancellationToken);
}
```

The payment abstraction protects application policy from a remote vendor, failure behavior, credentials, and SDK changes. Its boundary has architectural meaning.

### Avoid Interface-Per-Class Design

Dependency injection does not require every class to have an interface. Concrete classes can be constructor-injected.

Use an interface when:

- It is a port owned by higher-level policy.
- Multiple strategies are selected at runtime.
- A volatile dependency must be isolated.
- The contract is shared across a real module boundary.

Prefer a concrete class when:

- There is one stable in-process implementation.
- The class is an internal application operation.
- Tests can exercise behavior without replacing it.
- The interface would repeat the same members and add no semantic boundary.

Testing alone is not always sufficient justification. Excessive mocking often tests call choreography instead of observable behavior.

### Avoid Layer-Per-Concern Ceremony

Extra layers are useful only when they contain distinct policy or protect a boundary.

An over-layered request can look like:

```text
Controller
  -> Application service
    -> Domain service
      -> Repository
        -> Unit of work
          -> EF Core DbContext
```

If each layer only forwards parameters, the design adds navigation without separation.

A simple use case can be direct:

```csharp
app.MapPost("/todos", async (
    CreateTodoRequest request,
    TodoDbContext db,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Title))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["title"] = ["A title is required."]
        });
    }

    var todo = new Todo(request.Title.Trim());
    db.Todos.Add(todo);
    await db.SaveChangesAsync(cancellationToken);

    return Results.Created($"/todos/{todo.Id}", new TodoResponse(
        todo.Id,
        todo.Title,
        todo.IsComplete));
});
```

As rules grow, extraction can be incremental:

- Move complex business rules into a domain type.
- Move repeated use-case orchestration into a handler.
- Introduce a port when an external dependency appears.
- Split a module when independent ownership becomes useful.

### Generic Repository and Unit of Work in EF Core

EF Core's `DbContext` already provides unit-of-work behavior, and `DbSet` provides repository-like collection access. A generic repository that exposes only `Add`, `Update`, `Delete`, and `GetAll` may remove useful query composition while adding little domain value.

A custom repository is justified when it:

- Expresses aggregate-oriented operations.
- Hides complex persistence behavior.
- Protects domain code from infrastructure.
- Centralizes a query or concurrency rule with business meaning.

It is less useful when it only mirrors `DbSet`:

```csharp
public interface IRepository<T>
{
    IQueryable<T> GetAll();
    Task AddAsync(T entity);
    void Update(T entity);
    void Delete(T entity);
}
```

For a simple data-centric application, using `DbContext` directly in focused handlers can be clearer.

### CQRS and Mediator Trade-Offs

CQRS separates write operations from read operations. It is useful when:

- Read and write models differ materially.
- They scale independently.
- Writes enforce complex domain behavior.
- Read projections need specialized storage or shape.

Using command and query classes in one application can improve organization without requiring separate databases. However, creating duplicate models, handlers, buses, and mapping for trivial CRUD may be excessive.

A mediator is useful for:

- Pipeline behaviors such as validation, authorization, logging, or transactions.
- Dispatching requests without coupling callers to handlers.
- Consistent feature-slice organization.

It is unnecessary when it merely replaces an obvious method call and makes execution harder to follow.

### Microservices and Messaging

Microservices are justified by needs such as:

- Independent deployments.
- Independent team ownership.
- Distinct scaling profiles.
- Fault or security isolation.
- Different technology lifecycles.

They also require:

- Network failure handling.
- Contract versioning.
- Distributed tracing.
- Deployment automation.
- Data ownership and eventual consistency.
- Retries and idempotency.

A small application rarely benefits from paying these costs before the relevant organizational or runtime pressures exist.

Similarly, messaging is useful for durable asynchronous workflows and decoupled notifications. It is not automatically better than an in-process method call. A queue adds delivery semantics, duplicate handling, monitoring, and delayed-failure behavior.

### Event Sourcing

Event sourcing stores state changes as an append-only sequence of domain events. It can be valuable when the system needs:

- Complete historical reconstruction.
- Temporal queries.
- Auditability beyond ordinary change logs.
- Rich domain behavior expressed as events.
- Multiple projections from the same history.

It adds:

- Event schema evolution.
- Projection rebuilding.
- Eventual consistency.
- More difficult debugging and data correction.
- Specialized operational knowledge.

For ordinary CRUD with a current-state database, event sourcing is usually an unjustified default.

### Duplication Versus Premature Generalization

DRY does not mean that every similar-looking block must immediately share one abstraction. Two pieces of code can look similar while representing concepts that will evolve differently.

A practical approach is:

- Tolerate small duplication while the concepts are unclear.
- Observe how each copy changes.
- Extract when the shared concept and stable variation points are understood.
- Keep separate code when changes occur for different reasons.

The "rule of three" is a heuristic, not a law: repeated use can provide enough evidence for a useful abstraction. The more important test is whether the abstraction has a coherent responsibility and makes future changes easier.

### Reversible and Irreversible Decisions

Not every decision deserves the same amount of design effort.

Relatively reversible decisions include:

- Moving code into a feature folder.
- Extracting a class.
- Adding an interface at a clear boundary.
- Introducing a local application handler.

More expensive decisions include:

- Splitting data across services.
- Publishing a public API contract.
- Choosing event sourcing as the source of truth.
- Committing to a cloud-specific messaging topology.

Invest more analysis in decisions that are costly to reverse. For reversible decisions, choose a clear default and learn from implementation.

### A Practical Decision Framework

Before adopting a pattern, ask:

1. What current problem does it solve?
2. Which requirement or measured risk demonstrates that problem?
3. What new concepts and failure modes does it introduce?
4. Is there a simpler design that satisfies the same requirement?
5. How likely and costly is the predicted change?
6. Can the pattern be introduced later without a rewrite?
7. What observable trigger would tell us to evolve?

Examples of useful triggers:

- A module's release schedule repeatedly blocks another team.
- One workload consistently needs independent scaling.
- Query requirements diverge from the transactional model.
- A vendor integration changes frequently and leaks through the codebase.
- A class has accumulated several unrelated reasons to change.
- Duplicate business rules are producing inconsistent behavior.

### Keeping a Simple Design Evolvable

Avoiding over-architecture does not mean creating a dead end.

Useful practices include:

- Organize by cohesive features.
- Keep business rules out of UI and infrastructure details.
- Use explicit request and response contracts at external boundaries.
- Centralize composition in the application entry point.
- Isolate genuinely volatile integrations.
- Keep dependencies acyclic.
- Write tests around important behavior.
- Record architecture decisions and assumptions briefly.
- Measure performance before optimizing.
- Refactor continuously in small steps.

These practices preserve options without implementing every possible future architecture.

### Common Mistakes

- Equating more projects and interfaces with better separation.
- Choosing architecture from a diagram or template before understanding requirements.
- Building for hypothetical global scale.
- Using microservices to solve code organization problems.
- Treating every internal call as an event.
- Mocking every dependency and testing implementation details.
- Adding mappings that duplicate identical models without protecting a boundary.
- Hiding framework capabilities behind weaker generic abstractions.
- Refusing all structure in the name of YAGNI.
- Waiting until code is unmaintainable before refactoring.

### Best Practices

- Begin with functional requirements, quality attributes, and team constraints.
- Choose the least complex design that meets those needs.
- Make the reason for every major pattern explicit.
- Separate business policy from volatile external details.
- Prefer cohesive feature organization over ceremonial global layers.
- Use direct calls when synchronous in-process collaboration is sufficient.
- Add abstractions around proven variation or meaningful boundaries.
- Define measurable triggers for architectural evolution.
- Treat operational and cognitive costs as first-class design concerns.
- Revisit decisions as evidence changes.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What does it mean to over-architect an application?

<!-- question:start:when-not-to-over-architect-a-simple-application-beginner-q01 -->
<!-- question-id:when-not-to-over-architect-a-simple-application-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Over-architecture means adding abstractions, layers, infrastructure, or distributed boundaries whose costs are not justified by current requirements or credible risks. It creates accidental complexity without enough benefit. Examples include microservices for a small single-team CRUD system or an interface for every class with only one stable implementation.

##### Key Points to Mention

- The issue is an unjustified trade-off, not a specific pattern.
- Complexity has development, cognitive, runtime, and operational costs.
- A pattern can be appropriate in one context and excessive in another.
- Architecture should solve identifiable problems.

<!-- question:end:when-not-to-over-architect-a-simple-application-beginner-q01 -->

#### What is the difference between simple architecture and no architecture?

<!-- question:start:when-not-to-over-architect-a-simple-application-beginner-q02 -->
<!-- question-id:when-not-to-over-architect-a-simple-application-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A simple architecture deliberately uses few concepts while preserving clear responsibilities, dependency direction, validation, security, tests, and external boundaries. No architecture allows responsibilities and dependencies to grow without intent. Simplicity is a design outcome; disorder is the absence of design.

##### Key Points to Mention

- Simple systems still need structure and quality controls.
- Feature cohesion and clear boundaries do not require many layers.
- Avoid both ceremonial complexity and unstructured code.
- The design should remain understandable and changeable.

<!-- question:end:when-not-to-over-architect-a-simple-application-beginner-q02 -->

#### How do KISS and YAGNI influence architecture?

<!-- question:start:when-not-to-over-architect-a-simple-application-beginner-q03 -->
<!-- question-id:when-not-to-over-architect-a-simple-application-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

KISS favors the simplest design that satisfies the requirements. YAGNI discourages implementing flexibility or infrastructure for speculative future needs. Neither principle means ignoring known risks. They encourage teams to record assumptions, choose reversible defaults, and evolve the design when evidence appears.

##### Key Points to Mention

- Do not confuse possible future change with demonstrated need.
- Preserve options through clean code and tests rather than unused machinery.
- Consider the cost of introducing a pattern now versus later.
- Revisit decisions when assumptions change.

<!-- question:end:when-not-to-over-architect-a-simple-application-beginner-q03 -->

#### Does every class need an interface for dependency injection and testing?

<!-- question:start:when-not-to-over-architect-a-simple-application-beginner-q04 -->
<!-- question-id:when-not-to-over-architect-a-simple-application-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

No. Dependency injection can construct and inject concrete classes. An interface is useful when it represents a meaningful port, supports real implementation variation, isolates a volatile dependency, or defines a module contract. Creating a one-to-one interface for every class often adds navigation and mocking without improving separation.

##### Key Points to Mention

- Interfaces should express architectural boundaries or variation.
- Concrete internal services are often appropriate.
- Tests can use real collaborators or test behavior at a wider boundary.
- Mockability alone can lead to implementation-coupled tests.

<!-- question:end:when-not-to-over-architect-a-simple-application-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How do you decide whether an abstraction is justified?

<!-- question:start:when-not-to-over-architect-a-simple-application-intermediate-q01 -->
<!-- question-id:when-not-to-over-architect-a-simple-application-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Identify the concrete variation, volatility, or ownership boundary the abstraction protects. Compare its ongoing cost with the cost of direct coupling. An abstraction is justified when it represents a stable concept and makes expected changes safer, such as isolating a payment provider. It is premature when it only anticipates unspecified future implementations or duplicates a concrete class's API.

##### Key Points to Mention

- Name the problem and likely change.
- Prefer abstractions owned by the policy that consumes them.
- Evaluate lifecycle cost, not only initial code.
- Introduce the abstraction later when the decision is reversible.

<!-- question:end:when-not-to-over-architect-a-simple-application-intermediate-q01 -->

#### When is using EF Core directly preferable to adding a generic repository?

<!-- question:start:when-not-to-over-architect-a-simple-application-intermediate-q02 -->
<!-- question-id:when-not-to-over-architect-a-simple-application-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Direct `DbContext` usage is often clearer in a simple data-centric application because EF Core already supplies unit-of-work and repository-like behavior. A generic CRUD repository may hide useful query features and add forwarding methods. A custom repository becomes valuable when it expresses aggregate operations, enforces a persistence boundary, or encapsulates meaningful query or concurrency behavior.

##### Key Points to Mention

- Do not wrap a framework solely to say it is abstracted.
- Keep data access focused within the feature or application boundary.
- Use domain-specific repositories when they add semantic value.
- Consider testing with realistic database integration tests.

<!-- question:end:when-not-to-over-architect-a-simple-application-intermediate-q02 -->

#### When are CQRS and a mediator useful, and when are they excessive?

<!-- question:start:when-not-to-over-architect-a-simple-application-intermediate-q03 -->
<!-- question-id:when-not-to-over-architect-a-simple-application-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

CQRS is useful when read and write needs differ materially in model, scale, or optimization. A mediator is useful when request dispatch and shared pipeline behaviors reduce repeated code. They are excessive when simple CRUD operations gain duplicate models, handlers, mappings, and indirect control flow without solving a real problem. Command and query organization does not require separate databases or distributed messaging.

##### Key Points to Mention

- CQRS exists on a spectrum.
- Distinguish feature organization from infrastructure.
- Pipeline behaviors can justify mediation.
- Measure whether indirection improves or impairs changeability.

<!-- question:end:when-not-to-over-architect-a-simple-application-intermediate-q03 -->

#### How can you keep a simple application ready to evolve without building speculative infrastructure?

<!-- question:start:when-not-to-over-architect-a-simple-application-intermediate-q04 -->
<!-- question-id:when-not-to-over-architect-a-simple-application-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Keep features cohesive, dependencies acyclic, business rules separate from volatile infrastructure, and external contracts explicit. Add tests around important behavior and isolate integrations known to change. Record assumptions and define triggers for evolution, such as independent scaling or team ownership. These practices make later refactoring possible without paying for unused services, brokers, or layers now.

##### Key Points to Mention

- Preserve options through cohesion and tests.
- Isolate proven volatility.
- Prefer reversible decisions.
- Define measurable architecture triggers.

<!-- question:end:when-not-to-over-architect-a-simple-application-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you challenge a proposal to use microservices for a small application?

<!-- question:start:when-not-to-over-architect-a-simple-application-advanced-q01 -->
<!-- question-id:when-not-to-over-architect-a-simple-application-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Ask which requirements need independent deployment, team autonomy, scaling, fault isolation, or security isolation. Then compare those benefits with network failures, distributed data, observability, deployment automation, and on-call costs. If the needs are absent, propose a cohesive monolith or modular monolith and define conditions under which extraction would become worthwhile. The argument should be evidence-based rather than ideological.

##### Key Points to Mention

- Connect architecture to quality attributes and organization.
- Include operational ownership in the cost.
- Explain data consistency and failure implications.
- Offer an evolvable simpler alternative with explicit triggers.

<!-- question:end:when-not-to-over-architect-a-simple-application-advanced-q01 -->

#### How do reversible decisions affect how much architecture work you should do up front?

<!-- question:start:when-not-to-over-architect-a-simple-application-advanced-q02 -->
<!-- question-id:when-not-to-over-architect-a-simple-application-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Spend more analysis on decisions that are expensive to reverse, such as public contracts, service-owned data, or event sourcing as the source of truth. For reversible decisions such as extracting a class or adding an internal interface, choose a clear simple design and learn from implementation. This directs design effort toward lasting risk instead of speculative detail.

##### Key Points to Mention

- Reversibility changes the cost of being wrong.
- Delay commitment when learning has value.
- Tests and cohesive code reduce later refactoring cost.
- Do not use reversibility as an excuse to ignore known high-impact risks.

<!-- question:end:when-not-to-over-architect-a-simple-application-advanced-q02 -->

#### How would you recognize that a previously simple architecture now needs to evolve?

<!-- question:start:when-not-to-over-architect-a-simple-application-advanced-q03 -->
<!-- question-id:when-not-to-over-architect-a-simple-application-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Look for repeated evidence: coordinated releases blocking teams, one capability dominating scale, changes crossing many unrelated areas, unstable integrations leaking details, query needs diverging from transactional writes, or availability requirements differing by module. Confirm the pattern with delivery and runtime data, then introduce the smallest architectural change that addresses it.

##### Key Points to Mention

- Use trends and recurring pain rather than one incident.
- Recheck the original assumptions and quality attributes.
- Evolve one boundary at a time.
- Verify that the change improves the targeted outcome.

<!-- question:end:when-not-to-over-architect-a-simple-application-advanced-q03 -->

#### How do you balance DRY with the risk of premature abstraction?

<!-- question:start:when-not-to-over-architect-a-simple-application-advanced-q04 -->
<!-- question-id:when-not-to-over-architect-a-simple-application-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

DRY is about avoiding multiple authoritative representations of the same knowledge, not eliminating every similar line. Small duplication can reveal whether two concepts truly change together. Extract an abstraction when the shared responsibility and variation points are understood; keep code separate when the concepts change for different reasons. The rule of three can provide evidence, but semantic cohesion matters more than a repetition count.

##### Key Points to Mention

- Similar syntax does not prove shared responsibility.
- Wrong abstractions can be more expensive than duplication.
- Observe change patterns before generalizing.
- Extract around stable domain meaning.

<!-- question:end:when-not-to-over-architect-a-simple-application-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
