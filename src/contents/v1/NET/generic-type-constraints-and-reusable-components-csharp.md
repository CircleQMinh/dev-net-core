---
id: generic-type-constraints-and-reusable-components-csharp
topic: Modern C# patterns
subtopic: Generic Type Constraints and Reusable Components 
category: .NET
---

## Overview

Generic type constraints in C# define what kind of type can be used as a generic type argument. They are written with the `where` keyword and allow a generic class, method, interface, delegate, or struct to safely use members or behaviors that are guaranteed to exist on the type parameter.

Generics help developers write reusable, type-safe components without duplicating code for every concrete type. Constraints make those reusable components more precise. Instead of accepting "any type", a generic component can require a reference type, value type, interface implementation, base class, public parameterless constructor, enum, delegate, unmanaged type, or another generic type relationship.

This topic matters because generics appear everywhere in real C# and .NET development:

- `List<T>`, `Dictionary<TKey, TValue>`, `IEnumerable<T>`, and LINQ
- Repository and service abstractions
- CQRS commands, queries, handlers, validators, and pipeline behaviors
- Result wrappers such as `Result<T>`
- Mapping, caching, serialization, and factory components
- Generic math and reusable algorithms
- Strongly typed IDs and domain models

For interviews, generic constraints are important because they test whether a developer understands type safety, reusable design, compile-time guarantees, inheritance, interfaces, variance, nullable reference types, and the trade-offs between abstraction and complexity. A strong candidate should know not only the syntax, but also when constraints improve a design and when they make code unnecessarily complicated.

## Core Concepts

### What Generics Solve

Generics allow code to work with a type parameter instead of a specific type.

Without generics, reusable code often uses `object`, which loses type safety and can require casts:

```csharp
public class ObjectBox
{
    public object Value { get; set; }

    public ObjectBox(object value)
    {
        Value = value;
    }
}

var box = new ObjectBox("hello");
string text = (string)box.Value;
```

With generics, the type is known at compile time:

```csharp
public class Box<T>
{
    public T Value { get; }

    public Box(T value)
    {
        Value = value;
    }
}

var box = new Box<string>("hello");
string text = box.Value;
```

Benefits:

- Compile-time type safety
- Less casting
- Better readability
- Better reuse
- Better performance for value types because generic collections avoid many boxing scenarios
- Clearer APIs because the expected type is part of the method or class signature

Common interview point: generics are not just about avoiding duplicate code. They also express intent and let the compiler catch errors earlier.

### What Type Constraints Are

A type constraint tells the compiler what a type parameter must support.

```csharp
public static T Max<T>(T left, T right)
    where T : IComparable<T>
{
    return left.CompareTo(right) >= 0 ? left : right;
}
```

Without `where T : IComparable<T>`, the compiler cannot allow `left.CompareTo(right)` because it cannot assume every possible `T` has a `CompareTo` method.

A constraint acts like a contract between the reusable component and the caller:

- The component promises to work for any type that satisfies the constraint.
- The caller must provide a type that satisfies the constraint.
- The compiler validates the rule before runtime.

### Basic Generic Syntax

Generic classes:

```csharp
public class Repository<TEntity>
{
    private readonly List<TEntity> _items = new();

    public void Add(TEntity entity)
    {
        _items.Add(entity);
    }

    public IReadOnlyList<TEntity> GetAll()
    {
        return _items;
    }
}
```

Generic methods:

```csharp
public static T FirstOrDefaultValue<T>(IEnumerable<T> items, T fallback)
{
    foreach (var item in items)
    {
        return item;
    }

    return fallback;
}
```

Generic interfaces:

```csharp
public interface IHandler<TRequest, TResponse>
{
    Task<TResponse> HandleAsync(TRequest request, CancellationToken cancellationToken);
}
```

Generic delegates:

```csharp
public delegate TResult Converter<in TInput, out TResult>(TInput input);
```

In real applications, generic interfaces are common in CQRS, validation, mapping, pipelines, caching, and event handling.

### The `where` Keyword

Constraints are declared using `where` clauses.

```csharp
public class EfRepository<TEntity, TKey>
    where TEntity : class, IEntity<TKey>
    where TKey : notnull
{
    public Task<TEntity?> FindAsync(TKey id)
    {
        throw new NotImplementedException();
    }
}
```

This means:

- `TEntity` must be a non-nullable reference type.
- `TEntity` must implement `IEntity<TKey>`.
- `TKey` must be non-nullable.

Multiple type parameters can have separate constraints.

```csharp
public interface IMapper<TSource, TDestination>
    where TSource : class
    where TDestination : class, new()
{
    TDestination Map(TSource source);
}
```

### Common Constraint Types

C# supports several important constraint forms.

#### `where T : class`

Requires `T` to be a reference type.

```csharp
public class ReferenceCache<T>
    where T : class
{
    private readonly Dictionary<string, T> _cache = new();

    public T? Get(string key)
    {
        return _cache.TryGetValue(key, out var value) ? value : null;
    }
}
```

In a nullable-enabled project, `where T : class` means `T` is a non-nullable reference type. Use `class?` when nullable reference type arguments are allowed.

#### `where T : class?`

Allows nullable or non-nullable reference types.

```csharp
public static bool IsMissing<T>(T value)
    where T : class?
{
    return value is null;
}
```

This is useful when the component intentionally accepts nullable reference values.

#### `where T : struct`

Requires `T` to be a non-nullable value type.

```csharp
public static bool IsDefault<T>(T value)
    where T : struct
{
    return EqualityComparer<T>.Default.Equals(value, default);
}
```

Important details:

- `struct` excludes nullable value types such as `int?`.
- `struct` implies an accessible parameterless constructor.
- `struct` cannot be combined with `class`, `class?`, `notnull`, `unmanaged`, or `new()`.

#### `where T : notnull`

Requires `T` to be a non-nullable type.

```csharp
public class Lookup<TKey, TValue>
    where TKey : notnull
{
    private readonly Dictionary<TKey, TValue> _items = new();

    public void Add(TKey key, TValue value)
    {
        _items.Add(key, value);
    }
}
```

This is common for dictionary keys, cache keys, IDs, and strongly typed lookup structures.

Important interview detail: `notnull` works with nullable reference type analysis. Violations normally produce compiler warnings rather than hard errors.

#### `where T : unmanaged`

Requires `T` to be an unmanaged value type.

```csharp
public static int SizeOf<T>()
    where T : unmanaged
{
    return System.Runtime.InteropServices.Marshal.SizeOf<T>();
}
```

This is useful for low-level code, interop, binary serialization, memory operations, and performance-sensitive algorithms.

Important details:

- `unmanaged` implies `struct`.
- `unmanaged` cannot be combined with `struct` or `new()`.
- It is not commonly needed in normal business applications.

