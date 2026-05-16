---
id: object-oriented-fundamentals
topic: C# Language Foundations
subtopic: Object-Oriented Programming
category: .NET
---


## Overview

Object-Oriented Programming, usually called OOP, is a programming paradigm that organizes software around objects. An object represents a concept in the problem domain and combines data with behavior. In C#, objects are usually created from classes, records, or structs, and they interact through methods, properties, interfaces, events, and other type members.

OOP matters because most production C# applications are built around object-oriented ideas. ASP.NET Core controllers, services, repositories, Entity Framework Core entities, domain models, background workers, validators, middleware, and dependency injection registrations all depend on understanding how types, objects, interfaces, inheritance, and polymorphism work.

In interviews, OOP is important because it tests both language knowledge and design thinking. A candidate should not only know definitions such as encapsulation, abstraction, inheritance, and polymorphism, but also understand when to use them, when not to use them, and how they affect maintainability, testing, extensibility, and real-world application design.

A strong interview answer should connect OOP concepts to practical C# development. For example, interfaces are not only a theory topic; they are used heavily in dependency injection, unit testing, clean architecture, plugin systems, and API design. Inheritance is not only code reuse; it can support polymorphism but can also create fragile and tightly coupled designs when overused.

## Core Concepts

### Classes and Objects

A class is a blueprint for creating objects. It defines data and behavior through members such as fields, properties, methods, constructors, events, operators, indexers, and nested types.

An object is an instance of a class at runtime. Each object has its own state unless the state is stored in static members.

```csharp
public class BankAccount
{
    private decimal _balance;

    public string AccountNumber { get; }

    public BankAccount(string accountNumber, decimal openingBalance)
    {
        AccountNumber = accountNumber;
        _balance = openingBalance;
    }

    public decimal GetBalance()
    {
        return _balance;
    }

    public void Deposit(decimal amount)
    {
        if (amount <= 0)
            throw new ArgumentException("Deposit amount must be positive.");

        _balance += amount;
    }
}
```

In this example, `BankAccount` is the class, and each created account is an object with its own account number and balance.

```csharp
var account = new BankAccount("ACC-001", 1000m);
account.Deposit(250m);
```

Key points:

- A class defines structure and behavior.
- An object is a runtime instance of a class.
- Instance members belong to each object.
- Static members belong to the type itself.
- Constructors initialize objects into a valid state.

Common mistake: creating classes that only expose public fields and contain no meaningful behavior. This usually leads to weak encapsulation and scattered business logic.

### Members of a C# Type

A C# class can contain different kinds of members:

- Fields: store data internally.
- Properties: expose data in a controlled way.
- Methods: define behavior.
- Constructors: initialize new instances.
- Events: notify other objects that something happened.
- Indexers: allow objects to be accessed like arrays.
- Operators: customize operator behavior.
- Nested types: define helper types inside another type.

Example using fields, properties, and methods:

```csharp
public class Product
{
    private decimal _price;

    public string Name { get; set; } = string.Empty;

    public decimal Price
    {
        get => _price;
        set
        {
            if (value < 0)
                throw new ArgumentException("Price cannot be negative.");

            _price = value;
        }
    }

    public decimal CalculateDiscountedPrice(decimal discountPercentage)
    {
        return Price - (Price * discountPercentage / 100);
    }
}
```

Best practice: keep fields private and expose controlled access through properties or methods. This protects object state and makes future changes safer.

### Encapsulation

Encapsulation means hiding internal implementation details and exposing only a safe public API. It protects object state from invalid changes and keeps business rules close to the data they protect.

Poor encapsulation:

```csharp
public class Order
{
    public decimal TotalAmount;
    public string Status = "Draft";
}
```

Any code can change the order to an invalid state:

```csharp
order.TotalAmount = -100;
order.Status = "Unknown";
```

Better encapsulation:

```csharp
public class Order
{
    private readonly List<OrderItem> _items = new();

    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();
    public OrderStatus Status { get; private set; } = OrderStatus.Draft;
    public decimal TotalAmount => _items.Sum(item => item.TotalPrice);

    public void AddItem(OrderItem item)
    {
        if (Status != OrderStatus.Draft)
            throw new InvalidOperationException("Cannot add items after order submission.");

        _items.Add(item);
    }

    public void Submit()
    {
        if (!_items.Any())
            throw new InvalidOperationException("Cannot submit an empty order.");

        Status = OrderStatus.Submitted;
    }
}
```

The object controls its own state. Other code cannot directly set `Status` or modify the internal list.

Encapsulation is commonly used in:

- Domain entities
- Value objects
- Business rule validation
- API models
- Service classes
- EF Core entities
- Configuration classes

Trade-offs:

- Strong encapsulation improves correctness and maintainability.
- Too much hiding can make objects difficult to use or test.
- Public setters are convenient but can make invalid states easier to create.

Best practices:

- Prefer private fields with public methods or properties when validation is needed.
- Use private setters when only the class should change a value.
- Expose collections as `IReadOnlyCollection<T>` instead of mutable `List<T>` when callers should not modify them directly.
- Keep business rules close to the object that owns the data.

