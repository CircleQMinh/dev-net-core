---
id: aspnet-core-filters-and-middleware-boundaries
topic: API design and implementation
subtopic: ASP.NET Core filters and middleware boundaries
category: .NET
---


## Overview

Filters in ASP.NET Core are components that run before or after specific stages of the MVC or API action execution pipeline. They are commonly used for cross-cutting behavior such as authorization checks, request validation, response customization, caching decisions, exception handling, and result transformation.

Middleware and filters are related, but they operate at different levels. Middleware belongs to the broader ASP.NET Core request pipeline and works with low-level HTTP concepts through `HttpContext`. Filters belong to the MVC/action invocation pipeline and work with higher-level concepts such as selected actions, model binding, action arguments, `ModelState`, action results, and controller metadata.

This topic matters because many production APIs need behavior that is applied consistently across many endpoints. Examples include authentication, authorization, logging, exception handling, validation, caching, response headers, audit behavior, and standardized error responses. Choosing the wrong extension point can cause duplicated logic, incorrect execution order, missed exceptions, broken authorization, or inconsistent API behavior.

This is important for interviews because it tests whether a developer understands how ASP.NET Core processes requests beyond simply writing controller actions. A strong candidate should know when to use middleware, when to use filters, how different filter types execute, how filters can short-circuit the pipeline, and why authorization policies and exception middleware are often better choices than custom filters for certain scenarios.

## Core Concepts

### Middleware vs Filters

Middleware is part of the ASP.NET Core request pipeline. It is configured in `Program.cs` with methods such as `Use`, `Run`, `Map`, `UseRouting`, `UseAuthentication`, `UseAuthorization`, and `MapControllers`.

Middleware works at the HTTP pipeline level:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

var app = builder.Build();

app.UseExceptionHandler("/error");
app.UseHttpsRedirection();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
```

Filters work inside the MVC/action pipeline after routing has selected an endpoint and ASP.NET Core is preparing to execute a controller action.

A simplified flow looks like this:

```text
HTTP request
  -> middleware pipeline
    -> routing
    -> authentication middleware
    -> authorization middleware
    -> endpoint execution
      -> MVC filter pipeline
        -> authorization filters
        -> resource filters
        -> model binding
        -> action filters
        -> action method
        -> exception filters
        -> result filters
        -> result execution
  -> HTTP response
```

The key difference is scope:

| Concern | Middleware | Filter |
|---|---|---|
| Level | Whole HTTP pipeline | MVC/API action pipeline |
| Main context | `HttpContext` | MVC contexts such as `ActionExecutingContext`, `ResourceExecutingContext`, `ResultExecutingContext` |
| Runs before routing? | Can run before or after routing depending on order | Runs after action selection |
| Access to action arguments | No direct access | Yes, action filters can inspect or modify arguments |
| Access to `ModelState` | No direct MVC context | Yes |
| Works for static files, health checks, minimal APIs, MVC, Razor Pages | Yes, depending on placement | Mostly MVC/Razor Pages; endpoint filters cover route-handler style endpoints |
| Best for | Global HTTP concerns | Action/controller-specific cross-cutting concerns |

### The Filter Pipeline

Filters run in a defined order. Each filter type exists for a specific stage of request processing.

The common MVC filter types are:

1. Authorization filters
2. Resource filters
3. Action filters
4. Exception filters
5. Result filters

The order matters because each filter type sees the request at a different stage.

```text
Authorization filters
  -> Resource filters
    -> Model binding
      -> Action filters
        -> Action method
      -> Exception filters
      -> Result filters
        -> Result execution
  -> Resource filters after-code
