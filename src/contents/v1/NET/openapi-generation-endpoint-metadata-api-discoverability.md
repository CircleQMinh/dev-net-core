---
id: openapi-generation-endpoint-metadata-api-discoverability
topic: API design and implementation
subtopic: OpenAPI generation and API discoverability 
category: .NET
---


## Overview

OpenAPI generation is the process of producing a machine-readable description of an HTTP API. In ASP.NET Core, this description is built from endpoint definitions, route templates, request and response types, status-code metadata, parameter binding metadata, XML documentation comments, and explicit metadata added by attributes or endpoint extension methods.

Endpoint metadata is information attached to an endpoint that describes how the endpoint behaves. Examples include the route name, tags, summary, description, accepted request body type, produced response types, authorization requirements, content types, and whether the endpoint should be included in generated API documentation.

API discoverability means making an API easy for humans and tools to understand. A discoverable API has clear endpoint names, consistent route structure, accurate request and response schemas, meaningful status-code documentation, examples where useful, and a published OpenAPI document that can be used by Swagger UI, ReDoc, Scalar, API gateways, client generators, automated tests, and integration partners.

This topic matters because modern APIs are rarely consumed only by the team that builds them. Frontend teams, mobile teams, external partners, QA engineers, DevOps engineers, and automated tooling all rely on accurate contracts. Inaccurate OpenAPI documents create integration bugs, broken generated clients, incorrect test assumptions, and confusing developer experiences.

For interviews, this topic is important because it connects several real-world API skills:

- Designing clear HTTP APIs
- Documenting request and response contracts
- Understanding ASP.NET Core endpoint metadata
- Knowing the difference between controller-based APIs and Minimal APIs
- Explaining how OpenAPI documents are generated
- Avoiding common documentation mismatches
- Securing or hiding API documentation when needed
- Supporting API discoverability in production systems

A strong candidate should not only know how to enable Swagger or OpenAPI, but also how to make the generated document accurate, maintainable, secure, and useful for consumers.

## Core Concepts

### What OpenAPI Is

OpenAPI is a language-agnostic specification for describing HTTP APIs. It describes what routes exist, which HTTP methods they support, what parameters they accept, what request bodies they expect, what responses they return, and what security schemes are required.

An OpenAPI document commonly includes:

- API title, version, description, and contact information
- Paths such as `/api/products/{id}`
- HTTP operations such as `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`
- Route, query, header, and body parameters
- Request body schemas
- Response schemas
- Response status codes
- Content types such as `application/json`
- Security requirements such as bearer token authentication
- Tags used to group endpoints
- Operation IDs used by client generators

OpenAPI is useful because it becomes a contract between the API provider and API consumers.

### OpenAPI vs Swagger

The terms OpenAPI and Swagger are often used together, but they are not exactly the same.

OpenAPI is the specification. It defines the format of the API contract.

Swagger originally referred to the API description format and later became associated with a family of tools around API documentation, testing, and client generation. In many ASP.NET Core projects, developers still say "Swagger" when they mean the generated OpenAPI document or the interactive Swagger UI page.

A good interview answer should make this distinction:

- OpenAPI is the standard contract format.
- Swagger UI is a common tool for displaying and testing that contract.
- Swashbuckle is a popular ASP.NET Core package that can generate Swagger/OpenAPI documents and provide Swagger UI.
- ASP.NET Core also has built-in OpenAPI support through the `Microsoft.AspNetCore.OpenApi` package.

### Why OpenAPI Matters in ASP.NET Core APIs

OpenAPI helps ASP.NET Core APIs in several ways:

- It provides interactive documentation for developers.
- It allows frontend teams to understand available endpoints.
- It enables client SDK generation.
- It helps QA teams create contract-based tests.
- It helps API gateways and developer portals import API definitions.
- It improves onboarding for new developers.
- It makes versioned API contracts easier to compare.
- It reduces ambiguity around request and response shapes.

Without accurate API documentation, teams often depend on source code, outdated wiki pages, or informal communication. This causes integration delays and production bugs.

### How ASP.NET Core Generates OpenAPI Documents

ASP.NET Core generates OpenAPI documents by reading endpoint metadata. The framework inspects endpoints registered in the application and gathers information such as:

- Route pattern
- HTTP method
- Parameter sources
- Request body type
- Response types
- Status codes
- Content types
- Tags
- Operation names
- Summary and description
- Exclusion settings
- Authorization-related metadata

For Minimal APIs, metadata can come from route handler signatures, return types, attributes, and endpoint builder extension methods.

For controller-based APIs, metadata often comes from controller attributes, action attributes, return types, API conventions, and XML documentation comments.

A simplified setup using built-in ASP.NET Core OpenAPI support looks like this:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/api/health", () => Results.Ok(new { Status = "Healthy" }))
   .WithName("GetHealth")
   .WithSummary("Gets the API health status")
   .WithDescription("Returns a simple health response used by monitoring tools.")
   .WithTags("Health")
   .Produces(StatusCodes.Status200OK);

