---
id: records-in-csharp
topic: Modern C# patterns
subtopic: Records in C#
category: .NET
---


## Overview

Records in C# are data-focused types that provide built-in support for value-based equality, concise declaration syntax, readable `ToString()` output, deconstruction, and nondestructive mutation through `with` expressions.

A record can be declared as a reference type or a value type:

```csharp
public record CustomerDto(Guid Id, string Name);              // record class by default
public record class CustomerViewModel(Guid Id, string Name);  // explicit reference type
public record struct Money(decimal Amount, string Currency);  // value type
public readonly record struct Point(int X, int Y);            // immutable value type
```

Records matter because modern C# applications often use small data-carrier types for API responses, commands, queries, configuration values, domain events, integration messages, and DTOs. Without records, developers often write repetitive code for constructors, equality, `GetHashCode()`, `ToString()`, and copy operations. Records reduce that boilerplate while making the intent of the type clearer.

Records are important for interviews because they test whether a developer understands more than syntax. A strong candidate should be able to explain value equality, immutability, reference type versus value type behavior, `with` expressions, positional records, inheritance limitations, and when records should not be used. Interviewers often ask records together with classes, structs, DTOs, Entity Framework Core entities, immutability, and clean architecture boundaries.

## Core Concepts

### What a Record Is

A record is a C# type designed primarily to store data. The `record` modifier tells the compiler to generate members that are useful for data models.

For a typical record, the compiler can generate:

- a primary constructor
- public properties from positional parameters
- value-based equality
- `Equals`
- `GetHashCode`
- `==` and `!=` operators
- `ToString`
- `Deconstruct`
- support for `with` expressions

Example:

```csharp
public record UserDto(int Id, string Email);

var user1 = new UserDto(1, "admin@example.com");
var user2 = new UserDto(1, "admin@example.com");

Console.WriteLine(user1 == user2); // True
Console.WriteLine(user1);          // UserDto { Id = 1, Email = admin@example.com }
```

With a normal class, `==` usually checks whether two variables refer to the same object unless equality is manually implemented. With a record, equality is value-based by default.

### Record Class, Record Struct, and Readonly Record Struct

C# supports several record forms.

```csharp
public record ProductDto(int Id, string Name);
```

This is shorthand for a `record class`, so it is a reference type.

```csharp
public record class ProductDto(int Id, string Name);
```

This is the explicit reference-type form.

```csharp
public record struct Coordinate(double Latitude, double Longitude);
```

This creates a value-type record.

```csharp
public readonly record struct Coordinate(double Latitude, double Longitude);
```

This creates a readonly value-type record, which is useful for small immutable values.

The important distinction is that `record` does not automatically mean value type. A `record class` is still a reference type. A `record struct` is a value type.

### Positional Records

A positional record declares its data members directly in the type declaration.

```csharp
public record OrderSummary(int OrderId, decimal TotalAmount, string Status);
```

The compiler generates a constructor and public properties.

```csharp
var summary = new OrderSummary(1001, 250.75m, "Paid");

Console.WriteLine(summary.OrderId);
Console.WriteLine(summary.TotalAmount);
Console.WriteLine(summary.Status);
```

Positional records are compact and useful for DTOs, read models, messages, and value-like data.

A positional record also supports deconstruction:

```csharp
var (orderId, totalAmount, status) = summary;

Console.WriteLine(orderId);
Console.WriteLine(totalAmount);
Console.WriteLine(status);
```

This is convenient when the shape of the data is small and obvious. However, positional records can become hard to read when they contain many fields or fields of the same type.

Less readable:

```csharp
public record Address(string Line1, string Line2, string City, string State, string Country, string PostalCode);
```

For larger models, property-based syntax is often clearer.

### Property-Based Records

Records can also be declared with normal property syntax.

```csharp
public record CreateCustomerRequest
{
    public required string Name { get; init; }
    public required string Email { get; init; }
    public string? PhoneNumber { get; init; }
}
```

This style is useful when:

- the type has many properties
- optional properties are involved
- property names improve readability
- validation attributes are used
- the object is serialized or deserialized
- the model is used in an API request or response

Example:

```csharp
var request = new CreateCustomerRequest
{
    Name = "Alice",
    Email = "alice@example.com",
    PhoneNumber = "123456789"
};
```

This style is usually more maintainable for ASP.NET Core request and response models than long positional constructors.

### Value-Based Equality

The most important feature of records is value-based equality.

```csharp
public record CustomerDto(int Id, string Name);

var a = new CustomerDto(1, "Alice");
var b = new CustomerDto(1, "Alice");

Console.WriteLine(a == b);      // True
Console.WriteLine(a.Equals(b)); // True
```

For a normal class:

```csharp
public class CustomerClass
{
    public int Id { get; init; }
    public string Name { get; init; } = "";
}

var a = new CustomerClass { Id = 1, Name = "Alice" };
var b = new CustomerClass { Id = 1, Name = "Alice" };

Console.WriteLine(a == b);      // False
Console.WriteLine(a.Equals(b)); // False by default
```

Records compare values instead of object references by default.

This makes records useful for:

- DTOs
- value objects
- messages
- events
- commands
- query results
- test expected values
- configuration snapshots

However, value equality can become surprising when the record contains mutable reference-type properties.

```csharp
public record Customer(string Name, List<string> Tags);

var tags = new List<string> { "Premium" };

var customer1 = new Customer("Alice", tags);
var customer2 = customer1 with { };

customer2.Tags.Add("Active");

Console.WriteLine(customer1.Tags.Count); // 2
```

The `with` expression copied the reference to the same list. It did not deep-clone the list.

### Immutability and Init-Only Properties

Records are commonly used with immutable data.

```csharp
public record CustomerDto
{
    public required int Id { get; init; }
    public required string Name { get; init; }
}
```

`init` means the property can be assigned during object initialization but not changed afterward.

```csharp
var customer = new CustomerDto
{
    Id = 1,
    Name = "Alice"
};

// customer.Name = "Bob"; // Compile-time error
```

This helps prevent accidental mutation and makes code easier to reason about.

However, `init` only protects the property assignment. It does not make referenced objects immutable.

```csharp
public record Report(List<string> Lines);

var report = new Report(new List<string> { "Line 1" });

// The property cannot be reassigned if it is init-only,
// but the list itself can still be mutated.
report.Lines.Add("Line 2");
```

For stronger immutability, prefer immutable collection types or read-only abstractions when appropriate.

```csharp
public record Report(IReadOnlyList<string> Lines);
```

### With Expressions and Nondestructive Mutation

A `with` expression creates a copy of a record with selected properties changed.

```csharp
public record CustomerDto(int Id, string Name, string Status);

var original = new CustomerDto(1, "Alice", "Active");

var updated = original with
{
    Status = "Inactive"
};

Console.WriteLine(original.Status); // Active
Console.WriteLine(updated.Status);  // Inactive
```

This is called nondestructive mutation because the original value is not modified.

`with` expressions are especially useful for:

- immutable update flows
- mapping with small changes
- test data setup
- state transitions
- copy-and-change DTO operations

Example in tests:

```csharp
var validRequest = new CreateCustomerRequest
{
    Name = "Alice",
    Email = "alice@example.com"
};

var invalidRequest = validRequest with
{
    Email = ""
};
```

A common mistake is assuming that `with` performs a deep copy. It does not. It performs a shallow copy.

```csharp
public record OrderDto(int Id, List<string> Items);

var order1 = new OrderDto(1, new List<string> { "Book" });
var order2 = order1 with { };

order2.Items.Add("Pen");

Console.WriteLine(order1.Items.Count); // 2
```

Both records share the same list instance.

### Records and ToString

Records provide a readable `ToString()` implementation by default.

```csharp
public record ProductDto(int Id, string Name);

var product = new ProductDto(10, "Keyboard");

Console.WriteLine(product);
// ProductDto { Id = 10, Name = Keyboard }
```

This is useful for debugging, logging small values, and writing tests.

However, avoid relying on the default `ToString()` format as a stable contract for APIs, files, or integration messages. Use JSON or another explicit serialization format when the output must be stable.

### Records and Deconstruction

Positional records support deconstruction.

```csharp
public record Money(decimal Amount, string Currency);

var price = new Money(99.99m, "USD");

var (amount, currency) = price;

Console.WriteLine(amount);
Console.WriteLine(currency);
```

This can make code concise, but excessive deconstruction can reduce readability if property names would be clearer.

Less clear:

```csharp
var (a, b) = price;
```

More clear:

```csharp
decimal amount = price.Amount;
string currency = price.Currency;
```

Use deconstruction when the meaning is obvious or when pattern matching benefits from positional structure.

### Records and Pattern Matching

Records work well with pattern matching.

```csharp
public record Payment(decimal Amount, string Currency);

static string Classify(Payment payment)
{
    return payment switch
    {
        { Amount: <= 0 } => "Invalid",
        { Currency: "USD", Amount: > 1000 } => "Large USD payment",
        { Currency: "USD" } => "USD payment",
        _ => "Other payment"
    };
}
```

Records also work with positional patterns.

```csharp
public record Point(int X, int Y);

static string Describe(Point point)
{
    return point switch
    {
        (0, 0) => "Origin",
        (> 0, > 0) => "Positive quadrant",
        _ => "Other"
    };
}
```

This is helpful when building small value-like models that represent clear data shapes.

### Record Inheritance

Record classes can inherit from other record classes.

```csharp
public record Person(string FirstName, string LastName);

public record Employee(
    string FirstName,
    string LastName,
    int EmployeeId
) : Person(FirstName, LastName);
```

Records include runtime type information in equality. That means a base record and a derived record are not considered equal just because they share the same base properties.

```csharp
Person person = new Person("Alice", "Nguyen");
Person employee = new Employee("Alice", "Nguyen", 1001);

Console.WriteLine(person == employee); // False
```

This behavior helps prevent accidental equality between different logical types.

Record structs do not support inheritance because structs cannot inherit from other structs or classes.

### Records vs Classes

Records and classes can both represent reference types, but their defaults are different.