### Abstraction

Abstraction means exposing essential behavior while hiding unnecessary implementation details. In C#, abstraction is commonly achieved through interfaces, abstract classes, base classes, and carefully designed public APIs.

Example:

```csharp
public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body);
}
```

The caller does not need to know whether the email is sent through SMTP, SendGrid, Azure Communication Services, or another provider.

```csharp
public class NotificationService
{
    private readonly IEmailSender _emailSender;

    public NotificationService(IEmailSender emailSender)
    {
        _emailSender = emailSender;
    }

    public Task NotifyUserAsync(string email)
    {
        return _emailSender.SendAsync(
            email,
            "Welcome",
            "Your account has been created.");
    }
}
```

Abstraction is important because it helps with:

- Dependency injection
- Unit testing
- Loose coupling
- Clean architecture
- Replacing implementations without changing callers
- Plugin-style designs
- Separating business logic from infrastructure

Common interview point: abstraction is not the same as an abstract class. Abstraction is a design idea. An abstract class is one C# language feature that can implement that idea.

Trade-offs:

- Good abstractions make systems flexible and testable.
- Too many abstractions can make code harder to understand.
- Interfaces with too many members become difficult to implement.
- Abstractions should usually be based on real variation, not imaginary future requirements.

Best practices:

- Create interfaces around behavior, not around every class by default.
- Keep interfaces small and focused.
- Let application and domain layers depend on abstractions, while infrastructure provides implementations.
- Avoid abstractions that have only one implementation unless they are useful for testing, boundaries, or future extension.

### Inheritance

Inheritance allows one class to derive from another class. The derived class reuses, extends, or modifies behavior from the base class.

```csharp
public abstract class Employee
{
    public string Name { get; }

    protected Employee(string name)
    {
        Name = name;
    }

    public abstract decimal CalculatePay();
}

public class FullTimeEmployee : Employee
{
    public decimal MonthlySalary { get; }

    public FullTimeEmployee(string name, decimal monthlySalary)
        : base(name)
    {
        MonthlySalary = monthlySalary;
    }

    public override decimal CalculatePay()
    {
        return MonthlySalary;
    }
}

public class Contractor : Employee
{
    public decimal HourlyRate { get; }
    public int HoursWorked { get; }

    public Contractor(string name, decimal hourlyRate, int hoursWorked)
        : base(name)
    {
        HourlyRate = hourlyRate;
        HoursWorked = hoursWorked;
    }

    public override decimal CalculatePay()
    {
        return HourlyRate * HoursWorked;
    }
}
```

C# supports single inheritance for classes. A class can inherit from only one direct base class, but it can implement multiple interfaces.

Important inheritance keywords:

- `base`: calls a base class constructor or member.
- `virtual`: allows a method or property to be overridden.
- `override`: provides a new implementation for a virtual or abstract member.
- `abstract`: declares an incomplete type or member that derived classes must implement.
- `sealed`: prevents a class from being inherited or prevents an override from being overridden again.
- `protected`: allows access inside the class and derived classes.

Example of `virtual` and `override`:

```csharp
public class ReportExporter
{
    public virtual string Export()
    {
        return "Exporting report";
    }
}

public class PdfReportExporter : ReportExporter
{
    public override string Export()
    {
        return "Exporting report as PDF";
    }
}
```

Use inheritance when there is a real `is-a` relationship and derived classes can safely substitute the base class.

Good example:

```text
FullTimeEmployee is an Employee.
Contractor is an Employee.
```

Weak example:

```text
InvoicePrinter inherits from Invoice.
```

An invoice printer is not an invoice. It probably should use composition instead.

Trade-offs:

- Inheritance can reduce duplication and support polymorphism.
- Deep inheritance hierarchies are difficult to understand and maintain.
- Base class changes can accidentally break derived classes.
- Inheritance creates strong coupling between base and derived classes.

Best practices:

- Prefer shallow inheritance hierarchies.
- Use inheritance for stable domain relationships.
- Prefer composition for flexible behavior reuse.
- Make base classes `abstract` when they are not meant to be instantiated directly.
- Use `sealed` when a class or override should not be extended.

### Polymorphism

Polymorphism means that different types can be treated through a common abstraction while providing different behavior.

In C#, polymorphism commonly appears through:

- Base class references
- Interface references
- Virtual and overridden methods
- Abstract methods
- Method overloading
- Generic constraints

Runtime polymorphism example:

```csharp
var employees = new List<Employee>
{
    new FullTimeEmployee("Alice", 5000m),
    new Contractor("Bob", 50m, 120)
};

foreach (Employee employee in employees)
{
    Console.WriteLine(employee.CalculatePay());
}
```

The compile-time type is `Employee`, but the runtime object may be `FullTimeEmployee` or `Contractor`. C# calls the correct overridden method at runtime.

Interface polymorphism example:

```csharp
public interface IPaymentProcessor
{
    Task ProcessAsync(decimal amount);
}

public class CreditCardPaymentProcessor : IPaymentProcessor
{
    public Task ProcessAsync(decimal amount)
    {
        Console.WriteLine($"Processing {amount} by credit card");
        return Task.CompletedTask;
    }
}

public class BankTransferPaymentProcessor : IPaymentProcessor
{
    public Task ProcessAsync(decimal amount)
    {
        Console.WriteLine($"Processing {amount} by bank transfer");
        return Task.CompletedTask;
    }
}
```

The caller can depend on `IPaymentProcessor` without knowing the concrete payment type.

Important comparison:

| Concept | Meaning | When Resolved |
|---|---|---|
| Method overloading | Same method name, different parameters | Compile time |
| Method overriding | Derived class changes virtual or abstract base behavior | Runtime |
| Method hiding with `new` | Derived member hides base member without true polymorphic override | Depends on reference type |

Example showing overriding vs hiding:

```csharp
public class BaseLogger
{
    public virtual void Log() => Console.WriteLine("Base log");
}

public class GoodLogger : BaseLogger
{
    public override void Log() => Console.WriteLine("Good logger");
}

public class HidingLogger : BaseLogger
{
    public new void Log() => Console.WriteLine("Hiding logger");
}
```

```csharp
BaseLogger logger1 = new GoodLogger();
logger1.Log(); // Good logger

BaseLogger logger2 = new HidingLogger();
logger2.Log(); // Base log
```

Common mistake: using `new` when `override` was intended. This can create confusing behavior because method hiding is not normal runtime polymorphism.

### Interfaces

An interface defines a contract that a class, struct, or record can implement. It describes what a type can do, not how it does it.

```csharp
public interface IRepository<T>
{
    Task<T?> GetByIdAsync(Guid id);
    Task AddAsync(T entity);
}
```

A class implements the interface:

```csharp
public class ProductRepository : IRepository<Product>
{
    private readonly AppDbContext _dbContext;

    public ProductRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<Product?> GetByIdAsync(Guid id)
    {
        return _dbContext.Products.FindAsync(id).AsTask();
    }

    public async Task AddAsync(Product entity)
    {
        _dbContext.Products.Add(entity);
        await _dbContext.SaveChangesAsync();
    }
}
```

Interfaces are heavily used in C# for:

- Dependency injection
- Unit testing and mocking
- Repository patterns
- Strategy patterns
- Clean architecture boundaries
- External service boundaries
- Multiple behavior contracts

A class can implement multiple interfaces:

```csharp
public class FileStorageService : IFileUploader, IFileDownloader, IFileDeleter
{
    // Implementation
}
```

Best practices:

- Name interfaces with an `I` prefix, such as `ILogger`, `IRepository`, or `IEmailSender`.
- Keep interfaces focused on a single responsibility.
- Avoid large interfaces that force implementers to provide methods they do not need.
- Prefer interfaces when multiple unrelated types need to share behavior.
- Prefer abstract classes when you need shared state, protected members, constructors, or common implementation.

Common mistake: creating an interface for every class automatically. This can add unnecessary complexity if there is no real need for abstraction, substitution, or testability boundary.

### Abstract Classes

An abstract class is a class that cannot be instantiated directly. It can contain abstract members, concrete members, fields, constructors, and protected helper methods.

```csharp
public abstract class FileParser
{
    public async Task<IReadOnlyList<string>> ParseAsync(string path)
    {
        var content = await File.ReadAllTextAsync(path);
        return ParseContent(content);
    }

    protected abstract IReadOnlyList<string> ParseContent(string content);
}

public class CsvFileParser : FileParser
{
    protected override IReadOnlyList<string> ParseContent(string content)
    {
        return content.Split(',');
    }
}
```

This pattern is useful when the base class owns a common workflow and derived classes customize specific steps.

Abstract class vs interface:

| Feature | Interface | Abstract Class |
|---|---|---|
| Purpose | Defines a contract | Defines a base type with optional shared implementation |
| Multiple inheritance | A class can implement many interfaces | A class can inherit from only one class |
| Fields | Cannot contain instance fields | Can contain fields |
| Constructors | No instance constructors | Can have constructors |
| Access modifiers | Members are usually public contracts | Can use protected members for derived classes |
| Best use | Shared capability across types | Shared base behavior for related types |

Best practice: choose an interface when you only need a contract. Choose an abstract class when related types need shared implementation or protected extensibility points.

### Access Modifiers

Access modifiers control where types and members can be used.

Common access modifiers:

| Modifier | Meaning |
|---|---|
| `public` | Accessible from any code that can access the containing type |
| `private` | Accessible only inside the same type |
| `protected` | Accessible inside the same type and derived types |
| `internal` | Accessible only within the same assembly |
| `protected internal` | Accessible within the same assembly or from derived types in another assembly |
| `private protected` | Accessible inside the same type or derived types in the same assembly |

Example:

```csharp
public class Customer
{
    private string _secretNote = string.Empty;

    public string Name { get; private set; }

    protected DateTime CreatedAt { get; } = DateTime.UtcNow;

    internal bool IsVerified { get; set; }

    public Customer(string name)
    {
        Name = name;
    }
}
```

Why access modifiers matter in interviews:

- They are central to encapsulation.
- They affect API design.
- They control inheritance behavior.
- They help prevent accidental misuse.
- They are frequently used in library and domain model design.

