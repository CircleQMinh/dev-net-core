---
id: pattern-matching-in-csharp
topic: Modern C# patterns
subtopic: Pattern Matching in C#
category: .NET
---

## Overview

Pattern matching in C# is a language feature that lets you test whether a value has a specific shape, type, value, or set of properties, and then safely use the matched data. Instead of writing long `if` statements, repeated casts, nested null checks, or fragile conditional logic, pattern matching gives you a concise and expressive way to describe what a value must look like.

Pattern matching is commonly used with:

- `is` expressions
- `switch` statements
- `switch` expressions
- type checks and safe casts
- null checks
- enum and constant matching
- validation logic
- DTO and request inspection
- domain model rules
- recursive object checks
- tuple and record deconstruction
- list or array shape checks

It matters because modern C# code often deals with data from many sources: API requests, database records, messages, commands, background jobs, external integrations, and domain objects. Pattern matching helps make that decision logic easier to read, safer to maintain, and less error-prone.

For interviews, pattern matching is important because it tests several practical skills at once: understanding of C# syntax, type safety, nullable handling, control flow, switch expressions, records, deconstruction, clean conditional logic, and when pattern matching is better or worse than polymorphism.

## Core Concepts

### What Pattern Matching Means

Pattern matching means comparing an input value against a pattern. A pattern describes the expected form of the value.

A pattern can check things such as:

- whether a value is `null` or not `null`
- whether a value is a specific type
- whether a value equals a constant
- whether a number is inside a range
- whether an object has specific property values
- whether a tuple or record has specific positional values
- whether an array or list has a specific structure
- whether several conditions are true using `and`, `or`, and `not`

Simple example:

```csharp
object value = "Hello";

if (value is string text)
{
    Console.WriteLine(text.ToUpperInvariant());
}
```

The expression `value is string text` checks whether `value` is a `string`. If the match succeeds, C# assigns the matched value to the variable `text`.

This is cleaner and safer than the older style:

```csharp
object value = "Hello";

if (value is string)
{
    string text = (string)value;
    Console.WriteLine(text.ToUpperInvariant());
}
```

### Pattern Matching Constructs

C# pattern matching is mainly used in three places.

#### `is` Expression

The `is` expression checks whether a value matches a pattern.

```csharp
public static string Describe(object? input)
{
    if (input is null)
    {
        return "No value";
    }

    if (input is int number)
    {
        return $"Integer: {number}";
    }

    if (input is string text)
    {
        return $"Text: {text}";
    }

    return "Unknown value";
}
```

The `is` expression is commonly used for safe type checks, null checks, and simple conditional branching.

#### `switch` Statement

The `switch` statement can use patterns in `case` labels.

```csharp
public static void PrintResult(object? result)
{
    switch (result)
    {
        case null:
            Console.WriteLine("No result");
            break;

        case int number when number > 0:
            Console.WriteLine("Positive number");
            break;

        case int number:
            Console.WriteLine($"Number: {number}");
            break;

        case string text:
            Console.WriteLine($"Text: {text}");
            break;

        default:
            Console.WriteLine("Unsupported result");
            break;
    }
}
```

A `switch` statement is useful when each branch performs multiple statements or side effects.

#### `switch` Expression

A `switch` expression returns a value based on the first matching pattern.

```csharp
public static string GetPriorityLabel(int priority) => priority switch
{
    1 => "Low",
    2 => "Medium",
    3 => "High",
    >= 4 => "Critical",
    _ => "Unknown"
};
```

A `switch` expression is usually preferred when the goal is to map one value to another value.

### Declaration Patterns and Type Patterns

A declaration pattern checks the runtime type of a value and declares a new variable when the match succeeds.

```csharp
public static decimal CalculateDiscount(object customer)
{
    if (customer is PremiumCustomer premiumCustomer)
    {
        return premiumCustomer.TotalSpent > 10_000 ? 0.15m : 0.10m;
    }

    return 0.00m;
}
```

A type pattern checks the runtime type without declaring a variable.

```csharp
public static bool IsSupportedCustomer(object customer)
{
    return customer is PremiumCustomer or StandardCustomer;
}
```

Use declaration patterns when you need to use the matched value. Use type patterns when you only need to check the type.

### Constant Patterns and Null Checks

A constant pattern checks whether a value equals a constant.

```csharp
public static string GetStatusMessage(int statusCode) => statusCode switch
{
    200 => "OK",
    400 => "Bad Request",
    401 => "Unauthorized",
    404 => "Not Found",
    500 => "Server Error",
    _ => "Unknown Status"
};
```

A common constant pattern is `null`.

