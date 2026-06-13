---
id: switch-expressions-in-csharp
topic: Modern C# patterns
subtopic: Switch Expressions in C#
category: .NET
---

## Overview

Switch expressions in C# are a modern, expression-based way to choose and return a value based on pattern matching. They are commonly used when code needs to convert one value into another, classify data, map enum values, handle simple business rules, or replace long `if/else` chains with clearer and more compact logic.

A traditional `switch` statement executes statements. A `switch` expression evaluates to a value. This difference is important because switch expressions are often used directly in assignments, return statements, expression-bodied members, LINQ projections, DTO mapping, validation logic, and domain rule classification.

Switch expressions matter because they make decision logic easier to read when each branch produces a result. They also integrate deeply with C# pattern matching, which means they can match by value, type, property shape, tuple values, relational conditions, list patterns, and more.

For interviews, this topic is important because it tests several practical C# skills at the same time:

- Understanding the difference between expressions and statements
- Knowing modern C# syntax
- Applying pattern matching correctly
- Writing readable conditional logic
- Avoiding null-related and non-exhaustive switch bugs
- Choosing between `switch`, `if/else`, polymorphism, dictionaries, and strategy patterns
- Recognizing when compact syntax improves code and when it hides complexity

A good candidate should be able to explain not only the syntax, but also when switch expressions are appropriate, how arm ordering works, how exhaustive matching works, and how to use patterns without making business rules difficult to maintain.

## Core Concepts

### What a Switch Expression Is

A switch expression evaluates an input expression against multiple arms and returns the value from the first matching arm.

Basic syntax:

```csharp
var result = input switch
{
    pattern1 => value1,
    pattern2 => value2,
    _ => defaultValue
};
```

A switch expression contains:

- An input expression before the `switch` keyword
- One or more switch arms
- A pattern for each arm
- An optional `when` guard
- The `=>` token
- A result expression
- Commas between arms
- A semicolon after the full expression when used as a statement

Example:

```csharp
public enum OrderStatus
{
    Draft,
    Submitted,
    Paid,
    Cancelled
}

public static string GetStatusLabel(OrderStatus status)
{
    return status switch
    {
        OrderStatus.Draft => "Draft",
        OrderStatus.Submitted => "Submitted",
        OrderStatus.Paid => "Paid",
        OrderStatus.Cancelled => "Cancelled",
        _ => "Unknown"
    };
}
```

This is useful because the method clearly says: "given a status, return a label."

### Switch Expression vs Switch Statement

A `switch` statement executes code blocks. A `switch` expression returns a value.

Switch statement example:

```csharp
string label;

switch (status)
{
    case OrderStatus.Draft:
        label = "Draft";
        break;

    case OrderStatus.Paid:
        label = "Paid";
        break;

    default:
        label = "Unknown";
        break;
}
```

Switch expression equivalent:

```csharp
string label = status switch
{
    OrderStatus.Draft => "Draft",
    OrderStatus.Paid => "Paid",
    _ => "Unknown"
};
```

Important differences:

| Feature | Switch Statement | Switch Expression |
|---|---|---|
| Main purpose | Execute statements | Return a value |
| Syntax | `case`, `break`, `default` | patterns, `=>`, `_` |
| Best for | Multiple side effects or complex blocks | Mapping, classification, value selection |
| Fall-through | Controlled with `break`, `goto`, etc. | No fall-through |
| Exhaustiveness | Less expression-focused | More important because a value must be produced |
| Readability | Better for multi-step imperative logic | Better for concise result-producing logic |

Use a switch expression when every branch naturally produces a result. Use a switch statement when each branch performs multiple actions, mutates state, logs several things, calls multiple services, or needs more imperative flow.

### Switch Arms and Evaluation Order

Each branch in a switch expression is called a switch arm.

```csharp
var message = score switch
{
    >= 90 => "Excellent",
    >= 75 => "Good",
    >= 50 => "Pass",
    _ => "Fail"
};
```

Switch arms are evaluated from top to bottom. The first matching arm is selected.

Order matters. For example:

```csharp
var message = score switch
{
    >= 50 => "Pass",
    >= 90 => "Excellent",
    _ => "Fail"
};
```

In this version, `>= 90` is never reached because values greater than or equal to 90 also match `>= 50` first. The compiler can detect some unreachable arms, but developers should still order patterns from most specific to most general.

Best practice:

- Put special cases first
- Put broader cases later
- Put `_` or catch-all cases last
- Avoid overlapping conditions unless the order is intentional and obvious

### The Discard Pattern `_`

The discard pattern `_` matches anything that has not already matched.

```csharp
public static string GetRoleName(string role)
{
    return role switch
    {
        "admin" => "Administrator",
        "manager" => "Manager",
        "user" => "Standard User",
        _ => "Unknown Role"
    };
}
```

The `_` arm is similar to `default` in a traditional switch statement.

It is often used to make the switch expression exhaustive. Without a catch-all arm, a switch expression may fail at runtime if no pattern matches.

### Exhaustiveness and Runtime Exceptions

A switch expression should handle all possible input values. If no arm matches, the runtime throws an exception.

Example of a risky switch expression:

```csharp
public static string GetPriorityLabel(int priority)
{
    return priority switch
    {
        1 => "Low",
        2 => "Medium",
        3 => "High"
    };
}
```

If `priority` is `4`, no arm matches.

Safer version:

```csharp
public static string GetPriorityLabel(int priority)
{
    return priority switch
    {
        1 => "Low",
        2 => "Medium",
        3 => "High",
        _ => "Unknown"
    };
}
```

In business code, deciding whether to use `_` depends on the scenario.

Use `_` to provide a safe fallback:

```csharp
public static string GetDisplayName(OrderStatus status)
{
    return status switch
    {
        OrderStatus.Draft => "Draft",
        OrderStatus.Submitted => "Submitted",
        OrderStatus.Paid => "Paid",
        OrderStatus.Cancelled => "Cancelled",
        _ => "Unknown"
    };
}
```

Throw an exception when an unexpected value indicates a programming or data integrity problem:

```csharp
public static bool CanBeCancelled(OrderStatus status)
{
    return status switch
    {
        OrderStatus.Draft => true,
        OrderStatus.Submitted => true,
        OrderStatus.Paid => false,
        OrderStatus.Cancelled => false,
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unsupported order status.")
    };
}
```