#### `where T : new()`

Requires a public parameterless constructor.

```csharp
public static T Create<T>()
    where T : new()
{
    return new T();
}
```

This is useful for simple factories, mapping components, test helpers, and object initialization.

Important details:

- `new()` must appear last when combined with other constraints.
- It only allows public parameterless construction.
- It does not work for constructors with parameters.
- Overusing `new()` can lead to weak object creation because dependencies and invariants may be bypassed.

#### Base Class Constraint

Requires `T` to inherit from a specific base class.

```csharp
public abstract class Entity
{
    public Guid Id { get; init; }
}

public class AuditService<TEntity>
    where TEntity : Entity
{
    public string GetAuditKey(TEntity entity)
    {
        return $"{typeof(TEntity).Name}:{entity.Id}";
    }
}
```

Base class constraints are useful when a reusable component needs shared behavior or state from a base class.

Trade-off: base class constraints couple the generic component to a specific inheritance hierarchy. Interface constraints are often more flexible.

#### Interface Constraint

Requires `T` to implement an interface.

```csharp
public interface IEntity<TKey>
{
    TKey Id { get; }
}

public class Repository<TEntity, TKey>
    where TEntity : IEntity<TKey>
    where TKey : notnull
{
    public TKey GetId(TEntity entity)
    {
        return entity.Id;
    }
}
```

Interface constraints are one of the most common and useful constraint types because they express behavior without forcing inheritance from a base class.

Common examples:

```csharp
where T : IDisposable
where T : IComparable<T>
where T : IEquatable<T>
where T : IEntity<Guid>
where T : ICommand<TResult>
where T : IValidator<TRequest>
```

#### Multiple Constraints

A type parameter can have multiple constraints.

```csharp
public class CsvExporter<T>
    where T : class, IExportable, new()
{
    public string ExportNewItem()
    {
        var item = new T();
        return item.ToCsv();
    }
}

public interface IExportable
{
    string ToCsv();
}
```

Constraint ordering matters:

```csharp
// Correct
where T : class, IExportable, new()

// Incorrect
// where T : new(), class, IExportable
```

General order:

1. Primary kind constraint such as `class`, `class?`, `struct`, `notnull`, or `unmanaged`
2. Base class constraint, if used
3. Interface constraints
4. `new()` constraint last
5. Anti-constraints such as `allows ref struct`, when applicable

### Enum Constraints

C# supports constraining a type parameter to `System.Enum`.

```csharp
public static IReadOnlyList<TEnum> GetEnumValues<TEnum>()
    where TEnum : struct, Enum
{
    return Enum.GetValues<TEnum>();
}
```

This is useful for reusable enum helpers.

```csharp
public enum OrderStatus
{
    Draft,
    Submitted,
    Paid,
    Cancelled
}

var values = GetEnumValues<OrderStatus>();
```

Why this is better than accepting `Enum` directly:

- Stronger type safety
- No need to pass `typeof(OrderStatus)` manually
- Easier to build reusable helpers
- Better caller experience

### Delegate Constraints

A type can be constrained to `Delegate` or `MulticastDelegate`.

```csharp
public static TDelegate Combine<TDelegate>(TDelegate first, TDelegate second)
    where TDelegate : Delegate
{
    return (TDelegate)Delegate.Combine(first, second);
}
```

This is useful for reusable delegate utilities, callback composition, and event-related infrastructure.

In everyday business code, delegate constraints are less common than interface and base class constraints, but they are useful to know for advanced interviews.

### Type Parameter as a Constraint

One type parameter can constrain another.

```csharp
public static void CopyTo<TSource, TDestination>(
    IEnumerable<TSource> source,
    ICollection<TDestination> destination)
    where TSource : TDestination
{
    foreach (var item in source)
    {
        destination.Add(item);
    }
}
```

This means every `TSource` must be assignable to `TDestination`.

```csharp
List<string> strings = ["a", "b"];
List<object> objects = [];

CopyTo<string, object>(strings, objects);
```

This is useful when modeling relationships between type parameters.

### Generic Methods vs Generic Classes

A generic class makes the whole type reusable for a type parameter.

```csharp
public class PagedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = [];
    public int TotalCount { get; init; }
}
```

A generic method makes only one operation generic.

```csharp
public static PagedResult<T> ToPagedResult<T>(
    IReadOnlyList<T> items,
    int totalCount)
{
    return new PagedResult<T>
    {
        Items = items,
        TotalCount = totalCount
    };
}
```

Use a generic class when the type parameter is part of the object's state or identity.

Use a generic method when the type parameter is only needed for one operation.

Common mistake: making an entire class generic when only one method needs the type parameter.

### Constraints and Nullable Reference Types

Generic constraints interact with nullable reference types.

```csharp
public class RequiredValue<T>
    where T : notnull
{
    public T Value { get; }

    public RequiredValue(T value)
    {
        Value = value;
    }
}
```

This prevents nullable values from being used as valid type arguments in nullable-aware code.

Compare these constraints:

```csharp
where T : class      // non-nullable reference type in nullable context
where T : class?     // nullable or non-nullable reference type
where T : notnull    // non-nullable reference type or non-nullable value type
where T : struct     // non-nullable value type
```

Important habit: choose the constraint that matches the real domain rule.

```csharp
public class Cache<TKey, TValue>
    where TKey : notnull
{
    private readonly Dictionary<TKey, TValue> _cache = new();

    public TValue? GetOrDefault(TKey key)
    {
        return _cache.TryGetValue(key, out var value) ? value : default;
    }
}
```

`TKey` should be `notnull` because dictionary keys should not be null. `TValue` may or may not be nullable depending on the business case.

### Generic Constraints and Reusable Domain Components

Generics are common in domain and application layers.

```csharp
public interface IEntity<TKey>
{
    TKey Id { get; }
}
```

```csharp
public interface IRepository<TEntity, TKey>
    where TEntity : class, IEntity<TKey>
    where TKey : notnull
{
    Task<TEntity?> FindByIdAsync(TKey id, CancellationToken cancellationToken);
    Task AddAsync(TEntity entity, CancellationToken cancellationToken);
}
```

```csharp
public sealed class Product : IEntity<Guid>
{
    public Guid Id { get; init; }
    public string Name { get; set; } = string.Empty;
}
```

This design makes the repository reusable for many entity types while still guaranteeing that each entity has an ID.

Interview trade-off:

- Good: type-safe, reusable, consistent abstraction
- Bad: can become too generic and hide important persistence details
- Bad: generic repositories may not fit complex aggregate-specific queries
- Best practice: use generic abstractions where behavior is truly common, and use specific repositories or query services for domain-specific operations

### Generic Constraints in CQRS and MediatR-Style Designs

CQRS patterns often use generics for commands, queries, handlers, and pipeline behaviors.

