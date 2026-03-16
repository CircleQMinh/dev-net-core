---
id: clean-architecture
topic: Clean Architecture
category: Design & Architecture
---

## Overview

**Clean Architecture** is an architectural pattern that separates software into layers with clear responsibilities.
**Clean Architecture**is an architectural approach/style that organizes software into layers and enforces inward dependency flow.

Core rule:

```text
Dependencies must always point inward toward the domain.
````

Goal:

```text
Business logic should not depend on:
- frameworks
- UI
- database
```

This approach makes systems easier to **maintain, test, and evolve**.

---

# 1. What Problems Clean Architecture Solves

Clean Architecture addresses several common problems in large software systems.

### Reduced Coupling

Business logic becomes independent from frameworks such as:

```text
ASP.NET
Entity Framework
External APIs
```

---

### Better Testability

The **Domain** and **Application** layers can be tested without requiring:

```text
database
web server
infrastructure
```

---

### Business Rule Isolation

Business rules live in one place:

```text
Domain layer
```

instead of being scattered across controllers and services.

---

### Replaceable Infrastructure

Infrastructure implementations can be replaced without affecting business logic.

Examples:

```text
SQL Server → PostgreSQL
EF Core → Dapper
SMTP → SendGrid
```

---

### Long-Term Maintainability

As the system grows, the architecture helps maintain clarity and separation of concerns.

Interviewers usually care about **why it helps**, not just the definition.

---

# 2. Typical .NET Clean Architecture Layers

A typical .NET Clean Architecture implementation looks like this:

```text
        API
         ↓
    Application
         ↓
       Domain
         ↑
 Infrastructure
```

---

# 3. Responsibilities of Each Layer

---

# Domain Layer

The **core of the system**.

Contains **pure business logic**.

Typical contents:

```text
Entities
Value Objects
Domain Events
Business Rules
Domain Services
```

Example entity:

```csharp
public class Order
{
    public decimal Total { get; private set; }

    public void AddItem(decimal price)
    {
        Total += price;
    }
}
```

---

## Domain Should NOT Contain

```text
DbContext
Repository implementations
HTTP logic
Framework dependencies
```

The domain must remain **framework-independent**.

---

# Application Layer

This layer contains **use cases**.

It coordinates domain logic and infrastructure.

Typical contents:

```text
Commands / Queries
Use cases
DTOs
Interfaces (repositories/services)
Validation
Mapping
```

Example command:

```csharp
public record CreateOrderCommand(decimal Amount);
```

Example handler:

```csharp
public class CreateOrderHandler
{
    private readonly IOrderRepository _repo;

    public CreateOrderHandler(IOrderRepository repo)
    {
        _repo = repo;
    }

    public async Task Handle(CreateOrderCommand cmd)
    {
        var order = new Order(cmd.Amount);
        await _repo.AddAsync(order);
    }
}
```

---

# Infrastructure Layer

Contains **technical implementations**.

Examples:

```text
EF Core
Repository implementations
External APIs
Email services
File storage
```

Example repository:

```csharp
public class OrderRepository : IOrderRepository
{
    private readonly AppDbContext _context;

    public OrderRepository(AppDbContext context)
    {
        _context = context;
    }

    public Task AddAsync(Order order)
    {
        _context.Orders.Add(order);
        return _context.SaveChangesAsync();
    }
}
```

---

# API (Presentation Layer)

The outermost layer.

Handles:

```text
HTTP requests
Controllers
Authentication
Serialization
```

Example controller:

```csharp
[ApiController]
[Route("orders")]
public class OrdersController : ControllerBase
{
    private readonly IMediator _mediator;

    public OrdersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateOrderCommand command)
    {
        await _mediator.Send(command);
        return Ok();
    }
}
```

---

# 4. Dependency Direction (Critical Rule)

Dependencies always point **inward**.

Safe dependency graph:

```text
API → Application → Domain
Infrastructure → Application → Domain
Domain → (nothing)
```

The **Domain layer must not depend on anything else**.

---

# 5. What Belongs in the Domain Layer

Correct contents:

```text
Entities
Value Objects
Domain Logic
Domain Events
Business invariants
```

Example invariant:

```csharp
public void ChangeEmail(string email)
{
    if (string.IsNullOrWhiteSpace(email))
        throw new DomainException("Email required");

    Email = email;
}
```

---

# 6. What Belongs in the Application Layer

Responsibilities of the Application layer:

```text
Use cases (Commands / Queries)
Repository interfaces
Validation
DTO mapping
Application services
```

Example components:

```text
CreateOrderCommand
CreateOrderHandler
IOrderRepository
```

---

# 7. Where Should Validation Live?

Correct answer:

```text
Application layer
```

Reason:

```text
Validation belongs to use cases.
```

Example using FluentValidation:

```csharp
public class CreateOrderValidator : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderValidator()
    {
        RuleFor(x => x.Amount).GreaterThan(0);
    }
}
```

---

### Exception: Domain Validation

Domain validation should enforce **business invariants**.

Example:

```text
Order total cannot be negative
```

---

# 8. Where Should Mapping (AutoMapper) Live?

Usually located in the:

```text
Application layer
```

Reason:

```text
DTO ↔ Domain conversions occur at use-case boundaries.
```

---

# 9. Where Should Transactions Be Handled?

Transactions are typically handled at the **use-case boundary**.
Transaction boundaries are usually controlled around the application use case, while the underlying transaction mechanism is implemented by infrastructure/persistence technology.
Most common solutions:

```text
Application layer
```

Typical implementations:

```text
MediatR pipeline behavior
Unit of Work (DbContext)
```

Example flow:

```text
Command → Handler → SaveChanges
```

---

# 10. Layer Dependency Rules

| Layer          | Can reference                               |
| -------------- | ------------------------------------------- |
| API            | Application (+ Infrastructure for DI setup) |
| Infrastructure | Application, Domain                         |
| Application    | Domain                                      |
| Domain         | Nothing                                     |

![Unit test example](../knowledge-images/cleanA.png)

---

# 11. Quick Interview Answer

If asked:

**What is Clean Architecture?**

Good concise answer:

```text
Clean Architecture separates software into layers where
core business logic is independent from frameworks,
UI, and databases. Dependencies always point inward,
making the system easier to test, maintain, and evolve.
```

---

# 12. Quick Mental Model

Think about layers like this:

```text
Domain → Business rules
Application → Use cases
Infrastructure → Technical details
API → HTTP interface
```

---

# 13. Real .NET Project Structure Example

Typical solution layout:

```text
src/

MyApp.Domain
MyApp.Application
MyApp.Infrastructure
MyApp.API
```

---

# 14. Practical Example Flow

Typical request flow:

```text
HTTP Request
↓
Controller (API)
↓
Command Handler (Application)
↓
Entity logic (Domain)
↓
Repository (Infrastructure)
↓
Database
```

---

# 15. Real Benefits in Large Systems

Clean Architecture becomes powerful when:

```text
System grows
Multiple teams contribute
Infrastructure changes
Business rules evolve
```



---

## Notes

1. Clean Architecture is **primarily about dependency direction**, not simply having multiple layers.
2. In many .NET systems, Clean Architecture is combined with:

```text
CQRS
MediatR
DDD-lite
````

3. Small projects often do **not need full Clean Architecture** because the additional structure can introduce unnecessary complexity.
