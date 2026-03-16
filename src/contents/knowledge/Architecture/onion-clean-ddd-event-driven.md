---
id: onion-clean-ddd-event-driven
topic: Onion Architecture, Clean Architecture, DDD, and Event-Driven Architecture
category: Design & Architecture
---

## Overview

Modern .NET systems often combine several architectural concepts:

- **Onion Architecture**
- **Clean Architecture**
- **Domain-Driven Design (DDD)**
- **Event-Driven Architecture**

Each of these addresses a different aspect of system design:

```text
DDD → how business logic is modeled
Clean / Onion → how the codebase is structured
CQRS → how use cases are organized
Event-driven → how services communicate
````

Understanding how these concepts fit together helps design scalable, maintainable systems.

---

# 1. Onion Architecture

## What It Is

Onion Architecture is a software architecture pattern designed to build **maintainable, testable, and loosely coupled applications**.

Core rule:

```text
Dependencies always point inward toward the business logic.
```

Meaning:

```text
Business logic must not depend on
- databases
- frameworks
- UI
```

Instead, outer layers depend on inner layers.

---

## Core Idea

```text
The domain sits at the center and everything else depends on it.
```

---

## Onion Architecture Layers

Typical structure:

```text
API (UI)
↓
Infrastructure
↓
Application
↓
Domain
```

However, the **important rule is dependency direction**, not folder order.

Correct dependency graph:

```text
API → Application → Domain
Infrastructure → Application → Domain
Domain → nothing
```

---

## Typical .NET Onion Solution Structure

Example solution layout:

```text
src/

EmployeeManagement.Domain
    Entities/
    ValueObjects/
    Interfaces/

EmployeeManagement.Application
    DTOs/
    Services/
    Commands/
    Queries/

EmployeeManagement.Infrastructure
    Persistence/
    Repositories/
    ExternalServices/

EmployeeManagement.API
    Controllers/
    Middleware/
    Program.cs
```

---

# 2. Onion Architecture Is Not Inherently Service-Based

A common misconception.

Onion Architecture defines **dependency direction**, not coding style.

Multiple implementation styles are possible.

---

### Service-based style

```text
Application/Services/UserService.cs
Application/Services/OrderService.cs
```

---

### Use-case / handler style (CQRS)

```text
Application/Users/CreateUser/Handler.cs
Application/Users/DeactivateUser/Handler.cs
```

---

### Feature-based style

```text
Application/Users/
Application/Orders/
```

The architecture does **not require services or handlers**.

---

# 3. Clean Architecture vs Onion Architecture

They are extremely similar.

Both enforce the same core rule:

```text
Dependencies point inward toward business logic.
```

The main difference is **how code is organized**.

---

## Onion Architecture

Usually organized by **technical layers**.

Example:

```text
Domain
Application
Infrastructure
API
```

---

## Clean Architecture

Often organized by **use cases or features**.

Example:

```text
Application/Users/CreateUser
Application/Users/DeactivateUser
```

Often implemented with:

```text
CQRS
MediatR
Handlers
```

---

## Important Insight

```text
Onion vs Clean is mostly about code organization,
not architectural principles.
```

Both enforce the same dependency rule.

---

# 4. Domain-Driven Design (DDD)

DDD is a **software design approach** where system structure reflects business concepts.

The focus is modeling the **domain (business problem)**.

DDD includes concepts such as:

```text
Entities
Value Objects
Aggregates
Domain Events
Repositories
```

---

## Example Domain Entity

```csharp
public class Employee
{
    public string Email { get; private set; }

    public void ChangeEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new DomainException("Email required");

        Email = email;
    }
}
```

Important principle:

```text
Domain objects contain behavior, not just data.
```

---

## Value Objects

Example:

```csharp
public class Email
{
    public string Value { get; }

    public Email(string value)
    {
        if (!value.Contains("@"))
            throw new ArgumentException("Invalid email");

        Value = value;
    }
}
```

Value objects represent **immutable domain concepts**.

---

## Domain Events

Domain events represent things that **already happened**.

Examples:

```text
EmployeeCreated
OrderPaid
UserRegistered
```

Example:

```csharp
public record EmployeeCreated(Guid EmployeeId);
```

These events allow other parts of the system to react.

---

## Repository Interfaces

In DDD:

```text
Domain defines repository interfaces
Infrastructure implements them
```

Example interface:

```csharp
public interface IEmployeeRepository
{
    Task AddAsync(Employee employee);
}
```

Infrastructure implementation:

```csharp
public class EmployeeRepository : IEmployeeRepository
{
    private readonly AppDbContext _context;

    public Task AddAsync(Employee employee)
    {
        _context.Employees.Add(employee);
        return _context.SaveChangesAsync();
    }
}
```

---

# 5. Application Layer in DDD

The application layer orchestrates **use cases**.

Responsibilities:

```text
Coordinate domain logic
Call repositories
Handle transactions
```

Example use cases:

```text
CreateEmployee
DeactivateEmployee
RegisterUser
```

---

# 6. API Layer

The API layer acts as a **transport layer only**.

Responsibilities:

```text
HTTP handling
Authentication
Serialization
Routing
```

Controllers should **not contain business logic**.

---

# 7. Event-Driven Architecture

Event-driven architecture is a design style where components communicate via **events instead of direct calls**.

Instead of:

```text
Service A → calls → Service B
```

You publish an event:

```text
Service A → publishes event
Service B → subscribes
Service C → subscribes
```

---

## Example

Event:

```text
OrderCreated
```

Possible consumers:

```text
Billing Service
Notification Service
Analytics Service
```

Each component reacts independently.

---

# 8. Message Brokers

Event-driven systems usually rely on message brokers:

```text
Kafka
RabbitMQ
Azure Service Bus
```

---

# 9. Azure Service Bus Example

## Queue (Point-to-Point Messaging)

```text
Producer → Queue → Consumer
```

Each message is processed by **one consumer**.

Typical use cases:

```text
Background jobs
Commands
Processing pipelines
```

---

## Topic (Publish / Subscribe Messaging)

```text
Producer → Topic
             ↓
      Subscription A
      Subscription B
      Subscription C
```

Each subscription receives **its own copy**.

Typical use cases:

```text
Domain events
Integration events
Fan-out workflows
```

---

# 10. Example Flow in an Event-Driven System

Example workflow:

```text
User registers
↓
UserRegistered event published
↓
Email service sends welcome email
↓
Analytics service logs event
↓
Billing service creates account
```

No direct service-to-service calls are required.

---

# Quick Interview Summary

### Onion Architecture

```text
Architecture where dependencies point inward toward the domain,
keeping business logic independent from frameworks and infrastructure.
```

---

### Clean Architecture

```text
A layered architecture similar to Onion that organizes code around
use cases while keeping the domain independent of infrastructure.
```

---

### Domain-Driven Design (DDD)

```text
A design approach that models software based on business concepts
using entities, value objects, aggregates, and domain events.
```

---

### Event-Driven Architecture

```text
A system design where components communicate by publishing and
consuming events rather than calling each other directly.
```

---

# Practical Mental Model

Think about modern .NET backend architecture like this:

```text
DDD → how you model business logic

Clean / Onion → how you structure code

CQRS → how you organize use cases

Event-driven → how services communicate
```


---

## Notes

1. **Onion Architecture and Clean Architecture** are structural patterns focused on **dependency direction and separation of concerns**.
2. **DDD** focuses on **domain modeling**, not layering.
3. **Event-driven architecture** focuses on **communication between components or services**.
4. These approaches are often **combined together** in modern distributed systems and microservice architectures.
```