```csharp
public interface ICommand<TResult>
{
}

public interface ICommandHandler<TCommand, TResult>
    where TCommand : ICommand<TResult>
{
    Task<TResult> HandleAsync(TCommand command, CancellationToken cancellationToken);
}
```

```csharp
public sealed record CreateProductCommand(string Name) : ICommand<Guid>;
```

```csharp
public sealed class CreateProductHandler
    : ICommandHandler<CreateProductCommand, Guid>
{
    public Task<Guid> HandleAsync(
        CreateProductCommand command,
        CancellationToken cancellationToken)
    {
        var productId = Guid.NewGuid();
        return Task.FromResult(productId);
    }
}
```

The constraint ensures that a handler can only be created for a request type that actually represents a command returning the expected result.

### Generic Constraints for Validation

Reusable validation pipelines often use generic constraints.

```csharp
public interface IValidator<T>
{
    IReadOnlyList<string> Validate(T instance);
}

public sealed class ValidationBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
    {
        _validators = validators;
    }

    public IReadOnlyList<string> Validate(TRequest request)
    {
        return _validators
            .SelectMany(validator => validator.Validate(request))
            .ToList();
    }
}
```

This style is common in production .NET applications because it allows cross-cutting behavior to be implemented once and reused for many request types.

### Generic Constraints for Factories

The `new()` constraint can be used for simple factories.

```csharp
public interface IHasCreatedAt
{
    DateTime CreatedAtUtc { get; set; }
}

public static class Factory
{
    public static T Create<T>()
        where T : IHasCreatedAt, new()
    {
        return new T
        {
            CreatedAtUtc = DateTime.UtcNow
        };
    }
}
```

However, in real applications, constructors often require dependencies or required values.

Better for domain objects:

```csharp
public sealed class Order
{
    public Guid Id { get; }
    public string CustomerNumber { get; }

    public Order(Guid id, string customerNumber)
    {
        Id = id;
        CustomerNumber = string.IsNullOrWhiteSpace(customerNumber)
            ? throw new ArgumentException("Customer number is required.", nameof(customerNumber))
            : customerNumber;
    }
}
```

Avoid using `new()` if it forces domain objects to have weak parameterless constructors.

### Generic Math and Static Abstract Interface Members

Modern C# supports static abstract members in interfaces, which enables generic math and reusable numeric algorithms.

```csharp
public static T Add<T>(T left, T right)
    where T : System.Numerics.IAdditionOperators<T, T, T>
{
    return left + right;
}
```

Before static abstract interface members, writing reusable numeric code was difficult because operators like `+` could not be expressed through normal interface constraints.

```csharp
public static T Sum<T>(IEnumerable<T> values)
    where T :
        System.Numerics.IAdditionOperators<T, T, T>,
        System.Numerics.IAdditiveIdentity<T, T>
{
    var total = T.AdditiveIdentity;

    foreach (var value in values)
    {
        total += value;
    }

    return total;
}
```

This is useful for numeric algorithms, financial calculations, scientific code, statistics helpers, and reusable math libraries.

Interview point: this is an advanced feature. Most business applications do not need it, but it shows how constraints can describe compile-time capabilities beyond normal instance methods.

### Variance in Generic Interfaces

Variance controls how generic interface types can be assigned when their type arguments have inheritance relationships.

Covariance uses `out` and is for producer/output positions.

```csharp
IEnumerable<string> strings = new List<string>();
IEnumerable<object> objects = strings;
```

This works because `IEnumerable<out T>` only produces values of `T`.

Contravariance uses `in` and is for consumer/input positions.

```csharp
IComparer<object> objectComparer = Comparer<object>.Default;
IComparer<string> stringComparer = objectComparer;
```

This works because an `IComparer<object>` can compare strings, since strings are objects.

Custom examples:

```csharp
public interface IProducer<out T>
{
    T Produce();
}

public interface IConsumer<in T>
{
    void Consume(T item);
}
```

Rules:

- Use `out T` when the interface returns `T` but does not accept `T` as input.
- Use `in T` when the interface accepts `T` as input but does not return `T`.
- Value types do not support variance conversions.
- Classes are invariant even if they implement variant interfaces.

Common interview trap:

```csharp
List<string> strings = new();
IEnumerable<object> objects = strings; // Valid

// List<object> objectList = strings; // Invalid
```

`List<T>` is invariant because it both consumes and produces `T`.

### Open Generic Types and Dependency Injection

In ASP.NET Core and other .NET applications, open generic registrations allow one implementation to be reused for many closed generic types.

```csharp
services.AddScoped(typeof(IRepository<,>), typeof(EfRepository<,>));
```

This means the container can resolve:

```csharp
IRepository<Product, Guid>
IRepository<Customer, int>
IRepository<Order, Guid>
```

A common validation pipeline example:

```csharp
services.AddScoped(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
```

This is powerful because reusable generic components can be wired once and applied across many application types.

Interview point: open generics are often used for repositories, validators, handlers, decorators, pipeline behaviors, mappers, and caching wrappers.

### Runtime Behavior and Performance

Generics are checked at compile time, but they also have runtime behavior.

Important practical points:

- Generic code avoids many casts that would be needed with `object`.
- Generic collections such as `List<int>` avoid boxing each `int`.
- Reflection-based generic creation is more flexible but slower and less type-safe.
- Generic constraints let the compiler call constrained members directly.
- Overly abstract generic designs can make debugging and stack traces harder to understand.

Example of avoiding boxing:

```csharp
var numbers = new List<int>();
numbers.Add(10); // No boxing into object
```

Compared with:

```csharp
var numbers = new ArrayList();
numbers.Add(10); // int is boxed as object
```

In modern C#, prefer generic collections and generic interfaces over non-generic collections.

### Practical Design Examples

#### Reusable Result Type

```csharp
public sealed class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public string? Error { get; }

    private Result(bool isSuccess, T? value, string? error)
    {
        IsSuccess = isSuccess;
        Value = value;
        Error = error;
    }

    public static Result<T> Success(T value)
    {
        return new Result<T>(true, value, null);
    }

    public static Result<T> Failure(string error)
    {
        return new Result<T>(false, default, error);
    }
}
```

This generic type is reusable for many response values.

```csharp
Result<Guid> result = Result<Guid>.Success(Guid.NewGuid());
Result<string> failed = Result<string>.Failure("Name is required.");
```

#### Strongly Typed ID Pattern

```csharp
public interface IStronglyTypedId<TValue>
    where TValue : notnull
{
    TValue Value { get; }
}

public readonly record struct ProductId(Guid Value)
    : IStronglyTypedId<Guid>;

public readonly record struct CustomerId(Guid Value)
    : IStronglyTypedId<Guid>;
```

This avoids mixing unrelated IDs accidentally.

