---
id: in-process-vs-isolated-worker-model-for-dotnet-functions
topic: Azure Functions and Durable Functions
subtopic: In-process vs isolated worker model for .NET Functions
category: Azure
---

## Overview

.NET Azure Functions can use two execution models:

- **In-process:** Function code runs in the same process as the Azure Functions host.
- **Isolated worker:** Function code runs in a separate .NET worker process and communicates with the Functions host.

The isolated worker model is the current strategic model for .NET Functions. It supports current LTS and standard-term .NET releases, provides a normal .NET application startup model, gives the application greater control over dependency injection and middleware, and separates application dependencies from host dependencies.

Microsoft support for the in-process model ends on **November 10, 2026**. As of June 15, 2026, this deadline is less than five months away. New production applications should use isolated worker. Existing in-process applications should have an active migration plan with package, binding, behavior, deployment, and performance testing.

The migration is not simply changing a target framework. The models differ in:

- SDK and extension packages.
- Function and trigger attributes.
- Startup and dependency injection.
- HTTP request and response types.
- Middleware.
- JSON serialization.
- Logging and Application Insights configuration.
- Binding types.
- Exception behavior.
- Testing and local startup.

For interviews, candidates should explain why process isolation matters, identify the current support deadline, compare HTTP models, show a minimal isolated-worker application, and describe a low-risk migration plan.

## Core Concepts

### In-Process Execution

In-process functions run inside the Functions host process. The application and host share:

- Process memory.
- Assembly loading context.
- Runtime and dependency constraints.
- Host lifecycle.

The model commonly uses:

- `Microsoft.NET.Sdk.Functions`.
- `Microsoft.Azure.WebJobs` attributes.
- `[FunctionName("Name")]`.
- `FunctionsStartup` for dependency injection.
- `HttpRequest` and `IActionResult` for HTTP.

Example:

```csharp
[FunctionName("GetCustomer")]
public IActionResult Run(
    [HttpTrigger(
        AuthorizationLevel.Function,
        "get",
        Route = "customers/{id}")]
    HttpRequest request,
    string id,
    ILogger logger)
{
    return new OkObjectResult(new { id });
}
```

This model was convenient because it integrated directly with host types, but sharing the process constrained supported .NET versions and application dependency control.

### Isolated Worker Execution

In isolated worker, the Functions host manages triggers and scaling while a separate .NET process runs application code.

The model commonly uses:

- `Microsoft.Azure.Functions.Worker`.
- `Microsoft.Azure.Functions.Worker.Sdk`.
- `Microsoft.Azure.Functions.Worker.Extensions.*`.
- `[Function("Name")]`.
- A normal `Program.cs`.
- `IHostApplicationBuilder` or `IHostBuilder`.

Minimal startup:

```csharp
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();

builder.Services.AddApplicationInsightsTelemetryWorkerService();
builder.Services.ConfigureFunctionsApplicationInsights();
builder.Services.AddSingleton<IClock, SystemClock>();

builder.Build().Run();
```

`FunctionsApplication.CreateBuilder()` is the recommended starting approach for new projects.

### Process Boundary

The Functions host:

- Listens to triggers.
- Coordinates bindings.
- Manages host configuration.
- Participates in scale decisions.
- Sends invocation data to the worker.

The isolated worker:

- Deserializes invocation data.
- Executes application middleware and function code.
- Resolves application dependencies.
- Produces outputs and logs.

The process boundary prevents many application package conflicts with host packages. It also means some data is projected or serialized between processes unless a supported SDK type is used.

### Current Support Direction

The key date is:

```text
November 10, 2026
```

Microsoft support for the in-process model ends on that date. Existing apps might continue to run afterward, but they will no longer have the same supported lifecycle and should not depend on that as a production strategy.

Functions runtime 1.x has a separate support end date of September 14, 2026. Runtime version and .NET worker model are related but distinct decisions:

- Upgrade runtime 1.x applications to Functions 4.x.
- Migrate in-process .NET applications to isolated worker.

### Supported .NET Versions

The isolated worker model is required for broad support across current LTS and standard-term .NET versions and can also support .NET Framework in documented configurations. The in-process model has a much narrower supported runtime path.

Version support changes with .NET and Azure Functions release lifecycles. Before migration:

- Verify the current supported .NET table.
- Upgrade worker and extension packages.
- Match the Azure function app stack setting to the target framework.
- Test local Core Tools and CI images.

Do not infer Azure support solely because the .NET SDK compiles locally.

### Package and Namespace Differences

| Concern | In-process | Isolated worker |
| --- | --- | --- |
| Main SDK | `Microsoft.NET.Sdk.Functions` | Worker plus Worker SDK packages |
| Function attribute | `[FunctionName]` | `[Function]` |
| Extension namespace | `Microsoft.Azure.WebJobs.Extensions.*` | `Microsoft.Azure.Functions.Worker.Extensions.*` |
| Startup | `FunctionsStartup` | `Program.cs` host builder |
| Process | Functions host | Separate worker |
| HTTP options | Host ASP.NET Core types | Built-in types or ASP.NET Core integration |

Do not reference old combined extension packages alongside their newer split equivalents. Duplicate binding definitions can cause build or startup conflicts.

### Attribute Migration

An in-process signature:

```csharp
[FunctionName("ProcessOrder")]
public Task Run(
    [ServiceBusTrigger(
        "orders",
        Connection = "ServiceBusConnection")]
    Message message,
    ILogger logger)
```

Becomes conceptually:

```csharp
[Function("ProcessOrder")]
public Task Run(
    [ServiceBusTrigger(
        "orders",
        Connection = "ServiceBusConnection")]
    ServiceBusReceivedMessage message,
    FunctionContext context)
```

The exact supported type depends on extension and worker package versions. Migration should inventory every trigger, input binding, output binding, and type.

### Dependency Injection

Isolated worker uses standard .NET dependency injection:

```csharp
var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();

builder.Services.AddHttpClient<InventoryClient>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

builder.Services.AddScoped<IOrderHandler, OrderHandler>();

builder.Build().Run();
```

Service lifetimes follow the worker's dependency injection scope behavior. Avoid mutable singleton state unless it is thread-safe and genuinely shared across concurrent invocations.

### Configuration

Application configuration in the worker and trigger configuration in the Functions host are not identical.

Worker configuration can supply values to application code:

- Environment variables.
- JSON configuration.
- Azure App Configuration.
- User secrets in local development.

However, trigger and binding configuration must be available to the Functions platform. Adding a custom worker configuration provider does not automatically make its values available to trigger discovery or scale infrastructure.

Keep critical trigger connection and binding settings in supported application settings or identity-based setting groups.

### Worker Middleware

Isolated worker supports middleware around function execution:

```csharp
public sealed class CorrelationMiddleware : IFunctionsWorkerMiddleware
{
    public async Task Invoke(
        FunctionContext context,
        FunctionExecutionDelegate next)
    {
        var correlationId =
            context.InvocationId;

        using (LogContext.PushProperty(
            "CorrelationId",
            correlationId))
        {
            await next(context);
        }
    }
}
```

Middleware can implement:

- Correlation context.
- Cross-cutting logging.
- Validation.
- Exception translation.
- Tenant context.
- Shared telemetry.

Do not put trigger-specific business behavior into global middleware. Middleware runs within the worker invocation pipeline and is not the full ASP.NET Core request pipeline.

### HTTP Model Options

.NET isolated supports two HTTP approaches:

- **ASP.NET Core integration:** Uses `HttpRequest`, `HttpResponse`, and `IActionResult`.
- **Built-in worker model:** Uses `HttpRequestData` and `HttpResponseData`.

ASP.NET Core integration is generally familiar for API developers:

```csharp
[Function("CreateOrder")]
public async Task<IActionResult> Run(
    [HttpTrigger(
        AuthorizationLevel.Anonymous,
        "post",
        Route = "orders")]
    HttpRequest request)
{
    var command =
        await request.ReadFromJsonAsync<CreateOrder>();

    return new AcceptedResult();
}
```

Enable it through `ConfigureFunctionsWebApplication()` and the ASP.NET Core HTTP extension package.

### ASP.NET Core Integration Is Not Full ASP.NET Core Hosting

The integration exposes familiar request, response, and action-result types, but it does not expose all ASP.NET Core features. In particular, it does not provide unrestricted access to the normal ASP.NET Core middleware and routing pipelines.

