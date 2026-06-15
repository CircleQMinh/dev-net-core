---
id: shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks
topic: Azure Blob Storage and file handling
subtopic: Shared access signatures, managed identity, RBAC, stored access policies, and public access risks
category: Azure
---

## Overview

Azure Blob Storage supports several authorization mechanisms:

- Microsoft Entra ID with Azure role-based access control, or RBAC.
- Managed identities for Azure workloads.
- User delegation shared access signatures.
- Service shared access signatures.
- Account shared access signatures.
- Shared Key authorization.
- Anonymous public read access when explicitly enabled.

The preferred design is:

1. Use Microsoft Entra ID and managed identity for trusted applications.
2. Use Azure data-plane RBAC to grant the minimum required scope and actions.
3. Use a short-lived user delegation SAS when an untrusted client needs direct temporary access.
4. Disable Shared Key authorization when compatible.
5. Disable anonymous public access unless the data is intentionally public.
6. Restrict network access independently with private endpoints, firewalls, or approved public paths.

A SAS is a bearer token. Anyone who obtains it can use its permissions until expiry or revocation through the mechanisms available to that SAS type. It should be treated as a secret.

For interviews, candidates should explain the difference between identity authorization and delegated SAS access, distinguish control-plane and data-plane roles, compare user delegation, service, and account SAS, describe stored access policies, and recognize that private networking does not replace authorization.

## Core Concepts

### Authentication and Authorization

Authentication proves who the caller is. Authorization determines what the caller can do.

Examples:

- A managed identity authenticates an App Service workload.
- The `Storage Blob Data Reader` role authorizes blob reads.
- A user delegation SAS delegates selected permissions for a limited time.
- A private endpoint controls network reachability but does not grant data permission.

Secure storage requires both network and identity controls.

### Control Plane Versus Data Plane

The control plane manages the Azure resource:

- Create or delete storage accounts.
- Configure networking.
- Set encryption.
- Configure diagnostics.
- Assign roles.

The data plane accesses stored content:

- List containers or blobs.
- Read blob data.
- Upload or overwrite blobs.
- Delete blobs.
- Read or write tags.

Roles such as `Owner` and `Contributor` grant broad management permissions but do not automatically grant blob data access through Microsoft Entra authorization. Data access requires a data-plane role such as:

- `Storage Blob Data Reader`.
- `Storage Blob Data Contributor`.
- `Storage Blob Data Owner`.

The Azure portal can sometimes use account-key access when the user can retrieve keys, which can hide a missing data role. Disable Shared Key where practical and test using the same identity path as production.

### Azure RBAC Scope

Blob data roles can be assigned at scopes such as:

- Management group.
- Subscription.
- Resource group.
- Storage account.
- Container.

Use the narrowest practical scope. A workload that reads one container should not receive contributor access to every storage account in a subscription.

Broad inherited roles are easier to administer but increase blast radius. Container-scoped assignments improve least privilege but can create many role assignments. Use repeatable infrastructure as code.

### Common Blob Data Roles

**Storage Blob Data Reader**

- Read and list containers and blobs within scope.
- Appropriate for consumers that must not modify data.

**Storage Blob Data Contributor**

- Read, write, and delete blob data.
- Does not grant ownership-management capabilities.

**Storage Blob Data Owner**

- Full blob data access.
- Can manage ownership-related permissions in supported hierarchical namespace scenarios.

Custom roles can narrow actions further, but increase governance and testing requirements.

### Role Assignment Propagation

Role assignments are not always effective immediately. Applications and deployment automation should tolerate propagation delay rather than repeatedly changing configuration.

Troubleshooting should verify:

- Correct principal object ID.
- Correct tenant.
- Data-plane role rather than management-only role.
- Correct scope.
- No deny assignment.
- Token acquired after the assignment.
- Network reachability.

A 403 can result from identity, role, scope, SAS, firewall, public-access, or encryption configuration. Diagnose each layer systematically.

### Managed Identities

A managed identity is a Microsoft Entra service principal whose credentials Azure manages.

Types:

- **System-assigned:** Tied to one Azure resource and deleted with it.
- **User-assigned:** Independent Azure resource that can be attached to several workloads.

Managed identities avoid:

- Account keys in configuration.
- Client secrets in environment variables.
- Manual credential rotation.

A workload requests a token for Azure Storage and the SDK sends that token with data requests.

