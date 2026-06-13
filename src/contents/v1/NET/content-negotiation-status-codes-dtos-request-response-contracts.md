---
id: content-negotiation-status-codes-dtos-request-response-contracts
topic: API design and implementation
subtopic: Content negotiation, status codes and request/response contracts
category: .NET
---


## Overview

Content negotiation, status codes, DTOs, and request/response contracts are core parts of building reliable HTTP APIs in C# and ASP.NET Core.

In a Web API, the server and client communicate through a contract. That contract includes the request shape, response shape, media type, validation rules, status codes, error format, and behavioral expectations. A well-designed API contract makes the system easier to consume, test, document, version, and maintain.

This topic matters because API bugs are often not caused by business logic alone. They often come from unclear response codes, leaking database entities directly to clients, inconsistent error formats, undocumented response bodies, breaking DTO changes, incorrect `Content-Type` or `Accept` handling, and endpoints that return `200 OK` for every scenario.

In ASP.NET Core, this topic appears in controller-based APIs, Minimal APIs, OpenAPI/Swagger documentation, integration tests, frontend-backend communication, microservice boundaries, public APIs, internal APIs, and versioned enterprise systems.

For interviews, this is important because it tests whether a developer understands practical API design rather than only knowing how to create a controller action. Strong candidates can explain how HTTP semantics, ASP.NET Core return types, DTO design, validation, `ProblemDetails`, and content negotiation work together to create predictable and production-ready APIs.

## Core Concepts

### API Contracts

An API contract defines what a client can send to an API and what the API promises to return.

A request/response contract usually includes:

- Endpoint path and HTTP method
- Request headers
- Request body schema
- Query string parameters
- Route parameters
- Required and optional fields
- Validation rules
- Response body schema
- Success status codes
- Error status codes
- Error response format
- Supported media types
- Versioning and compatibility expectations

Example contract:

```http
POST /api/products
Content-Type: application/json
Accept: application/json
```

Request body:

```json
{
  "name": "Keyboard",
  "price": 49.99
}
```

Successful response:

```http
201 Created
Location: /api/products/123
Content-Type: application/json
```

```json
{
  "id": 123,
  "name": "Keyboard",
  "price": 49.99
}
```

Error response:

```http
400 Bad Request
Content-Type: application/problem+json
```

```json
{
  "type": "https://example.com/errors/validation",
  "title": "Validation failed",
  "status": 400,
  "errors": {
    "name": ["Name is required."]
  }
}
```

The contract is more than just C# classes. It is the full agreement between the API and the consumer.

### DTOs

DTO stands for Data Transfer Object.

A DTO is an object designed to carry data across a boundary, such as from an API client to a server or from a server to a client.

DTOs are commonly used to avoid exposing domain entities, database entities, or internal implementation details directly through API responses.

Example domain entity:

```csharp
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal Cost { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
```

Example response DTO:

```csharp
public sealed record ProductResponseDto(
    int Id,
    string Name,
    decimal Price
);
```

Example create request DTO:

```csharp
public sealed record CreateProductRequestDto(
    string Name,
    decimal Price
);
```

The response DTO hides internal fields such as `Cost`, `IsDeleted`, and `CreatedAtUtc`. The create request DTO also prevents the client from supplying server-owned fields such as `Id`.

### Why DTOs Matter

DTOs help keep API contracts stable and intentional.

Without DTOs, an API may accidentally expose internal fields:

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<Product>> GetById(int id)
{
    var product = await db.Products.FindAsync(id);

    if (product is null)
    {
        return NotFound();
    }

    return product;
}
```

This looks simple, but it couples the public API contract to the database model. If the entity changes, the API response may change unexpectedly.

A better approach is to map the entity to a response DTO:

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<ProductResponseDto>> GetById(int id)
{
    var product = await db.Products.FindAsync(id);

    if (product is null)
    {
        return NotFound();
    }

    return new ProductResponseDto(
        product.Id,
        product.Name,
        product.Price
    );
}
```

DTOs are useful for:

- Preventing over-posting attacks
- Hiding sensitive fields
- Avoiding accidental breaking changes
- Separating API design from database design
- Returning only data needed by the client
- Supporting different shapes for create, update, list, detail, and search operations

### Request DTOs vs Response DTOs

Request DTOs and response DTOs should often be different.

A create request usually contains fields the client is allowed to submit:

```csharp
public sealed record CreateCustomerRequest(
    string FullName,
    string Email
);
```

A response often contains server-generated fields:

```csharp
public sealed record CustomerResponse(
    Guid Id,
    string FullName,
    string Email,
    DateTime CreatedAtUtc
);
```

An update request may contain a different shape:

```csharp
public sealed record UpdateCustomerRequest(
    string FullName,
    string Email
);
```

A list response may contain less detail than a detail response:

```csharp
public sealed record CustomerListItemResponse(
    Guid Id,
    string FullName
);

public sealed record CustomerDetailResponse(
    Guid Id,
    string FullName,
    string Email,
    DateTime CreatedAtUtc,
    IReadOnlyList<OrderSummaryResponse> RecentOrders
);
```

