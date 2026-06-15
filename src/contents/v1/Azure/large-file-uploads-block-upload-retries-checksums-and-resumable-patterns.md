---
id: large-file-uploads-block-upload-retries-checksums-and-resumable-patterns
topic: Azure Blob Storage and file handling
subtopic: Large file uploads, block upload, retry behavior, checksums, and resumable upload patterns
category: Azure
---

## Overview

Large file upload design is a distributed workflow, not merely a call to `UploadAsync`. Networks fail, browsers close, processes restart, requests time out after the server may have accepted data, and several clients can target the same object.

Azure block blobs support reliable large uploads by dividing a file into blocks:

1. Generate a stable upload ID and target blob name.
2. Split the content into numbered blocks.
3. Stage blocks independently, often in parallel.
4. Retry only failed blocks.
5. Persist upload progress outside process memory.
6. Commit an ordered block list.
7. Verify final length and checksum.
8. Mark the business record complete.

Until the block list is committed, staged blocks do not form the visible blob. This provides a useful atomic publication boundary.

For interviews, candidates should distinguish:

- SDK request retries from resumability across application restarts.
- Transfer checksums from a whole-file business checksum.
- A timeout from a known failed write.
- Parallelism from uncontrolled concurrency.
- Upload completion from content validation and publication.
- Server-proxied upload from direct-to-Blob browser upload.

## Core Concepts

### Why Large Uploads Fail Differently

Large uploads are exposed to:

- Wi-Fi and mobile-network changes.
- Reverse-proxy request limits.
- Application restarts.
- Browser tab closure.
- Authentication token expiry.
- Storage throttling.
- Client memory pressure.
- Long request timeouts.
- Duplicate retries.
- Concurrent upload attempts.

One long HTTP request forces the entire transfer to restart after a failure. Block upload limits the retry scope to one block.

### Single-Request Versus Block Upload

The .NET SDK can upload a small block blob with one `Put Blob` request. For larger data it can stage blocks and commit them automatically according to `StorageTransferOptions`.

Use high-level `UploadAsync` when:

- Resume is needed only within the current SDK operation.
- Default or tuned SDK partitioning is sufficient.
- The process is expected to remain alive.
- The application does not need to persist per-block state.

Use explicit `StageBlockAsync` and `CommitBlockListAsync` when:

- Uploads must resume after process or browser restart.
- The application must display durable progress.
- Blocks are uploaded by several workers or clients.
- The server must validate an expected block manifest.
- A business workflow needs explicit staged and committed states.

### Block Blob Model

A block blob can contain up to 50,000 committed blocks. Modern service versions support very large blocks, producing a theoretical maximum near 190.7 TiB.

Practical limits usually come from:

- Available memory.
- Network bandwidth.
- Client timeout.
- Transaction cost.
- Account throughput.
- User experience.
- Downstream scanning and processing.

Do not choose block size solely from the service maximum.

### Deterministic Block IDs

Block IDs are Base64-encoded strings and must have equal encoded length within a blob.

A deterministic scheme:

```csharp
static string CreateBlockId(int index) =>
    Convert.ToBase64String(
        Encoding.UTF8.GetBytes(index.ToString("D8")));
```

This produces stable IDs:

```text
00000000
00000001
00000002
```

Deterministic IDs allow a restarted client to identify which blocks are already staged. Random GUID block IDs make reconciliation harder unless every ID is persisted.

### Upload Session Record

Persist an upload session in a durable database:

```text
UploadId
TenantId
BlobName
ExpectedLength
BlockSize
ExpectedBlockCount
WholeFileChecksum
ChecksumAlgorithm
Status
CreatedAt
ExpiresAt
```

Optional per-block state can include:

```text
UploadId
BlockIndex
BlockId
Length
Checksum
Status
AttemptCount
```

The record prevents the upload from depending on one application process.

### Server-Controlled Blob Names

Generate blob names on the trusted server:

```text
quarantine/{tenant-id}/{upload-id}
```

