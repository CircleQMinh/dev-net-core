---
id: system-assigned-and-user-assigned-managed-identities
topic: Identity, secrets, and access control
subtopic: System-assigned and user-assigned managed identities
category: Azure
---

## Overview

Managed identities give supported Azure resources an identity in Microsoft Entra ID without requiring application code or operators to manage a password, client secret, or certificate. Code running on the Azure resource requests an access token from the managed identity infrastructure and presents that token to a target service that supports Microsoft Entra authentication.

Managed identities solve credential management, not authorization. A complete design still requires:

1. Enabling or assigning an identity to the source compute resource.
2. Granting that identity the minimum required permission on the target resource.
3. Configuring the application or service connector to request a token for the target.
4. Validating operational behavior, audit logs, deployment ordering, and permission propagation.

Azure supports two managed identity types:

- **System-assigned managed identity:** Created on and tied to one Azure resource.
- **User-assigned managed identity:** Created as a standalone Azure resource and assignable to one or more supported resources.

The distinction affects lifecycle, sharing, deployment ordering, audit granularity, and blast radius. Current Microsoft guidance recommends user-assigned identities for a broad range of scenarios because they can be provisioned and authorized independently, but system-assigned identities remain a strong choice when one resource needs a unique identity whose lifecycle should end with that resource.

This topic matters in interviews because "use managed identity" is not a complete security design. Candidates should be able to explain:

- How both identity types are represented and used.
- How token acquisition differs from role assignment.
- How Azure RBAC and service-specific data-plane permissions work.
- How .NET applications use `Azure.Identity`.
- How local development differs from Azure-hosted execution.
- Why shared user-assigned identities can reduce administration but increase blast radius.
- How to select an identity explicitly when several are attached.
- How deletion, recreation, deployment slots, caching, and propagation affect operations.

## Core Concepts

### What a Managed Identity Is

A managed identity is a Microsoft Entra workload identity managed by Azure. Enabling one creates a special service principal in the tenant.

Applications can use it to authenticate to services such as:

- Azure Key Vault.
- Azure Storage.
- Azure Service Bus.
- Azure SQL Database.
- Azure Cosmos DB.
- Azure App Configuration.
- Custom APIs protected by Microsoft Entra ID.

The target service must support Microsoft Entra authentication for the required operation. A managed identity cannot replace a storage key or connection string when the target feature does not support token-based authentication.

Managed identity credentials are not exposed to the application. The platform provides a local token endpoint or equivalent integration that can issue tokens only in the supported hosting environment.

### System-Assigned Managed Identity

A system-assigned identity is enabled directly on a resource such as an App Service app, Function App, virtual machine, or another supported Azure service.

Its characteristics are:

- Created with or enabled on the resource.
- Usable only by that resource.
- Named in relation to the parent resource.
- Deleted when the parent resource is deleted.
- Cannot be shared with another resource.
- Suitable for resource-specific permissions and attribution.

This lifecycle is convenient but has consequences. Deleting and recreating the Azure resource creates a new service principal with a new object ID. Existing role assignments that referenced the old identity do not automatically transfer.

System-assigned identities are a good fit when:

- One workload runs on one Azure resource.
- Permissions should be unique to that resource.
- Audit logs should distinguish individual resources.
- Identity cleanup should follow resource cleanup.
- Sharing an identity would unnecessarily broaden access.

### User-Assigned Managed Identity

A user-assigned identity is a standalone Azure resource. It is created separately and then associated with one or more supported source resources.

Its characteristics are:

- Independent lifecycle.
- Stable identity across source-resource replacement.
- Reusable by multiple resources.
- Preprovisionable and preauthorizable.
- Explicitly selected when multiple identities are present.
- Manually removed when no longer required.

User-assigned identities are useful when:

- Multiple instances perform the same function and need the same permissions.
- Blue-green, slot, or ephemeral deployments need a stable identity.
- Identity and application-resource provisioning are owned by different teams.
- Role assignments must exist before compute resources are deployed.
- Rapid resource creation could cause identity-creation throttling or replication delays.
- A workload needs to move between supported hosting services.

Every resource using a shared identity receives all permissions granted to that identity. Sharing should therefore represent a real workload boundary, not merely administrative convenience.