### DefaultAzureCredential

Azure SDK clients can use `DefaultAzureCredential`:

```csharp
var serviceClient = new BlobServiceClient(
    new Uri("https://examplestorage.blob.core.windows.net"),
    new DefaultAzureCredential());

var containerClient = serviceClient.GetBlobContainerClient("documents");
```

In local development it can use developer credentials. In Azure it can use the assigned managed identity.

Production configuration should be deterministic. If a host has several user-assigned identities, explicitly select the intended identity rather than relying on ambiguous discovery.

### Managed Identity Does Not Grant Permission Automatically

Enabling an identity creates a principal. It does not grant storage access.

A separate role assignment is required:

```text
Managed identity
  + Storage Blob Data Contributor
  + container scope
  = authorized blob read/write access
```

Do not grant `Storage Blob Data Owner` when contributor or reader is sufficient.

### Shared Access Signatures

A shared access signature, or SAS, is a signed token containing authorization constraints such as:

- Resource or service.
- Permissions.
- Start time.
- Expiry time.
- Allowed protocol.
- Optional IP range.
- Service version.

The token is appended to a resource URI. Storage validates its signature and constraints on every request.

A SAS delegates access without giving the client the signing credential.

### SAS Is a Bearer Credential

Possession of a SAS is normally sufficient to use it. A leaked SAS can be copied into:

- Browser history.
- Reverse-proxy logs.
- Analytics systems.
- Referrer headers.
- Screenshots.
- Support tickets.
- Source control.

Security practices include:

- HTTPS only.
- Short expiry.
- Minimum permissions.
- Narrow resource scope.
- Avoid logging query strings.
- Redact SAS from telemetry.
- Do not send SAS in email or chat.
- Return SAS only after authorization.
- Use a new SAS per operation or object where practical.

### User Delegation SAS

A user delegation SAS is signed with a user delegation key obtained using Microsoft Entra credentials.

It is Microsoft's recommended SAS type for Blob Storage because:

- The signing authority comes from Microsoft Entra ID rather than an account key.
- The principal needs an RBAC action to request the delegation key.
- Shared Key can be disabled while user delegation SAS remains available.
- The maximum effective lifetime is constrained by the user delegation key.

A common pattern is:

1. API authenticates the user.
2. API authorizes access to one business object.
3. API uses its managed identity to request a user delegation key.
4. API creates a short-lived SAS for one blob.
5. Client uploads or downloads directly.

The SAS service enforces the token's storage permissions, but the application must enforce business authorization before issuance.

### User Delegation SAS Permissions

Grant only the operation required:

- Read for one download.
- Create or write for a new upload.
- Avoid delete unless explicitly required.
- Avoid list when one object is enough.
- Add tag permissions only when the client must set tags.

For upload, decide whether the client may overwrite an existing object. A create-only design using a server-generated name and conditional commit is safer than broad write access.

### Service SAS

A service SAS:

- Is signed with the storage account key.
- Delegates access within one storage service.
- Can target a container or blob.
- Can be associated with a stored access policy.

Service SAS remains useful for compatibility or stored-access-policy scenarios, but it depends on Shared Key. Protect the account key and prefer user delegation SAS where possible.

### Account SAS

An account SAS:

- Is signed with the storage account key.
- Can delegate access across several storage services.
- Can authorize broader service-level and resource operations.
- Cannot use a stored access policy.

Because its scope can be broad, avoid account SAS for browser uploads or ordinary object downloads. Use it only when the client genuinely requires the broader operations and no safer identity design is available.

### SAS Comparison

| Type | Signed with | Typical scope | Stored access policy |
| --- | --- | --- | --- |
| User delegation SAS | Microsoft Entra user delegation key | Blob resources and delegated operations | No |
| Service SAS | Storage account key | One storage service and selected resources | Yes |
| Account SAS | Storage account key | Multiple services and service-level operations | No |

For Blob Storage, prefer user delegation SAS unless a specific requirement calls for service SAS.

### Ad Hoc SAS

An ad hoc SAS contains its permissions and validity window directly in the token.

User delegation and account SAS are always ad hoc. A service SAS can be ad hoc or reference a stored access policy.

An ad hoc SAS cannot be individually revoked after issuance. Mitigations include:

- Very short expiry.
- Disable or restrict the affected resource.
- Revoke user delegation keys where applicable.
- Rotate the account key for account-key-signed SAS, which affects every SAS and client using that key.

