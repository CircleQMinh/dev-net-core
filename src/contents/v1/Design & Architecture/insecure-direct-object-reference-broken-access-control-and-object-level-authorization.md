---
id: insecure-direct-object-reference-broken-access-control-and-object-level-authorization
topic: Web application security threat modeling and attack patterns
subtopic: Insecure Direct Object Reference, broken access control, and object-level authorization
category: Design & Architecture
---

## Overview

Insecure Direct Object Reference (IDOR) occurs when an application exposes a reference to an object and accepts that reference without verifying that the current principal is authorized to access the specific object.

For example:

```http
GET /api/invoices/4812
```

If a user can change `4812` to `4813` and read another customer's invoice, the application has an object-level authorization failure. The identifier may be an integer, GUID, filename, account number, storage key, GraphQL node ID, or any other value that locates a resource.

IDOR is one form of **broken access control**. In API security, the same weakness is commonly called **Broken Object Level Authorization (BOLA)**. The central problem is not that the identifier is visible or guessable. The problem is that the server trusts a caller-controlled reference without enforcing an authorization decision for the resolved object.

Authentication answers, "Who is the caller?" Authorization answers, "May this caller perform this action on this object in its current context?" A valid login, role, or token does not automatically authorize access to every object reachable by the application.

This topic matters in interviews because it tests whether candidates can place authorization at the correct boundary, model horizontal and vertical privilege escalation, design multi-tenant data access, and write negative tests. Strong answers do not rely on hidden routes, disabled buttons, sequential-ID replacement, or globally unique identifiers as security controls.

## Core Concepts

### Direct Object References

A direct object reference is any client-visible value used to locate server-side data:

- Database primary keys.
- UUIDs or GUIDs.
- Usernames and email addresses.
- Filenames and paths.
- Cloud object-storage keys.
- Order, invoice, account, or ticket numbers.
- Encoded GraphQL global IDs.
- Document-sharing tokens.

Direct references are not inherently insecure. They become vulnerable when the server retrieves or modifies the referenced object without checking whether the current caller may perform the requested action.

### IDOR, BOLA, and Broken Access Control

The terms overlap but have different scope:

- **IDOR** emphasizes unsafe use of a caller-controlled object reference.
- **BOLA** emphasizes missing object-level authorization in an API.
- **Broken access control** is the broader category, including object, function, field, tenant, role, and workflow authorization failures.

Examples include:

- Reading another user's profile.
- Updating another tenant's order.
- Deleting a document the caller may only view.
- Calling an administrator endpoint as a normal user.
- Changing a protected field such as `role` or `approved`.
- Downloading a private file through a predictable storage key.

### Authentication Is Not Authorization

This check proves only that the caller signed in:

```csharp
[Authorize]
[HttpGet("/api/orders/{id:guid}")]
public async Task<IActionResult> GetOrder(Guid id)
{
    var order = await db.Orders.FindAsync(id);
    return order is null ? NotFound() : Ok(order);
}
```

If any authenticated user can supply any order ID, the endpoint may expose other users' data.

A safer query constrains the object to the caller's authorization scope:

```csharp
[Authorize]
[HttpGet("/api/orders/{id:guid}")]
public async Task<IActionResult> GetOrder(Guid id)
{
    var tenantId = currentUser.TenantId;

    var order = await db.Orders
        .Where(order => order.Id == id && order.TenantId == tenantId)
        .Select(order => new OrderResponse(
            order.Id,
            order.Status,
            order.Total))
        .SingleOrDefaultAsync();

    return order is null ? NotFound() : Ok(order);
}
```

The object lookup and tenant boundary are enforced together.

### Horizontal, Vertical, and Contextual Authorization

**Horizontal privilege escalation** accesses another principal's object at a similar privilege level:

```text
Customer A reads Customer B's invoice.
```

**Vertical privilege escalation** performs an action reserved for a more privileged role:

```text
A customer approves a refund reserved for finance staff.
```

**Contextual authorization** depends on relationships, state, purpose, or time:

```text
A support agent may view a case only while assigned to it.
A manager may approve an expense only below a limit.
An author may edit a draft but not a published record.
```