### Side-by-Side Comparison

| Concern | System-assigned | User-assigned |
| --- | --- | --- |
| Created | On the Azure resource | As a separate Azure resource |
| Lifecycle | Tied to one resource | Independent |
| Sharing | One source resource only | One or more source resources |
| Preauthorization | Difficult before source creation | Can be configured in advance |
| Resource recreation | Produces a new identity | Identity can remain stable |
| Cleanup | Identity deleted with parent | Must be explicitly deleted |
| Audit granularity | Naturally resource-specific | Actions identify the shared identity |
| Typical fit | Unique per-resource authority | Shared or stable workload authority |

The correct decision is based on permission boundaries and lifecycle, not on which option takes fewer portal clicks.

### Authentication Versus Authorization

Attaching a managed identity lets the workload authenticate as that identity. It does not grant access to anything.

Authorization is configured separately on the target resource using mechanisms such as:

- Azure RBAC roles.
- Azure service-specific data-plane roles.
- Key Vault access policies in legacy configurations.
- Database users and database permissions.
- App-role assignments for a custom Microsoft Entra-protected API.

For example, `Reader` at the subscription management plane does not grant permission to read blob contents. Blob access requires an appropriate data-plane role such as `Storage Blob Data Reader` at the narrowest useful scope.

Always distinguish:

- **Source resource:** Where application code runs and obtains a token.
- **Identity:** The security principal used by the code.
- **Target resource:** The service receiving the token.
- **Role scope:** The resource hierarchy level at which authorization is granted.

### Token Acquisition

The application asks for a token for a target resource. Azure handles authentication of the managed identity and token issuance.

With an Azure SDK client, token acquisition is usually implicit:

```csharp
TokenCredential credential = new DefaultAzureCredential();

var client = new SecretClient(
    new Uri(configuration["KeyVaultUri"]!),
    credential);

KeyVaultSecret secret = await client.GetSecretAsync("PaymentApiKey");
```

`DefaultAzureCredential` is convenient because:

- Locally, it can use a developer identity from supported tools.
- In Azure, it can use managed identity.

For production, an explicit credential can improve predictability and reduce unnecessary credential-chain attempts:

```csharp
TokenCredential credential = new ManagedIdentityCredential();

var client = new BlobServiceClient(
    new Uri(configuration["StorageServiceUri"]!),
    credential);
```

The Azure SDK caches tokens. Application code should reuse thread-safe service clients rather than constructing a new credential and client for every operation.

### Selecting a User-Assigned Identity

A resource can have multiple user-assigned identities and may also have a system-assigned identity. The application must select the intended identity when the environment is ambiguous.

A user-assigned identity is commonly selected by client ID:

```csharp
var credential = new ManagedIdentityCredential(
    clientId: configuration["ManagedIdentityClientId"]);

var client = new ServiceBusClient(
    configuration["ServiceBusNamespace"]!,
    credential);
```

The client ID identifies the user-assigned managed identity. The principal or object ID is commonly used for role assignments. The Azure resource ID can also be useful in infrastructure configuration. These identifiers are not interchangeable.

In applications that use `DefaultAzureCredential`, configure the user-assigned managed identity client ID through supported credential options or environment configuration. Do not rely on whichever identity the platform happens to choose.

### Local Development

The managed identity endpoint exists in the Azure hosting environment, not on a developer laptop.

For local development, `DefaultAzureCredential` can authenticate using a developer identity from Azure CLI, Azure Developer CLI, Visual Studio, or another supported source. This creates an important distinction:

- Local calls run with the developer's permissions.
- Deployed calls run with the workload identity's permissions.

Local success does not prove the managed identity is configured correctly. A developer may have broader access than production.

Recommended practices include:

- Test the deployed identity in a nonproduction Azure environment.
- Grant developers separate least-privilege roles.
- Avoid client-secret fallback in source-controlled settings.
- Log the selected credential type and nonsecret identity metadata when useful.
- Use integration tests that exercise actual target-service authorization.

### Azure RBAC Scope and Least Privilege

Role assignments combine:

- A principal.
- A role definition.
- A scope.

Prefer the narrowest scope that supports the workload:

```text
subscription
  resource group
    storage account
      container, when supported by the authorization model
```

Avoid broad roles such as subscription `Contributor` when the workload only needs to read secrets or publish messages. Management-plane contributor roles often do not represent the required data-plane action and also grant unnecessary resource-management authority.

Examples of more focused roles include:

- `Key Vault Secrets User`.
- `Storage Blob Data Reader`.
- `Storage Blob Data Contributor`.
- `Azure Service Bus Data Sender`.
- `Azure Service Bus Data Receiver`.

Use built-in roles when they fit. Create custom roles only when the permission set is well understood and a built-in role is materially too broad.

### Shared Identity Trade-Offs

Sharing a user-assigned identity can:

- Reduce the number of identities and role assignments.
- Simplify preauthorization.
- Provide stable permissions across replacements.
- Avoid repeated Microsoft Entra object creation.

It can also:

- Increase blast radius.
- Make it harder to identify which resource performed an action.
- Couple deployments through a shared permission set.
- Allow every attached resource to use every permission on the identity.
- Increase the impact of permission changes.

A useful rule is to share an identity among replicas of the same workload with the same trust boundary, not among unrelated applications.

### Permissions to Attach an Identity

Attaching a user-assigned identity to a compute resource is a privileged operation. Anyone who can run code on a resource with that identity can use its permissions. Anyone who can attach the identity to another resource may also be able to exercise its authority.

Govern:

- Who can assign user-assigned identities.
- Who can deploy or modify code on source resources.
- Who can grant roles to the identity.
- Which subscriptions and resource groups can contain source and target resources.
- How assignment and role changes are audited.

Separation of duties is useful only if the roles are designed so that one actor cannot trivially bypass it.

### Lifecycle and Deployment Ordering

Infrastructure deployment often follows this order:

1. Create the identity.
2. Create the target resource.
3. Assign the required target role to the identity.
4. Create or configure the source resource.
5. Attach the identity to the source.
6. Deploy application code and configuration.
7. Verify token acquisition and target access.

User-assigned identities support this sequence cleanly because they exist before the source resource.

With a system-assigned identity, the source must exist before its principal ID is available for a role assignment. Infrastructure as code must model that dependency.

Role assignments and directory objects can take time to propagate. Deployment tests should use bounded retries for expected propagation delays rather than immediately replacing credentials or widening permissions.

### Deletion and Orphaned Role Assignments

Deleting a system-assigned identity with its parent or deleting a user-assigned identity does not guarantee that every role assignment is immediately cleaned up.

Operational processes should:

- Remove obsolete role assignments.
- Delete unused user-assigned identities.
- Detect role assignments whose principal no longer exists.
- Review identity-to-resource associations.
- Keep infrastructure state authoritative.

Recreating a resource or identity with the same name does not restore the old object ID or its grants.

### Token and Authorization Caching

Token acquisition and authorization changes are not necessarily instantaneous:

- Azure SDKs cache access tokens until refresh is needed.
- Managed identity infrastructure caches tokens.
- Microsoft Entra objects and Azure RBAC assignments require propagation.
- Group or app-role membership changes may not appear until a new token is issued.

Managed identity group and role membership can have especially long cache behavior in the platform. When rapid permission changes are operationally important, prefer assigning access directly to a well-designed user-assigned identity rather than frequently changing group membership.

Do not respond to a propagation delay by adding broad permanent permissions.

### Deployment Slots and Environment Isolation

Slots and environments should be treated as separate security principals unless a stable shared workload identity is deliberate.

Consider:

- A system-assigned identity for a deployment slot is distinct from the production slot identity.
- Swapping content does not mean identity permissions should silently swap.
- A shared user-assigned identity can provide stable access across slots, but both slots then hold the same authority.
- Development, test, and production should not usually share one identity.

Environment-specific identities reduce cross-environment access and make incident response clearer.

### Custom APIs and Managed Identities

A managed identity can call a custom API protected by Microsoft Entra ID:

1. The API exposes an app role for application callers.
2. The role is assigned to the managed identity's service principal.
3. The workload requests a token for the API's audience.
4. The API validates the token and checks the `roles` claim.