```csharp
if (customer is null)
{
    throw new ArgumentNullException(nameof(customer));
}
```

For null checks, `is null` and `is not null` are often preferred because they express intent clearly and are not affected by overloaded equality operators.

```csharp
if (customer is not null)
{
    Console.WriteLine(customer.Name);
}
```

### Relational Patterns

Relational patterns compare a value with a constant using relational operators such as `<`, `<=`, `>`, and `>=`.

```csharp
public static string GetTemperatureDescription(decimal temperature) => temperature switch
{
    < 0 => "Freezing",
    >= 0 and < 20 => "Cold",
    >= 20 and < 30 => "Warm",
    >= 30 => "Hot"
};
```

Relational patterns are useful for range-based decisions, such as:

- age groups
- score ranges
- tax brackets
- retry counts
- priority levels
- validation thresholds

### Logical Patterns: `and`, `or`, and `not`

Logical patterns combine multiple patterns.

```csharp
public static bool IsValidPercentage(int value)
{
    return value is >= 0 and <= 100;
}
```

The `or` pattern matches when any subpattern matches.

```csharp
public static bool IsWeekend(DayOfWeek day)
{
    return day is DayOfWeek.Saturday or DayOfWeek.Sunday;
}
```

The `not` pattern negates another pattern.

```csharp
public static bool HasValue(string? text)
{
    return text is not null;
}
```

Logical patterns make conditions more readable when they describe the shape of the data.

Compare this:

```csharp
if (age >= 18 && age <= 65)
{
    Console.WriteLine("Working age");
}
```

With this:

```csharp
if (age is >= 18 and <= 65)
{
    Console.WriteLine("Working age");
}
```

Both are valid. Pattern matching can be clearer when the expression is part of a larger pattern-based rule.

### Property Patterns

Property patterns check properties or fields of an object.

```csharp
public sealed class Order
{
    public int Id { get; init; }
    public decimal Total { get; init; }
    public bool IsPaid { get; init; }
    public string Country { get; init; } = string.Empty;
}

public static bool CanShip(Order order)
{
    return order is { IsPaid: true, Total: > 0, Country: not "" };
}
```

The pattern `{ IsPaid: true, Total: > 0, Country: not "" }` means:

- the object is not `null`
- `IsPaid` must be `true`
- `Total` must be greater than `0`
- `Country` must not be an empty string

Property patterns are especially useful for DTO validation, domain rules, and branching based on object state.

Example with nested properties:

```csharp
public sealed class Customer
{
    public string Name { get; init; } = string.Empty;
    public Address? Address { get; init; }
}

public sealed class Address
{
    public string Country { get; init; } = string.Empty;
    public string City { get; init; } = string.Empty;
}

public static bool IsCustomerInVietnam(Customer customer)
{
    return customer is { Address: { Country: "VN" } };
}
```

This avoids a manual null check like:

```csharp
customer.Address != null && customer.Address.Country == "VN"
```

### Extended Property Patterns

Extended property patterns allow a more compact syntax for nested properties.

```csharp
public static bool IsCustomerInVietnam(Customer customer)
{
    return customer is { Address.Country: "VN" };
}
```

This is often easier to read when checking one or two nested values.

### Positional Patterns

Positional patterns match values returned by `Deconstruct`.

Records automatically support deconstruction for primary constructor parameters.

```csharp
public readonly record struct Money(decimal Amount, string Currency);

public static string Describe(Money money) => money switch
{
    (0, _) => "No money",
    (> 0, "USD") => "Positive amount in USD",
    (> 0, "VND") => "Positive amount in VND",
    (< 0, _) => "Negative amount",
    _ => "Other money value"
};
```

The pattern `(> 0, "USD")` checks the first positional value and the second positional value.

Positional patterns are useful when working with:

- records
- tuples
- small value objects
- domain values with clear positional meaning
- types that implement `Deconstruct`

Example with a custom class:

```csharp
public sealed class Point
{
    public int X { get; }
    public int Y { get; }

    public Point(int x, int y)
    {
        X = x;
        Y = y;
    }

    public void Deconstruct(out int x, out int y)
    {
        x = X;
        y = Y;
    }
}

public static string Describe(Point point) => point switch
{
    (0, 0) => "Origin",
    (0, _) => "On Y axis",
    (_, 0) => "On X axis",
    (> 0, > 0) => "First quadrant",
    _ => "Other point"
};
```

### Tuple Patterns

Tuple patterns are useful when a decision depends on multiple values.