A common mistake is to reuse one DTO for every operation. This often leads to confusing optional properties, weak validation, and unclear contracts.

### Content Negotiation

Content negotiation is the process where the client and server agree on the response format.

The client uses the `Accept` header to tell the server what response media types it can handle:

```http
Accept: application/json
```

The server uses the response `Content-Type` header to tell the client what media type it actually returned:

```http
Content-Type: application/json; charset=utf-8
```

In ASP.NET Core, content negotiation is commonly handled by `ObjectResult` and output formatters. When a controller returns `Ok(dto)` or an object wrapped in `ActionResult<T>`, ASP.NET Core chooses an output formatter that can serialize the response.

Example:

```csharp
[HttpGet("{id:int}")]
public ActionResult<ProductResponseDto> GetById(int id)
{
    var product = productService.GetById(id);

    if (product is null)
    {
        return NotFound();
    }

    return Ok(product);
}
```

If JSON is selected, the response body is serialized as JSON.

### Accept Header vs Content-Type Header

`Accept` and `Content-Type` are often confused.

`Accept` describes the response format the client wants:

```http
Accept: application/json
```

`Content-Type` describes the format of the request body being sent by the client:

```http
Content-Type: application/json
```

For a `POST` request with a JSON body, both may appear:

```http
POST /api/products
Accept: application/json
Content-Type: application/json
```

The API uses `Content-Type` to understand how to read the request body. It uses `Accept` to decide how to format the response.

### Input Formatters and Output Formatters

ASP.NET Core uses formatters to read request bodies and write response bodies.

Input formatters deserialize request bodies into C# objects. For example, they can read JSON from the request body and create a DTO.

Output formatters serialize C# objects into response bodies. For example, they can convert a DTO into JSON.

Example:

```csharp
builder.Services.AddControllers(options =>
{
    options.ReturnHttpNotAcceptable = true;
});
```

With `ReturnHttpNotAcceptable = true`, the API can return `406 Not Acceptable` when the client asks for a response format that the API cannot produce.

Example request:

```http
GET /api/products/1
Accept: application/xml
```

If XML output is not configured and `ReturnHttpNotAcceptable` is enabled, the API may return:

```http
406 Not Acceptable
```

### Consumes and Produces Metadata

ASP.NET Core provides attributes that document and constrain request and response formats.

`[Consumes]` describes the supported request body media type:

```csharp
[HttpPost]
[Consumes("application/json")]
public async Task<ActionResult<ProductResponseDto>> Create(CreateProductRequestDto request)
{
    // ...
}
```

`[Produces]` describes the response media type:

```csharp
[Produces("application/json")]
[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
}
```

`[ProducesResponseType]` documents possible response status codes and response body types:

```csharp
[HttpGet("{id:int}")]
[ProducesResponseType<ProductResponseDto>(StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public async Task<ActionResult<ProductResponseDto>> GetById(int id)
{
    var product = await productService.GetByIdAsync(id);

    if (product is null)
    {
        return NotFound();
    }

    return Ok(product);
}
```

These attributes improve generated OpenAPI documentation and help clients understand the API contract.

### Status Codes

HTTP status codes communicate the result of a request.

A good API should use status codes intentionally instead of returning `200 OK` for every scenario.

Common success status codes:

| Status Code | Meaning | Common Usage |
|---|---|---|
| `200 OK` | Request succeeded | Returning a resource, search result, or operation result |
| `201 Created` | Resource was created | `POST` that creates a new resource |
| `202 Accepted` | Request accepted but not completed yet | Long-running asynchronous processing |
| `204 No Content` | Request succeeded with no response body | Successful delete or update with no body |

Common client error status codes:

| Status Code | Meaning | Common Usage |
|---|---|---|
| `400 Bad Request` | Invalid request | Invalid JSON, invalid model binding, validation failure |
| `401 Unauthorized` | Authentication required or failed | Missing or invalid authentication |
| `403 Forbidden` | Authenticated but not allowed | User lacks permission |
| `404 Not Found` | Resource does not exist | Missing entity by id |
| `409 Conflict` | Request conflicts with current state | Duplicate resource, concurrency conflict |
| `415 Unsupported Media Type` | Request body format unsupported | Wrong `Content-Type` |
| `422 Unprocessable Entity` | Request is syntactically valid but semantically invalid | Business validation errors, if the API chooses this convention |

Common server error status codes:

| Status Code | Meaning | Common Usage |
|---|---|---|
| `500 Internal Server Error` | Unexpected server error | Unhandled exception or unexpected failure |
| `503 Service Unavailable` | Service temporarily unavailable | Dependency outage, maintenance, overload |

The exact status-code convention should be consistent across the API.

### Choosing Status Codes for Common API Operations

