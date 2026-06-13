---
id: nullable-reference-types-and-null-safety-habits-in-csharp
topic: C# Language Foundations
subtopic: Nullable reference  C#
category: .NET
---

## Overview

Nullable reference types are a C# language feature that helps developers express whether a reference type is expected to contain `null`.

Before nullable reference types, all reference types in C# could contain `null`, but the type system did not clearly communicate that intent. A method parameter declared as `string name` could still receive `null`, and a property declared as `Customer Customer` could still be uninitialized. This made `NullReferenceException` one of the most common runtime bugs in C# applications.

With nullable reference types enabled, C# distinguishes between:

```csharp
string name;   // Intended to be non-null
string? note;  // Intended to be nullable
```

This does not create a new runtime type. Both are still `System.String` at runtime. The difference is compile-time intent and compiler static analysis. The compiler tracks whether a reference is known to be non-null or maybe-null and produces warnings when code might dereference a null value or assign a maybe-null value to a non-nullable reference.

This topic matters because null-handling affects almost every layer of a .NET application:

- DTOs and API contracts
- ASP.NET Core request models
- EF Core entities and database nullability
- Domain models and value objects
- Service interfaces
- Repository return values
- Configuration and options binding
- External API integration
- Unit tests and defensive programming

For interviews, nullable reference types are important because they test both language knowledge and production habits. A strong candidate should know that null-safety is not just about adding `?` everywhere. It is about designing clear contracts, validating input at boundaries, initializing objects correctly, using compiler warnings instead of ignoring them, and choosing when `null` is appropriate versus when an empty object, empty collection, exception, or result type is better.

A good C# developer uses nullable reference types to make invalid states harder to represent, reduce runtime defects, and make APIs easier to understand.

## Core Concepts

### The null problem in C#

`null` means a reference does not point to an object instance.

For example:

```csharp
Customer? customer = null;

Console.WriteLine(customer.Name); // Possible NullReferenceException
```

The problem is not that `null` exists. The problem is unclear intent.

In many real systems, `null` can mean different things:

- The value is missing.
- The value was not loaded.
- The value is optional.
- The value is unknown.
- The value has not been initialized yet.
- The value does not apply to this case.
- A lookup failed.
- An external system returned incomplete data.

When code does not clearly model these meanings, bugs become likely.

A common interview point is that nullable reference types help document and enforce intent at compile time, but they do not remove `null` from the runtime.

### Nullable reference types vs nullable value types

C# has two related but different nullability concepts.

Nullable value types use `Nullable<T>` under the hood:

```csharp
int? age = null;
DateTime? completedAt = null;
```

`int?` means `Nullable<int>`. It is a real runtime wrapper that can represent either a value or no value.

Nullable reference types are different:

```csharp
string? middleName = null;
Customer? customer = null;
```

`string?` and `string` are the same runtime type. The `?` annotation is mainly compile-time metadata used by the compiler and tools to perform null-state analysis.

Comparison:

| Concept | Nullable value type | Nullable reference type |
|---|---|---|
| Example | `int?` | `string?` |
| Runtime type changes? | Yes, uses `Nullable<T>` | No, still the same reference type |
| Purpose | Allows value types to represent null | Describes whether reference types may be null |
| Compiler analysis | Yes | Yes |
| Common use | Database nullable columns, optional numeric/date values | Optional objects, strings, DTO fields, lookup results |

### Enabling nullable reference types

Nullable reference types are only useful when the nullable context is enabled.

In a project file:

```xml
<PropertyGroup>
  <Nullable>enable</Nullable>
</PropertyGroup>
```

You can also enable or disable it in a specific file or region:

```csharp
#nullable enable

public class Customer
{
    public string Name { get; set; } = string.Empty;
}

#nullable disable
```

Common nullable settings:

| Setting | Meaning |
|---|---|
| `disable` | Nullable annotations and warnings are disabled. This matches older C# behavior. |
| `enable` | Nullable annotations and warnings are enabled. This is recommended for new code. |
| `warnings` | Compiler warns about possible null problems but nullable annotations are not fully enabled. |
| `annotations` | Nullable annotations are enabled but warnings are disabled. |

For new projects, use `enable`. For older projects, teams often migrate gradually by enabling nullable warnings first, fixing high-risk code, then enabling full nullable analysis.

### Nullable annotations: `T` vs `T?`

When nullable reference types are enabled:

```csharp
string firstName = "Minh";
string? middleName = null;
```

`string` means the variable should not contain `null`.

`string?` means the variable may contain `null`, so callers must check it before dereferencing.

Example:

```csharp
public sealed class UserProfile
{
    public required string UserName { get; init; }
    public string? Bio { get; init; }
}
```

This communicates:

- `UserName` is required and should not be null.
- `Bio` is optional and may be null.

The compiler helps enforce this intent:

```csharp
UserProfile profile = new()
{
    UserName = "minh"
};

Console.WriteLine(profile.UserName.Length); // Safe
Console.WriteLine(profile.Bio.Length);      // Warning: Bio may be null
```

The correct handling is:

```csharp
if (!string.IsNullOrWhiteSpace(profile.Bio))
{
    Console.WriteLine(profile.Bio.Length);
}
```

### Null-state analysis

The compiler tracks the null-state of reference variables.

The main states are:

| State | Meaning |
|---|---|
| Not-null | Compiler believes the value is safe to dereference. |
| Maybe-null | Compiler cannot prove the value is non-null. |

Example:

```csharp
static int GetLength(string? value)
{
    return value.Length; // Warning: value may be null
}
```

After a null check, the compiler updates the null-state:

```csharp
static int GetLength(string? value)
{
    if (value is null)
    {
        return 0;
    }

    return value.Length; // Safe
}
```

The compiler understands common null checks:

```csharp
if (customer != null)
{
    Console.WriteLine(customer.Name);
}

if (customer is not null)
{
    Console.WriteLine(customer.Name);
}

if (name is { Length: > 0 })
{
    Console.WriteLine(name.ToUpperInvariant());
}
```

It also understands many framework methods such as `string.IsNullOrEmpty` and `string.IsNullOrWhiteSpace`.

### Nullable warnings are warnings, not runtime protection

Nullable reference types are not runtime validation.

This code may compile with warnings, but still run:

```csharp
string name = null!;

Console.WriteLine(name.Length); // Runtime NullReferenceException
```

The compiler helps identify risk, but it does not inject runtime null checks everywhere.

Important interview point:

> Nullable reference types make null problems more visible at compile time. They do not guarantee that a reference can never be null at runtime.

Runtime nulls can still come from:

- Reflection
- Deserialization
- Dependency injection misconfiguration
- External APIs
- Database data
- Legacy code compiled with nullable disabled
- Incorrect use of the null-forgiving operator
- Unsafe code
- Manual assignment of `null`

That is why null-safety requires both compiler support and good coding habits.

### Common nullable warning codes

Interviewers may not expect memorization of every warning code, but knowing common categories is useful.

| Warning | Typical meaning |
|---|---|
| `CS8600` | Converting null or possible null to a non-nullable type. |
| `CS8601` | Possible null reference assignment. |
| `CS8602` | Dereference of a possibly null reference. |
| `CS8603` | Possible null reference return. |
| `CS8604` | Possible null reference argument. |
| `CS8618` | Non-nullable property or field is not initialized. |
| `CS8625` | Cannot convert null literal to non-nullable reference type. |