```csharp
public static decimal GetShippingCost(bool isPremiumCustomer, decimal orderTotal, string country)
{
    return (isPremiumCustomer, orderTotal, country) switch
    {
        (true, >= 100, _) => 0m,
        (_, >= 200, "VN") => 0m,
        (_, < 50, "US") => 15m,
        (_, _, "VN") => 5m,
        _ => 20m
    };
}
```

This can be cleaner than nested `if` statements when multiple inputs determine a result.

However, tuple patterns can become hard to read if too many values are involved. For complex business rules, consider extracting named methods or using a dedicated rule object.

### List Patterns and Slice Patterns

List patterns match the structure of arrays, spans, or list-like values.

```csharp
public static string ParseCommand(string[] args) => args switch
{
    ["run"] => "Run default command",
    ["run", var jobName] => $"Run job: {jobName}",
    ["copy", var source, var destination] => $"Copy from {source} to {destination}",
    ["delete", .. var targets] => $"Delete {targets.Length} target(s)",
    [] => "No command",
    _ => "Unknown command"
};
```

In this example:

- `["run"]` matches exactly one item
- `["run", var jobName]` matches exactly two items
- `["copy", var source, var destination]` matches exactly three items
- `["delete", .. var targets]` matches a command followed by zero or more remaining items
- `[]` matches an empty list

List patterns are useful for command-line arguments, token parsing, small protocol messages, and simple sequence shape checks.

They are not a replacement for full parsing logic when the input grammar is complex.

### The `var` Pattern

The `var` pattern matches any value and assigns it to a variable.

```csharp
public static string DescribeLength(string? text) => text switch
{
    null => "No text",
    var value when value.Length == 0 => "Empty text",
    var value when value.Length < 10 => "Short text",
    var value => $"Long text with {value.Length} characters"
};
```

The `var` pattern is useful when you want to capture a value inside a switch arm, especially with a `when` guard.

### The Discard Pattern `_`

The discard pattern `_` matches anything and ignores the value.

```csharp
public static string GetRoleLabel(string role) => role switch
{
    "Admin" => "Administrator",
    "User" => "Standard User",
    _ => "Unknown Role"
};
```

The discard pattern is often used as the final fallback case in a `switch` expression.

Use it carefully. A discard arm can hide missing cases if you use it too early or too broadly.

### `when` Guards

A `when` guard adds an extra condition to a pattern arm.

```csharp
public static string DescribeCustomer(Customer customer) => customer switch
{
    { Name: "" } => "Missing name",
    { Address.Country: "VN" } when customer.Name.StartsWith("A") => "Vietnam customer with name starting with A",
    { Address.Country: "VN" } => "Vietnam customer",
    _ => "Other customer"
};
```

A pattern first checks the shape of the value. The `when` guard then checks an additional Boolean condition.

Use `when` guards when the rule cannot be expressed cleanly as a pattern alone.

### Ordering and First Match Wins

Pattern matching checks switch arms in order. The first matching arm wins.

```csharp
public static string DescribeNumber(int value) => value switch
{
    > 0 => "Positive",
    > 10 => "Greater than ten",
    _ => "Other"
};
```

The `> 10` arm is unreachable because every value greater than `10` already matches `> 0`.

Correct version:

```csharp
public static string DescribeNumber(int value) => value switch
{
    > 10 => "Greater than ten",
    > 0 => "Positive",
    _ => "Other"
};
```

Put more specific patterns before more general patterns.

### Exhaustiveness and Fallback Cases

A `switch` expression should handle all expected input cases.

```csharp
public enum PaymentStatus
{
    Pending,
    Paid,
    Failed,
    Refunded
}

public static string GetPaymentMessage(PaymentStatus status) => status switch
{
    PaymentStatus.Pending => "Payment is pending",
    PaymentStatus.Paid => "Payment completed",
    PaymentStatus.Failed => "Payment failed",
    PaymentStatus.Refunded => "Payment refunded",
    _ => "Unknown payment status"
};
```

The final `_` arm handles unexpected values. This is especially useful for enums because an enum variable can contain a numeric value that is not defined by the enum members.

If a `switch` expression does not match any arm at runtime, an exception is thrown. In practical code, use a fallback arm unless you intentionally want unhandled inputs to fail.

### Pattern Variables and Scope

A variable declared in a pattern is only definitely assigned when the pattern matches.

```csharp
object value = "abc";

if (value is string text)
{
    Console.WriteLine(text.Length);
}

// text is not available here
```

Pattern variables help reduce unsafe casts and make code more readable.

Another common example:

```csharp
if (request is { CustomerId: > 0 } validRequest)
{
    Console.WriteLine(validRequest.CustomerId);
}
```

Here, `validRequest` is only available inside the `if` block where the pattern has matched.

### Pattern Matching with Nullable Reference Types

