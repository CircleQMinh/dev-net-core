---
id: application-gateway-and-waf-concepts
topic: Networking, API edge, and secure connectivity
subtopic: Application Gateway and WAF concepts
category: Azure
---

## Overview

Azure Application Gateway is a regional reverse proxy and web traffic load balancer. It operates primarily at Layer 7, understands HTTP and HTTPS requests, and can route traffic by hostname, URL path, and other application-level attributes.

A typical request flow is:

1. A client connects to a public or private frontend IP.
2. A listener accepts traffic that matches its protocol, port, hostname, and frontend.
3. A routing rule selects a backend pool and backend settings.
4. Web Application Firewall, or WAF, rules inspect the request when WAF is enabled.
5. Application Gateway forwards allowed traffic to a healthy backend.
6. The response returns through the gateway to the client.

Application Gateway is commonly used for:

- Publishing regional web applications.
- TLS termination or end-to-end TLS.
- Host-based and path-based routing.
- Load balancing across healthy application instances.
- Protecting web workloads with WAF.
- Exposing private backends through a controlled entry point.
- Consolidating multiple sites behind one gateway.

Azure WAF on Application Gateway provides centralized protection against common HTTP attacks and protocol anomalies. It uses managed rule sets, custom rules, exclusions, request-size controls, and bot protection capabilities. WAF reduces risk, but it does not replace secure coding, authentication, authorization, patching, DDoS protection, or application monitoring.

For interviews, candidates should be able to:

- Explain each Application Gateway component and the request path.
- Distinguish Application Gateway from Azure Load Balancer, Azure Front Door, Azure API Management, and Azure Firewall.
- Describe TLS termination, end-to-end TLS, backend health probes, and common 502 failures.
- Explain WAF detection and prevention modes.
- Distinguish managed rules, custom rules, exclusions, and disabled rules.
- Discuss safe WAF tuning without creating broad security gaps.
- Design a highly available, observable, and privately connected deployment.

## Core Concepts

### Regional Layer 7 Reverse Proxy

Application Gateway is a regional service. It accepts client connections and creates separate connections to backend servers. Because it proxies HTTP traffic, it can make decisions using:

- Host headers.
- URL paths.
- HTTP methods.
- Listener configuration.
- Backend health.
- Redirect and rewrite rules.

This differs from a Layer 4 load balancer, which primarily distributes TCP or UDP flows using IP addresses and ports without understanding HTTP routes.

Application Gateway can be internet-facing, private, or configured with both public and private frontends where supported by the selected deployment configuration. A private frontend is useful for internal applications reached through peering, VPN, ExpressRoute, or connected virtual networks.

### Frontend IP Configuration

The frontend IP is the address clients use to reach the gateway. It can be associated with:

- A public IP for internet-facing applications.
- A private IP from the Application Gateway subnet for internal applications.
- Public and private frontends for workloads that need both entry paths.

DNS records should normally point application hostnames to the gateway frontend. Clients should use the intended hostname rather than depending directly on an IP address because listeners, certificates, and routing often depend on hostnames.

### Listeners

A listener accepts traffic that matches configured connection properties:

- Frontend IP.
- Port.
- Protocol.
- Hostname or hostnames.
- TLS certificate for HTTPS listeners.

A basic listener handles traffic without hostname-specific matching. A multi-site listener uses hostnames to publish multiple sites on the same gateway.

For example:

```text
shop.example.com  -> commerce backend pool
admin.example.com -> administration backend pool
```

Listener specificity and routing-rule priority matter when wildcard and exact hostnames overlap. Configuration should make the intended match deterministic.

### Routing Rules and URL Path Maps

A request routing rule connects:

- A listener.
- A backend pool or redirect.
- Backend settings.
- Optionally, a URL path map or rewrite set.

A basic rule sends all matching listener traffic to one backend pool. A path-based rule selects a backend based on URL path patterns.

```text
/api/*    -> API backend pool
/images/* -> static-content backend pool
/*        -> web frontend pool
```

Every path map needs a sensible default backend. Paths should be tested for ordering, wildcard behavior, trailing slashes, URL encoding, and unexpected routes.

