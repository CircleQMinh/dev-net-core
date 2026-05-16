---
id: classes-structs-records
topic: C# Language Foundations
subtopic: Classes, structs, records
category: .NET
---

## Overview

Classes, structs, and records are the main ways to define custom types in C#. They all let you group data and behavior, but they have different semantics for identity, copying, equality, inheritance, mutability, memory usage, and performance.

A `class` defines a reference type. Classes are the standard choice for domain entities, services, controllers, repositories, dependency-injected components, and objects that have identity or behavior that changes over time. When you assign a class instance to another variable, both variables usually refer to the same object.

A `struct` defines a value type. Structs are useful for small, lightweight values such as coordinates, money values, measurements, ranges, strongly typed IDs, or date/time-like values. When you assign a struct to another variable, the value is copied. This makes structs useful for immutable value objects, but dangerous when they are large or mutable.

A `record` is a data-focused type modifier that can be applied to a class or a struct. Records are designed for data models where value-based equality, readable `ToString()` output, deconstruction, and nondestructive mutation with `with` expressions are useful. A `record` or `record class` is still a reference type, while a `record struct` is still a value type.

This topic matters because many C# interview questions test whether you understand the difference between reference semantics and value semantics. Interviewers commonly ask when to use a class, struct, record class, or record struct; how equality works; why mutable structs are problematic; how `with` expressions behave; how boxing affects performance; and why records are not always a replacement for classes.

In real applications, choosing the wrong type can cause bugs, unexpected mutations, unnecessary allocations, poor performance, broken equality logic, or difficult-to-maintain domain models. A strong candidate should be able to explain the trade-offs clearly and choose the correct type based on behavior, identity, size, mutability, and equality requirements.

## Core Concepts

### Type Categories at a Glance

Classes, structs, and records are all user-defined types, but they are not interchangeable.

| Type form | Category | Default equality style | Copy behavior | Inheritance | Common use |
|---|---|---|---|---|---|
| `class` | Reference type | Reference equality unless overridden | Copies the reference | Supports class inheritance | Entities, services, mutable objects, behavior-heavy models |
| `struct` | Value type | Field-based `ValueType.Equals`, but custom equality is often better | Copies the whole value | Cannot inherit from another struct or class, but can implement interfaces | Small immutable values, numeric-like values, lightweight data |
| `record` / `record class` | Reference type | Compiler-generated value equality | Copies the reference; `with` creates a copied object | Can inherit from another record class | DTOs, response models, immutable data, value-like reference objects |
| `record struct` | Value type | Compiler-generated value equality | Copies the whole value | Cannot inherit from another type, but can implement interfaces | Small value objects with generated equality and `with` support |
| `readonly record struct` | Value type | Compiler-generated value equality | Copies the whole value | Cannot inherit from another type, but can implement interfaces | Small immutable value objects |

The most important distinction is this:

- Classes and record classes use reference-type semantics.
- Structs and record structs use value-type semantics.
- Records add data-focused behavior, but they do not change whether the underlying type is a reference type or value type.

### Classes

A `class` is a reference type. A class instance is an object, and variables of a class type usually store references to that object rather than storing the full object data directly.

```csharp
public class Customer
{
    public int Id { get; init; }
    public string Name { get; set; } = string.Empty;

    public void Rename(string newName)
    {
        if (string.IsNullOrWhiteSpace(newName))
            throw new ArgumentException("Name is required.", nameof(newName));

        Name = newName;
    }
}
```

Classes are best when the type has identity, lifecycle, behavior, or shared mutable state.

```csharp
var customer1 = new Customer { Id = 1, Name = "Alice" };
var customer2 = customer1;

customer2.Name = "Bob";

Console.WriteLine(customer1.Name); // Bob
Console.WriteLine(ReferenceEquals(customer1, customer2)); // True
```

Both variables refer to the same object. This is why classes are natural for domain entities such as `Customer`, `Order`, `User`, or `Invoice`. Two customers with the same name are not necessarily the same customer; identity matters.

Important class features include:

- Instance members, static members, fields, properties, methods, events, and constructors.
- Inheritance with `base`, `virtual`, `override`, `abstract`, and `sealed`.
- Interface implementation.
- Encapsulation using access modifiers such as `public`, `private`, `protected`, and `internal`.
- Nullable reference type analysis when enabled.
- Finalizers, although finalizers should be rare and are mainly for unmanaged resource cleanup.

A class can also use a primary constructor in modern C#:

```csharp
public class OrderService(IOrderRepository repository, ILogger<OrderService> logger)
{
    public async Task SubmitAsync(int orderId)
    {
        logger.LogInformation("Submitting order {OrderId}", orderId);
        var order = await repository.GetByIdAsync(orderId);
        order.Submit();
        await repository.SaveAsync(order);
    }
}
```

For non-record classes, primary constructor parameters are parameters, not automatically generated public properties. If you want a property, you must declare one:

```csharp
public class Product(string name)
{
    public string Name { get; } = name;
}
```

Best practices for classes:

- Use classes for entities and behavior-rich objects.
- Keep fields private and expose behavior through methods or controlled properties.
- Prefer immutability where possible for simple data models.
- Use `sealed` when inheritance is not intended.
- Override `Equals` and `GetHashCode` only when the class should use value equality.
- Avoid large inheritance hierarchies when composition or interfaces are simpler.

### Structs

A `struct` is a value type. A struct variable contains the value itself. Assigning a struct to another variable copies the value.

```csharp
public readonly struct Money
{
    public Money(decimal amount, string currency)
    {
        if (string.IsNullOrWhiteSpace(currency))
            throw new ArgumentException("Currency is required.", nameof(currency));

        Amount = amount;
        Currency = currency;
    }

    public decimal Amount { get; }
    public string Currency { get; }

    public override string ToString() => $"{Amount} {Currency}";
}
```

Example of value copy behavior:

```csharp
var price1 = new MutablePoint { X = 10, Y = 20 };
var price2 = price1;

price2.X = 99;

Console.WriteLine(price1.X); // 10
Console.WriteLine(price2.X); // 99

public struct MutablePoint
{
    public int X { get; set; }
    public int Y { get; set; }
}
```

