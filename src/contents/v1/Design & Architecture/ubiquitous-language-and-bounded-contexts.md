---
id: ubiquitous-language-and-bounded-contexts
topic: Domain modeling and Domain-Driven Design
subtopic: Ubiquitous language and bounded contexts
category: Design & Architecture
---

## Overview

Ubiquitous Language and Bounded Context are central strategic patterns in Domain-Driven Design (DDD).

A **Ubiquitous Language** is a precise, shared language developed by domain experts and software practitioners. The team uses it consistently in conversations, requirements, examples, code, tests, APIs, and documentation. Its purpose is to remove translation gaps between the business model and the software model.

A **Bounded Context** is an explicit boundary within which one domain model and its language are internally consistent. A term can have a precise meaning inside one context and a different meaning inside another. For example, `Customer` in Sales may represent a prospect and commercial relationship, while `Customer` in Support may represent a person or organization entitled to open support cases. Forcing both meanings into one universal class usually creates a confusing model.

These concepts are used in complex business systems, modular monoliths, microservices, integration design, legacy modernization, and team organization. They matter because many software failures are not caused by syntax or frameworks. They are caused by ambiguous language, hidden assumptions, unclear ownership, and models that mix rules from different parts of the business.

The topic is important in interviews because it reveals whether a candidate can:

- Collaborate with domain experts rather than model only database tables.
- Distinguish a business boundary from a technical layer or deployment unit.
- Explain why one enterprise-wide model is often impractical.
- Identify context boundaries from language, rules, ownership, and change patterns.
- Design explicit mappings between different models.
- Avoid treating every bounded context as an immediate microservice.

## Core Concepts

### Domain, Subdomains, and Models

A **domain** is the business area the software supports, such as insurance, logistics, healthcare, retail, or banking.

A large domain can be divided into **subdomains**:

- **Core subdomain**: differentiates the business and deserves focused modeling effort.
- **Supporting subdomain**: necessary for the business but not its primary differentiator.
- **Generic subdomain**: a commonly solved capability that can often use an existing product or service.

For an online marketplace:

```text
Domain: Online marketplace

Core:
  Matching buyers and sellers
  Pricing and promotions

Supporting:
  Seller onboarding
  Dispute handling

Generic:
  Authentication
  Email delivery
```

A **domain model** is a purposeful representation of concepts, rules, relationships, and behavior relevant to a particular problem. It is not a copy of reality and does not need to contain every fact known by the organization.

Subdomains describe the problem space. Bounded contexts describe the solution's model boundaries. They often align, but the mapping is not automatically one-to-one.

### What Ubiquitous Language Means

Ubiquitous Language is:

- Shared by domain experts, developers, testers, analysts, and product stakeholders.
- Based on the domain model.
- Precise enough to expose ambiguity.
- Used in both speech and software.
- Continuously refined as understanding improves.
- Scoped to a bounded context.

It is not merely:

- A glossary maintained separately from delivery.
- A list of database column names.
- Business terminology copied without clarification.
- Technical jargon translated for nontechnical stakeholders.
- One mandatory vocabulary for the whole enterprise.

The language is useful only when it influences the model and code.

Instead of vague language:

```text
Update the order when the user confirms it.
```

the team might establish:

```text
A Buyer submits a Draft Order.
Submitting reserves inventory and changes the Order to Pending Payment.
```

This statement reveals concepts, state transitions, actors, and rules that can appear directly in code and tests.

### Language in Code

Code should reflect the agreed language:

```csharp
public sealed class Order
{
    public OrderStatus Status { get; private set; }

    public void Submit(BuyerId buyerId)
    {
        if (Status != OrderStatus.Draft)
        {
            throw new DomainRuleViolation(
                "Only a draft order can be submitted.");
        }

        BuyerId = buyerId;
        Status = OrderStatus.PendingPayment;
    }
}
```

Names such as `Submit`, `Buyer`, `Draft`, and `PendingPayment` carry domain meaning. A generic method such as `UpdateStatus(2)` hides that meaning and allows invalid transitions.

The language should appear in:

- Class, method, event, and module names.
- Acceptance criteria and executable examples.
- Test names and assertions.
- API operations and messages where the language is part of a public contract.
- User-interface text where appropriate.
- Architecture decision records and diagrams.

