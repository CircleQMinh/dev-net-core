---
id: assumptions-constraints-risks-failure-modes
topic: Requirements decomposition and system trade-offs
subtopic: Assumptions, constraints, risks, and failure modes
category: Design & Architecture
---


## Overview

Assumptions, constraints, risks, and failure modes are core tools for turning an unclear problem statement into a realistic system design. In real projects and technical interviews, requirements are rarely complete. A good engineer must clarify what is known, identify what is unknown, understand the limits of the solution, and design for what can go wrong.

An **assumption** is something treated as true for the purpose of making progress, even though it may need validation later. A **constraint** is a limit or rule that the solution must respect. A **risk** is an uncertain event or condition that could negatively affect the system, project, cost, security, reliability, or user experience. A **failure mode** is a specific way a system, component, dependency, or process can fail.

These concepts matter because system design is not only about choosing databases, queues, caches, or APIs. It is also about explaining why those choices are valid under the business context. For example, a design for a low-cost internal reporting tool can make different trade-offs from a payment platform that requires high availability, strict consistency, auditability, and regulatory compliance.

In interviews, candidates are often evaluated on whether they can handle ambiguity. Strong candidates do not jump directly into architecture diagrams. They first clarify assumptions, constraints, success metrics, and failure cases. They show that they understand trade-offs, not just technologies. This is especially important for fullstack .NET developers and cloud engineers because production systems depend on many external factors: traffic patterns, database limits, deployment process, authentication providers, third-party APIs, compliance rules, network behavior, and operational readiness.

A practical interview answer should usually show this flow:

1. Clarify requirements and identify unknowns.
2. State assumptions explicitly.
3. Identify constraints that limit design options.
4. Identify risks and failure modes.
5. Choose mitigations and explain trade-offs.
6. Define how the team will validate, monitor, and revise the design.

## Core Concepts

### Definitions

| Concept | Meaning | Example |
|---|---|---|
| Assumption | A belief treated as true until validated | "Traffic is read-heavy, around 90% reads and 10% writes." |
| Constraint | A limit the design must respect | "The system must use Azure SQL because the company already standardizes on it." |
| Risk | An uncertain condition that may harm the outcome | "The third-party payment API may have intermittent outages." |
| Failure mode | A specific way something can fail | "Payment callback is delayed, duplicated, or never received." |
| Mitigation | A design or process that reduces likelihood or impact | "Use idempotency keys and retry with backoff." |
| Residual risk | Risk that remains after mitigation | "A full payment provider outage still prevents new payments." |
| Blast radius | Scope of impact when a failure occurs | "Only one tenant is affected instead of all tenants." |
| Detection | How the team discovers a failure | "Alert when queue age exceeds five minutes." |
| Recovery | How the system returns to a healthy state | "Replay failed messages from a dead-letter queue." |

### Why These Concepts Matter in System Design

Assumptions, constraints, risks, and failure modes help engineers avoid shallow designs.

Without assumptions, a design may appear precise but be based on hidden guesses. Without constraints, the solution may be unrealistic for the business. Without risk analysis, the architecture may work only during the happy path. Without failure-mode thinking, the system may collapse under ordinary production problems such as dependency outages, network timeouts, duplicate messages, slow queries, expired certificates, or deployment mistakes.

For interview purposes, these concepts demonstrate maturity. A junior answer often says, "Use a load balancer, cache, database, and queue." A stronger answer says, "Assuming traffic is read-heavy and eventual consistency is acceptable, I would cache product details, but I would not cache payment state without a clear invalidation strategy because stale payment state creates business risk."

### Assumptions

An assumption is a temporary decision made in the absence of complete information. Assumptions are not bad. They become dangerous only when they are hidden, unvalidated, or treated as permanent facts.

Common assumptions in system design include:

- Expected traffic volume
- Read/write ratio
- User behavior
- Data growth rate
- Latency target
- Availability target
- Consistency requirements
- Security requirements
- Team skill level
- Cloud provider availability
- Budget limit
- Deployment frequency
- Existing system constraints
- Third-party dependency reliability

Good assumptions are explicit, testable, and easy to revise.

Poor assumption:

```text
The database will be fine.
```

Better assumption:

```text
Assumption: The first release needs to support 1,000 active users, 50 requests per second at peak, and 90% read traffic.
Validation: Confirm expected usage with product analytics or load testing before launch.
Design impact: Start with a single relational database, but keep read-heavy endpoints cacheable.
```

Interview habit:

```text
I will assume the system starts with moderate traffic, but I will avoid design choices that prevent horizontal scaling later.
```

