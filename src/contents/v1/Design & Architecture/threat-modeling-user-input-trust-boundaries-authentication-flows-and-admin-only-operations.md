---
id: threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations
topic: Web application security threat modeling and attack patterns
subtopic: Threat modeling user input, trust boundaries, authentication flows, and admin-only operations
category: Design & Architecture
---

## Overview

Threat modeling is a structured process for understanding what a system must protect, how data and authority move through it, how an attacker could abuse those paths, and which controls reduce the risk to an acceptable level.

A practical threat model answers:

1. What are we building?
2. What valuable assets and security objectives exist?
3. Who are the legitimate actors and likely adversaries?
4. Where does data or control cross a trust boundary?
5. What can go wrong?
6. What controls prevent, detect, or limit it?
7. How will the team verify and maintain those controls?

Threat modeling is not a one-time compliance document and is not limited to penetration testers. It is an engineering activity that should begin during design, produce concrete requirements and tests, and be updated when architecture, identity, data sensitivity, dependencies, or deployment assumptions change.

User input, authentication flows, and administrator operations deserve special attention:

- User input crosses from a less-trusted actor into parsers, databases, templates, filesystems, or commands.
- Authentication flows grant sessions and establish identity assurance.
- Administrator operations carry broad authority and can create a large blast radius.

This topic matters in interviews because candidates are often asked to reason about a system before code exists. Strong answers identify assets and boundaries, avoid treating internal networks or authenticated users as automatically trusted, distinguish threats from vulnerabilities and risks, and connect mitigations to owners, tests, telemetry, and incident response.

## Core Concepts

### Threat, Vulnerability, Risk, and Control

A **threat** is a potential cause of harm:

```text
An attacker attempts to access another tenant's invoices.
```

A **vulnerability** is a weakness that enables the threat:

```text
The invoice endpoint retrieves by ID without checking tenant ownership.
```

A **risk** combines likelihood and impact in the system's context:

```text
Cross-tenant financial disclosure is likely and has severe impact.
```

A **control** changes likelihood, impact, detectability, or recovery:

```text
Tenant-scoped query, resource authorization, audit logging, and negative tests.
```

Threat models should describe specific attack paths and controls rather than listing vague labels such as "hacking" or "encryption."

### Security Objectives and Assets

Start by identifying what matters.

Common security objectives:

- Confidentiality.
- Integrity.
- Availability.
- Authenticity.
- Authorization.
- Accountability and non-repudiation where required.
- Privacy.
- Safety and regulatory obligations.

Assets may include:

- Customer and employee data.
- Credentials, sessions, tokens, and signing keys.
- Money, credits, inventory, or entitlements.
- Source code and deployment pipelines.
- Administrative authority.
- Audit evidence.
- Service capacity and business continuity.
- Reputation and contractual commitments.

An asset does not need to be a database row. The ability to approve a payment or deploy production code is itself valuable authority.

### Scope and Assumptions

Define:

- System components.
- External dependencies.
- Deployment environments.
- Actors and roles.
- Data classifications.
- Entry points.
- Out-of-scope areas.
- Security assumptions.

Write assumptions so they can be challenged:

```text
Assumption: only the API gateway can reach the service.
Verification: network policy test and continuous configuration monitoring.
Failure impact: direct callers bypass gateway authentication and rate limits.
```

An undocumented assumption is often an unowned vulnerability.

### Data Flow Diagrams

A lightweight data flow diagram (DFD) helps the team reason about:

- External entities.
- Processes or services.
- Data stores.
- Data flows.
- Trust boundaries.

Example:

```text
[Browser]
    | credentials, CSRF token, requests
    v
--- Internet / edge trust boundary ---
[CDN / WAF / Gateway]
    | authenticated request
    v
--- application trust boundary ---
[Web API] <----> [Identity Provider]
    |
    +----> [Database]
    |
    +----> [Object Storage]
    |
    +----> [Admin Worker]
```

The diagram does not need perfect notation. It must be accurate enough to expose where identity, data, and privilege change.

### Trust Boundaries

A trust boundary is a point where data or execution moves between contexts with different trust assumptions or control.

Examples:

- Internet to edge service.
- Browser JavaScript to server API.
- API gateway to internal service.
- Application to database.
- One tenant to shared infrastructure.
- Normal user plane to administrative control plane.
- CI/CD system to production.
- Main application to third-party SaaS.
- Host process to isolated file-processing worker.