For interviews, it is important to explain that `_` is not always the best answer. Sometimes a fallback is correct. Sometimes failing fast is better.

### Constant Patterns

A constant pattern matches a specific value.

```csharp
public static decimal GetDiscountRate(string customerType)
{
    return customerType switch
    {
        "VIP" => 0.20m,
        "Member" => 0.10m,
        "Guest" => 0.00m,
        _ => 0.00m
    };
}
```

Constant patterns are commonly used with:

- Enums
- Strings
- Integers
- Booleans
- Known code values

Example with enum:

```csharp
public static int GetSortOrder(OrderStatus status)
{
    return status switch
    {
        OrderStatus.Draft => 1,
        OrderStatus.Submitted => 2,
        OrderStatus.Paid => 3,
        OrderStatus.Cancelled => 4,
        _ => int.MaxValue
    };
}
```

### Relational Patterns

Relational patterns compare the input value using operators such as `<`, `<=`, `>`, and `>=`.

```csharp
public static string ClassifyAge(int age)
{
    return age switch
    {
        < 0 => "Invalid",
        < 13 => "Child",
        < 20 => "Teenager",
        < 65 => "Adult",
        _ => "Senior"
    };
}
```

Relational patterns are useful for:

- Range classification
- Score grading
- Age grouping
- Quantity thresholds
- Pricing rules
- Risk categories

A common mistake is ordering ranges incorrectly.

Bad example:

```csharp
public static string ClassifyScore(int score)
{
    return score switch
    {
        >= 50 => "Pass",
        >= 90 => "Excellent",
        _ => "Fail"
    };
}
```

Correct version:

```csharp
public static string ClassifyScore(int score)
{
    return score switch
    {
        >= 90 => "Excellent",
        >= 75 => "Good",
        >= 50 => "Pass",
        _ => "Fail"
    };
}
```

### Logical Patterns: `and`, `or`, and `not`

Logical patterns combine other patterns.

```csharp
public static string ClassifyTemperature(decimal temperature)
{
    return temperature switch
    {
        < 0 => "Freezing",
        >= 0 and < 20 => "Cold",
        >= 20 and < 30 => "Warm",
        >= 30 => "Hot"
    };
}
```

The `or` pattern can group multiple values:

```csharp
public static bool IsWeekend(DayOfWeek day)
{
    return day switch
    {
        DayOfWeek.Saturday or DayOfWeek.Sunday => true,
        _ => false
    };
}
```

The `not` pattern can express exclusions:

```csharp
public static bool IsValidName(string? name)
{
    return name switch
    {
        not null and not "" => true,
        _ => false
    };
}
```

For many real-world cases, simpler code may be more readable:

```csharp
public static bool IsValidName(string? name)
{
    return !string.IsNullOrWhiteSpace(name);
}
```

Best practice: use logical patterns when they make the business rule easier to read, not just because the syntax is available.

### Type and Declaration Patterns

A switch expression can match based on runtime type and declare a variable.

```csharp
public static string DescribeObject(object? value)
{
    return value switch
    {
        null => "Null value",
        int number => $"Integer: {number}",
        string text => $"String with length {text.Length}",
        DateTime date => $"Date: {date:yyyy-MM-dd}",
        _ => "Unknown object"
    };
}
```

This is useful when handling values with different possible runtime types.

Example in application code:

```csharp
public interface IDomainEvent;

public sealed record OrderCreated(Guid OrderId) : IDomainEvent;
public sealed record OrderCancelled(Guid OrderId, string Reason) : IDomainEvent;

public static string GetEventDescription(IDomainEvent domainEvent)
{
    return domainEvent switch
    {
        OrderCreated e => $"Order created: {e.OrderId}",
        OrderCancelled e => $"Order cancelled: {e.OrderId}. Reason: {e.Reason}",
        _ => "Unknown event"
    };
}
```

However, too much type switching may be a design smell. If each type has its own behavior, polymorphism or the strategy pattern may be better.

### Property Patterns

Property patterns match based on object property values.

```csharp
public sealed class Order
{
    public decimal TotalAmount { get; init; }
    public bool IsPaid { get; init; }
    public bool IsCancelled { get; init; }
}

public static string GetOrderCategory(Order order)
{
    return order switch
    {
        { IsCancelled: true } => "Cancelled",
        { IsPaid: false } => "Pending Payment",
        { TotalAmount: >= 1000 } => "High Value",
        _ => "Standard"
    };
}
```

Property patterns are useful for business rules that depend on object state.

They can also be nested:

```csharp
public sealed class Customer
{
    public string Type { get; init; } = "";
}

public sealed class Order
{
    public Customer Customer { get; init; } = new();
    public decimal TotalAmount { get; init; }
}

public static decimal GetDiscount(Order order)
{
    return order switch
    {
        { Customer.Type: "VIP", TotalAmount: >= 500 } => 0.20m,
        { Customer.Type: "VIP" } => 0.10m,
        { TotalAmount: >= 1000 } => 0.05m,
        _ => 0.00m
    };
}
```

Property patterns can improve readability when the object shape is simple. They can become hard to maintain when the business rule is complex, deeply nested, or frequently changing.

### Positional Patterns and Deconstruction

Positional patterns work with types that support deconstruction, including tuples and records.

```csharp
public readonly record struct Point(int X, int Y);

public static string DescribePoint(Point point)
{
    return point switch
    {
        (0, 0) => "Origin",
        (0, _) => "On Y axis",
        (_, 0) => "On X axis",
        (> 0, > 0) => "Quadrant I",
        (< 0, > 0) => "Quadrant II",
        (< 0, < 0) => "Quadrant III",
        (> 0, < 0) => "Quadrant IV"
    };
}
```

This works because the record struct provides deconstruction support.

Positional patterns are useful when the meaning of positions is obvious. For complex domain objects, property patterns are often clearer because property names communicate intent.

Compare:

```csharp
// Less clear if the tuple positions are not obvious
var result = (order.TotalAmount, order.IsPaid, order.IsCancelled) switch
{
    (_, _, true) => "Cancelled",
    (_, false, _) => "Pending Payment",
    (>= 1000, true, false) => "High Value",
    _ => "Standard"
};
```

