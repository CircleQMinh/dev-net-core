---
id: rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge
topic: Networking, API edge, and secure connectivity
subtopic: Rate limiting, quotas, auth offload, and request transformation at the edge
category: Azure
---

## Overview

An API gateway can enforce cross-cutting controls before requests reach backend services. Azure API Management provides policies for short-term rate limiting, long-term usage quotas, token validation, backend authentication, request and response transformation, routing, caching, and controlled error handling.

These capabilities are useful because they:

- Protect backend capacity from bursts.
- Enforce product or consumer usage plans.
- Reject invalid tokens before expensive backend work.
- Centralize common protocol and header rules.
- Let APIM call private backends using managed identity.
- Present a stable public contract while adapting legacy backends.

Edge enforcement has limits. Distributed counters are approximate. Gateway authentication does not replace object-level authorization. Transformations add CPU, latency, and hidden coupling. Backend services still need protection against bypass paths and must enforce business rules.

For interviews, candidates should explain:

- The difference between rate limits and quotas.
- How to choose a safe counter key.
- Why APIM counters are not globally exact across gateways and regions.
- How `429 Too Many Requests`, `Retry-After`, and client backoff work.
- How JWT validation, subscription keys, client certificates, and managed identity solve different problems.
- How to pass trusted identity context without trusting spoofed client headers.
- When URI, header, query, and body transformations are appropriate.
- Why policy order, body buffering, caching, retries, and error handling affect correctness.
- How to test traffic controls under scale and failure.

## Core Concepts

### Edge Controls and Their Boundaries

APIM can apply controls at:

- Global scope.
- Workspace scope.
- Product scope.
- API scope.
- Operation scope.

Typical sequence:

```text
Client
  -> network and TLS controls
  -> coarse abuse limit
  -> credential or token validation
  -> caller-specific rate limit or quota
  -> request normalization and transformation
  -> backend authentication
  -> backend service
  -> response transformation and filtering
```

The exact order depends on risk:

- A coarse IP-based limit may run before expensive token validation.
- A user-specific limit must run after trustworthy identity has been established.
- Backend authentication runs before forwarding.
- Response filtering runs after the backend response.

Policies execute sequentially. An apparently small ordering change can alter which requests are counted, authenticated, transformed, or cached.

### Rate Limiting

Rate limiting controls how quickly a caller can send requests over a short period. It protects against bursts and helps maintain backend stability.

APIM provides:

- `rate-limit`: Limits calls per APIM subscription.
- `rate-limit-by-key`: Limits calls by an arbitrary expression-derived key.

Example:

```xml
<rate-limit-by-key
    calls="60"
    renewal-period="60"
    counter-key="@(
        ((Jwt)context.Variables["validated-token"])
            .Claims.GetValueOrDefault("oid", "unknown"))"
    retry-after-header-name="Retry-After"
    remaining-calls-header-name="X-RateLimit-Remaining" />
```

When a rate limit is exceeded, APIM returns `429 Too Many Requests`.

Rate limiting is suitable for:

- Per-user requests per minute.
- Per-client requests per second.
- Coarse IP burst control.
- Protecting an expensive operation.
- Different product tiers.

It is not a reliable billing ledger or exact global concurrency control.

### Quotas

Quotas restrict total usage over a longer renewable period or lifetime.

APIM provides:

- `quota`: Call or bandwidth quota per subscription.
- `quota-by-key`: Call or bandwidth quota by an arbitrary key in supported gateways.

Example use cases:

- 100,000 calls per month per customer.
- 10 GB per day per subscription.
- A lifetime evaluation allowance.

When an APIM quota is exceeded, the quota policies return `403 Forbidden` and a `Retry-After` header.

Quotas are appropriate for product entitlement and broad consumption governance. They are not a financial source of truth. Billing and contractual usage normally require durable, independently reconciled metering.

### Rate Limit Versus Quota

| Concern | Rate limit | Quota |
| --- | --- | --- |
| Primary purpose | Smooth bursts | Limit total usage |
| Typical period | Seconds or minutes | Hours, days, months, lifetime |
| Exceeded response | `429` | `403` |
| Common use | Backend protection | Product entitlement |
| Accuracy expectation | Approximate distributed throttle | Usage control, still not a billing ledger |

Many systems use both:

```text
Rate limit: 20 requests per second
Quota: 1,000,000 requests per month
```

The rate limit protects operational capacity. The quota enforces the customer's plan.

### Distributed Counter Accuracy