This shows that you can make progress without pretending that every unknown is solved.

### Constraints

A constraint is a required boundary. Some constraints are hard requirements, while others are preferences or business realities.

Common constraint categories:

| Constraint Type | Examples |
|---|---|
| Business | Budget cap, launch deadline, required feature scope |
| Technical | Existing database, existing identity provider, required language or framework |
| Regulatory | Data residency, audit logs, retention rules, privacy requirements |
| Operational | Small team, limited on-call support, deployment window |
| Security | Encryption, least privilege, tenant isolation, authentication standard |
| Performance | Maximum response time, throughput target, batch window |
| Integration | Must integrate with legacy system, ERP, payment provider, or file feed |
| Organizational | Cloud provider standard, approved technology list, vendor contract |

Constraints reduce freedom but improve realism. A design that ignores constraints is usually not production-ready.

Example:

```text
Constraint: The company requires Azure-hosted services and managed identity for service-to-service access.

Design impact:
- Use Azure App Service or Azure Container Apps for hosting.
- Use Azure Key Vault for secret storage.
- Use managed identities where possible.
- Avoid unmanaged secret files in source control or deployment artifacts.
```

### Assumptions vs Constraints

Assumptions and constraints are often confused.

An assumption is uncertain and should be validated. A constraint is a known limit that must be respected.

| Question | Assumption | Constraint |
|---|---|---|
| Is it known to be true? | Not fully | Yes |
| Can it change after validation? | Yes | Sometimes, but usually harder |
| Should it be documented? | Yes | Yes |
| Example | "Most users are in one region." | "Data must remain in the EU." |
| Design effect | Guides an initial choice | Limits allowed choices |

A strong interview answer separates them clearly:

```text
Assumption: Most traffic comes from North America.
Constraint: User personal data must be stored only in approved regions.
```

### Risks

A risk is an uncertain event or condition that may affect the solution. Risks can be technical, product, operational, security, cost, or organizational.

A simple risk statement should include cause, event, and impact.

```text
Because the system depends on a third-party identity provider, if the provider is unavailable, users may not be able to sign in, causing an outage for authenticated workflows.
```

A practical risk register can look like this:

| Risk | Likelihood | Impact | Mitigation | Residual Risk |
|---|---:|---:|---|---|
| Payment provider outage | Medium | High | Use retries, idempotency keys, webhook reconciliation, provider status monitoring | New payments may still be delayed |
| Database hot partition | Medium | High | Choose partition key carefully, monitor RU/DTU/CPU, load test tenant distribution | Unexpected tenant growth can still cause imbalance |
| Cache contains stale data | Medium | Medium | Use short TTL, cache invalidation, versioned keys | Brief stale reads may still occur |
| Deployment breaks API contract | Low | High | Contract tests, backward-compatible DTO changes, staged rollout | Clients using undocumented behavior may still break |

Common risk responses:

| Response | Meaning | Example |
|---|---|---|
| Avoid | Change the design to remove the risk | Do not store card details directly |
| Reduce | Add controls to lower likelihood or impact | Add retries with backoff |
| Transfer | Move responsibility to another party | Use a managed payment processor |
| Accept | Acknowledge and monitor the risk | Accept temporary manual recovery for an internal admin tool |

### Failure Modes

A failure mode is a concrete way a system can fail. It is more specific than a general risk.

General risk:

```text
The order system may be unreliable.
```

Specific failure modes:

```text
- The database is unavailable.
- The payment provider times out.
- A message is published twice.
- A consumer processes a message but fails before acknowledging it.
- A cache returns stale data.
- A deployment introduces an incompatible response shape.
- A region outage makes one deployment unavailable.
- A background job falls behind and creates a queue backlog.
- A network partition prevents one service from reaching another.
```

Failure-mode thinking is important because modern systems often fail partially rather than completely. One API endpoint may be slow while others are healthy. One tenant may have bad data. One downstream service may reject requests. One background worker may stop while the web app still returns 200 responses.

### Failure Mode Analysis

Failure Mode Analysis is a structured way to identify what can fail, what happens when it fails, and how to reduce the impact.

A practical process:

1. Choose a critical user flow.
2. Break the flow into steps.
3. List dependencies for each step.
4. Identify failure modes for each dependency.
5. Estimate likelihood, impact, and blast radius.
6. Define detection signals.
7. Define mitigation and recovery actions.
8. Test the most important failure scenarios.

Example flow: "User places an order."

