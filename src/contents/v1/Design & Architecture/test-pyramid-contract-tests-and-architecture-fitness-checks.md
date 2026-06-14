---
id: test-pyramid-contract-tests-and-architecture-fitness-checks
topic: Testing strategy, maintainability, and technical leadership
subtopic: Test pyramid, contract tests, and architecture fitness checks
category: Design & Architecture
---

## Overview

A testing strategy should provide fast, trustworthy feedback at the lowest practical cost while still verifying real system behavior.

The test pyramid is a heuristic:

- Many fast tests for focused behavior.
- Fewer integration tests for infrastructure and component boundaries.
- A small number of broad end-to-end tests for critical journeys.

Contract tests verify that independently developed consumers and providers agree on requests, responses, messages, and compatibility. Architecture fitness checks continuously verify important structural or quality constraints such as dependency direction, API compatibility, performance budgets, observability, and security controls.

No single test layer is sufficient:

- Unit tests can miss framework, database, serialization, and configuration problems.
- Integration tests can be slow and difficult to diagnose.
- End-to-end tests are realistic but costly and often flaky.
- Contract tests verify interfaces but not complete business workflows.
- Architecture checks verify constraints but do not prove functional correctness.

This topic matters in interviews because candidates must choose evidence according to risk, deployment boundaries, and feedback speed rather than maximizing test count or coverage percentage.

## Core Concepts

### The Test Pyramid

The pyramid emphasizes economics:

```text
          End-to-end
       Integration/contract
          Unit tests
```

Lower-level tests are usually:

- Faster.
- More isolated.
- Easier to diagnose.
- Cheaper to run frequently.

Higher-level tests cover more real integration but create more setup, latency, and failure ambiguity.

The shape can vary. A service with little domain logic and substantial infrastructure may need more integration tests. The principle is to push each assertion to the cheapest layer that can prove it.

### Unit Tests

A unit test verifies a focused unit of behavior without real external infrastructure.

```csharp
[Fact]
public void Approve_Rejects_An_Expense_Above_Manager_Limit()
{
    var expense = Expense.Submitted(amount: 15_000m);
    var manager = new Approver(limit: 10_000m);

    var result = expense.ApproveBy(manager);

    Assert.False(result.Succeeded);
    Assert.Equal(ExpenseStatus.Submitted, expense.Status);
}
```

Good unit tests:

- Test observable behavior.
- Are deterministic.
- Use meaningful examples and boundaries.
- Avoid implementation-detail assertions.
- Run in parallel when safe.

Do not mock every class. Excessive mocking couples tests to call sequences and makes refactoring expensive.

### Integration Tests

Integration tests verify real collaboration with:

- ASP.NET Core routing and middleware.
- Model binding and serialization.
- Databases.
- Brokers.
- Filesystems.
- Authentication.
- External service adapters.

ASP.NET Core supports application-level tests:

```csharp
public sealed class OrdersApiTests
    : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient client;

    public OrdersApiTests(WebApplicationFactory<Program> factory)
    {
        client = factory.CreateClient();
    }

    [Fact]
    public async Task Unknown_Order_Returns_NotFound()
    {
        var response = await client.GetAsync(
            "/api/orders/00000000-0000-0000-0000-000000000001");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
```

Use production-like dependencies where behavior matters. An in-memory substitute can differ in transactions, constraints, query translation, and concurrency.

### Functional and End-to-End Tests

Functional tests verify a service or feature from an external interface. End-to-end tests cross multiple deployed components.

Use them for:

- Critical user journeys.
- Authentication and authorization flows.
- Deployment wiring.
- Cross-service business workflows.
- Browser behavior.

Keep the suite small and high value. Broad tests should not duplicate every lower-level edge case.

### Test Trophy and Other Shapes

Frontend teams sometimes prefer a "test trophy" with many component or integration tests because isolated UI units offer limited confidence.