With:

```csharp
// Clearer because property names are visible
var result = order switch
{
    { IsCancelled: true } => "Cancelled",
    { IsPaid: false } => "Pending Payment",
    { TotalAmount: >= 1000 } => "High Value",
    _ => "Standard"
};
```

### Tuple Patterns

Tuple patterns are useful when the decision depends on multiple values.

```csharp
public static decimal CalculateShipping(decimal orderTotal, bool isExpress, bool isInternational)
{
    return (orderTotal, isExpress, isInternational) switch
    {
        (>= 1000, false, false) => 0m,
        (_, true, false) => 25m,
        (_, false, true) => 40m,
        (_, true, true) => 60m,
        _ => 10m
    };
}
```

Tuple patterns are useful for:

- Combining multiple flags
- Mapping pairs of values
- State transition rules
- Small decision tables
- Coordinate-style logic

However, tuple-heavy switch expressions can become difficult to read when there are too many values. For complex rules, consider a named type, a rule object, a strategy pattern, or a decision table.

### List Patterns

List patterns match sequences such as arrays or lists.

```csharp
public static string DescribeNumbers(int[] numbers)
{
    return numbers switch
    {
        [] => "Empty",
        [var single] => $"Single value: {single}",
        [1, 2, 3] => "One two three",
        [var first, .., var last] => $"Starts with {first}, ends with {last}"
    };
}
```

List patterns are useful for:

- Command parsing
- Token matching
- Small array classification
- Detecting sequence shape
- Matching first and last elements

Example:

```csharp
public static string ParseCommand(string[] args)
{
    return args switch
    {
        ["create", var name] => $"Create {name}",
        ["delete", var id] => $"Delete {id}",
        ["list"] => "List all",
        _ => "Unknown command"
    };
}
```

List patterns are powerful, but they should be used carefully. If matching sequence shape becomes too complex, a parser or clearer validation logic may be better.

### Case Guards with `when`

A case guard adds an additional condition to a switch arm.

```csharp
public static string GetPaymentMessage(decimal amount, bool isVip)
{
    return amount switch
    {
        <= 0 => "Invalid amount",
        >= 1000 when isVip => "VIP high-value payment",
        >= 1000 => "High-value payment",
        _ => "Standard payment"
    };
}
```

The pattern must match first, and then the `when` condition must evaluate to `true`.

Case guards are useful when:

- A pattern handles the shape, and a condition handles extra business logic
- The condition depends on external variables
- A simple pattern cannot express the full rule clearly

Avoid using too many `when` clauses in one switch expression. It may become harder to read than `if/else`.

### Null Handling

Switch expressions work well with null checks.

```csharp
public static string GetDisplayName(User? user)
{
    return user switch
    {
        null => "Anonymous",
        { FirstName: not null and not "", LastName: not null and not "" } =>
            $"{user.FirstName} {user.LastName}",
        { FirstName: not null and not "" } => user.FirstName,
        _ => "Unnamed User"
    };
}

public sealed class User
{
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
}
```

A simpler and safer version can capture property values:

```csharp
public static string GetDisplayName(User? user)
{
    return user switch
    {
        null => "Anonymous",
        { FirstName: { Length: > 0 } firstName, LastName: { Length: > 0 } lastName } =>
            $"{firstName} {lastName}",
        { FirstName: { Length: > 0 } firstName } => firstName,
        _ => "Unnamed User"
    };
}
```

Important null-safety habit:

- Handle `null` explicitly when input may be null
- Avoid using the null-forgiving operator `!` to silence warnings unless you have a strong reason
- Use property patterns to check nested values safely
- Keep null handling near the decision logic

### Result Type and Type Inference

A switch expression must produce a result. The compiler needs to determine a common type for all arms.

Valid example:

```csharp
var value = status switch
{
    OrderStatus.Draft => "Draft",
    OrderStatus.Paid => "Paid",
    _ => "Unknown"
};
```

All arms return `string`.

Invalid example:

```csharp
var value = status switch
{
    OrderStatus.Draft => "Draft",
    OrderStatus.Paid => 1,
    _ => false
};
```

The arms return unrelated types, so the compiler cannot infer a useful common type.

A target type can help:

```csharp
object value = status switch
{
    OrderStatus.Draft => "Draft",
    OrderStatus.Paid => 1,
    _ => false
};
```

This compiles because all values can be assigned to `object`, but it may be a poor design if the caller expects a meaningful consistent type.

Best practice:

- Keep all arms returning the same conceptual type
- Avoid using `object` just to make mixed result types compile
- Prefer domain-specific result types when the output has meaning

### Throw Expressions in Switch Arms

A switch arm can throw an exception.

```csharp
public static string GetRequiredLabel(OrderStatus status)
{
    return status switch
    {
        OrderStatus.Draft => "Draft",
        OrderStatus.Submitted => "Submitted",
        OrderStatus.Paid => "Paid",
        OrderStatus.Cancelled => "Cancelled",
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unsupported status.")
    };
}
```

This is useful when unexpected input should fail fast.

Common examples:

- Unsupported enum value
- Invalid state transition
- Unknown command
- Unexpected external system code
- Missing required mapping

Do not throw for normal business outcomes. If the result is expected, return a meaningful value instead.

### Real-World Usage

Switch expressions are common in production C# code for mapping and classification.

#### Mapping Domain Status to API Response

```csharp
public static string ToApiStatus(OrderStatus status)
{
    return status switch
    {
        OrderStatus.Draft => "draft",
        OrderStatus.Submitted => "submitted",
        OrderStatus.Paid => "paid",
        OrderStatus.Cancelled => "cancelled",
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unsupported order status.")
    };
}
```

#### Mapping HTTP Status Codes

```csharp
public static string GetHttpCategory(int statusCode)
{
    return statusCode switch
    {
        >= 100 and <= 199 => "Informational",
        >= 200 and <= 299 => "Success",
        >= 300 and <= 399 => "Redirection",
        >= 400 and <= 499 => "Client Error",
        >= 500 and <= 599 => "Server Error",
        _ => "Unknown"
    };
}
```

#### State Transition Validation

