---
id: api-gateway-and-bff-decisions-for-web-clients-and-microservices
topic: API design and integration contracts
subtopic: API gateway and BFF decisions for web clients and microservices
category: Design & Architecture
---

## Overview

An API gateway is an edge component that provides one entry point to backend APIs and applies shared routing, security, traffic, and protocol policies. A Backend for Frontend (BFF) is a backend tailored to the needs of one frontend or client experience, such as a browser application, mobile app, or partner portal.

They solve related but different problems:

- A gateway centralizes common edge concerns across APIs.
- A BFF adapts backend capabilities to a particular user experience.

A gateway can:

- Route requests to services.
- Terminate TLS.
- Validate tokens.
- Apply rate limits and quotas.
- Transform protocols or headers.
- Aggregate selected backend calls.
- Cache safe responses.
- Record edge telemetry.

A BFF can:

- Shape responses for one client.
- Orchestrate client-specific workflows.
- Reduce frontend round trips.
- Hide internal service topology.
- Handle browser-specific authentication sessions.
- Optimize payloads for device or interface constraints.

Both add a network hop, deployment, security surface, operational ownership, and potential failure point. They should be introduced because client or service architecture requires them, not because microservice diagrams usually contain them.

This topic matters in interviews because candidates must reason about placement of responsibility, failure behavior, identity propagation, latency, ownership, and frontend needs. A gateway should not become a central monolith, and a BFF should not duplicate core business logic owned by domain services.

## Core Concepts

### Gateway, Reverse Proxy, Load Balancer, and Ingress

These terms overlap but emphasize different responsibilities.

**Reverse proxy**

- Receives a request and forwards it to an upstream server.
- Can terminate TLS and rewrite headers or paths.

**Load balancer**

- Distributes traffic across instances.
- Primarily addresses availability and capacity.

**Ingress controller**

- Implements external routing into a container platform such as Kubernetes.
- Translates ingress configuration into proxy behavior.

**API gateway**

- Adds API-aware policy such as authentication, quotas, transformation, version routing, developer subscriptions, and analytics.

A product can perform several roles. Evaluate required capabilities rather than selecting by label.

### Gateway Versus Service Mesh

An API gateway manages primarily north-south traffic between external clients and the system.

A service mesh manages primarily east-west traffic between services and may provide:

- Mutual TLS.
- Service identity.
- Retries and timeouts.
- Traffic shaping.
- Service-to-service telemetry.

They can coexist:

```text
Client
  -> API gateway
      -> service-mesh ingress
          -> internal services
```

Do not route every internal call back through the external gateway. That creates unnecessary latency and central coupling.

### Gateway Routing

The gateway maps external routes to internal services:

```text
/api/orders/*   -> Ordering service
/api/catalog/*  -> Catalog service
/api/users/*    -> Identity profile service
```

Benefits:

- Clients do not know service locations.
- Internal topology can change.
- Version or canary routing can be centralized.
- Services can remain private.

Keep route ownership explicit. Conflicting rewrites and hidden routing rules make incidents difficult to diagnose.

### Gateway Offloading

Common shared edge policies include:

- TLS termination.
- Authentication token validation.
- Rate limiting.
- Request-size limits.
- IP restrictions.
- Compression.
- CORS policy.
- Request correlation.
- Basic caching.
- Web application firewall rules.

Offload only concerns that are truly common and safe at the edge.

Backend services must still enforce:

- Resource-level authorization.
- Business invariants.
- Tenant isolation.
- Input semantics.
- Data access rules.

The gateway is not the sole security boundary.

### Gateway Aggregation

A gateway can call several services and combine their responses:

```text
GET /dashboard
  -> Customer service
  -> Orders service
  -> Recommendations service
  -> one dashboard response
```

Benefits:

- Fewer client round trips.
- Less client knowledge of service topology.
- Centralized timeout and fallback policy.

Costs:

- Increased gateway CPU and memory.
- Fan-out latency.
- Partial failures.
- Coupling to response schemas.
- Harder scaling and ownership.

Use limited aggregation for stable, shared edge scenarios. Client-specific aggregation often belongs in a BFF.