Real authorization often combines all three dimensions.

### Object-Level Authorization

Object-level authorization evaluates:

```text
principal + action + resource + context -> allow or deny
```

A complete decision may consider:

- User or service identity.
- Tenant membership.
- Ownership.
- Role and permissions.
- Resource state.
- Relationship to the resource.
- Delegation or sharing rules.
- Time, location, device, or risk signals.
- The requested operation and fields.

Checking only a broad permission such as `orders.read` may be insufficient. The application may also need to prove that the order belongs to a tenant or account the caller can access.

### Scope Queries to the Authorized Data Set

When possible, include authorization constraints in the query:

```csharp
public Task<Project?> FindVisibleProjectAsync(
    Guid projectId,
    Guid userId,
    CancellationToken cancellationToken)
{
    return db.Projects
        .Where(project => project.Id == projectId)
        .Where(project =>
            project.OwnerId == userId ||
            project.Members.Any(member => member.UserId == userId))
        .SingleOrDefaultAsync(cancellationToken);
}
```

Benefits include:

- Unauthorized objects are not materialized.
- Callers cannot easily forget a later ownership check.
- The same rule can constrain detail, list, search, and export queries.
- The database optimizer can apply filters efficiently.

Complex authorization may still require policy evaluation after loading the object. In that case, ensure no sensitive response, mutation, event, or cache entry occurs before authorization completes.

### Resource-Based Authorization in ASP.NET Core

ASP.NET Core supports authorization against a loaded resource:

```csharp
var document = await documents.FindAsync(id, cancellationToken);
if (document is null)
{
    return NotFound();
}

var result = await authorizationService.AuthorizeAsync(
    User,
    document,
    "CanEditDocument");

if (!result.Succeeded)
{
    return Forbid();
}

document.Rename(request.Name);
await unitOfWork.SaveChangesAsync(cancellationToken);
return NoContent();
```

A handler can centralize the rule:

```csharp
public sealed class DocumentOwnerHandler
    : AuthorizationHandler<OperationAuthorizationRequirement, Document>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        OperationAuthorizationRequirement requirement,
        Document resource)
    {
        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (requirement.Name == Operations.Update.Name &&
            resource.OwnerId.ToString() == userId &&
            resource.Status == DocumentStatus.Draft)
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
```

Resource-based policies are useful when the decision depends on object ownership, relationships, or state rather than only static claims.

### RBAC, ABAC, ReBAC, and Ownership

Authorization models can be combined:

- **Role-Based Access Control (RBAC):** permissions are assigned through roles.
- **Attribute-Based Access Control (ABAC):** decisions use attributes of the principal, resource, action, and environment.
- **Relationship-Based Access Control (ReBAC):** decisions use relationships such as owner, member, manager, or shared-with.
- **Ownership checks:** access is allowed because the caller owns the resource.

RBAC alone can become too coarse:

```text
Role: Customer
Permission: ReadInvoice
```

The permission still needs an object constraint:

```text
Invoice.CustomerId == CurrentCustomer.Id
```

Use the simplest model that correctly expresses the business rule, and centralize repeated decisions.

### Multi-Tenant Isolation

Tenant isolation is an object-level authorization boundary. Every tenant-owned query and mutation must be scoped to the trusted current tenant.

Unsafe:

```csharp
var report = await db.Reports.SingleAsync(x => x.Id == request.ReportId);
```

Safer:

```csharp
var report = await db.Reports.SingleOrDefaultAsync(
    x => x.Id == request.ReportId &&
         x.TenantId == currentTenant.Id,
    cancellationToken);
```

Do not trust a tenant ID supplied in the request body or query string unless the caller is authorized to select that tenant. Derive the active tenant from a validated session, token claim, membership selection, or another trusted server-side context.

Defense in depth may include:

- Global query filters.
- Tenant-aware repositories.
- Database schemas or databases per tenant.
- Database row-level security.
- Separate encryption keys.
- Automated cross-tenant tests.

No single layer eliminates the need for application-level authorization.

### UUIDs and Opaque Identifiers

