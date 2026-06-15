---
id: microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics
topic: Identity, secrets, and access control
subtopic: Microsoft Entra app registrations, scopes, and auth-code flow basics
category: Azure
---

## Overview

Microsoft Entra ID is Microsoft's cloud identity provider. Applications integrate with it to authenticate users, obtain tokens, and call protected APIs. An app registration defines how an application participates in that identity system, including:

- Which tenant accounts can sign in.
- Which redirect URIs can receive authentication responses.
- Whether the application is a public or confidential client.
- Which delegated permissions or application permissions it requests.
- Which scopes and app roles its own API exposes.
- Which credentials a confidential client can use.

The OAuth 2.0 authorization code flow is the standard interactive flow for web applications, single-page applications, desktop applications, and mobile applications. OpenID Connect adds authentication to the flow so that the client can learn who signed in. Proof Key for Code Exchange, or PKCE, protects the authorization code from interception and should be used for all application types that support it. It is required for single-page applications.

These concepts matter in interviews because identity designs frequently fail at the boundaries between authentication, delegated authorization, application authorization, and business authorization. A strong candidate should be able to explain:

- The relationship between an app registration, application object, and service principal.
- The difference between an ID token and an access token.
- The difference between delegated scopes and application permissions.
- How consent grants a client permission to call a resource API.
- How the authorization code flow and PKCE work.
- Why redirect URIs, token audiences, issuers, and signatures must be validated.
- Why an API must enforce scopes or roles instead of trusting the client application.
- When separate registrations are appropriate for a browser client, server application, and API.

## Core Concepts

### App Registration, Application Object, and Service Principal

Registering an application creates an identity configuration in a Microsoft Entra tenant.

The main objects are:

- **Application object:** The definition or blueprint of the application in its home tenant. It stores settings such as supported account types, redirect URIs, exposed scopes, app roles, and configured API permissions.
- **Service principal:** The application's local security identity in a tenant. Permissions, consent grants, assignments, and tenant-specific access are associated with service principals.
- **Application or client ID:** A public identifier for the application definition. It is not a secret.
- **Directory or tenant ID:** Identifies a Microsoft Entra tenant.
- **Object ID:** Identifies a specific directory object. An application object and its service principal have different object IDs.

In the home tenant, registering through the portal normally creates both an application object and a service principal. For a multitenant application, each customer tenant gets its own service principal when the application is accepted or consented to there.

The **App registrations** area is primarily used to manage application objects. The **Enterprise applications** area is primarily used to manage service principals and tenant-specific access.

### Supported Account Types and Tenant Endpoints

An app registration defines who can use the application:

- Accounts in one organizational tenant.
- Accounts in any Microsoft Entra organizational tenant.
- Organizational accounts and personal Microsoft accounts.
- Personal Microsoft accounts only.

Single-tenant applications are simpler to govern and should be the default for internal business applications. Multitenant applications are appropriate for software-as-a-service products used by customer organizations, but they require:

- Tenant onboarding and consent handling.
- Issuer and tenant validation.
- Per-tenant authorization and data isolation.
- Publisher verification and trustworthy consent descriptions.
- A plan for tenant administrators to revoke access.

Common authority values include a specific tenant ID, `organizations`, `consumers`, and `common`. An API must not weaken issuer validation merely because the client signs in through a multitenant endpoint.

### OAuth 2.0 and OpenID Connect

OAuth 2.0 is an authorization framework. It allows a client to obtain an access token for a protected resource.

OpenID Connect, or OIDC, is an identity layer on top of OAuth 2.0. It adds:

- The `openid` scope.
- ID tokens.
- User identity claims.
- Discovery metadata and user information behavior.

The practical distinction is:

- Use an **ID token** to establish the user's authenticated session in the client application.
- Use an **access token** to call the API for which the token was issued.

An application must not send an ID token to an API as an access token. It must also not inspect a token intended for another API and treat its claims as authorization for itself.

### ID Tokens, Access Tokens, and Refresh Tokens

An **ID token** describes an authentication event and the signed-in subject. Common claims include:

- `iss`: Token issuer.
- `aud`: Intended client application.
- `sub`: Subject identifier within the issuer and client context.
- `tid`: Tenant identifier for organizational accounts.
- `oid`: Directory object identifier when available.
- `nonce`: Correlates the token with the authentication request.

An **access token** authorizes calls to a resource API. Important claims commonly include:

- `aud`: The intended API.
- `iss`: The issuer.
- `scp`: Space-separated delegated scopes.
- `roles`: Application permissions or assigned app roles.
- `tid`, `oid`, and other identity context.

A **refresh token** allows a client library to request new access tokens without repeating a full interactive sign-in. Applications should let MSAL or another supported identity library manage refresh tokens and token caching rather than storing or exchanging them manually.

Tokens are bearer credentials. Anyone who can use a valid token can act with its authority, so applications must avoid logging or exposing them.

### Delegated Permissions and Scopes

Delegated access means:

1. A user signs in to a client application.
2. The client obtains an access token for an API.
3. The client calls the API on behalf of that user.

Delegated permissions are represented as **scopes**. The API defines scopes such as:

```text
api://orders-api-client-id/Orders.Read
api://orders-api-client-id/Orders.Write
```

The access token normally carries granted delegated scopes in the `scp` claim.

A delegated scope does not grant the user permissions they do not already have. Effective authorization is the intersection of:

- What the client has been granted.
- What the signed-in user is allowed to do.
- What the API's domain authorization rules permit for the requested resource.

For example, `Orders.Read` might allow the application to call a read endpoint, but the API must still check whether the signed-in user can access the requested customer account.

### Application Permissions and App Roles

Application permissions are used when an application acts without a signed-in user, such as a daemon, scheduled job, or service-to-service process. They are modeled as app roles allowed for applications.

In an app-only access token:

- There is no user delegation context.
- Granted application permissions normally appear in the `roles` claim.
- Administrator consent is required.
- The application may receive broad access, so least privilege is especially important.

Delegated scopes and application permissions are not interchangeable:

| Concern | Delegated permission | Application permission |
| --- | --- | --- |
| User present | Yes | No |
| Token claim | `scp` | `roles` |
| Effective authority | Client grant plus user authority | Application's own authority |
| Typical flow | Authorization code | Client credentials |
| Consent | User or administrator, depending on policy | Administrator |

An API endpoint that supports both models should explicitly define what each model is allowed to do.

### Exposing an API

An API app registration can define an Application ID URI, commonly:

```text
api://<api-client-id>
```

It can then expose:

- Delegated scopes for user-present calls.
- App roles for application-only calls or user/group assignments.
- Authorized client applications for selected preauthorized scenarios.

Scope names should describe stable capabilities rather than UI pages. Examples include:

```text
Orders.Read
Orders.Write
Orders.Approve
```

The API must validate the token and enforce the expected scope or role:

```csharp
[Authorize]
[RequiredScope("Orders.Read")]
[HttpGet("{orderId}")]
public async Task<ActionResult<OrderDto>> GetOrder(string orderId)
{
    var userObjectId = User.FindFirstValue("oid");
    var order = await orders.GetAuthorizedAsync(orderId, userObjectId);

    return order is null ? NotFound() : Ok(order);
}
```

The scope check controls API capability. `GetAuthorizedAsync` still performs object-level authorization.

### Consent

Consent creates a grant between a client application and a resource API.

Important forms include:

- **User consent:** A user grants permitted delegated access for their own use.
- **Administrator consent:** An administrator grants access for the organization or approves permissions that users cannot grant.
- **Static consent:** Permissions are configured on the client registration.
- **Dynamic consent:** Delegated scopes are requested incrementally at runtime.
- **Preauthorization:** A trusted client is configured so users are not prompted for selected custom API scopes.

Application permissions and high-privilege delegated permissions require administrator consent. Tenant policies can also restrict user consent.

Consent is not the same as application authorization. Consent allows the client to request tokens containing a permission. The API must still validate the token and make authorization decisions for every request.

Best practices include:

- Request only necessary permissions.
- Use meaningful consent display names and descriptions.
- Prefer incremental consent when it improves clarity.
- Avoid combining unrelated permissions in one application.
- Review and remove unused grants.
- Treat organization-wide admin consent as a high-impact security decision.

### Authorization Code Flow

At a high level, the flow is:

1. The client generates a random PKCE code verifier and derives a code challenge.
2. The client redirects the browser to the authorization endpoint.
3. The request includes the client ID, redirect URI, scopes, `state`, code challenge, and response type `code`.
4. Microsoft Entra authenticates the user and obtains consent when required.
5. Microsoft Entra redirects to the registered redirect URI with a short-lived authorization code and the original `state`.
6. The client verifies `state`.
7. The client sends the code, redirect URI, and PKCE verifier to the token endpoint.
8. A confidential server-side client also authenticates itself with a certificate, federated credential, or secret.
9. The token endpoint returns tokens.
10. The client library caches tokens and obtains replacements when required.

