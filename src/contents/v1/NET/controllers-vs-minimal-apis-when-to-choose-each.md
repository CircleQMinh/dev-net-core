---
id: controllers-vs-minimal-apis-when-to-choose-each
topic: API design and implementation
subtopic: Controllers vs Minimal APIs
category: .NET
---


## Overview

ASP.NET Core supports two main styles for building HTTP APIs: controller-based APIs and Minimal APIs. Both run on the same ASP.NET Core request pipeline, use endpoint routing, dependency injection, middleware, authorization, OpenAPI support, model binding concepts, and common HTTP result patterns. The difference is mainly how endpoints are declared, organized, extended, and maintained.

Controller-based APIs organize endpoints inside controller classes. A controller usually derives from `ControllerBase`, uses attributes such as `[ApiController]`, `[Route]`, `[HttpGet]`, `[HttpPost]`, and exposes action methods. Controllers are familiar, convention-friendly, and especially useful when an application benefits from MVC-style features such as filters, model binding extensibility, application model conventions, OData, JSON Patch, or large team organization.

Minimal APIs define endpoints directly with route mapping methods such as `MapGet`, `MapPost`, `MapPut`, and `MapDelete`. They are designed to reduce boilerplate and make small HTTP APIs, microservices, internal services, and vertical-slice endpoint modules easier to build. Minimal APIs can still use dependency injection, authorization, route groups, endpoint filters, typed results, validation, OpenAPI metadata, and middleware.

This topic matters because API style affects maintainability, testability, performance, team conventions, discoverability, and how easily cross-cutting concerns can be applied. Interviewers often ask this topic to check whether a developer understands ASP.NET Core architecture beyond syntax. A strong answer should not say that one approach is always better. Instead, it should explain trade-offs and choose based on endpoint complexity, framework feature needs, team structure, project size, validation requirements, and long-term maintainability.

## Core Concepts

### What Controller-Based APIs Are

A controller-based API uses classes to group related HTTP actions. In ASP.NET Core Web API projects, controllers usually inherit from `ControllerBase` instead of `Controller` because `Controller` includes MVC view support, which is usually unnecessary for APIs.

```csharp
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/products")]
public sealed class ProductsController : ControllerBase
{
    private readonly IProductService _productService;

    public ProductsController(IProductService productService)
    {
        _productService = productService;
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(ProductDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductDto>> GetById(int id, CancellationToken cancellationToken)
    {
        ProductDto? product = await _productService.GetByIdAsync(id, cancellationToken);

        if (product is null)
        {
            return NotFound();
        }

        return Ok(product);
    }

    [HttpPost]
    [ProducesResponseType(typeof(ProductDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ProductDto>> Create(
        CreateProductRequest request,
        CancellationToken cancellationToken)
    {
        ProductDto product = await _productService.CreateAsync(request, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }
}
```

Controllers are commonly registered and mapped like this:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddScoped<IProductService, ProductService>();

var app = builder.Build();

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
```

Important controller concepts include:

- `ControllerBase`: base class for API controllers without view support.
- `[ApiController]`: enables API-specific behavior such as automatic 400 responses for model validation errors, binding source inference, and Problem Details behavior.
- Attribute routing: maps controller actions to HTTP routes.
- Action methods: methods that handle HTTP requests.
- `ActionResult<T>`: allows an action to return either a typed response body or an HTTP result such as `NotFound()`.
- Filters: extension points for cross-cutting behavior such as authorization, exception handling, action execution, and result handling.
- Model binding and validation: maps request data to action parameters and validates request models.

### What Minimal APIs Are

Minimal APIs define endpoints directly on `WebApplication` or route groups. The route handler is often a lambda expression or a method group.

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IProductService, ProductService>();

var app = builder.Build();

app.MapGet("/api/products/{id:int}", async (
    int id,
    IProductService productService,
    CancellationToken cancellationToken) =>
{
    ProductDto? product = await productService.GetByIdAsync(id, cancellationToken);

    return product is null
        ? Results.NotFound()
        : Results.Ok(product);
});

app.Run();
```

Minimal APIs can be organized with route groups and extension methods to avoid putting every endpoint directly in `Program.cs`.

```csharp
public static class ProductEndpoints
{
    public static RouteGroupBuilder MapProductEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder group = app.MapGroup("/api/products")
            .WithTags("Products")
            .RequireAuthorization();

        group.MapGet("/{id:int}", GetById)
            .WithName("GetProductById")
            .Produces<ProductDto>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        group.MapPost("/", Create)
            .Produces<ProductDto>(StatusCodes.Status201Created)
            .ProducesValidationProblem();

        return group;
    }

    private static async Task<IResult> GetById(
        int id,
        IProductService productService,
        CancellationToken cancellationToken)
    {
        ProductDto? product = await productService.GetByIdAsync(id, cancellationToken);

        return product is null
            ? Results.NotFound()
            : Results.Ok(product);
    }

    private static async Task<IResult> Create(
        CreateProductRequest request,
        IProductService productService,
        LinkGenerator linkGenerator,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        ProductDto product = await productService.CreateAsync(request, cancellationToken);

        string? uri = linkGenerator.GetPathByName(
            httpContext,
            "GetProductById",
            new { id = product.Id });

        return Results.Created(uri ?? $"/api/products/{product.Id}", product);
    }
}
```

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IProductService, ProductService>();