Best practices:

- Use the most restrictive access level that still supports the required behavior.
- Avoid making members `public` just for convenience.
- Use `protected` carefully because it becomes part of the inheritance contract.
- Use `internal` for implementation details inside one assembly.

### Properties, Fields, and Methods

A field stores data. A property exposes data through accessors. A method performs an action or calculation.

```csharp
public class User
{
    private string _email = string.Empty;

    public string Email
    {
        get => _email;
        set
        {
            if (!value.Contains('@'))
                throw new ArgumentException("Invalid email address.");

            _email = value;
        }
    }

    public bool HasCompanyEmail()
    {
        return Email.EndsWith("@company.com", StringComparison.OrdinalIgnoreCase);
    }
}
```

Use fields for internal storage. Use properties when callers need controlled access. Use methods when the operation represents behavior, validation, business logic, or a meaningful action.

Auto-properties are useful when no custom logic is needed:

```csharp
public string FirstName { get; set; } = string.Empty;
```

Init-only properties are useful for object initialization while keeping the object mostly immutable afterward:

```csharp
public class CreateUserRequest
{
    public required string Email { get; init; }
    public required string DisplayName { get; init; }
}
```

Best practices:

- Avoid public fields in most application code.
- Use `private set` when only the class should modify a property after construction.
- Use `init` for values that should be assigned during object creation only.
- Use `required` when callers must provide a value during initialization.
- Avoid putting expensive operations inside property getters; use methods for operations with noticeable cost or side effects.

### Constructors and Object Initialization

A constructor initializes an object. Constructors should leave the object in a valid state.

```csharp
public class Money
{
    public decimal Amount { get; }
    public string Currency { get; }

    public Money(decimal amount, string currency)
    {
        if (string.IsNullOrWhiteSpace(currency))
            throw new ArgumentException("Currency is required.");

        Amount = amount;
        Currency = currency;
    }
}
```

Constructor chaining uses `this` or `base`:

```csharp
public class ApiClient
{
    public string BaseUrl { get; }
    public TimeSpan Timeout { get; }

    public ApiClient(string baseUrl)
        : this(baseUrl, TimeSpan.FromSeconds(30))
    {
    }

    public ApiClient(string baseUrl, TimeSpan timeout)
    {
        BaseUrl = baseUrl;
        Timeout = timeout;
    }
}
```

Best practices:

- Validate required constructor arguments.
- Keep constructors simple.
- Avoid heavy I/O work inside constructors.
- Use dependency injection to provide dependencies.
- Use object initializers for simple data transfer objects.
- Use constructors or factory methods for domain objects that require validation.

### Static Members

Static members belong to the type itself instead of a specific object instance.

```csharp
public static class TaxCalculator
{
    public static decimal CalculateVat(decimal amount, decimal rate)
    {
        return amount * rate;
    }
}
```

Static members are useful for stateless utility behavior, constants, factory methods, and shared metadata.

Trade-offs:

- Static methods are simple to call.
- Static state can make testing harder.
- Static mutable state can create concurrency issues.
- Static dependencies are harder to replace than injected dependencies.

Best practice: use static classes for pure utility functions. Avoid static mutable state in web applications unless it is carefully synchronized and intentionally shared.

### Composition

Composition means building a type by containing and using other types. It represents a `has-a` relationship.

```csharp
public interface IDiscountPolicy
{
    decimal ApplyDiscount(decimal amount);
}

public class PercentageDiscountPolicy : IDiscountPolicy
{
    private readonly decimal _percentage;

    public PercentageDiscountPolicy(decimal percentage)
    {
        _percentage = percentage;
    }

    public decimal ApplyDiscount(decimal amount)
    {
        return amount - (amount * _percentage / 100);
    }
}

public class CheckoutService
{
    private readonly IDiscountPolicy _discountPolicy;

    public CheckoutService(IDiscountPolicy discountPolicy)
    {
        _discountPolicy = discountPolicy;
    }

    public decimal CalculateTotal(decimal subtotal)
    {
        return _discountPolicy.ApplyDiscount(subtotal);
    }
}
```

`CheckoutService` has a discount policy. It does not inherit from a discount policy.

Composition is often preferred over inheritance because it creates more flexible designs. Behavior can be changed by injecting a different dependency instead of creating a new subclass.

Inheritance vs composition:

| Concept | Relationship | Use When |
|---|---|---|
| Inheritance | `is-a` | A derived type is a true specialization of a base type |
| Composition | `has-a` or `uses-a` | A type needs behavior from another type without becoming that type |

Best practices:

- Prefer composition for behavior reuse.
- Use inheritance for stable type hierarchies.
- Use interfaces with composition to support substitution.
- Avoid deep inheritance trees when strategies or services would be simpler.

### Records, Classes, and Structs

C# supports several type choices that are relevant to OOP design.

Classes:

- Reference types.
- Usually used for objects with identity and behavior.
- Support inheritance.
- Common for services, entities, controllers, and domain models.

Records:

- Reference types by default, unless declared as `record struct`.
- Designed for immutable or value-like data models.
- Provide built-in value-based equality behavior.
- Useful for DTOs, commands, queries, events, and result objects.

Structs:

- Value types.
- Copied by value unless passed by reference.
- Useful for small, lightweight values.
- Cannot inherit from other structs or classes, but can implement interfaces.

Example record:

```csharp
public record Address(string Street, string City, string Country);
```

Example class:

```csharp
public class Customer
{
    public Guid Id { get; }
    public string Name { get; private set; }

    public Customer(Guid id, string name)
    {
        Id = id;
        Name = name;
    }
}
```

Use classes when identity and lifecycle matter. Use records when value equality and immutability are useful. Use structs for small values where copying is acceptable and intentional.

Common mistake: using a struct for a large mutable object. This can cause unexpected copies and confusing behavior.

### Reference Equality and Value Equality

Reference equality checks whether two variables refer to the same object instance. Value equality checks whether two values are logically equal.

Class example:

```csharp
var customer1 = new Customer(Guid.NewGuid(), "Alice");
var customer2 = new Customer(customer1.Id, "Alice");

Console.WriteLine(customer1 == customer2); // Usually false for normal classes
```

Record example:

```csharp
public record ProductDto(int Id, string Name);

var product1 = new ProductDto(1, "Laptop");
var product2 = new ProductDto(1, "Laptop");

Console.WriteLine(product1 == product2); // True
```

Interview key point: normal classes use reference equality unless equality is overridden. Records are designed for value-based equality.

Best practices:

- Use records for immutable data models where value equality is expected.
- Override `Equals` and `GetHashCode` carefully when custom class equality is required.
- Be careful when using mutable properties in equality logic.

### SOLID Principles and OOP Design

SOLID principles are commonly discussed in OOP interviews because they show how to design maintainable object-oriented systems.

Single Responsibility Principle:

A class should have one main reason to change.

Poor example:

```csharp
public class InvoiceService
{
    public void CalculateTotal() { }
    public void SaveToDatabase() { }
    public void SendEmail() { }
    public void GeneratePdf() { }
}
```

Better design separates responsibilities:

```csharp
public class InvoiceCalculator { }
public class InvoiceRepository { }
public class InvoiceEmailService { }
public class InvoicePdfGenerator { }
```

Open/Closed Principle:

Software should be open for extension but closed for modification. New behavior should often be added by adding new types instead of changing existing stable code.

```csharp
public interface IShippingCostCalculator
{
    decimal Calculate(Order order);
}

public class StandardShippingCalculator : IShippingCostCalculator
{
    public decimal Calculate(Order order) => 10m;
}

public class ExpressShippingCalculator : IShippingCostCalculator
{
    public decimal Calculate(Order order) => 25m;
}
```

Liskov Substitution Principle:

A derived type should be usable wherever its base type is expected without breaking expected behavior.

Common violation:

```csharp
public class Bird
{
    public virtual void Fly() { }
}

public class Penguin : Bird
{
    public override void Fly()
    {
        throw new NotSupportedException();
    }
}
```

A better model separates flying behavior from bird identity.

Interface Segregation Principle:

Clients should not be forced to depend on methods they do not use.

Poor example:

```csharp
public interface IMachine
{
    void Print();
    void Scan();
    void Fax();
}
```

Better:

```csharp
public interface IPrinter
{
    void Print();
}

public interface IScanner
{
    void Scan();
}

public interface IFaxMachine
{
    void Fax();
}
```

Dependency Inversion Principle:

High-level modules should depend on abstractions, not concrete implementation details.

```csharp
public class ReportService
{
    private readonly IReportRepository _repository;

    public ReportService(IReportRepository repository)
    {
        _repository = repository;
    }
}
```

This makes the code easier to test and easier to change.

### Dependency Injection and OOP

Dependency Injection, or DI, is a common technique in C# applications where dependencies are provided from the outside instead of created inside the class.

Without DI:

```csharp
public class OrderService
{
    private readonly EmailSender _emailSender = new();
}
```

This tightly couples `OrderService` to `EmailSender`.

With DI:

```csharp
public class OrderService
{
    private readonly IEmailSender _emailSender;

    public OrderService(IEmailSender emailSender)
    {
        _emailSender = emailSender;
    }
}
```

ASP.NET Core can register and inject implementations:

```csharp
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<OrderService>();
```

Why this matters:

- Improves testability.
- Reduces tight coupling.
- Supports clean architecture.
- Makes implementations replaceable.
- Helps separate business logic from infrastructure.

Common mistake: depending on interfaces but still creating concrete classes with `new` inside the class. That defeats much of the benefit of dependency injection.

### OOP in Real-World C# Applications

Common real-world usage examples:

- ASP.NET Core controllers use classes and dependency injection.
- Services encapsulate business use cases.
- EF Core entities model domain or persistence data.
- Repositories abstract data access when useful.
- Validators encapsulate validation rules.
- Interfaces define boundaries between application and infrastructure layers.
- Middleware uses classes to encapsulate request pipeline behavior.
- Background services inherit from base classes such as `BackgroundService`.
- DTOs and records transfer data between layers.
- Domain entities use encapsulation to protect business invariants.

