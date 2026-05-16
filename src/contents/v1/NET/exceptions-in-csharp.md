---
id: exceptions-in-csharp
topic: C# Language Foundations
subtopic: Exceptions
category: .NET
---


## Overview

Exceptions in C# are the standard mechanism for reporting and handling runtime error conditions that prevent code from completing its intended operation. An exception represents an abnormal condition, such as invalid input, a missing file, a failed network call, an unavailable database, unauthorized access, or an invalid object state.

In C#, exception handling is built around the `try`, `catch`, `finally`, and `throw` keywords. Code that might fail is placed inside a `try` block, recoverable failures are handled in one or more `catch` blocks, cleanup logic can be placed in a `finally` block, and new exceptions can be raised with `throw`.

Exceptions matter because they affect application reliability, debugging, API design, logging, security, and user experience. In production .NET applications, exceptions are commonly handled at application boundaries, such as ASP.NET Core middleware, background worker boundaries, message consumer boundaries, scheduled jobs, and command handlers.

For interviews, exceptions are important because they test whether a developer understands more than just syntax. Interviewers often expect candidates to know when to throw exceptions, when not to throw exceptions, how to preserve stack traces, how `finally` relates to resource cleanup, how exceptions work with `async`/`await`, how to design custom exceptions, and how to build clean error handling in Web APIs.

## Core Concepts

### What Is an Exception?

An exception is an object that represents an error or unexpected condition during program execution. In .NET, exception types derive from `System.Exception`.

Common built-in exception types include:

- `ArgumentException`
- `ArgumentNullException`
- `ArgumentOutOfRangeException`
- `InvalidOperationException`
- `NotSupportedException`
- `UnauthorizedAccessException`
- `FileNotFoundException`
- `IOException`
- `TimeoutException`
- `OperationCanceledException`

Example:

```csharp
public decimal CalculateDiscount(decimal price, decimal discountPercent)
{
    if (price < 0)
    {
        throw new ArgumentOutOfRangeException(nameof(price), "Price cannot be negative.");
    }

    if (discountPercent is < 0 or > 100)
    {
        throw new ArgumentOutOfRangeException(nameof(discountPercent), "Discount must be between 0 and 100.");
    }

    return price * (discountPercent / 100);
}
```

In this example, the method throws exceptions because it cannot correctly complete its defined responsibility when the input is invalid.

### Exception Handling Syntax

The main exception handling keywords are:

| Keyword | Purpose |
|---|---|
| `try` | Wraps code that may throw an exception |
| `catch` | Handles a specific exception type |
| `finally` | Runs cleanup code whether an exception occurs or not |
| `throw` | Throws a new exception or rethrows an existing one |
| `when` | Adds a filter condition to a `catch` block |

Example:

```csharp
try
{
    string text = File.ReadAllText("settings.json");
    Console.WriteLine(text);
}
catch (FileNotFoundException ex)
{
    Console.WriteLine($"Configuration file was not found: {ex.FileName}");
}
catch (UnauthorizedAccessException)
{
    Console.WriteLine("The application does not have permission to read the file.");
}
finally
{
    Console.WriteLine("File read attempt finished.");
}
```

A `try` block must have at least one `catch`, one `finally`, or both.

### How Exception Propagation Works

When an exception is thrown, the runtime searches the call stack for the nearest matching `catch` block. If no suitable handler is found, the exception continues to propagate up the stack. If it remains unhandled, the application may terminate or the host may convert it into an error response.

Example:

```csharp
public void ProcessOrder(int orderId)
{
    ValidateOrder(orderId);
    SaveOrder(orderId);
}

private void ValidateOrder(int orderId)
{
    if (orderId <= 0)
    {
        throw new ArgumentOutOfRangeException(nameof(orderId));
    }
}
```

If `ValidateOrder` throws and `ProcessOrder` does not catch it, the exception moves to the caller of `ProcessOrder`.

In real applications, exceptions are often allowed to bubble up to a boundary where they can be logged and translated into a user-friendly response.

### Choosing the Right Exception Type

Choosing a specific exception type makes code easier to understand, test, and handle.

Common choices:

| Scenario | Recommended Exception |
|---|---|
| Required argument is `null` | `ArgumentNullException` |
| Argument value is outside valid range | `ArgumentOutOfRangeException` |
| Argument value is invalid but not range-based | `ArgumentException` |
| Object state does not allow the operation | `InvalidOperationException` |
| Operation is not supported by this implementation | `NotSupportedException` |
| Feature is intentionally not implemented yet | `NotImplementedException` |
| Operation is canceled | `OperationCanceledException` |
| Access is denied | `UnauthorizedAccessException` |
| A timeout occurs | `TimeoutException` |

Example:

```csharp
public void SendEmail(string recipient, string subject)
{
    ArgumentException.ThrowIfNullOrWhiteSpace(recipient);
    ArgumentException.ThrowIfNullOrWhiteSpace(subject);

    if (!_smtpClient.IsConnected)
    {
        throw new InvalidOperationException("Email cannot be sent because the SMTP client is not connected.");
    }

    // Send email...
}
```

Best practice is to throw the most specific exception that accurately describes the problem.

### Throwing Exceptions

Use `throw new` when creating a new exception:

```csharp
throw new InvalidOperationException("The order has already been submitted.");
```

Use guard clauses near the start of a method for invalid arguments:

```csharp
public Customer GetCustomer(Guid customerId)
{
    if (customerId == Guid.Empty)
    {
        throw new ArgumentException("Customer ID cannot be empty.", nameof(customerId));
    }

    // Query customer...
}
```

Modern C# also provides helper methods for common argument validation:

```csharp
public void CreateUser(string username)
{
    ArgumentException.ThrowIfNullOrWhiteSpace(username);

    // Create user...
}
```

Avoid intentionally throwing overly broad or runtime-reserved exceptions such as:

```csharp
throw new Exception("Something went wrong"); // Too generic
throw new NullReferenceException();          // Usually indicates a programming bug
throw new IndexOutOfRangeException();        // Usually thrown by the runtime
```

### Catching Exceptions

Catch exceptions when you can do something meaningful with them, such as:

- Retry the operation
- Use a fallback
- Convert the error to a domain-specific result
- Return an appropriate HTTP response
- Log the exception at an application boundary
- Add context and rethrow
- Release or roll back resources

Example:

```csharp
public async Task<string?> TryLoadConfigurationAsync(string path)
{
    try
    {
        return await File.ReadAllTextAsync(path);
    }
    catch (FileNotFoundException)
    {
        return null;
    }
}
```

This catch block is meaningful because a missing optional configuration file is expected and recoverable.

Avoid this pattern:

```csharp
try
{
    ProcessPayment();
}
catch
{
    // Bad: silently hides the real problem
}
```

Swallowing exceptions makes production issues hard to diagnose.

### Catching Specific Exceptions Before General Exceptions

When using multiple `catch` blocks, place more specific exception types before more general exception types.

Correct:

```csharp
try
{
    LoadFile();
}
catch (FileNotFoundException ex)
{
    Console.WriteLine($"File missing: {ex.FileName}");
}
catch (IOException ex)
{
    Console.WriteLine($"File I/O error: {ex.Message}");
}
catch (Exception ex)
{
    Console.WriteLine($"Unexpected error: {ex.Message}");
    throw;
}
```

Incorrect:

```csharp
try
{
    LoadFile();
}
catch (Exception)
{
    // This catches everything derived from Exception first.
}
catch (FileNotFoundException)
{
    // This is unreachable.
}
```

The compiler prevents unreachable catch blocks when a more general exception type appears before a more specific one.

### `throw;` vs `throw ex;`

One of the most common C# interview questions is the difference between `throw;` and `throw ex;`.

Use `throw;` to rethrow the current exception while preserving the original stack trace:

```csharp
try
{
    ProcessOrder();
}
catch (Exception ex)
{
    _logger.LogError(ex, "Order processing failed.");
    throw;
}
```

Avoid `throw ex;` because it resets the stack trace to the current catch block location:

```csharp
try
{
    ProcessOrder();
}
catch (Exception ex)
{
    _logger.LogError(ex, "Order processing failed.");
    throw ex; // Bad: loses original stack trace information
}
```

Preserving stack traces is important for debugging production issues.

### Exception Filters with `when`

Exception filters let you catch an exception only when a condition is true.

Example:

```csharp
try
{
    await CallExternalApiAsync();
}
catch (HttpRequestException ex) when (ex.Message.Contains("429"))
{
    Console.WriteLine("Rate limit was reached.");
}
```

Another example:

```csharp
try
{
    ProcessPayment(payment);
}
catch (PaymentException ex) when (ex.IsRetryable)
{
    await RetryPaymentAsync(payment);
}
```

Exception filters are useful when the exception type alone is not enough to decide how to handle the problem.

### `finally` and Resource Cleanup

A `finally` block runs after a `try` block finishes, regardless of whether an exception was thrown or caught. It is commonly used for cleanup.

Example:

```csharp
FileStream? stream = null;

try
{
    stream = File.OpenRead("report.csv");
    // Read file...
}
finally
{
    stream?.Dispose();
}
```

In modern C#, prefer `using` statements or `using` declarations for disposable resources:

```csharp
using var stream = File.OpenRead("report.csv");
// Use stream...
```

A `using` statement is compiled into a `try/finally` pattern that ensures `Dispose` is called.

For asynchronous cleanup, use `await using` with `IAsyncDisposable`:

```csharp
await using var connection = await OpenConnectionAsync();
// Use connection...
```

### Exceptions and `using`

`using` helps ensure resources are released even when exceptions occur.

Example:

```csharp
public string ReadReport(string path)
{
    using var reader = new StreamReader(path);
    return reader.ReadToEnd();
}
```

This is safer than manually opening and closing the resource because `Dispose` is called even if `ReadToEnd` throws.

Common mistake:

```csharp
var reader = new StreamReader(path);
string text = reader.ReadToEnd();
reader.Dispose();
```

If `ReadToEnd` throws, `Dispose` may never run. Use `using` instead.

### Custom Exceptions

A custom exception is useful when a built-in exception type is not expressive enough and callers need to handle a specific business or application error.

Example:

```csharp
public sealed class PaymentDeclinedException : Exception
{
    public string TransactionId { get; }

    public PaymentDeclinedException()
    {
    }

    public PaymentDeclinedException(string message)
        : base(message)
    {
    }

    public PaymentDeclinedException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public PaymentDeclinedException(string message, string transactionId)
        : base(message)
    {
        TransactionId = transactionId;
    }
}
```

Use custom exceptions when:

- The exception represents a meaningful domain or application failure
- Callers may catch that specific exception type
- Additional structured properties are useful
- A built-in exception does not describe the failure clearly

Avoid creating custom exceptions for every small validation case. Many cases are better handled with built-in exceptions or validation results.

### `InnerException`

`InnerException` preserves the original exception when wrapping it with a higher-level exception.

Example:

```csharp
try
{
    await _paymentGateway.ChargeAsync(request);
}
catch (HttpRequestException ex)
{
    throw new PaymentGatewayException("Failed to call payment gateway.", ex);
}
```

This gives the caller a more meaningful application-level exception while preserving the low-level cause.

Without `InnerException`, important debugging details may be lost.

### Exceptions in `async` and `await`

In `async` methods, exceptions are captured in the returned `Task`. They are rethrown when the task is awaited.

Example:

```csharp
public async Task<string> LoadDataAsync()
{
    await Task.Delay(100);
    throw new InvalidOperationException("Data source failed.");
}

try
{
    string data = await LoadDataAsync();
}
catch (InvalidOperationException ex)
{
    Console.WriteLine(ex.Message);
}
```

Important points:

- Exceptions in `async Task` methods are observed when awaited.
- Exceptions in `async void` methods are difficult to catch and should generally be avoided except for event handlers.
- Argument validation can be thrown synchronously before asynchronous work begins.
- Blocking on tasks with `.Wait()` or `.Result` can wrap exceptions in `AggregateException` and may cause deadlocks in some application types.

Prefer:

```csharp
await DoWorkAsync();
```

Avoid:

```csharp
DoWorkAsync().Wait();
var result = DoWorkAsync().Result;
```

### Exceptions with `Task.WhenAll`

When awaiting `Task.WhenAll`, multiple tasks may fail. The awaited exception often exposes one exception directly, while the returned task can contain multiple exceptions.

Example:

```csharp
Task task1 = SaveCustomerAsync(customer);
Task task2 = SendEmailAsync(customer.Email);

try
{
    await Task.WhenAll(task1, task2);
}
catch
{
    if (task1.Exception is not null)
    {
        foreach (Exception ex in task1.Exception.InnerExceptions)
        {
            Console.WriteLine($"Save failed: {ex.Message}");
        }
    }

    if (task2.Exception is not null)
    {
        foreach (Exception ex in task2.Exception.InnerExceptions)
        {
            Console.WriteLine($"Email failed: {ex.Message}");
        }
    }

    throw;
}
```

In interviews, a strong answer should mention that parallel asynchronous operations can produce more than one failure.

### Exceptions and Cancellation

