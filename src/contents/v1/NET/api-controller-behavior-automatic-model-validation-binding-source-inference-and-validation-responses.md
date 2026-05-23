---
id: api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses
topic: API design and implementation
subtopic: "[ApiController] Behavior"
category: ".NET"
---


## Overview

`[ApiController]` is an ASP.NET Core attribute that enables a set of API-focused conventions for controller-based Web APIs. It is commonly applied to controllers that derive from `ControllerBase`, although it can also be applied through a shared base controller or at the assembly level.

This topic matters because `[ApiController]` changes how ASP.NET Core handles routing, model binding, validation, request body inference, service injection into action parameters, and error responses. These behaviors reduce boilerplate code, but they can also surprise developers who do not understand what the framework is doing automatically.

In real projects, `[ApiController]` is used in REST APIs, internal service APIs, microservices, backend-for-frontend APIs, and enterprise applications built with ASP.NET Core. It helps teams create consistent request validation and error response behavior without repeating `if (!ModelState.IsValid)` in every action.

This topic is important for interviews because it tests whether a candidate understands practical ASP.NET Core API behavior, not just how to write a controller action. Interviewers often ask about model validation, binding sources, `ModelState`, `ValidationProblemDetails`, `ProblemDetails`, request body binding, and why an action may return `400 Bad Request` before the method body executes.

## Core Concepts

### What `[ApiController]` Is

`[ApiController]` is an attribute from ASP.NET Core MVC that enables opinionated Web API behaviors for controller-based APIs.

A typical controller looks like this:

```csharp
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpGet("{id:int}")]
    public ActionResult<ProductDto> GetById(int id)
    {
        var product = new ProductDto(id, "Keyboard", 49.99m);
        return Ok(product);
    }
}

public sealed record ProductDto(int Id, string Name, decimal Price);
```

The attribute helps ASP.NET Core treat the controller as an API controller rather than an MVC controller that returns views.

Key behaviors include:

- Attribute routing is required.
- Invalid model state can automatically return `400 Bad Request`.
- Binding sources can be inferred.
- `IFormFile` and `IFormFileCollection` infer multipart form-data behavior.
- Error responses can use `ProblemDetails` and `ValidationProblemDetails`.

### Where `[ApiController]` Can Be Applied

`[ApiController]` can be applied in three common ways.

Apply it directly to one controller:

```csharp
[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
}
```

Apply it to a shared base controller:

```csharp
[ApiController]
public abstract class ApiControllerBase : ControllerBase
{
}

[Route("api/customers")]
public class CustomersController : ApiControllerBase
{
}
```

Apply it at the assembly level:

```csharp
using Microsoft.AspNetCore.Mvc;

[assembly: ApiController]
```

When applied at the assembly level, all controllers in the assembly behave as API controllers. This can be useful for API-only projects, but it also means individual controllers cannot easily opt out.

### Attribute Routing Requirement

With `[ApiController]`, attribute routing is expected. Actions should be reachable through attributes such as `[Route]`, `[HttpGet]`, `[HttpPost]`, `[HttpPut]`, and `[HttpDelete]`.

Example:

```csharp
[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        return Ok(new { Id = id });
    }
}
```

This makes API routing explicit and easier to reason about. It also helps OpenAPI tools generate more accurate endpoint documentation.

A common mistake is to apply `[ApiController]` but rely only on conventional MVC routes. For Web APIs, explicit route attributes are the expected approach.

### Automatic Model Validation

One of the most important `[ApiController]` behaviors is automatic model validation.

Without `[ApiController]`, developers often write this manually:

```csharp
[HttpPost]
public IActionResult Create(CreateProductRequest request)
{
    if (!ModelState.IsValid)
    {
        return BadRequest(ModelState);
    }

    return Ok();
}
```

With `[ApiController]`, the manual check is usually unnecessary. If model binding or validation produces an invalid `ModelState`, ASP.NET Core can automatically return `400 Bad Request` before the action method body runs.

Example request model:

```csharp
using System.ComponentModel.DataAnnotations;

public sealed class CreateProductRequest
{
    [Required]
    [StringLength(100)]
    public string? Name { get; init; }

    [Range(0.01, 100000)]
    public decimal Price { get; init; }
}
```

Controller action:

```csharp
[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpPost]
    public IActionResult Create(CreateProductRequest request)
    {
        // If request.Name is missing or Price is invalid,
        // this code may not execute because ASP.NET Core can return 400 automatically.
        return CreatedAtAction(nameof(GetById), new { id = 1 }, request);
    }

    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        return Ok(new { Id = id });
    }
}
```