Example application service:

```csharp
public class CreateOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IPaymentProcessor _paymentProcessor;

    public CreateOrderService(
        IOrderRepository orderRepository,
        IPaymentProcessor paymentProcessor)
    {
        _orderRepository = orderRepository;
        _paymentProcessor = paymentProcessor;
    }

    public async Task<Guid> CreateAsync(CreateOrderRequest request)
    {
        var order = Order.Create(request.CustomerId, request.Items);

        await _paymentProcessor.ProcessAsync(order.TotalAmount);
        await _orderRepository.AddAsync(order);

        return order.Id;
    }
}
```

This example uses encapsulation, abstraction, dependency injection, and composition together.

### Common OOP Mistakes in C#

Common mistakes include:

- Exposing mutable public fields.
- Creating deep inheritance hierarchies.
- Using inheritance only to share code.
- Creating interfaces for every class without a clear reason.
- Building large interfaces with too many methods.
- Violating Liskov Substitution Principle with derived classes that cannot behave like the base class.
- Using `new` method hiding instead of `override`.
- Putting too much logic in controllers instead of services or domain objects.
- Creating God classes that do too many unrelated things.
- Making everything static, which hurts testability and flexibility.
- Using anemic domain models where all data is public and all business rules are scattered in services.
- Overusing patterns without a real problem to solve.

### OOP Best Practices for Interviews and Production Code

Best practices:

- Keep classes focused and cohesive.
- Use encapsulation to protect valid state.
- Prefer composition over inheritance for behavior reuse.
- Use inheritance only when the relationship is truly `is-a`.
- Depend on abstractions at architectural boundaries.
- Keep interfaces small and meaningful.
- Use dependency injection for replaceable dependencies.
- Use records for immutable data transfer models when value equality is useful.
- Avoid public mutable state.
- Prefer clear names that describe domain concepts.
- Keep business rules close to the data they protect when designing domain models.
- Write unit tests against public behavior, not private implementation details.
- Avoid unnecessary abstraction in small or simple code.

## Common Interview Questions

### Beginner

#### 1. What is OOP?

Expected answer:

OOP, or Object-Oriented Programming, is a programming paradigm that organizes code around objects. An object combines data and behavior. In C#, objects are commonly created from classes. OOP helps model real-world concepts, organize business logic, reduce duplication, and build maintainable applications.

Key points to mention:

- OOP means organizing software around objects.
- Objects contain state and behavior.
- C# is an object-oriented language.
- The main pillars are encapsulation, abstraction, inheritance, and polymorphism.
- OOP is used heavily in ASP.NET Core, EF Core, services, domain models, and libraries.

#### 2. What are the four pillars of OOP?

Expected answer:

The four pillars are encapsulation, abstraction, inheritance, and polymorphism. Encapsulation hides internal state and exposes safe operations. Abstraction exposes essential behavior while hiding implementation details. Inheritance allows a class to derive from another class. Polymorphism allows different implementations to be used through a common base type or interface.

Key points to mention:

- Encapsulation protects object state.
- Abstraction hides implementation details.
- Inheritance supports reuse and specialization.
- Polymorphism enables flexible behavior through common contracts.

#### 3. What is a class in C#?

Expected answer:

A class is a blueprint for creating objects. It defines members such as fields, properties, methods, constructors, and events. A class can contain both data and behavior. In C#, classes are reference types and support inheritance.

Key points to mention:

- A class defines structure and behavior.
- Objects are instances of classes.
- Classes are reference types.
- Classes can implement interfaces and inherit from one base class.

#### 4. What is an object?

Expected answer:

An object is a runtime instance of a class. It has its own state stored in instance fields and properties, and it can perform behavior through methods. Multiple objects can be created from the same class, each with different state.

Key points to mention:

- Object means instance.
- Objects have state and behavior.
- Instance members belong to each object.
- Static members belong to the type, not a specific object.

#### 5. What is encapsulation in C#?

Expected answer:

Encapsulation is the practice of hiding internal state and implementation details behind a controlled public API. In C#, this is usually done with access modifiers such as `private`, `public`, and `protected`, plus properties and methods that validate or control changes.

Key points to mention:

- Hide fields with `private`.
- Expose safe operations through methods or properties.
- Protect objects from invalid state.
- Use private setters or read-only collections when needed.

#### 6. What is the difference between a field and a property?

Expected answer:

A field is a variable that stores data inside a type. A property exposes data through `get`, `set`, or `init` accessors. Properties can include validation, computed values, different access levels, or logic while still looking like fields to callers.

Key points to mention:

- Fields store data.
- Properties provide controlled access.
- Public fields are usually avoided.
- Properties support validation and encapsulation.

#### 7. What is a constructor?

Expected answer:

A constructor is a special member used to initialize an object when it is created. It usually sets required values and validates constructor arguments. Constructors can be overloaded and can call other constructors using `this` or base constructors using `base`.

Key points to mention:

- Constructors initialize objects.
- They should leave objects in a valid state.
- They can accept parameters.
- They can call `this(...)` or `base(...)`.