var app = builder.Build();

app.MapProductEndpoints();

app.Run();
```

Important Minimal API concepts include:

- `MapGet`, `MapPost`, `MapPut`, `MapDelete`: route mapping methods.
- Route handlers: delegates that handle requests.
- Parameter binding: values are bound from route values, query strings, headers, body, services, and special framework types.
- Route groups: organize endpoints under common prefixes and shared metadata.
- Endpoint filters: run logic before and after endpoint handlers.
- `Results` and `TypedResults`: helper APIs for HTTP responses.
- Endpoint metadata: supports OpenAPI, authorization, filters, tags, response documentation, and conventions.

### Shared Foundation: Middleware, Routing, DI, and Endpoint Metadata

Controllers and Minimal APIs both run inside the ASP.NET Core pipeline. Middleware still handles cross-cutting infrastructure before requests reach endpoints.

```csharp
var app = builder.Build();

app.UseExceptionHandler();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapProductEndpoints();

app.Run();
```

This means both styles can share:

- authentication and authorization middleware
- exception handling middleware
- CORS middleware
- rate limiting middleware
- request logging middleware
- dependency injection
- configuration and options
- health checks
- OpenAPI metadata
- integration testing with `WebApplicationFactory`

The choice between controllers and Minimal APIs is not a choice between different web servers. It is a choice between different endpoint programming models.

### Binding and Validation

Model binding maps incoming request data to .NET parameters and models. Validation checks whether those models satisfy rules such as required fields, ranges, custom validation attributes, or complex validation logic.

Controllers have long-established binding and validation features. With `[ApiController]`, invalid model state can automatically produce a 400 response.

```csharp
public sealed record CreateProductRequest(
    [property: Required] string Name,
    [property: Range(0.01, 10_000)] decimal Price);

[ApiController]
[Route("api/products")]
public sealed class ProductsController : ControllerBase
{
    [HttpPost]
    public IActionResult Create(CreateProductRequest request)
    {
        // With [ApiController], invalid models can be rejected automatically
        // before this action executes.
        return Created("/api/products/1", request);
    }
}
```

Minimal APIs also support binding and validation, but the exact feature set depends on the ASP.NET Core version and packages used. In modern ASP.NET Core, Minimal APIs can validate request data using validation services and endpoint filters. For many applications, this is enough. For advanced MVC-style validation extensibility, controllers may still be the better fit.

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddValidation();

var app = builder.Build();

app.MapPost("/api/products", (CreateProductRequest request) =>
{
    return TypedResults.Created($"/api/products/1", request);
});

app.Run();
```

Use controllers when you need mature MVC model-binding extension points, custom model binders, model binder providers, model validation providers, or controller conventions. Use Minimal APIs when the binding model is straightforward and endpoint-local code is easier to read.

### Return Types and HTTP Results

Controllers commonly return `IActionResult`, `ActionResult<T>`, or a specific type.

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<ProductDto>> GetById(int id)
{
    ProductDto? product = await _productService.GetByIdAsync(id);

    return product is null
        ? NotFound()
        : product;
}
```

Minimal APIs commonly return `IResult`, `Results`, `TypedResults`, or typed result unions.

```csharp
app.MapGet("/api/products/{id:int}", async Task<Results<Ok<ProductDto>, NotFound>> (
    int id,
    IProductService productService) =>
{
    ProductDto? product = await productService.GetByIdAsync(id);

    return product is null
        ? TypedResults.NotFound()
        : TypedResults.Ok(product);
});
```

`TypedResults` can improve type information for testing and OpenAPI metadata. `Results` is simple but less strongly typed. In interviews, it is useful to mention that clear HTTP response modeling matters more than the chosen style.

### Filters vs Endpoint Filters

Controllers use MVC filters. Filters are powerful extension points that can run at different stages of the MVC pipeline.

Common controller filters include:

- authorization filters
- resource filters
- action filters
- exception filters
- result filters

Example action filter:

```csharp
public sealed class AuditActionFilter : IActionFilter
{
    private readonly ILogger<AuditActionFilter> _logger;

    public AuditActionFilter(ILogger<AuditActionFilter> logger)
    {
        _logger = logger;
    }

