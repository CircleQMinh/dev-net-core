---
id: parameter-binding-from-route-query-string-body-form-header-and-services
topic: API design and implementation
subtopic: Parameter Binding 
category: .NET
---

## Overview

Parameter binding in ASP.NET Core is the process of taking data from an HTTP request and converting it into strongly typed C# parameters that an API endpoint can use. Instead of manually reading `HttpContext.Request.RouteValues`, `Request.Query`, `Request.Headers`, `Request.Body`, or `Request.Form`, ASP.NET Core can bind those values directly to action method parameters, Minimal API handler parameters, DTOs, and services.

This topic matters because almost every Web API endpoint depends on parameter binding. A typical API may receive an `id` from the route, filtering options from the query string, a JSON object from the request body, a file from form data, a tenant or correlation value from headers, and business services from dependency injection. Understanding how these sources are selected helps developers design predictable APIs, avoid security issues such as overposting, troubleshoot `400 Bad Request` errors, and write cleaner endpoint code.

For interviews, parameter binding is important because it reveals whether a developer understands the HTTP request pipeline, controller APIs, Minimal APIs, DTO design, model validation, dependency injection, and common production mistakes. Strong candidates can explain not only how to use attributes like `[FromRoute]`, `[FromQuery]`, `[FromBody]`, `[FromForm]`, `[FromHeader]`, and `[FromServices]`, but also when explicit binding is safer than relying on framework inference.

## Core Concepts

### What Parameter Binding Means

Parameter binding maps incoming request data to .NET values.

For example, consider this HTTP request:

```http
POST /api/products/42?includeReviews=true
X-Correlation-Id: abc-123
Content-Type: application/json

{
  "name": "Mechanical Keyboard",
  "price": 120
}
```

An ASP.NET Core endpoint can bind the request into C# parameters:

```csharp
[HttpPost("api/products/{id:int}")]
public IActionResult UpdateProduct(
    [FromRoute] int id,
    [FromQuery] bool includeReviews,
    [FromHeader(Name = "X-Correlation-Id")] string correlationId,
    [FromBody] UpdateProductRequest request)
{
    return Ok(new
    {
        id,
        includeReviews,
        correlationId,
        request.Name,
        request.Price
    });
}

public sealed class UpdateProductRequest
{
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
}
```

The endpoint receives strongly typed values without manually parsing strings or reading the body.

### Common Binding Sources

ASP.NET Core commonly binds parameters from these request sources:

| Source | Attribute | Common Use |
|---|---|---|
| Route values | `[FromRoute]` | Resource identifiers such as `/products/{id}` |
| Query string | `[FromQuery]` | Filtering, sorting, paging, search terms |
| Body | `[FromBody]` | JSON request payloads for create/update operations |
| Form | `[FromForm]` | HTML forms, `multipart/form-data`, file uploads |
| Header | `[FromHeader]` | Correlation IDs, tenant IDs, version hints, conditional request headers |
| Services | `[FromServices]` | Dependency injection services used by the endpoint |

Explicit attributes are useful because they make the API contract clear. They also reduce confusion when a parameter could theoretically come from multiple places.

### Controllers vs Minimal APIs

Both controller-based APIs and Minimal APIs support parameter binding, but their style differs.

Controller example:

```csharp
[ApiController]
[Route("api/products")]
public sealed class ProductsController : ControllerBase
{
    [HttpGet("{id:int}")]
    public IActionResult GetProduct(
        [FromRoute] int id,
        [FromQuery] bool includeReviews,
        [FromServices] IProductService productService)
    {
        var product = productService.GetById(id, includeReviews);
        return product is null ? NotFound() : Ok(product);
    }
}
```

Minimal API example:

```csharp
app.MapGet("/api/products/{id:int}", (
    [FromRoute] int id,
    [FromQuery] bool includeReviews,
    IProductService productService) =>
{
    var product = productService.GetById(id, includeReviews);
    return product is null ? Results.NotFound() : Results.Ok(product);
});
```

In Minimal APIs, services registered in dependency injection are commonly inferred automatically by type, so `[FromServices]` is often optional. In controllers, constructor injection is usually preferred for services that are used across multiple actions, while `[FromServices]` is useful for action-specific dependencies.

### Binding from Route Values

Route values come from placeholders in the route template.

```csharp
[HttpGet("api/orders/{orderId:int}/items/{itemId:int}")]
public IActionResult GetOrderItem(
    [FromRoute] int orderId,
    [FromRoute] int itemId)
{
    return Ok(new { orderId, itemId });
}
```

Route binding is best for identifying a resource or nested resource.

Good route parameter examples:

```text
GET /api/products/10
GET /api/orders/100/items/5
GET /api/customers/25/invoices
```

Common mistakes include using route parameters for optional filters or placing too much search state in the path.

Less ideal:

```text
GET /api/products/category/electronics/min-price/100/max-price/500/sort/name
```

Better:

```text
GET /api/products?category=electronics&minPrice=100&maxPrice=500&sort=name
```

Route values should be stable, meaningful parts of the resource identity. Optional filters usually belong in the query string.

### Binding from Query String