This behavior makes APIs cleaner, but developers must understand that validation may happen before action code executes.

### `ModelState` and Validation Errors

`ModelState` stores model binding and validation information.

It can contain errors from:

- Missing required request body.
- Invalid JSON.
- Type conversion failures.
- Data annotation validation failures.
- Custom validation attributes.
- Manual calls to `ModelState.AddModelError`.

Example type conversion failure:

```http
GET /api/products/abc
```

If the route expects `id:int`, ASP.NET Core cannot bind `abc` to an `int`. That failure can make `ModelState` invalid and result in a validation response.

Example manual model state error:

```csharp
[HttpPost]
public IActionResult Create(CreateProductRequest request)
{
    if (request.Name == "admin")
    {
        ModelState.AddModelError(nameof(request.Name), "Product name is not allowed.");
        return ValidationProblem(ModelState);
    }

    return Ok();
}
```

Even with automatic validation, manual `ModelState` checks can still be useful for business-rule validation that happens inside the action. However, many teams prefer to separate business validation from model binding validation using validators, domain rules, or application-layer result types.

### Default Validation Response

When `[ApiController]` returns an automatic validation response, the response typically uses `ValidationProblemDetails`.

Example response shape:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "Name": [
      "The Name field is required."
    ],
    "Price": [
      "The field Price must be between 0.01 and 100000."
    ]
  },
  "traceId": "00-..."
}
```

Important points:

- The HTTP status is usually `400 Bad Request`.
- The response is machine-readable.
- The `errors` object groups messages by field name or model key.
- The response can include a trace identifier useful for support and logging.
- The shape is more consistent than returning arbitrary strings or anonymous objects.

### `ProblemDetails` vs `ValidationProblemDetails`

`ProblemDetails` is a standard error response format for HTTP APIs. It commonly includes:

- `type`
- `title`
- `status`
- `detail`
- `instance`

`ValidationProblemDetails` extends this idea for validation errors by adding an `errors` dictionary.

Use `ProblemDetails` for general API errors:

```csharp
[HttpGet("{id:int}")]
public IActionResult GetById(int id)
{
    return Problem(
        title: "Product lookup failed.",
        detail: $"Product {id} could not be loaded.",
        statusCode: StatusCodes.Status500InternalServerError);
}
```

Use `ValidationProblemDetails` for validation failures:

```csharp
[HttpPost]
public IActionResult Create(CreateProductRequest request)
{
    ModelState.AddModelError(nameof(request.Name), "Name is already used.");
    return ValidationProblem(ModelState);
}
```

A good interview answer should mention that validation failures and general API failures should have consistent response shapes, especially when consumed by frontend applications or other services.

### Binding-Source Inference

Binding-source inference means ASP.NET Core can infer where action parameters should come from instead of requiring explicit attributes every time.

Common binding attributes include:

| Attribute | Source |
|---|---|
| `[FromRoute]` | Route values |
| `[FromQuery]` | Query string |
| `[FromBody]` | Request body |
| `[FromForm]` | Form fields |
| `[FromHeader]` | Request headers |
| `[FromServices]` | Dependency injection container |

Example with explicit binding:

```csharp
[HttpGet("{id:int}")]
public IActionResult Search(
    [FromRoute] int id,
    [FromQuery] string? keyword,
    [FromHeader(Name = "X-Correlation-Id")] string? correlationId)
{
    return Ok(new { id, keyword, correlationId });
}
```

With `[ApiController]`, ASP.NET Core can infer many of these sources automatically.

### Common Binding Inference Rules

For API controllers, binding-source inference commonly works like this:

- Complex types registered in the DI container are inferred as services.
- Complex types not registered in DI are usually inferred from the request body.
- `IFormFile` and `IFormFileCollection` are inferred from form data.
- Parameters whose names match route parameters are inferred from route values.
- Other simple parameters are inferred from the query string.

Example:

```csharp
[HttpPost("{tenantId:guid}/products")]
public IActionResult Create(
    Guid tenantId,
    CreateProductRequest request,
    IProductService productService)
{
    return Ok();
}
```

Possible inference:

- `tenantId` comes from the route because the route template contains `{tenantId}`.
- `request` comes from the body because it is a complex request DTO.
- `productService` may come from services if it is registered in DI.

Even though inference is convenient, many teams still prefer explicit attributes for public APIs because they make the contract easier to read.

### Simple Types vs Complex Types

ASP.NET Core treats simple and complex types differently.

Simple types include types such as:

- `int`
- `long`
- `bool`
- `decimal`
- `double`
- `Guid`
- `DateTime`
- `string`
- enums

Complex types include custom classes and records such as:

```csharp
public sealed record CreateOrderRequest(
    int CustomerId,
    IReadOnlyList<CreateOrderLineRequest> Lines);

