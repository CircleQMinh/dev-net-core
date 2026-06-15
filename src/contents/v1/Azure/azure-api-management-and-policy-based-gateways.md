---
id: azure-api-management-and-policy-based-gateways
topic: Networking, API edge, and secure connectivity
subtopic: Azure API Management and policy-based gateways
category: Azure
---

## Overview

Azure API Management, or APIM, is a managed platform for publishing, securing, governing, observing, and productizing APIs. It places a gateway between API consumers and backend services while providing a management plane and developer-facing discovery capabilities.

The gateway is the runtime data plane. It:

- Accepts client requests.
- Matches them to APIs and operations.
- Executes configured policies.
- Routes requests to backend services.
- Processes backend responses.
- Emits telemetry.

APIM can provide a stable public contract while backend implementations evolve. It can expose legacy services through modern URLs, validate tokens, enforce traffic policies, authenticate to private backends, transform payloads, cache responses, and route requests across backend pools.

APIM is not automatically the correct choice for every API. It introduces cost, latency, configuration ownership, deployment dependencies, and another production component. It is most valuable when multiple APIs or consumer groups need consistent governance, security, onboarding, analytics, or hybrid gateway placement.

For interviews, candidates should be able to explain:

- The gateway, management plane, developer portal, APIs, products, subscriptions, and workspaces.
- The difference between managed, workspace, and self-hosted gateways.
- How the policy execution pipeline works.
- How policy scopes and `<base />` inheritance interact.
- Where authentication, routing, transformation, throttling, caching, retries, and error handling belong.
- Why APIM does not replace backend business authorization, a web application firewall, or sound API design.
- How tiers, networking, scaling, multi-region design, and self-hosted operations affect architecture.
- How to manage policies as code and test gateway behavior safely.

## Core Concepts

### Main API Management Components

An API Management service contains three major capabilities:

- **Gateway:** Runtime component that proxies requests, applies policies, and collects telemetry.
- **Management plane:** Configuration surface used to provision the service, import APIs, define products, configure policies, and manage deployments.
- **Developer portal:** Consumer-facing site for API discovery, documentation, onboarding, subscriptions, testing, and usage visibility.

The gateway is on the request path. The management plane and developer portal are not required for every individual API call.

This separation matters operationally. A management-plane outage or temporary self-hosted gateway disconnection does not always imply that an already-running gateway immediately stops processing its current configuration.

### APIs and Operations

An APIM API represents a consumer-facing API contract and maps its operations to a backend implementation.

APIs can be imported or defined from formats and services such as:

- OpenAPI.
- WSDL and SOAP.
- OData.
- GraphQL.
- gRPC in supported gateway configurations.
- App Service, Functions, Logic Apps, and Container Apps.

An operation defines:

- HTTP method.
- Public URL template.
- Path and query parameters.
- Request and response representations.
- Operation-level policies.

APIM can present a public route that differs from the backend route. This abstraction allows backend relocation and structural changes, but excessive rewriting can make the gateway a hidden application layer.

### Products and Subscriptions

A product packages one or more APIs for a consumer audience. A published product can be:

- Open.
- Protected by an APIM subscription.
- Subject to product-specific policy, quota, or rate limits.
- Visible to selected developer groups.

An APIM subscription provides a key associated with a scope such as a product, API, or broader service access. Subscription keys are useful for:

- Consumer identification.
- Usage analytics.
- Per-subscription throttling and quotas.
- Developer onboarding.
- Key rotation.

A subscription key is not a substitute for user or workload authentication when the API needs a trustworthy caller identity. Keys can be copied and shared. Use OAuth access tokens, client certificates, or another strong identity mechanism as appropriate.

### Developer Portal

The developer portal supports:

- API documentation.
- Interactive API calls.
- Consumer signup and onboarding.
- Product discovery.
- Subscription-key management.
- API definition downloads.
- Usage visibility.

It is useful for partner and internal API programs, but it should not be confused with the runtime gateway.

Portal governance should include:

- Which APIs and products are discoverable.
- Which users can subscribe.
- Whether subscription approval is automatic.
- How sample requests handle credentials.
- How documentation versions align with deployed behavior.

### Gateway as a Facade

The gateway provides a stable consumer-facing boundary:

```text
Client
  -> api.contoso.example/orders
  -> API Management gateway
  -> private internal backend
```

The facade can hide:

- Backend hostnames.
- Internal path structures.
- Implementation technology.
- Authentication mechanism used between APIM and the backend.
- Regional or versioned backend selection.