```csharp
public static bool CanTransition(OrderStatus current, OrderStatus next)
{
    return (current, next) switch
    {
        (OrderStatus.Draft, OrderStatus.Submitted) => true,
        (OrderStatus.Submitted, OrderStatus.Paid) => true,
        (OrderStatus.Draft, OrderStatus.Cancelled) => true,
        (OrderStatus.Submitted, OrderStatus.Cancelled) => true,
        _ => false
    };
}
```

#### DTO Mapping

```csharp
public sealed class OrderDto
{
    public required string Status { get; init; }
    public required string Label { get; init; }
}

public static OrderDto ToDto(Order order)
{
    return new OrderDto
    {
        Status = order.Status switch
        {
            OrderStatus.Draft => "draft",
            OrderStatus.Submitted => "submitted",
            OrderStatus.Paid => "paid",
            OrderStatus.Cancelled => "cancelled",
            _ => "unknown"
        },
        Label = order.Status switch
        {
            OrderStatus.Draft => "Draft",
            OrderStatus.Submitted => "Submitted",
            OrderStatus.Paid => "Paid",
            OrderStatus.Cancelled => "Cancelled",
            _ => "Unknown"
        }
    };
}

public sealed class Order
{
    public OrderStatus Status { get; init; }
}
```

If the same mapping is repeated in many places, extract it into a method or a mapper to avoid duplication.

### Trade-Offs

Switch expressions are concise, but they are not always the best tool.

Advantages:

- Clear for value mapping
- Removes repetitive `case` and `break`
- Works naturally with expression-bodied members
- Supports powerful pattern matching
- Encourages branch logic to return a value
- Reduces some common switch statement mistakes

Disadvantages:

- Can become unreadable when too many patterns are combined
- Can hide complex business rules in a compact expression
- Can encourage type checking instead of polymorphism
- Can become hard to debug if each arm contains complex expressions
- Requires careful arm ordering
- Requires careful handling of non-exhaustive cases

Good usage:

```csharp
public static string GetLabel(OrderStatus status) => status switch
{
    OrderStatus.Draft => "Draft",
    OrderStatus.Submitted => "Submitted",
    OrderStatus.Paid => "Paid",
    OrderStatus.Cancelled => "Cancelled",
    _ => "Unknown"
};
```

Poor usage:

```csharp
public static decimal Calculate(Order order, Customer customer, DateTime now)
{
    return (order.Status, customer.Type, order.TotalAmount, now.DayOfWeek) switch
    {
        (OrderStatus.Paid, "VIP", >= 1000, DayOfWeek.Monday) when customer.HasCoupon =>
            ApplyMultipleRules(order, customer, now),
        (OrderStatus.Submitted, "Partner", >= 500, _) when IsSpecialCampaign(now) =>
            CalculatePartnerPromotion(order, customer, now),
        _ => CalculateDefault(order)
    };
}
```

This may be better as named business rules, a strategy pattern, or a dedicated pricing service.

### Common Mistakes

#### Mistake 1: Forgetting the Catch-All Arm

```csharp
var label = status switch
{
    OrderStatus.Draft => "Draft",
    OrderStatus.Paid => "Paid"
};
```

This is risky because not all enum values are handled.

Better:

```csharp
var label = status switch
{
    OrderStatus.Draft => "Draft",
    OrderStatus.Submitted => "Submitted",
    OrderStatus.Paid => "Paid",
    OrderStatus.Cancelled => "Cancelled",
    _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unsupported status.")
};
```

#### Mistake 2: Putting the General Arm Before Specific Arms

```csharp
var category = amount switch
{
    > 0 => "Positive",
    > 1000 => "Large",
    _ => "Other"
};
```

The `> 1000` arm is unreachable in practice because `> 0` catches it first.

Better:

```csharp
var category = amount switch
{
    > 1000 => "Large",
    > 0 => "Positive",
    _ => "Other"
};
```

#### Mistake 3: Using Switch Expressions for Side Effects

Avoid this:

```csharp
_ = status switch
{
    OrderStatus.Paid => SendReceipt(),
    OrderStatus.Cancelled => SendCancellationEmail(),
    _ => Task.CompletedTask
};
```

This is less clear than straightforward imperative logic.

Better:

```csharp
switch (status)
{
    case OrderStatus.Paid:
        await SendReceipt();
        break;

    case OrderStatus.Cancelled:
        await SendCancellationEmail();
        break;
}
```

#### Mistake 4: Overusing `_`

A catch-all arm can hide missing cases.

```csharp
public static string GetLabel(OrderStatus status)
{
    return status switch
    {
        OrderStatus.Draft => "Draft",
        OrderStatus.Paid => "Paid",
        _ => "Unknown"
    };
}
```

If a new enum value is added, this method silently returns `"Unknown"`.

For internal domain logic, throwing may be safer:

```csharp
public static string GetLabel(OrderStatus status)
{
    return status switch
    {
        OrderStatus.Draft => "Draft",
        OrderStatus.Submitted => "Submitted",
        OrderStatus.Paid => "Paid",
        OrderStatus.Cancelled => "Cancelled",
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unsupported order status.")
    };
}
```

#### Mistake 5: Making Patterns Too Clever

This may be compact but hard to maintain:

```csharp
return (customer.Type, order.TotalAmount, order.CreatedAt.DayOfWeek, order.Items.Count) switch
{
    ("VIP" or "Partner", >= 1000, not DayOfWeek.Sunday, > 5) => 0.25m,
    ("VIP", >= 500, _, _) => 0.15m,
    (_, >= 2000, _, > 10) => 0.10m,
    _ => 0m
};
```

A clearer version may use named helper methods:

```csharp
if (IsLargeVipOrPartnerOrder(customer, order))
{
    return 0.25m;
}

if (IsVipOrder(customer, order))
{
    return 0.15m;
}

if (IsBulkHighValueOrder(order))
{
    return 0.10m;
}

return 0m;
```

Switch expressions are not a replacement for readable design.

### Best Practices

Use switch expressions when:

- Each branch returns a value
- The mapping is short and clear
- Patterns describe the business rule naturally
- The logic is easier to read than `if/else`
- The result type is consistent
- There are no significant side effects

Avoid or reconsider switch expressions when:

- Each branch performs multiple actions
- Branches require long blocks of code
- The decision depends on many unrelated values
- Business rules are complex and change often
- The code is type switching where polymorphism would be better
- The `_` arm hides important missing cases

Recommended habits:

- Handle `null` explicitly when needed
- Put specific cases before general cases
- Keep result expressions short
- Extract repeated mappings into methods
- Throw for impossible states in internal domain logic
- Return fallback values for expected external or user input cases
- Prefer property patterns over tuple patterns when names improve readability
- Use tests to cover important switch arms
- Revisit switch expressions when new enum values or domain states are added

### Switch Expressions vs Polymorphism

Switch expressions are good for simple mappings. Polymorphism is better when behavior varies by type and each type owns its behavior.

Switch expression approach:

```csharp
public static decimal CalculateFee(PaymentMethod paymentMethod)
{
    return paymentMethod switch
    {
        CreditCardPayment => 2.50m,
        BankTransferPayment => 1.00m,
        CashPayment => 0.00m,
        _ => throw new ArgumentOutOfRangeException(nameof(paymentMethod))
    };
}

public abstract class PaymentMethod;

public sealed class CreditCardPayment : PaymentMethod;
public sealed class BankTransferPayment : PaymentMethod;
public sealed class CashPayment : PaymentMethod;
```

Polymorphic approach:

```csharp
public abstract class PaymentMethod
{
    public abstract decimal CalculateFee();
}

public sealed class CreditCardPayment : PaymentMethod
{
    public override decimal CalculateFee() => 2.50m;
}

public sealed class BankTransferPayment : PaymentMethod
{
    public override decimal CalculateFee() => 1.00m;
}

public sealed class CashPayment : PaymentMethod
{
    public override decimal CalculateFee() => 0.00m;
}
```

Use switch expressions when the operation is external mapping or classification. Use polymorphism when the behavior belongs naturally to the type and is expected to grow.

### Switch Expressions vs Dictionary Lookup

A dictionary can be better for simple static mappings.

Switch expression:

```csharp
public static string GetCurrencySymbol(string currencyCode)
{
    return currencyCode switch
    {
        "USD" => "$",
        "EUR" => "€",
        "GBP" => "£",
        "JPY" => "¥",
        _ => ""
    };
}
```

Dictionary approach:

```csharp
private static readonly Dictionary<string, string> CurrencySymbols = new()
{
    ["USD"] = "$",
    ["EUR"] = "€",
    ["GBP"] = "£",
    ["JPY"] = "¥"
};

public static string GetCurrencySymbol(string currencyCode)
{
    return CurrencySymbols.TryGetValue(currencyCode, out var symbol)
        ? symbol
        : "";
}
```

Use a switch expression when the mapping is small, strongly typed, and unlikely to change. Use a dictionary when mappings are larger, data-driven, configurable, or frequently updated.

### Switch Expressions vs `if/else`

Use `if/else` when conditions are independent, procedural, or require multiple statements.

Good switch expression candidate:

```csharp
var label = status switch
{
    OrderStatus.Draft => "Draft",
    OrderStatus.Paid => "Paid",
    _ => "Unknown"
};
```

Good `if/else` candidate:

```csharp
if (order is null)
{
    logger.LogWarning("Order was null.");
    return;
}

if (!order.IsPaid)
{
    await paymentService.RequestPaymentAsync(order);
    return;
}

await shippingService.ScheduleShipmentAsync(order);
```

A practical rule: if the code is primarily choosing a value, consider a switch expression. If the code is performing a workflow, use `if/else`, a switch statement, or a dedicated service.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

####  What is a switch expression in C#?

<!-- question:start:switch-expressions-beginner-q01 -->
<!-- question-id:switch-expressions-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A switch expression is a C# expression that evaluates an input value against a set of patterns and returns the result from the first matching arm. It is commonly used for mapping, classification, and replacing simple `switch` statements or `if/else` chains when each branch produces a value.

Example:

```csharp
string label = status switch
{
    OrderStatus.Draft => "Draft",
    OrderStatus.Paid => "Paid",
    _ => "Unknown"
};
```

Unlike a switch statement, a switch expression is designed to return a value. It uses arms with `=>` instead of `case` labels and `break` statements.

##### Key Points to Mention

- It returns a value.
- It uses pattern matching.
- Each branch is called a switch arm.
- Arms are evaluated in order.
- `_` is the discard pattern and acts like a catch-all.
- It is best for concise value selection logic.

<!-- question:end:switch-expressions-beginner-q01 -->

####  What is the difference between a switch statement and a switch expression?

<!-- question:start:switch-expressions-beginner-q02 -->
<!-- question-id:switch-expressions-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A switch statement is a control-flow statement used to execute different blocks of code. A switch expression is an expression that chooses and returns a value.

A switch statement uses `case`, `break`, and `default`. A switch expression uses patterns, `=>`, and usually `_` for the default case.

Switch statements are better when each case performs multiple actions or side effects. Switch expressions are better when each case returns a value.

Example switch expression:

```csharp
string result = score switch
{
    >= 90 => "Excellent",
    >= 75 => "Good",
    >= 50 => "Pass",
    _ => "Fail"
};
```

##### Key Points to Mention

- Statement executes logic; expression returns a value.
- Switch expression has no `break`.
- Switch expression arms use `=>`.
- Switch statements are better for imperative workflows.
- Switch expressions are better for mapping and classification.

<!-- question:end:switch-expressions-beginner-q02 -->

####  What does `_` mean in a switch expression?

<!-- question:start:switch-expressions-beginner-q03 -->
<!-- question-id:switch-expressions-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`_` is the discard pattern. It matches any value that has not already matched a previous arm. It is commonly used as the final fallback arm in a switch expression.

Example:

```csharp
string roleName = role switch
{
    "admin" => "Administrator",
    "user" => "Standard User",
    _ => "Unknown"
};
```

It helps make a switch expression exhaustive, meaning that all possible input values are handled.

##### Key Points to Mention

- `_` matches anything.
- It is similar to `default`.
- It should usually appear last.
- It helps prevent non-exhaustive switch expressions.
- It can also hide missing cases if overused.

<!-- question:end:switch-expressions-beginner-q03 -->