Do not let a browser choose an arbitrary final path. Server-controlled names prevent:

- Tenant path confusion.
- Overwriting another user's file.
- Unsafe filenames.
- Guessable business identifiers.
- Mutable display names becoming storage identity.

Store the original filename separately after validation.

### Upload State Machine

Useful states include:

```text
Pending
Uploading
Committed
Scanning
Available
Rejected
Expired
Failed
```

State transitions should be conditional. For example, only the expected upload owner can move `Uploading` to `Committed`.

Blob existence alone should not mean the file is safe to expose.

### Tuning `StorageTransferOptions`

The .NET SDK exposes:

- `InitialTransferSize`
- `MaximumTransferSize`
- `MaximumConcurrency`

Example:

```csharp
var options = new BlobUploadOptions
{
    TransferOptions = new StorageTransferOptions
    {
        InitialTransferSize = 16 * 1024 * 1024,
        MaximumTransferSize = 8 * 1024 * 1024,
        MaximumConcurrency = 4
    }
};

await blobClient.UploadAsync(stream, options, cancellationToken);
```

These values are environment-specific, not universal recommendations.

### Initial Transfer Size

For a seekable stream, a blob smaller than `InitialTransferSize` can be uploaded in one request. A larger stream is partitioned into subtransfers.

A larger initial request:

- Reduces request overhead for medium files.
- Costs more to retry.
- Requires a stable connection for longer.

For unreliable networks, smaller requests can be more robust.

### Maximum Transfer Size

`MaximumTransferSize` controls the maximum subtransfer size.

Larger blocks:

- Reduce transaction count.
- Improve throughput on fast networks.
- Increase retry cost.
- Increase buffering needs for non-seekable streams.

Smaller blocks:

- Improve retry granularity.
- Increase request count and block-list size.
- Can reduce peak buffering.

Always ensure:

```text
ceil(file length / block size) <= 50,000
```

### Maximum Concurrency

Concurrency allows several blocks to upload in parallel.

Benefits:

- Better bandwidth utilization.
- Lower total upload duration.

Risks:

- Memory pressure.
- Client connection exhaustion.
- Storage throttling.
- Unstable tail latency.
- Mobile-device resource usage.

Increase concurrency only while measured throughput improves. Use asynchronous methods because synchronous SDK operations do not parallelize transfer workers in the same way.

### Seekable and Non-Seekable Streams

A seekable stream can move its position and supports easier retry. A non-seekable stream cannot replay bytes after they are consumed.

The SDK buffers individual subtransfers from non-seekable streams to make request retries possible. Large transfer sizes and high concurrency can therefore multiply memory use:

```text
Approximate buffering
= block size x active workers
```

For large server uploads, prefer a seekable file stream or explicit staging rather than buffering the entire request body.

### SDK Retry Behavior

Azure SDK clients use bounded retry policies for transient errors such as:

- Network failures.
- HTTP 408.
- HTTP 429.
- Selected 5xx responses.

Retries should use exponential backoff with jitter and respect server guidance such as `Retry-After`.

Avoid:

- Infinite retries.
- Retrying authorization failures.
- Retrying checksum mismatch without rereading the source.
- Immediate parallel retry storms.
- Extending retries beyond the user or request deadline.

The SDK retries individual requests. It does not automatically preserve a manual upload workflow across process termination.

### Request Retry Versus Workflow Resume

These are separate layers:

**Request retry**

- Repeats one failed HTTP operation.
- Usually handled by the SDK.
- Lives within the current process.

**Workflow resume**

- Continues a multi-block upload after process or browser restart.
- Requires stable upload ID and block IDs.
- Requires persisted state or listing uncommitted blocks.
- Must refresh expired authorization.

A reliable system implements both.

### Unknown Outcomes

A timeout does not prove that a write failed. The service might have accepted the block but the response was lost.

After an uncertain result:

1. Query staged blocks or blob properties.
2. Compare the deterministic block ID, expected length, ETag, or checksum.
3. Treat the operation as successful if the intended state exists.
4. Retry only if it does not.

