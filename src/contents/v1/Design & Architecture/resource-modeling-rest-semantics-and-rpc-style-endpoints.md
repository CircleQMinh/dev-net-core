---
id: resource-modeling-rest-semantics-and-rpc-style-endpoints
topic: API design and integration contracts
subtopic: Resource modeling, REST semantics, and when RPC-style endpoints are acceptable
category: Design & Architecture
---

## Overview

Resource modeling is the process of designing an HTTP API around concepts that clients can identify, retrieve, create, change, and delete. REST uses a uniform interface: resource identifiers, representations, standard HTTP methods, status codes, headers, caching rules, and stateless requests.

A resource is not necessarily a database row. It can represent:

- A business entity such as an order.
- A collection such as all orders visible to a user.
- A relationship such as an order's shipments.
- A workflow state such as a payment attempt.
- A computed result such as a price quote.
- A long-running operation.

Good resource design gives clients a stable business-facing contract without exposing internal tables, services, or object graphs.

Not every business operation maps naturally to CRUD. Commands such as approving a loan, capturing a payment, retrying a failed job, or calculating a route may be clearer as RPC-style endpoints. RPC-style HTTP is acceptable when it exposes an explicit business operation and still uses HTTP semantics honestly.

This topic matters in interviews because candidates must demonstrate more than route naming. They should understand:

- Resources versus representations.
- Collection and item semantics.
- Safe and idempotent methods.
- `POST`, `PUT`, and `PATCH` trade-offs.
- Status codes, headers, caching, and conditional requests.
- Asynchronous operations.
- When an action endpoint is clearer than inventing a misleading resource.
- How API contracts remain independent of persistence and domain internals.

## Core Concepts

### Resource, Representation, and Identifier

A **resource** is the conceptual thing exposed by the API. A **representation** is the current serialized form sent in a request or response. A **URI** identifies the resource.

```http
GET /orders/ord_123 HTTP/1.1
Accept: application/json
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "ord_123",
  "status": "pendingPayment",
  "total": {
    "amount": 125.00,
    "currency": "USD"
  }
}
```

The JSON document is not the resource itself. It is one representation of the order at a point in time.

This distinction permits:

- Different media types.
- Different language representations.
- Versioned representations.
- Partial or summary views.
- Caching based on representation metadata.

### Model Business Resources, Not Database Tables

An API is a contract for clients, not a remote database.

Avoid exposing:

```text
/tbl_orders
/order_status_lookup
/order_line_join
```

Prefer business concepts:

```text
/orders
/orders/{orderId}
/orders/{orderId}/lines
/orders/{orderId}/shipments
```

Table-shaped APIs often leak:

- Internal normalization.
- Surrogate keys that have no client meaning.
- Join tables.
- Persistence terminology.
- Fields clients should not control.

Use request and response models tailored to the API contract rather than serializing ORM entities directly.

### Resource Granularity

Resources should be large enough to support useful client operations and small enough to avoid excessive transfer and coupling.

Too fine-grained:

```text
GET /orders/123/status
GET /orders/123/total
GET /orders/123/customer-name
```

This creates chatty APIs and many network round trips.

Too coarse:

```text
GET /customer-account-everything/123
```

This transfers unrelated data, complicates authorization, and couples clients to one large representation.

Choose boundaries from:

- Client use cases.
- Business ownership.
- Consistency requirements.
- Security boundaries.
- Change patterns.
- Payload and latency constraints.

### Collection and Item Resources

A collection and an item are separate resources:

```text
/orders
/orders/{orderId}
```

Typical semantics:

```http
GET /orders
POST /orders
GET /orders/ord_123
PUT /orders/ord_123
PATCH /orders/ord_123
DELETE /orders/ord_123
```

The API does not need to support every method on every resource. Expose only operations that match the business and authorization model.

### URI Design

Useful conventions include:

- Use nouns for resources.
- Use plural nouns for collections.
- Use stable opaque identifiers.
- Use lowercase paths consistently.
- Keep nesting shallow.
- Put optional query behavior in the query string.
- Avoid leaking implementation technology.

Good examples:

```text
/customers/cus_42
/customers/cus_42/orders
/orders?status=pending&sort=-createdAt
```

Avoid:

```text
/getCustomerById?id=42
/sql/orders/42
/customers/42/orders/99/lines/5/product/category
```

Deep nesting is difficult to maintain. Once an item has a stable identity, a top-level item URI is often clearer.

### Stateless Requests

REST requests should contain the information required to understand and authorize them. The server should not rely on hidden conversational state tied to one server instance.

Statelessness improves:

- Horizontal scaling.
- Retry behavior.
- Load balancing.
- Failure recovery.
- Observability.

State still exists in resources, tokens, databases, and workflows. Stateless means the protocol request is independently understandable, not that the system stores no state.

### HTTP Method Semantics

HTTP methods carry standardized meaning:

| Method | Typical purpose | Safe | Idempotent |
| --- | --- | --- | --- |
| `GET` | Retrieve a representation | Yes | Yes |
| `HEAD` | Retrieve response metadata without content | Yes | Yes |
| `POST` | Process content or create under a collection | No | Not inherently |
| `PUT` | Create or replace state at a known URI | No | Yes |
| `PATCH` | Apply a partial modification | No | Depends on patch semantics |
| `DELETE` | Remove the target resource | No | Yes |
| `OPTIONS` | Discover communication options | Yes | Yes |

Safe means the client is not asking for a state change. Logging and metrics can still occur.

Idempotent means repeating the same request has the same intended effect on resource state. Responses can differ. A repeated `DELETE` can return `204` first and `404` later while remaining idempotent.

### GET and HEAD

`GET` retrieves a representation and must not be used to request a business mutation:

```http
GET /orders/123/cancel
```

is dangerous because browsers, crawlers, prefetchers, and caches can issue `GET`.

Use `HEAD` when clients need the same metadata as `GET` without response content:

```http
HEAD /documents/doc_123
```

Useful response metadata includes:

- `Content-Length`.
- `Content-Type`.
- `ETag`.
- `Last-Modified`.
- Cache headers.

### POST

Use `POST` when:

- The server assigns the new resource URI.
- The target collection processes a creation request.
- The operation is not naturally idempotent.
- A command does not fit replacement semantics.
- A request creates a subordinate or operation resource.

```http
POST /orders HTTP/1.1
Content-Type: application/json

{
  "customerId": "cus_42",
  "lines": [
    {
      "productId": "prd_7",
      "quantity": 2
    }
  ]
}
```

Successful creation:

```http
HTTP/1.1 201 Created
Location: /orders/ord_123
Content-Type: application/json

{
  "id": "ord_123",
  "status": "draft"
}
```

`POST` can return `200` when it processes a request and returns a result without creating a resource. Use `202 Accepted` for deferred processing.

### PUT

`PUT` requests that the target resource state be created or replaced by the supplied representation.

```http
PUT /profiles/usr_42/preferences HTTP/1.1
Content-Type: application/json

{
  "theme": "dark",
  "locale": "en-US"
}
```

Repeating the same request produces the same intended state, making `PUT` idempotent.

Important considerations:

- The client knows the target URI.
- Omitted fields can imply removal or default values under replacement semantics.
- The API must define whether creation at the URI is allowed.
- Return `200` with a representation, `204` without one, or `201` if created.

Do not call an arbitrary merge update `PUT` while silently preserving omitted properties. That makes the contract ambiguous.

### PATCH

`PATCH` applies a partial modification. The media type defines patch semantics.

JSON Merge Patch expresses a partial document:

```http
PATCH /customers/cus_42 HTTP/1.1
Content-Type: application/merge-patch+json

{
  "displayName": "A. Nguyen",
  "phone": null
}
```

JSON Patch expresses ordered operations:

```http
PATCH /customers/cus_42 HTTP/1.1
Content-Type: application/json-patch+json

[
  {
    "op": "replace",
    "path": "/displayName",
    "value": "A. Nguyen"
  }
]
```

`PATCH` is not automatically idempotent. Replacing a value can be idempotent; incrementing a value is not.

Validate:

- Allowed paths.
- Authorization per field.
- Resulting resource invariants.
- Preconditions such as `If-Match`.
- Patch document size and operation count.

### DELETE

`DELETE` requests removal of the association between the target URI and its current functionality. Business systems may implement:

- Hard deletion.
- Soft deletion.
- Deactivation.
- Retention workflow.