####  Can switch expressions be used with enums?

<!-- question:start:switch-expressions-beginner-q04 -->
<!-- question-id:switch-expressions-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Yes. Switch expressions are commonly used with enums because they are useful for mapping enum values to labels, codes, permissions, or behavior flags.

Example:

```csharp
public static string GetLabel(OrderStatus status)
{
    return status switch
    {
        OrderStatus.Draft => "Draft",
        OrderStatus.Submitted => "Submitted",
        OrderStatus.Paid => "Paid",
        OrderStatus.Cancelled => "Cancelled",
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unsupported status.")
    };
}
```

When working with enums, it is important to handle all valid values and decide whether unknown values should return a fallback or throw an exception.

##### Key Points to Mention

- Enum mapping is a common use case.
- Handle all known enum values.
- Use `_` carefully.
- Throwing can be better for invalid internal states.
- Fallback values can be better for external or user-provided data.

<!-- question:end:switch-expressions-beginner-q04 -->

####  What happens if no switch expression arm matches?

<!-- question:start:switch-expressions-beginner-q05 -->
<!-- question-id:switch-expressions-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

If no arm matches, the switch expression fails at runtime by throwing an exception. The compiler can warn about many non-exhaustive switch expressions, but developers should still make sure all expected cases are handled.

Example of a risky switch expression:

```csharp
string label = priority switch
{
    1 => "Low",
    2 => "Medium",
    3 => "High"
};
```

If `priority` is `4`, no arm matches.

A safer version includes a catch-all arm:

```csharp
string label = priority switch
{
    1 => "Low",
    2 => "Medium",
    3 => "High",
    _ => "Unknown"
};
```

##### Key Points to Mention

- A switch expression should be exhaustive.
- No match causes a runtime exception.
- The compiler may warn about missing cases.
- Use `_` for fallback.
- Throw explicitly when the value should never happen.

<!-- question:end:switch-expressions-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

####  How does arm ordering affect a switch expression?

<!-- question:start:switch-expressions-intermediate-q06 -->
<!-- question-id:switch-expressions-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Switch expression arms are evaluated from top to bottom. The first matching arm is selected. This means specific cases should usually come before general cases.

Example:

```csharp
string result = score switch
{
    >= 90 => "Excellent",
    >= 75 => "Good",
    >= 50 => "Pass",
    _ => "Fail"
};
```

This is correct because the most specific high-score checks appear first.

Bad example:

```csharp
string result = score switch
{
    >= 50 => "Pass",
    >= 90 => "Excellent",
    _ => "Fail"
};
```

The `>= 90` arm is effectively unreachable because any value greater than or equal to 90 already matches `>= 50`.

##### Key Points to Mention

- Arms are checked in text order.
- First match wins.
- Specific patterns should come before broader patterns.
- `_` should usually be last.
- Poor ordering can create unreachable or incorrect cases.

<!-- question:end:switch-expressions-intermediate-q06 -->

####  What are relational and logical patterns in switch expressions?

<!-- question:start:switch-expressions-intermediate-q07 -->
<!-- question-id:switch-expressions-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

Relational patterns match values using comparison operators such as `<`, `<=`, `>`, and `>=`. Logical patterns combine patterns using `and`, `or`, and `not`.

Example:

```csharp
string category = age switch
{
    < 0 => "Invalid",
    >= 0 and < 13 => "Child",
    >= 13 and < 20 => "Teenager",
    >= 20 and < 65 => "Adult",
    _ => "Senior"
};
```

These patterns are useful for range-based business rules such as grading, pricing, risk levels, age groups, and quantity thresholds.

##### Key Points to Mention

- Relational patterns compare values.
- Logical patterns combine conditions.
- `and`, `or`, and `not` improve expressiveness.
- Ordering still matters.
- They are good for range classification.

<!-- question:end:switch-expressions-intermediate-q07 -->

####  How do property patterns work in switch expressions?

<!-- question:start:switch-expressions-intermediate-q08 -->
<!-- question-id:switch-expressions-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

Property patterns match an object based on the values of its properties. They are useful when business logic depends on object state.

Example:

```csharp
string category = order switch
{
    { IsCancelled: true } => "Cancelled",
    { IsPaid: false } => "Pending Payment",
    { TotalAmount: >= 1000 } => "High Value",
    _ => "Standard"
};
```

The switch expression checks the shape and property values of the object. Property patterns can also be nested, allowing matching against properties inside child objects.

##### Key Points to Mention

- Property patterns inspect object properties.
- They are useful for domain object classification.
- They can be nested.
- They improve readability when the object shape is simple.
- They can become hard to maintain if deeply nested or overly complex.

<!-- question:end:switch-expressions-intermediate-q08 -->

####  What are tuple patterns and when would you use them?

<!-- question:start:switch-expressions-intermediate-q09 -->
<!-- question-id:switch-expressions-intermediate-q09 -->
<!-- question-level:intermediate -->

##### Expected Answer

Tuple patterns allow a switch expression to match multiple values at the same time. They are useful when a decision depends on a combination of inputs.

Example:

```csharp
bool canTransition = (currentStatus, nextStatus) switch
{
    (OrderStatus.Draft, OrderStatus.Submitted) => true,
    (OrderStatus.Submitted, OrderStatus.Paid) => true,
    (OrderStatus.Draft, OrderStatus.Cancelled) => true,
    _ => false
};
```

This is useful for state transitions, small decision tables, combinations of flags, coordinate logic, and rules based on multiple values.

However, if there are too many tuple elements, the code can become difficult to understand. In that case, a named type or rule object may be better.

##### Key Points to Mention

- Tuple patterns match multiple values.
- Good for small decision tables.
- Good for state transitions.
- Too many tuple values reduce readability.
- Property patterns may be clearer when names matter.

<!-- question:end:switch-expressions-intermediate-q09 -->

####  How do `when` guards work in switch expressions?

<!-- question:start:switch-expressions-intermediate-q10 -->
<!-- question-id:switch-expressions-intermediate-q10 -->
<!-- question-level:intermediate -->

##### Expected Answer

A `when` guard adds an extra Boolean condition to a switch arm. The pattern must match first, and then the `when` condition must be true.

Example:

```csharp
string message = amount switch
{
    <= 0 => "Invalid amount",
    >= 1000 when isVip => "VIP high-value payment",
    >= 1000 => "High-value payment",
    _ => "Standard payment"
};
```

Case guards are useful when the pattern alone cannot express the complete condition, especially when the condition depends on another variable or a custom method.

##### Key Points to Mention

- `when` adds an extra condition.
- The pattern is checked first.
- The guard must return a Boolean.
- Useful for external conditions.
- Too many guards can make the switch expression hard to read.

<!-- question:end:switch-expressions-intermediate-q10 -->

####  How can switch expressions help with null handling?

<!-- question:start:switch-expressions-intermediate-q11 -->
<!-- question-id:switch-expressions-intermediate-q11 -->
<!-- question-level:intermediate -->

##### Expected Answer

Switch expressions can handle null explicitly using the `null` pattern and can safely match properties using property patterns.

Example:

```csharp
public static string GetName(User? user)
{
    return user switch
    {
        null => "Anonymous",
        { FirstName: { Length: > 0 } firstName } => firstName,
        _ => "Unnamed User"
    };
}
```

This approach keeps null handling close to the decision logic and avoids unsafe dereferencing.

##### Key Points to Mention

- Use `null` as an explicit pattern.
- Property patterns can safely check nested values.
- Avoid using `!` to silence null warnings unnecessarily.
- Switch expressions work well with nullable reference types.
- Null handling should be intentional and visible.

<!-- question:end:switch-expressions-intermediate-q11 -->

####  What type must the arms of a switch expression return?

<!-- question:start:switch-expressions-intermediate-q12 -->
<!-- question-id:switch-expressions-intermediate-q12 -->
<!-- question-level:intermediate -->

##### Expected Answer

The arms of a switch expression must produce values that the compiler can convert to a common result type or to the target type expected by the assignment or return statement.

Valid example:

```csharp
string label = status switch
{
    OrderStatus.Draft => "Draft",
    OrderStatus.Paid => "Paid",
    _ => "Unknown"
};
```

Invalid or poor design example:

```csharp
var value = status switch
{
    OrderStatus.Draft => "Draft",
    OrderStatus.Paid => 1,
    _ => false
};
```

The arms return unrelated types. Although assigning to `object` can sometimes make mixed arms compile, it is usually a design smell unless the method intentionally returns a general object.

##### Key Points to Mention

- A switch expression returns one value.
- Arms need a common result type.
- Target typing can help.
- Mixed unrelated types are usually a bad design.
- Prefer clear, consistent return types.

<!-- question:end:switch-expressions-intermediate-q12 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

####  When should you avoid switch expressions?

<!-- question:start:switch-expressions-advanced-q13 -->
<!-- question-id:switch-expressions-advanced-q13 -->
<!-- question-level:advanced -->

##### Expected Answer

You should avoid switch expressions when they make the code less readable or when the logic is not naturally value-producing.

Avoid them when:

- Each branch performs multiple side effects
- Each branch needs several statements
- The rule is complex and changes frequently
- The expression requires many nested patterns
- Type switching is replacing proper polymorphism
- The switch expression hides important business rules
- Debugging the expression becomes difficult

For workflows, a switch statement, `if/else`, or separate service is often clearer. For behavior that varies by type, polymorphism or the strategy pattern may be better.

##### Key Points to Mention

- Switch expressions are best for returning values.
- Do not force workflows into expressions.
- Avoid overly clever pattern combinations.
- Complex business rules may need named methods or rule objects.
- Type switching may indicate a design smell.

<!-- question:end:switch-expressions-advanced-q13 -->

####  How do switch expressions compare with polymorphism?

<!-- question:start:switch-expressions-advanced-q14 -->
<!-- question-id:switch-expressions-advanced-q14 -->
<!-- question-level:advanced -->

##### Expected Answer

Switch expressions are good for external mapping or classification. Polymorphism is better when behavior belongs naturally to the type itself.

Switch expression example:

```csharp
decimal fee = paymentMethod switch
{
    CreditCardPayment => 2.50m,
    BankTransferPayment => 1.00m,
    CashPayment => 0.00m,
    _ => throw new ArgumentOutOfRangeException(nameof(paymentMethod))
};
```

This is acceptable for a small mapping. But if each payment method has its own behavior and that behavior grows, polymorphism is better:

```csharp
public abstract class PaymentMethod
{
    public abstract decimal CalculateFee();
}
```

Then each subclass implements its own fee calculation.

Switch expressions centralize decision logic. Polymorphism distributes behavior to the relevant type. The best choice depends on whether the operation is external mapping or core type behavior.

##### Key Points to Mention

- Switch expressions centralize branching.
- Polymorphism moves behavior into types.
- Use switch expressions for small mappings.
- Use polymorphism for growing type-specific behavior.
- Repeated type switching is often a design smell.

<!-- question:end:switch-expressions-advanced-q14 -->

####  How do switch expressions compare with dictionary lookups?

<!-- question:start:switch-expressions-advanced-q15 -->
<!-- question-id:switch-expressions-advanced-q15 -->
<!-- question-level:advanced -->

##### Expected Answer

Switch expressions are good for small, static, strongly typed mappings. Dictionary lookups are better for larger or data-driven mappings.

Switch expression:

```csharp
string symbol = currencyCode switch
{
    "USD" => "$",
    "EUR" => "€",
    "GBP" => "£",
    _ => ""
};
```

Dictionary:

```csharp
private static readonly Dictionary<string, string> Symbols = new()
{
    ["USD"] = "$",
    ["EUR"] = "€",
    ["GBP"] = "£"
};

string symbol = Symbols.TryGetValue(currencyCode, out var value)
    ? value
    : "";
```

A dictionary is easier to maintain when mappings are large, configurable, or loaded from data. A switch expression is often clearer for a small number of cases and can support patterns that dictionaries cannot easily express.

##### Key Points to Mention

- Switch expressions are good for small static logic.
- Dictionaries are good for larger lookup tables.
- Dictionaries support data-driven mappings.
- Switch expressions support complex patterns.
- Choose based on maintainability and clarity.

<!-- question:end:switch-expressions-advanced-q15 -->

####  What is the risk of using `_` in every switch expression?