Short lifetimes reduce the need for emergency broad revocation.

### Stored Access Policies

A stored access policy is defined on a container and can specify:

- Start time.
- Expiry time.
- Permissions.

A service SAS references the policy identifier rather than embedding every constraint.

Benefits:

- Change the policy to affect associated SAS tokens.
- Revoke associated tokens by deleting the policy.
- Centralize a group of service SAS constraints.

Limitations:

- Supported for service SAS, not user delegation or account SAS.
- A container supports a limited number of policies, commonly five.
- Policy changes can take time to propagate.
- It does not reveal which copies of a SAS were distributed.
- It still relies on the account key.

Stored access policies are useful when service SAS tokens require centralized revocation, but they are not a replacement for identity-based access.

### Revoking SAS

Revocation depends on type:

**User delegation SAS**

- Keep expiry short.
- Revoke user delegation keys for the storage account when emergency invalidation is needed.
- Remove the issuer's RBAC permission to prevent new tokens, noting that existing tokens remain valid until expiry or key revocation.

**Service SAS with stored access policy**

- Delete or change the policy.

**Ad hoc service SAS or account SAS**

- Rotate the signing account key.
- This invalidates every SAS and application using that key, so rotation can cause a wide outage.

Design revocation before distributing tokens.

### SAS Start Time and Clock Skew

If immediate use is required, omit the start time or set it slightly in the past. Client and service clocks can differ, causing a token with a current start time to be temporarily rejected.

Keep expiry short while allowing enough time for:

- Transfer duration.
- Retries.
- Client clock differences.
- User initiation delay.

Do not issue a multi-day SAS merely to avoid implementing token refresh.

### Direct Browser Upload

A secure direct upload pattern is:

1. Browser authenticates to the application.
2. Application validates tenant, file quota, intended type, and business operation.
3. Application generates a random blob name.
4. Application creates a short user delegation SAS for that object.
5. Browser uploads directly to Blob Storage.
6. Application receives or verifies completion.
7. A trusted worker validates size, checksum, and malware status.
8. Application marks the document available.

Use CORS to permit only required browser origins and methods. CORS is not authorization; the SAS still controls data access.

### Network Controls

Authorization and networking are independent.

Network controls include:

- Private endpoints.
- Storage firewall.
- Selected virtual networks.
- Approved public IP addresses.
- Disabled public network access.

A valid SAS can still fail if the network path is blocked. Conversely, a private endpoint does not grant permission.

For browser direct upload from the public internet, the storage public endpoint must be reachable through an approved design. Use narrow SAS, CORS, firewall strategy, and post-upload validation rather than assuming private endpoints work directly from arbitrary browsers.

### Shared Key Authorization

Storage account keys provide broad authority over the account. Applications with a key can:

- Generate service or account SAS.
- Access data according to Shared Key authorization.
- Cause a large blast radius if compromised.

Avoid storing account keys in application configuration. Prefer Microsoft Entra ID and managed identity.

When all dependencies support identity or user delegation SAS, set Shared Key access to disallowed. Test first because legacy tools and service integrations might depend on it.

Disabling Shared Key prevents account-key-authorized requests and account-key-signed service or account SAS. User delegation SAS continues to use Microsoft Entra authorization.

### Account Key Rotation

Storage accounts provide two account keys to support rotation:

1. Move clients from key 1 to key 2.
2. Regenerate key 1.
3. Move clients to the new key 1.
4. Regenerate key 2.

In practice, dependencies are often difficult to inventory. This is another reason to replace keys with managed identity.

Key rotation invalidates SAS tokens signed with that key.

### Anonymous Public Read Access

Anonymous blob access is possible only when:

1. The storage account permits blob public access.
2. The container is configured for a public access level.

Container public access levels include:

- **Blob:** Anonymous clients can read known blob URLs but cannot anonymously list the container.
- **Container:** Anonymous clients can read blobs and list the container.

If account-level public access is disabled, container-level public configuration cannot make data public.

### Public Access Risks

Anonymous access can expose:

- Customer documents.
- Backups.
- Source packages.
- Logs.
- Secrets embedded in files.
- Directory-like object names.
- Personal information.

The `Blob` access level reduces anonymous listing but does not make URLs secret. URLs appear in logs, browsers, referrers, search indexes, and application data.