Example:

```csharp
public sealed class Customer
{
    public string Name { get; set; } // CS8618 if not initialized
}
```

Fix options:

```csharp
public sealed class Customer
{
    public required string Name { get; init; }
}
```

Or:

```csharp
public sealed class Customer
{
    public Customer(string name)
    {
        Name = name;
    }

    public string Name { get; }
}
```

Or, when a property is truly optional:

```csharp
public sealed class Customer
{
    public string? DisplayName { get; set; }
}
```

The best fix depends on the business meaning.

### Required members and object initialization

Non-nullable properties must be initialized.

A common bad habit is using `null!` to silence warnings:

```csharp
public sealed class Customer
{
    public string Name { get; set; } = null!;
}
```

This tells the compiler, "Trust me, this will not be null." If that promise is wrong, the bug becomes a runtime failure.

A better approach is often `required`:

```csharp
public sealed class Customer
{
    public required string Name { get; init; }
    public string? PhoneNumber { get; init; }
}
```

Usage:

```csharp
var customer = new Customer
{
    Name = "Alice"
};
```

The compiler requires callers to initialize `Name`.

Constructor initialization is also strong:

```csharp
public sealed class Customer
{
    public Customer(string name)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        Name = name;
    }

    public string Name { get; }
}
```

Constructor initialization is often preferred in domain models because it lets you enforce invariants.

Use `required` when object initializer style is desirable, such as DTOs, options classes, and simple models.

Use constructors when the object has business rules or must be valid immediately after creation.

### Null checks and guard clauses

Guard clauses validate assumptions early.

Example:

```csharp
public sealed class OrderService
{
    private readonly IOrderRepository _repository;

    public OrderService(IOrderRepository repository)
    {
        ArgumentNullException.ThrowIfNull(repository);
        _repository = repository;
    }
}
```

`ArgumentNullException.ThrowIfNull` is concise and communicates intent clearly.

For strings, use stronger validation when empty or whitespace is also invalid:

```csharp
public sealed class Product
{
    public Product(string name)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        Name = name;
    }

    public string Name { get; }
}
```

Guard clause habit:

```csharp
public async Task<CustomerDto> GetCustomerAsync(string customerId)
{
    ArgumentException.ThrowIfNullOrWhiteSpace(customerId);

    var customer = await _repository.GetByIdAsync(customerId);

    if (customer is null)
    {
        throw new KeyNotFoundException($"Customer '{customerId}' was not found.");
    }

    return MapToDto(customer);
}
```

This separates invalid input from not-found data.

### Null-conditional operator: `?.` and `?[]`

The null-conditional operator safely accesses a member only when the left side is not null.

```csharp
int? length = customer?.Name?.Length;
```

If `customer` is null, the expression returns null instead of throwing.

For collections or arrays:

```csharp
string? firstTag = tags?[0];
```

Use this when null is acceptable and you want to continue with an optional result.

Avoid overusing it when null should be handled explicitly.

Weak example:

```csharp
_logger?.LogInformation("Order created");
```

If `_logger` should always be injected, this hides a dependency injection bug.

Better:

```csharp
ArgumentNullException.ThrowIfNull(logger);
_logger = logger;
```

### Null-coalescing operator: `??`

The null-coalescing operator provides a fallback value.

```csharp
string displayName = user.DisplayName ?? user.UserName;
```

This is useful when the fallback is a valid business default.

Example:

```csharp
public string GetGreeting(string? name)
{
    return $"Hello, {name ?? "guest"}";
}
```

It can also be used with throw expressions:

```csharp
public Customer GetRequiredCustomer(Customer? customer)
{
    return customer ?? throw new ArgumentNullException(nameof(customer));
}
```

Use `??` when the fallback is meaningful. Do not use arbitrary defaults just to avoid null warnings.

Bad example:

```csharp
decimal price = request.Price ?? 0;
```

If missing price is invalid, this silently changes invalid input into a valid value. A validation error would be better.

### Null-coalescing assignment: `??=`

The `??=` operator assigns a value only when the variable is null.

```csharp
private List<string>? _tags;

public List<string> Tags => _tags ??= new List<string>();
```

This is useful for lazy initialization.

However, prefer initializing collections directly when possible:

```csharp
public List<string> Tags { get; } = new();
```

For most domain and DTO collection properties, an empty collection is better than a nullable collection.

### Null-forgiving operator: `!`

The null-forgiving operator suppresses nullable warnings.

```csharp
string? value = GetValue();
Console.WriteLine(value!.Length);
```

It does not check anything at runtime. It only changes the compiler's null-state assumption.

Use it sparingly.

Appropriate uses include:

#### Test setup

```csharp
[Fact]
public void CreateOrder_Throws_WhenCustomerIsNull()
{
    Customer customer = null!;

    Assert.Throws<ArgumentNullException>(() => new Order(customer));
}
```

#### Framework initialization

Some frameworks initialize properties through reflection, binding, or lifecycle methods.

```csharp
public DbSet<Customer> Customers { get; set; } = null!;
```

Even here, use framework-specific best practices and avoid using `null!` casually.

#### EF Core navigation properties

Some required navigation properties are initialized by EF when entities are loaded.

```csharp
public Customer Customer { get; set; } = null!;
```

This can be acceptable, but should be intentional.

Bad use:

```csharp
public string Name { get; set; } = null!;
```

If you control construction, use `required`, a constructor, or a safe default instead.

### The difference between optional and required data

A key null-safety habit is modeling business meaning.

Do not make a property nullable just because it is easy.

Ask:

- Is the value truly optional?
- Is it required but not loaded yet?
- Is it required but initialized by a framework?
- Does missing data represent a validation error?
- Should a failed lookup return null, throw, or return a result object?
- Would an empty collection be clearer than null?
- Would an empty string be valid or invalid?

Example:

```csharp
public sealed class Employee
{
    public required string FullName { get; init; }
    public string? MiddleName { get; init; }
    public DateTime? TerminatedAt { get; init; }
}
```

Here:

- `FullName` is required.
- `MiddleName` is optional.
- `TerminatedAt` is null when the employee is active or termination date is not applicable.

When null has multiple possible meanings, consider a clearer model.

Instead of:

```csharp
public DateTime? ProcessedAt { get; init; }
```

Use:

```csharp
public enum PaymentStatus
{
    Pending,
    Processed,
    Failed
}

public sealed class Payment
{
    public PaymentStatus Status { get; init; }
    public DateTime? ProcessedAt { get; init; }
}
```

The status removes ambiguity.

### Avoid nullable collections when possible

A common production habit is:

> Collections should usually be non-null and empty when there are no items.

Prefer:

```csharp
public List<OrderItem> Items { get; } = new();
```

Instead of:

```csharp
public List<OrderItem>? Items { get; set; }
```

Why?

- Callers can iterate safely.
- It avoids repeated null checks.
- Empty collection clearly means "no items".
- It reduces API ambiguity.

Example:

```csharp
foreach (var item in order.Items)
{
    total += item.Price;
}
```

If `Items` is nullable, every caller must decide what null means.

For API responses, prefer:

```json
{
  "items": []
}
```

Instead of:

```json
{
  "items": null
}
```

unless `null` has a specific business meaning.

### Strings: null, empty, and whitespace