Pattern matching works well with nullable reference types.

```csharp
public static int GetNameLength(Customer? customer)
{
    return customer is { Name: not null } ? customer.Name.Length : 0;
}
```

The pattern checks that:

- `customer` is not `null`
- `customer.Name` is not `null`

This can make null handling more compact.

However, do not make patterns so dense that they become difficult to understand. Sometimes an explicit guard clause is clearer.

```csharp
public static int GetNameLength(Customer? customer)
{
    if (customer is null || customer.Name is null)
    {
        return 0;
    }

    return customer.Name.Length;
}
```

### Pattern Matching vs `if` Statements

Pattern matching does not replace all `if` statements.

Use pattern matching when the condition describes the shape, type, or value pattern of data.

```csharp
return order switch
{
    { IsPaid: false } => "Order is not paid",
    { Total: <= 0 } => "Invalid total",
    { Country: "VN" } => "Domestic order",
    _ => "International order"
};
```

Use normal `if` statements when the logic is procedural, step-by-step, or depends on multiple side effects.

```csharp
if (!cache.TryGetValue(key, out var value))
{
    value = LoadFromDatabase(key);
    cache[key] = value;
}
```

This is not a good pattern matching scenario because the logic is about a workflow, not just matching a value.

### Pattern Matching vs Polymorphism

Pattern matching is useful when branching on external data, DTOs, primitive values, tuples, or object shapes.

Polymorphism is often better when behavior naturally belongs inside a type hierarchy.

Pattern matching example:

```csharp
public static decimal CalculateArea(object shape) => shape switch
{
    Circle circle => Math.PI * circle.Radius * circle.Radius,
    Rectangle rectangle => rectangle.Width * rectangle.Height,
    _ => throw new NotSupportedException("Unsupported shape")
};
```

This can be acceptable when the shape types are external or cannot be changed.

Polymorphic version:

```csharp
public abstract class Shape
{
    public abstract decimal CalculateArea();
}

public sealed class Rectangle : Shape
{
    public decimal Width { get; init; }
    public decimal Height { get; init; }

    public override decimal CalculateArea() => Width * Height;
}
```

Polymorphism is often better when:

- each type owns its behavior
- new behavior is rare but new types are common
- you want to avoid central switch statements
- the domain model should enforce behavior

Pattern matching is often better when:

- the data shape is simple
- the input comes from outside the domain
- the logic is a small mapping or classification
- creating a class hierarchy would be overengineering

### Pattern Matching with Records

Records work naturally with pattern matching because they are often used as immutable data carriers.

```csharp
public abstract record Command;
public sealed record CreateOrder(int CustomerId, decimal Total) : Command;
public sealed record CancelOrder(int OrderId) : Command;

public static string Handle(Command command) => command switch
{
    CreateOrder { CustomerId: <= 0 } => "Invalid customer",
    CreateOrder { Total: <= 0 } => "Invalid order total",
    CreateOrder create => $"Create order for customer {create.CustomerId}",
    CancelOrder { OrderId: <= 0 } => "Invalid order id",
    CancelOrder cancel => $"Cancel order {cancel.OrderId}",
    _ => "Unknown command"
};
```

This is common in command handling, message processing, and domain workflows.

### Pattern Matching in ASP.NET Core and APIs

Pattern matching is useful in Web API code when mapping domain results to HTTP responses.

```csharp
public abstract record Result;
public sealed record Success(object Value) : Result;
public sealed record NotFound(string Message) : Result;
public sealed record ValidationFailed(IDictionary<string, string[]> Errors) : Result;
public sealed record UnauthorizedResult : Result;

public static IResult ToHttpResult(Result result) => result switch
{
    Success success => Results.Ok(success.Value),
    NotFound notFound => Results.NotFound(new { notFound.Message }),
    ValidationFailed validation => Results.ValidationProblem(validation.Errors),
    UnauthorizedResult => Results.Unauthorized(),
    _ => Results.Problem("Unexpected result")
};
```

This keeps response mapping readable and centralized.

### Common Mistakes

A common mistake is making switch expressions too large.

```csharp
// Hard to maintain if it grows too much
var result = input switch
{
    // many unrelated business rules here
};
```

If a switch expression becomes too long, split the logic into smaller methods, use polymorphism, or introduce a strategy/rule object.

Another mistake is using `_` too early.

```csharp
public static string Describe(int value) => value switch
{
    _ => "Any value",
    > 10 => "Greater than ten"
};
```

The second arm can never be reached because `_` matches everything.

Another mistake is assuming pattern matching always makes code better. Pattern matching improves readability only when the pattern itself is easy to understand.

### Best Practices

