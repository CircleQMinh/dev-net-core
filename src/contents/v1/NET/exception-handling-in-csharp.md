---
id: exception-handling-in-csharp
topic: Async programming, tasks, cancellation, and concurrency
subtopic: Exception Handling in C#
category: .NET
---



## Overview

Exception handling in C# is the mechanism used to detect, propagate, handle, and recover from runtime errors. It is built around `try`, `catch`, `finally`, `throw`, exception types, stack traces, and the .NET exception hierarchy.

In real applications, exception handling is used when an operation cannot complete its intended work. Examples include invalid arguments, unavailable files, failed database calls, network timeouts, permission failures, unexpected object state, and external service failures.

Exception handling matters because production applications must fail safely, release resources correctly, preserve useful diagnostic information, return appropriate API responses, and avoid hiding serious problems. Poor exception handling can make bugs harder to diagnose, corrupt application state, leak resources, or turn small failures into system-wide outages.

For interviews, exception handling is important because it tests both language knowledge and production judgment. Interviewers often expect candidates to understand not only syntax, but also when to catch exceptions, when to let them propagate, how to preserve stack traces, how async exceptions behave, how to handle cancellation, how to design custom exceptions, and how error handling works in ASP.NET Core applications.

## Core Concepts

### What an Exception Is

An exception is an object that represents an error or unexpected condition that occurs while a program is running.

In .NET, exceptions usually derive from `System.Exception`. When an exception is thrown, normal execution stops and the runtime searches for a matching `catch` block. If no matching handler is found, the exception continues up the call stack until it is handled or until the application boundary is reached.

Common exception types include:

- `ArgumentNullException`
- `ArgumentException`
- `ArgumentOutOfRangeException`
- `InvalidOperationException`
- `NotSupportedException`
- `FileNotFoundException`
- `IOException`
- `UnauthorizedAccessException`
- `TimeoutException`
- `OperationCanceledException`

Example:

```csharp
public decimal Divide(decimal left, decimal right)
{
    if (right == 0)
    {
        throw new DivideByZeroException("The divisor cannot be zero.");
    }

    return left / right;
}
```

In production code, prefer the most specific exception type that describes the failure.

### The Basic `try`, `catch`, and `finally` Flow