The authorization code is not an access token. It is short-lived, single-use, bound to the client and redirect URI, and protected by PKCE.

### PKCE, State, and Nonce

These values solve different problems:

- **PKCE code verifier and challenge:** Protect the authorization code from being redeemed by an attacker who intercepts it.
- **`state`:** Correlates the response to the initiating browser session and helps prevent login CSRF and response mix-up.
- **`nonce`:** Binds an ID token to an OIDC authentication request and helps detect token replay.

They are not substitutes for one another. Each value should be cryptographically random, validated, and associated with the correct browser transaction.

Do not put sensitive data or an unrestricted return URL directly in `state`. Store server-side state or use a protected reference and validate any post-login destination against an allowlist.

### Public and Confidential Clients

A **public client** cannot safely hold a credential. Examples include:

- Browser-based single-page applications.
- Desktop applications.
- Mobile applications.

Public clients use authorization code flow with PKCE and must not contain client secrets.

A **confidential client** runs in a trusted server environment and can authenticate itself. Examples include:

- Server-rendered web applications.
- Backend services.
- Daemons.

Prefer certificates, managed identity federation, or other stronger credential options over long-lived client secrets where supported. Never send a server credential to browser code.

### Redirect URI Security

The redirect URI in the authorization request must match a registered URI. The platform type matters:

- Web redirects are handled by a confidential server application.
- SPA redirects support browser-based code redemption with CORS and PKCE.
- Mobile and desktop applications use public-client redirect patterns.

Security rules include:

- Register exact production URLs.
- Use HTTPS outside approved local development cases.
- Do not use wildcard redirects.
- Remove stale development and preview URLs.
- Separate production registrations when operational isolation requires it.
- Do not reuse an SPA redirect type for a confidential server flow.

An open redirect on an allowed callback or return path can undermine an otherwise correct identity configuration.

### Using Supported Libraries

Applications should use MSAL, Microsoft.Identity.Web, or the appropriate supported framework integration rather than implementing protocol requests manually.

A server-rendered ASP.NET Core application can configure OIDC and downstream token acquisition:

```csharp
builder.Services
    .AddAuthentication(OpenIdConnectDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApp(
        builder.Configuration.GetSection("AzureAd"))
    .EnableTokenAcquisitionToCallDownstreamApi(
        new[] { "api://orders-api-client-id/Orders.Read" })
    .AddInMemoryTokenCaches();
```

Production applications with multiple instances need an appropriate protected distributed token cache. An in-memory cache is process-local and can cause repeated authentication or lost token state after restarts.

Libraries handle:

- OIDC metadata discovery.
- Correlation and nonce cookies.
- PKCE.
- Code redemption.
- Token caching.
- Refresh behavior.
- Protocol error handling.

The application remains responsible for secure configuration, authorization, session protection, and correct token validation.

### API Token Validation

An API should validate at least:

- Signature against trusted issuer keys.
- Issuer.
- Audience.
- Lifetime.
- Expected token version and tenant policy.

After authentication, it should authorize using:

- `scp` for delegated permissions.
- `roles` for app-only permissions or app-role assignments.
- Tenant allowlists for restricted multitenant APIs.
- Object-level and business rules from the domain.

A client ID claim can identify the calling application, but allowing a client application does not replace checking scopes, roles, users, or resources.

### SPA, Web App, API, and BFF Registrations

Separate app registrations are often useful when components have different security boundaries:

- An SPA is a public client and uses a SPA redirect URI.
- A server web app or backend-for-frontend is a confidential client.
- A protected API is a resource that exposes scopes and app roles.
- A background processor may use application permissions or managed identity.

Combining every component into one registration can blur ownership, consent, token audiences, credentials, and incident response.

A browser application that calls an API directly holds access tokens in the browser. A backend-for-frontend can instead keep tokens server-side and give the browser an HTTP-only session cookie. The BFF reduces browser token exposure but adds server state, CSRF controls, and operational complexity.

### Common Mistakes

