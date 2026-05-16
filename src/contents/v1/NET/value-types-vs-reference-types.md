---
id: value-types-vs-reference-types
topic: C# Language Foundations
subtopic: Value Types vs Reference Types
category: .NET
---


## Overview

Value types and reference types are one of the most important foundations of C# and the .NET type system. Every C# type belongs to one of these broad categories, and the category affects assignment, method calls, equality, nullability, memory allocation, mutation, performance, and API design.

A value type variable directly contains its value. Common examples include `int`, `bool`, `decimal`, `DateTime`, `Guid`, `enum`, `struct`, `record struct`, and nullable value types such as `int?`.

A reference type variable contains a reference to an object. Common examples include `class`, `record class`, `interface`, `delegate`, `object`, `string`, arrays, collections such as `List<T>`, and most services or domain entities in application code.

This topic matters because many C# bugs come from misunderstanding whether a value is copied or shared. For example, changing a property on a class object through one variable can be visible through another variable that references the same object. Changing a copied struct usually changes only that copy. Boxing a value type can allocate memory. Passing large structs by value can create unnecessary copying. Nullable reference types are compile-time annotations, while nullable value types are real wrapper types.

In interviews, value types vs reference types is commonly used to test whether a developer understands C# beyond syntax. Interviewers often ask about copying, mutation, boxing, heap vs stack, `struct` design, `class` design, `record` behavior, `ref`/`out`/`in`, nullable types, and equality semantics. A strong answer should avoid oversimplified statements like "value types are always on the stack and reference types are always on the heap." The more accurate answer is that value types have value semantics and reference types have reference semantics; their physical storage location depends on context and runtime implementation details.

## Core Concepts

### Value Types

A value type variable contains the actual value. When a value type is assigned to another variable, passed as an argument, or returned from a method, the value is copied by default.

Common value types include:

- numeric types such as `int`, `long`, `double`, `decimal`
- `bool`
- `char`
- `DateTime`
- `TimeSpan`
- `Guid`
- `enum`
- `struct`
- `record struct`
- nullable value types such as `int?`

Example:

```csharp
int a = 10;
int b = a;

b = 20;

Console.WriteLine(a); // 10
Console.WriteLine(b); // 20
```

Changing `b` does not change `a` because `b` received a copy of the value.

For custom structs:

```csharp
public struct Point
{
    public int X { get; set; }
    public int Y { get; set; }
}

Point p1 = new Point { X = 1, Y = 2 };
Point p2 = p1;

p2.X = 100;

Console.WriteLine(p1.X); // 1
Console.WriteLine(p2.X); // 100
```

The struct instance was copied. `p1` and `p2` are independent values.

### Reference Types

A reference type variable contains a reference to an object. When a reference type variable is assigned to another variable, the reference is copied, not the object itself. Both variables can point to the same object.

Common reference types include:

- `class`
- `record class`
- `interface`
- `delegate`
- `object`
- `string`
- arrays
- most collection types such as `List<T>` and `Dictionary<TKey, TValue>`

Example:

```csharp
public class Customer
{
    public string Name { get; set; } = "";
}

Customer c1 = new Customer { Name = "Alice" };
Customer c2 = c1;

c2.Name = "Bob";

Console.WriteLine(c1.Name); // Bob
Console.WriteLine(c2.Name); // Bob
```

`c1` and `c2` both refer to the same object. Mutating the object through `c2` is visible through `c1`.

### Value Semantics vs Reference Semantics

The most important difference is semantic, not physical.

Value semantics means the variable represents a self-contained value. Copying the variable copies the value.

Reference semantics means the variable represents a reference to an object. Copying the variable copies the reference.

```csharp
public struct Money
{
    public decimal Amount { get; init; }
    public string Currency { get; init; }
}

public class Account
{
    public decimal Balance { get; set; }
}
```

`Money` is naturally a value. Two `Money` values with the same amount and currency can reasonably be considered equal.

`Account` is naturally an entity. Two accounts with the same balance are not necessarily the same account.

This distinction is useful in domain modeling:

- Use value types for small, self-contained values.
- Use reference types for entities, services, aggregates, and objects with identity or shared mutable state.

### Assignment Behavior

Assignment behaves differently depending on the type category.

Value type assignment copies the value:

```csharp
var first = new Coordinates(10, 20);
var second = first;

second.X = 99;

// first is unchanged if Coordinates is a mutable struct.
```

Reference type assignment copies the reference:

```csharp
var first = new Order { Status = "Pending" };
var second = first;

second.Status = "Completed";

// first.Status is also "Completed" because both variables refer to the same object.
```

For interviews, explain that both assignments copy something. The difference is what gets copied:

- Value type: the data is copied.
- Reference type: the reference is copied.

### Method Parameter Passing

By default, C# passes arguments by value. This means the parameter receives a copy of the argument.

For value types, the method receives a copy of the value:

```csharp
static void Increment(int number)
{
    number++;
}

int value = 10;
Increment(value);

Console.WriteLine(value); // 10
```

For reference types, the method receives a copy of the reference:

```csharp
static void Rename(Customer customer)
{
    customer.Name = "Updated";
}

var customer = new Customer { Name = "Original" };
Rename(customer);

Console.WriteLine(customer.Name); // Updated
```

The method cannot replace the caller's variable unless the parameter is passed with `ref`:

```csharp
static void Replace(Customer customer)
{
    customer = new Customer { Name = "New" };
}

var customer = new Customer { Name = "Original" };
Replace(customer);

Console.WriteLine(customer.Name); // Original
```

The local parameter was reassigned, but the caller's variable still points to the original object.

To allow the method to replace the caller's variable:

```csharp
static void Replace(ref Customer customer)
{
    customer = new Customer { Name = "New" };
}

var customer = new Customer { Name = "Original" };
Replace(ref customer);

Console.WriteLine(customer.Name); // New
```

### `ref`, `out`, and `in`

C# provides parameter modifiers that change how arguments are passed.

`ref` passes a variable by reference. The method can read and assign a new value to the caller's variable.

```csharp
static void AddOne(ref int number)
{
    number++;
}

int value = 10;
AddOne(ref value);

Console.WriteLine(value); // 11
```

`out` is used when the method must assign a value before returning. It is commonly used in `TryParse`-style APIs.

```csharp
if (int.TryParse("123", out int number))
{
    Console.WriteLine(number);
}
```

`in` passes by readonly reference. It can avoid copying large structs while preventing the method from reassigning the parameter.

```csharp
public readonly struct LargeValue
{
    public decimal A { get; init; }
    public decimal B { get; init; }
    public decimal C { get; init; }
}

static decimal Calculate(in LargeValue value)
{
    return value.A + value.B + value.C;
}
```

`in` is most useful for large immutable structs. It is usually unnecessary for small types like `int`, `bool`, or `DateTime`.

### Default Values

Every C# type has a default value.

For value types, the default value is usually the zero-equivalent value:

```csharp
default(int)       // 0
default(bool)      // false
default(DateTime)  // 0001-01-01 00:00:00
default(Guid)      // 00000000-0000-0000-0000-000000000000
```

For reference types, the default value is `null`:

```csharp
string text = default!; // null at runtime
Customer customer = default!; // null at runtime
```

For nullable value types:

```csharp
int? number = default;

Console.WriteLine(number.HasValue); // false
```

For structs, default initialization sets fields to their own default values:

```csharp
public struct ProductCode
{
    public int Number;
    public string Prefix;
}

var code = default(ProductCode);

Console.WriteLine(code.Number); // 0
Console.WriteLine(code.Prefix is null); // True
```

A common mistake is assuming a struct constructor always runs. Default struct values can exist even if you define constructors. Therefore, struct types should handle their default state safely.

### Nullability

Non-nullable value types cannot be assigned `null`:

```csharp
int number = null; // Compile-time error
```

Nullable value types use `Nullable<T>` syntax, commonly written as `T?`:

```csharp
int? number = null;

if (number.HasValue)
{
    Console.WriteLine(number.Value);
}
```

Reference types can be `null` at runtime. Nullable reference types, introduced as a compiler feature, help express intent:

```csharp
string name = "Alice";     // Intended to be non-null
string? middleName = null; // Intended to allow null
```

Important interview distinction:

- `int?` is a real nullable value type: `Nullable<int>`.
- `string?` is still a `string` reference at runtime; the `?` mainly enables compiler nullability analysis and warnings.

### Boxing and Unboxing

Boxing occurs when a value type is converted to `object` or to an interface type it implements. The runtime wraps the value in an object.

```csharp
int number = 42;

object boxed = number; // Boxing
int unboxed = (int)boxed; // Unboxing
```

Boxing creates a copy of the value:

```csharp
int number = 42;
object boxed = number;

number = 100;

Console.WriteLine(boxed);  // 42
Console.WriteLine(number); // 100
```

Boxing can also happen when a struct is used through an interface:

```csharp
public struct Counter : IComparable<Counter>
{
    public int Value { get; init; }

    public int CompareTo(Counter other) => Value.CompareTo(other.Value);
}

Counter counter = new Counter { Value = 10 };

// Potential boxing when converted to a non-generic interface:
IComparable comparable = counter;
```

Why boxing matters:

- it can allocate memory
- it can add CPU overhead
- it can hide copy behavior
- it can cause performance issues in tight loops
- it can surprise developers when mutating boxed structs

Use generics where possible to avoid unnecessary boxing:

```csharp
List<int> numbers = new List<int>(); // No boxing for int elements
ArrayList oldList = new ArrayList(); // Boxes int values
```

### Equality

Value types and reference types have different default equality behavior.

For reference types, default equality is usually reference equality unless the type overrides equality members.

```csharp
var a = new Customer { Name = "Alice" };
var b = new Customer { Name = "Alice" };

Console.WriteLine(a == b);      // False by default for classes
Console.WriteLine(a.Equals(b)); // False unless overridden
```

For many value types, equality compares values:

```csharp
int a = 10;
int b = 10;

Console.WriteLine(a == b); // True
```

