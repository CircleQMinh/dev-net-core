---
id: delegates-events-lambda
topic: Delegates, Events, and Lambda Expressions
category: .NET
---

Understanding Delegates, Events, and Lambda Expressions is essential for C# interviews and real-world application development.

---

# Delegates

## What is a Delegate in C#?

A delegate is a type that references methods with a specific parameter list and return type.

- Similar to a function pointer in C++
- Type-safe and secure

```csharp
public delegate void MyDelegate(string message);

public class Example
{
    public static void ShowMessage(string msg)
    {
        Console.WriteLine(msg);
    }

    public static void Main()
    {
        MyDelegate del = ShowMessage;
        del("Hello from delegate!");
    }
}
````

---

## Types of Delegates

* Single-cast Delegate → Points to one method
* Multicast Delegate → Points to multiple methods
* Built-in generic delegates:

  * `Func<>`
  * `Action<>`
  * `Predicate<>`

---

## What is a Multicast Delegate?

A delegate that references more than one method.

```csharp
public delegate void MyDelegate();

void MethodA() => Console.WriteLine("A");
void MethodB() => Console.WriteLine("B");

MyDelegate d = MethodA;
d += MethodB;

d(); // Output:
// A
// B
```

---

## Difference Between Func, Action, and Predicate

| Type      | Return Type | Parameters          |
| --------- | ----------- | ------------------- |
| Action    | void        | 0–16                |
| Func      | Any type    | Last type is return |
| Predicate | bool        | 1 parameter         |

```csharp
Action<string> greet = name => Console.WriteLine($"Hi {name}");
Func<int, int, int> add = (x, y) => x + y;
Predicate<int> isEven = x => x % 2 == 0;
```

---

# Events

## What is an Event in C#?

An event is a mechanism that allows a class to notify other classes when something happens.

* Built on delegates
* Used in event-driven programming

```csharp
public class Alarm
{
    public event Action OnAlarm;

    public void Trigger()
    {
        Console.WriteLine("Alarm triggered!");
        OnAlarm?.Invoke();
    }
}
```

---

## How Are Delegates and Events Related?

* An event is essentially a wrapper around a delegate.
* Delegates can be invoked directly.
* Events can only be raised inside the declaring class.

```csharp
public event MyDelegate MyEvent;
```

Only the class declaring `MyEvent` can invoke it.

---

## Why Use Events Instead of Delegates?

* Restricts invocation access
* Enforces encapsulation
* Prevents external classes from raising the event

---

## Can an Event Have Multiple Subscribers?

Yes. Events are multicast by default.

```csharp
myAlarm.OnAlarm += Handler1;
myAlarm.OnAlarm += Handler2;
```

---

## Can You Unsubscribe From an Event?

Yes, using the `-=` operator.

```csharp
myAlarm.OnAlarm -= Handler1;
```

---

## Can Events Be Static?

Yes. Static events are shared across all instances.

```csharp
public static event Action OnGlobalEvent;
```

---

# Lambda Expressions

## What is a Lambda Expression?

A lambda expression is a concise syntax for writing anonymous methods.

Uses the `=>` operator.

```csharp
Func<int, int> square = x => x * x;
Console.WriteLine(square(5)); // 25
```

---

## Common Uses of Lambda Expressions

* LINQ queries
* Delegates (Func, Action, Predicate)
* Event handlers
* Anonymous methods

---

## Anonymous Method vs Lambda

Anonymous method:

```csharp
Action hello = delegate { Console.WriteLine("Hello!"); };
```

Lambda expression:

```csharp
Action hello = () => Console.WriteLine("Hello!");
```

Lambdas are shorter and preferred in modern C#.

---

## What is a Closure?

A lambda can capture variables from its outer scope.

```csharp
int count = 0;
Action increment = () => { count++; };

increment();
Console.WriteLine(count); // 1
```

This behavior is called a **closure**.

---

# Delegates in Event-Driven Programming

Delegates are the foundation of events.

They are used to notify subscribers when an action occurs.

---

# LINQ and Lambdas

```csharp
List<int> nums = new List<int> { 1, 2, 3, 4, 5 };
var evens = nums.Where(x => x % 2 == 0).ToList();
```

Lambda expressions are heavily used in LINQ.

---

# Real-World Example: Func, Action, and Predicate Together

## Scenario: Number Processor

```csharp
using System;
using System.Collections.Generic;
using System.Linq;

public class NumberProcessor
{
    private List<int> numbers;

    public NumberProcessor(List<int> initialNumbers)
    {
        numbers = initialNumbers;
    }

    // Predicate → filtering
    public List<int> Filter(Predicate<int> condition)
    {
        return numbers.FindAll(condition);
    }

    // Func → transformation
    public List<int> Transform(Func<int, int> transformation)
    {
        return numbers.Select(transformation).ToList();
    }

    // Action → side effects
    public void ProcessEach(Action<int> action)
    {
        foreach (var number in numbers)
        {
            action(number);
        }
    }
}
```

## Usage Example

```csharp
public class Program
{
    public static void Main()
    {
        var processor = new NumberProcessor(new List<int> { 1, 2, 3, 4, 5, 6 });

        var evens = processor.Filter(n => n % 2 == 0);
        Console.WriteLine("Even numbers: " + string.Join(", ", evens));

        var squares = processor.Transform(n => n * n);
        Console.WriteLine("Squared numbers: " + string.Join(", ", squares));

        Console.WriteLine("All numbers:");
        processor.ProcessEach(n => Console.WriteLine($"Number: {n}"));
    }
}
```

---

# Summary

| Topic                     | Key Concept                               |
| ------------------------- | ----------------------------------------- |
| Delegate                  | Type-safe method reference                |
| Multicast Delegate        | Can reference multiple methods            |
| Event                     | Notification mechanism built on delegates |
| Lambda                    | Concise inline function syntax            |
| Func / Action / Predicate | Generic built-in delegates                |

---

## Notes

* Multicast delegates execute methods in order of subscription.
* If one method in a multicast delegate throws an exception, subsequent methods will not execute unless handled.
* Lambda closures capture variables by reference, not by value.

```