```

This order explains why each filter is useful for different problems. For example, a resource filter can run before model binding, but an action filter runs after model binding. An exception filter can handle exceptions thrown by an action, but it does not catch exceptions thrown by earlier middleware.

### Authorization Filters

Authorization filters run first in the filter pipeline. Their job is to determine whether the current user is allowed to access the selected action.

Most applications should use built-in authorization attributes and policies instead of writing custom authorization filters:

```csharp
[Authorize(Policy = "CanManageOrders")]
[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    [HttpDelete("{id:int}")]
    public IActionResult DeleteOrder(int id)
    {
        return NoContent();
    }
}
```

Authorization filters can short-circuit the pipeline if the request is not authorized. In practice, this usually results in a challenge, forbid response, or an authorization failure.

Important habits:

- Prefer authorization policies and requirements for business authorization rules.
- Avoid throwing exceptions from authorization filters.
- Do not use action filters for authorization.
- Keep authentication in middleware and authorization policy logic in the authorization system.
- Use resource-based authorization when the decision depends on a specific resource loaded from the database.

Example resource-based authorization pattern:

```csharp
[Authorize]
[ApiController]
[Route("api/documents")]
public class DocumentsController : ControllerBase
{
    private readonly IAuthorizationService _authorizationService;
    private readonly IDocumentRepository _documents;

    public DocumentsController(
        IAuthorizationService authorizationService,
        IDocumentRepository documents)
    {
        _authorizationService = authorizationService;
        _documents = documents;
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetDocument(int id)
    {
        var document = await _documents.GetByIdAsync(id);

        if (document is null)
        {
            return NotFound();
        }

        var result = await _authorizationService.AuthorizeAsync(
            User,
            document,
            "CanReadDocument");

        if (!result.Succeeded)
        {
            return Forbid();
        }

        return Ok(document);
    }
}
```

### Resource Filters

Resource filters run after authorization filters and before model binding. They wrap most of the MVC pipeline.

They are useful when behavior must happen before model binding or when the request can be short-circuited early.

Common use cases:

- Caching a full action response before model binding and action execution.
- Disabling form value model binding for large file uploads.
- Setting up data needed by model binding or action execution.
- Short-circuiting expensive requests before the action runs.

Example resource filter that short-circuits a request:

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

public sealed class MaintenanceModeFilter : IResourceFilter
{
    private readonly IConfiguration _configuration;

    public MaintenanceModeFilter(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public void OnResourceExecuting(ResourceExecutingContext context)
    {
        var isEnabled = _configuration.GetValue<bool>("MaintenanceMode");

        if (isEnabled)
        {
            context.Result = new ObjectResult(new
            {
                message = "The API is temporarily unavailable."
            })
            {
                StatusCode = StatusCodes.Status503ServiceUnavailable
            };
        }
    }

    public void OnResourceExecuted(ResourceExecutedContext context)
    {
    }
}
```

Register it globally:

```csharp
builder.Services.AddScoped<MaintenanceModeFilter>();

builder.Services.AddControllers(options =>
{
    options.Filters.Add<MaintenanceModeFilter>();
});
```

Because resource filters run before model binding, they should not depend on action parameters already being bound.

### Action Filters

Action filters run immediately before and after a controller action method executes. By this stage, routing has selected the action and model binding has usually populated action parameters.

Action filters can:

- Inspect action arguments.
- Modify action arguments.
- Validate request state.
- Short-circuit before the action executes.
- Inspect or replace the action result after the action executes.
- Add action-level audit or business logging.

Example action filter that validates `ModelState` manually:

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

public sealed class ValidateModelFilter : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (!context.ModelState.IsValid)
        {
            context.Result = new BadRequestObjectResult(context.ModelState);
        }
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
    }
}
```

Usage:

```csharp
[ServiceFilter<ValidateModelFilter>]
[HttpPost]
public IActionResult CreateOrder(CreateOrderRequest request)
{
    return CreatedAtAction(nameof(GetOrder), new { id = 123 }, request);
}
```

However, for modern ASP.NET Core APIs using `[ApiController]`, automatic model validation already returns a 400 response for invalid model state. Therefore, a custom validation action filter is not always needed.

Action filters are often a good fit for behavior that is closely tied to controller actions, such as:

- Auditing action arguments.
- Enforcing action-specific conventions.
- Normalizing action results.
- Adding metadata based on controller/action attributes.

They are not a good fit for low-level HTTP concerns such as CORS, HTTPS redirection, authentication, static files, or global exception handling across the entire app.

### Exception Filters

Exception filters handle unhandled exceptions that occur during action execution or result execution, before the response body has been written.

Example exception filter:

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

public sealed class ApiExceptionFilter : IExceptionFilter
{
    private readonly ILogger<ApiExceptionFilter> _logger;

    public ApiExceptionFilter(ILogger<ApiExceptionFilter> logger)
    {
        _logger = logger;
    }

    public void OnException(ExceptionContext context)
    {
        _logger.LogError(context.Exception, "Unhandled exception in MVC action.");

        context.Result = new ObjectResult(new
        {
            title = "Unexpected error",
            detail = "An unexpected error occurred while processing the request."
        })
        {
            StatusCode = StatusCodes.Status500InternalServerError
        };

        context.ExceptionHandled = true;
    }
}
```