#### 8. What is the difference between `public`, `private`, and `protected`?

Expected answer:

`public` members can be accessed by any code that can access the containing type. `private` members can only be accessed inside the same class or struct. `protected` members can be accessed inside the same class and derived classes.

Key points to mention:

- Access modifiers support encapsulation.
- Use the most restrictive modifier possible.
- `protected` is useful for inheritance but should be used carefully.

### Intermediate

#### 1. What is abstraction in C#?

Expected answer:

Abstraction means exposing what an object can do while hiding how it does it. In C#, abstraction is commonly implemented with interfaces, abstract classes, and carefully designed public APIs. For example, a service can depend on `IEmailSender` without knowing whether the implementation uses SMTP, SendGrid, or another provider.

Key points to mention:

- Abstraction is a design concept.
- Interfaces and abstract classes are language tools for abstraction.
- Abstraction reduces coupling.
- It improves testability and replaceability.

#### 2. What is inheritance and when should you use it?

Expected answer:

Inheritance allows one class to derive from another class and reuse, extend, or override its behavior. It should be used when there is a true `is-a` relationship and derived classes can safely substitute the base class. It should not be used only for code reuse when composition would be clearer.

Key points to mention:

- C# supports single inheritance for classes.
- Use `abstract`, `virtual`, and `override` for extensible behavior.
- Use inheritance for stable specialization.
- Prefer composition when the relationship is `has-a` or behavior needs to vary flexibly.

#### 3. What is polymorphism in C#?

Expected answer:

Polymorphism allows different concrete types to be used through a common abstraction. For example, different `IPaymentProcessor` implementations can be called through the same interface. With runtime polymorphism, C# invokes the correct overridden method based on the runtime type of the object.

Key points to mention:

- Polymorphism means many forms.
- It can work through base classes or interfaces.
- Runtime polymorphism uses virtual and overridden members.
- It supports extensible and replaceable behavior.

#### 4. What is the difference between method overloading and method overriding?

Expected answer:

Method overloading means multiple methods have the same name but different parameter lists. It is resolved at compile time. Method overriding means a derived class provides a new implementation for a virtual or abstract member from a base class. It is resolved at runtime based on the actual object type.

Key points to mention:

- Overloading: same name, different parameters.
- Overriding: derived class changes base behavior.
- Overloading is compile-time polymorphism.
- Overriding is runtime polymorphism.
- Overriding requires `virtual`, `abstract`, or `override`.

#### 5. What is the difference between an interface and an abstract class?

Expected answer:

An interface defines a contract that a type can implement. An abstract class is a base class that can provide shared implementation, fields, constructors, and protected members. A class can implement multiple interfaces but can inherit from only one class.

Key points to mention:

- Use interfaces for contracts and capabilities.
- Use abstract classes for shared base behavior.
- Interfaces are better for unrelated types sharing behavior.
- Abstract classes are better for related types with common implementation.

#### 6. What is the difference between `virtual`, `override`, and `abstract`?

Expected answer:

`virtual` means a base class member has an implementation but allows derived classes to replace it. `override` means a derived class provides a replacement implementation. `abstract` means a member has no implementation in the abstract base class and must be implemented by a non-abstract derived class.

Key points to mention:

- `virtual` provides default behavior.
- `override` replaces inherited virtual or abstract behavior.
- `abstract` requires derived implementation.
- Abstract members can only exist in abstract classes.

#### 7. What is the difference between `override` and `new` in C# methods?

Expected answer:

`override` participates in runtime polymorphism. When a method is called through a base reference, the derived override is executed. `new` hides the base member and does not provide normal polymorphic behavior. The method called can depend on the compile-time reference type.

Key points to mention:

- `override` changes virtual behavior.
- `new` hides a member.
- `new` can cause confusing behavior.
- Prefer `override` when polymorphism is intended.

#### 8. Why is composition often preferred over inheritance?

Expected answer:

Composition is often preferred because it creates more flexible and loosely coupled designs. Instead of deriving from a base class, a class can use another object to provide behavior. This avoids deep inheritance hierarchies and makes behavior easier to replace through dependency injection.

Key points to mention:

- Inheritance creates tight coupling.
- Composition supports flexible behavior replacement.
- Composition represents `has-a` or `uses-a` relationships.
- Inheritance should represent true `is-a` relationships.

#### 9. How does dependency injection relate to OOP?

Expected answer:

Dependency injection is an OOP technique where a class receives its dependencies from outside instead of creating them internally. It usually works with interfaces or abstractions. This reduces coupling and improves testability because dependencies can be replaced with mocks, fakes, or different implementations.

Key points to mention:

- Dependencies are provided from outside.
- Classes depend on abstractions instead of concrete implementations.
- DI is widely used in ASP.NET Core.
- It improves testing, maintainability, and extensibility.

#### 10. What is the difference between a class, a record, and a struct?

Expected answer:

A class is a reference type usually used for objects with identity and behavior. A record is designed for immutable or value-like data and provides value-based equality by default. A struct is a value type, copied by value, and is best for small lightweight values.

Key points to mention:

- Classes are reference types.
- Records are useful for immutable data and value equality.
- Structs are value types.
- Structs should usually be small and not heavily mutable.

### Advanced

#### 1. What is the Liskov Substitution Principle?

Expected answer:

The Liskov Substitution Principle says that objects of a derived class should be usable anywhere the base class is expected without breaking correctness. If a derived class throws unsupported exceptions, weakens expected behavior, or violates base class assumptions, the design likely breaks this principle.

Key points to mention:

- Derived types must honor the base type contract.
- It is central to safe polymorphism.
- Violations often indicate incorrect inheritance.
- Composition or smaller abstractions may fix the design.

#### 2. How would you design a payment system using OOP principles?

Expected answer:

A good design would define a payment abstraction such as `IPaymentProcessor` with implementations like `CreditCardPaymentProcessor`, `BankTransferPaymentProcessor`, and `WalletPaymentProcessor`. The application service would depend on the interface, not the concrete classes. Dependency injection would provide the selected implementation. Each processor would encapsulate provider-specific logic.

Key points to mention:

- Use abstraction with an interface.
- Use polymorphism for multiple payment methods.
- Use dependency injection to reduce coupling.
- Keep provider-specific logic inside concrete implementations.
- Avoid large `switch` statements when behavior should be extensible.

#### 3. How can OOP improve unit testing?

Expected answer:

OOP improves unit testing when classes are small, focused, and depend on abstractions. Interfaces allow external dependencies such as databases, email services, and APIs to be replaced with mocks or fakes. Encapsulation also allows tests to focus on public behavior instead of internal implementation details.

Key points to mention:

- Small cohesive classes are easier to test.
- Interfaces support mocks and fakes.
- Dependency injection makes dependencies replaceable.
- Tests should verify behavior, not private implementation.

#### 4. What are the risks of overusing inheritance?

Expected answer:

Overusing inheritance can create deep, fragile hierarchies that are difficult to understand and change. Derived classes become tightly coupled to base class implementation details. A change in the base class can accidentally break derived classes. Inheritance can also lead to poor models when the relationship is not truly `is-a`.

Key points to mention:

- Deep hierarchies are hard to maintain.
- Inheritance creates tight coupling.
- Base class changes can have wide impact.
- Composition is often safer for behavior reuse.

#### 5. How do interfaces support Clean Architecture?

Expected answer:

In Clean Architecture, inner layers should not depend on outer infrastructure details. Interfaces allow the application or domain layer to define contracts such as `IOrderRepository` or `IEmailSender`, while the infrastructure layer provides implementations. This keeps business logic independent from databases, message brokers, cloud services, and external APIs.

Key points to mention:

- Inner layers define abstractions.
- Outer layers implement infrastructure details.
- Dependencies point inward.
- Interfaces improve testability and replaceability.

#### 6. What is a God class and why is it a problem?

Expected answer:

A God class is a class that has too many responsibilities and knows or does too much. It is difficult to test, modify, reuse, and understand. It often violates the Single Responsibility Principle. The solution is to split responsibilities into smaller cohesive classes or services.

Key points to mention:

- Too many responsibilities in one class.
- Hard to test and maintain.
- Violates Single Responsibility Principle.
- Refactor by extracting focused services or domain objects.

#### 7. How would you decide between an interface and an abstract class in a real project?

Expected answer:

Use an interface when you need a contract that multiple types can implement, especially when the types are unrelated or when dependency injection and testing are important. Use an abstract class when related types need shared state, constructors, protected helper methods, or a common workflow with customizable steps.

Key points to mention:

- Interface for capability or contract.
- Abstract class for shared base implementation.
- A class can implement multiple interfaces but inherit from only one class.
- Avoid unnecessary abstractions.

#### 8. What is an anemic domain model?

Expected answer:

An anemic domain model is a design where domain objects mostly contain data with public getters and setters, while business logic is placed elsewhere in services. This can lead to scattered rules, weak encapsulation, and invalid object states. A richer domain model keeps important business behavior and invariants inside the domain objects.

Key points to mention:

- Data-only domain objects.
- Business rules live outside the model.
- Can weaken encapsulation.
- Rich domain models protect invariants through methods and controlled state changes.

#### 9. How does polymorphism help remove large conditional logic?

Expected answer:

Polymorphism can replace repeated `if` or `switch` statements when behavior varies by type. Instead of checking a payment type and running different code, each payment processor can implement the same interface and provide its own behavior. The caller simply uses the interface.

Key points to mention:

- Move type-specific behavior into separate classes.
- Use a common interface or base class.
- Improves Open/Closed Principle.
- Makes new behavior easier to add without modifying existing logic.

#### 10. What are common signs of poor OOP design?

Expected answer:

Common signs include large classes, long methods, too many public setters, deep inheritance chains, large interfaces, repeated conditional logic, tight coupling to concrete classes, static mutable state, and business rules scattered across unrelated services.

Key points to mention:

- Low cohesion and high coupling.
- Weak encapsulation.
- Hard-to-test dependencies.
- Overuse of inheritance or static state.
- Interfaces that are too broad.
- Code that changes in many places for one requirement.