The external semantics must be clear. If cancellation is a meaningful state transition rather than deletion, use a cancellation operation instead.

Common responses:

- `204 No Content` when removal succeeds.
- `202 Accepted` when deletion is asynchronous.
- `404 Not Found` when no visible resource exists.
- `409 Conflict` when current state prevents deletion.

### Response Status Codes

Choose codes from HTTP semantics, not framework convenience.

Common success codes:

- `200 OK`: successful request with a response representation.
- `201 Created`: resource created; include `Location`.
- `202 Accepted`: processing accepted but not complete.
- `204 No Content`: successful request with no response content.

Common client-error codes:

- `400 Bad Request`: malformed syntax or invalid request shape.
- `401 Unauthorized`: authentication is required or invalid.
- `403 Forbidden`: authenticated client lacks permission.
- `404 Not Found`: target resource is unavailable or intentionally hidden.
- `405 Method Not Allowed`: method unsupported for the target; include `Allow`.
- `409 Conflict`: request conflicts with current resource state.
- `412 Precondition Failed`: conditional request precondition failed.
- `415 Unsupported Media Type`: request content type is unsupported.
- `422 Unprocessable Content`: syntactically valid content cannot be processed semantically.
- `429 Too Many Requests`: rate limit exceeded.

Server errors:

- `500 Internal Server Error`: unexpected server failure.
- `502 Bad Gateway`: invalid upstream response.
- `503 Service Unavailable`: temporary unavailability.
- `504 Gateway Timeout`: upstream timeout.

Do not return `200 OK` with an error object for failures. Clients, gateways, monitoring, and retry policies rely on status semantics.

### Error Representations

Use one consistent machine-readable error shape. Problem Details is a standard format:

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/order-already-shipped",
  "title": "The order cannot be cancelled",
  "status": 409,
  "detail": "Order ord_123 has already been shipped.",
  "instance": "/orders/ord_123",
  "traceId": "00-abcd..."
}
```

Extensions can provide:

- Stable error codes.
- Field validation errors.
- Retry guidance.
- Correlation IDs.

Do not expose stack traces, SQL, credentials, or internal topology.

### Resource Relationships

Represent relationships with:

- Links in representations.
- Related collection resources.
- Stable identifiers.
- Embedded summaries where useful.

```json
{
  "id": "ord_123",
  "customer": {
    "id": "cus_42",
    "href": "/customers/cus_42"
  },
  "shipmentsHref": "/orders/ord_123/shipments"
}
```

Avoid copying entire mutable resources into every response unless the snapshot has business meaning.

### Hypermedia

Hypermedia exposes available links and actions based on current state:

```json
{
  "id": "ord_123",
  "status": "pendingPayment",
  "links": [
    {
      "rel": "self",
      "href": "/orders/ord_123",
      "method": "GET"
    },
    {
      "rel": "payment",
      "href": "/orders/ord_123/payments",
      "method": "POST"
    }
  ]
}
```

Benefits:

- Clients discover related resources.
- State-dependent actions are explicit.
- URI construction logic is reduced.

Costs:

- More contract design.
- Client tooling may not use it.
- Link semantics must be documented.

Full hypermedia is not mandatory for every practical HTTP API, but links are useful for pagination, long-running operations, and discoverability.

### Caching

`GET` and `HEAD` can use HTTP caching:

```http
HTTP/1.1 200 OK
Cache-Control: private, max-age=60
ETag: "order-123-v7"
Vary: Accept-Encoding
```

Conditional retrieval:

```http
GET /orders/ord_123 HTTP/1.1
If-None-Match: "order-123-v7"
```

```http
HTTP/1.1 304 Not Modified
ETag: "order-123-v7"
```

Cache policy must consider:

- User-specific data.
- Authorization.
- Staleness tolerance.
- Intermediary caches.
- Varying representations.
- Invalidation.

### Optimistic Concurrency

Use entity tags with preconditions to avoid lost updates:

```http
GET /orders/ord_123 HTTP/1.1
```

```http
HTTP/1.1 200 OK
ETag: "v7"
```

```http
PATCH /orders/ord_123 HTTP/1.1
If-Match: "v7"
Content-Type: application/merge-patch+json