For `GET` by id:

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<ProductResponseDto>> GetById(int id)
{
    var product = await productService.GetByIdAsync(id);

    if (product is null)
    {
        return NotFound();
    }

    return Ok(product);
}
```

Common responses:

- `200 OK` when found
- `404 Not Found` when not found

For `POST` that creates a resource:

```csharp
[HttpPost]
public async Task<ActionResult<ProductResponseDto>> Create(CreateProductRequestDto request)
{
    var product = await productService.CreateAsync(request);

    var response = new ProductResponseDto(
        product.Id,
        product.Name,
        product.Price
    );

    return CreatedAtAction(
        nameof(GetById),
        new { id = response.Id },
        response
    );
}
```

Common response:

- `201 Created`
- `Location` header points to the new resource
- Response body contains the created resource or a representation of it

For `PUT` update:

```csharp
[HttpPut("{id:int}")]
public async Task<IActionResult> Update(int id, UpdateProductRequestDto request)
{
    var updated = await productService.UpdateAsync(id, request);

    if (!updated)
    {
        return NotFound();
    }

    return NoContent();
}
```

Common responses:

- `204 No Content` when update succeeds and no body is returned
- `200 OK` when the updated resource is returned
- `404 Not Found` when the resource does not exist
- `409 Conflict` when there is a concurrency conflict

For `DELETE`:

```csharp
[HttpDelete("{id:int}")]
public async Task<IActionResult> Delete(int id)
{
    var deleted = await productService.DeleteAsync(id);

    if (!deleted)
    {
        return NotFound();
    }

    return NoContent();
}
```

Common responses:

- `204 No Content` when delete succeeds
- `404 Not Found` when the resource does not exist

### Controller Return Types

ASP.NET Core supports multiple return type styles for controller actions.

A specific type is simple when there is only one possible response:

```csharp
[HttpGet]
public async Task<List<ProductResponseDto>> GetAll()
{
    return await productService.GetAllAsync();
}
```

`IActionResult` is flexible when there are multiple possible response types:

```csharp
[HttpGet("{id:int}")]
public async Task<IActionResult> GetById(int id)
{
    var product = await productService.GetByIdAsync(id);

    if (product is null)
    {
        return NotFound();
    }

    return Ok(product);
}
```

`ActionResult<T>` is often a good choice because it gives both strong typing and status-code flexibility:

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<ProductResponseDto>> GetById(int id)
{
    var product = await productService.GetByIdAsync(id);

    if (product is null)
    {
        return NotFound();
    }

    return Ok(product);
}
```

For interviews, `ActionResult<T>` is usually a strong default for controller-based APIs because it communicates the success response type while still allowing error responses.

### Minimal API Typed Results

Minimal APIs can use `Results`, `TypedResults`, and typed result unions.

Example:

```csharp
app.MapGet("/api/products/{id:int}",
    async Task<Results<Ok<ProductResponseDto>, NotFound>> (int id, IProductService productService) =>
    {
        var product = await productService.GetByIdAsync(id);

        return product is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(product);
    });
```

Typed result unions are useful because the endpoint signature documents possible outcomes in code.

This improves readability, testing, and OpenAPI metadata.

### Validation and Error Contracts

Validation is part of the API contract.

A request DTO can use data annotations:

```csharp
public sealed class CreateProductRequestDto
{
    [Required]
    [StringLength(100)]
    public string Name { get; init; } = string.Empty;

    [Range(0.01, 999999)]
    public decimal Price { get; init; }
}
```

With `[ApiController]`, ASP.NET Core automatically returns a `400 Bad Request` response when model validation fails.