### Tail Latency and Fan-Out

An aggregate response is constrained by slow dependencies:

```text
Total latency ~= gateway overhead + slowest required dependency
```

With many dependencies, the probability that at least one is slow or unavailable rises.

Design aggregation with:

- Parallel calls where independent.
- Per-dependency deadlines.
- Overall request deadline.
- Bounded concurrency.
- Partial-response policy.
- Fallbacks only when semantically safe.
- Cancellation propagation.
- Distributed tracing.

Do not retry every failed downstream call automatically. Retries can amplify load and duplicate unsafe operations.

### Partial Failure

Define whether each dependency is:

- Required.
- Optional.
- Replaceable by stale data.
- Omittable with a warning.

Example response:

```json
{
  "orders": [],
  "recommendations": null,
  "warnings": [
    {
      "code": "recommendations-unavailable"
    }
  ]
}
```

Returning partial data is appropriate only when consumers can understand it and business correctness is preserved.

### Single Point of Failure

A gateway is on many critical paths. Protect it with:

- Multiple instances across failure domains.
- Health probes.
- Autoscaling.
- Load testing.
- Configuration validation.
- Safe rollout and rollback.
- Minimal local state.
- Capacity headroom.
- Dependency isolation.

Avoid synchronous external control-plane dependencies in the request path.

### Gateway as a Choke Point

A gateway can become a bottleneck when it accumulates:

- Core business workflows.
- Large transformations.
- Long-running requests.
- Many custom plugins.
- Shared release coordination.
- Per-client conditional logic.

Keep the gateway focused on edge policy and simple routing or aggregation. Move domain behavior to services and client-specific behavior to BFFs.

### What Is a BFF?

A BFF is a backend owned and shaped around one frontend experience.

```text
Web app    -> Web BFF    -> services
Mobile app -> Mobile BFF -> services
Partner UI -> Partner BFF -> services
```

The BFF exposes operations and representations optimized for that client rather than forcing every client through one general-purpose aggregation API.

### BFF Responsibilities

Appropriate responsibilities:

- Client-specific aggregation.
- Response shaping.
- UI-oriented workflow orchestration.
- Server-side session handling.
- Token exchange and secure token storage.
- Client-specific caching.
- Reducing mobile payloads.
- Hiding unstable service topology.

Inappropriate responsibilities:

- Core pricing rules.
- Order invariants.
- Authoritative data ownership.
- Reusable domain policy.
- Direct access to every service database.

Business rules should remain in the service or module that owns them.

### When a BFF Is Valuable

Use a BFF when:

- Web and mobile clients need materially different APIs.
- A general backend contains many client-specific conditions.
- Clients make many calls to render one screen.
- Mobile bandwidth or latency needs special optimization.
- Frontend teams require independent backend evolution.
- Browser token security benefits from a server-side component.
- Client release cadence differs from service release cadence.

A BFF can reduce frontend coupling and network chattiness.

### When Not to Use a BFF

A BFF may be unnecessary when:

- Only one simple client exists.
- Clients use nearly identical operations.
- One gateway aggregation layer is sufficient.
- The backend is already a cohesive monolith.
- GraphQL or another composition layer already provides client-specific selection.
- The team cannot own another production service.

Duplicating one BFF per screen or minor client variation creates operational cost without useful autonomy.

### One BFF Per Experience, Not Per Device Automatically

Do not create separate BFFs merely because clients are named web, iOS, and Android.

Ask:

- Do they need different workflows?
- Do they evolve independently?
- Do they have different payload and latency constraints?
- Are they owned by different teams?
- Do they have different authentication models?

iOS and Android often share one mobile BFF. Administrative and customer web applications may need separate BFFs despite both running in browsers.

### Browser BFF and Token Handling

A browser BFF can use an OAuth/OpenID Connect flow on the server and keep access tokens out of browser JavaScript.

Typical flow:

```text
Browser
  -> secure session cookie
      -> BFF
          -> access token
              -> downstream API
```

Benefits:

- Access and refresh tokens remain server-side.
- Smaller exposure to token theft through browser script.
- Centralized token refresh and logout.

The session cookie should use:

- `Secure`.
- `HttpOnly`.
- Appropriate `SameSite`.
- Short or controlled lifetime.

Cookie authentication introduces CSRF risk for state-changing operations. Use anti-forgery defenses and strict origin policy.

### Authentication Versus Authorization

The gateway or BFF can validate the caller's identity, but downstream services must enforce authorization for owned resources.

Identity propagation options include:

- Forward the original access token.
- Exchange for a downstream audience token.
- Use workload identity plus signed user context.
- Use delegated authorization.

Do not trust arbitrary client-supplied identity headers. Strip or overwrite trusted headers at the edge.

### Token Audience and Scope

A token intended for a gateway is not automatically valid for every service.

Validate:

- Issuer.
- Audience.
- Signature.
- Expiration.
- Scopes or roles.
- Tenant.

Token exchange or on-behalf-of flows can produce service-appropriate tokens. Avoid issuing one broad token that grants every internal capability.

### BFF API Design

A BFF API can be task- or screen-oriented:

```text
GET /home
GET /checkout-summary
POST /checkout
GET /account-settings
```

This is acceptable because the BFF is a client adapter, not a reusable enterprise domain API.

Keep commands explicit and avoid exposing one generic proxy route:

```text
/proxy/{service}/{path}
```

An unrestricted proxy defeats surface reduction and can create security vulnerabilities.

### Orchestration and Transactions

A BFF can coordinate calls, but it should not pretend several service operations form one database transaction.

For multi-service workflows:

- Prefer one domain service to own the business process.
- Use asynchronous orchestration for long-running work.
- Define idempotency.
- Handle compensation explicitly.
- Return operation status where completion is deferred.

The BFF should not become the durable source of truth for a business saga unless that workflow is genuinely client-specific.

### Gateway Versus BFF

| Concern | API gateway | BFF |
| --- | --- | --- |
| Primary scope | Shared edge | One client experience |
| Routing | Core responsibility | Usually limited |
| Rate limiting | Common policy | Client-specific refinement |
| Authentication | Token validation and edge policy | Session and client flow |
| Aggregation | Shared, limited | Client-specific |
| Response shaping | Light transformation | Tailored composition |
| Business rules | Avoid | Avoid core domain rules |
| Ownership | Platform or API team | Frontend-aligned team |

A common architecture uses both:

```text
Client
  -> shared API gateway
      -> client BFF
          -> domain services
```

The extra hop must be justified. Some systems expose BFFs directly through an ingress or gateway product that combines these roles.

### Gateway Versus GraphQL

GraphQL can let clients select fields and combine a graph of data. It can reduce the need for multiple response-shaped BFF endpoints.

GraphQL does not automatically solve:

- Authentication and authorization.
- Rate limiting and abuse control.
- N+1 backend calls.
- Workflow commands.
- Token handling in browsers.
- Service ownership.
- Partial failure policy.

A GraphQL server can itself be a BFF or composition gateway. Avoid stacking layers that duplicate aggregation.

### Gateway Versus Direct Client-to-Service Calls

Direct calls may be acceptable when:

- Few services are public.
- Clients can safely discover and authenticate to each API.
- Cross-origin and certificate management are controlled.
- No common edge policy is needed.

Problems include:

- Exposed internal topology.
- Many public endpoints and certificates.
- Inconsistent security and quotas.
- Client coupling to service decomposition.
- More frontend round trips.

The gateway provides stability but adds central infrastructure.

### Rate Limiting and Quotas

Apply limits by appropriate identity:

- IP address.
- User.
- Tenant.
- API key.
- Client application.
- Operation cost.

