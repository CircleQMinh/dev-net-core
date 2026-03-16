---
id: logging-in-dotnet-core
topic: Logging in .NET Core
category: .NET
---

Logging in .NET Core is essential for diagnostics, monitoring, debugging, and auditing application behavior.

---

# Basic Logging Concepts

## What is Logging in .NET Core?

Logging is the process of recording application events such as:

- Errors
- Warnings
- Informational messages
- Debug traces

Why it is important:

- Troubleshooting issues
- Monitoring application health
- Debugging execution flow
- Auditing critical actions

---

## What is ILogger<T>?

`ILogger<T>` is the built-in logging abstraction in .NET Core.

It is:

- Generic (category based on type)
- Injected via Dependency Injection
- Used to log messages at different severity levels

Example:

```csharp
public class MyService
{
    private readonly ILogger<MyService> _logger;

    public MyService(ILogger<MyService> logger)
    {
        _logger = logger;
    }

    public void DoSomething()
    {
        _logger.LogInformation("This is an info message.");
        _logger.LogError("An error occurred.");
    }
}
````

---

# Log Levels

| Level       | Purpose                          |
| ----------- | -------------------------------- |
| Trace       | Most detailed, tracing execution |
| Debug       | Development diagnostics          |
| Information | Normal application flow          |
| Warning     | Potential issue                  |
| Error       | Handled failure                  |
| Critical    | Application failure              |

Example:

```csharp id="0c3h7s"
_logger.LogTrace("Trace log");
_logger.LogDebug("Debug log");
_logger.LogInformation("Information log");
_logger.LogWarning("Warning log");
_logger.LogError("Error log");
_logger.LogCritical("Critical log");
```

---

# Configuring Logging

Logging is configured in `Program.cs` (or `Startup.cs` in older versions).

Example:

```csharp
services.AddLogging(builder =>
{
    builder.AddConsole();
    builder.AddDebug();
    builder.AddEventSourceLogger();
});
```

---

## Configuring via appsettings.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning",
      "System": "Error"
    }
  }
}
```

This sets category-based filtering.

---

# Structured Logging

Structured logging logs key-value pairs instead of plain strings.

Example:

```csharp id="4c60w5"
_logger.LogInformation(
    "User {UserId} logged in at {Time}",
    userId,
    DateTime.UtcNow);
```

Benefits:

* Queryable logs
* Better filtering
* Works well with:

  * Elasticsearch
  * Azure Application Insights
  * Seq

---

# Filtering Logs

## Using appsettings.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning"
    }
  }
}
```

## Programmatic Filtering

```csharp
var loggerFactory = app.ApplicationServices
    .GetRequiredService<ILoggerFactory>();

loggerFactory.AddFilter("Microsoft", LogLevel.Warning);
```

---

# Log Providers

## AddConsole()

* Logs to console
* Useful in development and containers

## AddDebug()

* Logs to Visual Studio Debug window
* Development-only

---

# Logging to External Systems

To log to:

* Files
* Databases
* External systems

Use third-party providers:

* Serilog
* NLog
* Log4Net

---

## Example: Serilog File Logging

```csharp id="j0q97p"
Host.CreateDefaultBuilder(args)
    .ConfigureLogging(logging =>
    {
        logging.ClearProviders();
        logging.AddSerilog(new LoggerConfiguration()
            .WriteTo.File("logs/app.log")
            .CreateLogger());
    });
```

---

# Log Rotation and Retention (Serilog Example)

```csharp id="28gznm"
.WriteTo.File(
    "logs/log-.txt",
    rollingInterval: RollingInterval.Day,
    fileSizeLimitBytes: 10_000_000,
    retainedFileCountLimit: 5)
```

Features:

* Rolling logs
* File size limits
* Retention policies

---

# Exception Logging

Always log exceptions with stack trace:

```csharp id="e6g8wq"
try
{
    // risky code
}
catch (Exception ex)
{
    _logger.LogError(ex,
        "An error occurred while processing the request.");
}
```

Passing the exception ensures stack trace is captured.

---

# Logging HTTP Requests

Using middleware:

```csharp id="g8d9zt"
public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(
        RequestDelegate next,
        ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        _logger.LogInformation(
            "Handling request: {Method} {Path}",
            context.Request.Method,
            context.Request.Path);

        await _next(context);
    }
}
```

---

# Application Insights Integration

To enable Azure Application Insights:

1. Install:

   * `Microsoft.ApplicationInsights.AspNetCore`

2. Register:

```csharp id="rt9km4"
services.AddApplicationInsightsTelemetry(
    Configuration["ApplicationInsights:InstrumentationKey"]);
```

Application Insights provides:

* Request tracking
* Exception tracking
* Dependency tracking
* Performance metrics

---

# Key Interview Points

* ILogger<T> is injected via DI.
* Structured logging improves searchability.
* Log levels control verbosity.
* appsettings.json controls filtering.
* Middleware can log request/response.
* External providers handle file logging and retention.
* Always log exceptions with the exception object.

---

## Notes

* In .NET 6+, logging is configured via the Generic Host in `Program.cs`.
* Structured logging works best with centralized logging systems.
* Application Insights can use connection strings instead of instrumentation keys in modern setups.

```