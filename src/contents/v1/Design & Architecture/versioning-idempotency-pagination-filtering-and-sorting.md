---
id: versioning-idempotency-pagination-filtering-and-sorting
topic: API design and integration contracts
subtopic: Versioning, idempotency, pagination, filtering, and sorting
category: Design & Architecture
---

## Overview

Versioning, idempotency, pagination, filtering, and sorting define how an API evolves, handles retries, and exposes large collections predictably.

These concerns are closely related:

- **Versioning** protects clients from breaking contract changes.
- **Idempotency** protects clients from duplicate side effects when requests are retried.
- **Pagination** bounds response size and query cost.
- **Filtering** lets clients select relevant resources.
- **Sorting** defines deterministic order and supports reliable page traversal.

An API can return valid JSON and still be difficult to use if:

- Minor changes unexpectedly break clients.
- Retried payment requests create duplicate charges.
- Offset pagination skips records during concurrent inserts.
- Sort order changes between requests.
- Arbitrary filters expose expensive or unsafe database behavior.

These topics matter in interviews because they test end-to-end contract thinking. A strong candidate should connect HTTP semantics, client behavior, database queries, concurrency, security, compatibility, and operational lifecycle.

## Core Concepts

### API Compatibility Is the Primary Goal

Version numbers are a mechanism. Compatibility is the goal.

A change is usually backward compatible when existing clients continue to behave correctly without modification.

Common additive changes:

- Adding an optional response property when clients ignore unknown fields.
- Adding an optional request property with a stable default.
- Adding a new endpoint.
- Adding a new optional filter or sort field.
- Adding a new enum value only when clients are designed for unknown values.

Common breaking changes:

- Removing or renaming a property.
- Changing a property's type or meaning.
- Making an optional request field required.
- Changing identifier format unexpectedly.
- Removing an endpoint or method.
- Changing pagination ordering or cursor semantics.
- Changing error codes that clients branch on.
- Tightening validation for previously accepted requests.
- Adding an enum value when generated clients treat enums as closed.

Compatibility depends on actual client assumptions, not only schema comparison.

### Design for Tolerant Evolution

Server practices:

- Prefer additive changes.
- Keep existing fields stable.
- Use explicit defaults.
- Avoid reusing a field with new meaning.
- Treat error shape and status codes as contract.
- Test representative older clients.

Client practices:

- Ignore unknown response properties.
- Avoid depending on property order.
- Treat unknown enum values defensively.
- Follow links instead of constructing every URI.
- Handle optional fields.
- Avoid parsing human-readable error text.

Tolerant readers reduce the need for new versions but do not excuse ambiguous server changes.

### When to Introduce a New Version

Create a new version when a change cannot be made compatible at acceptable cost.

Examples:

- A representation must be restructured.
- A workflow changes semantics.
- Required inputs change fundamentally.
- Security policy requires removing unsafe behavior.
- Error and status behavior changes incompatibly.
- A resource model is replaced.

Do not create a version for every release. Maintaining many nearly identical versions increases:

- Testing.
- Documentation.
- Security patching.
- Routing.
- Monitoring.
- Client confusion.

### Versioning Scope

Versioning can apply to:

- The entire API.
- A resource family.
- A representation media type.
- One operation.

Whole-API versions are easy to understand but can duplicate stable endpoints. Fine-grained versioning reduces duplication but is harder to communicate and operate.

Choose and document the scope clearly.

### URI Path Versioning

```http
GET /v2/orders/ord_123
```

Advantages:

- Highly visible.
- Easy to route, log, cache, and test.
- Simple for browsers and documentation.

Trade-offs:

- Version becomes part of resource identity.
- Clients must change URIs.
- Links must consistently use the selected version.
- Whole API trees can be duplicated.

Path versioning is common and pragmatic for public APIs.

### Query String Versioning

```http
GET /orders/ord_123?api-version=2026-06-01
```

Advantages:

- Keeps the base path stable.
- Easy for simple clients.
- Date-based versions can communicate contract snapshots.

Trade-offs:

- Easy to omit.
- Cache configuration must include the query parameter.
- Links and documentation must preserve it.
- Resource identity and representation selection can become mixed.

### Header Versioning

```http
GET /orders/ord_123
Api-Version: 2
```

Advantages:

- Keeps URIs stable.
- Separates version selection from resource identity.

Trade-offs:

- Less visible during manual exploration.
- Caches and gateways must vary correctly.
- Links do not automatically carry the version.
- Custom header behavior requires documentation.

### Media Type Versioning

```http
GET /orders/ord_123
Accept: application/vnd.example.order.v2+json
```

Advantages:

- Treats version as representation negotiation.
- Supports multiple representations at one URI.
- Aligns with content negotiation.

Trade-offs:

- More complex client configuration.
- Harder debugging and documentation.
- Cache keys need `Vary: Accept`.
- Easy to implement inconsistently.

There is no universally best versioning strategy. Consistency, tooling, client capabilities, cache behavior, and operational ownership matter more.

### Version Negotiation and Defaults

Define:

- What happens when no version is supplied.
- Whether the default can change.
- How unsupported versions fail.
- Which response reports the selected version.
- How generated documentation is grouped.

Avoid silently moving unversioned clients to a breaking latest version.

A stable default or an explicit version requirement is safer:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/api-version-required",
  "title": "An API version is required",
  "status": 400
}
```

### Supporting Multiple Versions

Avoid copying an entire application for each version.

A practical design can use:

```text
Versioned transport contracts
  -> version-specific mapping
  -> shared application use cases
  -> domain model
```

Reuse internal behavior when semantics remain the same. Fork the use case when behavior genuinely differs.

Do not let old DTOs dictate the current domain model.

### Deprecation and Sunset

Deprecation means clients should migrate away, but the resource can still operate. Sunset identifies when the resource is expected to become unavailable.

Responses can communicate lifecycle:

```http
Deprecation: @1782864000
Sunset: Tue, 30 Jun 2026 00:00:00 GMT
Link: <https://developer.example.com/migrations/v1-to-v2>;
      rel="deprecation"; type="text/html"
```

An effective retirement process includes:

- Published support policy.
- Advance notice.
- Migration documentation.
- Runtime headers.
- Usage telemetry by client and version.
- Direct communication for important consumers.
- A defined sunset date.
- Monitoring after retirement.

Do not remove a version based only on its age. Verify actual usage and migration feasibility.

### HTTP Idempotency

An operation is idempotent when repeating the same request has the same intended effect as sending it once.

Naturally idempotent:

- `GET`.
- `HEAD`.
- `PUT`.
- `DELETE`.
- `OPTIONS`.

Not inherently idempotent:

- `POST`.
- Some `PATCH` operations.

Examples:

```http
PUT /users/usr_42/preferences
```

sets a known state and can be repeated.

```http
POST /payments
```

can create a new payment each time unless the API adds idempotency behavior.

### Idempotency Does Not Mean Identical Responses

Repeated requests can return different statuses while having the same final effect:

```text
First DELETE: 204 No Content
Second DELETE: 404 Not Found
```

The resource remains absent after either request.

For idempotency-key replay, APIs often return the original status and body because clients need to know the outcome of the first attempt. This is an API contract choice.

### Why Retries Happen

A client can time out after the server commits:

```text
Client sends payment request.
Server creates charge.
Response is lost.
Client retries.
```

Without idempotency, the retry can create a second charge.

Clients retry because of:

- Timeouts.
- Connection resets.
- Gateway failures.
- `502`, `503`, or `504` responses.
- Process restarts.
- Mobile network changes.

The server must distinguish a retry from a new business request.

### Idempotency Keys

Many APIs support a client-generated idempotency key for unsafe operations:

```http
POST /payments
Idempotency-Key: 3f7da83a-51df-476c-84be-26552a76a421
Content-Type: application/json