Cancellation is not always an error. In .NET, cancellation is commonly represented by `OperationCanceledException` or `TaskCanceledException`.

Example:

```csharp
public async Task ProcessAsync(CancellationToken cancellationToken)
{
    cancellationToken.ThrowIfCancellationRequested();

    await Task.Delay(1000, cancellationToken);
}
```

When handling exceptions, avoid treating cancellation as a normal failure.

Example:

```csharp
try
{
    await ProcessAsync(cancellationToken);
}
catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
{
    Console.WriteLine("Operation was canceled by request.");
}
```

In ASP.NET Core, request cancellation can happen when the client disconnects. Logging cancellation as an error can create noisy logs.

### Exceptions vs Return Values vs Result Pattern

Exceptions are best for unexpected or exceptional failures where the method cannot complete its intended work. Return values or result objects are often better for expected business outcomes.

Exception example:

```csharp
public Customer GetCustomer(Guid id)
{
    return _repository.Find(id)
        ?? throw new CustomerNotFoundException($"Customer '{id}' was not found.");
}
```

Result pattern example:

```csharp
public sealed record Result<T>(bool IsSuccess, T? Value, string? Error);

public Result<Customer> TryGetCustomer(Guid id)
{
    Customer? customer = _repository.Find(id);

    if (customer is null)
    {
        return new Result<Customer>(false, null, "Customer was not found.");
    }

    return new Result<Customer>(true, customer, null);
}
```

General guidance:

| Situation | Better approach |
|---|---|
| Programming bug | Exception |
| Invalid method argument | Exception |
| Infrastructure failure | Exception |
| Expected validation error | Validation result |
| User entered invalid form data | Validation result |
| Optional missing value | `null`, `bool`, `Try` pattern, or Result |
| Domain rule failure | Depends on architecture; often Result or domain-specific exception |

A common interview mistake is saying "always use exceptions" or "never use exceptions." Good design depends on whether the failure is exceptional, expected, recoverable, or part of normal business flow.

### Exceptions and Performance

Throwing exceptions is relatively expensive compared with normal control flow because the runtime must create exception objects and capture stack information. However, the main concern is not usually raw speed; the bigger issue is design clarity.

Bad:

```csharp
public bool IsNumber(string input)
{
    try
    {
        int.Parse(input);
        return true;
    }
    catch
    {
        return false;
    }
}
```

Better:

```csharp
public bool IsNumber(string input)
{
    return int.TryParse(input, out _);
}
```

Use exceptions for exceptional conditions, not for frequent expected decisions.

### Global Exception Handling in ASP.NET Core

In Web APIs, exceptions should not usually be caught in every controller action. A better approach is to use centralized exception handling.

Example:

```csharp
app.UseExceptionHandler();

builder.Services.AddProblemDetails();
```

A typical production API maps exceptions to appropriate HTTP responses:

| Exception | HTTP response |
|---|---|
| Validation exception | `400 Bad Request` |
| Unauthorized access | `401 Unauthorized` or `403 Forbidden` |
| Not found exception | `404 Not Found` |
| Conflict exception | `409 Conflict` |
| Unhandled exception | `500 Internal Server Error` |

Example custom middleware concept:

```csharp
public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger)
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception occurred.");

            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsJsonAsync(new
            {
                title = "An unexpected error occurred.",
                status = 500
            });
        }
    }
}
```

In production, do not expose stack traces or sensitive exception details to clients.

### Logging Exceptions

Good exception logging should include enough context to diagnose the issue without leaking sensitive data.

Good:

```csharp
_logger.LogError(
    ex,
    "Failed to process order {OrderId} for customer {CustomerId}.",
    orderId,
    customerId);
```

Bad:

```csharp
_logger.LogError(ex.Message);
```

Logging only `ex.Message` loses stack trace and structured diagnostic information.

Avoid logging the same exception repeatedly at every layer. A common approach is:

- Add useful context if needed
- Rethrow with `throw;`
- Log once at the application boundary

### Common Exception Handling Mistakes

Common mistakes include:

- Catching `Exception` everywhere
- Swallowing exceptions silently
- Using `throw ex;` instead of `throw;`
- Throwing generic `Exception`
- Using exceptions for normal control flow
- Returning exception objects instead of throwing them
- Logging sensitive data in exception messages
- Catching an exception only to rethrow it without adding value
- Forgetting to preserve `InnerException`
- Blocking async code with `.Result` or `.Wait()`
- Treating cancellation as a production error
- Exposing stack traces in API responses
- Creating too many custom exception types without a real handling need

### Best Practices

Use these practical best practices:

- Throw exceptions only when a method cannot complete its intended responsibility.
- Prefer specific exception types.
- Validate arguments early.
- Use `ArgumentNullException.ThrowIfNull` and related guard helpers when appropriate.
- Catch only exceptions you can handle meaningfully.
- Use `throw;` to rethrow and preserve stack trace.
- Preserve original exceptions with `InnerException` when wrapping.
- Use `using`, `await using`, or `finally` for cleanup.
- Avoid exceptions for normal validation or parsing flows.
- Centralize exception handling in ASP.NET Core APIs.
- Log exceptions with structured context.
- Do not leak internal exception details to end users.
- Treat cancellation separately from failure.
- Write tests for expected exception behavior.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:exceptions-in-csharp-beginner-q01 -->
#### Beginner Q01: What is an exception in C#?
<!-- question-id:exceptions-in-csharp-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

An exception in C# is an object that represents an error or unexpected condition that occurs during program execution. Exceptions are derived from `System.Exception`. They are thrown when code cannot continue its normal operation and can be handled using `try`, `catch`, and `finally`.

For example, trying to read a missing file may throw `FileNotFoundException`, passing an invalid argument may throw `ArgumentException`, and calling a method when an object is in the wrong state may throw `InvalidOperationException`.

Exceptions separate normal application logic from error handling logic. They also provide diagnostic information such as the exception type, message, stack trace, and inner exception.

##### Key Points to Mention

- Exceptions represent runtime error conditions.
- Exception types derive from `System.Exception`.
- Exceptions are thrown with `throw`.
- Exceptions are handled with `try/catch/finally`.
- Exceptions include diagnostic information such as message and stack trace.
- They should be used for error conditions, not normal control flow.

<!-- question:end:exceptions-in-csharp-beginner-q01 -->

<!-- question:start:exceptions-in-csharp-beginner-q02 -->
#### Beginner Q02: What are `try`, `catch`, and `finally` used for?
<!-- question-id:exceptions-in-csharp-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`try`, `catch`, and `finally` are the main blocks used for exception handling in C#.

A `try` block contains code that might throw an exception. A `catch` block handles a specific exception type. A `finally` block contains cleanup code that runs whether an exception occurs or not.