{
  "shippingAddress": {
    "city": "Da Nang"
  }
}
```

If the resource changed:

```http
HTTP/1.1 412 Precondition Failed
```

`409 Conflict` describes a semantic state conflict. `412` specifically indicates a failed HTTP precondition.

### Long-Running Operations

Do not hold an HTTP request open for long processing when a durable asynchronous workflow is more appropriate.

```http
POST /reports HTTP/1.1
Content-Type: application/json

{
  "type": "annualRevenue",
  "year": 2025
}
```

```http
HTTP/1.1 202 Accepted
Location: /operations/op_789
Retry-After: 5
```

```http
GET /operations/op_789 HTTP/1.1
```

```json
{
  "id": "op_789",
  "status": "running",
  "result": null
}
```

The operation resource should expose:

- Current status.
- Progress if meaningful.
- Failure details.
- Result link.
- Cancellation when supported.
- Retention policy.

### Resource-Oriented State Transitions

Some actions can be represented as subordinate resources:

```http
POST /orders/ord_123/cancellations
```

This creates a cancellation request or record with its own identity and lifecycle.

```http
POST /orders/ord_123/payments
```

This creates a payment attempt rather than pretending to update a payment flag.

This approach is useful when the action:

- Has a result or status.
- Can fail independently.
- Needs audit history.
- Can be retried or reversed.
- Has its own lifecycle.

### When RPC-Style Endpoints Are Acceptable

RPC-style endpoints name an operation:

```http
POST /orders/ord_123:cancel
POST /payments/pay_42:capture
POST /documents/doc_7:sign
POST /routes:calculate
```

They are acceptable when:

- The operation is a meaningful business command.
- It does not map honestly to CRUD.
- Inventing a noun would be artificial.
- The command's intent matters more than representation replacement.
- The operation has complex input or validation.
- The API is primarily command-oriented.

An action endpoint should still define:

- Whether it is safe or idempotent.
- Retry behavior.
- Preconditions.
- Status codes.
- Error contracts.
- Result or operation resources.

REST and RPC are not moral categories. A consistent HTTP API can combine resource-oriented reads with explicit commands.

### Prefer a Resource When the Result Has a Lifecycle

Before creating an action endpoint, ask whether the action produces a resource.

Instead of:

```http
POST /orders/123/start-refund
```

consider:

```http
POST /orders/123/refunds
```

A refund:

- Has an identity.
- Has status.
- Can be retrieved.
- Can fail.
- May have multiple attempts.
- Needs audit history.

Resource modeling becomes clearer when the operation has durable state.

### RPC for Calculations and Queries

A pure calculation can use `GET` when it is safe and parameters fit a URI:

```http
GET /shipping-quotes?origin=SGN&destination=HAN&weight=10
```

Use `POST` when:

- Input is large or structured.
- Sensitive inputs should not appear in URLs and logs.
- The calculation request has complex content.
- A quote resource is created.

```http
POST /shipping-quotes
Content-Type: application/json

{
  "origin": { "postalCode": "700000" },
  "destination": { "postalCode": "100000" },
  "packages": [
    {
      "weightKg": 10
    }
  ]
}
```

Do not use `GET` with a request body. Its semantics and interoperability are poorly supported.

### Bulk Operations

Bulk operations reduce network overhead but complicate atomicity and error reporting.

```http
POST /orders/batch
```

Define:

- Maximum batch size.
- Whether processing is atomic.
- Per-item status.
- Ordering.
- Idempotency.
- Partial failure behavior.
- Asynchronous processing thresholds.

Example result:

```json
{
  "results": [
    {
      "clientReference": "a1",
      "status": 201,
      "location": "/orders/ord_1"
    },
    {
      "clientReference": "a2",
      "status": 422,
      "errorCode": "invalid-product"
    }
  ]
}
```

Avoid returning one vague status when clients need to reconcile individual items.

### API Models Versus Domain Models

The API representation is an external contract. The domain model enforces internal business rules.

They differ because:

- API contracts require compatibility.
- Domain models evolve with business understanding.
- Authorization can hide fields.
- Responses may combine several read sources.
- API input should express client intent.
- Domain entities contain behavior not meant for serialization.

Map explicitly:

```csharp
public sealed record CancelOrderRequest(
    string Reason,
    string? Comment);

