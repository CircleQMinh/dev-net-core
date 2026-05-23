---
id: code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution
topic: Testing strategy and integration testing
subtopic: Code Coverage, Useful Assertions, Flaky Test Prevention, and CI Test Execution
category: .NET
---


## Overview

Code coverage, assertions, flaky test prevention, and CI test execution are core parts of a practical testing strategy. They help teams understand how much code is exercised, whether tests verify meaningful behavior, whether test results are trustworthy, and whether automated checks can protect the codebase during pull requests and deployments.

Code coverage measures which parts of the code run during tests. It can show lines, branches, methods, and sometimes conditions covered by tests. However, coverage only tells whether code was executed. It does not prove that the test checked the right behavior. A test can execute many lines and still assert almost nothing useful.

Useful assertions are what make tests valuable. Good assertions check observable behavior, outputs, state changes, HTTP responses, database effects, events, exceptions, logs when relevant, and important boundary cases. Weak assertions only check that code does not throw or that a response is `200 OK` without verifying the actual result.

Flaky tests are tests that sometimes pass and sometimes fail without a relevant code change. They are dangerous because they reduce trust in the test suite. Once developers believe CI is unreliable, they may ignore real failures. Flaky tests are common in integration and end-to-end tests, but they can also happen in unit tests when tests depend on time, randomness, shared state, parallel execution, external services, or ordering.

CI test execution is the process of running tests automatically in a continuous integration pipeline. A good CI pipeline restores dependencies, builds the solution, runs tests, collects test results, collects code coverage, publishes reports, enforces quality gates, and provides useful failure diagnostics. A poor CI pipeline is slow, unreliable, hard to debug, or too easy to bypass.

This topic matters because automated tests are only useful when they are trustworthy. Interviewers often ask:

- What does code coverage measure?
- Is high code coverage always good?
- What is the difference between line coverage and branch coverage?
- What makes an assertion useful?
- How do you avoid brittle assertions?
- What is a flaky test?
- How do you prevent flaky tests?
- Should CI retry failed tests?
- How do you run .NET tests in CI?
- How do you publish TRX and coverage reports?
- How do you decide which tests run on every pull request?
- How do you make integration and E2E tests reliable in CI?
- How do you handle slow test suites?

A strong answer should explain that coverage is a signal, not a goal by itself. Good tests assert meaningful behavior. CI should fail for real problems, produce useful diagnostics, and keep the feedback loop fast enough for developers to trust it.

## Core Concepts

### What Code Coverage Means

Code coverage measures how much production code was executed by tests.

Common coverage types:

| Coverage Type | Meaning |
|---|---|
| Line coverage | Percentage of executable lines run by tests |
| Branch coverage | Percentage of decision branches run by tests |
| Method coverage | Percentage of methods called by tests |
| Statement coverage | Percentage of statements executed |
| Condition coverage | Percentage of boolean conditions evaluated in different ways |
| Path coverage | Percentage of possible execution paths covered |

Example:

```csharp
public decimal CalculateDiscount(decimal total)
{
    if (total >= 1000)
    {
        return total * 0.10m;
    }

    return total * 0.02m;
}
```

A test that checks only `total = 1500` executes the `true` branch but not the `false` branch. Line coverage may look decent, but branch coverage shows that one path is missing.

Better tests:

```csharp
public sealed class DiscountCalculatorTests
{
    [Fact]
    public void CalculateDiscount_WhenTotalIsAtLeast1000_ReturnsTenPercent()
    {
        var calculator = new DiscountCalculator();

        var discount = calculator.CalculateDiscount(1500m);

        Assert.Equal(150m, discount);
    }

    [Fact]
    public void CalculateDiscount_WhenTotalIsLessThan1000_ReturnsTwoPercent()
    {
        var calculator = new DiscountCalculator();

        var discount = calculator.CalculateDiscount(500m);

        Assert.Equal(10m, discount);
    }
}
```

These tests cover both branches and verify the expected behavior.

### What Code Coverage Does Not Prove

Code coverage does not prove correctness.

A test can have high coverage but poor assertions.

Bad test:

```csharp
[Fact]
public void CalculateDiscount_DoesNotThrow()
{
    var calculator = new DiscountCalculator();

    calculator.CalculateDiscount(1500m);
}
```

This test executes code but does not verify the result.

Another weak test:

```csharp
[Fact]
public void CalculateDiscount_ReturnsSomeValue()
{
    var calculator = new DiscountCalculator();

    var result = calculator.CalculateDiscount(1500m);

    Assert.True(result >= 0);
}
```

This assertion is too broad. Many wrong implementations would pass.

Better:

```csharp
[Fact]
public void CalculateDiscount_WhenTotalIs1500_Returns150()
{
    var calculator = new DiscountCalculator();

    var result = calculator.CalculateDiscount(1500m);

    Assert.Equal(150m, result);
}
```

Coverage tells you what was executed. Assertions tell you whether the behavior was verified.

### Line Coverage vs Branch Coverage

Line coverage measures whether lines executed.

Branch coverage measures whether decision paths executed.

Example:

```csharp
public string GetRiskLevel(int score)
{
    if (score >= 80)
    {
        return "High";
    }

    return "Normal";
}
```

One test:

```csharp
[Fact]
public void GetRiskLevel_WhenScoreIs90_ReturnsHigh()
{
    var service = new RiskService();

    var result = service.GetRiskLevel(90);

    Assert.Equal("High", result);
}
```

This test may cover most lines, but it covers only one branch. It does not check the `Normal` path.

Add another test:

```csharp
[Fact]
public void GetRiskLevel_WhenScoreIs50_ReturnsNormal()
{
    var service = new RiskService();

    var result = service.GetRiskLevel(50);

    Assert.Equal("Normal", result);
}
```

Branch coverage is often more useful than line coverage for business logic because it reveals untested decision paths.

### Coverage Thresholds

A coverage threshold is a minimum coverage percentage required by the build.

Example goals:

```text
Line coverage >= 80%
Branch coverage >= 70%
No decrease in coverage for changed code
Critical modules >= 90%
```

Coverage thresholds can be useful, but they can also be harmful if used blindly.

Benefits:

- Prevents coverage from silently dropping.
- Encourages testing new code.
- Gives a measurable quality signal.
- Helps identify untested areas.
- Makes test discipline visible in CI.

Risks:

- Developers may write shallow tests just to satisfy a percentage.
- High coverage can create false confidence.
- Some code is hard or low-value to test directly.
- Generated code can distort metrics.
- Integration code may be covered differently from domain logic.
- Teams may optimize for numbers instead of risk reduction.

A good strategy is to use coverage thresholds as a guardrail, not as the only measure of test quality.

### Meaningful Coverage Targets