This is idempotent recovery.

### Listing Uncommitted Blocks

A resumed block upload can request the uncommitted block list and compare it with the expected manifest.

The client should still verify:

- Block ID.
- Expected length.
- Optional block checksum.
- Upload ownership.

Do not commit every uncommitted block found under an attacker-controlled or reused blob name. Commit only the server-approved ordered manifest.

### Atomic Commit

`CommitBlockListAsync` defines the visible blob content from the ordered IDs.

If a referenced block is missing, commit fails and the previous committed blob remains unchanged.

Use conditions:

```csharp
var commitOptions = new CommitBlockListOptions
{
    Conditions = new BlobRequestConditions
    {
        IfNoneMatch = ETag.All
    }
};
```

Create-only semantics prevent accidental overwrite. For intended replacement, use `If-Match` with the expected ETag.

### Transfer Checksums

The .NET SDK supports upload transfer validation using:

- Automatic algorithm selection.
- MD5.
- Storage CRC64.

Example:

```csharp
var options = new BlobUploadOptions
{
    TransferValidation = new UploadTransferValidationOptions
    {
        ChecksumAlgorithm = StorageChecksumAlgorithm.Auto
    }
};

await blobClient.UploadAsync(stream, options, cancellationToken);
```

The service computes a checksum for the request payload and rejects a mismatch.

### Checksum Mismatch

A checksum mismatch indicates that the transmitted bytes do not match the supplied checksum. It normally produces a 400 response and is not treated as a transient failure by the default retry policy.

The application should:

- Reopen or rewind the source.
- Recalculate the checksum.
- Investigate source mutation.
- Avoid repeatedly resending corrupted buffered data.

Do not catch every failure and retry it as transient.

### Whole-File Checksums

Per-request checksums validate blocks in transit. They do not necessarily prove that the final object is the exact business file expected by the application.

Calculate a whole-file digest such as SHA-256:

```csharp
static async Task<string> ComputeSha256Async(
    Stream stream,
    CancellationToken cancellationToken)
{
    using var sha256 = SHA256.Create();
    var hash = await sha256.ComputeHashAsync(stream, cancellationToken);
    return Convert.ToHexString(hash);
}
```

Store the expected digest in the authoritative upload record. After commit, verify the final object or trusted manifest.

SHA-256 is useful for identity and tamper detection. MD5 and CRC64 are primarily transport-integrity mechanisms in this context.

### Source Mutation During Upload

If a local file changes during upload, blocks can come from different file states.

Mitigations:

- Open the file with restrictive sharing.
- Record size and modification time.
- Compute a whole-file digest.
- Upload from an immutable temporary copy.
- Reject the commit if source state changed.

For browser `File` objects, treat the selected object as the upload source and calculate a digest if the workflow requires it.

### Retry-Safe Block Staging

Staging the same bytes under the same block ID is idempotent. The later block replaces the earlier uncommitted block for that ID.

This makes deterministic block IDs useful. A retry does not add duplicate content when the final block list includes each ID once.

The commit request itself should also be retry-safe because the same ordered list produces the same blob content, subject to conditions and metadata.

### Browser Resumability

For direct browser upload:

1. API creates an upload session.
2. API issues a short user delegation SAS.
3. Browser splits the `File` into chunks.
4. Browser stages blocks and persists local progress.
5. On restart, browser asks the API to resume.
6. API reauthorizes and issues a fresh SAS.
7. Browser compares expected and staged blocks.
8. Browser stages missing blocks.
9. API or browser commits the approved manifest.

Browser storage should not be the only source of truth. The server must know the upload owner, target, expected size, and expiry.

### SAS Expiry During Upload

A long transfer can outlive its SAS.

Do not issue a day-long broad SAS. Instead:

- Choose a reasonable short lifetime for expected blocks.
- Allow the authenticated client to request a replacement.
- Keep the same upload ID and blob name.
- Recheck business authorization before renewal.

Already staged blocks remain available until their storage retention window; a new valid token can continue the workflow.