The facade should preserve a coherent API contract. It should not hide incompatible business semantics or make operationally significant behavior impossible for teams to discover.

### Managed Gateway

Every APIM service tier includes a built-in managed gateway. Azure operates the gateway infrastructure, while the customer configures APIs, policies, networking, capacity, and monitoring.

Managed gateway advantages include:

- Lower operational burden.
- Integrated scaling and service management.
- Azure networking and monitoring integration.
- Centralized policy deployment.
- Supported multi-region or zone features in appropriate tiers.

Trade-offs include:

- Tier-dependent features and cost.
- Traffic may travel through Azure gateway locations even when backends are elsewhere.
- Platform limits and scaling characteristics.
- Network integration complexity for private backends.

### Workspace Gateways

Workspaces support federated API management. API teams can manage their own APIs, products, subscriptions, and related configuration while a central platform team retains governance of the APIM service.

A workspace can use the service's default managed gateway in supported v2 tiers or one or more dedicated workspace gateways in supported Premium configurations.

Workspace gateways provide runtime isolation between workspace workloads, but they do not support every feature of the default gateway. Architecture decisions must use the current tier and gateway feature matrix rather than assuming all APIM gateways behave identically.

### Self-Hosted Gateway

The self-hosted gateway is a containerized APIM gateway deployed near backends in an on-premises, edge, or other-cloud environment.

Benefits include:

- Lower latency to local backends.
- Reduced cross-environment data transfer.
- Local traffic routing for compliance.
- Central policy and API management from Azure.
- Hybrid and multicloud API governance.

The customer operates:

- Container or Kubernetes infrastructure.
- Scaling and availability.
- Image upgrades.
- Resource limits.
- Local networking and TLS.
- Persistent configuration backup.
- Local logging and monitoring.

The gateway still needs outbound connectivity to its APIM configuration endpoint for updates, status, and optional telemetry. During a temporary disconnection, a running gateway can continue using cached configuration. With configuration backup, a stopped gateway can restart from persisted configuration.

Production deployments should pin an intentional gateway image version instead of relying on a rolling tag that can introduce unplanned upgrades.

### APIM Service Tiers

APIM tiers differ in:

- Provisioning and scaling model.
- Capacity and service limits.
- Virtual network capabilities.
- Private endpoints.
- Availability zones.
- Multi-region deployment.
- Self-hosted gateway availability.
- Workspaces and workspace gateways.
- Caching and protocol features.
- SLA and cost.

Broad tier families include:

- Classic dedicated tiers.
- V2 tiers with faster provisioning and newer networking options.
- Consumption for variable serverless traffic.

Do not choose a tier only by average request volume. Evaluate:

- Peak concurrency and policy cost.
- Private backend connectivity.
- Required availability model.
- Multi-region needs.
- Protocol support.
- Expected scale-out time.
- Developer portal and analytics requirements.
- Gateway type and policy compatibility.

Load test with representative payloads and policies. Gateway throughput depends on backend latency, connection concurrency, body sizes, policy expressions, transformations, logging, and cache behavior.

### The Policy Pipeline

APIM policies are XML statements executed sequentially in four sections:

```xml
<policies>
  <inbound>
    <base />
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
  </outbound>
  <on-error>
    <base />
  </on-error>
</policies>
```

The sections are:

- **Inbound:** Runs as the request enters the gateway. Common tasks include token validation, throttling, header normalization, request transformation, and backend selection.
- **Backend:** Controls forwarding behavior, retries, timeouts, and backend routing.
- **Outbound:** Runs after a backend response. Common tasks include response transformation, header removal, caching, and response normalization.
- **On-error:** Runs when policy execution enters an error state. It can log context or return a controlled error.

If an error occurs during normal processing, remaining statements are skipped and execution moves to `on-error`.

API Management policies are not Azure Policy definitions. APIM policies change runtime request behavior; Azure Policy evaluates governance compliance of Azure resources.

### Policy Scopes

Policies can be configured at scopes from broadest to narrowest:

- Global.
- Workspace.
- Product.
- API.
- Operation.

Use broad scopes for universal controls:

- Correlation IDs.
- Baseline security headers.
- Required token validation.
- Common diagnostics.

Use narrow scopes for:

- Operation-specific authorization.
- Backend routing.
- Specialized transformations.
- Different quotas or timeouts.

Policies at multiple scopes are combined through inheritance. The location of `<base />` determines when parent policies execute.

### Policy Inheritance and Base

