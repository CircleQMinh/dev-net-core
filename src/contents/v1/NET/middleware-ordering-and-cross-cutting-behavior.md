---
id: middleware-ordering-and-cross-cutting-behavior
topic: Dependency injection, configuration, middleware, and logging
subtopic: Middleware Ordering and Cross-Cutting Behavior
category: .NET
---

## Overview

Middleware ordering is the way an ASP.NET Core application arranges request-processing components in the HTTP pipeline. Each middleware can inspect the incoming request, perform work before the next middleware runs, call the next middleware, perform work after the next middleware returns, or stop the request from going further.

Cross-cutting behavior means behavior that applies across many endpoints instead of belonging to one specific controller, Minimal API handler, Razor Page, or service method. Examples include exception handling, logging, authentication, authorization, CORS, rate limiting, response compression, localization, request timing, correlation IDs, and security headers.

This topic matters because ASP.NET Core middleware is order-sensitive. A middleware placed too early, too late, or after a terminal middleware may not run at all or may produce incorrect security and runtime behavior. For example, authorization must run after authentication, CORS must be placed where it can apply headers correctly, exception handling must be early enough to catch downstream failures, and endpoint execution must happen after routing has selected the endpoint.

Middleware ordering is important in interviews because it tests whether a developer understands the ASP.NET Core request pipeline beyond writing controllers. Interviewers often ask this topic to evaluate practical production knowledge: how requests flow, where to place common middleware, how cross-cutting concerns should be centralized, how to avoid duplicated logic, and how to debug problems caused by incorrect ordering.

## Core Concepts

### What Middleware Is

Middleware is software assembled into a request pipeline. In ASP.NET Core, a request enters the pipeline, moves through middleware components in the order they are registered, reaches an endpoint or terminal component, and then the response travels back through earlier middleware in reverse order.

A middleware can do three main things:

- Run logic before the next middleware.
- Call the next middleware by invoking `next`.
- Run logic after the next middleware returns.

Example inline middleware:

```csharp
app.Use(async (context, next) =>
{
    Console.WriteLine("Before next middleware");

    await next(context);

    Console.WriteLine("After next middleware");
});
```

For a request, the `Before` logic runs in registration order. The `After` logic runs in reverse order as the response returns through the pipeline.

### Middleware Pipeline Flow

A simplified flow looks like this:

```text
Request
  -> Middleware 1 before next
    -> Middleware 2 before next
      -> Endpoint or terminal middleware
    <- Middleware 2 after next
  <- Middleware 1 after next
Response
```

This explains why middleware ordering affects both requests and responses. A logging middleware placed early can time almost the whole request. A response-header middleware placed after a terminal middleware may never run. A middleware that tries to modify headers after the response has started can fail.

### `Use`, `Run`, `Map`, and `UseWhen`

ASP.NET Core provides several common ways to build or branch the pipeline.

`Use` adds middleware that normally receives a `next` delegate:

```csharp
app.Use(async (context, next) =>
{
    await next(context);
});
```

`Run` adds terminal middleware. It does not receive a `next` delegate and ends the pipeline for matching requests:

```csharp
app.Run(async context =>
{
    await context.Response.WriteAsync("Handled here");
});
```

Any middleware registered after a terminal `Run` for the same path will not execute.

`Map` creates a branch based on the request path:

```csharp
app.Map("/health", healthApp =>
{
    healthApp.Run(async context =>
    {
        await context.Response.WriteAsync("OK");
    });
});
```

`UseWhen` creates a conditional branch that can rejoin the main pipeline when the branch does not end the request:

```csharp
app.UseWhen(
    context => context.Request.Path.StartsWithSegments("/api"),
    apiBranch =>
    {
        apiBranch.Use(async (context, next) =>
        {
            context.Response.Headers.TryAdd("X-API-Branch", "true");
            await next(context);
        });
    });
```

### Terminal Middleware and Short-Circuiting

Short-circuiting means a middleware handles the request and does not call the next middleware. This is useful when further processing is unnecessary.

Common examples include:

- Static file middleware serving a file and stopping the pipeline.
- Authentication middleware handling an external login callback.
- Rate limiting middleware rejecting a request.
- A custom maintenance-mode middleware returning `503 Service Unavailable`.
- A health-check endpoint returning a response immediately.