Structs inherit from `ValueType`, which provides value-based equality by default, but reflection-based default equality can be slower than a custom implementation. For performance-sensitive structs, implement `IEquatable<T>`.

```csharp
public readonly struct Money : IEquatable<Money>
{
    public Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    public decimal Amount { get; }
    public string Currency { get; }

    public bool Equals(Money other)
    {
        return Amount == other.Amount &&
               Currency == other.Currency;
    }

    public override bool Equals(object? obj)
    {
        return obj is Money other && Equals(other);
    }

    public override int GetHashCode()
    {
        return HashCode.Combine(Amount, Currency);
    }
}
```

Records provide generated value-based equality:

```csharp
public record CustomerDto(int Id, string Name);      // Reference type by default
public readonly record struct Point(int X, int Y);   // Value type
```

Important distinction:

- `record class` is still a reference type, but it has value-based equality by default.
- `record struct` is a value type and also has generated value-based equality.

### Mutability

Mutability means whether an object or value can be changed after creation.

Mutable reference types are common:

```csharp
public class Customer
{
    public string Name { get; set; } = "";
}
```

Mutable structs are usually discouraged because copy behavior can be confusing:

```csharp
public struct MutablePoint
{
    public int X { get; set; }
    public int Y { get; set; }
}
```

Example of confusing behavior:

```csharp
var points = new List<MutablePoint>
{
    new MutablePoint { X = 1, Y = 2 }
};

var point = points[0];
point.X = 100;

Console.WriteLine(points[0].X); // 1
```

`points[0]` returned a copy. Mutating the copy did not update the value in the list.

Prefer immutable structs:

```csharp
public readonly struct Point
{
    public Point(int x, int y)
    {
        X = x;
        Y = y;
    }

    public int X { get; }
    public int Y { get; }
}
```

Or use a `readonly record struct`:

```csharp
public readonly record struct Point(int X, int Y);
```

### Classes vs Structs

A class is a reference type. A struct is a value type.

Use a class when:

- the type has identity
- the object is large
- the object is mutable
- shared state is expected
- inheritance is needed
- the type represents a service, entity, aggregate, or long-lived object

Use a struct when:

- the type is small
- the type is immutable or logically immutable
- value semantics are natural
- copying is cheap
- identity is not important
- the type represents a simple value like a coordinate, range, money amount, or measurement

Example of a good struct candidate:

```csharp
public readonly record struct Percentage(decimal Value)
{
    public override string ToString() => $"{Value:P}";
}
```

Example of a good class candidate:

```csharp
public class BankAccount
{
    public Guid Id { get; init; }
    public decimal Balance { get; private set; }

    public void Deposit(decimal amount)
    {
        Balance += amount;
    }
}
```

Even if two bank accounts have the same balance, they are not the same account. That makes identity important, so a class is usually better.

### Records, Record Classes, and Record Structs

Records are not a separate category from value/reference types. A record can be either:

- `record` or `record class`: reference type
- `record struct`: value type
- `readonly record struct`: immutable-oriented value type

```csharp
public record Person(string FirstName, string LastName);

public record struct Coordinate(int X, int Y);

public readonly record struct Money(decimal Amount, string Currency);
```

Records are useful when you want concise data-focused types with generated equality, deconstruction, `ToString`, and `with` support.

```csharp
var original = new Person("Alice", "Nguyen");
var updated = original with { LastName = "Tran" };

Console.WriteLine(original); // Person { FirstName = Alice, LastName = Nguyen }
Console.WriteLine(updated);  // Person { FirstName = Alice, LastName = Tran }
```

For a `record class`, the `with` expression creates a shallow copy. Reference-type properties are copied as references.

```csharp
public record OrderDto(List<string> Items);

var order1 = new OrderDto(new List<string> { "Book" });
var order2 = order1 with { };

order2.Items.Add("Pen");

Console.WriteLine(order1.Items.Count); // 2
```

This is a common interview trap. Records make equality and copying easier, but they do not automatically make nested objects deeply immutable.

### Arrays and Collections

Arrays are reference types, even if their elements are value types.

```csharp
int[] first = [1, 2, 3];
int[] second = first;

second[0] = 99;

Console.WriteLine(first[0]); // 99
```

The array variable is a reference to an array object. Both variables point to the same array.

For collections, the collection itself is usually a reference type:

```csharp
List<int> numbers1 = [1, 2, 3];
List<int> numbers2 = numbers1;

numbers2.Add(4);

Console.WriteLine(numbers1.Count); // 4
```

But the elements inside may be value types or reference types. This affects whether retrieving an element gives you a copy or a reference.

```csharp
List<Customer> customers = [new Customer { Name = "Alice" }];

Customer customer = customers[0];
customer.Name = "Bob";

Console.WriteLine(customers[0].Name); // Bob
```

For a list of class objects, the element is a reference to the same object.

### `string` as a Special Reference Type

`string` is a reference type, but it behaves like a value in many common scenarios because strings are immutable and `==` compares text content.

