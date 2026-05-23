---
id: endpoint-routing-and-route-matching-in-aspnet-core
topic: API design and implementation
subtopic: Endpoint routing and route matching 
category: .NET
---


## Overview

Endpoint routing is the ASP.NET Core system that matches incoming HTTP requests to executable endpoints such as controller actions, minimal API handlers, Razor Pages, SignalR hubs, gRPC services, and health check endpoints.

In an API, routing answers questions like:

- Which handler should process `GET /api/products/10`?
- Should `/api/products/search` go to a search endpoint or be interpreted as an `{id}` parameter?
- Should `/files/images/2026/logo.png` be handled by a catch-all route?
- Should an invalid route parameter return `404 Not Found` or should model validation return `400 Bad Request`?
- What happens when two routes could both match the same URL?

This topic matters because routing is one of the first design decisions in an ASP.NET Core application. A good route design makes an API predictable, stable, secure, and easy to consume. A poor route design can create ambiguous endpoints, incorrect authorization behavior, broken link generation, hard-to-debug `404` responses, and inconsistent API contracts.

In interviews, this topic is important because it connects several practical ASP.NET Core skills:

- API design
- Controller routing
- Minimal API routing
- Middleware ordering
- Authorization and endpoint metadata
- Model binding
- Route constraints
- REST-style URL design
- Debugging ambiguous or unexpected route matches

A strong candidate should understand not only how to write routes, but also how ASP.NET Core chooses the best route, when to use constraints, when optional parameters are risky, and why catch-all routes should be designed carefully.

## Core Concepts

### Endpoint Routing

Endpoint routing is the modern ASP.NET Core routing model. It separates route matching from endpoint execution.

A route endpoint usually contains:

- A route pattern, such as `/api/products/{id:int}`
- A request delegate or action method to execute
- Metadata, such as HTTP method, authorization requirements, CORS policy, filters, endpoint name, or OpenAPI information

Example using minimal APIs:

```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/api/products/{id:int}", (int id) =>
{
    return Results.Ok(new { Id = id, Name = "Keyboard" });
})
.WithName("GetProductById")
.RequireAuthorization();

app.Run();
```

In this example:

- `/api/products/{id:int}` is the route pattern.
- `{id:int}` captures a route value named `id`.
- `:int` is a route constraint.
- `MapGet` adds HTTP method metadata for `GET`.
- `RequireAuthorization` adds authorization metadata.
- `.WithName(...)` gives the endpoint a name useful for link generation.

Endpoint routing is used by both minimal APIs and MVC controllers. The definition style is different, but the routing system still selects an endpoint based on route patterns, HTTP method metadata, constraints, and precedence.

### Route Matching Pipeline

ASP.NET Core route matching can be understood as a filtering process.

For an incoming request, ASP.NET Core generally:

1. Compares the request path against available route templates.
2. Removes candidates that fail route constraints.
3. Applies endpoint selection policies, such as HTTP method matching.
4. Chooses the highest-priority endpoint.
5. Throws an ambiguity error if multiple endpoints have the same priority and no single best match exists.

Example:

```csharp
app.MapGet("/api/products/list", () => "Product list");
app.MapGet("/api/products/{id:int}", (int id) => $"Product {id}");
```

Requests:

```text
GET /api/products/list  -> matches /api/products/list
GET /api/products/10    -> matches /api/products/{id:int}
GET /api/products/abc   -> no match for {id:int}, usually 404
```

The literal route `/api/products/list` is more specific than the parameter route `/api/products/{id:int}`.

### Endpoint Routing and Middleware Ordering

Routing is closely related to middleware ordering.

A common ASP.NET Core pipeline looks like this:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuthentication();
builder.Services.AddAuthorization();

var app = builder.Build();

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
```

In modern minimal-hosting ASP.NET Core applications, the framework automatically places routing and endpoint execution around mapped endpoints in common scenarios. However, understanding the conceptual order is still important:

```csharp
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.UseEndpoints(endpoints =>
{
    endpoints.MapControllers();
});
```

The important idea is:

- Middleware before routing cannot see the selected endpoint.
- Middleware after routing and before endpoint execution can inspect endpoint metadata.
- Authorization middleware must run after routing has selected an endpoint so it can read endpoint authorization metadata.
- Endpoint execution is terminal when an endpoint is matched.

This is why endpoint metadata matters. For example:

```csharp
app.MapGet("/admin/reports", () => "Admin reports")
   .RequireAuthorization("AdminOnly");