Example custom short-circuit:

```csharp
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/maintenance"))
    {
        context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        await context.Response.WriteAsync("Service temporarily unavailable.");
        return;
    }

    await next(context);
});
```

Short-circuiting can improve performance, but it can also accidentally bypass logging, authentication, authorization, CORS, or headers if placed incorrectly.

### Cross-Cutting Behavior

Cross-cutting behavior is behavior that should apply consistently across many requests.

Common examples:

| Cross-cutting concern | Typical middleware responsibility |
|---|---|
| Exception handling | Convert unhandled exceptions into safe error responses |
| Logging | Record request start, end, duration, status code, and errors |
| Correlation IDs | Attach a request ID to logs and responses |
| Authentication | Identify the user |
| Authorization | Check whether the user can access a resource |
| CORS | Apply cross-origin rules for browser clients |
| Rate limiting | Reject or delay excessive requests |
| Localization | Set request culture |
| Response compression | Compress supported responses |
| Security headers | Add headers such as HSTS or content security policies |

Middleware is a good place for cross-cutting behavior when the concern operates at the HTTP request/response level. For business rules that depend on use-case logic, application services, MediatR pipeline behaviors, filters, or domain services may be a better fit.

### Common Middleware Ordering in ASP.NET Core

A typical order for many ASP.NET Core MVC, Razor Pages, or Minimal API applications looks like this:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuthentication();
builder.Services.AddAuthorization();
builder.Services.AddCors();
builder.Services.AddRateLimiter(_ => { });
builder.Services.AddControllers();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseCors("DefaultPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.UseRateLimiter();

app.MapControllers();

app.Run();
```

The exact order can vary by application, but several rules are common:

- Exception handling should be early so it can catch exceptions from downstream middleware and endpoints.
- HTTPS redirection and HSTS are security-related and usually belong early.
- Static files can run early so static asset requests do not need unnecessary endpoint processing.
- Routing must run before middleware that needs endpoint metadata.
- CORS often belongs after routing and before authentication/authorization and endpoints.
- Authentication must run before authorization.
- Authorization must run before endpoint execution.
- Endpoint mappings such as `MapControllers`, `MapGet`, and `MapGroup` define endpoint execution at the end of the pipeline.

### Routing, Endpoint Metadata, and Authorization

Routing selects an endpoint and attaches endpoint metadata to the current `HttpContext`. Middleware that needs endpoint metadata must run after routing.

Examples of endpoint metadata:

- `[Authorize]`
- `[AllowAnonymous]`
- CORS metadata
- Rate limiting metadata
- Antiforgery metadata
- Custom attributes used by custom middleware

Example custom middleware reading endpoint metadata:

```csharp
app.UseRouting();

app.Use(async (context, next) =>
{
    var endpoint = context.GetEndpoint();
    var requiresAudit = endpoint?.Metadata.GetMetadata<RequiresAuditAttribute>() is not null;

    if (requiresAudit)
    {
        Console.WriteLine($"Auditing request to {context.Request.Path}");
    }

    await next(context);
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
```

If this middleware runs before routing, `context.GetEndpoint()` will usually be `null`, so it cannot make decisions based on selected endpoint metadata.

### Authentication Before Authorization

Authentication answers: "Who is the caller?"

Authorization answers: "Is the caller allowed to do this?"

Because authorization depends on knowing the user identity and claims, authentication should run before authorization:

```csharp
app.UseAuthentication();
app.UseAuthorization();
```

Incorrect order:

```csharp
app.UseAuthorization();
app.UseAuthentication();
```

With the incorrect order, authorization may evaluate an unauthenticated or incomplete `HttpContext.User`, causing protected endpoints to reject requests unexpectedly or behave incorrectly.

### CORS Ordering

CORS controls whether browser-based cross-origin requests are allowed. CORS must be placed where it can apply the correct headers before the response is sent.

Common placement:

```csharp
app.UseRouting();

app.UseCors("FrontendPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
```

A common mistake is placing CORS too late, after endpoint execution or after middleware that already produced a response. In that case, preflight requests may fail or cross-origin responses may miss required CORS headers.

### Exception Handling Middleware

Exception handling middleware centralizes error handling for unhandled exceptions in later middleware and endpoints.

Production-style example:

```csharp
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
}
```

Minimal API error endpoint:

```csharp
app.Map("/error", () => Results.Problem(
    title: "An unexpected error occurred.",
    statusCode: StatusCodes.Status500InternalServerError));
```

Important habits:

- Do not expose stack traces or sensitive error details in production responses.
- Log exceptions with enough context to troubleshoot.
- Place exception handling early enough to catch downstream errors.
- Remember that exception handling middleware does not catch errors from middleware registered before it.
- Be careful if the error handler re-executes the pipeline, because middleware may need to be reentrant.

### Custom Middleware Class

For reusable middleware, prefer a class instead of a large inline lambda.

```csharp
public sealed class CorrelationIdMiddleware
{
    private const string HeaderName = "X-Correlation-ID";
    private readonly RequestDelegate _next;
    private readonly ILogger<CorrelationIdMiddleware> _logger;

    public CorrelationIdMiddleware(
        RequestDelegate next,
        ILogger<CorrelationIdMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers.TryGetValue(HeaderName, out var value)
            ? value.ToString()
            : Guid.NewGuid().ToString("N");

        context.Items[HeaderName] = correlationId;
        context.Response.Headers.TryAdd(HeaderName, correlationId);

        using (_logger.BeginScope(new Dictionary<string, object>
        {
            [HeaderName] = correlationId
        }))
        {
            await _next(context);
        }
    }
}
```

Register it in the pipeline:

```csharp
app.UseMiddleware<CorrelationIdMiddleware>();
```

This middleware should usually be placed early so the correlation ID is available to downstream logging and services.

### Middleware vs MVC Filters vs MediatR Behaviors

Middleware is not the only way to implement cross-cutting behavior.

| Mechanism | Scope | Good for | Not ideal for |
|---|---|---|---|
| Middleware | HTTP request/response pipeline | Logging, exception handling, CORS, auth, rate limiting, headers | Use-case-specific business rules |
| MVC filters | MVC/Razor action pipeline | Model/action/result behavior, controller-specific concerns | Non-MVC endpoints unless equivalent endpoint filters are used |
| Endpoint filters | Minimal API endpoint pipeline | Minimal API validation, endpoint-level behavior | Global HTTP behavior that should apply before routing |
| MediatR pipeline behaviors | Application request/handler pipeline | Validation, transactions, application logging, use-case policies | HTTP-specific behavior like CORS or response headers |
| Domain services | Domain/business layer | Business rules and domain decisions | Infrastructure concerns like HTTP headers |

Interviewers often expect developers to avoid forcing all cross-cutting logic into middleware. Good design places behavior at the correct layer.

### Response Headers and `HasStarted`

Middleware often adds response headers, but headers must be set before the response starts.

Safe pattern:

```csharp
app.Use(async (context, next) =>
{
    context.Response.Headers.TryAdd("X-App-Version", "1.0");

    await next(context);
});
```

When a header depends on the final response, use `OnStarting`:

```csharp
app.Use(async (context, next) =>
{
    var startedAt = Stopwatch.GetTimestamp();

    context.Response.OnStarting(() =>
    {
        var elapsed = Stopwatch.GetElapsedTime(startedAt);
        context.Response.Headers.TryAdd("X-Elapsed-Milliseconds", elapsed.TotalMilliseconds.ToString("F0"));
        return Task.CompletedTask;
    });

    await next(context);
});
```

Avoid changing status code or headers after the response body has already started. Check `context.Response.HasStarted` when handling late errors or cleanup scenarios.

### Request Body Reading and Reentrancy

Middleware can inspect the request body, but reading the body incorrectly can break downstream model binding or endpoint processing because the body stream may be consumed.

If middleware must read the body, enable buffering and reset the position:

```csharp
app.Use(async (context, next) =>
{
    context.Request.EnableBuffering();

    using var reader = new StreamReader(
        context.Request.Body,
        encoding: Encoding.UTF8,
        detectEncodingFromByteOrderMarks: false,
        bufferSize: 1024,
        leaveOpen: true);

    var body = await reader.ReadToEndAsync();
    context.Request.Body.Position = 0;

    await next(context);
});
```

Use this carefully. Reading large request bodies in middleware can hurt performance, increase memory usage, and create security risks if sensitive data is logged.

### Dependency Injection in Middleware

Middleware classes can receive singleton-safe dependencies in the constructor and scoped dependencies in the `InvokeAsync` method.

```csharp
public sealed class TenantMiddleware
{
    private readonly RequestDelegate _next;

    public TenantMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ITenantResolver tenantResolver)
    {
        var tenant = await tenantResolver.ResolveAsync(context.RequestAborted);
        context.Items["Tenant"] = tenant;

        await _next(context);
    }
}
```

This matters because middleware instances are often constructed once and reused. Capturing scoped services in the constructor can cause lifetime problems unless the middleware is created using patterns that support per-request activation.

### Performance Considerations

Middleware runs for many or all requests, so small inefficiencies can become expensive.

Best practices:

- Keep middleware focused and lightweight.
- Avoid unnecessary allocations on every request.
- Avoid reading the request body unless required.
- Short-circuit early for cheap endpoints such as health checks or static files when appropriate.
- Place expensive middleware only where it is needed.
- Use structured logging and avoid logging sensitive or high-volume payloads.
- Prefer built-in middleware for common concerns when possible.

Example of branch-specific middleware:

```csharp
app.Map("/admin", adminApp =>
{
    adminApp.UseMiddleware<AdminAuditMiddleware>();
    adminApp.Run(async context =>
    {
        await context.Response.WriteAsync("Admin area");
    });
});
```

This avoids running admin-specific behavior for every public request.

### Common Mistakes

Common mistakes include:

- Registering `UseAuthorization` before `UseAuthentication`.
- Placing CORS after endpoint execution.
- Adding middleware after a terminal `Run` and expecting it to execute.
- Putting exception handling too late to catch important failures.
- Writing to the response body before calling `next`, then expecting downstream middleware to control the response.
- Modifying headers after the response has started.
- Reading the request body without resetting the stream.
- Performing business logic in middleware when it belongs in the application or domain layer.
- Creating middleware that is not reentrant when exception handling re-executes the pipeline.
- Overusing global middleware when endpoint filters, MVC filters, or MediatR behaviors would be more precise.

### Production-Oriented Ordering Example

A more production-oriented pipeline could look like this:

```csharp
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
}

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();

app.UseHttpsRedirection();
app.UseRequestLocalization();
app.UseStaticFiles();

app.UseRouting();

app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapHealthChecks("/health").AllowAnonymous();
app.MapControllers();

app.Run();
```

This order is not universal, but it demonstrates the reasoning:

- Errors, correlation IDs, and logging happen early.
- Security and localization happen before endpoint handling.
- Routing happens before endpoint-aware middleware.
- CORS, authentication, authorization, and rate limiting run before protected endpoints execute.
- Endpoints are mapped at the end.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:middleware-ordering-beginner-q01 -->
<!-- question-id:middleware-ordering-beginner-q01 -->
<!-- question-level:beginner -->
#### 1. What is middleware in ASP.NET Core?

##### Expected Answer

Middleware is a component in the ASP.NET Core HTTP request pipeline. It can inspect or modify the request, call the next middleware, inspect or modify the response, or stop the request from continuing. Middleware is used for cross-cutting concerns such as exception handling, logging, routing, authentication, authorization, CORS, rate limiting, static files, and response compression.

A request flows through middleware in registration order. After an endpoint or terminal middleware produces a response, the response flows back through previous middleware in reverse order.

##### Key Points to Mention

- Middleware forms a pipeline.
- Each middleware can run before and after `next`.
- Middleware can short-circuit the pipeline.
- It is commonly used for HTTP-level cross-cutting concerns.
- Ordering is important.
<!-- question:end:middleware-ordering-beginner-q01 -->

<!-- question:start:middleware-ordering-beginner-q02 -->
<!-- question-id:middleware-ordering-beginner-q02 -->
<!-- question-level:beginner -->
#### 2. Why does middleware order matter?

##### Expected Answer

Middleware order matters because each middleware runs in the order it is registered, and some middleware depends on earlier middleware. For example, authorization depends on authentication because the user identity must be known before permissions can be checked. Exception handling must be early enough to catch exceptions thrown by downstream middleware. CORS must run before the response is generated so it can add the required headers.

Incorrect ordering can cause security issues, missing headers, failed authentication, endpoints not being reached, or middleware not running at all.

##### Key Points to Mention

- Request path follows registration order.
- Response path follows reverse order.
- Some middleware depends on route or user information.
- Terminal middleware can prevent later middleware from running.
- Incorrect order can cause production bugs.
<!-- question:end:middleware-ordering-beginner-q02 -->

<!-- question:start:middleware-ordering-beginner-q03 -->
<!-- question-id:middleware-ordering-beginner-q03 -->
<!-- question-level:beginner -->
#### 3. What is the difference between `Use` and `Run`?

##### Expected Answer

`Use` adds middleware that receives a `next` delegate. It can call `next` to continue the pipeline and can also run logic after `next` returns. `Run` adds terminal middleware. It does not receive a `next` delegate and ends the pipeline for the matched request.

Use `Use` when the request should usually continue to later middleware. Use `Run` when the middleware is intended to fully handle the request.

##### Key Points to Mention

- `Use` can continue the pipeline.
- `Run` is terminal.
- Middleware after a terminal `Run` may not execute.
- `Use` is common for cross-cutting concerns.
- `Run` is common for final request handling or simple endpoints.
<!-- question:end:middleware-ordering-beginner-q03 -->

<!-- question:start:middleware-ordering-beginner-q04 -->
<!-- question-id:middleware-ordering-beginner-q04 -->
<!-- question-level:beginner -->
#### 4. What does it mean to short-circuit the middleware pipeline?

##### Expected Answer

Short-circuiting means a middleware handles the request and does not call the next middleware. This stops the request from continuing through the rest of the pipeline. It is useful when no further processing is needed, such as serving a static file, rejecting a rate-limited request, returning a health-check response, or handling maintenance mode.

Short-circuiting should be used carefully because it can bypass middleware that would otherwise add logging, headers, authentication, authorization, or CORS behavior.

##### Key Points to Mention

- Short-circuiting means not calling `next`.
- It can improve performance.
- It can accidentally bypass important middleware.
- Static files, health checks, and rate limiting are common examples.
- Placement determines what still runs.
<!-- question:end:middleware-ordering-beginner-q04 -->

<!-- question:start:middleware-ordering-beginner-q05 -->
<!-- question-id:middleware-ordering-beginner-q05 -->
<!-- question-level:beginner -->
#### 5. What are cross-cutting concerns in a web application?

##### Expected Answer

Cross-cutting concerns are behaviors that apply across many parts of an application rather than belonging to one specific endpoint or business use case. In ASP.NET Core, HTTP-level cross-cutting concerns are often implemented with middleware.

Examples include exception handling, request logging, correlation IDs, authentication, authorization, CORS, rate limiting, localization, response compression, security headers, and metrics.

##### Key Points to Mention

- Cross-cutting behavior applies broadly.
- Middleware is often used for HTTP-level concerns.
- Not all cross-cutting behavior belongs in middleware.
- Filters and MediatR pipeline behaviors may be better for application-level concerns.
- Centralizing these concerns reduces duplicated endpoint code.
<!-- question:end:middleware-ordering-beginner-q05 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:middleware-ordering-intermediate-q01 -->
<!-- question-id:middleware-ordering-intermediate-q01 -->
<!-- question-level:intermediate -->
#### 1. What is the correct order for authentication and authorization middleware?

##### Expected Answer

Authentication should run before authorization:

```csharp
app.UseAuthentication();
app.UseAuthorization();
```

Authentication populates `HttpContext.User` with the caller's identity and claims. Authorization then uses that identity and endpoint metadata to decide whether the request is allowed. If authorization runs first, it may evaluate an empty or unauthenticated user and reject requests incorrectly.

##### Key Points to Mention

- Authentication identifies the user.
- Authorization checks access.
- Authorization depends on `HttpContext.User`.
- Wrong order can cause protected endpoints to fail.
- This order is one of the most common ASP.NET Core interview questions.
<!-- question:end:middleware-ordering-intermediate-q01 -->

<!-- question:start:middleware-ordering-intermediate-q02 -->
<!-- question-id:middleware-ordering-intermediate-q02 -->
<!-- question-level:intermediate -->
#### 2. Where should exception handling middleware be placed?

##### Expected Answer

Exception handling middleware should be placed early in the pipeline so it can catch unhandled exceptions thrown by downstream middleware and endpoints. In development, `UseDeveloperExceptionPage` is commonly used to show detailed errors. In production, `UseExceptionHandler` is used to return safe error responses and avoid exposing sensitive stack traces.

It cannot catch exceptions thrown by middleware registered before it, so placing it too late reduces its usefulness.

##### Key Points to Mention

- Place it early.
- Use detailed errors only in development.
- Use safe error responses in production.
- It catches downstream exceptions, not upstream exceptions.
- Avoid leaking sensitive details.
<!-- question:end:middleware-ordering-intermediate-q02 -->

<!-- question:start:middleware-ordering-intermediate-q03 -->
<!-- question-id:middleware-ordering-intermediate-q03 -->
<!-- question-level:intermediate -->
#### 3. Where should CORS middleware be placed?

##### Expected Answer

CORS middleware is commonly placed after routing and before authentication, authorization, and endpoint execution:

```csharp
app.UseRouting();
app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
```

This placement allows the selected endpoint and policy metadata to be available while ensuring CORS headers are added before the response is generated. If CORS is placed too late, preflight requests may fail or responses may not include the necessary browser CORS headers.

##### Key Points to Mention

- CORS must run before endpoint execution.
- CORS must be placed before response caching when both are used.
- Placing CORS too late often causes browser errors.
- Route-aware CORS scenarios need routing first.
- CORS is a browser security feature, not server-to-server authentication.
<!-- question:end:middleware-ordering-intermediate-q03 -->

<!-- question:start:middleware-ordering-intermediate-q04 -->
<!-- question-id:middleware-ordering-intermediate-q04 -->
<!-- question-level:intermediate -->
#### 4. Why might `HttpContext.GetEndpoint()` return `null` in custom middleware?

##### Expected Answer

`HttpContext.GetEndpoint()` may return `null` if the middleware runs before routing has selected an endpoint, or if the request does not match any endpoint. Middleware that depends on endpoint metadata should run after routing and before endpoint execution.

For example, custom middleware that checks attributes such as `[Authorize]`, custom audit metadata, or rate-limiting metadata needs to run after routing.

##### Key Points to Mention

- Routing selects the endpoint.
- Endpoint metadata is available only after routing.
- Not every request has a matching endpoint.
- Middleware requiring endpoint metadata must be ordered carefully.
- Endpoint metadata is commonly used for authorization, CORS, and custom behavior.
<!-- question:end:middleware-ordering-intermediate-q04 -->

<!-- question:start:middleware-ordering-intermediate-q05 -->
<!-- question-id:middleware-ordering-intermediate-q05 -->
<!-- question-level:intermediate -->
#### 5. How would you implement request logging as middleware?

##### Expected Answer

Request logging middleware usually records request information before calling `next`, measures elapsed time, then logs the response status code after `next` returns. It should be placed early enough to capture most of the request pipeline, but after correlation ID middleware if logs should include correlation data.

Example:

```csharp
public sealed class RequestTimingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestTimingMiddleware> _logger;

    public RequestTimingMiddleware(RequestDelegate next, ILogger<RequestTimingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var start = Stopwatch.GetTimestamp();

        try
        {
            await _next(context);
        }
        finally
        {
            var elapsed = Stopwatch.GetElapsedTime(start);
            _logger.LogInformation(
                "{Method} {Path} responded {StatusCode} in {ElapsedMs} ms",
                context.Request.Method,
                context.Request.Path,
                context.Response.StatusCode,
                elapsed.TotalMilliseconds);
        }
    }
}
```

##### Key Points to Mention

- Use `try/finally` so logging still happens on exceptions.
- Measure elapsed time around `next`.
- Log method, path, status code, and duration.
- Avoid logging sensitive data.
- Place after correlation ID middleware when correlation is needed.
<!-- question:end:middleware-ordering-intermediate-q05 -->

<!-- question:start:middleware-ordering-intermediate-q06 -->
<!-- question-id:middleware-ordering-intermediate-q06 -->
<!-- question-level:intermediate -->
#### 6. What is the difference between middleware and MVC filters?

##### Expected Answer

Middleware runs at the HTTP pipeline level and can affect all requests, including static files, Minimal APIs, MVC, Razor Pages, and health checks depending on placement. MVC filters run inside the MVC action pipeline, after routing has selected an MVC action.

Middleware is better for broad HTTP concerns such as exception handling, CORS, request logging, authentication, response headers, and rate limiting. MVC filters are better for action-specific behavior such as model validation, action logging, result transformation, or controller-level policies.

##### Key Points to Mention

- Middleware has a broader HTTP pipeline scope.
- Filters are MVC/action specific.
- Middleware runs before MVC action execution.
- Filters have access to MVC action context.
- Choose based on the correct layer and scope.
<!-- question:end:middleware-ordering-intermediate-q06 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:middleware-ordering-advanced-q01 -->
<!-- question-id:middleware-ordering-advanced-q01 -->
<!-- question-level:advanced -->
#### 1. How would you design a production middleware pipeline for an API?

##### Expected Answer

A production API pipeline should be designed around correctness, security, observability, and performance. A typical order is to place exception handling early, then correlation IDs and request logging, then security-related middleware, then routing, then endpoint-aware middleware such as CORS, authentication, authorization, rate limiting, and finally endpoint mappings.

Example:

```csharp
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
}

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();