Query string binding is used for optional values, filters, pagination, sorting, search, and flags.

```csharp
[HttpGet("api/products")]
public IActionResult SearchProducts(
    [FromQuery] string? search,
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 20,
    [FromQuery] string? sort = null)
{
    return Ok(new { search, page, pageSize, sort });
}
```

Example request:

```http
GET /api/products?search=keyboard&page=2&pageSize=10&sort=price_desc
```

For many query parameters, a request object is cleaner:

```csharp
public sealed class ProductSearchQuery
{
    public string? Search { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Sort { get; init; }
}

[HttpGet("api/products")]
public IActionResult SearchProducts([FromQuery] ProductSearchQuery query)
{
    return Ok(query);
}
```

Query string values are strings in HTTP. Model binding converts them to C# types such as `int`, `bool`, `DateTime`, `Guid`, enums, arrays, and collections when possible.

```csharp
[HttpGet("api/products/by-tags")]
public IActionResult GetByTags([FromQuery] string[] tags)
{
    return Ok(tags);
}
```

Possible request:

```http
GET /api/products/by-tags?tags=keyboard&tags=wireless
```

### Binding from the Body

Body binding is commonly used for JSON payloads in create and update operations.

```csharp
public sealed class CreateProductRequest
{
    public string Name { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public int CategoryId { get; init; }
}

[HttpPost("api/products")]
public IActionResult CreateProduct([FromBody] CreateProductRequest request)
{
    return Created($"/api/products/123", request);
}
```

Example request:

```http
POST /api/products
Content-Type: application/json

{
  "name": "Wireless Mouse",
  "price": 35,
  "categoryId": 7
}
```

In controller APIs with `[ApiController]`, complex types are often inferred from the body. However, using `[FromBody]` can still make the API contract more explicit.

Minimal API example:

```csharp
app.MapPost("/api/products", (CreateProductRequest request) =>
{
    return Results.Created("/api/products/123", request);
});
```

For `POST`, `PUT`, and `PATCH`, Minimal APIs commonly infer complex parameters from the body. For `GET`, `HEAD`, `OPTIONS`, and `DELETE`, body binding is not implicitly inferred in the same way and should be explicit if it is truly needed.

A practical rule is: use body binding for complex create/update command data, not for resource identity or simple filters.

### Only One Body Should Usually Be Bound

The request body is a stream. In typical API design, an endpoint should bind one main request body object.

Avoid this:

```csharp
[HttpPost("api/orders")]
public IActionResult CreateOrder(
    [FromBody] CustomerDto customer,
    [FromBody] OrderDto order)
{
    return Ok();
}
```

Prefer one request DTO:

```csharp
public sealed class CreateOrderRequest
{
    public CustomerDto Customer { get; init; } = new();
    public OrderDto Order { get; init; } = new();
}

[HttpPost("api/orders")]
public IActionResult CreateOrder([FromBody] CreateOrderRequest request)
{
    return Ok();
}
```

One body DTO gives the endpoint a clear contract and avoids ambiguity.

### Binding from Form Data

Form binding reads values from posted form fields. It is commonly used for traditional HTML forms and `multipart/form-data` requests.

Controller example:

```csharp
public sealed class UploadAvatarRequest
{
    public string DisplayName { get; set; } = string.Empty;
    public IFormFile Avatar { get; set; } = default!;
}

[HttpPost("api/users/avatar")]
public async Task<IActionResult> UploadAvatar([FromForm] UploadAvatarRequest request)
{
    if (request.Avatar.Length == 0)
    {
        return BadRequest("File is empty.");
    }

    await using var stream = System.IO.File.Create($"uploads/{request.Avatar.FileName}");
    await request.Avatar.CopyToAsync(stream);

    return Ok(new { request.DisplayName, request.Avatar.FileName });
}
```

Minimal API example:

```csharp
app.MapPost("/api/users/avatar", async (
    [FromForm] string displayName,
    IFormFile avatar) =>
{
    if (avatar.Length == 0)
    {
        return Results.BadRequest("File is empty.");
    }

    await using var stream = File.Create($"uploads/{avatar.FileName}");
    await avatar.CopyToAsync(stream);

    return Results.Ok(new { displayName, avatar.FileName });
});
```

Form binding is different from JSON body binding. A request cannot be both normal JSON and `multipart/form-data` at the same time in the same payload format. File upload endpoints usually use form data, while normal API create/update endpoints usually use JSON.

For production file uploads, do not blindly trust `IFormFile.FileName`. Validate file size, extension, content type, storage location, authorization, and malware scanning requirements.

### Binding from Headers

Header binding reads values from HTTP headers.

```csharp
[HttpGet("api/orders/{id:int}")]
public IActionResult GetOrder(
    [FromRoute] int id,
    [FromHeader(Name = "X-Correlation-Id")] string? correlationId,
    [FromHeader(Name = "X-Tenant-Id")] string? tenantId)
{
    return Ok(new { id, correlationId, tenantId });
}
```

Headers are useful for request metadata, not normal business payload.

Common examples include:

| Header | Purpose |
|---|---|
| `Authorization` | Authentication credential, usually handled by authentication middleware |
| `X-Correlation-Id` | Request tracing across services |
| `X-Tenant-Id` | Tenant identification in multi-tenant systems, if appropriate for the architecture |
| `If-Match` | Optimistic concurrency with ETags |
| `Accept-Language` | Preferred language or culture |

Avoid using custom headers for data that belongs in the route, query string, or body. Also avoid trusting sensitive header values unless they come from a trusted gateway, authentication system, or validated middleware.

### Binding from Services

Service binding gets values from the dependency injection container.

Controller action-level service binding:

```csharp
[HttpGet("api/products/{id:int}")]
public async Task<IActionResult> GetProduct(
    [FromRoute] int id,
    [FromServices] IProductRepository repository)
{
    var product = await repository.GetByIdAsync(id);
    return product is null ? NotFound() : Ok(product);
}
```

Controller constructor injection is usually preferred when the service is used by multiple actions:

```csharp
[ApiController]
[Route("api/products")]
public sealed class ProductsController : ControllerBase
{
    private readonly IProductRepository _repository;

    public ProductsController(IProductRepository repository)
    {
        _repository = repository;
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetProduct([FromRoute] int id)
    {
        var product = await _repository.GetByIdAsync(id);
        return product is null ? NotFound() : Ok(product);
    }
}
```

Minimal API service binding:

```csharp
app.MapGet("/api/products/{id:int}", async (
    int id,
    IProductRepository repository) =>
{
    var product = await repository.GetByIdAsync(id);
    return product is null ? Results.NotFound() : Results.Ok(product);
});
```

In Minimal APIs, if a parameter type is registered in dependency injection, the framework can infer that it should come from services. `[FromServices]` can still be used for clarity.

### Binding Inference and Why Explicit Binding Helps

ASP.NET Core can infer binding sources in many cases, especially with `[ApiController]` and Minimal APIs.

Controller example with inference:

```csharp
[ApiController]
[Route("api/products")]
public sealed class ProductsController : ControllerBase
{
    [HttpPost("{id:int}")]
    public IActionResult Update(int id, UpdateProductRequest request)
    {
        return Ok(new { id, request.Name });
    }
}
```

The framework can infer that `id` comes from route and `request` comes from body.

However, explicit binding is often better for interview-quality and production-quality code:

```csharp
[HttpPost("{id:int}")]
public IActionResult Update(
    [FromRoute] int id,
    [FromBody] UpdateProductRequest request)
{
    return Ok(new { id, request.Name });
}
```

Explicit binding makes it easier for readers, reviewers, and API consumers to understand where each value comes from.

### Minimal API Binding Precedence

Minimal APIs use a set of rules to decide where a parameter comes from. A simplified practical version is:

1. Use explicit attributes first, such as `[FromRoute]`, `[FromQuery]`, `[FromHeader]`, `[FromBody]`, `[FromForm]`, `[FromServices]`, or `[AsParameters]`.
2. Bind special framework types directly, such as `HttpContext`, `HttpRequest`, `HttpResponse`, `ClaimsPrincipal`, `CancellationToken`, `IFormFile`, `Stream`, or `PipeReader`.
3. Use custom binding methods like `BindAsync` when available.
4. Use `TryParse` for simple parseable values from route or query.
5. Use dependency injection if the parameter type is registered as a service.
6. Use the request body for remaining complex parameters when body binding is allowed.

This matters because ambiguous Minimal API parameters may not come from the source a developer expects. For example, a type registered in dependency injection may be resolved as a service instead of being bound from the body.

### Simple Types vs Complex Types

Simple types are values that can usually be converted from a string.

Examples:

```csharp
int id
bool includeInactive
Guid customerId
DateTime startDate
decimal minPrice
ProductStatus status
```

These are often bound from route or query string.

Complex types are objects with multiple properties.

```csharp
public sealed class CreateCustomerRequest
{
    public string Name { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
}
```

Complex types are commonly bound from the body for JSON requests or from the query string/form when explicitly specified.

A common interview mistake is saying, “Simple types always come from query and complex types always come from body.” That is too simplistic. Route templates, explicit attributes, HTTP method, `[ApiController]`, Minimal API rules, custom binders, and registered services can affect the actual binding source.

### Custom Binding with TryParse

Custom value types can participate in binding by exposing a `TryParse` method.

```csharp
public readonly record struct ProductCode(string Value)
{
    public static bool TryParse(string? value, out ProductCode productCode)
    {
        if (!string.IsNullOrWhiteSpace(value) && value.StartsWith("PRD-"))
        {
            productCode = new ProductCode(value);
            return true;
        }

        productCode = default;
        return false;
    }
}

app.MapGet("/api/products/{code}", (ProductCode code) =>
{
    return Results.Ok(new { code.Value });
});
```

This keeps parsing logic close to the value object and avoids repeating parsing code inside endpoints.

### Custom Binding with BindAsync

Minimal APIs can use `BindAsync` for more advanced binding scenarios.

