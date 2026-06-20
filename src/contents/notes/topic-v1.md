## Design & Architecture

1. **Requirements decomposition and system trade-offs**
   - ✅ Functional requirements vs nonfunctional requirements
   - ✅ Throughput, latency, concurrency, availability, consistency, and cost targets
   - ✅ Assumptions, constraints, risks, and failure modes
   - ✅ Capacity planning and identifying likely bottlenecks

2. **Software design principles and common .NET patterns**
   - ✅ SOLID principles, especially Single Responsibility, Open/Closed, Interface Segregation, and Dependency Inversion
   - ✅ KISS, DRY, YAGNI, Separation of Concerns, cohesion, and coupling
   - ✅ Factory, Builder, Strategy, Adapter, Decorator, Facade, Proxy, and Chain of Responsibility
   - ✅ Repository, Unit of Work, Mediator, Specification, and when these patterns are useful in .NET applications
   - ✅ Recognizing when a pattern improves maintainability vs when it adds unnecessary complexity

3. **Clean Architecture and modular boundaries**
   - ✅ Layered architecture vs Clean Architecture vs ports-and-adapters
   - ✅ Dependency inversion and inward-facing dependencies
   - ✅ Modular monolith structure and feature-based organization
   - ✅ When not to over-architect a simple application

4. **Domain modeling and Domain-Driven Design**
   - ✅ Ubiquitous language and bounded contexts
   - ✅ Entities, value objects, aggregates, and invariants
   - ✅ Domain services and domain events
   - ✅ Mapping domain models to persistence without corrupting the model

5. **API design and integration contracts**
   - ✅ Resource modeling, REST semantics, and when RPC-style endpoints are acceptable
   - ✅ Versioning, idempotency, pagination, filtering, and sorting
   - ✅ OpenAPI contracts and consumer-facing documentation
   - ✅ API gateway and BFF decisions for web clients and microservices

6. **Web application security threat modeling and attack patterns**
   - ✅ SQL Injection, parameterized queries, ORM safety, and unsafe dynamic SQL
   - ✅ Cross-Site Scripting, output encoding, dangerous HTML rendering, and content security controls
   - ✅ Cross-Site Request Forgery and how cookie-based authentication changes the risk model
   - ✅ Insecure Direct Object Reference, broken access control, and object-level authorization
   - ✅ Session hijacking, credential stuffing, brute-force protection, lockout, and multi-factor authentication
   - ✅ Command injection, file upload risks, path traversal, secrets exposure, and DoS/DDoS basics
   - ✅ Threat modeling user input, trust boundaries, authentication flows, and admin-only operations

7. **Distributed systems patterns**
   - ✅ CQRS and when separate read and write models make sense
   - ✅ Event-driven communication and asynchronous request-reply
   - ✅ Saga and compensating transaction patterns
   - ✅ Idempotent consumers and duplicate-message handling

8. **Scalability, resilience, caching, and observability design**
   - ✅ Retry, circuit breaker, bulkhead, and queue-based load leveling
   - ✅ Cache-aside, read caching, and invalidation trade-offs
   - ✅ Horizontal scaling, stateless services, and backpressure
   - ✅ Correlation IDs, traces, health checks, and alertable telemetry

9. **Testing strategy, maintainability, and technical leadership**
   - ✅ Test pyramid, contract tests, and architecture fitness checks
   - ✅ Refactoring strategy, code review standards, and technical debt management
   - ✅ ADRs, coding conventions, and team-level design communication
   - ✅ Mentoring, ownership, and incremental modernization

## Azure

1. **Azure compute choices and hosting models**
   - ✅ App Service plans and when PaaS web hosting is the right fit
   - ✅ Azure Functions hosting options, including current scale guidance
   - ✅ Azure Container Apps for containerized APIs and background workloads
   - ✅ Trade-offs among simplicity, portability, autoscaling, and operational control

2. **Azure Functions and Durable Functions**
   - ✅ HTTP, timer, queue, Service Bus, Event Grid, and Blob triggers
   - ✅ In-process vs isolated worker model for .NET Functions
   - ✅ Cold starts, hosting plan choices, timeout configuration, and scaling behavior
   - ✅ Bindings, connection configuration, dependency injection, logging, and local development
   - ✅ Durable Functions orchestrators, activity functions, durable timers, external events, and durable entities
   - ✅ Function chaining, fan-out/fan-in, async workflow state, replay-safe orchestrator code, and compensation