Include `<base />` in each section when child policies should inherit parent behavior:

```xml
<inbound>
  <base />
  <rewrite-uri template="/internal/orders/{orderId}" />
</inbound>
```

Removing `<base />` can omit policies from broader scopes. This can unintentionally bypass global authentication, throttling, telemetry, or header controls.

The position matters:

```xml
<inbound>
  <validate-header name="X-Required-Client" />
  <base />
</inbound>
```

Here, the child validation executes before inherited parent policies.

Use Azure Policy, CI validation, or another governance control to require appropriate inheritance. Review the effective policy, not only the local XML fragment.

### Policy Expressions

Policy expressions embed an allowed subset of C# expressions:

```xml
<set-header name="x-correlation-id" exists-action="skip">
  <value>@(context.RequestId.ToString())</value>
</set-header>
```

Expressions can inspect:

- Request and response data.
- Matched parameters.
- Subscription and user context.
- Deployment region.
- Variables.
- Validated token claims.

Use expressions for small edge decisions, not substantial business logic. Complex expressions:

- Are harder to test and review.
- Increase gateway CPU cost.
- Can consume request bodies.
- Can create runtime failures.
- Hide behavior from backend owners.

If logic requires databases, complex workflows, domain state, or frequent independent releases, it belongs in an application or dedicated service.

### Named Values and Secrets

Named values centralize policy configuration such as:

- Backend identifiers.
- Audience values.
- Feature switches.
- Nonsecret constants.
- Secret references.

Secret named values can reference Azure Key Vault. Use APIM managed identity and narrow Key Vault permissions.

Do not embed credentials directly in policy XML. Also remember that people who can edit policies may be able to use APIM's managed identity to acquire or forward tokens. Policy-edit permissions are privileged and must be governed.

### Backend Entities

A backend entity defines a reusable backend configuration. Policies can route by backend ID:

```xml
<set-backend-service backend-id="orders-primary" />
```

Backends can support:

- Centralized endpoint configuration.
- Managed identity or certificate authentication.
- Load-balanced pools.
- Circuit-breaker rules in supported gateways.
- Runtime routing decisions.

Backend entities reduce repeated URLs and make routing intent clearer. Restrict dynamic routing so tokens or secrets cannot be forwarded to an attacker-controlled destination.

### Routing and Version Abstraction

APIM can route based on:

- API version.
- Header or query parameter.
- Geography.
- Product or subscription.
- Canary percentage.
- Backend health or pool configuration.

Use versions for breaking contract changes. Use revisions for nonbreaking changes and controlled publication of the same version.

A gateway can support gradual migration:

```text
Public v1 -> legacy backend
Public v2 -> new backend
```

Do not use policy routing to pretend that incompatible contracts are one version. The public API definition and documentation must remain truthful.

### Networking

Common designs include:

- Public APIM gateway to public backends.
- Public gateway to private backends through virtual network integration.
- Private gateway reachable only through private networking.
- APIM behind Azure Front Door or Application Gateway for global routing or WAF.
- Self-hosted gateway beside on-premises backends.

Network design must address:

- Inbound client path.
- Outbound backend path.
- DNS.
- TLS certificates and custom domains.
- Private endpoints.
- Network security groups and route tables.
- Identity-provider and telemetry endpoints.
- Management-plane connectivity.

APIM is an API gateway, not a full web application firewall. Use Front Door or Application Gateway WAF when layer-7 web threat filtering is required.

### Backend Authentication

APIM can authenticate to backends using:

- Managed identity.
- Client certificates.
- Basic credentials for legacy systems.
- Static headers or keys stored securely.
- OAuth credentials through supported mechanisms.

Managed identity is preferred for supported Azure or Microsoft Entra-protected backends:

```xml
<authentication-managed-identity
    resource="api://orders-backend-client-id" />
```

APIM obtains and caches a token and sets the backend `Authorization` header.

The frontend caller's identity and APIM's backend identity solve different problems:

- Frontend token identifies and authorizes the consumer.
- APIM managed identity authorizes the gateway to call the backend.

If the backend needs the original user identity, use a deliberate delegation design rather than replacing the user's token without considering authorization semantics.

### Observability

APIM can emit:

- Azure Monitor metrics.
- Diagnostic logs.
- Application Insights telemetry.
- Request traces.
- Event Hub events.
- Self-hosted local logs and metrics.

Monitor:

- Gateway latency.
- Backend latency.
- Request volume.
- Status-code distribution.
- Policy failures.
- Authentication failures.
- Throttled and quota-rejected requests.
- Capacity and saturation.
- Backend pool health.
- Cache hit ratio.
- Regional behavior.

Separate gateway time from backend time. Otherwise teams may optimize the wrong component.

Avoid logging:

- Access tokens.
- Subscription keys.
- Authorization headers.
- Sensitive bodies.
- Personal data without an approved purpose.

### Caching

APIM can cache suitable GET responses to reduce latency and backend load.

Cache design must define:

- Which responses are cacheable.
- Cache key dimensions.
- Whether authorization affects the response.
- Vary-by headers and query parameters.
- Time to live.
- Invalidation behavior.
- Whether internal or external cache is used.

The built-in cache is volatile. A cache miss or outage can cause a sudden load increase, so rate limiting should still protect the backend.

Do not cache personalized or authorization-dependent responses under a shared key.

### Retries, Timeouts, and Circuit Breaking

The gateway can configure:

- Backend timeout.
- Request-body buffering for retry.
- Fixed, linear, or exponential retry.
- Backend switching.
- Backend pool load balancing.
- Circuit breakers in supported gateways.

Retries are safe only when:

- The operation is idempotent.
- The body can be replayed.
- Total latency remains within the client budget.
- Retried failures are transient.
- Retry multiplication across client, gateway, and backend is controlled.

Do not add broad retries to non-idempotent POST requests without an idempotency design.

### Error Handling

Use `on-error` to:

- Map internal gateway failures to a stable external response.
- Add correlation information.
- Emit safe diagnostic events.
- Handle selected policy errors.

Avoid exposing:

- Backend hostnames.
- Stack traces.
- Raw policy exceptions.
- Token-validation details useful to attackers.
- Secret named values.

Return standards-based, consistent errors where practical, but keep enough server-side context for diagnosis.

### APIM and Backend Responsibilities

Good edge responsibilities include:

- Transport security.
- Token validation.
- Coarse capability authorization.
- Rate limiting and quotas.
- Routing and protocol adaptation.
- Correlation and telemetry.
- Small structural transformations.

Backend responsibilities include:

- Object-level authorization.
- Business invariants.
- Domain validation.
- Transactions.
- Data consistency.
- Business auditing.
- Protection against bypass if the backend is reachable through another path.

Defense in depth can mean validating tokens at APIM and again in the backend. Edge validation protects the gateway contract; backend validation protects the service boundary.

### Infrastructure and Policy as Code

Treat APIM configuration as deployable source:

- API definitions.
- Policy XML.
- Named-value references.
- Products and subscriptions.
- Backends.
- Diagnostics.
- Custom domains.
- Network configuration.

Use:

- Infrastructure as code.
- Pull-request review.
- Environment-specific parameters.
- Policy linting and tests.
- Staged deployment.
- Revisions for controlled changes.
- Drift detection.

Avoid editing production policies only through the portal. A small XML change can alter authentication or routing for every request.

### Common Mistakes

- Treating subscription keys as strong user authentication.
- Removing `<base />` and bypassing parent protections.
- Putting complex business logic in policy expressions.
- Granting broad policy-edit permissions.
- Forwarding APIM managed identity tokens to dynamic or untrusted backends.
- Assuming every gateway type supports every feature.
- Selecting a tier from average traffic without load testing.
- Exposing a private backend through another route that bypasses APIM.
- Retrying non-idempotent operations.
- Caching personalized responses under a shared key.
- Logging tokens or sensitive payloads.
- Using APIM when one simple internal API has no meaningful gateway requirement.

### When APIM Is a Good Fit

APIM is a strong fit when:

- Many APIs need consistent security and governance.
- Partners need onboarding, products, keys, and documentation.
- Backends span Azure, on-premises, and other clouds.
- A stable facade must outlive backend migrations.
- Central traffic controls and analytics are required.
- Multiple teams need federated API ownership.

It may be excessive when:

- There is one low-risk internal API.
- Platform cost and latency exceed the governance benefit.
- The only requirement is basic reverse proxying.
- Existing ingress already provides the required controls.
- The team cannot operate or govern the added policy layer.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What are the main components of Azure API Management?

<!-- question:start:azure-api-management-and-policy-based-gateways-beginner-q01 -->
<!-- question-id:azure-api-management-and-policy-based-gateways-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

The main components are the API gateway, management plane, and developer portal. The gateway is the runtime data plane that proxies requests and executes policies. The management plane configures APIs, products, policies, and service settings. The developer portal provides documentation, discovery, onboarding, and subscription management for API consumers.