    public void OnActionExecuting(ActionExecutingContext context)
    {
        _logger.LogInformation("Executing {Action}", context.ActionDescriptor.DisplayName);
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
        _logger.LogInformation("Executed {Action}", context.ActionDescriptor.DisplayName);
    }
}
```

Minimal APIs use endpoint filters. Endpoint filters can inspect arguments, run logic before and after the handler, modify results, and implement endpoint-level validation, logging, or authorization-related behavior.

```csharp
app.MapPost("/api/products", async (
    CreateProductRequest request,
    IProductService productService) =>
{
    ProductDto product = await productService.CreateAsync(request);
    return TypedResults.Created($"/api/products/{product.Id}", product);
})
.AddEndpointFilter(async (context, next) =>
{
    var request = context.GetArgument<CreateProductRequest>(0);

    if (string.IsNullOrWhiteSpace(request.Name))
    {
        return TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(request.Name)] = ["Name is required."]
        });
    }

    return await next(context);
});
```

Choose controllers when your application already relies heavily on MVC filters, conventions, and the MVC application model. Choose Minimal APIs when endpoint filters and middleware are enough.

### Organization and Maintainability

A common mistake is assuming Minimal APIs must place all code in `Program.cs`. That is only true for very small examples. Production Minimal API projects should usually split endpoints by feature.

```text
Features/
  Products/
    ProductEndpoints.cs
    ProductService.cs
    ProductQueries.cs
    ProductCommands.cs
  Orders/
    OrderEndpoints.cs
    OrderService.cs
```

Minimal API organization pattern:

```csharp
public static class OrderEndpoints
{
    public static RouteGroupBuilder MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder group = app.MapGroup("/api/orders")
            .WithTags("Orders");

        group.MapGet("/{id:int}", GetById);
        group.MapPost("/", Create);

        return group;
    }

    private static async Task<IResult> GetById(int id, IOrderService orderService)
    {
        OrderDto? order = await orderService.GetByIdAsync(id);
        return order is null ? Results.NotFound() : Results.Ok(order);
    }

    private static async Task<IResult> Create(CreateOrderRequest request, IOrderService orderService)
    {
        OrderDto order = await orderService.CreateAsync(request);
        return Results.Created($"/api/orders/{order.Id}", order);
    }
}
```

Controller organization pattern:

```text
Controllers/
  ProductsController.cs
  OrdersController.cs
Application/
  Products/
  Orders/
```

Controllers give a clear and familiar structure by default. Minimal APIs need deliberate organization once the app grows. In a large system, both styles should delegate business logic to application services, use cases, commands, queries, or handlers rather than placing business rules directly in endpoint code.

### Performance Considerations

Minimal APIs generally have less framework overhead and less boilerplate than controllers. They can be a good fit for high-throughput endpoints, small services, and APIs where simple request handling dominates.

However, performance should rarely be the only reason to choose one style. Most real-world API latency comes from database calls, network calls, serialization, authentication, external services, and business logic. A well-designed controller API can perform well, and a poorly designed Minimal API can still be slow.

Practical performance guidance:

- Avoid blocking calls such as `.Result` and `.Wait()`.
- Use async database and I/O operations.
- Keep endpoint handlers thin.
- Use pagination for large collections.
- Avoid unnecessary serialization work.
- Measure with realistic load tests before making performance claims.
- Choose Minimal APIs for lower overhead when the feature requirements fit.

### OpenAPI and Documentation

Both controllers and Minimal APIs can produce OpenAPI metadata. Controllers commonly use attributes such as `[ProducesResponseType]`. Minimal APIs commonly use endpoint metadata methods such as `.Produces<T>()`, `.ProducesValidationProblem()`, `.WithName()`, `.WithTags()`, and `.WithOpenApi()` depending on the package and framework version.

Minimal API example:

```csharp
group.MapGet("/{id:int}", GetById)
    .WithName("GetProductById")
    .WithTags("Products")
    .Produces<ProductDto>(StatusCodes.Status200OK)
    .Produces(StatusCodes.Status404NotFound);