```

The route itself defines authorization metadata. The authorization middleware reads that metadata before the endpoint runs.

### Attribute Routing

Attribute routing defines routes directly on controllers and actions.

Example:

```csharp
[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll()
    {
        return Ok();
    }

    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        return Ok(new { Id = id });
    }

    [HttpPost]
    public IActionResult Create(CreateProductRequest request)
    {
        return CreatedAtAction(nameof(GetById), new { id = 10 }, request);
    }
}
```

Resulting routes:

```text
GET  /api/products
GET  /api/products/10
POST /api/products
```

In attribute routing:

- The route on the controller is usually a shared prefix.
- The route on the action is appended to the controller route.
- HTTP verb attributes such as `[HttpGet]`, `[HttpPost]`, and `[HttpDelete]` also define route templates.
- Controller and action names do not affect route matching unless token replacement is used.

### Combining Controller and Action Routes

A controller-level route can be combined with an action-level route.

```csharp
[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        return Ok();
    }
}
```

The final route is:

```text
GET /api/orders/{id:int}
```

If an action route starts with `/` or `~/`, it becomes an absolute route and is not combined with the controller route.

```csharp
[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    [HttpGet("/health/orders")]
    public IActionResult Health()
    {
        return Ok("Orders API is healthy");
    }
}
```

The final route is:

```text
GET /health/orders
```

not:

```text
GET /api/orders/health/orders
```

This can be useful, but it can also surprise developers during refactoring.

### HTTP Verb Attributes

HTTP verb attributes restrict a route to a specific HTTP method.

Common attributes include:

- `[HttpGet]`
- `[HttpPost]`
- `[HttpPut]`
- `[HttpPatch]`
- `[HttpDelete]`
- `[HttpHead]`

Example:

```csharp
[ApiController]
[Route("api/customers")]
public class CustomersController : ControllerBase
{
    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        return Ok();
    }

    [HttpDelete("{id:int}")]
    public IActionResult Delete(int id)
    {
        return NoContent();
    }
}
```

Both actions use the same route template, but different HTTP methods:

```text
GET    /api/customers/5
DELETE /api/customers/5
```

This is a common REST-style API design.

### Route Templates

A route template describes the URL pattern an endpoint can match.

Examples:

```text
api/products
api/products/{id}
api/products/{id:int}
api/orders/{orderId:int}/items/{itemId:int}
files/{**path}
```

A route template can contain:

- Literal segments
- Route parameters
- Optional parameters
- Default values
- Constraints
- Catch-all parameters
- Complex segments
- Parameter transformers

### Literal Segments

Literal segments must match the URL path text.

```csharp
app.MapGet("/api/products/search", () => "Search products");
```

This route matches:

```text
GET /api/products/search
```

It does not match:

```text
GET /api/products/10
GET /api/products/SearchByName
```

Literal routes are more specific than parameter routes, so they usually win when both could match.

### Route Parameters

A route parameter captures part of the URL into a named value.

```csharp
app.MapGet("/api/products/{id}", (string id) =>
{
    return Results.Ok($"Product id: {id}");
});
```

For:

```text
GET /api/products/abc123
```

`id` is captured as:

```text
abc123
```

In controllers:

```csharp
[HttpGet("{id}")]
public IActionResult GetById(string id)
{
    return Ok(id);
}
```

Route parameters are commonly used for resource identifiers.

### Typed Route Parameters in Handlers

In minimal APIs and controllers, route values can be bound to typed parameters.

```csharp
app.MapGet("/api/products/{id:int}", (int id) =>
{
    return Results.Ok(id);
});
```

The route constraint ensures that only integer-looking values match. The handler parameter is then bound as an `int`.

Without the constraint:

```csharp
app.MapGet("/api/products/{id}", (int id) =>
{
    return Results.Ok(id);
});
```

a non-integer path may still match the route pattern, then fail during binding or validation depending on the endpoint style and configuration. For public APIs, route constraints make the intended URL shape clearer.

### Route Constraints

Route constraints limit which URL values can match a route parameter.

Example:

```csharp
[HttpGet("{id:int}")]
public IActionResult GetById(int id)
{
    return Ok();
}

[HttpGet("{slug:alpha}")]
public IActionResult GetBySlug(string slug)
{
    return Ok();
}
```

Possible behavior:

```text
GET /api/products/123       -> GetById
GET /api/products/keyboard  -> GetBySlug
GET /api/products/abc123    -> no match
```

Common route constraints include:

| Constraint | Example | Meaning |
|---|---|---|
| `int` | `{id:int}` | Must be an integer |
| `long` | `{id:long}` | Must be a long integer |
| `guid` | `{id:guid}` | Must be a GUID |
| `alpha` | `{name:alpha}` | Must contain alphabetic characters |
| `bool` | `{active:bool}` | Must be Boolean-like |
| `datetime` | `{date:datetime}` | Must be date/time-like |
| `decimal` | `{amount:decimal}` | Must be decimal-like |
| `min` | `{id:min(1)}` | Must be at least a value |
| `max` | `{id:max(100)}` | Must be at most a value |
| `range` | `{id:range(1,100)}` | Must be in a range |
| `length` | `{code:length(3)}` | Must have exact length |
| `minlength` | `{name:minlength(3)}` | Must have minimum length |
| `maxlength` | `{name:maxlength(50)}` | Must have maximum length |
| `regex` | `{code:regex(^[A-Z]{3}$)}` | Must match a regular expression |

Multiple constraints can be combined:

```csharp
[HttpGet("{id:int:min(1)}")]
public IActionResult GetById(int id)
{
    return Ok();
}
```

This route requires `id` to be an integer and at least `1`.

### Constraints Are Not Input Validation

A common interview mistake is saying route constraints are validation.

They are not a replacement for request validation.

Route constraints are mainly for route disambiguation and URL shape matching. If a constraint fails, the route does not match, and the client typically receives `404 Not Found`.

Validation should return `400 Bad Request` with a useful error message.

Example:

```csharp
[HttpGet("{id:int:min(1)}")]
public IActionResult GetById(int id)
{
    return Ok();
}
```

Request:

```text
GET /api/products/abc
```

This does not match the route because `abc` is not an integer. A `404` response is expected.

Request:

```text
GET /api/products/0
```

This does not match if `min(1)` is used. A `404` response is expected.

If the API needs to tell the client that `0` is invalid input, handle it through validation instead:

```csharp
[HttpGet("{id:int}")]
public IActionResult GetById(int id)
{
    if (id <= 0)
    {
        return BadRequest("Product id must be greater than zero.");
    }

    return Ok();
}
```

### Optional Parameters

Optional route parameters are marked with `?`.

```csharp
[HttpGet("products/{id?}")]
public IActionResult GetProduct(int? id)
{
    if (id is null)
    {
        return Ok("All products");
    }

    return Ok($"Product {id}");
}
```

Matches:

```text
GET /products
GET /products/10
```

Optional parameters are useful in some MVC-style pages, but they should be used carefully in APIs.

For APIs, it is often clearer to define separate endpoints:

```csharp
[HttpGet("products")]
public IActionResult GetProducts()
{
    return Ok();
}