The two variables are independent copies. This is useful for values, but it can surprise developers when a struct is mutable.

A common interview trap is saying "structs are always stored on the stack." That is too simple and often wrong. A value type can be stored inline in another object, in an array, in a local variable, or boxed on the managed heap when converted to `object` or an interface. The key idea is not "stack vs heap"; the key idea is value semantics.

Structs are useful when the type is:

- Small.
- Immutable or effectively immutable.
- Value-like rather than identity-like.
- Frequently created.
- Not intended for inheritance.
- Safe to copy.

Examples include `DateTime`, `TimeSpan`, `Guid`, coordinates, ranges, IDs, and small domain value objects.

Structs have several important rules and trade-offs:

- They implicitly inherit from `System.ValueType`.
- They cannot inherit from another class or struct.
- They can implement interfaces.
- They can have constructors, methods, properties, fields, operators, and static members.
- They cannot declare a finalizer.
- They are always defaultable. `default(MyStruct)` creates a zero/default value.
- Large structs can be expensive because copying copies the whole value.
- Mutable structs are error-prone because copies may be modified instead of the original.
- Boxing a struct creates an object allocation.

Modern C# supports `readonly struct` to express immutability:

```csharp
public readonly struct Percentage
{
    public Percentage(decimal value)
    {
        if (value < 0 || value > 100)
            throw new ArgumentOutOfRangeException(nameof(value));

        Value = value;
    }

    public decimal Value { get; }
}
```

A `readonly struct` communicates that instance state should not change after construction. This can reduce defensive copying and make the type safer to use.

### Struct Default Values and Constructors

Every struct has a default value. Default initialization sets fields to their default values, such as `0`, `false`, or `null` for reference-type fields.

```csharp
public struct ReportId
{
    public int Value { get; }

    public ReportId(int value)
    {
        if (value <= 0)
            throw new ArgumentOutOfRangeException(nameof(value));

        Value = value;
    }
}

ReportId id1 = new ReportId(10);
ReportId id2 = default;

Console.WriteLine(id1.Value); // 10
Console.WriteLine(id2.Value); // 0
```

This is important because constructors cannot prevent `default(T)` from existing for structs. If `0` is invalid for a domain concept, a struct can still be default-initialized to that invalid state unless the code guards against it.

Modern C# allows parameterless constructors in structs, but `default(T)` still produces the default zero-initialized value. This matters when designing domain value objects.

```csharp
public struct Counter
{
    public int Value { get; }

    public Counter()
    {
        Value = 1;
    }
}

var a = new Counter(); // Calls parameterless constructor
var b = default(Counter); // Default value; Value is 0
```

Best practices for structs:

- Prefer `readonly struct` for value objects.
- Keep structs small.
- Avoid mutable public properties on structs.
- Implement `IEquatable<T>` for custom value equality and better performance.
- Avoid using structs for complex domain entities.
- Be careful with default values.
- Avoid boxing in performance-sensitive code.

### Records

A `record` is a type designed to model data. The `record` keyword adds compiler-generated functionality such as value equality, `GetHashCode`, `ToString`, deconstruction for positional records, and support for `with` expressions.

There are three common forms:

```csharp
public record CustomerDto(int Id, string Name); // Same as record class

public record class ProductDto(int Id, string Name); // Explicit record class

public record struct PointDto(int X, int Y); // Value type record

public readonly record struct MoneyDto(decimal Amount, string Currency); // Immutable value type record
```

A `record` by itself means `record class`, so it is a reference type:

```csharp
public record UserProfile(int Id, string DisplayName);
```

The compiler generates useful members for records:

```csharp
var user1 = new UserProfile(1, "Alice");
var user2 = new UserProfile(1, "Alice");

Console.WriteLine(user1 == user2); // True
Console.WriteLine(user1); // UserProfile { Id = 1, DisplayName = Alice }

var renamed = user1 with { DisplayName = "Alicia" };
Console.WriteLine(renamed); // UserProfile { Id = 1, DisplayName = Alicia }
```

Records are good for:

- DTOs.
- API request and response models.
- Query result models.
- Configuration snapshots.
- Immutable data transfer.
- Value objects where equality is based on data.

Records are not always good for:

- Entity Framework Core entities that rely on identity and change tracking.
- Mutable domain entities with lifecycle and behavior.
- Types where reference identity matters.
- Data containing mutable reference-type properties if deep immutability is expected.

A common mistake is assuming records are always immutable. Records encourage immutability, but they do not guarantee deep immutability.

```csharp
public record Team(string Name, List<string> Members);

var team1 = new Team("Core", new List<string> { "Alice" });
var team2 = team1 with { Name = "Platform" };

team2.Members.Add("Bob");

Console.WriteLine(team1.Members.Count); // 2
```

The `with` expression copied the record, but both records still reference the same `List<string>`. This is a shallow copy.

### Record Class vs Record Struct

A `record class` is a reference type with value-based equality.

```csharp
public record EmployeeDto(int Id, string Name);

var e1 = new EmployeeDto(1, "Alice");
var e2 = e1;
var e3 = new EmployeeDto(1, "Alice");

Console.WriteLine(ReferenceEquals(e1, e2)); // True
Console.WriteLine(e1 == e3); // True because records use value equality
```

A `record struct` is a value type with value-based equality.

```csharp
public record struct Coordinate(double Latitude, double Longitude);

var c1 = new Coordinate(10, 20);
var c2 = c1;

c2.Latitude = 99;

Console.WriteLine(c1.Latitude); // 10
Console.WriteLine(c2.Latitude); // 99
```

By default, positional `record struct` properties are mutable. Use `readonly record struct` when you want immutable value semantics.

```csharp
public readonly record struct Coordinate(double Latitude, double Longitude);
```

Choosing between them:

- Use `record class` when you want data-focused behavior and reference-type semantics.
- Use `record struct` when the data is small and value-copy semantics are desired.
- Use `readonly record struct` for small immutable value objects.