"Internal" is not a meaningful security guarantee by itself. Internal services can be compromised, misconfigured, or called through unexpected paths. Re-establish identity and authorization when authority crosses a boundary.

### Entry Points and Attack Surface

Inventory every way data or commands enter:

- HTTP routes and headers.
- Forms, query strings, JSON, GraphQL, and multipart bodies.
- WebSockets and real-time hubs.
- Message queues and event streams.
- File imports and uploads.
- Scheduled jobs.
- Webhooks.
- Administrative tools.
- Database migration and support scripts.
- Configuration and feature flags.
- Third-party callbacks.

Do not model only the public controller. Background consumers and admin utilities often process the same data with more privilege and fewer validation controls.

### STRIDE

STRIDE is a prompt for finding common threat classes:

- **Spoofing:** pretending to be another principal or service.
- **Tampering:** modifying data, code, messages, or configuration.
- **Repudiation:** denying an action when evidence is insufficient.
- **Information disclosure:** exposing protected data.
- **Denial of service:** reducing availability or exhausting resources.
- **Elevation of privilege:** gaining unauthorized capability.

Apply STRIDE to components, data flows, data stores, and trust boundaries. It is a discovery aid, not a substitute for business abuse cases or domain knowledge.

### Abuse Cases and Misuse Cases

An abuse case describes how a feature can be used against its intended purpose.

For a password reset feature:

- Enumerate registered accounts.
- Flood a victim with reset messages.
- Steal or replay a reset token.
- Redirect the reset link.
- Use recovery to bypass MFA.
- Keep old sessions active after reset.
- Abuse support escalation.

Thinking in attacker goals often reveals risks that a generic checklist misses.

### Modeling User Input

Every input should have:

- A known source and trust level.
- A schema and size bound.
- Canonicalization rules.
- Business validation.
- Authorization context.
- A defined destination or sink.
- Safe error and logging behavior.

Trace input from source to sink:

```text
query parameter
    -> model binding
    -> business rule
    -> database query
    -> response template
```

At each step ask whether the value changes interpretation:

- SQL syntax.
- HTML or JavaScript.
- Operating-system command.
- Filesystem path.
- URL or redirect target.
- Log structure.
- Template expression.
- Header value.
- Regular expression.

### Validation and Encoding Solve Different Problems

**Validation** checks whether input is acceptable for the business operation:

```text
Currency is one of USD, EUR, or VND.
Quantity is between 1 and 100.
```

**Canonicalization** produces a consistent representation:

```text
Normalize an email address according to the application's identity rules.
Resolve a path before checking containment.
```

**Parameterized APIs** separate data from interpreter syntax:

```text
Parameterized SQL or separate process arguments.
```

**Output encoding** makes data safe for a destination context:

```text
HTML text, attribute, URL, JavaScript, or CSS context.
```

Use the control appropriate to each sink. Input validation alone does not make arbitrary data safe in every output context.

### Client and Server Validation

Client-side validation improves usability and reduces accidental bad requests. It is not a security boundary because an attacker can:

- Modify JavaScript.
- Call the API directly.
- Replay requests.
- Use a custom client.

The server must enforce schema, business rules, authorization, and resource limits. Avoid inconsistent duplicate rules by sharing schemas or generating client contracts where practical, while keeping server enforcement authoritative.

### Authentication Flow Modeling

Authentication flows include more than the password form:

- Registration and invitation.
- Login.
- MFA enrollment and challenge.
- Password reset.
- Account recovery.
- Email or phone change.
- External identity-provider callbacks.
- Session issuance, renewal, and logout.
- Remembered devices.
- Factor replacement.
- Account linking.
- Impersonation.

For each step, model:

- Actor and authenticator.
- Redirects and callbacks.
- State stored in the browser and server.
- Token purpose, audience, lifetime, and replay behavior.
- Session transition.
- Failure and recovery paths.
- Logging and user notification.

The weakest alternate path can bypass the main login controls.

### OAuth and OpenID Connect Flow Threats

Common concerns include:

- Unvalidated redirect URIs.
- Missing or incorrect `state`.
- Missing `nonce` for applicable identity flows.
- Authorization-code interception.
- Missing Proof Key for Code Exchange (PKCE) for public clients.
- Token audience or issuer confusion.
- Mix-up between identity providers.
- Token leakage through URLs, logs, or browser storage.
- Unsafe account linking based only on unverified identifiers.
- Overbroad scopes and long-lived refresh tokens.

Use maintained protocol libraries and identity providers. Do not implement OAuth or OpenID Connect message validation from scratch.

### Authentication State Transitions

Mark transitions where authority increases:

```text
anonymous
    -> password authenticated
    -> MFA authenticated
    -> privileged operation reauthenticated
    -> temporary administrator elevation
```

At each transition consider:

- Session identifier rotation.
- Authentication method and time recorded.
- Required assurance for the next action.
- CSRF and replay protection.
- Revocation.
- Audit events.

A role claim issued before a privilege change may become stale. Critical authorization decisions may need current server-side state or short-lived tokens.

### Threat Modeling Admin-Only Operations

Administrator operations commonly include:

- Managing users, roles, and tenants.
- Resetting passwords or MFA.
- Viewing customer data.
- Issuing refunds or credits.
- Changing security settings.
- Exporting data.
- Impersonating users.
- Rotating keys.
- Deploying code or changing feature flags.

Do not protect these operations only by:

- Hiding UI controls.
- Using an obscure URL.
- Checking that the caller is authenticated.
- Trusting an internal network.
- Checking a broad `IsAdmin` flag for every action.

Use explicit operation-level authorization and constrain the affected resource, tenant, amount, environment, and state.

### Administrative Control Plane

High-risk systems benefit from separating the administrative control plane from ordinary user traffic.

Possible controls:

- Separate application or route surface.
- Phishing-resistant MFA.
- Managed devices or restricted networks.
- Just-in-time and time-limited roles.
- Approval for destructive or high-value actions.
- Step-up authentication.
- Read-only support roles.
- Separate production access.
- Stronger rate limits and anomaly detection.
- Tamper-resistant audit logging.

Separation reduces accidental exposure and allows stricter policy, but it does not replace authorization on each operation.

### Resource-Based and Policy-Based Authorization

An administrator may have permission to perform one action but not all actions on all tenants.

