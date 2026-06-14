---
id: adrs-coding-conventions-and-team-level-design-communication
topic: Testing strategy, maintainability, and technical leadership
subtopic: ADRs, coding conventions, and team-level design communication
category: Design & Architecture
---

## Overview

Software design is a continuing sequence of decisions. Teams choose boundaries, data ownership, integration styles, dependencies, security models, deployment approaches, and operational trade-offs. The code records the result, but it rarely explains the context, alternatives, assumptions, and consequences that led to it.

An Architecture Decision Record (ADR) is a short, durable record of one significant design decision. A useful ADR explains the problem and constraints, states the decision, records the alternatives considered, and describes positive and negative consequences. ADRs preserve reasoning so future engineers can understand whether a decision still fits rather than treating existing architecture as accidental or unquestionable.

Coding conventions reduce avoidable variation in implementation. They cover areas such as naming, formatting, nullability, asynchronous APIs, error handling, logging, tests, and public API design. Conventions are valuable when they improve readability, consistency, tool support, and defect prevention. They become harmful when they create review debates without producing an engineering benefit. Objective rules should be automated through formatters, compiler settings, analyzers, and continuous integration where possible.

Team-level design communication connects these practices. A team may use an exploratory design document or request for comments before deciding, diagrams and prototypes to clarify a proposal, an ADR to record the outcome, executable contracts and tests to enforce important properties, and code conventions to make implementation predictable.

Interviewers use this topic to evaluate technical leadership. Strong candidates can communicate a design to different audiences, make assumptions and trade-offs explicit, preserve decision history, encourage productive disagreement, and turn important agreements into lightweight, maintainable guardrails.

## Core Concepts

### What an ADR Records

An ADR normally contains:

- **Title:** A short decision statement.
- **Status:** Proposed, accepted, superseded, deprecated, or rejected.
- **Context:** The problem, constraints, assumptions, and forces.
- **Decision:** The chosen approach and its scope.
- **Alternatives:** Serious options that were considered.
- **Consequences:** Benefits, costs, risks, and follow-up work.
- **Links:** Related decisions, diagrams, experiments, issues, or implementation changes.

A compact template is often sufficient:

```md
# Use asynchronous events for order fulfillment

Status: Accepted
Date: 2026-06-14

Context:
Checkout must remain responsive when fulfillment providers are slow.
The business accepts eventual consistency after payment authorization.

Decision:
Publish a versioned OrderAccepted event through the managed message broker.
Fulfillment services will process it with idempotent consumers.

Alternatives:
- Synchronous HTTP orchestration
- Shared database polling

Consequences:
- Checkout is isolated from fulfillment latency.
- Message schemas and duplicate handling become explicit responsibilities.
- End-to-end completion is eventually consistent.
```

The exact format matters less than concise, discoverable reasoning.

### When to Write an ADR

An ADR is useful when a decision is:

- Expensive or risky to reverse.
- Likely to be questioned later.
- Shared across components or teams.
- Constrained by security, compliance, cost, or operations.
- A deliberate exception to an established standard.
- Based on assumptions that may change.

Examples include choosing a data store, defining service boundaries, adopting an identity provider, selecting a messaging model, or accepting eventual consistency. Routine implementation details and easily reversible local choices usually do not need an ADR.

### One Decision per Record

Keep each ADR focused on one coherent decision. A large document containing many unrelated decisions is difficult to review, supersede, and search. Related ADRs can link to one another and to a broader design document.

The title should state the decision rather than only the topic. "Use PostgreSQL for the audit service" communicates more than "Audit database."

### ADR Lifecycle and Immutability

Typical statuses include:

- **Proposed:** Open for review.
- **Accepted:** The team has agreed to follow it.
- **Rejected:** Considered but not selected.
- **Superseded:** Replaced by a newer decision.
- **Deprecated:** No longer recommended, although it may still exist.

After acceptance, preserve the historical record. Correct minor errors if needed, but do not silently rewrite the rationale to match current knowledge. Create a new ADR that supersedes the old one and explain what changed. This makes architectural evolution traceable.

### Context, Assumptions, and Constraints

The context should explain the forces that make the decision meaningful:

- Required capabilities and quality attributes.
- Current architecture and migration constraints.
- Scale, latency, availability, consistency, and cost targets.
- Security, privacy, regulatory, and data residency requirements.
- Team skills, operational maturity, and delivery deadlines.
- Known unknowns and assumptions.

An assumption should be testable where possible. For example, "traffic will remain below 500 requests per second for the next year" can have a review trigger. A constraint is a boundary the solution must currently respect, such as a contractual platform requirement.

### Alternatives and Consequences

An ADR should present credible alternatives fairly. Record why each was not chosen under the current context, not why it is universally bad. Consequences should include disadvantages and new responsibilities, not just benefits.

For example, choosing asynchronous messaging can improve temporal decoupling but introduces eventual consistency, duplicate delivery, schema evolution, tracing, and operational dependencies. Naming these consequences helps implementation and later review.

### Evidence and Validation

Important decisions may require:

- A time-boxed prototype or spike.
- Load, failure, or cost testing.
- Threat modeling.
- An operational readiness review.
- Consumer feedback.
- An architecture fitness check.

Record the evidence and uncertainty. An ADR is not proof that a decision is correct forever; it documents why the decision is reasonable now and how the team will notice when its assumptions stop holding.

### ADRs, Design Documents, and Documentation

These artifacts serve different purposes:

| Artifact | Primary purpose |
| --- | --- |
| Design document or RFC | Explore a problem and solicit feedback before commitment |
| ADR | Record a significant decision and its reasoning |
| C4 or component diagram | Explain static structure and boundaries |
| Sequence diagram | Explain an interaction over time |
| API specification | Define an interface contract |
| Runbook | Guide operational diagnosis and recovery |
| Code comments | Explain local intent that cannot be made clear in code |

A design document can produce several ADRs. The ADR should link to supporting material rather than duplicate a long proposal.

### Discoverability and Ownership

ADRs should be:

- Stored near the relevant code or in a well-indexed architecture repository.
- Named or numbered consistently.
- Searchable in normal developer workflows.
- Linked from pull requests and implementation documentation.
- Owned by a team that can answer questions and review changes.

An ADR that nobody can find or that has no relationship to the implemented system provides little value.

### Coding Conventions as Shared Constraints

Coding conventions reduce cognitive switching and make code predictable across contributors. Useful areas include:

- Naming and file organization.
- Formatting and whitespace.
- Nullable reference types.
- Asynchronous method and cancellation conventions.
- Error and exception handling.
- Dependency injection and lifetime usage.
- Logging structure and sensitive-data rules.
- Public API compatibility.
- Test naming and organization.
- Security-sensitive APIs.

Conventions should explain the intended outcome, especially for rules that are not self-evident.

### Automate Objective Rules

For .NET repositories, `.editorconfig`, compiler settings, analyzers, and formatters can make conventions executable:

```ini
root = true

[*.cs]
dotnet_sort_system_directives_first = true
dotnet_style_require_accessibility_modifiers = always:warning
dotnet_diagnostic.CA2007.severity = suggestion
csharp_style_namespace_declarations = file_scoped:suggestion

[*.{csproj,props,targets}]
indent_size = 2
```

The exact rules should match the application and team. A warning promoted to an error affects delivery and should have a strong defect-prevention or consistency rationale. Generated code and migrations may require scoped exceptions.

### Compiler and Analyzer Policy

Enforcement levels should be deliberate:

- **Suggestion:** Educational or low-risk preference.
- **Warning:** A likely defect or important convention.
- **Error:** A rule that must block integration.

Start with visibility, fix or baseline existing findings, then increase enforcement. Enabling hundreds of noisy errors at once encourages blanket suppression rather than improvement. Suppressions should be narrow and include a reason.

### Avoid Convention-Driven Complexity

Consistency is useful, but local clarity remains the goal. Common convention mistakes include:

- Requiring interfaces for every class.
- Mandating a pattern where the framework already provides the capability.
- Enforcing file structures that fragment cohesive behavior.
- Applying public-library rules to private application code without reason.
- Blocking pull requests on preferences that tools do not enforce.
- Copying another organization's standard without its context.

Conventions should be reviewed when technology, team structure, or architecture changes.

### Communicate to the Audience