| Step | Dependency | Failure Mode | Impact | Detection | Mitigation |
|---|---|---|---|---|---|
| Validate cart | Product service | Product service slow | Checkout latency increases | Latency alert | Timeout, cache product snapshot |
| Create order | Database | Write fails | Order not created | Error rate alert | Retry only if safe, return clear error |
| Charge payment | Payment API | Timeout after successful charge | User may be charged but order state unknown | Reconciliation job | Idempotency key, pending state, webhook reconciliation |
| Publish order event | Message broker | Event publish fails | Warehouse not notified | Dead-letter or missing event metric | Outbox pattern |
| Send email | Email provider | Email fails | User does not receive confirmation | Email failure metric | Retry background job, user can view order status in app |

This style is highly valuable in interviews because it shows production awareness.

### Failure Modes vs Errors

A useful distinction:

- An **error** is an expected abnormal result that the system can handle as part of normal control flow.
- A **failure** is when the system cannot perform its intended function without recovery, intervention, or degraded behavior.

Example:

```text
Invalid login password: expected error.
Identity provider unavailable: failure mode.
```

```text
User submits invalid email: expected validation error.
Email provider rejects all send requests due to service outage: failure mode.
```

This distinction helps avoid over-engineering normal validation errors while still preparing for real reliability problems.

### How Assumptions Affect Architecture Choices

Architecture choices are only correct under certain assumptions.

Example:

```text
Assumption: Product catalog updates are rare, but reads are frequent.

Possible design:
- Cache product details.
- Use CDN for product images.
- Accept eventual consistency for product display.
- Keep inventory and payment flows strongly consistent.
```

If the assumption changes, the design may change:

```text
New information: Prices change every few seconds and must be immediately accurate.

Design adjustment:
- Avoid long-lived product price cache.
- Separate static product data from dynamic pricing data.
- Add stronger cache invalidation or read from source of truth during checkout.
```

Interview habit:

```text
This cache is valid only if stale reads are acceptable for this data. If not, I would avoid caching this field or use shorter TTL and version-based invalidation.
```

### How Constraints Affect Trade-Offs

Constraints often force trade-offs. A strong engineer explains the trade-off instead of hiding it.

Example:

```text
Constraint: The team must launch in six weeks.

Trade-off:
- Use managed cloud services instead of operating custom infrastructure.
- Prefer simpler architecture over complex event-driven workflows.
- Accept lower flexibility in exchange for faster delivery and lower operational risk.
```

Example:

```text
Constraint: The system must support strict auditability.

Trade-off:
- Add append-only audit logs.
- Avoid hard deletes for important business records.
- Increase storage cost and implementation complexity.
```

### Risk, Impact, Likelihood, and Priority

Risks are commonly prioritized by likelihood and impact.

| Likelihood | Meaning |
|---|---|
| Low | Unlikely but possible |
| Medium | Reasonably possible |
| High | Expected or already observed |

| Impact | Meaning |
|---|---|
| Low | Minor inconvenience, easy recovery |
| Medium | User-visible degradation or operational work |
| High | Outage, data loss, security issue, compliance issue, or major business impact |

A simple priority formula:

```text
Risk priority = Likelihood × Impact
```

This is not a perfect mathematical model, but it helps teams focus on the most important risks first.

High-priority risks usually include:

- Data loss
- Security breach
- Payment inconsistency
- System-wide outage
- Regulatory violation
- Unbounded cost growth
- Irrecoverable deployment failure
- Broken backward compatibility for public clients

### Blast Radius

Blast radius describes how much of the system is affected by a failure.

Large blast radius:

```text
One bad tenant query consumes all database resources and slows down every tenant.
```

Smaller blast radius:

```text
Each tenant has rate limits, partitioning, and resource isolation, so one tenant cannot degrade all tenants.
```

Techniques to reduce blast radius:

- Tenant isolation
- Rate limiting
- Bulkheads
- Circuit breakers
- Queue-based buffering
- Separate read and write workloads
- Separate critical and non-critical background jobs
- Separate deployments or scaling units for high-risk components
- Least privilege access control
- Feature flags for controlled rollout

### Degraded Mode

Degraded mode means the system continues to provide reduced functionality instead of failing completely.

Examples:

| Failure | Degraded Behavior |
|---|---|
| Recommendation service is down | Show popular items instead |
| Email provider is down | Store email request and retry later |
| Analytics pipeline is down | Continue core user flow and buffer events |
| Cache is unavailable | Read from database with rate limits |
| Search index is stale | Show database-backed basic search |

Degraded mode is a common senior-level interview concept because it shows that reliability is not always about preventing failure. Sometimes it is about keeping the most important workflows available.

### Common Failure Modes in Web and Cloud Systems

Common failure modes include:

| Area | Failure Modes |
|---|---|
| API | Timeouts, dependency failures, bad deployment, incompatible DTO change |
| Database | Deadlocks, slow queries, connection pool exhaustion, migration failure, data corruption |
| Cache | Stale data, cache stampede, unavailable cache, inconsistent invalidation |
| Queue | Duplicate messages, poison messages, backlog growth, out-of-order processing |
| Authentication | Identity provider outage, expired signing keys, misconfigured redirect URI |
| Storage | File upload failure, partial upload, missing metadata, permission issue |
| Network | DNS issue, transient connection failure, region connectivity issue |
| Frontend | API contract mismatch, stale assets, browser caching issue, CORS issue |
| Security | leaked secrets, overly broad permissions, missing authorization check |
| Operations | missing alerts, noisy alerts, failed rollback, manual process dependency |

### Designing Mitigations

A mitigation should reduce either likelihood, impact, or recovery time.

Examples:

| Problem | Mitigation |
|---|---|
| Transient dependency failures | Retry with exponential backoff and jitter |
| Slow downstream service | Timeout and fallback |
| Dependency overload | Circuit breaker and rate limiting |
| Duplicate messages | Idempotent consumers |
| Lost events between database and queue | Outbox pattern |
| Bad deployment | Blue-green or canary deployment |
| Broken schema migration | Reviewed scripts, backups, rollback plan |
| Stale cache | TTL, versioned keys, explicit invalidation |
| Unknown production behavior | Metrics, logs, tracing, alerting |
| Unclear requirement | Assumption log and stakeholder validation |

Mitigation should match business importance. A payment system needs stronger mitigation than a non-critical dashboard.

### Documentation Habits

Assumptions, constraints, risks, and failure modes should be documented in a lightweight way. The goal is not bureaucracy. The goal is to make decisions visible and testable.

Useful formats include:

- Assumption log
- Risk register
- Architecture Decision Record
- Failure Mode Analysis table
- System context diagram
- Threat model
- Operational runbook
- Nonfunctional requirements document
- API contract document

Example Architecture Decision Record:

```markdown
# ADR: Use queue-based order processing

## Context
Checkout must remain responsive even when warehouse processing is slow.

## Assumptions
- Users can receive order confirmation before warehouse processing is complete.
- Warehouse processing can tolerate eventual consistency.

## Constraints
- Payment authorization must complete before order acceptance.
- Order records must be auditable.

## Decision
Use a message queue and background worker for warehouse notification.

## Risks
- Messages may be duplicated.
- Worker may fall behind.
- Queue may become unavailable.

## Mitigations
- Use idempotent message handling.
- Monitor queue age and dead-letter messages.
- Store order state transitions in the database.
```

### Example: Food Delivery System

For a food delivery system, assumptions, constraints, risks, and failure modes might look like this:

```text
Assumptions:
- Most users order from restaurants within the same city.
- Location updates can be eventually consistent.
- Payment status must be accurate before confirming an order.

Constraints:
- Payment processing must use an approved third-party provider.
- Personally identifiable information must be protected.
- The mobile app must support older client versions for at least six months.

Risks:
- Driver location updates may be delayed.
- Restaurants may accept an order but later be unable to fulfill it.
- Payment provider callbacks may arrive late or multiple times.
- Push notification delivery is not guaranteed.

Failure modes:
- Order service cannot reach payment provider.
- Restaurant tablet is offline.
- Driver assignment job falls behind.
- Notification service fails after order creation.
- Database migration breaks older app versions.
```

Possible mitigations:

```text
- Use idempotency keys for payment operations.
- Store order state transitions explicitly.
- Use background reconciliation for payment callbacks.
- Use a retryable notification queue.
- Support manual customer support workflows for stuck orders.
- Add monitoring for order state aging, such as "paid but not assigned after 5 minutes."
```

### Interview Framework for Handling Ambiguity

A useful interview structure:

```text
1. Restate the problem.
2. Ask clarifying questions.
3. State assumptions if details are missing.
4. Identify constraints.
5. Define success metrics.
6. Identify major risks.
7. Identify failure modes in critical flows.
8. Propose mitigations.
9. Explain trade-offs.
10. Mention validation through tests, metrics, and operational readiness.
```

Example interview phrasing:

```text
I will assume this is a customer-facing system where checkout is critical and recommendations are non-critical. That means I will design checkout for stronger consistency and better failure handling, while recommendations can degrade gracefully if their service is unavailable.
```

### Common Mistakes

Common mistakes include:

- Treating assumptions as facts
- Not validating assumptions with stakeholders or data
- Ignoring constraints such as budget, team size, compliance, or legacy systems
- Designing only for the happy path
- Saying "use retries" without idempotency or backoff
- Ignoring duplicate messages in event-driven systems
- Ignoring partial failure
- Treating all failures as equal
- Not defining detection and recovery
- Not considering blast radius
- Over-engineering low-risk internal features
- Under-engineering critical payment, identity, or data flows
- Assuming cloud services remove the need for architecture trade-offs
- Forgetting operational concerns such as monitoring, rollback, and runbooks

### Best Practices

Best practices include:

- Write assumptions explicitly.
- Validate assumptions as early as possible.
- Separate assumptions from constraints.
- Tie risks to business impact.
- Analyze failure modes for critical user flows.
- Prioritize risks by likelihood and impact.
- Design for partial failure.
- Reduce blast radius.
- Use timeouts, retries, backoff, circuit breakers, and idempotency carefully.
- Prefer graceful degradation for non-critical features.
- Use strong consistency only where the business needs it.
- Document residual risks honestly.
- Add monitoring for known failure modes.
- Test important failure scenarios.
- Keep documentation lightweight and useful.
- Revisit assumptions after new information appears.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

<!-- question:start:assumptions-constraints-risks-failure-modes-beginner-q01 -->
<!-- question-id:assumptions-constraints-risks-failure-modes-beginner-q01 -->
<!-- question-level:beginner -->

####  What is the difference between an assumption and a constraint in system design?

##### Expected Answer

An assumption is something temporarily treated as true so the design discussion can move forward, but it may need validation later. A constraint is a known limitation or rule that the solution must respect.

For example, "most users are in one geographic region" is an assumption if it has not been confirmed. "Customer data must remain in the EU" is a constraint if it comes from a compliance or legal requirement.

In interviews, it is important to separate the two because assumptions can change the design later, while constraints usually limit the available design choices from the start.

##### Key Points to Mention

- Assumptions are uncertain and should be validated.
- Constraints are known boundaries.
- Both should be documented.
- Hidden assumptions can lead to bad design decisions.
- Constraints often force trade-offs.

<!-- question:end:assumptions-constraints-risks-failure-modes-beginner-q01 -->

<!-- question:start:assumptions-constraints-risks-failure-modes-beginner-q02 -->
<!-- question-id:assumptions-constraints-risks-failure-modes-beginner-q02 -->
<!-- question-level:beginner -->

####  What is a risk in software architecture?

##### Expected Answer

A risk is an uncertain event or condition that could negatively affect the system, project, business, cost, security, reliability, or user experience. Risks are not guaranteed to happen, but they should be identified and managed.

For example, relying on a third-party payment API creates a risk that checkout may fail or become slow if that provider is unavailable. A mitigation could include timeouts, retries with backoff, idempotency keys, reconciliation jobs, and clear user-facing payment states.

##### Key Points to Mention

- Risk is about uncertainty and impact.
- Risks can be technical, business, operational, security, or cost-related.
- Risks should be prioritized by likelihood and impact.
- Mitigation reduces likelihood or impact.
- Some residual risk may remain.

<!-- question:end:assumptions-constraints-risks-failure-modes-beginner-q02 -->

<!-- question:start:assumptions-constraints-risks-failure-modes-beginner-q03 -->
<!-- question-id:assumptions-constraints-risks-failure-modes-beginner-q03 -->
<!-- question-level:beginner -->

####  What is a failure mode?

##### Expected Answer

A failure mode is a specific way a system, component, dependency, or process can fail. It is more concrete than saying "the system is unreliable."

For example, in an order system, failure modes may include the payment provider timing out, the database write failing, the message queue publishing duplicate messages, the notification provider being unavailable, or a background worker falling behind.

Identifying failure modes helps engineers design detection, mitigation, and recovery strategies.

##### Key Points to Mention

- Failure modes describe specific failure scenarios.
- They help move beyond the happy path.
- They are useful for reliability planning.
- Each failure mode should have detection and mitigation.
- They are especially important for critical flows.

<!-- question:end:assumptions-constraints-risks-failure-modes-beginner-q03 -->

<!-- question:start:assumptions-constraints-risks-failure-modes-beginner-q04 -->
<!-- question-id:assumptions-constraints-risks-failure-modes-beginner-q04 -->
<!-- question-level:beginner -->

####  Why should assumptions be stated explicitly in an interview?

##### Expected Answer

Assumptions should be stated explicitly because interview problems are intentionally incomplete. Stating assumptions shows that the candidate understands ambiguity and can make reasonable progress without pretending to know missing information.