- Using an ID token to call an API.
- Accepting any correctly signed token without checking audience and issuer.
- Authorizing only by client-side UI state.
- Checking a scope but skipping object-level authorization.
- Putting a client secret in an SPA or mobile application.
- Requesting broad permissions for convenience.
- Confusing configured permissions with granted consent.
- Assuming delegated permission overrides the user's own restrictions.
- Using `common` without a deliberate multitenant validation strategy.
- Logging access tokens, authorization codes, or client credentials.
- Implementing token refresh manually instead of using a supported library.
- Treating authentication as proof that a user can perform every operation.

### Interview Design Checklist

When discussing a design, clarify:

1. Who or what is the caller?
2. Is a user present?
3. Which application is the client?
4. Which application is the resource API?
5. What audience should the access token contain?
6. Which delegated scope or app role represents the operation?
7. Who can grant consent?
8. Which tenant issuers are accepted?
9. Where are tokens and server credentials stored?
10. What domain authorization is required after token validation?

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What does a Microsoft Entra app registration represent?

<!-- question:start:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-beginner-q01 -->
<!-- question-id:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

An app registration defines how an application integrates with Microsoft Entra ID. It creates an application object containing settings such as client ID, supported account types, redirect URIs, exposed scopes, app roles, and requested API permissions. A service principal represents that application within a tenant and is where tenant-specific permissions and assignments are applied.

##### Key Points to Mention

- The client ID is an identifier, not a credential.
- Application objects and service principals have different object IDs.
- App registrations manage definitions; enterprise applications manage tenant instances.
- A multitenant app has a service principal in each tenant where it is used.

<!-- question:end:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-beginner-q01 -->

#### What is the difference between an ID token and an access token?

<!-- question:start:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-beginner-q02 -->
<!-- question-id:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

An ID token is an OpenID Connect token for the client application and describes the user's authentication. An access token is an OAuth token for a resource API and authorizes calls to that API. The API should validate an access token whose audience identifies the API; it should not accept an ID token or a token intended for another resource.

##### Key Points to Mention

- ID tokens establish client sessions.
- Access tokens authorize API calls.
- The `aud` claim identifies the intended recipient.
- Tokens are bearer credentials and must be protected.

<!-- question:end:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-beginner-q02 -->

#### What is a delegated scope?

<!-- question:start:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-beginner-q03 -->
<!-- question-id:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A delegated scope is a permission that lets a client call an API on behalf of a signed-in user. Granted scopes normally appear in the access token's `scp` claim. The client grant does not give the user new authority; the API must consider the scope, the user's permissions, and its own resource-level authorization rules.

##### Key Points to Mention

- Delegated access requires a user.
- Scopes are defined by the resource API.
- The `scp` claim is used for delegated tokens.
- Scope checks do not replace object-level authorization.

<!-- question:end:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-beginner-q03 -->

#### What are the main steps in the authorization code flow?

<!-- question:start:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-beginner-q04 -->
<!-- question-id:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

The client redirects the user to Microsoft Entra with its client ID, redirect URI, requested scopes, state, and PKCE challenge. After sign-in and consent, Entra returns a short-lived authorization code to the registered redirect URI. The client verifies state and redeems the code at the token endpoint using the PKCE verifier. A confidential client also authenticates itself. The identity library then caches the resulting tokens.

##### Key Points to Mention

- The browser carries the authorization response.
- The code is not an access token.
- PKCE protects code redemption.
- Supported libraries should implement the protocol.

<!-- question:end:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How do PKCE, state, and nonce differ?

<!-- question:start:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-intermediate-q01 -->
<!-- question-id:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

PKCE binds authorization-code redemption to the client instance that initiated the flow. `state` correlates the callback with the browser transaction and helps prevent login CSRF and response mix-up. `nonce` binds an ID token to the OIDC authentication request and helps prevent token replay. They address different attacks and should all be generated and validated as required.

##### Key Points to Mention

- Use the `S256` PKCE challenge method.
- PKCE is required for SPAs and recommended broadly.
- State should not contain unprotected sensitive data.
- Nonce applies to ID-token issuance.

<!-- question:end:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-intermediate-q01 -->

#### What is the difference between delegated and application permissions?

<!-- question:start:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-intermediate-q02 -->
<!-- question-id:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Delegated permissions authorize a client to act on behalf of a signed-in user and are represented by scopes in the `scp` claim. Application permissions authorize an application to act as itself without a user and are represented by app roles in the `roles` claim. Application permissions require administrator consent and often have a larger blast radius.

##### Key Points to Mention

- Authorization code flow commonly produces delegated tokens.
- Client credentials commonly produces app-only tokens.
- A delegated app cannot exceed the user's authority.
- An API may need separate policies for both access models.