Different stakeholders need different information:

- Developers need contracts, dependencies, examples, and failure behavior.
- Operators need deployment, telemetry, capacity, and recovery implications.
- Security reviewers need trust boundaries, data flows, threats, and controls.
- Product stakeholders need capabilities, constraints, cost, risk, and delivery impact.
- Executives need decisions, options, exposure, and outcomes without implementation detail.

Using the same level of detail for every audience either overwhelms or under-informs them.

### Diagrams That Answer a Question

A diagram should have a purpose and a defined level of abstraction. Useful choices include:

- A context diagram for actors and external systems.
- A container or component diagram for ownership and dependencies.
- A sequence diagram for runtime interactions and failure paths.
- A deployment diagram for infrastructure and trust boundaries.
- A state diagram for lifecycle transitions.

Label important protocols, data ownership, asynchronous boundaries, and trust boundaries. Avoid diagrams that mix code-level classes, cloud resources, and business actors without a clear hierarchy.

### Asynchronous Review Before Meetings

For a significant proposal:

1. State the problem, constraints, and decision deadline.
2. Share a concise written proposal before the meeting.
3. Invite comments from affected owners.
4. Resolve factual questions asynchronously.
5. Use a meeting for unresolved trade-offs and decisions.
6. Record the outcome, dissent, owner, and follow-up actions.

This gives participants time to think and prevents presentation skill or seniority from dominating the decision.

### Productive Disagreement

Healthy design review separates people from ideas. Ask:

- Which requirement or risk does this option address?
- What evidence would change the decision?
- Is disagreement about facts, values, risk tolerance, or scope?
- Who is accountable for the decision?
- Is the choice reversible?
- When should it be reviewed?

After the accountable decision is made, the team should implement it consistently while preserving documented concerns and review triggers. Consensus is useful but not required for every decision.

### Link Decisions to Enforcement

The strongest design communication connects intent to implementation:

- ADRs link to pull requests and diagrams.
- API decisions link to OpenAPI or event schemas.
- Boundary decisions become architecture tests.
- Security decisions become analyzers, tests, and policy checks.
- Operational consequences become dashboards, alerts, and runbooks.
- Temporary exceptions have owners and expiry dates.

Documentation alone drifts. Automated checks alone lose context. Together they explain both why a rule exists and whether the system still follows it.

### Common Mistakes

- Writing ADRs after implementation only to justify a predetermined choice.
- Recording a technology choice without context or alternatives.
- Hiding disadvantages and uncertainty.
- Editing accepted ADRs until history is lost.
- Creating an ADR for every small coding choice.
- Storing decisions where contributors cannot find them.
- Letting formatting comments dominate code review.
- Adopting conventions without automation or rationale.
- Using diagrams with undefined scope or mixed abstraction.
- Holding design meetings without a written problem statement or decision owner.
- Treating disagreement as disloyalty.
- Failing to update or supersede decisions when assumptions change.

### Practical Best Practices

- Keep ADRs short, focused, and close to implementation.
- State assumptions and review triggers.
- Record credible alternatives and negative consequences.
- Supersede accepted decisions instead of rewriting history.
- Automate objective conventions.
- Introduce enforcement gradually and control noise.
- Match communication depth to the audience.
- Use diagrams to answer specific questions.
- Make decision authority and deadlines explicit.
- Connect important decisions to tests, contracts, telemetry, and runbooks.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is an Architecture Decision Record?

<!-- question:start:adrs-coding-conventions-and-team-level-design-communication-beginner-q01 -->
<!-- question-id:adrs-coding-conventions-and-team-level-design-communication-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

An ADR is a short record of one significant architecture decision. It captures the context and constraints, the selected option, important alternatives, and expected consequences. Its purpose is to preserve reasoning so future engineers can understand, implement, and reassess the decision.

##### Key Points to Mention

- Record one coherent decision.
- Include context, decision, alternatives, and consequences.
- Keep the record discoverable.
- ADRs explain why, not every implementation detail.

<!-- question:end:adrs-coding-conventions-and-team-level-design-communication-beginner-q01 -->

#### When should a team write an ADR?