Example:

```csharp
try
{
    string text = File.ReadAllText("file.txt");
}
catch (FileNotFoundException)
{
    Console.WriteLine("File was not found.");
}
finally
{
    Console.WriteLine("Operation finished.");
}
```

The `finally` block is often used to release resources, close connections, or clean up state. In modern C#, `using` is often preferred for disposable resources.

##### Key Points to Mention

- `try` wraps code that may fail.
- `catch` handles exceptions.
- `finally` runs cleanup code.
- `finally` runs whether an exception is thrown or not.
- A `try` block must have at least one `catch` or `finally`.
- `using` is often better for disposable resources.

<!-- question:end:exceptions-in-csharp-beginner-q02 -->

<!-- question:start:exceptions-in-csharp-beginner-q03 -->
#### Beginner Q03: What is the difference between `throw` and `throw new`?
<!-- question-id:exceptions-in-csharp-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`throw new` creates and throws a new exception instance.

```csharp
throw new InvalidOperationException("Order has already been submitted.");
```

`throw;` is used inside a `catch` block to rethrow the current exception while preserving the original stack trace.

```csharp
try
{
    ProcessOrder();
}
catch (Exception ex)
{
    _logger.LogError(ex, "Processing failed.");
    throw;
}
```

`throw new` is for creating a new exception. `throw;` is for rethrowing the same exception.

##### Key Points to Mention

- `throw new` throws a new exception object.
- `throw;` rethrows the current exception.
- `throw;` preserves the original stack trace.
- `throw;` can only be used inside a `catch` block.
- Avoid `throw ex;` because it resets stack trace information.

<!-- question:end:exceptions-in-csharp-beginner-q03 -->

<!-- question:start:exceptions-in-csharp-beginner-q04 -->
#### Beginner Q04: What is the difference between `throw;` and `throw ex;`?
<!-- question-id:exceptions-in-csharp-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`throw;` rethrows the current exception and preserves the original stack trace. This is the correct way to rethrow an exception after logging or adding handling logic.

```csharp
catch (Exception ex)
{
    _logger.LogError(ex, "Failed.");
    throw;
}
```

`throw ex;` throws the caught exception again but resets the stack trace to the current location. This makes debugging harder because the original source of the exception may be hidden.

```csharp
catch (Exception ex)
{
    throw ex; // Bad practice
}
```

In most cases, use `throw;` when rethrowing.

##### Key Points to Mention

- `throw;` preserves the original stack trace.
- `throw ex;` resets the stack trace.
- Stack trace preservation is critical for debugging.
- `throw;` is the preferred rethrow syntax.
- This is a very common C# interview question.

<!-- question:end:exceptions-in-csharp-beginner-q04 -->

<!-- question:start:exceptions-in-csharp-beginner-q05 -->
#### Beginner Q05: What are some common exception types in C#?
<!-- question-id:exceptions-in-csharp-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Common exception types in C# include:

- `ArgumentNullException`: a required argument is `null`
- `ArgumentException`: an argument is invalid
- `ArgumentOutOfRangeException`: an argument is outside the allowed range
- `InvalidOperationException`: the object state does not allow the operation
- `NotSupportedException`: an operation is not supported
- `FileNotFoundException`: a file cannot be found
- `IOException`: an input/output operation fails
- `UnauthorizedAccessException`: access is denied
- `TimeoutException`: an operation takes too long
- `OperationCanceledException`: an operation is canceled

A good developer should choose the most specific exception that accurately describes the failure.

##### Key Points to Mention

- Use specific exception types.
- Argument exceptions are used for invalid method input.
- `InvalidOperationException` is used for invalid object state.
- I/O exceptions are common for file and network operations.
- `OperationCanceledException` represents cancellation.
- Avoid throwing generic `Exception`.

<!-- question:end:exceptions-in-csharp-beginner-q05 -->

<!-- question:start:exceptions-in-csharp-beginner-q06 -->
#### Beginner Q06: When should you catch an exception?
<!-- question-id:exceptions-in-csharp-beginner-q06 -->
<!-- question-level:beginner -->

##### Expected Answer

You should catch an exception when you can do something meaningful with it. Examples include retrying the operation, using a fallback value, returning a specific error response, logging at an application boundary, rolling back a transaction, or converting the exception into a more meaningful domain-level error.

You should not catch exceptions just to hide them. Silently swallowing exceptions makes bugs difficult to find.

Good example:

```csharp
try
{
    return File.ReadAllText(path);
}
catch (FileNotFoundException)
{
    return string.Empty;
}
```

Bad example:

```csharp
try
{
    ProcessPayment();
}
catch
{
    // Exception hidden
}
```

##### Key Points to Mention

- Catch exceptions only when you can handle them meaningfully.
- Do not swallow exceptions silently.
- Catch specific exception types when possible.
- Logging should usually happen at boundaries.
- Rethrow with `throw;` when the caller still needs to know about the failure.

<!-- question:end:exceptions-in-csharp-beginner-q06 -->

<!-- question:start:exceptions-in-csharp-beginner-q07 -->
#### Beginner Q07: What is a stack trace?
<!-- question-id:exceptions-in-csharp-beginner-q07 -->
<!-- question-level:beginner -->

##### Expected Answer

A stack trace is diagnostic information that shows the sequence of method calls that led to an exception. It helps developers locate where the exception was thrown and how the code reached that point.

For example, if `Controller` calls `Service`, and `Service` calls `Repository`, and the repository throws an exception, the stack trace can show that call path.

Stack traces are very useful for debugging but should not usually be exposed to end users or API clients in production because they may reveal internal implementation details.

##### Key Points to Mention

- Stack trace shows the call path to the exception.
- It helps identify where the error happened.
- It is important for debugging and logging.
- `throw;` preserves the stack trace.
- Stack traces should not be exposed in production API responses.

<!-- question:end:exceptions-in-csharp-beginner-q07 -->

<!-- question:start:exceptions-in-csharp-beginner-q08 -->
#### Beginner Q08: Why should you not use exceptions for normal control flow?
<!-- question-id:exceptions-in-csharp-beginner-q08 -->
<!-- question-level:beginner -->

##### Expected Answer

Exceptions should represent exceptional or error conditions, not normal expected decisions. Using exceptions for normal flow makes code harder to read, harder to debug, and less efficient.

Bad example:

```csharp
try
{
    int value = int.Parse(input);
    return true;
}
catch
{
    return false;
}
```

Better example:

```csharp
return int.TryParse(input, out _);
```

For expected cases such as validation errors, missing optional data, or user input mistakes, a return value, validation result, `Try` method, or Result pattern may be more appropriate.