Use anonymous access only for deliberately public content. Prefer a separate storage account for public assets so private workloads cannot be exposed by a container configuration error.

### Public Website Content

Legitimate public-content patterns include:

- Public marketing images.
- Open datasets.
- Public downloads.
- Static website assets.

Even then:

- Separate public and private accounts.
- Use content review.
- Prevent public write.
- Enable versioning or deployment rollback.
- Apply CDN or Front Door where appropriate.
- Monitor unexpected object additions.

Do not place private uploads and public website assets in one container.

### RBAC and SAS Together

RBAC determines whether the SAS-issuing service can obtain a user delegation key and access data. The generated SAS then delegates a subset of access to the client.

This creates two authorization layers:

```text
Managed identity RBAC
  -> may generate delegated access

SAS constraints
  -> client may perform a limited storage operation
```

The issuer should have only the scope needed to produce the required tokens.

### Authorization at the Business Layer

Storage authorization knows the account, container, blob, and requested operation. It does not know:

- Whether a user owns an invoice.
- Whether a case is closed.
- Whether a subscription is paid.
- Whether a document passed malware scanning.

The application must evaluate business rules before issuing a SAS or proxying data. Use server-controlled identifiers and query authoritative metadata.

### SAS Generation Is Not Fully Auditable

Azure Storage does not maintain an inventory of every SAS token generated by a client. A principal with signing permission can create tokens outside the storage account owner's direct observation.

Controls include:

- Restrict `generateUserDelegationKey`.
- Disable Shared Key.
- Limit who can list account keys.
- Use a central token-issuing service.
- Log business authorization and token intent before generation.
- Keep expiry short.
- Monitor actual storage access.

Audit issuance in the application, but never log the SAS token itself.

### Logging and Incident Response

Enable:

- Azure activity logs for management changes.
- Blob read, write, and delete resource logs.
- Authentication type and caller information where available.
- Alerts for anonymous access configuration.
- Alerts for Shared Key use during migration.
- Public exposure inventory.
- Microsoft Defender for Storage where appropriate.

An incident response plan should cover:

- Disable public access.
- Revoke delegation keys.
- Rotate account keys.
- Remove compromised role assignments.
- Block network access.
- Identify affected blobs from logs.
- Restore deleted or overwritten data.

### Common 403 Troubleshooting

Check:

1. Correct account, container, and blob.
2. Token audience and tenant.
3. Data-plane RBAC role and scope.
4. Role propagation.
5. SAS signature, permissions, resource, protocol, start, and expiry.
6. Stored access policy.
7. Account Shared Key setting.
8. Storage firewall or private endpoint.
9. Encryption-scope permissions.
10. Conditional headers or immutability policy.

Do not respond to every 403 by assigning `Owner` or generating a broad account SAS.

### Common Mistakes

Common mistakes include:

- Using account keys in application settings.
- Giving `Contributor` and assuming it grants data access.
- Issuing container-level SAS for one file.
- Granting read, write, delete, and list when only create is required.
- Logging full SAS URLs.
- Using long expiry to avoid token renewal.
- Expecting ad hoc SAS to be individually revocable.
- Assuming stored access policies support every SAS type.
- Enabling a private endpoint but retaining broad public access.
- Treating CORS as authorization.
- Making a container public because a browser cannot authenticate.
- Mixing public and private data in one account.
- Granting RBAC at subscription scope for one container.

### Best-Practice Authorization Checklist

A production design should normally:

- Prefer Microsoft Entra ID.
- Use managed identity for Azure workloads.
- Assign data-plane roles at the narrowest practical scope.
- Prefer user delegation SAS for temporary direct access.
- Issue per-object, least-privilege, short-lived SAS.
- Use HTTPS only and redact query strings.
- Use stored access policies only for service SAS scenarios that need centralized revocation.
- Disable Shared Key when dependencies support it.
- Disable anonymous access unless content is intentionally public.
- Separate public assets from private data.
- Combine authorization with network restrictions.
- Audit SAS issuance intent and monitor actual storage operations.
- Test revocation, key rotation, and incident response.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is a shared access signature?

<!-- question:start:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-beginner-q01 -->
<!-- question-id:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

A SAS is a signed bearer token that delegates selected Azure Storage permissions for a limited scope and time. It can restrict resources, operations, expiry, protocol, and optional IP range.

