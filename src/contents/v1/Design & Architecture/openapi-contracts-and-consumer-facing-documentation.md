---
id: openapi-contracts-and-consumer-facing-documentation
topic: API design and integration contracts
subtopic: OpenAPI contracts and consumer-facing documentation
category: Design & Architecture
---

## Overview

OpenAPI is a language-independent specification for describing HTTP APIs in a machine-readable JSON or YAML document. It describes operations, paths, parameters, request bodies, responses, schemas, authentication mechanisms, examples, callbacks, webhooks, and reusable components.

An OpenAPI document can support:

- Interactive reference documentation.
- Client and server code generation.
- Contract testing.
- Request and response validation.
- API linting and governance.
- Mock servers.
- Compatibility analysis.
- Gateway and developer-portal configuration.

OpenAPI is not a substitute for all documentation. A consumer also needs task-oriented guides, authentication instructions, workflow explanations, error and retry behavior, rate limits, versioning policy, examples, and support information.

A strong API contract answers both structural and behavioral questions:

- Which request is valid?
- Which responses can occur?
- Which fields are required or nullable?
- How is authentication supplied?
- Is an operation idempotent?
- How should pagination and retries work?
- Which errors are stable enough for automation?
- How does a consumer complete a real business workflow?

This topic matters in interviews because candidates must connect design, implementation, testing, documentation, compatibility, and consumer experience. Producing a generated Swagger page is not enough if the document is incomplete, inaccurate, or unusable for client generation.

## Core Concepts

### OpenAPI Description Versus API Version

The OpenAPI document contains two different version concepts:

```yaml
openapi: 3.1.0
info:
  title: Ordering API
  version: 2.3.0
```

- `openapi` identifies the OpenAPI Specification feature set used by the document.
- `info.version` identifies the described API contract or document version.

Neither automatically defines the runtime versioning strategy. An API can use path, header, query, or media-type versioning independently.

Use a specification version supported by the team's tooling. The current OpenAPI Specification continues to evolve, while generators and frameworks may support earlier versions such as OpenAPI 3.1 or 3.0.

### Main OpenAPI Structure

A simplified document:

```yaml
openapi: 3.1.0
info:
  title: Ordering API
  version: 1.0.0
  description: Creates and manages customer orders.
servers:
  - url: https://api.example.com
paths:
  /orders/{orderId}:
    get:
      operationId: getOrder
      summary: Retrieve an order
      parameters:
        - $ref: '#/components/parameters/OrderId'
      responses:
        '200':
          description: The order
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '404':
          $ref: '#/components/responses/NotFound'
components:
  schemas:
    Order:
      type: object
      required:
        - id
        - status
      properties:
        id:
          type: string
          example: ord_123
        status:
          type: string
          enum:
            - draft
            - submitted
            - paid
```

The contract should be valid for tooling and understandable to a human reviewer.

### Paths and Operations

Each operation should define:

- HTTP method and path.
- Stable `operationId`.
- Summary and detailed description.
- Tags.
- Parameters.
- Request-body media types and schema.
- Every expected response.
- Security requirements.
- Deprecation state.

Example:

```yaml
post:
  operationId: createOrder
  summary: Create a draft order
  tags:
    - Orders
  requestBody:
    required: true
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/CreateOrderRequest'
  responses:
    '201':
      description: Order created
      headers:
        Location:
          description: URI of the created order
          schema:
            type: string
            format: uri-reference
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Order'
    '422':
      $ref: '#/components/responses/ValidationProblem'
```

Documenting only a successful `200` response hides important contract behavior.

### Stable Operation IDs

`operationId` uniquely identifies an operation and is frequently used as a generated client method name.

Prefer:

```text
getOrder
createOrder
cancelOrder
listCustomerOrders
```

Avoid unstable values derived from implementation method names or route text.

Changing an operation ID can break generated clients even if the HTTP route remains compatible. Treat it as consumer-facing contract.

### Parameters