[HttpGet("products/{id:int}")]
public IActionResult GetProductById(int id)
{
    return Ok();
}
```

This gives each endpoint a clear purpose and avoids overloaded route behavior.

### Optional Parameters vs Default Values

Optional parameters and default values are similar but not the same.

Optional parameter:

```text
{category?}
```

A value is produced only when the segment exists.

Default value:

```text
{category=all}
```

A value is produced even when the segment does not exist.

Example:

```csharp
app.MapGet("/products/{category=all}", (string category) =>
{
    return Results.Ok($"Category: {category}");
});
```

Request:

```text
GET /products
```

The route value is:

```text
category = all
```

For APIs, default route values are more common in conventional MVC routes than in explicit REST-style endpoints.

### Catch-All Routes

A catch-all route captures the rest of the URL path.

```csharp
app.MapGet("/files/{**path}", (string? path) =>
{
    return Results.Ok($"Requested file path: {path}");
});
```

Matches:

```text
GET /files/readme.txt
GET /files/images/products/keyboard.png
GET /files/
```

Catch-all parameters are useful for:

- File path routing
- CMS pages
- Slug-based pages
- Documentation routes
- Fallback routes for single-page applications
- Proxy-like endpoints

Two forms exist:

```text
{*path}
{**path}
```

The difference matters most during URL generation:

- `{*path}` escapes path separators when generating links.
- `{**path}` preserves path separators when generating links.

For route matching, both can capture multiple path segments. For URL generation, `{**path}` is usually the better choice when the captured value is intended to remain a path.

### Catch-All Routes Should Usually Be Last Conceptually

Catch-all routes are greedy because they can match many URLs.

Example:

```csharp
app.MapGet("/api/{**path}", (string path) => $"Fallback API path: {path}");
app.MapGet("/api/products/{id:int}", (int id) => $"Product {id}");
```

In endpoint routing, route precedence usually prevents a catch-all from beating a more specific route. However, catch-all routes should still be designed carefully because they can make APIs harder to reason about and can hide mistakes.

A better design is often:

```csharp
app.MapGet("/api/products/{id:int}", (int id) => $"Product {id}");
app.MapGet("/api/{**path}", (string path) => Results.NotFound());
```

For conventional routing, greedy routes should be placed later because conventional routing is order-dependent.

### Route Precedence

Route precedence is the system ASP.NET Core uses to choose the most specific route when multiple endpoints could match.

General rules:

- More segments are usually more specific.
- Literal segments are more specific than parameter segments.
- Constrained parameters are more specific than unconstrained parameters.
- Complex segments are treated as more specific than simple unconstrained parameters.
- Catch-all parameters are the least specific.

Example:

```csharp
app.MapGet("/products/list", () => "List");
app.MapGet("/products/{id}", (string id) => $"Product {id}");
app.MapGet("/products/{id:int}", (int id) => $"Product {id}");
app.MapGet("/products/{**path}", (string path) => $"Fallback {path}");
```

Possible matches:

```text
GET /products/list      -> /products/list
GET /products/123       -> /products/{id:int}
GET /products/abc       -> /products/{id}
GET /products/a/b/c     -> /products/{**path}
```

The more specific route wins.

### Ambiguous Routes

Ambiguous routes happen when ASP.NET Core cannot choose a single best endpoint.

Example:

```csharp
app.MapGet("/products/{value}", (string value) => $"By value: {value}");
app.MapGet("/products/{name}", (string name) => $"By name: {name}");
```

Both routes have the same shape and priority. A request like:

```text
GET /products/keyboard
```

could match both. ASP.NET Core cannot know which one is intended.

Better:

```csharp
app.MapGet("/products/by-code/{code}", (string code) => $"By code: {code}");
app.MapGet("/products/by-name/{name}", (string name) => $"By name: {name}");
```

or use constraints when the shapes are truly different:

```csharp
app.MapGet("/products/{id:int}", (int id) => $"By id: {id}");
app.MapGet("/products/{slug:alpha}", (string slug) => $"By slug: {slug}");
```

### Route Order

Endpoint routing mostly relies on route precedence instead of registration order. In common cases, you should not need to manually set route order.

However, order can still matter in some scenarios:

- Conventional MVC routing
- Explicit `Order` values on route endpoints
- Greedy catch-all conventional routes
- Fallback routes
- Routes with identical precedence where ambiguity must be avoided

For conventional controller routes:

```csharp
app.MapControllerRoute(
    name: "areas",
    pattern: "{area:exists}/{controller=Home}/{action=Index}/{id?}");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