##### Key Points to Mention

- Exceptions are for exceptional or error conditions.
- Throwing exceptions has overhead.
- Normal flow should use conditionals, return values, `Try` methods, or validation results.
- `int.TryParse` is a classic example.
- Overusing exceptions can make code harder to maintain.

<!-- question:end:exceptions-in-csharp-beginner-q08 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:exceptions-in-csharp-intermediate-q01 -->
#### Intermediate Q01: How do you choose which exception type to throw?
<!-- question-id:exceptions-in-csharp-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Choose the most specific exception type that accurately describes why the method cannot complete its intended operation.

For invalid arguments, use argument-related exceptions:

```csharp
public void UpdateQuantity(int quantity)
{
    if (quantity <= 0)
    {
        throw new ArgumentOutOfRangeException(nameof(quantity), "Quantity must be greater than zero.");
    }
}
```

For invalid object state, use `InvalidOperationException`:

```csharp
public void Submit()
{
    if (Status == OrderStatus.Submitted)
    {
        throw new InvalidOperationException("Order has already been submitted.");
    }
}
```

For unsupported operations, use `NotSupportedException`. For cancellation, use `OperationCanceledException`.

Avoid throwing `Exception` because it is too generic and makes handling less precise.

##### Key Points to Mention

- Use the most specific exception type.
- Use argument exceptions for invalid input.
- Use `InvalidOperationException` for invalid object state.
- Use `NotSupportedException` for unsupported behavior.
- Use `OperationCanceledException` for cancellation.
- Avoid generic `Exception`.

<!-- question:end:exceptions-in-csharp-intermediate-q01 -->

<!-- question:start:exceptions-in-csharp-intermediate-q02 -->
#### Intermediate Q02: What is `InnerException` and why is it useful?
<!-- question-id:exceptions-in-csharp-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

`InnerException` stores the original exception when one exception is wrapped inside another. It is useful when lower-level technical exceptions need to be converted into higher-level application exceptions without losing diagnostic details.

Example:

```csharp
try
{
    await _paymentGateway.ChargeAsync(request);
}
catch (HttpRequestException ex)
{
    throw new PaymentGatewayException("Failed to charge customer.", ex);
}
```

Here, `PaymentGatewayException` gives the application a meaningful business-level error, while `InnerException` preserves the original `HttpRequestException`.

This helps debugging because developers can inspect the full exception chain.

##### Key Points to Mention

- `InnerException` preserves the original cause.
- It is used when wrapping exceptions.
- It helps keep both high-level context and low-level details.
- It is important for logging and troubleshooting.
- Do not lose the original exception when adding context.

<!-- question:end:exceptions-in-csharp-intermediate-q02 -->

<!-- question:start:exceptions-in-csharp-intermediate-q03 -->
#### Intermediate Q03: What are exception filters in C#?
<!-- question-id:exceptions-in-csharp-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Exception filters use the `when` keyword to catch an exception only when a condition is true.

Example:

```csharp
try
{
    await CallApiAsync();
}
catch (HttpRequestException ex) when (IsTransient(ex))
{
    await RetryAsync();
}
```

The catch block only executes if the exception is `HttpRequestException` and `IsTransient(ex)` returns `true`.

Exception filters are useful when the exception type alone is not specific enough. They can keep error handling logic more expressive and avoid catching an exception and then rethrowing it manually.

##### Key Points to Mention

- Exception filters use `catch (...) when (...)`.
- They catch only when the filter condition is true.
- They are useful for conditional handling.
- They can reduce unnecessary catch-and-rethrow logic.
- Common use cases include transient errors, status codes, and domain-specific flags.

<!-- question:end:exceptions-in-csharp-intermediate-q03 -->

<!-- question:start:exceptions-in-csharp-intermediate-q04 -->
#### Intermediate Q04: How do exceptions work with `async` and `await`?
<!-- question-id:exceptions-in-csharp-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

In `async Task` or `async Task<T>` methods, exceptions are captured in the returned `Task`. When the caller awaits the task, the exception is rethrown at the await point.

Example:

```csharp
public async Task<string> LoadAsync()
{
    await Task.Delay(100);
    throw new InvalidOperationException("Load failed.");
}

try
{
    string result = await LoadAsync();
}
catch (InvalidOperationException ex)
{
    Console.WriteLine(ex.Message);
}
```

The caller can handle the exception with normal `try/catch` around the `await`.

Blocking on async code with `.Wait()` or `.Result` can wrap exceptions in `AggregateException` and may cause deadlocks in some environments. Prefer `await`.

`async void` should generally be avoided except for event handlers because callers cannot await it or catch its exceptions normally.

##### Key Points to Mention

- Exceptions in async methods are stored in the returned `Task`.
- Exceptions are rethrown when awaited.
- Use `try/catch` around `await`.
- Avoid `.Wait()` and `.Result`.
- Avoid `async void` except for event handlers.
- Blocking APIs may expose `AggregateException`.

<!-- question:end:exceptions-in-csharp-intermediate-q04 -->

<!-- question:start:exceptions-in-csharp-intermediate-q05 -->
#### Intermediate Q05: What happens when multiple tasks fail in `Task.WhenAll`?
<!-- question-id:exceptions-in-csharp-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

When multiple tasks fail in `Task.WhenAll`, the combined task contains information about the failures. When awaited, an exception is thrown, but multiple underlying exceptions may exist.

Example:

```csharp
Task task1 = SaveAsync();
Task task2 = NotifyAsync();

try
{
    await Task.WhenAll(task1, task2);
}
catch
{
    if (task1.Exception is not null)
    {
        foreach (var ex in task1.Exception.InnerExceptions)
        {
            Console.WriteLine(ex.Message);
        }
    }

    if (task2.Exception is not null)
    {
        foreach (var ex in task2.Exception.InnerExceptions)
        {
            Console.WriteLine(ex.Message);
        }
    }

    throw;
}
```

A strong answer should mention that parallel async operations may produce more than one exception, and production code should consider whether all failures need to be logged or handled.

##### Key Points to Mention

- Multiple tasks can fail.
- The combined task can contain multiple exceptions.
- Awaiting `Task.WhenAll` throws an exception.
- Inspect task exceptions if all failures matter.
- Useful in parallel API calls, background jobs, and batch processing.

<!-- question:end:exceptions-in-csharp-intermediate-q05 -->

<!-- question:start:exceptions-in-csharp-intermediate-q06 -->
#### Intermediate Q06: When should you create a custom exception?
<!-- question-id:exceptions-in-csharp-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Create a custom exception when a built-in exception type does not clearly represent the failure and callers may need to catch or understand that specific error.