3. **Identity, secrets, and access control**
   - ✅ Microsoft Entra app registrations, scopes, and auth-code flow basics
   - ✅ System-assigned and user-assigned managed identities
   - ✅ Azure Key Vault for secrets, certificates, and connection settings
   - ✅ RBAC, least privilege, and separating human vs workload identities

4. **Networking, API edge, and secure connectivity**
   - ✅ Azure API Management and policy-based gateways
   - ✅ Rate limiting, quotas, auth offload, and request transformation at the edge
   - ✅ Application Gateway and WAF concepts
   - ✅ Service tags, private networking, and reducing public attack surface

5. **Azure data, storage, and caching services**
   - ✅ Azure SQL Database tiers, scaling, serverless options, and failover groups
   - ✅ Blob Storage, access tiers, lifecycle management, and immutability
   - ✅ Azure Cache for Redis for low-latency reads and session/state scenarios
   - ✅ Matching storage choices to relational, object, and cache workloads

6. **Azure Blob Storage and file handling**
   - ✅ Storage accounts, containers, blobs, virtual folders, metadata, and access tiers
   - ✅ Block blobs, append blobs, and page blobs
   - ✅ Shared access signatures, managed identity, RBAC, stored access policies, and public access risks
   - ✅ Large file uploads, block upload, retry behavior, checksums, and resumable upload patterns
   - ✅ Lifecycle management, soft delete, versioning, immutability, encryption, and retention
   - ✅ .NET Blob clients, direct browser upload patterns, and storing metadata separately from binary content

7. **Messaging and event-driven Azure integration**
   - ✅ Service Bus queues, topics, subscriptions, and dead-letter queues
   - ✅ Event Grid for event publication and fan-out
   - ✅ Duplicate detection, retries, and poison-message handling
   - ✅ Choosing queues vs topics vs event notifications

8. **Monitoring, tracing, and incident response on Azure**
   - ✅ Metrics vs logs vs traces
   - ✅ Application Insights and OpenTelemetry-aligned observability
   - ✅ Log Analytics queries, dashboards, and availability tests
   - ✅ Alert rules, action groups, and incident response workflows

9. **Delivery, infrastructure as code, scaling, and cost control**
   - ✅ Bicep fundamentals, modules, and reusable environment definitions
   - ✅ GitHub Actions or Azure DevOps for build, test, deploy, and infrastructure steps
   - ✅ OIDC-based Azure authentication in pipelines
   - ✅ Deployment slots, rollout safety, autoscaling, availability zones, and cost-aware tiering

## .NET

1. **C# language foundations**
   - ✅ Classes, structs, records, and object-oriented fundamentals
   - ✅ Value types vs reference types
   - ✅ Exceptions, collection choices, and common BCL types
   - ✅ Nullable reference types and null-safety habits

2. **Modern C# patterns, LINQ, generics, delegates, and events**
   - ✅ Generic type constraints and reusable components
   - ✅ Pattern matching, switch expressions, and records
   - ✅ Delegates, events, and observer-style communication
   - ✅ LINQ querying, deferred execution, and IEnumerable vs IQueryable

3. **Async programming, tasks, cancellation, and concurrency**
   - ✅ async and await semantics
   - ✅ CPU-bound vs I/O-bound work and when Task.Run is appropriate
   - ✅ CancellationToken propagation
   - ✅ Exception handling, timeouts, and coordinating multiple tasks

4. **Dependency injection, configuration, middleware, and logging**
   - ✅ DI container basics, lifetimes, and constructor selection
   - ✅ Configuration sources and the options pattern
   - ✅ Middleware ordering and cross-cutting behavior
   - ✅ Structured logging and correlation

5. **ASP.NET Core API design and implementation**
   - ✅ Controllers vs Minimal APIs and when to choose each
   - ✅ Endpoint routing, attribute routing, route constraints, optional parameters, catch-all routes, and route precedence
   - ✅ Parameter binding from route, query string, body, form, header, and services
   - ✅ `[ApiController]` behavior, automatic model validation, binding-source inference, and validation responses
   - ✅ Content negotiation, status codes, DTOs, and request/response contracts
   - ✅ Authorization, resource, action, exception, and result filters, and how filters differ from middleware
   - ProblemDetails and consistent error responses
   - ✅ OpenAPI generation, endpoint metadata, and API discoverability

