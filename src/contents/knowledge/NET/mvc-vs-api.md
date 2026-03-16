---
id: mvc-vs-api
topic: ASP.NET MVC vs Web API
category: .NET
---

ASP.NET MVC and Web API are two application styles within ASP.NET used for different purposes, though in ASP.NET Core they are unified under the same framework.



---

# Core Differences

## What is the difference between MVC and Web API?

### MVC (Model-View-Controller)

- Designed for server-side rendered web applications
- Returns **HTML views**
- Uses Razor (.cshtml)
- Suitable for traditional web apps

### Web API

- Designed for RESTful services
- Returns **data (JSON/XML)**
- No view rendering
- Used by:
  - SPA (React, Angular)
  - Mobile apps
  - External clients

---

## Can MVC and API Be Used Together?

Yes.

In ASP.NET Core:

- Both are unified under `Microsoft.AspNetCore.Mvc`
- You can mix:
  - View controllers
  - API controllers
- Same routing and DI system

---

# Return Types

| MVC | Web API |
|------|----------|
| ViewResult | ObjectResult |
| IActionResult | IActionResult |
| RedirectResult | JsonResult |
| PartialViewResult | Ok(), BadRequest(), etc. |

MVC returns HTML.  
API returns structured data.

---

# Routing

### Classic ASP.NET MVC

- Convention-based routing
- `routes.MapRoute()`

### ASP.NET Core

- Primarily attribute routing

```csharp
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
}
````

---

# Controller vs ControllerBase

| Controller                  | ControllerBase  |
| --------------------------- | --------------- |
| Used for MVC                | Used for APIs   |
| Supports View()             | No view support |
| Includes ViewData, TempData | Lightweight     |

Use:

* `Controller` → HTML rendering
* `ControllerBase` → APIs

---

# When to Use MVC vs API

| Use Case             | Recommendation |
| -------------------- | -------------- |
| Render HTML          | MVC            |
| Provide data for SPA | API            |
| Mobile backend       | API            |
| Traditional website  | MVC            |

---

# Content Negotiation

### Web API

* Uses Accept header
* Automatically returns:

  * JSON
  * XML
  * Other formatters

### MVC

* Primarily returns HTML
* Content negotiation less relevant

---

# [ApiController] Attribute

Introduced in ASP.NET Core.

Benefits:

* Automatic model validation
* Automatic 400 responses
* Binding source inference
* Consistent API behavior

Example:

```csharp
[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
}
```

---

# Model Validation

Both MVC and API use Data Annotations:

* `[Required]`
* `[Range]`
* `[StringLength]`

Difference:

* MVC → Must check `ModelState.IsValid`
* API with `[ApiController]` → Automatic 400 response

---

# Parameter Binding Attributes

Used mostly in APIs:

* `[FromBody]`
* `[FromRoute]`
* `[FromQuery]`
* `[FromForm]`
* `[FromHeader]`

Example:

```csharp
public IActionResult Get(
    [FromRoute] int id,
    [FromQuery] string filter)
```

---

# Filters in MVC vs API

Filters apply to both unless view-specific.

## Filter Types

| Type          | Purpose             |
| ------------- | ------------------- |
| Authorization | Security            |
| Resource      | Wraps pipeline      |
| Action        | Before/after action |
| Exception     | Handle errors       |
| Result        | Modify result/view  |

---

## Result Filters

* MVC → Used to modify ViewResult
* API → Rarely used (no views)

---

# Example: MVC Filter

```csharp
public class LogActionFilter : ActionFilterAttribute
{
    public override void OnActionExecuting(
        ActionExecutingContext context)
    {
        Console.WriteLine("Before MVC action.");
    }

    public override void OnActionExecuted(
        ActionExecutedContext context)
    {
        Console.WriteLine("After MVC action.");
    }
}
```

---

# Example: API Filter

```csharp
[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll()
        => Ok(new[] { "item1", "item2" });
}
```

---

# Authentication

| MVC               | API         |
| ----------------- | ----------- |
| Cookie-based auth | JWT / OAuth |
| Session-based     | Stateless   |

MVC often uses cookies.
APIs usually use JWT tokens.

---

# Swagger (API Only)

Swagger (via Swashbuckle):

* Generates API documentation
* Provides interactive UI
* Tests endpoints

Typically not used in pure MVC applications.

---

# Applying Filters

Filters can be applied at:

| Scope      | Description               |
| ---------- | ------------------------- |
| Global     | All controllers           |
| Controller | All actions in controller |
| Action     | Specific action           |
| Service    | Via DI                    |

---

## Global Filter Example

```csharp
services.AddControllersWithViews(options =>
{
    options.Filters.Add(typeof(LogActionFilter));
});
```

Applies to MVC and API controllers.

---

# Summary

| Aspect         | MVC      | Web API       |
| -------------- | -------- | ------------- |
| View rendering | Yes      | No            |
| Returns        | HTML     | JSON/XML      |
| Result filters | Yes      | Rare          |
| UI interaction | Yes      | No            |
| Common usage   | Websites | Services/APIs |

---

# Key Interview Takeaways

* MVC = server-side HTML rendering.
* API = data endpoints.
* ControllerBase is for APIs.
* [ApiController] enables automatic validation.
* Both share same filter pipeline in ASP.NET Core.
* APIs use content negotiation.
* MVC often uses cookies; APIs use tokens.

---

## Notes

* In ASP.NET Core, MVC and Web API are unified; there is no separate "Web API project type".
* Result filters technically work in APIs but are rarely meaningful since APIs do not return views.
* Minimal APIs (introduced in .NET 6) are an alternative to traditional API controllers.

```
