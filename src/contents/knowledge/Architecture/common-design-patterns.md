---
id: common-design-patterns
topic: Common Design Patterns (Builder, Factory, Prototype, Singleton, Facade, Proxy, Chain of Responsibility, Strategy)
category: Design & Architecture
---

## Overview

Design patterns provide **reusable solutions to common software design problems**.

Understanding these patterns helps engineers:

- improve code structure
- increase maintainability
- reduce coupling
- improve extensibility

This document covers several commonly used patterns in practical engineering:

- Builder
- Factory
- Prototype
- Singleton
- Facade
- Proxy
- Chain of Responsibility
- Strategy

---

#  Builder Pattern

## What It Is

The **Builder pattern** constructs complex objects step by step while hiding the construction logic from the client.

Core idea:

```

Build complex objects incrementally.

````

---

## Problems Builder Solves

Use Builder when:

- an object has many optional parameters
- constructors become messy
- readable object creation is desired
- validation is needed before object creation
- the same construction process can produce different representations

---

## Example (C#)

```csharp
public class UserBuilder
{
    private readonly User _user;

    private UserBuilder(int id, string email)
    {
        _user = new User(id, email);
    }

    public static UserBuilder Create(int id, string email)
        => new(id, email);

    public UserBuilder WithPhone(string phone)
    {
        _user.Phone = phone;
        return this;
    }

    public UserBuilder WithAddress(string address)
    {
        _user.Address = address;
        return this;
    }

    public UserBuilder AsActive()
    {
        _user.IsActive = true;
        return this;
    }

    public User Build()
    {
        if (string.IsNullOrEmpty(_user.Email))
            throw new InvalidOperationException("Email is required");

        return _user;
    }
}
````

Usage:

```csharp
var user = UserBuilder
    .Create(1, "user@email.com")
    .WithPhone("123")
    .WithAddress("Sydney")
    .AsActive()
    .Build();
```

---

## Real-World Examples

Builder pattern is commonly used for:

* HTTP request builders
* SQL query builders
* configuration builders
* test data builders
* UI component builders

---

#  Factory Pattern

## What It Is

The **Factory pattern** encapsulates object creation logic and hides which concrete implementation is instantiated.

Core idea:

```
Ask for what you want, not how it's created.
```

---

## When to Use

Use Factory when:

* multiple implementations of an interface exist
* object creation requires conditional logic
* clients should not depend on concrete classes
* new implementations may be added later

---

## Example

Interface:

```csharp
public interface IPaymentProcessor
{
    void Process(decimal amount);
}
```

Implementations:

```csharp
public class CreditCardPayment : IPaymentProcessor
{
    public void Process(decimal amount)
        => Console.WriteLine($"Credit card payment: {amount}");
}

public class PaypalPayment : IPaymentProcessor
{
    public void Process(decimal amount)
        => Console.WriteLine($"PayPal payment: {amount}");
}
```

Factory:

```csharp
public static class PaymentProcessorFactory
{
    public static IPaymentProcessor Create(string type)
    {
        return type switch
        {
            "CreditCard" => new CreditCardPayment(),
            "Paypal" => new PaypalPayment(),
            _ => throw new ArgumentException("Unsupported type")
        };
    }
}
```

Usage:

```csharp
var processor = PaymentProcessorFactory.Create("CreditCard");
processor.Process(100);
```

---

#  Prototype Pattern

## What It Is

The **Prototype pattern** creates new objects by **cloning existing ones**.

Core idea:

```
Create new objects by copying an existing instance.
```

---

## When It Makes Sense

Use Prototype when:

* object creation is expensive
* many similar objects are needed
* constructors are complex
* runtime state should be preserved

---

## Example
This Clone implementation is a shallow copy because it uses MemberwiseClone().
```csharp
public class Document
{
    public string Title { get; set; }
    public string Content { get; set; }

    public Document Clone()
    {
        return (Document)this.MemberwiseClone();
    }
}
```

Usage:

```csharp
var original = new Document
{
    Title = "Template",
    Content = "Base content"
};

var copy = original.Clone();
copy.Title = "New document";
```

---

## Deep vs Shallow Copy

**Shallow Copy**

```
Copies object but shares referenced objects
```

**Deep Copy**

```
Copies object AND referenced objects
```

---

#  Singleton Pattern

## What It Is

The **Singleton pattern** ensures:

1. Only one instance of a class exists
2. That instance is globally accessible

---

## Common Use Cases

Singleton works well for:

* shared stateless services
* application configuration
* logging
* caching
* process-wide coordination

Examples include:

* logging infrastructure
* configuration providers
* metrics collectors
* in-memory caches

---

## Example

```csharp
public sealed class ConfigService
{
    private static readonly ConfigService _instance = new();

    public static ConfigService Instance => _instance;

    private ConfigService() { }
}
```

---

#  Facade Pattern

## What It Is

The **Facade pattern** provides a simplified interface to a complex subsystem.

Core idea:

```
Hide complexity behind a clean API.
```

---

## Example

Without a facade, a caller might need to coordinate:

* repository
* validator
* payment service
* inventory system
* shipping system

Facade implementation:

```csharp
public class OrderFacade
{
    private readonly InventoryService _inventory;
    private readonly PaymentService _payment;
    private readonly ShippingService _shipping;

    public OrderFacade(
        InventoryService inventory,
        PaymentService payment,
        ShippingService shipping)
    {
        _inventory = inventory;
        _payment = payment;
        _shipping = shipping;
    }

    public void PlaceOrder(string sku, decimal amount, string address)
    {
        _inventory.Reserve(sku);
        _payment.Charge(amount);
        _shipping.Ship(address);
    }
}
```

Usage:

```csharp
orderFacade.PlaceOrder("SKU-1", 100, "Sydney");
```

---

#  Proxy Pattern

## What It Is

The **Proxy pattern** provides a surrogate object that controls access to another object.

Core idea:

```
Wrap the real object and intercept calls.
```

---

## Common Use Cases

* authorization
* caching
* lazy loading
* logging
* rate limiting

---

## Example

```csharp
public class SecureReportProxy : IReport
{
    private readonly Report _real;
    private readonly IUserContext _user;

    public SecureReportProxy(Report real, IUserContext user)
    {
        _real = real;
        _user = user;
    }

    public void Generate()
    {
        if (!_user.IsAdmin)
            throw new UnauthorizedAccessException();

        _real.Generate();
    }
}
```

---

#  Chain of Responsibility

## What It Is

The **Chain of Responsibility** pattern allows a request to pass through a chain of handlers.

Each handler decides:

```
Handle OR pass to next handler
```

Mental model:

```
Request → Handler A → Handler B → Handler C
```

---

## Example

ASP.NET Core middleware pipeline follows this pattern.

Example flow:

```
HTTP Request
   ↓
Authentication Middleware
   ↓
Authorization Middleware
   ↓
Controller
```

---

#  Strategy Pattern

## What It Is

The **Strategy pattern** defines a family of algorithms and makes them interchangeable.

Core idea:

```
Replace large if/switch logic with pluggable behaviors.
```

---

## Example

Strategy interface:

```csharp
public interface IDiscountStrategy
{
    bool Supports(OrderType type);
    decimal Calculate(Order order);
}
```

Implementations:

```csharp
public class RegularDiscountStrategy : IDiscountStrategy
{
    public bool Supports(OrderType type) => type == OrderType.Regular;
    public decimal Calculate(Order order)
        => order.Total * 0.05m;
}

public class PremiumDiscountStrategy : IDiscountStrategy
{
    public bool Supports(OrderType type) => type == OrderType.Premium;
    public decimal Calculate(Order order)
        => order.Total * 0.10m;
}

public class VipDiscountStrategy : IDiscountStrategy
{
    public bool Supports(OrderType type) => type == OrderType.Vip;
    public decimal Calculate(Order order)
        => order.Total * 0.20m;
}
```

Resolver example:

```csharp
public class DiscountStrategyResolver
{
    private readonly IEnumerable<IDiscountStrategy> _strategies;

    public DiscountStrategyResolver(IEnumerable<IDiscountStrategy> strategies)
    {
        _strategies = strategies;
    }

    public IDiscountStrategy Resolve(OrderType type)
        => _strategies.First(s => s.Supports(type));
}
```

---

# Quick Pattern Cheat Sheet

| Pattern                 | Purpose                          |
| ----------------------- | -------------------------------- |
| Builder                 | Step-by-step object construction |
| Factory                 | Encapsulate object creation      |
| Prototype               | Clone existing objects           |
| Singleton               | Single shared instance           |
| Facade                  | Simplify complex subsystem       |
| Proxy                   | Control access to an object      |
| Chain of Responsibility | Pass request through handlers    |
| Strategy                | Replace conditional logic        |


###  How to identify each pattern in real life

How to spot them:
- Builder: fluent step-by-step creation
- Factory: one place decides which implementation to create
- Prototype: clone an existing object/template
- Singleton: one shared instance for the whole app/process
- Facade: one simplified entry point to a complex subsystem
- Proxy: wrapper controlling access to the real object
- Chain of Responsibility: request flows through multiple handlers
- Strategy: interchangeable business rules/algorithms

###  When not to use

When not to use:
- Builder: overkill for simple objects with few parameters
- Factory: unnecessary when object creation is trivial
- Prototype: risky if copy semantics are unclear
- Singleton: avoid when it introduces hidden global state
- Facade: avoid turning it into a god service
- Proxy: unnecessary wrapper if no access-control/interception is needed
- Chain of Responsibility: can become hard to debug if chain flow is unclear
- Strategy: overkill for very small or stable conditional logic

---

## Notes

1. **ASP.NET Core uses these patterns internally**

Examples:

- Middleware → Chain of Responsibility  
- Dependency Injection container → Factory  
- HttpClientBuilder → Builder  
- Logging providers → Strategy

---

2. **Modern .NET code already uses them indirectly**

Example:

```csharp
services.AddScoped<IService, Service>();
````

This effectively combines **Factory + Dependency Injection**.

---

3. **Strategy + DI is very common in enterprise .NET**

Typical scenarios include:

* multiple payment providers
* multiple discount strategies
* multiple message processors