### Equality: Reference Equality, Value Equality, and Generated Equality

Equality is one of the most important interview topics for classes, structs, and records.

For a normal class, two variables are equal by default only when they refer to the same object.

```csharp
public class PersonClass
{
    public string Name { get; init; } = string.Empty;
}

var p1 = new PersonClass { Name = "Alice" };
var p2 = new PersonClass { Name = "Alice" };

Console.WriteLine(p1 == p2); // False
```

For a record class, two values are equal when the record type and values are equal.

```csharp
public record PersonRecord(string Name);

var r1 = new PersonRecord("Alice");
var r2 = new PersonRecord("Alice");

Console.WriteLine(r1 == r2); // True
```

For a struct, default equality is inherited from `ValueType`, but for production code you often implement `IEquatable<T>` to define equality explicitly and avoid slower default behavior.

```csharp
public readonly struct ProductCode : IEquatable<ProductCode>
{
    public ProductCode(string value)
    {
        Value = string.IsNullOrWhiteSpace(value)
            ? throw new ArgumentException("Product code is required.", nameof(value))
            : value;
    }

    public string Value { get; }

    public bool Equals(ProductCode other) =>
        string.Equals(Value, other.Value, StringComparison.OrdinalIgnoreCase);

    public override bool Equals(object? obj) =>
        obj is ProductCode other && Equals(other);

    public override int GetHashCode() =>
        StringComparer.OrdinalIgnoreCase.GetHashCode(Value);

    public static bool operator ==(ProductCode left, ProductCode right) => left.Equals(right);
    public static bool operator !=(ProductCode left, ProductCode right) => !left.Equals(right);
}
```

When overriding equality, always keep `Equals`, `GetHashCode`, and equality operators consistent. This matters for dictionaries, hash sets, LINQ `Distinct`, grouping, caching, and tests.

### Mutability and Immutability

Mutability means the state of an object can change after creation. Immutability means the state cannot be changed after construction.

Classes are often mutable:

```csharp
public class ShoppingCart
{
    private readonly List<string> _items = new();

    public IReadOnlyList<string> Items => _items;

    public void AddItem(string item) => _items.Add(item);
}
```

Records are often used as immutable data models:

```csharp
public record OrderSummary(int OrderId, decimal Total, string Status);

var submitted = new OrderSummary(1, 100m, "Draft");
var approved = submitted with { Status = "Approved" };
```

Structs should usually be immutable:

```csharp
public readonly record struct CustomerId(int Value);
```

Important points:

- `init` allows a property to be assigned during object initialization, but not changed afterward.
- `readonly struct` prevents instance members from modifying struct state.
- `readonly record struct` is concise for immutable value objects.
- Immutability makes code safer for concurrency and easier to reason about.
- Immutability can require more object creation, so consider performance in hot paths.
- Records with mutable reference-type properties are only shallowly immutable.

### Primary Constructors and Positional Syntax

Records commonly use positional syntax:

```csharp
public record CustomerResponse(int Id, string Name, string Email);
```

For records, positional parameters generate public properties. For non-record classes and structs, primary constructor parameters do not automatically become public properties.

```csharp
public class CustomerService(ICustomerRepository repository)
{
    public Task<Customer?> GetAsync(int id) => repository.GetAsync(id);
}
```

In this class, `repository` is a constructor parameter in scope within the type. It is not a public property named `Repository`.

For a record, the parameters become properties:

```csharp
public record CustomerResponse(int Id, string Name);

var response = new CustomerResponse(1, "Alice");
Console.WriteLine(response.Id); // 1
```

This difference is a common interview question because the syntax looks similar but generates different members.

### Inheritance and Interfaces

Classes support inheritance:

```csharp
public abstract class PaymentMethod
{
    public abstract void Pay(decimal amount);
}

public class CreditCardPayment : PaymentMethod
{
    public override void Pay(decimal amount)
    {
        Console.WriteLine($"Paid {amount} by credit card.");
    }
}
```

Structs do not support class-style inheritance, but they can implement interfaces:

```csharp
public readonly struct Meter : IComparable<Meter>
{
    public Meter(decimal value) => Value = value;

    public decimal Value { get; }

    public int CompareTo(Meter other) => Value.CompareTo(other.Value);
}
```

Record classes can inherit from other record classes:

```csharp
public record Person(string Name);
public record Employee(string Name, int EmployeeId) : Person(Name);
```

But record structs cannot inherit because structs cannot inherit from other structs or classes.

Prefer inheritance only when there is a true substitutable relationship. For many applications, interfaces and composition produce simpler designs.

### Boxing and Unboxing

Boxing occurs when a value type is converted to `object` or an interface type. The runtime wraps the value in a reference-type object.

```csharp
int number = 42;
object boxed = number;     // Boxing
int unboxed = (int)boxed;   // Unboxing
```

Boxing can also happen with structs:

```csharp
public readonly struct CustomerId
{
    public CustomerId(int value) => Value = value;
    public int Value { get; }
}

CustomerId id = new(10);
object boxedId = id; // Boxing allocation
```

Boxing matters because it can create allocations and reduce performance in tight loops or high-throughput systems. Generic interfaces such as `IEquatable<T>` and generic collections such as `List<T>` help avoid boxing.

### Choosing Between Class, Struct, Record Class, and Record Struct

Use a class when:

- The type has identity.
- The type has behavior and lifecycle.
- The type is large or expensive to copy.
- The type is used with dependency injection.
- The type needs inheritance.
- The type is an EF Core entity or aggregate root.

Use a struct when:

- The type is small and value-like.
- Copying the value is safe and cheap.
- The type should not have identity.
- You want to reduce allocations in carefully chosen scenarios.
- The type can be immutable or effectively immutable.

Use a record class when:

- You want reference-type semantics but value-based equality.
- The type is primarily data.
- The type is useful as a DTO, query result, or immutable model.
- You want `with`, readable `ToString`, and deconstruction.
- The type may be too large for struct copying.

Use a record struct when:

- You want value-type semantics and generated equality.
- The type is small and self-contained.
- You want a concise value object.
- You want `with` support without writing equality boilerplate.

Use a readonly record struct when:

- You want a small immutable value object.
- You want generated equality.
- You want to avoid accidental mutation.
- You want concise syntax for strongly typed IDs or simple values.

Example strongly typed ID:

```csharp
public readonly record struct CustomerId(int Value);

public class Customer
{
    public CustomerId Id { get; init; }
    public string Name { get; set; } = string.Empty;
}
```

This avoids accidentally passing an `OrderId` where a `CustomerId` is expected, even if both wrap an `int`.

### Common Mistakes

Common mistakes include:

- Using a mutable struct with settable properties.
- Using a large struct that gets copied frequently.
- Assuming all structs are allocated on the stack.
- Using records for EF Core entities without understanding tracking and identity implications.
- Assuming `with` performs a deep copy.
- Assuming records are automatically deeply immutable.
- Forgetting that `record` means `record class` by default.
- Forgetting that `record struct` positional properties are mutable by default.
- Forgetting that structs always have a default value.
- Overriding `Equals` without overriding `GetHashCode`.
- Using class inheritance when interfaces or composition would be simpler.
- Treating DTOs, entities, and value objects as the same kind of model.

### Practical Design Examples

A typical Web API might use all of these type kinds together:

```csharp
// Entity: identity and lifecycle matter
public class Customer
{
    public CustomerId Id { get; private set; }
    public string Name { get; private set; }

    public Customer(CustomerId id, string name)
    {
        Id = id;
        Name = name;
    }

    public void Rename(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name is required.", nameof(name));

        Name = name;
    }
}

// Small immutable value object
public readonly record struct CustomerId(int Value);

// API response DTO
public record CustomerResponse(int Id, string Name);

// Service: behavior and dependencies matter
public class CustomerService(ICustomerRepository repository)
{
    public async Task<CustomerResponse?> GetAsync(CustomerId id)
    {
        var customer = await repository.GetAsync(id);
        return customer is null
            ? null
            : new CustomerResponse(customer.Id.Value, customer.Name);
    }
}
```

This design uses:

- A class for the domain entity because identity and behavior matter.
- A readonly record struct for a small strongly typed ID.
- A record class for the API response because it is data-focused.
- A class for the service because it has dependencies and behavior.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:classes-structs-records-in-csharp-beginner-q01 -->
#### Beginner Q01: What is a class in C#?
<!-- question-id:classes-structs-records-in-csharp-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A class is a reference type used to define objects that can contain data and behavior. A class can have fields, properties, methods, constructors, events, nested types, static members, and access modifiers. Classes support inheritance, polymorphism, encapsulation, and abstraction.

When you create a class instance, variables of that class type usually hold a reference to the object. If you assign one class variable to another, both variables usually point to the same object. Changing the object through one variable is visible through the other variable.

Classes are commonly used for domain entities, services, controllers, repositories, view models, dependency-injected components, and behavior-heavy objects.

##### Key Points to Mention

- A class is a reference type.
- Assignment copies the reference, not the full object.
- Classes support inheritance and polymorphism.
- Classes are good for objects with identity, behavior, and lifecycle.
- Default equality for normal classes is reference equality unless overridden.

<!-- question:end:classes-structs-records-in-csharp-beginner-q01 -->

<!-- question:start:classes-structs-records-in-csharp-beginner-q02 -->
#### Beginner Q02: What is a struct in C#?
<!-- question-id:classes-structs-records-in-csharp-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A struct is a value type used to represent small, lightweight values. Unlike a class, assigning a struct to another variable copies the whole value. Changes to one copy do not affect the other copy.

Structs are useful for values such as coordinates, measurements, money, ranges, strongly typed IDs, and other small immutable concepts. Structs can contain fields, properties, methods, constructors, operators, and static members. They can implement interfaces, but they cannot inherit from another class or struct.

Structs should usually be immutable or readonly because mutable structs can create confusing bugs due to copy behavior.

##### Key Points to Mention

- A struct is a value type.
- Assignment copies the value.
- Structs are best for small immutable values.
- Structs can implement interfaces but do not support class inheritance.
- Structs are always defaultable.
- Large or mutable structs can cause performance and correctness problems.

<!-- question:end:classes-structs-records-in-csharp-beginner-q02 -->

<!-- question:start:classes-structs-records-in-csharp-beginner-q03 -->
#### Beginner Q03: What is a record in C#?
<!-- question-id:classes-structs-records-in-csharp-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A record is a data-focused type that provides compiler-generated value equality and other useful members. Records are designed for types whose main purpose is storing data. They automatically provide value-based equality, `GetHashCode`, a readable `ToString()`, and support for `with` expressions.

A `record` by itself is a `record class`, which means it is a reference type. A `record struct` is a value type. A `readonly record struct` is commonly used for small immutable value objects.

Records are often used for DTOs, API responses, query results, messages, configuration models, and simple immutable data structures.

##### Key Points to Mention

- `record` means `record class` by default.
- Records provide value-based equality.
- Records support `with` expressions.
- Positional records generate properties and deconstruction.
- `record class` is a reference type.
- `record struct` is a value type.

<!-- question:end:classes-structs-records-in-csharp-beginner-q03 -->

<!-- question:start:classes-structs-records-in-csharp-beginner-q04 -->
#### Beginner Q04: What is the main difference between a class and a struct?
<!-- question-id:classes-structs-records-in-csharp-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

The main difference is that a class is a reference type and a struct is a value type. With a class, variables usually store references to objects. Assigning one class variable to another copies the reference, so both variables point to the same object.

With a struct, variables store values. Assigning one struct variable to another copies the entire value, so the variables are independent copies.

This difference affects equality, memory behavior, mutation, performance, and how types should be designed.

##### Key Points to Mention

- Class: reference type.
- Struct: value type.
- Class assignment copies a reference.
- Struct assignment copies the value.
- Classes are better for identity and behavior.
- Structs are better for small value-like data.