##### Key Points to Mention

- The gateway is on the request path.
- APIs contain operations mapped to backends.
- Products package APIs for consumer audiences.
- Components have different availability and security concerns.

<!-- question:end:azure-api-management-and-policy-based-gateways-beginner-q01 -->

#### What is an APIM policy?

<!-- question:start:azure-api-management-and-policy-based-gateways-beginner-q02 -->
<!-- question-id:azure-api-management-and-policy-based-gateways-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

An APIM policy is an XML-configured runtime rule executed by the gateway. Policies can validate tokens, limit traffic, rewrite requests, select backends, authenticate to backends, cache responses, and handle errors. They execute sequentially in inbound, backend, outbound, and on-error sections.

##### Key Points to Mention

- APIM policies are different from Azure Policy.
- Policy order affects behavior.
- Policy expressions support constrained C# logic.
- Policies should not contain complex domain logic.

<!-- question:end:azure-api-management-and-policy-based-gateways-beginner-q02 -->

#### What is the difference between a managed and self-hosted APIM gateway?

<!-- question:start:azure-api-management-and-policy-based-gateways-beginner-q03 -->
<!-- question-id:azure-api-management-and-policy-based-gateways-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Azure operates the managed gateway as part of the APIM service. A self-hosted gateway is a container that the customer deploys and operates near on-premises or multicloud backends while receiving configuration from an Azure APIM service. Self-hosting can reduce latency and meet locality requirements but transfers scaling, upgrades, availability, and local observability responsibilities to the customer.

##### Key Points to Mention

- Self-hosted gateways still need configuration connectivity to Azure.
- They can continue with cached configuration during temporary disconnection.
- Feature support differs by gateway and tier.
- Pin production container versions deliberately.

<!-- question:end:azure-api-management-and-policy-based-gateways-beginner-q03 -->

#### What are APIM products and subscriptions?

<!-- question:start:azure-api-management-and-policy-based-gateways-beginner-q04 -->
<!-- question-id:azure-api-management-and-policy-based-gateways-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A product packages APIs for a particular consumer audience and can define publication, subscription, quota, and policy behavior. A subscription gives a consumer one or more keys used to access a protected product or API and to track usage. Subscription keys are useful for identification and metering but should not replace strong caller authentication when identity matters.

##### Key Points to Mention

- Products can be open or protected.
- Subscription scope affects product-policy execution.
- Keys need rotation and secure handling.
- OAuth or certificates may be required in addition to keys.

<!-- question:end:azure-api-management-and-policy-based-gateways-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How do APIM policy scopes and the base element work?

<!-- question:start:azure-api-management-and-policy-based-gateways-intermediate-q01 -->
<!-- question-id:azure-api-management-and-policy-based-gateways-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Policies can be defined at global, workspace, product, API, and operation scopes. A narrower policy uses `<base />` to inherit policies from broader scopes. The element's location controls when parent statements run relative to local statements. Omitting it can bypass inherited authentication, throttling, telemetry, or routing behavior.

##### Key Points to Mention

- Review the effective combined policy.
- Put universal controls at broader scopes.
- Use narrow scopes for exceptions.
- Govern required inheritance through CI or Azure Policy.

<!-- question:end:azure-api-management-and-policy-based-gateways-intermediate-q01 -->

#### When should logic be implemented in an APIM policy instead of a backend?

<!-- question:start:azure-api-management-and-policy-based-gateways-intermediate-q02 -->
<!-- question-id:azure-api-management-and-policy-based-gateways-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use policies for edge concerns such as token validation, throttling, routing, header normalization, small protocol transformations, caching, and telemetry. Keep business invariants, object-level authorization, transactions, and complex stateful decisions in backend code. The gateway should remain understandable, fast, and independently testable.

##### Key Points to Mention

- Policy expressions execute on every request.
- Complex XML logic is difficult to maintain.
- Gateway changes can affect many APIs at once.
- Backends still protect themselves from bypass paths.

<!-- question:end:azure-api-management-and-policy-based-gateways-intermediate-q02 -->

#### How would APIM access a private backend securely?

<!-- question:start:azure-api-management-and-policy-based-gateways-intermediate-q03 -->
<!-- question-id:azure-api-management-and-policy-based-gateways-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Choose a tier and gateway configuration that supports the required virtual network connectivity. Configure DNS and routing to the private backend, secure TLS, and use managed identity or client-certificate authentication from APIM to the backend. Restrict the backend so clients cannot bypass the gateway and monitor both network and authorization failures.