Example response shape:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "Name": ["The Name field is required."]
  }
}
```

This is typically represented by `ValidationProblemDetails`.

A consistent error contract matters because frontend applications and API clients need predictable error handling.

### ProblemDetails

`ProblemDetails` is a standard structure for machine-readable error responses.

A typical problem response includes:

- `type`
- `title`
- `status`
- `detail`
- `instance`
- optional extension fields

Example:

```csharp
return Problem(
    title: "Unable to create product",
    detail: "A product with the same name already exists.",
    statusCode: StatusCodes.Status409Conflict
);
```

Example response:

```json
{
  "type": "about:blank",
  "title": "Unable to create product",
  "status": 409,
  "detail": "A product with the same name already exists."
}
```

Use `ProblemDetails` for consistent API errors instead of inventing many unrelated error formats.

### DTO Validation vs Domain Validation

DTO validation and domain validation are related but not the same.

DTO validation checks whether the incoming request shape is acceptable. Examples:

- Required fields
- String length
- Numeric range
- Valid email format
- Valid enum value

Domain validation checks business rules. Examples:

- Product name must be unique
- Order cannot be cancelled after shipment
- Customer cannot exceed credit limit
- Booking date must be available

Example:

```csharp
public async Task<ActionResult<ProductResponseDto>> Create(CreateProductRequestDto request)
{
    if (await productService.ExistsByNameAsync(request.Name))
    {
        return Conflict(new ProblemDetails
        {
            Title = "Product already exists",
            Status = StatusCodes.Status409Conflict,
            Detail = "Another product already uses the same name."
        });
    }

    var product = await productService.CreateAsync(request);
    return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
}
```

A common interview mistake is saying all validation belongs in DTO attributes. Attributes are useful, but business rules usually belong in application or domain logic.

### Serialization and JSON Contracts

Most ASP.NET Core APIs use JSON by default.

JSON contract design includes decisions such as:

- Property naming style
- Null handling
- Date/time format
- Enum representation
- Required properties
- Backward-compatible changes
- Numeric precision
- Polymorphism rules

Example DTO with explicit JSON property names:

```csharp
public sealed record ProductResponseDto
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("displayName")]
    public string DisplayName { get; init; } = string.Empty;

    [JsonPropertyName("price")]
    public decimal Price { get; init; }
}
```

Explicit JSON names can make the wire contract more stable even if C# property names change.

### Nullability in API Contracts

Nullability should be intentional.

Example:

```csharp
public sealed record CustomerResponse(
    Guid Id,
    string FullName,
    string? PhoneNumber
);
```

In this contract:

- `FullName` is expected to always exist
- `PhoneNumber` may be missing or unknown

Nullable reference types help developers express intent in C# code, but the API contract should also be clear in documentation and validation.

Avoid returning inconsistent null behavior, such as sometimes omitting a field, sometimes returning `null`, and sometimes returning an empty string for the same concept.

### Dates and Times in Contracts

Date and time fields are common sources of bugs.

Good API habits include:

- Use UTC for server timestamps when possible
- Use `DateTimeOffset` when the offset matters
- Use ISO 8601 style JSON values
- Avoid ambiguous local times
- Document whether a field is a date-only value, time-only value, or timestamp
- Avoid sending formatted display strings as the primary contract value

Example:

```csharp
public sealed record OrderResponse(
    Guid Id,
    DateTimeOffset CreatedAt,
    DateOnly DeliveryDate
);
```

Use display formatting in the frontend when possible. The API should usually send precise data, not UI-formatted strings.

### Versioning and Backward Compatibility

API contracts should evolve carefully.

Usually safe changes:

- Adding an optional response property
- Adding a new endpoint
- Adding a new optional query parameter
- Adding a new enum value only if clients can handle unknown values

Usually breaking changes:

- Removing a property
- Renaming a property
- Changing a property type
- Changing a status code meaning
- Making an optional request field required
- Changing error response shape
- Changing date/time format
- Changing pagination format

DTOs help manage versioning because the API contract is separated from internal models.

Example versioned DTOs:

```csharp
public sealed record ProductResponseV1(
    int Id,
    string Name
);