<!-- question:end:classes-structs-records-in-csharp-beginner-q04 -->

<!-- question:start:classes-structs-records-in-csharp-beginner-q05 -->
#### Beginner Q05: What is the difference between a record class and a record struct?
<!-- question-id:classes-structs-records-in-csharp-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

A record class is a reference type with compiler-generated value equality. A record struct is a value type with compiler-generated value equality.

Both can use positional syntax, value equality, readable `ToString()`, deconstruction, and `with` expressions. The difference is the underlying type semantics. A record class variable holds a reference to an object. A record struct variable holds the value directly and is copied on assignment.

Use a record class for data models that may be larger or where reference-type behavior is acceptable. Use a record struct for small, self-contained values where copying is cheap and value semantics are desired.

##### Key Points to Mention

- `record class` is a reference type.
- `record struct` is a value type.
- Both provide generated value equality.
- Record structs are copied by value.
- Record classes can participate in record inheritance.
- Record structs cannot inherit from other types.

<!-- question:end:classes-structs-records-in-csharp-beginner-q05 -->

<!-- question:start:classes-structs-records-in-csharp-beginner-q06 -->
#### Beginner Q06: When should you use a class, struct, or record?
<!-- question-id:classes-structs-records-in-csharp-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

Use a class when the type has identity, behavior, lifecycle, or should be shared by reference. Examples include `Customer`, `Order`, `UserService`, `Repository`, and controller classes.

Use a struct when the type is small, value-like, and cheap to copy. Examples include coordinates, IDs, percentages, ranges, and small measurement values. Prefer immutable or readonly structs.

Use a record when the type is mainly for storing data and value-based equality is useful. Examples include DTOs, API responses, query results, event messages, and simple immutable models.

##### Key Points to Mention

- Class: identity, behavior, lifecycle, dependencies.
- Struct: small immutable value-like data.
- Record class: data-focused reference type with value equality.
- Record struct: data-focused value type with value equality.
- Choose based on identity, equality, size, mutation, and performance.

<!-- question:end:classes-structs-records-in-csharp-beginner-q06 -->

<!-- question:start:classes-structs-records-in-csharp-beginner-q07 -->
#### Beginner Q07: What is value equality?
<!-- question-id:classes-structs-records-in-csharp-beginner-q07 -->
<!-- question-level:beginner -->

##### Expected Answer

Value equality means two instances are considered equal when their data values are equal, even if they are different instances in memory. Records provide value equality automatically. Structs also have value-based equality behavior through `ValueType`, but production structs often implement `IEquatable<T>` for better performance and explicit behavior.

Reference equality means two variables are equal only when they refer to the same object. Normal classes use reference equality by default unless equality is overridden.

##### Key Points to Mention

- Value equality compares data.
- Reference equality compares object identity.
- Records provide generated value equality.
- Normal classes use reference equality by default.
- Custom equality must keep `Equals` and `GetHashCode` consistent.

<!-- question:end:classes-structs-records-in-csharp-beginner-q07 -->

<!-- question:start:classes-structs-records-in-csharp-beginner-q08 -->
#### Beginner Q08: Are records immutable by default?
<!-- question-id:classes-structs-records-in-csharp-beginner-q08 -->
<!-- question-level:beginner -->

##### Expected Answer

Records encourage immutability, but they are not always fully immutable. Positional `record class` properties are usually `init`-only, which means they can be set during initialization but not changed afterward. However, a record can still contain mutable properties if you declare them.

Also, records are not deeply immutable. If a record contains a mutable reference type such as `List<T>`, the list itself can still be changed even if the record property cannot be reassigned.

For value-type records, positional `record struct` properties are mutable by default. Use `readonly record struct` for an immutable value-type record.

##### Key Points to Mention

- Records encourage immutability but do not guarantee deep immutability.
- `record class` positional properties are typically `init`-only.
- `record struct` positional properties are mutable by default.
- Use `readonly record struct` for immutable record structs.
- Mutable reference properties can still be modified internally.

<!-- question:end:classes-structs-records-in-csharp-beginner-q08 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:classes-structs-records-in-csharp-intermediate-q01 -->
#### Intermediate Q01: Why are mutable structs considered dangerous?
<!-- question-id:classes-structs-records-in-csharp-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Mutable structs are dangerous because structs are copied by value. A developer might think they are modifying the original value, but they may actually be modifying a copy. This can happen when structs are stored in properties, collections, `foreach` variables, or returned from methods.

For example, if a property returns a struct, modifying a member of that returned struct may modify only a temporary copy rather than the original value. This makes behavior confusing and bug-prone.

The usual recommendation is to make structs immutable. Use `readonly struct` or `readonly record struct`, expose get-only or init-only properties, and return new values instead of modifying existing values.

##### Key Points to Mention

- Structs are copied by value.
- Mutating a copy does not mutate the original.
- Bugs often happen with properties, collections, and method returns.
- Prefer immutable structs.
- Use `readonly struct` or `readonly record struct` when appropriate.

<!-- question:end:classes-structs-records-in-csharp-intermediate-q01 -->

<!-- question:start:classes-structs-records-in-csharp-intermediate-q02 -->
#### Intermediate Q02: How does the `with` expression work with records?
<!-- question-id:classes-structs-records-in-csharp-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A `with` expression creates a copy of a record and applies specified property changes to the copy. This is called nondestructive mutation because the original instance is not directly changed.

```csharp
public record UserDto(int Id, string Name);

var user = new UserDto(1, "Alice");
var renamed = user with { Name = "Alicia" };
```

The original `user` still has the name `Alice`, and `renamed` has the name `Alicia`.

However, `with` performs a shallow copy. If a record contains a reference to a mutable object, both the original and copied record may share that same referenced object.

##### Key Points to Mention

- `with` creates a copied instance with selected changes.
- The original record is not directly changed.
- `with` supports immutable-style updates.
- The copy is shallow, not deep.
- Mutable reference-type properties can still cause shared mutation.

<!-- question:end:classes-structs-records-in-csharp-intermediate-q02 -->