##### Key Points to Mention

- Private endpoints and virtual network integration are tier-dependent.
- Frontend and backend authentication are separate.
- Custom DNS and route configuration are common failure points.
- A WAF may be added through Front Door or Application Gateway.

<!-- question:end:azure-api-management-and-policy-based-gateways-intermediate-q03 -->

#### How should APIM configuration be deployed safely?

<!-- question:start:azure-api-management-and-policy-based-gateways-intermediate-q04 -->
<!-- question-id:azure-api-management-and-policy-based-gateways-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Store API definitions, policies, backends, products, diagnostics, and infrastructure in version control. Use infrastructure as code, pull-request review, environment parameters, automated policy validation, integration tests through the gateway, and staged rollout. Use API revisions for controlled nonbreaking changes and versions for breaking contracts.

##### Key Points to Mention

- Avoid unmanaged production portal edits.
- Test effective policy inheritance.
- Keep secrets in Key Vault-backed references.
- Rollback plans must include gateway configuration.

<!-- question:end:azure-api-management-and-policy-based-gateways-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you choose among managed, workspace, and self-hosted gateways?

<!-- question:start:azure-api-management-and-policy-based-gateways-advanced-q01 -->
<!-- question-id:azure-api-management-and-policy-based-gateways-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use the default managed gateway for operational simplicity and Azure-hosted traffic. Use workspace gateways when decentralized API teams need runtime isolation under centralized APIM governance and the selected tier supports the required features. Use self-hosted gateways when traffic locality, on-premises access, multicloud placement, latency, or compliance justifies operating gateway containers. Compare feature support, connectivity, availability, scaling, and telemetry before deciding.

##### Key Points to Mention

- Gateway capabilities differ by tier and type.
- Self-hosted availability is the customer's responsibility.
- Counters and caches may be local to gateway deployments.
- Workspace autonomy does not remove central governance needs.

<!-- question:end:azure-api-management-and-policy-based-gateways-advanced-q01 -->

#### How would you design APIM for multi-region availability?

<!-- question:start:azure-api-management-and-policy-based-gateways-advanced-q02 -->
<!-- question-id:azure-api-management-and-policy-based-gateways-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Select a tier that supports the required regional topology, deploy gateway capacity in appropriate regions, use a global routing layer when needed, and ensure backends, DNS, identity dependencies, certificates, and telemetry are also regionally resilient. Test failover and capacity under degraded conditions. Account for rate counters, caches, and policy state being regional rather than globally exact.

##### Key Points to Mention

- Multi-region gateway alone does not make the backend resilient.
- External dependencies must tolerate regional failover.
- Client DNS and connection behavior affect recovery time.
- Load tests should include policy cost and backend latency.

<!-- question:end:azure-api-management-and-policy-based-gateways-advanced-q02 -->

#### What security risk is associated with permission to edit APIM policies?

<!-- question:start:azure-api-management-and-policy-based-gateways-advanced-q03 -->
<!-- question-id:azure-api-management-and-policy-based-gateways-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Policy editors can alter authentication, route traffic, expose sensitive headers, log bodies, or use APIM's managed identity to obtain and forward tokens. Therefore policy-edit permission is privileged. Apply least privilege, separate duties, review changes, restrict managed identity permissions, use trusted backend entities, and monitor policy and named-value changes.

##### Key Points to Mention

- Managed identity token forwarding is customer-controlled.
- Dynamic backend destinations can create exfiltration paths.
- Portal-only changes weaken review and audit.
- Narrow APIM identity permissions limit blast radius.

<!-- question:end:azure-api-management-and-policy-based-gateways-advanced-q03 -->

#### When would you decide not to use Azure API Management?

<!-- question:start:azure-api-management-and-policy-based-gateways-advanced-q04 -->
<!-- question-id:azure-api-management-and-policy-based-gateways-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Avoid APIM when a small internal system has one simple API, existing ingress already supplies the required controls, or the additional cost, latency, and operational ownership outweigh governance benefits. Also avoid it as a place to hide poor contracts or move complex business logic out of code. The decision should be based on consumer onboarding, security consistency, lifecycle governance, routing, and observability needs.

##### Key Points to Mention

- A reverse proxy may be sufficient for basic routing.
- Every gateway adds latency and failure modes.
- Teams need ownership for policies and deployments.
- APIM is strongest as a shared API platform capability.

<!-- question:end:azure-api-management-and-policy-based-gateways-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