{
  "orderId": "ord_123",
  "amount": 125.00,
  "currency": "USD"
}
```

The key should:

- Be unique for one intended operation.
- Have sufficient entropy.
- Be scoped to a tenant, principal, and operation.
- Be reused only for a retry of the same request.
- Have a documented retention period.

The `Idempotency-Key` header is a widely used API convention. The API must define its behavior explicitly rather than assuming all clients and intermediaries share one universal implementation.

### Idempotency Record

Store:

- Key.
- Scope.
- Request fingerprint.
- Processing state.
- Response status.
- Response headers that matter.
- Response body or resulting resource reference.
- Creation and expiration time.

Example:

```text
Key: 3f7d...
Tenant: tenant-7
Operation: POST /payments
Fingerprint: sha256(method + route + canonical body)
State: completed
Status: 201
Location: /payments/pay_88
ExpiresAt: 2026-06-15T10:00:00Z
```

### Request Fingerprints

If the same key is used with a different request, reject it:

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/idempotency-key-reused",
  "title": "The idempotency key was used for a different request",
  "status": 409
}
```

Fingerprint relevant request semantics:

- Method.
- Route identity.
- Authenticated tenant or account.
- Canonical request content.

Do not include volatile transport headers that change harmlessly between retries.

### Concurrent Duplicate Requests

Two identical requests can arrive before the first completes.

The idempotency store needs an atomic claim:

```text
Insert key as processing if absent.
If insert succeeds, execute operation.
If key exists:
  - different fingerprint -> reject
  - completed -> replay result
  - processing -> wait, poll, or return conflict
```

Use:

- Unique constraints.
- Transactions.
- Compare-and-set operations.
- Distributed storage when instances do not share memory.

An in-memory dictionary is insufficient in a scaled deployment and loses state on restart.

### What to Cache for Idempotency

Define whether to store:

- Successful responses.
- Deterministic client errors.
- Unexpected server errors.
- Timeouts.

Common policy:

- Replay completed success.
- Replay deterministic validation or business failure.
- Do not permanently cache transient infrastructure failures.
- Keep processing state recoverable.

The operation and idempotency record should commit atomically where possible. Otherwise the system can perform the side effect but fail to store the result.

### Idempotency Key Retention

Retention must exceed the realistic retry window.

Trade-offs:

- Short retention permits delayed duplicates.
- Long retention consumes storage and may retain sensitive response data.

Document:

- Key lifetime.
- Cleanup behavior.
- Whether expired keys can create new operations.
- Security and privacy treatment.

Store a result reference instead of a full sensitive response when appropriate.

### Business Identifiers as Natural Idempotency

Sometimes a client-provided business key is sufficient:

```http
PUT /payments/order-ord_123
```

or:

```json
{
  "merchantReference": "invoice-2026-1007"
}
```

A unique database constraint can prevent duplicates.

Use an idempotency key when one business resource can have several legitimate operations or when replay needs the original response.

### Pagination Goals

Pagination should:

- Bound query and payload cost.
- Produce deterministic traversal.
- Avoid missing or duplicating items where possible.
- Support stable links or cursors.
- Prevent unbounded page sizes.
- Preserve authorization and filters.

Every paginated query needs a total ordering, even when the client does not specify one.

### Page-Number Pagination

```http
GET /orders?page=3&pageSize=25
```

Advantages:

- Familiar UI model.
- Easy to jump to a page.
- Simple for small stable datasets.

Trade-offs:

- Usually implemented with offset.
- Deep pages become slower.
- Inserts and deletes shift page membership.
- Page numbers do not represent stable positions.

### Offset and Limit Pagination

```http
GET /orders?offset=50&limit=25
```

SQL-like behavior:

```sql
ORDER BY CreatedAt DESC, Id DESC
OFFSET 50 ROWS FETCH NEXT 25 ROWS ONLY;
```

Advantages:

- Simple.
- Supports arbitrary jumps.
- Works well for small administrative datasets.