A `try` block contains code that might fail. A `catch` block handles a specific exception. A `finally` block contains cleanup code that should run whether the operation succeeds or fails.

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
catch (UnauthorizedAccessException ex)
{
    Console.WriteLine($"Access denied: {ex.Message}");
}
finally
{
    Console.WriteLine("File read attempt finished.");
}
```

Important rules:

- A `try` block must have at least one `catch` or one `finally`.
- `catch` blocks are checked from top to bottom.
- More specific exception types should come before more general exception types.
- Only one matching `catch` block runs for a thrown exception.
- `finally` is commonly used for cleanup, although `using` is usually better for disposable resources.

### Catch Specific Exceptions

A common mistake is catching `Exception` everywhere.

```csharp
try
{
    ProcessOrder(order);
}
catch (Exception ex)
{
    Console.WriteLine(ex.Message);
}
```

This is usually too broad because it can hide programming bugs, infrastructure failures, and corrupted state. A better approach is to catch only exceptions you can handle meaningfully.

```csharp
try
{
    ProcessOrder(order);
}
catch (PaymentDeclinedException ex)
{
    logger.LogWarning(ex, "Payment was declined for order {OrderId}.", order.Id);
    return OrderResult.PaymentDeclined;
}
catch (InventoryUnavailableException ex)
{
    logger.LogWarning(ex, "Inventory was unavailable for order {OrderId}.", order.Id);
    return OrderResult.OutOfStock;
}
```

It is acceptable to catch a broad exception at application boundaries, such as:

- API middleware
- background worker top-level loops
- message handler boundaries
- CLI command boundaries
- logging and crash reporting boundaries

At those boundaries, the goal is usually to log the failure, return a safe response, and prevent sensitive implementation details from leaking to the user.

### `throw` vs `throw ex`

When rethrowing an exception from inside a `catch` block, use `throw;`, not `throw ex;`.

Correct:

```csharp
try
{
    SaveCustomer(customer);
}
catch (SqlException ex)
{
    logger.LogError(ex, "Failed to save customer {CustomerId}.", customer.Id);
    throw;
}
```

Incorrect:

```csharp
try
{
    SaveCustomer(customer);
}
catch (SqlException ex)
{
    logger.LogError(ex, "Failed to save customer {CustomerId}.", customer.Id);
    throw ex;
}
```

`throw;` preserves the original stack trace. `throw ex;` resets the stack trace from the rethrow location, which makes debugging harder.

### Wrapping Exceptions and Inner Exceptions

Sometimes a lower-level exception should be wrapped in a higher-level exception that better describes the business operation that failed.

```csharp
public async Task<CustomerProfile> GetCustomerProfileAsync(Guid customerId)
{
    try
    {
        return await repository.GetProfileAsync(customerId);
    }
    catch (SqlException ex)
    {
        throw new CustomerProfileLoadException(
            $"Failed to load customer profile for customer '{customerId}'.",
            ex);
    }
}
```

The original exception should be passed as the inner exception. This preserves the root cause while adding context.

Good exception wrapping:

- Adds meaningful context.
- Preserves the original exception as `InnerException`.
- Uses a higher-level exception type when the lower-level type is not meaningful to the caller.

Poor exception wrapping:

- Catches and rethrows without adding value.
- Replaces the original exception and loses diagnostic information.
- Converts every exception into a generic exception type.

### Exception Filters with `when`

Exception filters let you catch an exception only when a condition is true.

```csharp
try
{
    await httpClient.GetAsync(url);
}
catch (HttpRequestException ex) when (ex.Message.Contains("timeout", StringComparison.OrdinalIgnoreCase))
{
    logger.LogWarning(ex, "The request timed out.");
}
```

A more realistic example is filtering by status code:

```csharp
try
{
    await SendToExternalApiAsync(request);
}
catch (ExternalApiException ex) when (ex.StatusCode == 429)
{
    logger.LogWarning(ex, "External API rate limit was reached.");
    throw new RetryableExternalApiException("The external API rate limit was reached.", ex);
}
catch (ExternalApiException ex) when (ex.StatusCode >= 500)
{
    logger.LogWarning(ex, "External API returned a server error.");
    throw new RetryableExternalApiException("The external API is temporarily unavailable.", ex);
}
```

Exception filters are useful when the exception type is the same but the handling depends on additional data.

### `finally`, `using`, and Resource Cleanup

`finally` is useful for cleanup code that must run even when an exception occurs.

```csharp
FileStream? stream = null;

