---
id: dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content
topic: Azure Blob Storage and file handling
subtopic: .NET Blob clients, direct browser upload patterns, and storing metadata separately from binary content
category: Azure
---

## Overview

Azure Blob Storage applications commonly combine three architectural concerns:

- .NET services use Azure SDK clients to authorize and manage blob operations.
- Browsers upload large files directly to Blob Storage using narrowly scoped, short-lived delegated access.
- A database stores authoritative business metadata while Blob Storage stores binary content.

Separating these responsibilities avoids routing every byte through an API, keeps searchable and transactional data in a database, and lets Blob Storage handle durable object transfer. It also creates a distributed workflow: the database and Blob Storage do not share one transaction, so the application must handle incomplete uploads, retries, duplicate completion calls, malware scanning, and orphan cleanup.

For interviews, candidates should explain the SDK client hierarchy, managed identity, dependency injection, SAS security, CORS, metadata modeling, idempotency, consistency, and secure download authorization.

## Core Concepts

### Azure Blob Client Hierarchy

The primary .NET clients are:

- `BlobServiceClient`: account-level operations and client creation.
- `BlobContainerClient`: operations within one container.
- `BlobClient`: operations on a specific blob.
- `BlockBlobClient`: explicit block staging and block-list commits.
- `AppendBlobClient`: append-only blob operations.
- `PageBlobClient`: page-range operations.

Create narrower clients from broader clients:

```csharp
BlobContainerClient container =
    serviceClient.GetBlobContainerClient("documents");

BlobClient blob =
    container.GetBlobClient("tenant-42/8f7c/report.pdf");
```

Use a specialized client only when its specialized operations are needed.

### Client Lifetime and Thread Safety

Azure SDK clients are thread-safe and designed for reuse. Register them as singletons or otherwise create and retain a small number of clients.

Do not create a new `BlobServiceClient` for every request. Reuse provides:

- Shared HTTP connection pools.
- Lower allocation and connection overhead.
- Centralized configuration.
- Consistent diagnostics and retry behavior.

Per-operation request objects and streams still require normal concurrency care.

### Authentication with `DefaultAzureCredential`

Prefer Microsoft Entra authentication over storage account keys.

```csharp
var serviceClient = new BlobServiceClient(
    new Uri(configuration["Storage:BlobServiceUri"]!),
    new DefaultAzureCredential());
```

`DefaultAzureCredential` supports local developer credentials and deployed workload identities. In Azure, use a system-assigned or user-assigned managed identity and grant only the required data-plane role.

Common roles include:

- Storage Blob Data Reader.
- Storage Blob Data Contributor.
- Storage Blob Data Owner.

Management-plane roles such as Contributor do not automatically grant blob data access.

### Dependency Injection

A simple registration:

```csharp
builder.Services.AddSingleton(sp =>
{
    var configuration = sp.GetRequiredService<IConfiguration>();
    var serviceUri = new Uri(
        configuration["Storage:BlobServiceUri"]!);

    return new BlobServiceClient(
        serviceUri,
        new DefaultAzureCredential());
});
```

A domain-facing service should hide storage-specific details from controllers:

```csharp
public interface IDocumentContentStore
{
    Task<UploadTarget> CreateUploadTargetAsync(
        CreateUploadRequest request,
        CancellationToken cancellationToken);

    Task<Stream> OpenReadAsync(
        string blobName,
        CancellationToken cancellationToken);
}
```

Do not expose account keys or unrestricted `BlobClient` instances to unrelated application layers.

### SDK Retry Configuration

Azure SDK clients include retry behavior for transient failures. Configure retries at client creation rather than layering arbitrary retries around every operation.

```csharp
var options = new BlobClientOptions
{
    Retry =
    {
        Mode = RetryMode.Exponential,
        MaxRetries = 5,
        Delay = TimeSpan.FromSeconds(0.8),
        MaxDelay = TimeSpan.FromSeconds(8),
        NetworkTimeout = TimeSpan.FromMinutes(2)
    }
};

var client = new BlobServiceClient(
    serviceUri,
    new DefaultAzureCredential(),
    options);
```

Retries must respect cancellation and an overall operation deadline. A retry can repeat a request whose outcome is unknown, so application workflows still need idempotency and reconciliation.

### Streaming Upload and Download

Avoid loading an entire file into memory.