app.Run();
```

In this example:

- `AddOpenApi` registers OpenAPI generation services.
- `MapOpenApi` exposes the generated OpenAPI document through an endpoint.
- `WithName`, `WithSummary`, `WithDescription`, `WithTags`, and `Produces` add endpoint metadata.
- The OpenAPI document becomes more useful because the endpoint is described explicitly.

### Runtime Generation vs Build-Time Generation

OpenAPI documents can be generated at runtime or during the build process.

Runtime generation means the application serves the OpenAPI document from an endpoint while the app is running. This is convenient during development because the document reflects the current running application.

Build-time generation means the OpenAPI document is created as part of the build pipeline. This can be useful for CI/CD, publishing API contracts, validating API compatibility, or generating clients without starting the application.

Runtime generation is convenient for local development and interactive testing. Build-time generation is useful for contract governance and automation.

### Endpoint Metadata

Endpoint metadata is a collection of descriptive information attached to an endpoint. ASP.NET Core uses this metadata for many behaviors, not only OpenAPI generation.

Endpoint metadata can affect:

- Routing
- Authorization
- CORS
- Rate limiting
- Output caching
- OpenAPI generation
- Filters
- Endpoint discovery
- API explorer behavior

Example Minimal API endpoint with rich metadata:

```csharp
app.MapPost("/api/orders", async (
        CreateOrderRequest request,
        IOrderService orderService,
        CancellationToken cancellationToken) =>
    {
        var order = await orderService.CreateAsync(request, cancellationToken);

        return Results.Created($"/api/orders/{order.Id}", order);
    })
    .WithName("CreateOrder")
    .WithSummary("Creates a new order")
    .WithDescription("Creates an order and returns the created order resource.")
    .WithTags("Orders")
    .Accepts<CreateOrderRequest>("application/json")
    .Produces<OrderResponse>(StatusCodes.Status201Created)
    .ProducesValidationProblem()
    .ProducesProblem(StatusCodes.Status500InternalServerError);
```

This endpoint is easier to understand because the metadata clearly describes the request body, response types, status codes, and documentation grouping.

### Common Metadata in Minimal APIs

Common Minimal API metadata methods include:

- `WithName` for setting an endpoint name or operation ID.
- `WithSummary` for adding a short summary.
- `WithDescription` for adding a longer explanation.
- `WithTags` for grouping endpoints.
- `Accepts<T>` for describing request body type and content type.
- `Produces<T>` for describing successful response type and status code.
- `ProducesProblem` for documenting error responses using `ProblemDetails`.
- `ProducesValidationProblem` for documenting validation errors.
- `ExcludeFromDescription` for hiding an endpoint from API documentation.
- `RequireAuthorization` for attaching authorization metadata.

Example:

```csharp
app.MapGet("/api/products/{id:int}", async (
        int id,
        IProductService productService,
        CancellationToken cancellationToken) =>
    {
        var product = await productService.GetByIdAsync(id, cancellationToken);

        return product is null
            ? Results.NotFound()
            : Results.Ok(product);
    })
    .WithName("GetProductById")
    .WithSummary("Gets a product by ID")
    .WithTags("Products")
    .Produces<ProductResponse>(StatusCodes.Status200OK)
    .Produces(StatusCodes.Status404NotFound);