<!-- question:start:classes-structs-records-in-csharp-intermediate-q03 -->
#### Intermediate Q03: What is boxing, and why does it matter for structs?
<!-- question-id:classes-structs-records-in-csharp-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Boxing happens when a value type is converted to `object` or to an interface reference. The runtime creates a reference-type object that contains a copy of the value type.

```csharp
int number = 42;
object boxed = number;
```

This matters because boxing allocates memory and copies the value. In performance-sensitive code, repeated boxing can increase garbage collection pressure and reduce throughput.

Boxing can also happen when a struct is used through an interface. Generic collections and generic interfaces can often avoid boxing. For example, implementing `IEquatable<T>` helps avoid boxing in equality comparisons.

##### Key Points to Mention

- Boxing converts a value type to a reference-type object.
- Boxing creates an allocation.
- Unboxing extracts the value back from the object.
- Boxing can happen with `object` and interface conversions.
- Use generics and `IEquatable<T>` to avoid unnecessary boxing.

<!-- question:end:classes-structs-records-in-csharp-intermediate-q03 -->

<!-- question:start:classes-structs-records-in-csharp-intermediate-q04 -->
#### Intermediate Q04: How do primary constructors differ between records and normal classes?
<!-- question-id:classes-structs-records-in-csharp-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Records commonly use positional syntax, and the compiler generates public properties from the primary constructor parameters.

```csharp
public record CustomerDto(int Id, string Name);
```

This creates properties such as `Id` and `Name`.

Normal classes and structs can also have primary constructors, but their parameters do not automatically become public properties.

```csharp
public class CustomerService(ICustomerRepository repository)
{
    public Task<Customer?> GetAsync(int id) => repository.GetAsync(id);
}
```

In this example, `repository` is a constructor parameter available in the type body. It is not a public property. If you need a property, you must declare it explicitly.

##### Key Points to Mention

- Records synthesize properties from positional parameters.
- Non-record primary constructor parameters are not automatically properties.
- Primary constructor parameters are in scope in the type body.
- Explicit constructors must follow primary constructor rules.
- This syntax is useful for dependency injection and reducing boilerplate.

<!-- question:end:classes-structs-records-in-csharp-intermediate-q04 -->

<!-- question:start:classes-structs-records-in-csharp-intermediate-q05 -->
#### Intermediate Q05: What happens when a struct is initialized with `default`?
<!-- question-id:classes-structs-records-in-csharp-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

When a struct is initialized with `default`, all fields are set to their default values. Numeric fields become `0`, booleans become `false`, and reference-type fields become `null`.

This matters because structs are always defaultable. Even if a struct constructor validates values, code can still create a default instance.

```csharp
public readonly struct PositiveNumber
{
    public PositiveNumber(int value)
    {
        if (value <= 0)
            throw new ArgumentOutOfRangeException(nameof(value));

        Value = value;
    }

    public int Value { get; }
}

var valid = new PositiveNumber(10);
var invalid = default(PositiveNumber); // Value is 0
```

This can be a problem for domain value objects where the default value is invalid. The type should either tolerate the default state, guard against it when used, or use a class if invalid default values are unacceptable.

##### Key Points to Mention

- Structs always have a default value.
- `default(T)` zero-initializes the struct.
- Constructors do not remove the possibility of default values.
- This affects domain modeling and validation.
- Be careful when wrapping values where `0` or `null` is invalid.

<!-- question:end:classes-structs-records-in-csharp-intermediate-q05 -->

<!-- question:start:classes-structs-records-in-csharp-intermediate-q06 -->
#### Intermediate Q06: Why should you avoid using records for EF Core entities?
<!-- question-id:classes-structs-records-in-csharp-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

EF Core entities usually represent identity and lifecycle. The same entity can change over time, and EF Core tracks entities by identity and object references. Records are designed for value equality, where two instances with the same values are considered equal.

This can conflict with entity modeling. For example, two entity instances with the same property values might not represent the same tracked object. Records also encourage immutability and nondestructive mutation, while EF Core change tracking commonly works with mutable properties and object identity.

Records can still be useful for DTOs, query projections, API responses, and read models. But for tracked domain entities, classes are usually a better fit.

##### Key Points to Mention

- EF Core entities usually need identity semantics.
- Records use value equality by default.
- EF Core change tracking works with object identity and state changes.
- Use classes for tracked entities.
- Use records for DTOs, projections, and response models.

<!-- question:end:classes-structs-records-in-csharp-intermediate-q06 -->

<!-- question:start:classes-structs-records-in-csharp-intermediate-q07 -->
#### Intermediate Q07: How should you implement equality for a custom struct?
<!-- question-id:classes-structs-records-in-csharp-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

For a custom struct, implement `IEquatable<T>`, override `Equals(object?)`, override `GetHashCode()`, and optionally overload `==` and `!=`. This makes equality explicit and avoids some boxing and reflection-based behavior.

```csharp
public readonly struct EmailAddress : IEquatable<EmailAddress>
{
    public EmailAddress(string value)
    {
        Value = string.IsNullOrWhiteSpace(value)
            ? throw new ArgumentException("Email is required.", nameof(value))
            : value;
    }

    public string Value { get; }

    public bool Equals(EmailAddress other) =>
        string.Equals(Value, other.Value, StringComparison.OrdinalIgnoreCase);

    public override bool Equals(object? obj) =>
        obj is EmailAddress other && Equals(other);

    public override int GetHashCode() =>
        StringComparer.OrdinalIgnoreCase.GetHashCode(Value);

    public static bool operator ==(EmailAddress left, EmailAddress right) => left.Equals(right);
    public static bool operator !=(EmailAddress left, EmailAddress right) => !left.Equals(right);
}
```

The equality logic must be consistent. If two values are equal according to `Equals`, they must return the same hash code.

##### Key Points to Mention

- Implement `IEquatable<T>`.
- Override `Equals(object?)` and `GetHashCode()`.
- Overload `==` and `!=` if useful.
- Keep equality and hash code logic consistent.
- Consider using `readonly record struct` when generated equality is enough.