Application Gateway routing is useful for infrastructure-level dispatch. Complex business routing, authorization decisions, and workflow logic belong in the application or a purpose-built API gateway.

### Backend Pools

A backend pool is a collection of destinations that can serve requests. Members can include:

- Virtual machine network interfaces.
- Virtual machine scale sets.
- Private IP addresses.
- Public IP addresses.
- Fully qualified domain names.
- Supported multitenant services such as App Service or Container Apps.
- Reachable on-premises or external servers.

Application Gateway requires network reachability and working DNS resolution for the selected backend members. A backend pool does not by itself define how to connect; backend settings provide protocol, port, host behavior, timeout, and related options.

### Backend Settings

Backend settings control the gateway-to-backend connection. Important settings include:

- HTTP or HTTPS.
- Backend port.
- Request timeout.
- Hostname selection or override.
- Cookie-based affinity.
- Connection draining.
- Trusted root certificates or certificate validation behavior.
- Associated health probe.

The host header is especially important for multitenant backends. App Service and similar platforms often require a hostname that matches the application binding. An incorrect host override can cause redirects, certificate mismatch, authentication failure, or an unhealthy probe.

### Health Probes

Application Gateway sends health probes to decide which backend members can receive traffic. Unhealthy members are temporarily removed from load balancing and restored after successful probes.

Custom probes can define:

- Protocol and port.
- Host header.
- Request path.
- Probe interval.
- Timeout.
- Failure threshold.
- Accepted status-code range.
- Optional response-body matching.

A good health endpoint checks whether an instance can safely serve traffic. It should be:

- Fast.
- Unauthenticated or accessible only through an appropriate probe path.
- Free of side effects.
- Representative without depending on every downstream service.

A probe that always returns success can route traffic to a broken instance. A probe that checks every dependency can remove all instances during a downstream outage and amplify the failure. Many systems separate liveness from readiness and use a readiness-style endpoint for load-balancer routing.

### TLS Termination and End-to-End TLS

With TLS termination, the client establishes HTTPS to Application Gateway, and the gateway decrypts the request. The backend connection can then use HTTP or HTTPS.

Benefits include:

- Central certificate management.
- Reduced TLS processing on application servers.
- WAF inspection of decrypted HTTP content.
- Consistent TLS policy at the entry point.

If the backend connection uses HTTP, traffic is unencrypted between the gateway and backend. This may violate security or compliance requirements even when traffic stays on a private network.

End-to-end TLS uses:

```text
Client --HTTPS--> Application Gateway --HTTPS--> Backend
```

The gateway still terminates the client-side connection and establishes a new TLS connection to the backend. Backend certificate validation, hostname configuration, certificate rotation, and trust chains must be planned carefully.

### Certificate and TLS Operations

Certificate operations should include:

- Automated renewal where possible.
- Expiration alerts.
- Secure storage, commonly through Key Vault integration where supported.
- Explicit ownership for certificate and DNS changes.
- Testing of certificate chains and hostname bindings.
- Controlled TLS policy updates.

A certificate can be valid but still fail because the hostname sent to the backend does not match the certificate, an intermediate certificate is missing, or the gateway does not trust the issuer.

### Autoscaling, Capacity, and Zone Redundancy

The v2 SKU supports autoscaling and zone-redundant deployment options. Autoscaling adjusts capacity to changing traffic, but it is not instantaneous and does not make a poorly designed backend resilient.

Capacity planning should consider:

- Request rate.
- Concurrent connections.
- TLS processing.
- Response size.
- WAF inspection cost.
- Long-lived WebSocket connections.
- Minimum instance capacity.
- Sudden traffic spikes.

A nonzero minimum capacity can reduce scale-from-low-capacity risk. Zone redundancy improves resilience to zonal failures, while backend pools should also span failure domains. A redundant gateway cannot compensate for a single-instance backend.

### Connection Draining and Session Affinity

Connection draining stops sending new requests to a backend member while allowing existing requests to finish for a configured period. It is useful during rolling deployments and planned scale-in.

Cookie-based affinity keeps a client associated with one backend instance. It can support legacy applications with in-memory session state, but it introduces trade-offs:

- Uneven load distribution.
- Session loss when an instance fails.
- Harder deployments and scaling.
- More stateful application behavior.

Prefer stateless application instances with shared or external session storage when practical.

### Redirects and Rewrites

Application Gateway can:

- Redirect HTTP to HTTPS.
- Redirect between listeners or external locations.
- Rewrite request and response headers.
- Rewrite URL paths and query strings.
- Add security-related headers.
- Remove headers that reveal backend implementation details.

Rewrites are appropriate for infrastructure concerns and compatibility. They should not become hidden application logic. Document and test rewrites because a gateway-level change can affect every request before application logs are produced.

### Application Gateway WAF

WAF inspects HTTP traffic passing through Application Gateway. It is designed to reduce exposure to common web attacks such as:

- SQL injection.
- Cross-site scripting.
- Command injection.
- Remote file inclusion.
- Request smuggling patterns.
- Protocol violations and malformed requests.
- Known malicious bots and scanners when bot rules are enabled.

WAF evaluates request attributes such as headers, cookies, query parameters, paths, and supported request bodies. Inspection is constrained by configured request-body and file-upload limits.

WAF is not a vulnerability scanner and does not understand application intent. It cannot determine whether an authenticated user is allowed to access another user's order or whether a transfer amount violates business rules.

### WAF Policies

A WAF policy contains:

- Policy mode.
- Managed rule sets.
- Managed-rule overrides.
- Custom rules.
- Exclusions.
- Request body and size settings.
- File upload limits.
- Bot protection configuration where used.

A policy can be associated at different scopes, including:

- An entire Application Gateway.
- A listener or site.
- A path-based rule.

Per-site or per-path policies are useful when applications have different risk profiles or payload formats. Excessive policy fragmentation increases operational overhead and can cause inconsistent protection.

### Detection and Prevention Modes

In **detection mode**, WAF evaluates traffic and logs matches but does not block requests based on those managed-rule detections. Detection mode is useful for:

- Initial deployment.
- Rule-set upgrades.
- Learning normal traffic.
- Identifying false positives.
- Testing exclusions and custom rules.

In **prevention mode**, WAF blocks traffic when configured rule behavior determines it is malicious. Blocked requests normally return an HTTP error such as 403 and are recorded in WAF logs.

A safe rollout is:

1. Enable diagnostics.
2. Deploy in detection mode.
3. Observe representative production traffic.
4. Investigate matches.
5. Add narrow, justified tuning.
6. Test critical user journeys.
7. Switch to prevention mode.
8. Alert on blocking changes and anomalies.

Detection mode should be a controlled rollout phase, not an indefinite substitute for enforcement.

### Managed Rule Sets and Anomaly Scoring

Managed rule sets provide Microsoft-maintained protections based on common attack patterns. Rules are grouped by attack category and have identifiers that can be tuned individually.

Modern rule sets can use anomaly scoring. Multiple rule matches contribute scores based on severity. In prevention mode, a request is blocked when the accumulated score reaches the blocking threshold.

Anomaly scoring reduces dependence on a single low-confidence match, but teams must still inspect the complete set of matched rules. Disabling only the final blocking rule does not necessarily address the underlying matches correctly.

Managed rule-set versions should be treated like production dependencies:

- Review release changes.
- Test upgrades.
- Monitor false positives and new detections.
- Keep an inventory of overrides and their reasons.
- Remove temporary exceptions after application fixes.

### Custom Rules

Custom rules evaluate before managed rules and use an explicit priority. They can match attributes such as:

- Source IP.
- Geographic location.
- Request URI.
- Headers.
- Cookies.
- Query parameters.
- Request method.

Typical uses include:

- Blocking known hostile IP ranges.
- Restricting an administration route.
- Applying geo-based policy where legally and operationally appropriate.
- Rejecting unexpected methods on a path.
- Allowing a narrowly identified trusted integration.

An allow rule is powerful because rule processing can stop after a match. A broad allow condition can bypass managed-rule inspection for traffic that should still be inspected. Prefer precise conditions and review custom-rule precedence.

### Exclusions and False Positives

An exclusion tells WAF not to inspect a specific request attribute under defined conditions. It may be needed when legitimate content resembles an attack signature, such as encoded tokens, rich text, or generated identifiers.