Not all code deserves the same coverage target.

High coverage is valuable for:

- Domain rules.
- Financial calculations.
- Authorization rules.
- Validation logic.
- Security-sensitive code.
- Complex branching logic.
- Data transformations.
- Error handling.
- Public API contract behavior.
- Regression-prone areas.

Lower direct coverage may be acceptable for:

- Simple DTOs.
- Auto-generated code.
- Thin framework glue.
- Configuration-only code.
- Boilerplate.
- Migrations.
- UI layout details.
- Code better verified through integration tests.

A mature testing strategy focuses coverage expectations by risk.

Example:

```text
Payment calculation: high branch coverage expected.
DTO property class: no direct unit test required.
Controller routing: integration test preferred.
External gateway adapter: fake/mocked unit tests plus contract/integration tests.
```

### Collecting Code Coverage in .NET

A common .NET approach is to use `dotnet test` with Coverlet's cross-platform coverage collector.

Command:

```bash
dotnet test --collect:"XPlat Code Coverage"
```

This produces coverage output, commonly in Cobertura XML format, under a `TestResults` directory.

You can also produce TRX test results:

```bash
dotnet test \
  --configuration Release \
  --logger "trx" \
  --results-directory ./TestResults \
  --collect:"XPlat Code Coverage"
```

A test project usually references packages like:

```xml
<ItemGroup>
  <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.0" />
  <PackageReference Include="coverlet.collector" Version="6.0.4" />
  <PackageReference Include="xunit" Version="2.9.3" />
  <PackageReference Include="xunit.runner.visualstudio" Version="3.1.1" />
</ItemGroup>
```

Package versions change over time, so keep them aligned with the SDK and test framework version used by the project.

### Generating Human-Readable Coverage Reports

Raw coverage XML is useful for tools, but developers usually need readable reports.

A common tool is ReportGenerator.

Install:

```bash
dotnet tool install --global dotnet-reportgenerator-globaltool
```

Generate report:

```bash
reportgenerator \
  -reports:"./TestResults/**/coverage.cobertura.xml" \
  -targetdir:"./CoverageReport" \
  -reporttypes:"Html;Cobertura"
```

This can produce:

- HTML report for local review.
- Cobertura XML for CI systems.
- Summary reports.
- Badges or history if configured.

A useful coverage workflow is:

1. Run tests.
2. Collect coverage.
3. Generate a report.
4. Publish the report in CI.
5. Enforce reasonable thresholds.
6. Review uncovered high-risk areas.

### Excluding Code from Coverage

Some code may be excluded from coverage when direct testing provides little value.

Example:

```csharp
using System.Diagnostics.CodeAnalysis;

[ExcludeFromCodeCoverage]
public sealed class GeneratedDto
{
    public string Name { get; set; } = string.Empty;
}
```

Common exclusions:

- Generated code.
- Designer files.
- Simple DTOs.
- Migrations.
- Program startup boilerplate, depending on strategy.
- Code covered indirectly through integration tests but noisy in unit coverage.
- Third-party generated clients.

Use exclusions carefully. Do not exclude difficult code just to improve coverage numbers.

### Useful Assertions

An assertion should verify behavior that matters.

Useful assertions check:

- Return values.
- State changes.
- Exceptions.
- Error messages when part of the contract.
- HTTP status codes.
- Response bodies.
- Response headers.
- Database effects.
- Published events.
- Calls to important dependencies.
- Logs when logs are part of the operational contract.
- Time-sensitive behavior through a fake clock.
- Authorization outcomes.
- Validation errors.
- Idempotency behavior.
- Boundary cases.

Example service:

```csharp
public sealed class OrderService
{
    public Order Submit(Order order)
    {
        if (order.Lines.Count == 0)
        {
            throw new InvalidOperationException("An order must have at least one line.");
        }

        order.Status = OrderStatus.Submitted;
        order.SubmittedAtUtc = DateTime.UtcNow;

        return order;
    }
}
```

Weak test:

```csharp
[Fact]
public void Submit_WithValidOrder_DoesNotThrow()
{
    var service = new OrderService();
    var order = OrderFactory.CreateValid();

    service.Submit(order);
}
```

Better test:

```csharp
[Fact]
public void Submit_WithValidOrder_MarksOrderAsSubmitted()
{
    var service = new OrderService();
    var order = OrderFactory.CreateValid();

    var result = service.Submit(order);

    Assert.Equal(OrderStatus.Submitted, result.Status);
    Assert.NotNull(result.SubmittedAtUtc);
}
```

Good tests should fail when important behavior breaks.

### Arrange-Act-Assert

The Arrange-Act-Assert pattern gives tests a clear structure.

```csharp
[Fact]
public void ApplyDiscount_WhenCustomerIsPremium_AppliesPremiumDiscount()
{
    // Arrange
    var calculator = new DiscountCalculator();
    var customer = new Customer
    {
        IsPremium = true
    };

    // Act
    var discount = calculator.ApplyDiscount(customer, 100m);

    // Assert
    Assert.Equal(15m, discount);
}
```

Benefits:

- Easy to read.
- Separates setup from behavior from verification.
- Helps avoid multiple actions in one test.
- Makes failures easier to diagnose.
- Supports consistent test style.

For very small tests, comments may not be necessary, but the structure should still be visible.

### Assert One Behavior, Not Always One Assertion

A common guideline says one test should verify one behavior. This does not always mean one assertion.

Example:

```csharp
[Fact]
public async Task CreateOrder_WithValidRequest_ReturnsCreatedOrder()
{
    using var client = _factory.CreateClient();

    var response = await client.PostAsJsonAsync("/api/orders", new
    {
        CustomerId = 1,
        ProductId = 10,
        Quantity = 2
    });

    Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);

    var body = await response.Content.ReadFromJsonAsync<OrderDto>();

    Assert.NotNull(body);
    Assert.Equal(1, body.CustomerId);
    Assert.Equal(10, body.ProductId);
    Assert.Equal(2, body.Quantity);
}
```

This test has several assertions, but they all verify one behavior: creating an order returns the expected HTTP response.

Avoid unrelated assertions in the same test.

Bad:

```csharp
[Fact]
public async Task OrderApi_Works()
{
    // Tests create, update, delete, permissions, validation, and email sending.
}
```

This is hard to debug and maintain.

### Assertion Specificity

Assertions should be specific enough to catch real bugs.

Weak:

```csharp
Assert.NotNull(result);
```

Better:

```csharp
Assert.Equal("Submitted", result.Status);
Assert.Equal(3, result.LineCount);
Assert.Equal(120.50m, result.Total);
```

Weak:

```csharp
Assert.True(response.IsSuccessStatusCode);
```

Better:

```csharp
Assert.Equal(HttpStatusCode.Created, response.StatusCode);
Assert.Equal("/api/orders/123", response.Headers.Location?.OriginalString);
```

Weak:

```csharp
Assert.Contains("error", body);
```

Better:

```csharp
var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();

Assert.NotNull(problem);
Assert.True(problem.Errors.ContainsKey("Email"));
Assert.Contains("Email is required.", problem.Errors["Email"]);
```

Specific assertions make failures more useful.

### Avoiding Over-Specified Assertions

Assertions can also be too specific.

Over-specified tests check implementation details instead of behavior.

Example:

```csharp
mockRepository.Verify(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()), Times.Once);
mockRepository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
mockLogger.Verify(l => l.Log(...), Times.Once);
```

This may be useful for some tests, but if every test verifies internal calls, refactoring becomes painful.

Prefer behavior assertions:

```csharp
Assert.Equal(OrderStatus.Submitted, order.Status);
```

Use interaction verification when the interaction is the behavior.

Good examples for interaction verification:

- Email was sent.
- Message was published.
- Payment gateway was called.
- Cache invalidation happened.
- Audit log was written.
- Repository save was required by the use case.

Avoid verifying every internal method call just because mocking makes it possible.

### Testing Exceptions

Good exception tests verify the type and sometimes the message or properties if they are part of the contract.

Example:

```csharp
[Fact]
public void Submit_WhenOrderHasNoLines_ThrowsInvalidOperationException()
{
    var service = new OrderService();
    var order = new Order();

    var exception = Assert.Throws<InvalidOperationException>(
        () => service.Submit(order));

    Assert.Equal("An order must have at least one line.", exception.Message);
}
```

For async methods:

```csharp
[Fact]
public async Task SubmitAsync_WhenOrderDoesNotExist_ThrowsNotFoundException()
{
    var service = CreateService();

    var exception = await Assert.ThrowsAsync<NotFoundException>(
        () => service.SubmitAsync(999, CancellationToken.None));

    Assert.Equal("Order was not found.", exception.Message);
}
```

Avoid catching exceptions manually unless needed.

Bad:

```csharp
try
{
    service.Submit(order);
}
catch
{
    Assert.True(true);
}
```

This can pass for the wrong exception type.

### Testing Collections

For collections, assert both count and content when relevant.

Example:

```csharp
Assert.Collection(result,
    first =>
    {
        Assert.Equal("Alice", first.Name);
        Assert.Equal("Admin", first.Role);
    },
    second =>
    {
        Assert.Equal("Bob", second.Name);
        Assert.Equal("User", second.Role);
    });
```

If order does not matter:

```csharp
Assert.Contains(result, user => user.Email == "alice@example.com");
Assert.Contains(result, user => user.Email == "bob@example.com");
Assert.Equal(2, result.Count);
```

Avoid relying on ordering unless ordering is part of the contract.

Bad:

```csharp
Assert.Equal("Alice", result[0].Name);
```

Good if ordering is intentional:

```csharp
Assert.Equal(
    ["Alice", "Bob", "Charlie"],
    result.Select(user => user.Name).ToArray());
```

### Testing HTTP APIs with Useful Assertions

For API tests, useful assertions often include:

- Status code.
- Content type.
- Response DTO.
- Validation errors.
- Headers.
- Cookies.
- Database state.
- Side effects.
- Authorization behavior.

Example:

```csharp
[Fact]
public async Task CreateProduct_WhenRequestIsInvalid_ReturnsValidationProblemDetails()
{
    using var client = _factory.CreateClient();

    var response = await client.PostAsJsonAsync("/api/products", new
    {
        Name = "",
        Price = -1
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

    var problem = await response.Content
        .ReadFromJsonAsync<ValidationProblemDetails>();

    Assert.NotNull(problem);
    Assert.Contains("Name", problem.Errors.Keys);
    Assert.Contains("Price", problem.Errors.Keys);
}
```

This is more useful than:

```csharp
Assert.False(response.IsSuccessStatusCode);
```

### Snapshot Testing

Snapshot testing compares output against a stored approved result.

It can be useful for:

- Large JSON responses.
- Generated documents.
- UI component output.
- API contract snapshots.
- Complex serialization output.

Benefits:

- Easy to verify large outputs.
- Helps detect unexpected changes.
- Useful for contract-like responses.

Risks:

- Snapshots can become too large.
- Developers may approve changes without reviewing them.
- Snapshots can include unstable data.
- Tests can be brittle if output changes frequently.
- Snapshots are poor for behavior that needs targeted assertions.

Best practice:

- Normalize dynamic values.
- Keep snapshots focused.
- Review snapshot diffs carefully.
- Combine snapshots with targeted assertions.
- Avoid snapshotting huge unrelated objects.

### Flaky Tests

A flaky test is a test that sometimes passes and sometimes fails without a relevant code change.

Common causes:

| Cause | Example |
|---|---|
| Time dependency | Test expects current date/time |
| Randomness | Test uses random data without controlling seed |
| Shared state | Tests modify same database rows |
| Test order dependency | Test B depends on Test A |
| Parallel execution | Tests interfere when run together |
| Async race condition | Test asserts before async work finishes |
| Threading bug | Non-thread-safe shared object |
| External service dependency | Real API is slow or unavailable |
| Network instability | E2E test depends on unstable network |
| UI timing | Element not ready yet |
| Hard waits | `Task.Delay` or fixed sleeps |
| Resource limits | CI has less CPU/memory than local machine |
| Time zones | Local and CI use different time zones |
| Culture settings | Parsing/formatting differs by culture |
| File system dependency | Tests use same file path |
| Port conflicts | Tests bind same port |
| Caching | Shared cache state leaks between tests |

Flaky tests are dangerous because they reduce trust in CI.

### Preventing Flaky Unit Tests

Unit tests should be deterministic.

Avoid:

```csharp
[Fact]
public void Token_IsNotExpired()
{
    var token = new Token
    {
        ExpiresAtUtc = DateTime.UtcNow.AddMinutes(5)
    };

    Assert.True(token.ExpiresAtUtc > DateTime.UtcNow);
}
```

Better: inject time.

```csharp
public sealed class TokenService
{
    private readonly TimeProvider _timeProvider;

    public TokenService(TimeProvider timeProvider)
    {
        _timeProvider = timeProvider;
    }

    public bool IsExpired(Token token)
    {
        return token.ExpiresAtUtc <= _timeProvider.GetUtcNow();
    }
}
```

Test:

```csharp
[Fact]
public void IsExpired_WhenTokenExpiresBeforeNow_ReturnsTrue()
{
    var timeProvider = new FakeTimeProvider(
        new DateTimeOffset(2026, 5, 17, 10, 0, 0, TimeSpan.Zero));

    var service = new TokenService(timeProvider);

    var token = new Token
    {
        ExpiresAtUtc = new DateTimeOffset(2026, 5, 17, 9, 59, 0, TimeSpan.Zero)
    };

    var result = service.IsExpired(token);

    Assert.True(result);
}
```

Other unit test stability practices:

- Avoid real time.
- Avoid uncontrolled randomness.
- Avoid real network.
- Avoid shared static mutable state.
- Avoid file paths shared by tests.
- Avoid relying on test order.
- Use deterministic data.
- Use explicit cultures/time zones where relevant.
- Keep tests small and isolated.

### Preventing Flaky Integration Tests

Integration tests commonly fail due to shared state or environment differences.

Best practices:

- Use a clean database or reset database state.
- Seed deterministic test data.
- Avoid depending on test order.
- Disable parallelization for tests sharing mutable resources.
- Use unique names/IDs per test.
- Replace external services with fakes or test containers.
- Use `TimeProvider` or a fake clock.
- Avoid real queues unless the test is specifically about queue integration.
- Wait for eventual consistency with bounded polling, not fixed sleeps.
- Capture logs and test output on failure.
- Clean up files, containers, and database state.
- Avoid global mutable configuration.
- Use realistic providers for database behavior.

Example bounded polling:

```csharp
public static async Task EventuallyAsync(
    Func<Task<bool>> condition,
    TimeSpan timeout,
    TimeSpan interval)
{
    var deadline = DateTimeOffset.UtcNow.Add(timeout);

    while (DateTimeOffset.UtcNow < deadline)
    {
        if (await condition())
        {
            return;
        }

        await Task.Delay(interval);
    }

    throw new TimeoutException("Condition was not met before timeout.");
}
```

Use this for eventual asynchronous side effects, not for ordinary synchronous logic.

### Preventing Flaky E2E Tests

E2E tests are often flaky because real UI and browser behavior is asynchronous.

Good practices:

- Prefer stable locators.
- Use role/text/test-id locators instead of brittle CSS when possible.
- Use web-first assertions.
- Avoid fixed sleeps.
- Wait for meaningful UI state.
- Avoid relying on animation timing.
- Avoid relying on test order.
- Isolate test users and test data.
- Reset backend state.
- Keep E2E tests short and focused.
- Run fewer critical E2E tests rather than many brittle workflows.
- Capture trace, screenshot, video, and console/network logs on failure.
- Configure CI workers based on available CPU.
- Use browser/container versions consistently.
- Avoid testing third-party systems directly in normal E2E runs.

Bad Playwright-style example:

```typescript
await page.click('#submit');
await page.waitForTimeout(3000);
expect(await page.isVisible('.success')).toBeTruthy();
```

Better:

```typescript
await page.getByRole('button', { name: 'Submit' }).click();

await expect(page.getByText('Order submitted successfully')).toBeVisible();
```

A web-first assertion waits for the expected UI condition instead of sleeping for a fixed time.

### Retries and Flaky Tests

Retries can reduce noise, especially for E2E tests, but they can also hide real problems.

Benefits of retries:

- Reduces temporary CI noise.
- Helps with rare infrastructure issues.
- Gives time to collect trace/video on retry.
- Can keep deployment pipelines moving.

Risks:

- Masks real bugs.
- Normalizes instability.
- Makes test results harder to trust.
- Increases test duration.
- Delays root-cause analysis.
- Can let flaky tests remain for months.

A good retry policy:

- Avoid retries for unit tests.
- Use limited retries for E2E tests if needed.
- Track flaky tests separately.
- Do not treat "passed after retry" as fully healthy.
- Fail or alert on repeated flaky tests.
- Quarantine only with ownership and expiry.
- Fix or delete unreliable tests.

Example Playwright configuration:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

This captures useful diagnostics when a retry happens.

### Quarantining Flaky Tests

Quarantining means temporarily separating known flaky tests from the required CI gate.

It should be a controlled process, not a hiding place.

Good quarantine policy:

- Create a ticket for every quarantined test.
- Assign an owner.
- Record the reason.
- Set an expiry date.
- Run quarantined tests separately.
- Track failure rate.
- Fix, rewrite, or delete the test.
- Do not allow indefinite quarantine.

Bad quarantine policy:

```text
Move flaky tests to ignored category forever.
```

This reduces confidence and creates test debt.

### Useful Failure Diagnostics

CI failures should provide enough information to debug quickly.

Useful artifacts:

- TRX test result files.
- JUnit XML files.
- Coverage reports.
- Console logs.
- Application logs.
- Screenshots.
- Playwright traces.
- Videos.
- Browser console logs.
- Network logs.
- Database logs.
- Container logs.
- Test output files.
- Failed request/response payloads.
- Environment details.
- Random seed values.
- Correlation IDs.

A failure that says only "test failed" is not enough.

A useful failure should answer:

- Which test failed?
- What was expected?
- What was actual?
- What input was used?
- What environment ran the test?
- What logs are available?
- What screenshot or trace exists?
- Was this a first-run failure or retry success?
- Did the failure happen before or after deployment?

### CI Test Execution

A CI pipeline should run tests automatically on pull requests and important branches.

A typical .NET CI flow:

```text
checkout
setup .NET SDK
restore
build
run unit tests
run integration tests
collect test results
collect coverage
publish reports
enforce quality gates
upload failure artifacts
```

Example GitHub Actions workflow:

```yaml
name: build-and-test

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.0.x'

      - name: Restore
        run: dotnet restore

      - name: Build
        run: dotnet build --configuration Release --no-restore

      - name: Test
        run: |
          dotnet test \
            --configuration Release \
            --no-build \
            --logger "trx;LogFileName=test-results.trx" \
            --results-directory ./TestResults \
            --collect:"XPlat Code Coverage"

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: ./TestResults
```

This keeps test results available even when tests fail.

### Azure Pipelines Test Execution

Example Azure Pipelines YAML:

```yaml
trigger:
  branches:
    include:
      - main

pool:
  vmImage: ubuntu-latest

variables:
  buildConfiguration: Release

steps:
  - task: UseDotNet@2
    inputs:
      packageType: sdk
      version: 10.0.x

  - script: dotnet restore
    displayName: Restore

  - script: dotnet build --configuration $(buildConfiguration) --no-restore
    displayName: Build

  - script: |
      dotnet test \
        --configuration $(buildConfiguration) \
        --no-build \
        --logger "trx" \
        --results-directory "$(Agent.TempDirectory)/TestResults" \
        --collect:"XPlat Code Coverage"
    displayName: Test
    continueOnError: false

  - task: PublishTestResults@2
    condition: always()
    inputs:
      testResultsFormat: VSTest
      testResultsFiles: '$(Agent.TempDirectory)/TestResults/**/*.trx'
      failTaskOnFailedTests: true

  - task: PublishCodeCoverageResults@2
    condition: always()
    inputs:
      summaryFileLocation: '$(Agent.TempDirectory)/TestResults/**/coverage.cobertura.xml'
```

