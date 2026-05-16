---
id: delegates-in-csharp
topic: Modern C# patterns
subtopic: Delegates
category: .NET
---


## Overview

Delegates in C# are type-safe references to methods. A delegate defines a method signature: the return type and parameter list that a compatible method must have. After a delegate instance is created, it can point to a named method, an anonymous method, or a lambda expression, and the code can invoke that method through the delegate.

Delegates matter because they allow behavior to be passed as data. Instead of hard-coding what a method should do, a class or method can accept a delegate parameter and let the caller provide the logic. This is the foundation for callbacks, events, LINQ operators, sorting, filtering, validation rules, notification handlers, and many extensibility points in .NET.

In modern C#, developers often use built-in delegate types such as `Action`, `Func`, and `Predicate<T>` instead of declaring custom delegate types. However, understanding custom delegates is still important because events, framework APIs, asynchronous callbacks, expression trees, and functional-style code all build on the same idea.

Delegates are important in interviews because they test whether a developer understands C# beyond basic object-oriented syntax. Interviewers often use delegates to explore method references, lambdas, events, multicast behavior, variance, closures, asynchronous code, and how .NET enables flexible designs without excessive inheritance.

## Core Concepts

### What Is a Delegate?

A delegate is a reference type that represents one or more methods with a specific signature.

```csharp
public delegate int Operation(int x, int y);
```

This delegate can reference any method that accepts two `int` parameters and returns an `int`.

```csharp
public static int Add(int x, int y) => x + y;
public static int Multiply(int x, int y) => x * y;

Operation operation = Add;
Console.WriteLine(operation(2, 3)); // 5

operation = Multiply;
Console.WriteLine(operation(2, 3)); // 6
```

The key idea is that `operation` is not the result of calling `Add`; it is a reference to the `Add` method itself.

Delegates are:

- Type-safe: the method signature must be compatible.
- Object-oriented: a delegate is an object derived from `System.Delegate` or `System.MulticastDelegate`.
- Invokeable: a delegate can be called like a method.
- Composable: delegates can be combined into multicast delegates.
- Common in framework APIs: events, LINQ, callbacks, and asynchronous APIs use delegates heavily.

### Delegate Declaration, Instantiation, and Invocation

A custom delegate type is declared with the `delegate` keyword.

```csharp
public delegate void Notify(string message);
```

A delegate instance can be assigned a method group, an anonymous method, or a lambda expression.

```csharp
public static void SendEmail(string message)
{
    Console.WriteLine($"Email: {message}");
}

Notify notify1 = SendEmail;

Notify notify2 = delegate (string message)
{
    Console.WriteLine($"Anonymous: {message}");
};

Notify notify3 = message => Console.WriteLine($"Lambda: {message}");

notify1("Order created");
notify2("Order created");
notify3("Order created");
```

A delegate can be invoked directly:

```csharp
notify1("Hello");
```

Or with `Invoke`:

```csharp
notify1.Invoke("Hello");
```

Both forms call the referenced method. Direct invocation is more common, while `Invoke` can be useful when combined with the null-conditional operator.

```csharp
notify1?.Invoke("Hello");
```

### Built-In Delegate Types: Action, Func, and Predicate

Modern C# provides built-in generic delegate types that cover most common cases.

`Action` represents a method that returns `void`.

```csharp
Action<string> log = message => Console.WriteLine(message);
log("Application started");
```

`Func` represents a method that returns a value. The last generic type argument is the return type.

```csharp
Func<int, int, int> add = (x, y) => x + y;
int result = add(10, 20);
```

`Predicate<T>` represents a method that accepts a value of type `T` and returns `bool`.

```csharp
Predicate<int> isEven = number => number % 2 == 0;
Console.WriteLine(isEven(10)); // True
```

Common built-in delegates include:

| Delegate Type | Meaning | Example |
|---|---|---|
| `Action` | No parameters, no return value | `Action save = Save;` |
| `Action<T>` | One parameter, no return value | `Action<string> log = Log;` |
| `Func<TResult>` | No parameters, returns a value | `Func<DateTime> now = () => DateTime.UtcNow;` |
| `Func<T, TResult>` | One parameter, returns a value | `Func<int, bool> isValid = x => x > 0;` |
| `Predicate<T>` | One parameter, returns `bool` | `Predicate<string> hasValue = s => !string.IsNullOrWhiteSpace(s);` |
| `Comparison<T>` | Compares two values | `Comparison<int> compare = (a, b) => a.CompareTo(b);` |
| `Converter<TInput, TOutput>` | Converts one value to another | `Converter<string, int> parse = int.Parse;` |

For most application code, prefer `Action`, `Func`, and `Predicate<T>` unless a custom delegate name improves readability or is required by an event/API contract.

### Custom Delegates vs Built-In Delegates

A custom delegate is useful when the delegate represents a meaningful domain concept.

```csharp
public delegate bool DiscountEligibilityRule(Customer customer, Order order);
```

The same signature could be written with `Func<Customer, Order, bool>`:

```csharp
Func<Customer, Order, bool> discountEligibilityRule;
```

Both approaches work, but they communicate different levels of intent.

Use a custom delegate when:

- The delegate has domain meaning.
- The signature is reused across a public API.
- You want XML documentation on the delegate type.
- You want a clearer name than `Func<T1, T2, TResult>`.
- You are defining an event pattern or framework-style API.