```csharp
public sealed class PagingOptions
{
    public int Page { get; init; }
    public int PageSize { get; init; }

    public static ValueTask<PagingOptions?> BindAsync(HttpContext context)
    {
        int.TryParse(context.Request.Query["page"], out var page);
        int.TryParse(context.Request.Query["pageSize"], out var pageSize);

        return ValueTask.FromResult<PagingOptions?>(new PagingOptions
        {
            Page = page <= 0 ? 1 : page,
            PageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100)
        });
    }
}

app.MapGet("/api/products", (PagingOptions paging) =>
{
    return Results.Ok(paging);
});
```

`BindAsync` is useful when binding requires multiple request values or custom normalization. It should remain simple and predictable. Complex business logic should stay in application services, not in binders.

### Grouping Parameters with AsParameters in Minimal APIs

Minimal APIs can group multiple parameters into one object using `[AsParameters]`.

```csharp
public sealed class SearchProductsRequest
{
    [FromQuery]
    public string? Search { get; init; }

    [FromQuery]
    public int Page { get; init; } = 1;

    [FromQuery]
    public int PageSize { get; init; } = 20;

    [FromHeader(Name = "X-Correlation-Id")]
    public string? CorrelationId { get; init; }
}

app.MapGet("/api/products", ([AsParameters] SearchProductsRequest request) =>
{
    return Results.Ok(request);
});
```

This is helpful when a Minimal API handler has too many parameters. It can improve readability without forcing all values into the body.

### Model Validation and Binding

Binding answers the question: “Can the request data be converted into .NET parameters?”

Validation answers the question: “Are the converted values acceptable for the application?”

Example DTO:

```csharp
public sealed class CreateProductRequest
{
    [Required]
    [StringLength(100)]
    public string Name { get; init; } = string.Empty;

    [Range(0.01, 1_000_000)]
    public decimal Price { get; init; }
}
```

Controller with `[ApiController]`:

```csharp
[ApiController]
[Route("api/products")]
public sealed class ProductsController : ControllerBase
{
    [HttpPost]
    public IActionResult Create([FromBody] CreateProductRequest request)
    {
        return Ok(request);
    }
}
```

With `[ApiController]`, invalid model state commonly results in an automatic `400 Bad Request` response before the action body executes.

Minimal APIs do not behave exactly like controller model validation by default. In production Minimal APIs, validation is usually handled through endpoint filters, manual validation, FluentValidation, or a custom pipeline.

### Binding Failure Behavior

Binding can fail when values are missing, malformed, or have the wrong content type.

Examples:

```http
GET /api/products/not-an-int
```

If the endpoint expects `int id`, binding fails.

```http
POST /api/products
Content-Type: application/json

{ invalid json }
```

If the endpoint expects a JSON body, deserialization fails.

Common results include `400 Bad Request` for invalid values or invalid JSON, and `415 Unsupported Media Type` when the request content type is wrong for body binding.

Good APIs should return consistent error responses. For public APIs, consider standard error shapes such as validation problem responses or Problem Details.

### Overposting and DTO Safety

Overposting happens when a client sends fields that should not be controlled by the client, and the server accidentally binds them.

Risky DTO:

```csharp
public sealed class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public bool IsAdmin { get; set; }
}

[HttpPost("api/users")]
public IActionResult CreateUser([FromBody] User user)
{
    // Dangerous if the client can set IsAdmin.
    return Ok(user);
}
```

Safer request DTO:

```csharp
public sealed class CreateUserRequest
{
    public string Email { get; init; } = string.Empty;
}

[HttpPost("api/users")]
public IActionResult CreateUser([FromBody] CreateUserRequest request)
{
    var user = new User
    {
        Email = request.Email,
        IsAdmin = false
    };

    return Ok(user);
}
```

Do not bind directly to database entities for create and update APIs. Use request DTOs that expose only the fields the client is allowed to send.

### Choosing the Correct Binding Source

A practical design guide:

| Data | Recommended Source | Example |
|---|---|---|
| Resource identity | Route | `/api/products/{id}` |
| Optional filters | Query string | `?category=books&page=2` |
| Create/update command | Body | JSON DTO |
| File upload | Form | `multipart/form-data` with `IFormFile` |
| Request metadata | Header | `X-Correlation-Id` |
| Application dependency | Services | `IProductService` |

Example of a well-separated endpoint:

```csharp
[HttpPut("api/products/{id:int}")]
public async Task<IActionResult> UpdateProduct(
    [FromRoute] int id,
    [FromQuery] bool publishImmediately,
    [FromHeader(Name = "X-Correlation-Id")] string? correlationId,
    [FromBody] UpdateProductRequest request,
    [FromServices] IProductService productService)
{
    await productService.UpdateAsync(id, request, publishImmediately, correlationId);
    return NoContent();
}
```

Each value comes from a source that matches its purpose.

### Common Mistakes

Common mistakes include:

- Relying on implicit binding when explicit attributes would make the API clearer.
- Putting optional filters in route segments instead of query string parameters.
- Binding directly to EF Core entities or domain entities.
- Using `[FromBody]` for multiple parameters instead of creating one request DTO.
- Expecting JSON body binding to work with `multipart/form-data` requests.
- Trusting custom headers without validation or trusted infrastructure.
- Putting business logic inside custom binders.
- Forgetting that Minimal API and controller binding rules are similar but not identical.
- Ignoring model validation and assuming successful binding means valid input.
- Using services from request data accidentally because a Minimal API parameter type is registered in DI.