```

The more specific area route is placed before the default route.

For attribute routing and minimal APIs, prefer unique, clear route templates instead of relying on manual order.

### Conventional Routing vs Attribute Routing

Conventional routing defines a pattern centrally.

```csharp
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
```

This can match:

```text
/Home/Index/10
/Products/Details/5
```

Attribute routing defines routes on actions.

```csharp
[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        return Ok();
    }
}
```

Comparison:

| Feature | Conventional Routing | Attribute Routing |
|---|---|---|
| Route definition | Centralized in startup/program configuration | Close to controller/action |
| Common use | MVC web apps | Web APIs |
| URL style | Often controller/action based | Often resource based |
| Precision | Less explicit per action | More explicit per action |
| Order sensitivity | More order-dependent | Mostly precedence-based |
| Refactoring risk | Controller/action names can affect routes | Routes remain explicit unless tokens are used |

For APIs, attribute routing is generally preferred because it makes the public API contract explicit.

### Token Replacement

Attribute routes can use tokens:

```csharp
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    [HttpGet("[action]/{id:int}")]
    public IActionResult Details(int id)
    {
        return Ok();
    }
}
```

This produces:

```text
GET /api/products/details/10
```

Common tokens:

- `[controller]`
- `[action]`
- `[area]`

Token replacement can reduce repetition, but it can also make public URLs dependent on class and method names. For public APIs, be careful because renaming a controller or action can unintentionally break routes.

A more stable route is often:

```csharp
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        return Ok();
    }
}
```

### Reserved Route Parameter Names

Some route names have special meaning in MVC and Razor Pages routing, such as:

- `action`
- `area`
- `controller`
- `handler`
- `page`

Avoid using these names as normal business parameters in controller or Razor Pages routes.

Risky:

```csharp
[HttpGet("documents/{page}")]
public IActionResult GetDocumentPage(string page)
{
    return Ok();
}
```

Better:

```csharp
[HttpGet("documents/{pageNumber:int}")]
public IActionResult GetDocumentPage(int pageNumber)
{
    return Ok();
}
```

Using reserved names incorrectly can cause confusing link generation or route matching behavior.

### Route Values and Model Binding

Route parameters become route values and can be bound to action parameters.

```csharp
[HttpGet("orders/{orderId:int}/items/{itemId:int}")]
public IActionResult GetOrderItem(int orderId, int itemId)
{
    return Ok(new { orderId, itemId });
}
```

Request:

```text
GET /orders/100/items/5
```

Bound values:

```text
orderId = 100
itemId = 5
```

Route value names should match method parameter names unless explicit binding is used.

```csharp
[HttpGet("orders/{id:int}")]
public IActionResult GetOrder([FromRoute(Name = "id")] int orderId)
{
    return Ok(orderId);
}
```

This is valid, but matching names are clearer:

```csharp
[HttpGet("orders/{orderId:int}")]
public IActionResult GetOrder(int orderId)
{
    return Ok(orderId);
}
```

### Route Design for REST APIs

For REST-style APIs, route templates should usually model resources, not actions.

Prefer:

```text
GET    /api/products
GET    /api/products/{id}
POST   /api/products
PUT    /api/products/{id}
PATCH  /api/products/{id}
DELETE /api/products/{id}
```

Avoid action-heavy routes when standard HTTP methods already communicate intent:

```text
GET  /api/products/getAllProducts
POST /api/products/createProduct
POST /api/products/deleteProduct/10
```

Action-like routes can still be appropriate for operations that do not map cleanly to CRUD:

```text
POST /api/orders/{id}/cancel
POST /api/invoices/{id}/send
POST /api/reports/monthly:generate
```

The important habit is consistency.

### Nested Resource Routes

Nested routes express relationships between resources.

```csharp
[ApiController]
[Route("api/orders/{orderId:int}/items")]
public class OrderItemsController : ControllerBase
{
    [HttpGet]
    public IActionResult GetItems(int orderId)
    {
        return Ok();
    }

    [HttpGet("{itemId:int}")]
    public IActionResult GetItem(int orderId, int itemId)
    {
        return Ok();
    }
}
```

Routes:

```text
GET /api/orders/10/items
GET /api/orders/10/items/5
```

Nested routes are useful when the child resource is naturally scoped by the parent. Avoid overly deep nesting such as:

```text
/api/customers/1/orders/2/items/3/discounts/4
```

Very deep routes can become hard to maintain. Consider query parameters or separate top-level resources when relationships become complex.

### Query String vs Route Parameters

Route parameters are best for identifying resources.

```text
GET /api/products/10
```

Query strings are best for filtering, sorting, searching, and paging.

```text
GET /api/products?category=books&page=2&pageSize=20
```

Good route design:

```csharp
[HttpGet]
public IActionResult SearchProducts(
    [FromQuery] string? category,
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 20)
{
    return Ok();
}

[HttpGet("{id:int}")]
public IActionResult GetProductById(int id)
{
    return Ok();
}
```

Avoid putting many optional filters into the path:

```text
/api/products/books/active/price/10/100/page/2
```

That style is harder to evolve and understand.

### Minimal API Route Groups

Minimal APIs can group routes with a shared prefix and shared metadata.

```csharp
var products = app.MapGroup("/api/products")
                  .RequireAuthorization()
                  .WithTags("Products");

products.MapGet("/", () => "All products");

products.MapGet("/{id:int}", (int id) => $"Product {id}");

products.MapPost("/", (CreateProductRequest request) =>
{
    return Results.Created($"/api/products/10", request);
});
```

Route groups help avoid repetition and keep related endpoints together.

They are useful for:

- Shared authorization
- API version prefixes
- Tags for OpenAPI
- Shared filters
- Common route prefixes

### Fallback Routes

Fallback routes are used when no other route matches.

They are common for single-page applications:

```csharp
app.MapFallbackToFile("index.html");
```

A custom fallback could look like:

```csharp
app.MapFallback(() => Results.NotFound(new
{
    Message = "The requested API endpoint was not found."
}));
```

Fallback routes should be used carefully in APIs. A fallback that returns `200 OK` for unknown API paths can hide client errors and make debugging harder.

### Link Generation

Routing is not only for matching incoming requests. It is also used to generate URLs.

In controllers:

```csharp
[HttpPost]
public IActionResult Create(CreateProductRequest request)
{
    var id = 10;

    return CreatedAtAction(
        nameof(GetById),
        new { id },
        new { Id = id, request.Name });
}