public sealed record CreateOrderLineRequest(
    int ProductId,
    int Quantity);
```

A common interview point is that simple action parameters are usually bound from route or query string, while complex request DTOs are usually bound from the request body in API controllers.

Example:

```csharp
[HttpGet("search")]
public IActionResult Search(string keyword, int page = 1)
{
    // keyword and page are usually read from query string:
    // /api/products/search?keyword=keyboard&page=2
    return Ok();
}
```

### Request Body Binding and the One-Body-Parameter Rule

HTTP requests have one body stream. In ASP.NET Core MVC controllers, an action should not have multiple parameters bound from the body.

Problematic example:

```csharp
[HttpPost]
public IActionResult Create(ProductRequest product, AuditRequest audit)
{
    return Ok();
}
```

If both parameters are inferred or marked as `[FromBody]`, ASP.NET Core cannot safely bind both from the same request body. The better design is to create one request DTO:

```csharp
public sealed class CreateProductCommand
{
    public ProductRequest Product { get; init; } = new();
    public AuditRequest Audit { get; init; } = new();
}

[HttpPost]
public IActionResult Create(CreateProductCommand request)
{
    return Ok();
}
```

Best practice:

- Use one body DTO per action.
- Keep route identifiers in route parameters.
- Keep filtering and pagination in query parameters.
- Avoid putting unrelated body parameters directly in the action signature.

### `[FromServices]` and Dependency Injection in Action Parameters

`[FromServices]` binds an action parameter from the DI container.

Example:

```csharp
[HttpGet("{id:int}")]
public async Task<IActionResult> GetById(
    int id,
    [FromServices] IProductQueryService productQueryService,
    CancellationToken cancellationToken)
{
    var product = await productQueryService.GetByIdAsync(id, cancellationToken);

    return product is null ? NotFound() : Ok(product);
}
```

This can be useful for action-specific services, but constructor injection is often preferred for required controller dependencies.

Constructor injection:

```csharp
[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    private readonly IProductQueryService _productQueryService;

    public ProductsController(IProductQueryService productQueryService)
    {
        _productQueryService = productQueryService;
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken cancellationToken)
    {
        var product = await _productQueryService.GetByIdAsync(id, cancellationToken);
        return product is null ? NotFound() : Ok(product);
    }
}
```

Use constructor injection when the controller depends on the service for most actions. Use `[FromServices]` when the dependency is only needed by one action or when it improves action-level clarity.

### Binding-Source Inference Can Surprise You

Binding-source inference is helpful, but it can create unexpected behavior.

Example:

```csharp
[HttpPost]
public IActionResult Create(CreateProductRequest request, ProductOptions options)
{
    return Ok();
}
```

If `ProductOptions` is registered in DI, it may be inferred from services. If it is not registered, it may be inferred from the body. That can change behavior depending on DI registration.

Better approach:

```csharp
[HttpPost]
public IActionResult Create(
    [FromBody] CreateProductRequest request,
    [FromServices] ProductOptions options)
{
    return Ok();
}
```

For interview answers, mention that explicit binding attributes are often clearer for complex or security-sensitive endpoints.

### Validation Attributes and DTO Design

Data annotations are commonly used for request DTO validation.

Example:

```csharp
using System.ComponentModel.DataAnnotations;

public sealed class RegisterUserRequest
{
    [Required]
    [EmailAddress]
    public string? Email { get; init; }

    [Required]
    [StringLength(100, MinimumLength = 8)]
    public string? Password { get; init; }