The client receives the SAS without receiving the signing identity or account key. Anyone who obtains the SAS can use it, so it must be short-lived, least-privilege, HTTPS-only, and excluded from logs.

##### Key Points to Mention

- SAS delegates temporary storage access.
- It is appended to the resource URI.
- It is a bearer credential.
- Scope, permissions, and expiry should be minimal.

<!-- question:end:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-beginner-q01 -->

#### Why should an Azure workload use managed identity for Blob Storage?

<!-- question:start:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-beginner-q02 -->
<!-- question-id:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Managed identity lets the workload obtain Microsoft Entra tokens without storing a client secret or storage key. Azure manages the credential lifecycle.

The identity still needs an Azure data-plane role such as `Storage Blob Data Reader` or `Storage Blob Data Contributor` at the required scope. Enabling an identity alone does not grant access.

##### Key Points to Mention

- Managed identity removes application-managed credentials.
- Azure RBAC grants actual data permissions.
- Use the narrowest role and scope.
- SDKs can use `DefaultAzureCredential`.

<!-- question:end:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-beginner-q02 -->

#### What is the difference between control-plane and data-plane roles?

<!-- question:start:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-beginner-q03 -->
<!-- question-id:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Control-plane roles manage the Azure storage account resource and configuration. Data-plane roles read or modify the actual blob data.

`Contributor` can manage the account but does not by itself grant Microsoft Entra blob reads. `Storage Blob Data Reader`, `Storage Blob Data Contributor`, and `Storage Blob Data Owner` are data-plane roles.

##### Key Points to Mention

- Management permission and data permission are separate.
- Portal behavior can hide this when account keys are available.
- Assign a blob data role for content access.
- Scope data roles narrowly.

<!-- question:end:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-beginner-q03 -->

#### When can a blob be read anonymously?

<!-- question:start:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-beginner-q04 -->
<!-- question-id:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Anonymous reads require both account-level permission for blob public access and a container configured with `Blob` or `Container` public access.

`Blob` permits reading a known blob URL but not anonymous container listing. `Container` also permits listing. If account-level public access is disabled, container settings cannot make blobs public.

##### Key Points to Mention

- Public access requires two levels of configuration.
- Blob-level public access does not make URLs secret.
- Container-level access permits listing.
- Disable anonymous access for private data.

<!-- question:end:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Compare user delegation, service, and account SAS.

<!-- question:start:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-intermediate-q01 -->
<!-- question-id:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

A user delegation SAS is signed with a key obtained through Microsoft Entra ID and is preferred for Blob Storage. A service SAS is signed with an account key and delegates access within one storage service. An account SAS is account-key-signed and can cover multiple storage services and broader service operations.

Only service SAS supports stored access policies. User delegation and account SAS are ad hoc. Prefer user delegation SAS unless compatibility or stored-policy requirements justify service SAS.

##### Key Points to Mention

- User delegation SAS uses Microsoft Entra authority.
- Service and account SAS rely on Shared Key.
- Account SAS has the broadest potential scope.
- Stored access policy works only with service SAS.

<!-- question:end:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-intermediate-q01 -->

#### What problem does a stored access policy solve?

<!-- question:start:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-intermediate-q02 -->
<!-- question-id:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

A stored access policy defines start time, expiry, and permissions on a container. Service SAS tokens can reference the policy. Changing or deleting it changes or revokes associated tokens without rotating the storage account key.

It supports only service SAS, has a limited number of policies per container, can have propagation delay, and does not inventory distributed token copies. It remains dependent on the account key.

##### Key Points to Mention

- It centralizes constraints for service SAS.
- Deleting the policy can revoke associated tokens.
- It is not supported by user delegation or account SAS.
- Short expiry and token protection are still necessary.

<!-- question:end:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-intermediate-q02 -->

#### How would you securely let a browser upload directly to Blob Storage?

<!-- question:start:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-intermediate-q03 -->
<!-- question-id:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

The application authenticates the user, checks business authorization and quota, generates a server-controlled blob name, and issues a short-lived user delegation SAS limited to creating or writing that one blob. CORS permits the expected origin and methods.

After upload, a trusted process verifies length, checksum, file type, and malware status before making the object available. The SAS is not logged, and abandoned pending uploads are cleaned up.

##### Key Points to Mention