### Server Proxy Versus Direct Upload

**Server-proxied upload**

- Simpler browser authorization.
- Allows inline validation.
- Consumes application bandwidth and compute.
- Can hit request-size and timeout limits.

**Direct-to-Blob upload**

- Removes large payloads from the API.
- Scales storage transfer independently.
- Requires SAS issuance, CORS, and completion validation.
- Exposes the storage endpoint to the browser.

Use direct upload for large files when the security workflow is designed correctly.

### CORS

Browser direct upload requires Blob service CORS configuration for:

- Approved origins.
- Required methods.
- Required request headers.
- Exposed response headers.
- Preflight cache duration.

CORS is browser enforcement, not storage authorization. A non-browser client can ignore it. The SAS or identity still controls access.

Avoid wildcard origins for authenticated upload applications.

### Quarantine and Publication

Upload untrusted data to a private quarantine location.

After commit:

- Verify expected size.
- Verify checksum.
- Inspect content signature, not only extension.
- Scan for malware.
- Enforce file-type and decompression limits.
- Extract metadata safely.
- Move or copy to an approved location.
- Mark the business record available.

A successful upload only proves that bytes reached storage.

### Idempotent Completion

The completion endpoint should be safe to call repeatedly.

It can:

- Load the upload session.
- Return success if already completed.
- Verify the committed blob matches the expected manifest.
- Transition state using a concurrency token.
- Publish one outbox event.

This avoids duplicate processing when a client retries after losing the completion response.

### Cancellation and Deadlines

Pass cancellation tokens to SDK calls. Stopping abandoned work reduces:

- Wasted bandwidth.
- Application resources.
- User confusion.

Cancellation does not guarantee the service did not accept the last request. Reconcile state before continuing or deleting staged data.

### Cleanup

Clean up:

- Expired upload sessions.
- Committed but rejected quarantine blobs.
- Unreferenced completed blobs.
- Temporary server files.

Uncommitted blocks expire automatically after the service retention window, but application records and any placeholder objects require explicit cleanup.

Use a grace period so an active slow upload is not deleted.

### Observability

Track:

- Upload size.
- Duration.
- Throughput.
- Block count and size.
- Retry count.
- Failure status and error code.
- Resume count.
- Checksum mismatch.
- Commit latency.
- Scan duration.
- Abandoned sessions.

Use a correlation ID across API, browser telemetry, storage operations, and processing workers. Never log SAS query strings.

### Common Mistakes

Common mistakes include:

- Uploading multi-gigabyte files through one API request.
- Assuming SDK retry provides restart-safe resume.
- Generating random block IDs without persisting them.
- Retrying every error.
- Ignoring unknown outcomes after timeouts.
- Using too much concurrency.
- Buffering whole files in application memory.
- Trusting file extensions or browser content types.
- Publishing immediately after commit.
- Issuing broad, long-lived container SAS.
- Allowing unconditional overwrite.
- Treating per-block checksums as a complete malware or authenticity check.

### Best-Practice Upload Checklist

A production design should normally:

- Use block blobs.
- Generate upload and blob IDs on the server.
- Persist upload state.
- Use deterministic equal-length block IDs.
- Tune block size and concurrency through realistic tests.
- Use bounded transient retries with jitter.
- Reconcile unknown outcomes.
- Validate transfer and whole-file checksums.
- Commit with create-only or ETag conditions.
- Use short per-object user delegation SAS for browser uploads.
- Separate upload, validation, and publication.
- Make completion idempotent.
- Clean expired and rejected data.
- Monitor end-to-end transfer and processing.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### Why are block blobs suitable for large file uploads?

<!-- question:start:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-beginner-q01 -->
<!-- question-id:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Block blobs let a client divide a file into independently staged blocks. Blocks can upload in parallel and failed blocks can retry without retransmitting the whole file. An ordered block-list commit atomically publishes the final object.

This model supports high throughput, bounded retry cost, resumability, and very large objects.

##### Key Points to Mention