```csharp
string a = "hello";
string b = "he" + "llo";

Console.WriteLine(a == b); // True
```

This can confuse beginners because `string` is not a value type. It is a reference type with value-like behavior.

Important points:

- `string` variables hold references.
- `string` instances are immutable.
- operations like concatenation create new strings.
- `==` compares string contents, not object references.
- `object.ReferenceEquals(a, b)` checks whether two variables reference the same string object.

```csharp
string a = "hello";
string b = new string("hello".ToCharArray());

Console.WriteLine(a == b);                    // True
Console.WriteLine(object.ReferenceEquals(a,b)); // False
```

### Heap vs Stack: Avoiding the Oversimplification

A common incorrect explanation is:

> Value types are stored on the stack and reference types are stored on the heap.

A better explanation is:

> Value type variables directly contain their data, while reference type variables contain references to objects. Storage location depends on context and runtime implementation.

Examples:

A value type local variable may be stored on the stack, in a CPU register, or optimized away.

A value type field inside a class is stored inline as part of the class object, which is on the managed heap:

```csharp
public class OrderLine
{
    public decimal Price { get; set; } // decimal is a value type stored inside the OrderLine object
}
```

An array of value types stores the values inline inside the array object, and the array object is on the heap:

```csharp
int[] numbers = new int[100];
```

A boxed value type is stored inside an object on the managed heap:

```csharp
object boxed = 123;
```

For interviews, focus on semantics first: copy behavior, identity, mutation, nullability, and equality. Discuss stack vs heap carefully and avoid absolute statements.

### Garbage Collection and Lifetime

Reference type objects are managed by the garbage collector. When no live references point to an object, the runtime can reclaim it.

```csharp
Customer customer = new Customer();
customer = null;
```

After this assignment, the object may be eligible for garbage collection if nothing else references it.

Value types do not have independent object identity unless boxed. Their lifetime depends on where they are stored:

- local variable
- field inside a class
- element inside an array
- field inside another struct
- boxed object

This affects performance and memory behavior, but application code should normally focus on clear design first. Prematurely converting classes to structs for performance can introduce bugs and often does not improve performance.

### `ref struct`, `Span<T>`, and Stack-Only Types

Some value types have special restrictions. A `ref struct` is a stack-only type that cannot escape to the managed heap.

Common examples include:

- `Span<T>`
- `ReadOnlySpan<T>`

```csharp
Span<int> numbers = stackalloc int[3];
numbers[0] = 10;
numbers[1] = 20;
numbers[2] = 30;
```

`Span<T>` is designed for high-performance memory access without unnecessary allocations. Because it can point to stack memory or unmanaged memory, the compiler enforces restrictions.

For example, a `Span<T>` cannot be stored in a normal class field:

```csharp
public class InvalidHolder
{
    // This is not allowed:
    // public Span<int> Data;
}
```

This is an advanced topic, but interviewers may ask about it when discussing performance, memory, or modern .NET APIs.

### Generics and Constraints

Generics help write code that works with value types and reference types without unnecessary boxing.

```csharp
public static bool AreEqual<T>(T first, T second)
{
    return EqualityComparer<T>.Default.Equals(first, second);
}
```

Generic constraints can limit type parameters:

```csharp
public class Repository<TEntity>
    where TEntity : class
{
}
```

`class` means the type argument must be a reference type.

```csharp
public readonly struct ResultCode
{
    public int Value { get; init; }
}

public static T CreateDefault<T>()
    where T : struct
{
    return default;
}
```

`struct` means the type argument must be a non-nullable value type.

Nullable-aware constraints also exist:

```csharp
public class NullableAwareRepository<TEntity>
    where TEntity : class?
{
}
```

Generics are important because they preserve type information and avoid many runtime casts and boxing operations.

### Common Mistakes

Common mistakes include:

- saying value types are always on the stack
- saying reference types are always on the heap without explaining the reference variable itself
- using mutable structs for complex state
- using structs for large objects
- assuming `record` always means value type
- assuming `string` is a value type
- forgetting that arrays are reference types
- boxing value types accidentally through `object` or non-generic interfaces
- using `==` without understanding whether it checks value equality or reference equality
- assuming nullable reference types prevent `null` at runtime
- returning or passing large structs by value without considering copy cost
- making structs with invalid or unsafe default states

### Best Practices

Prefer classes for most business entities, services, and mutable objects.

Use structs for small, immutable, self-contained values where value semantics are natural.

Prefer `readonly struct` or `readonly record struct` when designing value types.

Avoid mutable structs unless there is a strong reason and you fully understand the copy behavior.

Implement `IEquatable<T>` for custom structs used in collections or performance-sensitive paths.

Use generics instead of `object` when working with value types to avoid boxing.

Do not optimize around stack vs heap based only on assumptions. Measure performance when it matters.

Use nullable reference types to express intent and catch possible null bugs at compile time.

Be careful with shallow copying in records and reference-type properties.

Design structs so their default value is valid or at least safe to handle.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:value-types-vs-reference-types-beginner-q01 -->
#### Beginner Q01: What is the difference between value types and reference types in C#?