Example:

```csharp
public sealed class CustomerCreditLimitExceededException : Exception
{
    public Guid CustomerId { get; }

    public CustomerCreditLimitExceededException(Guid customerId, decimal limit)
        : base($"Customer '{customerId}' exceeded credit limit '{limit}'.")
    {
        CustomerId = customerId;
    }
}
```

Custom exceptions are useful for meaningful domain or application failures, especially when centralized exception handling maps them to specific responses.

However, avoid creating custom exceptions for every small validation case. Use built-in exceptions or validation results where appropriate.

##### Key Points to Mention

- Use custom exceptions for meaningful application/domain failures.
- Use them when callers may handle that specific type.
- Add properties only when programmatically useful.
- Name them with the `Exception` suffix.
- Derive from `Exception`.
- Do not overuse custom exceptions.

<!-- question:end:exceptions-in-csharp-intermediate-q06 -->

<!-- question:start:exceptions-in-csharp-intermediate-q07 -->
#### Intermediate Q07: How should exceptions be handled in ASP.NET Core Web APIs?
<!-- question-id:exceptions-in-csharp-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

In ASP.NET Core Web APIs, exceptions should usually be handled centrally instead of wrapping every controller action in `try/catch`. Centralized handling can be done with exception handling middleware, `UseExceptionHandler`, `IExceptionHandler`, and Problem Details.

A typical approach is:

- Let unexpected exceptions bubble up.
- Log them at the API boundary.
- Map known exception types to appropriate HTTP status codes.
- Return a consistent error response format.
- Do not expose stack traces or sensitive details in production.

Example mapping:

| Exception | Response |
|---|---|
| Validation exception | `400 Bad Request` |
| Not found exception | `404 Not Found` |
| Conflict exception | `409 Conflict` |
| Unauthorized exception | `401` or `403` |
| Unexpected exception | `500 Internal Server Error` |

##### Key Points to Mention

- Prefer centralized exception handling.
- Avoid repeated `try/catch` in every controller.
- Use Problem Details for consistent API errors.
- Map known exceptions to HTTP status codes.
- Log unhandled exceptions.
- Do not expose internal details in production.

<!-- question:end:exceptions-in-csharp-intermediate-q07 -->

<!-- question:start:exceptions-in-csharp-intermediate-q08 -->
#### Intermediate Q08: What is the difference between exceptions and validation errors?
<!-- question-id:exceptions-in-csharp-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

Exceptions represent abnormal failures where code cannot complete its intended operation. Validation errors are usually expected input problems that should be reported to the user in a controlled way.

For example, a user entering an invalid email address is not usually exceptional. It should be returned as a validation error. But a database connection failure during user registration is exceptional and may be represented by an exception.

Example validation result:

```csharp
if (string.IsNullOrWhiteSpace(request.Email))
{
    return BadRequest("Email is required.");
}
```

Example exception:

```csharp
if (!_database.IsAvailable)
{
    throw new InvalidOperationException("Database is unavailable.");
}
```

In domain-driven or CQRS-style systems, expected business rule failures are often modeled with a Result pattern, while unexpected infrastructure failures use exceptions.

##### Key Points to Mention

- Validation errors are expected user/input problems.
- Exceptions are for abnormal or exceptional failures.
- Invalid form input should usually not rely on exceptions.
- Infrastructure failures are commonly exceptions.
- Result pattern can be useful for expected business outcomes.
- Good error design improves API clarity.

<!-- question:end:exceptions-in-csharp-intermediate-q08 -->

<!-- question:start:exceptions-in-csharp-intermediate-q09 -->
#### Intermediate Q09: How should exception logging be done?
<!-- question-id:exceptions-in-csharp-intermediate-q09 -->
<!-- question-level:intermediate -->

##### Expected Answer

Exception logging should capture the full exception object and useful structured context. It should not log only `ex.Message`, because that loses stack trace and inner exception details.

Good example:

```csharp
_logger.LogError(
    ex,
    "Failed to process order {OrderId} for customer {CustomerId}.",
    orderId,
    customerId);
```

Bad example:

```csharp
_logger.LogError(ex.Message);
```

A common best practice is to log exceptions at application boundaries, such as middleware, background service loops, message consumers, and job runners. Avoid logging the same exception repeatedly at every layer unless each layer adds meaningful context.

Also avoid logging sensitive data such as passwords, tokens, payment card information, or private personal data.

##### Key Points to Mention

- Log the exception object, not just the message.
- Include structured context.
- Avoid duplicate logging at every layer.
- Log at boundaries.
- Do not leak sensitive information.
- Preserve stack trace and inner exception details.

<!-- question:end:exceptions-in-csharp-intermediate-q09 -->

<!-- question:start:exceptions-in-csharp-intermediate-q10 -->
#### Intermediate Q10: How are exceptions related to transactions and rollback?
<!-- question-id:exceptions-in-csharp-intermediate-q10 -->
<!-- question-level:intermediate -->

##### Expected Answer

Exceptions often indicate that an operation failed before completion. When a failure occurs during a transaction, the transaction should usually be rolled back to avoid partial updates.

Example:

```csharp
await using var transaction = await dbContext.Database.BeginTransactionAsync();

try
{
    dbContext.Orders.Add(order);
    dbContext.OrderEvents.Add(orderEvent);

    await dbContext.SaveChangesAsync();
    await transaction.CommitAsync();
}
catch
{
    await transaction.RollbackAsync();
    throw;
}
```

The key idea is to keep data consistent. If one part of a multi-step operation fails, the system should not leave half-completed changes behind.

In EF Core, `SaveChanges` already runs in a transaction for many simple cases, but explicit transactions may be needed when multiple operations must be committed together.

##### Key Points to Mention

- Exceptions can trigger rollback logic.
- Transactions protect data consistency.
- Use `try/catch` around transaction commit flows.
- Rethrow after rollback with `throw;`.
- Avoid partial updates.
- EF Core may create implicit transactions for simple `SaveChanges` operations.

<!-- question:end:exceptions-in-csharp-intermediate-q10 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:exceptions-in-csharp-advanced-q01 -->
#### Advanced Q01: How would you design exception handling in a production ASP.NET Core application?
<!-- question-id:exceptions-in-csharp-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

In a production ASP.NET Core application, exception handling should be centralized and consistent. Controllers and endpoints should not contain repeated generic `try/catch` blocks unless they can handle a specific recoverable error.

A strong design includes:

- Global exception handling middleware or `IExceptionHandler`
- Consistent Problem Details responses
- Mapping known exception types to HTTP status codes
- Structured logging with correlation IDs
- Safe production responses without stack traces
- Special handling for validation, not found, conflict, authorization, and cancellation cases
- Observability through logs, metrics, and tracing
- Tests that verify exception-to-response mappings