### Best Practices

Use explicit binding attributes when endpoint readability matters.

```csharp
public IActionResult Get(
    [FromRoute] int id,
    [FromQuery] bool includeDetails)
{
    return Ok();
}
```

Use request DTOs instead of domain entities.

```csharp
public sealed class UpdateProductPriceRequest
{
    public decimal Price { get; init; }
}
```

Keep route parameters focused on identity.

```text
/api/products/{id}
/api/customers/{customerId}/orders/{orderId}
```

Keep query parameters focused on filtering and optional behavior.

```text
/api/products?search=mouse&page=1&pageSize=20
```

Use body parameters for complex commands.

```csharp
[FromBody] CreateOrderRequest request
```

Use form parameters for file uploads and HTML form posts.

```csharp
[FromForm] IFormFile file
```

Use headers for cross-cutting metadata.

```csharp
[FromHeader(Name = "X-Correlation-Id")] string? correlationId
```

Use dependency injection for services, not request data.

```csharp
[FromServices] IProductService productService
```

Validate after binding. Binding converts data; validation checks whether the data is acceptable.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-beginner-q01 -->
#### Beginner Q01: What is parameter binding in ASP.NET Core?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Parameter binding is the process where ASP.NET Core reads data from an HTTP request and converts it into strongly typed C# parameters for a controller action or Minimal API route handler.

The data can come from several sources, including route values, query string values, the request body, form fields, headers, uploaded files, and dependency injection services. For example, an `id` can be bound from `/api/products/{id}`, a search term can be bound from `?search=keyboard`, a JSON DTO can be bound from the body, and a repository can be resolved from the DI container.

Parameter binding reduces manual parsing and makes endpoint code cleaner. Instead of reading strings from `HttpContext.Request` and converting them manually, developers can declare the parameters they need and let the framework bind them.

##### Key Points to Mention

- Converts HTTP request data into C# parameters.
- Works in controllers and Minimal APIs.
- Supports route, query, body, form, header, and services.
- Reduces manual parsing of `HttpContext.Request`.
- Binding is separate from validation.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-beginner-q01 -->

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-beginner-q02 -->
#### Beginner Q02: What is the difference between `[FromRoute]` and `[FromQuery]`?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`[FromRoute]` binds a value from the route template. It is usually used for resource identifiers.

```csharp
[HttpGet("api/products/{id:int}")]
public IActionResult Get([FromRoute] int id)
{
    return Ok(id);
}
```

This matches a request like:

```http
GET /api/products/10
```

`[FromQuery]` binds a value from the query string. It is usually used for optional filters, paging, sorting, and search terms.

```csharp
[HttpGet("api/products")]
public IActionResult Search([FromQuery] string? search, [FromQuery] int page = 1)
{
    return Ok(new { search, page });
}
```

This matches a request like:

```http
GET /api/products?search=keyboard&page=2
```

A good rule is: use route values for identity and query string values for optional filtering or behavior.

##### Key Points to Mention

- `[FromRoute]` reads from URL path placeholders.
- `[FromQuery]` reads from the query string after `?`.
- Route values are usually resource identifiers.
- Query values are usually filters, pagination, sorting, and search options.
- Using the right source makes APIs easier to understand.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-beginner-q02 -->

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-beginner-q03 -->
#### Beginner Q03: When should you use `[FromBody]`?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`[FromBody]` should be used when the endpoint needs to read a complex request payload from the request body, usually JSON. It is common for create and update operations.

```csharp
public sealed class CreateProductRequest
{
    public string Name { get; init; } = string.Empty;
    public decimal Price { get; init; }
}

[HttpPost("api/products")]
public IActionResult Create([FromBody] CreateProductRequest request)
{
    return Ok(request);
}
```

Example request:

```http
POST /api/products
Content-Type: application/json

{
  "name": "Keyboard",
  "price": 99
}
```

`[FromBody]` is not ideal for simple resource identifiers or optional filters. Those usually belong in the route or query string.

##### Key Points to Mention

- Used for request body payloads, usually JSON.
- Common for `POST`, `PUT`, and `PATCH`.
- Best used with request DTOs.
- Route identity should usually stay in the route.
- Optional filters should usually stay in the query string.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-beginner-q03 -->

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-beginner-q04 -->
#### Beginner Q04: What is `[FromHeader]` used for?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

`[FromHeader]` binds a value from an HTTP request header. It is commonly used for request metadata such as correlation IDs, tenant IDs, language preferences, API version hints, or conditional request headers.

```csharp
[HttpGet("api/orders/{id:int}")]
public IActionResult GetOrder(
    [FromRoute] int id,
    [FromHeader(Name = "X-Correlation-Id")] string? correlationId)
{
    return Ok(new { id, correlationId });
}
```

Headers should generally be used for metadata, not normal business data. For example, a product name should not be sent in a custom header; it should be in the body or query string depending on the operation.