<!-- question:start:switch-expressions-advanced-q16 -->
<!-- question-id:switch-expressions-advanced-q16 -->
<!-- question-level:advanced -->

##### Expected Answer

The `_` arm makes a switch expression exhaustive, but it can hide missing cases. For example, if a new enum value is added later, the `_` arm may silently handle it instead of forcing the developer to update the mapping.

Example:

```csharp
string label = status switch
{
    OrderStatus.Draft => "Draft",
    OrderStatus.Paid => "Paid",
    _ => "Unknown"
};
```

If `OrderStatus.Refunded` is added later, this method returns `"Unknown"` instead of clearly requiring a decision.

In internal domain logic, it is often better to throw for unsupported values:

```csharp
_ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unsupported status.")
```

For external user input or integration input, a fallback may be correct because unexpected values are normal and should not always crash the application.

##### Key Points to Mention

- `_` prevents non-exhaustive matches.
- It can hide newly added enum values.
- Throwing may be better for internal impossible states.
- Fallbacks may be better for external input.
- The right choice depends on domain expectations.

<!-- question:end:switch-expressions-advanced-q16 -->

####  How would you use switch expressions for state transitions?

<!-- question:start:switch-expressions-advanced-q17 -->
<!-- question-id:switch-expressions-advanced-q17 -->
<!-- question-level:advanced -->

##### Expected Answer

Switch expressions work well for small state transition rules, especially with tuple patterns.

Example:

```csharp
public static bool CanTransition(OrderStatus current, OrderStatus next)
{
    return (current, next) switch
    {
        (OrderStatus.Draft, OrderStatus.Submitted) => true,
        (OrderStatus.Submitted, OrderStatus.Paid) => true,
        (OrderStatus.Draft, OrderStatus.Cancelled) => true,
        (OrderStatus.Submitted, OrderStatus.Cancelled) => true,
        _ => false
    };
}
```

This is readable for a small state machine. If the transition rules grow, require permissions, depend on time, or need audit logging, a dedicated state machine, policy object, or domain service may be more maintainable.

##### Key Points to Mention

- Tuple patterns are useful for state transitions.
- Works well for small decision tables.
- Keep the rules readable.
- For complex workflows, use a dedicated domain service or state machine.
- Add tests for allowed and rejected transitions.

<!-- question:end:switch-expressions-advanced-q17 -->

####  How do list patterns work in switch expressions?

<!-- question:start:switch-expressions-advanced-q18 -->
<!-- question-id:switch-expressions-advanced-q18 -->
<!-- question-level:advanced -->

##### Expected Answer

List patterns allow a switch expression to match the shape and contents of a sequence.

Example:

```csharp
public static string ParseCommand(string[] args)
{
    return args switch
    {
        ["create", var name] => $"Create {name}",
        ["delete", var id] => $"Delete {id}",
        ["list"] => "List all",
        [] => "No command",
        _ => "Unknown command"
    };
}
```

List patterns can match empty sequences, exact positions, variables, and remaining elements using slice patterns such as `..`.

They are useful for command parsing, token matching, and small sequence classification. They should not replace a proper parser for complex grammar.

##### Key Points to Mention

- List patterns match sequence shape.
- They can match exact elements.
- `..` can represent remaining elements.
- Useful for command-line or token-like inputs.
- Avoid using them for complex parsing logic.

<!-- question:end:switch-expressions-advanced-q18 -->

####  How can switch expressions improve maintainability, and how can they hurt it?

<!-- question:start:switch-expressions-advanced-q19 -->
<!-- question-id:switch-expressions-advanced-q19 -->
<!-- question-level:advanced -->

##### Expected Answer

Switch expressions improve maintainability when they make simple decision logic compact, readable, and centralized. They reduce boilerplate from switch statements and make mappings easy to scan.

They can hurt maintainability when they become too dense, use many nested patterns, contain complex expressions, or centralize behavior that should belong to separate classes.

Good maintainable example:

```csharp
public static string ToApiStatus(OrderStatus status) => status switch
{
    OrderStatus.Draft => "draft",
    OrderStatus.Submitted => "submitted",
    OrderStatus.Paid => "paid",
    OrderStatus.Cancelled => "cancelled",
    _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unsupported status.")
};
```

Harder-to-maintain example:

```csharp
return (order.Status, customer.Type, order.TotalAmount, order.Items.Count, now.DayOfWeek) switch
{
    (OrderStatus.Paid, "VIP" or "Partner", >= 1000, > 5, not DayOfWeek.Sunday) => 0.25m,
    (OrderStatus.Submitted, "VIP", >= 500, _, _) when customer.HasCoupon => 0.15m,
    _ => 0m
};
```

The second example may be better expressed with named methods or separate rule classes.

##### Key Points to Mention

- Good for small, clear mappings.
- Bad when overly dense or clever.
- Complex business rules deserve named abstractions.
- Readability matters more than compactness.
- Unit tests should cover important arms.

<!-- question:end:switch-expressions-advanced-q19 -->

####  What are good testing practices for switch expressions?

<!-- question:start:switch-expressions-advanced-q20 -->
<!-- question-id:switch-expressions-advanced-q20 -->
<!-- question-level:advanced -->

##### Expected Answer

Testing should cover each important arm, boundary values for relational patterns, null cases, fallback behavior, and invalid or unsupported values.

For example, if a switch expression classifies status codes:

```csharp
public static string GetHttpCategory(int statusCode)
{
    return statusCode switch
    {
        >= 100 and <= 199 => "Informational",
        >= 200 and <= 299 => "Success",
        >= 300 and <= 399 => "Redirection",
        >= 400 and <= 499 => "Client Error",
        >= 500 and <= 599 => "Server Error",
        _ => "Unknown"
    };
}
```

Tests should include boundary values such as `100`, `199`, `200`, `299`, `400`, `499`, `500`, `599`, and invalid values like `99` or `600`.

For enum mappings, tests should cover all enum values. For state transitions, tests should cover allowed and rejected transitions.

##### Key Points to Mention

- Test every meaningful arm.
- Test boundary values.
- Test null handling.
- Test fallback or exception behavior.
- Add tests when new enum values or states are introduced.

<!-- question:end:switch-expressions-advanced-q20 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