try
{
    stream = File.OpenRead("data.txt");
    // Read the file.
}
finally
{
    stream?.Dispose();
}
```

However, for types that implement `IDisposable` or `IAsyncDisposable`, prefer `using` or `await using`.

```csharp
using FileStream stream = File.OpenRead("data.txt");
// Use the stream.
```

For asynchronous disposal:

```csharp
await using var connection = await CreateConnectionAsync();
// Use the connection.
```

`using` is clearer and less error-prone than manually writing `try/finally` for most resource cleanup.

### Do Not Use Exceptions for Normal Control Flow

Exceptions are for exceptional or invalid conditions, not ordinary decision-making.

Poor approach:

```csharp
try
{
    int value = int.Parse(input);
    Console.WriteLine(value);
}
catch (FormatException)
{
    Console.WriteLine("Invalid number.");
}
```

Better approach for expected invalid input:

```csharp
if (int.TryParse(input, out int value))
{
    Console.WriteLine(value);
}
else
{
    Console.WriteLine("Invalid number.");
}
```

Use exceptions when the method cannot complete its contract. Use validation, conditional checks, `TryParse`, `TryGetValue`, or result objects for expected outcomes.

### Argument Validation

Public methods should validate their inputs and throw clear argument exceptions when the caller violates the method contract.

```csharp
public Customer CreateCustomer(string name, string email)
{
    ArgumentException.ThrowIfNullOrWhiteSpace(name);
    ArgumentException.ThrowIfNullOrWhiteSpace(email);

    if (!email.Contains('@'))
    {
        throw new ArgumentException("Email must be a valid email address.", nameof(email));
    }

    return new Customer(name, email);
}
```

Common argument exceptions:

- Use `ArgumentNullException` when a required argument is `null`.
- Use `ArgumentException` when an argument is invalid.
- Use `ArgumentOutOfRangeException` when a value is outside the allowed range.

For modern C#, static throw helper methods such as `ArgumentNullException.ThrowIfNull` and `ArgumentException.ThrowIfNullOrWhiteSpace` make validation concise and consistent.

### Exception Safety and State Consistency

A method should avoid leaving an object in an invalid or partially updated state when an exception occurs.

Risky example:

```csharp
public void Transfer(Account from, Account to, decimal amount)
{
    from.Balance -= amount;

    // If this throws, money was removed but not added.
    to.Balance += amount;
}
```

Better approach:

```csharp
public void Transfer(Account from, Account to, decimal amount)
{
    if (amount <= 0)
    {
        throw new ArgumentOutOfRangeException(nameof(amount), "Amount must be positive.");
    }

    if (from.Balance < amount)
    {
        throw new InvalidOperationException("Insufficient funds.");
    }

    decimal originalFromBalance = from.Balance;
    decimal originalToBalance = to.Balance;

    try
    {
        from.Balance -= amount;
        to.Balance += amount;
    }
    catch
    {
        from.Balance = originalFromBalance;
        to.Balance = originalToBalance;
        throw;
    }
}
```

In real systems, transactions are often used to protect consistency.

Examples:

- SQL transaction for database updates.
- Message processing with retry and dead-letter handling.
- Unit of Work pattern in business applications.
- Outbox pattern for coordinating database changes and message publishing.

### Async Exception Handling

Exceptions thrown inside an async method are stored in the returned `Task` and rethrown when the task is awaited.

```csharp
public async Task<string> DownloadAsync(string url)
{
    using var client = new HttpClient();
    return await client.GetStringAsync(url);
}

try
{
    string result = await DownloadAsync("https://example.com");
}
catch (HttpRequestException ex)
{
    logger.LogError(ex, "Download failed.");
}
```

Important async exception rules:

- Exceptions before the first `await` can still be represented through the returned task in most async methods.
- Awaiting a faulted task rethrows the exception.
- If a task is never awaited or observed, its exception may be missed.
- `async void` exceptions are difficult to handle and can crash application-level contexts.
- Prefer `async Task` or `async Task<T>` over `async void`, except for event handlers.

Avoid fire-and-forget code unless it has its own exception handling:

```csharp
_ = Task.Run(async () =>
{
    try
    {
        await SendAuditLogAsync();
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to send audit log.");
    }
});
```

### `Task.WhenAll` and Multiple Exceptions

`Task.WhenAll` waits for multiple tasks. If one or more tasks fail, the returned task is faulted.

```csharp
Task[] tasks =
[
    ImportCustomersAsync(),
    ImportOrdersAsync(),
    ImportInvoicesAsync()
];

try
{
    await Task.WhenAll(tasks);
}
catch (Exception ex)
{
    logger.LogError(ex, "One or more imports failed.");

    foreach (Task task in tasks.Where(t => t.IsFaulted))
    {
        logger.LogError(task.Exception, "A task failed.");
    }
}
```

When awaiting `Task.WhenAll`, one exception is rethrown, but the task's `Exception` property can contain multiple inner exceptions. This is important in batch processing and parallel operations.

### Cancellation Is Not the Same as Failure

Cancellation usually represents an intentional stop request, not a system failure.

Common cancellation types:

- `CancellationToken`
- `OperationCanceledException`
- `TaskCanceledException`

Example:

```csharp
public async Task<string> ReadFileAsync(string path, CancellationToken cancellationToken)
{
    return await File.ReadAllTextAsync(path, cancellationToken);
}
```

Handling cancellation:

```csharp
try
{
    string content = await ReadFileAsync(path, cancellationToken);
}
catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
{
    logger.LogInformation("The operation was canceled by request.");
}
```

In most applications, cancellation should be logged at a lower severity than unexpected exceptions.

### Custom Exceptions

Create a custom exception only when existing exception types do not clearly describe the failure and callers need to distinguish that failure programmatically.

```csharp
public sealed class OrderCannotBeSubmittedException : Exception
{
    public OrderCannotBeSubmittedException()
    {
    }