6. **Authentication, authorization, and web security**
   - ✅ Authentication vs authorization
   - ✅ JWT bearer auth, claims, scopes, and policy-based authorization
   - ✅ Cookie behavior, CSRF, and browser-based security concerns
   - ✅ CORS, secure headers, secret handling, and least privilege

7. **Entity Framework Core modeling, querying, and persistence**
   - ✅ Conventions, Fluent API, owned/complex data, and relationship mapping
   - ✅ DbContext, DbSet, entity states, Change Tracker behavior, `Attach`, `Update`, and `DetectChanges`
   - ✅ Eager, explicit, and lazy loading, including the N+1 query problem
   - ✅ Tracking vs no-tracking queries and identity resolution
   - LINQ translation, generated SQL diagnostics, `ToQueryString`, logging, interceptors, and slow-query investigation
   - ✅ Migrations, migration snapshots, reviewed SQL scripts, rollback strategy, and production migration safety
   - ✅ Data seeding choices, including `HasData` vs runtime seed logic
   - ✅ Optimistic concurrency, transactions, savepoints, and conflict handling
   - ✅ DbContext lifetime, thread safety, connection usage, and when to avoid sharing a context

8. **ASP.NET Core testing strategy and integration testing**
   - ✅ Unit tests vs integration tests vs end-to-end tests
   - ✅ xUnit, NUnit, MSTest, test naming, Arrange-Act-Assert, and test data setup
   - ✅ Test doubles, mocks, stubs, fakes, and when mocking hides real integration problems
   - ✅ `WebApplicationFactory`, `TestServer`, `HttpClient`, and full ASP.NET Core pipeline testing
   - ✅ Overriding services and configuration for tests
   - ✅ EF Core InMemory provider caveats and when SQLite, Docker databases, or Testcontainers are safer
   - ✅ Testing authentication, authorization, middleware, filters, validation, and error responses
   - ✅ Code coverage, useful assertions, flaky test prevention, and CI test execution

9. **Performance, testing, diagnostics, and background work**
   - ✅ IHttpClientFactory and resilient outbound HTTP
   - ✅ In-memory, distributed, hybrid, and output caching
   - ✅ Rate limiting, memory/GC awareness, and runtime diagnostics
   - ✅ Unit tests, integration tests, and hosted services for background jobs

## React

1. **JavaScript fundamentals for React developers**
   - ✅ Closures and lexical scope
   - ✅ Promises and asynchronous JavaScript
   - ✅ Modules and import/export behavior
   - ✅ Strict equality, reference identity, and immutability implications

2. **TypeScript for React applications**
   - ✅ Everyday types, unions, intersections, and discriminated unions
   - ✅ Narrowing and control-flow analysis
   - ✅ Utility types and conditional types
   - ✅ tsconfig basics, strict mode, and module settings

3. **Components, props, state, and rendering behavior**
   - ✅ Functional components and JSX composition
   - ✅ Props flow, local state, and lifting state up
   - ✅ Controlled inputs and event handling
   - ✅ Rerender triggers, derived state, and avoiding duplicated state

4. **Hooks, effects, and custom hooks**
   - ✅ useState, useReducer, useContext, and custom hooks
   - ✅ Proper useEffect usage and cleanup
   - ✅ “You might not need an effect” patterns
   - ✅ Memoization with useMemo and dependency correctness

5. **Routing, forms, and server communication**
   - ✅ Nested routes, layouts, params, and route boundaries
   - ✅ Route loaders/actions or equivalent data-loading patterns
   - ✅ Forms, validation, optimistic updates, and mutation states
   - ✅ Error states and retry UX for failed requests

6. **Production data access, API clients, and frontend auth**
   - ✅ Centralized API clients with `fetch`, Axios, RTK Query, or TanStack Query
   - ✅ Axios request and response interceptors for auth headers, global errors, logging, and retry behavior
   - ✅ RTK Query custom base queries, including Axios-based baseQuery patterns
   - ✅ Access tokens, refresh tokens, expiration handling, retrying original requests, and refresh-token queue patterns
   - ✅ Browser storage trade-offs: localStorage, sessionStorage, memory storage, and cookies
   - ✅ Secure cookie flags: `HttpOnly`, `Secure`, `SameSite`, path, domain, and expiration
   - ✅ Global loading, error, unauthorized, and network-failure UX patterns

