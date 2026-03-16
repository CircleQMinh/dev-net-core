---
id: cqrs
topic: CQRS (Command Query Responsibility Segregation)
category: Design & Architecture
---

## Overview

**CQRS (Command Query Responsibility Segregation)** is an architectural pattern that separates operations that **change system state** from operations that **read data**.

In .NET applications:

- **Commands** modify system state and encapsulate business rules.
- **Queries** retrieve data and are optimized for reading.

CQRS can improve:

- clarity of responsibilities
- performance optimization
- scalability

However, it introduces additional complexity and should only be applied when the domain or performance requirements justify it.

---

#  What CQRS Really Means

CQRS separates:

```

Commands → write operations that change system state
Queries  → read operations that return data

````

### Command Rules

Commands:

- Change state
- Usually return minimal data (often nothing or an ID)
- Contain business logic and validation
- Produce side effects

### Query Rules

Queries:

- Read data only
- Must not change system state
- Can be optimized heavily for performance
- Usually return **DTOs**

### Example

```csharp
public record CreateUserCommand(string Email) : IRequest<Guid>;
````

```csharp
public record GetUserByIdQuery(Guid Id) : IRequest<UserDto>;
```

Breaking these rules weakens CQRS separation.

---

#  CQRS Is a Pattern, Not a Framework

CQRS is an **architectural pattern**, not a library or framework.

CQRS does **not automatically imply**:

* Microservices
* Event sourcing
* Separate databases

These technologies are often used together with CQRS but are **not required**.

---

#  MediatR Is Commonly Used in .NET

In .NET, CQRS is commonly implemented using **MediatR**.

CQRS defines the architecture, while MediatR helps enforce it.

MediatR provides:

* decoupling between controllers and business logic
* single-responsibility handlers
* pipeline behaviors (validation, logging, transactions)

### Example Handler

```csharp
public class CreateUserHandler
    : IRequestHandler<CreateUserCommand, Guid>
{
    public async Task<Guid> Handle(
        CreateUserCommand request,
        CancellationToken ct)
    {
        // business logic
    }
}
```

---

#  Validation Belongs to Commands (Not Controllers)

A common CQRS flow:

1. Controller receives request
2. Controller sends command through MediatR
3. Validation executes in pipeline behavior

Example:

```csharp
public class ValidationBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
{
    // FluentValidation logic here
}
```

### Benefits

* Controllers remain thin
* Validation is centralized
* Validation logic is reusable

---

#  Read Model ≠ Write Model (Important Concept)

CQRS separates the **write model** and **read model**.

### Write Model

* Domain entities
* Enforces business rules
* Uses aggregates and invariants

### Read Model

* DTOs
* Lightweight projections
* Optimized for queries

Avoid returning domain entities directly in query responses.

Example query projection:

```csharp
var users = await db.Users
    .Select(u => new UserDto
    {
        Id = u.Id,
        Name = u.Name
    })
    .ToListAsync();
```

Reads may use:

* EF Core projections
* Dapper
* SQL views

---

#  CQRS Does Not Require Separate Databases

A common misconception is that CQRS requires separate databases.

In many systems you can use:

* the same database
* the same tables
* different access patterns

CQRS focuses on **logical separation**, not physical separation.

---

### Simple CQRS Architecture

```
Controller
   ↓
Command Handler → EF Core → Database
   ↓
Query Handler → Dapper → Database
```

---

### Advanced CQRS Architecture

```
Write DB
   ↓
Event Bus
   ↓
Read DB (denormalized projections)
```

In advanced architectures, read models may be stored in a separate optimized database.

---

#  Where CQRS Shines

CQRS works well when:

* Write operations contain complex business rules
* Systems are heavily read-oriented
* Read and write workloads differ significantly
* Reporting or dashboards require optimized queries
* Clear domain boundaries improve maintainability

Typical systems using CQRS:

* Order management systems
* Financial systems
* Event-driven systems
* Large enterprise APIs

---

# Example Scenario

Order processing system.

### Commands

* CreateOrder
* CancelOrder
* AddOrderItem

### Queries

* GetOrders
* GetOrderDetails
* GetCustomerOrders

Commands enforce domain rules.

Queries return optimized projections.

---

# Benefits of CQRS

* Clear separation of responsibilities
* Easier unit testing
* Independent read/write optimization
* Improved scalability
* Better domain modeling

---

# Trade-offs

CQRS introduces additional complexity:

* More classes
* More handlers
* Additional infrastructure

CQRS should be avoided when:

* the application is simple CRUD
* domain logic is minimal
* performance requirements are low


---

## Notes

1. **CQRS vs CRUD**

Many systems that use CQRS still expose **CRUD-like APIs externally**.  
The difference lies in the **internal architecture**, not necessarily the API endpoints.

---

2. **DTO Usage**

Queries should return **DTOs instead of EF Core entities**.

Returning domain entities can leak domain logic and persistence concerns into the API layer.

---

3. **Read Optimization**

Queries can be optimized aggressively because they are side-effect free.

Common optimization techniques include:

- SQL views
- denormalized tables
- caching
- read replicas

---

4. **CQRS and Event-Driven Architecture**

CQRS is often combined with event-driven architecture:

Command → Domain Event → Read Model Projection


However, CQRS works perfectly **without event sourcing**.
```