<!-- question:start:adrs-coding-conventions-and-team-level-design-communication-beginner-q02 -->
<!-- question-id:adrs-coding-conventions-and-team-level-design-communication-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Write an ADR when a decision is consequential, difficult to reverse, cross-team, constrained by important quality attributes, or likely to be questioned later. Examples include data ownership, service boundaries, identity, messaging, and major technology choices. Do not create one for every routine or easily reversible implementation choice.

##### Key Points to Mention

- Focus on durable, significant decisions.
- Consider reversibility and blast radius.
- Record deliberate exceptions.
- Avoid documentation ceremony for trivial choices.

<!-- question:end:adrs-coding-conventions-and-team-level-design-communication-beginner-q02 -->

#### Why are coding conventions useful?

<!-- question:start:adrs-coding-conventions-and-team-level-design-communication-beginner-q03 -->
<!-- question-id:adrs-coding-conventions-and-team-level-design-communication-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Coding conventions make implementation more predictable, reduce unnecessary variation, support tools, and prevent recurring defects. They help engineers focus review attention on behavior and design instead of formatting. A convention should have a clear benefit and objective rules should be automated wherever practical.

##### Key Points to Mention

- Consistency reduces cognitive switching.
- Automation prevents repetitive review comments.
- Rules should serve clarity or risk reduction.
- Conventions need periodic review.

<!-- question:end:adrs-coding-conventions-and-team-level-design-communication-beginner-q03 -->

#### What is the difference between an ADR and a design document?

<!-- question:start:adrs-coding-conventions-and-team-level-design-communication-beginner-q04 -->
<!-- question-id:adrs-coding-conventions-and-team-level-design-communication-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A design document or RFC explores a problem, alternatives, and a proposed solution while feedback is still being gathered. An ADR records a decision and its reasoning after or during agreement. A substantial design document may result in several focused ADRs, which can link back to the proposal for detail.

##### Key Points to Mention

- Design documents support exploration.
- ADRs preserve decisions.
- Avoid duplicating long content.
- Link related artifacts.

<!-- question:end:adrs-coding-conventions-and-team-level-design-communication-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### What should happen when an accepted ADR is no longer appropriate?

<!-- question:start:adrs-coding-conventions-and-team-level-design-communication-intermediate-q01 -->
<!-- question-id:adrs-coding-conventions-and-team-level-design-communication-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Create a new ADR that explains the changed context and supersedes or deprecates the previous decision. Preserve the original record so the historical reasoning remains visible. Link both records and define the migration, compatibility, and enforcement work required by the new decision.

##### Key Points to Mention

- Do not silently rewrite accepted history.
- Explain which assumptions changed.
- Link old and new decisions.
- Plan implementation and migration.

<!-- question:end:adrs-coding-conventions-and-team-level-design-communication-intermediate-q01 -->

#### How would you introduce stricter coding rules into an existing .NET codebase?

<!-- question:start:adrs-coding-conventions-and-team-level-design-communication-intermediate-q02 -->
<!-- question-id:adrs-coding-conventions-and-team-level-design-communication-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Choose rules tied to defects, readability, or supported language practices, then configure them in shared compiler, analyzer, formatter, and `.editorconfig` settings. Measure existing violations, automatically fix safe cases, and baseline or address the remainder. Roll out enforcement gradually, document narrow exceptions, and keep generated code or migrations appropriately scoped.

##### Key Points to Mention

- Explain the engineering rationale.
- Automate fixes and checks.
- Control noise before making rules blocking.
- Avoid blanket suppressions.

<!-- question:end:adrs-coding-conventions-and-team-level-design-communication-intermediate-q02 -->

#### How do you communicate a design to both engineers and nontechnical stakeholders?

<!-- question:start:adrs-coding-conventions-and-team-level-design-communication-intermediate-q03 -->
<!-- question-id:adrs-coding-conventions-and-team-level-design-communication-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Start with the shared problem, desired outcome, constraints, options, and major trade-offs. For stakeholders, emphasize capability, risk, cost, and delivery implications. For engineers, add boundaries, contracts, data flows, failure modes, deployment, and examples. Keep terminology consistent and use layered diagrams so each audience can stop at the appropriate detail.

##### Key Points to Mention