app.UseHttpsRedirection();
app.UseRouting();

app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapHealthChecks("/health").AllowAnonymous();
app.MapControllers();
```

The exact order depends on the app, but the candidate should explain the reason behind each placement rather than memorizing a list.

##### Key Points to Mention

- Exception handling early.
- Correlation/logging early for observability.
- HTTPS/HSTS for security.
- Routing before endpoint-aware middleware.
- Authentication before authorization.
- Endpoint mappings near the end.
- Explain trade-offs instead of memorizing one fixed order.
<!-- question:end:middleware-ordering-advanced-q01 -->

<!-- question:start:middleware-ordering-advanced-q02 -->
<!-- question-id:middleware-ordering-advanced-q02 -->
<!-- question-level:advanced -->
#### 2. How can middleware ordering create security bugs?

##### Expected Answer

Middleware ordering can create security bugs when security middleware is bypassed, runs too late, or runs without the information it needs. For example, placing authorization before authentication may cause incorrect identity evaluation. Placing a custom short-circuit middleware before authorization may expose data without access checks. Placing CORS too late can break browser security behavior. Serving static files before security checks may expose files that should not be public.

Security middleware should be ordered so that requests are authenticated and authorized before protected resources are reached, and short-circuit behavior should be reviewed carefully.

##### Key Points to Mention

- Short-circuiting can bypass security.
- Authentication must precede authorization.
- Protected files should not be served as public static files.
- Endpoint metadata may be unavailable before routing.
- Security behavior should be tested with integration tests.
<!-- question:end:middleware-ordering-advanced-q02 -->

<!-- question:start:middleware-ordering-advanced-q03 -->
<!-- question-id:middleware-ordering-advanced-q03 -->
<!-- question-level:advanced -->
#### 3. How do you handle exceptions in middleware without corrupting the response?

##### Expected Answer

A middleware can catch exceptions around `await next(context)`, but it must be careful if the response has already started. Once the response body or headers have started, changing the status code or headers can fail or corrupt the response. Production applications usually use centralized exception handling middleware early in the pipeline.

If custom middleware catches exceptions, it should check `context.Response.HasStarted`. If the response has not started, it can clear the response and write a safe error body. If the response has started, it should usually log the error and rethrow or abort according to the application strategy.

Example:

```csharp
try
{
    await next(context);
}
catch (Exception ex)
{
    logger.LogError(ex, "Unhandled request error");

    if (context.Response.HasStarted)
    {
        throw;
    }

    context.Response.Clear();
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await context.Response.WriteAsJsonAsync(new
    {
        error = "An unexpected error occurred."
    });
}
```

##### Key Points to Mention

- Prefer centralized exception handling.
- Wrap `await next(context)` when building custom error middleware.
- Check `Response.HasStarted`.
- Do not expose sensitive exception details.
- Be careful with partial responses.
<!-- question:end:middleware-ordering-advanced-q03 -->

<!-- question:start:middleware-ordering-advanced-q04 -->
<!-- question-id:middleware-ordering-advanced-q04 -->
<!-- question-level:advanced -->
#### 4. What are the risks of reading the request body in middleware?

##### Expected Answer

Reading the request body in middleware can consume the body stream, preventing downstream model binding or endpoints from reading it. It can also create performance and memory issues, especially for large payloads. If middleware must read the body, it should enable buffering, leave the stream open, and reset the body position after reading.

It should also avoid logging sensitive data such as passwords, tokens, financial information, or personal data.

##### Key Points to Mention

- Request body streams are usually forward-only.
- Reading the body can break downstream processing.
- Use `EnableBuffering` when necessary.
- Reset `context.Request.Body.Position`.
- Avoid logging sensitive or large payloads.
<!-- question:end:middleware-ordering-advanced-q04 -->

<!-- question:start:middleware-ordering-advanced-q05 -->
<!-- question-id:middleware-ordering-advanced-q05 -->
<!-- question-level:advanced -->
#### 5. How do middleware, endpoint filters, MVC filters, and MediatR behaviors differ for cross-cutting concerns?

##### Expected Answer

They operate at different layers. Middleware operates at the HTTP pipeline level and is best for request/response concerns such as logging, CORS, authentication, rate limiting, headers, and exception handling. Endpoint filters operate around Minimal API endpoints and are useful for endpoint-level validation or transformation. MVC filters operate around MVC controller actions and results. MediatR behaviors operate in the application layer around requests and handlers, making them useful for validation, transactions, caching, and application logging.

A good design chooses the narrowest layer that correctly owns the concern. HTTP-specific concerns should not be pushed into domain logic, and business-specific rules should not be implemented as global middleware.

##### Key Points to Mention

- Middleware is HTTP-wide.
- Endpoint filters are Minimal API endpoint-specific.
- MVC filters are controller/action-specific.
- MediatR behaviors are application-layer request-specific.
- Correct placement improves maintainability and testability.
<!-- question:end:middleware-ordering-advanced-q05 -->

<!-- question:start:middleware-ordering-advanced-q06 -->
<!-- question-id:middleware-ordering-advanced-q06 -->
<!-- question-level:advanced -->
#### 6. How would you debug an issue where middleware is not running?

##### Expected Answer

First, inspect the order in `Program.cs` and check whether a terminal middleware, branch, static file handler, endpoint mapping, or short-circuit is preventing the middleware from running. Add temporary structured logs before and after `next` to confirm the flow. Check whether the request path enters a `Map`, `MapWhen`, or `UseWhen` branch. Verify that the middleware is registered before endpoint execution if it needs to apply to endpoints.

Also check environment-specific registration. Middleware may only be registered in development or production branches. Integration tests can confirm expected behavior for important paths.

##### Key Points to Mention

- Check order in `Program.cs`.
- Look for terminal middleware and short-circuiting.
- Check branch-specific pipelines.
- Add logs before and after `next`.
- Verify environment conditions.
- Use integration tests for important behavior.
<!-- question:end:middleware-ordering-advanced-q06 -->

<!-- question:start:middleware-ordering-advanced-q07 -->
<!-- question-id:middleware-ordering-advanced-q07 -->
<!-- question-level:advanced -->
#### 7. How should scoped services be used in custom middleware?

##### Expected Answer

A conventional middleware class may be constructed once and reused, so constructor injection should not capture scoped services such as a DbContext. Scoped services can be requested in the `InvokeAsync` method because that method runs per request and can receive services from the request scope.

Example:

```csharp
public sealed class ExampleMiddleware
{
    private readonly RequestDelegate _next;

    public ExampleMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, MyScopedService service)
    {
        await service.DoWorkAsync(context.RequestAborted);
        await _next(context);
    }
}
```

This avoids lifetime mismatches and keeps per-request dependencies scoped correctly.

##### Key Points to Mention

- Middleware instances can be reused.
- Avoid capturing scoped services in a long-lived middleware constructor.
- Inject scoped services into `InvokeAsync`.
- Be aware of dependency lifetimes.
- Keep middleware lightweight.
<!-- question:end:middleware-ordering-advanced-q07 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