```csharp
await blobClient.UploadAsync(
    contentStream,
    new BlobUploadOptions
    {
        HttpHeaders = new BlobHttpHeaders
        {
            ContentType = validatedContentType
        },
        TransferOptions = new StorageTransferOptions
        {
            MaximumConcurrency = 4,
            MaximumTransferSize = 8 * 1024 * 1024
        }
    },
    cancellationToken);
```

For downloads, either:

- Stream through the API when inspection, transformation, or strict network control is required.
- Return a short-lived read SAS after the API authorizes the user.

Do not infer authorization from knowledge of a blob name.

### Direct Browser Upload Architecture

A secure direct-upload flow is:

1. The browser authenticates to the application API.
2. The API authorizes the user and validates file intent, size, and allowed type.
3. The API creates a pending upload record and a server-generated blob name.
4. The API returns a short-lived write-only SAS for that blob.
5. The browser uploads directly to Blob Storage.
6. The browser calls a completion endpoint with the upload ID.
7. The API checks blob properties, expected size, checksum, and ownership.
8. A worker scans and processes the file in quarantine.
9. The database state changes to `Available` only after validation succeeds.

This keeps large payloads away from the API while preserving server control over identity, authorization, naming, and publication.

### User Delegation SAS

When possible, generate a user delegation SAS using Microsoft Entra credentials instead of signing SAS tokens with an account key.

A direct-upload SAS should normally be:

- Scoped to one blob.
- Limited to create and write permissions.
- Valid for a short period.
- Served only over HTTPS.
- Bound to a server-generated path.
- Issued only after application authorization.

Do not grant list, delete, or container-wide permissions unless the workflow proves they are necessary.

Treat a SAS as a bearer credential:

- Do not log it.
- Do not place it in analytics events.
- Avoid storing it in application state longer than needed.
- Redact query strings from diagnostics.
- Use a renewal endpoint rather than issuing a long-lived token.

### CORS Is Not Authorization

Blob Storage cross-origin resource sharing configuration controls whether a browser is allowed to make a cross-origin request. It does not decide whether the caller can read or write a blob.

Direct browser uploads require both:

- A CORS rule that permits the trusted web origin, methods, and headers.
- A valid authorization mechanism such as a SAS.

Avoid wildcard origins for credential-bearing production workflows when a known origin can be specified.

### Server-Controlled Naming

Use opaque storage names:

```text
quarantine/{tenant-id}/{upload-id}
```

Store the user's display filename separately. This prevents:

- Path traversal assumptions.
- Cross-tenant overwrite.
- Guessable object identifiers.
- Unsafe characters leaking into headers.
- Renaming a document from requiring a physical blob move.

Blob names are object keys, not operating-system file paths, even though slash-delimited names appear as virtual folders.

### Quarantine and Publication

An uploaded blob should not become downloadable merely because the upload request succeeded.

Keep new content in quarantine until the application verifies:

- Expected size.
- Allowed extension and detected media type.
- Whole-file checksum where required.
- Malware scan result.
- File-format validity.
- Tenant and upload-session ownership.

Use a state machine:

```text
Pending -> Uploading -> Uploaded -> Scanning -> Available
                                      |             |
                                      v             v
                                   Rejected       Deleted
```

Only `Available` content should be returned by normal download endpoints.

### Store Binary Content and Business Metadata Separately

Blob Storage is optimized for object content. A relational or document database is better for business metadata that requires transactions, joins, rich filtering, ownership rules, and workflow state.

An example document record:

```text
DocumentId
TenantId
OwnerUserId
BlobContainer
BlobName
BlobVersionId
OriginalFileName
ValidatedContentType
ExpectedLength
ActualLength
Checksum
ChecksumAlgorithm
Status
RetentionClass
CreatedAt
UploadedAt
PublishedAt
RowVersion
```

The API should address a document by `DocumentId`, authorize the business record, and resolve the internal blob location. Clients should not construct blob paths from business IDs.

### Blob Metadata and Index Tags

Blob metadata is suitable for small technical key-value properties that should travel with the object. Blob index tags support server-side filtering and lifecycle rules.

Good uses include:

- Schema or pipeline version.
- Technical classification.
- Processing correlation ID.
- Lifecycle tag.

Avoid treating blob metadata as the authoritative business database because:

- Query capabilities are limited.
- Multi-record transactions are unavailable.
- Rich constraints and relationships are difficult.
- Metadata updates can create concurrency and versioning side effects.
- Sensitive values may be exposed to identities that can read blob properties.

Store only the minimum duplicated metadata needed for storage operations.

### No Distributed Transaction

Azure SQL and Blob Storage do not share a normal atomic transaction. Failures can occur between:

1. Creating the database record.
2. Uploading the blob.
3. Marking the record complete.
4. Publishing a processing event.

Model this explicitly instead of pretending the operations are atomic.

### Pending-First Workflow

Create the database record first with a unique upload ID and `Pending` state. Then upload to the generated blob name.

Benefits:

- Every authorized upload has a business owner.
- Repeated create requests can be idempotent.
- Cleanup can find expired sessions.
- Completion can validate the expected target.

If the upload never happens, a scheduled cleanup marks the record expired.

### Completion Endpoint

The completion endpoint should be idempotent:

```http
POST /api/uploads/{uploadId}/complete
```

On every call it should:

1. Authorize the upload owner.
2. Read the expected record.
3. Fetch blob properties.
4. Verify length, checksum, and target name.
5. Transition state conditionally.
6. Return the already completed result when appropriate.

Do not trust size, content type, or completion status supplied only by the browser.

### Outbox and Event Processing

When downstream processing starts after a database state change, use an outbox pattern:

1. Update the upload record.
2. Insert an outbox message in the same database transaction.
3. Publish the message asynchronously.
4. Mark the outbox record dispatched.

Consumers should be idempotent because a message can be delivered more than once.

### Reconciliation and Orphan Cleanup

Run reconciliation jobs for:

- Pending records whose SAS expired.
- Blobs with no database record.
- Records marked uploaded whose blob is missing.
- Scans that exceeded their expected duration.
- Duplicate or superseded blobs.

Deletion should consider soft delete, legal retention, and audit requirements. Prefer writing orphan candidates to a report or state table before destructive cleanup.

### Secure Download Pattern

A download flow should:

1. Authenticate the user.
2. Load the document record by opaque ID and tenant.
3. Enforce object-level authorization.
4. Require `Available` state.
5. Resolve the exact blob name and version if necessary.
6. Stream content or issue a short-lived read-only SAS.
7. Set a safe `Content-Disposition` filename.
8. Log the business access event without logging credentials.

For sensitive content, consider streaming through the API or a controlled gateway rather than issuing a reusable URL.

### Optimistic Concurrency

Blob operations return ETags. Use conditional requests when concurrent writers could overwrite one another:

```csharp
var conditions = new BlobRequestConditions
{
    IfMatch = expectedETag
};
```

The metadata database should also use optimistic concurrency, such as a SQL `rowversion`. These tokens protect different resources; the workflow still needs reconciliation across them.

### Multi-Tenant Isolation

For a multi-tenant system:

- Include the tenant in every metadata query.
- Generate blob names on the server.
- Scope SAS tokens to one authorized object.
- Avoid container listing from the browser.
- Separate accounts or containers when compliance requires stronger boundaries.
- Use distinct encryption scopes only when a key boundary is required.
- Test cross-tenant access as a security requirement.

Naming conventions improve organization but do not create authorization by themselves.

### Common Mistakes

- Creating SDK clients per request.
- Deploying storage account keys in application settings.
- Issuing container-wide or long-lived SAS tokens.
- Treating CORS as a security boundary.
- Letting the browser choose the final blob name.
- Trusting browser-provided content type or completion status.
- Publishing files before scanning.
- Storing searchable business state only in blob metadata.
- Assuming the database and blob write are atomic.
- Deleting orphans without accounting for retention controls.
- Authorizing downloads only by a predictable blob path.

### Best Practices

- Reuse thread-safe SDK clients.
- Use managed identity and data-plane RBAC.
- Pass cancellation tokens through all storage operations.
- Keep upload SAS tokens short-lived and object-scoped.
- Use quarantine, validation, and explicit publication states.
- Keep authoritative metadata in a transactional store.
- Make create, complete, scan, and cleanup operations idempotent.
- Use an outbox for reliable downstream events.
- Reconcile database and storage state regularly.
- Monitor request failures, throttling, scan latency, orphan counts, and SAS issuance.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is the difference among `BlobServiceClient`, `BlobContainerClient`, and `BlobClient`?

<!-- question:start:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-beginner-q01 -->
<!-- question-id:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

`BlobServiceClient` represents the storage account's Blob service and creates container clients. `BlobContainerClient` represents one container and creates blob clients. `BlobClient` represents one blob and performs object-level upload, download, property, metadata, and delete operations.

Specialized clients such as `BlockBlobClient` expose blob-type-specific operations. The clients are thread-safe and should be reused.

##### Key Points to Mention