[HttpGet("{id:int}", Name = "GetProductById")]
public IActionResult GetById(int id)
{
    return Ok();
}
```

Named routes can make link generation more stable:

```csharp
return CreatedAtRoute(
    "GetProductById",
    new { id = 10 },
    new { Id = 10 });
```

In minimal APIs:

```csharp
app.MapGet("/api/products/{id:int}", (int id) => Results.Ok())
   .WithName("GetProductById");

app.MapPost("/api/products", (LinkGenerator links, HttpContext context) =>
{
    var uri = links.GetUriByName(context, "GetProductById", new { id = 10 });
    return Results.Created(uri!, new { Id = 10 });
});
```

Link generation helps avoid hardcoding URLs throughout the application.

### Common Mistakes

Common mistakes include:

- Relying on route constraints as business validation.
- Creating ambiguous routes with the same shape.
- Using optional parameters too broadly in APIs.
- Creating greedy catch-all routes without considering precedence.
- Mixing conventional and attribute routing without a clear reason.
- Using `[action]` token replacement in public APIs and accidentally changing URLs during refactoring.
- Using reserved route names as business parameter names.
- Returning `200 OK` from fallback routes for unknown API paths.
- Making routes action-based when resource-based routes would be clearer.
- Adding route parameters for filters that belong in the query string.
- Forgetting HTTP method attributes on controller actions.
- Expecting route registration order to solve route ambiguity in endpoint routing.

### Best Practices

Practical best practices:

- Prefer attribute routing for Web APIs.
- Use resource-oriented route names.
- Use HTTP methods to represent operations where appropriate.
- Use route constraints to disambiguate similar routes.
- Use validation for invalid business input.
- Keep route templates explicit and stable.
- Prefer separate endpoints over overloaded optional parameters.
- Put filters, sorting, searching, and paging in query strings.
- Avoid deep nested routes unless the hierarchy is essential.
- Avoid catch-all routes unless there is a clear use case.
- Name important endpoints for link generation.
- Keep route parameter names consistent with method parameter names.
- Test important route behaviors with integration tests.

Example integration test idea:

```csharp
[Fact]
public async Task GetProduct_WithNonIntegerId_ReturnsNotFound()
{
    await using var factory = new WebApplicationFactory<Program>();
    using var client = factory.CreateClient();

    var response = await client.GetAsync("/api/products/abc");

    Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
}
```

Integration tests are especially useful for verifying route constraints, authorization behavior, and ambiguous route fixes.

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->

### Beginner

<!-- question:start:endpoint-routing-beginner-q01 -->
#### 1. What is endpoint routing in ASP.NET Core?

<!-- question-id:endpoint-routing-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Endpoint routing is the ASP.NET Core system that matches incoming HTTP requests to executable endpoints. An endpoint can be a controller action, minimal API handler, Razor Page, SignalR hub, gRPC service, or health check endpoint.

Endpoint routing uses route templates, HTTP method metadata, route constraints, and endpoint metadata to select the correct handler. After an endpoint is selected, routing-aware middleware such as authorization can inspect the selected endpoint's metadata before the endpoint executes.

Example:

```csharp
app.MapGet("/api/products/{id:int}", (int id) =>
{
    return Results.Ok(new { Id = id });
});
```

Here, `GET /api/products/10` matches the endpoint, captures `id`, applies the `int` constraint, and executes the handler.

##### Key Points to Mention

- Matches HTTP requests to endpoints.
- Used by controllers, minimal APIs, Razor Pages, SignalR, gRPC, and more.
- Endpoint metadata supports cross-cutting behavior such as authorization.
- Route matching and endpoint execution are related but separate concepts.
- Route constraints and precedence help select the correct endpoint.

<!-- question:end:endpoint-routing-beginner-q01 -->

<!-- question:start:endpoint-routing-beginner-q02 -->
#### 2. What is attribute routing?

<!-- question-id:endpoint-routing-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Attribute routing defines route templates directly on controllers and actions using attributes such as `[Route]`, `[HttpGet]`, `[HttpPost]`, `[HttpPut]`, and `[HttpDelete]`.

Example:

```csharp
[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        return Ok();
    }
}
```

This creates:

```text
GET /api/products/{id:int}
```

Attribute routing is common in Web APIs because it makes the public API contract explicit and keeps the route definition close to the action that handles it.

##### Key Points to Mention

- Routes are declared with attributes.
- HTTP verb attributes also define routes.
- Controller-level and action-level routes are combined.
- Commonly used for REST APIs.
- More explicit than conventional routing.

<!-- question:end:endpoint-routing-beginner-q02 -->

<!-- question:start:endpoint-routing-beginner-q03 -->
#### 3. What is a route parameter?

<!-- question-id:endpoint-routing-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A route parameter captures part of the URL path and makes it available as a route value.

Example:

```csharp
[HttpGet("api/products/{id}")]
public IActionResult GetById(string id)
{
    return Ok(id);
}
```

For:

```text
GET /api/products/abc123
```

the route parameter `id` receives:

```text
abc123
```

Route parameters are commonly used for resource identifiers.

##### Key Points to Mention

- Defined with curly braces, such as `{id}`.
- Captures a URL path segment.
- Can bind to controller action or minimal API parameters.
- Should usually represent resource identity.
- Parameter names should match method parameter names when possible.

<!-- question:end:endpoint-routing-beginner-q03 -->

<!-- question:start:endpoint-routing-beginner-q04 -->
#### 4. What is a route constraint?

<!-- question-id:endpoint-routing-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A route constraint restricts which values can match a route parameter.

Example:

```csharp
[HttpGet("api/products/{id:int}")]
public IActionResult GetById(int id)
{
    return Ok();
}
```

This route matches:

```text
/api/products/10
```

but not:

```text
/api/products/abc
```

Common constraints include `int`, `guid`, `alpha`, `bool`, `datetime`, `min`, `max`, `range`, `length`, and `regex`.

Route constraints are mainly used to disambiguate routes and define URL shape. They should not replace business validation.

##### Key Points to Mention

- Added with `:` inside a route parameter.
- Example: `{id:int}`.
- Helps route selection.
- Failed constraint usually results in no route match, often `404`.
- Not a replacement for validation.

<!-- question:end:endpoint-routing-beginner-q04 -->

<!-- question:start:endpoint-routing-beginner-q05 -->
#### 5. What is an optional route parameter?

<!-- question-id:endpoint-routing-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

An optional route parameter is a parameter that does not need to appear in the URL. It is marked with `?`.

Example:

```csharp
[HttpGet("products/{id?}")]
public IActionResult GetProduct(int? id)
{
    if (id is null)
    {
        return Ok("All products");
    }

    return Ok($"Product {id}");
}
```

This can match both:

```text
/products
/products/10
```

Optional parameters can be useful, but in Web APIs it is often clearer to create separate routes for collection and item endpoints.

##### Key Points to Mention

- Syntax: `{id?}`.
- Parameter may be missing from the URL.
- Use nullable or default method parameters when appropriate.
- Can make API behavior less clear if overused.
- Separate endpoints are often better for REST APIs.

<!-- question:end:endpoint-routing-beginner-q05 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->

### Intermediate

<!-- question:start:endpoint-routing-intermediate-q01 -->
#### 6. How does ASP.NET Core choose between multiple matching routes?

<!-- question-id:endpoint-routing-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

ASP.NET Core uses endpoint selection and route precedence to choose the best match. In general, the most specific route wins.

Rules of thumb:

- Literal segments are more specific than parameter segments.
- Constrained parameters are more specific than unconstrained parameters.
- More specific templates have higher priority.
- Catch-all parameters are the least specific.
- If multiple endpoints have the same priority and match the same request, an ambiguous match error can occur.

Example:

```csharp
app.MapGet("/products/list", () => "List");
app.MapGet("/products/{id:int}", (int id) => $"Product {id}");
app.MapGet("/products/{slug}", (string slug) => $"Slug {slug}");
```

Requests:

```text
/products/list  -> /products/list
/products/10    -> /products/{id:int}
/products/chair -> /products/{slug}
```

##### Key Points to Mention

- Endpoint routing considers all candidates.
- Constraints filter candidates.
- Route precedence chooses more specific templates.
- Literal segments beat parameter segments.
- Ambiguity occurs when no single best endpoint exists.

<!-- question:end:endpoint-routing-intermediate-q01 -->

<!-- question:start:endpoint-routing-intermediate-q02 -->
#### 7. What is the difference between route constraints and model validation?

<!-- question-id:endpoint-routing-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Route constraints decide whether a URL matches a route. Model validation decides whether the input is valid for business or application rules.

If a route constraint fails, ASP.NET Core treats the route as not matched, commonly returning `404 Not Found`.

Example:

```csharp
[HttpGet("products/{id:int}")]
public IActionResult GetById(int id)
{
    return Ok();
}
```

Request:

```text
GET /products/abc
```

This fails the `int` constraint and usually returns `404`.

Validation should be used when the route matches but the input is not valid business input.

```csharp
[HttpGet("products/{id:int}")]
public IActionResult GetById(int id)
{
    if (id <= 0)
    {
        return BadRequest("Id must be greater than zero.");
    }

    return Ok();
}
```

##### Key Points to Mention

- Constraints are for route matching and disambiguation.
- Validation is for input correctness and business rules.
- Constraint failure usually gives `404`.
- Validation failure should usually give `400`.
- Do not use constraints as the only validation layer.

<!-- question:end:endpoint-routing-intermediate-q02 -->

<!-- question:start:endpoint-routing-intermediate-q03 -->
#### 8. What is a catch-all route and when would you use it?

<!-- question-id:endpoint-routing-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A catch-all route captures the rest of the URL path into a single route parameter.

Example:

```csharp
app.MapGet("/files/{**path}", (string? path) =>
{
    return Results.Ok(path);
});
```

This can match:

```text
/files/readme.txt
/files/images/products/keyboard.png
/files/
```

Catch-all routes are useful for file paths, documentation pages, CMS slugs, fallback routes, and proxy-like endpoints.

They should be used carefully because they are broad and can hide mistakes if they are too greedy.

##### Key Points to Mention

- Syntax: `{*path}` or `{**path}`.
- Captures multiple path segments.
- Useful for file paths and fallback behavior.
- Catch-all routes are least specific in route precedence.
- Avoid broad catch-all routes unless clearly needed.

<!-- question:end:endpoint-routing-intermediate-q03 -->

<!-- question:start:endpoint-routing-intermediate-q04 -->
#### 9. What is the difference between `{*path}` and `{**path}`?

<!-- question-id:endpoint-routing-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Both `{*path}` and `{**path}` are catch-all route parameters that can capture the remaining URL path.

The important difference is URL generation:

- `{*path}` escapes path separator characters when generating URLs.
- `{**path}` preserves path separator characters when generating URLs.

Example concept:

```text
Route: /files/{*path}
Value: docs/readme.txt
Generated URL may encode the slash.