```csharp
public class CustomerClass
{
    public int Id { get; init; }
    public string Name { get; init; } = "";
}

public record CustomerRecord(int Id, string Name);
```

Key differences:

| Feature | Class | Record Class |
|---|---|---|
| Main purpose | Behavior and identity | Data and value equality |
| Equality by default | Reference equality | Value equality |
| `ToString()` by default | Type name | Property-based output |
| `with` expression support | Not by default | Supported |
| Immutability | Manual design | Common with `init` |
| Best fit | Entities, services, behavior-rich objects | DTOs, value objects, messages |

Use a class when identity matters.

```csharp
public class BankAccount
{
    public Guid Id { get; private set; }
    public decimal Balance { get; private set; }

    public void Deposit(decimal amount)
    {
        if (amount <= 0)
            throw new ArgumentOutOfRangeException(nameof(amount));

        Balance += amount;
    }
}
```

Use a record when data values matter more than identity.

```csharp
public record BankAccountSummary(Guid Id, decimal Balance);
```

### Records vs Structs

A `record struct` is a value type with record-generated features.

```csharp
public record struct Money(decimal Amount, string Currency);
```

A normal struct is also a value type, but it does not get all record features in the same concise way.

```csharp
public struct MoneyStruct
{
    public decimal Amount { get; init; }
    public string Currency { get; init; }
}
```

Use `record struct` for small, immutable or value-like data where copying is cheap and value semantics are desired.

Good candidates:

```csharp
public readonly record struct Money(decimal Amount, string Currency);
public readonly record struct Percentage(decimal Value);
public readonly record struct Coordinate(double Latitude, double Longitude);
```

Avoid large mutable record structs because copying value types can be expensive and confusing.

### Records and Entity Framework Core

Records are usually not the best choice for Entity Framework Core entity types.

Entity types usually need identity and change tracking. EF Core tracks entity instances by reference identity. Records use value equality by default, which can conflict with the mental model of entities.

Usually prefer classes for EF Core entities:

```csharp
public class Customer
{
    public Guid Id { get; private set; }
    public string Name { get; private set; } = "";

    private Customer()
    {
    }

    public Customer(Guid id, string name)
    {
        Id = id;
        Name = name;
    }

    public void ChangeName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name is required.", nameof(name));

        Name = name;
    }
}
```

Records are often better for DTOs around the entity:

```csharp
public record CustomerResponse(Guid Id, string Name);
public record CreateCustomerCommand(string Name);
```

A common interview answer is: use records for values and data transfer models, but be careful using them for persistent entities where identity and tracking matter.

### Records as DTOs, Commands, Queries, and Events

Records are common in ASP.NET Core and CQRS-style applications.

DTO example:

```csharp
public record ProductResponse(
    Guid Id,
    string Name,
    decimal Price
);
```

Command example:

```csharp
public record CreateProductCommand(
    string Name,
    decimal Price
);
```

Query example:

```csharp
public record GetProductByIdQuery(Guid Id);
```

Event example:

```csharp
public record ProductCreatedEvent(
    Guid ProductId,
    string Name,
    DateTimeOffset CreatedAt
);
```

Records fit these cases because the objects primarily carry data and often benefit from value equality in tests.

### Required Members and Records

Records can use `required` members when object initializers are preferred.

```csharp
public record RegisterUserRequest
{
    public required string Email { get; init; }
    public required string Password { get; init; }
}
```

This helps ensure important properties are initialized.

However, `required` is a compile-time feature. It does not replace runtime validation.

```csharp
public static void Validate(RegisterUserRequest request)
{
    if (string.IsNullOrWhiteSpace(request.Email))
        throw new ArgumentException("Email is required.");

    if (request.Password.Length < 8)
        throw new ArgumentException("Password must be at least 8 characters.");
}
```

In real applications, still use validation approaches such as model validation, FluentValidation, or explicit business rules.

### Customizing Record Behavior

Records allow custom members.

```csharp
public record Money(decimal Amount, string Currency)
{
    public override string ToString()
    {
        return $"{Amount:0.00} {Currency}";
    }
}
```

You can also add validation in a constructor or factory method.

```csharp
public record EmailAddress
{
    public string Value { get; }

    public EmailAddress(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("Email is required.", nameof(value));

        if (!value.Contains('@'))
            throw new ArgumentException("Invalid email format.", nameof(value));

        Value = value;
    }
}
```

Be careful not to overuse records for behavior-heavy domain objects. If the type has complex lifecycle rules, many methods, state transitions, or identity, a class is often clearer.

### Shallow Immutability

Records are often described as immutable, but this can be misleading.

```csharp
public record UserProfile(string Name, List<string> Roles);
```

The record property might be init-only, but the list is still mutable.

```csharp
var profile = new UserProfile("Alice", new List<string> { "Admin" });

profile.Roles.Add("Manager");
```

For safer designs, use immutable collections or avoid exposing mutable collections directly.

```csharp
public record UserProfile(string Name, IReadOnlyList<string> Roles);
```

Even `IReadOnlyList<T>` only prevents mutation through that interface. If the original list is still referenced elsewhere, it can still be changed. For stronger immutability, copy the input into an immutable collection or a private array.

