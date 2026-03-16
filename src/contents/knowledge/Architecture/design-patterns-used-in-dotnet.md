---
id: design-patterns-used-in-dotnet
topic: Design Patterns Every .NET Developer Actually Uses
category: Design & Architecture
---

## Overview

Modern .NET development uses many design patterns in practical, framework-driven ways.

These patterns appear throughout:

- ASP.NET Core
- EF Core
- MediatR
- Clean Architecture / DDD-style applications

The key idea is not memorizing pattern definitions, but understanding how they solve real engineering problems.

---

#  Dependency Injection (DI)

## Core Idea

Objects **receive dependencies instead of creating them**.

```text
Don't create dependencies inside classes.
Inject them.
````

---

## Example

```csharp
public class OrderService
{
    private readonly IPaymentService _payment;

    public OrderService(IPaymentService payment)
    {
        _payment = payment;
    }

    public void Checkout(Order order)
    {
        _payment.Process(order.Total);
    }
}
```

Registration:

```csharp
services.AddScoped<IPaymentService, StripePaymentService>();
```

---

## Why It Matters

Benefits:

* Loose coupling
* Easier testing
* Easy implementation swapping
* Foundation of ASP.NET Core architecture

---

#  Middleware Pattern (Chain of Responsibility)

ASP.NET Core middleware is an implementation of the **Chain of Responsibility** pattern.

Mental model:

```text
Request
 ↓
Middleware A
 ↓
Middleware B
 ↓
Middleware C
 ↓
Controller
```

Each middleware can:

* handle the request
* modify the request/response
* pass control to the next middleware

---

## Example

```csharp
app.Use(async (context, next) =>
{
    Console.WriteLine("Before request");

    await next();

    Console.WriteLine("After request");
});
```

Common middleware examples:

* Authentication
* Authorization
* Rate limiting
* Logging
* Exception handling

---

#  Strategy Pattern

The Strategy pattern allows **multiple interchangeable algorithms or behaviors**.

It is extremely common with dependency injection.

Example use case:

* multiple payment providers

---

## Strategy Interface

```csharp
public interface IPaymentProvider
{
    Task ProcessAsync(decimal amount);
}
```

Implementations:

```csharp
public class StripePayment : IPaymentProvider { }
public class PaypalPayment : IPaymentProvider { }
public class ApplePayPayment : IPaymentProvider { }
```

Resolver:

```csharp
public class PaymentResolver
{
    private readonly IEnumerable<IPaymentProvider> _providers;

    public PaymentResolver(IEnumerable<IPaymentProvider> providers)
    {
        _providers = providers;
    }
}
```

This pattern appears frequently in enterprise applications.

---

#  Factory Pattern

The ASP.NET Core DI container behaves like a **Factory**.

Instead of manually creating services:

```csharp
var service = new UserService();
```

You resolve them through the container:

```csharp
var service = serviceProvider.GetRequiredService<IUserService>();
```

The container decides:

* which implementation to create
* how to build dependencies
* how to manage object lifetimes

---

#  Repository Pattern

The Repository pattern abstracts data access.

Instead of writing EF Core queries directly in services, repositories encapsulate persistence logic.

---

## Example

```csharp
public interface IUserRepository
{
    Task<User> GetById(Guid id);
}
```

Implementation:

```csharp
public class UserRepository : IUserRepository
{
    private readonly AppDbContext _db;

    public UserRepository(AppDbContext db)
    {
        _db = db;
    }