Route: /files/{**path}
Value: docs/readme.txt
Generated URL preserves the slash as part of the path.
```

When the captured value represents an actual path, `{**path}` is usually more suitable.

##### Key Points to Mention

- Both are catch-all route parameters.
- Difference matters mainly in link generation.
- `{*path}` can encode `/`.
- `{**path}` preserves `/`.
- Use `{**path}` for path-like values.

<!-- question:end:endpoint-routing-intermediate-q04 -->

<!-- question:start:endpoint-routing-intermediate-q05 -->
#### 10. What is the difference between conventional routing and attribute routing?

<!-- question-id:endpoint-routing-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Conventional routing defines route patterns centrally, often based on controller and action names.

```csharp
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
```

Attribute routing defines route patterns directly on controllers and actions.

```csharp
[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        return Ok();
    }
}
```

Conventional routing is common in MVC-style web applications. Attribute routing is common in Web APIs because it provides precise control over each endpoint's public URL.

##### Key Points to Mention

- Conventional routing is centralized.
- Attribute routing is declared on controllers/actions.
- Conventional routing is often order-dependent.
- Attribute routing is more explicit.
- Attribute routing is preferred for most Web APIs.

<!-- question:end:endpoint-routing-intermediate-q05 -->

<!-- question:start:endpoint-routing-intermediate-q06 -->
#### 11. Why can optional parameters be problematic in API design?

<!-- question-id:endpoint-routing-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Optional route parameters can make one endpoint handle multiple meanings. This may reduce clarity and make route matching harder to reason about.

Example:

```csharp
[HttpGet("products/{id?}")]
public IActionResult GetProducts(int? id)
{
    if (id is null)
    {
        return Ok("All products");
    }

    return Ok($"Product {id}");
}
```

This works, but it mixes collection retrieval and item retrieval into one action.

A clearer API design is:

```csharp
[HttpGet("products")]
public IActionResult GetProducts()
{
    return Ok();
}