    public OrderCannotBeSubmittedException(string message)
        : base(message)
    {
    }

    public OrderCannotBeSubmittedException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public string? OrderId { get; init; }
}
```

Best practices:

- End the type name with `Exception`.
- Derive from `Exception`.
- Include common constructors.
- Add extra properties only when callers can use them programmatically.
- Avoid creating custom exceptions for every small validation rule.

### Exceptions vs Result Objects

Exceptions and result objects solve different problems.

Use exceptions when:

- A method cannot complete its intended contract.
- The failure is unexpected or exceptional.
- The error should propagate to a higher-level boundary.
- You need stack trace diagnostics.

Use result objects when:

- Failure is expected and part of normal business flow.
- The caller should handle success and failure explicitly.
- You want to avoid exceptions for validation or predictable outcomes.

Example result object:

```csharp
public sealed record CreateOrderResult(bool Succeeded, string? Error);

public CreateOrderResult CreateOrder(OrderRequest request)
{
    if (request.Items.Count == 0)
    {
        return new CreateOrderResult(false, "An order must contain at least one item.");
    }

    return new CreateOrderResult(true, null);
}
```

Practical examples:

- Invalid login credentials are usually a result, not an exception.
- A missing required constructor argument is usually an exception.
- A database outage is usually an exception.
- A business rule failure may be a result or a domain exception depending on the architecture.

### Logging Exceptions

When logging exceptions, include the exception object, not only the message.

Poor logging:

```csharp
logger.LogError(ex.Message);
```

Better logging:

```csharp
logger.LogError(ex, "Failed to process order {OrderId}.", order.Id);
```

Good exception logging should include:

- The exception object.
- A useful message with operation context.
- Correlation IDs or request IDs when available.
- Relevant business identifiers, such as order ID or customer ID.
- No sensitive data such as passwords, tokens, full credit card numbers, or private personal information.

Avoid logging the same exception repeatedly at every layer. Usually, log where the exception is handled or at an application boundary.

### Exception Handling in ASP.NET Core APIs

In ASP.NET Core, avoid putting large `try/catch` blocks in every controller action. Prefer centralized error handling through middleware or exception handlers.

Example concept:

```csharp
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/problem+json";

        await Results.Problem(
            title: "An unexpected error occurred.",
            statusCode: StatusCodes.Status500InternalServerError)
            .ExecuteAsync(context);
    });
});
```

Controller actions should usually focus on application logic:

```csharp
[HttpGet("{id:guid}")]
public async Task<ActionResult<CustomerDto>> GetCustomer(Guid id)
{
    CustomerDto? customer = await service.GetCustomerAsync(id);

    if (customer is null)
    {
        return NotFound();
    }

    return Ok(customer);
}
```

Use explicit responses for expected HTTP outcomes such as `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, and `404 Not Found`. Use centralized exception handling for unexpected failures.

### Common Mistakes

Common exception handling mistakes include:

- Catching `Exception` too broadly.
- Swallowing exceptions silently.
- Using `throw ex;` instead of `throw;`.
- Throwing exceptions for normal validation flow.
- Losing inner exception details.
- Logging only `ex.Message`.
- Forgetting to await a task.
- Using `async void` outside event handlers.
- Throwing from `finally`.
- Catching cancellation as an error.
- Returning internal exception details to API clients.
- Creating too many custom exception types.
- Catching exceptions at a low level without a real recovery strategy.

### Best Practices Summary

Good exception handling usually follows these practices:

- Throw exceptions when a method cannot complete its contract.
- Catch exceptions only when you can recover, translate, add useful context, or handle them at a boundary.
- Catch specific exception types.
- Preserve stack traces with `throw;`.
- Preserve root causes with inner exceptions.
- Use `using` or `await using` for disposable resources.
- Avoid exceptions for normal control flow.
- Validate public method arguments clearly.
- Treat cancellation differently from failure.
- Log exceptions with context and without sensitive data.
- Centralize API exception handling.
- Keep objects and data consistent when operations fail.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:exception-handling-in-csharp-beginner-q01 -->
#### Beginner Q01: What is exception handling in C#?