The name of the shape is less important than:

- Feedback speed.
- Realism.
- Diagnostic quality.
- Stability.
- Risk coverage.

Avoid enforcing arbitrary percentages per layer.

### Contract Tests

A contract test verifies an integration boundary without deploying every participant together.

Examples:

- HTTP request and response.
- Message schema and metadata.
- Error behavior.
- Required headers.
- Field optionality.
- Compatibility rules.

Contract tests do not prove:

- Provider internal correctness.
- Network policies.
- Complete workflows.
- Production configuration.
- Nonfunctional behavior.

They reduce the number of expensive multi-service tests needed for compatibility.

### Provider Contract Testing

Provider conformance checks that implementation matches a published contract such as OpenAPI:

```text
implementation response
    -> schema and status validation
    -> documented contract
```

This catches:

- Undocumented status codes.
- Missing required fields.
- Wrong content types.
- Schema drift.

It does not prove that current consumers use the provider correctly.

### Consumer-Driven Contract Testing

A consumer records the interactions it depends on. The provider verifies those expectations against its real implementation.

```text
consumer test -> contract artifact
contract artifact -> provider verification
verification result -> deployment compatibility
```

Benefits:

- Tests only behavior consumers use.
- Provides independent deployment confidence.
- Detects breaking provider changes early.

Risks:

- Stale or abandoned consumer contracts.
- Overly specific examples that prevent safe provider evolution.
- Provider state setup complexity.
- False confidence when production routing or auth differs.

### Message Contract Tests

Message contracts should verify:

- Type identifier.
- Schema version.
- Required and optional fields.
- Metadata.
- Serialization.
- Compatibility.
- Consumer assumptions.

Events can remain in queues or logs longer than one deployment. Test old messages against new consumers and new additive fields against old consumers.

### Contract Broker and Deployment Checks

A contract broker can store:

- Contract versions.
- Consumer and provider versions.
- Verification results.
- Environment deployments.

A deployment check should answer:

```text
Can provider version P deploy
given currently deployed consumer versions C1, C2, and C3?
```

Do not treat "all tests passed on the latest branch" as proof of compatibility with versions currently in production.

### Architecture Fitness Checks

A fitness function objectively evaluates whether architecture remains close to an intended quality.

Examples:

- Domain code must not depend on infrastructure.
- Public API changes remain backward compatible.
- No circular project references.
- P95 latency stays below a budget.
- Services expose health and telemetry.
- No plaintext secrets enter the repository.
- Deployment remains available during instance replacement.

Fitness checks can be:

- Automated or manual.
- Continuous or periodic.
- Static or dynamic.
- Atomic or holistic.

Automate stable, important rules that are otherwise easy to regress.

### Dependency Architecture Tests

Example using an architecture-testing library:

```csharp
[Fact]
public void Domain_Does_Not_Depend_On_Infrastructure()
{
    var result = Types.InAssembly(typeof(Order).Assembly)
        .ShouldNot()
        .HaveDependencyOn("Ordering.Infrastructure")
        .GetResult();

    Assert.True(result.IsSuccessful);
}
```

Useful rules:

- Domain has no web or persistence dependency.
- Features do not access another feature's internal namespace.
- Controllers depend on application abstractions.
- Only approved assemblies reference sensitive packages.

Test rules that reflect actual architecture decisions, not cosmetic preferences.

### Dynamic Fitness Checks

Some qualities require running systems:

```text
deployment under load -> error rate below threshold
dependency latency injected -> checkout degrades safely
API compatibility check -> no breaking change
security scan -> no prohibited severity
```

Run expensive checks at appropriate pipeline stages rather than on every local edit.

### Test Boundaries and Ownership

Assign tests to the team that owns the behavior:

- Domain team owns business-rule tests.
- Provider owns provider verification.
- Consumer owns consumer expectations.
- Platform team can provide reusable fitness tooling.
- Product team owns critical journey tests.