Return clear feedback:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
```

One global limit can allow a noisy tenant to affect everyone. Use fair partitions and protect expensive aggregation endpoints separately.

### Caching

Gateway or BFF caching can reduce latency and backend load for safe responses.

Cache keys must consider:

- Path and query.
- User or tenant identity.
- Authorization scope.
- Language.
- Accepted representation.
- API version.

Never place private user data in a shared cache without correct partitioning. Prefer HTTP validators and explicit cache-control policy over ad hoc caching.

### Retries, Timeouts, and Circuit Breakers

Every outbound call needs a deadline.

Retry only when:

- The failure is transient.
- The remaining deadline permits it.
- The operation is idempotent or protected by an idempotency key.
- Retry volume is bounded.

Use jittered backoff and circuit breakers carefully. Layered retries at client, gateway, BFF, and service can multiply traffic.

Define one retry budget across the call chain.

### Request and Response Transformation

Transformations can:

- Rename an external path.
- Add trusted correlation metadata.
- Translate a legacy media type.
- Remove internal fields.

Heavy transformations create a second implementation of the contract and complicate debugging. Prefer explicit BFF code for substantial client adaptation.

### Observability

Capture:

- Request ID and trace context.
- Authenticated client and tenant.
- Route and operation.
- Status and latency.
- Downstream dependency timing.
- Retry and circuit-breaker events.
- Rate-limit decisions.
- Cache hits.
- Partial failures.

Use distributed tracing across gateway, BFF, and services. Do not log tokens, cookies, personal data, or sensitive request bodies.

### Correlation and Causation

Preserve standard trace headers and add business correlation IDs when needed. The gateway can create a trace when absent, but should not replace a valid trusted trace context without policy.

Return a safe correlation identifier in errors so support can locate the request.

### Deployment and Ownership

Define:

- Who owns gateway configuration.
- Who can add routes and policies.
- Who deploys each BFF.
- Who responds to incidents.
- How changes are reviewed.
- How configurations are tested.

Gateway configuration is production code. Store it in version control, validate it, and deploy through controlled pipelines.

BFF ownership should align with the frontend team when that team can operate backend services. Otherwise the pattern may create organizational handoffs rather than autonomy.

### Scaling

Scale gateways and BFFs independently when their workloads differ.

Gateway load depends on:

- Total requests.
- TLS and authentication cost.
- Transformations.
- Payload sizes.

BFF load depends on:

- Client traffic.
- Fan-out count.
- Aggregation CPU and memory.
- Session storage.

Keep services stateless where possible. If sessions are required, use resilient shared storage or encrypted self-contained cookies with careful size and revocation decisions.

### Resilience and Isolation

Avoid allowing one failing dependency to exhaust all gateway or BFF resources.

Use:

- Connection-pool limits.
- Per-upstream concurrency limits.
- Bulkheads.
- Short queues.
- Timeouts.
- Load shedding.
- Separate deployment pools for critical clients where justified.

Return a controlled `503` or partial response instead of allowing unbounded work to collapse the edge.

### API Discovery and Documentation

The gateway can expose one developer portal, but ownership of API contracts should remain with backend teams.

Gateway documentation should not drift from service behavior. Aggregate or publish versioned OpenAPI documents through a controlled process, and ensure external routes, security, and server URLs match what consumers actually call.

### .NET Reverse Proxy Example

YARP can implement a programmable reverse proxy in ASP.NET Core:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddReverseProxy()
    .LoadFromConfig(
        builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

app.MapReverseProxy();

app.Run();
```

Configuration:

```json
{
  "ReverseProxy": {
    "Routes": {
      "orders": {
        "ClusterId": "ordering",
        "Match": {
          "Path": "/api/orders/{**catch-all}"
        }
      }
    },
    "Clusters": {
      "ordering": {
        "Destinations": {
          "primary": {
            "Address": "https://ordering.internal/"
          }
        }
      }
    }
  }
}
```

A managed gateway product may provide stronger policy, portal, quota, analytics, and lifecycle capabilities. A code-based proxy provides flexibility but transfers more operational responsibility to the team.

### Minimal BFF Endpoint Example

```csharp
app.MapGet(
    "/home",
    async (
        IOrdersClient orders,
        IRecommendationsClient recommendations,
        ClaimsPrincipal user,
        CancellationToken cancellationToken) =>
    {
        var customerId = user.GetRequiredCustomerId();

        var ordersTask = orders.GetRecentAsync(
            customerId,
            cancellationToken);

        var recommendationsTask = recommendations.GetAsync(
            customerId,
            cancellationToken);

        await Task.WhenAll(ordersTask, recommendationsTask);

        return TypedResults.Ok(new HomeResponse(
            await ordersTask,
            await recommendationsTask));
    });
```