Replacing sequential IDs with random UUIDs makes enumeration harder and can reduce accidental disclosure. It does not enforce authorization.

UUIDs can leak through:

- Browser history.
- Logs and analytics.
- Referrer headers.
- Email and chat.
- Shared screenshots.
- API responses.
- Frontend source or caches.

Every request must remain safe when an attacker knows a valid identifier. Treat opaque IDs as defense in depth and usability tools, not permission checks.

### Indirect References

An application can map a short-lived, user-scoped external reference to an internal identifier:

```text
Browser sees: /downloads/a8f2c1
Server maps: a8f2c1 -> user 17's report 9004
```

This can reduce identifier exposure, but the mapping itself must:

- Be unguessable when secrecy is intended.
- Be scoped to a user, tenant, purpose, or expiration.
- Be revoked when access changes.
- Be checked for every use.

Signed URLs and capability links intentionally grant access to anyone possessing the token. Their scope, lifetime, audience, and leakage risk must match that model.

### Collection, Search, Export, and Batch Endpoints

Object authorization is not only a detail-endpoint concern.

Review:

- List and search filters.
- Counts and aggregates.
- Reports and exports.
- Batch reads, updates, and deletes.
- GraphQL connections and node resolvers.
- WebSocket subscriptions.
- Background jobs.
- Audit-log queries.

This batch endpoint is unsafe if it authorizes only the operation:

```http
POST /api/documents/archive

{ "ids": ["doc-a", "doc-b", "doc-c"] }
```

The server must authorize each object or construct one query that selects only objects the caller may archive. It should define whether partial success is allowed and avoid leaking which unauthorized IDs exist.

### Nested Routes Do Not Imply Authorization

A route such as:

```http
GET /api/customers/25/orders/900
```

does not prove that order `900` belongs to customer `25`. The query must validate the relationship:

```csharp
var order = await db.Orders.SingleOrDefaultAsync(
    order => order.Id == orderId &&
             order.CustomerId == customerId &&
             order.TenantId == currentTenant.Id);
```

Parent IDs are attacker-controlled input too.

### Field-Level and Property-Level Authorization

A caller may be authorized to update an object but not every field.

Unsafe model binding:

```csharp
public sealed record UpdateUserRequest(
    string DisplayName,
    string Role,
    bool IsApproved);
```

Safer public contract:

```csharp
public sealed record UpdateProfileRequest(string DisplayName);
```

Use purpose-specific request models, allowlist writable properties, and authorize privileged transitions separately. This prevents mass-assignment or over-posting vulnerabilities from becoming vertical privilege escalation.

### Function-Level and Object-Level Authorization

Function-level authorization asks whether a caller may invoke an operation:

```text
May this user call ApproveRefund?
```

Object-level authorization asks whether the caller may perform it on a particular resource:

```text
May this finance user approve this refund for this tenant, amount, and state?
```

Secure endpoints often need both. Route-level role checks do not replace resource checks.

### Service and Domain Boundaries

Authorization should be enforced at a boundary that every relevant caller passes through.

Controller-only checks can be bypassed when the same application service is invoked by:

- Another controller.
- GraphQL or gRPC.
- A message consumer.
- A scheduled job.
- An administrative tool.

A practical design separates:

- Authentication and request-context construction at the edge.
- Application authorization policies around use cases and resources.
- Domain invariants that must hold regardless of caller.
- Infrastructure filters such as tenant query scoping.

Do not place framework principal objects deep inside domain entities. Pass explicit, validated decisions or domain-relevant actor data into the use case.

### Mutations, State, and Time-of-Check Risks

Authorization can depend on resource state, and that state may change between checking and writing.

For sensitive mutations:

- Load and authorize within an appropriate transaction.
- Include expected tenant, owner, version, and state in the update predicate.
- Use optimistic concurrency where appropriate.
- Re-evaluate rules after state transitions if later work depends on them.
- Ensure background processing retains the authorization context or trusted delegation.

Example constrained update:

```csharp
var affected = await db.Invoices
    .Where(invoice =>
        invoice.Id == invoiceId &&
        invoice.TenantId == currentTenant.Id &&
        invoice.Status == InvoiceStatus.Draft)
    .ExecuteUpdateAsync(
        setters => setters.SetProperty(
            invoice => invoice.Status,
            InvoiceStatus.Submitted),
        cancellationToken);

if (affected == 0)
{
    return NotFound();
}
```

The write predicate protects the same boundaries used for the decision.

### Caches and Derived Data

Authorization bugs can occur even when the database query is correct:

- A cache key omits tenant or user scope.
- A CDN caches a private response publicly.
- A report contains data the current caller cannot read.
- A search index is queried without access filters.
- A notification includes a private object title.
- A presigned URL remains valid after permission revocation.

Cache keys and invalidation policies must include every dimension that changes the authorized result. Shared caches should not store personalized responses unless their variation and privacy controls are explicit.

### Error Responses and Information Disclosure

Applications commonly choose between:

- `403 Forbidden`: the resource exists, but the caller lacks permission.
- `404 Not Found`: do not reveal whether an inaccessible resource exists.

Either can be valid if applied consistently. Returning `404` can reduce object enumeration, but it does not replace authorization. Internal logs should preserve enough detail for investigation without exposing sensitive identifiers or data to the caller.

### Administrative and Support Access

Privileged access should be explicit rather than implemented as a broad bypass.

Consider:

- Separate permissions for viewing and modifying customer data.
- Just-in-time elevation.
- Reason or ticket requirements.
- Step-up authentication.
- Tenant-aware support sessions.
- Read-only impersonation where possible.
- Tamper-resistant audit events.
- User or security-team notifications for sensitive actions.

An `IsAdmin` shortcut scattered throughout code is difficult to review and often grants more authority than intended.

### Testing Authorization

Authorization tests should be negative and matrix-driven.

For each endpoint, test:

- Owner with an allowed action.
- Owner with a disallowed action.
- Another user in the same tenant.
- A user in another tenant.
- A privileged role with and without the required scope.
- Anonymous access.
- Missing and malformed identifiers.
- Valid identifiers learned through another workflow.
- Every method, field, batch item, and alternate API surface.
- Resource state changes and revoked access.

Example integration test:

```csharp
[Fact]
public async Task GetInvoice_DoesNotReturnAnotherTenantInvoice()
{
    using var client = factory.CreateAuthenticatedClient(tenantId: TenantA.Id);

    var response = await client.GetAsync(
        $"/api/invoices/{TenantBInvoice.Id}");

    Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
}
```

Testing only happy paths leaves the most important authorization behavior unverified.

### Common Mistakes

Common failures include:

- Checking authentication without object authorization.
- Trusting an ID because it came from a hidden field or route.
- Treating UUIDs as access control.
- Trusting tenant or owner IDs from the request.
- Hiding buttons in the UI without enforcing the rule server-side.
- Authorizing list endpoints but not detail endpoints, or the reverse.
- Checking read permission before a write without checking the requested action.
- Applying role checks but no ownership or tenant constraint.
- Fetching an object globally and forgetting a later policy check.
- Returning entities directly and exposing protected fields.
- Reusing cache entries across users or tenants.
- Omitting background jobs, exports, files, and subscriptions from the authorization review.
- Implementing broad administrator bypasses without audit controls.

### Best-Practice Decision Process

For every operation:

1. Identify the authenticated principal and trusted tenant context.
2. Define the action precisely: read, update, delete, approve, share, export, or another operation.
3. Resolve the resource only within the caller's authorized scope when possible.
4. Evaluate role, relationship, ownership, state, and field-level rules.
5. Deny by default when the policy cannot make a confident decision.
6. Apply the same rule across every transport and background path.
7. Return a consistent `403` or conceal existence with `404` according to policy.
8. Audit high-impact allowed and denied actions.
9. Test cross-user, cross-role, and cross-tenant negative cases.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is an Insecure Direct Object Reference?

<!-- question:start:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-beginner-q01 -->
<!-- question-id:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