Use Azure Functions worker middleware for function-wide invocation behavior. Do not assume an existing ASP.NET Core application can be moved unchanged into a Function app.

### Built-In HTTP Types

The built-in model uses:

- `HttpRequestData`.
- `HttpResponseData`.

It requires fewer ASP.NET Core integration dependencies and remains supported for compatibility. It uses worker serialization configuration rather than the ASP.NET Core MVC serialization layer.

Choose one HTTP approach deliberately and standardize it within an application to avoid inconsistent serialization and response behavior.

### JSON Serialization

The isolated worker uses `System.Text.Json` by default. General worker serialization can be configured through dependency injection.

ASP.NET Core integration has a separate ASP.NET Core serialization layer. Configure it through MVC services:

```csharp
builder.Services
    .AddMvc()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions
            .PropertyNamingPolicy =
                JsonNamingPolicy.CamelCase;
    });
```

Migration tests should compare:

- Property names.
- Enum representation.
- Case sensitivity.
- Null handling.
- Date and time formats.
- Reference loops.
- Error responses.

Serialization changes can break external contracts even when the code compiles.

### Binding Types

Newer isolated-worker extensions support Azure SDK types for several bindings, including types for:

- Blob Storage.
- Queue Storage.
- Service Bus.
- Event Hubs.
- Event Grid.

Support depends on extension and core worker package versions. Simpler POCO, string, `byte[]`, or `BinaryData` types remain useful.

Use SDK types when metadata or settlement behavior is needed. Use POCO types for simple business payloads. For advanced output operations, inject an Azure SDK client rather than forcing the behavior through an output binding.

### Multiple Output Bindings

In isolated worker, output bindings are represented through the return value. A custom return type can expose several output properties:

```csharp
public sealed class CreateOrderResult
{
    public required IActionResult HttpResult { get; init; }

    [QueueOutput("order-commands")]
    public required string QueueMessage { get; init; }
}
```

With ASP.NET Core integration, the HTTP property may require the supported HTTP result attribute depending on package versions. Verify the current extension requirements.

Bindings do not create a transaction across HTTP, storage, databases, and brokers.

### Logging Pipelines

In isolated worker, application logs and host logs can have separate configuration paths. The worker can send telemetry through:

- Application Insights worker integration.
- Direct Application Insights integration.
- OpenTelemetry with the Azure Monitor exporter.

Default Application Insights logging can filter lower-severity logs. Configure categories and levels deliberately, and verify behavior in Azure rather than only locally.

Avoid duplicate telemetry caused by registering overlapping pipelines without understanding their responsibilities.

### Exception Behavior

In-process exceptions occur in the host process. Isolated-worker exceptions cross the worker boundary. Older host-builder configurations can wrap exceptions unless worker exception behavior is enabled; current recommended builders provide the expected direct behavior.

Migration tests should verify:

- Trigger retry behavior.
- Logged exception type and stack.
- HTTP exception translation.
- Application Insights failure records.
- Poison or dead-letter outcomes.

Do not catch every exception and return success for event-triggered work.

### Cancellation and Shutdown

Accept `CancellationToken` in long-running functions and propagate it to:

- HTTP calls.
- Database calls.
- Stream operations.
- Broker clients.
- Application loops.

Cancellation can occur during host shutdown, scale-in, deployment, or client disconnection in supported contexts. The function should stop taking new side effects and leave retryable work in a consistent state.

### Testing

Keep business logic outside function entry-point classes:

```text
Function adapter
  -> parse and validate trigger data
  -> call application handler
  -> map result to binding output
```

Unit-test handlers without the Functions runtime. Add integration tests for:

- Trigger binding and deserialization.
- HTTP contracts.
- Extension configuration.
- Managed identity access.
- Retry and poison behavior.
- Serialization compatibility.

Mocking `FunctionContext` deeply usually produces brittle tests. Test the adapter narrowly and test important behavior through the local host or deployed environment.

### Migration Strategy

A practical migration sequence is:

1. Inventory triggers, bindings, packages, SDK types, and configuration.
2. Upgrade to a supported Functions runtime and target framework.
3. Create an isolated-worker project structure.
4. Replace SDK and extension packages.
5. Convert `[FunctionName]` to `[Function]`.
6. Replace trigger and output types.
7. Move startup to `Program.cs`.
8. Configure DI, serialization, and telemetry.
9. Rebuild HTTP contracts and middleware.
10. Validate host settings and identity-based connections.
11. Run functional, retry, performance, and cold-start tests.
12. Deploy side by side and cut traffic or triggers over safely.

For event triggers, avoid letting old and new apps consume the same queue or subscription accidentally unless duplicate processing is explicitly controlled.

### Side-by-Side Deployment

Migration options include:

- A deployment slot where supported.
- A separate function app with a new endpoint.
- A new queue or Service Bus subscription.
- API Management routing for HTTP.
- Event subscription cutover.

Separate resources provide clearer rollback but require configuration and identity parity. Plan which app owns processing at every stage.

### Performance and Cold Start

Isolated worker starts a separate process, so package size, worker initialization, dependency registration, and assembly loading affect startup.

Microsoft documents performance optimizations such as:

- Current Worker and Worker SDK packages.
- Appropriate framework references.
- .NET isolated placeholders where supported.
- Correct function app framework configuration.

Application-level improvements include:

- Avoiding network calls during startup.
- Deferring optional initialization.
- Keeping dependency graphs focused.
- Reusing clients through DI.
- Choosing always-ready or prewarmed capacity for strict latency.

Measure the deployed application rather than assuming one model is always faster.

### Common Migration Mistakes

- Treating migration as only a target-framework change.
- Keeping incompatible `Microsoft.Azure.WebJobs` extension packages.
- Mixing old combined storage extensions with new split packages.
- Assuming custom worker configuration is visible to triggers.
- Missing serialization contract changes.
- Assuming ASP.NET Core integration exposes the full ASP.NET pipeline.
- Registering duplicate logging providers.
- Swallowing event-trigger exceptions.
- Forgetting identity roles in the new app.
- Running old and new consumers simultaneously without deduplication.
- Skipping cold-start and concurrency testing.
- Waiting until close to November 10, 2026 to begin migration.

### Practical Best Practices

- Use isolated worker for new .NET Functions.
- Treat November 10, 2026 as a firm migration deadline.
- Use current worker and extension packages.
- Prefer `FunctionsApplication.CreateBuilder()` for new projects.
- Keep function classes thin.
- Configure HTTP and JSON behavior explicitly.
- Use standard dependency injection carefully with concurrency.
- Prefer managed identity.
- Separate host configuration from worker application configuration.
- Validate retries, logging, and output binding behavior.
- Deploy migrations with an explicit ownership cutover.
- Verify current .NET and extension support before each upgrade.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the difference between in-process and isolated-worker Azure Functions?

<!-- question:start:in-process-vs-isolated-worker-model-for-dotnet-functions-beginner-q01 -->
<!-- question-id:in-process-vs-isolated-worker-model-for-dotnet-functions-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

In-process function code runs inside the Azure Functions host process and shares its runtime and dependency environment. Isolated-worker code runs in a separate .NET process and communicates with the host. Isolation gives the application more control over .NET versions, startup, dependency injection, middleware, serialization, and dependencies.

##### Key Points to Mention

- The host still manages triggers and scaling.
- Isolated worker uses different SDK and extension packages.
- A process boundary can require data projection or serialization.
- Isolated worker is the current strategic model.

<!-- question:end:in-process-vs-isolated-worker-model-for-dotnet-functions-beginner-q01 -->

#### When does support for the .NET in-process model end?

<!-- question:start:in-process-vs-isolated-worker-model-for-dotnet-functions-beginner-q02 -->
<!-- question-id:in-process-vs-isolated-worker-model-for-dotnet-functions-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Microsoft support ends on November 10, 2026. New applications should use isolated worker, and existing in-process applications should migrate before that date. Continuing to run after the date is not the same as having a supported production platform.

##### Key Points to Mention

- Use the exact date: November 10, 2026.
- Runtime 1.x has a separate September 14, 2026 deadline.
- Migration requires behavioral testing.
- Do not wait for the support date to begin.

<!-- question:end:in-process-vs-isolated-worker-model-for-dotnet-functions-beginner-q02 -->