Trade-offs:

- The database scans or discards earlier rows for deep offsets.
- Concurrent changes can create skips or duplicates.
- Results require deterministic ordering.

### Keyset Pagination

Keyset pagination uses the last item's sort values:

```http
GET /orders?limit=25&afterCreatedAt=2026-06-14T08:00:00Z&afterId=ord_123
```

Conceptual query:

```sql
WHERE CreatedAt < @afterCreatedAt
   OR (CreatedAt = @afterCreatedAt AND Id < @afterId)
ORDER BY CreatedAt DESC, Id DESC
FETCH FIRST 25 ROWS ONLY;
```

Advantages:

- Efficient with a matching index.
- Stable relative traversal during inserts.
- Good for feeds and large datasets.

Trade-offs:

- No simple arbitrary page jump.
- Predicate becomes complex for several sort fields.
- Clients should not construct raw position parameters.

### Cursor Pagination

A cursor is an opaque token encoding keyset state:

```http
GET /orders?limit=25&cursor=eyJjcmVhdGVkQXQiOiIuLi4ifQ
```

Response:

```json
{
  "items": [],
  "page": {
    "nextCursor": "eyJjcmVhdGVkQXQiOiIuLi4ifQ",
    "hasMore": true
  },
  "links": {
    "next": "/orders?limit=25&cursor=eyJjcmVhdGVkQXQiOiIuLi4ifQ"
  }
}
```

The cursor can encode:

- Last sort values.
- Filter fingerprint.
- Sort specification.
- Direction.
- Snapshot or expiration metadata.

Protect cursors with signing or authenticated encryption when clients must not tamper with them. Treat them as opaque, not secret, unless encrypted.

### Stable Ordering

Sorting by a nonunique field is insufficient:

```sql
ORDER BY CreatedAt DESC
```

Rows sharing the same timestamp can move between requests.

Add a unique tie-breaker:

```sql
ORDER BY CreatedAt DESC, Id DESC
```

The cursor and index must include the same fields and directions.

### Pagination Under Concurrent Changes

No ordinary live pagination strategy creates a perfect immutable snapshot automatically.

Options:

- Accept live-view semantics and document possible movement.
- Use keyset traversal to reduce insert-related shifts.
- Capture a high-water mark.
- Use a database snapshot or exported result resource.
- Include a consistency timestamp.

For financial exports or legal reports, create a report resource over a fixed snapshot rather than paginating a changing collection.

### Total Counts

Exact totals can be expensive.

Options:

- Return exact `totalCount`.
- Return approximate count.
- Return `hasMore`.
- Omit totals.
- Provide a separate count endpoint.

Do not execute an expensive full count automatically when the client only needs the next page.

### Filtering

Filtering narrows a collection:

```http
GET /orders?status=paid&customerId=cus_42
```

Define:

- Supported fields.
- Operators.
- Type formats.
- Case sensitivity.
- Time zone behavior.
- Repeated parameter behavior.
- Null handling.
- Maximum complexity.

Range example:

```http
GET /orders?createdFrom=2026-06-01T00:00:00Z&createdTo=2026-07-01T00:00:00Z
```

Search example:

```http
GET /products?q=wireless+keyboard
```

Free-text search and exact filtering are different capabilities and should have different semantics.

### Filter Syntax

Simple named parameters are easiest:

```text
?status=paid&minTotal=100
```

Structured expressions can support complex clients:

```text
?filter=status eq 'paid' and total gt 100
```

Expression languages require:

- A grammar.
- Type checking.
- Allowlists.
- Complexity limits.
- Parameterized translation.
- Clear error reporting.

Do not concatenate filter text into SQL.

### Filtering Security and Cost

Filtering can expose:

- SQL injection through unsafe translation.
- Unauthorized fields.
- Side-channel information.
- Full table scans.
- Expensive joins.
- Denial of service through complex expressions.

Protect the API by:

- Allowlisting fields and operators.
- Parameterizing queries.
- Applying authorization before or within filtering.
- Limiting expression depth and list size.
- Enforcing timeouts and page limits.
- Indexing supported query patterns.
- Monitoring expensive combinations.

### Sorting

Common syntax:

```http
GET /orders?sort=-createdAt,total
```

Convention:

- `createdAt` means ascending.
- `-createdAt` means descending.

Define:

- Allowed sort fields.
- Default order.
- Maximum number of fields.
- Null placement.
- Case and collation behavior.
- Stable tie-breaker.
- Interaction with cursors.

Never pass raw client field names into dynamic SQL.

### Sorting and Database Indexes

A query:

```text
status = paid
sort = createdAt desc, id desc
```

may benefit from an index shaped like:

```text
(Status, CreatedAt DESC, Id DESC)
```

Index strategy depends on:

- Selectivity.
- Query frequency.
- Write cost.
- Database capabilities.
- Tenant partitioning.

Do not advertise arbitrary sorting if the backend cannot support it safely and predictably.

### Combining Pagination, Filtering, and Sorting

Execution concept:

```text
Authorize scope
  -> apply filters
  -> apply deterministic sort
  -> apply cursor boundary
  -> fetch pageSize + 1
  -> build next cursor
```

Fetching one extra row determines `hasMore` without a full count.

The cursor should be invalid if reused with different:

- Filters.
- Sort order.
- Tenant.
- API version.
- Page direction.

Encode or store a fingerprint of these parameters.

### ASP.NET Core and EF Core Example

```csharp
public sealed record OrderQuery(
    string? Status,
    DateTimeOffset? CreatedFrom,
    string Sort = "-createdAt",
    string? Cursor = null,
    int Limit = 50);
```

```csharp
var limit = Math.Clamp(request.Limit, 1, 100);

IQueryable<OrderReadModel> query = dbContext.Orders
    .AsNoTracking()
    .Where(order => order.TenantId == currentTenant.Id);

if (request.Status is not null)
{
    query = query.Where(order => order.Status == request.Status);
}

if (request.CreatedFrom is not null)
{
    query = query.Where(
        order => order.CreatedAt >= request.CreatedFrom);
}

var cursor = cursorCodec.Decode(request.Cursor);

if (cursor is not null)
{
    query = query.Where(order =>
        order.CreatedAt < cursor.CreatedAt ||
        (order.CreatedAt == cursor.CreatedAt &&
         string.Compare(order.Id, cursor.Id) < 0));
}

var rows = await query
    .OrderByDescending(order => order.CreatedAt)
    .ThenByDescending(order => order.Id)
    .Take(limit + 1)
    .Select(order => new OrderListItem(
        order.Id,
        order.Status,
        order.CreatedAt,
        order.Total))
    .ToListAsync(cancellationToken);
```

Production code should use typed cursor values and database-translatable comparisons appropriate to the identifier type.

### Error Behavior