    [Range(18, 120)]
    public int Age { get; init; }
}
```

Controller:

```csharp
[HttpPost("register")]
public IActionResult Register(RegisterUserRequest request)
{
    return Ok();
}
```

Good DTO design practices:

- Use request-specific DTOs instead of exposing EF Core entities directly.
- Validate input shape at the API boundary.
- Keep domain validation in the domain or application layer.
- Avoid relying only on client-side validation.
- Avoid putting sensitive or server-controlled fields in request DTOs.

### Automatic 400 vs Manual Business Validation

Automatic model validation is best for input shape and basic request validation.

Examples:

- Required field is missing.
- String length is too long.
- Numeric value is out of range.
- Request body is invalid.
- Type conversion failed.

Business validation is different.

Examples:

- User does not have enough balance.
- Product name must be unique in a tenant.
- Order cannot be canceled after shipment.
- Start date must be before end date based on business rules.
- Customer is not allowed to access the requested resource.

Business validation often belongs in the application layer or domain layer, not only in attributes.

Example:

```csharp
[HttpPost]
public async Task<IActionResult> Create(
    CreateProductRequest request,
    CancellationToken cancellationToken)
{
    var result = await _productService.CreateAsync(request, cancellationToken);

    if (result.IsDuplicateName)
    {
        ModelState.AddModelError(nameof(request.Name), "A product with this name already exists.");
        return ValidationProblem(ModelState);
    }

    return CreatedAtAction(nameof(GetById), new { id = result.ProductId }, null);
}
```

This approach still returns a validation-style response but keeps the business decision in the appropriate layer.

### Customizing Automatic Validation Responses

You can customize automatic validation responses using `ApiBehaviorOptions`.

Example:

```csharp
using Microsoft.AspNetCore.Mvc;

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var problemDetails = new ValidationProblemDetails(context.ModelState)
            {
                Title = "Request validation failed.",
                Status = StatusCodes.Status400BadRequest,
                Detail = "Check the errors property for details."
            };

            problemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;

            return new BadRequestObjectResult(problemDetails);
        };
    });
```

This is useful when an organization needs a consistent API error contract across services.

Best practices:

- Keep the response machine-readable.
- Preserve field-level validation details.
- Include a trace identifier.
- Avoid leaking sensitive internal details.
- Keep the shape consistent across endpoints.

### Disabling Automatic 400 Responses

Automatic `400 Bad Request` responses can be disabled globally.

Example:

```csharp
using Microsoft.AspNetCore.Mvc;

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.SuppressModelStateInvalidFilter = true;
    });
```

After this, actions must check `ModelState.IsValid` manually or use another validation mechanism.

Disabling automatic validation is uncommon for standard APIs, but it may be useful when:

- The team uses a custom validation pipeline.
- The API must return a legacy error response shape.
- The application wants to combine multiple validation sources before responding.
- The endpoint needs special validation flow.

### Disabling Binding-Source Inference

Binding-source inference can also be disabled.

Example:

```csharp
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.SuppressInferBindingSourcesForParameters = true;
    });
```

If inference is disabled, developers should use explicit attributes:

```csharp
[HttpPost("{tenantId:guid}/products")]
public IActionResult Create(
    [FromRoute] Guid tenantId,
    [FromBody] CreateProductRequest request,
    [FromServices] IProductService productService)
{
    return Ok();
}
```

This style is more verbose but can make API contracts clearer.

### Problem Details for Client Error Responses

With API controller conventions, client error results such as `NotFound()` can be mapped to `ProblemDetails` responses.

Example:

```csharp
[HttpGet("{id:int}")]
public IActionResult GetById(int id)
{
    ProductDto? product = null;

    if (product is null)
    {
        return NotFound();
    }

    return Ok(product);
}
```

Instead of returning an empty 404, the framework may generate a problem details response depending on configuration.

For APIs consumed by frontend applications, this consistency helps client code handle errors in a predictable way.

### Multipart Form-Data and File Uploads

`[ApiController]` applies special inference for file upload parameters such as `IFormFile` and `IFormFileCollection`.

Example:

```csharp
[HttpPost("upload")]
public async Task<IActionResult> Upload(IFormFile file, CancellationToken cancellationToken)
{
    if (file.Length == 0)
    {
        return BadRequest("File is empty.");
    }

    await using var stream = file.OpenReadStream();

    // Save or process the stream here.

    return Ok(new { file.FileName, file.Length });
}
```

For file uploads, clients usually send `multipart/form-data`.

Common mistakes:

- Sending JSON instead of multipart form data.
- Forgetting request size limits.
- Loading very large files entirely into memory.
- Trusting the uploaded file name without sanitization.
- Not validating file type, extension, and content.

### Nullable Reference Types and Validation

Nullable reference types and validation attributes are related but not identical.

Example:

```csharp
public sealed class CreateCustomerRequest
{
    public string Name { get; init; } = string.Empty;

    public string? Notes { get; init; }
}
```

With nullable reference types enabled, `Name` expresses that the property should not be null in C# code. However, API validation behavior depends on model binding and validation rules.

Many teams still use explicit validation attributes for public API contracts:

```csharp
public sealed class CreateCustomerRequest
{
    [Required]
    public string? Name { get; init; }