The exact coverage publishing task and inputs may vary by pipeline version and report format, but the principle is the same: publish results even when tests fail so developers can inspect the failure.

### Splitting Test Suites in CI

Not every test needs to run at the same frequency.

Example categories:

| Test Type | Run Frequency |
|---|---|
| Fast unit tests | Every pull request |
| Integration tests | Every pull request or important branches |
| Database container tests | Pull request and main branch, depending on speed |
| E2E smoke tests | Pull request or pre-merge for critical flows |
| Full E2E suite | Nightly or before release |
| Load tests | Scheduled or release candidate |
| Security tests | Scheduled, PR for critical checks, release pipeline |

A practical strategy:

- Pull request: fast unit tests + important integration tests.
- Main branch: all PR tests + broader integration/E2E tests.
- Nightly: full E2E, mutation tests, long-running compatibility tests.
- Release: smoke tests against deployed environment.

This balances fast feedback with broad confidence.

### Test Filtering and Traits

Test frameworks support categories or traits to control which tests run.

xUnit example:

```csharp
[Trait("Category", "Integration")]
public sealed class OrdersApiTests
{
    [Fact]
    public async Task CreateOrder_ReturnsCreated()
    {
        // ...
    }
}
```

Run only non-integration tests:

```bash
dotnet test --filter "Category!=Integration"
```

Run only integration tests:

```bash
dotnet test --filter "Category=Integration"
```

This is useful for separating fast unit tests from slower integration tests.

### Parallel Test Execution

Parallel execution can make CI faster, but it can also create flakiness.

Parallelization is safe when tests are independent.

Parallelization is risky when tests share:

- Database state.
- Files.
- Static mutable variables.
- Ports.
- External services.
- Test users.
- Queues.
- Caches.
- Browser contexts.
- Containers with shared state.

xUnit supports test collections to control shared context and parallelization.

Example collection:

```csharp
[CollectionDefinition("Database collection", DisableParallelization = true)]
public sealed class DatabaseCollection
{
}
```

Usage:

```csharp
[Collection("Database collection")]
public sealed class OrdersDatabaseTests
{
}
```

Use this when tests share a database fixture and cannot safely run in parallel.

Better long-term solution:

- Isolate test data.
- Use unique databases or schemas.
- Reset state per test.
- Avoid shared mutable state.
- Then enable parallelization safely.

### CI Resource Constraints

CI is often slower and more constrained than a developer machine.

Common issues:

- Fewer CPU cores.
- Less memory.
- Slower disk.
- Noisy neighbors on shared runners.
- Cold dependency cache.
- Docker image pulls.
- Browser tests competing for CPU.
- Database containers starting slowly.
- Network variability.
- Different time zone or culture.
- Different environment variables.

Do not assume CI is just "local but slower."

Stability practices:

- Set explicit timeouts.
- Limit parallel workers.
- Cache dependencies.
- Use deterministic environment variables.
- Pin SDK versions.
- Pin container image versions.
- Use CI-specific test configuration.
- Capture artifacts.
- Avoid fixed sleeps.
- Separate slow tests.
- Monitor test duration trends.

### Build Once, Test Many

A CI pipeline should avoid rebuilding unnecessarily.

Example:

```bash
dotnet restore
dotnet build --configuration Release --no-restore
dotnet test --configuration Release --no-build
```

This reduces duplicate work and ensures tests run against the built output.

For large solutions:

```bash
dotnet test MySolution.sln \
  --configuration Release \
  --no-build \
  --filter "Category!=E2E"
```

For test projects separately:

```bash
dotnet test tests/UnitTests/UnitTests.csproj --no-build
dotnet test tests/IntegrationTests/IntegrationTests.csproj --no-build
```

Keep CI scripts explicit and predictable.

### Quality Gates

A quality gate is a rule that must pass before merging or deploying.

Common gates:

- Build succeeds.
- Unit tests pass.
- Integration tests pass.
- No critical static analysis issues.
- Coverage does not drop below threshold.
- Changed code coverage meets threshold.
- No high-severity vulnerabilities.
- E2E smoke tests pass.
- No flaky tests in required suite.
- Test results are published.
- Required artifacts are uploaded.

Coverage gate example concept:

```text
Line coverage must be >= 80%.
Branch coverage must be >= 70%.
Coverage must not decrease by more than 1%.
```

Use gates carefully. Gates should encourage good behavior, not create meaningless checklists.

### Handling Failing Tests in CI

When tests fail in CI:

1. Do not immediately rerun without looking.
2. Read the failure message.
3. Check expected vs actual.
4. Check logs and artifacts.
5. Check whether the failure is deterministic.
6. Run the test locally if needed.
7. Reproduce under CI-like settings if possible.
8. Identify whether it is a product bug, test bug, or environment issue.
9. Fix the root cause.
10. Add regression coverage if the product had a bug.

Avoid treating flaky tests as harmless.

A flaky test can still reveal real regressions.

### Useful Test Naming

Good test names explain the scenario and expected result.

Common pattern:

```text
MethodName_WhenCondition_ExpectedResult
```

Example:

```csharp
[Fact]
public void CalculateTotal_WhenOrderHasMultipleLines_ReturnsSumOfLineTotals()
{
}
```

Another readable style:

```csharp
[Fact]
public void Should_return_bad_request_when_email_is_missing()
{
}
```

Good names help CI failures become understandable without opening the test file.

Bad:

```csharp
[Fact]
public void Test1()
{
}
```

### Test Data Builders

Test data builders reduce noisy arrange code.

Example:

```csharp
public sealed class OrderBuilder
{
    private readonly Order _order = new()
    {
        CustomerId = 1
    };

    public OrderBuilder WithLine(decimal price, int quantity)
    {
        _order.Lines.Add(new OrderLine
        {
            UnitPrice = price,
            Quantity = quantity
        });

        return this;
    }

    public Order Build()
    {
        return _order;
    }
}
```

Usage:

```csharp
var order = new OrderBuilder()
    .WithLine(10m, 2)
    .WithLine(5m, 1)
    .Build();
```

Benefits:

- Tests focus on relevant data.
- Defaults are centralized.
- Reduces duplication.
- Makes test intent clearer.

Be careful not to hide too much. Test readers should still understand the important setup.

### Mutation Testing

Mutation testing changes production code slightly and checks whether tests fail.

Example mutation:

```csharp
if (total >= 1000)
```

Changed to:

```csharp
if (total > 1000)
```

If tests still pass, the test suite may not be strong enough.

Mutation testing is useful because it measures test effectiveness better than line coverage. It asks: "Would the tests catch real mistakes?"

Trade-offs:

- Slower than normal tests.
- More complex to configure.
- Not usually run on every pull request.
- Better for critical modules or scheduled checks.

Mutation testing is often used as an advanced quality signal, not a replacement for coverage.

### Common Mistakes

Common mistakes include:

- Treating high coverage as proof of correctness.
- Writing tests with no meaningful assertions.
- Asserting only `NotNull` or `IsSuccessStatusCode`.
- Testing implementation details instead of behavior.
- Making tests depend on current time.
- Using random data without controlling it.
- Sharing database state between tests.
- Depending on test execution order.
- Ignoring flaky tests.
- Using retries to hide test problems.
- Running too many slow tests on every pull request.
- Not publishing test results in CI.
- Not collecting failure artifacts.
- Letting integration tests call real external services.
- Using fixed sleeps in async or UI tests.
- Overusing mocks and verifying every internal call.
- Not testing negative cases.
- Not testing boundary cases.
- Not running tests in Release configuration in CI.
- Not pinning SDK or container versions.
- Not separating unit, integration, and E2E test stages.
- Allowing skipped tests without ownership.

### Best Practices

Use code coverage as a signal, not the only goal.

Prefer branch coverage for complex decision logic.

Review uncovered high-risk code.

Write assertions that verify meaningful behavior.

Use Arrange-Act-Assert.

Prefer behavior assertions over implementation-detail assertions.

Test success, failure, boundary, and edge cases.

Keep tests deterministic.

Control time, randomness, culture, and external dependencies.

Isolate test data.

Avoid test order dependencies.

Treat flaky tests as defects.

Use retries carefully and track retry-based passes.

Publish TRX/JUnit results and coverage reports in CI.

Upload failure artifacts such as logs, screenshots, traces, and coverage reports.

Run fast tests on every pull request.

Run slower tests in separate stages, nightly jobs, or release gates when needed.

Keep CI scripts explicit and reproducible.

Use test categories or traits to split suites.

Limit parallelism when tests share resources.

Make failed CI output actionable.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q01 -->
#### Beginner Q01: What is code coverage?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Code coverage measures how much production code is executed when tests run. Common types include line coverage, branch coverage, method coverage, and statement coverage.

For example, if a method has an `if` statement and tests only exercise the `true` branch, line coverage may look acceptable, but branch coverage reveals that the `false` branch is not tested.

Coverage is useful because it shows untested areas, but it does not prove that the tests verify correct behavior.

##### Key Points to Mention

- Measures code executed by tests.
- Common metrics include line, branch, and method coverage.
- Branch coverage is useful for decision logic.
- Coverage does not prove correctness.
- High coverage with weak assertions is still weak testing.
- Use coverage as a signal, not as the only quality measure.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q01 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q02 -->
#### Beginner Q02: Is 100% code coverage always good?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Not necessarily. 100% code coverage means all measured code was executed by tests, but it does not mean the tests asserted correct behavior.

A test can execute a method without checking its result. That increases coverage but gives little confidence.

High coverage is useful for critical business logic, but teams should focus on meaningful tests, branch coverage, edge cases, and behavior verification rather than only chasing a number.

##### Key Points to Mention

- 100% coverage does not guarantee correctness.
- Assertions matter more than execution alone.
- Some code is low-value to test directly.
- Critical code should have strong coverage.
- Coverage can create false confidence.
- Quality depends on meaningful assertions and scenarios.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q02 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q03 -->
#### Beginner Q03: What makes an assertion useful?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A useful assertion verifies behavior that matters. It should check the expected output, state change, exception, HTTP response, database effect, event, or side effect.

For example, instead of only asserting that a response is successful, an API test should often assert the exact status code, response body, content type, and important fields.

Useful assertions should be specific enough to catch real bugs but not so tied to implementation details that simple refactoring breaks the test.

##### Key Points to Mention

- Verifies meaningful behavior.
- Checks expected result, state, or side effect.
- Should be specific.
- Should avoid unnecessary implementation details.
- Makes failures easy to understand.
- A test without useful assertions gives weak confidence.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q03 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q04 -->
#### Beginner Q04: What is a flaky test?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A flaky test is a test that sometimes passes and sometimes fails without a relevant code change. It is unreliable because the same code can produce different test results.

Common causes include timing issues, shared state, test order dependency, parallel execution, real external services, random data, current time, async race conditions, and CI resource constraints.

Flaky tests are dangerous because they reduce trust in the test suite and can cause developers to ignore real failures.

##### Key Points to Mention

- Passes and fails inconsistently.
- Happens without relevant code changes.
- Common in integration and E2E tests.
- Can also happen in unit tests.
- Reduces trust in CI.
- Should be treated as a defect.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q04 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q05 -->
#### Beginner Q05: How do you collect code coverage in .NET?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

A common way is to run `dotnet test` with the Coverlet collector.

Example:

```bash
dotnet test --collect:"XPlat Code Coverage"
```

You can also generate TRX test results:

```bash
dotnet test \
  --logger "trx" \
  --results-directory ./TestResults \
  --collect:"XPlat Code Coverage"
```

Coverage results can be converted into readable reports using tools such as ReportGenerator and published in CI.

##### Key Points to Mention

- Use `dotnet test`.
- Use `--collect:"XPlat Code Coverage"` for Coverlet collector.
- Use `--logger "trx"` for test result files.
- Coverage output is often Cobertura XML.
- ReportGenerator can create HTML reports.
- CI can publish coverage reports.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q05 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q06 -->
#### Beginner Q06: What should a CI pipeline do with test results?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

A CI pipeline should run tests automatically, fail when required tests fail, and publish test results so developers can inspect failures. It should also publish useful artifacts such as logs, TRX/JUnit files, coverage reports, screenshots, traces, or videos when relevant.

Publishing test results is important because it lets the team see which tests failed, how long they took, and what error messages were produced.

##### Key Points to Mention

- Run tests automatically.
- Fail the build for required failures.
- Publish TRX/JUnit test results.
- Publish coverage reports.
- Upload diagnostic artifacts.
- Make failures easy to debug.
- Keep feedback visible in pull requests.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q01 -->
#### Intermediate Q01: What is the difference between line coverage and branch coverage?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Line coverage measures whether executable lines were run during tests. Branch coverage measures whether each decision path was exercised.

For example, an `if` statement has at least two branches: true and false. A test that only covers the true branch may execute many lines, but it does not verify the false path.

Branch coverage is often more useful for business logic because it highlights untested decisions and edge cases.