Use `Func`, `Action`, or `Predicate<T>` when:

- The delegate is simple and local.
- The behavior is passed to a method temporarily.
- The signature is obvious from the context.
- You are writing LINQ-style code.

### Delegates as Callback Parameters

A callback is a method supplied by the caller and executed by the callee at a later point or inside a workflow.

```csharp
public static void ProcessNumbers(IEnumerable<int> numbers, Action<int> process)
{
    foreach (int number in numbers)
    {
        process(number);
    }
}

ProcessNumbers([1, 2, 3], number => Console.WriteLine(number));
```

A more realistic example is validation or filtering.

```csharp
public static IEnumerable<T> Filter<T>(IEnumerable<T> items, Predicate<T> condition)
{
    foreach (T item in items)
    {
        if (condition(item))
        {
            yield return item;
        }
    }
}

var activeUsers = Filter(users, user => user.IsActive);
```

This pattern avoids hard-coding business rules inside the reusable method. The reusable method controls the workflow, while the delegate supplies the changing behavior.

### Delegates and Lambdas

A lambda expression is a concise way to create a delegate instance.

```csharp
Func<int, int> square = x => x * x;
```

Lambdas are heavily used with delegates because they allow behavior to be written inline.

```csharp
var expensiveProducts = products
    .Where(product => product.Price > 1000)
    .OrderBy(product => product.Name)
    .ToList();
```

In this example, `Where` and `OrderBy` accept delegate-based parameters. The lambda expressions describe the filtering and sorting behavior.

A lambda can be:

```csharp
// Expression lambda
Func<int, bool> isPositive = x => x > 0;

// Statement lambda
Action<string> print = message =>
{
    string formatted = message.Trim().ToUpperInvariant();
    Console.WriteLine(formatted);
};
```

Use expression lambdas for simple transformations or predicates. Use statement lambdas when multiple statements are required, but avoid putting complex business logic inline if it harms readability or testability.

### Closures and Captured Variables

A lambda can capture variables from the surrounding scope. This is called a closure.

```csharp
int minimumAge = 18;
Func<User, bool> isAdult = user => user.Age >= minimumAge;
```

The lambda references `minimumAge` even though `minimumAge` is declared outside the lambda.

Closures are powerful, but they can cause bugs when variables change after the delegate is created.

```csharp
var actions = new List<Action>();

for (int i = 0; i < 3; i++)
{
    int copy = i;
    actions.Add(() => Console.WriteLine(copy));
}

foreach (Action action in actions)
{
    action();
}
```

The `copy` variable avoids accidentally capturing a loop variable in a confusing way. Modern C# handles `foreach` loop variable capture more safely than older versions, but developers should still be careful when closures are created inside loops.

Closures can also allocate extra objects because the compiler may create a generated class to store captured variables. This usually does not matter for normal business code, but it can matter in hot paths or high-throughput code.

### Multicast Delegates

A delegate can reference more than one method. This is called a multicast delegate.

```csharp
Action<string> notify = SendEmail;
notify += SendSms;
notify += WriteAuditLog;

notify("Order shipped");
```

When invoked, the methods are called in order.

```csharp
public static void SendEmail(string message) => Console.WriteLine($"Email: {message}");
public static void SendSms(string message) => Console.WriteLine($"SMS: {message}");
public static void WriteAuditLog(string message) => Console.WriteLine($"Audit: {message}");
```

Delegates can be combined and removed with `+`, `+=`, `-`, and `-=`.

```csharp
notify -= SendSms;
```

Important multicast behavior:

- Methods are invoked in invocation-list order.
- If one method throws an exception, later methods are not called unless the caller handles invocation manually.
- For non-`void` multicast delegates, the final return value is the return value of the last invoked method.
- Delegates are immutable; combining or removing delegates creates a new delegate instance.

For events and notifications, multicast delegates are useful. For operations where each result matters, manually iterate through `GetInvocationList()` or use another design.

```csharp
foreach (Action<string> handler in notify.GetInvocationList())
{
    try
    {
        handler("Order shipped");
    }
    catch (Exception ex)
    {
        Console.WriteLine(ex.Message);
    }
}
```

### Delegates and Events

Events are built on top of delegates. A delegate defines the handler signature, while the `event` keyword restricts how outside code can interact with the delegate.

```csharp
public class OrderService
{
    public event EventHandler<OrderCreatedEventArgs>? OrderCreated;

    public void CreateOrder(Order order)
    {
        // Create and save order...
        OrderCreated?.Invoke(this, new OrderCreatedEventArgs(order.Id));
    }
}

public class OrderCreatedEventArgs : EventArgs
{
    public OrderCreatedEventArgs(int orderId)
    {
        OrderId = orderId;
    }

    public int OrderId { get; }
}
```

Subscriber code:

```csharp
var service = new OrderService();

service.OrderCreated += (sender, args) =>
{
    Console.WriteLine($"Order created: {args.OrderId}");
};
```

An event should be used when an object wants to notify interested subscribers that something happened. A delegate parameter should be used when the caller must provide behavior for the operation to complete.

Example difference:

```csharp
// Delegate callback: required behavior
products.Sort((x, y) => x.Price.CompareTo(y.Price));

// Event: optional notification
button.Click += OnButtonClicked;
```

With a public delegate field, outside code could overwrite or invoke the delegate. With an event, outside code can usually only subscribe and unsubscribe.