<!-- question:end:classes-structs-records-in-csharp-intermediate-q07 -->

<!-- question:start:classes-structs-records-in-csharp-intermediate-q08 -->
#### Intermediate Q08: What is the difference between object identity and domain identity?
<!-- question-id:classes-structs-records-in-csharp-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

Object identity means two variables refer to the exact same object instance in memory. Domain identity means two objects represent the same business concept, often based on an ID such as `CustomerId` or `OrderId`.

For example, two separate `Customer` objects might both have `Id = 10`. They are different object instances, but they may represent the same customer in the domain.

Classes are commonly used for domain entities because entities have identity and lifecycle. Value objects, on the other hand, are usually compared by their values. Records and readonly record structs are often good for value objects and DTOs.

##### Key Points to Mention

- Object identity is about the same runtime instance.
- Domain identity is about the same business entity.
- Entities usually have identity and lifecycle.
- Value objects are usually compared by their values.
- Classes are common for entities; records/structs are common for values and DTOs.

<!-- question:end:classes-structs-records-in-csharp-intermediate-q08 -->

<!-- question:start:classes-structs-records-in-csharp-intermediate-q09 -->
#### Intermediate Q09: Why can large structs hurt performance?
<!-- question-id:classes-structs-records-in-csharp-intermediate-q09 -->
<!-- question-level:intermediate -->

##### Expected Answer

Large structs can hurt performance because structs are copied by value. Passing them to methods, returning them from methods, storing them in collections, or assigning them to variables can copy the entire value. If the struct contains many fields, copying can become expensive.

Large structs can also cause defensive copies, especially when used through readonly references or properties. They may increase memory usage in arrays because each array element stores the full value inline.

For large models, a class is often better because copying a reference is cheaper than copying a large value. If a struct must be used in performance-sensitive code, consider making it readonly and passing it by `in` or `ref readonly` where appropriate.

##### Key Points to Mention

- Struct assignment copies the whole value.
- Large structs can cause expensive copies.
- Arrays of structs store values inline.
- Classes copy references, which can be cheaper for large objects.
- Use readonly structs and `in` parameters carefully in hot paths.

<!-- question:end:classes-structs-records-in-csharp-intermediate-q09 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:classes-structs-records-in-csharp-advanced-q01 -->
#### Advanced Q01: Why is "structs are stored on the stack and classes are stored on the heap" an incomplete explanation?
<!-- question-id:classes-structs-records-in-csharp-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

That explanation is incomplete because storage location depends on context. A struct can be stored in a local variable, inline inside a class object, inline in an array, or boxed on the heap. A class instance is a reference type object managed by the runtime, but the variable holding the reference can be stored in different places.

The more accurate distinction is semantic: classes have reference semantics, and structs have value semantics. With classes, assignment copies a reference. With structs, assignment copies the value.

Interviewers often look for this correction because focusing only on stack versus heap leads to wrong assumptions about memory, performance, and garbage collection.

##### Key Points to Mention

- Storage location depends on context.
- Structs can be boxed on the heap.
- Structs can be stored inline in arrays or containing objects.
- Class variables hold references.
- The core distinction is reference semantics vs value semantics.

<!-- question:end:classes-structs-records-in-csharp-advanced-q01 -->

<!-- question:start:classes-structs-records-in-csharp-advanced-q02 -->
#### Advanced Q02: How do record equality and inheritance work?
<!-- question-id:classes-structs-records-in-csharp-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Record classes support inheritance from other record classes. Record equality is value-based, but it also considers the runtime record type. This means a base record and a derived record are not equal just because their shared properties have the same values.

```csharp
public record Person(string Name);
public record Employee(string Name, int EmployeeId) : Person(Name);

Person p = new("Alice");
Employee e = new("Alice", 1);

Console.WriteLine(p == e); // False
```

This behavior prevents equality from treating different record types as the same just because some properties match. Record structs do not support inheritance because structs cannot inherit from other structs or classes.

##### Key Points to Mention

- Record classes can inherit from record classes.
- Record equality includes type information.
- A base record and derived record with matching base values are not necessarily equal.
- Record structs cannot inherit.
- Be careful when using records in polymorphic models.

<!-- question:end:classes-structs-records-in-csharp-advanced-q02 -->

<!-- question:start:classes-structs-records-in-csharp-advanced-q03 -->
#### Advanced Q03: What are defensive copies with structs?
<!-- question-id:classes-structs-records-in-csharp-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

A defensive copy is a copy created by the compiler or runtime to preserve readonly guarantees or value semantics. It can happen when calling members on a mutable struct through a readonly field, readonly property, or `in` parameter. The compiler may copy the struct before calling the member because the member might mutate state.

This can hurt performance when the struct is large or used frequently. Marking the struct as `readonly` and marking members as readonly where appropriate helps communicate that methods do not mutate state and can reduce unnecessary copies.

For high-performance code, this is one reason immutable readonly structs are preferred over mutable structs.

##### Key Points to Mention

- Defensive copies protect readonly/value semantics.
- They can happen with mutable structs through readonly access paths.
- Large structs make defensive copies more expensive.
- `readonly struct` helps reduce this risk.
- Avoid mutable structs in performance-sensitive code.

<!-- question:end:classes-structs-records-in-csharp-advanced-q03 -->

<!-- question:start:classes-structs-records-in-csharp-advanced-q04 -->
#### Advanced Q04: How would you design a strongly typed ID in C#?
<!-- question-id:classes-structs-records-in-csharp-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

A strongly typed ID wraps a primitive value such as `int`, `long`, or `Guid` in a domain-specific type. This prevents accidentally passing one kind of ID where another is expected.

A concise approach is to use a `readonly record struct`:

```csharp
public readonly record struct CustomerId(Guid Value);
public readonly record struct OrderId(Guid Value);

public Task<Customer?> GetCustomerAsync(CustomerId customerId)
{
    // ...
}
```

Now an `OrderId` cannot accidentally be passed to a method expecting a `CustomerId`, even though both wrap `Guid`.