<!-- question-id:exception-handling-in-csharp-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Exception handling in C# is a structured way to handle runtime errors. Code that may fail is placed inside a `try` block. If an exception is thrown, the runtime searches for a matching `catch` block. A `finally` block can be used for cleanup code that must run whether the operation succeeds or fails.

Exceptions are represented as objects, usually derived from `System.Exception`. They contain useful diagnostic information such as the message, stack trace, and inner exception.

Exception handling is used to recover from known failures, add useful context, release resources, log errors, or allow failures to propagate to a higher-level handler.

##### Key Points to Mention

- Exceptions represent runtime errors or invalid conditions.
- `try` contains risky code.
- `catch` handles matching exceptions.
- `finally` runs cleanup code.
- Exceptions propagate up the call stack if not handled.
- Use exceptions for failures, not normal control flow.

<!-- question:end:exception-handling-in-csharp-beginner-q01 -->

<!-- question:start:exception-handling-in-csharp-beginner-q02 -->
#### Beginner Q02: What is the difference between `try`, `catch`, and `finally`?

<!-- question-id:exception-handling-in-csharp-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`try` defines a block of code where an exception might occur. `catch` defines how to handle a specific exception type. `finally` defines code that runs after the `try` and `catch` blocks, whether an exception occurred or not.

Example:

```csharp
try
{
    ProcessFile();
}
catch (IOException ex)
{
    Console.WriteLine(ex.Message);
}
finally
{
    Console.WriteLine("Cleanup finished.");
}
```

`finally` is commonly used for cleanup, but in modern C#, `using` or `await using` is often preferred for disposable resources.

##### Key Points to Mention

- `try` is required before `catch` or `finally`.
- `catch` handles exceptions.
- `finally` runs even if no matching `catch` exists.
- `finally` is useful for cleanup.
- `using` is often a cleaner resource cleanup pattern.

<!-- question:end:exception-handling-in-csharp-beginner-q02 -->

<!-- question:start:exception-handling-in-csharp-beginner-q03 -->
#### Beginner Q03: Why should specific exceptions be caught before general exceptions?

<!-- question-id:exception-handling-in-csharp-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

C# checks `catch` blocks from top to bottom and runs the first compatible handler. If a general exception type such as `Exception` appears before a more specific type such as `FileNotFoundException`, the specific handler becomes unreachable.

Correct order:

```csharp
try
{
    ReadConfiguration();
}
catch (FileNotFoundException ex)
{
    Console.WriteLine("The file was not found.");
}
catch (IOException ex)
{
    Console.WriteLine("A file I/O error occurred.");
}
catch (Exception ex)
{
    Console.WriteLine("An unexpected error occurred.");
}
```

The most specific exceptions should come first, followed by more general exceptions.

##### Key Points to Mention

- Catch blocks are evaluated in order.
- The first matching catch block runs.
- Specific exceptions should come before base exception types.
- Catching `Exception` too early makes specific handlers unreachable.
- Catching broad exceptions should usually be done at boundaries.

<!-- question:end:exception-handling-in-csharp-beginner-q03 -->

<!-- question:start:exception-handling-in-csharp-beginner-q04 -->
#### Beginner Q04: What is the difference between `throw` and `throw ex`?

<!-- question-id:exception-handling-in-csharp-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Inside a `catch` block, `throw;` rethrows the current exception while preserving the original stack trace. `throw ex;` throws the exception object again but resets the stack trace from the current location.

Correct:

```csharp
catch (Exception ex)
{
    logger.LogError(ex, "Operation failed.");
    throw;
}
```

Incorrect:

```csharp
catch (Exception ex)
{
    logger.LogError(ex, "Operation failed.");
    throw ex;
}
```

Preserving the original stack trace is important because it helps developers find where the error actually happened.

##### Key Points to Mention

- Use `throw;` to rethrow the current exception.
- Avoid `throw ex;`.
- `throw ex;` resets useful stack trace information.
- Preserving stack traces improves debugging.
- Add context through logging or wrapping with an inner exception.

<!-- question:end:exception-handling-in-csharp-beginner-q04 -->

<!-- question:start:exception-handling-in-csharp-beginner-q05 -->
#### Beginner Q05: When should you throw an exception?