```

The generated document can now show that the endpoint may return either `200 OK` with a `ProductResponse` or `404 Not Found`.

### Common Metadata in Controller-Based APIs

Controller-based APIs commonly use attributes to provide metadata.

Example:

```csharp
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ProductsController : ControllerBase
{
    private readonly IProductService _productService;

    public ProductsController(IProductService productService)
    {
        _productService = productService;
    }

    [HttpGet("{id:int}", Name = "GetProductById")]
    [EndpointSummary("Gets a product by ID")]
    [EndpointDescription("Returns a product when the product exists.")]
    [ProducesResponseType<ProductResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductResponse>> GetById(
        int id,
        CancellationToken cancellationToken)
    {
        var product = await _productService.GetByIdAsync(id, cancellationToken);

        if (product is null)
        {
            return NotFound();
        }

        return Ok(product);
    }
}
```

Common controller metadata attributes include:

- `[ApiController]`
- `[Route]`
- `[HttpGet]`, `[HttpPost]`, `[HttpPut]`, `[HttpPatch]`, `[HttpDelete]`
- `[Produces]`
- `[Consumes]`
- `[ProducesResponseType]`
- `[EndpointSummary]`
- `[EndpointDescription]`
- `[Tags]`
- `[ApiExplorerSettings(IgnoreApi = true)]`

Controller attributes are useful because they keep documentation metadata close to the action method.

### Operation IDs and Endpoint Names

An operation ID is a unique identifier for an API operation in the OpenAPI document. Client generators often use operation IDs to create method names.

In Minimal APIs, `WithName` is commonly used to set the endpoint name and operation ID.

```csharp
app.MapGet("/api/customers/{id:int}", GetCustomerById)
   .WithName("GetCustomerById");
```

In controller-based APIs, the route name can be provided in the HTTP method attribute.

```csharp
[HttpGet("{id:int}", Name = "GetCustomerById")]
public async Task<ActionResult<CustomerResponse>> GetById(int id)
{
    // ...
}
```

Good operation IDs should be:

- Unique
- Stable
- Descriptive
- Verb-based
- Consumer-friendly

Good examples:

- `GetCustomerById`
- `CreateOrder`
- `UpdateProductPrice`
- `CancelSubscription`

Poor examples:

- `Get`
- `Post`
- `Endpoint1`
- `Products_GetById_123`

Changing operation IDs can break generated client SDKs, so they should be treated as part of the public contract.

### Tags and API Grouping

Tags are used to group related endpoints in API documentation tools.

Example:

```csharp
app.MapGet("/api/orders", GetOrders)
   .WithTags("Orders");

app.MapPost("/api/orders", CreateOrder)
   .WithTags("Orders");

app.MapGet("/api/customers", GetCustomers)
   .WithTags("Customers");
```

Good tags improve discoverability by helping developers find related endpoints quickly.

Common tag strategies include:

- Grouping by business capability, such as `Orders`, `Customers`, and `Payments`.
- Grouping by API area, such as `Admin`, `Public`, and `Reporting`.
- Grouping by version only when necessary, such as `Orders v1` and `Orders v2`.

Avoid creating too many tags or using inconsistent tag names.

### Request Contracts

A request contract describes what data an API expects from the client. In ASP.NET Core, request contracts are usually represented by DTOs.

Example:

```csharp
public sealed record CreateProductRequest(
    string Name,
    decimal Price,
    string? Description);
```

For a `POST` endpoint, the request body type should be clear in the OpenAPI document.

```csharp
app.MapPost("/api/products", async (
        CreateProductRequest request,
        IProductService productService) =>
    {
        var product = await productService.CreateAsync(request);
        return Results.Created($"/api/products/{product.Id}", product);
    })
    .Accepts<CreateProductRequest>("application/json")
    .Produces<ProductResponse>(StatusCodes.Status201Created)
    .ProducesValidationProblem();
```

Good request contracts should:

- Use DTOs instead of EF Core entities.
- Avoid exposing internal domain objects.
- Clearly mark required and optional fields.
- Use validation attributes or validators.
- Avoid accepting more fields than the operation needs.
- Use separate DTOs for create, update, patch, and read operations when needed.

### Response Contracts

A response contract describes what the API returns to the client.

Example:

```csharp
public sealed record ProductResponse(
    int Id,
    string Name,
    decimal Price,
    string? Description);
```

Response contracts should be stable and explicit. They should not accidentally change when internal database entities change.

For example, this is risky:

```csharp
app.MapGet("/api/products/{id:int}", async (AppDbContext db, int id) =>
{
    var product = await db.Products.FindAsync(id);
    return product is null ? Results.NotFound() : Results.Ok(product);
});
```

The endpoint exposes the persistence entity directly. If the entity later gains internal properties, navigation properties, or sensitive fields, the API contract may accidentally change.

A safer approach maps the entity to a response DTO:

```csharp
app.MapGet("/api/products/{id:int}", async (AppDbContext db, int id) =>
{
    var product = await db.Products.FindAsync(id);

    if (product is null)
    {
        return Results.NotFound();
    }

    var response = new ProductResponse(
        product.Id,
        product.Name,
        product.Price,
        product.Description);

    return Results.Ok(response);
})
.Produces<ProductResponse>(StatusCodes.Status200OK)
.Produces(StatusCodes.Status404NotFound);
```

### Status Codes and Response Metadata

OpenAPI documents are more useful when they accurately describe possible status codes.

Common status codes include:

- `200 OK` for successful reads and updates.
- `201 Created` for successful creation.
- `204 No Content` for successful delete or update operations with no body.
- `400 Bad Request` for invalid request syntax or validation failures.
- `401 Unauthorized` for missing or invalid authentication.
- `403 Forbidden` for authenticated users who lack permission.
- `404 Not Found` for missing resources.
- `409 Conflict` for concurrency conflicts or duplicate resources.
- `422 Unprocessable Entity` for semantically invalid input in APIs that choose to distinguish this from `400`.
- `500 Internal Server Error` for unhandled server errors.

Example controller action:

```csharp
[HttpPost]
[Consumes("application/json")]
[ProducesResponseType<ProductResponse>(StatusCodes.Status201Created)]
[ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
public async Task<ActionResult<ProductResponse>> Create(
    CreateProductRequest request,
    CancellationToken cancellationToken)
{
    var result = await _productService.CreateAsync(request, cancellationToken);

    if (result.HasConflict)
    {
        return Conflict(new ProblemDetails
        {
            Title = "Product conflict",
            Detail = "A product with the same name already exists."
        });
    }

    return CreatedAtAction(nameof(GetById), new { id = result.Product.Id }, result.Product);
}
```

Accurate status-code metadata helps client developers implement correct error handling.

### ProblemDetails and Error Discoverability

`ProblemDetails` is a common format for machine-readable error responses.

A consistent error contract is important because clients need predictable error shapes.

Example:

```csharp
app.MapPost("/api/products", CreateProduct)
   .Produces<ProductResponse>(StatusCodes.Status201Created)
   .ProducesValidationProblem()
   .ProducesProblem(StatusCodes.Status409Conflict)
   .ProducesProblem(StatusCodes.Status500InternalServerError);
```

A typical `ProblemDetails` response contains:

- `type`
- `title`
- `status`
- `detail`
- `instance`

Validation errors are often represented by `ValidationProblemDetails`, which includes field-level errors.

Best practices:

- Use a consistent error format across the API.
- Document expected error responses.
- Avoid leaking stack traces or sensitive internal details.
- Include helpful error titles and details.
- Use trace IDs or correlation IDs for debugging.

### Content Types and Content Negotiation

OpenAPI metadata should describe the content types an endpoint consumes and produces.

For JSON APIs, common metadata includes:

```csharp
app.MapPost("/api/customers", CreateCustomer)
   .Accepts<CreateCustomerRequest>("application/json")
   .Produces<CustomerResponse>(StatusCodes.Status201Created, "application/json");
```

For controller-based APIs:

```csharp
[Consumes("application/json")]
[Produces("application/json")]
[HttpPost]
public async Task<ActionResult<CustomerResponse>> Create(CreateCustomerRequest request)
{
    // ...
}
```

This helps API consumers understand what format to send and what format to expect.

### XML Documentation Comments

XML documentation comments can improve OpenAPI descriptions without placing every detail in attributes or endpoint builder calls.

Example:

```csharp
/// <summary>
/// Gets a product by ID.
/// </summary>
/// <param name="id">The product ID.</param>
/// <returns>The product if it exists.</returns>
[HttpGet("{id:int}")]
public async Task<ActionResult<ProductResponse>> GetById(int id)
{
    // ...
}
```

XML documentation comments are useful for:

- Endpoint summaries
- Parameter descriptions
- DTO property descriptions
- Return value descriptions
- Developer-facing explanations

However, comments should not replace clear contracts. The actual request and response types should still be accurate.

### Excluding Internal Endpoints

Not every endpoint should appear in public API documentation.

Examples of endpoints that may be excluded:

- Internal diagnostics endpoints
- Infrastructure health endpoints
- Admin-only operational endpoints
- Deprecated endpoints hidden from public consumers
- Development-only endpoints

Minimal API example:

```csharp
app.MapGet("/internal/cache/stats", GetCacheStats)
   .ExcludeFromDescription();
```

Controller example:

```csharp
[ApiExplorerSettings(IgnoreApi = true)]
[Route("internal/cache")]
public class InternalCacheController : ControllerBase
{
    [HttpGet("stats")]
    public IActionResult GetStats()
    {
        // ...
        return Ok();
    }
}
```

Excluding endpoints improves discoverability because consumers only see what they are supposed to use.

### Securing OpenAPI Documents

OpenAPI documents can reveal endpoint paths, request schemas, response schemas, and security behavior. In some systems, this information should not be publicly exposed.

Common approaches include:

- Expose OpenAPI only in development.
- Protect OpenAPI endpoints with authentication.
- Expose public and internal OpenAPI documents separately.
- Remove internal endpoints from public documentation.
- Avoid including sensitive implementation details in descriptions.
- Use API gateways or developer portals for controlled access.

Example:

```csharp
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
```

Example with authorization:

```csharp
app.MapOpenApi()
   .RequireAuthorization("ApiDocumentationReaders");
```

The right approach depends on whether the API is public, partner-facing, internal, or private.

### Multiple OpenAPI Documents

Large APIs may generate multiple OpenAPI documents.

Examples:

- Public API document
- Internal API document
- Admin API document
- Versioned API documents
- Partner-specific API documents

This helps avoid overwhelming consumers and reduces the risk of exposing internal contracts.

A public document should include only stable consumer-facing endpoints. An internal document may include operational endpoints used by internal tools.

### OpenAPI Transformers and Customization

Generated OpenAPI documents often need customization beyond endpoint metadata.

Common customization needs include:

- Adding API title, version, and description
- Adding security schemes
- Adding global error responses
- Modifying operation IDs
- Applying naming conventions
- Hiding internal fields
- Adding server URLs
- Adding custom extensions used by gateways or portals

A simplified example of customizing OpenAPI configuration:

```csharp
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, cancellationToken) =>
    {
        document.Info.Title = "Products API";
        document.Info.Version = "v1";
        document.Info.Description = "API for managing products.";

        return Task.CompletedTask;
    });
});
```

Customization should be used carefully. It should improve the accuracy and usefulness of the contract, not hide inconsistencies in endpoint design.

### OpenAPI and API Versioning

Versioning is important when APIs evolve over time.

OpenAPI documents can support versioning by producing separate documents for different API versions, such as:

- `/openapi/v1.json`
- `/openapi/v2.json`

Good versioning habits include:

- Do not break existing consumers without a migration path.
- Keep operation IDs stable within a version.
- Mark deprecated endpoints clearly.
- Publish separate documents for major versions.
- Document version-specific behavior.
- Avoid mixing unrelated versions in one confusing document.

Example endpoint metadata for deprecation:

```csharp
app.MapGet("/api/v1/products", GetProductsV1)
   .WithName("GetProductsV1")
   .WithSummary("Gets products using the legacy v1 contract")
   .WithTags("Products")
   .WithOpenApi(operation =>
   {
       operation.Deprecated = true;
       return operation;
   });
