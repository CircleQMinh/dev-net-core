---
id: interfaces-vs-abstract-classes
topic: Interfaces vs Abstract Classes
category: .NET
---

## Overview

Understanding interfaces and abstract classes is essential for C# and object-oriented programming interviews.

---

## What is the Difference Between an Interface and an Abstract Class?

| Feature              | Interface                          | Abstract Class                                  |
|----------------------|-----------------------------------|------------------------------------------------|
| Inheritance          | Supports multiple inheritance     | Supports single inheritance                    |
| Method Implementation| Only method signatures (pre C# 8) Can have default implementations (C# 8+) | Can have abstract and concrete methods         |
| Fields               | Cannot have instance fields       | Can have fields                                |
| Access Modifiers     | Members are public by default     | Supports private, protected, etc.              |
| Constructors         | Cannot have instance constructors | Can have constructors                          |
| When to Use          | Define contracts                  | Share common logic among related classes       |

> Note: Interfaces can have static members (C# 8+) and static abstract members (C# 11+), but cannot have instance fields.

---

## Can a Class Inherit Both an Abstract Class and an Interface?

Yes.

A class can inherit:

- One abstract class
- Multiple interfaces

C# does not support multiple class inheritance.

### Example

```csharp
// Abstract class
public abstract class Animal
{
    public abstract void Speak();
}

// Interface
public interface IWalker
{
    void Walk();
}

// Dog class inherits Animal and implements IWalker
public class Dog : Animal, IWalker
{
    public override void Speak()
    {
        Console.WriteLine("Dog barks");
    }

    public void Walk()
    {
        Console.WriteLine("Dog is walking");
    }
}
````

---

## Can an Interface Have Method Implementations?

Yes — starting from C# 8.

Interfaces can define default method implementations.

```csharp
public interface IAnimal
{
    void MakeSound(); // Abstract method

    // Default implementation (C# 8+)
    public void Sleep()
    {
        Console.WriteLine("Sleeping...");
    }
}

public class Dog : IAnimal
{
    public void MakeSound()
    {
        Console.WriteLine("Dog barks");
    }
}
```

Older versions (before C# 8) do not allow method bodies in interfaces.

---

## Can an Abstract Class Have a Constructor?

Yes.

The constructor runs when a derived class instance is created.

Used to initialize shared state.

```csharp
public abstract class Animal
{
    public string Name;

    public Animal(string name)
    {
        Name = name;
        Console.WriteLine("Animal Constructor Called");
    }

    public abstract void Speak();
}

public class Dog : Animal
{
    public Dog(string name) : base(name) { }

    public override void Speak()
    {
        Console.WriteLine($"{Name} barks!");
    }
}
```

---

## Can an Interface Have Fields?

No.

Interfaces cannot contain instance fields.

They can define properties, but the implementing class provides storage.

```csharp
public interface IAnimal
{
    string Name { get; set; }
}

public class Dog : IAnimal
{
    public string Name { get; set; } = "Doggy";
}
```

---

## When Should You Use an Interface vs Abstract Class?

### Use an Interface When:

* You need multiple inheritance
* You are defining a contract only
* Types are unrelated but share capability (e.g., IDisposable)

### Use an Abstract Class When:

* You need shared implementation
* You want both abstract and concrete methods
* Classes are closely related in hierarchy

---

## Can an Interface Inherit Another Interface?

Yes.

Interfaces can inherit from other interfaces.

```csharp
public interface IMovable
{
    void Move();
}

public interface IWalker : IMovable
{
    void Walk();
}

public class Robot : IWalker
{
    public void Move()
    {
        Console.WriteLine("Moving...");
    }

    public void Walk()
    {
        Console.WriteLine("Walking...");
    }
}
```

---

## Can an Abstract Class Implement an Interface?

Yes.

An abstract class can implement an interface partially or fully.

```csharp
public interface IAnimal
{
    void MakeSound();
}

public abstract class Mammal : IAnimal
{
    public abstract void MakeSound();
}

public class Dog : Mammal
{
    public override void MakeSound()
    {
        Console.WriteLine("Dog barks");
    }
}
```

---

## Can an Interface Have Static Methods?

Yes (C# 8+).

```csharp
public interface ICalculator
{
    static int Add(int a, int b) => a + b;
}
```

Static interface methods are accessed via the interface type.

---

## What Happens If Two Interfaces Have Methods With the Same Name?

If a class implements two interfaces with identical method signatures, explicit implementation is required to avoid ambiguity.

```csharp
public interface IFirst
{
    void Show();
}

public interface ISecond
{
    void Show();
}

public class Demo : IFirst, ISecond
{
    void IFirst.Show()
    {
        Console.WriteLine("First Interface Show");
    }

    void ISecond.Show()
    {
        Console.WriteLine("Second Interface Show");
    }
}
```

Explicit interface implementation resolves the conflict.
How to Call Each Implementation Correctly

You must cast to the interface:
```csharp
Demo demo = new Demo();

((IFirst)demo).Show();   // Output: First Interface Show
((ISecond)demo).Show();  // Output: Second Interface Show
```
---

## Summary

* Interfaces define contracts.
* Abstract classes share behavior and logic.
* Interfaces support multiple inheritance.
* Abstract classes support shared state and constructors.
* C# 8+ enhances interfaces with default and static methods.

---

## Notes

* The statement “interfaces cannot have constructors” refers to instance constructors. Modern C# allows static members in interfaces.
* Performance differences between interfaces and abstract classes are negligible in modern .NET; design clarity should drive the choice.
* The original claim that interfaces are “slightly faster” than abstract classes is misleading. In modern .NET, performance differences are negligible and depend on JIT optimizations rather than the construct itself.

```