##### Key Points to Mention

- Reads values from HTTP headers.
- Useful for request metadata.
- Common examples include correlation IDs and tenant IDs.
- Header names can be specified with `Name`.
- Do not use headers as a replacement for body or query data.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-beginner-q04 -->

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-beginner-q05 -->
#### Beginner Q05: What is `[FromServices]` used for?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

`[FromServices]` tells ASP.NET Core to resolve a parameter from the dependency injection container instead of from the HTTP request.

```csharp
[HttpGet("api/products/{id:int}")]
public async Task<IActionResult> Get(
    [FromRoute] int id,
    [FromServices] IProductService productService)
{
    var product = await productService.GetByIdAsync(id);
    return product is null ? NotFound() : Ok(product);
}
```

In controllers, constructor injection is usually preferred for services used by many actions. `[FromServices]` is helpful for dependencies used by one specific action. In Minimal APIs, service parameters are often inferred automatically when the type is registered in DI.

##### Key Points to Mention

- Resolves dependencies from the DI container.
- It is not request data.
- Useful for action-specific services.
- Constructor injection is common in controllers.
- Minimal APIs can often infer services by type.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-beginner-q05 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q01 -->
#### Intermediate Q01: How does `[ApiController]` affect parameter binding in controller APIs?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

`[ApiController]` adds API-specific conventions to controller behavior. One important feature is binding source inference. For example, route parameters can be inferred from route templates, and complex action parameters are commonly inferred from the request body.

```csharp
[ApiController]
[Route("api/products")]
public sealed class ProductsController : ControllerBase
{
    [HttpPost("{id:int}")]
    public IActionResult Update(int id, UpdateProductRequest request)
    {
        return Ok(new { id, request.Name });
    }
}
```

In this case, `id` can be inferred from the route and `request` can be inferred from the body. `[ApiController]` also commonly enables automatic `400 Bad Request` responses when model validation fails.

However, many teams still prefer explicit attributes like `[FromRoute]` and `[FromBody]` because they make the endpoint contract easier to read.

##### Key Points to Mention

- `[ApiController]` enables API-focused conventions.
- It supports binding source inference.
- Complex types are commonly inferred from body.
- Invalid model state can automatically return `400 Bad Request`.
- Explicit attributes are still useful for clarity.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q01 -->

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q02 -->
#### Intermediate Q02: Why should an API usually have only one `[FromBody]` parameter?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

The request body is a stream. It is normally read and deserialized into one object for an endpoint. Having multiple `[FromBody]` parameters creates ambiguity and is not a good API contract.

Bad design:

```csharp
[HttpPost("api/orders")]
public IActionResult Create(
    [FromBody] CustomerDto customer,
    [FromBody] OrderDto order)
{
    return Ok();
}
```

Better design:

```csharp
public sealed class CreateOrderRequest
{
    public CustomerDto Customer { get; init; } = new();
    public OrderDto Order { get; init; } = new();
}

[HttpPost("api/orders")]
public IActionResult Create([FromBody] CreateOrderRequest request)
{
    return Ok();
}
```

A single request DTO gives the endpoint a clear input contract, improves validation, and avoids stream-reading problems.

##### Key Points to Mention

- The request body is a stream.
- Multiple body parameters are ambiguous.
- Use one request DTO for complex input.
- A DTO improves validation and documentation.
- Route/query/header parameters can still be separate from the body DTO.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q02 -->

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q03 -->
#### Intermediate Q03: How are query parameters bound to complex objects?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A complex object can be bound from query string values when `[FromQuery]` is used. The framework maps query string keys to public properties on the object.

```csharp
public sealed class ProductSearchQuery
{
    public string? Search { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Sort { get; init; }
}

[HttpGet("api/products")]
public IActionResult Search([FromQuery] ProductSearchQuery query)
{
    return Ok(query);
}
```

Request:

```http
GET /api/products?search=keyboard&page=2&pageSize=10&sort=price_desc
```

This approach is cleaner than having many separate action parameters. It is especially useful for search and listing endpoints.

##### Key Points to Mention

- `[FromQuery]` can bind a complex query DTO.
- Query keys map to object properties.
- Useful for search, filtering, sorting, and paging.
- Keeps method signatures smaller.
- Query DTOs should represent optional request options, not command body data.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q03 -->

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q04 -->
#### Intermediate Q04: What is the difference between `[FromForm]` and `[FromBody]`?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

`[FromBody]` usually reads and deserializes a JSON request body into an object. It is common for API create and update operations.

`[FromForm]` reads posted form fields, usually from `application/x-www-form-urlencoded` or `multipart/form-data`. It is common for traditional form posts and file uploads.

JSON body example:

```csharp
[HttpPost("api/products")]
public IActionResult Create([FromBody] CreateProductRequest request)
{
    return Ok(request);
}
```

File upload form example:

```csharp
[HttpPost("api/users/avatar")]
public async Task<IActionResult> Upload([FromForm] IFormFile avatar)
{
    await using var stream = System.IO.File.Create($"uploads/{avatar.FileName}");
    await avatar.CopyToAsync(stream);
    return Ok();
}
```