Infrastructure details do not need domain names when no domain meaning exists. `SqlConnection`, `RetryPolicy`, and `HttpClient` remain technical concepts.

### Discovering and Refining the Language

The language is discovered collaboratively rather than invented by developers alone.

Useful techniques include:

- Domain-expert interviews.
- Event storming.
- Example mapping.
- Story mapping.
- Process walkthroughs.
- Reviewing real forms, policies, reports, and exception cases.
- Writing concrete scenarios and acceptance tests.
- Listening for overloaded terms and synonyms.

Questions that expose the model include:

- What event starts this process?
- Who is allowed to make this decision?
- What must be true before it happens?
- What can prevent or reverse it?
- Which terms mean different things to different departments?
- Which values are calculated, and according to which policy?
- What is the business name for this state transition?

When a term is ambiguous, do not hide the ambiguity with a generic word. Clarify it or recognize that multiple contexts may exist.

### Language Smells

Signals that the language or model needs work include:

- Different teams use the same word for different concepts.
- Several words are used for the same concept without an intentional distinction.
- Developers constantly translate business terms into technical names.
- Core methods are named `Process`, `Handle`, `Manage`, or `Update` without saying what happens.
- Boolean flags represent unexplained business states.
- Domain experts cannot understand the important code-level concepts when described.
- The database schema dictates language that no longer matches the business.
- Requirements rely on pronouns such as "it" or "they" where ownership is unclear.

For example, `IsActive` may mean:

- A subscription is within its paid period.
- A user can sign in.
- A product can be purchased.
- A supplier is approved.

Separate concepts should receive separate names.

### What a Bounded Context Is

A Bounded Context defines where a particular model and Ubiquitous Language apply. Inside the boundary:

- Terms have agreed meanings.
- Rules and invariants are internally consistent.
- The model has clear ownership.
- Changes are evaluated against that context's needs.

Outside the boundary, another model may use different terms, structures, and rules.

Consider `Product`:

```text
Catalog context:
  ProductId, title, description, images, category

Pricing context:
  ProductId, price list, discount eligibility, tax classification

Inventory context:
  SKU, warehouse balances, reorder threshold

Shipping context:
  package dimensions, weight, hazardous-material classification
```

These models can refer to the same real-world offering while representing different domain concerns.

### A Bounded Context Is Not Automatically a Microservice

A bounded context is a semantic and model boundary. A microservice is a deployment and operational boundary.

One bounded context can be implemented as:

- A module in a modular monolith.
- One deployable service.
- Several collaborating services sharing one coherent model.
- A protected area inside a legacy application.

Likewise, a poorly designed service can contain several conflicting models.

Deployment decisions should consider independent scaling, release cadence, security, resilience, team ownership, and operational cost. Do not create network boundaries merely because a context boundary exists.

### Identifying Bounded Contexts

Useful boundary signals include:

- A shift in language or meaning.
- Different business policies or invariants.
- Different actors and workflows.
- Different rates or reasons for change.
- Separate ownership or decision authority.
- Different data freshness and consistency requirements.
- Distinct security or regulatory rules.
- A need for independent evolution.

For example, in an insurance system, `Policy` may mean:

- A quoted offer in Sales.
- A legally active contract in Underwriting.
- Coverage available for a claim in Claims.

These differences are not naming inconveniences. They indicate distinct models and responsibilities.

Boundaries should not be chosen only from:

- Organization charts.
- Existing database schemas.
- UI pages.
- Technical layers.
- CRUD entity lists.
- A target number of services.

Those factors can provide evidence, but business meaning and consistency remain central.

### Context Boundaries and Team Ownership

Clear ownership supports a coherent language. A team should be able to evolve its model without requiring approval from every other team.

Useful alignment often exists between:

- A bounded context.
- A cohesive module or service.
- A team that owns its behavior and data.

This is not a rigid rule. Small organizations may have one team owning several contexts. The important point is that responsibility and decision rights are explicit.

Shared ownership of every model often leads to:

- Slow coordinated changes.
- Compromise abstractions that satisfy no context well.
- Accidental coupling.
- Unclear responsibility for defects and data.

### Context Maps

A **context map** describes bounded contexts and their relationships. It makes model dependencies and integration choices visible.

Example:

```text
[Sales] ---> [Ordering] ---> [Fulfillment]
    |              |
    v              v
[Pricing]       [Billing]

[Legacy ERP] --anti-corruption layer--> [Ordering]
```

A context map should show more than boxes. It should answer:

- Which context is upstream?
- Which context depends on another?
- Who controls the contract?
- How are models translated?
- Is the integration synchronous, asynchronous, or batch-based?
- Where is coupling intentionally accepted?

### Common Context Relationships

Important context-mapping patterns include:

**Partnership**

Two contexts coordinate closely and align their plans because both succeed or fail together. This requires strong collaboration and can reduce autonomy.

**Shared Kernel**

Contexts deliberately share a small part of a model or code. Changes require coordination, so the shared area must remain limited and jointly owned.

**Customer-Supplier**

An upstream context supplies capabilities to a downstream customer. The downstream needs influence the upstream contract through an explicit relationship.

**Conformist**

The downstream context adopts the upstream model as-is because it cannot influence it or the cost of translation is not worthwhile.

**Anti-Corruption Layer**

The downstream context translates an external or legacy model into its own language so foreign concepts do not spread through its domain.

**Open Host Service and Published Language**

An upstream context exposes a stable integration protocol and documented representation for multiple consumers.

**Separate Ways**

Contexts do not integrate because duplication or independent work costs less than ongoing coupling.

These patterns describe social and technical relationships. Selecting one should be an explicit design decision.

### Anti-Corruption Layers

An anti-corruption layer (ACL) protects one model from another. It commonly contains:

- Adapters.
- Translators.
- Facades.
- Integration DTOs.
- Mapping rules.

Suppose a legacy ERP calls a customer an `Account` and encodes status as numeric values:

```csharp
public sealed record LegacyAccountDto(
    string AccountNo,
    int StatusCode,
    decimal CreditCeiling);

public sealed class LegacyCustomerTranslator
{
    public CustomerCreditProfile Translate(LegacyAccountDto source)
    {
        var status = source.StatusCode switch
        {
            10 => CreditStatus.Approved,
            20 => CreditStatus.Suspended,
            _ => CreditStatus.Unknown
        };

        return new CustomerCreditProfile(
            new CustomerId(source.AccountNo),
            status,
            Money.Usd(source.CreditCeiling));
    }
}
```

The rest of the domain uses `CustomerCreditProfile`, `CreditStatus`, and `Money`. It does not inherit the ERP's terminology and encoding.

An ACL has a maintenance cost. Use it when preserving model independence is more valuable than directly accepting the upstream model.

### Integration Between Contexts

Contexts should exchange explicit contracts rather than share internal domain objects.

Suitable contracts include:

- Request and response DTOs.
- Commands.
- Integration events.
- Published schemas.
- Files with versioned formats.

An integration event should describe a fact in the publisher's language:

```csharp
public sealed record OrderSubmittedIntegrationEvent(
    Guid OrderId,
    Guid BuyerId,
    decimal Total,
    string Currency);
```

The consumer translates that fact into its own model. It should not reference the publisher's aggregate classes or database tables.

Integration requires decisions about:

- Contract versioning.
- Ownership.
- Idempotency.
- Failure handling.
- Data freshness.
- Compatibility.
- Security and privacy.

### Shared Identity Does Not Mean Shared Entity

Two contexts may use the same identifier while modeling different entities.

For example:

```text
Identity context:
  UserId, credentials, MFA methods, lockout state

Ordering context:
  BuyerId, delivery preferences, order eligibility

Support context:
  RequesterId, service tier, open cases
```

The shared identifier supports correlation. It does not require a single `User` class, shared table, or universal set of attributes.

This distinction prevents a large enterprise entity from becoming a dependency of every context.

### Data Ownership

Each context should own the data needed to enforce its model and rules. Other contexts should use contracts rather than directly updating that data.

Data ownership does not always require a separate physical database. A modular monolith can use:

- Separate schemas.
- Separate `DbContext` types.
- Restricted repository access.
- Architecture tests.

The essential rule is behavioral ownership: one context is authoritative for a fact and controls its writes.

Duplicating selected data can be appropriate when:

- A consumer needs a local read model.
- Availability should not depend on a synchronous upstream call.
- Historical values must remain stable.
- Different contexts interpret the information differently.

The team must then define freshness and reconciliation expectations.

### Strategic DDD Versus Tactical DDD