##### Key Points to Mention

- Line coverage measures executed lines.
- Branch coverage measures decision paths.
- Branch coverage is useful for `if`, `switch`, and conditional logic.
- High line coverage can still miss important paths.
- Business rules should usually have good branch coverage.
- Branch coverage is often a stronger signal than line coverage alone.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q01 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q02 -->
#### Intermediate Q02: How do you prevent flaky unit tests?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Prevent flaky unit tests by making them deterministic and isolated. Avoid real time, uncontrolled randomness, shared static state, real network calls, test order dependencies, and file paths shared by multiple tests.

Use fake clocks, seeded random values, in-memory test doubles, isolated test data, and explicit culture/time zone settings when relevant.

Unit tests should not depend on external services or environment timing.

##### Key Points to Mention

- Control time with `TimeProvider` or fake clock.
- Control randomness.
- Avoid shared mutable state.
- Avoid real network.
- Avoid test order dependency.
- Use deterministic test data.
- Keep tests small and isolated.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q02 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q03 -->
#### Intermediate Q03: How do you prevent flaky integration tests?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Prevent flaky integration tests by isolating test data, resetting the database between tests, replacing external services with fakes or test containers, avoiding test order dependencies, and controlling parallel execution.

Integration tests should use deterministic data and should not rely on shared mutable resources unless those resources are reset. If asynchronous side effects are involved, use bounded polling for the expected condition instead of fixed sleeps.

##### Key Points to Mention

- Reset database state.
- Seed deterministic data.
- Avoid shared mutable state.
- Replace external services.
- Avoid test order dependency.
- Control parallelization.
- Use bounded polling for eventual consistency.
- Capture logs on failure.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q03 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q04 -->
#### Intermediate Q04: How should retries be used in CI tests?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Retries should be used carefully. They can reduce noise for E2E tests affected by infrastructure or browser timing, but they can also hide real product bugs and allow flaky tests to remain unfixed.

Unit tests usually should not need retries. For E2E tests, limited retries may be acceptable if flaky retry results are tracked and treated as unhealthy. A test that passes only after retry should not be considered fully healthy.

Flaky tests should have owners, diagnostics, and a fix or quarantine plan.

##### Key Points to Mention

- Avoid retries for unit tests.
- Limited retries may help E2E tests.
- Retries can hide real bugs.
- Track tests that pass after retry.
- Capture diagnostics on retry.
- Quarantine only temporarily.
- Fix the root cause.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q04 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q05 -->
#### Intermediate Q05: What is a good assertion strategy for API integration tests?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

A good API integration test should assert the meaningful HTTP contract. This usually includes the exact status code, response body, important response fields, content type, headers when relevant, validation errors, and database side effects if the endpoint writes data.

For example, for a create endpoint, assert `201 Created`, the response DTO, the `Location` header if part of the contract, and that the entity was persisted.

Avoid only asserting `IsSuccessStatusCode` unless that is truly enough.

##### Key Points to Mention

- Assert exact status code.
- Assert response DTO.
- Assert validation errors for invalid requests.
- Assert headers/content type when relevant.
- Assert database side effects for write endpoints.
- Test negative cases.
- Avoid vague success assertions.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q05 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q06 -->
#### Intermediate Q06: How do you split test suites in CI?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Split tests by speed, reliability, and purpose. Fast unit tests should run on every pull request. Important integration tests should also run on pull requests if they are stable and reasonably fast. Slower E2E, load, compatibility, or full regression tests can run on main branch, nightly schedules, or release pipelines.

Use test traits or categories to filter test runs.

Example:

```bash
dotnet test --filter "Category!=E2E"
```

The goal is fast feedback on pull requests and broader confidence before release.

##### Key Points to Mention

- Unit tests on every PR.
- Important integration tests on PRs.
- Full E2E may run nightly or before release.
- Use traits/categories.
- Keep PR feedback fast.
- Separate slow or fragile tests.
- Required gates should be reliable.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q06 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q07 -->
#### Intermediate Q07: How do you handle parallel test execution safely?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

Parallel execution is safe only when tests are independent. If tests share databases, files, ports, static state, queues, caches, or external services, parallel execution can cause flaky failures.

To handle it safely, isolate test data, use unique resources per test, reset state, avoid shared mutable variables, or disable parallelization for tests that share resources.

In xUnit, test collections can be used to control shared fixtures and disable parallelization for a collection.

##### Key Points to Mention

- Parallelization improves speed but can cause flakiness.
- Tests must be independent.
- Shared database state is a common problem.
- Use unique data/resources.
- Reset state between tests.
- Disable parallelization for shared fixtures when needed.
- Prefer isolation over disabling parallelism globally.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q07 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q08 -->
#### Intermediate Q08: What artifacts should CI capture for failed tests?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

CI should capture enough artifacts to debug failures without rerunning blindly. Useful artifacts include test result files, coverage reports, console logs, application logs, screenshots, browser traces, videos, network logs, database logs, container logs, failed request/response payloads, and environment details.

For Playwright or browser tests, traces, screenshots, and videos are especially useful. For integration tests, application logs and database logs are often more useful.

##### Key Points to Mention

- TRX/JUnit results.
- Coverage reports.
- Console and application logs.
- Screenshots/traces/videos for E2E.
- Container/database logs for integration tests.
- Request/response payloads when safe.
- Artifacts should upload even when tests fail.
- Good artifacts reduce debugging time.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q01 -->
#### Advanced Q01: How would you design a CI testing strategy for a full-stack .NET application?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

I would design the pipeline in stages. First, restore and build the solution. Then run fast unit tests on every pull request with coverage collection. Next, run important integration tests, including ASP.NET Core pipeline tests and database tests using a realistic provider. Then run a small set of critical E2E smoke tests if they are stable enough for PR checks.

Slower full E2E, load, compatibility, and long-running regression suites can run nightly or before release. CI should publish test results, coverage reports, and failure artifacts. It should enforce quality gates such as required tests passing, no major coverage regression, and no critical flaky tests in required suites.

The strategy should balance fast feedback, reliability, and production confidence.

##### Key Points to Mention

- Build once, test many.
- Fast unit tests on every PR.
- Integration tests for important server/database behavior.
- Small stable E2E smoke suite for critical flows.
- Full E2E/nightly/release tests separately.
- Publish results and coverage.
- Capture failure artifacts.
- Use quality gates carefully.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q01 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q02 -->
#### Advanced Q02: How would you enforce code coverage without encouraging bad tests?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

I would use coverage as a guardrail, not as the only quality goal. I would set realistic thresholds, focus on branch coverage for complex logic, and pay special attention to critical modules such as authorization, validation, pricing, payments, and domain rules.