Production code needs explicit timeouts, failure policy, tracing, and authorization.

### Decision Framework

Ask:

1. Which shared edge concerns need one enforcement point?
2. Do clients need materially different backend behavior?
3. How many extra network hops are acceptable?
4. Who owns and operates the new component?
5. Which logic belongs to domain services rather than the edge?
6. How are identity and authorization propagated?
7. What happens when one downstream service is slow or unavailable?
8. Can existing gateway aggregation, GraphQL, or a modular backend solve the need?
9. How will contracts, telemetry, and incidents be managed?

Choose the fewest layers that satisfy those requirements.

### Common Mistakes

- Adding a gateway because every microservice diagram has one.
- Putting core business logic in gateway policies.
- Treating gateway authentication as complete authorization.
- Forwarding untrusted identity headers.
- Routing internal service calls through the external gateway.
- Aggregating too many dependencies into one request.
- Retrying unsafe operations without idempotency.
- Stacking retries at every layer.
- Returning partial data without a documented contract.
- Building one general BFF full of conditions for every client.
- Creating a BFF when all clients have identical needs.
- Exposing an unrestricted proxy endpoint.
- Storing browser access tokens in JavaScript despite a server-side BFF design.
- Using cookies without CSRF protection.
- Treating gateway configuration as manual operations work.
- Publishing internal topology and endpoints.
- Ignoring the additional latency and ownership cost.

### Best Practices

- Keep gateway responsibilities focused on shared edge policy.
- Keep BFF responsibilities focused on one client experience.
- Leave domain rules and authoritative data in owning services.
- Validate identity at the edge and authorization in services.
- Use audience-appropriate tokens and trusted identity propagation.
- Define deadlines, retry budgets, and partial-failure policy.
- Protect unsafe retries with idempotency.
- Make gateway and BFF highly available and horizontally scalable.
- Use distributed tracing and dependency-level metrics.
- Version-control and test routing and policy configuration.
- Align BFF ownership with frontend ownership where practical.
- Avoid duplicate aggregation layers.
- Reassess whether the extra hop still provides value.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is an API gateway?

<!-- question:start:api-gateway-and-bff-decisions-for-web-clients-and-microservices-beginner-q01 -->
<!-- question-id:api-gateway-and-bff-decisions-for-web-clients-and-microservices-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

An API gateway is an edge entry point that routes client requests to backend APIs and applies shared policies such as TLS termination, authentication validation, rate limiting, quotas, caching, transformation, and telemetry. It hides internal topology but adds a critical network component that must be highly available and carefully scoped.

##### Key Points to Mention

- It handles north-south traffic.
- Routing and shared edge policy are core responsibilities.
- Services still enforce resource-level authorization and business rules.
- It can become a bottleneck or failure point.

<!-- question:end:api-gateway-and-bff-decisions-for-web-clients-and-microservices-beginner-q01 -->

#### What is a Backend for Frontend?

<!-- question:start:api-gateway-and-bff-decisions-for-web-clients-and-microservices-beginner-q02 -->
<!-- question-id:api-gateway-and-bff-decisions-for-web-clients-and-microservices-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A BFF is a backend tailored to one frontend experience. It aggregates and shapes backend data, coordinates client-specific operations, and can handle authentication sessions for that client. Separate BFFs are useful when clients have materially different workflows or constraints, not simply because they run on different devices.

##### Key Points to Mention

- It is owned around a user experience.
- It reduces frontend coupling and round trips.
- Core domain logic remains in backend services.
- Every BFF adds deployment and maintenance cost.

<!-- question:end:api-gateway-and-bff-decisions-for-web-clients-and-microservices-beginner-q02 -->

#### What is the main difference between an API gateway and a BFF?

<!-- question:start:api-gateway-and-bff-decisions-for-web-clients-and-microservices-beginner-q03 -->
<!-- question-id:api-gateway-and-bff-decisions-for-web-clients-and-microservices-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A gateway provides shared edge capabilities for many APIs and clients. A BFF provides client-specific composition and adaptation for one experience. A system can use both: the gateway applies common security and traffic policy, while the BFF returns web- or mobile-specific responses.