IDOR occurs when an application accepts a caller-controlled object reference and accesses the object without checking whether the current caller is authorized for that specific object and action. Changing an invoice, user, document, or file ID may expose or modify another principal's data. The server must enforce object-level authorization on every request.

##### Key Points to Mention

- The identifier is a locator, not proof of permission.
- IDOR is a form of broken access control.
- Both reads and writes can be vulnerable.
- Authorization must be enforced server-side.

<!-- question:end:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-beginner-q01 -->

#### What is the difference between authentication and authorization?

<!-- question:start:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-beginner-q02 -->
<!-- question-id:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Authentication establishes who the caller is. Authorization decides whether that caller may perform a particular action on a particular resource in the current context. An authenticated customer may read their own invoice but not another customer's invoice, and may be allowed to view a record without being allowed to approve or delete it.

##### Key Points to Mention

- Login is not a complete access-control check.
- Authorization includes principal, action, resource, and context.
- Different operations can require different permissions.
- Deny access when the rule is missing or uncertain.

<!-- question:end:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-beginner-q02 -->

#### Do UUIDs prevent IDOR?

<!-- question:start:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-beginner-q03 -->
<!-- question-id:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

No. UUIDs make blind enumeration harder, but valid identifiers can leak through logs, links, API responses, browser history, shared content, or other endpoints. The application must remain secure when an attacker knows a valid ID. UUIDs are defense in depth, while object-level authorization is the actual control.

##### Key Points to Mention

- Unpredictability is not permission.
- Any valid identifier may eventually be disclosed.
- Authorization is required for every lookup and mutation.
- Opaque IDs can still reduce enumeration and accidental exposure.

<!-- question:end:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-beginner-q03 -->

#### What are horizontal and vertical privilege escalation?

<!-- question:start:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-beginner-q04 -->
<!-- question-id:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Horizontal escalation accesses another principal's resources at a similar privilege level, such as one customer reading another customer's order. Vertical escalation gains a more privileged capability, such as a normal user invoking an administrator approval action. An endpoint can be vulnerable to both if it lacks function-level and object-level checks.

##### Key Points to Mention

- Horizontal checks commonly involve owner or tenant boundaries.
- Vertical checks commonly involve roles and permissions.
- Resource state and relationships may add contextual rules.
- UI restrictions do not enforce either boundary.

<!-- question:end:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you fix an endpoint that retrieves an order by ID?

<!-- question:start:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-intermediate-q01 -->
<!-- question-id:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Derive the caller and tenant from trusted authentication context, then query for the order using both its ID and the caller's authorized scope. If authorization is relationship- or state-dependent, load the constrained object and run a resource-based policy before returning or mutating it. Project only permitted fields and return a consistent `404` or `403` according to the application's disclosure policy.

##### Key Points to Mention

- Do not trust owner or tenant IDs supplied by the client.
- Prefer authorization constraints in the database query.
- Check the requested operation, not only generic access.
- Prevent data exposure before the decision completes.

<!-- question:end:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-intermediate-q01 -->

#### When should authorization be query-based versus policy-based?

<!-- question:start:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-intermediate-q02 -->
<!-- question-id:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Query-based authorization works well for ownership, tenant membership, visibility, and relationships that can be expressed efficiently in data access. It avoids loading unauthorized rows. Policy-based authorization is useful when decisions require richer role, resource-state, delegation, or environmental logic. Many systems combine them: constrain the candidate data set in the query, then evaluate a centralized resource policy for the requested action.

##### Key Points to Mention

- Query scoping reduces accidental exposure and improves efficiency.
- Policies centralize complex reusable decisions.
- Avoid duplicating inconsistent rules across controllers.
- Ensure every transport reaches the same authorization boundary.

<!-- question:end:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-intermediate-q02 -->

#### How do mass assignment and field-level authorization relate to broken access control?

<!-- question:start:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-intermediate-q03 -->
<!-- question-id:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

A caller may be authorized to update an object but not privileged properties such as role, price, approval status, owner, or tenant. Binding an entire entity or broad request model can let the caller set protected fields. Use purpose-specific DTOs, allowlist writable fields, validate state transitions, and require separate permissions for privileged changes.