Strings need special care because `null`, `""`, and `"   "` may have different meanings.

Common checks:

```csharp
if (name is null)
{
    // Missing
}

if (name == string.Empty)
{
    // Empty
}

if (string.IsNullOrWhiteSpace(name))
{
    // Missing, empty, or only whitespace
}
```

For required user input, `string.IsNullOrWhiteSpace` is usually better:

```csharp
public static User Create(string userName)
{
    if (string.IsNullOrWhiteSpace(userName))
    {
        throw new ArgumentException("User name is required.", nameof(userName));
    }

    return new User(userName);
}
```

Nullable annotation should match the contract:

```csharp
public void UpdateDisplayName(string? displayName)
{
    // Optional value; null may mean clear display name
}

public void Rename(string newName)
{
    ArgumentException.ThrowIfNullOrWhiteSpace(newName);
    Name = newName;
}
```

### Method parameters: accept null only when meaningful

A method parameter should be nullable only if the method supports null as a valid input.

Good:

```csharp
public string FormatDisplayName(string firstName, string? middleName, string lastName)
{
    ArgumentException.ThrowIfNullOrWhiteSpace(firstName);
    ArgumentException.ThrowIfNullOrWhiteSpace(lastName);

    return string.IsNullOrWhiteSpace(middleName)
        ? $"{firstName} {lastName}"
        : $"{firstName} {middleName} {lastName}";
}
```

Bad:

```csharp
public string FormatDisplayName(string? firstName, string? middleName, string? lastName)
{
    return $"{firstName} {middleName} {lastName}";
}
```

The second version pushes invalid input into string formatting and may hide bugs.

Good habit:

- Use non-nullable parameters for required inputs.
- Validate required inputs at public boundaries.
- Use nullable parameters only when null is part of the method contract.

### Return values: null, exception, empty collection, or result type

Choosing the return type is one of the most important null-safety design decisions.

#### Return null for optional lookup

```csharp
public Task<Customer?> FindByEmailAsync(string email);
```

This communicates that the customer may not exist.

Call site:

```csharp
var customer = await repository.FindByEmailAsync(email);

if (customer is null)
{
    return NotFound();
}
```

#### Throw when absence is exceptional

```csharp
public async Task<Customer> GetRequiredAsync(Guid id)
{
    var customer = await repository.FindByIdAsync(id);

    return customer ?? throw new KeyNotFoundException($"Customer '{id}' was not found.");
}
```

Use this when the caller expects the value to exist.

#### Return empty collection for no results

```csharp
public Task<IReadOnlyList<Customer>> SearchAsync(string keyword);
```

Returning an empty list is usually better than returning null.

#### Use a result type for richer outcomes

```csharp
public sealed record Result<T>(
    bool IsSuccess,
    T? Value,
    string? Error);
```

Or a more precise design:

```csharp
public sealed record CustomerLookupResult(
    bool Found,
    Customer? Customer,
    string? ErrorMessage);
```

For production code, a well-designed result type can be better than null when you need to distinguish not found, validation failure, permission denied, and external system error.

### Nullability and generics

Generics introduce additional complexity.

Example:

```csharp
public T? Find<T>(IEnumerable<T> values, Func<T, bool> predicate)
{
    return values.FirstOrDefault(predicate);
}
```

`T?` means different things depending on whether `T` is a reference type or value type.

Constraints can clarify intent:

```csharp
public T? FindReference<T>(IEnumerable<T> values, Func<T, bool> predicate)
    where T : class
{
    return values.FirstOrDefault(predicate);
}
```

For non-nullable generic type parameters:

```csharp
public void Save<T>(T entity)
    where T : notnull
{
    ArgumentNullException.ThrowIfNull(entity);
}
```

The `notnull` constraint communicates that `T` should not be nullable.

Common interview points:

- `T?` is not always simple in unconstrained generics.
- `where T : class` means a non-nullable reference type in a nullable-enabled context.
- `where T : class?` allows nullable reference types.
- `where T : notnull` allows non-nullable reference types and non-nullable value types.
- Generic APIs often need nullable attributes to express precise contracts.

### Nullable static analysis attributes

Nullable attributes help the compiler understand custom null-checking methods and advanced API contracts.

They are commonly found in `System.Diagnostics.CodeAnalysis`.

#### `NotNullWhen`

Use when a boolean return value tells the compiler something about a parameter.

```csharp
using System.Diagnostics.CodeAnalysis;

public static bool HasValue([NotNullWhen(true)] string? value)
{
    return !string.IsNullOrWhiteSpace(value);
}
```

Usage:

```csharp
string? input = GetInput();

if (HasValue(input))
{
    Console.WriteLine(input.Length); // Compiler knows input is not null
}
```

#### `MaybeNull`

Use when a method may return null even though the generic type does not show it clearly.

```csharp
using System.Diagnostics.CodeAnalysis;

public interface ICache
{
    [return: MaybeNull]
    T Get<T>(string key);
}
```

#### `NotNullIfNotNull`

Use when the return value is non-null if an input is non-null.

```csharp
using System.Diagnostics.CodeAnalysis;

[return: NotNullIfNotNull(nameof(value))]
public static string? Normalize(string? value)
{
    return value?.Trim();
}
```

#### `MemberNotNull`

Use when a method initializes members.

```csharp
using System.Diagnostics.CodeAnalysis;

public sealed class ReportBuilder
{
    private string? _title;

    [MemberNotNull(nameof(_title))]
    public void Initialize(string title)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        _title = title;
    }

    public string Build()
    {
        Initialize("Monthly Report");
        return _title.ToUpperInvariant();
    }
}
```

Common attributes:

| Attribute | Purpose |
|---|---|
| `AllowNull` | A non-nullable property can accept null as input, often converting it internally. |
| `DisallowNull` | A nullable property should not accept null as input. |
| `MaybeNull` | A return value, field, or property may be null. |
| `NotNull` | A value is not null after a method returns. |
| `MaybeNullWhen` | A parameter may be null when a method returns a specific boolean value. |
| `NotNullWhen` | A parameter is not null when a method returns a specific boolean value. |
| `NotNullIfNotNull` | Return value is not null if a specified parameter is not null. |
| `MemberNotNull` | Method guarantees specified members are initialized after it returns. |
| `MemberNotNullWhen` | Method guarantees specified members are initialized when it returns a specific boolean value. |

These are especially useful for libraries, helper methods, validation methods, and framework-like code.

### Null-safety in ASP.NET Core APIs

Nullable reference types help express API request and response contracts.

Example request model:

```csharp
public sealed class CreateCustomerRequest
{
    public required string Name { get; init; }
    public string? PhoneNumber { get; init; }
}
```

Meaning:

- `Name` is required.
- `PhoneNumber` is optional.

In ASP.NET Core, non-nullable properties can influence validation behavior. However, do not rely only on nullable annotations for full business validation.

Use validation rules as well:

```csharp
public sealed class CreateCustomerRequestValidator
{
    public static void Validate(CreateCustomerRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Name);
    }
}
```

In real projects, teams commonly use FluentValidation, data annotations, or endpoint filters.

Controller example:

```csharp
[HttpPost]
public async Task<IActionResult> Create(CreateCustomerRequest request)
{
    if (string.IsNullOrWhiteSpace(request.Name))
    {
        return BadRequest("Name is required.");
    }

    var customer = await _service.CreateAsync(request.Name, request.PhoneNumber);

    return CreatedAtAction(nameof(GetById), new { id = customer.Id }, customer);
}
```