<!-- question-id:value-types-vs-reference-types-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Value types directly contain their data, while reference types contain a reference to an object. When a value type is assigned to another variable, the value is copied. When a reference type is assigned to another variable, the reference is copied, so both variables can point to the same object.

Examples of value types include `int`, `bool`, `decimal`, `DateTime`, `Guid`, `enum`, `struct`, and `record struct`. Examples of reference types include `class`, `record class`, `interface`, `delegate`, `object`, `string`, arrays, and most collections.

The most important difference is behavior. Value types usually represent independent values. Reference types usually represent objects that can have identity and shared mutable state.

##### Key Points to Mention

- Value type variables contain values.
- Reference type variables contain references.
- Value type assignment copies the value.
- Reference type assignment copies the reference.
- Classes are reference types.
- Structs are value types.
- `string` is a reference type even though it behaves value-like.
- Avoid saying only "stack vs heap" as the main explanation.

<!-- question:end:value-types-vs-reference-types-beginner-q01 -->

<!-- question:start:value-types-vs-reference-types-beginner-q02 -->
#### Beginner Q02: Is `string` a value type or a reference type?

<!-- question-id:value-types-vs-reference-types-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`string` is a reference type. However, it behaves like a value in many common scenarios because strings are immutable and the `==` operator compares string contents instead of object references.

For example:

```csharp
string a = "hello";
string b = new string("hello".ToCharArray());

Console.WriteLine(a == b); // True
Console.WriteLine(object.ReferenceEquals(a, b)); // False
```

The two variables contain equal text, but they do not necessarily reference the same object.

##### Key Points to Mention

- `string` is a reference type.
- Strings are immutable.
- `==` compares string content.
- `ReferenceEquals` checks whether both variables refer to the same object.
- Immutability makes strings feel value-like.

<!-- question:end:value-types-vs-reference-types-beginner-q02 -->

<!-- question:start:value-types-vs-reference-types-beginner-q03 -->
#### Beginner Q03: What happens when you assign one class variable to another?

<!-- question-id:value-types-vs-reference-types-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

When you assign one class variable to another, C# copies the reference, not the object. Both variables point to the same object. If the object is mutable and you change it through one variable, the change is visible through the other variable.

```csharp
var customer1 = new Customer { Name = "Alice" };
var customer2 = customer1;

customer2.Name = "Bob";

Console.WriteLine(customer1.Name); // Bob
```

The assignment does not create a deep copy or a new `Customer` object.

##### Key Points to Mention

- Classes are reference types.
- Assignment copies the reference.
- Both variables can point to the same object.
- Mutating the object through one variable affects the shared object.
- Reassigning one variable does not automatically reassign the other variable.

<!-- question:end:value-types-vs-reference-types-beginner-q03 -->

<!-- question:start:value-types-vs-reference-types-beginner-q04 -->
#### Beginner Q04: What happens when you assign one struct variable to another?

<!-- question-id:value-types-vs-reference-types-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

When you assign one struct variable to another, C# copies the struct value. The two variables are independent copies. If the struct is mutable and you change one copy, the other copy is not changed.

```csharp
Point p1 = new Point { X = 1, Y = 2 };
Point p2 = p1;

p2.X = 100;

Console.WriteLine(p1.X); // 1
Console.WriteLine(p2.X); // 100
```

This copy behavior is why mutable structs can be confusing.

##### Key Points to Mention

- Structs are value types.
- Assignment copies the whole value.
- Each variable has its own copy.
- Mutating one copy does not update the other copy.
- Prefer immutable structs to avoid copy-related bugs.

<!-- question:end:value-types-vs-reference-types-beginner-q04 -->

<!-- question:start:value-types-vs-reference-types-beginner-q05 -->
#### Beginner Q05: Can value types be null?

<!-- question-id:value-types-vs-reference-types-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Non-nullable value types cannot be assigned `null`.

```csharp
int number = null; // Not allowed
```

However, nullable value types can represent either a value or no value. They use `Nullable<T>` and are usually written as `T?`.

```csharp
int? number = null;

if (number.HasValue)
{
    Console.WriteLine(number.Value);
}
```

This is different from nullable reference types. `int?` is a real wrapper type, while `string?` is a reference type annotation used by the compiler for nullability analysis.

##### Key Points to Mention

- Normal value types cannot be `null`.
- Nullable value types use `T?`.
- `int?` means `Nullable<int>`.
- Nullable value types have `HasValue` and `Value`.
- Nullable reference types are different from nullable value types.

<!-- question:end:value-types-vs-reference-types-beginner-q05 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:value-types-vs-reference-types-intermediate-q01 -->
#### Intermediate Q01: What is boxing and unboxing?

<!-- question-id:value-types-vs-reference-types-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Boxing is the process of converting a value type to `object` or to an interface type it implements. The runtime wraps the value inside an object. Unboxing extracts the value type back from the boxed object.

```csharp
int number = 42;

object boxed = number;      // Boxing
int unboxed = (int)boxed;   // Unboxing
```