APIM throttling is distributed, so counters are not perfectly exact. Actual accepted calls can differ from the configured threshold because of:

- Concurrent requests.
- Gateway distribution.
- Backend latency.
- Counter synchronization.
- Platform restarts.
- Conditional increment timing.

Counters are tracked independently per gateway deployment, including regional, workspace, and self-hosted gateways. Self-hosted gateway instances can synchronize locally when configured, but their counts do not synchronize with managed gateways.

Consequences:

- Do not use APIM rate limits as an exact financial meter.
- Design backend capacity with tolerance above the nominal limit.
- Test multi-region behavior.
- Use a durable centralized system when globally exact entitlement is mandatory.

### Choosing the Counter Key

The counter key determines the isolation boundary.

Possible keys:

- APIM subscription.
- Validated user object ID.
- Validated client application ID.
- Customer or tenant ID.
- API operation plus customer ID.
- Source IP address.

Good key:

```text
tenant-id + client-id + API operation
```

Poor key:

```text
unvalidated X-Customer-Id header
```

Rules:

- Derive identity keys from a validated token or trusted subscription context.
- Include operation or product information when limits should be independent.
- Avoid personally identifying data when a stable opaque ID is sufficient.
- Understand that many users can share a NAT IP.
- Understand that attackers can rotate source IPs.
- Prevent accidental sharing of one key across policy scopes.

If the same `counter-key` value is used at multiple scopes, APIM can share a counter for that value. Add a scope discriminator when independent counters are intended.

### Client Behavior After Throttling

A well-behaved client should:

- Treat `429` as temporary.
- Honor `Retry-After`.
- Use exponential backoff with jitter.
- Stop unbounded immediate retries.
- Preserve idempotency.
- Surface quota exhaustion differently from transient throttling.

The gateway should return:

- A stable error shape.
- `Retry-After` when meaningful.
- Optional limit and remaining values.
- A correlation ID.

Do not reveal sensitive customer or internal capacity details through headers.

### Concurrency Limits Versus Request Rate

Requests per second and concurrent in-flight requests are different.

A backend can be overwhelmed by:

- A small number of long-running requests.
- Large uploads.
- Expensive queries.
- Streaming connections.
- Fan-out behavior behind one request.

Rate limiting alone may not protect these cases. Combine it with:

- Backend timeouts.
- Queue-based load leveling.
- Request size limits.
- Service concurrency controls.
- Circuit breakers.
- Asynchronous job APIs.
- Operation-specific limits.

### Subscription Keys

APIM subscription keys identify a subscription and enable product access, analytics, quotas, and per-subscription rate limits.

They are shared secrets and have limitations:

- They do not identify the human user.
- They can be copied.
- They do not carry scopes or roles.
- They may be embedded in insecure clients.

Use them for API program management, not as the only security control for sensitive APIs.

A common design requires both:

```text
APIM subscription key:
  identifies consumer account and product plan

OAuth access token:
  authenticates user or client and carries authorization claims
```

### Frontend Token Validation

For Microsoft Entra tokens, APIM can use the Entra-specific validation policy. For general OpenID Connect and JWT issuers, APIM can validate JWTs using issuer metadata and required claims.

A validation policy should verify:

- Token presence and bearer scheme.
- Signature.
- Expiration.
- Issuer.
- Audience.
- Required scopes or roles.
- Tenant restrictions when applicable.

Conceptual example:

```xml
<validate-jwt
    header-name="Authorization"
    require-scheme="Bearer"
    output-token-variable-name="validated-token"
    failed-validation-httpcode="401">
  <openid-config
      url="https://login.example.invalid/.well-known/openid-configuration" />
  <audiences>
    <audience>api://orders-api</audience>
  </audiences>
  <required-claims>
    <claim name="scp" match="any" separator=" ">
      <value>Orders.Read</value>
    </claim>
  </required-claims>
</validate-jwt>
```

Token validation at APIM:

- Rejects invalid traffic early.
- Centralizes common issuer and audience checks.
- Enables limits keyed by validated claims.
- Reduces duplicate edge configuration.

It does not replace:

- Object-level authorization.
- Business authorization.
- Tenant-data isolation.
- Backend validation when clients can bypass APIM.

### Authentication Versus Authorization

Authentication establishes who or what presented a valid credential. Authorization decides whether that identity can perform the requested operation on the requested resource.

At the edge, APIM can enforce coarse authorization:

- Required delegated scope.
- Required application role.
- Allowed tenant.
- Allowed client application.
- Product subscription.

The backend must enforce:

- Whether the user owns the order.
- Whether the caller can access a specific tenant.
- Whether the transition is valid.
- Whether sensitive fields can be changed.

A valid token with `Orders.Write` does not prove that the caller can update every order.

### Authentication Offload

Authentication offload means APIM performs credential validation or acquisition so backend services receive only requests that passed gateway checks.

Possible frontend mechanisms:

- OAuth or OpenID Connect access tokens.
- Client certificates.
- APIM subscription keys.
- IP filtering as an additional network signal.

Possible backend mechanisms:

- APIM managed identity.
- Client certificate from APIM.
- Static legacy credential from a secure named value.
- Forwarded original access token.
- On-behalf-of delegation in a separate application component where user delegation is required.

Offload reduces repeated gateway concerns, but the backend must understand the trust model and whether the APIM route can be bypassed.

### APIM Managed Identity to Backend

APIM can obtain a Microsoft Entra access token through its system-assigned or selected user-assigned managed identity:

```xml
<authentication-managed-identity
    resource="api://orders-backend-client-id" />
```

APIM caches the token until expiration and places it in the backend `Authorization` header.

This creates two identities:

- The original API consumer.
- The APIM gateway workload.

Choose whether the backend authorizes APIM as a trusted service, receives original user context, or requires delegated user access.

Security rules:

- Give APIM managed identity the minimum backend role.
- Apply the policy at the narrowest useful scope.
- Restrict who can edit policies.
- Route only to trusted backend entities.
- Do not expose the acquired token through logging or dynamic forwarding.

### Trusted Identity Headers

Some backends accept identity context from headers added by a trusted gateway:

```xml
<set-header name="x-user-object-id" exists-action="delete" />
<set-header name="x-user-object-id" exists-action="override">
  <value>@(
    ((Jwt)context.Variables["validated-token"])
      .Claims.GetValueOrDefault("oid", ""))</value>
</set-header>
```

The gateway must:

1. Remove any client-supplied version.
2. Validate the token.
3. Derive the value from validated claims.
4. Add the trusted header.
5. Ensure only APIM can reach the backend.

The backend must not trust this header from arbitrary network callers. Cryptographic token validation in the backend is often simpler and safer when bypass prevention cannot be guaranteed.

### Request URL Transformation

`rewrite-uri` can map a public route to a backend route:

```xml
<rewrite-uri
    template="/internal/v2/orders/{orderId}"
    copy-unmatched-params="false" />
```

Use URL rewriting to:

- Present clean public routes.
- Hide legacy backend paths.
- Add expected query parameters.
- Maintain a stable facade during backend migration.

Be explicit about unmatched query parameters. Copying arbitrary parameters can leak unsupported input to a backend or change cache behavior.

### Header Transformation

APIM can add, replace, append, or remove request and response headers:

```xml
<set-header name="x-correlation-id" exists-action="skip">
  <value>@(context.RequestId.ToString())</value>
</set-header>

<set-header name="x-internal-debug" exists-action="delete" />
```

Common uses:

- Correlation IDs.
- Backend version headers.
- Removing internal response headers.
- Setting content negotiation.
- Passing verified gateway context.

Do not:

- Forward client-supplied internal trust headers.
- expose backend infrastructure details.
- log authorization values.
- assume every hop preserves multi-value headers identically.

### Query and Method Transformation

Policies can:

- Add, replace, or remove query parameters.
- Rewrite URLs.
- Change request methods in constrained compatibility scenarios.
- Select backend based on parameters or claims.

These transformations should preserve documented API semantics. Changing `GET` to a state-changing backend call can violate caching, retry, and observability assumptions.

Prefer a clear public contract over a large collection of implicit compatibility rules.

### Body Transformation

`set-body`, Liquid templates, and format conversion policies can transform requests and responses:

- JSON to JSON.
- XML to JSON.
- JSON to SOAP.
- Legacy response filtering.
- Field renaming or envelope changes.

Reading a body consumes it unless content preservation is requested when required. Large-body transformation:

- Buffers content.
- Adds CPU and memory pressure.
- Increases latency.
- Can fail on malformed input.
- Complicates streaming.

Keep transformations small and deterministic. A complex domain mapping belongs in code with unit tests and a normal release lifecycle.

### Request and Response Validation

APIM can validate content and parameters against API schemas and requirements in supported policies.

Edge validation can:

- Reject malformed requests early.
- Enforce body size.
- Require headers or parameters.
- Reduce load on backends.
- Normalize consumer errors.

The backend should still validate domain rules. Schema validity does not prove:

- The resource exists.
- The state transition is allowed.
- The amount is within the user's limit.
- The caller owns the object.

### Caching and Authorization

Caching can improve latency and reduce backend traffic, but identity-sensitive responses require careful cache keys.

For authenticated content:

- Do not use a shared cache unless the response is genuinely identical for all authorized users.
- Vary by authorization-related identity or product when appropriate.
- Avoid caching secrets or personal data.
- Respect backend cache directives where suitable.
- Define invalidation and TTL.

The APIM internal cache is volatile and regional. Cache failure can increase backend load, so rate limiting should remain after cache lookup.

### Retry Placement

APIM retries can be useful for transient backend failures:

```xml
<retry
    condition="@(context.Response != null &&
                 context.Response.StatusCode >= 500)"
    count="2"
    interval="1"
    max-interval="4"
    delta="1"
    first-fast-retry="false">
  <forward-request buffer-request-body="true" />
</retry>
```

Before retrying, ask:

- Is the operation idempotent?
- Can the body be replayed?
- Does the client also retry?
- Does the backend SDK retry?
- What is the total time budget?
- Could retries amplify an outage?

For non-idempotent operations, use an idempotency key or avoid edge retry.

### Error Transformation

The gateway can return consistent edge errors:

```json
{
  "type": "rate-limit-exceeded",
  "title": "Too many requests",
  "status": 429,
  "correlationId": "..."
}
```

Distinguish:

- `401`: Missing or invalid authentication.
- `403`: Authenticated but forbidden, or quota exhausted according to APIM quota policy behavior.
- `404`: Resource or route not found.
- `429`: Rate limit exceeded.
- `502` or `503`: Backend or gateway dependency failure.
- `504`: Backend timeout.

Do not transform every backend error into `200`. Preserve HTTP semantics so clients, monitoring, and retry logic behave correctly.

### Policy Ordering Example

```xml
<policies>
  <inbound>
    <base />

    <rate-limit-by-key
        calls="120"
        renewal-period="60"
        counter-key="@("ip:" + context.Request.IpAddress)" />

    <validate-jwt
        header-name="Authorization"
        require-scheme="Bearer"
        output-token-variable-name="validated-token">
      <openid-config
          url="https://login.example.invalid/.well-known/openid-configuration" />
      <audiences>
        <audience>api://orders-api</audience>
      </audiences>
    </validate-jwt>

    <rate-limit-by-key
        calls="30"
        renewal-period="60"
        counter-key="@(
          "user:" +
          ((Jwt)context.Variables["validated-token"])
            .Claims.GetValueOrDefault("oid", "unknown"))" />

    <set-header name="x-correlation-id" exists-action="skip">
      <value>@(context.RequestId.ToString())</value>
    </set-header>

    <rewrite-uri
        template="/internal/orders/{orderId}"
        copy-unmatched-params="false" />

    <authentication-managed-identity
        resource="api://orders-backend-client-id" />
  </inbound>

  <backend>
    <forward-request timeout="30" />
  </backend>

  <outbound>
    <set-header name="Server" exists-action="delete" />
    <base />
  </outbound>

  <on-error>
    <base />
  </on-error>
</policies>
```

This illustrates separate pre-authentication and post-authentication rate limits. In production, verify gateway support, inherited policy order, header limitations, and whether removing a response header is permitted.

### Testing

Test policies at several levels:

- XML and policy linting.
- Unit-like policy toolkit tests where applicable.
- Integration tests through APIM.
- Invalid and expired tokens.
- Wrong issuer, audience, scope, and role.
- Spoofed identity headers.
- Boundary rates and quotas.
- Multi-instance and multi-region traffic.
- Backend timeouts and failures.
- Large and malformed bodies.
- Cache misses and cache failure.
- Rotation of keys, certificates, and named values.

Load tests should reproduce:

- Representative policy chain.
- Payload sizes.
- Backend latency.
- Connection concurrency.
- Regional topology.
- Expected invalid traffic.

### Observability

Track:

- Accepted and rejected requests.
- Rejections by policy type.
- `401`, `403`, and `429` counts.
- Caller or product dimensions using safe identifiers.
- Gateway and backend latency.
- Transformation failures.
- Token metadata retrieval failures.
- Managed identity token failures.
- Cache hit ratio.
- Retry count and outcome.
- Request and response sizes.

Avoid high-cardinality dimensions that make monitoring expensive or unusable. Never log raw access tokens, subscription keys, secret headers, or sensitive payloads.