##### Key Points to Mention

- Gateway scope is platform-wide; BFF scope is client-specific.
- Gateway transformations should remain light.
- BFFs can own UI-oriented orchestration.
- Avoid duplicate responsibilities across layers.

<!-- question:end:api-gateway-and-bff-decisions-for-web-clients-and-microservices-beginner-q03 -->

#### When might neither a gateway nor a BFF be necessary?

<!-- question:start:api-gateway-and-bff-decisions-for-web-clients-and-microservices-beginner-q04 -->
<!-- question-id:api-gateway-and-bff-decisions-for-web-clients-and-microservices-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A small application with one cohesive backend and one simple client may expose its API directly through an ordinary ingress or reverse proxy. A BFF adds little when clients make the same requests, and a full API gateway adds little when advanced shared policy and many independently deployed APIs do not exist.

##### Key Points to Mention

- Architecture should follow actual client and service needs.
- Every additional layer adds latency and operations.
- A monolith can expose one well-designed API.
- Introduce the pattern when evidence justifies it.

<!-- question:end:api-gateway-and-bff-decisions-for-web-clients-and-microservices-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Which responsibilities should remain out of an API gateway?

<!-- question:start:api-gateway-and-bff-decisions-for-web-clients-and-microservices-intermediate-q01 -->
<!-- question-id:api-gateway-and-bff-decisions-for-web-clients-and-microservices-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Core business rules, aggregate invariants, authoritative workflow state, database ownership, and resource-level authorization should remain in domain services. The gateway can validate credentials and enforce shared policy, but moving business behavior into policies creates a central monolith, coordinated releases, and poor testability.

##### Key Points to Mention

- Edge authentication does not replace service authorization.
- Heavy transformations usually belong in a BFF or service.
- Keep the gateway stateless and focused.
- Route and policy configuration should remain testable.

<!-- question:end:api-gateway-and-bff-decisions-for-web-clients-and-microservices-intermediate-q01 -->

#### How should a BFF handle authentication for a browser application?

<!-- question:start:api-gateway-and-bff-decisions-for-web-clients-and-microservices-intermediate-q02 -->
<!-- question-id:api-gateway-and-bff-decisions-for-web-clients-and-microservices-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

The BFF can perform the OAuth or OpenID Connect flow server-side, store access and refresh tokens outside browser JavaScript, and issue a secure `HttpOnly` session cookie. It attaches an appropriate downstream token when calling APIs. Because browsers automatically send cookies, state-changing endpoints require CSRF protection, strict origin handling, and suitable `SameSite` policy.

##### Key Points to Mention

- Use `Secure` and `HttpOnly` cookies.
- Keep tokens server-side.
- Validate token audience and scope for downstream APIs.
- Cookie security and CSRF must be designed together.

<!-- question:end:api-gateway-and-bff-decisions-for-web-clients-and-microservices-intermediate-q02 -->

#### How should gateway aggregation handle partial failures?

<!-- question:start:api-gateway-and-bff-decisions-for-web-clients-and-microservices-intermediate-q03 -->
<!-- question-id:api-gateway-and-bff-decisions-for-web-clients-and-microservices-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Classify downstream data as required, optional, cacheable, or safely omittable. Call independent dependencies in parallel with per-call and overall deadlines. Return an error when required data fails; return a documented partial response and warnings only when that remains correct for the client. Record dependency timing and cancellation in distributed traces.

##### Key Points to Mention

- Fan-out increases tail-latency and failure probability.
- Fallbacks must preserve business meaning.
- Do not hide required failures with empty data.
- Bound concurrency and propagate cancellation.

<!-- question:end:api-gateway-and-bff-decisions-for-web-clients-and-microservices-intermediate-q03 -->

#### How do you prevent retries at a gateway from causing duplicate side effects?