Boxing creates a copy of the value and can allocate memory. It can cause performance problems in tight loops or high-throughput code. Generics are often used to avoid unnecessary boxing.

```csharp
List<int> numbers = new(); // Avoids boxing
ArrayList oldList = new(); // Boxes int values
```

##### Key Points to Mention

- Boxing converts a value type to `object` or interface.
- Unboxing converts the boxed object back to the value type.
- Boxing can allocate and copy.
- Unboxing requires an explicit cast.
- Generics help avoid boxing.
- Boxing can be a performance problem in hot paths.

<!-- question:end:value-types-vs-reference-types-intermediate-q01 -->

<!-- question:start:value-types-vs-reference-types-intermediate-q02 -->
#### Intermediate Q02: Are value types always stored on the stack?

<!-- question-id:value-types-vs-reference-types-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

No. Saying value types are always stored on the stack is an oversimplification. The real difference is semantic: value types directly contain their data and reference types contain references to objects.

A value type local variable may be stored on the stack, in a register, or optimized away. A value type field inside a class is stored inline inside that class object, and the class object is on the managed heap. A value type inside an array is stored inline in the array object, and the array object is on the heap. A boxed value type is stored inside an object on the heap.

Example:

```csharp
public class OrderLine
{
    public decimal Price { get; set; } // decimal is stored inside the OrderLine object
}
```

`decimal` is a value type, but here it is part of a heap-allocated object.

##### Key Points to Mention

- Do not define value types mainly by stack allocation.
- The key difference is value semantics vs reference semantics.
- Value type fields in classes are stored inside the class object.
- Arrays are reference types; their value-type elements are stored inline in the array.
- Boxed value types live inside heap objects.
- Runtime optimizations can change physical storage details.

<!-- question:end:value-types-vs-reference-types-intermediate-q02 -->

<!-- question:start:value-types-vs-reference-types-intermediate-q03 -->
#### Intermediate Q03: How does passing parameters work for value types and reference types?

<!-- question-id:value-types-vs-reference-types-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

By default, C# passes arguments by value. For value types, the method receives a copy of the value. For reference types, the method receives a copy of the reference. This means a method can mutate the object through the copied reference, but it cannot replace the caller's variable unless the parameter is passed with `ref`.

```csharp
static void ChangeName(Customer customer)
{
    customer.Name = "Updated";
}

static void Replace(Customer customer)
{
    customer = new Customer { Name = "New" };
}
```

`ChangeName` modifies the object. `Replace` only reassigns the local parameter.

To replace the caller's variable:

```csharp
static void Replace(ref Customer customer)
{
    customer = new Customer { Name = "New" };
}
```

##### Key Points to Mention

- C# passes arguments by value by default.
- For value types, the value is copied.
- For reference types, the reference is copied.
- A method can mutate the referenced object.
- A method cannot replace the caller's reference unless using `ref`.
- `out` is for assigning a value before returning.
- `in` passes by readonly reference, useful for large structs.

<!-- question:end:value-types-vs-reference-types-intermediate-q03 -->

<!-- question:start:value-types-vs-reference-types-intermediate-q04 -->
#### Intermediate Q04: When should you use a struct instead of a class?

<!-- question-id:value-types-vs-reference-types-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use a struct when the type is small, logically represents a single value, has no important identity, is preferably immutable, and copying is cheap. Good examples include coordinates, ranges, measurements, money values, IDs, and small domain value objects.

Use a class when the type has identity, is large, is mutable, participates in inheritance, represents a service, or should be shared by reference.

A good struct candidate:

```csharp
public readonly record struct Money(decimal Amount, string Currency);
```

A good class candidate:

```csharp
public class BankAccount
{
    public Guid Id { get; init; }
    public decimal Balance { get; private set; }
}
```

A bank account has identity, so a class is usually better.

##### Key Points to Mention

- Structs are best for small immutable values.
- Classes are best for identity and shared mutable state.
- Avoid large structs because copies can be expensive.
- Avoid mutable structs because copy behavior is confusing.
- Use `readonly struct` or `readonly record struct` for value objects.
- Most application objects should usually be classes.

<!-- question:end:value-types-vs-reference-types-intermediate-q04 -->

<!-- question:start:value-types-vs-reference-types-intermediate-q05 -->
#### Intermediate Q05: What is the difference between `record class` and `record struct`?

<!-- question-id:value-types-vs-reference-types-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

A `record class` is a reference type with generated value-based equality and data-focused behavior. A `record struct` is a value type with generated value-based equality and data-focused behavior.

```csharp
public record Person(string FirstName, string LastName); // Reference type

public record struct Point(int X, int Y); // Value type
```

Both records can support concise syntax, generated equality, deconstruction, `ToString`, and `with` expressions. But they still follow their type category.

For a `record class`, assignment copies the reference. For a `record struct`, assignment copies the value.

Also, `with` expressions perform shallow copying. If a record contains reference-type properties, nested objects are not automatically deep-copied.

##### Key Points to Mention