<!-- question-id:exception-handling-in-csharp-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Throw an exception when a method cannot complete the work it promised to do. Examples include invalid arguments, invalid object state, missing required files, unauthorized access, failed database calls, or unsupported operations.

Example:

```csharp
public void Withdraw(decimal amount)
{
    if (amount <= 0)
    {
        throw new ArgumentOutOfRangeException(nameof(amount), "Amount must be greater than zero.");
    }

    if (amount > Balance)
    {
        throw new InvalidOperationException("Insufficient funds.");
    }

    Balance -= amount;
}
```

Do not throw exceptions for normal expected decisions, such as parsing user input when `TryParse` is available.

##### Key Points to Mention

- Throw when the method cannot complete its contract.
- Use specific exception types.
- Validate public method arguments.
- Avoid exceptions for expected control flow.
- Prefer `TryParse` or result objects for predictable failures.

<!-- question:end:exception-handling-in-csharp-beginner-q05 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:exception-handling-in-csharp-intermediate-q01 -->
#### Intermediate Q01: How should exceptions be handled in async methods?

<!-- question-id:exception-handling-in-csharp-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

In async methods, exceptions are captured by the returned `Task` and rethrown when the task is awaited. This means callers should usually use `await` inside a `try/catch` block.

```csharp
try
{
    string content = await httpClient.GetStringAsync(url);
}
catch (HttpRequestException ex)
{
    logger.LogError(ex, "HTTP request failed.");
}
```

If a task is started but never awaited, its exception may not be observed properly. This can lead to missed failures. `async void` should be avoided except for event handlers because callers cannot await it or catch its exceptions normally.

##### Key Points to Mention

- Async exceptions are stored in the returned `Task`.
- Awaiting a faulted task rethrows the exception.
- Use `try/catch` around `await`.
- Avoid unobserved fire-and-forget tasks.
- Avoid `async void` except for event handlers.

<!-- question:end:exception-handling-in-csharp-intermediate-q01 -->

<!-- question:start:exception-handling-in-csharp-intermediate-q02 -->
#### Intermediate Q02: What are exception filters and when would you use them?

<!-- question-id:exception-handling-in-csharp-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Exception filters use the `when` keyword to catch an exception only when a condition is true.

```csharp
try
{
    await SendRequestAsync();
}
catch (ExternalApiException ex) when (ex.StatusCode == 429)
{
    logger.LogWarning(ex, "Rate limit reached.");
}
catch (ExternalApiException ex) when (ex.StatusCode >= 500)
{
    logger.LogWarning(ex, "External API server error.");
}
```

They are useful when one exception type can represent multiple scenarios and each scenario needs different handling. They can also make code clearer than catching the exception and then writing conditional logic inside the `catch`.

##### Key Points to Mention

- Exception filters use `catch (...) when (...)`.
- The filter must evaluate to `true` for the handler to run.
- Useful when handling depends on exception properties.
- Helps avoid broad catch blocks with nested `if` statements.
- Filters should not throw exceptions.

<!-- question:end:exception-handling-in-csharp-intermediate-q02 -->

<!-- question:start:exception-handling-in-csharp-intermediate-q03 -->
#### Intermediate Q03: What is an inner exception and why is it useful?

<!-- question-id:exception-handling-in-csharp-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

An inner exception is the original exception that caused a higher-level exception to be thrown. It is passed into the constructor of the new exception.

```csharp
try
{
    await repository.SaveAsync(order);
}
catch (SqlException ex)
{
    throw new OrderSaveException("Failed to save the order.", ex);
}
```

The outer exception describes the higher-level operation that failed. The inner exception preserves the technical root cause. This is useful when translating low-level exceptions into domain-specific or application-specific exceptions without losing diagnostic details.

##### Key Points to Mention

- Inner exceptions preserve root cause information.
- Wrapping can add meaningful business or application context.
- Do not wrap exceptions without adding value.
- Always pass the original exception as the inner exception.
- Inner exceptions help debugging across application layers.

<!-- question:end:exception-handling-in-csharp-intermediate-q03 -->