```csharp
public sealed class Product
{
    public ProductId Id { get; init; }
}
```

Generic constraints can then work with typed IDs:

```csharp
public static string FormatId<TId, TValue>(TId id)
    where TId : IStronglyTypedId<TValue>
    where TValue : notnull
{
    return id.Value.ToString()!;
}
```

#### Generic Cache Wrapper

```csharp
public interface ICache<TKey, TValue>
    where TKey : notnull
{
    bool TryGet(TKey key, out TValue value);
    void Set(TKey key, TValue value);
}

public sealed class MemoryCache<TKey, TValue> : ICache<TKey, TValue>
    where TKey : notnull
{
    private readonly Dictionary<TKey, TValue> _items = new();

    public bool TryGet(TKey key, out TValue value)
    {
        return _items.TryGetValue(key, out value!);
    }

    public void Set(TKey key, TValue value)
    {
        _items[key] = value;
    }
}
```

The `notnull` constraint clearly expresses that cache keys cannot be null.

#### Generic Comparable Helper

```csharp
public static class SortHelper
{
    public static IReadOnlyList<T> Sort<T>(IEnumerable<T> items)
        where T : IComparable<T>
    {
        return items.OrderBy(item => item).ToList();
    }
}
```

The constraint allows sorting only for types that define comparison logic.

### Constraints vs Runtime Checks

A constraint is checked at compile time.

```csharp
public static void DisposeItem<T>(T item)
    where T : IDisposable
{
    item.Dispose();
}
```

A runtime check is checked while the program runs.

```csharp
public static void DisposeIfPossible<T>(T item)
{
    if (item is IDisposable disposable)
    {
        disposable.Dispose();
    }
}
```

Use constraints when the operation requires a capability.

Use runtime checks when the capability is optional.

Interview comparison:

| Approach | Use When | Benefit | Trade-off |
|---|---|---|---|
| Constraint | The type must support the behavior | Compile-time safety | Less flexible |
| Runtime check | The behavior is optional | More flexible | Errors may be found later |
| Reflection | Shape is unknown at compile time | Maximum flexibility | Slower and less safe |
| Interface polymorphism | You do not need generic type preservation | Simple abstraction | May lose specific type information |

### Constraints vs Inheritance vs Interfaces

Generic constraints can use both base classes and interfaces, but the design intent is different.

Base class constraint:

```csharp
where T : Entity
```

Use when all types truly share a common base implementation.

Interface constraint:

```csharp
where T : IEntity<Guid>
```

Use when the component only needs a behavior or contract.

Generic interface without base class:

```csharp
public interface IAuditable
{
    DateTime CreatedAtUtc { get; }
}
```

```csharp
public static DateTime GetCreatedAt<T>(T item)
    where T : IAuditable
{
    return item.CreatedAtUtc;
}
```

In most reusable business components, interface constraints are more flexible than base class constraints.

### Common Mistakes

#### Overusing Generics

Not every abstraction needs generics.

```csharp
public class ProductService<TProduct>
{
    // Only ever used with Product
}
```

If only one type is valid, use the concrete type.

#### Over-Constraining Type Parameters

```csharp
public class ReportBuilder<T>
    where T : class, new()
{
}
```

If the class never creates `T`, the `new()` constraint is unnecessary.

Only add constraints that the implementation actually needs.

#### Using `new()` for Domain Entities

```csharp
public class EntityFactory<T>
    where T : new()
{
    public T Create() => new T();
}
```

This can force domain entities to expose parameterless constructors and allow invalid objects.

Prefer explicit factories for domain objects with required data.

#### Forgetting `notnull` for Keys

```csharp
public class Cache<TKey, TValue>
{
    private readonly Dictionary<TKey, TValue> _items = new();
}
```

Better:

```csharp
public class Cache<TKey, TValue>
    where TKey : notnull
{
    private readonly Dictionary<TKey, TValue> _items = new();
}
```

Keys should usually be non-null.

#### Assuming `default(T)` Is Always Safe

```csharp
public static T GetDefault<T>()
{
    return default!;
}
```

`default(T)` can be:

- `0` for `int`
- `false` for `bool`
- `null` for reference types
- A zero-initialized struct
- A value that may be invalid for the domain

Avoid using `default` as a fake valid value unless the behavior is clearly documented.

#### Confusing `class`, `class?`, and `notnull`

```csharp
where T : class
```

This means non-nullable reference type in nullable-aware code.

```csharp
where T : class?
```

This allows nullable reference types.

```csharp
where T : notnull
```

This allows non-nullable reference types and non-nullable value types.

Choose based on the real nullability rule.

#### Assuming `IEnumerable<T>` Allows Modification

```csharp
public void AddItem<T>(IEnumerable<T> items, T item)
{
    // Cannot add to IEnumerable<T>
}
```

`IEnumerable<T>` is for enumeration. Use `ICollection<T>` or `IList<T>` if mutation is required.

#### Returning Overly Generic Types

```csharp
public object GetValue<T>()
{
    return default(T)!;
}
```

Better:

```csharp
public T? GetValue<T>()
{
    return default;
}
```

If the method is generic, preserve the generic type information.

### Best Practices

Use generics when the logic is genuinely reusable across multiple types.

Prefer interface constraints for behavior-based reuse:

```csharp
where T : IAuditable
```

Use base class constraints only when shared implementation is truly required:

```csharp
where T : Entity
```

Use `notnull` for dictionary keys, cache keys, IDs, and lookup types.

Avoid adding constraints before the implementation actually needs them.

Use nullable-aware constraints such as `class`, `class?`, and `notnull` intentionally.

Prefer generic collections such as `List<T>`, `Dictionary<TKey, TValue>`, and `IReadOnlyList<T>` over non-generic collections.

Avoid `new()` constraints for rich domain models that require valid constructor arguments.

Keep generic APIs readable. If a generic signature becomes hard to understand, the abstraction may be too broad.

Use descriptive type parameter names when the role is not obvious:

```csharp
public interface IRepository<TEntity, TKey>
```

This is clearer than:

```csharp
public interface IRepository<T, U>
```

Use common names such as `T`, `TKey`, `TValue`, `TEntity`, `TRequest`, `TResponse`, `TCommand`, and `TQuery`.

Prefer specific abstractions for domain-specific behavior. A generic repository should not become a dumping ground for every possible query.

### Interview Mental Model

When choosing a generic constraint, ask:

1. What operation does the generic component need to perform?
2. Does every possible `T` support that operation?
3. Can an interface express the required behavior?
4. Is a base class truly required?
5. Should the type allow reference types, value types, nullable values, or only non-null values?
6. Does the component need to create instances of `T`?
7. Would a non-generic abstraction be simpler?
8. Will this generic design remain understandable to other developers?