public sealed record OrderResponse(
    string Id,
    string Status,
    MoneyResponse Total);
```

Do not bind request JSON directly onto tracked domain entities.

### ASP.NET Core Example

```csharp
app.MapPost(
    "/orders/{orderId}:cancel",
    async (
        string orderId,
        CancelOrderRequest request,
        ICancelOrderHandler handler,
        CancellationToken cancellationToken) =>
    {
        var result = await handler.Handle(
            new CancelOrderCommand(
                OrderId.Parse(orderId),
                request.Reason,
                request.Comment),
            cancellationToken);

        return result.Match(
            success => Results.Ok(success),
            notFound => Results.NotFound(),
            conflict => Results.Conflict(
                new ProblemDetails
                {
                    Title = "The order cannot be cancelled",
                    Detail = conflict.Message,
                    Status = StatusCodes.Status409Conflict
                }));
    });
```

The route is command-oriented, but the implementation still respects HTTP status and content semantics.

### Security Considerations

Resource design affects security:

- Authorize every item, not only the collection route.
- Do not trust resource IDs to imply ownership.
- Prevent mass assignment.
- Limit fields clients can filter and sort.
- Bound request and response sizes.
- Avoid leaking resource existence where policy requires concealment.
- Validate content types.
- Use rate limits for expensive operations.
- Avoid putting secrets in paths or query strings.

`404` can intentionally hide whether a resource exists. This should be a consistent policy, not accidental behavior.

### Common Mistakes

- Mirroring database tables as resources.
- Using verbs in every URI.
- Treating REST as a route-naming convention only.
- Mutating state through `GET`.
- Using `POST` for every operation without defining semantics.
- Implementing partial merge behavior under `PUT`.
- Assuming every `PATCH` is idempotent.
- Returning `200` for errors.
- Returning ORM entities directly.
- Ignoring `Location` after creation.
- Using `202` without a status resource.
- Nesting paths too deeply.
- Inventing awkward resources to avoid all action endpoints.
- Using RPC actions without retry and concurrency rules.
- Confusing soft deletion, cancellation, and deactivation.
- Ignoring caching and conditional requests.

### Best Practices

- Model stable business concepts and workflows as resources.
- Separate resources from their representations and persistence models.
- Use consistent collection and item URIs.
- Apply HTTP method semantics honestly.
- Use `201` and `Location` for newly created resources.
- Use conditional requests for caching and concurrency.
- Standardize errors with Problem Details.
- Represent long-running work with operation resources.
- Prefer subordinate resources for actions with identity and lifecycle.
- Use RPC-style endpoints for genuine commands that do not fit CRUD.
- Document idempotency, retry, authorization, and failure behavior for every operation.
- Keep API contracts independent from domain and ORM classes.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is a resource in a REST-style HTTP API?

<!-- question:start:resource-modeling-rest-semantics-and-rpc-style-endpoints-beginner-q01 -->
<!-- question-id:resource-modeling-rest-semantics-and-rpc-style-endpoints-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A resource is a conceptual thing exposed by the API and identified by a URI. It can be an entity, collection, relationship, workflow, calculation, or operation. JSON is a representation of the resource, not the resource itself. Good resources model the client's business view rather than database tables.

##### Key Points to Mention

- URIs identify resources.
- Representations carry current resource state.
- A resource need not be a database row.
- Resource boundaries should reflect client use cases and business ownership.

<!-- question:end:resource-modeling-rest-semantics-and-rpc-style-endpoints-beginner-q01 -->

#### What is the difference between POST, PUT, and PATCH?

<!-- question:start:resource-modeling-rest-semantics-and-rpc-style-endpoints-beginner-q02 -->
<!-- question-id:resource-modeling-rest-semantics-and-rpc-style-endpoints-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

`POST` asks a resource to process content and commonly creates a new item under a collection with a server-assigned URI. `PUT` creates or replaces the state at a known target URI and is idempotent. `PATCH` applies a partial modification whose exact semantics come from its media type and are not automatically idempotent.

##### Key Points to Mention

- `POST /orders` commonly creates an order.
- `PUT /preferences/user-1` replaces known resource state.
- `PATCH` uses a defined patch format.
- Omitted-field behavior must be explicit.

<!-- question:end:resource-modeling-rest-semantics-and-rpc-style-endpoints-beginner-q02 -->

#### What do safe and idempotent mean in HTTP?

<!-- question:start:resource-modeling-rest-semantics-and-rpc-style-endpoints-beginner-q03 -->
<!-- question-id:resource-modeling-rest-semantics-and-rpc-style-endpoints-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A safe method does not ask the server to change application state; `GET`, `HEAD`, and `OPTIONS` are safe. An idempotent method has the same intended effect when repeated as when sent once; `PUT` and `DELETE` are idempotent even if repeated responses differ. `POST` is not inherently idempotent, and `PATCH` depends on the patch operation.

##### Key Points to Mention

- Safe methods can still produce logs and metrics.
- Idempotency concerns intended resource state, not identical responses.
- Safe methods are also idempotent.
- Retry behavior should follow method and operation semantics.

<!-- question:end:resource-modeling-rest-semantics-and-rpc-style-endpoints-beginner-q03 -->

#### Which status code should an API return after creating a resource?

<!-- question:start:resource-modeling-rest-semantics-and-rpc-style-endpoints-beginner-q04 -->
<!-- question-id:resource-modeling-rest-semantics-and-rpc-style-endpoints-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Return `201 Created` when the request creates a resource, and provide its URI in the `Location` header. The response can include the created representation. Use `202 Accepted` instead when processing has begun but is not complete, and provide a status or operation resource that the client can monitor.

##### Key Points to Mention

- `Location` identifies the created resource.
- `201` means creation completed.
- `202` requires a way to observe eventual completion.
- Use `200` when processing succeeds without creating a resource.

<!-- question:end:resource-modeling-rest-semantics-and-rpc-style-endpoints-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### When is an RPC-style action endpoint acceptable?

<!-- question:start:resource-modeling-rest-semantics-and-rpc-style-endpoints-intermediate-q01 -->
<!-- question-id:resource-modeling-rest-semantics-and-rpc-style-endpoints-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

An action endpoint is acceptable for a meaningful business command that does not map honestly to create, retrieve, replace, patch, or delete semantics. Examples include capturing a payment or approving an application. The endpoint should still define method semantics, idempotency, concurrency, status codes, and errors. If the action creates durable state with its own lifecycle, model that state as a subordinate resource instead.

##### Key Points to Mention

- Do not invent misleading nouns solely to avoid RPC.
- Use `POST` for non-idempotent commands unless stronger semantics are defined.
- Prefer resources for refunds, jobs, and attempts with identity.
- Consistency matters more than ideological purity.

<!-- question:end:resource-modeling-rest-semantics-and-rpc-style-endpoints-intermediate-q01 -->

#### How should an API model a long-running operation?

<!-- question:start:resource-modeling-rest-semantics-and-rpc-style-endpoints-intermediate-q02 -->
<!-- question-id:resource-modeling-rest-semantics-and-rpc-style-endpoints-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Accept the request and return `202 Accepted` with a `Location` pointing to an operation resource. The client retrieves that resource to observe pending, running, succeeded, failed, or cancelled status. The operation should eventually link to its result and expose failure information, retry guidance, and retention behavior.

##### Key Points to Mention

- Do not use `202` without observable progress.
- `Retry-After` can guide polling.
- Operation resources need stable identity and terminal states.
- Consider callbacks or events for suitable clients.

<!-- question:end:resource-modeling-rest-semantics-and-rpc-style-endpoints-intermediate-q02 -->

#### How do ETags prevent lost updates?

<!-- question:start:resource-modeling-rest-semantics-and-rpc-style-endpoints-intermediate-q03 -->
<!-- question-id:resource-modeling-rest-semantics-and-rpc-style-endpoints-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

The server returns an `ETag` representing the current resource version. A client sends that value in `If-Match` with a modifying request. If another client changed the resource, the tag no longer matches and the server returns `412 Precondition Failed` rather than overwriting newer state. The client can reload and resolve the conflict.

##### Key Points to Mention

- ETags are HTTP validators.
- `If-Match` provides optimistic concurrency.
- `If-None-Match` supports conditional retrieval and creation patterns.
- `412` specifically communicates failed preconditions.

<!-- question:end:resource-modeling-rest-semantics-and-rpc-style-endpoints-intermediate-q03 -->

#### Why should API models be separate from domain and persistence entities?

<!-- question:start:resource-modeling-rest-semantics-and-rpc-style-endpoints-intermediate-q04 -->
<!-- question-id:resource-modeling-rest-semantics-and-rpc-style-endpoints-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

API representations are external compatibility and authorization contracts. Domain entities contain behavior and invariants, while persistence entities reflect storage. Returning or binding those objects directly leaks implementation fields, permits overposting, couples clients to internal evolution, and can expose sensitive data. Explicit request and response models keep each concern independently shaped.

##### Key Points to Mention

- API inputs should express client intent.
- Responses may combine or omit internal data.
- Domain methods should control state changes.
- Mapping is intentional contract protection.

<!-- question:end:resource-modeling-rest-semantics-and-rpc-style-endpoints-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you decide whether to model an operation as an action or a subordinate resource?

<!-- question:start:resource-modeling-rest-semantics-and-rpc-style-endpoints-advanced-q01 -->
<!-- question-id:resource-modeling-rest-semantics-and-rpc-style-endpoints-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Model a subordinate resource when the outcome has identity, status, history, retries, authorization, or independent retrieval, such as a refund or payment attempt. Use an action when the operation is an instantaneous command with no useful persistent representation and a noun would be artificial. Evaluate client workflow, audit needs, idempotency, and whether multiple attempts can exist.

##### Key Points to Mention

- Durable lifecycle is a strong resource signal.
- A resource enables retrieval and status transitions.
- An action can communicate intent more honestly than fake CRUD.
- Both designs must specify HTTP and business semantics.

<!-- question:end:resource-modeling-rest-semantics-and-rpc-style-endpoints-advanced-q01 -->

#### How would you design partial updates without allowing clients to violate invariants?

<!-- question:start:resource-modeling-rest-semantics-and-rpc-style-endpoints-advanced-q02 -->
<!-- question-id:resource-modeling-rest-semantics-and-rpc-style-endpoints-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Choose and document a patch media type, whitelist mutable paths, authorize field-level changes, apply the patch to an input model or controlled command, and invoke domain behavior against authoritative state. Validate the resulting resource as a whole and require `If-Match` where concurrent updates matter. Do not blindly apply arbitrary JSON paths to tracked entities.

##### Key Points to Mention

- Patch syntax does not replace business validation.
- Merge Patch and JSON Patch have different semantics.
- Protect immutable and server-controlled fields.
- Concurrency preconditions prevent lost updates.

<!-- question:end:resource-modeling-rest-semantics-and-rpc-style-endpoints-advanced-q02 -->

#### How would you design a bulk endpoint with partial failures?

<!-- question:start:resource-modeling-rest-semantics-and-rpc-style-endpoints-advanced-q03 -->
<!-- question-id:resource-modeling-rest-semantics-and-rpc-style-endpoints-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Define whether the batch is atomic or item-independent. For independent processing, return a result per item using a client reference, status, location, and structured error. Bound batch size, specify ordering and concurrency, and support idempotency for retries. Use an asynchronous batch resource when work is too large for one request.

##### Key Points to Mention

- Atomicity cannot remain implicit.
- Clients need deterministic item correlation.
- Retry only failed items or replay safely with keys.
- Rate limits and payload limits still apply.

<!-- question:end:resource-modeling-rest-semantics-and-rpc-style-endpoints-advanced-q03 -->

#### What makes an HTTP API RESTful beyond using nouns and HTTP verbs?

<!-- question:start:resource-modeling-rest-semantics-and-rpc-style-endpoints-advanced-q04 -->
<!-- question-id:resource-modeling-rest-semantics-and-rpc-style-endpoints-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

REST is an architectural style based on resources, representations, a uniform interface, stateless communication, cacheable responses, layered components, and optionally code-on-demand. In HTTP APIs this means honoring method and status semantics, using metadata and links, enabling caching and conditional requests, and decoupling clients from implementation. Noun routes alone do not provide these properties.

##### Key Points to Mention

- Uniform interface is broader than CRUD naming.
- Statelessness and caching affect scalability and coupling.
- Representations and links mediate client interaction.
- Practical APIs can adopt REST constraints incrementally.

<!-- question:end:resource-modeling-rest-semantics-and-rpc-style-endpoints-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