7. **Forms, validation, and frontend performance in production**
   - ✅ React Hook Form fundamentals, uncontrolled inputs, `Controller`, and form state
   - ✅ Built-in validation, async validation, and schema resolvers with Yup or Zod
   - ✅ `watch` vs `useWatch`, form render isolation, and large-form performance
   - ✅ Debounce and throttle for search, filtering, autosave, and expensive UI updates
   - ✅ Code splitting, lazy loading, bundle analysis, and route-level loading
   - ✅ Preventing duplicate requests, canceling stale requests, and avoiding race conditions
   - ✅ Reducing state complexity and avoiding unnecessary rerenders in form-heavy pages

8. **State management, performance, and rendering optimization**
   - ✅ Context plus reducer vs external stores
   - ✅ useSyncExternalStore and subscribing to external state
   - ✅ Memoization and avoiding needless rerenders
   - ✅ Suspense, transitions, and rendering priority concepts

9. **Testing, accessibility, and frontend debugging**
   - ✅ User-centric testing with React Testing Library
   - ✅ Query strategy and avoiding implementation-detail assertions
   - ✅ Keyboard accessibility, semantic HTML, ARIA, and labels/IDs
   - ✅ Debugging rendering, hydration, and interaction issues

## SQL

1. **Relational modeling and normalization**
   - ✅ Primary keys, foreign keys, and constraints
   - ✅ One-to-one, one-to-many, and many-to-many relationships
   - ✅ Normalization and when denormalization is justified
   - ✅ Data types, nullability, and business-rule enforcement

2. **Core querying and data retrieval**
   - ✅ SELECT, WHERE, ORDER BY, TOP/OFFSET-FETCH
   - ✅ INNER, LEFT, and other join patterns
   - ✅ GROUP BY and aggregate functions
   - ✅ NULL handling and common filtering mistakes

3. **SQL practical interview comparisons and SQL Server-specific features**
   - ✅ DELETE vs TRUNCATE, including logging, identity reset, rollback behavior, and foreign key limitations
   - ✅ WHERE vs HAVING and filtering before vs after aggregation
   - ✅ Primary key vs unique constraint, candidate keys, foreign keys, and constraint design
   - ✅ DDL vs DML vs DCL and how schema, data, and permissions changes differ
   - ✅ Local vs global temporary tables and table variables
   - ✅ UNION vs UNION ALL, EXCEPT, INTERSECT, and duplicate handling
   - ✅ CHAR vs VARCHAR vs NVARCHAR and Unicode storage choices
   - ✅ Computed columns, persisted computed columns, and indexed views
   - ✅ MERGE and upsert patterns, including concurrency cautions
   - ✅ Stored procedure transaction patterns with `TRY...CATCH`, output parameters, and error handling

4. **Advanced querying with window functions and CTEs**
   - ✅ OVER, PARTITION BY, ROW_NUMBER, RANK, and running aggregates
   - ✅ Standard and recursive CTEs
   - ✅ Replacing brittle subqueries with clearer query structure
   - ✅ Temporal or reporting-style query patterns

5. **Indexes, statistics, and execution plans**
   - ✅ Clustered vs nonclustered indexes
   - ✅ Selectivity, covering indexes, and index maintenance trade-offs
   - ✅ Statistics and how the optimizer uses them
   - ✅ Estimated vs actual execution plans

6. **Transactions, isolation, locking, and deadlocks**
   - ✅ ACID basics and transaction scope
   - ✅ Isolation levels and row versioning
   - ✅ Locking behavior and blocking
   - ✅ Deadlocks, detection, and mitigation

7. **Query tuning, Query Store, and plan stability**
   - ✅ Query Store for regression detection and plan history
   - ✅ Parameter-sensitive plans and skewed data distributions
   - ✅ Baselines, workload comparisons, and targeted tuning
   - ✅ Knowing when to change SQL, indexes, or schema instead of forcing hints

8. **Database programmability and schema evolution**
   - ✅ Stored procedures, output parameters, and encapsulated database logic
   - ✅ Views and user-defined functions
   - ✅ Triggers and their trade-offs
   - ✅ Schema migrations, source control, reviewable SQL scripts, and release safety

9. **Backup, recovery, HA/DR, security, and temporal data**
   - ✅ Backup types, restore strategy, and recovery objectives
   - ✅ High availability and disaster recovery basics
   - ✅ Least privilege, roles, row-level security, and masking
   - ✅ Temporal tables, historical retention, and lifecycle management