OpenAPI distinguishes:

- Path parameters.
- Query parameters.
- Header parameters.
- Cookie parameters.

Document:

- Data type and format.
- Whether required.
- Default and allowed values.
- Serialization style.
- Description and example.
- Constraints such as minimum and maximum.

```yaml
- name: limit
  in: query
  required: false
  description: Maximum number of orders to return.
  schema:
    type: integer
    minimum: 1
    maximum: 100
    default: 50
```

Every path-template parameter must be defined and required.

### Request Bodies and Media Types

Specify the accepted media types and schema:

```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/CreateOrderRequest'
```

An operation can support several media types:

```yaml
content:
  application/json:
    schema:
      $ref: '#/components/schemas/ImportRequest'
  text/csv:
    schema:
      type: string
```

Do not document `application/json` if the implementation requires a vendor-specific or patch media type.

### Schema Precision

Schemas should express what consumers can rely on:

```yaml
Money:
  type: object
  required:
    - amount
    - currency
  properties:
    amount:
      type: number
      multipleOf: 0.01
      example: 125.50
    currency:
      type: string
      pattern: '^[A-Z]{3}$'
      example: USD
```

Useful constraints include:

- `required`.
- `minimum` and `maximum`.
- `minLength` and `maxLength`.
- `pattern`.
- `format`.
- `enum`.
- `minItems` and `maxItems`.
- `uniqueItems`.
- Composition such as `oneOf`, `anyOf`, and `allOf`.

Do not add constraints that the runtime does not enforce. Do not omit constraints that clients must satisfy.

### Required, Optional, and Nullable

These are distinct:

- **Required** means the property must appear.
- **Optional** means it can be omitted.
- **Nullable** means `null` is an allowed value.

In an OpenAPI 3.1-style schema:

```yaml
middleName:
  type:
    - string
    - 'null'
```

An optional nullable field can be absent or explicitly `null`. A required nullable field must be present but may be `null`.

This distinction affects validation and generated types.

### Read-Only and Write-Only Properties

Use schema annotations to clarify direction:

```yaml
id:
  type: string
  readOnly: true

password:
  type: string
  format: password
  writeOnly: true
```

These annotations do not implement authorization or data masking. The server must still enforce behavior.

Separate request and response schemas when one shared schema becomes confusing.

### Enums and Compatibility

Enums improve discoverability but can create compatibility risk.

```yaml
status:
  type: string
  enum:
    - pending
    - completed
    - failed
```

Adding a value can break generated clients that model a closed enum.

Options include:

- Document that consumers must tolerate unknown values.
- Generate extensible-enum types where supported.
- Use a string plus documented known values.
- Introduce a version for an incompatible semantic change.

Never reuse an existing enum value with a new meaning.

### Polymorphism

OpenAPI supports schema composition and discriminators:

```yaml
PaymentMethod:
  oneOf:
    - $ref: '#/components/schemas/CardPaymentMethod'
    - $ref: '#/components/schemas/BankTransferMethod'
  discriminator:
    propertyName: type
    mapping:
      card: '#/components/schemas/CardPaymentMethod'
      bankTransfer: '#/components/schemas/BankTransferMethod'
```

Use polymorphism only when it reflects a stable contract. Complex inheritance models can generate poor client code across languages.

Prefer a clear discriminator and validate every supported variant.

### Reusable Components

`components` can hold reusable:

- Schemas.
- Parameters.
- Headers.
- Responses.
- Examples.
- Security schemes.
- Request bodies.
- Links.
- Callbacks.

```yaml
components:
  responses:
    NotFound:
      description: The resource was not found.
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetails'
```

Reuse reduces duplication, but excessive indirection makes documents hard to read. Share concepts that are genuinely the same contract.

### Examples

Examples make abstract schemas concrete:

```yaml
examples:
  paidOrder:
    summary: A paid order ready for fulfillment
    value:
      id: ord_123
      status: paid
      total:
        amount: 125.50
        currency: USD
```