```

Deprecation metadata helps consumers plan migrations.

### OpenAPI and Client Generation

One of the major benefits of OpenAPI is client generation. Tools can generate TypeScript, C#, Java, or other clients from the OpenAPI document.

This makes contract accuracy critical. If the OpenAPI document says an endpoint returns `ProductResponse`, but the actual runtime response returns a different shape, generated clients may fail.

Common generated-client problems include:

- Missing response metadata
- Incorrect nullable properties
- Inconsistent operation IDs
- Overly generic response types such as `object`
- Undocumented error responses
- Exposing entity models instead of DTOs
- Inconsistent route naming
- Missing authentication metadata

To support client generation, APIs should use explicit DTOs and precise metadata.

### OpenAPI and Minimal API Typed Results

Minimal APIs can improve OpenAPI accuracy by using typed results.

Example:

```csharp
static async Task<Results<Ok<ProductResponse>, NotFound>> GetProductById(
    int id,
    IProductService productService,
    CancellationToken cancellationToken)
{
    var product = await productService.GetByIdAsync(id, cancellationToken);

    return product is null
        ? TypedResults.NotFound()
        : TypedResults.Ok(product);
}
```

Typed results help the framework understand possible response types. This can reduce the need for extra manual response metadata, although explicit metadata may still be useful for readability and documentation clarity.

### API Explorer

API Explorer is the ASP.NET Core infrastructure that exposes information about API endpoints to documentation generators and other tools.

It acts as a bridge between the application endpoint definitions and tools that need to discover API behavior.

API Explorer can describe:

- Controller actions
- Minimal API endpoints
- HTTP methods
- Routes
- Parameters
- Request formats
- Response formats
- Metadata attributes

When an endpoint is excluded from API Explorer, documentation tools usually do not include it in the generated OpenAPI document.

### Good API Discoverability Habits

Good API discoverability is not only about enabling OpenAPI. It is about designing APIs so consumers can understand them quickly and correctly.

Best practices include:

- Use consistent route naming.
- Use meaningful endpoint names and operation IDs.
- Group endpoints with clear tags.
- Use DTOs instead of database entities.
- Document all meaningful success and error status codes.
- Use `ProblemDetails` for consistent errors.
- Add summaries and descriptions for non-obvious behavior.
- Include request and response content types.
- Hide internal endpoints from public documentation.
- Secure API documentation when appropriate.
- Keep OpenAPI documents versioned.
- Validate generated OpenAPI documents in CI/CD when possible.
- Review OpenAPI diffs before releasing breaking changes.
- Keep documentation close to the code so it stays current.

### Common Mistakes

Common mistakes include:

- Enabling Swagger UI but not adding accurate response metadata.
- Returning `object`, `dynamic`, or anonymous objects from endpoints.
- Returning EF Core entities directly.
- Forgetting to document `404`, `400`, `401`, `403`, and `409` responses.
- Using generic operation IDs like `Get` or `Post`.
- Mixing public and internal endpoints in the same public document.
- Exposing OpenAPI documents publicly without considering security.
- Letting generated clients depend on unstable operation IDs.
- Allowing documentation to drift from actual runtime behavior.
- Ignoring nullable reference types, causing inaccurate schema nullability.
- Not documenting authentication requirements.
- Not documenting validation errors.
- Using route names and tags inconsistently.

### Practical Production Example

A production-style endpoint should describe the contract clearly.

```csharp
public sealed record CreateCustomerRequest(
    string FirstName,
    string LastName,
    string Email);