### Common Mistakes

A common mistake is thinking that all records are value types.

```csharp
public record User(int Id); // reference type
```

Only `record struct` is a value type.

Another mistake is using records for everything. Records are excellent for data-centric types, but not every model should be a record.

Avoid using records blindly for:

- EF Core entities
- behavior-heavy domain aggregates
- mutable objects with complex lifecycle
- services
- objects where reference identity is important

Another common mistake is assuming `with` performs deep cloning. It does not.

```csharp
public record Cart(List<string> Items);

var cart1 = new Cart(new List<string> { "Book" });
var cart2 = cart1 with { };

cart2.Items.Add("Pen");

Console.WriteLine(cart1.Items.Count); // 2
```

Another mistake is creating very large `record struct` types. Large structs can be expensive to copy and can make performance worse.

### Best Practices

Use records when the type is primarily a data carrier and value equality is desired.

Prefer `record class` for most DTOs, API models, commands, queries, and events.

```csharp
public record OrderResponse(Guid Id, decimal Total, string Status);
```

Use `readonly record struct` for small value-like objects.

```csharp
public readonly record struct ProductId(Guid Value);
```

Use property-based records for larger request/response models.

```csharp
public record UpdateProductRequest
{
    public required string Name { get; init; }
    public required decimal Price { get; init; }
    public string? Description { get; init; }
}
```

Avoid mutable collection properties unless mutation is intentional.

```csharp
public record TeamDto(string Name, IReadOnlyList<string> Members);
```

Do not rely on records alone for validation. Records help with data modeling, but they do not automatically enforce business rules.

Use classes for entities and behavior-rich domain models where identity and lifecycle matter.

Use records in tests to simplify expected data comparisons.

```csharp
var expected = new ProductResponse(product.Id, "Keyboard", 99.99m);
var actual = MapToResponse(product);

Assert.Equal(expected, actual);
```

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:records-in-csharp-beginner-q01 -->
#### Beginner Q01: What is a record in C#?

<!-- question-id:records-in-csharp-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A record in C# is a data-focused type that provides compiler-generated behavior useful for storing and comparing data. Records support value-based equality, readable `ToString()` output, deconstruction for positional records, and nondestructive mutation using `with` expressions.

A record can be a reference type or a value type. `record` and `record class` create reference types. `record struct` creates a value type.

Records are commonly used for DTOs, API responses, commands, queries, events, and value-like models where equality should be based on data values instead of object identity.

##### Key Points to Mention

- Records are designed for data-centric models.
- `record` is shorthand for `record class`.
- `record struct` creates a value type.
- Records provide value-based equality by default.
- Records reduce boilerplate for DTO-like types.
- Records support `with` expressions.

<!-- question:end:records-in-csharp-beginner-q01 -->

<!-- question:start:records-in-csharp-beginner-q02 -->
#### Beginner Q02: What is the difference between a record and a class?

<!-- question-id:records-in-csharp-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A class uses reference equality by default, meaning two class instances are considered equal only when they refer to the same object unless equality is manually overridden. A record class uses value-based equality by default, meaning two record instances with the same type and same property values are considered equal.

Classes are usually better for objects with identity, behavior, lifecycle, and mutable state. Records are usually better for data transfer objects, immutable data models, commands, queries, events, and values where equality should be based on data.

Example:

```csharp
public class CustomerClass
{
    public int Id { get; init; }
    public string Name { get; init; } = "";
}

public record CustomerRecord(int Id, string Name);
```

Two `CustomerRecord` instances with the same values are equal by default. Two `CustomerClass` instances with the same values are not equal by default unless equality is implemented.

##### Key Points to Mention

- Classes default to reference equality.
- Record classes default to value equality.
- Records generate useful members automatically.
- Classes are better for identity and behavior.
- Records are better for data-focused models.
- Both `class` and `record class` are reference types.

<!-- question:end:records-in-csharp-beginner-q02 -->

<!-- question:start:records-in-csharp-beginner-q03 -->
#### Beginner Q03: Is a record a reference type or a value type?

<!-- question-id:records-in-csharp-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

It depends on how the record is declared.

`record` and `record class` create reference types.

```csharp
public record UserDto(int Id, string Name);
public record class ProductDto(int Id, string Name);
```

`record struct` and `readonly record struct` create value types.

```csharp
public record struct Point(int X, int Y);
public readonly record struct Money(decimal Amount, string Currency);
```

A common mistake is saying records are value types. That is not true. The `record` modifier adds data-friendly behavior, but the underlying kind of type still matters.

##### Key Points to Mention

- `record` is shorthand for `record class`.
- `record class` is a reference type.
- `record struct` is a value type.
- The `record` modifier does not automatically mean value type.
- Reference/value semantics still depend on class versus struct.

<!-- question:end:records-in-csharp-beginner-q03 -->

<!-- question:start:records-in-csharp-beginner-q04 -->
#### Beginner Q04: What is value-based equality in records?

<!-- question-id:records-in-csharp-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Value-based equality means that two record instances are considered equal when they are the same record type and their stored values are equal.