Strategic DDD addresses the large-scale model:

- Subdomains.
- Bounded contexts.
- Ubiquitous Languages.
- Context maps.
- Relationships and ownership.

Tactical DDD addresses modeling inside a context:

- Entities.
- Value objects.
- Aggregates.
- Repositories.
- Domain services.
- Domain events.

Tactical patterns do not repair a missing strategic boundary. Perfect aggregates inside one giant conflicting enterprise model can still produce poor architecture.

### Testing the Language and Boundaries

The language can be tested through examples:

```gherkin
Scenario: Submitting a draft order
  Given a Buyer has a Draft Order with at least one item
  When the Buyer submits the Order
  Then the Order becomes Pending Payment
  And inventory reservation is requested
```

If domain experts and developers interpret this differently, the language is not yet precise.

Boundaries can be tested with:

- Architecture tests preventing forbidden dependencies.
- Contract tests between contexts.
- Integration tests for translation layers.
- Consumer-driven contract tests where appropriate.
- Ownership checks for database access.

### Evolving a Bounded Context

Context boundaries and language are hypotheses that improve with learning. Evolution may involve:

- Renaming concepts to match current understanding.
- Splitting a context with conflicting models.
- Merging contexts whose separation adds no value.
- Introducing an ACL around a legacy model.
- Replacing shared code with explicit contracts.
- Moving a boundary without changing deployment.

Renaming is not cosmetic when it corrects the model. Code, tests, documentation, and team conversation should change together.

### Trade-Offs

Benefits include:

- Better communication between business and technology.
- More cohesive models.
- Clear ownership.
- Reduced accidental coupling.
- Safer independent evolution.
- More meaningful code.

Costs include:

- Time with domain experts.
- Translation between contexts.
- Contract and mapping maintenance.
- Potential data duplication.
- More explicit integration work.
- Ongoing effort to keep language current.

DDD is most valuable where business complexity and changing rules dominate. A simple CRUD context may not need extensive modeling, but it still benefits from clear language and ownership.

### Common Mistakes

- Treating Ubiquitous Language as a static glossary.
- Forcing one enterprise-wide meaning for every term.
- Allowing code terminology and business terminology to diverge.
- Defining contexts from database tables or technical layers alone.
- Assuming every bounded context must be a microservice.
- Sharing one domain model assembly across all contexts.
- Using another context's entities as integration contracts.
- Creating boundaries so small that every use case requires many cross-context calls.
- Ignoring social ownership and decision authority.
- Letting legacy or vendor terminology leak throughout the domain.
- Treating the initial context map as permanent.

### Best Practices

- Build the language collaboratively from concrete business scenarios.
- Use the language consistently in code, tests, conversation, and documentation.
- Challenge ambiguous words and hidden synonyms.
- Scope each language to an explicit bounded context.
- Identify boundaries from meaning, invariants, ownership, and change patterns.
- Keep context contracts explicit and versionable.
- Translate models at boundaries instead of sharing internal objects.
- Use an anti-corruption layer when an external model would distort the local model.
- Align team ownership with contexts where practical.
- Treat deployment topology as a separate decision.
- Review and refine the model as domain knowledge grows.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is Ubiquitous Language in Domain-Driven Design?

<!-- question:start:ubiquitous-language-and-bounded-contexts-beginner-q01 -->
<!-- question-id:ubiquitous-language-and-bounded-contexts-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Ubiquitous Language is a precise, shared language developed by domain experts and software practitioners around a domain model. The team uses it consistently in discussion, requirements, code, tests, and documentation. It reduces translation gaps and exposes ambiguity. The language is not fixed; it evolves as the team's understanding of the domain improves.

##### Key Points to Mention

- It is model-based, not merely a glossary.
- Business and technical participants use the same terms.
- Important terms should appear in code and examples.
- It is scoped to a bounded context and evolves continuously.

<!-- question:end:ubiquitous-language-and-bounded-contexts-beginner-q01 -->

#### What is a bounded context?

<!-- question:start:ubiquitous-language-and-bounded-contexts-beginner-q02 -->
<!-- question-id:ubiquitous-language-and-bounded-contexts-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A bounded context is an explicit boundary within which one domain model and Ubiquitous Language are internally consistent. The same real-world concept can have different representations and rules in other contexts. Contexts communicate through explicit contracts and translations instead of sharing one universal model.