<!-- question:start:exception-handling-in-csharp-intermediate-q04 -->
#### Intermediate Q04: How should cancellation be handled compared with exceptions?

<!-- question-id:exception-handling-in-csharp-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Cancellation is usually an expected cooperative stop request, not an unexpected failure. In C#, cancellation is commonly represented with `CancellationToken` and `OperationCanceledException`.

```csharp
try
{
    await service.ProcessAsync(cancellationToken);
}
catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
{
    logger.LogInformation("Processing was canceled.");
}
```

Cancellation should usually not be logged as an error. It should often be allowed to propagate or handled separately from unexpected exceptions.

##### Key Points to Mention

- Cancellation is intentional, not necessarily a failure.
- Use `CancellationToken`.
- Canceled operations often throw `OperationCanceledException`.
- Do not treat normal cancellation as an application error.
- Use exception filters to distinguish requested cancellation.

<!-- question:end:exception-handling-in-csharp-intermediate-q04 -->

<!-- question:start:exception-handling-in-csharp-intermediate-q05 -->
#### Intermediate Q05: How should exception handling be designed in ASP.NET Core APIs?

<!-- question-id:exception-handling-in-csharp-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

In ASP.NET Core APIs, expected HTTP outcomes should usually be returned explicitly, while unexpected exceptions should be handled centrally with middleware or an exception handler.

For example, a controller can return `NotFound()` for a missing resource:

```csharp
[HttpGet("{id:guid}")]
public async Task<ActionResult<CustomerDto>> GetCustomer(Guid id)
{
    CustomerDto? customer = await service.GetCustomerAsync(id);

    if (customer is null)
    {
        return NotFound();
    }

    return Ok(customer);
}
```

Unexpected exceptions can be handled by centralized error handling, which logs the failure and returns a safe error response such as Problem Details. This avoids repeating `try/catch` blocks in every action and prevents internal exception details from being exposed to clients.

##### Key Points to Mention

- Do not put repetitive `try/catch` blocks in every controller.
- Return explicit responses for expected outcomes.
- Use centralized middleware or exception handlers for unexpected failures.
- Return safe error responses.
- Do not expose stack traces or sensitive details to clients.
- Log exceptions with useful context.

<!-- question:end:exception-handling-in-csharp-intermediate-q05 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:exception-handling-in-csharp-advanced-q01 -->
#### Advanced Q01: How do you decide between exceptions and result objects?

<!-- question-id:exception-handling-in-csharp-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use exceptions when a method cannot complete its intended contract and the failure is exceptional or unexpected. Use result objects when failure is expected and part of normal business flow.

For example, invalid login credentials are usually not an exception because they are expected in normal application behavior. A database outage during login is an exception because the system cannot complete the operation.

```csharp
public sealed record LoginResult(bool Succeeded, string? Error);

public LoginResult Login(string username, string password)
{
    if (!IsValidCredential(username, password))
    {
        return new LoginResult(false, "Invalid username or password.");
    }

    return new LoginResult(true, null);
}
```

The key is consistency. Mixing exceptions and result objects randomly can make error handling confusing. A clean architecture often defines where domain validation, application results, and infrastructure exceptions belong.

##### Key Points to Mention

- Exceptions are for broken contracts or unexpected failures.
- Result objects are good for expected business outcomes.
- Validation errors may be results or exceptions depending on design.
- Infrastructure failures are usually exceptions.
- Consistency is more important than personal preference.
- Avoid using exceptions as normal branching logic.

<!-- question:end:exception-handling-in-csharp-advanced-q01 -->

<!-- question:start:exception-handling-in-csharp-advanced-q02 -->
#### Advanced Q02: What happens when `Task.WhenAll` is used and multiple tasks fail?

<!-- question-id:exception-handling-in-csharp-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

`Task.WhenAll` returns a task that completes when all supplied tasks complete. If one or more tasks fail, the returned task becomes faulted. When awaited, an exception is thrown. If multiple tasks fail, the returned task can contain multiple exceptions in its `Exception.InnerExceptions`.

```csharp
Task[] tasks =
[
    ProcessCustomersAsync(),
    ProcessOrdersAsync(),
    ProcessInvoicesAsync()
];

try
{
    await Task.WhenAll(tasks);
}
catch
{
    foreach (Task failedTask in tasks.Where(t => t.IsFaulted))
    {
        logger.LogError(failedTask.Exception, "A task failed.");
    }

    throw;
}
```