Example conceptual mapping:

```csharp
public static int MapStatusCode(Exception exception)
{
    return exception switch
    {
        ValidationException => StatusCodes.Status400BadRequest,
        NotFoundException => StatusCodes.Status404NotFound,
        ConflictException => StatusCodes.Status409Conflict,
        UnauthorizedAccessException => StatusCodes.Status403Forbidden,
        OperationCanceledException => StatusCodes.Status499ClientClosedRequest,
        _ => StatusCodes.Status500InternalServerError
    };
}
```

The exact implementation depends on the project, but the goal is consistent, secure, observable error handling.

##### Key Points to Mention

- Centralized handling at the API boundary.
- Problem Details for consistent API responses.
- Known exception-to-status-code mapping.
- Structured logging and correlation IDs.
- Do not expose internal details in production.
- Treat validation and cancellation carefully.
- Avoid repeated broad `try/catch` in controllers.

<!-- question:end:exceptions-in-csharp-advanced-q01 -->

<!-- question:start:exceptions-in-csharp-advanced-q02 -->
#### Advanced Q02: When would you use exceptions versus the Result pattern?
<!-- question-id:exceptions-in-csharp-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use exceptions for unexpected or exceptional failures where the method cannot complete its intended responsibility, such as infrastructure failures, invalid programmer usage, corrupted state, or failed external dependencies.

Use the Result pattern for expected business outcomes that are part of normal application flow, such as validation failures, insufficient balance, duplicate email, or a domain rule preventing an action.

Example Result:

```csharp
public sealed record Result(bool IsSuccess, string? Error)
{
    public static Result Success() => new(true, null);
    public static Result Failure(string error) => new(false, error);
}
```

Example usage:

```csharp
public Result SubmitOrder(Order order)
{
    if (order.Items.Count == 0)
    {
        return Result.Failure("Order must contain at least one item.");
    }

    if (order.Status == OrderStatus.Submitted)
    {
        return Result.Failure("Order is already submitted.");
    }

    order.Submit();
    return Result.Success();
}
```

A mature answer avoids extreme rules. Exceptions and Result both have valid uses. The key is whether the failure is exceptional or an expected part of the business workflow.

##### Key Points to Mention

- Exceptions are good for unexpected failures.
- Result is good for expected business outcomes.
- Validation errors often fit Result or validation models.
- Infrastructure failures often fit exceptions.
- Avoid using exceptions as normal control flow.
- Avoid making every method return complex result types unnecessarily.
- Design should be consistent across the application.

<!-- question:end:exceptions-in-csharp-advanced-q02 -->

<!-- question:start:exceptions-in-csharp-advanced-q03 -->
#### Advanced Q03: How do you preserve stack traces when rethrowing exceptions across layers?
<!-- question-id:exceptions-in-csharp-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Inside a `catch` block, use `throw;` to rethrow the current exception while preserving the original stack trace.

```csharp
catch (Exception ex)
{
    _logger.LogError(ex, "Operation failed.");
    throw;
}
```

When wrapping an exception with additional context, pass the original exception as `InnerException`.

```csharp
catch (SqlException ex)
{
    throw new OrderPersistenceException("Failed to save order.", ex);
}
```

If an exception must be captured and thrown later outside the original catch block, `ExceptionDispatchInfo` can preserve the original stack trace.

```csharp
ExceptionDispatchInfo captured;

try
{
    DoWork();
}
catch (Exception ex)
{
    captured = ExceptionDispatchInfo.Capture(ex);
}

captured.Throw();
```

The most common interview point is still: avoid `throw ex;`.

##### Key Points to Mention

- Use `throw;` inside `catch`.
- Avoid `throw ex;`.
- Use `InnerException` when wrapping.
- `ExceptionDispatchInfo` can preserve stack traces when rethrowing later.
- Stack trace preservation is critical for production debugging.

<!-- question:end:exceptions-in-csharp-advanced-q03 -->

<!-- question:start:exceptions-in-csharp-advanced-q04 -->
#### Advanced Q04: How do exception filters differ from catching and rethrowing?
<!-- question-id:exceptions-in-csharp-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Exception filters allow the runtime to decide whether a catch block applies before entering the catch block. If the filter condition is false, the runtime continues searching for another matching handler.

Example:

```csharp
try
{
    await SendRequestAsync();
}
catch (HttpRequestException ex) when (IsRetryable(ex))
{
    await RetryAsync();
}
```

Without filters, developers often catch broadly, check a condition, and rethrow:

```csharp
catch (HttpRequestException ex)
{
    if (!IsRetryable(ex))
    {
        throw;
    }

    await RetryAsync();
}
```

Filters can make intent clearer and avoid unnecessary catch/rethrow patterns. They are especially useful for status-code-based handling, transient error handling, logging filters, and domain-specific exception properties.

##### Key Points to Mention

- Filters use `when`.
- The catch block runs only if the condition is true.
- Filters reduce catch-check-rethrow patterns.
- They improve readability for conditional exception handling.
- Useful for transient errors and specific status codes.

<!-- question:end:exceptions-in-csharp-advanced-q04 -->

<!-- question:start:exceptions-in-csharp-advanced-q05 -->
#### Advanced Q05: What are the risks of catching `Exception` globally?
<!-- question-id:exceptions-in-csharp-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Catching `Exception` globally is appropriate at application boundaries, such as ASP.NET Core middleware, background worker loops, or message consumer boundaries. However, catching `Exception` deep inside business logic can be risky.

Risks include:

- Hiding bugs
- Accidentally swallowing serious failures
- Making code continue in an invalid state
- Losing stack trace if rethrown incorrectly
- Logging duplicate errors
- Converting all failures into vague responses
- Catching exceptions the code cannot actually recover from

A good rule is: catch specific exceptions close to the source only when they can be handled meaningfully; catch broad exceptions at boundaries for logging, cleanup, and safe failure responses.

##### Key Points to Mention

- Broad catches are useful at application boundaries.
- Broad catches are dangerous inside core logic.
- Do not swallow unknown exceptions.
- Do not continue with invalid state.
- Log and fail safely.
- Prefer specific catches when recovery is possible.

<!-- question:end:exceptions-in-csharp-advanced-q05 -->

<!-- question:start:exceptions-in-csharp-advanced-q06 -->
#### Advanced Q06: How do exceptions affect reliability and state consistency?
<!-- question-id:exceptions-in-csharp-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Exceptions can interrupt execution at almost any point, so methods should be designed to avoid leaving objects, databases, files, or external systems in inconsistent states.

