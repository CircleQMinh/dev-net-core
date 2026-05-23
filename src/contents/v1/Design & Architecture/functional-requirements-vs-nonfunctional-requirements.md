---
id: functional-requirements-vs-nonfunctional-requirements
topic: Requirements decomposition and system trade-offs
subtopic: Functional Requirements vs Nonfunctional Requirements
category: Design & Architecture
---



## Overview

Functional requirements and nonfunctional requirements are two major categories of requirements used in software engineering, product planning, architecture design, and system design interviews.

A **functional requirement** describes what the system must do. It defines behavior, features, workflows, inputs, outputs, business rules, user actions, system actions, and integration behavior.

Examples:

- Users can register with email and password.
- Customers can add products to a cart.
- The system calculates tax based on region and product type.
- Admins can approve or reject loan applications.
- The API returns order details by order ID.
- The system sends an email after an invoice is generated.

A **nonfunctional requirement** describes how well the system must operate or what constraints it must satisfy. It defines quality attributes such as performance, scalability, availability, reliability, resilience, security, usability, accessibility, maintainability, observability, compliance, portability, and cost.

Examples:

- Product search must respond within 300 ms at p95 under expected peak load.
- The checkout API must maintain 99.95% monthly availability.
- The system must support 10,000 concurrent users.
- Sensitive customer data must be encrypted in transit and at rest.
- Audit logs must be retained for 7 years.
- New payment providers should be added without changing existing checkout business logic.

A simple way to remember the difference is:

```text
Functional requirements: What should the system do?
Nonfunctional requirements: How well should the system do it?
```

This topic matters because functional requirements define product scope, while nonfunctional requirements define the quality bar and architecture constraints. A system can be functionally correct but still fail in production if it is too slow, unavailable, insecure, expensive, hard to operate, or unable to scale.

For example, "users can upload files" is a functional requirement. The architecture is very different depending on the nonfunctional requirements: file size, upload throughput, encryption, virus scanning, resumable upload, retention, auditability, and download latency.

This topic is important for interviews because system design discussions usually begin with requirements. A strong candidate does not jump directly to databases, queues, caches, or microservices. They first clarify the functional scope and the quality attributes that shape the design. Interviewers expect candidates to ask about scale, latency, availability, consistency, security, compliance, observability, cost, and operational constraints.

A strong answer should show that requirements are not just documentation. They guide architecture trade-offs, technology choices, API design, database design, testing strategy, deployment strategy, monitoring, and production operations.

## Core Concepts

### Functional Requirements

A functional requirement defines a behavior or capability the system must provide.

Functional requirements usually describe:

- User actions.
- System actions.
- Business workflows.
- Business rules.
- Input and output behavior.
- API behavior.
- Data creation, update, retrieval, and deletion.
- Permissions and role-specific behavior.
- Notifications.
- Reports.
- Integrations.
- Calculations.
- Validations.
- State transitions.

Example for an e-commerce system:

```text
FR-001: A customer can add a product to the shopping cart.
FR-002: A customer can remove a product from the shopping cart.
FR-003: A customer can place an order using a saved payment method.
FR-004: The system sends an order confirmation email after successful payment.
FR-005: An admin can update product inventory.
FR-006: The system prevents checkout when inventory is insufficient.
```

These requirements describe what the system does from the user's or business's point of view.

### Nonfunctional Requirements

A nonfunctional requirement defines a quality attribute, operational expectation, or constraint.

Nonfunctional requirements usually describe:

- Performance.
- Latency.
- Throughput.
- Scalability.
- Availability.
- Reliability.
- Resilience.
- Security.
- Privacy.
- Compliance.
- Usability.
- Accessibility.
- Maintainability.
- Modifiability.
- Testability.
- Observability.
- Operability.
- Portability.
- Compatibility.
- Cost.
- Data retention.
- Disaster recovery.
- Backup and restore.
- Capacity.
- Technology constraints.
- Deployment constraints.

Example for the same e-commerce system:

```text
NFR-001: Product search must return results within 300 ms at p95 under normal load.
NFR-002: The checkout API must be available 99.95% monthly.
NFR-003: Payment information must never be stored in plain text.
NFR-004: The system must support 5,000 concurrent users during peak campaigns.
NFR-005: Order data must be retained for 7 years.
NFR-006: The system must recover from database failover within 5 minutes.
```

These requirements describe how well the system must work and what constraints it must respect.

### Simple Comparison

| Aspect | Functional Requirement | Nonfunctional Requirement |
|---|---|---|
| Main question | What should the system do? | How well should the system do it? |
| Focus | Behavior and features | Quality attributes and constraints |
| Examples | Register user, create order, send email | Latency, availability, security, scalability |
| Usually verified by | Functional tests, integration tests, acceptance tests | Load tests, security tests, reliability tests, monitoring, audits |
| Impact | Product behavior and user workflows | Architecture, infrastructure, operations, trade-offs |
| Failure example | User cannot place an order | User can place an order, but it takes 30 seconds |
| Written as | User stories, use cases, API contracts, business rules | Measurable quality targets, constraints, service-level objectives |

Both are required. A system that has only functional requirements may work in a demo but fail in production. A system that focuses only on nonfunctional requirements may be over-engineered without delivering the business features users need.

### Functional Requirement Examples

Functional requirements are usually feature-oriented.

Example: banking application

```text
FR-001: A customer can view account balances.
FR-002: A customer can transfer money between their own accounts.
FR-003: A customer can transfer money to an external account.
FR-004: The system validates that the source account has sufficient funds.
FR-005: The system records every successful transfer in transaction history.
FR-006: A bank employee can freeze an account.
```

Example: course management application

```text
FR-001: An instructor can create a course.
FR-002: A student can enroll in an available course.
FR-003: The system prevents enrollment when the course is full.
FR-004: An instructor can upload course materials.
FR-005: A student can submit assignments.
FR-006: The system calculates final grades from assignment scores.
```

Example: managed file transfer system

```text
FR-001: A user can upload a file.
FR-002: The system stores file metadata.
FR-003: A user can share a file with another organization.
FR-004: The recipient can download the shared file.
FR-005: The system records download history.
FR-006: The sender can revoke access before download.
```

Each requirement describes a behavior the system must support.

### Nonfunctional Requirement Examples

Nonfunctional requirements should be specific and measurable when possible.

Weak examples:

```text
The system should be fast.
The system should be secure.
The system should be scalable.
The system should be easy to use.
The system should be reliable.
```

Better examples:

```text
The product search API must return results within 300 ms at p95 under 1,000 requests per second with 100,000 products indexed.

The checkout API must maintain 99.95% monthly availability, excluding planned maintenance windows.

All personally identifiable information must be encrypted at rest using approved encryption mechanisms.

The system must support horizontal scaling to 20 application instances without code changes.

A new payment provider integration should be added by implementing a new provider adapter without changing existing checkout business logic.

The system must retain audit logs for 7 years and allow authorized users to search them by user ID, event type, and date range.
```

A good nonfunctional requirement has an observable target.

### Why Nonfunctional Requirements Drive Architecture

Functional requirements often define product features. Nonfunctional requirements often define architecture.

Example:

```text
Functional requirement:
Users can upload files.

Nonfunctional requirements:
- Files can be up to 10 GB.
- Uploads must resume after network interruption.
- Files must be virus-scanned before download.
- Files must be encrypted at rest.
- Downloads must be audited.
- Files must be retained for 7 years.
- Upload throughput must support 2,000 files per hour.
```

These nonfunctional requirements affect design choices:

- Use object storage instead of storing files in a relational database.
- Use chunked or resumable upload.
- Use background scanning.
- Use event-driven processing.
- Use encryption and key management.
- Store metadata separately.
- Add audit logging.
- Add lifecycle policies.
- Add queue-based processing.
- Add monitoring and alerting.

The feature "upload files" is simple. The architecture is shaped by the quality attributes.

### Quality Attributes

Quality attributes are properties used to evaluate a system.

Common quality attributes include:

| Attribute | Meaning |
|---|---|
| Performance | How fast the system responds |
| Scalability | How well the system handles growth |
| Availability | How often the system is usable |
| Reliability | How consistently the system works correctly |
| Resilience | How well the system recovers from failures |
| Security | How well the system protects data and operations |
| Usability | How easy the system is to use |
| Accessibility | How usable the system is for users with disabilities |
| Maintainability | How easy the system is to change and fix |
| Modifiability | How easy the system is to adapt to new requirements |
| Testability | How easy the system is to verify |
| Observability | How well the system exposes its internal behavior |
| Portability | How easy the system is to move between environments |
| Interoperability | How well the system works with other systems |
| Compliance | How well the system satisfies legal or regulatory rules |
| Cost efficiency | How well the system balances cost and value |

In architecture interviews, nonfunctional requirements are often called quality attributes, architecture characteristics, or "ilities."

### Constraints vs Quality Attributes

Not all nonfunctional requirements are quality attributes. Some are constraints.

A **quality attribute** describes a desired quality level.

Example:

```text
The API must respond within 200 ms at p95.
```

A **constraint** limits the solution space.

Example:

```text
The system must use Azure SQL Database.
The frontend must be built with React.
The system must integrate with the existing payment gateway.
The application must be deployed to the company's Kubernetes platform.
The system must comply with PCI DSS requirements.
```

Constraints can be technical, business, legal, operational, organizational, or budget-related.

Constraints are important because they shape what solutions are possible. In interviews, it is useful to ask whether there are required technologies, compliance rules, budget limits, region restrictions, data residency rules, or integration constraints.

### Functional vs Nonfunctional vs Business Requirements

Requirements can be viewed at different levels.

| Requirement Type | Focus | Example |
|---|---|---|
| Business requirement | Business goal or outcome | Reduce checkout abandonment by 15% |
| Functional requirement | System behavior | Allow customers to save payment methods |
| Nonfunctional requirement | Quality or constraint | Checkout must complete within 2 seconds at p95 |
| Technical requirement | Implementation-level need | Use OAuth 2.0 with JWT bearer tokens |
| Compliance requirement | Legal or regulatory need | Retain transaction records for 7 years |

They are related but not the same.

Example flow:

```text
Business requirement:
Increase online sales conversion.

Functional requirement:
Customers can check out using saved payment methods.

Nonfunctional requirement:
Checkout must complete within 2 seconds at p95 during peak traffic.

Technical requirement:
Payment tokens must be stored using the approved payment provider tokenization API.

Compliance requirement:
The system must not store raw card numbers.
```

Strong architecture work connects business goals to functional behavior and quality attributes.

### User Stories and Acceptance Criteria

Functional requirements are often written as user stories.

Example:

```text
As a customer,
I want to reset my password,
so that I can regain access to my account.
```

Acceptance criteria:

```text
Given a registered email address,
When the customer requests a password reset,
Then the system sends a password reset email.

Given an unregistered email address,
When the customer requests a password reset,
Then the system returns a generic success response without revealing whether the email exists.

Given an expired reset token,
When the customer attempts to reset the password,
Then the system rejects the token.
```

Nonfunctional requirements can be attached to the same user story.

```text
The password reset request must complete within 500 ms at p95.
The reset token must expire after 15 minutes.
The reset token must be single-use.
The system must rate-limit reset attempts by IP address and email.
Reset token values must not be logged.
```

The user story describes behavior. The nonfunctional requirements define quality and constraints.

### Acceptance Criteria vs Nonfunctional Requirements

Acceptance criteria are conditions that must be true for a requirement or story to be accepted. They can include both functional and nonfunctional expectations.

Functional acceptance criterion:

```text
Given a valid order,
When the customer submits payment,
Then the system creates the order and marks it as paid.
```

Nonfunctional acceptance criterion:

```text
The payment submission must complete within 2 seconds at p95 under expected peak load.
```

Security acceptance criterion:

```text
The payment endpoint must reject requests without a valid authentication token.
```

Observability acceptance criterion:

```text
The system must emit a structured audit event for every successful payment.
```

In practice, teams often write functional acceptance criteria clearly but forget measurable nonfunctional acceptance criteria. This creates ambiguity and hidden architecture risk.

### Measurable Requirements

Good requirements are testable and measurable.

Weak:

```text
The system must be fast.
```

Better:

```text
The product search API must return results within 300 ms at p95 under 1,000 requests per second with 100,000 products indexed.
```

Weak:

```text
The system must be reliable.
```

Better:

```text
The order API must maintain 99.95% monthly availability and recover from a single application instance failure without user-visible downtime.
```

Weak:

```text
The system must be secure.
```

Better:

```text
All API endpoints that access customer data must require authentication and authorization. Sensitive data must be encrypted in transit using TLS and at rest using platform-managed encryption.
```

Measurable requirements reduce ambiguity and make testing possible.

### SMART Requirements

A practical way to evaluate requirements is to make them SMART:

| Letter | Meaning |
|---|---|
| Specific | Clear and unambiguous |
| Measurable | Can be verified |
| Achievable | Realistic with constraints |
| Relevant | Connected to business or user goals |
| Time-bound | Includes deadline, duration, or operating window when relevant |

Example:

```text
The system must process 95% of invoice-generation jobs within 5 minutes of request submission during normal business hours.
```

This is specific, measurable, relevant, and time-related. Whether it is achievable depends on scale, budget, and architecture.

### Ambiguous Requirements

Ambiguous requirements are dangerous because different stakeholders interpret them differently.

Ambiguous:

```text
The system should support many users.
```

Clarified:

```text
The system must support 20,000 registered users and 2,000 concurrent active users during peak hours.
```

Ambiguous:

```text
Reports should load quickly.
```

Clarified:

```text
The monthly sales report must load within 5 seconds at p95 for datasets up to 5 million rows.
```

Ambiguous:

```text
The system should be secure.
```

Clarified:

```text
Administrative actions must require multi-factor authentication, be authorized by role, and be recorded in an immutable audit log.
```

Interviewers often reward candidates who ask clarifying questions before proposing architecture.

### Requirements in System Design Interviews

In system design interviews, requirements usually come first.

A good requirements discussion asks:

```text
Who are the users?
What are the main user flows?
What are the read/write patterns?
What scale should we design for?
What latency is acceptable?
What availability target matters?
What consistency is required?
What data must be protected?
What compliance rules apply?
What integrations are needed?
What operations must be auditable?
What can fail gracefully?
What is out of scope?
```

Functional requirements define the core features. Nonfunctional requirements define the design pressure.

Example: designing a URL shortener

Functional requirements:

```text
Users can create short URLs.
Users can redirect using a short URL.
Users can optionally set expiration time.
Users can view basic analytics.
```

Nonfunctional requirements:

```text
Redirect latency must be under 50 ms at p95.
The system must support 100 million redirects per day.
Short URL creation must prevent duplicate keys.
Redirects should remain available during analytics outages.
Analytics can be eventually consistent.
The service must be highly available.
```

These NFRs strongly influence the architecture.

### Functional Requirements in API Design

Functional requirements can be mapped to API endpoints.

Example:

```text
FR-001: Customers can create an order.
```

Possible API:

```http
POST /api/orders
```

Request:

```json
{
  "customerId": 123,
  "items": [
    {
      "productId": 10,
      "quantity": 2
    }
  ]
}
```

Response:

```json
{
  "orderId": 456,
  "status": "Created"
}
```

Additional functional requirements:

```text
FR-002: Customers can get an order by ID.
FR-003: Customers can cancel an order before shipment.
FR-004: Admins can list orders by status.
```

Functional requirements help define API contracts, UI flows, commands, queries, and business operations.

### Nonfunctional Requirements in API Design

Nonfunctional requirements shape API design and infrastructure.

Example:

```text
NFR-001: Create order must respond within 1 second at p95.
NFR-002: Order creation must be idempotent.
NFR-003: The API must reject unauthenticated requests.
NFR-004: The API must log a correlation ID for every request.
NFR-005: The API must handle duplicate client retries safely.
NFR-006: The API must return errors using a consistent ProblemDetails format.
```

Design implications:

- Add idempotency keys.
- Use authentication and authorization middleware.
- Use structured logging and correlation IDs.
- Add validation.
- Add timeouts.
- Add consistent error handling.
- Add database constraints.
- Add observability.
- Add retry-safe client behavior.

NFRs often turn a basic API into a production-ready API.

### Requirements and Architecture Trade-Offs

Nonfunctional requirements often conflict with each other.

| Requirement | Possible Trade-Off |
|---|---|
| High availability | Higher cost and operational complexity |
| Strong consistency | Higher latency and lower availability during partitions |
| Low latency | May require caching and eventual consistency |
| Strong security | More friction for users and developers |
| High scalability | More distributed complexity |
| Maintainability | May require more abstraction and upfront design |
| Low cost | May limit redundancy, performance, and automation |
| Rich auditability | More storage, logging, and privacy concerns |
| Fast delivery | May reduce long-term maintainability |

Architecture is about making these trade-offs explicit.

Example:

```text
Requirement:
Analytics must be near real-time.

Clarification:
Does "near real-time" mean under 1 second, under 1 minute, or under 15 minutes?

Trade-off:
Under 1 second may require streaming architecture.
Under 15 minutes may work with batch processing.
```

A strong design answer explains the trade-off, not just the solution.

### Architecturally Significant Requirements

An architecturally significant requirement is a requirement that strongly influences architecture.

Examples:

```text
The system must support 1 million concurrent users.
The system must be available across regions.
The system must process payment safely exactly once from the user's perspective.
The system must support tenant-level data isolation.
The system must comply with strict data residency rules.
The system must support offline usage.
The system must support plug-in payment providers.
The system must be deployable without downtime.
```

Not every requirement changes architecture. Adding one more field to a form may not be architecturally significant. But a requirement for multi-region failover likely is.

In interviews, identify architecturally significant requirements early.

### Functional Decomposition

Functional decomposition breaks a large system into smaller capabilities.

Example: e-commerce platform

```text
User management
Catalog browsing
Search
Shopping cart
Checkout
Payment
Inventory
Shipping
Notifications
Order history
Admin management
Reporting
```

Functional decomposition helps identify:

- Modules.
- Services.
- Use cases.
- APIs.
- Data boundaries.
- Team ownership.
- Test scope.

However, functional decomposition alone is not enough. NFRs determine whether these should be modules in one application, separate services, event-driven components, separate databases, or managed services.

### Nonfunctional Decomposition

Nonfunctional decomposition breaks quality expectations into measurable targets.

Example: reliability

```text
Availability target: 99.95% monthly.
Recovery time objective: 15 minutes.
Recovery point objective: 5 minutes.
Failure detection: within 1 minute.
Retry behavior: transient failures retried up to 3 times with backoff.
Degraded mode: users can browse catalog even if recommendations are down.
Backup: database backup every 15 minutes.
```

Example: performance

```text
Product search p95 latency: 300 ms.
Checkout p95 latency: 1 second.
Report generation p95 completion: 5 minutes.
Maximum supported catalog size: 1 million products.
Peak request rate: 2,000 requests per second.
```

Breaking NFRs into specific targets makes them testable and designable.

### Common Nonfunctional Requirement Categories

#### Performance

Performance describes speed and resource efficiency.

Examples:

```text
The login API must respond within 500 ms at p95.
The search API must respond within 300 ms at p95 under 1,000 RPS.
The nightly import job must process 1 million rows within 2 hours.
```

Design implications:

- Caching.
- Database indexing.
- Query optimization.
- Async processing.
- Load balancing.
- CDN.
- Profiling.
- Efficient serialization.
- Avoiding N+1 queries.
- Capacity planning.

#### Scalability

Scalability describes how well the system handles growth.

Examples:

```text
The system must support 10x traffic growth by adding application instances.
The worker system must process up to 100,000 jobs per hour.
The database design must support 50 million orders.
```

Design implications:

- Horizontal scaling.
- Stateless services.
- Partitioning.
- Sharding.
- Queue-based load leveling.
- Caching.
- Read replicas.
- Autoscaling.
- Message brokers.

#### Availability

Availability describes how often the system is usable.

Examples:

```text
The API must achieve 99.9% monthly availability.
Checkout must remain available during a single application instance failure.
```

Design implications:

- Redundancy.
- Health checks.
- Load balancing.
- Multi-zone deployment.
- Failover.
- Rolling deployments.
- Circuit breakers.
- Graceful degradation.

#### Reliability

Reliability describes consistent correct operation over time.

Examples:

```text
The system must not lose accepted orders.
Failed background jobs must be retried or moved to a dead-letter queue.
The system must prevent duplicate payment capture.
```

Design implications:

- Transactions.
- Idempotency.
- Outbox pattern.
- Retry policies.
- Dead-letter queues.
- Data validation.
- Monitoring.
- Error handling.

#### Security

Security describes protection against unauthorized access, data exposure, abuse, and tampering.

Examples:

```text
All customer data endpoints must require authentication.
Users can access only their own orders.
Administrative actions must require role-based authorization.
Secrets must not be stored in source control.
Sensitive data must be encrypted in transit and at rest.
```

Design implications:

- Authentication.
- Authorization.
- Secure secret storage.
- Encryption.
- Input validation.
- Audit logging.
- Rate limiting.
- Threat modeling.
- Secure defaults.