### Common Mistakes

- Using one global rate key for every caller.
- Trusting an unvalidated header as the counter key.
- Expecting exact global limits across regions.
- Treating quota counters as a billing ledger.
- Returning no `Retry-After` guidance.
- Retrying immediately after `429`.
- Validating a JWT signature but not audience or issuer.
- Offloading authentication and removing all backend authorization.
- Forwarding spoofable identity headers.
- Giving policy editors broad APIM managed identity access.
- Performing large body transformations on every request.
- Copying all unmatched query parameters to a legacy backend.
- Caching authenticated responses without varying by identity.
- Retrying non-idempotent operations without an idempotency design.

### Interview Decision Framework

For each edge control, define:

1. Which threat or operational problem it solves.
2. Which trustworthy identity or key it uses.
3. Which scope applies.
4. Where it sits in policy order.
5. Whether state is gateway-local or global.
6. What response clients receive.
7. How backends remain protected.
8. How the behavior is tested under concurrency.
9. What telemetry proves it is working.
10. What happens when APIM, cache, identity provider, or backend is degraded.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the difference between rate limiting and quotas in APIM?

<!-- question:start:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-beginner-q01 -->
<!-- question-id:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Rate limiting controls short-term request velocity to smooth bursts and protect backend capacity. Quotas control total calls or bandwidth over a longer renewable period or lifetime. APIM rate-limit policies return `429 Too Many Requests` when exceeded, while APIM quota policies return `403 Forbidden` with retry guidance.

##### Key Points to Mention

- Rate limits are operational protection.
- Quotas often represent product entitlement.
- Many APIs use both.
- Neither should be treated as an exact billing ledger.

<!-- question:end:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-beginner-q01 -->

#### What is authentication offload at an API gateway?

<!-- question:start:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-beginner-q02 -->
<!-- question-id:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Authentication offload means the gateway validates client credentials or obtains credentials for the backend before forwarding a request. APIM can validate access tokens, check subscription keys or client certificates, and use its managed identity to authenticate to a backend. Offload centralizes edge checks but does not remove backend object-level or business authorization.

##### Key Points to Mention

- Frontend and backend identities may differ.
- The backend must trust only the APIM path or validate independently.
- Invalid traffic can be rejected early.
- Authentication is not the same as authorization.

<!-- question:end:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-beginner-q02 -->

#### What kinds of request transformation can APIM perform?

<!-- question:start:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-beginner-q03 -->
<!-- question-id:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

APIM can rewrite URLs, add or remove headers and query parameters, change backend routing, convert formats, and reshape request or response bodies. These transformations are useful for stable public contracts and legacy integration. They should remain small and deterministic because complex transformations increase latency, memory use, and hidden coupling.

##### Key Points to Mention

- Inbound transforms affect backend requests.
- Outbound transforms affect client responses.
- Body reads can consume or buffer content.
- API documentation must reflect the public contract.

<!-- question:end:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-beginner-q03 -->

#### How should a client respond to an HTTP 429 response?

<!-- question:start:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-beginner-q04 -->
<!-- question-id:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

The client should honor `Retry-After`, wait, and retry with bounded exponential backoff and jitter. It should avoid immediate retry loops, preserve idempotency, and surface sustained throttling to operators. If the request is not safe to retry, it should return a controlled failure instead.

##### Key Points to Mention

- `429` is normally temporary throttling.
- Retries can amplify overload.
- Use a maximum attempt and time budget.
- Quota exhaustion may require a different user message or plan change.

<!-- question:end:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How should you choose a rate-limit counter key?

<!-- question:start:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-intermediate-q01 -->
<!-- question-id:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Choose a stable key matching the intended isolation boundary, such as validated user ID, client application ID, tenant, subscription, or a combination with the operation. Derive identity keys only from validated tokens or trusted APIM context. Avoid spoofable headers, and use IP addresses only for coarse controls because NAT can group many users and attackers can rotate IPs.

##### Key Points to Mention

- Add scope identifiers when counters should be independent.
- Consider privacy and cardinality.
- Validate authentication before using identity claims.
- One shared key can create noisy-neighbor throttling.

<!-- question:end:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-intermediate-q01 -->

#### Why are APIM rate limits not perfectly accurate across a distributed deployment?

<!-- question:start:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-intermediate-q02 -->
<!-- question-id:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Requests execute concurrently across gateway instances and regions, and counter updates are distributed. Backend latency, synchronization, platform restarts, and conditional increment timing can allow slight overrun. Counters are tracked independently by regional, workspace, and separate self-hosted gateway deployments rather than as one exact global counter.