Exception filters are useful for MVC-specific exception policies, but they have important limitations:

- They do not catch exceptions thrown by middleware.
- They do not catch exceptions thrown during routing.
- They do not catch exceptions thrown during model binding.
- They may not be useful once the response has already started.
- They only apply to MVC/action execution.

For most production APIs, centralized exception handling middleware is usually preferred for global error handling:

```csharp
app.UseExceptionHandler("/error");

app.Map("/error", () =>
{
    return Results.Problem(
        title: "Unexpected error",
        statusCode: StatusCodes.Status500InternalServerError);
});
```

A practical rule is:

- Use middleware for app-wide exception handling.
- Use exception filters only for MVC-specific exception transformation or controller/action-specific exception policies.

### Result Filters

Result filters run immediately before and after action results execute. They are useful for behavior that surrounds result execution, such as formatting, response headers, or result transformation.

Example result filter that adds a response header:

```csharp
using Microsoft.AspNetCore.Mvc.Filters;

public sealed class AddResponseHeaderFilter : IResultFilter
{
    public void OnResultExecuting(ResultExecutingContext context)
    {
        context.HttpContext.Response.Headers["X-Api-Version"] = "1.0";
    }

    public void OnResultExecuted(ResultExecutedContext context)
    {
    }
}
```

Result filters are useful when you need to affect the final result execution stage. For APIs, this often means:

- Adding headers.
- Applying response metadata.
- Wrapping successful responses in a consistent shape.
- Adding timing or diagnostic information after the action result is known.

Result filters usually run only when the action method executes successfully. They are not a replacement for exception handling.

### Synchronous vs Asynchronous Filters

Most filter types have both synchronous and asynchronous interfaces.

For example, action filters can be written using either `IActionFilter` or `IAsyncActionFilter`.

Synchronous example:

```csharp
public sealed class SampleActionFilter : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        // Before action.
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
        // After action.
    }
}
```

Asynchronous example:

```csharp
public sealed class SampleAsyncActionFilter : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(
        ActionExecutingContext context,
        ActionExecutionDelegate next)
    {
        // Before action.

        var executedContext = await next();

        // After action.
    }
}
```

Use asynchronous filters when the filter needs to perform asynchronous work, such as calling a database, cache, remote service, or authorization dependency.

Important habit:

- Do not implement both sync and async versions of the same filter type in the same class.
- Prefer async filters when any I/O is involved.
- Avoid blocking calls such as `.Result` or `.Wait()` inside filters.

### Filter Scope and Execution Order

Filters can be applied at different scopes:

- Globally to all controllers and actions.
- At the controller level.
- At the action level.

Example:

```csharp
builder.Services.AddControllers(options =>
{
    options.Filters.Add<GlobalAuditFilter>();
});
```

```csharp
[ServiceFilter<ControllerAuditFilter>]
[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    [ServiceFilter<ActionAuditFilter>]
    [HttpPost]
    public IActionResult CreateOrder(CreateOrderRequest request)
    {
        return Ok();
    }
}
```

By default, filters of the same stage nest by scope:

```text
Global before
  Controller before
    Action before
      Action method
    Action after
  Controller after
Global after
```

A filter with a lower `Order` value runs earlier on the way in and later on the way out.

```csharp
public sealed class OrderedAuditFilter : IActionFilter, IOrderedFilter
{
    public int Order => -100;

    public void OnActionExecuting(ActionExecutingContext context)
    {
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
    }
}
```

