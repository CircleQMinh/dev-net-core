---
id: design-patterns-in-csharp
topic: Design Patterns in C#
category: Design & Architecture
---

## Repository Pattern

### What is the Repository Pattern?

The Repository Pattern encapsulates data access logic and provides a clean separation between the domain layer and the persistence layer.

### Code Example

```csharp
public interface IUserRepository
{
    Task<User> GetByIdAsync(Guid id);
    Task AddAsync(User user);
}

public class UserRepository : IUserRepository
{
    private readonly DbContext _context;

    public UserRepository(DbContext context)
    {
        _context = context;
    }

    public async Task<User> GetByIdAsync(Guid id)
        => await _context.Users.FindAsync(id);

    public async Task AddAsync(User user)
        => await _context.Users.AddAsync(user);
}
````

### Explanation

* `IUserRepository` defines methods for user data access.
* `UserRepository` implements this interface using Entity Framework’s `DbContext`.
* This pattern allows switching data sources or mocking data access during testing.

### Advantages

* Separation of concerns
* Easier unit testing with mock repositories
* Clean abstraction over data access logic

### Disadvantages

* Additional abstraction layer
* May be unnecessary for simple CRUD applications

---

## Unit of Work (UOW) Pattern

### What is the Unit of Work Pattern?

The Unit of Work pattern manages transactions and coordinates changes across multiple repositories to ensure consistency.

### Code Example

```csharp
public interface IUnitOfWork : IDisposable
{
    IUserRepository Users { get; }
    Task<int> CommitAsync();
}

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;

    public IUserRepository Users { get; }

    public UnitOfWork(AppDbContext context, IUserRepository users)
    {
        _context = context;
        Users = users;
    }

    public async Task<int> CommitAsync()
        => await _context.SaveChangesAsync();

    public void Dispose()
        => _context.Dispose();
}
```

### Explanation

* `IUnitOfWork` exposes repositories and a commit method.
* `UnitOfWork` wraps `DbContext` and coordinates repository operations.
* Ensures multiple changes are committed within the same transaction boundary.

### Advantages

* Manages changes across multiple repositories
* Centralized transaction handling
* Improves consistency and testability

### Disadvantages

* Adds architectural complexity
* Can tightly couple repositories to a specific persistence mechanism

---

## Singleton Pattern

### What is the Singleton Pattern?

The Singleton Pattern ensures a class has only one instance and provides a global access point.

### Code Example

```csharp
public sealed class Logger
{
    private static readonly Logger _instance = new Logger();

    public static Logger Instance => _instance;

    private Logger() { }

    public void Log(string message)
        => Console.WriteLine(message);
}
```

### Explanation

* The constructor is private to prevent external instantiation.
* The single instance is created once and exposed via the `Instance` property.
* Guarantees a single globally accessible instance.

### Advantages

* Controlled access to shared resources
* Reduces memory footprint for shared services

### Disadvantages

* Hard to mock and test
* Can introduce hidden dependencies and global state

---

## CQRS (Command Query Responsibility Segregation)

### What is CQRS?

CQRS separates read (query) operations from write (command) operations using different models.

### Code Example

```csharp
// Command
public class CreateOrderCommand
{
    public Guid CustomerId { get; set; }
    public List<Guid> ProductIds { get; set; }
}

// Query
public class GetOrderByIdQuery
{
    public Guid OrderId { get; set; }
}

// Handler (simplified)
public class OrderService
{
    public void Handle(CreateOrderCommand command)
    {
        // Logic to create an order
    }

    public Order Handle(GetOrderByIdQuery query)
    {
        // Logic to retrieve order details
        return new Order();
    }
}
```

### Explanation

* `CreateOrderCommand` represents a write operation.
* `GetOrderByIdQuery` represents a read operation.
* Each responsibility is separated for scalability and optimization.

### Advantages

* Clear separation between read and write logic
* Enables independent optimization of reads and writes
* Improves scalability

### Disadvantages

* Increased architectural complexity
* May be overkill for small applications

---

## Factory Pattern

### What is the Factory Pattern?

The Factory Pattern provides a way to create objects without exposing instantiation logic to the client.

### Code Example

```csharp
public interface INotificationService
{
    void Notify(string message);
}

public class EmailNotification : INotificationService
{
    public void Notify(string message)
        => Console.WriteLine($"Email: {message}");
}

public class NotificationFactory
{
    public static INotificationService Create(string type) => type switch
    {
        "email" => new EmailNotification(),
        _ => throw new NotImplementedException()
    };
}
```

### Explanation

* `INotificationService` defines a contract.
* `EmailNotification` implements the interface.
* `NotificationFactory.Create` centralizes object creation logic.

### Advantages

* Centralized object creation
* Supports Open/Closed Principle when extended properly

### Disadvantages

* Adds extra abstraction
* Can become complex if not designed carefully

---

## Notes

* The Unit of Work pattern is often unnecessary when using Entity Framework Core, since `DbContext` already acts as a Unit of Work and repository abstraction.
* The provided CQRS example uses a single service handling both commands and queries. In real CQRS implementations, commands and queries are typically handled by separate handlers (e.g., using MediatR).
* The Singleton example is thread-safe due to static initialization, but lazy initialization may require additional synchronization depending on implementation needs.

```