The API should also restrict tenants and apply business authorization. Merely seeing that the caller is a managed identity is not sufficient.

### Managed Identity as a Federated Credential

In advanced scenarios, a managed identity can act as a federated credential for an application registration. The workload first proves its managed identity, then exchanges that assertion for a token as the application.

This can support credential-free access when a separate application registration is required. It introduces another trust relationship and should be used deliberately rather than as the default for ordinary Azure-service access.

### Observability and Troubleshooting

Useful troubleshooting sequence:

1. Confirm the source service supports the selected identity type.
2. Confirm the identity is enabled or attached.
3. Confirm code selected the intended identity.
4. Confirm the token audience matches the target service.
5. Confirm the target supports Microsoft Entra authentication for the operation.
6. Confirm the correct data-plane role exists at the correct scope.
7. Account for propagation and token caching.
8. Inspect Azure Activity Logs, Microsoft Entra sign-in logs, and target-service diagnostics.

Common failure categories are:

- **Credential unavailable:** No supported identity endpoint or the requested identity is not attached.
- **Authentication failed:** Token acquisition, tenant, endpoint, or platform configuration problem.
- **403 forbidden:** Token is valid, but the identity lacks the correct target permission.
- **Wrong resource access:** Role assigned at the wrong scope or wrong identity selected.

Log identity client or principal identifiers where safe, target host, operation category, and correlation IDs. Never log raw access tokens.

### Common Mistakes

- Assuming managed identity grants automatic access.
- Assigning a management-plane role when a data-plane role is required.
- Granting broad subscription roles for convenience.
- Sharing one user-assigned identity across unrelated workloads.
- Failing to select an identity when several are attached.
- Treating local developer authentication as proof of Azure configuration.
- Recreating a system-assigned resource without rebuilding role assignments.
- Ignoring propagation and token caches during deployment.
- Giving users permission to attach a highly privileged identity broadly.
- Creating a new credential or SDK client for every request.
- Keeping unused user-assigned identities and orphaned grants.
- Falling back to connection strings even though the target supports Microsoft Entra authentication.

### Interview Decision Framework

Choose a system-assigned identity when:

- The identity belongs to exactly one resource.
- Permissions should be isolated per resource.
- Lifecycle cleanup should follow the resource.
- Per-resource audit attribution matters.

Choose a user-assigned identity when:

- The identity must survive resource replacement.
- Several replicas share one workload boundary.
- Role assignments must be created in advance.
- Identity administration is separate from compute administration.
- Ephemeral resources would otherwise create many directory objects.

Then evaluate:

- The narrowest required target role and scope.
- Who can attach and use the identity.
- Whether sharing expands blast radius.
- How local and deployed authentication differ.
- How rotation-free authentication affects operational testing.
- How identities and role assignments are removed.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What problem do managed identities solve?

<!-- question:start:system-assigned-and-user-assigned-managed-identities-beginner-q01 -->
<!-- question-id:system-assigned-and-user-assigned-managed-identities-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Managed identities let code on supported Azure resources obtain Microsoft Entra access tokens without developers managing a client secret, password, or certificate. Azure manages the identity credential and exposes token acquisition through the hosting environment. The target service must support Microsoft Entra authentication, and the identity still needs an explicit authorization grant.

##### Key Points to Mention

- Credentials are not exposed to application code.
- Managed identity is intended for workload authentication.
- It can be used with Azure services and protected custom APIs.
- It removes credential handling, not authorization design.

<!-- question:end:system-assigned-and-user-assigned-managed-identities-beginner-q01 -->

#### What is the difference between system-assigned and user-assigned managed identities?

<!-- question:start:system-assigned-and-user-assigned-managed-identities-beginner-q02 -->
<!-- question-id:system-assigned-and-user-assigned-managed-identities-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A system-assigned identity is created on one Azure resource, can be used only by that resource, and is deleted with it. A user-assigned identity is a standalone Azure resource with an independent lifecycle and can be attached to multiple supported resources. System-assigned identities favor per-resource isolation; user-assigned identities favor reuse, preauthorization, and stable identity across resource replacement.

##### Key Points to Mention