Return clear client errors for invalid collection requests:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/invalid-sort-field",
  "title": "The requested sort field is not supported",
  "status": 400,
  "errors": {
    "sort": [
      "Allowed fields are createdAt, total, and status."
    ]
  }
}
```

Do not silently ignore misspelled filters or sort fields. Silent fallback can return incorrect business results.

### Testing Versioning

Test:

- Old contract fixtures.
- Unknown-field tolerance.
- Removed or renamed fields.
- Version routing and default behavior.
- Unsupported versions.
- Documentation per version.
- Deprecation headers.
- Cross-version behavior where semantics differ.

Consumer-driven contract tests can help when important consumers are known, but they do not replace provider compatibility policy.

### Testing Idempotency

Test:

- Same key and same request replays the result.
- Same key and different payload is rejected.
- Concurrent duplicate requests produce one effect.
- Process failure between side effect and response.
- Expired-key behavior.
- Tenant scoping.
- Retry after transient failure.
- Sensitive data retention.

Use integration tests against the actual shared idempotency store and database constraints.

### Testing Pagination and Query Features

Test:

- Empty, first, middle, and final pages.
- Duplicate sort values.
- Inserts and deletes between page requests.
- Forward and backward traversal if supported.
- Cursor tampering and expiration.
- Cursor reuse with changed filters.
- Maximum page size.
- Unsupported filters and sorts.
- Authorization isolation.
- Database query plans for important combinations.

Property-based tests can verify that stable datasets produce every item exactly once.

### Common Mistakes

- Versioning every deployment.
- Changing an unversioned default to the newest breaking version.
- Treating field addition as safe without considering strict clients and enums.
- Maintaining old versions without telemetry or retirement plans.
- Assuming `POST` retries are safe.
- Storing idempotency keys only in process memory.
- Reusing the same key with different content.
- Failing to handle concurrent duplicate requests.
- Keeping keys for less time than client retries.
- Paginating without deterministic order.
- Using offset for unbounded deep traversal.
- Exposing cursor internals as a client contract.
- Returning exact totals for every expensive query.
- Allowing arbitrary filter expressions or sort columns.
- Building dynamic SQL from request strings.
- Ignoring authorization in filterable collections.
- Reusing a cursor with different filters or versions.

### Best Practices

- Prefer compatible additive evolution before adding a version.
- Version only when contract semantics must break.
- Choose one versioning strategy and apply it consistently.
- Publish deprecation, migration, and sunset information.
- Make unsafe retryable operations idempotent with durable, scoped keys.
- Store request fingerprints and atomically claim keys.
- Design for duplicate and concurrent retries.
- Use bounded page sizes and deterministic total ordering.
- Prefer cursor or keyset pagination for large changing datasets.
- Treat cursors as opaque and bind them to query context.
- Allowlist filters and sort fields.
- Parameterize all query translation.
- Match indexes to supported filter and sort patterns.
- Return explicit errors for invalid query parameters.
- Test contract compatibility and data traversal behavior.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### When should an API introduce a new version?

<!-- question:start:versioning-idempotency-pagination-filtering-and-sorting-beginner-q01 -->
<!-- question-id:versioning-idempotency-pagination-filtering-and-sorting-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Introduce a new version when a required contract change would break existing clients and cannot reasonably be made additive or compatible. Examples include removing fields, changing types or meanings, restructuring resources, or changing workflow semantics. Do not create a version for every server release because each supported version adds operational and maintenance cost.

##### Key Points to Mention

- Compatibility is the goal; versioning is a mechanism.
- Prefer additive changes first.
- Client assumptions determine whether a change is breaking.
- Versions need support and retirement policies.

<!-- question:end:versioning-idempotency-pagination-filtering-and-sorting-beginner-q01 -->

#### What does idempotency mean for an API request?

<!-- question:start:versioning-idempotency-pagination-filtering-and-sorting-beginner-q02 -->
<!-- question-id:versioning-idempotency-pagination-filtering-and-sorting-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

An idempotent request has the same intended effect when repeated as when sent once. `PUT` and `DELETE` are idempotent by HTTP semantics, while `POST` is not inherently idempotent. Responses do not have to be identical. APIs can add idempotency keys to make unsafe operations such as payment creation safe to retry.

##### Key Points to Mention

- Idempotency concerns final intended state.
- Repeated `DELETE` responses may differ.
- Network failures make retry safety important.
- Server implementation must enforce the guarantee.

<!-- question:end:versioning-idempotency-pagination-filtering-and-sorting-beginner-q02 -->

#### What is the difference between offset and cursor pagination?

<!-- question:start:versioning-idempotency-pagination-filtering-and-sorting-beginner-q03 -->
<!-- question-id:versioning-idempotency-pagination-filtering-and-sorting-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Offset pagination skips a number of rows and is simple and jumpable, but deep offsets are slower and concurrent changes can shift results. Cursor pagination uses an opaque continuation position, commonly based on the last item's sort keys. It is more stable and efficient for large changing datasets but does not naturally support arbitrary page jumps.

##### Key Points to Mention

- Both require deterministic sorting.
- Cursor pagination commonly implements keyset traversal.
- Offset works well for small administrative lists.
- Cursor state should be opaque and validated.

<!-- question:end:versioning-idempotency-pagination-filtering-and-sorting-beginner-q03 -->

#### Why must paginated results have a stable sort order?

<!-- question:start:versioning-idempotency-pagination-filtering-and-sorting-beginner-q04 -->
<!-- question-id:versioning-idempotency-pagination-filtering-and-sorting-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Without a total deterministic order, the database can return equal rows in different orders between requests, causing duplicates and missing items across pages. Add a unique tie-breaker such as `Id` after the user-selected sort field, and use the same fields in the keyset cursor and supporting index.

##### Key Points to Mention

- Sorting by a nonunique timestamp alone is insufficient.
- Default sorting must also be deterministic.
- Cursor values must match the complete order.
- Database indexes should support the order.

<!-- question:end:versioning-idempotency-pagination-filtering-and-sorting-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### What are the trade-offs among path, query, header, and media-type versioning?

<!-- question:start:versioning-idempotency-pagination-filtering-and-sorting-intermediate-q01 -->
<!-- question-id:versioning-idempotency-pagination-filtering-and-sorting-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Path versioning is visible and easy to route but changes resource URIs. Query versioning is explicit and easy for clients but can be omitted and must be included in cache keys. Header versioning keeps URIs stable but is less discoverable. Media-type versioning aligns with representation negotiation but increases tooling and caching complexity. Consistency and client fit matter more than theoretical purity.

##### Key Points to Mention

- Every strategy affects caching and links.
- Define behavior when version is missing.
- Do not silently move clients to a breaking default.
- Keep internal use cases shared where semantics remain compatible.

<!-- question:end:versioning-idempotency-pagination-filtering-and-sorting-intermediate-q01 -->

#### How should an idempotency-key implementation handle retries?

<!-- question:start:versioning-idempotency-pagination-filtering-and-sorting-intermediate-q02 -->
<!-- question-id:versioning-idempotency-pagination-filtering-and-sorting-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Atomically claim a key scoped to the caller and operation, store a fingerprint of the request, and execute the side effect once. Save the resulting status, important headers, and body or resource reference. A retry with the same key and fingerprint receives the recorded result; a different fingerprint is rejected. A request arriving while processing is in progress must wait, poll, or receive a defined conflict response.

##### Key Points to Mention

- Use durable shared storage.
- Enforce uniqueness atomically.
- Bind the key to tenant, route, and request semantics.
- Document expiration and error-caching behavior.

<!-- question:end:versioning-idempotency-pagination-filtering-and-sorting-intermediate-q02 -->

#### How does keyset pagination work with multiple sort fields?

<!-- question:start:versioning-idempotency-pagination-filtering-and-sorting-intermediate-q03 -->
<!-- question-id:versioning-idempotency-pagination-filtering-and-sorting-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

The cursor stores the last row's complete ordered key tuple. For descending `createdAt` and `id`, the next query selects rows with an earlier timestamp, or the same timestamp and a smaller ID, then applies the identical order. The predicate expands lexicographically for more fields, and a matching composite index is important.

##### Key Points to Mention

- Include a unique tie-breaker.
- Direction must be consistent in order and predicate.
- Encode the tuple in an opaque cursor.
- Bind the cursor to filters and API version.

<!-- question:end:versioning-idempotency-pagination-filtering-and-sorting-intermediate-q03 -->

#### How should an API safely implement filtering and sorting?

<!-- question:start:versioning-idempotency-pagination-filtering-and-sorting-intermediate-q04 -->
<!-- question-id:versioning-idempotency-pagination-filtering-and-sorting-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Publish an allowlist of fields, operators, directions, and formats. Parse parameters into typed expressions and use parameterized query APIs rather than string-concatenated SQL. Apply authorization, complexity limits, maximum list sizes, and bounded page sizes. Reject unknown fields instead of silently ignoring them, and index supported high-value combinations.

##### Key Points to Mention

- Filtering is both a security and performance surface.
- Raw client field names must not become SQL.
- Define case, null, date, and collation semantics.
- Stable tie-breaker sorting is mandatory for pagination.

<!-- question:end:versioning-idempotency-pagination-filtering-and-sorting-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you retire an old API version safely?

<!-- question:start:versioning-idempotency-pagination-filtering-and-sorting-advanced-q01 -->
<!-- question-id:versioning-idempotency-pagination-filtering-and-sorting-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Publish a support policy, migration guide, deprecation date, and sunset date. Emit runtime `Deprecation`, `Sunset`, and documentation links, monitor usage by version and client, and contact important consumers. Keep security fixes flowing during support. Remove the version only after migration evidence and a controlled shutdown plan, then monitor failures.

##### Key Points to Mention

- Deprecation does not itself change behavior.
- Sunset communicates expected unavailability.
- Telemetry is necessary because documentation alone is insufficient.
- Client migration time and contractual commitments matter.

<!-- question:end:versioning-idempotency-pagination-filtering-and-sorting-advanced-q01 -->

#### How do you make an idempotent payment endpoint correct under concurrent duplicate requests?

<!-- question:start:versioning-idempotency-pagination-filtering-and-sorting-advanced-q02 -->
<!-- question-id:versioning-idempotency-pagination-filtering-and-sorting-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use a durable idempotency table with a unique key scoped to merchant and operation. Atomically insert a processing record before charging, verify the request fingerprint, and ensure the payment record and idempotency outcome are committed consistently. Concurrent duplicates observe the existing processing or completed state. Add a unique merchant reference where possible and design recovery for a crash around the external gateway call.

##### Key Points to Mention

- In-memory locks do not work across instances or restarts.
- External side effects require provider idempotency or reconciliation.
- Persist processing, completed, and recoverable failure states.
- Replays must not leak another tenant's response.

<!-- question:end:versioning-idempotency-pagination-filtering-and-sorting-advanced-q02 -->

#### How do you provide consistent pagination over a rapidly changing dataset?

<!-- question:start:versioning-idempotency-pagination-filtering-and-sorting-advanced-q03 -->
<!-- question-id:versioning-idempotency-pagination-filtering-and-sorting-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

First define whether the client needs a live view or a fixed snapshot. For live feeds, use keyset pagination with a unique order and optionally capture a high-water mark so newer items do not enter later pages. For exact exports, create a report or snapshot resource and paginate that immutable result. Document how updates and deletions affect traversal.

##### Key Points to Mention

- No pagination algorithm creates snapshot semantics by itself.
- Keyset reduces shifting but does not freeze updates.
- High-water marks bound the viewed dataset.
- Exact business reports need explicit snapshot ownership.

<!-- question:end:versioning-idempotency-pagination-filtering-and-sorting-advanced-q03 -->

#### How would you evolve pagination or filtering without breaking existing clients?

<!-- question:start:versioning-idempotency-pagination-filtering-and-sorting-advanced-q04 -->
<!-- question-id:versioning-idempotency-pagination-filtering-and-sorting-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Preserve existing parameter meanings, default order, limits, cursor validity policy, response fields, and link behavior. Add optional capabilities rather than changing defaults. If cursor encoding changes, continue decoding old cursors for their documented lifetime or introduce a new cursor version internally. A semantic change such as replacing live offset pages with snapshot cursors may require a versioned endpoint or explicit opt-in.

##### Key Points to Mention

- Collection behavior is part of the API contract.
- Default sort changes can be breaking.
- Opaque cursors permit internal evolution if compatibility is planned.
- Test older client requests and stored continuation tokens.

<!-- question:end:versioning-idempotency-pagination-filtering-and-sorting-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