```csharp
// Avoid this for public APIs
public Action<string>? MessageReceived;

// Prefer this for notifications
public event Action<string>? MessageReceived;
```

### Delegate Variance: Covariance and Contravariance

Variance allows some delegate assignments to work even when the method signature is not exactly identical but is type-compatible.

Covariance allows a delegate to reference a method that returns a more derived type than the delegate return type.

```csharp
public class Animal { }
public class Dog : Animal { }

Func<Animal> createAnimal = CreateDog;

static Dog CreateDog() => new Dog();
```

The delegate expects an `Animal`, and the method returns a `Dog`. This is safe because every `Dog` is an `Animal`.

Contravariance allows a delegate to reference a method that accepts a less derived parameter type.

```csharp
Action<Dog> handleDog = HandleAnimal;

static void HandleAnimal(Animal animal)
{
    Console.WriteLine(animal.GetType().Name);
}
```

The delegate expects something that can handle a `Dog`. A method that can handle any `Animal` can safely handle a `Dog`.

For generic delegate declarations:

```csharp
public delegate TResult Transformer<in TInput, out TResult>(TInput input);
```

- `in` means the type parameter is contravariant and used as an input.
- `out` means the type parameter is covariant and used as an output.

`Func` and `Action` use variance annotations. `Func` return types are covariant, and `Action` parameter types are contravariant.

Variance is an advanced interview topic. A strong answer should focus on type safety: covariance is about safely returning more specific types, and contravariance is about safely accepting less specific input types.

### Delegates, Interfaces, and Strategy Pattern

Delegates and interfaces can both represent replaceable behavior, but they are useful in different situations.

A delegate is often best when the behavior is a single operation.

```csharp
public decimal CalculateTotal(Order order, Func<Order, decimal> discountRule)
{
    decimal discount = discountRule(order);
    return order.Subtotal - discount;
}
```

An interface is often better when the behavior has multiple related operations or needs a named abstraction.

```csharp
public interface IDiscountPolicy
{
    bool IsEligible(Order order);
    decimal CalculateDiscount(Order order);
}
```

Use delegates when:

- The operation is simple and single-method.
- You want lightweight callback behavior.
- You want to avoid creating many small classes.
- The behavior is local to a method call.

Use interfaces when:

- The abstraction has multiple methods.
- The behavior needs dependency injection, lifetime management, or state.
- The implementation is complex and should be tested independently.
- The design benefits from a named contract.

In interviews, this comparison often appears as “When would you use a delegate instead of an interface?” A practical answer is: use delegates for small function-like behavior and interfaces for larger object-like behavior.

### Delegates and LINQ

LINQ relies heavily on delegates. Many LINQ methods accept `Func` parameters.

```csharp
var names = users
    .Where(user => user.IsActive)
    .Select(user => user.Name)
    .OrderBy(name => name)
    .ToList();
```

Common LINQ delegate signatures include:

```csharp
Func<User, bool> predicate = user => user.IsActive;
Func<User, string> selector = user => user.Name;
Func<User, DateTime> keySelector = user => user.CreatedAt;
```

LINQ demonstrates one of the most common real-world uses of delegates: expressing query behavior without changing the collection-processing algorithm.

For `IEnumerable<T>`, lambdas usually compile to delegates. For `IQueryable<T>`, lambdas may be represented as expression trees, such as `Expression<Func<T, bool>>`, so the provider can translate the expression to SQL or another query language.

```csharp
Func<User, bool> inMemoryFilter = user => user.IsActive;
Expression<Func<User, bool>> databaseFilter = user => user.IsActive;
```

This distinction matters in Entity Framework Core interviews. A `Func<T, bool>` usually means client-side executable code, while `Expression<Func<T, bool>>` means inspectable expression data that can often be translated by a provider.

### Delegates and Expression Trees

A delegate is executable behavior. An expression tree is a data structure that represents code.

```csharp
Func<int, int> compiled = x => x + 1;
Expression<Func<int, int>> expression = x => x + 1;
```

The delegate can be invoked directly:

```csharp
int value = compiled(10);
```

The expression tree can be inspected, transformed, or translated:

```csharp
Console.WriteLine(expression.Body); // (x + 1)
```

Expression trees are used by query providers, rule engines, dynamic filters, and libraries that need to analyze code rather than immediately execute it.

Use `Func<T, TResult>` when you want to run code. Use `Expression<Func<T, TResult>>` when another component needs to inspect or translate the code.

### Async Delegates

Delegates can reference asynchronous methods.

```csharp
Func<Task> saveAsync = async () =>
{
    await Task.Delay(100);
    Console.WriteLine("Saved");
};

await saveAsync();
```

For asynchronous operations, prefer delegates that return `Task` or `Task<T>`.

```csharp
Func<int, Task<User>> getUserAsync = async id =>
{
    await Task.Delay(100);
    return new User(id, "Minh");
};
```

Avoid `async void` except for event handlers.

```csharp
// Avoid for normal callback APIs
Action save = async () =>
{
    await Task.Delay(100);
    throw new InvalidOperationException("This exception is hard to observe.");
};
```

The lambda above is accepted because `Action` returns `void`, but the asynchronous exception cannot be awaited by the caller. Prefer:

```csharp
Func<Task> save = async () =>
{
    await Task.Delay(100);
    throw new InvalidOperationException("The caller can observe this by awaiting.");
};

await save();
```

For event handlers, `async void` is allowed because event signatures typically return `void`, but the handler should still catch and handle exceptions when needed.

