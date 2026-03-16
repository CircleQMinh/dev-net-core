---
id: dependency-injection-and-ioc
topic: Dependency Injection (DI) and Inversion of Control (IoC)
category: .NET
---

Dependency Injection (DI) and Inversion of Control (IoC) are core concepts in modern .NET development. They help build loosely coupled, testable, and maintainable systems.

---

# Basic Concepts

## What is Dependency Injection (DI)?

Dependency Injection is a design pattern where a class receives its dependencies from an external source instead of creating them itself.

### Example

```csharp
public interface IEngine
{
    void Run();
}

public class Car
{
    private readonly IEngine _engine;

    public Car(IEngine engine) // Constructor Injection
    {
        _engine = engine;
    }

    public void Start()
    {
        _engine.Run();
    }
}
````

### Benefits

* Loose coupling
* Easier unit testing
* Reusability
* Flexibility in switching implementations

---

## What is Inversion of Control (IoC)?

IoC is a broader design principle where control of object creation and execution flow is transferred to an external system.

* DI is a specific implementation of IoC.
* The IoC container manages object creation and dependency resolution.

---

# Types of Dependency Injection

## 1. Constructor Injection (Recommended)

Dependencies are required at object creation.

```csharp
public class Car
{
    private readonly IEngine _engine;

    public Car(IEngine engine)
    {
        _engine = engine;
    }
}
```

## 2. Setter Injection

Dependencies are provided via properties.

```csharp
public class Car
{
    public IEngine Engine { get; set; }
}
```

⚠ May lead to partially initialized objects.

## 3. Interface Injection (Rare in C#)

The dependency defines an injection method.

Rarely used in .NET applications.

---

# IoC Containers

## What is an IoC Container?

An IoC container:

* Manages object creation
* Resolves dependencies
* Controls object lifetimes

### Popular .NET Containers

* Microsoft.Extensions.DependencyInjection (built-in)
* Autofac
* Ninject
* Castle Windsor

---

## ASP.NET Core Example

```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddTransient<IEngine, Engine>();
    services.AddTransient<Car>();
}
```

The container automatically resolves dependencies.

---

# Service Lifetimes

## 1. Transient

New instance every time requested.

```csharp
services.AddTransient<IEngine, Engine>();
```

## 2. Scoped

One instance per request (in web apps).

```csharp
services.AddScoped<IEngine, Engine>();
```

## 3. Singleton

One instance for entire application lifetime.

```csharp
services.AddSingleton<IEngine, Engine>();
```

---

## Lifetime Comparison

| Lifetime  | Instance Created     |
| --------- | -------------------- |
| Transient | Every resolve        |
| Scoped    | Once per request     |
| Singleton | Once per application |

---

# Lifetime Mismatch (Important Interview Topic)

## Safe Scenario

* Transient depends on Singleton

```csharp
services.AddTransient<ServiceA>();
services.AddSingleton<ServiceB>();

public class ServiceA
{
    private readonly ServiceB _serviceB;

    public ServiceA(ServiceB serviceB)
    {
        _serviceB = serviceB;
    }
}
```

✔ New `ServiceA` each time
✔ Shared singleton `ServiceB`
✔ Safe and supported

---

## Dangerous Scenario

❌ Singleton depends on Scoped or Transient

```csharp
public class ServiceB
{
    public ServiceB(ServiceA serviceA) // ServiceA is scoped/transient
    {
    }
}
```

* Causes lifetime capture issues
* .NET throws runtime error if injecting Scoped into Singleton

---

## Lifetime Rule of Thumb
In ASP.NET Core DI, most lifetime combinations resolve without error except when a Singleton depends on a Scoped service.


| Injected Into ↓      | Singleton | Scoped | Transient |
| -------------------- | --------- | ------ | --------- |
| Can accept Singleton | ✅         | ✅      | ✅         |
| Can accept Scoped    | ❌         | ✅      | ✅         |
| Can accept Transient | ❌         | ✅      | ✅         |

![Unit test example](../knowledge-images/dirule.png)
---

## Disposal Rules

* Transient is disposed if:

  * It implements `IDisposable`
  * It is resolved within a scope
* Singleton is disposed at application shutdown
* Avoid resolving transients from the root container without proper disposal

---

# Circular Dependencies

Circular dependency example:

* ServiceA depends on ServiceB
* ServiceB depends on ServiceA

This causes resolution failure.

### Solutions

* Refactor design
* Use factory/delegate
* Use `Lazy<T>`
* Use setter injection (carefully)

---

# Factory Method with DI

Used when dependency needs parameters or complex creation logic.

```csharp
public class CarFactory
{
    private readonly IEngine _engine;

    public CarFactory(IEngine engine)
    {
        _engine = engine;
    }

    public Car CreateCar() => new Car(_engine);
}
```

---

# DI vs Service Locator

| Dependency Injection             | Service Locator                   |
| -------------------------------- | --------------------------------- |
| Dependencies provided externally | Class fetches dependencies itself |
| Promotes loose coupling          | Creates hidden dependencies       |
| Better for testing               | Harder to test                    |

Service Locator is generally discouraged.

---

# Testing with DI

Use mocking frameworks:

```csharp
var mockEngine = new Mock<IEngine>();
var car = new Car(mockEngine.Object);

car.Start();

mockEngine.Verify(e => e.Run(), Times.Once);
```

DI allows easy injection of mocked dependencies.

---

# Why DI Helps Unit Testing

* No manual dependency creation
* Inject mocks or stubs
* Test class in isolation
* Better separation of concerns

---

# Summary

| Concept               | Key Point                                        |
| --------------------- | ------------------------------------------------ |
| DI                    | Inject dependencies externally                   |
| IoC                   | External control of object creation              |
| Constructor Injection | Preferred approach                               |
| Lifetimes             | Singleton, Scoped, Transient                     |
| Rule                  | Shorter lifetime → can depend on longer lifetime |
| Anti-pattern          | Service Locator                                  |

---

## Notes

1. Injecting Singleton into Transient is safe.
2. Injecting Scoped into Singleton causes runtime failure in .NET.
3. Overusing DI can increase complexity.
4. Lifetime mismatches are common interview traps.
5. Circular dependencies usually indicate design problems.


Dependency Injection in .NET – Quick Concept Map

Core Principles Achieved
- Inversion of Control (IoC)
- Dependency Inversion Principle (DIP)

Key Benefits
- Loose Coupling
- Easier Unit Testing (easy mocking)
- Centralized Configuration

Service Lifetimes (the most important part!)

Singleton
- Created: once, lazily (first resolution)
- Shared: entire application lifetime
- Best for: stateless, thread-safe, globally shared services
  (e.g., caches, configuration, HttpClient wrappers)

Scoped (Default for DbContext!)
- Created: once per scope
- Shared: within the same scope (usually = one HTTP request)
- Best for: per-request / per-operation state
  (e.g., DbContext, Unit of Work, current user context)

Transient
- Created: every single resolution
- Shared: never
- Best for: lightweight, stateless helpers
  (e.g., mappers, calculators, email formatters)

Danger Zone – The Captive Dependency Trap

Singleton → Scoped / Transient = Very dangerous!
- Scoped or Transient becomes effectively Singleton
- Leads to: stale data, tenant leaks, connection exhaustion, bugs

Fix:
- Never inject scoped/transient directly into singleton.
- Use IServiceScopeFactory to create a child scope on demand.

(Note: Manual scoping inside singleton methods is acceptable,
but avoid making it a habit – prefer designing away from the need.)
```

