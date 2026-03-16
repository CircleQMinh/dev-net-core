---
id: middleware-and-request-pipeline
topic: Middleware and Request Pipeline in ASP.NET Core
category: .NET
---

Middleware and the Request Pipeline are core concepts in ASP.NET Core that determine how HTTP requests are processed.

---

# Basic Concepts

## What is Middleware?

Middleware in ASP.NET Core:

- Is a component in the HTTP request pipeline
- Processes requests and responses
- Can:
  - Inspect the request
  - Modify the request or response
  - Short-circuit the pipeline
  - Pass control to the next middleware

Middleware executes in the order it is added.

---

## What is the Request Pipeline?

The Request Pipeline is a sequence of middleware components.

### Flow:

1. HTTP request arrives
2. Request passes through middleware (in order)
3. Routing selects endpoint (if applicable)
4. Controller/action executes
5. Response flows back through middleware (reverse order)
6. Final HTTP response sent

Middleware can terminate the pipeline early (e.g., return 404 or 401).

---

## Middleware Ordering

Order is critical.

Examples:

- Exception handling → near the top
- Authentication → before Authorization
- Routing → before Endpoints

Middleware is registered using:

- `app.Use(...)`
- `app.Run(...)`
- `app.Map(...)`

---

# Built-in Middleware

Common middleware components:

- `app.UseRouting()`
- `app.UseAuthentication()`
- `app.UseAuthorization()`
- `app.UseEndpoints()`
- `app.UseExceptionHandler()`
- `app.UseStaticFiles()`
- `app.UseCors()`
- `app.UseHttpsRedirection()`

---

# Use vs Run

## Use()

- Can call next middleware
- Allows pre/post execution

```csharp
app.Use(async (context, next) =>
{
    // Before
    await next();
    // After
});
````

## Run()

* Terminal middleware
* Does NOT call next

```csharp
app.Run(async context =>
{
    await context.Response.WriteAsync("Request processed.");
});
```

---

# Use vs Map

## Use()

* Applies to every request

## Map()

* Applies only to specific path

```csharp
app.Map("/admin", adminApp =>
{
    adminApp.Run(async context =>
    {
        await context.Response.WriteAsync("Admin Panel");
    });
});
```

Only triggers for `/admin`.

---

# UseWhen (Conditional Middleware)

Adds middleware conditionally.

```csharp
app.UseWhen(
    context => context.Request.Path.StartsWithSegments("/api"),
    apiApp =>
    {
        apiApp.UseMiddleware<ApiMiddleware>();
    });
```

---

# Creating Custom Middleware

## Step 1: Create Middleware Class

```csharp
public class CustomMiddleware
{
    private readonly RequestDelegate _next;

    public CustomMiddleware(RequestDelegate next)
    {
        _next = next ?? throw new ArgumentNullException(nameof(next));
    }

    public async Task InvokeAsync(HttpContext context)
    {
        Console.WriteLine("Before next middleware");

        await _next(context);

        Console.WriteLine("After next middleware");
    }
}
```

---

## Step 2: Register Middleware

```csharp
public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    app.UseMiddleware<CustomMiddleware>();

    app.UseRouting();
    app.UseAuthorization();

    app.UseEndpoints(endpoints =>
    {
        endpoints.MapControllers();
    });
}
```

---

# Request/Response Transformation

Middleware can:

### Modify Request

* Headers
* Body
* Path
* Query string

### Modify Response

* Add headers
* Change status code
* Wrap response body
* Compress output

---

# Logging Middleware Example

```csharp
public class LoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<LoggingMiddleware> _logger;

    public LoggingMiddleware(
        RequestDelegate next,
        ILogger<LoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        _logger.LogInformation("Handling request: " + context.Request.Path);

        await _next(context);

        _logger.LogInformation("Finished request: " + context.Response.StatusCode);
    }
}
```

---

# Global Error Handling

Built-in:

```csharp
app.UseExceptionHandler("/Home/Error");
app.UseStatusCodePagesWithReExecute("/Home/Error/{0}");
```

Custom handling:

```csharp
public async Task InvokeAsync(HttpContext context)
{
    try
    {
        await _next(context);
    }
    catch (Exception ex)
    {
        context.Response.StatusCode = 500;
        await context.Response.WriteAsync("Unexpected error");
    }
}
```

---

# IApplicationBuilder

`IApplicationBuilder`:

* Used in `Startup.Configure`
* Builds the middleware pipeline
* Provides:

  * `Use`
  * `Run`
  * `Map`
  * `UseWhen`

---

# Asynchronous Processing

ASP.NET Core middleware supports async/await.

Benefits:

* Non-blocking I/O
* High scalability
* Better throughput

Example:

```csharp
await _next(context);
```

---

# Lifecycle Summary

```
Incoming Request
        ↓
Middleware #1
        ↓
Middleware #2
        ↓
Routing
        ↓
Controller Action
        ↓
Response
        ↑
Middleware #2
        ↑
Middleware #1
        ↑
Client
```

---

# Example Use Cases

* Logging middleware
* JWT authentication middleware
* Rate limiting middleware
* Feature flag middleware
* Exception handling middleware
* Response compression middleware

---

# Key Interview Points

* Middleware order matters.
* `Use()` can call next; `Run()` terminates.
* Request flows forward; response flows backward.
* `Map()` branches pipeline.
* `UseWhen()` conditionally applies middleware.
* Middleware is framework-level; not MVC-specific.

---

## Notes

* Middleware runs for all HTTP requests.
* Response passes back through middleware in reverse order.
* In modern ASP.NET Core (minimal hosting model), middleware is configured in `Program.cs` instead of `Startup.cs`.
* Endpoint routing must be configured in correct order relative to authentication/authorization.

# Example
```csharp
using FluentValidation;
using Sample.Cqrs.Domain.Common;
using System.Net;
using System.Text.Json;

public sealed class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(
        RequestDelegate next,
        ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning(ex, "Validation error");

            await WriteResponseAsync(
                context,
                HttpStatusCode.BadRequest,
                ex.Errors.Select(e => e.ErrorMessage));
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Resource not found");

            await WriteResponseAsync(
                context,
                HttpStatusCode.NotFound,
                new[] { ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access");

            await WriteResponseAsync(
                context,
                HttpStatusCode.Unauthorized,
                new[] { "Unauthorized" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception");

            await WriteResponseAsync(
                context,
                HttpStatusCode.InternalServerError,
                new[] { "An unexpected error occurred" });
        }
    }

    private static async Task WriteResponseAsync(
        HttpContext context,
        HttpStatusCode statusCode,
        IEnumerable<string> errors)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;

        var response = BaseResponse<object>.Failure(errors);

        var json = JsonSerializer.Serialize(
            response,
            new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

        await context.Response.WriteAsync(json);
    }
}

```