- Blocks are uploaded independently.
- Parallel transfer improves bandwidth use.
- Only failed blocks need retry.
- Commit defines final order and visibility.

<!-- question:end:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-beginner-q01 -->

#### What is the difference between retry and resume?

<!-- question:start:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-beginner-q02 -->
<!-- question-id:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

Retry repeats one failed request during the current operation, usually through the SDK's transient-fault policy. Resume continues the overall upload after the process, browser, or network session ended.

Resume requires a stable upload ID, deterministic block IDs, durable progress, and a way to list or verify staged blocks. SDK retries alone do not provide cross-process resumability.

##### Key Points to Mention

- Retry operates at request scope.
- Resume operates at workflow scope.
- Resume state must survive process restart.
- Both layers are required for robust uploads.

<!-- question:end:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-beginner-q02 -->

#### Why use checksums during upload?

<!-- question:start:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-beginner-q03 -->
<!-- question-id:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Transfer checksums let Azure Storage verify that transmitted bytes match what the client sent. A mismatch rejects the request rather than storing corrupted transfer data.

A whole-file SHA-256 digest can separately verify that the final committed object matches the business file expected by the application. Checksums do not replace malware scanning or file-type validation.

##### Key Points to Mention

- MD5 or CRC64 can validate transfer integrity.
- A whole-file digest validates final identity.
- Mismatch is not normally a transient retry case.
- Checksums do not prove content safety.

<!-- question:end:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-beginner-q03 -->

#### What happens to staged blocks before commit?

<!-- question:start:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-beginner-q04 -->
<!-- question-id:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

They remain uncommitted and are not part of the visible blob content. The client can list them and later commit an ordered subset.

Uncommitted blocks are eventually discarded if not committed. Application upload-session records and temporary resources still require explicit expiry and cleanup.

##### Key Points to Mention

- Staged blocks are not visible final content.
- Commit selects and orders blocks.
- Resume can inspect staged block IDs.
- Uncommitted data has a limited service lifetime.

<!-- question:end:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### How do you select block size and concurrency?

<!-- question:start:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-intermediate-q01 -->
<!-- question-id:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

Measure file size, network bandwidth and reliability, client memory, transaction cost, device limits, account throughput, and retry tolerance. Larger blocks reduce request count but cost more to retry and buffer. More concurrency improves throughput until the client, network, or service saturates.

Ensure the file fits within 50,000 blocks. Benchmark representative networks and payloads, use bounded concurrency, and reduce pressure when throttling or memory growth appears.

##### Key Points to Mention

- Block size trades transactions against retry granularity.
- Concurrency consumes connections and memory.
- Non-seekable streams require buffering.
- Production-like tests determine good settings.

<!-- question:end:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-intermediate-q01 -->

#### How would you resume an upload after the application restarts?

<!-- question:start:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-intermediate-q02 -->
<!-- question-id:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Load the durable upload session containing target name, block size, count, and checksum. Reauthorize the caller, create a new SAS if needed, list staged blocks, and compare them with the deterministic expected manifest.

Upload missing or invalid blocks, then commit only the approved ordered IDs using a conditional request. Verify final length and digest before changing the business state to complete.

##### Key Points to Mention

- Persist manifest and ownership.
- Stable block IDs make comparison possible.
- Refresh authorization independently of upload identity.
- Verify before commit and publication.

<!-- question:end:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-intermediate-q02 -->

#### How should an application handle an upload timeout?

<!-- question:start:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-intermediate-q03 -->
<!-- question-id:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Treat the outcome as unknown rather than failed. Query the block list or final blob properties using the deterministic block ID, expected ETag, length, or checksum.

If the intended state exists, continue as success. Otherwise retry the idempotent operation with bounded backoff. This prevents duplicate work or conflicting commits after a response is lost.

##### Key Points to Mention

- Timeout does not prove rejection.
- Reconcile remote state before retry.
- Deterministic IDs enable idempotency.
- Avoid blind retry of non-idempotent operations.

<!-- question:end:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-intermediate-q03 -->