Use explicit ordering carefully. Too much ordering logic can make request behavior hard to understand.

### Dependency Injection in Filters

Filters often need dependencies such as loggers, repositories, caches, or configuration.

A common mistake is trying to inject services directly into an attribute constructor:

```csharp
// Avoid this pattern for services.
// Attribute constructor arguments must be known where the attribute is applied.
public sealed class BadFilterAttribute : Attribute, IActionFilter
{
    public BadFilterAttribute(IMyService service)
    {
    }

    public void OnActionExecuting(ActionExecutingContext context) { }

    public void OnActionExecuted(ActionExecutedContext context) { }
}
```

Better options include:

- Registering the filter type globally.
- Using `[ServiceFilter<TFilter>]`.
- Using `[TypeFilter]`.
- Implementing `IFilterFactory`.

Example with `ServiceFilter`:

```csharp
builder.Services.AddScoped<AuditActionFilter>();
```

```csharp
[ServiceFilter<AuditActionFilter>]
[HttpPost]
public IActionResult CreateOrder(CreateOrderRequest request)
{
    return Ok();
}
```

Example filter:

```csharp
public sealed class AuditActionFilter : IAsyncActionFilter
{
    private readonly ILogger<AuditActionFilter> _logger;

    public AuditActionFilter(ILogger<AuditActionFilter> logger)
    {
        _logger = logger;
    }

    public async Task OnActionExecutionAsync(
        ActionExecutingContext context,
        ActionExecutionDelegate next)
    {
        _logger.LogInformation(
            "Executing action {ActionName}",
            context.ActionDescriptor.DisplayName);

        var executedContext = await next();

        _logger.LogInformation(
            "Executed action {ActionName} with result {ResultType}",
            context.ActionDescriptor.DisplayName,
            executedContext.Result?.GetType().Name);
    }
}
```

When adding filter instances directly to MVC options, be careful because the same instance can be reused across requests. Avoid mutable state inside filters unless the lifetime and thread-safety behavior are clearly understood.

### Short-Circuiting

Both middleware and filters can short-circuit execution, but they do it differently.

Middleware short-circuits by not calling `next`:

```csharp
app.Use(async (context, next) =>
{
    if (!context.Request.Headers.ContainsKey("X-Correlation-Id"))
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsync("Missing correlation id.");
        return;
    }

    await next();
});
```

Filters short-circuit by setting `context.Result`:

```csharp
public sealed class RequireHeaderFilter : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (!context.HttpContext.Request.Headers.ContainsKey("X-Correlation-Id"))
        {
            context.Result = new BadRequestObjectResult(new
            {
                error = "Missing X-Correlation-Id header."
            });
        }
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
    }
}
```

Use short-circuiting carefully. It is powerful, but it can make behavior harder to trace if many filters and middleware components can stop the request.

### Choosing the Right Tool

A practical decision guide:

| Requirement | Better choice | Reason |
|---|---|---|
| Global exception handling for all requests | Middleware | Catches exceptions outside MVC, including middleware and endpoint processing |
| Authentication | Middleware | Establishes `HttpContext.User` before authorization and endpoint execution |
| Authorization policies | Built-in authorization system | Centralized, testable, works with policies and requirements |
| Controller/action audit behavior | Action filter | Has access to action metadata and arguments |
| Add response header for selected controllers/actions | Result filter or action filter | Easy to apply by scope |
| Cache or skip expensive model binding/action execution | Resource filter | Runs before model binding and wraps most of MVC |
| Validate action arguments after model binding | Action filter | Has access to bound action arguments and `ModelState` |
| CORS, HTTPS redirection, static files, compression | Middleware | Low-level HTTP concerns |
| Convert MVC-specific exceptions to API results | Exception filter | Works inside MVC action/result execution |
| Minimal API endpoint-specific logic | Endpoint filter | Designed for route-handler endpoints |

### Middleware Filter Boundary

ASP.NET Core also supports running middleware inside the filter pipeline with middleware filters. This is advanced and should not be the default choice.

The reason this exists is that some middleware-like behavior may need MVC route values or action context. However, in most applications, normal middleware or normal filters are easier to understand and maintain.