The correct choice depends on the request content type and use case. Normal JSON APIs usually use `[FromBody]`; file uploads usually use `[FromForm]`.

##### Key Points to Mention

- `[FromBody]` is commonly JSON deserialization.
- `[FromForm]` reads form fields and files.
- File uploads commonly use `multipart/form-data`.
- A request content type must match the expected binding source.
- Do not treat JSON body and multipart form data as the same thing.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q04 -->

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q05 -->
#### Intermediate Q05: What is overposting, and how is it related to model binding?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Overposting happens when an API binds more properties than the client should be allowed to set. This often occurs when an endpoint binds directly to an entity or a model with sensitive fields.

Risky example:

```csharp
public sealed class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public bool IsAdmin { get; set; }
}

[HttpPost("api/users")]
public IActionResult Create([FromBody] User user)
{
    return Ok(user);
}
```

A malicious client could send `"isAdmin": true`. A safer design uses a request DTO with only allowed input fields.

```csharp
public sealed class CreateUserRequest
{
    public string Email { get; init; } = string.Empty;
}
```

The server then maps the request DTO to a domain object and sets sensitive values internally.

##### Key Points to Mention

- Overposting means binding fields the client should not control.
- It often happens when binding directly to entities.
- Use request DTOs to limit client-controlled fields.
- Map DTOs to domain models explicitly.
- This is both a security and maintainability concern.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q05 -->

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q06 -->
#### Intermediate Q06: How does Minimal API parameter binding differ from controller parameter binding?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Both controllers and Minimal APIs support binding from route, query, body, form, header, and services, but Minimal APIs use route handler parameters directly and have their own binding precedence rules.

In controllers, services are commonly injected through constructors, and `[ApiController]` provides controller-specific conventions such as automatic model state responses.

In Minimal APIs, service parameters are often inferred by type if the type is registered in dependency injection. Minimal APIs also support features such as `[AsParameters]`, `BindAsync`, and simple `TryParse`-based binding for custom parameter types.

Controller example:

```csharp
[HttpGet("{id:int}")]
public IActionResult Get([FromRoute] int id, [FromServices] IProductService service)
{
    return Ok(service.GetById(id));
}
```

Minimal API example:

```csharp
app.MapGet("/api/products/{id:int}", (int id, IProductService service) =>
{
    return Results.Ok(service.GetById(id));
});
```

##### Key Points to Mention

- Both approaches support similar binding sources.
- Controllers use action parameters and controller conventions.
- Minimal APIs use route handler parameters.
- Minimal APIs infer DI services by registered type.
- `[AsParameters]`, `TryParse`, and `BindAsync` are important Minimal API features.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-intermediate-q06 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q01 -->
#### Advanced Q01: Explain Minimal API binding precedence.
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Minimal APIs use precedence rules to decide where each route handler parameter comes from. A practical explanation is:

1. Explicit binding attributes win first, such as `[FromRoute]`, `[FromQuery]`, `[FromHeader]`, `[FromBody]`, `[FromForm]`, `[FromServices]`, and `[AsParameters]`.
2. Special framework types are bound directly, such as `HttpContext`, `HttpRequest`, `HttpResponse`, `ClaimsPrincipal`, `CancellationToken`, `IFormFile`, `Stream`, and `PipeReader`.
3. Custom binding methods such as `BindAsync` can be used.
4. Simple string-like or parseable types can bind from route or query using parsing.
5. Registered service types can be resolved from dependency injection.
6. Remaining complex parameters can be inferred from the request body when body binding is allowed.

This matters because a parameter may not come from the source the developer expects. For example, if a type is registered in DI, a Minimal API handler may resolve it as a service rather than treating it as body data. Explicit attributes prevent ambiguity.

##### Key Points to Mention

- Explicit attributes have the highest priority.
- Special framework types are bound automatically.
- `BindAsync` and `TryParse` support custom binding.
- DI service resolution can affect binding source selection.
- Explicit binding is useful for avoiding surprising behavior.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q01 -->

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q02 -->
#### Advanced Q02: How would you design binding for an endpoint that needs route, query, header, body, and service values?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

The best design is to place each value in the source that matches its purpose:

- Resource identity in the route.
- Optional behavior in the query string.
- Request metadata in headers.
- Complex command data in the body.
- Application dependencies in services.

Example:

```csharp
[HttpPut("api/products/{id:int}")]
public async Task<IActionResult> UpdateProduct(
    [FromRoute] int id,
    [FromQuery] bool publishImmediately,
    [FromHeader(Name = "X-Correlation-Id")] string? correlationId,
    [FromBody] UpdateProductRequest request,
    [FromServices] IProductService productService)
{
    await productService.UpdateAsync(id, request, publishImmediately, correlationId);
    return NoContent();
}
```

This design makes the API contract clear. The route identifies the product, the query string controls optional behavior, the header carries cross-cutting tracing metadata, the body contains update data, and the service performs the application operation.

##### Key Points to Mention