This matters in batch operations because simply catching the exception from `await Task.WhenAll(...)` may not show every failed operation unless the individual task exceptions are inspected.

##### Key Points to Mention

- `Task.WhenAll` waits for all tasks to complete.
- The returned task is faulted if any task fails.
- Awaiting rethrows an exception.
- Multiple failures may be available through the task's exception details.
- Inspect individual tasks when all failures matter.
- Preserve the original exception after logging.

<!-- question:end:exception-handling-in-csharp-advanced-q02 -->

<!-- question:start:exception-handling-in-csharp-advanced-q03 -->
#### Advanced Q03: How can exception handling affect application state consistency?

<!-- question-id:exception-handling-in-csharp-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

If an exception occurs halfway through an operation, the application can be left in a partially updated state. Good exception-safe code either completes the full operation or restores the previous state.

Risky example:

```csharp
public void Transfer(Account from, Account to, decimal amount)
{
    from.Balance -= amount;
    to.Balance += amount;
}
```

If the second update fails, the first account has already changed. A safer design validates first, uses transactions when appropriate, and avoids mutating state until the operation can complete safely.

In database code, transactions are often the correct solution. In distributed systems, consistency may require retries, idempotency, outbox patterns, compensating actions, or message dead-lettering.

##### Key Points to Mention

- Exceptions can interrupt operations halfway.
- Partial updates can corrupt state.
- Validate before mutating.
- Use transactions for database consistency.
- Use rollback or compensation where needed.
- Distributed systems need special patterns such as idempotency and outbox.

<!-- question:end:exception-handling-in-csharp-advanced-q03 -->

<!-- question:start:exception-handling-in-csharp-advanced-q04 -->
#### Advanced Q04: When should you create a custom exception type?

<!-- question-id:exception-handling-in-csharp-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Create a custom exception when existing exception types do not clearly describe the failure and callers need to catch or distinguish that failure programmatically.

Example:

```csharp
public sealed class PaymentProviderUnavailableException : Exception
{
    public PaymentProviderUnavailableException()
    {
    }

    public PaymentProviderUnavailableException(string message)
        : base(message)
    {
    }

    public PaymentProviderUnavailableException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public string? ProviderName { get; init; }
}
```

Do not create custom exceptions for every validation rule or every small error. Many cases can use existing exceptions such as `ArgumentException`, `InvalidOperationException`, or `NotSupportedException`.

##### Key Points to Mention

- Use predefined exception types when they fit.
- Create custom exceptions when callers need to distinguish the failure.
- End names with `Exception`.
- Include common constructors.
- Preserve inner exceptions.
- Add custom properties only when useful.
- Avoid excessive custom exception types.

<!-- question:end:exception-handling-in-csharp-advanced-q04 -->

<!-- question:start:exception-handling-in-csharp-advanced-q05 -->
#### Advanced Q05: What are the risks of catching and swallowing exceptions?

<!-- question-id:exception-handling-in-csharp-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Swallowing an exception means catching it and doing nothing or hiding it without proper recovery. This is dangerous because the application may continue with invalid state, missing data, or incomplete operations.

Bad example:

```csharp
try
{
    SaveChanges();
}
catch
{
    // Ignored
}
```

A better approach is to handle only exceptions you understand. If the operation can recover, perform the recovery. If not, log useful context and rethrow or let the exception propagate to an application boundary.

```csharp
try
{
    SaveChanges();
}
catch (DbUpdateException ex)
{
    logger.LogError(ex, "Failed to save changes for order {OrderId}.", order.Id);
    throw;
}
```

Swallowing may be acceptable only in narrow cases where failure is explicitly non-critical and the code documents the decision.

##### Key Points to Mention

- Swallowing exceptions hides real failures.
- It can lead to corrupted state or data loss.
- Catch only what you can handle.
- Log with context when handling or rethrowing.
- Let unexpected exceptions propagate.
- Only ignore failures intentionally and narrowly.

<!-- question:end:exception-handling-in-csharp-advanced-q05 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
