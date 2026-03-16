---
id: unit-testing-dotnet
topic: Unit Testing in C# / .NET
category: .NET
---

## Unit Testing Fundamentals

### What is unit testing?

Unit testing is a type of software testing where individual units (methods, classes, components) are tested in isolation to ensure they behave as expected.

---

### What are the benefits of unit testing?

- Detects bugs early
- Improves code quality
- Makes refactoring safer
- Serves as living documentation
- Encourages modular design
- Supports CI/CD pipelines

---

### Difference Between Unit, Integration, and End-to-End Testing

| Type              | Scope                                   |
|------------------|------------------------------------------|
| Unit Testing      | Tests individual methods/classes         |
| Integration Testing | Tests interaction between components |
| End-to-End Testing | Simulates full user flows              |

---

## Testing Frameworks in .NET

### Most Common Frameworks

- xUnit (modern, widely adopted)
- NUnit (mature and feature-rich)
- MSTest (Microsoft official framework)

---

### Example: Basic xUnit Test

```csharp
[Fact]
public void Add_ShouldReturnCorrectSum()
{
    var calc = new Calculator();
    var result = calc.Add(2, 3);

    Assert.Equal(5, result);
}
````

---

### Naming Convention for Tests

**MethodName_StateUnderTest_ExpectedBehavior**

Example:

```
Add_NegativeAndPositiveNumber_ReturnsCorrectSum
```

---

## xUnit vs NUnit vs MSTest

| Framework | Characteristics                                    |
| --------- | -------------------------------------------------- |
| xUnit     | Modern, clean syntax, uses `[Fact]` and `[Theory]` |
| NUnit     | Mature, supports `[TestCase]`, rich assertions     |
| MSTest    | Integrated with Visual Studio                      |

Preference typically depends on team standards. xUnit is commonly preferred in modern .NET projects.

---

### `[Fact]` vs `[Theory]` in xUnit

* `[Fact]` → No parameters
* `[Theory]` → Parameterized tests using `[InlineData]`

Example:

```csharp id="n5d8op"
[Theory]
[InlineData(2, 3, 5)]
[InlineData(0, 0, 0)]
public void Add_ReturnsExpected(int a, int b, int expected)
{
    var calc = new Calculator();
    Assert.Equal(expected, calc.Add(a, b));
}
```

---

### NUnit `[TestCase]` Example

```csharp id="h9k4xv"
[TestCase(2, 3, 5)]
[TestCase(0, 0, 0)]
public void Add_ShouldReturnSum(int a, int b, int expected)
{
    var calc = new Calculator();
    Assert.AreEqual(expected, calc.Add(a, b));
}
```

---

## Mocking & Test Doubles

### What is mocking?

Mocking simulates the behavior of real dependencies to isolate the unit under test.

---

### Popular Mocking Frameworks

* Moq
* NSubstitute
* FakeItEasy

---

### Example: Mocking with Moq

```csharp id="q2pz7l"
var mockRepo = new Mock<IRepository>();
mockRepo.Setup(r => r.GetById(1))
        .Returns(new Item());
```

---

### Mocking vs Stubbing

* **Stub** → Returns predefined data
* **Mock** → Verifies interactions and behavior

---

### What is a Test Double?

A general term for:

* Mock
* Stub
* Fake
* Spy

---

## Test Structure & Patterns

### AAA Pattern

* Arrange → Setup test data and dependencies
* Act → Execute the method
* Assert → Verify results

---

### Writing Testable Code

* Use interfaces
* Use dependency injection
* Avoid static methods
* Keep methods small and focused

---

### Dependency Injection and Testing

Dependency Injection (DI) allows dependencies to be injected, making them easier to mock.

---

### Testing Private Methods

Best practice:

* Refactor logic into a separate class
* Avoid directly testing private methods
* Use `InternalsVisibleTo` only when necessary

---

## Advanced Testing Topics

### Code Coverage

Code coverage measures how much code is executed by tests.

Tools:

* Coverlet
* Visual Studio (Enterprise)
* dotnet test with coverage collectors

---

### Testing Async Methods

```csharp id="y7mq4e"
[Fact]
public async Task GetDataAsync_ShouldReturnData()
{
    var service = new MyService();
    var result = await service.GetDataAsync();

    Assert.NotNull(result);
}
```

Always return `Task` from async test methods.

---

### Testing HttpClient

Approaches:

* Mock `HttpMessageHandler`
* Use `RichardSzalay.MockHttp`
* Use `WebApplicationFactory` for integration tests

---

### Testing IOptions<T>

```csharp id="l0f9wp"
var options = Options.Create(new MySettings
{
    Key = "Value"
});
```

Inject into the class under test.

---

### Testing DateTime / Time Logic

Abstract time:

```csharp
public interface IDateTimeProvider
{
    DateTime Now { get; }
}
```

Mock in tests.

---

## Common Challenges & Solutions

| Challenge             | Solution                      |
| --------------------- | ----------------------------- |
| Static dependencies   | Use interfaces & DI           |
| Private methods       | Extract logic                 |
| Tight coupling        | Reduce constructor complexity |
| Async/background code | Use async test patterns       |
| External systems      | Use mocks/fakes               |
| Flaky tests           | Remove randomness             |
| Legacy code           | Incremental refactor          |
| Shared state          | Isolate tests                 |
| Excessive setup       | Use builders/helpers          |
| Broad assertions      | Write focused tests           |

---

## Test-Driven Development (TDD)

TDD means writing tests before implementation.

### Red-Green-Refactor Cycle

* 🔴 Red → Write failing test
* 🟢 Green → Make it pass
* 🔁 Refactor → Improve code while keeping tests passing

---

### Example: Red-Green-Refactor

#### Red

```csharp id="g6n3az"
[Fact]
public void GetDiscount_PremiumCustomer_Returns20Percent()
{
    var calculator = new DiscountCalculator();
    var result = calculator.GetDiscount("Premium", 100);

    Assert.Equal(20, result);
}
```

#### Green

```csharp id="b8k2mv"
public class DiscountCalculator
{
    public decimal GetDiscount(string customerType, decimal amount)
    {
        if (customerType == "Premium")
            return amount * 0.2m;

        return 0;
    }
}
```

#### Refactor

```csharp id="x3m8te"
public class DiscountCalculator
{
    public decimal GetDiscount(string customerType, decimal amount)
    {
        return customerType switch
        {
            "Premium" => amount * 0.2m,
            _ => 0
        };
    }
}
```

---

## How Unit Testing Influences Architecture

Unit testing encourages:

* Separation of concerns
* SOLID principles
* Loosely coupled design
* Clean architecture
* Maintainable code

It leads to more modular and scalable systems.

![Unit test example](../knowledge-images/unittest.png)

```