A central QA team cannot compensate for missing engineering ownership.

### Test Data

Reliable tests need:

- Isolated data.
- Deterministic identifiers and clocks.
- Explicit setup.
- Cleanup or disposable environments.
- No dependence on execution order.

Use builders and fixtures to express meaningful scenarios. Avoid giant shared fixtures where one mutation breaks unrelated tests.

### Test Doubles

Types include:

- Stub: returns controlled data.
- Fake: lightweight working implementation.
- Mock: verifies interactions.
- Spy: records calls.

Use doubles at boundaries under your control. Do not fake a database when the purpose is to verify database semantics.

### Flaky Tests

A flaky test gives inconsistent results without a relevant product change.

Causes:

- Timing assumptions.
- Shared state.
- Randomness.
- Network dependencies.
- Order dependence.
- Incomplete cleanup.

Quarantine only temporarily with an owner and deadline. Retrying flaky tests hides lost confidence.

### Code Coverage

Coverage identifies unexecuted code but does not measure assertion quality.

Use it to:

- Find risk areas with no tests.
- Prevent large unexplained regressions.
- Guide discussion.

Do not optimize for a percentage by adding low-value tests. Mutation testing can reveal whether tests detect behavioral changes.

### CI Test Stages

A practical pipeline:

```text
compile and static checks
  -> unit and architecture tests
  -> component integration tests
  -> contract verification
  -> selected end-to-end and performance checks
```

Fast failures should occur early. Parallelize independent suites and publish diagnostics.

### Common Mistakes

Common failures include:

- Treating the pyramid as a fixed ratio.
- Mocking implementation details.
- Using an in-memory database for all persistence confidence.
- Relying only on end-to-end tests.
- Contract-testing schemas but not behavior.
- Keeping stale consumer contracts.
- Writing architecture checks for arbitrary layering.
- Quarantining flaky tests indefinitely.
- Chasing coverage rather than risk.
- Running tests that do not fail when behavior breaks.

### Best-Practice Strategy

1. Identify product, integration, and architectural risks.
2. Put each assertion at the cheapest credible layer.
3. Use real infrastructure where semantics matter.
4. Keep critical end-to-end journeys few and stable.
5. Contract-test independently deployable boundaries.
6. Verify deployed version compatibility.
7. Automate important architecture constraints.
8. Control test data, time, and concurrency.
9. Treat flaky tests as defects.
10. Measure suite duration, failure usefulness, and escaped defects.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the test pyramid?

<!-- question:start:test-pyramid-contract-tests-and-architecture-fitness-checks-beginner-q01 -->
<!-- question-id:test-pyramid-contract-tests-and-architecture-fitness-checks-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

The test pyramid recommends many fast focused tests, fewer infrastructure integration tests, and a small number of broad end-to-end tests. It is a feedback-cost heuristic, not a required ratio. Each behavior should be tested at the lowest layer that can prove it reliably.

##### Key Points to Mention

- Lower tests are faster and easier to diagnose.
- Higher tests provide more integration realism.
- System shape can justify a different distribution.
- Avoid duplicating every scenario at every layer.

<!-- question:end:test-pyramid-contract-tests-and-architecture-fitness-checks-beginner-q01 -->

#### What is the difference between unit and integration tests?

<!-- question:start:test-pyramid-contract-tests-and-architecture-fitness-checks-beginner-q02 -->
<!-- question-id:test-pyramid-contract-tests-and-architecture-fitness-checks-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A unit test verifies focused behavior without real external infrastructure. An integration test verifies collaboration with framework or infrastructure components such as routing, serialization, databases, brokers, or filesystems. Integration tests are slower but catch problems isolated tests cannot.

##### Key Points to Mention

- Test behavior, not private implementation.
- Use real dependencies when their semantics are the subject.
- Unit tests should remain deterministic.
- Both layers serve different risks.

