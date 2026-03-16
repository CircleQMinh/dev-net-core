---
id: middleware-and-filters
topic: Middleware and Filters in ASP.NET Core
category: .NET
---

Middleware and Filters are key extensibility mechanisms in ASP.NET Core. They help implement cross-cutting concerns such as logging, authentication, exception handling, and validation.

---

# Middleware Basics

## What is Middleware?

Middleware in ASP.NET Core:

- Processes HTTP requests and responses.
- Executes as part of the request pipeline.
- Can:
  - Inspect requests
  - Modify responses
  - Short-circuit the pipeline

Each middleware decides whether to call the next middleware.

---

## Configuring Middleware

Middleware is configured in the pipeline:

```csharp
public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    app.UseMiddleware<CustomMiddleware>();
}
````

Common built-in middleware:

* `app.UseRouting()`
* `app.UseAuthentication()`
* `app.UseAuthorization()`
* `app.UseEndpoints()`
* `app.UseStaticFiles()`
* `app.UseCors()`

---

## Middleware Execution Order

* Middleware runs **in the order it is registered**.
* Order matters.
* The first registered middleware handles the request first.

Response flows back in reverse order.

---

## Use vs Run

### Use()

* Calls the next middleware.
* Allows pre and post logic.

```csharp
app.Use(async (context, next) =>
{
    // Before
    await next();
    // After
});
```

### Run()

* Terminates the pipeline.
* Does NOT call next middleware.

```csharp
app.Run(async context =>
{
    await context.Response.WriteAsync("Final Middleware");
});
```

---

# Creating Custom Middleware

Custom middleware must:

* Accept `RequestDelegate`
* Implement `Invoke` or `InvokeAsync`

```csharp
public class CustomMiddleware
{
    private readonly RequestDelegate _next;

    public CustomMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Custom logic
        await _next(context);
    }
}
```

---

# Global Exception Handling with Middleware

ASP.NET Core provides built-in exception handling middleware:

```csharp
public void Configure(IApplicationBuilder app)
{
    app.UseExceptionHandler("/Home/Error");
}
```

Also available:

* `app.UseDeveloperExceptionPage()` (development only)

Middleware is ideal for global error handling.

---

# Filters in ASP.NET Core

## What Are Filters?

Filters:

* Execute before/after controller actions
* Handle cross-cutting concerns at the action level

Used for:

* Authorization
* Logging
* Validation
* Caching

---

## Types of Filters

| Filter Type   | Purpose                            |
| ------------- | ---------------------------------- |
| Authorization | Runs before action to check access |
| Resource      | Runs before other filters          |
| Action        | Before and after action method     |
| Result        | Before and after result execution  |
| Exception     | Handles unhandled exceptions       |

---

## Applying Filters

### Action Level

```csharp
[Authorize]
public IActionResult MyAction()
{
    return View();
}
```

### Controller Level

```csharp
[ServiceFilter(typeof(MyCustomFilter))]
public class MyController : Controller
{
}
```

### Global Level

```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddControllersWithViews(options =>
    {
        options.Filters.Add(new MyGlobalFilter());
    });
}
```

---

# IActionFilter

Allows logic before and after an action method.

```csharp
public class MyActionFilter : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        // Before action
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
        // After action
    }
}
```

---

# IAsyncActionFilter

Async version of action filter.

Used when awaiting async operations.

---

# IResultFilter

Allows logic before and after result execution.

Methods:

* `OnResultExecuting`
* `OnResultExecuted`

---

# IExceptionFilter

Handles unhandled exceptions in controller execution.

```csharp
public class MyExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        context.ExceptionHandled = true;
    }
}
```

---

# Middleware vs Filters

| Middleware                       | Filters                           |
| -------------------------------- | --------------------------------- |
| Global pipeline level            | Controller/action level           |
| Executes before MVC              | Executes inside MVC               |
| Can short-circuit entire request | Scoped to actions/results         |
| Good for logging, auth, CORS     | Good for validation, action logic |

---

## Can They Be Used Together?

Yes.

* Middleware handles global concerns.
* Filters handle action-specific concerns.
* Filters execute after middleware routing has selected the endpoint.

---

# Common Middleware Use Cases

* Logging
* Rate limiting
* Feature flags
* Authentication
* Global exception handling

---

# Key Interview Takeaways

* Middleware order matters.
* `Use()` calls next, `Run()` terminates.
* Filters are MVC-specific.
* Middleware is global and framework-level.
* Exception handling can be implemented in both (different scopes).

---

## Notes

* Filters only apply to MVC endpoints (controllers).
* Middleware runs for all HTTP requests.
* Response flows back through middleware in reverse order.
* For Minimal APIs, endpoint filters (introduced later) differ from MVC filters.

```