A good generic design is reusable but not vague. It should make invalid usage impossible or at least difficult.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What are generics in C#?

<!-- question:start:generics-basics-beginner-q01 -->
<!-- question-id:generics-basics-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Generics allow classes, methods, interfaces, structs, and delegates to work with type parameters. Instead of writing separate code for `int`, `string`, `Product`, or `Customer`, a generic component can work with `T`.

For example, `List<T>` can become `List<int>`, `List<string>`, or `List<Product>`. The compiler knows the actual type, so it can provide type safety and avoid many casts.

```csharp
public class Box<T>
{
    public T Value { get; }

    public Box(T value)
    {
        Value = value;
    }
}
```

Generics are useful because they improve code reuse, compile-time safety, readability, and performance when compared with `object`-based designs.

##### Key Points to Mention

- Generics use type parameters such as `T`.
- They allow reusable and type-safe code.
- They avoid many casts.
- Generic collections are preferred over non-generic collections.
- Examples include `List<T>`, `Dictionary<TKey, TValue>`, and `IEnumerable<T>`.

<!-- question:end:generics-basics-beginner-q01 -->

#### What is a generic type constraint?

<!-- question:start:generic-type-constraint-definition-beginner-q02 -->
<!-- question-id:generic-type-constraint-definition-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A generic type constraint is a rule that limits what types can be used as a generic type argument. Constraints are written using the `where` keyword.

```csharp
public static T Max<T>(T left, T right)
    where T : IComparable<T>
{
    return left.CompareTo(right) >= 0 ? left : right;
}
```

The constraint `where T : IComparable<T>` means `T` must implement `IComparable<T>`. Because of this, the compiler allows the method to call `CompareTo`.

Constraints help the compiler understand what members and behaviors are available on a generic type.

##### Key Points to Mention

- Constraints use the `where` keyword.
- They restrict valid type arguments.
- They provide compile-time safety.
- They allow access to members defined by the constraint.
- They make reusable components more precise.

<!-- question:end:generic-type-constraint-definition-beginner-q02 -->

#### Why would you use constraints instead of accepting any `T`?

<!-- question:start:why-use-generic-constraints-beginner-q03 -->
<!-- question-id:why-use-generic-constraints-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Without constraints, the compiler only knows that `T` is some type. It cannot assume that `T` has specific methods, properties, constructors, or behaviors.

This does not compile:

```csharp
public static int Compare<T>(T left, T right)
{
    return left.CompareTo(right);
}
```

Adding a constraint fixes the issue:

```csharp
public static int Compare<T>(T left, T right)
    where T : IComparable<T>
{
    return left.CompareTo(right);
}
```

Constraints are used when the generic implementation requires a specific capability.

##### Key Points to Mention

- Unconstrained `T` has very limited known capabilities.
- Constraints tell the compiler what `T` supports.
- Constraints avoid runtime casts and runtime failures.
- Use constraints when the implementation requires a behavior.
- Do not add constraints unnecessarily.

<!-- question:end:why-use-generic-constraints-beginner-q03 -->

#### What does `where T : class` mean?

<!-- question:start:class-constraint-beginner-q04 -->
<!-- question-id:class-constraint-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`where T : class` means the type argument must be a reference type. In a nullable-enabled project, it means `T` should be a non-nullable reference type.

```csharp
public class ReferenceCache<T>
    where T : class
{
    public T? GetOrDefault(string key)
    {
        return null;
    }
}
```

This allows the generic component to work only with classes, interfaces, delegates, arrays, or other reference types.

##### Key Points to Mention

- Restricts `T` to reference types.
- In nullable-aware code, it means non-nullable reference type.
- Use `class?` if nullable reference type arguments are allowed.
- It cannot be combined with `struct`, `notnull`, or `unmanaged`.

<!-- question:end:class-constraint-beginner-q04 -->

#### What does `where T : struct` mean?

<!-- question:start:struct-constraint-beginner-q05 -->
<!-- question-id:struct-constraint-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

`where T : struct` means the type argument must be a non-nullable value type.

```csharp
public static bool IsDefault<T>(T value)
    where T : struct
{
    return EqualityComparer<T>.Default.Equals(value, default);
}
```

This allows types such as `int`, `decimal`, `DateTime`, `Guid`, and custom structs. It does not allow reference types and does not allow nullable value types such as `int?`.

##### Key Points to Mention

- Restricts `T` to non-nullable value types.
- Does not allow `Nullable<T>` such as `int?`.
- Implies an accessible parameterless constructor.
- Cannot be combined with `class`, `notnull`, `unmanaged`, or `new()`.

<!-- question:end:struct-constraint-beginner-q05 -->

#### What does `where T : new()` mean?

<!-- question:start:new-constraint-beginner-q06 -->
<!-- question-id:new-constraint-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

`where T : new()` means the type argument must have a public parameterless constructor. This lets the generic code create an instance of `T`.

```csharp
public static T Create<T>()
    where T : new()
{
    return new T();
}
```

When combined with other constraints, `new()` must be listed last.

##### Key Points to Mention

- Allows `new T()` inside generic code.
- Requires a public parameterless constructor.
- Must appear last in the constraint list.
- Should not be overused for domain entities that require constructor parameters.

<!-- question:end:new-constraint-beginner-q06 -->

#### What is the difference between a generic class and a generic method?

<!-- question:start:generic-class-vs-method-beginner-q07 -->
<!-- question-id:generic-class-vs-method-beginner-q07 -->
<!-- question-level:beginner -->

##### Expected Answer

A generic class uses a type parameter across the whole class.

```csharp
public class Repository<TEntity>
{
    public void Add(TEntity entity)
    {
    }
}
```

A generic method uses a type parameter only for one method.

```csharp
public static T Echo<T>(T value)
{
    return value;
}
```

Use a generic class when the type parameter is part of the object's state or behavior. Use a generic method when only one operation needs to be generic.

##### Key Points to Mention

- Generic classes make the whole type generic.
- Generic methods make a single operation generic.
- Method type parameters can often be inferred from arguments.
- Avoid making a whole class generic when only one method needs generics.

<!-- question:end:generic-class-vs-method-beginner-q07 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### What is the difference between `class`, `class?`, and `notnull` constraints?

<!-- question:start:class-classnullable-notnull-intermediate-q01 -->
<!-- question-id:class-classnullable-notnull-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

In nullable-aware C# code, these constraints express different nullability rules.

```csharp
where T : class
```

`T` must be a non-nullable reference type.

```csharp
where T : class?
```

`T` can be a nullable or non-nullable reference type.

```csharp
where T : notnull
```

`T` must be non-nullable, but it can be either a non-nullable reference type or a non-nullable value type.

```csharp
public class Cache<TKey, TValue>
    where TKey : notnull
{
    private readonly Dictionary<TKey, TValue> _items = new();
}
```