Safe tuning follows least privilege:

- Exclude a specific parameter, cookie, or header rather than the entire request body.
- Scope the exclusion to the affected rule or rule group when possible.
- Avoid disabling a complete managed rule group for one endpoint.
- Record the false-positive evidence and business owner.
- Add regression tests for both legitimate and malicious inputs.
- Review exceptions periodically.

WAF exclusions reduce inspection. They should be treated as security-sensitive changes, not routine application configuration.

### WAF, DDoS Protection, and Secure Coding

These controls solve different problems:

- **WAF:** Inspects application-layer HTTP requests for malicious patterns.
- **Azure DDoS Protection:** Helps protect network resources from volumetric and protocol-level attacks.
- **Application rate limiting:** Controls abusive or excessive operations using application or identity context.
- **Secure code:** Prevents vulnerabilities at their source.
- **Authentication and authorization:** Establish and enforce caller permissions.

WAF can provide virtual-patch protection while an application fix is developed, but the underlying vulnerability should still be corrected.

### Logging and Observability

Important telemetry includes:

- Access logs.
- Performance metrics.
- WAF logs.
- Backend health.
- Failed request counts.
- Response status distribution.
- Capacity and connection metrics.
- TLS and certificate alerts.

Useful alerts include:

- Increase in 502 responses.
- Sudden WAF blocks after a deployment.
- Repeated attacks against a sensitive route.
- All members of a backend pool becoming unhealthy.
- Capacity approaching expected limits.
- Certificate expiration.

Logs should include enough context to correlate a gateway request with backend application telemetry. Sensitive headers, tokens, or request bodies must not be exposed carelessly in diagnostic data.

### Troubleshooting 502 and Backend Health Failures

Application Gateway commonly returns 502 when it cannot successfully communicate with a healthy backend. Investigation should check:

1. Backend health status and probe error.
2. DNS resolution from the gateway environment.
3. NSG, route table, firewall, and backend access restrictions.
4. Backend port and protocol.
5. Host header and probe hostname.
6. TLS trust, certificate chain, and hostname match.
7. Request timeout and backend response time.
8. Application process health and listening address.

Changing the probe to accept every response may hide the symptom while leaving the backend broken. Diagnose the failed layer rather than weakening health checks.

### Comparing Related Azure Services

| Service | Primary role | Typical scope |
| --- | --- | --- |
| Application Gateway | Layer 7 reverse proxy, regional web routing, optional WAF | Regional |
| Azure Front Door | Global HTTP entry, acceleration, global routing, optional WAF | Global edge |
| Azure Load Balancer | Layer 4 TCP/UDP load balancing | Regional |
| Azure API Management | API governance, policies, products, developer onboarding | API layer |
| Azure Firewall | Central network firewall and egress/inbound network filtering | Virtual network |

Services can be combined. For example, Front Door can provide a global edge while Application Gateway provides regional ingress to private backends. Every additional proxy increases cost, latency, certificate ownership, logging complexity, and troubleshooting paths, so each layer needs a clear responsibility.

### Common Mistakes

Common design and operational mistakes include:

- Treating WAF as a replacement for secure coding.
- Switching immediately to prevention mode without observing legitimate traffic.
- Creating broad exclusions or allow rules to fix one false positive.
- Using an incorrect backend host header.
- Relying on default probes for an application with a custom health path.
- Terminating TLS and sending sensitive traffic to backends over HTTP without evaluating risk.
- Deploying a redundant gateway in front of a single backend instance.
- Assuming autoscaling handles instantaneous traffic spikes.
- Failing to enable WAF and access diagnostics before an incident.
- Mixing Application Gateway routing with extensive business logic.
- Exposing backends publicly even though all normal traffic should enter through the gateway.

### Best-Practice Design Checklist

A production design should normally:

- Prefer the current v2 SKU for new supported deployments.
- Use explicit hostnames and HTTPS listeners.
- Automate certificate renewal and expiration monitoring.
- Encrypt backend traffic when required by the threat model.
- Configure representative custom health probes.
- Spread gateway and backend capacity across failure domains.
- Restrict backend ingress so clients cannot bypass the gateway.
- Start WAF in detection mode, tune narrowly, then enforce prevention.
- Store WAF policies and gateway configuration as infrastructure as code.
- Review managed rule-set versions and exceptions regularly.
- Enable access, WAF, health, and performance telemetry.
- Load-test routing, TLS, WAF, scaling, and failure behavior before production.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is Azure Application Gateway, and how is it different from Azure Load Balancer?

<!-- question:start:application-gateway-and-waf-concepts-beginner-q01 -->
<!-- question-id:application-gateway-and-waf-concepts-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Azure Application Gateway is a regional reverse proxy and web traffic load balancer that understands HTTP and HTTPS. It can route by hostname and URL path, terminate TLS, rewrite headers and URLs, maintain backend health, and integrate with WAF.

Azure Load Balancer primarily operates at Layer 4 and distributes TCP or UDP flows using IP addresses and ports. It is appropriate when the load balancer does not need to inspect HTTP semantics. Application Gateway is selected when web-aware routing or WAF is required.

##### Key Points to Mention

- Application Gateway is primarily Layer 7; Load Balancer is Layer 4.
- Application Gateway supports host-based and path-based routing.
- WAF integration is a major Application Gateway capability.
- The correct service depends on protocol and routing requirements.

<!-- question:end:application-gateway-and-waf-concepts-beginner-q01 -->

#### What are the main components of an Application Gateway request path?

<!-- question:start:application-gateway-and-waf-concepts-beginner-q02 -->
<!-- question-id:application-gateway-and-waf-concepts-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

The frontend IP is the client-facing address. A listener matches the frontend, port, protocol, and optional hostname. A routing rule connects that listener to a backend pool and backend settings, possibly through a path map. Backend settings define the backend protocol, port, host behavior, timeout, affinity, and probe. Health probes determine which backend members are eligible to receive traffic.

##### Key Points to Mention

- Frontend IP and listener accept the request.
- Routing rules select a backend or redirect.
- Backend pools identify destinations.
- Backend settings and health probes control connectivity and eligibility.

<!-- question:end:application-gateway-and-waf-concepts-beginner-q02 -->

#### What is the difference between WAF detection mode and prevention mode?

<!-- question:start:application-gateway-and-waf-concepts-beginner-q03 -->
<!-- question-id:application-gateway-and-waf-concepts-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Detection mode evaluates requests and logs rule matches but allows the traffic to continue. Prevention mode enforces the configured rules and blocks requests that meet blocking criteria.

A common rollout starts in detection mode with diagnostics enabled, observes normal production traffic, tunes false positives narrowly, tests critical workflows, and then changes to prevention mode. Prevention mode should remain monitored because rule-set or application changes can alter blocking behavior.

##### Key Points to Mention

- Detection logs; prevention can block.
- Detection mode is useful for initial tuning.
- WAF logs must be enabled and reviewed.
- Moving to prevention should be tested and controlled.

<!-- question:end:application-gateway-and-waf-concepts-beginner-q03 -->

#### What does an Application Gateway health probe do?

<!-- question:start:application-gateway-and-waf-concepts-beginner-q04 -->
<!-- question-id:application-gateway-and-waf-concepts-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

A health probe periodically calls a backend endpoint and determines whether a backend member can receive traffic. Members that fail the configured criteria are removed from load balancing until they recover.

A custom probe can configure the host, path, protocol, interval, timeout, failure threshold, accepted status codes, and optional response-body match. The endpoint should be fast, side-effect free, and representative of readiness to serve requests.

##### Key Points to Mention

- Probes protect clients from known-unhealthy instances.
- Custom probes are usually preferable for real applications.
- Hostname, protocol, and path must match backend behavior.
- Overly shallow or overly dependent probes both create risk.

<!-- question:end:application-gateway-and-waf-concepts-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you configure TLS from the client through Application Gateway to the backend?

<!-- question:start:application-gateway-and-waf-concepts-intermediate-q01 -->
<!-- question-id:application-gateway-and-waf-concepts-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Configure an HTTPS listener with the public-facing certificate for the application hostname. If backend traffic can be unencrypted under the threat model, backend settings can use HTTP. If encryption is required throughout the path, configure HTTPS backend settings and ensure Application Gateway trusts the backend certificate and sends the correct hostname.