- Both are represented by managed-identity service principals.
- User-assigned does not mean a human user identity.
- Sharing affects blast radius and audit granularity.
- Lifecycle is a primary selection criterion.

<!-- question:end:system-assigned-and-user-assigned-managed-identities-beginner-q02 -->

#### Does enabling a managed identity grant access to Azure resources?

<!-- question:start:system-assigned-and-user-assigned-managed-identities-beginner-q03 -->
<!-- question-id:system-assigned-and-user-assigned-managed-identities-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

No. Enabling or attaching an identity only gives the source workload an identity that can authenticate. The identity must separately receive an Azure RBAC data-plane role, database permission, API app role, or another authorization grant on the target resource. The grant should use the narrowest role and scope that support the required operation.

##### Key Points to Mention

- Authentication and authorization are separate.
- Management-plane and data-plane roles differ.
- Role assignment scope matters.
- A valid token can still receive a 403 response.

<!-- question:end:system-assigned-and-user-assigned-managed-identities-beginner-q03 -->

#### How does a .NET application use a managed identity?

<!-- question:start:system-assigned-and-user-assigned-managed-identities-beginner-q04 -->
<!-- question-id:system-assigned-and-user-assigned-managed-identities-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

The application uses an `Azure.Identity` credential, commonly `DefaultAzureCredential` or `ManagedIdentityCredential`, and passes it to an Azure SDK client. In Azure, the credential requests a token through the managed identity environment. The SDK caches and refreshes tokens. Clients should normally be reused through dependency injection rather than created per request.

##### Key Points to Mention

- No secret is stored in configuration.
- The target URI or namespace is still configured.
- `DefaultAzureCredential` supports local developer identities.
- Explicit credentials can make production behavior more predictable.

<!-- question:end:system-assigned-and-user-assigned-managed-identities-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### When would you choose a user-assigned identity over a system-assigned identity?

<!-- question:start:system-assigned-and-user-assigned-managed-identities-intermediate-q01 -->
<!-- question-id:system-assigned-and-user-assigned-managed-identities-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Choose a user-assigned identity when the identity must exist before compute deployment, survive replacement, or be shared by replicas of the same workload. It also helps when identity administration is separate, resources are created rapidly, or several supported hosts need identical permissions. Confirm that sharing reflects one trust boundary because every attached resource receives all permissions granted to the identity.

##### Key Points to Mention

- The identity can be preauthorized.
- It avoids new identity creation during every resource replacement.
- It reduces role-assignment count for true replicas.
- Reuse can increase security blast radius.

<!-- question:end:system-assigned-and-user-assigned-managed-identities-intermediate-q01 -->

#### How should local development work when production uses managed identity?

<!-- question:start:system-assigned-and-user-assigned-managed-identities-intermediate-q02 -->
<!-- question-id:system-assigned-and-user-assigned-managed-identities-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

The managed identity endpoint is not available locally. Developers can use `DefaultAzureCredential` with a separately authenticated developer identity from supported tooling. Local permissions should be least privilege and separate from production. Because the developer identity may have different access, the deployed managed identity must also be tested in a nonproduction Azure environment.

##### Key Points to Mention

- Local and deployed callers are different principals.
- Avoid secret fallback in source-controlled settings.
- Local success can hide missing production role assignments.
- Integration testing should exercise the real workload identity.

<!-- question:end:system-assigned-and-user-assigned-managed-identities-intermediate-q02 -->

#### How do you select the correct identity when an Azure resource has several managed identities?

<!-- question:start:system-assigned-and-user-assigned-managed-identities-intermediate-q03 -->
<!-- question-id:system-assigned-and-user-assigned-managed-identities-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Configure the credential with the intended user-assigned identity, commonly by client ID, resource ID, or the supported host configuration. Do not rely on an implicit choice when both a system-assigned identity and one or more user-assigned identities are available. Keep client ID, principal ID, and Azure resource ID distinct because they serve different configuration and role-assignment purposes.

##### Key Points to Mention

- The identity must first be attached to the source resource.
- Client ID commonly selects the user-assigned identity in code.
- Principal ID commonly identifies it in role assignments.
- Log nonsecret identity metadata to aid diagnosis.

<!-- question:end:system-assigned-and-user-assigned-managed-identities-intermediate-q03 -->