For example, a candidate might say, "I will assume read traffic is much higher than write traffic. If that is not true, I would change the caching and database scaling strategy."

This gives the interviewer a chance to correct the assumption and shows that the candidate knows the design depends on context.

##### Key Points to Mention

- Interview prompts are often incomplete.
- Explicit assumptions prevent hidden design mistakes.
- They allow the interviewer to confirm or adjust the scenario.
- They make trade-offs clearer.
- They show senior-level communication skills.

<!-- question:end:assumptions-constraints-risks-failure-modes-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

<!-- question:start:assumptions-constraints-risks-failure-modes-intermediate-q01 -->
<!-- question-id:assumptions-constraints-risks-failure-modes-intermediate-q01 -->
<!-- question-level:intermediate -->

####  How would you identify risks in a proposed architecture?

##### Expected Answer

I would start from the most important user flows and business outcomes. Then I would identify dependencies, data stores, integrations, security boundaries, operational processes, and scaling assumptions. For each dependency or decision, I would ask what can go wrong, how likely it is, what the impact would be, how we would detect it, and how we would recover.

For example, in a checkout flow, I would examine payment authorization, order creation, event publishing, inventory update, and notification sending. Risks may include payment timeout, duplicate callback, database write failure, event publish failure, or inconsistent order state.

The output can be a risk register or Failure Mode Analysis table.

##### Key Points to Mention

- Start from critical business flows.
- Identify dependencies and boundaries.
- Consider likelihood, impact, detection, mitigation, and recovery.
- Include both technical and business risks.
- Use risk analysis to prioritize engineering work.

<!-- question:end:assumptions-constraints-risks-failure-modes-intermediate-q01 -->

<!-- question:start:assumptions-constraints-risks-failure-modes-intermediate-q02 -->
<!-- question-id:assumptions-constraints-risks-failure-modes-intermediate-q02 -->
<!-- question-level:intermediate -->

####  How do constraints influence architecture trade-offs?

##### Expected Answer

Constraints limit available options and often force trade-offs. For example, a strict launch deadline may favor managed services and a simpler architecture over a highly customized platform. A compliance constraint may require audit logging, encryption, data residency, and stricter access control, increasing cost and complexity.

A strong architecture explains the trade-off clearly. Instead of saying "this is the best solution," it should say "given these constraints, this solution balances cost, reliability, delivery speed, and maintainability."

##### Key Points to Mention

- Constraints reduce design freedom.
- They can be business, technical, regulatory, security, or operational.
- They often create trade-offs between speed, cost, reliability, and flexibility.
- Ignoring constraints creates unrealistic designs.
- Good architects make constraints visible.

<!-- question:end:assumptions-constraints-risks-failure-modes-intermediate-q02 -->

<!-- question:start:assumptions-constraints-risks-failure-modes-intermediate-q03 -->
<!-- question-id:assumptions-constraints-risks-failure-modes-intermediate-q03 -->
<!-- question-level:intermediate -->

####  How would you handle a third-party API dependency that can fail?

##### Expected Answer

I would treat the third-party API as an unreliable dependency and design around partial failure. I would add timeouts so requests do not hang indefinitely, retries with exponential backoff and jitter for transient failures, idempotency keys for operations that may be retried, and circuit breakers to avoid overwhelming the dependency.

For critical workflows, I would also define a fallback or degraded mode. For example, if email sending fails, the system can store the email request and retry later. If payment authorization is uncertain, the order can move to a pending state and be reconciled by webhook or background job.

I would also add monitoring, alerting, and runbooks for dependency failures.

##### Key Points to Mention

- Third-party dependencies can be slow, unavailable, or inconsistent.
- Use timeouts, retries, backoff, and circuit breakers.
- Use idempotency for retried operations.
- Separate critical and non-critical failures.
- Add monitoring and recovery processes.

<!-- question:end:assumptions-constraints-risks-failure-modes-intermediate-q03 -->

<!-- question:start:assumptions-constraints-risks-failure-modes-intermediate-q04 -->
<!-- question-id:assumptions-constraints-risks-failure-modes-intermediate-q04 -->
<!-- question-level:intermediate -->

####  What is blast radius and how can you reduce it?

##### Expected Answer

Blast radius is the scope of impact when a failure occurs. A large blast radius means one failure affects many users, tenants, services, or business functions. A small blast radius means the failure is isolated.

To reduce blast radius, a system can use tenant isolation, rate limiting, separate scaling units, bulkheads, circuit breakers, feature flags, least privilege permissions, queue isolation, and separate critical from non-critical workloads.

For example, in a multi-tenant SaaS system, one noisy tenant should not be able to consume all shared database or API capacity and degrade every other tenant.