- `record` means `record class` by default.
- `record class` is a reference type.
- `record struct` is a value type.
- Records provide generated value-based equality.
- `with` expressions create shallow copies.
- Records do not automatically guarantee deep immutability.

<!-- question:end:value-types-vs-reference-types-intermediate-q05 -->

<!-- question:start:value-types-vs-reference-types-intermediate-q06 -->
#### Intermediate Q06: How does equality differ for value types and reference types?

<!-- question-id:value-types-vs-reference-types-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

For reference types, default equality is usually reference equality unless the type overrides `Equals`, `GetHashCode`, or operators. Two class instances with the same property values are not equal by default.

```csharp
var a = new Customer { Name = "Alice" };
var b = new Customer { Name = "Alice" };

Console.WriteLine(a.Equals(b)); // Usually false
```

For value types, equality usually compares values. Structs inherit value-based equality from `ValueType`, but for custom structs, especially those used in collections or performance-sensitive code, it is best to implement `IEquatable<T>` and override `GetHashCode`.

Records generate value-based equality by default. This applies to both `record class` and `record struct`.

##### Key Points to Mention

- Classes usually use reference equality by default.
- Structs generally use value-based equality.
- Default struct equality may not be ideal for performance.
- Implement `IEquatable<T>` for custom structs.
- Override `GetHashCode` consistently with `Equals`.
- Records generate value-based equality.
- `record class` is still a reference type despite value-based equality.

<!-- question:end:value-types-vs-reference-types-intermediate-q06 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:value-types-vs-reference-types-advanced-q01 -->
#### Advanced Q01: Why are mutable structs dangerous?

<!-- question-id:value-types-vs-reference-types-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Mutable structs are dangerous because structs are copied by value. Developers may believe they are modifying the original value, but they may only be modifying a copy.

Example:

```csharp
public struct MutablePoint
{
    public int X { get; set; }
    public int Y { get; set; }
}

var points = new List<MutablePoint>
{
    new MutablePoint { X = 1, Y = 2 }
};

var point = points[0];
point.X = 100;

Console.WriteLine(points[0].X); // 1
```

The list returned a copy of the struct. Updating `point` did not update the value inside the list.

Mutable structs can also cause issues with properties, readonly fields, defensive copies, and interface calls. Prefer immutable structs, `readonly struct`, or `readonly record struct`.

##### Key Points to Mention

- Structs are copied by value.
- Mutating a copy does not mutate the original.
- Collections and properties can return struct copies.
- Mutable structs make code harder to reason about.
- `readonly struct` reduces accidental mutation.
- Use classes for mutable objects with identity.
- Use immutable structs for small value objects.

<!-- question:end:value-types-vs-reference-types-advanced-q01 -->

<!-- question:start:value-types-vs-reference-types-advanced-q02 -->
#### Advanced Q02: What are defensive copies, and why do they matter for structs?

<!-- question-id:value-types-vs-reference-types-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

A defensive copy is an extra copy the compiler creates to preserve readonly guarantees. This can happen when calling non-readonly members on a struct stored in a readonly field or passed as an `in` parameter.

For example, if a struct has methods that are not marked as readonly, the compiler may copy the struct before calling the method to ensure the original readonly value is not modified.

```csharp
public struct Measurement
{
    public decimal Value { get; }

    public decimal GetValue() => Value;
}
```

If `Measurement` is large and used through readonly contexts, repeated defensive copies may hurt performance. Using `readonly struct` and readonly members tells the compiler that instance members do not mutate state.

```csharp
public readonly struct Measurement
{
    public decimal Value { get; }

    public Measurement(decimal value)
    {
        Value = value;
    }

    public decimal GetValue() => Value;
}
```

##### Key Points to Mention

- Defensive copies preserve readonly safety.
- They can occur with structs in readonly contexts.
- Large structs are more affected by copy overhead.
- `readonly struct` helps avoid unnecessary defensive copies.
- `readonly` instance members can communicate non-mutating behavior.
- Measure before making performance-driven changes.

<!-- question:end:value-types-vs-reference-types-advanced-q02 -->

<!-- question:start:value-types-vs-reference-types-advanced-q03 -->
#### Advanced Q03: How can boxing affect performance and correctness?

<!-- question-id:value-types-vs-reference-types-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Boxing can affect performance because it may allocate an object and copy the value type into that object. In high-throughput code, tight loops, logging, formatting, non-generic collections, or interface-based calls, repeated boxing can increase allocations and garbage collection pressure.

Boxing can also affect correctness expectations because the boxed value is a separate copy. Mutating the original value type does not change the boxed copy. Also, mutating a boxed struct can be confusing and often does not update the original variable.

Example:

```csharp
int number = 10;
object boxed = number;

number = 20;

Console.WriteLine(boxed);  // 10
Console.WriteLine(number); // 20
```

Use generic APIs, generic collections, and `IEquatable<T>` to reduce boxing.

##### Key Points to Mention

- Boxing can allocate.
- Boxing copies the value.
- It can increase GC pressure.
- It often happens through `object`, non-generic collections, or non-generic interfaces.
- Generic collections avoid boxing for value types.
- Boxed values are separate from the original value.
- Use profiling to confirm boxing issues.