    public string? Notes { get; init; }
}
```

Best practice:

- Use nullable reference types for C# correctness.
- Use validation attributes or a validation library for API input rules.
- Avoid assuming nullable annotations alone are enough for all runtime validation needs.

### Minimal APIs Comparison

`[ApiController]` applies to controller-based APIs. Minimal APIs do not use `[ApiController]` on endpoint handlers, but they have their own binding and validation patterns.

Controller example:

```csharp
[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpPost]
    public IActionResult Create(CreateProductRequest request)
    {
        return Ok();
    }
}
```

Minimal API example:

```csharp
app.MapPost("/api/products", (CreateProductRequest request) =>
{
    return Results.Ok();
});
```

Important difference:

- `[ApiController]` is a controller convention.
- Minimal APIs use endpoint parameter binding rules.
- Validation behavior in Minimal APIs may need explicit filters, endpoint filters, libraries, or manual handling depending on the application design.

In interviews, avoid saying `[ApiController]` controls all ASP.NET Core APIs. It specifically affects controller-based APIs.

### Common Mistakes

Common mistakes include:

- Manually checking `ModelState.IsValid` in every action even though `[ApiController]` already handles it.
- Forgetting that invalid model state can prevent the action method from running.
- Using multiple `[FromBody]` parameters in one action.
- Assuming all complex parameters always come from the body, even when registered in DI.
- Returning inconsistent validation error shapes.
- Exposing domain entities or EF Core entities directly as request models.
- Treating data annotations as complete business validation.
- Not including trace or correlation information in error responses.
- Disabling automatic validation without replacing it with a consistent validation strategy.
- Forgetting explicit route attributes.

### Best Practices

Use `[ApiController]` for controller-based Web APIs unless there is a strong reason not to.

Prefer `ControllerBase` instead of `Controller` for APIs that do not return views.

Use explicit route attributes:

```csharp
[Route("api/orders")]
```

Use request and response DTOs instead of domain entities:

```csharp
public sealed record CreateOrderRequest(int CustomerId, List<CreateOrderLineRequest> Lines);
public sealed record OrderResponse(int Id, int CustomerId, decimal Total);
```

Use one request body DTO per action.

Use explicit binding attributes when the action signature could be ambiguous:

```csharp
public IActionResult Create(
    [FromRoute] Guid tenantId,
    [FromBody] CreateOrderRequest request,
    [FromHeader(Name = "X-Correlation-Id")] string? correlationId)