##### Key Points to Mention

- Blast radius measures failure impact scope.
- Smaller blast radius improves resilience.
- Isolation is a key design principle.
- Rate limiting and bulkheads help control damage.
- Feature flags and staged rollout reduce deployment risk.

<!-- question:end:assumptions-constraints-risks-failure-modes-intermediate-q04 -->

<!-- question:start:assumptions-constraints-risks-failure-modes-intermediate-q05 -->
<!-- question-id:assumptions-constraints-risks-failure-modes-intermediate-q05 -->
<!-- question-level:intermediate -->

####  How do you decide which risks to mitigate first?

##### Expected Answer

I would prioritize risks based on likelihood, impact, and business criticality. High-impact risks such as data loss, security breach, payment inconsistency, compliance violation, or system-wide outage should usually be addressed first, even if their likelihood is moderate.

I would also consider detectability and recovery. A risk that is hard to detect and hard to recover from deserves more attention than a risk that is visible and easily reversible.

The goal is not to eliminate all risk. The goal is to spend engineering effort where it produces the greatest reduction in business and technical exposure.

##### Key Points to Mention

- Prioritize by likelihood and impact.
- Business-critical flows matter most.
- Consider detectability and recoverability.
- Some risks can be accepted with monitoring.
- Risk mitigation should be proportional to importance.

<!-- question:end:assumptions-constraints-risks-failure-modes-intermediate-q05 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

<!-- question:start:assumptions-constraints-risks-failure-modes-advanced-q01 -->
<!-- question-id:assumptions-constraints-risks-failure-modes-advanced-q01 -->
<!-- question-level:advanced -->

####  How would you perform Failure Mode Analysis for a critical workflow?

##### Expected Answer

I would begin by choosing a critical workflow, such as checkout, login, payment, file transfer, or order fulfillment. Then I would break the workflow into steps and identify every dependency involved: database, cache, queue, external API, authentication provider, object storage, background worker, and network boundary.

For each step, I would list possible failure modes, impact, blast radius, detection method, mitigation, and recovery process. I would pay special attention to partial failures, duplicate operations, uncertain state, and failures that happen between two systems.

For example, in checkout, payment may succeed but order creation may fail, or order creation may succeed but event publishing may fail. These cases require idempotency, transactional boundaries, outbox pattern, reconciliation jobs, and explicit order states.

Finally, I would test the most important scenarios using integration tests, chaos testing where appropriate, manual runbooks, and production monitoring.

##### Key Points to Mention

- Start with a critical business flow.
- Break it into concrete steps and dependencies.
- Identify specific failure modes.
- Include blast radius, detection, mitigation, and recovery.
- Consider partial failure and uncertain state.
- Validate using tests, monitoring, and runbooks.

<!-- question:end:assumptions-constraints-risks-failure-modes-advanced-q01 -->

<!-- question:start:assumptions-constraints-risks-failure-modes-advanced-q02 -->
<!-- question-id:assumptions-constraints-risks-failure-modes-advanced-q02 -->
<!-- question-level:advanced -->

####  How would you design for payment failure modes in an order system?

##### Expected Answer

Payment systems require careful failure handling because retries, timeouts, and duplicate callbacks can create inconsistent or financially incorrect states.

I would avoid treating payment as a simple synchronous success/failure call. Instead, I would use an idempotency key for payment requests, explicit order states such as PendingPayment, Paid, PaymentFailed, and PaymentUnknown, and reconciliation through payment provider webhooks or scheduled checks.

If the payment API times out, the system should not blindly retry without idempotency because the first request may have succeeded. If a webhook arrives multiple times, the system should process it idempotently. If the payment provider is unavailable, the system should clearly communicate the pending or failed state to the user and avoid confirming the order as paid until the state is known.

##### Key Points to Mention

- Payment operations need idempotency.
- Timeouts can create unknown state.
- Webhooks may be delayed, duplicated, or missing.
- Use explicit business states.
- Use reconciliation jobs.
- Avoid double-charging users.
- Separate user communication from backend recovery.

<!-- question:end:assumptions-constraints-risks-failure-modes-advanced-q02 -->

<!-- question:start:assumptions-constraints-risks-failure-modes-advanced-q03 -->
<!-- question-id:assumptions-constraints-risks-failure-modes-advanced-q03 -->
<!-- question-level:advanced -->

####  How do assumptions and constraints affect consistency and availability trade-offs?

##### Expected Answer

Consistency and availability choices depend heavily on assumptions and constraints. If the business requires accurate financial state, inventory guarantees, or compliance-grade auditability, stronger consistency may be necessary even if it increases latency or reduces availability during failures.