```csharp
button.Click += async (sender, args) =>
{
    try
    {
        await SaveAsync();
    }
    catch (Exception ex)
    {
        Log(ex);
    }
};
```

### Delegate Nullability and Safe Invocation

A delegate variable can be `null` if no method has been assigned.

```csharp
Action<string>? log = null;
log?.Invoke("Message");
```

For events, nullability is common because there may be no subscribers.

```csharp
public event EventHandler? Completed;

protected virtual void OnCompleted()
{
    Completed?.Invoke(this, EventArgs.Empty);
}
```

In older code, developers copied the delegate to a local variable before invoking it to avoid a race where subscribers unsubscribe between the null check and invocation.

```csharp
EventHandler? handler = Completed;
handler?.Invoke(this, EventArgs.Empty);
```

The null-conditional operator also evaluates the receiver once, making it a clean modern pattern for most event invocation code.

### Delegate Immutability

Delegate instances are immutable. When a delegate is combined or removed, C# creates a new delegate instance with a different invocation list.

```csharp
Action handler = First;
handler += Second; // Creates a new combined delegate instance
handler -= First;  // Creates another delegate instance
```

This immutability helps make delegate invocation safer and predictable, but it also means repeatedly combining delegates in performance-critical loops can create allocations.

For normal event subscription and callback code, this cost is usually negligible. For high-performance code, avoid repeatedly allocating new lambdas or delegate instances in hot paths.

### Exception Behavior in Multicast Delegates

When a multicast delegate is invoked normally, each method is called in order. If one method throws an exception, the invocation stops and the exception is propagated to the caller.

```csharp
Action notify = Handler1;
notify += Handler2;
notify += Handler3;

notify(); // If Handler2 throws, Handler3 is not called.
```

If every subscriber must be attempted, invoke each handler manually.

```csharp
foreach (Action handler in notify.GetInvocationList())
{
    try
    {
        handler();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Handler failed: {ex.Message}");
    }
}
```

This is important for plugin systems, notification systems, and domain event dispatching where one handler failure should not necessarily stop all other handlers.

### Return Values in Multicast Delegates

A multicast delegate can have a return type, but normal invocation returns only the value from the last method in the invocation list.

```csharp
Func<int> getNumber = () => 1;
getNumber += () => 2;
getNumber += () => 3;

Console.WriteLine(getNumber()); // 3
```

This behavior is often surprising. For this reason, multicast delegates are usually clearer with `void` return types, especially for events.

If multiple return values are required, manually enumerate the invocation list.

```csharp
foreach (Func<int> provider in getNumber.GetInvocationList())
{
    int result = provider();
    Console.WriteLine(result);
}
```

### Performance Considerations

Delegates are efficient enough for most application code, but they are still indirect calls and can involve allocations depending on how they are used.

Common allocation sources include:

- Capturing lambdas, because captured variables may require a compiler-generated closure object.
- Creating new delegate instances repeatedly in loops.
- Combining and removing multicast delegates frequently.
- Using delegates where a direct method call would be simpler in a hot path.

Example of a non-capturing lambda:

```csharp
Func<int, int> square = static x => x * x;
```

The `static` lambda modifier prevents capturing variables from the surrounding scope.

```csharp
int factor = 10;

// This would not compile because a static lambda cannot capture factor.
// Func<int, int> multiply = static x => x * factor;
```

Use static lambdas when you want to make accidental captures impossible.

For normal business applications, readability and correct design are usually more important than micro-optimizing delegate overhead. For performance-critical paths, measure before optimizing.

### Common Mistakes

A common mistake is using a custom delegate when `Func`, `Action`, or `Predicate<T>` would be clearer and simpler.

```csharp
// Usually unnecessary
public delegate bool Check(int value);

// Usually simpler
Predicate<int> check = value => value > 0;
```

Another mistake is using `Action` with an asynchronous lambda.

```csharp
// Problematic: async void behavior
Action work = async () => await SaveAsync();
```

Prefer:

```csharp
Func<Task> work = async () => await SaveAsync();
await work();
```

Another common mistake is exposing a public delegate field instead of an event.

```csharp
// Bad public API
public Action<string>? DataChanged;
```

Prefer:

```csharp
public event Action<string>? DataChanged;
```

Another mistake is assuming multicast delegates collect every return value. Normal invocation only returns the last handler result.

Another mistake is forgetting that closures capture variables, not just values. If a variable changes before the delegate runs, the delegate may observe the changed value.

### Best Practices

Use built-in delegates for simple local behavior.

```csharp
Func<decimal, decimal> applyTax = amount => amount * 1.1m;
```

Use custom delegates when the name adds domain meaning or improves a public API.

```csharp
public delegate bool AuthorizationRule(User user, Resource resource);
```

Use events for notifications and delegates for required callbacks.

```csharp
public event EventHandler? Completed;

public void Retry(Func<Task> operation)
{
    // operation is required for Retry to do useful work
}
```

Use `EventHandler` or `EventHandler<TEventArgs>` for conventional .NET events.

```csharp
public event EventHandler<OrderCreatedEventArgs>? OrderCreated;
```

Use `Func<Task>` or `Func<T, Task<TResult>>` for asynchronous callbacks.

```csharp
public Task ExecuteAsync(Func<CancellationToken, Task> operation, CancellationToken cancellationToken)
{
    return operation(cancellationToken);
}
```