    public Task<User> GetById(Guid id)
    {
        return _db.Users.FindAsync(id).AsTask();
    }
}
```

---

## Why It Is Useful

* Separates domain logic from persistence
* Improves testability
* Supports cleaner architecture

It is often used with:

* DDD
* Clean Architecture
* Onion Architecture

---

#  Unit of Work Pattern

The Unit of Work pattern coordinates **transactions across multiple operations**.

In EF Core, `DbContext` already acts as a Unit of Work.

Example:

```csharp
await db.SaveChangesAsync();
```

This commits all tracked changes in a single unit.

---

#  Mediator Pattern (MediatR)

The Mediator pattern decouples senders from handlers.

Instead of:

```text
Controller → Service → Service → Service
```

You use:

```text
Controller → Mediator → Handler
```

---

## Example

Command:

```csharp
public record CreateUserCommand(string Email) : IRequest<Guid>;
```

Handler:

```csharp
public class CreateUserHandler
    : IRequestHandler<CreateUserCommand, Guid>
{
    public async Task<Guid> Handle(
        CreateUserCommand request,
        CancellationToken ct)
    {
        // business logic
        return Guid.NewGuid();
    }
}
```

Controller:

```csharp
await _mediator.Send(new CreateUserCommand(email));
```

---

## Benefits

* Thin controllers
* Cleaner request flow
* Supports pipeline behaviors
* Fits naturally with CQRS

---

#  Decorator Pattern

The Decorator pattern adds behavior **without modifying the original implementation**.

This is very common with MediatR pipeline behaviors.

Mental model:

```text
Handler → LoggingDecorator → ActualHandler
```

Pipeline behavior example:

```csharp
public class LoggingBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        // logging before
        var response = await next();
        // logging after
        return response;
    }
}
```

Common uses:

* Logging
* Validation
* Caching
* Retry logic

---

#  Builder Pattern

The Builder pattern is useful when creating **complex objects step by step**.

Example:

```csharp
var client = new HttpClientBuilder()
    .WithTimeout(30)
    .WithRetry(3)
    .Build();
```

Also common in:

* configuration builders
* query builders
* HTTP client builders

---

#  Adapter Pattern

The Adapter pattern lets **incompatible interfaces work together**.

It is commonly used when integrating with third-party APIs or legacy libraries.

---

## Example

External library:

```csharp
ExternalPaymentApi.Charge(amount);
```

Adapter:

```csharp
public class PaymentAdapter : IPaymentService
{
    public void Process(decimal amount)
    {
        ExternalPaymentApi.Charge(amount);
    }
}
```

Your application depends on `IPaymentService`, not the external library directly.

---

# Real Patterns Used in ASP.NET Core

| Framework Feature  | Pattern                 |
| ------------------ | ----------------------- |
| Middleware         | Chain of Responsibility |
| DI Container       | Factory                 |
| MediatR            | Mediator                |
| Pipeline Behaviors | Decorator               |
| Repositories       | Repository              |
| DbContext          | Unit of Work            |
| Payment providers  | Strategy                |
| HttpClientBuilder  | Builder                 |
| External APIs      | Adapter                 |

---

# Practical Architecture Example

A common modern .NET backend flow:

```text
Controller
   ↓
Mediator (CQRS)
   ↓
Command / Query Handler
   ↓
Repository
   ↓
DbContext
   ↓
Database
```

Cross-cutting concerns such as:

* Logging
* Validation
* Caching
* Retries

are often handled through:

```text
Middleware
Decorators
Pipeline behaviors
```

---

# Interview Summary

If asked:

### What design patterns do you actually use in .NET?

A strong practical answer is:

```text
Dependency Injection
Middleware (Chain of Responsibility)
Strategy
Factory (DI container)
Repository
Unit of Work (DbContext)
Mediator (MediatR)
Decorator (pipeline behaviors)
Builder
Adapter
```

These patterns appear in **almost every modern .NET backend**.



---

## Notes

1. Many of these patterns appear **implicitly through ASP.NET Core and EF Core**, even when developers do not explicitly name them.
2. The example `HttpClientBuilder` is conceptual. In real .NET applications, a more common example is `IHttpClientFactory` or builder-style configuration APIs rather than a literal built-in `HttpClientBuilder` class in general app code.
3. `DbContext` is often treated as a Unit of Work, but whether to add a separate Repository/Unit of Work abstraction on top of EF Core depends on architecture style and project needs.
4. Overusing patterns can reduce readability. They should be applied only when they solve real complexity.
```