I would review tests for meaningful assertions during code review and avoid accepting shallow tests written only to raise coverage. I would exclude generated or low-value boilerplate code where appropriate. I might also track coverage on changed code to prevent new untested code without forcing unrealistic global thresholds.

For critical code, mutation testing can provide a stronger signal than coverage alone.

##### Key Points to Mention

- Coverage is a signal, not proof.
- Use realistic thresholds.
- Focus on high-risk code.
- Prefer branch coverage for business rules.
- Review assertion quality.
- Avoid shallow coverage-padding tests.
- Exclude generated/boilerplate carefully.
- Consider changed-code coverage and mutation testing.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q02 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q03 -->
#### Advanced Q03: How would you investigate and fix a flaky test?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

First, determine whether the failure is a real product bug, test bug, or environment issue. Look at CI logs, screenshots, traces, timing, test data, and recent changes. Try to reproduce the failure under CI-like conditions, including the same OS, browser, database, parallelization, and environment variables.

Then identify the root cause. Common fixes include isolating test data, removing test order dependency, replacing fixed sleeps with condition-based waits, controlling time/randomness, reducing parallelism for shared resources, using unique files or ports, replacing real external calls, or fixing an actual race condition in the application.

If the test is flaky and cannot be fixed immediately, quarantine it with an owner and expiry date. Do not ignore it indefinitely.

##### Key Points to Mention

- Classify product bug vs test bug vs environment issue.
- Use logs, traces, screenshots, and artifacts.
- Reproduce under CI-like conditions.
- Check time, randomness, shared state, parallelism, and external services.
- Fix root cause.
- Avoid blind retries.
- Quarantine only temporarily with ownership.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q03 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q04 -->
#### Advanced Q04: How do you decide whether to assert behavior or mock interactions?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Prefer behavior assertions when the observable state or output represents the requirement. For example, assert that an order status changed to `Submitted` or that an API returned the expected response.

Mock interaction assertions are useful when the interaction itself is the behavior, such as sending an email, publishing an event, calling a payment gateway, writing an audit log, or invalidating a cache.

Avoid verifying every internal method call because that couples tests to implementation details and makes refactoring harder.

##### Key Points to Mention

- Prefer observable behavior.
- Use interaction verification when interaction is the requirement.
- Good examples: email, event, payment, audit, cache invalidation.
- Avoid verifying every internal call.
- Over-mocking creates brittle tests.
- Tests should support refactoring.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q04 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q05 -->
#### Advanced Q05: What is a good approach to CI retries and flaky test reporting?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Retries should be limited and transparent. Unit tests should generally not use retries. E2E tests may use a small number of retries if the team also reports tests that pass only after retry as flaky.

CI should not hide retry-based passes. Flaky tests should be tracked, owned, and fixed. Some teams quarantine flaky tests temporarily, but quarantine should require an owner, reason, and expiry date.

Retries should capture diagnostics such as traces, screenshots, videos, and logs so the root cause can be fixed.

##### Key Points to Mention

- Avoid retries for unit tests.
- Use limited retries for E2E if needed.
- Track passed-after-retry tests as flaky.
- Do not treat flaky as healthy.
- Capture diagnostics on retry.
- Quarantine with owner and expiry.
- Fix or delete unreliable tests.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q05 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q06 -->
#### Advanced Q06: How would you reduce CI test execution time without losing confidence?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

I would first measure where time is spent. Then I would split tests by type and risk. Fast unit tests should run on every PR. Slower tests can be separated into integration, E2E smoke, full E2E, nightly, or release stages.

I would avoid rebuilding for each test stage by building once and using `--no-build`. I would use dependency caching, test filtering, parallelization where safe, database/container reuse with proper cleanup, and smaller focused E2E suites. I would also move logic-heavy coverage from E2E tests into unit and integration tests where possible.

The goal is to keep PR feedback fast while still running broader confidence checks at the right time.

##### Key Points to Mention

- Measure before optimizing.
- Split fast and slow tests.
- Build once, test many.
- Use `--no-build`.
- Cache dependencies.
- Parallelize only safe tests.
- Reuse containers carefully.
- Keep E2E suite small and focused.
- Run full suites nightly or before release.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q06 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q07 -->
#### Advanced Q07: How do you make E2E tests less flaky in CI?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Use stable locators, condition-based waits, web-first assertions, isolated test data, and deterministic backend state. Avoid fixed sleeps and avoid relying on animation timing or test order. Configure CI-specific workers and timeouts based on available resources. Capture traces, screenshots, videos, console logs, and network logs on failure.

Keep E2E tests focused on critical user journeys instead of covering every edge case. Move detailed business logic tests to unit or integration tests.

##### Key Points to Mention

- Use stable locators.
- Prefer web-first assertions.
- Avoid fixed sleeps.
- Isolate users and data.
- Reset backend state.
- Limit CI workers based on resources.
- Capture traces/screenshots/videos.
- Keep E2E tests focused.
- Move detailed logic checks lower in the test pyramid.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q07 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q08 -->
#### Advanced Q08: How should test failures be handled during pull request review?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

A failing required test should block the pull request until the cause is understood. The team should inspect the failure, determine whether it is a product bug, test bug, environment issue, or flaky test, and fix the root cause.

Reviewers should also review the tests themselves, not only production code. They should check that tests have meaningful assertions, cover important paths, avoid brittle implementation details, and do not introduce flakiness.

If a flaky test is discovered, it should be fixed or quarantined with ownership and an expiry date, not ignored.

##### Key Points to Mention

- Required test failures should block merge.
- Investigate before rerunning blindly.
- Classify failure cause.
- Review test quality in PRs.
- Check assertions and edge cases.
- Watch for new flakiness.
- Quarantine only with ownership and expiry.
- Do not normalize red CI.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q08 -->

<!-- question:start:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q09 -->
#### Advanced Q09: How do mutation testing and code coverage complement each other?

<!-- question-id:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

Code coverage measures whether code was executed. Mutation testing measures whether tests would fail if production code were changed in small ways.

For example, mutation testing might change `>=` to `>` or replace `&&` with `||`. If tests still pass, the tests may not be strong enough even if coverage is high.

Coverage is faster and useful as a broad signal. Mutation testing is slower but gives stronger insight into test effectiveness. It is often used for critical modules, scheduled checks, or quality improvement work rather than every pull request.

##### Key Points to Mention

- Coverage measures execution.
- Mutation testing measures test strength.
- High coverage can still miss bad assertions.
- Mutation testing finds weak tests.
- Mutation testing is slower.
- Useful for critical business logic.
- Complements but does not replace coverage.

<!-- question:end:code-coverage-useful-assertions-flaky-test-prevention-and-ci-test-execution-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
