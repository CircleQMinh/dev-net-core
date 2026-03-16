---
id: oop
topic: OOP
category: .NET
---

## General OOP Concepts

### What are the four main principles of OOP?

The four main principles of Object-Oriented Programming (OOP) are:

- Encapsulation
- Inheritance
- Polymorphism
- Abstraction

---

### Can you explain encapsulation with an example?

Encapsulation is the practice of bundling data (fields) and methods that operate on that data into a single unit (class) while restricting direct access to implementation details. This helps maintain data integrity and control how data is modified.

```csharp
public class BankAccount
{
    private decimal balance;

    public void Deposit(decimal amount)
    {
        if (amount > 0)
            balance += amount;
    }

    public decimal GetBalance()
    {
        return balance;
    }
}
````

Here, `balance` is private and can only be modified through `Deposit()`.

---

## Inheritance & Polymorphism

### What is inheritance in C#? How does it work?

Inheritance allows a class (child) to acquire properties and behaviors from another class (parent).

```csharp
public class Animal
{
    public void Eat() => Console.WriteLine("Eating...");
}

public class Dog : Animal
{
    public void Bark() => Console.WriteLine("Barking...");
}

// Usage
Dog dog = new Dog();
dog.Eat();
dog.Bark();
```

---

### What is polymorphism? How is it achieved in C#?

Polymorphism allows a method to take different forms. It is achieved through:

* Method overloading (compile-time polymorphism)
* Method overriding (runtime polymorphism)

```csharp
public class Animal
{
    public virtual void Speak() => Console.WriteLine("Animal makes a sound");
}

public class Dog : Animal
{
    public override void Speak() => Console.WriteLine("Dog barks");
}

// Usage
Animal myAnimal = new Dog();
myAnimal.Speak();
```

---

### What is the difference between method overloading and method overriding?

| Feature        | Overloading                            | Overriding                                      |
| -------------- | -------------------------------------- | ----------------------------------------------- |
| Definition     | Same method name, different parameters | Same method signature, different implementation |
| When           | Compile-time                           | Runtime                                         |
| Modifiers Used | None required                          | virtual, override, or new                       |

---

## Abstraction & Interfaces

### What is abstraction? How does it differ from encapsulation?

* **Abstraction** hides implementation details and exposes only essential features.
* **Encapsulation** restricts access to data using access modifiers.

---

### What is the difference between an abstract class and an interface?

| Feature              | Abstract Class                            | Interface                           |
| -------------------- | ----------------------------------------- | ----------------------------------- |
| Methods              | Abstract and non-abstract methods allowed | Only abstract methods (before C# 8) |
| Fields               | Can contain fields                        | Cannot contain instance fields      |
| Access Modifiers     | Supports private, protected, etc.         | Members are public by default       |
| Multiple Inheritance | Not supported                             | Supported                           |

#### Abstract Class Example

```csharp
public abstract class Vehicle
{
    public abstract void Move();
    public void StartEngine() => Console.WriteLine("Engine started");
}

public class Car : Vehicle
{
    public override void Move() => Console.WriteLine("Car is moving");
}
```

#### Interface Example

```csharp
public interface IVehicle
{
    void Move();
}

public class Bike : IVehicle
{
    public void Move() => Console.WriteLine("Bike is moving");
}
```

---

## Additional OOP Questions

### What is a sealed class in C#?

A sealed class cannot be inherited.

```csharp
public sealed class Utility
{
    public static void PrintMessage() => Console.WriteLine("Hello!");
}
```

---

### What is the difference between composition and inheritance?

* **Inheritance**: "IS-A" relationship (Car is a Vehicle).
* **Composition**: "HAS-A" relationship (Car has an Engine).

```csharp
public class Engine
{
    public void Start() => Console.WriteLine("Engine started");
}

public class Car
{
    private Engine engine = new Engine();

    public void StartCar()
    {
        engine.Start();
    }
}
```

---

### How do you implement multiple inheritance in C#?

C# does not support multiple class inheritance, but similar behavior can be achieved using interfaces.

```csharp
public interface IWalk
{
    void Walk();
}

public interface IRun
{
    void Run();
}

public class Human : IWalk, IRun
{
    public void Walk() => Console.WriteLine("Walking...");
    public void Run() => Console.WriteLine("Running...");
}
```

---

## Access Modifiers in C#

Access modifiers control the visibility and accessibility of classes and members.

### public

Accessible from anywhere.

```csharp
public class Car
{
    public void Drive() { }
}
```

### private

Accessible only within the same class.

```csharp
class Car
{
    private void StartEngine() { }
}
```

### protected

Accessible within the same class or derived classes.

```csharp
class Vehicle
{
    protected void FuelUp() { }
}
```

### internal

Accessible within the same assembly.

```csharp
internal class Engine { }
```

### protected internal

Accessible within the same assembly or derived classes in another assembly.

```csharp
protected internal void Service() { }
```

### private protected (C# 7.2+)

Accessible only within the same class or derived classes in the same assembly.

```csharp
private protected void Reset() { }
```


---



## Notes

- The statement that interfaces contain only abstract methods is outdated; since C# 8, interfaces can include default implementations, static members, and private methods.
- The sealed class example contains only static members; sealing such a class is unnecessary because static classes cannot be inherited.
- The original encapsulation explanation contained a grammatically incomplete sentence which was corrected for clarity.

```