public sealed record CustomerResponse(
    int Id,
    string FullName,
    string Email);

app.MapPost("/api/customers", async (
        CreateCustomerRequest request,
        ICustomerService customerService,
        CancellationToken cancellationToken) =>
    {
        var customer = await customerService.CreateAsync(request, cancellationToken);

        return TypedResults.Created(
            $"/api/customers/{customer.Id}",
            customer);
    })
    .WithName("CreateCustomer")
    .WithSummary("Creates a customer")
    .WithDescription("Creates a new customer and returns the created customer resource.")
    .WithTags("Customers")
    .Accepts<CreateCustomerRequest>("application/json")
    .Produces<CustomerResponse>(StatusCodes.Status201Created, "application/json")
    .ProducesValidationProblem()
    .ProducesProblem(StatusCodes.Status409Conflict)
    .ProducesProblem(StatusCodes.Status500InternalServerError)
    .RequireAuthorization();
```

This endpoint is discoverable because it makes the important contract details explicit:

- The operation name is stable.
- The endpoint is grouped under `Customers`.
- The request DTO is clear.
- The success response type and status code are clear.
- Validation and error responses are documented.
- Authorization is attached to the endpoint.

### Trade-Offs

OpenAPI generation has trade-offs.

Benefits:

- Improves API documentation.
- Helps frontend and partner integration.
- Enables generated clients.
- Supports automated contract testing.
- Improves onboarding.
- Makes API review easier.
- Helps align implementation and contract.

Costs and risks:

- Metadata can become noisy.
- Documentation can drift if endpoints are poorly modeled.
- Generated clients may break if operation IDs change.
- Public docs can expose more information than intended.
- Large APIs can produce difficult-to-navigate documents.
- Customization can hide design problems if overused.
- Versioning adds maintenance overhead.

The best approach is to treat the OpenAPI document as part of the API contract, not as an afterthought.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

<!-- question:start:openapi-generation-endpoint-metadata-api-discoverability-beginner-q01 -->
#### 1. What is OpenAPI, and why is it useful in ASP.NET Core APIs?

<!-- question-id:openapi-generation-endpoint-metadata-api-discoverability-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

OpenAPI is a standard format for describing HTTP APIs. It documents paths, HTTP methods, parameters, request bodies, response bodies, status codes, content types, and security requirements.

In ASP.NET Core, OpenAPI is useful because it turns API endpoints into a machine-readable contract. This contract can be shown in tools such as Swagger UI, imported into API gateways, used to generate client SDKs, used by QA for testing, and shared with frontend or partner teams.

A strong answer should explain that OpenAPI is not just a documentation page. It is a contract that helps different systems and teams integrate safely.

##### Key Points to Mention

- OpenAPI describes HTTP APIs in a standard format.
- It documents routes, methods, parameters, request bodies, responses, and security.
- It improves API discoverability.
- It supports interactive documentation and client generation.
- Inaccurate OpenAPI documents can cause integration bugs.

<!-- question:end:openapi-generation-endpoint-metadata-api-discoverability-beginner-q01 -->

<!-- question:start:openapi-generation-endpoint-metadata-api-discoverability-beginner-q02 -->
#### 2. What is the difference between OpenAPI and Swagger?

<!-- question-id:openapi-generation-endpoint-metadata-api-discoverability-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

OpenAPI is the specification used to describe HTTP APIs. Swagger is commonly used to refer to tools around that specification, such as Swagger UI, Swagger Editor, and packages that generate or display OpenAPI documents.

In many projects, people say "Swagger" when they mean the OpenAPI document or the interactive API documentation page. In an interview, it is better to be precise: OpenAPI is the standard, while Swagger UI is one common tool for rendering and testing the API contract.

##### Key Points to Mention

- OpenAPI is the API description standard.
- Swagger is commonly associated with tooling.
- Swagger UI displays and tests OpenAPI documents.
- Developers often use the terms interchangeably, but they are not exactly the same.

<!-- question:end:openapi-generation-endpoint-metadata-api-discoverability-beginner-q02 -->

<!-- question:start:openapi-generation-endpoint-metadata-api-discoverability-beginner-q03 -->
#### 3. How do you enable OpenAPI generation in an ASP.NET Core application?

<!-- question-id:openapi-generation-endpoint-metadata-api-discoverability-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

In modern ASP.NET Core, OpenAPI generation can be enabled by registering OpenAPI services and mapping an OpenAPI endpoint.

Example:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.Run();
```