Certificate renewal, trust chains, hostname matching, TLS policy, and expiration monitoring must be automated or operationally owned. End-to-end TLS still consists of two TLS connections because the gateway terminates the client connection and creates a separate backend connection.

##### Key Points to Mention

- Client-side and backend-side TLS are separate connections.
- Backend HTTPS requires correct trust and hostname configuration.
- TLS termination enables WAF inspection and centralized policy.
- Certificate rotation and monitoring are production requirements.

<!-- question:end:application-gateway-and-waf-concepts-intermediate-q01 -->

#### How should a team handle a legitimate request that is blocked by a managed WAF rule?

<!-- question:start:application-gateway-and-waf-concepts-intermediate-q02 -->
<!-- question-id:application-gateway-and-waf-concepts-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

First correlate the blocked request with WAF logs and identify the exact rule, request attribute, endpoint, and content that caused the match. Confirm that the request is legitimate and determine whether the application can change its input format.

If WAF tuning is required, make the narrowest change possible: exclude a specific parameter from a specific rule, adjust one rule action, or scope policy behavior to the affected site or path. Avoid disabling an entire rule group or allowing all traffic to the endpoint. Add tests that prove legitimate traffic succeeds while representative attacks remain blocked, document the exception, and review it later.

##### Key Points to Mention

- Investigate the exact rule and matched variable.
- Prefer an application fix when practical.
- Use narrowly scoped exclusions or overrides.
- Regression-test and periodically review every exception.

<!-- question:end:application-gateway-and-waf-concepts-intermediate-q02 -->

#### Why might Application Gateway report a backend as unhealthy or return HTTP 502?

<!-- question:start:application-gateway-and-waf-concepts-intermediate-q03 -->
<!-- question-id:application-gateway-and-waf-concepts-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Possible causes include a blocked network path, incorrect backend port or protocol, failed DNS resolution, a wrong host header, a health endpoint returning an unaccepted status, a slow backend, TLS trust or hostname failure, or an application process that is not listening.

Troubleshooting should begin with backend health details and probe errors, then verify DNS, effective routes, NSGs, firewalls, backend settings, host behavior, certificate validation, timeout, and application logs. Weakening the probe is not a valid fix unless the probe criteria were genuinely incorrect.

##### Key Points to Mention

- Use backend health and probe diagnostics first.
- Check network, DNS, HTTP, TLS, and application layers systematically.
- Host-header mismatch is common with multitenant PaaS backends.
- Do not hide backend failures by making probes always succeed.

<!-- question:end:application-gateway-and-waf-concepts-intermediate-q03 -->

#### When would you choose Application Gateway instead of Azure Front Door or API Management?

<!-- question:start:application-gateway-and-waf-concepts-intermediate-q04 -->
<!-- question-id:application-gateway-and-waf-concepts-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Choose Application Gateway when a regional web workload needs Layer 7 routing, private virtual-network connectivity to backends, TLS termination, or regional WAF enforcement. Choose Front Door when the primary requirement is a global edge, acceleration, global failover, or routing users to multiple regions. Choose API Management for API contracts, products, subscriptions, developer onboarding, authentication policies, transformations, quotas, and API governance.

They can be combined, but every layer must have a distinct responsibility. A design should avoid stacking proxies without a requirement because that increases latency, cost, certificate management, logging, and failure modes.

##### Key Points to Mention

- Application Gateway is regional and virtual-network oriented.
- Front Door provides a global HTTP edge.
- API Management focuses on API governance.
- Combined architectures need clear boundaries and justified complexity.

<!-- question:end:application-gateway-and-waf-concepts-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### Design a secure and highly available Application Gateway deployment for a regional web application.

<!-- question:start:application-gateway-and-waf-concepts-advanced-q01 -->
<!-- question-id:application-gateway-and-waf-concepts-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use an appropriately sized Application Gateway v2 deployment with autoscaling, a tested minimum capacity, and zone redundancy where supported. Publish HTTPS listeners with automated certificate rotation and redirect HTTP to HTTPS. Use WAF with managed rules, narrowly scoped custom rules, diagnostics, an initial detection phase, and controlled transition to prevention.

