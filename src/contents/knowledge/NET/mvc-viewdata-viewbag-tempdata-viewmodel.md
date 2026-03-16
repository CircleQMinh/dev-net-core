---
id: mvc-viewdata-viewbag-tempdata-viewmodel
topic: ViewData vs ViewBag vs TempData vs ViewModel in ASP.NET MVC
category: .NET
---

In ASP.NET MVC (and ASP.NET Core MVC), “view-related data passing” refers to ways of sending data from **Controller → View**.

The common approaches are:

- ViewData
- ViewBag
- TempData
- Strongly-Typed ViewModel

---

#  ViewData

## What It Is

`ViewData` is a dictionary:

```csharp
ViewData["Message"] = "Hello";
````

Under the hood:

```csharp
public ViewDataDictionary ViewData { get; set; }
```

It stores values as `object`.

---

## Reading in the View

```csharp
<h2>@ViewData["Message"]</h2>
```

---

## Characteristics

* Type: `Dictionary<string, object>`
* Requires casting for complex types
* Lifetime: Current request only
* Older pattern

Example with casting:

```csharp
ViewData["Count"] = 10;
int count = (int)ViewData["Count"];
```

---

#  ViewBag

## What It Is

`ViewBag` is a dynamic wrapper around `ViewData`.

Instead of:

```csharp
ViewData["Message"] = "Hello";
```

You write:

```csharp
ViewBag.Message = "Hello";
```

---

## Reading in the View

```csharp
<h2>@ViewBag.Message</h2>
```

---

## Important Fact

`ViewBag` internally uses `ViewData`.

This works:

```csharp
ViewBag.Name = "Minh";
Console.WriteLine(ViewData["Name"]); // Minh
```

They share the same storage.

---

## Characteristics

* Dynamic (no compile-time checking)
* Cleaner syntax
* Same lifetime as ViewData (one request)

---

#  TempData

## What It Is

`TempData` is used to pass data between requests.

Example:

```csharp
TempData["Success"] = "Saved successfully";
return RedirectToAction("Index");
```

In the Index view:

```csharp
@TempData["Success"]
```

---

## Characteristics

* Uses session (or cookies in ASP.NET Core via TempData providers)
* Survives redirect
* Removed after it is read (one-time use)
* Useful for PRG (Post-Redirect-Get) pattern

---

#  Strongly-Typed ViewModel (Best Practice)

Instead of using dynamic or dictionary-based approaches:

## Controller

```csharp
public IActionResult Index()
{
    var model = new UserViewModel
    {
        Name = "Minh",
        Age = 25
    };

    return View(model);
}
```

## View

```csharp
@model UserViewModel

<h2>@Model.Name</h2>
```

---

## Characteristics

* Compile-time safety
* IntelliSense support
* Clean and maintainable
* Recommended for real projects

---

# Comparison Table

| Feature                  | ViewData        | ViewBag          | TempData                | ViewModel       |
| ------------------------ | --------------- | ---------------- | ----------------------- | --------------- |
| Type Safe                | ❌ No            | ❌ No             | ❌ No                    | ✅ Yes           |
| Lifetime                 | Current request | Current request  | Next request (redirect) | Current request |
| Requires Casting         | Yes             | No               | Yes                     | No              |
| Uses Dictionary          | Yes             | Yes (internally) | Yes                     | No              |
| Recommended for real app | ❌               | ❌                | Sometimes               | ✅               |

---

# When to Use What?

## ✅ Use ViewModel (Recommended)

For rendering real application data.

---

## ⚠ Use ViewBag / ViewData

For:

* Small flags
* Page titles
* Simple messages

Example:

```csharp
ViewBag.Title = "User List";
```

---

## ⚠ Use TempData

For:

* Success messages after redirect
* Error notifications after form submission

---

# Modern ASP.NET Core Best Practice

In professional projects:

* Use **strongly-typed ViewModels**
* Use `TempData` only for redirect messages
* Rarely use ViewBag/ViewData in serious applications

---

## Key Interview Points

* ViewData = dictionary-based
* ViewBag = dynamic wrapper over ViewData
* TempData = survives one redirect
* ViewModel = strongly-typed and recommended
* ViewBag and ViewData share the same storage internally

---

## Notes

1. In ASP.NET Core, TempData uses a provider (cookie-based by default).
2. ViewBag does not provide compile-time safety because it relies on dynamic typing.
3. ViewModel is the recommended approach for maintainable and testable MVC applications.

```