Use pattern matching to make value-based and shape-based logic easier to read.

Prefer `is null` and `is not null` for clear null checks.

Use `switch` expressions for simple mappings that return a value.

Use `switch` statements when each branch needs multiple statements.

Put specific patterns before general patterns.

Include a fallback arm for unexpected input unless failing fast is intentional.

Avoid hiding complex business workflows inside a single large switch expression.

Use property patterns for DTO validation and state checks.

Use positional patterns when the positional meaning is obvious.

Use named property patterns instead of positional patterns when readability is more important than brevity.

Use list patterns for small sequence shape checks, not full parser logic.

Consider polymorphism or strategy patterns when behavior belongs to types rather than to a central decision block.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:pattern-matching-in-csharp-beginner-q01 -->
#### Beginner Q01: What is pattern matching in C#?
<!-- question-id:pattern-matching-in-csharp-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Pattern matching in C# is a feature that lets you test whether a value matches a specific pattern, such as a type, constant, property shape, range, tuple shape, or list structure. When a match succeeds, C# can also safely assign parts of the matched value to variables.

It is commonly used with `is`, `switch` statements, and `switch` expressions. It helps replace repetitive type checks, casts, null checks, and nested conditionals with more readable code.

Example:

```csharp
if (value is string text)
{
    Console.WriteLine(text.Length);
}
```

This checks whether `value` is a `string` and, if true, assigns it to `text`.

##### Key Points to Mention

- Tests a value against a pattern
- Works with `is`, `switch` statements, and `switch` expressions
- Can check type, value, range, properties, tuples, records, and lists
- Reduces manual casts and nested conditionals
- Improves readability when used for shape-based logic

<!-- question:end:pattern-matching-in-csharp-beginner-q01 -->

<!-- question:start:pattern-matching-in-csharp-beginner-q02 -->
#### Beginner Q02: What is the difference between `is string` and `is string text`?
<!-- question-id:pattern-matching-in-csharp-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`is string` checks whether a value is a string but does not create a variable. `is string text` checks whether the value is a string and, if the match succeeds, assigns the value to a new variable named `text`.

Example:

```csharp
if (value is string)
{
    Console.WriteLine("Value is a string");
}

if (value is string text)
{
    Console.WriteLine(text.Length);
}
```

Use `is string` when you only need to check the type. Use `is string text` when you need to use the matched value as a string.

##### Key Points to Mention

- `is string` is a type pattern
- `is string text` is a declaration pattern
- Declaration patterns both check and assign
- Avoids explicit casting
- The declared variable is only safely available where the pattern matched

<!-- question:end:pattern-matching-in-csharp-beginner-q02 -->

<!-- question:start:pattern-matching-in-csharp-beginner-q03 -->
#### Beginner Q03: How do you check for `null` using pattern matching?
<!-- question-id:pattern-matching-in-csharp-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Use `is null` to check for null and `is not null` to check for non-null.

```csharp
if (customer is null)
{
    throw new ArgumentNullException(nameof(customer));
}

if (customer is not null)
{
    Console.WriteLine(customer.Name);
}
```

These forms are clear and are commonly preferred for null checks because they express the intention directly.

##### Key Points to Mention

- Use `is null` for null checks
- Use `is not null` for non-null checks
- Clearer than some equality comparisons
- Useful with nullable reference types
- Can be combined with property patterns

<!-- question:end:pattern-matching-in-csharp-beginner-q03 -->

<!-- question:start:pattern-matching-in-csharp-beginner-q04 -->
#### Beginner Q04: What is a switch expression in C#?
<!-- question-id:pattern-matching-in-csharp-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A `switch` expression is a concise way to choose and return a value based on pattern matching. Unlike a traditional `switch` statement, it is an expression, so it produces a result.

```csharp
public static string GetStatusText(int statusCode) => statusCode switch
{
    200 => "OK",
    400 => "Bad Request",
    404 => "Not Found",
    >= 500 => "Server Error",
    _ => "Unknown"
};
```

It is commonly used for mapping values, classifying inputs, or returning different results based on object state.

##### Key Points to Mention

- A `switch` expression returns a value
- Uses `=>` arms
- Often cleaner than a switch statement for mappings
- The first matching arm wins
- `_` is commonly used as a fallback

<!-- question:end:pattern-matching-in-csharp-beginner-q04 -->

<!-- question:start:pattern-matching-in-csharp-beginner-q05 -->
#### Beginner Q05: What does the discard pattern `_` do?
<!-- question-id:pattern-matching-in-csharp-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

The discard pattern `_` matches any value and ignores it. It is commonly used as the final fallback arm in a switch expression or switch statement.