##### Key Points to Mention

- The boundary defines where a model applies.
- Terms can legitimately have different meanings across contexts.
- A context should have clear ownership and consistent rules.
- Integration occurs through explicit contracts.

<!-- question:end:ubiquitous-language-and-bounded-contexts-beginner-q02 -->

#### Why can the same term mean different things in different bounded contexts?

<!-- question:start:ubiquitous-language-and-bounded-contexts-beginner-q03 -->
<!-- question-id:ubiquitous-language-and-bounded-contexts-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Different business capabilities care about different facts and behavior. A `Customer` in Sales may be a prospect, while a `Customer` in Billing may be a legally responsible account. Each model should contain only the meaning needed for its context. Forcing every meaning into one entity creates optional fields, conflicting rules, and coupling.

##### Key Points to Mention

- Models are purpose-specific representations.
- Shared real-world identity does not imply a shared software entity.
- Different rules and workflows justify different models.
- Context boundaries make semantic differences explicit.

<!-- question:end:ubiquitous-language-and-bounded-contexts-beginner-q03 -->

#### Is a bounded context the same as a microservice?

<!-- question:start:ubiquitous-language-and-bounded-contexts-beginner-q04 -->
<!-- question-id:ubiquitous-language-and-bounded-contexts-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

No. A bounded context is a model and language boundary, while a microservice is an independently deployable operational boundary. A bounded context can be implemented as a module in a monolith, one service, or several collaborating services. Deployment should be chosen from scaling, release, resilience, security, and team requirements rather than inferred automatically from DDD.

##### Key Points to Mention

- Semantic boundaries and deployment boundaries solve different problems.
- A modular monolith can contain several bounded contexts.
- Microservices add network and operational complexity.
- Context boundaries can guide service boundaries without dictating them.

<!-- question:end:ubiquitous-language-and-bounded-contexts-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How do you discover a Ubiquitous Language with domain experts?

<!-- question:start:ubiquitous-language-and-bounded-contexts-intermediate-q01 -->
<!-- question-id:ubiquitous-language-and-bounded-contexts-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Work through real scenarios, decisions, exceptions, policies, and state transitions using techniques such as event storming, example mapping, and process walkthroughs. Listen for synonyms, overloaded terms, vague verbs, and disagreements. Turn clarified language into executable examples and code, then ask domain experts to challenge it. Refine the model whenever the language feels awkward or fails to explain a case.

##### Key Points to Mention

- Start from behavior and examples, not database tables.
- Include developers, testers, product stakeholders, and domain experts.
- Ambiguity is valuable evidence of missing model knowledge.
- Language and model evolve together.

<!-- question:end:ubiquitous-language-and-bounded-contexts-intermediate-q01 -->

#### What signals suggest that a domain should be split into multiple bounded contexts?

<!-- question:start:ubiquitous-language-and-bounded-contexts-intermediate-q02 -->
<!-- question-id:ubiquitous-language-and-bounded-contexts-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Look for shifts in terminology, conflicting meanings, different invariants, different actors and workflows, separate ownership, distinct security rules, and capabilities that change for different reasons. A model that accumulates many optional properties or conditional rules based on department can also indicate mixed contexts. Boundaries are hypotheses and should be validated against real workflows and integration cost.

##### Key Points to Mention

- Language changes are strong boundary signals.
- Business rules and transactional consistency matter.
- Team and data ownership provide supporting evidence.
- Avoid splitting solely by entity, UI page, or technical layer.

<!-- question:end:ubiquitous-language-and-bounded-contexts-intermediate-q02 -->

#### What is a context map, and what should it communicate?

<!-- question:start:ubiquitous-language-and-bounded-contexts-intermediate-q03 -->
<!-- question-id:ubiquitous-language-and-bounded-contexts-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A context map shows bounded contexts and their relationships. It should identify upstream and downstream dependencies, contract ownership, translation boundaries, and collaboration patterns such as Shared Kernel, Customer-Supplier, Conformist, Anti-Corruption Layer, or Separate Ways. It can also record communication style and important ownership constraints.

##### Key Points to Mention

- A context map is more than a component diagram.
- It exposes model and organizational dependencies.
- Relationship patterns describe how teams and models interact.
- The map should change as the domain and integrations evolve.