Provide examples for:

- Typical success.
- Validation errors.
- Authentication and authorization failures.
- Conflict states.
- Pagination.
- Asynchronous operations.
- Edge cases.

Validate examples against schemas in CI. Stale examples damage trust.

### Response Documentation

Document all deliberate responses:

```yaml
responses:
  '200':
    description: Order returned
  '304':
    description: Cached representation remains current
  '401':
    $ref: '#/components/responses/Unauthorized'
  '403':
    $ref: '#/components/responses/Forbidden'
  '404':
    $ref: '#/components/responses/NotFound'
  '429':
    $ref: '#/components/responses/RateLimited'
```

Include relevant headers:

- `Location`.
- `ETag`.
- `Retry-After`.
- Pagination links.
- Rate-limit metadata.
- Deprecation and sunset information.

A `default` response can describe unexpected errors but should not replace known status-specific contracts.

### Problem Details

Use a reusable Problem Details schema:

```yaml
ProblemDetails:
  type: object
  properties:
    type:
      type: string
      format: uri-reference
    title:
      type: string
    status:
      type: integer
    detail:
      type: string
    instance:
      type: string
      format: uri-reference
    traceId:
      type: string
```

Document stable extension members such as:

- Machine-readable error code.
- Field errors.
- Correlation ID.
- Retryability.

Consumers should not parse human-readable `detail` text.

### Security Schemes

OpenAPI can describe authentication mechanisms:

```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

```yaml
security:
  - bearerAuth: []
```

OAuth scopes:

```yaml
security:
  - oauth2:
      - orders.read
      - orders.write
```

Security declarations describe how credentials are supplied. They do not express every authorization rule, such as resource ownership or tenant isolation.

Never place real secrets or usable production tokens in examples.

### Callbacks and Webhooks

OpenAPI can describe requests sent by the provider to a consumer.

Document:

- Registration.
- Event types.
- Payload schemas.
- Signature verification.
- Retry policy.
- Delivery ordering.
- Duplicate handling.
- Expected responses.
- Timeout behavior.

A schema alone is not enough for reliable webhook integration.

### Links

Links can describe a relationship from one response to another operation:

```yaml
links:
  GetCreatedOrder:
    operationId: getOrder
    parameters:
      orderId: '$response.body#/id'
```

Links improve workflow discoverability and can support generated clients or documentation tools, though tooling support varies.

### Contract-First Development

Contract-first workflow:

```text
Design OpenAPI contract
  -> review with consumers
  -> lint and validate
  -> generate mocks or stubs
  -> implement provider and clients
  -> verify implementation
```

Benefits:

- Consumers can review before implementation.
- Parallel frontend and backend development.
- Earlier compatibility and governance checks.
- Contract drives implementation intentionally.

Costs:

- Requires disciplined synchronization.
- Generated server code can constrain implementation.
- Teams need specification expertise.

### Code-First Development

Code-first workflow:

```text
Implement annotated endpoints
  -> generate OpenAPI document
  -> publish and test contract
```

Benefits:

- Implementation and contract metadata remain close.
- Productive for existing ASP.NET Core APIs.
- Type information can be inferred.

Risks:

- Generated descriptions can be incomplete.
- Implementation names can leak into the contract.
- Error responses, examples, and behavior require deliberate metadata.
- Contract review may happen too late.

Code-first does not mean contract-last. Generate and review the document in CI before release.

### Hybrid Workflow

A practical hybrid:

1. Design important paths and schemas with consumers.
2. Implement using typed endpoint metadata.
3. Generate the OpenAPI document.
4. Diff it against the approved contract.
5. Run contract and example tests.
6. Publish the generated artifact.

The source of truth must be explicit. Two independently edited documents will drift.

### ASP.NET Core OpenAPI Generation

Modern ASP.NET Core provides built-in OpenAPI document generation through `Microsoft.AspNetCore.OpenApi`.

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

The generated document is available from a route such as:

```text
/openapi/v1.json
```

ASP.NET Core can generate multiple documents for audiences or versions and can generate documents at build time. Interactive UIs are separate tools and are not the OpenAPI document itself.

### Endpoint Metadata in ASP.NET Core

```csharp
app.MapGet(
    "/orders/{orderId}",
    async Task<Results<Ok<OrderResponse>, NotFound>> (
        string orderId,
        IOrderQueries queries,
        CancellationToken cancellationToken) =>
    {
        var order = await queries.GetAsync(
            orderId,
            cancellationToken);

        return order is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(order);
    })
    .WithName("GetOrder")
    .WithSummary("Retrieve an order")
    .WithDescription(
        "Returns an order visible to the authenticated caller.")
    .WithTags("Orders")
    .Produces<OrderResponse>(StatusCodes.Status200OK)
    .Produces(StatusCodes.Status404NotFound);