Example:

```csharp
public record ProductDto(int Id, string Name);

var a = new ProductDto(1, "Keyboard");
var b = new ProductDto(1, "Keyboard");

Console.WriteLine(a == b); // True
```

This differs from normal class behavior, where two separate objects are usually not equal unless they are the same reference or equality is manually implemented.

Value-based equality is useful for DTOs, value objects, messages, commands, events, and tests.

##### Key Points to Mention

- Records compare data values by default.
- Record equality includes the record type.
- Normal classes use reference equality by default.
- Value equality makes testing and DTO comparison easier.
- Mutable reference-type properties can still cause surprises.

<!-- question:end:records-in-csharp-beginner-q04 -->

<!-- question:start:records-in-csharp-beginner-q05 -->
#### Beginner Q05: What is a positional record?

<!-- question-id:records-in-csharp-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

A positional record declares its data members directly in the record declaration.

```csharp
public record CustomerDto(int Id, string Name);
```

The compiler generates a constructor and public properties based on the positional parameters. Positional records also support deconstruction.

```csharp
var customer = new CustomerDto(1, "Alice");

var (id, name) = customer;
```

Positional records are concise and useful for small DTOs and simple data models. For larger models, property-based records may be more readable.

##### Key Points to Mention

- Positional records use constructor-like syntax.
- The compiler generates properties.
- They support deconstruction.
- They are concise for small data models.
- Too many positional parameters can hurt readability.

<!-- question:end:records-in-csharp-beginner-q05 -->

<!-- question:start:records-in-csharp-beginner-q06 -->
#### Beginner Q06: What is a `with` expression in records?

<!-- question-id:records-in-csharp-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

A `with` expression creates a copy of a record with selected properties changed. The original record is not modified.

```csharp
public record CustomerDto(int Id, string Name, string Status);

var original = new CustomerDto(1, "Alice", "Active");

var updated = original with
{
    Status = "Inactive"
};

Console.WriteLine(original.Status); // Active
Console.WriteLine(updated.Status);  // Inactive
```

This is useful for immutable models because it allows update-like behavior without changing the original object.

However, a `with` expression performs a shallow copy, not a deep copy.

##### Key Points to Mention

- `with` creates a copy with changed properties.
- It supports nondestructive mutation.
- The original instance remains unchanged.
- It is useful for immutable data flows.
- It performs a shallow copy.

<!-- question:end:records-in-csharp-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:records-in-csharp-intermediate-q01 -->
#### Intermediate Q01: When should you use a record instead of a class?

<!-- question-id:records-in-csharp-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use a record when the type is primarily used to store data and equality should be based on the values of that data. Records are a good fit for DTOs, request/response models, commands, queries, integration events, domain events, immutable state snapshots, and small value-like models.

Use a class when identity and behavior matter. For example, domain entities, EF Core entities, services, aggregates with lifecycle rules, and objects with complex mutation are usually better as classes.

Example:

```csharp
public record CustomerResponse(Guid Id, string Name);

public class Customer
{
    public Guid Id { get; private set; }
    public string Name { get; private set; } = "";

    public void ChangeName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name is required.", nameof(name));

        Name = name;
    }
}
```

The response model is data-focused, so a record fits. The entity has identity and behavior, so a class fits better.

##### Key Points to Mention

- Use records for data-centric models.
- Use classes for identity and behavior.
- Records are common for DTOs, commands, queries, and events.
- Classes are usually better for EF Core entities.
- Do not choose records only because the syntax is shorter.

<!-- question:end:records-in-csharp-intermediate-q01 -->

<!-- question:start:records-in-csharp-intermediate-q02 -->
#### Intermediate Q02: What is the difference between `record class` and `record struct`?

<!-- question-id:records-in-csharp-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A `record class` is a reference type. Assignment copies the reference, and the object is allocated and managed like other reference types. A `record struct` is a value type. Assignment copies the value.

Both support record features such as value equality, `ToString()`, and `with` expressions, but their underlying memory and copying semantics are different.

Example:

```csharp
public record class CustomerDto(int Id, string Name);
public record struct Point(int X, int Y);
```

Use `record class` for most DTOs and data models, especially when the object may be larger or when reference semantics are acceptable. Use `record struct` for small, self-contained values where value-type copy semantics make sense.

##### Key Points to Mention

- `record class` is a reference type.
- `record struct` is a value type.
- Both provide record-generated members.
- Struct assignment copies values.
- Class assignment copies references.
- Use record structs only for small value-like data.

<!-- question:end:records-in-csharp-intermediate-q02 -->

<!-- question:start:records-in-csharp-intermediate-q03 -->
#### Intermediate Q03: Are records immutable?

<!-- question-id:records-in-csharp-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Records are commonly used for immutable data, but records are not automatically deeply immutable.

A positional `record class` creates init-only properties by default.

```csharp
public record CustomerDto(int Id, string Name);
```

After construction, those properties cannot be assigned again.

However, records can be mutable if you define settable properties.

```csharp
public record CustomerDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}
```

Also, even init-only properties do not make referenced objects immutable.