<!-- question:end:ubiquitous-language-and-bounded-contexts-intermediate-q03 -->

#### When should you use an anti-corruption layer?

<!-- question:start:ubiquitous-language-and-bounded-contexts-intermediate-q04 -->
<!-- question-id:ubiquitous-language-and-bounded-contexts-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use an anti-corruption layer when an upstream, legacy, or vendor model would otherwise leak concepts that distort the local domain model. The layer translates external contracts into local terms through adapters, facades, and mapping. It is worthwhile when local model independence exceeds the cost of maintaining translation; a conformist relationship may be simpler when the upstream model is acceptable and influence is limited.

##### Key Points to Mention

- The ACL protects the local Ubiquitous Language.
- Translation belongs at the boundary.
- It is especially useful for legacy and third-party integration.
- It adds code and maintenance, so use it deliberately.

<!-- question:end:ubiquitous-language-and-bounded-contexts-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you prevent a shared enterprise model from coupling multiple bounded contexts?

<!-- question:start:ubiquitous-language-and-bounded-contexts-advanced-q01 -->
<!-- question-id:ubiquitous-language-and-bounded-contexts-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Give each context ownership of its domain model and persistence behavior. Exchange versioned DTOs or events rather than domain entities, and translate them into local concepts. Share identifiers only where correlation is needed. If a Shared Kernel is justified, keep it small, stable, and jointly governed. Enforce boundaries through module references, architecture tests, and data-access rules.

##### Key Points to Mention

- Shared identity does not require shared entity classes.
- Integration contracts are not internal domain models.
- Shared kernels create coordinated change and must remain limited.
- Technical enforcement supports semantic ownership.

<!-- question:end:ubiquitous-language-and-bounded-contexts-advanced-q01 -->

#### How do bounded contexts influence data ownership and consistency?

<!-- question:start:ubiquitous-language-and-bounded-contexts-advanced-q02 -->
<!-- question-id:ubiquitous-language-and-bounded-contexts-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Each context should be authoritative for the data and invariants of its model. Other contexts request behavior or consume published facts instead of directly changing its storage. Cross-context workflows may use replicated read models and eventual consistency because one global transaction would couple ownership. A modular monolith can still use a shared physical database if schemas, contexts, and write access remain logically separated.

##### Key Points to Mention

- Behavioral write ownership matters more than physical database count.
- Cross-context updates should use contracts.
- Replication requires explicit freshness and reconciliation rules.
- Consistency choices follow business invariants.

<!-- question:end:ubiquitous-language-and-bounded-contexts-advanced-q02 -->

#### How would you split an existing bounded context that has become internally inconsistent?

<!-- question:start:ubiquitous-language-and-bounded-contexts-advanced-q03 -->
<!-- question-id:ubiquitous-language-and-bounded-contexts-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Identify conflicting language, policies, ownership, and change clusters. Define candidate contexts with separate models and assign authoritative behavior and data. Introduce an internal contract or translation layer, redirect one workflow at a time, and prevent new dependencies on the old shared model. The deployment can remain monolithic during the split. Validate the result through reduced conditional logic, clearer language, and more localized changes.

##### Key Points to Mention

- Split behavior and ownership, not folders alone.
- Use incremental migration rather than a large rewrite.
- Make translation and authority explicit.
- Deployment separation is optional and can occur later.

<!-- question:end:ubiquitous-language-and-bounded-contexts-advanced-q03 -->

#### How do you decide between a Shared Kernel, Conformist relationship, and Anti-Corruption Layer?

<!-- question:start:ubiquitous-language-and-bounded-contexts-advanced-q04 -->
<!-- question-id:ubiquitous-language-and-bounded-contexts-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Use a Shared Kernel when both teams benefit from a small common model and can coordinate its changes. Use Conformist when the downstream cannot influence the upstream and accepting its model costs less than translation. Use an Anti-Corruption Layer when preserving the downstream model is strategically important enough to justify mapping. The decision depends on model fit, power relationships, change frequency, and coordination cost.

##### Key Points to Mention

- Context relationships include organizational dynamics.
- Shared Kernel trades duplication for coordination.
- Conformist minimizes local work but accepts upstream influence.
- ACL preserves autonomy at the cost of translation.

<!-- question:end:ubiquitous-language-and-bounded-contexts-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