Avoid unnecessary captures in hot paths. Use static lambdas when useful.

```csharp
var numbers = Enumerable.Range(1, 10).Select(static x => x * 2);
```

Keep delegate logic readable. If a lambda becomes too large, move it into a named method.

```csharp
var validOrders = orders.Where(IsValidOrder);

static bool IsValidOrder(Order order)
{
    return order.Total > 0 && order.CustomerId is not null;
}
```

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:delegates-in-csharp-beginner-q01 -->
#### Beginner Q01: What is a delegate in C#?
<!-- question-id:delegates-in-csharp-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A delegate is a type-safe reference to a method. It defines a method signature, including parameter types and return type. Any method with a compatible signature can be assigned to the delegate and invoked through it.

Delegates allow methods to be passed as arguments, stored in variables, returned from methods, and used as callbacks. They are the basis for events, many LINQ methods, and common callback patterns in .NET.

Example:

```csharp
public delegate int Operation(int x, int y);

static int Add(int x, int y) => x + y;

Operation operation = Add;
int result = operation(2, 3);
```

Here, `operation` references the `Add` method and can be invoked like a normal method.

##### Key Points to Mention

- A delegate represents a method signature.
- Delegates are type-safe.
- Delegates are reference types.
- A delegate can reference static methods, instance methods, anonymous methods, or lambdas.
- Delegates are used for callbacks, events, LINQ, and flexible behavior.

<!-- question:end:delegates-in-csharp-beginner-q01 -->

<!-- question:start:delegates-in-csharp-beginner-q02 -->
#### Beginner Q02: How do you declare and use a custom delegate?
<!-- question-id:delegates-in-csharp-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A custom delegate is declared with the `delegate` keyword. The declaration specifies the return type and parameters that assigned methods must match.

```csharp
public delegate void Notify(string message);

public static void SendNotification(string message)
{
    Console.WriteLine(message);
}

Notify notify = SendNotification;
notify("Order created");
```

The `SendNotification` method can be assigned to `Notify` because it accepts a `string` and returns `void`, matching the delegate signature.

##### Key Points to Mention

- Use the `delegate` keyword to declare a custom delegate type.
- The assigned method must have a compatible signature.
- A delegate can be invoked directly or with `.Invoke()`.
- Method group conversion allows `Notify notify = SendNotification;`.
- Custom delegates are useful when the delegate name has domain meaning.

<!-- question:end:delegates-in-csharp-beginner-q02 -->

<!-- question:start:delegates-in-csharp-beginner-q03 -->
#### Beginner Q03: What are `Action`, `Func`, and `Predicate<T>`?
<!-- question-id:delegates-in-csharp-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`Action`, `Func`, and `Predicate<T>` are built-in generic delegate types.

`Action` represents a method that returns `void`.

```csharp
Action<string> log = message => Console.WriteLine(message);
```

`Func` represents a method that returns a value. The last type parameter is the return type.

```csharp
Func<int, int, int> add = (x, y) => x + y;
```

`Predicate<T>` represents a method that accepts a `T` and returns `bool`.

```csharp
Predicate<int> isEven = number => number % 2 == 0;
```

They are commonly used instead of declaring custom delegates for simple callback scenarios.

##### Key Points to Mention

- `Action` returns `void`.
- `Func` returns a value.
- The last generic parameter of `Func` is the return type.
- `Predicate<T>` returns `bool`.
- These built-in delegates reduce the need for custom delegate declarations.

<!-- question:end:delegates-in-csharp-beginner-q03 -->

<!-- question:start:delegates-in-csharp-beginner-q04 -->
#### Beginner Q04: What is the difference between a delegate and a normal method call?
<!-- question-id:delegates-in-csharp-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A normal method call directly calls a specific method known at compile time. A delegate call invokes a method through a delegate variable. The actual method can be selected, changed, or passed in at runtime as long as it matches the delegate signature.

```csharp
static int Add(int x, int y) => x + y;
static int Multiply(int x, int y) => x * y;

Func<int, int, int> operation = Add;
operation = Multiply;

int result = operation(2, 3); // Calls Multiply
```

Delegates make code more flexible because the caller can provide behavior instead of the callee hard-coding it.

##### Key Points to Mention

- A direct method call targets a specific method.
- A delegate call invokes the method currently assigned to the delegate.
- Delegates enable callbacks and runtime behavior selection.
- The method must still match the delegate signature.
- Delegates are useful for decoupling algorithms from specific operations.

<!-- question:end:delegates-in-csharp-beginner-q04 -->

<!-- question:start:delegates-in-csharp-beginner-q05 -->
#### Beginner Q05: What is a lambda expression, and how is it related to delegates?
<!-- question-id:delegates-in-csharp-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

A lambda expression is a concise way to define an anonymous function. In many contexts, a lambda expression is converted into a delegate instance.

```csharp
Func<int, int> square = x => x * x;
Console.WriteLine(square(5)); // 25
```

Lambdas are commonly used with delegate-based APIs such as LINQ.

```csharp
var activeUsers = users.Where(user => user.IsActive).ToList();
```

The lambda `user => user.IsActive` supplies the predicate delegate used by `Where`.

##### Key Points to Mention

- A lambda is an anonymous function syntax.
- Lambdas can be converted to compatible delegate types.
- Lambdas are commonly used with `Func`, `Action`, and `Predicate<T>`.
- LINQ uses delegates heavily through lambda expressions.
- Lambdas can be expression lambdas or statement lambdas.