```

Controller example:

```csharp
[HttpGet("{id:int}")]
[ProducesResponseType(typeof(ProductDto), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public async Task<ActionResult<ProductDto>> GetById(int id)
{
    ProductDto? product = await _productService.GetByIdAsync(id);
    return product is null ? NotFound() : Ok(product);
}
```

For interviews, mention that API documentation should be explicit regardless of style. Do not rely on default inference for complex APIs where client contracts matter.

### Authorization, Authentication, and Cross-Cutting Concerns

Both styles support ASP.NET Core authentication and authorization.

Controller example:

```csharp
[Authorize]
[ApiController]
[Route("api/orders")]
public sealed class OrdersController : ControllerBase
{
    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        return Ok();
    }
}
```

Minimal API example:

```csharp
RouteGroupBuilder group = app.MapGroup("/api/orders")
    .RequireAuthorization();

group.MapGet("/{id:int}", (int id) => Results.Ok());
```

Cross-cutting concerns that apply to all requests usually belong in middleware. Cross-cutting concerns that apply to a subset of endpoints can be implemented with controller filters, endpoint filters, route group metadata, or custom conventions depending on the chosen style.

### Testing Controllers and Minimal APIs

Both styles can be tested with unit tests and integration tests.

For controllers, you can instantiate the controller class and mock dependencies.

```csharp
[Fact]
public async Task GetById_ReturnsNotFound_WhenProductDoesNotExist()
{
    var service = new Mock<IProductService>();
    service.Setup(x => x.GetByIdAsync(1, It.IsAny<CancellationToken>()))
        .ReturnsAsync((ProductDto?)null);

    var controller = new ProductsController(service.Object);

    ActionResult<ProductDto> result = await controller.GetById(1, CancellationToken.None);

    Assert.IsType<NotFoundResult>(result.Result);
}
```

For Minimal APIs, it is often better to test endpoint behavior with integration tests or keep handlers as named methods that can be called directly.

```csharp
[Fact]
public async Task GetById_ReturnsNotFound_WhenProductDoesNotExist()
{
    await using var application = new CustomWebApplicationFactory();
    using HttpClient client = application.CreateClient();

    HttpResponseMessage response = await client.GetAsync("/api/products/999");

    Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
}
```

In interviews, a strong answer is that integration tests are valuable for both because they verify routing, binding, filters, middleware, serialization, authorization, and response behavior together.

### When to Choose Minimal APIs

Choose Minimal APIs when:

- You are starting a new API and do not need MVC-specific features.
- The service has simple HTTP endpoints.
- You want less boilerplate and direct route-to-handler mapping.
- You are building microservices, internal APIs, health/status APIs, webhooks, or backend-for-frontend endpoints.
- You prefer vertical-slice organization by feature.
- Endpoint filters and middleware are enough for cross-cutting concerns.
- You want concise tests around small handlers or route groups.
- You want to take advantage of modern ASP.NET Core endpoint features.

Example suitable Minimal API scenario:

```csharp
app.MapPost("/api/webhooks/payment-succeeded", async (
    PaymentSucceededEvent paymentEvent,
    IPaymentWebhookHandler handler,
    CancellationToken cancellationToken) =>
{
    await handler.HandleAsync(paymentEvent, cancellationToken);
    return Results.NoContent();
});
```

This endpoint is simple, action-oriented, and does not need controller-specific infrastructure.

### When to Choose Controllers

Choose controllers when:

- The application already uses controller conventions and MVC infrastructure.
- The team prefers a familiar class-based structure.
- You need advanced model binding or validation extensibility.
- You need MVC filters or application model conventions.
- You use OData or JSON Patch features that are more natural with controllers.
- You have many related actions that benefit from controller grouping.
- You need mature patterns around attributes, conventions, versioning, and documentation.
- You are maintaining an existing controller-based API and consistency matters.

Example suitable controller scenario:

```csharp
[ApiController]
[Route("api/customers/{customerId:int}/addresses")]
public sealed class CustomerAddressesController : ControllerBase
{
    [HttpPatch("{addressId:int}")]
    public async Task<IActionResult> PatchAddress(
        int customerId,
        int addressId,
        JsonPatchDocument<UpdateAddressRequest> patchDocument,
        CancellationToken cancellationToken)
    {
        // JSON Patch and complex model validation scenarios are often easier
        // to standardize with controller-based APIs.
        return NoContent();
    }
}
```

### Mixing Controllers and Minimal APIs

You can use both styles in the same application.

```csharp
builder.Services.AddControllers();

var app = builder.Build();

app.MapControllers();

app.MapGet("/health/live", () => Results.Ok(new { status = "live" }));
app.MapGet("/health/ready", () => Results.Ok(new { status = "ready" }));

app.Run();
```

Mixing styles can be useful when:

- existing business APIs use controllers, but simple operational endpoints use Minimal APIs
- new vertical-slice modules use Minimal APIs while older modules remain controller-based
- the team wants gradual migration
- a specific feature benefits from one style more than the other

The main risk is inconsistency. If both styles are used, document conventions for routing, validation, error responses, authorization, logging, OpenAPI metadata, and folder structure.

### Common Mistakes

A common mistake is putting business logic directly inside controllers or Minimal API lambdas. Endpoint code should usually coordinate request handling, authorization, validation, and response mapping. Business rules should live in application services, domain services, use cases, commands, queries, or handlers.

Another mistake is choosing Minimal APIs only because they look shorter in small demos. Minimal APIs still need clean organization, consistent error handling, validation, logging, authorization, and documentation in production.

A third mistake is choosing controllers only because they are familiar. For small services and simple endpoints, controllers can add unnecessary ceremony.

Other common mistakes include:

- returning inconsistent error shapes across endpoints
- skipping OpenAPI response metadata
- using synchronous I/O in async endpoints
- manually checking validation everywhere instead of centralizing it
- overusing filters for business logic
- allowing endpoints to depend directly on `DbContext` in large systems without a clear architecture
- mixing controllers and Minimal APIs without team conventions
- assuming Minimal APIs cannot be used in large apps
- assuming controllers are always slower in a way that matters

### Best Practices

Use a consistent API style per bounded context or module unless there is a clear reason to mix. Keep endpoint handlers thin and move business behavior to application services. Use DTOs for request and response contracts instead of exposing EF Core entities directly. Standardize validation and error responses with Problem Details. Make OpenAPI metadata explicit for public APIs. Use route groups for Minimal APIs and controller-level route attributes for controllers. Apply authorization at the group or controller level when possible.

For Minimal APIs:

- organize endpoints by feature using extension methods
- use route groups for shared prefixes, tags, authorization, and filters
- prefer named handler methods when lambdas become large
- use `TypedResults` when strong response typing helps tests and documentation
- keep validation and error handling consistent

For controllers:

- derive from `ControllerBase` for API-only controllers
- use `[ApiController]` for API behavior
- prefer `ActionResult<T>` when an endpoint can return either data or an HTTP result
- use filters for cross-cutting concerns, not business logic
- avoid large controllers by splitting by resource or feature

### Practical Decision Matrix

| Situation | Better Default | Reason |
|---|---:|---|
| Small microservice with simple CRUD endpoints | Minimal APIs | Less boilerplate and direct endpoint mapping |
| Existing MVC/Web API project | Controllers | Consistency and existing conventions matter |
| Heavy OData usage | Controllers | Controller-based APIs commonly fit OData patterns better |
| JSON Patch endpoint | Controllers | Controller support and examples are more mature |
| Health checks, status, simple webhooks | Minimal APIs | Small endpoint surface and low ceremony |
| Large team with established controller standards | Controllers | Familiar organization and review conventions |
| Vertical-slice architecture | Minimal APIs | Route groups and endpoint modules fit feature folders well |
| Advanced model binding extensibility | Controllers | MVC model binding extensibility is stronger |
| API requiring only middleware plus endpoint filters | Minimal APIs | Simpler model with enough extension points |
| Public API with detailed OpenAPI contract | Either | Both can work if metadata is explicit |

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-beginner-q01 -->
#### Beginner Q01: What is the difference between controllers and Minimal APIs in ASP.NET Core?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Controllers define API endpoints as action methods inside controller classes, usually derived from `ControllerBase`. They use attributes such as `[ApiController]`, `[Route]`, `[HttpGet]`, and `[HttpPost]` to describe routing and behavior.

Minimal APIs define endpoints directly using methods such as `MapGet`, `MapPost`, `MapPut`, and `MapDelete`. The route handler can be a lambda expression or a named method. Minimal APIs reduce boilerplate and are often simpler for small APIs and microservices.

Both run on ASP.NET Core, both can use middleware, dependency injection, authorization, validation, and OpenAPI. The main difference is the programming model and available extension points.

##### Key Points to Mention

- Controllers are class/action based.
- Minimal APIs are route-handler based.
- Both use the ASP.NET Core pipeline.
- Minimal APIs reduce boilerplate.
- Controllers provide mature MVC features and conventions.
- The choice depends on project needs, not personal preference only.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-beginner-q01 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-beginner-q02 -->
#### Beginner Q02: What is `ControllerBase` and why is it used for Web APIs?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`ControllerBase` is the base class commonly used for ASP.NET Core Web API controllers. It provides useful API-related methods and properties such as `Ok()`, `NotFound()`, `BadRequest()`, `CreatedAtAction()`, `Request`, `Response`, `ModelState`, and access to route/user context.

For API-only controllers, `ControllerBase` is preferred over `Controller` because `Controller` includes MVC view support. View support is unnecessary for JSON-based APIs and can add confusion.

##### Key Points to Mention

- Use `ControllerBase` for API controllers.
- Use `Controller` when the same controller needs view support.
- `ControllerBase` provides common HTTP result helpers.
- It fits REST-style API actions.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-beginner-q02 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-beginner-q03 -->
#### Beginner Q03: What is `[ApiController]` used for?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`[ApiController]` enables API-specific behavior for controller-based APIs. It can automatically return a 400 Bad Request response when model validation fails, infer binding sources for action parameters, require attribute routing, and produce standardized error responses such as Problem Details.

This reduces repetitive validation code in controller actions and makes APIs more consistent.

##### Key Points to Mention

- Enables automatic 400 responses for invalid models.
- Helps infer binding sources.
- Requires attribute routing.
- Improves consistency for API behavior.
- Usually placed on each controller or a shared base controller.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-beginner-q03 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-beginner-q04 -->
#### Beginner Q04: How do you define a simple Minimal API endpoint?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A Minimal API endpoint is defined by calling a route mapping method such as `MapGet` or `MapPost` on the application.

```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/hello", () => "Hello from Minimal API");

app.Run();
```

For a real API, the handler usually accepts route parameters, request DTOs, services from dependency injection, and a cancellation token.

```csharp
app.MapGet("/api/products/{id:int}", async (
    int id,
    IProductService productService,
    CancellationToken cancellationToken) =>
{
    ProductDto? product = await productService.GetByIdAsync(id, cancellationToken);
    return product is null ? Results.NotFound() : Results.Ok(product);
});
```

##### Key Points to Mention

- Use `MapGet`, `MapPost`, `MapPut`, or `MapDelete`.
- Handler parameters can come from route, query, body, services, or framework context.
- Minimal APIs can still use dependency injection.
- Use `Results` or `TypedResults` to return HTTP responses.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-beginner-q04 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-beginner-q05 -->
#### Beginner Q05: Can controllers and Minimal APIs be used in the same ASP.NET Core application?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Yes. ASP.NET Core allows both styles in the same application. You can call `MapControllers()` for controller-based endpoints and also call `MapGet`, `MapPost`, or feature-specific Minimal API mapping methods.

```csharp
builder.Services.AddControllers();

var app = builder.Build();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.Run();
```

This can be useful for adding simple operational endpoints, gradually migrating an application, or using the style that best fits each module. The main concern is maintaining consistent conventions.

##### Key Points to Mention

- Yes, both can coexist.
- Use `AddControllers()` and `MapControllers()` for controllers.
- Use `MapGet`/`MapPost` or endpoint extension methods for Minimal APIs.
- Mixing styles requires clear conventions.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-beginner-q05 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q01 -->
#### Intermediate Q01: When would you choose Minimal APIs over controllers?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Choose Minimal APIs when the API is simple, endpoint-focused, and does not need advanced MVC-specific features. Minimal APIs are a good default for small services, microservices, internal APIs, webhooks, health/status endpoints, backend-for-frontend endpoints, and vertical-slice architectures.

They reduce boilerplate and make the relationship between route and handler very direct. With route groups, endpoint filters, dependency injection, validation, authorization, typed results, and OpenAPI metadata, Minimal APIs can be production-ready when organized well.

However, Minimal APIs should not become a large unstructured `Program.cs` file. In production, endpoints should usually be grouped by feature and mapped through extension methods.

##### Key Points to Mention

- Good for simple, fast, low-boilerplate APIs.
- Good for microservices and vertical slices.
- Works well with route groups and endpoint filters.
- Still supports DI, authorization, validation, and OpenAPI.
- Needs deliberate organization in larger projects.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q01 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q02 -->
#### Intermediate Q02: When would you choose controllers over Minimal APIs?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Choose controllers when the application benefits from MVC conventions, class-based organization, filters, advanced model binding, advanced validation extensibility, application model customization, OData, JSON Patch, or a team standard based on controller classes.

Controllers are also a natural choice for existing applications that already use controller-based APIs. Maintaining consistency can be more valuable than introducing a second programming model.

Controllers are not automatically more enterprise-ready than Minimal APIs, but they provide mature framework features that are useful for complex API scenarios.

##### Key Points to Mention

- Good for MVC-style conventions and class-based organization.
- Good for advanced model binding and validation extensibility.
- Good for OData and JSON Patch scenarios.
- Good for existing controller-based projects.
- Consistency and maintainability matter.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q02 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q03 -->
#### Intermediate Q03: How do filters in controllers compare with endpoint filters in Minimal APIs?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Controller filters are part of the MVC pipeline. They can run at different stages such as authorization, resource execution, action execution, exception handling, and result execution. They are powerful and mature for controller-based applications.

Endpoint filters are used with Minimal APIs. They run before and after a route handler. They can inspect parameters, short-circuit the request, modify results, and implement endpoint-specific concerns such as validation or logging.

Middleware applies more broadly to the HTTP pipeline. Filters and endpoint filters apply closer to endpoint execution. Use middleware for global concerns and filters or endpoint filters for endpoint-specific concerns.

##### Key Points to Mention

- Controller filters belong to MVC.
- Endpoint filters belong to Minimal APIs.
- Middleware is broader than both.
- Endpoint filters can validate, log, short-circuit, or modify results.
- Controller filters offer more MVC pipeline stages.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q03 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q04 -->
#### Intermediate Q04: How should Minimal APIs be organized in a real project?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

In real projects, Minimal API endpoints should usually be organized by feature instead of placing everything in `Program.cs`. A common pattern is to create endpoint extension methods for each feature and call them from `Program.cs`.

```csharp
public static class ProductEndpoints
{
    public static RouteGroupBuilder MapProductEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder group = app.MapGroup("/api/products")
            .WithTags("Products");

        group.MapGet("/{id:int}", GetById);
        group.MapPost("/", Create);

        return group;
    }

    private static Task<IResult> GetById(int id, IProductService service)
    {
        // Handler logic here
        return Task.FromResult(Results.Ok());
    }

    private static Task<IResult> Create(CreateProductRequest request, IProductService service)
    {
        // Handler logic here
        return Task.FromResult(Results.Created("/api/products/1", request));
    }
}
```

`Program.cs` then stays clean:

```csharp
app.MapProductEndpoints();
app.MapOrderEndpoints();
```

This keeps Minimal APIs maintainable as the application grows.

##### Key Points to Mention

- Avoid huge `Program.cs` files.
- Group endpoints by feature.
- Use route groups for prefixes, tags, authorization, and filters.
- Use named handler methods when logic grows.
- Keep business logic outside endpoint handlers.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q04 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q05 -->
#### Intermediate Q05: How does validation differ between controllers and Minimal APIs?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Controllers have mature MVC model binding and validation behavior. With `[ApiController]`, validation errors can automatically return 400 responses before the action method executes. Controllers also support MVC validation extensibility and model binding customization.

Minimal APIs can also validate input in modern ASP.NET Core, often by registering validation services and using endpoint filters. They can validate request bodies, query parameters, headers, and DTOs depending on framework version and configuration. For many APIs, this is enough.

Choose controllers when advanced MVC validation and binding extensibility are required. Choose Minimal APIs when validation needs are straightforward or can be standardized with endpoint filters and shared validators.

##### Key Points to Mention

- Controllers have mature validation behavior through MVC.
- `[ApiController]` can automatically return 400 responses.
- Minimal APIs can support validation with validation services and endpoint filters.
- Controllers are stronger for advanced model binding and validation extensibility.
- Keep validation behavior consistent regardless of style.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q05 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q06 -->
#### Intermediate Q06: What are `Results` and `TypedResults` in Minimal APIs?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

`Results` and `TypedResults` are helper APIs for returning HTTP responses from Minimal API handlers.

`Results` returns `IResult` values. It is simple and flexible, but the compiler has less specific type information.

```csharp
return product is null
    ? Results.NotFound()
    : Results.Ok(product);