#### Why separate upload completion from publication?

<!-- question:start:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-intermediate-q04 -->
<!-- question-id:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Commit proves that storage assembled the selected bytes. It does not prove the file belongs to the caller, matches the declared type, has the expected business checksum, or is free of malware.

Keep committed uploads in quarantine, validate them in a trusted process, and only then mark the metadata record available or move the content to an approved location.

##### Key Points to Mention

- Storage success is not business validation.
- Quarantine prevents premature exposure.
- Validate size, digest, type, and malware.
- Publication should be an explicit state transition.

<!-- question:end:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### Design a resumable browser upload for multi-gigabyte files.

<!-- question:start:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-advanced-q01 -->
<!-- question-id:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

The API authenticates and authorizes the user, checks quota, creates an upload session, and generates a private quarantine blob name. It returns a short-lived per-object user delegation SAS and an expected block manifest.

The browser slices the file, stages deterministic blocks with bounded concurrency and checksums, and reports progress. Progress is persisted locally for user experience but the server remains authoritative. After restart, the browser reauthenticates, receives a new SAS, lists staged blocks, and uploads only missing blocks.

Commit uses the approved ordered IDs and create-only conditions. A trusted worker verifies length, SHA-256, content type, and malware status before publication. Expired sessions and rejected files are cleaned asynchronously.

##### Key Points to Mention

- Durable server-side upload state.
- Short renewable SAS rather than broad long-lived access.
- Deterministic blocks and remote reconciliation.
- Quarantine, validation, idempotent completion, and cleanup.

<!-- question:end:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-advanced-q01 -->

#### How would you prevent duplicate or conflicting final commits?

<!-- question:start:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-advanced-q02 -->
<!-- question-id:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Use one server-approved manifest per upload session and a conditional commit. For a new object use `If-None-Match: *`; for replacement use `If-Match` with the expected ETag. Transition the upload database row with optimistic concurrency so only one completion wins.

If the response is lost, reload the row and blob properties. If the committed content matches the manifest and checksum, return the existing successful result. Publish downstream processing through an outbox so repeated completion calls produce one event.

##### Key Points to Mention

- Conditional storage writes prevent accidental overwrite.
- Database concurrency controls the business transition.
- Completion must be idempotent.
- Outbox prevents duplicate downstream work.

<!-- question:end:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-advanced-q02 -->

#### How would you tune uploads for a server receiving non-seekable request streams?

<!-- question:start:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-advanced-q03 -->
<!-- question-id:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Non-seekable streams require the SDK to buffer each subtransfer for retries. Estimate memory as block size multiplied by concurrency and simultaneous uploads. Use smaller transfer sizes, bounded workers, application admission control, and asynchronous I/O.

For very large or high-volume uploads, avoid proxying through the server and use direct-to-Blob SAS. If proxying is required for inspection, spool to a controlled seekable temporary file or stream through a scanner with strict limits and backpressure.

##### Key Points to Mention

- Non-seekable retry requires buffering.
- Concurrency multiplies memory across uploads.
- Admission control prevents resource exhaustion.
- Direct upload removes application bandwidth pressure.

<!-- question:end:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-advanced-q03 -->

#### What failure tests should be run before releasing a large-upload system?

<!-- question:start:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-advanced-q04 -->
<!-- question-id:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Test network interruption during each block, lost responses after successful stage and commit, browser and server restarts, SAS expiry, duplicate completion calls, storage throttling, checksum mismatch, source mutation, malicious file types, concurrent overwrite attempts, scan failure, and cleanup races.

Also load-test many simultaneous uploads across realistic bandwidth and device profiles. Verify memory, connection count, transaction cost, retry amplification, monitoring, and recovery of abandoned sessions.

##### Key Points to Mention

- Inject uncertainty, not only explicit failures.
- Test authentication expiry and process restarts.
- Validate idempotency and cleanup.
- Measure resource use and cost under concurrency.

<!-- question:end:large-file-uploads-block-upload-retries-checksums-and-resumable-patterns-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