public sealed record ProductResponseV2(
    int Id,
    string Name,
    decimal Price
);
```

### Request/Response Contract Documentation

OpenAPI documentation is commonly used to describe API contracts.

ASP.NET Core can generate better OpenAPI metadata when endpoints clearly declare:

- Request DTOs
- Response DTOs
- Status codes
- Content types
- Validation metadata
- Route parameters
- Query parameters

Controller example:

```csharp
[HttpPost]
[Consumes("application/json")]
[ProducesResponseType<ProductResponseDto>(StatusCodes.Status201Created)]
[ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
public async Task<ActionResult<ProductResponseDto>> Create(CreateProductRequestDto request)
{
    // ...
}
```

This helps frontend developers, testers, and external consumers know what to expect.

### Pagination, Filtering, and List Contracts

List endpoints should have explicit response contracts.

Avoid returning a raw list if the client needs metadata such as total count, page size, or continuation tokens.

Example:

```csharp
public sealed record PagedResponse<T>(
    IReadOnlyList<T> Items,
    int PageNumber,
    int PageSize,
    int TotalCount
);
```

Example endpoint:

```csharp
[HttpGet]
public async Task<ActionResult<PagedResponse<ProductListItemDto>>> Search(
    [FromQuery] ProductSearchRequest request)
{
    var result = await productService.SearchAsync(request);
    return Ok(result);
}
```

For large or cloud-backed datasets, continuation-token pagination may be better than page-number pagination.

### Over-Posting and Under-Posting

Over-posting happens when a client sends fields that it should not control, and the API accidentally applies them.

Bad example:

```csharp
[HttpPost]
public async Task<ActionResult<Product>> Create(Product product)
{
    db.Products.Add(product);
    await db.SaveChangesAsync();
    return product;
}
```

A malicious client might send fields such as:

```json
{
  "name": "Keyboard",
  "price": 49.99,
  "isDeleted": true,
  "cost": 1.00
}
```

Better example:

```csharp
[HttpPost]
public async Task<ActionResult<ProductResponseDto>> Create(CreateProductRequestDto request)
{
    var product = new Product
    {
        Name = request.Name,
        Price = request.Price,
        CreatedAtUtc = DateTime.UtcNow
    };

    db.Products.Add(product);
    await db.SaveChangesAsync();

    var response = new ProductResponseDto(product.Id, product.Name, product.Price);

    return CreatedAtAction(nameof(GetById), new { id = product.Id }, response);
}
```

DTOs protect the write contract.

### Mapping Between Entities and DTOs

Mapping can be done manually or with mapping libraries.

Manual mapping is explicit and easy to debug:

```csharp
public static ProductResponseDto ToResponse(Product product)
{
    return new ProductResponseDto(
        product.Id,
        product.Name,
        product.Price
    );
}
```

For larger systems, teams may use mapping libraries to reduce repetitive code. However, mapping should still be reviewed carefully because hidden mapping rules can produce unexpected API contract changes.

For interview answers, it is useful to mention that manual mapping is often preferred for important boundaries because API contracts should be explicit.

### Commands, Queries, and Response Shape

Not every `POST` creates a resource.

For example, a command endpoint might execute a business action:

```http
POST /api/orders/123/cancel
```

Possible responses:

- `200 OK` with updated order state
- `204 No Content` if the operation succeeds and no body is needed
- `400 Bad Request` for invalid input
- `404 Not Found` if the order does not exist
- `409 Conflict` if the order is already shipped and cannot be cancelled

Example:

```csharp
[HttpPost("{id:guid}/cancel")]
public async Task<ActionResult<OrderResponseDto>> Cancel(Guid id)
{
    var result = await orderService.CancelAsync(id);

    return result.Status switch
    {
        CancelOrderStatus.NotFound => NotFound(),
        CancelOrderStatus.AlreadyShipped => Conflict(new ProblemDetails
        {
            Title = "Order cannot be cancelled",
            Status = StatusCodes.Status409Conflict,
            Detail = "The order has already been shipped."
        }),
        CancelOrderStatus.Cancelled => Ok(result.Order),
        _ => Problem(statusCode: StatusCodes.Status500InternalServerError)
    };
}
```

The status code should describe the result of the operation, not just the HTTP method.

### Common Mistakes

Common mistakes include:

- Returning `200 OK` for errors
- Returning database entities directly
- Reusing one DTO for every endpoint
- Returning inconsistent error response shapes
- Using `string` for dates, money, or ids without a strong reason
- Ignoring `Content-Type` and `Accept`
- Not documenting non-`200` responses
- Returning `null` with unclear meaning
- Returning `204 No Content` when the client expects a body
- Using `500 Internal Server Error` for validation or business-rule failures
- Mixing authentication, authorization, validation, and business errors into the same status code
- Creating API contracts that mirror the database instead of the client use case
- Breaking clients by renaming fields or changing response shapes without versioning

### Best Practices

Use DTOs for request and response models.

Keep request DTOs separate from response DTOs.

Use `ActionResult<T>` for controller actions that return a typed success body and possible error responses.

Use `CreatedAtAction` or equivalent `201 Created` responses when creating resources.

Use `NoContent()` for successful operations that intentionally return no body.

Use `ProblemDetails` and `ValidationProblemDetails` for consistent error responses.

Use `[ProducesResponseType]`, `[Consumes]`, and `[Produces]` to document contracts.

Avoid exposing EF Core entities directly from API endpoints.

Treat JSON property names, nullability, date formats, and status codes as part of the public contract.

Prefer explicit mapping at API boundaries.

Write integration tests for important status codes and response shapes.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

####  What is a DTO, and why is it used in Web APIs?

<!-- question:start:dto-purpose-beginner-q01 -->
<!-- question-id:dto-purpose-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A DTO, or Data Transfer Object, is an object used to transfer data across a boundary, such as between a client and a Web API.

In ASP.NET Core APIs, DTOs are used to define request and response shapes. They help avoid exposing internal domain entities or database entities directly. DTOs also help prevent over-posting, hide sensitive fields, make validation clearer, and keep the public API contract stable even when internal models change.

For example, an entity might contain fields like `Cost`, `IsDeleted`, or `CreatedAtUtc`, but the response DTO may only expose `Id`, `Name`, and `Price`.

##### Key Points to Mention

- DTO means Data Transfer Object.
- DTOs define API input and output shapes.
- They separate API contracts from internal models.
- They help prevent exposing sensitive or internal fields.
- Request DTOs and response DTOs are often different.

<!-- question:end:dto-purpose-beginner-q01 -->

####  What is content negotiation?

<!-- question:start:content-negotiation-beginner-q02 -->
<!-- question-id:content-negotiation-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Content negotiation is the process where the client and server determine the format of the response.

The client sends an `Accept` header to tell the server which response formats it can handle, such as `application/json`. The server selects a supported format and returns the response with a `Content-Type` header.

In ASP.NET Core, content negotiation is commonly handled by `ObjectResult` and output formatters. When a controller action returns `Ok(dto)` or `ActionResult<T>`, ASP.NET Core serializes the object using an output formatter, usually JSON by default.

##### Key Points to Mention

- `Accept` describes the desired response format.
- `Content-Type` describes the actual body format.
- ASP.NET Core commonly returns JSON by default.
- Output formatters serialize response objects.
- Content negotiation improves API flexibility and correctness.

<!-- question:end:content-negotiation-beginner-q02 -->

####  What is the difference between `Accept` and `Content-Type`?

<!-- question:start:accept-vs-content-type-beginner-q03 -->
<!-- question-id:accept-vs-content-type-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

`Accept` tells the server what response media types the client can handle. For example, `Accept: application/json` means the client wants a JSON response.

`Content-Type` tells the server or client what format the current request or response body is in. For example, `Content-Type: application/json` on a `POST` request means the request body is JSON.

For a JSON API request, a client may send both headers: `Content-Type` for the request body and `Accept` for the response body.

##### Key Points to Mention

- `Accept` is about the response the client wants.
- `Content-Type` is about the body being sent.
- `POST` and `PUT` commonly use `Content-Type`.
- `GET` commonly uses `Accept`.
- Confusing these headers can cause API integration issues.

<!-- question:end:accept-vs-content-type-beginner-q03 -->

####  What status code should an API return when a resource is not found?

<!-- question:start:not-found-status-code-beginner-q04 -->
<!-- question-id:not-found-status-code-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

An API should usually return `404 Not Found` when a requested resource does not exist.

For example, if the client calls `GET /api/products/123` and product `123` does not exist, the API should return `404 Not Found`.

In ASP.NET Core, this is commonly done with `return NotFound();`.

##### Key Points to Mention

- Use `404 Not Found` for missing resources.
- Do not return `200 OK` with `null` for a missing resource unless the API has a special documented reason.
- `NotFound()` is the common ASP.NET Core helper.
- The response can optionally include a `ProblemDetails` body.

<!-- question:end:not-found-status-code-beginner-q04 -->

####  What status code should be returned after successfully creating a resource?

<!-- question:start:created-status-code-beginner-q05 -->
<!-- question-id:created-status-code-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

An API should usually return `201 Created` after successfully creating a new resource.

The response should often include a `Location` header pointing to the new resource. In ASP.NET Core controllers, this is commonly done with `CreatedAtAction`.

Example:

```csharp
return CreatedAtAction(
    nameof(GetById),
    new { id = product.Id },
    productResponse
);
```

This returns `201 Created`, includes the URL of the new resource, and can include the created resource representation in the body.

##### Key Points to Mention

- `201 Created` is common for successful creation.
- Include a `Location` header when possible.
- `CreatedAtAction` is commonly used in ASP.NET Core.
- Not every `POST` creates a resource; command-style `POST` endpoints may return different status codes.

<!-- question:end:created-status-code-beginner-q05 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

####  Why should APIs avoid returning EF Core entities directly?

<!-- question:start:avoid-returning-entities-intermediate-q06 -->
<!-- question-id:avoid-returning-entities-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

APIs should avoid returning EF Core entities directly because entities represent the internal persistence model, not necessarily the public API contract.

Returning entities can expose sensitive fields, create over-posting risks, cause circular reference serialization problems, and tightly couple the API response to the database schema. If the entity changes, the API contract may accidentally change and break clients.

DTOs give the API a deliberate contract. They allow the API to expose only the fields clients need and keep internal implementation details hidden.

##### Key Points to Mention

- Entities are internal persistence models.
- DTOs are external contract models.
- Returning entities may expose sensitive fields.
- Entity relationships can cause serialization problems.
- DTOs reduce coupling and support versioning.

<!-- question:end:avoid-returning-entities-intermediate-q06 -->

####  When should you use `ActionResult<T>` instead of `IActionResult`?

<!-- question:start:actionresult-vs-iactionresult-intermediate-q07 -->
<!-- question-id:actionresult-vs-iactionresult-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

`ActionResult<T>` is useful when the action has a known success response type but can also return different error responses.

For example, `ActionResult<ProductResponseDto>` communicates that the successful response body is a `ProductResponseDto`, while still allowing the action to return `NotFound()`, `BadRequest()`, or other results.

`IActionResult` is more flexible but less descriptive because the success response type is not visible from the method signature.

Example:

```csharp
public async Task<ActionResult<ProductResponseDto>> GetById(int id)
{
    var product = await productService.GetByIdAsync(id);

    if (product is null)
    {
        return NotFound();
    }

    return Ok(product);
}
```

##### Key Points to Mention

- `ActionResult<T>` combines strong typing and flexible status codes.
- It improves readability and API documentation.
- `IActionResult` is useful for many unrelated response types.
- Specific types are best when only one response shape is possible.

<!-- question:end:actionresult-vs-iactionresult-intermediate-q07 -->

####  What is `ProblemDetails`, and why is it useful?

<!-- question:start:problemdetails-intermediate-q08 -->
<!-- question-id:problemdetails-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

`ProblemDetails` is a standard structure for returning machine-readable error information from HTTP APIs.

It commonly includes fields such as `type`, `title`, `status`, `detail`, and `instance`. ASP.NET Core also uses `ValidationProblemDetails` for validation errors, which includes an `errors` dictionary.

`ProblemDetails` is useful because it gives clients a consistent way to process API errors instead of receiving different error shapes from different endpoints.

##### Key Points to Mention

- `ProblemDetails` standardizes error responses.
- `ValidationProblemDetails` is used for validation errors.
- It avoids inconsistent custom error formats.
- It is useful for frontend error handling and API clients.
- It should not expose sensitive internal exception details.

<!-- question:end:problemdetails-intermediate-q08 -->

####  What is the difference between `400 Bad Request`, `409 Conflict`, and `422 Unprocessable Entity`?

<!-- question:start:badrequest-conflict-unprocessable-intermediate-q09 -->
<!-- question-id:badrequest-conflict-unprocessable-intermediate-q09 -->
<!-- question-level:intermediate -->

##### Expected Answer

`400 Bad Request` usually means the request is invalid. This can include malformed JSON, model binding failure, invalid data annotations, or basic validation errors.

`409 Conflict` means the request conflicts with the current state of the resource. Examples include duplicate unique values, concurrency conflicts, or trying to cancel an order that has already shipped.

`422 Unprocessable Entity` is sometimes used when the request is syntactically valid but semantically invalid according to business rules. Not every API uses `422`; some teams use `400` for all validation errors. The most important thing is consistency and documentation.

##### Key Points to Mention

- `400` means invalid request.
- `409` means state conflict.
- `422` can represent semantic validation errors.
- Teams should define and document the convention.
- Do not return `500` for expected validation or business-rule failures.

<!-- question:end:badrequest-conflict-unprocessable-intermediate-q09 -->

####  How does ASP.NET Core handle automatic validation errors with `[ApiController]`?

<!-- question:start:apicontroller-validation-intermediate-q10 -->
<!-- question-id:apicontroller-validation-intermediate-q10 -->
<!-- question-level:intermediate -->

##### Expected Answer

When `[ApiController]` is applied, ASP.NET Core automatically checks model validation before the action executes. If model validation fails, ASP.NET Core returns a `400 Bad Request` response automatically.

The response is typically a `ValidationProblemDetails` object that includes validation errors grouped by field name.

This reduces repetitive code because developers do not need to manually check `ModelState.IsValid` in every action.

##### Key Points to Mention

- `[ApiController]` enables automatic model validation responses.
- Invalid models usually produce `400 Bad Request`.
- The response is commonly `ValidationProblemDetails`.
- This behavior can be customized when needed.
- Business validation should still be handled in application or domain logic.

<!-- question:end:apicontroller-validation-intermediate-q10 -->

####  How do `[Consumes]`, `[Produces]`, and `[ProducesResponseType]` help API design?

<!-- question:start:api-metadata-attributes-intermediate-q11 -->
<!-- question-id:api-metadata-attributes-intermediate-q11 -->
<!-- question-level:intermediate -->

##### Expected Answer

`[Consumes]` specifies the request media types an action accepts, such as `application/json`.

`[Produces]` specifies the response media types an action or controller produces.

`[ProducesResponseType]` documents the possible response status codes and response body types.

These attributes make the API contract clearer and improve generated OpenAPI documentation. They also help client developers understand what the endpoint expects and what it can return.

##### Key Points to Mention

- `[Consumes]` documents or constrains request body formats.
- `[Produces]` documents response media types.
- `[ProducesResponseType]` documents response status codes and body types.
- They improve Swagger/OpenAPI output.
- They make API contracts more explicit.

<!-- question:end:api-metadata-attributes-intermediate-q11 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

####  How would you design a stable request/response contract for a public API?

<!-- question:start:stable-api-contract-advanced-q12 -->
<!-- question-id:stable-api-contract-advanced-q12 -->
<!-- question-level:advanced -->

##### Expected Answer

A stable public API contract should be designed intentionally and should not simply mirror database entities.

The API should use clear request and response DTOs, consistent naming conventions, documented status codes, consistent error responses, and stable JSON formats. It should define nullability, date/time formats, pagination shape, validation rules, authentication behavior, and versioning rules.

Backward compatibility is important. Adding optional response fields is usually safe, but removing fields, renaming fields, changing types, or changing error response shape can break clients. Versioning may be needed for breaking changes.

The API should also include integration tests that verify important response shapes and status codes.

##### Key Points to Mention

- Do not expose database models as public contracts.
- Define request DTOs and response DTOs explicitly.
- Use consistent status codes and error formats.
- Treat JSON field names and nullability as part of the contract.
- Plan for versioning and backward compatibility.
- Test contract behavior with integration tests.

<!-- question:end:stable-api-contract-advanced-q12 -->

####  How do you prevent over-posting in ASP.NET Core APIs?

<!-- question:start:prevent-overposting-advanced-q13 -->
<!-- question-id:prevent-overposting-advanced-q13 -->
<!-- question-level:advanced -->

##### Expected Answer

Over-posting is prevented by using request DTOs that contain only the fields the client is allowed to send.

The API should not bind request bodies directly to EF Core entities or domain entities. Instead, it should bind to a request DTO, validate the DTO, and map allowed fields manually or through a controlled mapper.

For example, a client should not be allowed to set fields like `Id`, `IsAdmin`, `CreatedAtUtc`, `IsDeleted`, or `Cost` unless the API explicitly allows it.

##### Key Points to Mention

- Over-posting happens when clients send fields they should not control.
- Avoid binding request bodies directly to entities.
- Use create/update request DTOs.
- Map only allowed fields.
- This is both a design and security concern.

<!-- question:end:prevent-overposting-advanced-q13 -->

####  How should an API handle validation errors versus domain/business-rule errors?

<!-- question:start:validation-vs-domain-errors-advanced-q14 -->
<!-- question-id:validation-vs-domain-errors-advanced-q14 -->
<!-- question-level:advanced -->

##### Expected Answer

Validation errors and domain errors should be handled differently but consistently.

Request validation checks whether the incoming DTO is structurally valid. Examples include required fields, string length, numeric ranges, and invalid JSON. In ASP.NET Core with `[ApiController]`, these commonly produce `400 Bad Request` with `ValidationProblemDetails`.

Domain or business-rule errors occur when the request is structurally valid but violates business rules. Examples include duplicate product names, cancelling a shipped order, or failing a concurrency check. These may return `409 Conflict`, `400 Bad Request`, or `422 Unprocessable Entity`, depending on the API convention.

The key is to return predictable status codes and consistent `ProblemDetails` responses.

##### Key Points to Mention

- DTO validation checks request shape and basic rules.
- Domain validation checks business rules.
- Use `ValidationProblemDetails` for field-level validation errors.
- Use `ProblemDetails` for business or application errors.
- Choose consistent status-code conventions.

<!-- question:end:validation-vs-domain-errors-advanced-q14 -->

#### How does content negotiation affect error responses?

<!-- question:start:content-negotiation-error-responses-advanced-q15 -->
<!-- question-id:content-negotiation-error-responses-advanced-q15 -->
<!-- question-level:advanced -->

##### Expected Answer

Content negotiation can affect both successful responses and error responses.

If an API supports multiple response formats, error responses should also follow a predictable media type and shape. For JSON APIs, errors are commonly returned as `application/problem+json` or JSON-formatted `ProblemDetails`.

If the client requests a media type the API cannot produce and the API is configured to enforce negotiation, the server may return `406 Not Acceptable`.

For practical API design, the team should define whether errors always use `ProblemDetails`, whether unsupported `Accept` headers are enforced, and how browsers or wildcard `Accept` headers are handled.

##### Key Points to Mention

- Error responses are part of the API contract.
- `ProblemDetails` is commonly used for error response bodies.
- `406 Not Acceptable` can be returned when the requested response type is unsupported.
- APIs should be consistent in error media types.
- Clients should not receive random error shapes depending on endpoint implementation.

<!-- question:end:content-negotiation-error-responses-advanced-q15 -->

####  What are the trade-offs between manual DTO mapping and using a mapping library?

<!-- question:start:dto-mapping-tradeoffs-advanced-q16 -->
<!-- question-id:dto-mapping-tradeoffs-advanced-q16 -->
<!-- question-level:advanced -->

##### Expected Answer

Manual mapping is explicit, easy to debug, and makes API contract changes visible in code. It is often preferred for important API boundaries because developers can clearly see which fields are exposed.

Mapping libraries can reduce repetitive mapping code, especially in large applications with many DTOs. However, they can hide mapping behavior, make debugging harder, and accidentally expose fields if conventions are not controlled carefully.

The best choice depends on project size, team preference, complexity, and how sensitive the boundary is. For public APIs or security-sensitive models, explicit mapping is often safer.

##### Key Points to Mention

- Manual mapping is explicit and safe.
- Mapping libraries reduce boilerplate.
- Mapping libraries can hide contract changes.
- API boundaries should be reviewed carefully.
- Avoid blindly mapping every entity property to a response.

<!-- question:end:dto-mapping-tradeoffs-advanced-q16 -->

####  How would you test request/response contracts in an ASP.NET Core API?

<!-- question:start:testing-api-contracts-advanced-q17 -->
<!-- question-id:testing-api-contracts-advanced-q17 -->
<!-- question-level:advanced -->

##### Expected Answer

API contracts should be tested with integration tests that call the API through HTTP and verify status codes, response headers, response body shape, and error formats.

For example, tests should verify that `GET /api/products/999` returns `404`, creating a valid product returns `201` with a `Location` header, invalid input returns `400` with validation errors, and conflict scenarios return `409` with a consistent `ProblemDetails` body.

Tests can also verify JSON property names, required fields, null behavior, pagination metadata, and content type.

##### Key Points to Mention

- Use integration tests for API boundary behavior.
- Verify status codes and response bodies.
- Verify error response shape.
- Verify `Content-Type` and important headers.
- Test both success and failure paths.
- Contract tests help prevent accidental breaking changes.

<!-- question:end:testing-api-contracts-advanced-q17 -->

####  How do Minimal APIs represent response contracts differently from controllers?

<!-- question:start:minimal-api-contracts-advanced-q18 -->
<!-- question-id:minimal-api-contracts-advanced-q18 -->
<!-- question-level:advanced -->

##### Expected Answer

Minimal APIs can represent response contracts using `Results`, `TypedResults`, and typed result unions such as `Results<Ok<T>, NotFound, BadRequest>`.

Typed results make possible endpoint outcomes visible in the method signature. This can improve readability, testing, and OpenAPI metadata.

Controllers commonly use `ActionResult<T>`, `IActionResult`, attributes like `[ProducesResponseType]`, and controller helper methods such as `Ok`, `NotFound`, and `CreatedAtAction`.

Both approaches can create clear contracts, but Minimal APIs often rely more on typed results and endpoint metadata methods, while controllers often rely more on attributes and `ActionResult<T>`.

##### Key Points to Mention

- Controllers commonly use `ActionResult<T>` and attributes.
- Minimal APIs can use `TypedResults`.
- Typed result unions document possible outcomes in code.
- Both approaches need clear status codes and DTOs.
- OpenAPI metadata should be accurate in both styles.

<!-- question:end:minimal-api-contracts-advanced-q18 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