#### Maintainability

Maintainability describes how easy the system is to understand, change, test, and fix.

Examples:

```text
Adding a new payment provider should not require changes to existing provider implementations.
Business rules should be covered by unit tests.
The system should separate domain logic from infrastructure concerns.
```

Design implications:

- Clean architecture.
- Modularity.
- Dependency inversion.
- Automated tests.
- Clear naming.
- Documentation.
- Code review.
- Observability.
- Refactoring discipline.

#### Observability

Observability describes how well the system exposes internal behavior.

Examples:

```text
Every request must include a correlation ID.
The system must emit metrics for request rate, error rate, and p95 latency.
Failed payment attempts must be logged with payment provider and error code.
```

Design implications:

- Structured logging.
- Metrics.
- Distributed tracing.
- Correlation IDs.
- Dashboards.
- Alerts.
- Health checks.
- Audit logs.

### How Requirements Affect Testing

Functional requirements are commonly verified with:

- Unit tests.
- Integration tests.
- API tests.
- UI tests.
- Acceptance tests.
- Manual exploratory tests.
- Business rule tests.

Nonfunctional requirements are commonly verified with:

- Load tests.
- Stress tests.
- Performance benchmarks.
- Security tests.
- Penetration tests.
- Static analysis.
- Availability tests.
- Chaos testing.
- Failover drills.
- Disaster recovery tests.
- Accessibility tests.
- Usability tests.
- Observability checks.
- Compliance audits.
- Operational readiness reviews.

Example:

```text
Functional requirement:
A customer can place an order.

Functional test:
Submit a valid order and verify an order is created.

Nonfunctional requirement:
Order placement must complete within 1 second at p95 under 500 concurrent users.

Nonfunctional test:
Run a load test with 500 concurrent users and verify p95 latency is <= 1 second.
```

Functional correctness does not imply production readiness.

### Requirements Traceability

Traceability means linking requirements to design, implementation, tests, and operations.

Example trace:

```text
Business goal:
Reduce checkout abandonment.

Functional requirement:
Customers can save payment methods.

Nonfunctional requirement:
Checkout must complete within 2 seconds at p95.

Design decision:
Use payment provider tokenization and cache shipping rate estimates.

Implementation:
CheckoutService, PaymentTokenService, Orders API.

Tests:
Unit tests for checkout rules.
Integration tests for order creation.
Load tests for checkout p95 latency.
Security tests for payment token handling.

Monitoring:
Checkout latency dashboard.
Payment failure alerts.
```

Traceability helps teams answer:

- Why was this feature built?
- Which requirement does this test cover?
- Which NFR does this architecture decision support?
- What breaks if this component changes?
- Are all critical requirements verified?

### Requirements and Prioritization

Not all requirements have equal importance.

Prioritization methods include:

- Must have / should have / could have / won't have.
- Risk-based prioritization.
- Business value.
- User impact.
- Regulatory requirement.
- Technical dependency.
- Cost of delay.
- Architecture risk.
- Operational risk.

Example:

```text
Must have:
Users can place orders.
Payments are secure.
Order data is durable.

Should have:
Users can save wishlists.
Product recommendations are available.

Could have:
Animated checkout progress.

Won't have for MVP:
Multi-currency checkout.
```

For NFRs:

```text
Must have:
Checkout must be secure and reliable.

Should have:
Search p95 latency under 300 ms.

Could have:
Personalized recommendations under 100 ms.
```

A good architect clarifies which requirements are mandatory and which are negotiable.

### MVP and Requirements

An MVP should still include essential nonfunctional requirements.

A common mistake is thinking NFRs are only for later.

Example: MVP e-commerce checkout

Functional MVP:

```text
Customers can browse products.
Customers can place orders.
Admins can manage inventory.
```

Nonfunctional MVP:

```text
Payments must be secure.
Orders must not be lost.
The system must have basic monitoring.
The system must back up order data.
The checkout API must handle expected launch traffic.
```

Some NFRs can be relaxed for MVP, but critical security, reliability, and data integrity requirements cannot be ignored.

### Conflicts Between Requirements

Requirements often conflict.

Example:

```text
Requirement A:
The system must provide real-time analytics.

Requirement B:
The system must minimize infrastructure cost.
```

Possible trade-off:

```text
Use near-real-time batch processing every 5 minutes instead of streaming every event instantly.
```

Example:

```text
Requirement A:
The system must provide strong consistency for inventory.

Requirement B:
The system must remain available during regional network partitions.
```

Possible trade-off:

```text
Use strong consistency for checkout inventory reservation, but eventual consistency for product search inventory display.
```

Good architecture discussions make conflicts visible and negotiate acceptable trade-offs.

### Requirement Quality Checklist

A good requirement should be:

- Clear.
- Unambiguous.
- Testable.
- Measurable when possible.
- Feasible.
- Necessary.
- Traceable.
- Prioritized.
- Consistent with other requirements.
- Owned by a stakeholder.
- Written at the right level of detail.
- Not secretly prescribing implementation unless it is a real constraint.

Weak:

```text
The system should use microservices.
```

Better if this is a real constraint:

```text
The system must allow independent deployment of the catalog, checkout, and notification capabilities because separate teams own each area and release on different schedules.
```

The second version explains the actual requirement. Microservices may be a solution, not the requirement.

### Distinguishing Requirements from Solutions

A common mistake is confusing a solution with a requirement.

Solution disguised as requirement:

```text
The system must use Kafka.
```

Possible underlying requirement:

```text
The system must process order events asynchronously and support at least 10,000 events per second with durable delivery and consumer retry support.
```

Solution disguised as requirement:

```text
The system must use Redis.
```

Possible underlying requirement:

```text
Product search suggestions must respond within 100 ms at p95, and the system can tolerate suggestions being up to 5 minutes stale.
```

Sometimes the technology really is a constraint. But in interviews, ask why the technology is required. This shows architectural maturity.

### Functional Requirements and Domain Modeling

Functional requirements often reveal domain concepts.

Example:

```text
Customers can place orders.
Admins can approve refunds.
Inventory is reserved during checkout.
Payments can be captured or refunded.
Orders can be shipped in multiple packages.
```

Possible domain model:

```text
Customer
Order
OrderLine
InventoryReservation
Payment
Refund
Shipment
```

Functional requirements help identify aggregates, entities, workflows, commands, domain events, and business rules.

Nonfunctional requirements then shape the implementation approach.

Example:

```text
Inventory reservation must prevent overselling under high concurrency.
```

This may influence transaction design, locking, consistency, and database constraints.

### Nonfunctional Requirements and Architecture Patterns

NFRs often point toward architecture patterns.

| NFR | Possible Pattern |
|---|---|
| High read performance | Caching, CQRS, read replicas |
| High write throughput | Queue-based ingestion, partitioning |
| Reliability for events | Outbox pattern |
| Resilience to downstream failure | Circuit breaker, retry, fallback |
| Auditability | Event logging, audit trail |
| Scalability | Stateless services, horizontal scaling |
| Availability | Multi-zone deployment, health checks |
| Maintainability | Clean architecture, modular monolith |
| Independent deployment | Microservices |
| Data isolation | Multi-tenant partitioning or database-per-tenant |
| Long-running work | Background jobs and queues |
| Loose coupling | Event-driven architecture |
| Consistent APIs | API gateway, shared API standards |