<!-- question:end:value-types-vs-reference-types-advanced-q03 -->

<!-- question:start:value-types-vs-reference-types-advanced-q04 -->
#### Advanced Q04: What is a `ref struct`, and how is it different from a normal struct?

<!-- question-id:value-types-vs-reference-types-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

A `ref struct` is a stack-only value type with special compiler restrictions. It is used for types that must not escape to the managed heap, often because they refer to stack memory or unmanaged memory. Examples include `Span<T>` and `ReadOnlySpan<T>`.

```csharp
Span<int> numbers = stackalloc int[3];
numbers[0] = 10;
```

A `ref struct` cannot be boxed, cannot be stored in normal class fields, cannot be used as an array element type, and has restrictions with lambdas, async methods, iterators, and interfaces depending on the C# version and context.

Normal structs can be fields in classes, boxed to `object`, stored in arrays, and used more freely. `ref struct` is more restricted for memory safety.

##### Key Points to Mention

- `ref struct` is a stack-only value type.
- `Span<T>` and `ReadOnlySpan<T>` are common examples.
- It cannot be boxed.
- It cannot be stored in a normal class field.
- Restrictions exist to prevent references from outliving the memory they point to.
- Useful for high-performance memory access.
- More advanced than normal struct usage.

<!-- question:end:value-types-vs-reference-types-advanced-q04 -->

<!-- question:start:value-types-vs-reference-types-advanced-q05 -->
#### Advanced Q05: How do nullable reference types differ from nullable value types?

<!-- question-id:value-types-vs-reference-types-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Nullable value types and nullable reference types are different features.

A nullable value type such as `int?` is shorthand for `Nullable<int>`. It is a real value type wrapper that can represent either a value or no value.

```csharp
int? number = null;

Console.WriteLine(number.HasValue); // False
```

A nullable reference type such as `string?` is still the same underlying runtime reference type as `string`. The annotation tells the compiler that `null` is expected or allowed. It enables static analysis warnings, but it does not prevent `null` at runtime.

```csharp
string? name = null;
```

So `int?` changes the type to `Nullable<int>`, while `string?` changes the compiler's nullability interpretation.

##### Key Points to Mention

- `int?` means `Nullable<int>`.
- Nullable value types are real wrapper structs.
- `string?` is still a `string` reference at runtime.
- Nullable reference types are compile-time annotations and warnings.
- Nullable reference types do not guarantee no nulls at runtime.
- Both features improve expressiveness but work differently.

<!-- question:end:value-types-vs-reference-types-advanced-q05 -->

<!-- question:start:value-types-vs-reference-types-advanced-q06 -->
#### Advanced Q06: How would you design a high-quality value object in C#?

<!-- question-id:value-types-vs-reference-types-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

A high-quality value object should be immutable, have clear value-based equality, validate its invariants, have a safe default-state strategy, and avoid unnecessary allocation or copying.

For a small value object, a `readonly record struct` can be a good option:

```csharp
public readonly record struct EmailAddress
{
    public EmailAddress(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Email is required.", nameof(value));
        }

        Value = value;
    }

    public string Value { get; }

    public override string ToString() => Value;
}
```

However, default structs can still exist:

```csharp
var email = default(EmailAddress);
```

So the type must either tolerate the default state or guard against it when used. If the value object is large, contains complex behavior, or should not have a default invalid state, a class may be better.

##### Key Points to Mention

- Prefer immutability.
- Use value-based equality.
- Validate invariants.
- Consider `readonly record struct` for small values.
- Consider class for complex or large values.
- Remember that `default(T)` can create a struct without calling custom validation.
- Avoid mutable reference-type fields inside value objects unless carefully controlled.

<!-- question:end:value-types-vs-reference-types-advanced-q06 -->

<!-- question:start:value-types-vs-reference-types-advanced-q07 -->
#### Advanced Q07: How do value types and reference types affect API design?

<!-- question-id:value-types-vs-reference-types-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

The choice affects how API consumers think about ownership, identity, mutation, equality, copying, and performance.

Use reference types when the API exposes entities, services, shared state, dependency-injected objects, or objects with identity. Consumers expect changes to the object to be visible through all references.

Use value types when the API exposes small, immutable values that should be copied safely and compared by value. Consumers expect each value to be independent.

Bad API design can surprise consumers. For example, a large mutable struct returned from a property can cause copy-related bugs. A class used for a small immutable value may create unnecessary allocations. A record class with mutable list properties may look immutable but still expose mutable nested state.

Good API design makes the semantic intent clear.

##### Key Points to Mention

- Type category communicates intent.
- Classes are good for identity and shared behavior.
- Structs are good for small independent values.
- Mutability should be explicit and controlled.
- Records help with data-centric models but do not guarantee deep immutability.
- Large structs can make APIs slower or confusing.
- API design should prioritize correctness and clarity before micro-optimization.

<!-- question:end:value-types-vs-reference-types-advanced-q07 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