<!-- question:start:api-gateway-and-bff-decisions-for-web-clients-and-microservices-intermediate-q04 -->
<!-- question-id:api-gateway-and-bff-decisions-for-web-clients-and-microservices-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Retry only idempotent operations or operations protected by a durable idempotency key. Respect an overall deadline and retry budget, use limited backoff with jitter, and avoid duplicating retries at the client, gateway, BFF, and service. Unsafe commands should be retried only when the downstream contract guarantees replay safety.

##### Key Points to Mention

- `POST` is not inherently replay-safe.
- Layered retries can amplify traffic.
- Timeouts do not prove the server did no work.
- Services remain the authority for idempotent effects.

<!-- question:end:api-gateway-and-bff-decisions-for-web-clients-and-microservices-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you decide whether web and mobile clients need separate BFFs?

<!-- question:start:api-gateway-and-bff-decisions-for-web-clients-and-microservices-advanced-q01 -->
<!-- question-id:api-gateway-and-bff-decisions-for-web-clients-and-microservices-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Compare workflows, payload needs, latency and offline constraints, authentication models, release cadence, team ownership, and failure policy. Separate BFFs are justified when those needs cause substantial conditional logic or coordination in one backend. If clients call nearly identical operations, one BFF or gateway aggregation avoids duplicated code and operations.

##### Key Points to Mention

- Device type alone is not enough.
- Independence must outweigh duplicated implementation.
- Align ownership with client teams where possible.
- Review whether GraphQL or shared composition already solves the need.

<!-- question:end:api-gateway-and-bff-decisions-for-web-clients-and-microservices-advanced-q01 -->

#### How would you prevent an API gateway from becoming a distributed monolith?

<!-- question:start:api-gateway-and-bff-decisions-for-web-clients-and-microservices-advanced-q02 -->
<!-- question-id:api-gateway-and-bff-decisions-for-web-clients-and-microservices-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Keep routes and shared policies declarative and small, leave business workflows in owning services, and use BFFs for substantial client-specific composition. Give backend teams independent contract ownership, automate policy tests, and avoid requiring gateway releases for every internal service change. Track configuration complexity, deployment coupling, and aggregation fan-out as architecture signals.

##### Key Points to Mention

- Centralized edge policy must not become centralized domain logic.
- Version external routes independently from internal topology.
- Establish clear platform and service ownership.
- Remove unused transformations and routes continuously.

<!-- question:end:api-gateway-and-bff-decisions-for-web-clients-and-microservices-advanced-q02 -->

#### How should identity be propagated from a gateway or BFF to microservices?

<!-- question:start:api-gateway-and-bff-decisions-for-web-clients-and-microservices-advanced-q03 -->
<!-- question-id:api-gateway-and-bff-decisions-for-web-clients-and-microservices-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Use validated tokens with correct issuer, audience, scopes, and tenant, or exchange the external token for a downstream audience token. Another option combines workload identity with signed user context. Strip untrusted identity headers at the edge. Every service validates trusted identity and enforces its own resource authorization rather than trusting the route alone.

##### Key Points to Mention

- One broad token for all services violates least privilege.
- Authentication and authorization remain separate.
- Header trust requires a protected network and cryptographic assurance.
- Preserve correlation without logging credentials.

<!-- question:end:api-gateway-and-bff-decisions-for-web-clients-and-microservices-advanced-q03 -->

#### How would you design resilience for a gateway that is on every critical request path?

<!-- question:start:api-gateway-and-bff-decisions-for-web-clients-and-microservices-advanced-q04 -->
<!-- question-id:api-gateway-and-bff-decisions-for-web-clients-and-microservices-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Deploy stateless instances across failure domains with autoscaling, health checks, capacity headroom, controlled rollouts, and fast rollback. Apply per-upstream timeouts, concurrency limits, bulkheads, load shedding, and bounded retry budgets. Validate configuration before deployment and instrument route, dependency, cache, rate-limit, and authentication behavior with distributed tracing.

##### Key Points to Mention

- Avoid synchronous control-plane dependencies in the data path.
- Isolate one failing backend from gateway resource exhaustion.
- Test overload and downstream failure, not only happy-path capacity.
- Define fallback and partial-response behavior before incidents.

<!-- question:end:api-gateway-and-bff-decisions-for-web-clients-and-microservices-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