Patterns should be selected because they satisfy requirements, not because they are trendy.

### Example: Requirements for a Notification System

Functional requirements:

```text
Users can choose notification preferences.
The system sends email notifications.
The system sends SMS notifications.
The system sends push notifications.
Admins can view notification delivery status.
The system retries failed notifications.
```

Nonfunctional requirements:

```text
Notifications should be delivered within 1 minute for 95% of normal events.
The system must handle 500,000 notifications per day.
Failed notifications must be retried up to 3 times with exponential backoff.
Notification content must not expose sensitive data in logs.
Users must be able to opt out of marketing notifications.
Delivery attempts must be auditable for 1 year.
```

Design implications:

- Use queue-based processing.
- Use provider adapters.
- Use retry and dead-letter handling.
- Store delivery status.
- Use templates and localization.
- Add observability.
- Add opt-out rules.
- Add audit storage.

### Example: Requirements for a Chat Application

Functional requirements:

```text
Users can send messages.
Users can receive messages in real time.
Users can create group chats.
Users can upload attachments.
Users can see message history.
Users can mark messages as read.
```

Nonfunctional requirements:

```text
Messages should be delivered within 500 ms at p95 for online users.
Message history must be durable.
The system must support 1 million daily active users.
Attachments must be scanned for malware.
Messages must be encrypted in transit.
The system must handle temporary disconnects and reconnect users automatically.
Read receipts can be eventually consistent.
```

Design implications:

- WebSockets or real-time messaging.
- Persistent message store.
- Message broker or event stream.
- Presence service.
- Attachment storage.
- Background scanning.
- Horizontal scaling.
- Eventual consistency for read receipts.

### Example: Requirements for a Reporting System

Functional requirements:

```text
Users can request monthly reports.
Users can download completed reports.
Admins can schedule recurring reports.
The system emails users when reports are ready.
Users can filter reports by date range and department.
```

Nonfunctional requirements:

```text
Report requests must return immediately with 202 Accepted.
95% of monthly reports must complete within 10 minutes.
The report worker must retry transient failures.
Large reports must not block API request threads.
Reports must be retained for 90 days.
Only authorized users can download reports.
Report generation failures must be visible in monitoring.
```

Design implications:

- Async background jobs.
- Queue.
- Worker service.
- Blob/object storage.
- Status table.
- Authorization checks.
- Retry and dead-letter.
- Monitoring dashboard.
- Expiration cleanup job.

### Requirements and Consistency

Consistency is often a nonfunctional requirement.

Example:

```text
When a user completes payment, the order status must not show "Unpaid" after confirmation.
```

This may require strong consistency between payment and order status.

Other cases can use eventual consistency.

Example:

```text
Product recommendation updates can lag behind purchases by up to 15 minutes.
```

This allows async processing and simpler scaling.

In interviews, ask:

```text
Which data must be immediately consistent?
Which data can be eventually consistent?
What is the acceptable delay?
What happens if the user sees stale data?
```

Consistency requirements strongly shape system design.

### Requirements and Security

Security can be functional and nonfunctional.

Functional security requirement:

```text
Admins can assign roles to users.
Users can change their password.
The system logs out users after password change.
```

Nonfunctional security requirement:

```text
Passwords must be hashed using an approved password hashing algorithm.
Sensitive data must be encrypted in transit and at rest.
Admin actions must be audited.
Authentication tokens must expire after a defined period.
The system must rate-limit login attempts.
```

Security requirements must be explicit. "Secure" is not enough.

### Requirements and Compliance

Compliance requirements often appear as constraints or nonfunctional requirements.

Examples:

```text
Customer records must be retained for 7 years.
Users must be able to request data deletion where legally allowed.
Audit logs must be immutable.
Data must remain in a specified geographic region.
Access to regulated data must be logged.
The system must support export of personal data.
```

Compliance can affect:

- Data model.
- Storage location.
- Retention policies.
- Encryption.
- Audit logging.
- Access control.
- Backup strategy.
- Deletion workflows.
- Vendor selection.
- Operational processes.

In interviews, compliance requirements are especially important for finance, healthcare, insurance, government, education, and payment systems.

### Requirements and Cost

Cost can be a nonfunctional requirement.

Examples:

```text
The monthly cloud cost for the MVP must stay under $2,000.
The system should use serverless services where possible to reduce idle cost.
The archive storage tier may be used for data older than 1 year.
```

Cost requirements create trade-offs.

Example:

```text
Requirement:
99.99% availability across regions.

Trade-off:
Multi-region active-active deployment increases cost and complexity.
```

A strong architect does not ignore cost. The best design is not always the most scalable design. It is the design that meets requirements within constraints.

### Requirements and Operational Readiness

Operational requirements define how the system is supported in production.

Examples:

```text
The system must expose health check endpoints.
The system must emit structured logs.
The system must include dashboards for error rate, latency, and throughput.
Critical alerts must notify the on-call engineer within 5 minutes.
Deployments must support rollback.
Database backups must be tested monthly.
```

These are nonfunctional requirements because they define how the system is operated and supported.

They are often missed during early design but are critical for production systems.

### Quality Attribute Scenarios

A quality attribute scenario makes an NFR concrete.

Template:

```text
Source: Who or what triggers the scenario?
Stimulus: What happens?
Environment: Under what conditions?
Artifact: What part of the system is affected?
Response: What should the system do?
Response measure: How will success be measured?
```

Example:

```text
Source:
A customer

Stimulus:
Submits an order

Environment:
Peak traffic, 1,000 concurrent users

Artifact:
Checkout API and order database

Response:
The system validates the order, reserves inventory, creates the order, and returns confirmation

Response measure:
p95 response time <= 1 second, error rate < 0.1%
```

This is much better than "checkout should be fast."

### Example Requirement Decomposition

High-level request:

```text
Build a file-sharing system.
```

Functional requirements:

```text
Users can upload files.
Users can download files.
Users can share files with other users.
Users can revoke access.
Users can view upload and download history.
Admins can manage storage limits.
```

Nonfunctional requirements:

```text
Files up to 5 GB must be supported.
Uploads must resume after interruption.
Download links must expire after 24 hours.
Files must be encrypted at rest.
Access must be audited.
The system must support 10,000 downloads per hour.
The service must be available 99.9% monthly.
Virus scanning must complete before files are available for download.
```

Architecture implications:

```text
Use object storage.
Use metadata database.
Use background scanning.
Use signed download URLs.
Use audit logging.
Use queue-based processing.
Use CDN if download traffic is high.
Use encryption and key management.
Use resumable/chunked upload.
```

This example shows how requirements decomposition turns an idea into architecture.

### Common Mistakes

Common mistakes include:

- Treating nonfunctional requirements as optional.
- Writing vague NFRs such as "fast", "secure", or "scalable".
- Focusing only on features and ignoring production qualities.
- Confusing a solution with a requirement.
- Not asking about scale, availability, security, and compliance in system design interviews.
- Assuming all data must be strongly consistent.
- Assuming all features need the same availability target.
- Not prioritizing requirements.
- Not identifying architecturally significant requirements.
- Not measuring NFRs.
- Not mapping requirements to tests.
- Not considering cost trade-offs.
- Writing requirements that are impossible to verify.
- Over-engineering for imaginary NFRs.
- Under-engineering by ignoring likely growth or failure modes.
- Treating "microservices", "Kafka", or "Kubernetes" as requirements without understanding the underlying need.
- Ignoring operational requirements such as logging, monitoring, and backup.
- Forgetting data retention, privacy, and audit requirements.
- Not clarifying MVP vs future requirements.

### Best Practices

Separate functional requirements from nonfunctional requirements during discovery.

Ask clarifying questions before designing.

Make nonfunctional requirements measurable.

Identify architecturally significant requirements early.

Connect requirements to business goals.

Distinguish real constraints from preferred solutions.

Prioritize requirements.

Document trade-offs explicitly.

Use quality attribute scenarios for important NFRs.

Define acceptance criteria for both functional and nonfunctional requirements.

Map requirements to tests and monitoring.

Validate NFRs with realistic tests, not assumptions.

Do not over-engineer for requirements that do not exist.

Do not ignore critical security, reliability, compliance, and data integrity requirements even in MVP.

Review requirements with stakeholders, developers, testers, operations, security, and product owners.

Treat requirements as living information that can evolve, but protect critical architecture decisions with clear rationale.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-beginner-q01 -->
#### Beginner Q01: What is a functional requirement?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A functional requirement describes what the system must do. It defines behavior, features, business rules, workflows, inputs, outputs, and user-visible capabilities.

Examples include:

- A user can register an account.
- A customer can place an order.
- An admin can approve a request.
- The system sends an email after payment succeeds.
- The API returns order details by ID.

Functional requirements are usually verified through unit tests, integration tests, API tests, UI tests, and acceptance tests.

##### Key Points to Mention

- Describes system behavior.
- Answers "what should the system do?"
- Includes features, workflows, rules, and outputs.
- Often written as user stories or use cases.
- Drives product scope.
- Verified by functional tests and acceptance criteria.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-beginner-q01 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-beginner-q02 -->
#### Beginner Q02: What is a nonfunctional requirement?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A nonfunctional requirement describes how well the system must operate or what constraints it must satisfy. It defines quality attributes such as performance, scalability, availability, reliability, security, usability, maintainability, observability, compliance, and cost.

Examples include:

- The API must respond within 300 ms at p95.
- The system must support 10,000 concurrent users.
- Customer data must be encrypted at rest and in transit.
- The service must be available 99.9% monthly.
- Audit logs must be retained for 7 years.

Nonfunctional requirements often drive architecture and infrastructure decisions.

##### Key Points to Mention

- Describes quality attributes and constraints.
- Answers "how well should the system work?"
- Includes performance, security, reliability, scalability, maintainability.
- Should be measurable when possible.
- Strongly affects architecture.
- Verified through performance, security, reliability, and operational tests.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-beginner-q02 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-beginner-q03 -->
#### Beginner Q03: What is the difference between functional and nonfunctional requirements?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Functional requirements define what the system does. Nonfunctional requirements define how well the system does it or what constraints it must satisfy.

Example:

```text
Functional requirement:
Users can upload files.

Nonfunctional requirements:
Files can be up to 5 GB.
Uploads must resume after interruption.
Files must be encrypted at rest.
Download access must be audited.
```

The functional requirement defines the feature. The nonfunctional requirements shape the architecture and quality expectations.

##### Key Points to Mention

- Functional = behavior/features.
- Nonfunctional = quality/constraints.
- Functional requirements define scope.
- Nonfunctional requirements define quality bar.
- Both are required for production systems.
- NFRs often drive architecture decisions.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-beginner-q03 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-beginner-q04 -->
#### Beginner Q04: Give examples of functional requirements for an e-commerce system.

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Examples of functional requirements for an e-commerce system include:

- Customers can browse products.
- Customers can search products by name or category.
- Customers can add products to a shopping cart.
- Customers can place orders.
- Customers can pay using a saved payment method.
- The system sends an order confirmation email.
- Admins can update product inventory.
- Customers can view order history.
- Customers can cancel an order before shipment.

These describe what the system must do.

##### Key Points to Mention

- Product browsing.
- Search.
- Cart management.
- Checkout.
- Payment.
- Email confirmation.
- Inventory management.
- Order history.
- User-visible behavior.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-beginner-q04 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-beginner-q05 -->
#### Beginner Q05: Give examples of nonfunctional requirements for an e-commerce system.

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Examples of nonfunctional requirements for an e-commerce system include:

- Product search must respond within 300 ms at p95.
- Checkout must be available 99.95% monthly.
- The system must support 5,000 concurrent users during peak campaigns.
- Payment data must never be stored in plain text.
- Customer data must be encrypted at rest and in transit.
- Orders must not be lost after payment succeeds.
- The system must emit structured logs for checkout failures.
- Order records must be retained for 7 years.

These describe quality, scale, security, reliability, and operational expectations.

##### Key Points to Mention

- Performance.
- Availability.
- Scalability.
- Security.
- Reliability.
- Observability.
- Compliance.
- Data retention.
- Quality expectations.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-beginner-q05 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-beginner-q06 -->
#### Beginner Q06: Why are nonfunctional requirements important?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

Nonfunctional requirements are important because a system can be functionally correct but still fail in production. For example, users may be able to place orders, but if checkout takes 30 seconds, fails during peak traffic, exposes sensitive data, or loses orders, the system is not acceptable.

NFRs define the quality bar for production readiness. They influence architecture, infrastructure, database design, security, testing, monitoring, deployment, and cost.

##### Key Points to Mention

- Functional correctness is not enough.
- NFRs define production quality.
- They affect architecture and technology choices.
- They reduce hidden assumptions.
- They guide testing and monitoring.
- They help avoid under-engineering and over-engineering.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-intermediate-q01 -->
#### Intermediate Q01: How do nonfunctional requirements influence architecture?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Nonfunctional requirements influence architecture by defining the qualities and constraints the system must satisfy. Requirements such as low latency, high availability, scalability, security, compliance, maintainability, and observability often determine architectural patterns and technology choices.

For example, a file upload feature may be implemented simply with local storage for a small internal tool. But if files are 10 GB, must be encrypted, must be virus-scanned, and must support resumable uploads, the design may require object storage, chunked upload, background scanning, metadata storage, signed URLs, and audit logging.

Functional requirements define the feature. Nonfunctional requirements often determine the architecture.

##### Key Points to Mention

- NFRs are often architecturally significant.
- Performance can require caching and indexing.
- Scalability can require horizontal scaling and queues.
- Availability can require redundancy and failover.
- Security can require encryption, authorization, and audit logging.
- Maintainability can require modular design.
- NFRs shape trade-offs.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-intermediate-q01 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-intermediate-q02 -->
#### Intermediate Q02: How do you make a nonfunctional requirement measurable?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Make a nonfunctional requirement measurable by replacing vague words with specific metrics, operating conditions, and success criteria.