Examples of reliability concerns:

- A method updates one field but throws before updating another.
- A database insert succeeds but an event publish fails.
- A file is opened but not closed.
- A transaction is partially completed.
- A lock is acquired but not released.

Solutions include:

- Validate before mutating state.
- Use transactions for atomic database operations.
- Use `finally`, `using`, and `await using` for cleanup.
- Keep operations idempotent where possible.
- Roll back or compensate failed multi-step workflows.
- Avoid catching exceptions and continuing with corrupted state.

Example:

```csharp
public void Transfer(Account from, Account to, decimal amount)
{
    if (amount <= 0)
    {
        throw new ArgumentOutOfRangeException(nameof(amount));
    }

    from.Withdraw(amount);
    to.Deposit(amount);
}
```

In a real system, this may need a transaction or domain design that ensures both changes succeed or neither change is committed.

##### Key Points to Mention

- Exceptions can interrupt execution.
- State may become inconsistent if not designed carefully.
- Validate before state changes.
- Use transactions for atomic persistence.
- Use cleanup patterns for resources.
- Do not continue after unknown serious failures.
- Consider idempotency and compensation for distributed systems.

<!-- question:end:exceptions-in-csharp-advanced-q06 -->

<!-- question:start:exceptions-in-csharp-advanced-q07 -->
#### Advanced Q07: How should cancellation be handled differently from exceptions?
<!-- question-id:exceptions-in-csharp-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Cancellation is often a requested stop, not a system failure. In .NET, cancellation is commonly represented by `OperationCanceledException` or `TaskCanceledException`, usually connected to a `CancellationToken`.

Example:

```csharp
public async Task ExportAsync(CancellationToken cancellationToken)
{
    cancellationToken.ThrowIfCancellationRequested();

    await GenerateFileAsync(cancellationToken);
}
```

At boundaries, cancellation should often be logged at a lower severity or not logged as an error, depending on the application. In ASP.NET Core, cancellation may happen because the client disconnected or aborted the request.

Handling cancellation separately prevents noisy error logs and makes monitoring more accurate.

##### Key Points to Mention

- Cancellation is not always an error.
- It is represented by `OperationCanceledException`.
- It is commonly triggered through `CancellationToken`.
- Do not log normal cancellation as a production error.
- Handle cancellation separately from unexpected failures.
- In Web APIs, client disconnects can trigger cancellation.

<!-- question:end:exceptions-in-csharp-advanced-q07 -->

<!-- question:start:exceptions-in-csharp-advanced-q08 -->
#### Advanced Q08: How do you design custom exceptions well?
<!-- question-id:exceptions-in-csharp-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

A well-designed custom exception should represent a meaningful failure that callers may handle specifically. It should derive from `Exception`, end with the `Exception` suffix, include standard constructors, and expose additional properties only when they are useful programmatically.

Example:

```csharp
public sealed class DuplicateEmailException : Exception
{
    public string Email { get; }

    public DuplicateEmailException()
    {
    }

    public DuplicateEmailException(string message)
        : base(message)
    {
    }

    public DuplicateEmailException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public DuplicateEmailException(string email, string message)
        : base(message)
    {
        Email = email;
    }
}
```

Avoid designing custom exceptions only to change the message text. If no caller will catch the type and no extra structured data is needed, a built-in exception may be enough.

Also avoid putting sensitive data in exception messages or properties.

##### Key Points to Mention

- Derive from `Exception`.
- End the class name with `Exception`.
- Include common constructors.
- Add structured properties only when useful.
- Preserve inner exceptions.
- Avoid custom exceptions for every small case.
- Avoid sensitive data in messages.

<!-- question:end:exceptions-in-csharp-advanced-q08 -->

<!-- question:start:exceptions-in-csharp-advanced-q09 -->
#### Advanced Q09: How would you test exception behavior?
<!-- question-id:exceptions-in-csharp-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

Exception behavior can be tested with unit tests and integration tests.

Unit tests can verify that invalid input throws the correct exception type:

```csharp
[Fact]
public void CreateOrder_WithEmptyCustomerId_ThrowsArgumentException()
{
    var ex = Assert.Throws<ArgumentException>(() =>
        Order.Create(Guid.Empty));

    Assert.Equal("customerId", ex.ParamName);
}
```

Async exceptions should be tested with async assertion helpers:

```csharp
[Fact]
public async Task HandleAsync_WhenRepositoryFails_ThrowsOrderException()
{
    await Assert.ThrowsAsync<OrderPersistenceException>(() =>
        handler.HandleAsync(command));
}
```

Integration tests can verify that API-level exception handling returns the expected HTTP response:

```csharp
var response = await client.GetAsync("/api/customers/invalid-id");

Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
```

Good tests should verify the type, important properties, and externally visible behavior. Avoid over-testing exact exception message text unless the message is part of a public contract.

##### Key Points to Mention

- Use `Assert.Throws` for synchronous exceptions.
- Use `Assert.ThrowsAsync` for async exceptions.
- Verify exception type and important properties.
- Integration test API error responses.
- Avoid brittle tests based only on exact messages.
- Test both known and unexpected error paths where useful.

<!-- question:end:exceptions-in-csharp-advanced-q09 -->

<!-- question:start:exceptions-in-csharp-advanced-q10 -->
#### Advanced Q10: What are common exception handling anti-patterns in enterprise C# applications?
<!-- question-id:exceptions-in-csharp-advanced-q10 -->
<!-- question-level:advanced -->

##### Expected Answer

Common anti-patterns include:

1. Swallowing exceptions silently:

```csharp
catch
{
}
```

2. Throwing generic exceptions:

```csharp
throw new Exception("Failed");
```

3. Resetting stack traces:

```csharp
catch (Exception ex)
{
    throw ex;
}
```

4. Catching everything in every method:

```csharp
catch (Exception ex)
{
    return false;
}
```

5. Using exceptions for expected validation flow:

```csharp
try
{
    int.Parse(input);
}
catch
{
    return false;
}
```

6. Exposing exception details to API clients in production.

7. Logging the same exception repeatedly at every layer.

8. Ignoring cancellation and treating it as an error.

A strong developer should be able to explain not only that these are bad, but why they make systems harder to debug, less reliable, less secure, or harder to maintain.

##### Key Points to Mention

- Do not swallow exceptions.
- Do not throw generic `Exception`.
- Do not use `throw ex;`.
- Do not use exceptions for normal flow.
- Do not leak internal details.
- Avoid duplicate logging.
- Treat cancellation separately.
- Handle exceptions at the right architectural boundary.

<!-- question:end:exceptions-in-csharp-advanced-q10 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