Use middleware filters only when:

- The behavior is naturally middleware-shaped.
- It must run at the resource filter stage.
- It needs MVC/action context that ordinary middleware does not have.
- The team understands the lifecycle and ordering implications.

### Common Mistakes

Common mistakes include:

- Using an action filter for authentication or authorization instead of the built-in authentication and authorization systems.
- Using an exception filter as the only global error handler and expecting it to catch middleware or routing exceptions.
- Writing a custom model validation filter when `[ApiController]` already provides automatic validation behavior.
- Blocking async work inside filters with `.Result` or `.Wait()`.
- Putting mutable request-specific state in a filter instance that may be reused.
- Assuming result filters run for failed actions or exceptions.
- Applying too many filters with custom `Order` values, making execution order hard to reason about.
- Using filters for concerns that belong in middleware, such as CORS, compression, static files, HTTPS redirection, or global request logging.

### Best Practices

Good production habits include:

- Use middleware for app-wide HTTP concerns.
- Use filters for MVC/controller/action-level cross-cutting concerns.
- Prefer authorization policies over custom authorization filters.
- Prefer exception middleware for global exception handling.
- Keep filters small and focused.
- Prefer asynchronous filters for I/O.
- Avoid mutable state in filters.
- Register filters through DI when they need services.
- Use global filters for truly global MVC behavior.
- Use controller/action filters only when the behavior is intentionally scoped.
- Document any non-obvious filter order.
- Test filters separately when they contain business rules or important behavior.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

<!-- question:start:aspnet-core-filters-beginner-q01 -->
<!-- question-id:aspnet-core-filters-beginner-q01 -->
<!-- question-level:beginner -->
####  What are filters in ASP.NET Core?

##### Expected Answer

Filters are components that run before or after specific stages of the MVC or API action execution pipeline. They allow developers to apply cross-cutting behavior without duplicating code in every controller action.

Examples include authorization checks, validation, auditing, response header modification, caching decisions, exception handling, and result transformation.

Filters run after ASP.NET Core has selected an action to execute. This is different from middleware, which runs in the broader HTTP request pipeline.

##### Key Points to Mention

- Filters are part of the MVC/action pipeline.
- They run before or after specific stages.
- They help implement cross-cutting concerns.
- They can be applied globally, to controllers, or to actions.
- They are different from middleware.
<!-- question:end:aspnet-core-filters-beginner-q01 -->

<!-- question:start:aspnet-core-filters-beginner-q02 -->
<!-- question-id:aspnet-core-filters-beginner-q02 -->
<!-- question-level:beginner -->
####  What are the main filter types in ASP.NET Core?

##### Expected Answer

The main MVC filter types are authorization filters, resource filters, action filters, exception filters, and result filters.

Authorization filters run first and determine whether the user is allowed to access the action. Resource filters run after authorization and before model binding. Action filters run before and after the action method. Exception filters handle certain unhandled exceptions from action or result execution. Result filters run before and after the action result is executed.

##### Key Points to Mention

- Authorization filters run first.
- Resource filters run before model binding.
- Action filters surround action method execution.
- Exception filters handle MVC action/result exceptions.
- Result filters surround result execution.
<!-- question:end:aspnet-core-filters-beginner-q02 -->

<!-- question:start:aspnet-core-filters-beginner-q03 -->
<!-- question-id:aspnet-core-filters-beginner-q03 -->
<!-- question-level:beginner -->
####  What is the difference between middleware and filters?

##### Expected Answer

Middleware runs in the main ASP.NET Core HTTP request pipeline and works with `HttpContext`. It can run before or after routing depending on where it is registered in `Program.cs`.

Filters run later, inside the MVC/action execution pipeline, after an endpoint/action has been selected. Filters have access to MVC-specific context such as action arguments, `ModelState`, action results, controller metadata, and filter context objects.

Middleware is better for app-wide HTTP concerns such as exception handling, static files, routing, authentication, authorization middleware, CORS, compression, and HTTPS redirection. Filters are better for controller/action-specific cross-cutting behavior.

##### Key Points to Mention