<!-- question:end:delegates-in-csharp-beginner-q05 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:delegates-in-csharp-intermediate-q01 -->
#### Intermediate Q01: What is a multicast delegate?
<!-- question-id:delegates-in-csharp-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

A multicast delegate is a delegate that has more than one method in its invocation list. When invoked, it calls each method in order.

```csharp
Action<string> notify = SendEmail;
notify += SendSms;
notify += WriteAuditLog;

notify("Order shipped");
```

The delegate calls `SendEmail`, then `SendSms`, then `WriteAuditLog`.

Multicast delegates are commonly used by events. They work best with `void` return types. If a multicast delegate has a return value, normal invocation returns only the result from the last method in the invocation list.

If one handler throws an exception, invocation stops and later handlers are not called unless the caller manually iterates through `GetInvocationList()` and handles exceptions per handler.

##### Key Points to Mention

- A multicast delegate has an invocation list.
- Use `+=` to add methods and `-=` to remove methods.
- Methods are invoked in order.
- Events commonly use multicast delegates.
- For non-`void` multicast delegates, only the last return value is returned.
- Exceptions stop normal invocation unless handled manually.

<!-- question:end:delegates-in-csharp-intermediate-q01 -->

<!-- question:start:delegates-in-csharp-intermediate-q02 -->
#### Intermediate Q02: What is the difference between delegates and events?
<!-- question-id:delegates-in-csharp-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A delegate is a type that references methods. An event is a language feature built on top of delegates that restricts how outside code can interact with the delegate.

A public delegate field can be assigned, overwritten, or invoked by external code.

```csharp
public Action<string>? MessageReceived;
```

An event normally allows external code only to subscribe or unsubscribe.

```csharp
public event Action<string>? MessageReceived;
```

Use a delegate parameter when the operation requires caller-provided behavior to complete. Use an event when an object wants to notify subscribers that something happened and subscribers are optional.

```csharp
// Required callback
products.Sort((a, b) => a.Price.CompareTo(b.Price));

// Optional notification
button.Click += OnButtonClicked;
```

##### Key Points to Mention

- Events are based on delegates.
- Delegates represent callable method references.
- Events restrict external access to subscription and unsubscription.
- Use delegates for required callbacks.
- Use events for optional notifications.
- Avoid exposing public delegate fields in public APIs.

<!-- question:end:delegates-in-csharp-intermediate-q02 -->

<!-- question:start:delegates-in-csharp-intermediate-q03 -->
#### Intermediate Q03: When should you use a custom delegate instead of `Func` or `Action`?
<!-- question-id:delegates-in-csharp-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use `Func`, `Action`, or `Predicate<T>` for simple local behavior where the signature is obvious. Use a custom delegate when the delegate represents a meaningful domain concept or public API contract.

```csharp
public delegate bool AuthorizationRule(User user, Resource resource);
```

This is more expressive than:

```csharp
Func<User, Resource, bool> rule;
```

The custom delegate name communicates purpose. It can also have documentation and can make public APIs easier to understand.

However, custom delegates add extra types. For short local callbacks, built-in delegates are usually simpler.

##### Key Points to Mention

- `Func` and `Action` are good for simple callbacks.
- Custom delegates are good when the name adds meaning.
- Custom delegates can improve public API readability.
- Custom delegates can be documented as domain concepts.
- Avoid creating unnecessary custom delegate types for trivial cases.

<!-- question:end:delegates-in-csharp-intermediate-q03 -->

<!-- question:start:delegates-in-csharp-intermediate-q04 -->
#### Intermediate Q04: What is a closure in C# delegate or lambda usage?
<!-- question-id:delegates-in-csharp-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

A closure happens when a lambda or anonymous method captures variables from the surrounding scope.

```csharp
int minimumAge = 18;
Func<User, bool> isAdult = user => user.Age >= minimumAge;
```

The lambda captures `minimumAge`. It can still use that variable when invoked later.

Closures are useful but can cause bugs if the captured variable changes before the delegate runs.

```csharp
var actions = new List<Action>();

for (int i = 0; i < 3; i++)
{
    int copy = i;
    actions.Add(() => Console.WriteLine(copy));
}
```

Using `copy` avoids confusion about which loop value is captured.

Closures may also allocate extra objects because the compiler may need to store captured variables in a generated class.

##### Key Points to Mention

- A closure captures variables from the outer scope.
- Captured variables can be used after the outer method scope continues.
- Be careful when capturing loop variables.
- Closures can introduce hidden allocations.
- Use static lambdas to prevent accidental captures when appropriate.

<!-- question:end:delegates-in-csharp-intermediate-q04 -->

<!-- question:start:delegates-in-csharp-intermediate-q05 -->
#### Intermediate Q05: How do delegates support LINQ?
<!-- question-id:delegates-in-csharp-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

LINQ methods accept delegate-based parameters to describe filtering, projection, ordering, grouping, and other query behavior.

```csharp
var activeUserNames = users
    .Where(user => user.IsActive)
    .Select(user => user.Name)
    .OrderBy(name => name)
    .ToList();
```

`Where` uses a predicate delegate, usually `Func<T, bool>`. `Select` uses a selector delegate, usually `Func<TSource, TResult>`. `OrderBy` uses a key selector delegate.

This lets LINQ provide reusable algorithms while the caller supplies the changing logic through lambda expressions.