- Match binding source to data purpose.
- Avoid putting everything in the body.
- Avoid using headers for normal business payload.
- Keep services separate from request data.
- Explicit attributes make the contract easy to review.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q02 -->

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q03 -->
#### Advanced Q03: When would you use custom binding with `TryParse` or `BindAsync`?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Use `TryParse` when a custom value object can be created from a single string value, such as a route or query parameter.

```csharp
public readonly record struct ProductCode(string Value)
{
    public static bool TryParse(string? value, out ProductCode code)
    {
        if (!string.IsNullOrWhiteSpace(value) && value.StartsWith("PRD-"))
        {
            code = new ProductCode(value);
            return true;
        }

        code = default;
        return false;
    }
}
```

Use `BindAsync` when binding requires access to `HttpContext` or multiple request values.

```csharp
public sealed class RequestMetadata
{
    public string? CorrelationId { get; init; }
    public string? TenantId { get; init; }

    public static ValueTask<RequestMetadata?> BindAsync(HttpContext context)
    {
        return ValueTask.FromResult<RequestMetadata?>(new RequestMetadata
        {
            CorrelationId = context.Request.Headers["X-Correlation-Id"],
            TenantId = context.Request.Headers["X-Tenant-Id"]
        });
    }
}
```

Custom binding should be used for request-shaping logic, not business decisions. Complex validation and business rules should remain in validation layers or application services.

##### Key Points to Mention

- `TryParse` is good for single-value custom types.
- `BindAsync` is good when `HttpContext` or multiple values are needed.
- Custom binding can improve endpoint readability.
- Avoid putting business logic into binders.
- Keep custom binders predictable and testable.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q03 -->

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q04 -->
#### Advanced Q04: How do binding and validation differ, and why does the distinction matter?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Binding converts request data into .NET values. Validation checks whether those values are acceptable for the application.

For example, binding can convert the JSON value `"price": -10` into a `decimal Price` property successfully. But validation should reject it because a negative product price is invalid.

```csharp
public sealed class CreateProductRequest
{
    [Required]
    public string Name { get; init; } = string.Empty;

    [Range(0.01, 1_000_000)]
    public decimal Price { get; init; }
}
```

Binding failure examples include an invalid integer route value or malformed JSON. Validation failure examples include missing required fields, invalid ranges, invalid string lengths, or cross-field business rules.

This distinction matters because a successfully bound object is not necessarily valid. Production APIs need both correct binding and explicit validation.

##### Key Points to Mention

- Binding is conversion from HTTP data to .NET types.
- Validation checks rules and constraints.
- Successful binding does not guarantee valid data.
- Controllers with `[ApiController]` can automatically return validation errors.
- Minimal APIs commonly need explicit validation strategy or endpoint filters.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q04 -->

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q05 -->
#### Advanced Q05: What security concerns should you consider with parameter binding?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Several security concerns are related to parameter binding.

First, overposting can occur if the API binds directly to domain or EF Core entities. A client may set properties that should be server-controlled, such as `IsAdmin`, `Status`, or `CreatedBy`.

Second, custom headers should not be blindly trusted. Headers such as tenant IDs, user IDs, or roles should be validated or derived from authenticated claims or trusted infrastructure.

Third, file uploads through form binding require careful validation. The server should check file size, extension, content type, storage path, authorization, and malware scanning requirements. It should not trust the original uploaded file name.

Fourth, model binding does not replace authorization or business validation. Binding only maps input; it does not prove that the caller is allowed to perform the operation.

##### Key Points to Mention

- Avoid binding directly to entities.
- Use request DTOs to prevent overposting.
- Validate or derive sensitive values instead of trusting headers.
- Treat file uploads as high-risk input.
- Binding is not authorization or business validation.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q05 -->

<!-- question:start:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q06 -->
#### Advanced Q06: How would you troubleshoot unexpected `400 Bad Request` or `415 Unsupported Media Type` responses caused by binding?
<!-- question-id:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

For unexpected `400 Bad Request`, first check whether route or query values can be converted to the target C# types. For example, `/api/products/abc` cannot bind to `int id`. Also check JSON syntax, required body fields, validation attributes, and whether `[ApiController]` is automatically returning validation errors.

For `415 Unsupported Media Type`, check the `Content-Type` header. If an endpoint expects JSON body binding, the request should usually send `Content-Type: application/json`. If the endpoint expects form data or file upload binding, the request should use the correct form content type such as `multipart/form-data`.

Also confirm the binding attributes. A value expected from query but marked `[FromBody]`, or a file expected from form but sent as JSON, can cause confusing failures.

A practical troubleshooting approach is:

1. Check route template and actual URL.
2. Check query string names and value formats.
3. Check `Content-Type`.
4. Check JSON shape and property names.
5. Check validation errors.
6. Check whether the endpoint is a controller or Minimal API because binding rules differ slightly.

##### Key Points to Mention

- `400` often means conversion, JSON, or validation failure.
- `415` often means wrong `Content-Type` for body binding.
- Check route constraints and query value formats.
- Check JSON shape and property names.
- Check explicit binding attributes and framework conventions.

<!-- question:end:parameter-binding-from-route-query-string-body-form-header-and-services-advanced-q06 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