#### How is an isolated-worker function application started?

<!-- question:start:in-process-vs-isolated-worker-model-for-dotnet-functions-beginner-q03 -->
<!-- question-id:in-process-vs-isolated-worker-model-for-dotnet-functions-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

It has a normal `Program.cs` that builds and runs a .NET host. New applications commonly use `FunctionsApplication.CreateBuilder(args)`, configure Functions HTTP behavior where required, register services in the dependency injection container, and call `Build().Run()`.

##### Key Points to Mention

- Startup is application-controlled.
- Standard dependency injection is available.
- Use `ConfigureFunctionsWebApplication()` for ASP.NET Core HTTP integration.
- Trigger settings still need platform-visible configuration.

<!-- question:end:in-process-vs-isolated-worker-model-for-dotnet-functions-beginner-q03 -->

#### What HTTP types can .NET isolated Functions use?

<!-- question:start:in-process-vs-isolated-worker-model-for-dotnet-functions-beginner-q04 -->
<!-- question-id:in-process-vs-isolated-worker-model-for-dotnet-functions-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

The built-in model uses `HttpRequestData` and `HttpResponseData`. ASP.NET Core integration supports familiar types such as `HttpRequest` and `IActionResult`. ASP.NET Core integration is usually convenient for API developers, but it does not expose the complete ASP.NET Core middleware and routing platform.

##### Key Points to Mention

- Configure ASP.NET Core integration explicitly.
- The two approaches use different serialization paths.
- Standardize one model within an app.
- Functions remains a Functions host, not a full ASP.NET Core app.

<!-- question:end:in-process-vs-isolated-worker-model-for-dotnet-functions-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### What package and attribute changes are required during migration?

<!-- question:start:in-process-vs-isolated-worker-model-for-dotnet-functions-intermediate-q01 -->
<!-- question-id:in-process-vs-isolated-worker-model-for-dotnet-functions-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Replace `Microsoft.NET.Sdk.Functions` and WebJobs extension packages with `Microsoft.Azure.Functions.Worker`, Worker SDK, and isolated-worker extension packages. Replace `[FunctionName]` with `[Function]`, update namespaces, and migrate old SDK message types to supported current types. Remove conflicting combined and split extension references.

##### Key Points to Mention

- Extension package depends on execution model.
- Binding types can change.
- Package versions determine SDK-type support.
- Compile success does not prove runtime compatibility.

<!-- question:end:in-process-vs-isolated-worker-model-for-dotnet-functions-intermediate-q01 -->

#### How does configuration differ in isolated worker?

<!-- question:start:in-process-vs-isolated-worker-model-for-dotnet-functions-intermediate-q02 -->
<!-- question-id:in-process-vs-isolated-worker-model-for-dotnet-functions-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

The worker can use normal .NET configuration sources for application code. The Functions host and scale infrastructure still require trigger and binding settings through supported app settings and `host.json`. Adding Azure App Configuration or a custom provider only to the worker does not automatically make those values available when the host discovers and monitors triggers.

##### Key Points to Mention

- Distinguish host from worker configuration.
- Use identity-based connection setting groups.
- Keep local settings out of source control.
- Verify configuration in deployed scale scenarios.

<!-- question:end:in-process-vs-isolated-worker-model-for-dotnet-functions-intermediate-q02 -->

#### What compatibility risks should be tested during migration?

<!-- question:start:in-process-vs-isolated-worker-model-for-dotnet-functions-intermediate-q03 -->
<!-- question-id:in-process-vs-isolated-worker-model-for-dotnet-functions-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Test trigger discovery, payload deserialization, HTTP routes and error contracts, JSON naming and null behavior, output bindings, retries, poison handling, logging, Application Insights, identity access, concurrency, timeout, and cold start. Also compare extension-specific message types and manual settlement behavior.

##### Key Points to Mention

- Serialization differences can break contracts.
- Logging has worker and host paths.
- Retry behavior must not accidentally acknowledge failure.
- Load and startup tests are required.

<!-- question:end:in-process-vs-isolated-worker-model-for-dotnet-functions-intermediate-q03 -->

#### How should dependency injection lifetimes be used in an isolated Function app?