#### Why can a managed identity receive 403 after a role assignment was added?

<!-- question:start:system-assigned-and-user-assigned-managed-identities-intermediate-q04 -->
<!-- question-id:system-assigned-and-user-assigned-managed-identities-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

The role may be wrong, assigned at the wrong scope, assigned to a different principal, or still propagating. The application may have selected another identity or requested a token for the wrong audience. Azure SDK and managed identity infrastructure also cache tokens, so authorization changes may not be visible immediately. Diagnose these possibilities before widening access.

##### Key Points to Mention

- Verify data-plane versus management-plane roles.
- Confirm source identity and target audience.
- Account for directory, RBAC, and token-cache propagation.
- Use bounded deployment retries for expected delays.

<!-- question:end:system-assigned-and-user-assigned-managed-identities-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you choose identities for ten replicas of one service and three unrelated services?

<!-- question:start:system-assigned-and-user-assigned-managed-identities-advanced-q01 -->
<!-- question-id:system-assigned-and-user-assigned-managed-identities-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

The ten replicas can share a user-assigned identity if they perform the same function, need identical permissions, and belong to one trust boundary. The unrelated services should use separate identities so permissions and compromise impact remain isolated. Depending on lifecycle and audit needs, each unrelated service can use its own system-assigned or user-assigned identity.

##### Key Points to Mention

- Identity boundaries should follow workload boundaries.
- Sharing reduces administration but weakens per-resource attribution.
- Avoid one environment-wide identity.
- Production and nonproduction should use separate identities.

<!-- question:end:system-assigned-and-user-assigned-managed-identities-advanced-q01 -->

#### What security risk comes with permission to attach a user-assigned identity?

<!-- question:start:system-assigned-and-user-assigned-managed-identities-advanced-q02 -->
<!-- question-id:system-assigned-and-user-assigned-managed-identities-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Anyone who can attach a privileged identity to a resource they control, or execute code on a resource that already has it, may be able to exercise all permissions granted to that identity. Therefore identity-assignment permissions, code-deployment permissions, and target-role administration are sensitive capabilities. They require least privilege, separation of duties, and auditing.

##### Key Points to Mention

- The source resource can use every permission on the identity.
- Shared identities transfer their authority to every attached host.
- Managed Identity Operator and related roles require careful scope.
- Credential-free does not mean low risk.

<!-- question:end:system-assigned-and-user-assigned-managed-identities-advanced-q02 -->

#### How do managed identity lifecycle choices affect infrastructure deployments?

<!-- question:start:system-assigned-and-user-assigned-managed-identities-advanced-q03 -->
<!-- question-id:system-assigned-and-user-assigned-managed-identities-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

A system-assigned principal is available only after the source resource exists, so infrastructure must create the resource before assigning target roles. Deleting and recreating it produces a new principal ID. A user-assigned identity can be created and authorized first, attached later, and retained across source replacement. Both models require cleanup of obsolete role assignments and handling of propagation delays.

##### Key Points to Mention

- Model dependencies explicitly in infrastructure as code.
- Names do not preserve identity object IDs.
- User-assigned identities need explicit end-of-life cleanup.
- Deployment verification should test actual target access.

<!-- question:end:system-assigned-and-user-assigned-managed-identities-advanced-q03 -->

#### How would you troubleshoot managed identity authentication end to end?

<!-- question:start:system-assigned-and-user-assigned-managed-identities-advanced-q04 -->
<!-- question-id:system-assigned-and-user-assigned-managed-identities-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

First verify that the source service supports managed identity and that the intended identity is enabled or attached. Confirm the application selects that identity and requests a token for the correct target audience. Then verify the target supports Microsoft Entra authentication and that the identity has the correct data-plane role at the correct scope. Finally, account for propagation and token caching and inspect safe diagnostics in Activity Logs, Entra sign-in logs, and the target service.

##### Key Points to Mention

- Credential-unavailable errors differ from target-service 403 responses.
- Multiple attached identities can cause selection mistakes.
- Do not log raw access tokens.
- Avoid fixing diagnosis problems by adding broad roles or secrets.

<!-- question:end:system-assigned-and-user-assigned-managed-identities-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