With `IEnumerable<T>`, lambdas normally compile to executable delegates. With `IQueryable<T>`, lambdas are often represented as expression trees so a provider can translate them into SQL or another query language.

##### Key Points to Mention

- LINQ methods commonly accept `Func` delegates.
- `Where` uses predicate logic.
- `Select` uses projection logic.
- Delegates allow LINQ algorithms to be reusable.
- `IEnumerable<T>` usually uses delegates; `IQueryable<T>` often uses expression trees.

<!-- question:end:delegates-in-csharp-intermediate-q05 -->

<!-- question:start:delegates-in-csharp-intermediate-q06 -->
#### Intermediate Q06: What happens if a multicast delegate has a return value?
<!-- question-id:delegates-in-csharp-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

If a multicast delegate has a return value, normal invocation returns only the result from the last method in the invocation list.

```csharp
Func<int> getValue = () => 1;
getValue += () => 2;
getValue += () => 3;

Console.WriteLine(getValue()); // 3
```

The earlier return values are ignored by normal invocation. If all return values matter, you need to manually iterate through the invocation list.

```csharp
foreach (Func<int> handler in getValue.GetInvocationList())
{
    int result = handler();
    Console.WriteLine(result);
}
```

Because of this behavior, multicast delegates are usually clearer when used with `void` return types, especially for events.

##### Key Points to Mention

- Normal multicast invocation returns only the last handler result.
- Earlier return values are ignored.
- Use `GetInvocationList()` when all results matter.
- Multicast delegates are best suited for notification-style `void` methods.
- This is one reason .NET events typically use `void` handlers.

<!-- question:end:delegates-in-csharp-intermediate-q06 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:delegates-in-csharp-advanced-q01 -->
#### Advanced Q01: Explain covariance and contravariance in delegates.
<!-- question-id:delegates-in-csharp-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Variance allows delegate assignments to work when the assigned method is type-compatible but not exactly identical.

Covariance applies to return types. A delegate that expects a base type result can reference a method that returns a derived type.

```csharp
class Animal { }
class Dog : Animal { }

Func<Animal> createAnimal = CreateDog;

static Dog CreateDog() => new Dog();
```

This is safe because every `Dog` is an `Animal`.

Contravariance applies to parameter types. A delegate that expects a method that can handle a derived type can reference a method that handles a base type.

```csharp
Action<Dog> handleDog = HandleAnimal;

static void HandleAnimal(Animal animal)
{
    Console.WriteLine(animal.GetType().Name);
}
```

This is safe because a method that can handle any `Animal` can handle a `Dog`.

Generic delegates can use `in` and `out` annotations.

```csharp
public delegate TResult Transformer<in TInput, out TResult>(TInput input);
```

`in` means the type parameter is used for input and is contravariant. `out` means the type parameter is used for output and is covariant.

##### Key Points to Mention

- Covariance is about returning a more derived type.
- Contravariance is about accepting a less derived parameter type.
- `out` marks covariant type parameters.
- `in` marks contravariant type parameters.
- `Func` uses covariant return types and contravariant parameter types.
- `Action` uses contravariant parameter types.
- The main principle is type safety.

<!-- question:end:delegates-in-csharp-advanced-q01 -->

<!-- question:start:delegates-in-csharp-advanced-q02 -->
#### Advanced Q02: What is the difference between `Func<T, bool>` and `Expression<Func<T, bool>>`?
<!-- question-id:delegates-in-csharp-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

`Func<T, bool>` is executable code. It represents a delegate that can be invoked directly.

```csharp
Func<User, bool> isActive = user => user.IsActive;
bool result = isActive(user);
```

`Expression<Func<T, bool>>` is a data structure that represents code as an expression tree.

```csharp
Expression<Func<User, bool>> isActiveExpression = user => user.IsActive;
```

An expression tree can be inspected, transformed, or translated. This is important for libraries like Entity Framework Core, where an expression can be translated into SQL.

For in-memory filtering, `Func<T, bool>` is fine. For query providers that need to translate the predicate, `Expression<Func<T, bool>>` is usually required.

##### Key Points to Mention

- `Func<T, bool>` is executable delegate code.
- `Expression<Func<T, bool>>` represents code as data.
- Expression trees can be inspected or translated.
- EF Core commonly uses expression trees to translate LINQ to SQL.
- Using `Func<T, bool>` too early can force client-side evaluation or in-memory filtering.

<!-- question:end:delegates-in-csharp-advanced-q02 -->

<!-- question:start:delegates-in-csharp-advanced-q03 -->
#### Advanced Q03: What are the risks of using async lambdas with delegates?
<!-- question-id:delegates-in-csharp-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

The main risk is assigning an async lambda to a `void`-returning delegate such as `Action`. This creates `async void` behavior.

```csharp
Action work = async () =>
{
    await SaveAsync();
};
```

Because `Action` returns `void`, the caller cannot await the operation. Exceptions thrown after the `await` cannot be observed by awaiting the delegate call. This can cause unhandled exceptions, difficult testing, and unexpected execution order.

Prefer delegates that return `Task` or `Task<T>` for asynchronous callbacks.

```csharp
Func<Task> work = async () =>
{
    await SaveAsync();
};

await work();
```

`async void` should generally be limited to event handlers, because event signatures usually require `void`.

##### Key Points to Mention