Weak:

```text
The system must be fast.
```

Better:

```text
The product search API must respond within 300 ms at p95 under 1,000 requests per second with 100,000 products indexed.
```

A measurable NFR should define what is measured, the target value, the load or environment, and how it will be verified.

##### Key Points to Mention

- Avoid vague terms like fast, secure, scalable.
- Add specific metrics.
- Include load or operating conditions.
- Include percentile when relevant.
- Define verification method.
- Make it testable.
- Use realistic targets.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-intermediate-q02 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-intermediate-q03 -->
#### Intermediate Q03: What is an architecturally significant requirement?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

An architecturally significant requirement is a requirement that strongly influences architecture decisions. It may affect system structure, technology choices, deployment design, data storage, communication patterns, scaling strategy, security model, or operational approach.

Examples include:

- The system must support 1 million concurrent users.
- The system must run across multiple regions.
- Payments must be processed safely without duplicate charges.
- Tenant data must be isolated.
- The system must recover from region failure within 30 minutes.
- Data must remain in a specific geographic region.

These requirements are important to identify early because changing architecture later can be expensive.

##### Key Points to Mention

- Strongly influences architecture.
- Often an NFR but can also be functional.
- Affects major design decisions.
- Should be identified early.
- Examples include scale, availability, security, compliance, data isolation.
- Drives trade-off analysis.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-intermediate-q03 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-intermediate-q04 -->
#### Intermediate Q04: How do you gather requirements in a system design interview?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Start by clarifying functional requirements: who the users are, what actions they perform, what workflows are in scope, and what is out of scope.

Then clarify nonfunctional requirements: expected scale, read/write patterns, latency, availability, consistency, security, compliance, data retention, observability, cost constraints, and operational expectations.

Example questions:

- How many users and requests should we support?
- What latency is acceptable?
- What availability target matters?
- Which data must be strongly consistent?
- What can be eventually consistent?
- What data is sensitive?
- Are there compliance or data residency constraints?
- What is MVP vs future scope?

##### Key Points to Mention

- Start with users and main flows.
- Clarify scope.
- Ask about scale and traffic.
- Ask about latency and availability.
- Ask about security and compliance.
- Ask about consistency.
- Ask about operations and cost.
- Requirements guide the design.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-intermediate-q04 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-intermediate-q05 -->
#### Intermediate Q05: What is the difference between a requirement and a solution?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

A requirement describes a need or constraint. A solution describes how to satisfy it.

Example of a solution disguised as a requirement:

```text
The system must use Kafka.
```

Possible underlying requirement:

```text
The system must process order events asynchronously with durable delivery, retry support, and throughput of 10,000 events per second.
```

Sometimes a technology is a real constraint, but it is important to ask why. Understanding the underlying need helps choose the right architecture and avoid using technology for its own sake.

##### Key Points to Mention

- Requirement = need or constraint.
- Solution = implementation choice.
- Technologies are often solutions, not requirements.
- Ask why a specific technology is required.
- Underlying need may be throughput, durability, team skill, compliance, or integration.
- Good architects separate problem from solution.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-intermediate-q05 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-intermediate-q06 -->
#### Intermediate Q06: How do functional and nonfunctional requirements affect testing strategy?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Functional requirements are usually verified with unit tests, integration tests, API tests, UI tests, and acceptance tests. They check that the system performs the required behavior.

Nonfunctional requirements require different verification methods. Performance requirements may need load tests. Security requirements may need security tests and reviews. Availability and resilience requirements may need failover tests, chaos testing, or disaster recovery drills. Accessibility requirements may need accessibility testing. Observability requirements may need log, metric, and trace checks.

A complete testing strategy should map tests to both feature behavior and quality attributes.

##### Key Points to Mention

- Functional tests verify behavior.
- NFR tests verify quality attributes.
- Performance needs load tests.
- Security needs security testing and reviews.
- Reliability needs failure and recovery tests.
- Accessibility needs accessibility testing.
- Observability should be verified.
- Requirements should map to tests.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-intermediate-q06 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-intermediate-q07 -->
#### Intermediate Q07: What are quality attributes?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

Quality attributes are properties used to evaluate how well a system satisfies stakeholder needs. They are commonly treated as nonfunctional requirements or architecture characteristics.

Examples include performance, scalability, availability, reliability, resilience, security, usability, accessibility, maintainability, testability, observability, portability, interoperability, and cost efficiency.

Quality attributes are important because they often drive architecture decisions and trade-offs.

##### Key Points to Mention

- Describe system quality.
- Often part of NFRs.
- Also called architecture characteristics or "ilities."
- Include performance, security, availability, scalability, maintainability.
- Need measurable targets.
- Drive architecture trade-offs.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-intermediate-q07 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-intermediate-q08 -->
#### Intermediate Q08: How do you handle conflicting requirements?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

Conflicting requirements should be made explicit and resolved through trade-off analysis with stakeholders. The team should clarify priorities, business impact, cost, risk, and acceptable compromise.

For example, a requirement for strong consistency may conflict with a requirement for maximum availability during network partitions. The solution may be to use strong consistency for critical operations like payment and inventory reservation, but eventual consistency for less critical views like analytics or recommendations.

Good architecture does not hide trade-offs. It documents them and aligns them with business priorities.

##### Key Points to Mention

- Identify the conflict clearly.
- Clarify priorities and business impact.
- Discuss cost and risk.
- Consider different behavior for different parts of the system.
- Document trade-offs.
- Align with stakeholders.
- Avoid pretending all qualities can be maximized at once.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-advanced-q01 -->
#### Advanced Q01: How would you decompose requirements for a new system during architecture design?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would start by understanding the business goal and stakeholders. Then I would identify the main user roles and functional workflows. After that, I would clarify nonfunctional requirements such as scale, latency, availability, reliability, consistency, security, compliance, observability, maintainability, and cost.

I would separate MVP requirements from future requirements, identify architecturally significant requirements, and clarify constraints such as required cloud provider, data residency, existing integrations, or team skill limitations. Then I would map requirements to system capabilities, data boundaries, APIs, storage choices, integration patterns, and testing strategy.

The output should be a clear set of prioritized functional requirements, measurable NFRs, known constraints, assumptions, risks, and trade-offs.

##### Key Points to Mention

- Start with business goals.
- Identify users and workflows.
- Separate functional and nonfunctional requirements.
- Clarify MVP vs future scope.
- Identify architecturally significant requirements.
- Capture constraints and assumptions.
- Map requirements to design decisions.
- Document risks and trade-offs.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-advanced-q01 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-advanced-q02 -->
#### Advanced Q02: Why can vague nonfunctional requirements be dangerous?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Vague nonfunctional requirements are dangerous because they lead to different interpretations. Words like "fast", "secure", "scalable", and "reliable" do not define a clear target. Developers, architects, testers, product owners, and users may all assume different meanings.

This can cause under-engineering, over-engineering, failed acceptance, poor production behavior, and missed testing. For example, "fast search" might mean 100 ms to one stakeholder and 5 seconds to another.

The solution is to make NFRs measurable with specific metrics, operating conditions, and verification methods.

##### Key Points to Mention