```csharp
public static string GetRoleLabel(string role) => role switch
{
    "Admin" => "Administrator",
    "User" => "Standard User",
    _ => "Unknown Role"
};
```

It should usually be placed last because it matches everything. If placed too early, later arms may become unreachable.

##### Key Points to Mention

- `_` matches anything
- Usually used as a fallback
- Should normally be placed last
- Can hide missing cases if used too broadly
- Helps make switch expressions exhaustive

<!-- question:end:pattern-matching-in-csharp-beginner-q05 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:pattern-matching-in-csharp-intermediate-q01 -->
#### Intermediate Q01: What are property patterns and when would you use them?
<!-- question-id:pattern-matching-in-csharp-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Property patterns match an object based on the values of its properties or fields. They are useful when decision logic depends on the state or shape of an object.

```csharp
public static bool CanShip(Order order)
{
    return order is { IsPaid: true, Total: > 0, Country: not "" };
}
```

This checks that the order is paid, has a positive total, and has a non-empty country. Property patterns are useful for DTO validation, request handling, domain rules, and API result mapping.

They can also be nested:

```csharp
customer is { Address: { Country: "VN" } }
```

Or written with extended property patterns:

```csharp
customer is { Address.Country: "VN" }
```

##### Key Points to Mention

- Match objects by property values
- Useful for state-based logic
- Can include nested patterns
- Can combine with relational and logical patterns
- Avoid making property patterns too dense or unreadable

<!-- question:end:pattern-matching-in-csharp-intermediate-q01 -->

<!-- question:start:pattern-matching-in-csharp-intermediate-q02 -->
#### Intermediate Q02: What are relational and logical patterns?
<!-- question-id:pattern-matching-in-csharp-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Relational patterns compare a value with a constant using operators such as `<`, `<=`, `>`, and `>=`. Logical patterns combine patterns using `and`, `or`, and `not`.

```csharp
public static string GetAgeGroup(int age) => age switch
{
    < 0 => "Invalid",
    >= 0 and < 13 => "Child",
    >= 13 and < 20 => "Teenager",
    >= 20 and < 65 => "Adult",
    >= 65 => "Senior"
};
```

Relational and logical patterns are useful for ranges, validation rules, status classifications, and readable conditional logic.

##### Key Points to Mention

- Relational patterns use `<`, `<=`, `>`, `>=`
- Logical patterns use `and`, `or`, `not`
- Very useful for range checks
- Can be combined with switch expressions
- More readable than complex Boolean conditions in some cases

<!-- question:end:pattern-matching-in-csharp-intermediate-q02 -->

<!-- question:start:pattern-matching-in-csharp-intermediate-q03 -->
#### Intermediate Q03: What are positional patterns?
<!-- question-id:pattern-matching-in-csharp-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Positional patterns match values based on positions returned by `Deconstruct`. Records and tuples work naturally with positional patterns.

```csharp
public readonly record struct Point(int X, int Y);

public static string Describe(Point point) => point switch
{
    (0, 0) => "Origin",
    (0, _) => "On Y axis",
    (_, 0) => "On X axis",
    (> 0, > 0) => "First quadrant",
    _ => "Other point"
};
```

They are useful when the positional meaning is obvious. For complex objects, property patterns are often clearer because they include property names.

##### Key Points to Mention

- Use values produced by `Deconstruct`
- Common with records and tuples
- Good for small value objects
- Can reduce boilerplate
- Property patterns may be clearer for complex objects

<!-- question:end:pattern-matching-in-csharp-intermediate-q03 -->

<!-- question:start:pattern-matching-in-csharp-intermediate-q04 -->
#### Intermediate Q04: What are list patterns in C#?
<!-- question-id:pattern-matching-in-csharp-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

List patterns match the structure of a sequence, such as an array or list-like value. They can check exact elements, capture values, match empty sequences, or use a slice pattern to match remaining elements.

```csharp
public static string ParseCommand(string[] args) => args switch
{
    ["run"] => "Run default command",
    ["run", var jobName] => $"Run job: {jobName}",
    ["copy", var source, var destination] => $"Copy {source} to {destination}",
    ["delete", .. var targets] => $"Delete {targets.Length} target(s)",
    [] => "No command",
    _ => "Unknown command"
};
```

List patterns are useful for command-line arguments, tokens, simple protocol messages, or small sequence shape checks.

##### Key Points to Mention

- Match sequence shape
- Can match exact elements
- `..` is a slice pattern
- Useful for small parsing and command scenarios
- Not a replacement for full parsing logic

<!-- question:end:pattern-matching-in-csharp-intermediate-q04 -->