- `Action` plus async lambda creates `async void` behavior.
- `async void` cannot be awaited by the caller.
- Exceptions from `async void` are hard to catch from outside.
- Prefer `Func<Task>` or `Func<T, Task<TResult>>` for async callbacks.
- `async void` is mainly acceptable for event handlers.
- Event handlers should still handle exceptions when appropriate.

<!-- question:end:delegates-in-csharp-advanced-q03 -->

<!-- question:start:delegates-in-csharp-advanced-q04 -->
#### Advanced Q04: How do delegates compare with interfaces for implementing the Strategy pattern?
<!-- question-id:delegates-in-csharp-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Both delegates and interfaces can represent replaceable behavior. Delegates are best for small, single-operation strategies. Interfaces are better for larger abstractions with multiple operations, state, dependency injection needs, or a strong domain contract.

Delegate-based strategy:

```csharp
public decimal CalculateTotal(Order order, Func<Order, decimal> discountRule)
{
    return order.Subtotal - discountRule(order);
}
```

Interface-based strategy:

```csharp
public interface IDiscountPolicy
{
    bool IsEligible(Order order);
    decimal CalculateDiscount(Order order);
}
```

The delegate version is lightweight and concise. The interface version is more explicit and easier to extend when the behavior has multiple responsibilities.

In production systems, interfaces are often preferred for dependency injection and complex domain policies. Delegates are often preferred for local callbacks, simple rules, and functional-style composition.

##### Key Points to Mention

- Delegates work well for single-method behavior.
- Interfaces work better for multi-method contracts.
- Interfaces are usually better for dependency injection and complex policies.
- Delegates reduce boilerplate for simple callbacks.
- Both can implement Strategy-style behavior.
- Choose based on readability, testability, lifetime, and complexity.

<!-- question:end:delegates-in-csharp-advanced-q04 -->

<!-- question:start:delegates-in-csharp-advanced-q05 -->
#### Advanced Q05: Are delegates immutable, and why does that matter?
<!-- question-id:delegates-in-csharp-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Yes. Delegate instances are immutable. When you combine or remove delegates, C# creates a new delegate instance with a new invocation list.

```csharp
Action handler = Handler1;
handler += Handler2; // Creates a new combined delegate instance
handler -= Handler1; // Creates another delegate instance
```

This matters because delegate variables can be safely treated as snapshots of an invocation list at a point in time. It also explains why event invocation patterns often copy or evaluate the delegate once before invoking it.

Immutability also means repeated delegate combination/removal can allocate new objects. This is usually fine for normal event subscription code, but it can matter in performance-sensitive code.

##### Key Points to Mention

- Delegate instances are immutable.
- Combining or removing delegates creates a new delegate instance.
- Immutability supports safer invocation-list behavior.
- There can be allocation costs from repeated delegate composition.
- This is usually not a concern outside hot paths.

<!-- question:end:delegates-in-csharp-advanced-q05 -->

<!-- question:start:delegates-in-csharp-advanced-q06 -->
#### Advanced Q06: How should exceptions be handled when invoking multicast delegates?
<!-- question-id:delegates-in-csharp-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

When a multicast delegate is invoked normally, handlers are called in order. If a handler throws an exception, invocation stops and the exception propagates to the caller. Later handlers are not called.

```csharp
Action notify = Handler1;
notify += Handler2;
notify += Handler3;

notify(); // If Handler2 throws, Handler3 is not called.
```

If all handlers should be attempted independently, manually iterate through the invocation list and handle exceptions around each handler.

```csharp
foreach (Action handler in notify.GetInvocationList())
{
    try
    {
        handler();
    }
    catch (Exception ex)
    {
        Log(ex);
    }
}
```

This approach is useful in plugin systems, notification dispatchers, and domain event dispatching where one subscriber failure should not prevent other subscribers from running.

##### Key Points to Mention

- Normal multicast invocation stops when a handler throws.
- Later handlers are skipped after an exception.
- Use `GetInvocationList()` to invoke handlers individually.
- Handle exceptions per handler if all subscribers should be attempted.
- Consider whether failure should stop the workflow or be isolated.

<!-- question:end:delegates-in-csharp-advanced-q06 -->

<!-- question:start:delegates-in-csharp-advanced-q07 -->
#### Advanced Q07: What performance issues can delegates introduce?
<!-- question-id:delegates-in-csharp-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Delegates are efficient enough for most application code, but they can introduce overhead in performance-sensitive paths.

Potential issues include:

- Indirect call overhead compared with a direct method call.
- Allocations from creating delegate instances repeatedly.
- Allocations from capturing lambdas because closures may require compiler-generated objects.
- Allocations from combining/removing multicast delegates.
- Extra overhead if delegates are used in very tight loops.

Example of a capturing lambda:

```csharp
int factor = 10;
Func<int, int> multiply = x => x * factor;
```

Example of a static lambda that prevents capture:

```csharp
Func<int, int> square = static x => x * x;
```

In normal business applications, delegate overhead is rarely the main bottleneck. In high-throughput code, measure with a profiler or benchmark before optimizing.

##### Key Points to Mention

- Delegates can allocate depending on how they are created.
- Capturing lambdas can allocate closure objects.
- Static lambdas prevent accidental captures.
- Multicast delegate composition creates new delegate instances.
- Delegate overhead is usually acceptable in business code.
- Optimize only after measurement.

<!-- question:end:delegates-in-csharp-advanced-q07 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