[HttpGet("products/{id:int}")]
public IActionResult GetProductById(int id)
{
    return Ok();
}
```

Separate endpoints improve readability, authorization control, OpenAPI documentation, testing, and future changes.

##### Key Points to Mention

- Optional parameters can overload endpoint meaning.
- Separate routes are often clearer.
- Better for OpenAPI documentation.
- Better for authorization and validation differences.
- Use optional parameters carefully in public APIs.

<!-- question:end:endpoint-routing-intermediate-q06 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->

### Advanced

<!-- question:start:endpoint-routing-advanced-q01 -->
#### 12. How does endpoint routing interact with authorization middleware?

<!-- question-id:endpoint-routing-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Endpoint routing selects an endpoint and attaches it to the current `HttpContext`. Authorization middleware then reads metadata from the selected endpoint, such as `[Authorize]` attributes or `.RequireAuthorization()` metadata.

Conceptual order:

```csharp
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.UseEndpoints(endpoints =>
{
    endpoints.MapControllers();
});
```

In minimal-hosting apps, this is often handled automatically, but the concept is still important.

Example:

```csharp
app.MapGet("/admin/reports", () => "Reports")
   .RequireAuthorization("AdminOnly");
```

The route defines authorization metadata. The authorization middleware must run after endpoint selection so it can inspect that metadata before the endpoint executes.

##### Key Points to Mention

- Routing selects the endpoint.
- Endpoint metadata stores authorization requirements.
- Authorization middleware reads selected endpoint metadata.
- Middleware order matters conceptually.
- Incorrect ordering can cause security behavior to be wrong or inconsistent.

<!-- question:end:endpoint-routing-advanced-q01 -->

<!-- question:start:endpoint-routing-advanced-q02 -->
#### 13. How would you resolve ambiguous route matches?

<!-- question-id:endpoint-routing-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Ambiguous route matches occur when multiple endpoints match the same request with the same priority and ASP.NET Core cannot choose one.

Bad example:

```csharp
app.MapGet("/products/{value}", (string value) => $"Value: {value}");
app.MapGet("/products/{name}", (string name) => $"Name: {name}");
```

Both routes have the same shape. A request to `/products/keyboard` matches both.

Ways to fix it:

Use different literal segments:

```csharp
app.MapGet("/products/by-code/{code}", (string code) => $"Code: {code}");
app.MapGet("/products/by-name/{name}", (string name) => $"Name: {name}");
```

Use constraints:

```csharp
app.MapGet("/products/{id:int}", (int id) => $"Id: {id}");
app.MapGet("/products/{slug:alpha}", (string slug) => $"Slug: {slug}");
```

Use different HTTP methods when the operation is different:

```csharp
app.MapGet("/products/{id:int}", (int id) => $"Get {id}");
app.MapDelete("/products/{id:int}", (int id) => $"Delete {id}");
```

The best fix is usually to make the route design more explicit.

##### Key Points to Mention

- Ambiguity means no single best match.
- Same route shape with different parameter names is still ambiguous.
- Parameter names alone do not disambiguate routes.
- Use literals, constraints, or HTTP methods.
- Prefer clear API design over relying on route order.

<!-- question:end:endpoint-routing-advanced-q02 -->

<!-- question:start:endpoint-routing-advanced-q03 -->
#### 14. How would you design routes for filtering, sorting, and paging?

<!-- question-id:endpoint-routing-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Filtering, sorting, searching, and paging should usually use query string parameters, not route parameters.

Good design:

```text
GET /api/products?category=books&sort=name&page=2&pageSize=20
```

Example:

```csharp
[HttpGet("api/products")]
public IActionResult GetProducts(
    [FromQuery] string? category,
    [FromQuery] string? sort,
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 20)
{
    return Ok();
}
```

Route parameters should identify resources:

```text
GET /api/products/10
```

Query parameters should modify how a collection is returned.

Avoid:

```text
GET /api/products/category/books/sort/name/page/2/pageSize/20
```

That style is harder to evolve and creates too many route shapes.

##### Key Points to Mention

- Route parameters identify resources.
- Query parameters filter, search, sort, and page collections.
- Query strings are easier to extend.
- Avoid many optional path segments.
- Improves API clarity and client usability.

<!-- question:end:endpoint-routing-advanced-q03 -->

<!-- question:start:endpoint-routing-advanced-q04 -->
#### 15. How would you use route constraints for overloaded-looking routes?

<!-- question-id:endpoint-routing-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Route constraints can safely separate routes that have similar URL shapes but different parameter formats.

Example:

```csharp
[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        return Ok();
    }

    [HttpGet("{slug:regex(^[a-z0-9-]+$)}")]
    public IActionResult GetBySlug(string slug)
    {
        return Ok();
    }
}
```

Requests:

```text
GET /api/products/123                 -> GetById
GET /api/products/mechanical-keyboard -> GetBySlug
```

However, constraints should not become overly complex. If the routes are hard to understand, it may be better to add literal segments:

```text
GET /api/products/by-id/123
GET /api/products/by-slug/mechanical-keyboard
```

##### Key Points to Mention

- Constraints help disambiguate similar route patterns.
- Good for `int` vs `slug`, `guid` vs `name`, etc.
- Avoid overly complex regex routes.
- Clear literal segments may be better.
- Constraints are not business validation.

<!-- question:end:endpoint-routing-advanced-q04 -->

<!-- question:start:endpoint-routing-advanced-q05 -->
#### 16. What are the risks of using `[controller]` and `[action]` token replacement in public APIs?

<!-- question-id:endpoint-routing-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Token replacement uses controller, action, or area names to build route templates.

Example:

```csharp
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    [HttpGet("[action]/{id:int}")]
    public IActionResult Details(int id)
    {
        return Ok();
    }
}
```

This creates a route like:

```text
GET /api/products/details/10
```

The risk is that public URLs become coupled to C# class and method names. Renaming `ProductsController` or `Details` can unintentionally change the API route and break clients.

For stable public APIs, explicit routes are usually better:

```csharp
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        return Ok();
    }
}
```

##### Key Points to Mention

- Tokens reduce repetition.
- Tokens couple routes to code names.
- Refactoring can break public URLs.
- Explicit routes are more stable.
- Use tokens carefully in public APIs.

<!-- question:end:endpoint-routing-advanced-q05 -->

<!-- question:start:endpoint-routing-advanced-q06 -->
#### 17. How would you debug a route that returns 404 unexpectedly?

<!-- question-id:endpoint-routing-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

A route may return `404` because no endpoint matches. Debugging should check the route template, HTTP method, constraints, route prefixes, optional parameters, catch-all routes, and middleware configuration.

A practical debugging checklist:

1. Confirm the HTTP method is correct.
2. Confirm the path matches the route template.
3. Check controller-level and action-level route combination.
4. Check whether an action route starts with `/` or `~/`.
5. Check route constraints.
6. Check whether a route parameter value fails a constraint.
7. Check whether the controller is registered with `MapControllers`.
8. Check whether required services like controllers are registered.
9. Check whether authorization returns `401` or `403` instead of `404`.
10. Add integration tests for the expected route.

Example issue:

```csharp
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        return Ok();
    }
}
```

Request:

```text
GET /api/products/abc
```

This returns `404` because `abc` fails the `int` route constraint.

##### Key Points to Mention

- Check method and path first.
- Constraints commonly cause unexpected `404`.
- Attribute route combination can surprise developers.
- Missing `MapControllers()` can prevent controller routing.
- Integration tests are useful for route behavior.

<!-- question:end:endpoint-routing-advanced-q06 -->

<!-- question:start:endpoint-routing-advanced-q07 -->
#### 18. When would you use a fallback route, and what are the risks?

<!-- question-id:endpoint-routing-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

A fallback route runs when no other route matches. It is commonly used for single-page applications, documentation sites, or custom not-found behavior.

Example for an SPA:

```csharp
app.MapFallbackToFile("index.html");
```

Example custom fallback:

```csharp
app.MapFallback(() => Results.NotFound(new
{
    Message = "Endpoint not found."
}));
```

The risk is that a fallback can hide real API mistakes. For example, returning `200 OK` and serving `index.html` for an unknown API route can confuse API clients and monitoring tools.

A good habit is to separate API fallback behavior from client-side SPA fallback behavior.

##### Key Points to Mention

- Fallback routes run when no other endpoint matches.
- Common for SPAs.
- Can hide API errors if too broad.
- Avoid returning `200 OK` for unknown API paths.
- Keep API fallback and SPA fallback behavior clear.

<!-- question:end:endpoint-routing-advanced-q07 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