<!-- question:start:in-process-vs-isolated-worker-model-for-dotnet-functions-intermediate-q04 -->
<!-- question-id:in-process-vs-isolated-worker-model-for-dotnet-functions-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use singleton services for thread-safe reusable clients and immutable shared infrastructure, scoped services for invocation-oriented units of work, and transient services for lightweight independent objects. Remember that one worker instance can process concurrent invocations, so mutable singleton state is unsafe unless synchronized. Reuse `HttpClient` and Azure SDK clients through DI.

##### Key Points to Mention

- Concurrency exists within one instance.
- Singleton does not mean one instance across scaled-out workers.
- Avoid per-invocation client construction.
- Propagate cancellation tokens.

<!-- question:end:in-process-vs-isolated-worker-model-for-dotnet-functions-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you migrate a production Service Bus function without duplicate processing?

<!-- question:start:in-process-vs-isolated-worker-model-for-dotnet-functions-advanced-q01 -->
<!-- question-id:in-process-vs-isolated-worker-model-for-dotnet-functions-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Create and test the isolated app with equivalent identity, extension, host settings, and telemetry. Use a separate subscription or a controlled stop-and-start cutover rather than letting both apps compete unexpectedly. Make the handler idempotent, drain or account for in-flight locks, monitor backlog and dead-letter state, and retain a rollback path.

##### Key Points to Mention

- Message ownership during cutover must be explicit.
- Idempotency protects unavoidable duplicates.
- Validate lock renewal and settlement.
- Compare throughput before full cutover.

<!-- question:end:in-process-vs-isolated-worker-model-for-dotnet-functions-advanced-q01 -->

#### How would you structure a testable isolated-worker application?

<!-- question:start:in-process-vs-isolated-worker-model-for-dotnet-functions-advanced-q02 -->
<!-- question-id:in-process-vs-isolated-worker-model-for-dotnet-functions-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Keep function methods as adapters that parse trigger data, establish context, call application handlers, and map outcomes. Put business logic in plain .NET services with explicit interfaces and test those directly. Add focused adapter tests and integration tests using the Functions host or deployed resources for binding, identity, serialization, retry, and contract behavior.

##### Key Points to Mention

- Avoid business logic in trigger attributes and function classes.
- Do not over-mock `FunctionContext`.
- Test contracts at real boundaries.
- Keep host-specific code replaceable.

<!-- question:end:in-process-vs-isolated-worker-model-for-dotnet-functions-advanced-q02 -->

#### How do middleware and ASP.NET Core integration differ in isolated Functions?

<!-- question:start:in-process-vs-isolated-worker-model-for-dotnet-functions-advanced-q03 -->
<!-- question-id:in-process-vs-isolated-worker-model-for-dotnet-functions-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Functions worker middleware wraps function invocations and can implement cross-cutting behavior for multiple trigger types. ASP.NET Core integration exposes familiar HTTP request, response, and action-result types and its serialization layer. It does not expose the full ASP.NET Core middleware and endpoint-routing pipeline, so existing ASP.NET middleware cannot be assumed to work unchanged.

##### Key Points to Mention

- Worker middleware is trigger-independent invocation middleware.
- ASP.NET integration applies to HTTP handling.
- Serialization configuration paths differ.
- Keep business authorization explicit.

<!-- question:end:in-process-vs-isolated-worker-model-for-dotnet-functions-advanced-q03 -->

#### How would you diagnose a performance regression after migrating to isolated worker?

<!-- question:start:in-process-vs-isolated-worker-model-for-dotnet-functions-advanced-q04 -->
<!-- question-id:in-process-vs-isolated-worker-model-for-dotnet-functions-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Compare cold and warm startup, worker initialization, dependency registration, assembly loading, serialization, trigger concurrency, memory, and dependency latency. Verify current Worker and Worker SDK packages, placeholder settings where supported, target-framework configuration, telemetry duplication, and extension versions. Use deployed traces and load tests to separate worker overhead from application or downstream changes.

##### Key Points to Mention

- Measure cold and steady-state paths separately.
- Check package and platform configuration.
- Compare per-instance concurrency.
- Avoid network calls during startup.
- Do not assume process isolation is the only cause.

<!-- question:end:in-process-vs-isolated-worker-model-for-dotnet-functions-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