<!-- question:end:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-intermediate-q02 -->

#### Why must redirect URIs be registered precisely?

<!-- question:start:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-intermediate-q03 -->
<!-- question-id:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

The redirect URI determines where Microsoft Entra sends authorization responses. Exact registration prevents an attacker from changing the callback to a site they control. The platform type also determines whether the redirect is used by an SPA, confidential web app, or native client. Applications should use HTTPS in production, avoid wildcards, remove stale callbacks, and prevent open redirects after login.

##### Key Points to Mention

- The token request must use the same redirect URI as the authorization request.
- SPA redirect types support browser code redemption.
- Client secrets must never be used from browser code.
- Callback security includes validating the post-login destination.

<!-- question:end:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-intermediate-q03 -->

#### What does consent do, and what does it not do?

<!-- question:start:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-intermediate-q04 -->
<!-- question-id:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Consent grants a client permission to request access to a resource API. User consent can grant allowed delegated permissions for the user, while administrator consent can grant organization-wide delegated access or application permissions. Consent does not authorize every API operation automatically. The API must still validate the token and apply scope, role, tenant, user, and resource-level rules.

##### Key Points to Mention

- Configuring a permission is different from granting it.
- Tenant policy can restrict user consent.
- Application permissions require administrator consent.
- Least privilege and periodic grant review are essential.

<!-- question:end:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you structure app registrations for an SPA and a protected API?

<!-- question:start:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-advanced-q01 -->
<!-- question-id:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Use a public-client registration for the SPA with SPA redirect URIs and authorization code flow with PKCE. Use a separate resource registration for the API that exposes delegated scopes and, if needed, application roles. Configure the SPA to request only required scopes. The API validates its own audience and issuer, enforces `scp`, and applies domain authorization. A BFF is an alternative when tokens should remain server-side.

##### Key Points to Mention

- Separate registrations make security boundaries explicit.
- Never place a confidential-client credential in the SPA.
- The API owns authorization enforcement.
- A BFF trades browser token exposure for server state and CSRF controls.

<!-- question:end:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-advanced-q01 -->

#### How should a multitenant API validate access tokens?

<!-- question:start:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-advanced-q02 -->
<!-- question-id:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

The API should validate signature, audience, lifetime, and an issuer that is valid for the token's tenant. It should decide which tenants are allowed, bind tenant context to data isolation, and reject unprovisioned tenants. It must then enforce delegated scopes or application roles and perform user or workload authorization within that tenant. Disabling issuer validation is not a valid multitenant strategy.

##### Key Points to Mention

- A service principal exists in each consenting tenant.
- Tenant onboarding should be explicit for controlled SaaS systems.
- Tenant ID must participate in data-partition authorization.
- Consent does not prove that the tenant has a valid business subscription.

<!-- question:end:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-advanced-q02 -->

#### How should tokens and confidential-client credentials be managed in production?

<!-- question:start:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-advanced-q03 -->
<!-- question-id:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Use a supported identity library and a protected token cache appropriate for the application's scale model. Do not log tokens or persist them in application-readable plaintext. Public clients use PKCE without a secret. Confidential clients should prefer certificates, workload identity federation, or managed identity-backed approaches over long-lived secrets where possible. Credentials require rotation, restricted access, monitoring, and environment separation.

##### Key Points to Mention

- In-memory token caches are process-local.
- Refresh tokens should be library-managed.
- Browser storage increases token-exfiltration risk.
- Credential choice does not replace least-privilege permissions.

<!-- question:end:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-advanced-q03 -->

#### How would you diagnose an API that returns 401 for some calls and 403 for others?

<!-- question:start:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-advanced-q04 -->
<!-- question-id:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

A 401 normally indicates authentication failure: missing token, invalid signature, wrong issuer, wrong audience, expired token, or invalid bearer-token configuration. A 403 normally indicates that authentication succeeded but authorization failed: missing scope or role, disallowed tenant, insufficient user authority, or failed object-level policy. Inspect safe token metadata and server diagnostics without logging the raw token, and verify which resource and permission the client requested.

##### Key Points to Mention

- Confirm the access token audience matches the API.
- Check `scp` for delegated calls and `roles` for app-only calls.
- Distinguish consent problems from API business authorization.
- Return consistent challenge and forbidden responses without leaking sensitive details.

<!-- question:end:microsoft-entra-app-registrations-scopes-and-auth-code-flow-basics-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