- Tailor depth without changing the underlying facts.
- Lead with outcomes and constraints.
- Use diagrams with a defined scope.
- Make decisions and open questions explicit.

<!-- question:end:adrs-coding-conventions-and-team-level-design-communication-intermediate-q03 -->

#### How can a team prevent ADRs from becoming stale documentation?

<!-- question:start:adrs-coding-conventions-and-team-level-design-communication-intermediate-q04 -->
<!-- question-id:adrs-coding-conventions-and-team-level-design-communication-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Keep ADRs concise and close to normal engineering workflows, link them from code and pull requests, assign ownership, and add review triggers for important assumptions. Translate enforceable decisions into contracts, tests, analyzers, or architecture checks. Supersede records when the decision changes rather than attempting continuous prose maintenance.

##### Key Points to Mention

- Discoverability is essential.
- Connect rationale to automated evidence.
- Use ownership and review triggers.
- Preserve history through supersession.

<!-- question:end:adrs-coding-conventions-and-team-level-design-communication-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you facilitate a contentious cross-team architecture decision?

<!-- question:start:adrs-coding-conventions-and-team-level-design-communication-advanced-q01 -->
<!-- question-id:adrs-coding-conventions-and-team-level-design-communication-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Define the problem, scope, constraints, decision owner, and deadline in writing. Ask affected teams to review credible options and make disagreement concrete through requirements, risks, evidence, and reversibility. Use prototypes or measurements for disputed facts. Record the decision, unresolved risks, dissent, and review triggers, then ensure owners implement the outcome consistently.

##### Key Points to Mention

- Separate factual disagreement from risk preference.
- Prevent seniority from replacing evidence.
- Make decision authority explicit.
- Preserve concerns without requiring unanimous consensus.

<!-- question:end:adrs-coding-conventions-and-team-level-design-communication-advanced-q01 -->

#### How do you decide which architecture decisions should become automated checks?

<!-- question:start:adrs-coding-conventions-and-team-level-design-communication-advanced-q02 -->
<!-- question-id:adrs-coding-conventions-and-team-level-design-communication-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Automate properties that are important, objectively testable, and likely to regress, such as dependency direction, API compatibility, security policy, or resource limits. Keep the check fast, actionable, and owned. Do not encode every stylistic preference or context-dependent judgment as a central gate. Link the check to the ADR that explains its purpose.

##### Key Points to Mention

- Prioritize high-value invariant properties.
- Control false positives and maintenance cost.
- Give exceptions rationale and expiry.
- Combine executable evidence with human context.

<!-- question:end:adrs-coding-conventions-and-team-level-design-communication-advanced-q02 -->

#### How would you govern coding conventions across many repositories?

<!-- question:start:adrs-coding-conventions-and-team-level-design-communication-advanced-q03 -->
<!-- question-id:adrs-coding-conventions-and-team-level-design-communication-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Provide versioned shared configurations, analyzers, templates, and CI integrations with a small set of organization-wide safety rules. Allow repository-specific extension for domain and framework needs. Publish migration guidance, automate upgrades, collect feedback on noise, and define an exception process. Governance should improve consistency without freezing teams on an unsuitable central standard.

##### Key Points to Mention

- Use reusable, versioned tooling.
- Separate mandatory safety rules from defaults.
- Support gradual adoption.
- Measure developer friction and defect prevention.

<!-- question:end:adrs-coding-conventions-and-team-level-design-communication-advanced-q03 -->

#### What evidence would cause you to revisit an architecture decision?

<!-- question:start:adrs-coding-conventions-and-team-level-design-communication-advanced-q04 -->
<!-- question-id:adrs-coding-conventions-and-team-level-design-communication-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Revisit a decision when its assumptions, constraints, or consequences materially change. Evidence may include scale exceeding the design range, repeated incidents, unacceptable cost, new compliance requirements, poor delivery flow, unavailable platform support, or a simpler proven alternative. Compare the cost and risk of change with the cost of retaining the decision, then record any replacement through a new ADR.

##### Key Points to Mention

- Define review triggers when making the original decision.
- Use production and delivery evidence.
- Existing investment alone is not a sufficient reason to continue.
- Migration cost and reversibility still matter.

<!-- question:end:adrs-coding-conventions-and-team-level-design-communication-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