##### Key Points to Mention

- Object access does not imply access to every property.
- Avoid binding persistence entities directly.
- Authorize sensitive transitions explicitly.
- Apply output filtering as well as input restrictions.

<!-- question:end:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-intermediate-q03 -->

#### Should an unauthorized object request return 403 or 404?

<!-- question:start:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-intermediate-q04 -->
<!-- question-id:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

`403` clearly states that the caller is authenticated but forbidden, while `404` can conceal whether an inaccessible object exists. The choice depends on the API contract and information-disclosure policy. Use it consistently, avoid timing or response-body differences that defeat concealment, and never treat `404` as a replacement for the actual authorization check.

##### Key Points to Mention

- Both statuses can be valid.
- Concealment can reduce enumeration.
- Internal logs may record the true reason securely.
- Consistency matters across endpoints.

<!-- question:end:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you design object-level authorization for a multi-tenant .NET application?

<!-- question:start:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-advanced-q01 -->
<!-- question-id:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Establish the active tenant from validated identity and membership context, not arbitrary request data. Make tenant scope mandatory in repositories or query services, constrain reads and writes by tenant and object ID, and use ASP.NET Core resource-based policies for role, relationship, action, and state rules. Add defense in depth through query filters or row-level security, tenant-aware cache keys, scoped background jobs, audit logs, and automated cross-tenant negative tests.

##### Key Points to Mention

- Tenant context must be trusted and explicit.
- Every data path, cache, search index, and job needs the boundary.
- Database controls supplement application authorization.
- Administrative cross-tenant access needs narrow permissions and auditing.

<!-- question:end:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-advanced-q01 -->

#### How do you secure batch, search, and export endpoints against BOLA?

<!-- question:start:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-advanced-q02 -->
<!-- question-id:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Construct the result set from the caller's authorized scope before applying user filters, sorting, pagination, aggregation, or export. For batch mutations, authorize every object or issue a constrained set-based update that includes tenant, relationship, state, and action predicates. Define atomic versus partial-success behavior without leaking unauthorized object existence, and apply limits to prevent authorization checks from becoming a denial-of-service vector.

##### Key Points to Mention

- Collection endpoints can leak data, counts, and metadata.
- Pagination must occur after authorization filters.
- Batch permission must not be inferred from one authorized object.
- Generated files require the same access and retention controls.

<!-- question:end:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-advanced-q02 -->

#### How can caching and asynchronous processing reintroduce authorization vulnerabilities?

<!-- question:start:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-advanced-q03 -->
<!-- question-id:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

A cache may return one tenant's response to another if its key omits tenant, user, permission, locale, or resource-state dimensions. Background jobs may process IDs later without preserving a trusted tenant or delegated authority, and signed download URLs may outlive revoked access. Include authorization scope in cache keys, avoid publicly caching private responses, carry explicit trusted execution context into jobs, revalidate access when appropriate, and use narrow expirations and revocation strategies for capabilities.

##### Key Points to Mention

- Correct controller checks do not secure downstream derived data automatically.
- Cache variation must match authorization variation.
- Jobs should not trust serialized caller-supplied tenant IDs.
- Capability URLs intentionally shift authorization to possession of the token.

<!-- question:end:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-advanced-q03 -->

#### How would you create a comprehensive authorization test strategy?

<!-- question:start:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-advanced-q04 -->
<!-- question-id:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Build an authorization matrix of principals, tenants, roles, relationships, actions, resource states, and fields. Add policy unit tests and integration tests that exercise owners, same-tenant non-owners, cross-tenant users, privileged users with insufficient scope, anonymous callers, revoked access, and state transitions. Cover detail, collection, search, batch, export, file, GraphQL, messaging, and background paths. Verify both status codes and absence of sensitive data or side effects.

##### Key Points to Mention

- Negative tests are the core of authorization assurance.
- Test every action and alternate transport.
- Seed known cross-tenant objects and attempt direct access.
- Keep tests when identifiers change from integers to UUIDs.

<!-- question:end:insecure-direct-object-reference-broken-access-control-and-object-level-authorization-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