`notnull` is useful for keys and identifiers because keys should not be null.

##### Key Points to Mention

- `class` means non-nullable reference type in nullable context.
- `class?` allows nullable reference type arguments.
- `notnull` allows non-nullable reference types and non-nullable value types.
- `notnull` is common for dictionary keys and cache keys.
- Choose based on the real domain rule.

<!-- question:end:class-classnullable-notnull-intermediate-q01 -->

#### Why is `where TKey : notnull` common with dictionaries?

<!-- question:start:notnull-dictionary-key-intermediate-q02 -->
<!-- question-id:notnull-dictionary-key-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Dictionary keys should not be null. When building a generic wrapper around a dictionary, the wrapper should usually apply the same rule.

```csharp
public sealed class Lookup<TKey, TValue>
    where TKey : notnull
{
    private readonly Dictionary<TKey, TValue> _items = new();

    public void Add(TKey key, TValue value)
    {
        _items.Add(key, value);
    }
}
```

This prevents nullable keys from being used and makes the API clearer.

##### Key Points to Mention

- Dictionary keys need stable equality and hash code behavior.
- Null keys are usually invalid.
- `notnull` expresses this at compile time.
- It avoids nullable warnings in the generic wrapper.
- It improves API correctness.

<!-- question:end:notnull-dictionary-key-intermediate-q02 -->

#### When should you use an interface constraint instead of a base class constraint?

<!-- question:start:interface-vs-base-class-constraint-intermediate-q03 -->
<!-- question-id:interface-vs-base-class-constraint-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use an interface constraint when the generic component only needs a behavior or contract. Use a base class constraint when the component truly needs shared implementation or state from a common base class.

Interface constraint:

```csharp
public interface IEntity<TKey>
{
    TKey Id { get; }
}

public class Repository<TEntity, TKey>
    where TEntity : IEntity<TKey>
    where TKey : notnull
{
    public TKey GetId(TEntity entity) => entity.Id;
}
```

Base class constraint:

```csharp
public abstract class Entity
{
    public Guid Id { get; init; }
}

public class AuditService<TEntity>
    where TEntity : Entity
{
    public string GetKey(TEntity entity) => entity.Id.ToString();
}
```

Interfaces are usually more flexible because C# classes can implement multiple interfaces but inherit from only one base class.

##### Key Points to Mention

- Interface constraints express behavior.
- Base class constraints express inheritance.
- Interfaces are usually more flexible.
- Base class constraints create tighter coupling.
- Use the weakest constraint that gives the needed capability.

<!-- question:end:interface-vs-base-class-constraint-intermediate-q03 -->

#### How do generic constraints improve reusable repository design?

<!-- question:start:generic-repository-constraints-intermediate-q04 -->
<!-- question-id:generic-repository-constraints-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Generic constraints can ensure that a reusable repository only works with valid entity types and valid key types.

```csharp
public interface IEntity<TKey>
{
    TKey Id { get; }
}

public interface IRepository<TEntity, TKey>
    where TEntity : class, IEntity<TKey>
    where TKey : notnull
{
    Task<TEntity?> FindByIdAsync(TKey id, CancellationToken cancellationToken);
    Task AddAsync(TEntity entity, CancellationToken cancellationToken);
}
```

The constraints ensure that `TEntity` is a reference type, exposes an ID, and uses a non-null key.

However, a generic repository should not hide complex domain-specific queries. For complex aggregates, specific repositories or query services may be better.

##### Key Points to Mention

- Constraints guarantee entity shape.
- `class` is common for EF Core entity types.
- `IEntity<TKey>` exposes a common ID.
- `notnull` is useful for keys.
- Generic repositories are useful but can be overused.

<!-- question:end:generic-repository-constraints-intermediate-q04 -->

#### What are enum constraints used for?

<!-- question:start:enum-constraints-intermediate-q05 -->
<!-- question-id:enum-constraints-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Enum constraints allow reusable methods to work only with enum types.

```csharp
public static IReadOnlyList<TEnum> GetValues<TEnum>()
    where TEnum : struct, Enum
{
    return Enum.GetValues<TEnum>();
}
```

This is useful for enum helper methods, validation, display-name mapping, parsing, and building dropdown options.

Compared with accepting `Enum` or `Type`, a generic enum constraint gives stronger type safety and a better caller experience.

##### Key Points to Mention

- Use `where TEnum : struct, Enum`.
- Useful for reusable enum helpers.
- More type-safe than passing `Type`.
- Avoids invalid non-enum usage.
- Common in UI dropdowns, validation, and mapping utilities.

<!-- question:end:enum-constraints-intermediate-q05 -->

#### What is the risk of overusing the `new()` constraint?

<!-- question:start:new-constraint-risk-intermediate-q06 -->
<!-- question-id:new-constraint-risk-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

The `new()` constraint requires a public parameterless constructor. This can be convenient for simple factories, but it can be harmful when it forces domain objects to expose invalid or incomplete construction.

```csharp
public sealed class Order
{
    public Guid Id { get; set; }
    public string CustomerNumber { get; set; } = string.Empty;
}
```

This class can be created without a valid customer number.

A better domain model may require constructor arguments:

```csharp
public sealed class Order
{
    public Guid Id { get; }
    public string CustomerNumber { get; }

    public Order(Guid id, string customerNumber)
    {
        Id = id;
        CustomerNumber = customerNumber;
    }
}
```

If a generic API requires `new()`, this richer model cannot be used.

##### Key Points to Mention

- `new()` requires a public parameterless constructor.
- It can encourage invalid object creation.
- It may conflict with dependency injection and domain invariants.
- Use explicit factories when construction is complex.
- Add `new()` only when generic code truly needs `new T()`.

<!-- question:end:new-constraint-risk-intermediate-q06 -->

#### What is variance in generic interfaces?

<!-- question:start:generic-variance-intermediate-q07 -->
<!-- question-id:generic-variance-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

Variance controls assignment compatibility for generic interfaces and delegates when type arguments have inheritance relationships.

Covariance uses `out` and is for producing values:

```csharp
IEnumerable<string> strings = new List<string>();
IEnumerable<object> objects = strings;
```

This works because `IEnumerable<out T>` only returns `T`.

Contravariance uses `in` and is for consuming values:

```csharp
IComparer<object> objectComparer = Comparer<object>.Default;
IComparer<string> stringComparer = objectComparer;
```

This works because a comparer that can compare objects can also compare strings.

Custom example:

```csharp
public interface IProducer<out T>
{
    T Produce();
}

public interface IConsumer<in T>
{
    void Consume(T item);
}
```

##### Key Points to Mention

- `out` means covariant producer.
- `in` means contravariant consumer.
- Interfaces and delegates can be variant.
- Classes such as `List<T>` are invariant.
- Value types do not support variance conversions.