- Middleware is lower-level and app-wide.
- Filters are MVC/action-level.
- Middleware uses `HttpContext`.
- Filters can access action arguments, `ModelState`, and results.
- Choose based on scope and required context.
<!-- question:end:aspnet-core-filters-beginner-q03 -->

<!-- question:start:aspnet-core-filters-beginner-q04 -->
<!-- question-id:aspnet-core-filters-beginner-q04 -->
<!-- question-level:beginner -->
####  What is an action filter?

##### Expected Answer

An action filter runs immediately before and after a controller action method executes. It can inspect or modify action arguments before the action runs, and it can inspect or modify the result after the action runs.

Action filters are commonly used for auditing, validation, logging of business-level action details, enforcing conventions, or applying behavior to selected controllers/actions.

##### Key Points to Mention

- Runs before and after action method execution.
- Has access to action arguments.
- Can short-circuit by setting `context.Result`.
- Can inspect the result after execution.
- Good for action-specific cross-cutting logic.
<!-- question:end:aspnet-core-filters-beginner-q04 -->

<!-- question:start:aspnet-core-filters-beginner-q05 -->
<!-- question-id:aspnet-core-filters-beginner-q05 -->
<!-- question-level:beginner -->
####  How can a filter short-circuit a request?

##### Expected Answer

A filter can short-circuit the MVC pipeline by setting `context.Result`. When `context.Result` is set before the action executes, ASP.NET Core skips the remaining action execution path and returns that result instead.

For example, an action filter can return `BadRequestObjectResult` if a required header is missing. A resource filter can return a cached response before model binding and action execution occur.

##### Key Points to Mention

- Set `context.Result`.
- The action method may not execute.
- Resource filters can short-circuit before model binding.
- Action filters can short-circuit before the action.
- Use carefully because it changes normal flow.
<!-- question:end:aspnet-core-filters-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

<!-- question:start:aspnet-core-filters-intermediate-q01 -->
<!-- question-id:aspnet-core-filters-intermediate-q01 -->
<!-- question-level:intermediate -->
####  When would you use a resource filter instead of an action filter?

##### Expected Answer

Use a resource filter when the behavior must run before model binding or when it should wrap most of the MVC pipeline. Resource filters run after authorization but before model binding, so they are useful for caching, short-circuiting expensive requests, or disabling form value model binding for large file uploads.

Use an action filter when model binding has already completed and you need access to action arguments or `ModelState`.

##### Key Points to Mention

- Resource filters run before model binding.
- Action filters run after model binding.
- Resource filters wrap most of MVC execution.
- Resource filters are useful for caching and upload scenarios.
- Action filters are better for argument-level behavior.
<!-- question:end:aspnet-core-filters-intermediate-q01 -->

<!-- question:start:aspnet-core-filters-intermediate-q02 -->
<!-- question-id:aspnet-core-filters-intermediate-q02 -->
<!-- question-level:intermediate -->
####  Why are authorization policies usually preferred over custom authorization filters?

##### Expected Answer

Authorization policies are preferred because they use the built-in ASP.NET Core authorization system. Policies are centralized, composable, testable, and integrate naturally with authentication, authorization middleware, `[Authorize]`, requirements, handlers, and resource-based authorization.

Custom authorization filters are lower-level and easier to misuse. For most business authorization rules, a policy or authorization handler is clearer and more maintainable.

##### Key Points to Mention

- Prefer `[Authorize]`, policies, requirements, and handlers.
- Authorization filters run first but are not usually where business authorization should live.
- Policies are reusable and testable.
- Resource-based authorization can handle entity-specific decisions.
- Do not use action filters for authorization.
<!-- question:end:aspnet-core-filters-intermediate-q02 -->

<!-- question:start:aspnet-core-filters-intermediate-q03 -->
<!-- question-id:aspnet-core-filters-intermediate-q03 -->
<!-- question-level:intermediate -->
####  What are the limitations of exception filters?

##### Expected Answer

Exception filters only handle certain exceptions that happen inside MVC action execution or result execution. They do not catch exceptions thrown by earlier middleware, routing, or model binding. They also may not be useful if the response has already started.