This design gives type safety, value semantics, generated equality, and minimal syntax. However, teams should consider serialization, EF Core value conversions, default values, validation, and API model binding.

##### Key Points to Mention

- Strongly typed IDs improve type safety.
- `readonly record struct` is a concise option.
- It provides generated equality and value semantics.
- Consider serialization and persistence mapping.
- Be careful with default values such as `Guid.Empty`.

<!-- question:end:classes-structs-records-in-csharp-advanced-q04 -->

<!-- question:start:classes-structs-records-in-csharp-advanced-q05 -->
#### Advanced Q05: How do you choose between a value object class and a readonly record struct?
<!-- question-id:classes-structs-records-in-csharp-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Choose a readonly record struct when the value object is small, self-contained, immutable, and cheap to copy. Examples include strongly typed IDs, small measurements, percentages, coordinates, and simple wrappers around primitives.

Choose a value object class or record class when the object is larger, contains multiple reference-type members, requires inheritance, has complex validation, or copying the full value would be expensive. A class may also be better when you need to avoid invalid default struct values.

The decision should be based on size, copy cost, default value concerns, equality requirements, serialization needs, persistence mapping, and how the type will be used in collections and APIs.

##### Key Points to Mention

- Small immutable values are good candidates for readonly record structs.
- Larger or complex value objects may be better as classes or record classes.
- Structs always have a default value.
- Classes avoid value-copy costs for large objects.
- Consider persistence, serialization, and API boundaries.

<!-- question:end:classes-structs-records-in-csharp-advanced-q05 -->

<!-- question:start:classes-structs-records-in-csharp-advanced-q06 -->
#### Advanced Q06: What are the risks of using records with mutable reference-type properties?
<!-- question-id:classes-structs-records-in-csharp-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Records provide value equality and support `with` expressions, but they do not automatically make the whole object graph immutable. If a record has a property of type `List<T>`, array, dictionary, or another mutable reference type, that inner object can still be changed.

Also, `with` creates a shallow copy. The original and copied records can still share the same mutable child object. Mutating that child object through one record affects what is observed through the other record.

To avoid this, use immutable collection types, expose read-only views, copy collections defensively, or design records with immutable child objects.

##### Key Points to Mention

- Records are not deeply immutable by default.
- `with` performs a shallow copy.
- Mutable reference properties can be shared between copies.
- Use immutable collections or defensive copying.
- Value equality can be tricky with mutable collections.

<!-- question:end:classes-structs-records-in-csharp-advanced-q06 -->

<!-- question:start:classes-structs-records-in-csharp-advanced-q07 -->
#### Advanced Q07: What is a `ref struct`, and how is it different from a normal struct?
<!-- question-id:classes-structs-records-in-csharp-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

A `ref struct` is a special kind of struct with restrictions that make it safe for stack-only scenarios. It is commonly associated with types such as `Span<T>` and `ReadOnlySpan<T>`. A `ref struct` cannot be boxed and has restrictions around fields, async methods, iterator methods, interfaces, and capturing because it must not escape to the managed heap in unsafe ways.

Normal structs can be boxed, stored in fields, used in arrays, and generally behave like ordinary value types. `ref struct` types are more restricted and are mainly used for high-performance memory-safe APIs.

For most business applications, developers use normal structs or readonly record structs. `ref struct` is more relevant in performance-sensitive libraries, parsing, memory processing, and low-allocation code.

##### Key Points to Mention

- `ref struct` is stack-only by design.
- `Span<T>` is a common example.
- `ref struct` has escape and usage restrictions.
- It cannot be boxed.
- It is mainly used for high-performance memory scenarios.

<!-- question:end:classes-structs-records-in-csharp-advanced-q07 -->

<!-- question:start:classes-structs-records-in-csharp-advanced-q08 -->
#### Advanced Q08: How do classes, structs, and records affect API versioning and compatibility?
<!-- question-id:classes-structs-records-in-csharp-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

Public type choices affect API versioning. Changing a public class to a struct, or a struct to a class, is a breaking change because it changes semantics, assignment behavior, nullability, boxing, inheritance, and binary compatibility.

Adding properties to records can also affect equality, hash codes, deconstruction, serialization, and tests. For positional records, changing constructor parameters can break callers and pattern matching code.

Structs require extra care because adding fields increases copy size and can affect performance. Mutable public fields or properties are hard to change later without breaking consumers.

For public APIs, choose the type kind carefully up front. Prefer stable contracts, explicit properties, and avoid exposing unnecessary implementation details.

##### Key Points to Mention

- Changing class vs struct is a breaking semantic change.
- Positional record changes can break constructors and deconstruction.
- Adding record properties may affect equality and hash codes.
- Adding fields to structs can affect copy cost and performance.
- Public APIs should use stable and intentional type design.

<!-- question:end:classes-structs-records-in-csharp-advanced-q08 -->

<!-- question:start:classes-structs-records-in-csharp-advanced-q09 -->
#### Advanced Q09: How would you explain class, struct, and record choices in a Clean Architecture application?
<!-- question-id:classes-structs-records-in-csharp-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

In a Clean Architecture application, classes are usually used for domain entities, aggregate roots, services, handlers, repositories, controllers, and infrastructure services because these types have identity, dependencies, behavior, lifecycle, or framework integration needs.

Structs or readonly record structs can be used for small value objects such as IDs, percentages, amounts, date ranges, and other strongly typed values. These types make invalid usage harder and communicate domain meaning better than raw primitives.

Record classes are often useful for DTOs, query results, integration events, API requests, API responses, and immutable application-layer models. They reduce boilerplate and make value equality useful in tests and message processing.

The key is not to choose one type everywhere. The type should match the role: entity, value object, service, command, query, response, or event.

##### Key Points to Mention

- Entities and services are usually classes.
- Small value objects can be readonly record structs.
- DTOs and read models are good record candidates.
- EF Core tracked entities are usually classes.
- Choose based on identity, behavior, equality, and framework requirements.

<!-- question:end:classes-structs-records-in-csharp-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