Place application instances across zones or failure domains and configure representative custom probes. Use end-to-end TLS where required. Restrict backend ingress so traffic can originate only from the intended gateway path, preventing direct public bypass. Store gateway and WAF configuration in infrastructure as code.

Send access, WAF, metrics, and backend health telemetry to the monitoring platform. Alert on backend pool failure, 502 growth, capacity, unusual WAF blocks, and certificate expiration. Test zonal failure, backend deployment, scale, certificate rotation, WAF updates, and rollback.

##### Key Points to Mention

- Gateway and backend both need redundancy.
- Prevent direct access that bypasses WAF.
- Use controlled WAF and certificate operations.
- Include observability, failure testing, and infrastructure as code.

<!-- question:end:application-gateway-and-waf-concepts-advanced-q01 -->

#### How do custom WAF rules, managed rules, exclusions, and policy scope interact?

<!-- question:start:application-gateway-and-waf-concepts-advanced-q02 -->
<!-- question-id:application-gateway-and-waf-concepts-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Custom rules are evaluated by priority before managed rule-set processing. A matching custom rule can allow, block, or log traffic according to its action, and a terminating action can prevent later rules from evaluating the request. Managed rules provide broad protections and may use anomaly scoring to combine matches.

Exclusions remove selected request attributes from managed-rule inspection and therefore reduce protection for that content. Overrides can alter individual managed-rule behavior. Policy association can apply globally, to a listener, or to a path, allowing different applications or endpoints to have different policies.

The design risk is unintended bypass. A broad custom allow rule, exclusion, or path policy can create a gap even though the global policy appears secure. Teams need explicit precedence, narrow scope, automated tests, change review, and an inventory of exceptions.

##### Key Points to Mention

- Custom-rule priority can affect whether managed rules run.
- Exclusions remove content from inspection.
- Listener and path policies support targeted behavior.
- Broad allow rules and fragmented policies are common sources of bypass.

<!-- question:end:application-gateway-and-waf-concepts-advanced-q02 -->

#### How would you roll out a WAF managed rule-set upgrade safely?

<!-- question:start:application-gateway-and-waf-concepts-advanced-q03 -->
<!-- question-id:application-gateway-and-waf-concepts-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Treat the rule set as a versioned production dependency. Review changes, deploy the new policy to a test environment, and replay representative legitimate and malicious requests. In production, use a staged policy or detection mode where architecture permits, collect WAF logs, and compare match rates by rule, route, and application.

Investigate new matches rather than applying blanket exclusions. Validate high-value user journeys, APIs, file uploads, encoded payloads, and administrative operations. Roll out gradually, monitor block rates and business metrics, maintain a tested rollback, and update the documented exception inventory.

##### Key Points to Mention

- Rule-set upgrades can change both protection and false positives.
- Test realistic application payloads and attack cases.
- Use staged enforcement and measurable rollout criteria.
- Maintain rollback and exception governance.

<!-- question:end:application-gateway-and-waf-concepts-advanced-q03 -->

#### Why is WAF not sufficient protection for an internet-facing application?

<!-- question:start:application-gateway-and-waf-concepts-advanced-q04 -->
<!-- question-id:application-gateway-and-waf-concepts-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

WAF detects request patterns, not full application intent. It cannot reliably enforce object-level authorization, protect stolen credentials, correct insecure business workflows, patch every dependency, or guarantee resilience against volumetric attacks. Encoding, protocol variation, false negatives, and exclusions also limit inspection.

A defense-in-depth design combines WAF with secure coding, input validation, output encoding, strong identity, least-privilege authorization, patching, secrets management, DDoS protection, rate limiting, private backend access, monitoring, incident response, and regular security testing. WAF is one enforcement layer and can provide temporary virtual-patch coverage, but application vulnerabilities should still be fixed.

##### Key Points to Mention

- WAF lacks business and authorization context.
- It can have false positives and false negatives.
- Network-level DDoS and credential abuse require other controls.
- Defense in depth and source-code remediation remain necessary.

<!-- question:end:application-gateway-and-waf-concepts-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