Good habits for API models:

- Mark required values as non-nullable.
- Mark optional values as nullable.
- Validate at the boundary.
- Avoid accepting nullable values deep inside business logic unless null is meaningful.
- Avoid returning nullable collections in API responses.
- Keep request DTOs separate from domain entities.

### Null-safety in EF Core

EF Core uses nullable reference type annotations to help infer required and optional properties.

Example:

```csharp
public sealed class Customer
{
    public int Id { get; set; }

    public required string Name { get; set; }

    public string? PhoneNumber { get; set; }
}
```

Typical meaning:

- `Name` is required.
- `PhoneNumber` is optional.

Be careful when enabling nullable reference types in an existing EF Core project. A property that was previously treated as optional may become required if it is non-nullable. This can affect migrations and database schema.

For navigation properties:

```csharp
public sealed class Order
{
    public int Id { get; set; }

    public int CustomerId { get; set; }

    public Customer Customer { get; set; } = null!;

    public List<OrderItem> Items { get; } = new();
}
```

Here, `Customer` is required but initialized by EF when loaded. The `null!` is a framework-specific compromise. The collection is non-null and initialized to an empty list.

For optional navigation:

```csharp
public sealed class Order
{
    public int Id { get; set; }

    public int? DiscountCodeId { get; set; }

    public DiscountCode? DiscountCode { get; set; }
}
```

Good EF Core habits:

- Align C# nullability with database nullability.
- Use `required` or constructors for required scalar properties.
- Initialize collection navigations.
- Avoid nullable collection navigation properties.
- Use `null!` only when EF or another framework truly initializes the member.
- Review migrations after enabling nullable reference types.
- Be careful with optional relationships in LINQ queries because the compiler may not understand provider-specific query translation.

### Null-safety in Clean Architecture and domain models

In Clean Architecture, null-safety should be strongest in the domain and application layers.

Domain model example:

```csharp
public sealed class Product
{
    public Product(string name, decimal price)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        if (price < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(price), "Price cannot be negative.");
        }

        Name = name;
        Price = price;
    }

    public string Name { get; }
    public decimal Price { get; }
}
```

The domain model does not allow an invalid product to exist.

Application service example:

```csharp
public async Task<ProductDto?> FindProductAsync(Guid id)
{
    var product = await _repository.FindByIdAsync(id);

    return product is null
        ? null
        : new ProductDto(product.Id, product.Name, product.Price);
}
```

Here, `ProductDto?` communicates that the product may not be found.

Command handler example:

```csharp
public sealed record UpdateProductNameCommand(Guid ProductId, string Name);

public sealed class UpdateProductNameHandler
{
    private readonly IProductRepository _repository;

    public UpdateProductNameHandler(IProductRepository repository)
    {
        ArgumentNullException.ThrowIfNull(repository);
        _repository = repository;
    }

    public async Task Handle(UpdateProductNameCommand command)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(command.Name);

        var product = await _repository.FindByIdAsync(command.ProductId);

        if (product is null)
        {
            throw new KeyNotFoundException("Product was not found.");
        }

        product.Rename(command.Name);

        await _repository.SaveChangesAsync();
    }
}
```

Good architecture habit:

- Validate external input at the boundary.
- Keep domain entities in a valid state.
- Use nullable return types for optional lookups.
- Convert nullable external data into safer internal models as early as possible.
- Avoid spreading `string?` and `object?` everywhere in the application layer.

### Null-safety with dependency injection

Services injected through constructors should usually be non-nullable.

```csharp
public sealed class InvoiceService
{
    private readonly IInvoiceRepository _repository;
    private readonly ILogger<InvoiceService> _logger;

    public InvoiceService(
        IInvoiceRepository repository,
        ILogger<InvoiceService> logger)
    {
        ArgumentNullException.ThrowIfNull(repository);
        ArgumentNullException.ThrowIfNull(logger);

        _repository = repository;
        _logger = logger;
    }
}
```

Some developers skip these checks because dependency injection normally provides non-null dependencies. However, guard clauses are still useful because:

- They protect tests that instantiate classes manually.
- They fail fast when the container is misconfigured.
- They document the dependency contract.
- They help static analysis.

Avoid this:

```csharp
_logger?.LogInformation("Invoice created");
```

If `_logger` is required, using `?.` hides a broken invariant.

### Null-safety with external data

External systems are a common source of unexpected nulls.

Examples:

- JSON APIs
- Message queues
- CSV files
- User input
- Configuration
- Databases
- Legacy services

Even if your model says a value is non-nullable, external data may violate it.

Example:

```csharp
public sealed class ExternalCustomerDto
{
    public string? Name { get; init; }
    public string? Email { get; init; }
}
```

Convert to a safer internal model:

```csharp
public sealed class Customer
{
    public Customer(string name, string email)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(email);

        Name = name;
        Email = email;
    }

    public string Name { get; }
    public string Email { get; }
}

public static Customer Map(ExternalCustomerDto dto)
{
    ArgumentNullException.ThrowIfNull(dto);

    if (string.IsNullOrWhiteSpace(dto.Name))
    {
        throw new InvalidOperationException("External customer name is missing.");
    }

    if (string.IsNullOrWhiteSpace(dto.Email))
    {
        throw new InvalidOperationException("External customer email is missing.");
    }

    return new Customer(dto.Name, dto.Email);
}
```

Good habit:

> Treat external data as untrusted, validate it once, and convert it into a safer internal model.

### Null-safety in configuration and options

Configuration values are often missing at runtime.

Example:

```csharp
public sealed class StorageOptions
{
    public required string ConnectionString { get; init; }
    public required string ContainerName { get; init; }
}
```

Validation:

```csharp
builder.Services
    .AddOptions<StorageOptions>()
    .Bind(builder.Configuration.GetSection("Storage"))
    .Validate(options => !string.IsNullOrWhiteSpace(options.ConnectionString), "Storage connection string is required.")
    .Validate(options => !string.IsNullOrWhiteSpace(options.ContainerName), "Storage container name is required.")
    .ValidateOnStart();
```

Good habit:

- Make required options non-nullable.
- Validate options at startup.
- Avoid allowing the application to start with invalid configuration.
- Do not hide missing configuration with fake defaults.

### Null-safety and async code

Nullable annotations work with async methods too.

```csharp
public async Task<Customer?> FindCustomerAsync(Guid id)
{
    return await _repository.FindByIdAsync(id);
}
```

Caller:

```csharp
Customer? customer = await service.FindCustomerAsync(id);

if (customer is null)
{
    return Results.NotFound();
}

return Results.Ok(customer);
```

Avoid returning `Task<Customer>` when the result may be missing. That forces callers to discover nullability through documentation or runtime behavior.

Also avoid `Task<Customer?>?`. A task itself should almost never be null.

Bad:

```csharp
public Task<Customer?>? FindCustomerAsync(Guid id);
```

Better:

```csharp
public Task<Customer?> FindCustomerAsync(Guid id);
```

The task should always exist. The result inside the task may be null.

### Null-safety with LINQ

LINQ methods can return null depending on the method and data.

Examples:

```csharp
Customer? customer = customers.FirstOrDefault(c => c.Email == email);

if (customer is null)
{
    return null;
}

return customer.Name;
```