```csharp
public record Report(List<string> Lines);

var report = new Report(new List<string> { "Line 1" });
report.Lines.Add("Line 2");
```

The property reference is fixed, but the list can still be modified.

##### Key Points to Mention

- Records are often immutable by convention.
- Positional record classes use init-only properties by default.
- Records can still be made mutable.
- `init` does not create deep immutability.
- Mutable reference properties can still change.
- Use immutable collections or read-only abstractions for safer designs.

<!-- question:end:records-in-csharp-intermediate-q03 -->

<!-- question:start:records-in-csharp-intermediate-q04 -->
#### Intermediate Q04: What does it mean that `with` expressions perform shallow copies?

<!-- question-id:records-in-csharp-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

A shallow copy means the record object is copied, but referenced objects inside it are not cloned. If a record has a property that points to a list, array, dictionary, or another mutable object, the copied record can still share that same inner object.

Example:

```csharp
public record Cart(List<string> Items);

var cart1 = new Cart(new List<string> { "Book" });
var cart2 = cart1 with { };

cart2.Items.Add("Pen");

Console.WriteLine(cart1.Items.Count); // 2
Console.WriteLine(cart2.Items.Count); // 2
```

Both records share the same list. The `with` expression did not create a new list.

To avoid this issue, use immutable collections, copy the collection manually, or design the record to avoid exposing mutable references.

##### Key Points to Mention

- `with` does not deep-clone nested objects.
- Reference-type properties can be shared.
- Mutable collections are a common source of bugs.
- Use immutable collections or manual copying when needed.
- This is important for safe immutable design.

<!-- question:end:records-in-csharp-intermediate-q04 -->

<!-- question:start:records-in-csharp-intermediate-q05 -->
#### Intermediate Q05: Why are records useful for DTOs and CQRS messages?

<!-- question-id:records-in-csharp-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Records are useful for DTOs and CQRS messages because these types are usually data carriers. They often do not need identity or complex behavior. Records provide concise syntax, value equality, readable debugging output, and easy copy operations.

Examples:

```csharp
public record CreateOrderCommand(Guid CustomerId, IReadOnlyList<OrderLineDto> Lines);

public record GetOrderByIdQuery(Guid OrderId);

public record OrderCreatedEvent(Guid OrderId, DateTimeOffset CreatedAt);

public record OrderResponse(Guid Id, decimal Total, string Status);
```

In CQRS, commands, queries, events, and responses are often passed between layers. Records make these models simple, explicit, and easy to compare in unit tests.

##### Key Points to Mention

- CQRS messages are usually data-focused.
- Records reduce boilerplate.
- Value equality helps in tests.
- Records work well for immutable request/response models.
- They make message intent clear.
- They should not replace behavior-rich domain entities.

<!-- question:end:records-in-csharp-intermediate-q05 -->

<!-- question:start:records-in-csharp-intermediate-q06 -->
#### Intermediate Q06: Why should you be careful using records as EF Core entities?

<!-- question-id:records-in-csharp-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

EF Core entities usually represent objects with identity and lifecycle. EF Core tracks entity instances and expects reference identity semantics in many typical designs. Records, however, use value-based equality by default, which can conflict with how developers usually think about persistent entities.

Entities also often contain behavior, relationships, private setters, backing fields, and state transitions. A class usually communicates this better than a record.

A safer approach is to use classes for EF Core entities and records for DTOs, commands, queries, and API responses.

```csharp
public class Customer
{
    public Guid Id { get; private set; }
    public string Name { get; private set; } = "";

    private Customer()
    {
    }

    public Customer(Guid id, string name)
    {
        Id = id;
        Name = name;
    }
}

public record CustomerResponse(Guid Id, string Name);
```

##### Key Points to Mention

- EF Core entities usually need identity.
- Records use value equality by default.
- EF Core tracks object instances.
- Classes are usually clearer for entities.
- Records are better for DTOs around the entity.
- Do not use records for entities just to reduce boilerplate.

<!-- question:end:records-in-csharp-intermediate-q06 -->

<!-- question:start:records-in-csharp-intermediate-q07 -->
#### Intermediate Q07: What members does the compiler generate for records?

<!-- question-id:records-in-csharp-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

For records, the compiler generates members that support value-based behavior and concise data modeling. Depending on the record form, generated members can include:

- constructor
- public properties from positional parameters
- `Equals`
- `GetHashCode`
- `==` and `!=`
- `ToString`
- `Deconstruct`
- support for `with` expressions

Example:

```csharp
public record ProductDto(int Id, string Name);
```

This small declaration provides functionality that would require much more code in a normal class.

The exact generated members depend on whether the record is positional, property-based, class-based, or struct-based.

##### Key Points to Mention

- Records reduce boilerplate.
- Equality members are generated.
- `ToString()` is generated.
- Positional records get constructor properties and deconstruction.
- `with` expression support is generated.
- Generated behavior can be customized when necessary.

<!-- question:end:records-in-csharp-intermediate-q07 -->

<!-- question:start:records-in-csharp-intermediate-q08 -->
#### Intermediate Q08: How do records work with pattern matching?