<!-- question:start:pattern-matching-in-csharp-intermediate-q05 -->
#### Intermediate Q05: How does ordering affect pattern matching in a switch expression?
<!-- question-id:pattern-matching-in-csharp-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Switch arms are evaluated in order, and the first matching arm wins. This means more specific patterns should be placed before more general patterns.

Incorrect example:

```csharp
public static string Describe(int value) => value switch
{
    > 0 => "Positive",
    > 10 => "Greater than ten",
    _ => "Other"
};
```

The `> 10` arm is unreachable because values greater than `10` already match `> 0`.

Correct version:

```csharp
public static string Describe(int value) => value switch
{
    > 10 => "Greater than ten",
    > 0 => "Positive",
    _ => "Other"
};
```

##### Key Points to Mention

- First matching arm wins
- Put specific patterns before general patterns
- `_` should usually be last
- Bad ordering can cause unreachable arms
- Ordering is important for correctness and readability

<!-- question:end:pattern-matching-in-csharp-intermediate-q05 -->

<!-- question:start:pattern-matching-in-csharp-intermediate-q06 -->
#### Intermediate Q06: What is a `when` guard in pattern matching?
<!-- question-id:pattern-matching-in-csharp-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

A `when` guard adds an extra Boolean condition to a pattern arm. The pattern must match first, and then the `when` condition must also be true.

```csharp
public static string DescribeOrder(Order order) => order switch
{
    { IsPaid: false } => "Not paid",
    { Total: > 1000 } when order.Country == "VN" => "Large domestic order",
    { Total: > 1000 } => "Large international order",
    _ => "Normal order"
};
```

Use `when` when a condition is difficult or awkward to express as a pure pattern.

##### Key Points to Mention

- Adds an extra Boolean condition
- Pattern match happens before the guard
- Useful for complex checks
- Can improve readability when used sparingly
- Too many guards may indicate logic should be refactored

<!-- question:end:pattern-matching-in-csharp-intermediate-q06 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:pattern-matching-in-csharp-advanced-q01 -->
#### Advanced Q01: When should you use pattern matching instead of polymorphism?
<!-- question-id:pattern-matching-in-csharp-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use pattern matching when the logic is mainly about inspecting external data, DTOs, primitive values, tuples, records, or simple object shapes. It is very useful for mapping, validation, classification, and API result handling.

Use polymorphism when behavior naturally belongs inside a type hierarchy. If each type should own its behavior, an abstract method or interface implementation is usually cleaner than a central switch.

Pattern matching example:

```csharp
public static decimal CalculateArea(object shape) => shape switch
{
    Circle circle => Math.PI * circle.Radius * circle.Radius,
    Rectangle rectangle => rectangle.Width * rectangle.Height,
    _ => throw new NotSupportedException()
};
```

This may be acceptable if the types are external or simple. But if `Shape` is your domain model, polymorphism may be better:

```csharp
public abstract class Shape
{
    public abstract decimal CalculateArea();
}
```

The decision depends on ownership, extensibility, and where behavior belongs.

##### Key Points to Mention

- Pattern matching is good for data inspection and mapping
- Polymorphism is good when behavior belongs to types
- Avoid huge central switches for domain behavior
- Pattern matching can be better for external or immutable data models
- This is a design trade-off, not just syntax preference

<!-- question:end:pattern-matching-in-csharp-advanced-q01 -->

<!-- question:start:pattern-matching-in-csharp-advanced-q02 -->
#### Advanced Q02: What happens if a switch expression is not exhaustive?
<!-- question-id:pattern-matching-in-csharp-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

If a switch expression does not handle all possible input values and no arm matches at runtime, an exception is thrown. The compiler can warn about some non-exhaustive switch expressions, but it cannot always prove all cases, especially with complex patterns.

Example:

```csharp
public static string GetStatus(PaymentStatus status) => status switch
{
    PaymentStatus.Pending => "Pending",
    PaymentStatus.Paid => "Paid"
};
```

If `status` is `Failed`, `Refunded`, or an undefined enum value, the switch expression may fail at runtime.

A safer version includes all known values and a fallback:

```csharp
public static string GetStatus(PaymentStatus status) => status switch
{
    PaymentStatus.Pending => "Pending",
    PaymentStatus.Paid => "Paid",
    PaymentStatus.Failed => "Failed",
    PaymentStatus.Refunded => "Refunded",
    _ => "Unknown"
};
```

##### Key Points to Mention

- Switch expressions should handle all expected inputs
- Non-exhaustive switches can fail at runtime
- Compiler warnings help but do not replace careful design
- Use `_` for unexpected values when appropriate
- Enums can contain undefined numeric values