For collections of nullable values:

```csharp
List<string?> names = ["Alice", null, "Bob"];

List<string> validNames = names
    .Where(name => name is not null)
    .Select(name => name!)
    .ToList();
```

In some cases, use pattern matching:

```csharp
List<string> validNames = names
    .OfType<string>()
    .ToList();
```

`OfType<string>()` filters out null values and values of different types.

Be careful with `First()` vs `FirstOrDefault()`:

```csharp
Customer customer = customers.First(c => c.Id == id); // Throws if not found
Customer? maybeCustomer = customers.FirstOrDefault(c => c.Id == id); // Returns null if not found
```

Use the method that matches the business expectation.

### Pattern matching and null-safety

Pattern matching can make null checks expressive.

```csharp
if (customer is null)
{
    return;
}

if (customer.Address is { City: "London" })
{
    // customer.Address is not null in this block
}
```

Property pattern example:

```csharp
if (request is { Name.Length: > 0 })
{
    Console.WriteLine(request.Name);
}
```

This checks that `request` is not null, `Name` is not null, and `Name.Length` is greater than zero.

However, readability matters. Do not write overly clever patterns when a simple guard clause is clearer.

### Common null-safety habits

Strong C# developers usually follow these habits:

#### Enable nullable reference types for new code

Use nullable warnings as feedback. Avoid treating warnings as noise.

```xml
<PropertyGroup>
  <Nullable>enable</Nullable>
</PropertyGroup>
```

For stricter teams, consider treating nullable warnings as build errors after migration.

#### Prefer non-nullable by default

Make a value nullable only when null has a clear meaning.

```csharp
public string Name { get; init; } = string.Empty;
public string? Description { get; init; }
```

#### Validate at boundaries

Validate API requests, messages, files, configuration, and external service responses.

#### Keep domain models valid

Do not allow invalid entities to exist.

```csharp
public void Rename(string name)
{
    ArgumentException.ThrowIfNullOrWhiteSpace(name);
    Name = name;
}
```

#### Use empty collections instead of null collections

```csharp
public IReadOnlyList<OrderItem> Items { get; init; } = [];
```

#### Avoid excessive `!`

The null-forgiving operator should be rare and explainable.

#### Avoid meaningless defaults

Do not use `?? ""`, `?? 0`, or `?? new()` unless the fallback is correct for the business case.

#### Distinguish not-found from invalid input

```csharp
if (id == Guid.Empty)
{
    return BadRequest();
}

var customer = await repository.FindByIdAsync(id);

if (customer is null)
{
    return NotFound();
}
```

#### Design clear contracts

A method signature should tell the caller what can happen.

```csharp
Task<Customer?> FindByIdAsync(Guid id);
Task<Customer> GetRequiredByIdAsync(Guid id);
Task<IReadOnlyList<Customer>> SearchAsync(string keyword);
```

### Common mistakes

#### Adding `?` everywhere

Bad:

```csharp
public sealed class CreateOrderRequest
{
    public string? CustomerId { get; init; }
    public List<OrderItemDto>? Items { get; init; }
}
```

This makes every caller handle null, even when the data is required.

Better:

```csharp
public sealed class CreateOrderRequest
{
    public required string CustomerId { get; init; }
    public List<OrderItemDto> Items { get; init; } = [];
}
```

#### Using `null!` as a default fix

Bad:

```csharp
public string Name { get; set; } = null!;
```

Better:

```csharp
public required string Name { get; init; }
```

or:

```csharp
public string Name { get; set; } = string.Empty;
```

depending on the business meaning.

#### Hiding bugs with `?.`

Bad:

```csharp
_orderService?.Process(order);
```

If `_orderService` is required, this silently skips work.

Better:

```csharp
_orderService.Process(order);
```

and ensure `_orderService` is initialized correctly.

#### Returning null for collections

Bad:

```csharp
public IReadOnlyList<Customer>? Search(string keyword)
{
    return null;
}
```

Better:

```csharp
public IReadOnlyList<Customer> Search(string keyword)
{
    return [];
}
```

#### Ignoring nullable warnings

Warnings are often early indicators of runtime bugs.

Bad habit:

```csharp
#pragma warning disable CS8602
```

Use warning suppression only when you understand why the warning is incorrect and cannot express the contract better.

#### Confusing compiler safety with runtime validation

Nullable annotations are not a replacement for input validation.

```csharp
public void Register(string email)
{
    // email is non-nullable, but public callers, reflection, tests, or legacy code may still pass null.
    ArgumentException.ThrowIfNullOrWhiteSpace(email);
}
```

### Best practices

#### Use nullable reference types as API documentation

Method signatures should be self-explanatory.

```csharp
public interface IUserRepository
{
    Task<User?> FindByEmailAsync(string email);
    Task<IReadOnlyList<User>> SearchAsync(string keyword);
}
```

This tells callers:

- `FindByEmailAsync` may not find a user.
- `SearchAsync` always returns a collection, possibly empty.

#### Make invalid states unrepresentable

Prefer constructors, `required`, and validation.

```csharp
public sealed class EmailAddress
{
    public EmailAddress(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);

        if (!value.Contains('@'))
        {
            throw new ArgumentException("Invalid email address.", nameof(value));
        }

        Value = value;
    }

    public string Value { get; }
}
```

#### Use nullable annotations at boundaries

External DTOs can be more nullable because external data may be incomplete.

Internal domain models should be less nullable because they should represent valid business state.

#### Keep nullable warnings visible

A good production standard is:

- New code should have no nullable warnings.
- Existing warnings should be tracked and gradually reduced.
- Suppressions should be rare and documented.
- Nullable context should be enabled in new projects.

#### Prefer explicit handling over silent fallback

Bad:

```csharp
var email = request.Email ?? "";
```

Better:

```csharp
if (string.IsNullOrWhiteSpace(request.Email))
{
    return BadRequest("Email is required.");
}
```

#### Use nullable attributes for reusable helpers

Without attributes, the compiler may not understand custom null-check methods.

```csharp
public static bool IsPresent([NotNullWhen(true)] string? value)
{
    return !string.IsNullOrWhiteSpace(value);
}
```

#### Review database and API contracts during migration

When enabling nullable reference types in an existing project, review:

- Public APIs
- DTOs
- EF Core entities
- Database migrations
- JSON serialization behavior
- Tests
- External integrations
- Reflection-based frameworks

Nullable migration is partly a design exercise, not just a syntax update.

### Practical comparison table

| Scenario | Recommended approach | Reason |
|---|---|---|
| Required constructor dependency | Non-nullable parameter + guard clause | Fail fast and document dependency contract |
| Optional user input | Nullable property or parameter | Null is part of valid input |
| Required API request field | Non-nullable or `required` + validation | Clear contract and runtime protection |
| Lookup may not find data | Return `T?` or result type | Caller must handle absence |
| Search returns no rows | Return empty collection | Easier and safer for callers |
| EF Core required navigation | Non-nullable with careful initialization or `null!` | Framework initializes it |
| External API response | Nullable DTO properties + mapping validation | External data is untrusted |
| Required domain value | Constructor validation | Keeps domain model valid |
| Lazy initialization | `??=` or initialized property | Avoid repeated null checks |
| Custom null-check helper | Nullable static analysis attributes | Helps compiler understand contract |