```

Return `ValidationProblem(ModelState)` for manual validation errors that should match automatic validation responses.

Customize `InvalidModelStateResponseFactory` if your organization requires a standard error envelope.

Keep input validation, business validation, authorization, and exception handling separate.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-beginner-q01 -->
#### Beginner Q01: What does `[ApiController]` do in ASP.NET Core?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

`[ApiController]` enables API-specific conventions for controller-based ASP.NET Core Web APIs. It helps the framework handle common API behaviors automatically, such as requiring attribute routing, automatically returning `400 Bad Request` when model validation fails, inferring where action parameters should be bound from, handling file upload content type inference, and producing consistent problem details responses for some client errors.

It reduces boilerplate code and makes controller APIs behave more consistently.

##### Key Points to Mention

- Applies to controller-based APIs.
- Commonly used with `ControllerBase`.
- Enables automatic model validation responses.
- Enables binding-source inference.
- Requires attribute routing.
- Helps produce consistent API error responses.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-beginner-q01 -->

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-beginner-q02 -->
#### Beginner Q02: Why is `if (!ModelState.IsValid)` often unnecessary when using `[ApiController]`?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

When `[ApiController]` is applied, ASP.NET Core can automatically check `ModelState` before the action method executes. If the model state is invalid, the framework returns a `400 Bad Request` response automatically. This means the action does not need to manually check `ModelState.IsValid` for basic request validation.

However, manual validation may still be needed for business rules that are evaluated inside the action or application layer.

##### Key Points to Mention

- Invalid model state can short-circuit the action.
- Automatic response is usually `400 Bad Request`.
- Response commonly uses `ValidationProblemDetails`.
- Manual checks may still be used for business validation.
- Avoid repeated boilerplate in every action.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-beginner-q02 -->

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-beginner-q03 -->
#### Beginner Q03: What is `ModelState`?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`ModelState` is a structure that stores the result of model binding and validation. It contains information about whether the request values were successfully bound to action parameters or model properties, and whether validation rules passed.

For example, if a required field is missing, a string is too long, or a route value cannot be converted to an integer, `ModelState` can contain an error.

##### Key Points to Mention

- Tracks binding and validation errors.
- Used by ASP.NET Core MVC.
- Invalid model state can produce automatic 400 responses.
- Can contain data annotation errors.
- Can also contain conversion errors.
- Developers can add errors manually with `ModelState.AddModelError`.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-beginner-q03 -->

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-beginner-q04 -->
#### Beginner Q04: What is the difference between `[FromRoute]`, `[FromQuery]`, and `[FromBody]`?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`[FromRoute]` binds a value from route data, such as `/api/products/10`. `[FromQuery]` binds a value from the query string, such as `/api/products?category=books`. `[FromBody]` binds a value from the request body, usually JSON.

Example:

```csharp
[HttpPut("{id:int}")]
public IActionResult Update(
    [FromRoute] int id,
    [FromQuery] bool notify,
    [FromBody] UpdateProductRequest request)
{
    return Ok();
}
```

In this example, `id` comes from the route, `notify` comes from the query string, and `request` comes from the JSON body.

##### Key Points to Mention

- `[FromRoute]` reads route template values.
- `[FromQuery]` reads query string values.
- `[FromBody]` reads the request body.
- Request body is commonly JSON.
- Explicit attributes improve readability.
- `[ApiController]` can infer many sources automatically.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-beginner-q04 -->

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-beginner-q05 -->
#### Beginner Q05: What response is returned when model validation fails in an API controller?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

When `[ApiController]` is used and model validation fails, ASP.NET Core typically returns `400 Bad Request` automatically. The response body commonly uses `ValidationProblemDetails`, which includes a title, status code, trace ID, and an `errors` dictionary containing field-level validation messages.

##### Key Points to Mention

- Usually returns HTTP 400.
- Usually happens before the action body executes.
- Response is machine-readable.
- `errors` contains field-specific messages.
- Useful for frontend validation display.
- Helps keep API validation responses consistent.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-beginner-q05 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q01 -->
#### Intermediate Q01: Explain binding-source inference with `[ApiController]`.

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Binding-source inference means ASP.NET Core can infer where an action parameter should come from without requiring explicit attributes.

For API controllers, route-matching parameter names are inferred from route values. Other simple types are often inferred from query string values. Complex types are usually inferred from the request body unless they are registered in the DI container, in which case they may be inferred from services. File parameters such as `IFormFile` are inferred from form data.

Example:

```csharp
[HttpPost("{tenantId:guid}/products")]
public IActionResult Create(Guid tenantId, CreateProductRequest request)
{
    return Ok();
}
```

Here, `tenantId` is inferred from the route and `request` is inferred from the body.

##### Key Points to Mention

- Saves repetitive binding attributes.
- Route parameter names are important.
- Complex DTOs are commonly inferred from body.
- Simple parameters are commonly inferred from query.
- DI-registered complex types may be inferred from services.
- Explicit attributes are clearer for complex signatures.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q01 -->

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q02 -->
#### Intermediate Q02: Why should an action not have multiple `[FromBody]` parameters?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

An HTTP request has one body stream. ASP.NET Core generally expects only one action parameter to be bound from the request body. If an action has multiple body-bound parameters, the framework cannot reliably deserialize the same body into multiple independent parameters.

The correct approach is to create one request DTO that contains all the body data.

Bad example:

```csharp
[HttpPost]
public IActionResult Create(ProductRequest product, AuditRequest audit)
{
    return Ok();
}
```

Better example:

```csharp
public sealed class CreateProductRequest
{
    public ProductRequest Product { get; init; } = new();
    public AuditRequest Audit { get; init; } = new();
}

[HttpPost]
public IActionResult Create(CreateProductRequest request)
{
    return Ok();
}
```

##### Key Points to Mention

- Request body is a single stream.
- Use one body DTO per action.
- Route values and query values can still be separate parameters.
- Multiple body-bound parameters can cause startup or runtime errors.
- Good DTO design improves API clarity.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q02 -->

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q03 -->
#### Intermediate Q03: How can you customize automatic validation responses?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Automatic validation responses can be customized using `ApiBehaviorOptions.InvalidModelStateResponseFactory`. This lets the application change the response body, add metadata such as trace IDs, log validation failures, or enforce a standard organization-wide error response shape.

Example:

```csharp
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var problemDetails = new ValidationProblemDetails(context.ModelState)
            {
                Title = "Validation failed.",
                Status = StatusCodes.Status400BadRequest
            };

            problemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;

            return new BadRequestObjectResult(problemDetails);
        };
    });