- The hierarchy narrows from account to container to object.
- Specialized clients are used for specialized operations.
- Clients are thread-safe.
- Reuse clients rather than creating them per request.
- Authorization still depends on the credential and assigned role.

<!-- question:end:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-beginner-q01 -->

#### Why should a .NET application use managed identity for Blob Storage?

<!-- question:start:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-beginner-q02 -->
<!-- question-id:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Managed identity lets an Azure workload obtain Microsoft Entra tokens without storing a storage account key or client secret. The identity receives a least-privilege Blob data-plane role, and Azure manages the underlying credential lifecycle.

`DefaultAzureCredential` provides a consistent developer and production authentication model. Local development can use developer credentials, while the deployed application uses its managed identity.

##### Key Points to Mention

- No long-lived secret is stored in application configuration.
- Use Blob data-plane RBAC roles.
- Apply least privilege.
- `DefaultAzureCredential` supports local and Azure environments.
- Identity use should be logged and monitored.

<!-- question:end:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-beginner-q02 -->

#### What is a direct browser upload?

<!-- question:start:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-beginner-q03 -->
<!-- question-id:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

In a direct browser upload, the application API authorizes the user and creates an upload session, but the browser sends file bytes directly to Blob Storage. The API normally provides a short-lived, object-scoped write SAS for a server-generated blob name.

After transfer, the browser calls the API to complete the workflow. The API verifies the blob and starts scanning or processing before publishing it.

##### Key Points to Mention

- The API remains responsible for business authorization.
- File bytes bypass the application server.
- Use a short-lived, least-privilege SAS.
- CORS permits the browser request but does not authorize it.
- Completion and scanning are separate workflow steps.

<!-- question:end:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-beginner-q03 -->

#### Why store document metadata separately from the blob?

<!-- question:start:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-beginner-q04 -->
<!-- question-id:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Blob Storage is optimized for binary objects, while a database is better for searchable business fields, ownership, relationships, transactions, workflow state, and object-level authorization. The database stores an opaque document ID and internal blob location.

Blob metadata or index tags may duplicate a small amount of technical classification, but they should not become the sole authoritative business model.

##### Key Points to Mention

- Binary and business data have different access patterns.
- Databases provide queries, constraints, and transactions.
- The document ID should be distinct from the blob path.
- Store original filename as metadata, not storage identity.
- Plan for cross-store consistency.

<!-- question:end:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How should Azure Blob SDK clients be registered in dependency injection?

<!-- question:start:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-intermediate-q01 -->
<!-- question-id:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Register a configured `BlobServiceClient` as a singleton, or use the Azure client registration extensions. Supply a service URI, `DefaultAzureCredential`, retry settings, and diagnostics once. Domain services can derive container and blob clients from it.

Azure SDK clients are thread-safe and maintain reusable HTTP resources. Creating clients per request adds avoidable allocation and connection overhead. Request-specific streams, conditions, and cancellation tokens remain operation scoped.

##### Key Points to Mention

- SDK clients are safe for concurrent reuse.
- Singleton lifetime is normally appropriate.
- Centralize credentials, retry, and diagnostics.
- Keep domain logic behind an application abstraction.
- Pass operation-specific cancellation and concurrency conditions.

<!-- question:end:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-intermediate-q01 -->

#### How would you secure a SAS used for direct upload?

<!-- question:start:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-intermediate-q02 -->
<!-- question-id:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Authorize the business operation first, generate an opaque blob name, and issue a user delegation SAS scoped to that exact blob. Grant only the required create and write permissions, require HTTPS, and set a short expiry.

Do not log the token or expose it to analytics. Use a server endpoint to renew an expired upload after reauthorization. The completion endpoint must verify ownership and blob properties rather than trusting the browser.

##### Key Points to Mention

- Prefer user delegation SAS.
- Scope to one object and minimum permissions.
- Keep the lifetime short.
- Treat the URL as a bearer credential.
- Reauthorize renewal and completion.

<!-- question:end:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-intermediate-q02 -->

#### How do you coordinate a database record and a Blob Storage upload without a distributed transaction?

<!-- question:start:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-intermediate-q03 -->
<!-- question-id:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use an explicit state machine. Create a pending database record first, upload to its server-generated blob name, and invoke an idempotent completion operation that verifies the blob before changing the record to uploaded. A later scan or processing step changes it to available.

Use an outbox to publish downstream work reliably and reconciliation jobs to find expired pending records, missing blobs, and orphan blobs. Every step should tolerate retries.

##### Key Points to Mention