For global production exception handling, exception middleware is usually preferred because it can cover more of the request pipeline.

##### Key Points to Mention

- Exception filters are MVC-specific.
- They do not catch middleware exceptions.
- They do not catch routing exceptions.
- They do not catch model binding exceptions.
- Use exception middleware for global handling.
<!-- question:end:aspnet-core-filters-intermediate-q03 -->

<!-- question:start:aspnet-core-filters-intermediate-q04 -->
<!-- question-id:aspnet-core-filters-intermediate-q04 -->
<!-- question-level:intermediate -->
####  How do global, controller, and action filters execute?

##### Expected Answer

Filters can be applied globally, at the controller level, or at the action level. By default, filters of the same stage are nested by scope.

The before-code usually executes from outer to inner: global, then controller, then action. The after-code executes in reverse: action, then controller, then global.

The order can be customized by implementing `IOrderedFilter` or by setting an order value when registering or applying the filter.

##### Key Points to Mention

- Global filters wrap controller filters.
- Controller filters wrap action filters.
- After-code runs in reverse order.
- `IOrderedFilter` can override default order.
- Overusing custom order can make behavior hard to debug.
<!-- question:end:aspnet-core-filters-intermediate-q04 -->

<!-- question:start:aspnet-core-filters-intermediate-q05 -->
<!-- question-id:aspnet-core-filters-intermediate-q05 -->
<!-- question-level:intermediate -->
####  How do you inject services into filters?

##### Expected Answer

If a filter needs services from dependency injection, you should register the filter as a service and apply it using mechanisms such as global filter registration, `[ServiceFilter<T>]`, `[TypeFilter]`, or a custom `IFilterFactory`.

A normal attribute constructor cannot directly receive services from DI because attribute constructor arguments must be supplied where the attribute is applied. Therefore, service-backed filters need a DI-aware pattern.

##### Key Points to Mention

- Register filter types in DI when they need services.
- Use `ServiceFilter` for registered filter services.
- Use `TypeFilter` when the filter type itself does not need to be registered directly.
- Avoid service dependencies in plain attribute constructors.
- Avoid mutable shared state in reusable filter instances.
<!-- question:end:aspnet-core-filters-intermediate-q05 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

<!-- question:start:aspnet-core-filters-advanced-q01 -->
<!-- question-id:aspnet-core-filters-advanced-q01 -->
<!-- question-level:advanced -->
####  How would you decide whether global API error handling should be middleware or an exception filter?

##### Expected Answer

For global API error handling, middleware is usually the better default because it sits in the broader HTTP pipeline and can catch exceptions from middleware, endpoint execution, and other parts of the request pipeline depending on placement.

An exception filter is narrower. It can transform exceptions from MVC action or result execution, but it does not catch exceptions from middleware, routing, or model binding. Therefore, exception filters are better for MVC-specific policies or selected controller/action behavior.

A production API often uses exception middleware for the global safety net and avoids spreading error transformation rules across many filters.

##### Key Points to Mention

- Middleware has broader coverage.
- Exception filters are MVC/action specific.
- Middleware should be placed early.
- Exception filters do not handle routing or middleware failures.
- Use filters only for scoped MVC-specific exception policies.
<!-- question:end:aspnet-core-filters-advanced-q01 -->

<!-- question:start:aspnet-core-filters-advanced-q02 -->
<!-- question-id:aspnet-core-filters-advanced-q02 -->
<!-- question-level:advanced -->
####  What problems can happen if filters contain mutable state?

##### Expected Answer

Filters can be reused depending on how they are registered or applied. If a filter instance contains mutable request-specific state, that state might be shared across concurrent requests. This can cause race conditions, data leaks, incorrect audit information, or unpredictable behavior.

Filters should generally be stateless. If they need request-specific data, they should store it in local variables, filter context items, `HttpContext.Items`, scoped services, or other request-scoped mechanisms.

##### Key Points to Mention

- Filter instances may be reused.
- Shared mutable state can create thread-safety bugs.
- Concurrent requests can corrupt request-specific values.
- Prefer stateless filters.
- Use scoped services or request context for per-request data.
<!-- question:end:aspnet-core-filters-advanced-q02 -->