```

`TypedResults` returns concrete typed result objects, which can improve compile-time type information, testing, and OpenAPI metadata.

```csharp
return product is null
    ? TypedResults.NotFound()
    : TypedResults.Ok(product);
```

For endpoints with multiple possible response types, typed result unions can describe the possible outcomes.

```csharp
app.MapGet("/api/products/{id:int}", async Task<Results<Ok<ProductDto>, NotFound>> (
    int id,
    IProductService service) =>
{
    ProductDto? product = await service.GetByIdAsync(id);
    return product is null ? TypedResults.NotFound() : TypedResults.Ok(product);
});
```

##### Key Points to Mention

- `Results` is simple and returns `IResult`.
- `TypedResults` returns concrete result types.
- `TypedResults` can help tests and OpenAPI metadata.
- Typed result unions can document multiple possible outcomes.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q06 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q07 -->
#### Intermediate Q07: How do you apply authorization in controllers and Minimal APIs?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

In controllers, authorization is commonly applied with the `[Authorize]` attribute on a controller or action.

```csharp
[Authorize]
[ApiController]
[Route("api/orders")]
public sealed class OrdersController : ControllerBase
{
    [HttpGet("{id:int}")]
    public IActionResult GetById(int id) => Ok();
}
```

In Minimal APIs, authorization can be applied with `.RequireAuthorization()` on an endpoint or route group.

```csharp
RouteGroupBuilder group = app.MapGroup("/api/orders")
    .RequireAuthorization();