```

##### Key Points to Mention

- Use `ConfigureApiBehaviorOptions`.
- Customize `InvalidModelStateResponseFactory`.
- Preserve field-level errors.
- Include trace/correlation information.
- Keep response shape consistent.
- Avoid leaking internal details.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q03 -->

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q04 -->
#### Intermediate Q04: What is the difference between `ProblemDetails` and `ValidationProblemDetails`?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

`ProblemDetails` is a general machine-readable format for HTTP API errors. It usually contains fields such as `type`, `title`, `status`, `detail`, and `instance`.

`ValidationProblemDetails` is used for validation errors and includes an additional `errors` dictionary that maps field names or model keys to validation messages.

Use `ProblemDetails` for general errors such as not found, conflict, or server errors. Use `ValidationProblemDetails` when the client submitted invalid input and field-level validation information should be returned.

##### Key Points to Mention

- `ProblemDetails` is general error metadata.
- `ValidationProblemDetails` is specialized for validation.
- Validation responses include an `errors` dictionary.
- Both support consistent API error contracts.
- Automatic model validation commonly returns `ValidationProblemDetails`.
- `ValidationProblem(ModelState)` helps keep custom validation responses consistent.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q04 -->

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q05 -->
#### Intermediate Q05: When would you use explicit binding attributes even though `[ApiController]` can infer sources?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Explicit binding attributes are useful when readability, maintainability, or security is more important than reducing code. They make it clear where each value comes from and avoid surprises from inference rules.

For example:

```csharp
[HttpPost("{tenantId:guid}/orders")]
public IActionResult Create(
    [FromRoute] Guid tenantId,
    [FromQuery] bool dryRun,
    [FromHeader(Name = "X-Correlation-Id")] string? correlationId,
    [FromBody] CreateOrderRequest request)
{
    return Ok();
}
```

This action is easier to understand because route, query, header, and body inputs are explicit.

##### Key Points to Mention

- Improves API contract readability.
- Avoids unexpected DI inference.
- Helps with security-sensitive endpoints.
- Useful for mixed route/query/body/header parameters.
- Helpful in large teams and public APIs.
- Reduces ambiguity when reviewing code.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q05 -->

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q06 -->
#### Intermediate Q06: How does `[FromServices]` work with `[ApiController]`?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

`[FromServices]` tells ASP.NET Core to resolve an action parameter from the dependency injection container. With `[ApiController]`, complex types that are registered in DI may be inferred as services even without the explicit `[FromServices]` attribute.

Example:

```csharp
[HttpGet("{id:int}")]
public async Task<IActionResult> GetById(
    int id,
    [FromServices] IProductQueryService queryService,
    CancellationToken cancellationToken)
{
    var product = await queryService.GetByIdAsync(id, cancellationToken);
    return product is null ? NotFound() : Ok(product);
}
```

This can be useful for action-specific dependencies. For dependencies used by many actions, constructor injection is usually preferred.

##### Key Points to Mention

- Resolves action parameter from DI.
- `[ApiController]` can infer services for registered complex types.
- Constructor injection is usually preferred for common dependencies.
- `[FromServices]` is useful for action-specific dependencies.
- Inference can surprise developers if a request type is accidentally registered in DI.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-intermediate-q06 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q01 -->
#### Advanced Q01: How would you design validation in a production ASP.NET Core API using `[ApiController]`?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

A production API should separate input validation, business validation, authorization, and exception handling.

`[ApiController]` should handle basic request validation at the API boundary, such as required fields, invalid types, invalid JSON, and simple data annotation rules. Business validation should usually live in the application or domain layer. For example, checking whether a product name is unique, whether an order can be canceled, or whether a user has enough balance should not be handled only by model binding attributes.

The API should return consistent validation responses, preferably using `ValidationProblemDetails` or a standardized organization-specific shape. If custom validation is used, the team can map validation failures back into `ModelState` or directly return a consistent validation problem response.

##### Key Points to Mention

- Use `[ApiController]` for boundary validation.
- Keep business rules out of simple DTO attributes where possible.
- Use DTOs instead of EF/domain entities.
- Return consistent validation responses.
- Use `ValidationProblem(ModelState)` for custom validation errors when appropriate.
- Include trace/correlation information.
- Do not expose sensitive implementation details.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q01 -->

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q02 -->
#### Advanced Q02: What problems can binding-source inference cause in large applications?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Binding-source inference can hide important API contract details. In large applications, this may cause confusion when a parameter is inferred from a different source than expected.

One risk is DI inference. If a complex type is registered in the DI container, ASP.NET Core may infer it as a service instead of reading it from the request body. This can be surprising if the type looks like a request model.

Another risk is ambiguity. Without explicit attributes, reviewers must know the framework rules to understand where every parameter comes from. This can make APIs harder to maintain, especially when route, query, body, header, and service parameters are mixed.

A good production practice is to use explicit attributes on public or complex endpoints, even if inference would work.

##### Key Points to Mention

- Inference can reduce readability.
- DI registration can change behavior.
- Complex parameters may be body-bound or service-bound.
- Route parameter names affect binding.
- Explicit attributes make API contracts clearer.
- Inference can be disabled globally if the team wants strict explicit binding.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q02 -->

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q03 -->
#### Advanced Q03: How can you disable or replace `[ApiController]` automatic behaviors?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Automatic behaviors can be configured through `ApiBehaviorOptions`.

For example, automatic model-state validation can be disabled:

```csharp
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.SuppressModelStateInvalidFilter = true;
    });