<!-- question-id:records-in-csharp-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

Records work well with pattern matching because they usually represent clear data shapes. You can use property patterns or positional patterns with records.

Property pattern example:

```csharp
public record Payment(decimal Amount, string Currency);

static string Classify(Payment payment)
{
    return payment switch
    {
        { Amount: <= 0 } => "Invalid",
        { Currency: "USD", Amount: > 1000 } => "Large USD payment",
        { Currency: "USD" } => "USD payment",
        _ => "Other payment"
    };
}
```

Positional pattern example:

```csharp
public record Point(int X, int Y);

static string Describe(Point point)
{
    return point switch
    {
        (0, 0) => "Origin",
        (> 0, > 0) => "Positive quadrant",
        _ => "Other"
    };
}
```

This is useful for clean conditional logic over immutable data models.

##### Key Points to Mention

- Records pair naturally with pattern matching.
- Property patterns use named properties.
- Positional patterns use deconstruction.
- Pattern matching can make branching logic cleaner.
- Use property patterns when names improve readability.

<!-- question:end:records-in-csharp-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:records-in-csharp-advanced-q01 -->
#### Advanced Q01: How does equality work with record inheritance?

<!-- question-id:records-in-csharp-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Record classes can inherit from other record classes. Record equality includes the runtime type, not just shared property values. This prevents a base record and a derived record from being considered equal when they represent different logical types.

Example:

```csharp
public record Person(string FirstName, string LastName);

public record Employee(
    string FirstName,
    string LastName,
    int EmployeeId
) : Person(FirstName, LastName);

Person person = new Person("Alice", "Nguyen");
Person employee = new Employee("Alice", "Nguyen", 1001);

Console.WriteLine(person == employee); // False
```

Although the base properties match, the records have different runtime types. This behavior helps preserve logical correctness in inheritance hierarchies.

Record structs cannot inherit from other record structs because structs do not support inheritance.

##### Key Points to Mention

- Record classes can inherit from record classes.
- Record equality includes runtime type.
- Base and derived records are not equal just because shared properties match.
- This avoids accidental equality across different logical types.
- Record structs do not support inheritance.
- Prefer composition if record inheritance becomes confusing.

<!-- question:end:records-in-csharp-advanced-q01 -->

<!-- question:start:records-in-csharp-advanced-q02 -->
#### Advanced Q02: What are the risks of using mutable properties in records?

<!-- question-id:records-in-csharp-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Mutable properties can undermine the main benefits of records. Records are often expected to behave like stable values. If their properties can change after creation, equality and hash codes can also change.

This is especially dangerous when records are used as keys in dictionaries or stored in hash sets.

```csharp
public record Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

var product = new Product { Id = 1, Name = "Keyboard" };

var set = new HashSet<Product> { product };

product.Name = "Mouse";

Console.WriteLine(set.Contains(product)); // Can become unreliable
```

Because the hash code is based on values, changing those values after insertion can break hash-based lookup behavior.

For records used as values or keys, prefer immutable properties.

##### Key Points to Mention

- Mutable records can be surprising.
- Changing record values changes equality behavior.
- Changing values can change hash codes.
- HashSet and Dictionary keys can break if mutated.
- Prefer immutable records for value-like models.
- Use classes for mutable identity-based objects.

<!-- question:end:records-in-csharp-advanced-q02 -->

<!-- question:start:records-in-csharp-advanced-q03 -->
#### Advanced Q03: How would you model a value object using records?

<!-- question-id:records-in-csharp-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

A value object is defined by its values rather than identity, so records can be a good fit. A good value object should be immutable, validate its invariants, and avoid exposing mutable internal state.

Example:

```csharp
public sealed record EmailAddress
{
    public string Value { get; }

    public EmailAddress(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("Email is required.", nameof(value));

        if (!value.Contains('@'))
            throw new ArgumentException("Invalid email format.", nameof(value));

        Value = value;
    }

    public override string ToString() => Value;
}
```

For small value objects, a `readonly record struct` can also be appropriate.

```csharp
public readonly record struct ProductId(Guid Value)
{
    public ProductId() : this(Guid.NewGuid())
    {
    }
}
```

The choice between `record class` and `readonly record struct` depends on size, copying cost, nullability needs, and how the value is used.

##### Key Points to Mention

- Value objects are defined by values, not identity.
- Records provide value equality.
- Enforce invariants in constructors or factories.
- Prefer immutability.
- Avoid mutable collection properties.
- Use `readonly record struct` only for small values.

<!-- question:end:records-in-csharp-advanced-q03 -->

<!-- question:start:records-in-csharp-advanced-q04 -->
#### Advanced Q04: What is the difference between shallow immutability and deep immutability in records?

<!-- question-id:records-in-csharp-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Shallow immutability means the record's properties cannot be reassigned after initialization, but the objects referenced by those properties may still be mutable. Deep immutability means the entire object graph cannot be changed.

Example of shallow immutability:

```csharp
public record UserProfile(string Name, List<string> Roles);

var profile = new UserProfile("Alice", new List<string> { "Admin" });

profile.Roles.Add("Manager");
```