<!-- question:end:test-pyramid-contract-tests-and-architecture-fitness-checks-beginner-q02 -->

#### What is a contract test?

<!-- question:start:test-pyramid-contract-tests-and-architecture-fitness-checks-beginner-q03 -->
<!-- question-id:test-pyramid-contract-tests-and-architecture-fitness-checks-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A contract test verifies that a consumer and provider agree on an integration interface such as HTTP requests and responses or messages. It can validate provider conformance to a specification or consumer expectations against a real provider implementation without deploying the entire system.

##### Key Points to Mention

- Contracts enable independent deployment confidence.
- They complement rather than replace integration tests.
- Version compatibility must be tracked.
- Message contracts need evolution tests.

<!-- question:end:test-pyramid-contract-tests-and-architecture-fitness-checks-beginner-q03 -->

#### What is an architecture fitness check?

<!-- question:start:test-pyramid-contract-tests-and-architecture-fitness-checks-beginner-q04 -->
<!-- question-id:test-pyramid-contract-tests-and-architecture-fitness-checks-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

It is an objective check that verifies an architectural quality or constraint, such as dependency direction, API compatibility, performance, security, resilience, or observability. It provides continuous feedback and detects architectural drift.

##### Key Points to Mention

- Checks can be static or dynamic.
- Automate stable high-value rules.
- Tie checks to explicit architecture goals.
- Not every architectural judgment can be automated.

<!-- question:end:test-pyramid-contract-tests-and-architecture-fitness-checks-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you test an ASP.NET Core API effectively?

<!-- question:start:test-pyramid-contract-tests-and-architecture-fitness-checks-intermediate-q01 -->
<!-- question-id:test-pyramid-contract-tests-and-architecture-fitness-checks-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Unit-test domain and application policies, use `WebApplicationFactory` integration tests for routing, middleware, authentication, serialization, and persistence, contract-test external interfaces, and retain a small set of end-to-end journeys. Use disposable production-like infrastructure for database behavior.

##### Key Points to Mention

- Controller unit tests do not exercise the web pipeline.
- Test authorization and failure paths.
- Keep test data isolated.
- Run fast suites on every change.

<!-- question:end:test-pyramid-contract-tests-and-architecture-fitness-checks-intermediate-q01 -->

#### How do consumer-driven contract tests support independent deployment?

<!-- question:start:test-pyramid-contract-tests-and-architecture-fitness-checks-intermediate-q02 -->
<!-- question-id:test-pyramid-contract-tests-and-architecture-fitness-checks-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Consumers publish executable examples of the interactions they require. Providers verify each active contract against their implementation. A broker records verification and deployment versions so the pipeline can determine whether a new consumer or provider is compatible with versions currently deployed.

##### Key Points to Mention

- Consumers own their expectations.
- Providers need reproducible state setup.
- Remove abandoned contracts.
- Avoid overspecifying irrelevant response details.

<!-- question:end:test-pyramid-contract-tests-and-architecture-fitness-checks-intermediate-q02 -->

#### What architecture rules are good candidates for automated checks?

<!-- question:start:test-pyramid-contract-tests-and-architecture-fitness-checks-intermediate-q03 -->
<!-- question-id:test-pyramid-contract-tests-and-architecture-fitness-checks-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Automate objective, important, repeatable constraints: dependency direction, forbidden references, cycles, API breaking changes, required observability, secret scanning, package policies, latency budgets, or deployment availability. Avoid tests that encode naming preferences or freeze a design that should evolve.

##### Key Points to Mention

- A failing check should explain remediation.
- Align checks with ADRs and quality attributes.
- Run checks at an appropriate frequency.
- Review rules when architecture changes.

<!-- question:end:test-pyramid-contract-tests-and-architecture-fitness-checks-intermediate-q03 -->

#### How should flaky tests be handled?