<!-- question:end:generic-variance-intermediate-q07 -->

#### Why is `List<string>` not assignable to `List<object>`?

<!-- question:start:list-invariance-intermediate-q08 -->
<!-- question-id:list-invariance-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

`List<T>` is invariant because it both produces and consumes `T`. If `List<string>` could be assigned to `List<object>`, code could add a non-string object to a list that is actually a string list.

```csharp
List<string> strings = new();

// This is not allowed:
// List<object> objects = strings;

// If it were allowed, this would be a problem:
// objects.Add(new object());
```

However, `IEnumerable<string>` can be assigned to `IEnumerable<object>` because `IEnumerable<T>` only produces values and is covariant.

```csharp
IEnumerable<string> strings = new List<string>();
IEnumerable<object> objects = strings;
```

##### Key Points to Mention

- `List<T>` is invariant.
- It both accepts and returns `T`.
- Allowing the assignment would break type safety.
- `IEnumerable<out T>` is covariant because it only produces values.
- This is a common interview trap.

<!-- question:end:list-invariance-intermediate-q08 -->

#### How are open generics used in dependency injection?

<!-- question:start:open-generics-dependency-injection-intermediate-q09 -->
<!-- question-id:open-generics-dependency-injection-intermediate-q09 -->
<!-- question-level:intermediate -->

##### Expected Answer

An open generic type is a generic type definition that has not been closed with specific type arguments, such as `IRepository<,>` or `IValidator<>`.

In dependency injection, open generics allow one registration to support many closed generic types.

```csharp
services.AddScoped(typeof(IRepository<,>), typeof(EfRepository<,>));
```

This can later resolve:

```csharp
IRepository<Product, Guid>
IRepository<Customer, int>
```

Open generics are commonly used for repositories, validators, CQRS handlers, pipeline behaviors, decorators, mappers, and caching wrappers.

##### Key Points to Mention

- Open generic means type arguments are not supplied yet.
- Closed generic means type arguments are supplied.
- DI containers can map open generic interfaces to open generic implementations.
- This reduces repetitive registrations.
- Common in ASP.NET Core applications.

<!-- question:end:open-generics-dependency-injection-intermediate-q09 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How do static abstract interface members improve generic reusable components?

<!-- question:start:static-abstract-generic-math-advanced-q01 -->
<!-- question-id:static-abstract-generic-math-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Static abstract interface members allow generic code to call static members and operators defined by a type. This enables generic math and reusable numeric algorithms.

```csharp
public static T Add<T>(T left, T right)
    where T : System.Numerics.IAdditionOperators<T, T, T>
{
    return left + right;
}
```

Before this feature, it was difficult to write generic methods that used operators such as `+`, because operators are static and could not be expressed through normal instance interface methods.

A more complete example:

```csharp
public static T Sum<T>(IEnumerable<T> values)
    where T :
        System.Numerics.IAdditionOperators<T, T, T>,
        System.Numerics.IAdditiveIdentity<T, T>
{
    var total = T.AdditiveIdentity;

    foreach (var value in values)
    {
        total += value;
    }

    return total;
}
```

This is useful in numeric libraries, financial calculations, scientific computing, statistics, and reusable algorithm design.

##### Key Points to Mention

- Static abstract interface members allow compile-time static member calls.
- They make generic math possible.
- Operators like `+` can be represented through constraints.
- Useful for advanced reusable algorithms.
- Usually not needed in simple business CRUD code.

<!-- question:end:static-abstract-generic-math-advanced-q01 -->

#### What is the difference between constraints and runtime type checks?

<!-- question:start:constraints-vs-runtime-checks-advanced-q02 -->
<!-- question-id:constraints-vs-runtime-checks-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Constraints are compile-time rules. They prevent invalid type arguments before the program runs.

```csharp
public static void DisposeItem<T>(T item)
    where T : IDisposable
{
    item.Dispose();
}
```

Runtime type checks happen during execution.

```csharp
public static void DisposeIfPossible<T>(T item)
{
    if (item is IDisposable disposable)
    {
        disposable.Dispose();
    }
}
```

Use constraints when a capability is required. Use runtime checks when a capability is optional.

Constraints produce clearer APIs and stronger safety. Runtime checks are more flexible but may hide problems until runtime.

##### Key Points to Mention

- Constraints are compile-time validation.
- Runtime checks use `is`, `as`, reflection, or pattern matching.
- Required behavior should usually be a constraint.
- Optional behavior can be a runtime check.
- Constraints make APIs more self-documenting.

<!-- question:end:constraints-vs-runtime-checks-advanced-q02 -->

#### How can generic constraints support Clean Architecture or CQRS?

<!-- question:start:generic-constraints-clean-architecture-cqrs-advanced-q03 -->
<!-- question-id:generic-constraints-clean-architecture-cqrs-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Generic constraints can define reusable application-layer contracts while preserving type safety.

```csharp
public interface ICommand<TResult>
{
}

public interface ICommandHandler<TCommand, TResult>
    where TCommand : ICommand<TResult>
{
    Task<TResult> HandleAsync(TCommand command, CancellationToken cancellationToken);
}
```

This ensures a handler's request type is actually a command that returns the expected response type.

Generic pipeline behaviors can also apply validation, logging, transactions, or performance measurement across many request types.

```csharp
public sealed class ValidationBehavior<TRequest, TResponse>
    where TRequest : notnull
{
}
```

In Clean Architecture, these abstractions usually belong in the Application layer, while concrete implementations may live in Infrastructure.

##### Key Points to Mention

- Generics are common in commands, queries, handlers, validators, and pipeline behaviors.
- Constraints enforce relationships between request and response types.
- Reusable cross-cutting behavior can be implemented once.
- Keep abstractions in the correct layer.
- Avoid making generic abstractions so broad that they hide business intent.

<!-- question:end:generic-constraints-clean-architecture-cqrs-advanced-q03 -->

#### What are the limitations of generic constraints?

<!-- question:start:generic-constraints-limitations-advanced-q04 -->
<!-- question-id:generic-constraints-limitations-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Generic constraints are powerful, but they cannot express every possible rule.

Limitations include:

- They cannot require a specific constructor signature other than public parameterless `new()`.
- They cannot directly require instance operators without modern static abstract interface patterns.
- They cannot express complex runtime rules such as "must have a property named `Name`" unless that property is part of an interface or base class.
- They cannot enforce business invariants by themselves.
- They can make APIs harder to read if overused.
- Some constraints are mutually exclusive.

This is not possible directly:

```csharp
// Not supported:
// where T : new(string name)
```

A better approach is usually to use a factory delegate or factory interface:

```csharp
public interface IFactory<T>
{
    T Create(string name);
}
```

##### Key Points to Mention