The `Roles` property itself was not reassigned, but the list was modified.

A safer approach is to use read-only or immutable collection types and defensive copying.

```csharp
public record UserProfile
{
    public string Name { get; }
    public IReadOnlyList<string> Roles { get; }

    public UserProfile(string name, IEnumerable<string> roles)
    {
        Name = name;
        Roles = roles.ToArray();
    }
}
```

For stronger immutability, immutable collection types can be used.

##### Key Points to Mention

- Records are not automatically deeply immutable.
- `init` prevents reassignment, not object mutation.
- Lists, arrays, and dictionaries remain mutable.
- `with` expressions perform shallow copies.
- Use defensive copies or immutable collections.
- Deep immutability requires deliberate design.

<!-- question:end:records-in-csharp-advanced-q04 -->

<!-- question:start:records-in-csharp-advanced-q05 -->
#### Advanced Q05: Should records contain business logic?

<!-- question-id:records-in-csharp-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Records can contain methods and validation, but they are usually best for data-focused models and simple value objects. It is acceptable for a record to contain logic that protects its own invariants or derives values from its data.

Example:

```csharp
public record Money(decimal Amount, string Currency)
{
    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new InvalidOperationException("Currencies must match.");

        return this with
        {
            Amount = Amount + other.Amount
        };
    }
}
```

However, if the type has complex lifecycle rules, identity, many state transitions, or behavior that changes internal state over time, a class is usually more appropriate.

Records should not be used as a shortcut to avoid designing a proper domain model.

##### Key Points to Mention

- Records can contain methods.
- Simple invariant and derived-value logic is acceptable.
- Records fit value objects well.
- Behavior-heavy domain entities usually fit classes better.
- Identity and lifecycle usually point to classes.
- Do not make every model a record by default.

<!-- question:end:records-in-csharp-advanced-q05 -->

<!-- question:start:records-in-csharp-advanced-q06 -->
#### Advanced Q06: How do records affect testing?

<!-- question-id:records-in-csharp-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Records are useful in tests because value equality makes expected and actual objects easy to compare.

Example:

```csharp
public record ProductResponse(Guid Id, string Name, decimal Price);

var expected = new ProductResponse(productId, "Keyboard", 99.99m);

var actual = service.GetProduct(productId);

Assert.Equal(expected, actual);
```

With normal classes, this comparison might fail unless equality is implemented. Records reduce the amount of test-specific comparison code.

Records also make test data setup easier with `with` expressions.

```csharp
var valid = new ProductResponse(productId, "Keyboard", 99.99m);
var discounted = valid with { Price = 79.99m };
```

However, tests can become misleading if records contain mutable reference properties. In that case, two records may share the same nested object.

##### Key Points to Mention

- Value equality simplifies assertions.
- `with` expressions simplify test variations.
- Records reduce test boilerplate.
- They work well for expected DTOs and events.
- Be careful with mutable nested objects.
- Do not use records to hide poor domain modeling.

<!-- question:end:records-in-csharp-advanced-q06 -->

<!-- question:start:records-in-csharp-advanced-q07 -->
#### Advanced Q07: How do `required`, `init`, and records work together?

<!-- question-id:records-in-csharp-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

`init` properties can be assigned during object initialization but not changed afterward. `required` tells the compiler that the property must be initialized by the caller.

Together, they are useful for property-based records where constructor syntax would be too long or unclear.

```csharp
public record CreateProductRequest
{
    public required string Name { get; init; }
    public required decimal Price { get; init; }
    public string? Description { get; init; }
}
```

This makes required data explicit while preserving an immutable-style design.

However, `required` is not a replacement for runtime validation. It does not guarantee that a string is non-empty, that a price is positive, or that business rules are satisfied.

##### Key Points to Mention

- `init` supports immutable-style initialization.
- `required` forces initialization at compile time.
- They work well with property-based records.
- They improve readability for larger DTOs.
- They do not replace validation.
- Runtime validation is still needed for business rules.

<!-- question:end:records-in-csharp-advanced-q07 -->

<!-- question:start:records-in-csharp-advanced-q08 -->
#### Advanced Q08: What are the performance considerations of record classes and record structs?

<!-- question-id:records-in-csharp-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

A `record class` is a reference type, so assigning it copies the reference, not the whole object. This is usually appropriate for most DTOs and larger data models.

A `record struct` is a value type, so assigning it copies the entire value. This can be efficient for small values, but expensive for large structs. Large mutable structs can also create confusing bugs because developers may accidentally mutate a copy.

Example:

```csharp
public readonly record struct Money(decimal Amount, string Currency);
```

This is reasonable because the data is small and value-like.

A large record struct with many fields or mutable properties is usually not a good design. Prefer `record class` unless there is a clear reason to use value-type semantics.

##### Key Points to Mention

- `record class` copies references.
- `record struct` copies values.
- Small immutable structs can be efficient.
- Large structs can be expensive to copy.
- Mutable structs can be confusing.
- Prefer record classes for most DTOs.

<!-- question:end:records-in-csharp-advanced-q08 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