- Do not pretend the two stores are atomic.
- Persist intent before transferring content.
- Use conditional, idempotent state transitions.
- Publish events through an outbox.
- Reconcile and clean up incomplete workflows.

<!-- question:end:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-intermediate-q03 -->

#### How would you implement an authorized document download?

<!-- question:start:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-intermediate-q04 -->
<!-- question-id:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Load the document by opaque business ID and tenant, enforce object-level authorization, confirm that its workflow state is available, and resolve the internal blob name. Then either stream the blob through the API or return a short-lived, read-only SAS.

Use a validated content type and safe `Content-Disposition` filename. Do not authorize access merely because the caller knows a blob URL, and do not expose quarantine content.

##### Key Points to Mention

- Authorize the business object before resolving storage.
- Enforce tenant and ownership constraints.
- Require an approved publication state.
- Use streaming or short-lived read SAS based on the threat model.
- Sanitize response headers and audit access.

<!-- question:end:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### Design a large-file upload architecture for a multi-tenant .NET application.

<!-- question:start:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-advanced-q01 -->
<!-- question-id:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

The API authenticates the user, enforces tenant quotas, creates a pending document and upload session, and generates a quarantine blob name containing trusted tenant and upload identifiers. It returns a short-lived user delegation SAS for that object. The browser performs a block upload directly to storage and can persist its block manifest for resume.

An idempotent completion endpoint verifies expected length, checksum, and blob identity. An outbox starts scanning and processing. Only a successful conditional state transition publishes the document. Downloads resolve an opaque document ID after tenant authorization. Reconciliation handles expired sessions, orphan blobs, duplicate messages, and stuck scans.

##### Key Points to Mention

- Server-controlled names and tenant-scoped authorization.
- Object-scoped delegated access.
- Durable upload and document state.
- Quarantine, scanning, and explicit publication.
- Idempotent completion, outbox, and reconciliation.

<!-- question:end:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-advanced-q01 -->

#### How do you handle an upload whose final request timed out but may have succeeded?

<!-- question:start:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-advanced-q02 -->
<!-- question-id:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Treat the outcome as unknown rather than failed. Re-read blob properties or the committed block list, compare the target name, length, checksum, ETag, and upload-session state, and then complete the workflow idempotently if the expected object exists.

Do not create a second random target on every retry. Stable upload IDs and deterministic blob names make reconciliation possible. If the blob is incomplete, resume missing blocks or safely restart according to policy.

##### Key Points to Mention

- Timeout does not prove the server rejected the operation.
- Reconcile by reading authoritative state.
- Stable identifiers make retries idempotent.
- Verify content before publication.
- Cleanup handles abandoned or superseded data.

<!-- question:end:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-advanced-q02 -->

#### How would you divide metadata among SQL, blob metadata, and blob index tags?

<!-- question:start:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-advanced-q03 -->
<!-- question-id:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Keep authoritative business metadata in SQL: ownership, tenant, original filename, workflow status, retention classification, relationships, and audit references. Use blob metadata for small technical values that should accompany the object, such as a pipeline schema version. Use index tags for storage-side filtering or lifecycle rules.

Duplicate only values with a defined purpose and ownership rule. When duplicated values change, define which store is authoritative and how reconciliation updates the derived copy.

##### Key Points to Mention

- SQL owns transactional and relational business state.
- Blob metadata carries limited object-local technical properties.
- Index tags support storage queries and lifecycle filters.
- Avoid sensitive or unbounded metadata duplication.
- Define authority, synchronization, and reconciliation.

<!-- question:end:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-advanced-q03 -->

#### What threats should be considered in a direct browser upload flow?

<!-- question:start:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-advanced-q04 -->
<!-- question-id:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Threats include stolen SAS tokens, excessive permissions, cross-tenant paths, quota exhaustion, malicious content, content-type spoofing, decompression bombs, duplicate completion, overwrite races, public exposure, token leakage through logs, and orphan accumulation.

Mitigations include short-lived object-scoped user delegation SAS, server-generated names, tenant quotas, size limits, CORS restricted to trusted origins, quarantine, content inspection, malware scanning, checksums, conditional writes, idempotent state transitions, private or restricted networking where appropriate, and monitored cleanup.

##### Key Points to Mention

- CORS is not an authorization control.
- SAS is a bearer credential and must be minimized.
- File validation happens after transfer and before publication.
- Object-level authorization is enforced by the application.
- Abuse controls, monitoring, and cleanup are part of security.

<!-- question:end:dotnet-blob-clients-direct-browser-upload-and-separating-metadata-from-binary-content-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