- Different stakeholders interpret vague words differently.
- Vague NFRs cannot be tested reliably.
- Causes under-engineering or over-engineering.
- Creates hidden architecture risk.
- Replace vague words with measurable targets.
- Include load, percentile, and verification criteria.
- Clarify assumptions early.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-advanced-q02 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-advanced-q03 -->
#### Advanced Q03: How do you translate NFRs into architecture decisions?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Translate NFRs by identifying the quality attribute, making it measurable, and then choosing patterns and technologies that satisfy it within constraints.

For example, if the NFR is "checkout must remain available during a single application instance failure," the architecture may need multiple instances, health checks, load balancing, stateless application design, and shared durable storage.

If the NFR is "analytics can be delayed by up to 15 minutes," the architecture can use asynchronous event processing and batch aggregation instead of synchronous real-time updates.

The key is to connect each major architecture decision to a requirement and document the trade-off.

##### Key Points to Mention

- Identify the quality attribute.
- Make the target measurable.
- Choose patterns that satisfy the target.
- Consider constraints and cost.
- Document the decision rationale.
- Validate with tests or operational metrics.
- Avoid choosing patterns without requirement justification.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-advanced-q03 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-advanced-q04 -->
#### Advanced Q04: How do requirements affect consistency choices in distributed systems?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Requirements determine which parts of the system need strong consistency and which can tolerate eventual consistency. Critical operations like payment, inventory reservation, account balance updates, and authorization decisions often require stronger consistency. Less critical views like analytics, recommendations, search indexes, and read receipts can often be eventually consistent.

The acceptable staleness window should be explicit. For example, "recommendations can lag by 15 minutes" enables simpler async processing. But "users must not be charged twice" requires idempotency, transactions, or strong coordination.

Consistency choices should be based on business impact, user expectations, and failure tolerance.

##### Key Points to Mention

- Not all data needs the same consistency.
- Critical operations may need strong consistency.
- Analytics/search/recommendations may tolerate eventual consistency.
- Define acceptable staleness.
- Consistency affects latency and availability.
- Business impact drives the choice.
- Idempotency is often required for reliability.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-advanced-q04 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-advanced-q05 -->
#### Advanced Q05: How do you identify architecturally significant requirements in an interview?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

I look for requirements that affect major design decisions, such as scale, latency, availability, consistency, data volume, security, compliance, integrations, deployment model, team ownership, and operational needs.

I ask questions like:

- What is the expected traffic and data size?
- What latency matters?
- What availability target is required?
- What data is sensitive?
- Are there compliance or data residency rules?
- Which operations must be strongly consistent?
- What can fail gracefully?
- Are there required integrations or technologies?
- What is the cost or time constraint?

The requirements that significantly change storage, communication, deployment, data partitioning, security, or failure handling are architecturally significant.

##### Key Points to Mention

- Look for scale, latency, availability, consistency, security, compliance.
- Ask clarifying questions.
- Identify requirements that change architecture.
- Separate important constraints from preferences.
- Prioritize early design risks.
- Use NFRs to guide trade-offs.
- Do not jump to design too early.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-advanced-q05 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-advanced-q06 -->
#### Advanced Q06: How would you handle a stakeholder saying "the system must be scalable"?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

I would clarify what scalability means in measurable terms. I would ask what dimension needs to scale: users, requests per second, data volume, tenants, background jobs, file size, geographic regions, or teams. I would also ask about current load, expected future load, peak traffic, growth rate, acceptable latency, and budget.

Then I would convert it into measurable requirements.

Example:

```text
The system must support 10,000 concurrent users and 2,000 requests per second while keeping p95 API latency under 500 ms during peak hours.
```

Only after clarifying would I propose scaling patterns such as stateless services, horizontal scaling, caching, partitioning, queues, or read replicas.

##### Key Points to Mention

- "Scalable" is too vague.
- Ask what dimension must scale.
- Ask current and expected load.
- Ask latency targets.
- Ask peak vs average traffic.
- Ask budget and timeline.
- Convert to measurable NFR.
- Choose patterns after clarification.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-advanced-q06 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-advanced-q07 -->
#### Advanced Q07: How do you avoid over-engineering from nonfunctional requirements?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Avoid over-engineering by validating that each NFR is real, measurable, prioritized, and tied to business value or risk. Distinguish current MVP requirements from future possibilities. Ask what happens if the requirement is not met, what scale is expected now, what growth is realistic, and what budget or timeline constraints exist.

For example, not every system needs microservices, multi-region deployment, Kafka, or global active-active architecture. If the MVP has 500 users and can tolerate short downtime, a modular monolith with good observability and a clear migration path may be better.

Good architecture satisfies current important requirements while leaving room for expected growth.

##### Key Points to Mention

- Validate NFRs with business value.
- Separate MVP from future needs.
- Prioritize by risk and impact.
- Consider cost and complexity.
- Avoid trendy solutions without requirement justification.
- Design for expected growth, not imaginary scale.
- Keep migration paths open.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-advanced-q07 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-advanced-q08 -->
#### Advanced Q08: How do you connect requirements to testing and monitoring?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

Each important requirement should have a verification method. Functional requirements can map to unit, integration, API, UI, or acceptance tests. Nonfunctional requirements can map to load tests, security tests, failover tests, accessibility tests, compliance checks, and monitoring dashboards.

For production, some NFRs must also be monitored continuously. For example, if the requirement is "checkout p95 latency under 1 second," then CI may include performance tests, and production monitoring should track checkout latency with alerts.

Traceability helps connect business goals, requirements, design decisions, tests, and operational metrics.

##### Key Points to Mention

- Requirements should be verifiable.
- Functional requirements map to functional tests.
- NFRs map to specialized tests.
- Production NFRs need monitoring.
- Use dashboards and alerts for latency, errors, availability.
- Traceability improves confidence.
- Tests alone may not prove ongoing production behavior.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-advanced-q08 -->

<!-- question:start:functional-requirements-vs-nonfunctional-requirements-advanced-q09 -->
#### Advanced Q09: How would you explain functional vs nonfunctional requirements using a real design example?

<!-- question-id:functional-requirements-vs-nonfunctional-requirements-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

For a reporting system, functional requirements might be:

- Users can request reports.
- Users can download completed reports.
- Admins can schedule recurring reports.
- The system emails users when reports are ready.

Nonfunctional requirements might be:

- Report requests must return immediately with `202 Accepted`.
- 95% of reports must complete within 10 minutes.
- Large reports must not block API request threads.
- Only authorized users can download reports.
- Reports must be retained for 90 days.
- Failed report jobs must be retried and visible in monitoring.

These NFRs change the architecture. Instead of generating reports synchronously in the API, the design may use a job queue, background worker, blob storage, status table, retry logic, authorization checks, and monitoring.

##### Key Points to Mention

- Functional requirements define reporting features.
- NFRs define latency, security, retention, reliability.
- NFRs push design toward async processing.
- Queue and worker improve responsiveness.
- Blob storage handles generated files.
- Monitoring handles operational visibility.
- Good examples connect requirements to design choices.

<!-- question:end:functional-requirements-vs-nonfunctional-requirements-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