Many applications also use Swagger UI or another visual tool to display the generated OpenAPI document. For development, it is common to expose the document and UI only in the development environment.

##### Key Points to Mention

- Register OpenAPI services.
- Map an endpoint that serves the generated document.
- Often expose documentation only in development or behind authorization.
- Swagger UI or another UI can display the OpenAPI document.
- OpenAPI generation depends on endpoint metadata.

<!-- question:end:openapi-generation-endpoint-metadata-api-discoverability-beginner-q03 -->

<!-- question:start:openapi-generation-endpoint-metadata-api-discoverability-beginner-q04 -->
#### 4. What is endpoint metadata?

<!-- question-id:openapi-generation-endpoint-metadata-api-discoverability-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Endpoint metadata is descriptive information attached to an ASP.NET Core endpoint. It tells the framework and tools how the endpoint should behave or be described.

Examples include the endpoint name, tags, summary, description, request body type, response types, content types, authorization requirements, CORS policies, rate limiting policies, and whether the endpoint should appear in API documentation.

OpenAPI generation reads this metadata to build a more accurate API document.

##### Key Points to Mention

- Metadata is attached to endpoints.
- It can describe behavior and documentation.
- OpenAPI tools use metadata to generate accurate API contracts.
- Metadata can come from attributes, endpoint extension methods, return types, and route handler signatures.

<!-- question:end:openapi-generation-endpoint-metadata-api-discoverability-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

<!-- question:start:openapi-generation-endpoint-metadata-api-discoverability-intermediate-q01 -->
#### 1. How do Minimal APIs provide metadata for OpenAPI generation?

<!-- question-id:openapi-generation-endpoint-metadata-api-discoverability-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Minimal APIs provide metadata through route handler signatures, return types, attributes, and endpoint builder extension methods.

For example, route parameters and request body types can be inferred from the handler signature. Additional metadata can be added with methods such as `WithName`, `WithSummary`, `WithDescription`, `WithTags`, `Accepts`, `Produces`, `ProducesProblem`, and `ProducesValidationProblem`.

Example:

```csharp
app.MapGet("/api/products/{id:int}", GetProductById)
   .WithName("GetProductById")
   .WithSummary("Gets a product by ID")
   .WithTags("Products")
   .Produces<ProductResponse>(StatusCodes.Status200OK)
   .Produces(StatusCodes.Status404NotFound);
```

This makes the generated OpenAPI document more accurate because it describes both the successful response and the not-found case.

##### Key Points to Mention

- Minimal APIs infer some metadata from handler signatures.
- Explicit metadata improves generated documentation.
- `WithName` affects operation IDs.
- `WithTags` groups endpoints.
- `Produces` and `Accepts` describe response and request contracts.
- Typed results can also improve response metadata.

<!-- question:end:openapi-generation-endpoint-metadata-api-discoverability-intermediate-q01 -->

<!-- question:start:openapi-generation-endpoint-metadata-api-discoverability-intermediate-q02 -->
#### 2. How do controller-based APIs provide metadata for OpenAPI generation?

<!-- question-id:openapi-generation-endpoint-metadata-api-discoverability-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Controller-based APIs usually provide metadata through attributes and action return types. Common attributes include `[ApiController]`, `[Route]`, `[HttpGet]`, `[HttpPost]`, `[Produces]`, `[Consumes]`, `[ProducesResponseType]`, `[EndpointSummary]`, `[EndpointDescription]`, and `[ApiExplorerSettings]`.

Example:

```csharp
[HttpGet("{id:int}", Name = "GetProductById")]
[EndpointSummary("Gets a product by ID")]
[ProducesResponseType<ProductResponse>(StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public async Task<ActionResult<ProductResponse>> GetById(int id)
{
    var product = await _service.GetByIdAsync(id);

    return product is null
        ? NotFound()
        : Ok(product);
}
```

The generated OpenAPI document can then show the route, operation name, response type, and possible status codes.

##### Key Points to Mention