### Example: before and after nullable improvements

Before:

```csharp
public class CustomerService
{
    private ICustomerRepository _repository;

    public CustomerService(ICustomerRepository repository)
    {
        _repository = repository;
    }

    public async Task<CustomerDto> GetByEmail(string email)
    {
        var customer = await _repository.FindByEmail(email);

        return new CustomerDto
        {
            Id = customer.Id,
            Name = customer.Name,
            PhoneNumber = customer.PhoneNumber
        };
    }
}
```

Problems:

- `_repository` could be null if constructed incorrectly.
- `email` might be null or whitespace.
- `FindByEmail` might return null.
- `customer.Id` may throw.
- The method contract does not show what happens when the customer is not found.

After:

```csharp
public sealed class CustomerService
{
    private readonly ICustomerRepository _repository;

    public CustomerService(ICustomerRepository repository)
    {
        ArgumentNullException.ThrowIfNull(repository);
        _repository = repository;
    }

    public async Task<CustomerDto?> FindByEmailAsync(string email)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(email);

        Customer? customer = await _repository.FindByEmailAsync(email);

        if (customer is null)
        {
            return null;
        }

        return new CustomerDto
        {
            Id = customer.Id,
            Name = customer.Name,
            PhoneNumber = customer.PhoneNumber
        };
    }
}
```

Repository contract:

```csharp
public interface ICustomerRepository
{
    Task<Customer?> FindByEmailAsync(string email);
}
```

DTO:

```csharp
public sealed class CustomerDto
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public string? PhoneNumber { get; init; }
}
```

The improved version makes the nullable behavior explicit and forces callers to handle the not-found case.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

<!-- question:start:nullable-reference-types-beginner-q01 -->
<!-- question-id:nullable-reference-types-beginner-q01 -->
<!-- question-level:beginner -->

####  What are nullable reference types in C#?

##### Expected Answer

Nullable reference types are a C# feature that lets developers express whether a reference type is expected to contain `null`.

With nullable reference types enabled, `string` means the value should not be null, while `string?` means the value may be null.

Example:

```csharp
string name = "Alice";     // Intended to be non-null
string? nickname = null;   // Allowed to be null
```

The feature helps the compiler warn when code may dereference a null value or assign a maybe-null value to a non-nullable variable.

Nullable reference types do not create new runtime types. `string` and `string?` are still the same runtime type. The difference is compile-time annotation and static analysis.

##### Key Points to Mention

- `T` means intended non-null reference.
- `T?` means nullable reference.
- The feature is compile-time analysis, not runtime enforcement.
- It helps reduce `NullReferenceException`.
- It must be enabled through nullable context settings.

<!-- question:end:nullable-reference-types-beginner-q01 -->

<!-- question:start:nullreferenceexception-beginner-q02 -->
<!-- question-id:nullreferenceexception-beginner-q02 -->
<!-- question-level:beginner -->

####  What is a `NullReferenceException`?

##### Expected Answer

A `NullReferenceException` happens when code tries to access a member on a reference that is currently null.

Example:

```csharp
Customer? customer = null;
Console.WriteLine(customer.Name); // NullReferenceException
```

The code fails because `customer` does not point to an actual `Customer` object.

Nullable reference types help reduce this risk by warning when a value may be null before dereferencing it.

##### Key Points to Mention

- It occurs when dereferencing null.
- Nullable reference types help detect possible null dereferences at compile time.
- Runtime validation is still needed at application boundaries.
- A null check or better API design can prevent the exception.

<!-- question:end:nullreferenceexception-beginner-q02 -->

<!-- question:start:enable-nullable-context-beginner-q03 -->
<!-- question-id:enable-nullable-context-beginner-q03 -->
<!-- question-level:beginner -->

####  How do you enable nullable reference types in a C# project?

##### Expected Answer

You enable nullable reference types in the project file by adding:

```xml
<PropertyGroup>
  <Nullable>enable</Nullable>
</PropertyGroup>
```

You can also enable it in a specific file:

```csharp
#nullable enable
```

For new code, enabling nullable reference types at the project level is usually preferred.

##### Key Points to Mention

- Use `<Nullable>enable</Nullable>` in the `.csproj`.
- Use `#nullable enable` for file-level or migration scenarios.
- New projects should generally enable nullable reference types.
- Existing projects may need gradual migration.

<!-- question:end:enable-nullable-context-beginner-q03 -->

<!-- question:start:nullable-reference-vs-value-beginner-q04 -->
<!-- question-id:nullable-reference-vs-value-beginner-q04 -->
<!-- question-level:beginner -->

####  What is the difference between `string?` and `int?`?

##### Expected Answer

`string?` is a nullable reference type. It means the reference may be null, but it is still a `System.String` at runtime.

`int?` is a nullable value type. It is shorthand for `Nullable<int>` and allows a value type to represent either an `int` value or null.

Example:

```csharp
string? name = null; // Nullable reference type
int? age = null;     // Nullable value type
```

The key difference is that nullable value types use a real runtime wrapper, while nullable reference types are mainly compile-time annotations.

##### Key Points to Mention

- `int?` means `Nullable<int>`.
- `string?` is still `System.String` at runtime.
- Nullable reference types rely on compiler analysis.
- Both express that null is possible, but they work differently.

<!-- question:end:nullable-reference-vs-value-beginner-q04 -->

<!-- question:start:null-coalescing-beginner-q05 -->
<!-- question-id:null-coalescing-beginner-q05 -->
<!-- question-level:beginner -->

####  What do the `?.`, `??`, and `??=` operators do?

##### Expected Answer

The `?.` operator safely accesses a member only when the left side is not null.

```csharp
int? length = user?.Name?.Length;
```

The `??` operator provides a fallback value when the left side is null.

```csharp
string displayName = user.DisplayName ?? user.UserName;
```

The `??=` operator assigns a value only if the variable is currently null.

```csharp
tags ??= new List<string>();
```

These operators help write concise null-handling code, but they should not be used to hide bugs or ignore required values.

##### Key Points to Mention

- `?.` is null-conditional access.
- `??` provides a fallback.
- `??=` performs assignment only when null.
- Use them when null is valid and the fallback behavior is correct.
- Do not use them to hide invalid object state.

<!-- question:end:null-coalescing-beginner-q05 -->

<!-- question:start:null-forgiving-beginner-q06 -->
<!-- question-id:null-forgiving-beginner-q06 -->
<!-- question-level:beginner -->

####  What does the null-forgiving operator `!` do?

##### Expected Answer

The null-forgiving operator tells the compiler to treat a value as non-null, even if the compiler thinks it may be null.

Example:

```csharp
string? value = GetValue();
Console.WriteLine(value!.Length);
```

It does not perform a runtime null check. If `value` is actually null, the code can still throw `NullReferenceException`.

It should be used sparingly, mainly when the developer knows something the compiler cannot know, such as framework initialization, EF Core navigation properties, or specific test scenarios.

##### Key Points to Mention

- `!` suppresses nullable warnings.
- It does not change runtime behavior.
- It can hide real bugs.
- Use it rarely and intentionally.
- Prefer proper initialization, validation, or nullable attributes when possible.

<!-- question:end:null-forgiving-beginner-q06 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

<!-- question:start:null-state-analysis-intermediate-q01 -->
<!-- question-id:null-state-analysis-intermediate-q01 -->
<!-- question-level:intermediate -->