ASP.NET Core policy example:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CanSuspendUser", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim("permission", "users:suspend");
        policy.RequireClaim("mfa", "phishing-resistant");
    });
});
```

Endpoint:

```csharp
[Authorize(Policy = "CanSuspendUser")]
[HttpPost("/admin/tenants/{tenantId:guid}/users/{userId:guid}/suspend")]
public async Task<IActionResult> SuspendUser(
    Guid tenantId,
    Guid userId,
    CancellationToken cancellationToken)
{
    var target = await users.FindInTenantAsync(
        tenantId,
        userId,
        cancellationToken);

    if (target is null)
    {
        return NotFound();
    }

    var authorization = await authorizationService.AuthorizeAsync(
        User,
        target,
        "CanSuspendTargetUser");

    if (!authorization.Succeeded)
    {
        return Forbid();
    }

    await users.SuspendAsync(target, User, cancellationToken);
    return NoContent();
}
```

The route policy checks broad capability and assurance. The resource policy checks tenant scope, target relationship, protected accounts, and other contextual rules.

### Impersonation and Support Access

Impersonation is powerful because actions appear in another user's context.

Safe design should:

- Require a narrow permission and recent strong authentication.
- Record the real operator and impersonated principal.
- Display an unmistakable impersonation indicator.
- Limit duration and tenant scope.
- Prevent or separately authorize high-risk operations.
- Notify or audit according to policy.
- Terminate cleanly and rotate session state.

Never overwrite the original operator identity in audit records.

### Auditability and Repudiation

Security-relevant audit events should answer:

- Who acted?
- Under which real and delegated identity?
- What operation was attempted?
- Which resource and tenant were affected?
- What changed?
- When and from which trusted context?
- Was the operation allowed or denied?
- Which policy or approval applied?

Avoid logging secrets, full tokens, or unnecessary personal data. Protect audit integrity, access, retention, and time synchronization. Logs support detection and investigation but should not become another sensitive-data leak.

### Risk Prioritization

Teams can rank threats using:

- Business impact.
- Exploitability.
- Exposure.
- Existing controls.
- Detectability.
- Number and sensitivity of affected assets.
- Recovery difficulty.

Use a consistent scale, but do not let arithmetic hide uncertainty. A concise rationale is more useful than false precision:

| Threat | Likelihood | Impact | Priority | Planned control |
|---|---|---|---|---|
| Cross-tenant invoice access | High | High | Critical | Tenant-scoped queries and negative tests |
| Reset-token replay | Medium | High | High | Single-use short-lived token and session revocation |
| Admin export misuse | Medium | High | High | Step-up MFA, approval, scope limit, and audit |

### Mitigation Types

Controls can:

- **Prevent:** parameterized query, authorization policy, MFA.
- **Detect:** anomaly alert, tamper-resistant audit event.
- **Limit impact:** least privilege, tenant isolation, short token lifetime.
- **Recover:** revocation, backup restore, incident runbook.
- **Transfer or accept:** contractual protection or explicit risk acceptance.

Document an owner and verification method for each mitigation. "Use encryption" is not actionable without specifying what data, where, which keys, and how validation occurs.

### Turning Threats into Requirements

Threat:

```text
An attacker replays a password-reset token.
```

Security requirements:

- Reset tokens are single-use.
- Tokens expire after a short defined period.
- Tokens are bound to the intended account and operation.
- Successful reset invalidates the token.
- Existing sessions are revoked according to policy.
- The user receives a notification.
- Replay attempts are logged without storing the token.

Tests:

- Reusing a consumed token fails.
- Using a token for another account fails.
- Expired and modified tokens fail.
- A successful reset revokes required sessions.

Threat modeling is valuable when it creates work the team can implement and verify.

### Security Testing from the Model

Derive:

- Unit tests for policy and validation logic.
- Integration tests for authentication and authorization boundaries.
- Negative tests for cross-tenant and cross-role access.
- Abuse tests for rate limits and resource bounds.
- Static analysis and secret scanning.
- Dependency and container scanning.
- Infrastructure policy tests.
- Manual penetration-test scenarios.
- Incident-response exercises.

Maintain traceability between high-risk threats, controls, and tests so regressions are visible.

### Architecture Change Triggers

Review the threat model when:

- A new data type or high-value operation is added.
- Authentication or authorization changes.
- A public endpoint or webhook is introduced.
- A new third party receives data or tokens.
- Deployment moves across networks, clouds, or regions.
- An upload, parser, or command-processing feature is added.
- An administrator capability expands.
- A security incident invalidates an assumption.
- A control is removed, bypassed, or replaced.

Lightweight incremental review is usually more effective than recreating the entire model once a year.

### Team Workflow

A practical workshop can be:

1. Gather architecture, product, engineering, operations, and security perspectives.
2. Define scope, assets, actors, assumptions, and data classifications.
3. Draw data flows and trust boundaries.
4. Walk each entry point and privileged flow.
5. Use STRIDE and abuse cases to generate threats.
6. Record existing controls and gaps.
7. Rank risks.
8. Assign mitigation owners and target dates.
9. Create requirements, tests, telemetry, and runbook changes.
10. Review the model during design and architecture changes.

The goal is shared understanding and risk reduction, not a visually perfect diagram.

### Common Mistakes

Common failures include:

- Threat modeling only after implementation.
- Treating a checklist as the entire model.
- Omitting assets, business impact, and abuse goals.
- Trusting internal services or authenticated users automatically.
- Modeling only the happy-path login.
- Ignoring reset, recovery, linking, and factor-change flows.
- Treating all input as equivalent instead of tracing it to sinks.
- Hiding admin UI without server authorization.
- Using one broad administrator role.
- Recording mitigations without owners or tests.
- Ignoring operational controls and incident response.
- Never updating the model after architecture changes.

### Best-Practice Threat-Modeling Strategy

A useful threat model should:

1. Define assets, actors, objectives, scope, and assumptions.
2. Represent actual data and authority flows.
3. Mark every trust boundary.
4. Inventory public, internal, asynchronous, and administrative entry points.
5. Trace untrusted input to interpreters, data stores, and outputs.
6. Model the complete authentication and recovery lifecycle.
7. Treat privileged operations as explicit capabilities with constrained scope.
8. Use STRIDE plus business-specific abuse cases.
9. Rank risks using system context.
10. Convert mitigations into assigned requirements, tests, telemetry, and response procedures.
11. Revisit the model when the system or threat landscape changes.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is threat modeling?

<!-- question:start:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-beginner-q01 -->
<!-- question-id:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Threat modeling is a structured way to describe a system, identify valuable assets and trust boundaries, enumerate how attackers or failures could cause harm, prioritize the resulting risks, and choose controls. It should produce concrete security requirements, tests, monitoring, and ownership, and should be updated as architecture and assumptions change.

##### Key Points to Mention

- Start during design rather than after release.
- Include business abuse cases as well as technical threats.
- Risk depends on system context and impact.
- The output must be actionable and verifiable.

<!-- question:end:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-beginner-q01 -->

#### What is a trust boundary?

<!-- question:start:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-beginner-q02 -->
<!-- question-id:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A trust boundary is a point where data, identity, or control moves between contexts with different trust assumptions or security controls. Examples include the browser-to-API boundary, service-to-database boundary, tenant boundary, and user-to-admin control-plane boundary. Crossing it should trigger explicit validation, authentication, authorization, protection, or monitoring appropriate to the new context.

##### Key Points to Mention

- Internal networks are still trust boundaries.
- Boundaries reveal where assumptions change.
- Identity and authority must be propagated and revalidated safely.
- Data-flow diagrams make boundaries visible.

<!-- question:end:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-beginner-q02 -->

#### What does STRIDE stand for?

<!-- question:start:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-beginner-q03 -->
<!-- question-id:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

STRIDE stands for Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege. It is a prompt for examining components, stores, flows, and boundaries for common threat categories. It should be combined with business-specific abuse cases and domain knowledge rather than used as a complete security checklist.

##### Key Points to Mention

- Spoofing concerns identity.
- Tampering concerns integrity.
- Information disclosure concerns confidentiality.
- STRIDE aids discovery but does not rank risk by itself.

<!-- question:end:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-beginner-q03 -->

#### Why is client-side validation not a security control?

<!-- question:start:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-beginner-q04 -->
<!-- question-id:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

An attacker can bypass or modify the browser application and call the server directly. Client validation improves usability, but the server must enforce schemas, size limits, business rules, authentication, authorization, and safe handling for each destination. Output encoding and parameterized APIs are still required because valid business input can be dangerous in a particular interpreter context.

##### Key Points to Mention

- The client is outside the server's trust boundary.
- Server validation is authoritative.
- Validation and output encoding solve different problems.
- Trace input all the way to its sink.

<!-- question:end:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How would you threat-model an authentication flow?

<!-- question:start:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-intermediate-q01 -->
<!-- question-id:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Map registration, login, MFA, external-provider callbacks, session creation, renewal, logout, password reset, recovery, account linking, and factor replacement. For every transition, identify actors, tokens, redirect targets, trust boundaries, replay opportunities, assurance changes, and failure paths. Consider spoofing, enumeration, credential attacks, CSRF, token leakage, fixation, recovery bypass, stale claims, and session revocation, then derive controls and negative tests.

##### Key Points to Mention

- The alternate and recovery paths are part of authentication.
- Record token purpose, audience, lifetime, and one-time use.
- Rotate session state after assurance or privilege changes.
- Use maintained identity protocol libraries.

<!-- question:end:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-intermediate-q01 -->

#### How would you threat-model user input from source to sink?

<!-- question:start:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-intermediate-q02 -->
<!-- question-id:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Identify every source, schema, maximum size, canonical representation, business rule, authorization context, transformation, storage location, and final sink. Ask whether the value enters SQL, HTML, JavaScript, a URL, command, path, template, log, or parser. Apply allowlist validation, parameterized APIs, context-correct encoding, resource limits, and safe logging at the relevant stages, then test malformed, boundary, encoded, and unauthorized inputs.

##### Key Points to Mention

- Trust is not gained merely because data was stored in a database.
- Canonicalize before comparisons that depend on representation.
- Each interpreter context requires its own defense.
- Model asynchronous and administrative consumers too.

<!-- question:end:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-intermediate-q02 -->

#### How should admin-only operations be protected?

<!-- question:start:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-intermediate-q03 -->
<!-- question-id:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use server-side operation-level and resource-level authorization, least-privilege roles, phishing-resistant MFA, step-up authentication for sensitive actions, and narrow tenant and environment scope. Consider a separate control plane, just-in-time elevation, approval for destructive operations, strong audit records, rate limits, anomaly detection, and tested revocation. Hidden routes and disabled buttons are not controls.

##### Key Points to Mention

- Avoid one unrestricted `IsAdmin` bypass.
- Record both operator and affected resource.
- Support roles should be read-only unless modification is required.
- Administrative recovery and impersonation need special controls.

<!-- question:end:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-intermediate-q03 -->

#### How do you turn a threat model into engineering work?

<!-- question:start:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-intermediate-q04 -->
<!-- question-id:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

For each prioritized threat, document the attack path, affected asset, existing controls, residual risk, planned mitigation, owner, and due date. Rewrite mitigations as specific requirements and acceptance criteria, then create unit, integration, abuse, infrastructure, and operational tests. Add telemetry and response steps where prevention is incomplete, and link architecture changes to threat-model review.

##### Key Points to Mention

- Vague controls are difficult to implement and verify.
- Every mitigation needs an owner and verification method.
- Accepted risk should be explicit and time-bounded when appropriate.
- High-risk threats should remain traceable to tests.

<!-- question:end:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you threat-model a multi-tenant SaaS administrative control plane?

<!-- question:start:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-advanced-q01 -->
<!-- question-id:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Model operators, tenant administrators, service identities, support tools, CI/CD, identity providers, data stores, and audit systems. Mark boundaries between tenants, user and control planes, environments, and human and workload identities. Examine cross-tenant access, privilege elevation, impersonation, approval bypass, stale roles, session theft, malicious insiders, export abuse, audit tampering, secret compromise, and availability attacks. Mitigate with scoped policies, phishing-resistant MFA, just-in-time roles, resource checks, approvals, isolation, immutable audit, and rehearsed revocation.

##### Key Points to Mention

- Administrative authority is a high-value asset.
- Real operator identity must survive impersonation and delegation.
- Tenant and environment scope must be explicit in every operation.
- Break-glass access needs narrow use, monitoring, and review.

<!-- question:end:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-advanced-q01 -->

#### How should trust be handled between internal microservices?

<!-- question:start:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-advanced-q02 -->
<!-- question-id:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Treat every service boundary as a security boundary. Authenticate workload identity, authorize the calling service and delegated user context, validate message audience and purpose, protect transport, minimize network reachability, and apply least privilege to data and downstream APIs. Do not trust headers merely because a request came from the internal network. Preserve traceable identity, prevent confused-deputy behavior, rotate credentials, and model queues, retries, and asynchronous consumers separately.

##### Key Points to Mention

- Network location is not sufficient identity.
- Service permission and end-user permission may both be required.
- Audience-restricted tokens reduce credential reuse.
- Gateways do not eliminate service-level authorization.

<!-- question:end:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-advanced-q02 -->

#### How do you prioritize threats when evidence and estimates are uncertain?

<!-- question:start:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-advanced-q03 -->
<!-- question-id:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Use a consistent qualitative or quantitative method, state assumptions, and separate exploitability from business impact. Consider exposure, attacker capability, affected population, data sensitivity, existing controls, detectability, and recovery difficulty. Record ranges or confidence when evidence is weak, prioritize catastrophic or irreversible impact even when likelihood is uncertain, and schedule validation work to reduce the most decision-relevant uncertainty.

##### Key Points to Mention

- Risk scores should support judgment, not replace it.
- Document rationale and confidence.
- Compare residual risk after existing controls.
- Reassess when incidents or architecture changes invalidate assumptions.

<!-- question:end:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-advanced-q03 -->

#### How would you keep threat models useful over the lifetime of a system?

<!-- question:start:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-advanced-q04 -->
<!-- question-id:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Keep diagrams and threat records close to architecture documentation, assign ownership, and integrate review into design proposals and high-risk changes. Link major threats to backlog items, tests, alerts, and runbooks; automate verification of stable controls where possible; and perform lightweight incremental updates rather than infrequent rewrites. Use incidents, penetration tests, dependency changes, and production telemetry to challenge assumptions and reprioritize residual risks.

##### Key Points to Mention

- Define explicit change triggers.
- Track mitigations and accepted risks to owners.
- Remove obsolete assumptions and components.
- Measure whether controls operate in production, not only whether they were designed.

<!-- question:end:threat-modeling-user-input-trust-boundaries-authentication-flows-and-admin-only-operations-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