```

Stable endpoint names commonly become operation IDs. Typed results and response metadata help generate accurate response contracts.

### Document Transformers

Generation pipelines can add:

- API metadata.
- Security schemes.
- Common headers.
- Environment-specific servers.
- Standard error responses.
- Naming conventions.

Transformers should not hide missing endpoint design. Keep custom logic deterministic and test generated output.

### Build-Time Generation

Build-time generation is useful when the document is:

- Stored as a release artifact.
- Diffed for breaking changes.
- Used to generate clients.
- Published statically.
- Used by contract tests.

The generation process can execute application startup. Avoid requiring unavailable databases, secrets, or external services merely to produce the contract.

### Contract Validation

CI should validate:

- Document syntax.
- References.
- Unique operation IDs.
- Required metadata.
- Schema consistency.
- Examples against schemas.
- Organization naming rules.
- Security declarations.
- Known response coverage.

Lint rules should support consumer value rather than enforce arbitrary style.

### Breaking-Change Detection

Compare the proposed document with the released baseline.

Potential breaking changes include:

- Removed operation.
- Removed response or media type.
- New required request field.
- Narrowed accepted values.
- Changed type or format.
- Removed enum value.
- Changed operation ID.
- Changed authentication requirement.
- Changed parameter location.

Automated diffing catches structural changes. Human review is still needed for semantic changes that keep the same schema.

### Generated Clients

Generated clients can provide:

- Typed request and response models.
- Serialization.
- Route construction.
- Authentication hooks.
- Basic error handling.

Risks include:

- Poor names from unstable operation IDs.
- Closed enums.
- Large generated code changes.
- Generator-specific behavior.
- Runtime and dependency coupling.

Pin generator versions, inspect output, and wrap generated clients when application code needs insulation.

### Contract Testing

Useful tests include:

- Provider implementation matches the OpenAPI response schema.
- Consumer requests conform to the contract.
- Examples remain valid.
- Important workflows work against a mock and real provider.
- Older released contracts remain supported.
- Generated clients compile and pass smoke tests.

Schema validation cannot prove business semantics, authorization, or idempotency. Combine it with behavioral tests.

### Consumer-Facing Documentation

A useful documentation portal includes:

- Overview and intended audience.
- Getting started.
- Base URLs and environments.
- Authentication setup.
- Quick-start request and response.
- Task-oriented guides.
- Endpoint reference.
- Errors and troubleshooting.
- Pagination, filtering, and sorting.
- Idempotency and retry guidance.
- Rate limits.
- Webhook behavior.
- Versioning, changelog, deprecation, and migration.
- SDK instructions.
- Support and service expectations.

Reference documentation answers "what exists." Guides answer "how do I accomplish my goal."

### Examples and Tutorials

Examples should be:

- Runnable.
- Minimal but realistic.
- Free of secrets.
- Versioned with the API.
- Tested automatically.
- Available in common client languages where justified.

Show complete workflows:

```text
Authenticate
  -> create order with idempotency key
  -> retrieve order
  -> handle validation conflict
  -> paginate order history