- Controller metadata is commonly attribute-based.
- `[ProducesResponseType]` documents possible responses.
- `[Consumes]` and `[Produces]` document content types.
- `[ApiExplorerSettings(IgnoreApi = true)]` can hide endpoints.
- `ActionResult<T>` can help infer successful response types.

<!-- question:end:openapi-generation-endpoint-metadata-api-discoverability-intermediate-q02 -->

<!-- question:start:openapi-generation-endpoint-metadata-api-discoverability-intermediate-q03 -->
#### 3. Why should APIs use DTOs instead of exposing EF Core entities directly in OpenAPI contracts?

<!-- question-id:openapi-generation-endpoint-metadata-api-discoverability-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

APIs should use DTOs because the API contract should be stable, intentional, and separate from internal persistence models. EF Core entities often contain navigation properties, internal fields, persistence-specific attributes, or fields that should not be exposed to clients.

If entities are exposed directly, the generated OpenAPI schema can accidentally change when the database model changes. This can break clients or leak sensitive data.

DTOs allow the API to control exactly what the client can send and receive.

##### Key Points to Mention

- DTOs separate API contracts from persistence models.
- Entities may contain sensitive or internal fields.
- Entity changes can accidentally break API consumers.
- DTOs make OpenAPI schemas cleaner and more intentional.
- Different operations often need different DTOs.

<!-- question:end:openapi-generation-endpoint-metadata-api-discoverability-intermediate-q03 -->

<!-- question:start:openapi-generation-endpoint-metadata-api-discoverability-intermediate-q04 -->
#### 4. What are operation IDs, and why do they matter?

<!-- question-id:openapi-generation-endpoint-metadata-api-discoverability-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

An operation ID is a unique name for an API operation in the OpenAPI document. It is often used by client generation tools to create method names.

Operation IDs matter because they affect generated SDKs and developer experience. If operation IDs are generic, duplicated, or unstable, generated clients may have confusing method names or breaking changes.

Good operation IDs are unique, stable, descriptive, and action-oriented.

Examples:

```csharp
app.MapGet("/api/customers/{id:int}", GetCustomerById)
   .WithName("GetCustomerById");
```

Good operation IDs include `GetCustomerById`, `CreateOrder`, and `CancelSubscription`. Poor operation IDs include `Get`, `Post`, or `Endpoint1`.

##### Key Points to Mention

- Operation IDs uniquely identify operations.
- Client generators often use them as method names.
- They should be stable and descriptive.
- Changing them can break generated clients.
- `WithName` is commonly used for Minimal APIs.

<!-- question:end:openapi-generation-endpoint-metadata-api-discoverability-intermediate-q04 -->

<!-- question:start:openapi-generation-endpoint-metadata-api-discoverability-intermediate-q05 -->
#### 5. How should an API document validation and error responses?

<!-- question-id:openapi-generation-endpoint-metadata-api-discoverability-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

An API should document validation and error responses explicitly. For validation errors, `ValidationProblemDetails` is commonly used. For general errors, `ProblemDetails` provides a consistent error shape.

Minimal API example:

```csharp
app.MapPost("/api/products", CreateProduct)
   .Produces<ProductResponse>(StatusCodes.Status201Created)
   .ProducesValidationProblem()
   .ProducesProblem(StatusCodes.Status409Conflict)
   .ProducesProblem(StatusCodes.Status500InternalServerError);
```

Controller example:

```csharp
[ProducesResponseType<ProductResponse>(StatusCodes.Status201Created)]
[ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
public async Task<ActionResult<ProductResponse>> Create(CreateProductRequest request)
{
    // ...
}
```

This helps clients implement predictable error handling.

##### Key Points to Mention

- Document common error status codes.
- Use `ProblemDetails` for consistent errors.
- Use `ValidationProblemDetails` for validation errors.
- Do not document only the happy path.
- Accurate error metadata improves client reliability.

<!-- question:end:openapi-generation-endpoint-metadata-api-discoverability-intermediate-q05 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

<!-- question:start:openapi-generation-endpoint-metadata-api-discoverability-advanced-q01 -->
#### 1. How would you design OpenAPI documentation for a large enterprise API?

<!-- question-id:openapi-generation-endpoint-metadata-api-discoverability-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

For a large enterprise API, the OpenAPI strategy should be treated as part of API governance.

A strong design would include separate documents for public, internal, admin, or versioned APIs when necessary. Endpoints should be grouped with meaningful tags, use stable operation IDs, expose DTO-based contracts, document all important status codes, use consistent error responses, and hide internal endpoints from public documentation.

The OpenAPI document should be reviewed as part of the release process. In CI/CD, the team can generate the document, check it into an artifact store, compare it with the previous version, detect breaking changes, and generate clients or contract tests.

The documentation should also be secured if it contains non-public API details.

##### Key Points to Mention

- Treat OpenAPI as an API contract.
- Use separate documents for different audiences or versions.
- Use DTOs and stable operation IDs.
- Document errors and authentication.
- Hide internal endpoints.
- Validate or diff OpenAPI documents in CI/CD.
- Secure documentation when appropriate.

<!-- question:end:openapi-generation-endpoint-metadata-api-discoverability-advanced-q01 -->

<!-- question:start:openapi-generation-endpoint-metadata-api-discoverability-advanced-q02 -->
#### 2. What problems can happen when OpenAPI documentation drifts from runtime behavior?

<!-- question-id:openapi-generation-endpoint-metadata-api-discoverability-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Documentation drift happens when the OpenAPI document no longer matches the actual API behavior. This can happen when developers change endpoint behavior but forget to update metadata, return anonymous objects, omit response metadata, expose inconsistent error shapes, or customize the OpenAPI document manually without aligning the implementation.