group.MapGet("/{id:int}", (int id) => Results.Ok());
```

Both require authentication and authorization services and middleware to be configured correctly.

##### Key Points to Mention

- Controllers commonly use `[Authorize]`.
- Minimal APIs commonly use `.RequireAuthorization()`.
- Route groups can apply authorization to many endpoints.
- Middleware configuration still matters.
- Authorization should be consistent across the API.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-intermediate-q07 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-advanced-q01 -->
#### Advanced Q01: Are Minimal APIs always better for performance than controllers?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Minimal APIs generally have less framework overhead and less ceremony, so they can be faster in simple scenarios. However, real API performance is usually dominated by database queries, network calls, serialization, authentication, caching strategy, business logic, and external dependencies.

It is not enough to say Minimal APIs are always better. The correct answer is that Minimal APIs can have a performance advantage, but the difference may not matter for many business applications. Developers should choose based on feature needs and maintainability, then measure performance with realistic benchmarks and load tests.

##### Key Points to Mention

- Minimal APIs usually have lower overhead.
- Real latency often comes from I/O and external services.
- Controllers can still be highly performant.
- Do not choose style based only on microbenchmarks.
- Measure with realistic workloads.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-advanced-q01 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-advanced-q02 -->
#### Advanced Q02: How would you choose between controllers and Minimal APIs for a large enterprise system?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

For a large enterprise system, the choice should be based on maintainability, consistency, required framework features, team experience, testing strategy, documentation requirements, and long-term ownership.

Controllers may be better if the organization already has controller conventions, uses MVC filters heavily, needs advanced model binding, OData, JSON Patch, or extensive controller conventions. Minimal APIs may be better if the system follows vertical-slice architecture, prefers lightweight endpoint modules, and does not need MVC-specific features.

A mixed approach can also be valid. For example, core business APIs may remain controller-based while health checks, webhooks, or new feature modules use Minimal APIs. If mixing styles, the team should define standards for routing, error responses, validation, authorization, logging, and OpenAPI metadata.

##### Key Points to Mention

- Consider team conventions and existing codebase.
- Consider MVC-specific feature needs.
- Consider vertical-slice vs controller/resource organization.
- Mixing is valid when conventions are clear.
- Maintainability is more important than style preference.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-advanced-q02 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-advanced-q03 -->
#### Advanced Q03: What MVC-specific features might make controllers the better choice?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Controllers may be the better choice when the application needs features that are deeply integrated with MVC. Examples include advanced model binding extensibility with custom model binders or model binder providers, advanced validation providers, MVC filters across different pipeline stages, application model conventions, OData, JSON Patch, and mature controller-oriented API versioning or documentation conventions.

Some of these can be implemented with Minimal APIs using middleware, endpoint filters, custom binders, or conventions, but controllers provide them more naturally and with more established patterns.

##### Key Points to Mention

- Advanced model binding extensibility.
- Advanced validation extensibility.
- MVC filters and application model conventions.
- OData and JSON Patch scenarios.
- Existing mature controller-based patterns.
- Minimal APIs can sometimes replicate these, but not always as directly.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-advanced-q03 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-advanced-q04 -->
#### Advanced Q04: How can Minimal APIs support clean architecture or CQRS?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Minimal APIs can support clean architecture or CQRS by keeping endpoint handlers thin and delegating business behavior to application services, command handlers, query handlers, or MediatR handlers. The endpoint should be responsible for HTTP concerns: binding request data, calling the application layer, handling authorization or validation metadata, and mapping the result to an HTTP response.

Example:

```csharp
group.MapPost("/", async (
    CreateProductCommand command,
    ISender sender,
    CancellationToken cancellationToken) =>
{
    Result<ProductDto> result = await sender.Send(command, cancellationToken);

    return result.IsSuccess
        ? TypedResults.Created($"/api/products/{result.Value.Id}", result.Value)
        : TypedResults.BadRequest(result.Errors);
});
```

The same principle applies to controllers. The endpoint style should not contain domain logic. Clean architecture depends more on dependency direction and separation of concerns than on whether the endpoint is a controller or Minimal API.

##### Key Points to Mention

- Keep handlers thin.
- Delegate to application layer services or handlers.
- Do not place domain logic in route lambdas.
- Minimal APIs work well with vertical slices.
- Clean architecture is about dependencies and boundaries, not controller syntax.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-advanced-q04 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-advanced-q05 -->
#### Advanced Q05: How would you standardize error responses across controllers and Minimal APIs?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

A good approach is to standardize around Problem Details for error responses. Use centralized exception handling middleware for unexpected exceptions and known application exceptions. Use validation behavior or filters to return consistent validation errors. For controllers, `[ApiController]` can help with automatic validation responses. For Minimal APIs, endpoint filters or built-in validation support can help return consistent validation Problem Details.

The important part is that clients receive the same error shape regardless of whether the endpoint is implemented with controllers or Minimal APIs.

Example goals:

```json
{
  "type": "https://example.com/problems/validation-error",
  "title": "Validation failed",
  "status": 400,
  "errors": {
    "name": ["Name is required."]
  }
}
```

##### Key Points to Mention

- Use Problem Details consistently.
- Centralize exception handling with middleware.
- Standardize validation error responses.
- Avoid each endpoint inventing its own error shape.
- Consistency matters more than endpoint style.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-advanced-q05 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-advanced-q06 -->
#### Advanced Q06: What are the risks of mixing controllers and Minimal APIs in the same application?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

The main risk is inconsistency. Different modules may handle validation, authorization, logging, error responses, route naming, OpenAPI metadata, and testing differently. This can make the API harder to maintain and harder for clients to consume.

Mixing can be a good strategy when there is a clear reason, such as gradual migration or using Minimal APIs for simple operational endpoints. However, the team should define conventions for folder structure, route naming, response types, Problem Details, authentication, authorization, versioning, and documentation.

##### Key Points to Mention

- Main risk is inconsistent conventions.
- Define shared standards for routing and responses.
- Standardize validation and error handling.
- Use mixing intentionally, not randomly.
- Good for gradual migration or specific endpoint types.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-advanced-q06 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-advanced-q07 -->
#### Advanced Q07: How do endpoint filters differ from middleware, and when should each be used?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Middleware runs in the global HTTP request pipeline and can apply to all or large groups of requests. It is best for broad infrastructure concerns such as exception handling, authentication, CORS, HTTPS redirection, request logging, rate limiting, and response compression.

Endpoint filters run closer to Minimal API endpoint execution. They can inspect endpoint handler arguments and results, which middleware generally does not understand at that level. Endpoint filters are good for endpoint-specific validation, logging, pre/post processing, or short-circuiting based on handler parameters.

Use middleware for broad HTTP pipeline concerns. Use endpoint filters for Minimal API concerns that need endpoint arguments or handler result access.

##### Key Points to Mention

- Middleware is broader and pipeline-level.
- Endpoint filters are endpoint-level.
- Endpoint filters can inspect handler arguments.
- Use middleware for global concerns.
- Use endpoint filters for endpoint-specific pre/post logic.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-advanced-q07 -->

<!-- question:start:controllers-vs-minimal-apis-when-to-choose-each-advanced-q08 -->
#### Advanced Q08: How should API documentation be handled for controllers and Minimal APIs?
<!-- question-id:controllers-vs-minimal-apis-when-to-choose-each-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

Both controllers and Minimal APIs can generate OpenAPI documentation, but developers should provide explicit metadata for important endpoints. Controllers often use attributes such as `[ProducesResponseType]`, while Minimal APIs often use methods such as `.Produces<T>()`, `.ProducesValidationProblem()`, `.WithName()`, `.WithTags()`, and OpenAPI-related endpoint metadata.

For public APIs, documentation should describe status codes, request bodies, response bodies, validation errors, authentication requirements, and versioning. The chosen programming model should not result in unclear API contracts.

##### Key Points to Mention

- Both styles support OpenAPI.
- Controllers often use attributes.
- Minimal APIs often use endpoint metadata methods.
- Document response codes and error shapes explicitly.
- Public API contracts should not rely only on inference.

<!-- question:end:controllers-vs-minimal-apis-when-to-choose-each-advanced-q08 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