- Only public parameterless construction can be constrained with `new()`.
- Use interfaces to express required members.
- Use factories for complex construction.
- Constraints do not replace validation or business rules.
- Overly complex constraints can hurt maintainability.

<!-- question:end:generic-constraints-limitations-advanced-q04 -->

#### How do generic constraints affect performance?

<!-- question:start:generic-constraints-performance-advanced-q05 -->
<!-- question-id:generic-constraints-performance-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Generics can improve performance compared with `object`-based code because they avoid many casts and can avoid boxing for value types.

```csharp
var list = new List<int>();
list.Add(10); // no boxing
```

Compared with older non-generic collections:

```csharp
var list = new ArrayList();
list.Add(10); // boxes int as object
```

Constraints can also allow the compiler to call known members without reflection or unsafe casts.

However, performance should not be the only reason to use constraints. The main benefits are type safety, API clarity, and reuse. Overly generic designs can sometimes make code more complex or harder to optimize at the application level.

##### Key Points to Mention

- Generic collections avoid many boxing scenarios.
- Constraints avoid reflection and repeated casts.
- Compile-time calls are safer and usually cleaner.
- Measure performance before making complex generic optimizations.
- Design clarity is usually more important than micro-optimization.

<!-- question:end:generic-constraints-performance-advanced-q05 -->

#### How would you design a reusable component without overusing generics?

<!-- question:start:avoid-overusing-generics-advanced-q06 -->
<!-- question-id:avoid-overusing-generics-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Start with the actual behavior the component needs. If the behavior is shared across many types, use an interface and a generic constraint. If only one type is expected, use a concrete type. If the behavior varies significantly, prefer specific services or strategies.

Bad design:

```csharp
public class ProductService<TProduct>
{
}
```

If the application only has one `Product` type, this generic service adds complexity without value.

Good generic design:

```csharp
public interface IAuditable
{
    DateTime CreatedAtUtc { get; }
}

public class AuditFormatter<T>
    where T : IAuditable
{
    public string Format(T item)
    {
        return item.CreatedAtUtc.ToString("O");
    }
}
```

This generic design is justified because it works for any auditable type.

##### Key Points to Mention

- Do not make code generic just to appear reusable.
- Generic abstractions should solve repeated real problems.
- Prefer concrete types for concrete business logic.
- Use interfaces to express required behavior.
- Keep generic signatures readable.

<!-- question:end:avoid-overusing-generics-advanced-q06 -->

#### What is the `unmanaged` constraint and when would you use it?

<!-- question:start:unmanaged-constraint-advanced-q07 -->
<!-- question-id:unmanaged-constraint-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

The `unmanaged` constraint requires the type argument to be an unmanaged value type. This means the type does not contain references and can be treated as a block of memory.

```csharp
public static int GetSize<T>()
    where T : unmanaged
{
    return System.Runtime.InteropServices.Marshal.SizeOf<T>();
}
```

It is useful in interop, binary serialization, low-level memory operations, performance-sensitive code, and scenarios involving spans, buffers, or native APIs.

In normal business application code, it is uncommon.

##### Key Points to Mention

- `unmanaged` means non-nullable unmanaged value type.
- It implies `struct`.
- It cannot be combined with `struct` or `new()`.
- Useful for interop and low-level performance scenarios.
- Rare in typical CRUD applications.

<!-- question:end:unmanaged-constraint-advanced-q07 -->

#### What is a type parameter constraint such as `where TSource : TDestination`?

<!-- question:start:type-parameter-as-constraint-advanced-q08 -->
<!-- question-id:type-parameter-as-constraint-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

A type parameter can be used as a constraint for another type parameter. This expresses a relationship between two generic types.

```csharp
public static void CopyTo<TSource, TDestination>(
    IEnumerable<TSource> source,
    ICollection<TDestination> destination)
    where TSource : TDestination
{
    foreach (var item in source)
    {
        destination.Add(item);
    }
}
```

This means `TSource` must be assignable to `TDestination`.

```csharp
List<string> strings = ["a", "b"];
List<object> objects = [];

CopyTo<string, object>(strings, objects);
```

It is useful when a method needs to enforce inheritance or assignability relationships between generic parameters.

##### Key Points to Mention

- One generic parameter can constrain another.
- It models assignability relationships.
- Useful for copying, mapping, and conversion scenarios.
- The compiler enforces the relationship.
- It is less common but useful in advanced generic APIs.

<!-- question:end:type-parameter-as-constraint-advanced-q08 -->

#### What are `default` and `allows ref struct` constraints?

<!-- question:start:default-allows-ref-struct-advanced-q09 -->
<!-- question-id:default-allows-ref-struct-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

The `default` constraint is used in advanced cases involving overrides or explicit interface implementations where the base method has neither a `class` nor `struct` constraint. It helps resolve ambiguity around unconstrained type parameters, especially with nullable annotations.

The `allows ref struct` anti-constraint indicates that a type parameter can be a `ref struct`. If a generic API allows `ref struct` types, it must obey ref safety rules because values such as `Span<T>` cannot be boxed, captured, or stored on the heap in unsafe ways.

These constraints are advanced and not commonly used in everyday business applications, but they are part of modern C#'s generic constraint system.

##### Key Points to Mention

- `default` is mainly for overrides and explicit interface implementations.
- It helps with unconstrained generic method ambiguity.
- `allows ref struct` permits ref-like type arguments.
- Ref-like types require strict safety rules.
- These are advanced and uncommon in typical application code.

<!-- question:end:default-allows-ref-struct-advanced-q09 -->

#### How would you explain a good generic API design in an interview?

<!-- question:start:good-generic-api-design-advanced-q10 -->
<!-- question-id:good-generic-api-design-advanced-q10 -->
<!-- question-level:advanced -->

##### Expected Answer

A good generic API is reusable, type-safe, and easy to understand. It uses constraints to express real requirements, not accidental implementation details.

```csharp
public interface IEntity<TKey>
{
    TKey Id { get; }
}

public interface IReadRepository<TEntity, TKey>
    where TEntity : class, IEntity<TKey>
    where TKey : notnull
{
    Task<TEntity?> FindByIdAsync(TKey id, CancellationToken cancellationToken);
}
```

This API is clear because it says:

- The entity is a reference type.
- The entity has an ID.
- The key cannot be null.
- The repository only exposes read behavior.

A poor generic API often has too many type parameters, unnecessary constraints, vague names like `T1` and `T2`, or generic abstractions that are only used once.

##### Key Points to Mention

- Use generics for real reuse.
- Use constraints to express required capabilities.
- Avoid unnecessary type parameters.
- Use meaningful names such as `TEntity`, `TKey`, and `TResponse`.
- Prefer readability and maintainability over cleverness.

<!-- question:end:good-generic-api-design-advanced-q10 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