<!-- question:start:aspnet-core-filters-advanced-q03 -->
<!-- question-id:aspnet-core-filters-advanced-q03 -->
<!-- question-level:advanced -->
####  How does short-circuiting differ between middleware and filters?

##### Expected Answer

Middleware short-circuits by not calling the `next` delegate. Once middleware writes a response or decides not to call `next`, downstream middleware and endpoint execution do not run.

Filters short-circuit by setting `context.Result`. For example, an action filter can set a `BadRequestObjectResult`, or a resource filter can return a cached response. This prevents later MVC action execution steps from running.

The key difference is that middleware controls the broader HTTP pipeline, while filters control the MVC/action pipeline.

##### Key Points to Mention

- Middleware short-circuits by not calling `next`.
- Filters short-circuit by setting `context.Result`.
- Middleware short-circuiting affects downstream middleware.
- Filter short-circuiting affects MVC/action execution.
- Both should be used carefully.
<!-- question:end:aspnet-core-filters-advanced-q03 -->

<!-- question:start:aspnet-core-filters-advanced-q04 -->
<!-- question-id:aspnet-core-filters-advanced-q04 -->
<!-- question-level:advanced -->
####  Why might a result filter not run when an exception occurs?

##### Expected Answer

Result filters are designed to run around result execution when the action has executed successfully. If an exception occurs before a normal action result is produced, result filters may not run. Exception handling takes a different path through the pipeline.

This is why result filters should not be used for cleanup or error handling that must always happen. For guaranteed cleanup, middleware with `try/finally`, resource filters, or other appropriate lifecycle hooks may be better depending on the scope.

##### Key Points to Mention

- Result filters surround result execution.
- They usually run for successful action execution.
- Exceptions can bypass normal result execution.
- Do not rely on result filters for global cleanup.
- Use exception handling or middleware for error paths.
<!-- question:end:aspnet-core-filters-advanced-q04 -->

<!-- question:start:aspnet-core-filters-advanced-q05 -->
<!-- question-id:aspnet-core-filters-advanced-q05 -->
<!-- question-level:advanced -->
####  How would you design cross-cutting behavior for a large ASP.NET Core API?

##### Expected Answer

A good design separates concerns by pipeline level. Use middleware for global HTTP concerns such as exception handling, correlation IDs, request logging, security headers, CORS, authentication, authorization middleware, compression, and HTTPS redirection.

Use the built-in authorization system for authorization policies and resource-based authorization. Use filters for MVC/action-specific behavior such as action auditing, response metadata, selected controller conventions, cached MVC responses, and action argument checks.

The design should avoid putting everything into one large filter or middleware. Each component should be small, focused, registered with the correct lifetime, and tested independently.

##### Key Points to Mention

- Choose middleware for global HTTP concerns.
- Choose policies for authorization rules.
- Choose filters for action/controller concerns.
- Keep components small and focused.
- Avoid duplicated cross-cutting logic in controllers.
- Test important filters and middleware separately.
<!-- question:end:aspnet-core-filters-advanced-q05 -->

<!-- question:start:aspnet-core-filters-advanced-q06 -->
<!-- question-id:aspnet-core-filters-advanced-q06 -->
<!-- question-level:advanced -->
####  What is the difference between MVC filters and endpoint filters?

##### Expected Answer

MVC filters are part of the MVC controller and Razor Pages pipeline. They have access to MVC-specific concepts such as action descriptors, action arguments, model state, controller context, and action results.

Endpoint filters are designed for endpoint-based APIs, especially minimal APIs. They run before and after endpoint handler execution and can inspect or modify endpoint invocation arguments and results.

In a controller-based API, MVC filters are usually the natural choice. In a minimal API, endpoint filters are usually the natural choice.

##### Key Points to Mention

- MVC filters are tied to MVC/controller execution.
- Endpoint filters are tied to endpoint handler execution.
- Minimal APIs commonly use endpoint filters.
- Controllers commonly use MVC filters.
- Both support cross-cutting endpoint/action behavior, but at different abstraction layers.
<!-- question:end:aspnet-core-filters-advanced-q06 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
