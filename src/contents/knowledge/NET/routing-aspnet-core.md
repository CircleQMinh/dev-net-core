---
id: routing-aspnet-core
topic: Routing in ASP.NET Core
category: .NET
---

Routing in ASP.NET Core is the mechanism that maps incoming HTTP requests to controller action methods.

---

# Basic Routing Concepts

## What is Routing?

Routing:

- Matches incoming HTTP requests
- Maps URL patterns to controllers and actions
- Extracts route values (e.g., id)

Example:

```

/products/details/5

```

Maps to:

```

ProductsController.Details(int id)

````

---

## Types of Routing

### 1. Conventional Routing

- Defined globally
- Pattern-based
- Uses route templates

### 2. Attribute Routing

- Defined directly on controllers/actions
- Uses attributes like:
  - `[Route]`
  - `[HttpGet]`
  - `[HttpPost]`

---

# Conventional Routing

Example:

```csharp
app.UseEndpoints(endpoints =>
{
    endpoints.MapControllerRoute(
        name: "default",
        pattern: "{controller=Home}/{action=Index}/{id?}");
});
````

Meaning:

* Default controller = Home
* Default action = Index
* id = optional

---

## How Conventional Routing Works

Pattern:

```
{controller}/{action}/{id}
```

Example:

```
/products/details/5
```

Maps to:

```
ProductsController.Details(5)
```

---

## Pros & Cons

### Pros

* Simple
* Less duplication
* Good for small apps

### Cons

* Less flexible
* Harder for RESTful APIs
* Harder to manage complex routes

---

# Attribute Routing

Attribute routing defines routes directly on controllers or actions.

Example:

```csharp
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpGet("{id}")]
    public IActionResult GetById(int id)
    {
        return Ok();
    }
}
```

---

## Benefits of Attribute Routing

* Explicit routes
* Better for REST APIs
* Fine-grained control
* Easier maintenance in large apps

---

# Route Parameters

Example:

```csharp
[HttpGet("products/{id}")]
public IActionResult GetProduct(int id)
```

---

## Route Constraints

Constraints restrict route values.

Examples:

* `{id:int}`
* `{slug:alpha}`
* `{price:decimal:min(0):max(9999)}`

Example:

```csharp
[HttpGet("products/{id:int:min(1)}")]
```

---

# Route Prefixes

Example:

```csharp
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll()
    {
        return Ok();
    }
}
```

Custom prefix:

```csharp
[Route("store/products")]
```

---

# [Route] vs [HttpGet]/[HttpPost]

| Attribute  | Purpose                            |
| ---------- | ---------------------------------- |
| [Route]    | Defines route template             |
| [HttpGet]  | Defines GET verb + optional route  |
| [HttpPost] | Defines POST verb + optional route |

Example:

```csharp
[HttpGet("products/{id}")]
```

Combines HTTP method and route.

---

# Named Routes

Example:

```csharp
[HttpGet("details/{id}", Name = "GetProductDetails")]
public IActionResult Details(int id)
{
    return Ok();
}
```

Usage:

```csharp
return RedirectToRoute("GetProductDetails", new { id = 5 });
```

---

# Order in Routing

```csharp
[Route("api/products", Order = 1)]
```

Lower `Order` value = higher priority.

---

# Handling Route Conflicts

To avoid conflicts:

* Use route constraints
* Avoid overlapping templates
* Differentiate by HTTP verb

Example:

```csharp
[HttpGet("product/{id}")]
public IActionResult Get(int id)

[HttpDelete("product/{id}")]
public IActionResult Delete(int id)
```

---

# Optional Parameters

```csharp
[HttpGet("products/{id?}")]
```

Default value:

```csharp
[HttpGet("products/{id=1}")]
```

---

# Catch-All Routes

Capture remaining URL segments:

```csharp
[HttpGet("blog/{*slug}")]
```

Example:

```
/blog/2025/aspnet/routing
```

slug = "2025/aspnet/routing"

---

# Route Precedence

More specific routes:

* Fewer optional parameters
* No wildcards
* More constraints

Have higher priority over generic routes.

---

# Attribute vs Conventional Together

If both are configured:

* Attribute routes are evaluated first
* If no match → conventional routing applies

---

# Endpoint Routing

Introduced in ASP.NET Core 3.0.

Features:

* Centralized routing system
* Unified routing for:

  * MVC
  * Razor Pages
  * SignalR
  * Minimal APIs
* Improved performance

Example:

```csharp
app.UseRouting();

app.UseEndpoints(endpoints =>
{
    endpoints.MapControllers();
});
```

---

# Can Two Actions Have Same Route?

No — unless differentiated by HTTP verb.

Valid:

```csharp
[HttpGet("product/{id}")]
public IActionResult Get(int id)

[HttpDelete("product/{id}")]
public IActionResult Delete(int id)
```

Invalid:

Two `[HttpGet("product/{id}")]` methods → conflict.

---

# Key Interview Takeaways

* Routing maps URLs to controller actions.
* Two types: Conventional & Attribute.
* Attribute routing preferred for APIs.
* Route constraints improve safety.
* Order affects route priority.
* Endpoint routing unified routing system.
* Attribute routes evaluated before conventional routes.

---

## Notes

* In .NET 6+, minimal APIs provide route mapping without controllers.
* Route precedence is determined by template specificity and order.
* Attribute routing is generally preferred in modern RESTful API design.
* Attribute routes are not strictly evaluated “before” conventional routes; endpoint routing builds a unified route table, but attribute routes are typically more specific and therefore match first due to precedence rules.
* In minimal hosting (ASP.NET Core 6+), `MapControllerRoute` is often configured directly in `Program.cs` rather than `Startup.cs`.

```