##### Key Points to Mention

- Design capacity with tolerance above the limit.
- Load test the real topology.
- Use durable centralized metering for exact contractual usage.
- Self-hosted local synchronization does not include managed gateways.

<!-- question:end:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-intermediate-q02 -->

#### How should APIM pass user identity context to a backend?

<!-- question:start:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-intermediate-q03 -->
<!-- question-id:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

The safest general approach is to forward a valid access token and let the backend validate it. If trusted identity headers are used, APIM must delete any client-supplied values, validate the token, derive headers from validated claims, and ensure the backend is reachable only through trusted gateway paths. The backend still enforces resource authorization.

##### Key Points to Mention

- Never trust identity headers directly from clients.
- APIM managed identity represents the gateway, not the user.
- Delegated user access needs an explicit design.
- Defense in depth may validate at both layers.

<!-- question:end:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-intermediate-q03 -->

#### What risks come with request and response body transformation?

<!-- question:start:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-intermediate-q04 -->
<!-- question-id:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Body transformations can consume or buffer the message, increase CPU and memory use, break streaming, add latency, and fail on malformed payloads. They can also hide contract differences and leak fields if response filtering is incomplete. Keep transformations small, set content types correctly, preserve content when needed, and load test representative payloads.

##### Key Points to Mention

- Body access can consume the original message.
- Large payloads magnify gateway cost.
- Complex mappings belong in tested application code.
- Public schemas and errors must match transformed behavior.

<!-- question:end:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you protect a high-cost API operation from both abuse and legitimate traffic spikes?

<!-- question:start:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-advanced-q01 -->
<!-- question-id:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use a coarse pre-authentication limit for obvious abuse, validate the caller, then apply a stricter operation-specific limit by validated tenant or client. Add a longer quota if product entitlement requires it. Enforce request size and timeout limits, make expensive work asynchronous where possible, use backend concurrency and queue controls, and return `Retry-After` with observable rejection metrics.

##### Key Points to Mention

- Rate is different from concurrent in-flight work.
- Do not rely on APIM counters as exact global state.
- Protect cache-miss and degraded-backend scenarios.
- Client retry behavior is part of the design.

<!-- question:end:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-advanced-q01 -->

#### How would you design frontend and backend authentication through APIM?

<!-- question:start:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-advanced-q02 -->
<!-- question-id:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Validate the consumer's access token at APIM for signature, issuer, audience, lifetime, and required scope or role. Decide whether the backend needs the original user token or only trusts APIM as a workload. For service authentication, give APIM a narrowly authorized managed identity and acquire a backend token at a narrow policy scope. Restrict backend network access and repeat critical authorization in the backend.

##### Key Points to Mention

- Consumer identity and gateway identity are distinct.
- Object-level authorization remains in the backend.
- Policy editors can potentially misuse APIM's identity.
- Never forward tokens to dynamically untrusted destinations.

<!-- question:end:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-advanced-q02 -->

#### How do caching, throttling, and retries interact during a backend outage?

<!-- question:start:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-advanced-q03 -->
<!-- question-id:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

A cache can absorb some read traffic, but cache misses or cache failure can suddenly expose the backend to full demand. A rate limit after cache lookup protects that path. Retries can multiply load and should be bounded, delayed, and limited to idempotent transient failures. Circuit breaking, stale-cache strategies, and backend queueing may be safer than repeated synchronous calls.

##### Key Points to Mention

- The built-in cache is volatile and regional.
- Avoid caching authorization-sensitive data incorrectly.
- Coordinate retries across client, gateway, and backend.
- Monitor cache hit ratio, retry count, and backend saturation.

<!-- question:end:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-advanced-q03 -->

#### How would you test that an edge policy design is correct under scale?

<!-- question:start:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-advanced-q04 -->
<!-- question-id:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Use automated policy validation and integration tests for token, header, route, transform, and error behavior. Load test with realistic concurrency, payloads, backend latency, multiple identities, and the production gateway topology. Test threshold races, regional counters, invalid traffic, cache failure, backend timeout, secret rotation, and rollback. Validate both client responses and server-side telemetry.

##### Key Points to Mention

- Exact single-instance tests do not prove distributed behavior.
- Verify spoofed headers are removed.
- Check `401`, `403`, `429`, and timeout semantics.
- Measure gateway latency separately from backend latency.

<!-- question:end:rate-limiting-quotas-auth-offload-and-request-transformation-at-the-edge-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