```

Isolated curl snippets are helpful but do not replace workflow guidance.

### Documentation for Behavior OpenAPI Cannot Fully Express

Document explicitly:

- Idempotency-key retention.
- Eventual consistency.
- Retryable status codes.
- Rate-limit windows.
- Ordering guarantees.
- Pagination snapshot behavior.
- Webhook redelivery.
- Data freshness.
- Authorization ownership rules.
- Long-running operation lifecycle.
- Support and uptime commitments.

Use OpenAPI extensions sparingly when tooling consumes them. Otherwise keep behavioral documentation beside the reference.

### Public and Internal Documents

A service can produce different documents for:

- Public consumers.
- Partner consumers.
- Internal operators.
- API versions.

Do not rely on documentation filtering as access control. Undocumented endpoints still require authentication and authorization.

Avoid publishing internal topology, administrative operations, or sensitive schemas unnecessarily.

### Documentation Ownership

The team that owns the API should own its contract and documentation.

Include documentation in the definition of done:

- Contract updated.
- Examples updated.
- Compatibility reviewed.
- Changelog written.
- Migration notes supplied for breaking changes.
- Consumer feedback collected.

Documentation that is updated by a separate team after release will predictably drift.

### Common Mistakes

- Treating Swagger UI as complete consumer documentation.
- Generating a contract without reviewing it.
- Documenting only success responses.
- Unstable or duplicate operation IDs.
- Returning schemas that differ from runtime JSON.
- Confusing OpenAPI version with API version.
- Omitting nullability and required-property semantics.
- Publishing ORM or domain entities directly.
- Adding examples that fail schema validation.
- Declaring authentication without explaining authorization.
- Assuming generated clients tolerate every additive change.
- Editing code and a separate contract independently.
- Skipping compatibility diffing.
- Exposing internal endpoints through a public document.
- Describing behavior the server does not enforce.

### Best Practices

- Treat the OpenAPI description as a release artifact and consumer contract.
- Choose one explicit source of truth.
- Use stable operation IDs and business-facing schema names.
- Document all expected responses, headers, and media types.
- Express required, nullable, read-only, and write-only semantics precisely.
- Provide validated success and error examples.
- Describe authentication and stable authorization requirements.
- Generate and lint the document in CI.
- Diff against the last released contract.
- Test provider behavior and generated clients.
- Pair reference documentation with task-oriented guides.
- Document behavior that schemas cannot capture.
- Publish changelogs, deprecation notices, and migration guides.
- Keep public and internal contracts intentionally separated.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is OpenAPI, and what is it used for?

<!-- question:start:openapi-contracts-and-consumer-facing-documentation-beginner-q01 -->
<!-- question-id:openapi-contracts-and-consumer-facing-documentation-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

OpenAPI is a language-independent specification for describing HTTP APIs in JSON or YAML. It defines paths, operations, parameters, request bodies, responses, schemas, security, and examples. Tools use the document for interactive reference, client generation, mocks, validation, testing, and governance.

##### Key Points to Mention

- It is a machine-readable API description.
- Humans and tools can consume it.
- It describes the contract, not the implementation.
- It does not replace task-oriented documentation.

<!-- question:end:openapi-contracts-and-consumer-facing-documentation-beginner-q01 -->

#### What is the difference between the OpenAPI version and the API version?

<!-- question:start:openapi-contracts-and-consumer-facing-documentation-beginner-q02 -->
<!-- question-id:openapi-contracts-and-consumer-facing-documentation-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

The top-level `openapi` field identifies the version of the OpenAPI Specification used to interpret the document. `info.version` identifies the described API contract or document release. Runtime API versioning through paths, headers, queries, or media types is a separate design decision.

##### Key Points to Mention

- OpenAPI 3.1 does not mean API version 3.1.
- Tooling must support the selected specification version.
- Runtime versions should be documented explicitly.
- Document versioning does not create compatibility automatically.

<!-- question:end:openapi-contracts-and-consumer-facing-documentation-beginner-q02 -->

#### Why are operation IDs important?

<!-- question:start:openapi-contracts-and-consumer-facing-documentation-beginner-q03 -->
<!-- question-id:openapi-contracts-and-consumer-facing-documentation-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

An `operationId` uniquely identifies an operation and is commonly used as a generated client method name or link target. It should be stable, unique, and business-oriented. Changing it can break generated clients even when the HTTP route and schema remain unchanged.

##### Key Points to Mention

- Treat operation IDs as public contract.
- Avoid deriving them from unstable implementation names.
- Validate uniqueness in CI.
- Use clear names such as `getOrder` and `createOrder`.

<!-- question:end:openapi-contracts-and-consumer-facing-documentation-beginner-q03 -->

#### Why is generated API reference documentation not enough?

<!-- question:start:openapi-contracts-and-consumer-facing-documentation-beginner-q04 -->
<!-- question-id:openapi-contracts-and-consumer-facing-documentation-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Generated reference explains available operations and schemas, but consumers also need authentication setup, workflows, retries, idempotency, pagination, rate limits, error handling, versioning, migration, and troubleshooting. OpenAPI cannot fully express every operational and business guarantee. Reference and task-oriented documentation serve different needs.

##### Key Points to Mention

- Reference answers what; guides answer how.
- Show complete consumer workflows.
- Document behavioral guarantees outside schemas.
- Keep guides and examples versioned with the API.

<!-- question:end:openapi-contracts-and-consumer-facing-documentation-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### What are the trade-offs between contract-first and code-first OpenAPI workflows?

<!-- question:start:openapi-contracts-and-consumer-facing-documentation-intermediate-q01 -->
<!-- question-id:openapi-contracts-and-consumer-facing-documentation-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Contract-first enables consumer review, mocks, parallel development, and governance before implementation, but requires specification discipline and synchronization. Code-first keeps metadata close to implementation and is productive in frameworks such as ASP.NET Core, but generated descriptions can be incomplete and implementation details can leak. A hybrid can design important contracts first, generate from code, and diff against the approved artifact.

##### Key Points to Mention

- Make the source of truth explicit.
- Do not maintain two independently editable contracts.
- Code-first still requires contract review.
- Contract-first does not remove implementation conformance testing.

<!-- question:end:openapi-contracts-and-consumer-facing-documentation-intermediate-q01 -->

#### How should required, optional, and nullable properties be documented?

<!-- question:start:openapi-contracts-and-consumer-facing-documentation-intermediate-q02 -->
<!-- question-id:openapi-contracts-and-consumer-facing-documentation-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Required means a property must be present. Optional means it may be omitted. Nullable means `null` is an allowed value. These states must match runtime serialization and validation because they affect generated client types. Request and response schemas should be separated when directional requirements differ substantially.

##### Key Points to Mention

- Omitted and explicit null are different.
- `readOnly` and `writeOnly` describe direction.
- Test generated schemas against real payloads.
- Avoid one ambiguous schema for every operation.

<!-- question:end:openapi-contracts-and-consumer-facing-documentation-intermediate-q02 -->

#### How would you use OpenAPI in a CI pipeline?

<!-- question:start:openapi-contracts-and-consumer-facing-documentation-intermediate-q03 -->
<!-- question-id:openapi-contracts-and-consumer-facing-documentation-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Generate or load the document, validate syntax and references, lint organization rules, validate examples, check unique operation IDs, and compare it with the released baseline for breaking changes. Then run provider conformance tests and optionally generate clients and compile or smoke-test them. Publish the approved document as a release artifact.

##### Key Points to Mention

- Structural diffing catches many compatibility problems.
- Human review is still needed for semantic changes.
- Pin validator and generator versions.
- Fail the build when contract and implementation drift.

<!-- question:end:openapi-contracts-and-consumer-facing-documentation-intermediate-q03 -->

#### How should authentication and authorization be represented?

<!-- question:start:openapi-contracts-and-consumer-facing-documentation-intermediate-q04 -->
<!-- question-id:openapi-contracts-and-consumer-facing-documentation-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Define security schemes for mechanisms such as bearer tokens, OAuth flows, API keys, or mutual TLS, then apply security requirements globally or per operation. Document required OAuth scopes. Also provide prose for resource ownership, tenant isolation, and role rules because OpenAPI security declarations do not fully express object-level authorization.

##### Key Points to Mention

- Security schemes describe credential transport.
- Empty operation security can intentionally make an endpoint anonymous.
- Do not include live secrets in examples.
- Documentation never replaces runtime authorization.

<!-- question:end:openapi-contracts-and-consumer-facing-documentation-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How do you detect breaking API changes with OpenAPI?

<!-- question:start:openapi-contracts-and-consumer-facing-documentation-advanced-q01 -->
<!-- question-id:openapi-contracts-and-consumer-facing-documentation-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Compare the candidate document with the released baseline using an OpenAPI-aware diff. Detect removed operations, responses, media types, fields, or enum values; new required inputs; narrowed constraints; changed types, security, parameter locations, and operation IDs. Add human review for semantic changes that preserve structure, such as changed field meaning or default behavior.

##### Key Points to Mention

- Compatibility is consumer behavior, not only schema shape.
- Additive enum values can break closed generated enums.
- Set policy for allowed and reviewed changes.
- Keep baselines for every supported API version.

<!-- question:end:openapi-contracts-and-consumer-facing-documentation-advanced-q01 -->

#### How do you prevent generated clients from becoming a source of coupling?

<!-- question:start:openapi-contracts-and-consumer-facing-documentation-advanced-q02 -->
<!-- question-id:openapi-contracts-and-consumer-facing-documentation-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Stabilize operation IDs and schema names, pin the generator and configuration, review generated diffs, and test representative clients. Keep generated code in a dedicated package and wrap it behind application-facing interfaces when consumers need insulation. Avoid exposing generated transport models throughout the consumer's domain logic.

##### Key Points to Mention

- Generator upgrades can produce unrelated breaking changes.
- Transport types should remain at integration boundaries.
- Publish SDKs with explicit compatibility policy.
- Test unknown fields, enums, errors, and retries.

<!-- question:end:openapi-contracts-and-consumer-facing-documentation-advanced-q02 -->

#### How would you document webhook reliability and security?

<!-- question:start:openapi-contracts-and-consumer-facing-documentation-advanced-q03 -->
<!-- question-id:openapi-contracts-and-consumer-facing-documentation-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Describe event payloads and expected consumer responses in OpenAPI, then document signature construction and rotation, timestamp tolerance, replay protection, timeout, retry schedule, duplicate delivery, ordering, event IDs, retention, and test tooling. Consumers must acknowledge quickly, verify signatures on raw payloads, and process idempotently.

##### Key Points to Mention

- Schema alone does not define delivery guarantees.
- Never promise exactly-once delivery.
- Include event version and stable identifier.
- Provide a sandbox or replay mechanism where feasible.

<!-- question:end:openapi-contracts-and-consumer-facing-documentation-advanced-q03 -->

#### How would you produce different OpenAPI documents for public and internal consumers?

<!-- question:start:openapi-contracts-and-consumer-facing-documentation-advanced-q04 -->
<!-- question-id:openapi-contracts-and-consumer-facing-documentation-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Classify endpoint metadata by audience and generate separate named documents with independent descriptions, security schemes, and publication pipelines. Test each document against included endpoints and prevent internal schemas from leaking through references. Keep runtime authentication and network controls because removing an operation from public documentation is not access control.

##### Key Points to Mention

- Audience-specific documents reduce irrelevant exposure.
- Shared components must be filtered carefully.
- ASP.NET Core can generate multiple named documents.
- Internal endpoints still require full security enforcement.

<!-- question:end:openapi-contracts-and-consumer-facing-documentation-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