<!-- question:end:pattern-matching-in-csharp-advanced-q02 -->

<!-- question:start:pattern-matching-in-csharp-advanced-q03 -->
#### Advanced Q03: How can pattern matching help with nullable reference types?
<!-- question-id:pattern-matching-in-csharp-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Pattern matching can express null checks and object shape checks in a compact way. With nullable reference types, the compiler can often understand that a value is non-null after a successful pattern match.

```csharp
public static string GetCustomerCountry(Customer? customer)
{
    return customer is { Address.Country: var country and not "" }
        ? country
        : "Unknown";
}
```

This checks that `customer`, `Address`, and `Country` match the required shape. Pattern matching can reduce repetitive null checks, especially with nested properties.

However, dense patterns can become hard to read. For complicated logic, guard clauses may be clearer.

##### Key Points to Mention

- `is null` and `is not null` are clear null checks
- Property patterns can check nested non-null shapes
- Helps reduce repeated `?.` and `!= null` checks
- Works well with nullable reference type analysis
- Do not sacrifice readability for compactness

<!-- question:end:pattern-matching-in-csharp-advanced-q03 -->

<!-- question:start:pattern-matching-in-csharp-advanced-q04 -->
#### Advanced Q04: What are the risks of overusing pattern matching?
<!-- question-id:pattern-matching-in-csharp-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

The main risk is turning pattern matching into a large, centralized decision block that becomes hard to maintain. A very large switch expression can hide business rules, violate separation of concerns, and make it harder to add new behavior safely.

Other risks include:

- placing general patterns before specific patterns
- using `_` too broadly
- writing overly dense nested property patterns
- replacing polymorphism where polymorphism would be clearer
- mixing pattern matching with too many `when` guards
- using list patterns for complex parsing instead of a real parser

Pattern matching is best when it improves clarity. If it makes the code clever but harder to understand, it should be simplified.

##### Key Points to Mention

- Large switch expressions can become maintenance problems
- Pattern matching should not replace good object design
- Readability matters more than compact syntax
- Use helper methods for complex conditions
- Prefer polymorphism or strategies for behavior-heavy branching

<!-- question:end:pattern-matching-in-csharp-advanced-q04 -->

<!-- question:start:pattern-matching-in-csharp-advanced-q05 -->
#### Advanced Q05: How can pattern matching be used in API result mapping?
<!-- question-id:pattern-matching-in-csharp-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Pattern matching is useful for mapping domain results or application results to HTTP responses. This is common in ASP.NET Core applications where handlers return result objects and controllers or endpoints translate those results into response types.

```csharp
public abstract record AppResult;
public sealed record OkResult(object Value) : AppResult;
public sealed record NotFoundResult(string Message) : AppResult;
public sealed record ValidationErrorResult(IDictionary<string, string[]> Errors) : AppResult;

public static IResult ToHttpResult(AppResult result) => result switch
{
    OkResult ok => Results.Ok(ok.Value),
    NotFoundResult notFound => Results.NotFound(new { notFound.Message }),
    ValidationErrorResult validation => Results.ValidationProblem(validation.Errors),
    _ => Results.Problem("Unexpected result")
};
```

This approach keeps the mapping centralized, readable, and type-safe. It works well when application handlers return a small set of known result types.

##### Key Points to Mention

- Good for mapping result objects to HTTP responses
- Works well with records and discriminated-result style models
- Keeps controller or endpoint logic clean
- Add fallback handling for unexpected result types
- Avoid making one mapping switch responsible for unrelated workflows

<!-- question:end:pattern-matching-in-csharp-advanced-q05 -->

<!-- question:start:pattern-matching-in-csharp-advanced-q06 -->
#### Advanced Q06: What performance considerations exist with pattern matching?
<!-- question-id:pattern-matching-in-csharp-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Pattern matching is generally compiled efficiently and should usually be chosen for readability first. In most business applications, the performance difference between pattern matching and equivalent `if` statements is not important.

However, there are practical considerations:

- property patterns may access property getters
- positional patterns may call `Deconstruct`
- list patterns may use length/count and indexing operations
- complex switch expressions can still become expensive if the matched logic is expensive
- repeated pattern checks inside hot loops should be benchmarked if performance matters

The correct interview answer is not that pattern matching is always faster. The correct answer is that it is primarily a readability and correctness feature, and performance-sensitive paths should be measured.

##### Key Points to Mention

- Usually efficient enough for normal application code
- Prefer readability unless profiling shows a problem
- Property and positional patterns can call members
- List patterns inspect sequence structure
- Benchmark hot paths instead of guessing

<!-- question:end:pattern-matching-in-csharp-advanced-q06 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