```

Binding-source inference can be disabled:

```csharp
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.SuppressInferBindingSourcesForParameters = true;
    });
```

Client error mapping can also be changed or suppressed depending on how the API wants to handle `ProblemDetails`.

These settings should be changed carefully because they affect every controller. If automatic validation is disabled, the application should replace it with a consistent validation pipeline.

##### Key Points to Mention

- Use `ConfigureApiBehaviorOptions`.
- `SuppressModelStateInvalidFilter` disables automatic 400 responses.
- `SuppressInferBindingSourcesForParameters` disables binding inference.
- `SuppressMapClientErrors` affects automatic client error mapping.
- Global changes can affect many endpoints.
- Replace disabled framework behavior with a clear alternative.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q03 -->

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q04 -->
#### Advanced Q04: How should an API handle validation errors consistently across controllers?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

A production API should define a consistent validation error contract. The default `ValidationProblemDetails` response is a good starting point because it is machine-readable and includes field-level errors.

For automatic validation, customize `InvalidModelStateResponseFactory` only if the default shape does not meet requirements. For manual validation, use `ValidationProblem(ModelState)` or return the same custom validation error shape. For application-layer validation, map validation failures into the same response format instead of returning unrelated objects from different endpoints.

The API should include trace or correlation information, avoid exposing internal details, and document the error format for frontend and service consumers.

##### Key Points to Mention

- Use a consistent error shape.
- Default `ValidationProblemDetails` is often sufficient.
- Customize only when needed.
- Manual validation should match automatic validation.
- Include trace/correlation ID.
- Avoid inconsistent anonymous error objects.
- Document the response contract.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q04 -->

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q05 -->
#### Advanced Q05: How does `[ApiController]` interact with Minimal APIs?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

`[ApiController]` applies to controller-based APIs, not Minimal API endpoint handlers. Minimal APIs have their own parameter binding rules and conventions. A Minimal API endpoint can bind route, query, body, header, and service parameters, but it does not use `[ApiController]` to enable controller-specific behaviors.

For validation, Minimal APIs often use endpoint filters, manual validation, validation libraries, or custom conventions depending on the project.

A strong answer should avoid saying that `[ApiController]` controls all ASP.NET Core APIs. It is specifically for MVC controller APIs.

##### Key Points to Mention

- `[ApiController]` is for controller-based APIs.
- Minimal APIs do not use controller attributes in the same way.
- Minimal APIs have separate binding behavior.
- Validation strategy may differ.
- Endpoint filters can be used in Minimal APIs.
- Choose the API style based on project needs.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q05 -->

<!-- question:start:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q06 -->
#### Advanced Q06: What is a good answer when asked whether data annotations are enough for validation?

<!-- question-id:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Data annotations are useful for simple input validation, such as required fields, string length, range checks, and format checks. They work well with `[ApiController]` because invalid models can automatically return `400 Bad Request`.

However, data annotations are not enough for all validation. Business rules often require database checks, current user context, tenant rules, workflow state, or domain logic. Those rules should usually be handled in the application or domain layer.

A practical approach is to use data annotations or a validation library for request shape validation, then handle business validation separately and return consistent validation or conflict responses.

##### Key Points to Mention

- Data annotations are good for simple boundary validation.
- They are not enough for complex business rules.
- Business validation may need database or domain context.
- Keep validation responsibilities separated.
- Return consistent error responses.
- Do not expose domain entities directly as request models.

<!-- question:end:api-controller-behavior-automatic-model-validation-binding-source-inference-and-validation-responses-advanced-q06 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