Problems include broken generated clients, frontend integration bugs, incorrect QA tests, incorrect API gateway configuration, and confusion for consumers.

To reduce drift, teams should keep metadata close to endpoints, use strongly typed DTOs, use typed results where possible, document all response paths, generate OpenAPI in CI/CD, and compare OpenAPI changes during pull requests.

##### Key Points to Mention

- Drift means the contract does not match runtime behavior.
- It causes integration bugs and broken generated clients.
- It often happens when response metadata is incomplete.
- Strongly typed DTOs and typed results reduce drift.
- CI/CD validation and OpenAPI diffs help catch drift.

<!-- question:end:openapi-generation-endpoint-metadata-api-discoverability-advanced-q02 -->

<!-- question:start:openapi-generation-endpoint-metadata-api-discoverability-advanced-q03 -->
#### 3. How should OpenAPI documents be secured in production?

<!-- question-id:openapi-generation-endpoint-metadata-api-discoverability-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

OpenAPI documents can expose endpoint paths, schemas, validation behavior, and security requirements. For public APIs, publishing OpenAPI may be intentional. For private or internal APIs, the document should usually be restricted.

Common approaches include enabling OpenAPI only in development, protecting the OpenAPI endpoint with authorization, exposing documentation through a developer portal, generating separate public and internal documents, and excluding sensitive endpoints from the public document.

Example:

```csharp
app.MapOpenApi()
   .RequireAuthorization("ApiDocumentationReaders");
```

The decision depends on whether the API is public, partner-facing, internal, or private.

##### Key Points to Mention

- OpenAPI can reveal useful information about the API.
- Public APIs may intentionally expose documentation.
- Internal APIs often restrict documentation access.
- Use environment checks, authorization, or developer portals.
- Exclude internal endpoints from public documents.
- Do not include sensitive implementation details in descriptions.

<!-- question:end:openapi-generation-endpoint-metadata-api-discoverability-advanced-q03 -->

<!-- question:start:openapi-generation-endpoint-metadata-api-discoverability-advanced-q04 -->
#### 4. How do OpenAPI documents help with client generation, and what makes a document client-generation friendly?

<!-- question-id:openapi-generation-endpoint-metadata-api-discoverability-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

OpenAPI documents can be used by tools to generate strongly typed clients in languages such as TypeScript, C#, Java, or Kotlin. This reduces manual client code and helps consumers stay aligned with the API contract.

A client-generation friendly document has stable operation IDs, explicit request and response DTOs, accurate nullability, documented error responses, consistent content types, clear route parameters, and no ambiguous schemas such as `object` or `dynamic`.

If the OpenAPI document is inaccurate, generated clients may compile but fail at runtime, or they may generate confusing method names and weak types.

##### Key Points to Mention

- OpenAPI supports generated client SDKs.
- Operation IDs often become client method names.
- Explicit DTOs improve generated types.
- Accurate nullability matters.
- Avoid `object`, `dynamic`, anonymous objects, and entity exposure.
- Document errors and content types.

<!-- question:end:openapi-generation-endpoint-metadata-api-discoverability-advanced-q04 -->

<!-- question:start:openapi-generation-endpoint-metadata-api-discoverability-advanced-q05 -->
#### 5. How would you handle API versioning with OpenAPI?

<!-- question-id:openapi-generation-endpoint-metadata-api-discoverability-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

For versioned APIs, each major API version should usually have a clear OpenAPI document. This helps consumers understand the contract they are using and prevents unrelated versions from being mixed into a confusing document.

A common approach is to generate documents such as `v1` and `v2`, group endpoints by API version, mark deprecated endpoints, and keep operation IDs stable within each version.

The team should also define a release process for OpenAPI changes. Breaking changes should be reviewed carefully, and clients should receive migration guidance.

##### Key Points to Mention

- Use separate OpenAPI documents for major versions.
- Keep versioned contracts clear and stable.
- Mark deprecated operations.
- Avoid mixing unrelated API versions.
- Review breaking changes.
- Use OpenAPI diffs to help detect contract changes.

<!-- question:end:openapi-generation-endpoint-metadata-api-discoverability-advanced-q05 -->

<!-- question:start:openapi-generation-endpoint-metadata-api-discoverability-advanced-q06 -->
#### 6. How would you customize generated OpenAPI output in ASP.NET Core?

<!-- question-id:openapi-generation-endpoint-metadata-api-discoverability-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

Generated OpenAPI output can be customized by adding endpoint metadata, XML documentation comments, API conventions, and document or operation transformers.

For simple changes, it is usually better to add accurate endpoint metadata directly, such as `WithSummary`, `WithDescription`, `WithTags`, `Produces`, and `Accepts`.

For global changes, such as adding API title, version, security schemes, global response conventions, or custom extensions, a transformer or generator configuration is more appropriate.

Customization should improve accuracy and usability. It should not be used to hide poor endpoint design or make the document say something different from the runtime behavior.

##### Key Points to Mention

- Start with accurate endpoint metadata.
- Use XML comments for summaries and descriptions.
- Use transformers for global document customization.
- Add security schemes and API information when needed.
- Avoid making the document inconsistent with actual behavior.
- Keep customization maintainable.

<!-- question:end:openapi-generation-endpoint-metadata-api-discoverability-advanced-q06 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
