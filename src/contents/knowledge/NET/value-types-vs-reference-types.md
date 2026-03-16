---
id: value-types-vs-reference-types
topic: Value Types vs. Reference Types
category: .NET
---

## General Concepts

### What is the difference between value types and reference types?

Value types and reference types differ in how they store and manage data in memory.

- **Value Types**: Store the actual data directly.
- **Reference Types**: Store a reference (memory address) to the actual data.

| Feature        | Value Type                          | Reference Type                                  |
| -------------- | ----------------------------------- | ----------------------------------------------- |
| Typical Storage| Inline storage (often stack for locals) | Object data on heap, reference stored inline |
| Contains       | Actual data                         | Reference to data                              |
| Copy Behavior  | Creates a copy of the data          | Copies reference (both point to same object)   |
| Default Value  | Default value (e.g., 0 for int)     | null (unless initialized)                      |
| Examples       | int, float, char, struct            | class, array, interface, string                |

> **Note:** It is a common simplification that value types live on the stack and reference types live on the heap. In reality, value types can also exist on the heap (for example, when they are fields inside a class or when boxed). The key difference is how data is stored, not strictly where.

---

### What are some examples of value types and reference types in C#?

- **Value Types**: `int`, `float`, `double`, `char`, `bool`, `enum`, `struct`
- **Reference Types**: `class`, `string`, `object`, `array`, `delegate`, `interface`

---

## Parameter Passing Behavior

### What happens when you pass value types vs. reference types as parameters?

- **Value Type**: Passed by value (a new copy is created).
- **Reference Type**: The reference is passed by value. Both variables refer to the same object instance.

> **Important:** Reference types are **not** passed by reference by default. The reference itself is copied. The object can be modified through the copied reference, but reassignment requires `ref` or `out`.

#### Example: Passing Value Type (No Change in Original)

```csharp
void Modify(int num)
{
    num = 20;  // Changes local copy
}

int x = 10;
Modify(x);
Console.WriteLine(x); // 10 (Unchanged)
````

---

#### Example: Passing Reference Type (Changes the Original Object)

```csharp
class Person
{
    public string Name { get; set; }
}

void Modify(Person p)
{
    p.Name = "Changed"; // Modifies the original object
}

Person p1 = new Person { Name = "Original" };
Modify(p1);
Console.WriteLine(p1.Name); // "Changed"
```

---

## Struct vs Class

### How do struct and class differ in terms of memory allocation?

#### struct (Value Type)

* Typically allocated inline (stack for local variables).
* Does not support inheritance from another struct or class (except implicitly from `System.ValueType`).
* Suitable for small, lightweight data structures.

#### class (Reference Type)

* Object allocated on the heap.
* Supports inheritance.
* Suitable for complex objects and behaviors.

#### Example: struct vs class Behavior

```csharp
struct Point
{
    public int X, Y;
}

class Rectangle
{
    public int Width, Height;
}

Point p1 = new Point { X = 5, Y = 10 };
Point p2 = p1;  // Copies data
p2.X = 100;
Console.WriteLine(p1.X); // 5 (Unchanged)

Rectangle r1 = new Rectangle { Width = 5, Height = 10 };
Rectangle r2 = r1;  // Copies reference
r2.Width = 100;
Console.WriteLine(r1.Width); // 100 (Changed)
```

---

## String Behavior

### Is string a value type or reference type? Why does it behave like a value type?

`string` is a **reference type**, but it behaves like a value type because it is **immutable** (it cannot be changed after creation).

```csharp
string s1 = "Hello";
string s2 = s1;

s2 = "World";

Console.WriteLine(s1); // "Hello" (Unchanged)
Console.WriteLine(s2); // "World"
```

Although `s2` was assigned from `s1`, reassigning `s2` creates a new string instance instead of modifying the original.

---

## ref and out Keywords

### How do ref and out modify value types to behave like reference types?

By default, value types are copied when passed to methods. Using `ref` or `out`, you pass the variable by reference.

#### Using ref (Requires Initialization)

```csharp
void Modify(ref int x)
{
    x = 50; // Modifies the original variable
}

int num = 10;
Modify(ref num);
Console.WriteLine(num); // 50
```

---

#### Using out (Does Not Require Initialization)

```csharp
void GetValues(out int a, out int b)
{
    a = 10;
    b = 20;
}

int x, y;
GetValues(out x, out y);
Console.WriteLine(x); // 10
Console.WriteLine(y); // 20
```

---

## Boxing and Unboxing

### What is boxing and unboxing? How does it relate to value/reference types?

* **Boxing**: Converting a value type to a reference type (e.g., storing an `int` in an `object`).
* **Unboxing**: Converting a reference type back to a value type.

```csharp
int num = 10;
object obj = num;  // Boxing (value type → reference type)

int num2 = (int)obj;  // Unboxing (reference type → value type)
```

**Performance Impact:** Boxing and unboxing cause additional memory allocation and should be minimized in performance-critical scenarios.

---

## Notes

- None

```