<!-- question:start:test-pyramid-contract-tests-and-architecture-fitness-checks-intermediate-q04 -->
<!-- question-id:test-pyramid-contract-tests-and-architecture-fitness-checks-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Treat flakiness as a defect. Capture diagnostics, reproduce the timing or shared-state issue, and fix isolation, clocks, cleanup, or dependencies. Temporary quarantine needs an owner and deadline. Automatic retry may collect evidence but should not make an unreliable suite appear healthy.

##### Key Points to Mention

- Flaky tests destroy trust in CI.
- Track flake rate and affected suites.
- Eliminate order and timing assumptions.
- Prefer deterministic fakes for nondeterministic external conditions.

<!-- question:end:test-pyramid-contract-tests-and-architecture-fitness-checks-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you redesign a slow end-to-end-heavy test suite?

<!-- question:start:test-pyramid-contract-tests-and-architecture-fitness-checks-advanced-q01 -->
<!-- question-id:test-pyramid-contract-tests-and-architecture-fitness-checks-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Classify failures and scenarios by risk, move business rules into focused tests, replace service compatibility paths with contract tests, and use component tests with real local infrastructure. Keep only critical cross-system journeys end to end. Parallelize isolated suites and measure duration, flakiness, and escaped defects during migration.

##### Key Points to Mention

- Do not delete coverage before replacing evidence.
- Preserve deployment and configuration checks.
- Test boundaries independently.
- Improve failure diagnostics with the suite structure.

<!-- question:end:test-pyramid-contract-tests-and-architecture-fitness-checks-advanced-q01 -->

#### How do contract tests differ from schema validation?

<!-- question:start:test-pyramid-contract-tests-and-architecture-fitness-checks-advanced-q02 -->
<!-- question-id:test-pyramid-contract-tests-and-architecture-fitness-checks-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Schema validation checks structural conformance, such as field types and required properties. Behavioral contract tests exercise concrete interactions, status codes, headers, provider states, and consumer assumptions. Both are useful: schema checks provide broad shape coverage, while executable contracts verify behavior consumers actually rely on.

##### Key Points to Mention

- Valid schema can still have wrong semantics.
- Contracts should permit irrelevant provider flexibility.
- Error behavior is part of the contract.
- Production routing and security still require integration testing.

<!-- question:end:test-pyramid-contract-tests-and-architecture-fitness-checks-advanced-q02 -->

#### How would you govern architecture fitness checks across many teams?

<!-- question:start:test-pyramid-contract-tests-and-architecture-fitness-checks-advanced-q03 -->
<!-- question-id:test-pyramid-contract-tests-and-architecture-fitness-checks-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Define a small set of organization-wide outcomes, provide reusable tooling and sensible defaults, and let teams add domain-specific checks. Version rules, make failures actionable, support justified exceptions with expiry, and review whether checks improve risk and flow. Avoid a central gate that encodes every local design choice.

##### Key Points to Mention

- Platform teams provide paved roads.
- Product teams retain architecture ownership.
- Exceptions need rationale and follow-up.
- Measure false positives and delivery impact.

<!-- question:end:test-pyramid-contract-tests-and-architecture-fitness-checks-advanced-q03 -->

#### How would you measure whether a testing strategy is effective?

<!-- question:start:test-pyramid-contract-tests-and-architecture-fitness-checks-advanced-q04 -->
<!-- question-id:test-pyramid-contract-tests-and-architecture-fitness-checks-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Track escaped defects by class, change failure rate, detection time, suite duration, flake rate, failure diagnostic time, contract incompatibilities caught before deployment, and developer feedback. Coverage can identify gaps but should not be the primary outcome. Adjust investment toward recurring high-impact failures.

##### Key Points to Mention

- Test count is not a quality metric.
- Fast trustworthy feedback supports frequent delivery.
- Production incidents reveal missing evidence.
- Delete redundant low-value tests.

<!-- question:end:test-pyramid-contract-tests-and-architecture-fitness-checks-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