- Application authorization happens before SAS issuance.
- Scope the SAS to one object and minimal operations.
- CORS is not authorization.
- Validate untrusted content after upload.

<!-- question:end:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-intermediate-q03 -->

#### What happens when Shared Key authorization is disabled?

<!-- question:start:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-intermediate-q04 -->
<!-- question-id:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Requests authorized directly with account keys are rejected. Service SAS and account SAS signed with those keys also stop working. Microsoft Entra ID authorization and user delegation SAS continue to work.

Before disabling Shared Key, inventory applications, scripts, portal workflows, and service integrations that depend on keys. Migrate them to managed identity, service principals, or user delegation SAS, monitor remaining Shared Key use, and keep a controlled rollback plan.

##### Key Points to Mention

- Shared Key has a broad compromise blast radius.
- Key-signed SAS depends on Shared Key.
- User delegation SAS is identity-based.
- Test dependencies before enforcing the setting.

<!-- question:end:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### Design authorization for private application access and temporary customer downloads.

<!-- question:start:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-advanced-q01 -->
<!-- question-id:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Give the application a managed identity with the minimum blob data role at container scope. Connect through a private endpoint, configure private DNS, and disable or restrict the public network path for server-side operations.

For customer download, authenticate the user against authoritative document ownership, then generate a read-only user delegation SAS for one blob with HTTPS-only access and a short expiry. Never expose the storage key. Redact query strings and log the authorization decision and document ID rather than the token.

If public clients need the storage endpoint, design the firewall path separately and ensure the SAS cannot access other objects. Monitor downloads and provide revocation through short expiry and emergency delegation-key revocation.

##### Key Points to Mention

- Managed identity and RBAC secure trusted workloads.
- User delegation SAS supports temporary client access.
- Business authorization precedes storage delegation.
- Network controls and token controls are separate.

<!-- question:end:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-advanced-q01 -->

#### How would you respond to a leaked SAS token?

<!-- question:start:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-advanced-q02 -->
<!-- question-id:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Identify the SAS type, signing mechanism, permissions, scope, and expiry. Restrict the affected resource or network path immediately when practical. For a service SAS tied to a stored policy, remove or change the policy. For user delegation SAS, revoke user delegation keys if the remaining lifetime is unacceptable.

For ad hoc key-signed SAS, rotate the signing account key, understanding that this invalidates all clients and SAS tokens using it. Review data access logs, restore modified or deleted objects, remove the token from logs or repositories, and fix the issuance or leakage path.

##### Key Points to Mention

- Revocation depends on SAS type.
- Account-key rotation has broad impact.
- Short lifetimes reduce incident blast radius.
- Investigate actual access and restore affected data.

<!-- question:end:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-advanced-q02 -->

#### Why is a private endpoint insufficient by itself for Blob Storage security?

<!-- question:start:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-advanced-q03 -->
<!-- question-id:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

A private endpoint creates a private network path but does not grant data authorization and often does not automatically disable the public endpoint. A caller still needs Microsoft Entra, SAS, or Shared Key authorization.

The design should validate private DNS, assign least-privilege RBAC, disable or restrict public network access, disable anonymous access, and preferably disable Shared Key. Test both that approved workloads succeed and that an internet client cannot reach or authorize against the resource.

##### Key Points to Mention

- Reachability and authorization are separate.
- Public access may remain enabled after Private Link creation.
- Private DNS is required for the intended endpoint.
- Negative testing proves public bypass is closed.

<!-- question:end:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-advanced-q03 -->

#### How would you govern SAS issuance across a large organization?

<!-- question:start:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-advanced-q04 -->
<!-- question-id:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Disable Shared Key where possible and restrict roles that can list keys or generate user delegation keys. Centralize SAS issuance in approved services using managed identity. Require per-object scope, approved permission templates, maximum lifetimes, HTTPS-only access, and documented business authorization.

Use Azure Policy to audit account settings, monitor Shared Key and anonymous access, redact query strings, and record issuance intent without storing tokens. Maintain emergency delegation-key revocation and account-key rotation runbooks. Review role assignments and public exposure continuously.

##### Key Points to Mention

- Central token issuance improves consistent policy.
- Restrict signing permissions and account-key access.
- Enforce lifetime, scope, and permission standards.
- Monitor usage and test revocation procedures.

<!-- question:end:shared-access-signatures-managed-identity-rbac-stored-access-policies-and-public-access-risks-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