If the use case can tolerate stale data, such as recommendations, analytics dashboards, or product browsing, the system can often favor availability and performance through caching, replication, eventual consistency, and asynchronous processing.

For example, assuming product descriptions are rarely updated, caching is reasonable. But if the constraint is that checkout price must always be accurate, the checkout flow should validate price against the source of truth before payment.

The key is to apply consistency where the business requires it, not everywhere by default.

##### Key Points to Mention

- Consistency requirements depend on business semantics.
- Strong consistency can increase latency or reduce availability.
- Eventual consistency can improve performance and resilience.
- Different parts of the same system may need different consistency models.
- Assumptions must be validated because they affect architecture.

<!-- question:end:assumptions-constraints-risks-failure-modes-advanced-q03 -->

<!-- question:start:assumptions-constraints-risks-failure-modes-advanced-q04 -->
<!-- question-id:assumptions-constraints-risks-failure-modes-advanced-q04 -->
<!-- question-level:advanced -->

####  How do you communicate residual risk to stakeholders?

##### Expected Answer

I would communicate residual risk clearly, in business language, after explaining the mitigation already in place. Stakeholders need to understand what risk remains, what impact it may have, and whether accepting it is reasonable given cost, timeline, and business priority.

For example, after adding retries, idempotency, and reconciliation for payment callbacks, a full payment provider outage may still prevent new payments. The residual risk is that users cannot complete checkout during the provider outage. The business may accept this risk, add a backup provider, or define a manual fallback process depending on revenue impact.

The important part is not to hide residual risk. Architecture decisions should make risk visible so business owners can make informed trade-offs.

##### Key Points to Mention

- Residual risk remains after mitigation.
- Explain risk in business terms.
- Include impact, likelihood, and recovery options.
- Stakeholders may choose to accept, reduce, transfer, or avoid the risk.
- Do not present mitigation as eliminating all risk.

<!-- question:end:assumptions-constraints-risks-failure-modes-advanced-q04 -->

<!-- question:start:assumptions-constraints-risks-failure-modes-advanced-q05 -->
<!-- question-id:assumptions-constraints-risks-failure-modes-advanced-q05 -->
<!-- question-level:advanced -->

####  How would you prevent a retry strategy from making an outage worse?

##### Expected Answer

Retries can make an outage worse if every client retries aggressively and overloads an already struggling dependency. To prevent this, I would use bounded retries, exponential backoff, jitter, timeouts, and circuit breakers. I would also make operations idempotent before retrying them.

For high-volume systems, I would add rate limiting, queue-based buffering, backpressure, and bulkheads. I would monitor retry rates separately because a sudden increase in retries can be an early signal of downstream instability.

Retries should be used for transient failures, not permanent validation errors. Retrying a bad request, authorization failure, or invalid input only wastes resources.

##### Key Points to Mention

- Aggressive retries can amplify failures.
- Use exponential backoff and jitter.
- Set retry limits.
- Use circuit breakers and timeouts.
- Ensure idempotency.
- Do not retry permanent errors.
- Monitor retry volume and downstream health.

<!-- question:end:assumptions-constraints-risks-failure-modes-advanced-q05 -->

<!-- question:start:assumptions-constraints-risks-failure-modes-advanced-q06 -->
<!-- question-id:assumptions-constraints-risks-failure-modes-advanced-q06 -->
<!-- question-level:advanced -->

####  How would you use assumptions, constraints, risks, and failure modes during an architecture review?

##### Expected Answer

During an architecture review, I would use these concepts to check whether the proposed design is realistic, testable, and operationally safe.

I would ask whether the assumptions are documented and validated, whether constraints are clear, whether critical risks have mitigation plans, and whether major failure modes have detection and recovery strategies. I would also check whether the design has appropriate observability, rollback strategy, security controls, and capacity assumptions.

For example, if a design assumes cache availability but has no fallback when the cache is down, that is a failure-mode gap. If a design assumes all clients upgrade immediately but the product requires backward compatibility, that is a constraint mismatch.

The goal of the review is not to block progress. It is to identify hidden uncertainty and make trade-offs explicit before production incidents occur.

##### Key Points to Mention

- Architecture review should expose hidden assumptions.
- Constraints must match business and operational reality.
- Risks need mitigation or explicit acceptance.
- Failure modes need detection and recovery.
- Observability and rollback are part of production readiness.
- Reviews should improve decision quality, not create bureaucracy.

<!-- question:end:assumptions-constraints-risks-failure-modes-advanced-q06 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