####  How does C# null-state analysis work?

##### Expected Answer

Null-state analysis is the compiler's flow analysis that tracks whether a reference variable is not-null or maybe-null.

For example:

```csharp
static int GetLength(string? value)
{
    if (value is null)
    {
        return 0;
    }

    return value.Length;
}
```

At the start, `value` is maybe-null. After the `if (value is null)` check returns, the compiler knows `value` is not null in the remaining code path.

The compiler uses assignments, null checks, conditional branches, pattern matching, and nullable annotations to determine whether dereferencing a variable is safe.

##### Key Points to Mention

- The compiler tracks null-state using flow analysis.
- Main states are not-null and maybe-null.
- Null checks update the compiler's understanding.
- The analysis is static and not perfect.
- Attributes can improve analysis for custom methods.

<!-- question:end:null-state-analysis-intermediate-q01 -->

<!-- question:start:required-vs-constructor-intermediate-q02 -->
<!-- question-id:required-vs-constructor-intermediate-q02 -->
<!-- question-level:intermediate -->

####  How do `required` properties help with nullable reference types?

##### Expected Answer

The `required` modifier tells the compiler that callers must initialize a property or field when creating an object.

Example:

```csharp
public sealed class Customer
{
    public required string Name { get; init; }
}
```

Usage:

```csharp
var customer = new Customer
{
    Name = "Alice"
};
```

If the caller does not set `Name`, the compiler reports an error.

`required` is useful for DTOs, options classes, and models where object initializer syntax is preferred.

Constructors are often better for domain models with business rules because they allow validation and enforce invariants immediately.

##### Key Points to Mention

- `required` helps avoid uninitialized non-nullable properties.
- It works well with object initializers.
- It does not automatically validate business rules.
- Constructors are stronger for domain invariants.
- A required property can still be assigned null, but the compiler warns if the type is non-nullable.

<!-- question:end:required-vs-constructor-intermediate-q02 -->

<!-- question:start:guard-clauses-intermediate-q03 -->
<!-- question-id:guard-clauses-intermediate-q03 -->
<!-- question-level:intermediate -->

####  Why are guard clauses still needed if nullable reference types are enabled?

##### Expected Answer

Nullable reference types provide compile-time warnings, but they do not guarantee runtime safety.

Null can still come from legacy code, reflection, deserialization, external APIs, dependency injection misconfiguration, tests, or code using the null-forgiving operator.

Guard clauses validate assumptions at runtime.

Example:

```csharp
public OrderService(IOrderRepository repository)
{
    ArgumentNullException.ThrowIfNull(repository);
    _repository = repository;
}
```

For strings:

```csharp
ArgumentException.ThrowIfNullOrWhiteSpace(name);
```

Guard clauses are especially important at public boundaries and when constructing domain objects.

##### Key Points to Mention

- Nullable reference types are not runtime validation.
- External callers and frameworks can still pass null.
- Guard clauses fail fast.
- They document method and constructor contracts.
- They are important for public APIs, domain constructors, and service dependencies.

<!-- question:end:guard-clauses-intermediate-q03 -->

<!-- question:start:null-return-design-intermediate-q04 -->
<!-- question-id:null-return-design-intermediate-q04 -->
<!-- question-level:intermediate -->

####  When should a method return `T?`, throw an exception, return an empty collection, or use a result type?

##### Expected Answer

A method should return `T?` when absence is a normal and expected outcome.

```csharp
Task<Customer?> FindByIdAsync(Guid id);
```

It should throw when absence is exceptional or violates the caller's assumption.

```csharp
Task<Customer> GetRequiredByIdAsync(Guid id);
```

It should return an empty collection when there are no results.

```csharp
Task<IReadOnlyList<Customer>> SearchAsync(string keyword);
```

It should use a result type when the caller needs richer information, such as not found, validation failure, permission denied, or external service errors.

The method signature should communicate the expected behavior clearly.

##### Key Points to Mention

- `T?` is good for optional lookup.
- Exceptions are for exceptional or invalid states.
- Empty collections are better than null collections.
- Result types are useful for richer outcomes.
- API contracts should make caller obligations clear.

<!-- question:end:null-return-design-intermediate-q04 -->

<!-- question:start:nullable-collections-intermediate-q05 -->
<!-- question-id:nullable-collections-intermediate-q05 -->
<!-- question-level:intermediate -->

####  Why should collections usually be non-null?

##### Expected Answer

Collections should usually be non-null and empty when there are no items.

Good:

```csharp
public List<OrderItem> Items { get; } = new();
```

Bad:

```csharp
public List<OrderItem>? Items { get; set; }
```

An empty collection clearly means "there are no items." A nullable collection forces every caller to ask whether null means no items, not loaded, unknown, or invalid.

Non-null collections also make iteration safer and simpler.

##### Key Points to Mention

- Prefer empty collections over null collections.
- Null collections create ambiguous meaning.
- Non-null collections reduce caller checks.
- This is common for API responses, domain models, and EF Core collection navigations.
- Use nullable collections only when null has a distinct business meaning.

<!-- question:end:nullable-collections-intermediate-q05 -->

<!-- question:start:aspnetcore-nullability-intermediate-q06 -->
<!-- question-id:aspnetcore-nullability-intermediate-q06 -->
<!-- question-level:intermediate -->

####  How do nullable reference types affect ASP.NET Core request models?

##### Expected Answer

Nullable annotations help express whether request properties are required or optional.

Example:

```csharp
public sealed class CreateCustomerRequest
{
    public required string Name { get; init; }
    public string? PhoneNumber { get; init; }
}
```

`Name` is required and `PhoneNumber` is optional.

ASP.NET Core can use nullable metadata during model validation, but nullable annotations should not be the only validation mechanism. Business validation should still be explicit through model validation, FluentValidation, data annotations, endpoint filters, or service-level validation.

##### Key Points to Mention

- Non-nullable properties communicate required data.
- Nullable properties communicate optional data.
- Runtime validation is still needed.
- DTOs should match API contracts.
- Avoid making all request fields nullable just to avoid compiler warnings.

<!-- question:end:aspnetcore-nullability-intermediate-q06 -->

<!-- question:start:efcore-nullability-intermediate-q07 -->
<!-- question-id:efcore-nullability-intermediate-q07 -->
<!-- question-level:intermediate -->

####  How do nullable reference types affect EF Core entities?

##### Expected Answer

EF Core uses nullable reference type annotations to help determine whether properties are required or optional.

Example:

```csharp
public sealed class Customer
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public string? PhoneNumber { get; set; }
}
```

`Name` is required, while `PhoneNumber` is optional.

When enabling nullable reference types in an existing EF Core project, developers must be careful because previously optional properties may become required. This can generate migrations that change database column nullability.

For navigation properties, required references are sometimes initialized with `null!` because EF initializes them when loading entities:

```csharp
public Customer Customer { get; set; } = null!;
```

Collection navigations should usually be non-null and initialized:

```csharp
public List<OrderItem> Items { get; } = new();
```

##### Key Points to Mention

- EF Core interprets nullability for required and optional properties.
- Enabling NRT can affect migrations.
- Required scalar properties should use constructors or `required`.
- Required navigation properties may use `null!` intentionally.
- Collection navigations should not be nullable.

<!-- question:end:efcore-nullability-intermediate-q07 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

<!-- question:start:nullable-attributes-advanced-q01 -->
<!-- question-id:nullable-attributes-advanced-q01 -->
<!-- question-level:advanced -->

####  What are nullable static analysis attributes and when should you use them?

##### Expected Answer

Nullable static analysis attributes are attributes that help the compiler understand nullability contracts that cannot be expressed with `?` alone.

They are useful for custom validation methods, generic APIs, helper methods, and library code.

Example using `NotNullWhen`:

```csharp
using System.Diagnostics.CodeAnalysis;

public static bool HasValue([NotNullWhen(true)] string? value)
{
    return !string.IsNullOrWhiteSpace(value);
}
```

Usage:

```csharp
string? input = GetInput();

if (HasValue(input))
{
    Console.WriteLine(input.Length); // Compiler understands input is not null
}
```

Other useful attributes include `MaybeNull`, `NotNull`, `AllowNull`, `DisallowNull`, `NotNullIfNotNull`, `MemberNotNull`, and `MemberNotNullWhen`.

##### Key Points to Mention

- Attributes improve compiler null-state analysis.
- They are useful when method behavior affects null-state.
- `NotNullWhen(true)` is common for custom guard methods.
- `MemberNotNull` is useful for initialization methods.
- They are important for reusable libraries and framework-style code.

<!-- question:end:nullable-attributes-advanced-q01 -->

<!-- question:start:nullability-generics-advanced-q02 -->
<!-- question-id:nullability-generics-advanced-q02 -->
<!-- question-level:advanced -->

####  Why is nullability more complex with generics?

##### Expected Answer

Generics are complex because a type parameter can represent a reference type, value type, nullable reference type, nullable value type, or unconstrained type.

Example:

```csharp
public T? Find<T>(IEnumerable<T> values, Func<T, bool> predicate)
{
    return values.FirstOrDefault(predicate);
}
```

The meaning of `T?` depends on the constraints on `T`.

Constraints clarify intent:

```csharp
public T? FindReference<T>(IEnumerable<T> values, Func<T, bool> predicate)
    where T : class
{
    return values.FirstOrDefault(predicate);
}
```

For non-null values:

```csharp
public void Save<T>(T entity)
    where T : notnull
{
    ArgumentNullException.ThrowIfNull(entity);
}
```

Generic APIs may also need nullable attributes such as `MaybeNull` to describe return behavior precisely.

##### Key Points to Mention

- `T?` depends on generic constraints.
- `where T : class` means non-nullable reference type in nullable-enabled code.
- `where T : class?` allows nullable reference types.
- `where T : notnull` requires non-nullable value or reference types.
- Generic libraries often need nullable attributes.

<!-- question:end:nullability-generics-advanced-q02 -->

<!-- question:start:nullable-migration-advanced-q03 -->
<!-- question-id:nullable-migration-advanced-q03 -->
<!-- question-level:advanced -->

####  How would you migrate an existing large C# codebase to nullable reference types?

##### Expected Answer

A safe migration should be gradual.

A practical approach:

1. Enable nullable analysis in a limited scope, such as one project, folder, or file.
2. Start with high-value layers such as domain models, application services, and public APIs.
3. Fix real warnings instead of suppressing them.
4. Add nullable annotations to interfaces and DTOs.
5. Initialize required properties using constructors, `required`, or safe defaults.
6. Validate external input at boundaries.
7. Avoid using `null!` as a blanket fix.
8. Review EF Core migrations and database nullability.
9. Add tests for null-related edge cases.
10. Consider treating nullable warnings as errors once the project is clean.

For legacy projects, teams may temporarily use `#nullable enable` file by file or enable warnings first before full annotations.

##### Key Points to Mention

- Migrate gradually.
- Do not add `?` or `!` everywhere blindly.
- Prioritize public contracts and domain logic.
- Review EF Core schema impact.
- Use tests to protect behavior.
- Make nullable warnings visible in CI.

<!-- question:end:nullable-migration-advanced-q03 -->

<!-- question:start:null-object-vs-nullable-advanced-q04 -->
<!-- question-id:null-object-vs-nullable-advanced-q04 -->
<!-- question-level:advanced -->

####  When would you use the Null Object pattern instead of returning null?

##### Expected Answer

The Null Object pattern uses a real object that represents "do nothing" or "empty behavior" instead of returning null.

Example:

```csharp
public interface INotificationSender
{
    Task SendAsync(string message);
}

public sealed class NullNotificationSender : INotificationSender
{
    public Task SendAsync(string message)
    {
        return Task.CompletedTask;
    }
}
```

This can be useful when callers should not care whether a behavior is enabled.

However, it should not be used when absence is important business information. If the caller needs to know that a customer was not found, returning `Customer?` or a result type is clearer.

##### Key Points to Mention

- Null Object avoids repeated null checks.
- It is useful for optional behavior.
- It should not hide important business absence.
- It works well for logging, notifications, strategies, and optional integrations.
- Use `T?` or result types when the caller must react to absence.

<!-- question:end:null-object-vs-nullable-advanced-q04 -->

<!-- question:start:api-contract-design-advanced-q05 -->
<!-- question-id:api-contract-design-advanced-q05 -->
<!-- question-level:advanced -->

####  How should nullable reference types influence API and library design?

##### Expected Answer

Nullable reference types should make API contracts explicit.

A library method should clearly communicate:

- Which parameters are required.
- Which parameters are optional.
- Whether a return value may be null.
- Whether a collection can be empty but not null.
- Whether absence is normal or exceptional.

Example:

```csharp
public interface IUserRepository
{
    Task<User?> FindByEmailAsync(string email);
    Task<User> GetRequiredByIdAsync(Guid id);
    Task<IReadOnlyList<User>> SearchAsync(string keyword);
}
```

This API tells callers exactly what to expect.

For reusable libraries, nullable annotations and attributes are especially important because consumers rely heavily on compiler warnings and IntelliSense.

##### Key Points to Mention

- Nullability is part of the public contract.
- Avoid ambiguous APIs.
- Do not return null collections.
- Use nullable attributes for complex contracts.
- Clear nullability improves caller experience and reduces bugs.

<!-- question:end:api-contract-design-advanced-q05 -->

<!-- question:start:null-safety-architecture-advanced-q06 -->
<!-- question-id:null-safety-architecture-advanced-q06 -->
<!-- question-level:advanced -->

####  How do nullable reference types support Clean Architecture or domain-driven design?

##### Expected Answer

Nullable reference types support Clean Architecture and domain-driven design by making domain contracts explicit and helping prevent invalid states.

In the domain layer, required values should be non-nullable and validated through constructors or methods.

```csharp
public sealed class Product
{
    public Product(string name)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        Name = name;
    }

    public string Name { get; private set; }
}
```

Optional values should be nullable only when null has real business meaning.

At application boundaries, external DTOs may contain nullable properties because incoming data is untrusted. The application should validate and map those DTOs into safer domain models.

This keeps null-handling close to boundaries and prevents nullable uncertainty from spreading throughout the system.

##### Key Points to Mention

- Domain models should prefer valid, non-null state.
- Nullable annotations document business optionality.
- External data should be validated and mapped.
- Avoid spreading nullable values deep into the domain.
- Null-safety supports maintainability and clearer invariants.

<!-- question:end:null-safety-architecture-advanced-q06 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
